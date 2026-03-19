import type { Request, Response } from 'express';
import Stripe from 'stripe';
import crypto from 'crypto';
import { supabase } from '../lib/supabase.js';
import { webhookQueue } from '../lib/webhook-queue.js';
import { validateWebhookPayload } from '../lib/webhook-schemas.js';

// Lazy init — Stripe SDK throws if apiKey is empty
let _stripe: Stripe | null = null;
function getStripe(): Stripe {
    if (!_stripe) {
        const key = process.env.STRIPE_SECRET_KEY;
        if (!key) throw new Error('STRIPE_SECRET_KEY not configured');
        _stripe = new Stripe(key, { apiVersion: '2026-01-28.clover' as Stripe.LatestApiVersion });
    }
    return _stripe;
}

/**
 * Verifica o token de autenticação de plataformas que usam segredo estático.
 * Usa comparação em tempo constante (timingSafeEqual) para prevenir timing attacks.
 * Retorna true se válido.
 */
function verifyPlatformToken(platform: string, req: Request): boolean {
    if (platform === 'hotmart') {
        // Método 1 (preferido): HMAC-SHA256 via x-hotmart-signature (Hotmart API v2.0)
        const hmacSignature = req.headers['x-hotmart-signature'] as string | undefined;
        const hmacSecret = process.env.HOTMART_WEBHOOK_SECRET;

        if (hmacSignature && hmacSecret) {
            try {
                // req.body é Buffer (express.raw montado antes do express.json)
                const rawBody = Buffer.isBuffer(req.body) ? req.body : Buffer.from(JSON.stringify(req.body));
                const expected = crypto
                    .createHmac('sha256', hmacSecret)
                    .update(rawBody)
                    .digest('hex');
                const expectedBuf = Buffer.from(expected, 'hex');
                const receivedBuf = Buffer.from(hmacSignature, 'hex');
                if (expectedBuf.length === receivedBuf.length && crypto.timingSafeEqual(expectedBuf, receivedBuf)) {
                    return true;
                }
                console.warn('[Webhook] Hotmart: HMAC inválido');
                return false;
            } catch {
                return false;
            }
        }

        // Método 2 (fallback): hottok estático via x-hotmart-hottok
        const expected = process.env.HOTMART_WEBHOOK_TOKEN;
        const received = req.headers['x-hotmart-hottok'] as string | undefined;

        if (expected && received) {
            try {
                const expectedBuf = Buffer.from(expected, 'utf8');
                const receivedBuf = Buffer.from(received, 'utf8');
                if (expectedBuf.length !== receivedBuf.length || !crypto.timingSafeEqual(expectedBuf, receivedBuf)) {
                    console.warn('[Webhook] Hotmart: token hottok inválido');
                    return false;
                }
                return true;
            } catch {
                return false;
            }
        }

        // Sem token configurado — rejeitar para prevenir injeção de vendas falsas
        console.warn('[Webhook] Hotmart: nenhum segredo configurado (HOTMART_WEBHOOK_SECRET ou HOTMART_WEBHOOK_TOKEN). Configure um dos dois para ativar o webhook.');
        return false;
    }
    // Plataforma sem verificação configurada — rejeitar
    console.warn(`[Webhook] Platform "${platform}" has no token verification configured — rejecting`);
    return false;
}

/**
 * Handles Stripe Connect webhooks.
 * Requires raw body (express.raw) — must be mounted BEFORE express.json().
 * Verifies HMAC signature and looks up profile via stripe_user_id.
 */
