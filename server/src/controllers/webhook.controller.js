import Stripe from 'stripe';
import crypto from 'crypto';
import { supabase } from '../lib/supabase.js';
import { webhookQueue } from '../lib/webhook-queue.js';
import { validateWebhookPayload } from '../lib/webhook-schemas.js';
import { decrypt } from '../utils/encryption.js';
// Lazy init — Stripe SDK throws if apiKey is empty
let _stripe = null;
function getStripe() {
    if (!_stripe) {
        const key = process.env.STRIPE_SECRET_KEY;
        if (!key)
            throw new Error('STRIPE_SECRET_KEY not configured');
        _stripe = new Stripe(key, { apiVersion: '2026-01-28.clover' });
    }
    return _stripe;
}
/**
 * Verifica o token de autenticação de plataformas que usam segredo estático.
 * Usa comparação em tempo constante (timingSafeEqual) para prevenir timing attacks.
 * Retorna true se válido.
 */
function verifyPlatformToken(platform, req) {
    if (platform === 'hotmart') {
        const expected = process.env.HOTMART_WEBHOOK_TOKEN;
        if (!expected) {
            console.error('[Webhook] HOTMART_WEBHOOK_TOKEN não configurado — rejeitando request');
            return false;
        }
        const received = req.headers['x-hotmart-hottok'];
        if (!received) {
            console.warn('[Webhook] Hotmart: header x-hotmart-hottok ausente');
            return false;
        }
        // Comparação timing-safe para prevenir timing attacks
        try {
            const expectedBuf = Buffer.from(expected, 'utf8');
            const receivedBuf = Buffer.from(received, 'utf8');
            if (expectedBuf.length !== receivedBuf.length || !crypto.timingSafeEqual(expectedBuf, receivedBuf)) {
                console.warn('[Webhook] Hotmart: token inválido');
                return false;
            }
        }
        catch {
            return false;
        }
    }
    return true;
}
/**
 * Handles Stripe Connect webhooks.
 * Requires raw body (express.raw) — must be mounted BEFORE express.json().
 * Verifies HMAC signature and looks up profile via stripe_user_id.
 */
export async function handleStripeWebhook(req, res) {
    const sig = req.headers['stripe-signature'];
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret) {
        console.error('[StripeWebhook] STRIPE_WEBHOOK_SECRET not configured');
        return res.status(500).json({ error: 'Webhook secret not configured' });
    }
    if (!sig) {
        return res.status(400).json({ error: 'Missing stripe-signature header' });
    }
    let event;
    try {
        event = getStripe().webhooks.constructEvent(req.body, sig, webhookSecret);
    }
    catch (err) {
        console.warn('[StripeWebhook] Signature verification failed:', err.message);
        return res.status(400).json({ error: `Webhook Error: ${err.message}` });
    }
    // For Stripe Connect, every event includes the connected account ID
    const stripeAccountId = event.account;
    let profileId = null;
    if (stripeAccountId) {
        const { data: integrations } = await supabase
            .from('integrations')
            .select('profile_id, config_encrypted')
            .eq('platform', 'stripe')
            .eq('status', 'active');
        for (const intg of integrations || []) {
            try {
                const tokens = JSON.parse(decrypt(intg.config_encrypted.data));
                if (tokens.stripe_user_id === stripeAccountId) {
                    profileId = intg.profile_id;
                    break;
                }
            }
            catch { /* skip corrupt record */ }
        }
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
export async function handleHotmartWebhook(req, res) {
    const profileId = req.params.profileId;
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
    const payload = req.body;
    const validation = validateWebhookPayload('hotmart', payload);
    if (!validation.success) {
        console.warn(`[Webhook] Hotmart: invalid payload for profile ${profileId}:`, validation.errors);
        return res.status(400).json({ error: 'Invalid payload', details: validation.errors });
    }
    try {
        // 4. Persistir raw data (audit trail)
        const { data: rawData, error: rawError } = await supabase
            .from('platforms_data_raw')
            .insert({ profile_id: profileId, platform: 'hotmart', payload, processed: false })
            .select('id')
            .single();
        if (rawError)
            throw rawError;
        // 5. Responder imediatamente — Hotmart exige resposta rápida ou retenta
        res.status(200).json({ status: 'received', id: rawData.id });
        // 6. Enfileira normalização com retry automático
        webhookQueue.enqueue(rawData.id, 'hotmart', payload, profileId);
    }
    catch (error) {
        console.error(`[Webhook] Hotmart error for profile ${profileId}:`, error.message);
        if (!res.headersSent) {
            res.status(500).json({ error: 'Internal server error' });
        }
    }
}
/**
 * Handles incoming webhooks by persisting raw data and triggering normalization.
 * Valida o payload antes de persistir — rejeita com 400 se inválido.
 */
export async function handleWebhook(req, res) {
    const { platform } = req.params;
    const payload = req.body;
    const profileId = req.headers['x-profile-id'];
    if (!platform || typeof platform !== 'string') {
        return res.status(400).json({ error: 'Missing or invalid platform parameter' });
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
        console.warn(`[Webhook] Invalid payload for ${platform}:`, validation.errors);
        return res.status(400).json({ error: 'Invalid payload', details: validation.errors });
    }
    try {
        // 3. Persist raw data for safety (Audit Trail)
        const { data: rawData, error: rawError } = await supabase
            .from('platforms_data_raw')
            .insert({
            profile_id: profileId,
            platform,
            payload,
            processed: false
        })
            .select()
            .single();
        if (rawError)
            throw rawError;
        // 4. Respond immediately to the platform (webhook requirement)
        res.status(200).json({ status: 'received', id: rawData.id });
        // 5. Enfileira normalização com retry automático e backoff exponencial
        webhookQueue.enqueue(rawData.id, platform, payload, profileId);
    }
    catch (error) {
        console.error(`Webhook error for ${platform}:`, error);
        res.status(500).json({ error: 'Internal server error' });
    }
}
//# sourceMappingURL=webhook.controller.js.map