export async function handleStripeWebhook(req: Request, res: Response) {
    const sig = req.headers['stripe-signature'] as string;
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!webhookSecret) {
        console.error('[StripeWebhook] STRIPE_WEBHOOK_SECRET not configured');
        return res.status(500).json({ error: 'Webhook secret not configured' });
    }

    if (!sig) {
        return res.status(400).json({ error: 'Missing stripe-signature header' });
    }

    let event: Stripe.Event;
    try {
        event = getStripe().webhooks.constructEvent(req.body as Buffer, sig, webhookSecret);
    } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : String(err);
        console.warn('[StripeWebhook] Signature verification failed:', errMsg);
        return res.status(400).json({ error: `Webhook Error: ${errMsg}` });
    }

    // For Stripe Connect, every event includes the connected account ID
    const stripeAccountId: string | undefined = (event as unknown as { account?: string }).account;

    let profileId: string | null = null;

    if (stripeAccountId) {
        // Lookup direto via coluna indexada (sem decrypt loop)
        const { data: match } = await supabase
            .from('integrations')
            .select('profile_id')
            .eq('platform', 'stripe')
            .eq('status', 'active')
            .eq('stripe_account_id', stripeAccountId)
            .single();

        profileId = match?.profile_id ?? null;
    }

    if (!profileId) {
        // Acknowledge Stripe but skip processing — account not linked to any profile
        console.log(`[StripeWebhook] No profile for Stripe account ${stripeAccountId} — event ${event.type} ack'd`);
        return res.status(200).json({ received: true });
    }

    const { data: rawData, error: rawError } = await supabase
        .from('platforms_data_raw')
        .insert({ profile_id: profileId, platform: 'stripe', payload: event, processed: false })
        .select('id')
        .single();

    if (rawError) {
        console.error('[StripeWebhook] Failed to persist raw event:', rawError.message);
        return res.status(500).json({ error: 'Failed to persist event' });
    }

    // Acknowledge immediately — Stripe requires fast response
    res.status(200).json({ received: true });

    webhookQueue.enqueue(rawData.id, 'stripe', event, profileId);
}

/**
 * Handles Hotmart webhooks via URL-based profile identification.
 * URL: POST /api/webhooks/hotmart/:profileId
 * Cada founder configura a URL única no painel da Hotmart — sem necessidade de header x-profile-id.
 */
export async function handleHotmartWebhook(req: Request, res: Response) {
    const profileId = req.params.profileId as string;

    if (!profileId) {
        return res.status(400).json({ error: 'Missing profileId in URL' });
    }

    // 1. Verificar token em tempo constante
    if (!verifyPlatformToken('hotmart', req)) {
        return res.status(401).json({ error: 'Unauthorized: invalid hotmart token' });
    }

    // 2. Confirmar que o profile tem integração Hotmart ativa
    const { data: integration } = await supabase
        .from('integrations')
        .select('id')
        .eq('profile_id', profileId)
        .eq('platform', 'hotmart')
        .eq('status', 'active')
        .single();

    if (!integration) {
        console.warn(`[Webhook] Hotmart: no active integration for profile ${profileId}`);
        return res.status(404).json({ error: 'Hotmart integration not found for this profile' });
    }

    // 3. Validar estrutura do payload
    const payload = Buffer.isBuffer(req.body) ? JSON.parse(req.body.toString()) : req.body;
    const validation = validateWebhookPayload('hotmart', payload);
    if (!validation.success) {
        const errs = (validation as { errors?: string[] }).errors ?? [];
        console.warn(`[Webhook] Hotmart: invalid payload for profile ${profileId}:`, errs);
        return res.status(400).json({ error: 'Invalid payload', details: errs });
    }

    try {
        // 4. Persistir raw data (audit trail)
        const { data: rawData, error: rawError } = await supabase
            .from('platforms_data_raw')
            .insert({ profile_id: profileId, platform: 'hotmart', payload, processed: false })
            .select('id')
            .single();

        if (rawError) throw rawError;

        // 5. Responder imediatamente — Hotmart exige resposta rápida ou retenta
        res.status(200).json({ status: 'received', id: rawData.id });

        // 6. Enfileira normalização com retry automático
        webhookQueue.enqueue(rawData.id, 'hotmart', payload, profileId);
    } catch (error: unknown) {
        console.error(`[Webhook] Hotmart error for profile ${profileId}:`, error instanceof Error ? error.message : String(error));
        if (!res.headersSent) {
            res.status(500).json({ error: 'Internal server error' });
        }
    }
}

/**
 * Handles Shopify webhooks via URL-based profile identification.
 * URL: POST /api/webhooks/shopify/:profileId
 * Verifica assinatura HMAC-SHA256 com o Shopify Webhook Secret.
 */
export async function handleShopifyWebhook(req: Request, res: Response) {
    const profileId = req.params.profileId as string;

    if (!profileId) {
        return res.status(400).json({ error: 'Missing profileId in URL' });
    }

    // 1. Verificar assinatura HMAC em tempo constante
    const sig = req.headers['x-shopify-hmac-sha256'] as string | undefined;
    const webhookSecret = process.env.SHOPIFY_WEBHOOK_SECRET;

    if (!webhookSecret) {
        console.error('[ShopifyWebhook] SHOPIFY_WEBHOOK_SECRET não configurado');
        return res.status(500).json({ error: 'Webhook secret not configured' });
    }

    if (!sig) {
        return res.status(400).json({ error: 'Missing x-shopify-hmac-sha256 header' });
    }

    const hmac = crypto.createHmac('sha256', webhookSecret)
        .update(req.body as Buffer)
        .digest('base64');

    try {
        if (!crypto.timingSafeEqual(Buffer.from(hmac), Buffer.from(sig))) {
            console.warn(`[ShopifyWebhook] Invalid HMAC for profile ${profileId}`);
            return res.status(401).json({ error: 'Invalid signature' });
        }
    } catch {
        return res.status(401).json({ error: 'Invalid signature' });
    }

    // 2. Confirmar integração ativa
    const { data: integration } = await supabase
        .from('integrations')
        .select('id')
        .eq('profile_id', profileId)
        .eq('platform', 'shopify')
        .eq('status', 'active')
        .single();

    if (!integration) {
        console.warn(`[ShopifyWebhook] No active Shopify integration for profile ${profileId}`);
        return res.status(404).json({ error: 'Shopify integration not found for this profile' });
    }

    const payload = JSON.parse((req.body as Buffer).toString());
    const topic = req.headers['x-shopify-topic'] as string; // e.g. 'orders/paid'

    // APP_UNINSTALLED: desativa integração imediatamente
    if (topic === 'app/uninstalled') {
        await supabase
            .from('integrations')
            .update({ status: 'revoked' })
            .eq('profile_id', profileId)
            .eq('platform', 'shopify');
        console.log(`[ShopifyWebhook] App uninstalled — integration revoked for profile ${profileId}`);
        return res.status(200).json({ received: true });
    }

    try {
        // 3. Persistir raw data (audit trail)
        const { data: rawData, error: rawError } = await supabase
            .from('platforms_data_raw')
            .insert({ profile_id: profileId, platform: 'shopify', payload: { ...payload, _topic: topic }, processed: false })
            .select('id')
            .single();

        if (rawError) throw rawError;

        // 4. Responder imediatamente — Shopify exige resposta rápida
        res.status(200).json({ received: true });

        // 5. Enfileira normalização com retry automático
        webhookQueue.enqueue(rawData.id, 'shopify', { ...payload, _topic: topic }, profileId);
    } catch (error: unknown) {
        console.error(`[ShopifyWebhook] Error for profile ${profileId}:`, error instanceof Error ? error.message : String(error));
        if (!res.headersSent) {
            res.status(500).json({ error: 'Internal server error' });
        }
    }
}

/**
 * Handles incoming webhooks by persisting raw data and triggering normalization.
 * Valida o payload antes de persistir — rejeita com 400 se inválido.
 */
export async function handleWebhook(req: Request, res: Response) {
    const { platform } = req.params;
    const payload = req.body;
    const profileId = req.headers['x-profile-id'];

    if (!platform || typeof platform !== 'string') {
        return res.status(400).json({ error: 'Missing or invalid platform parameter' });
    }

    const ALLOWED_WEBHOOK_PLATFORMS = new Set(['hotmart', 'stripe', 'shopify', 'meta', 'google']);
    if (!ALLOWED_WEBHOOK_PLATFORMS.has(platform)) {
        return res.status(400).json({ error: `Unsupported platform: ${platform}` });
    }

    if (!profileId || typeof profileId !== 'string') {
        return res.status(400).json({ error: 'Missing or invalid x-profile-id header' });
    }

    // 1. Verificar autenticidade da plataforma (token/assinatura)
    if (!verifyPlatformToken(platform, req)) {
        return res.status(401).json({ error: 'Unauthorized: invalid platform token' });
    }

    // 2. Validar estrutura do payload antes de qualquer persistência
    const validation = validateWebhookPayload(platform, payload);
    if (!validation.success) {
        const errs = (validation as { errors?: string[] }).errors ?? [];
        console.warn(`[Webhook] Invalid payload for ${platform}:`, errs);
        return res.status(400).json({ error: 'Invalid payload', details: errs });
    }

    try {
        // 3. Persist raw data for safety (Audit Trail)
        const { data: rawData, error: rawError } = await supabase
            .from('platforms_data_raw')
            .insert({
                profile_id: profileId as string,
                platform,
                payload,
                processed: false
            })
            .select('id')
            .single();

        if (rawError) throw rawError;

        // 4. Respond immediately to the platform (webhook requirement)
        res.status(200).json({ status: 'received', id: rawData.id });

        // 5. Enfileira normalização com retry automático e backoff exponencial
        webhookQueue.enqueue(rawData.id, platform, payload, profileId as string);

    } catch (error: unknown) {
        console.error(`Webhook error for ${platform}:`, error);
        res.status(500).json({ error: 'Internal server error' });
    }
}
