import type { Request, Response } from 'express';
import { supabase } from '../lib/supabase.js';
import { webhookQueue } from '../lib/webhook-queue.js';
import { validateWebhookPayload } from '../lib/webhook-schemas.js';
import crypto from 'crypto';

/**
 * Verifica o token de autenticação de plataformas que usam segredo estático.
 * Retorna true se válido (ou se a plataforma não requer verificação).
 */
function verifyPlatformToken(platform: string, req: Request): boolean {
    if (platform === 'hotmart') {
        const expected = process.env.HOTMART_WEBHOOK_TOKEN;
        if (!expected) {
            // Token não configurado — loga aviso mas não bloqueia (evita quebrar em dev)
            console.warn('[Webhook] HOTMART_WEBHOOK_TOKEN não configurado — pulando verificação');
            return true;
        }
        const received = req.headers['x-hotmart-hottok'] as string | undefined;
        if (!received) {
            console.warn('[Webhook] Hotmart: token ausente');
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
        } catch {
            return false;
        }
    }
    return true;
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
                profile_id: profileId as string,
                platform,
                payload,
                processed: false
            })
            .select()
            .single();

        if (rawError) throw rawError;

        // 4. Respond immediately to the platform (webhook requirement)
        res.status(200).json({ status: 'received', id: rawData.id });

        // 5. Enfileira normalização com retry automático e backoff exponencial
        webhookQueue.enqueue(rawData.id, platform, payload, profileId as string);

    } catch (error: any) {
        console.error(`Webhook error for ${platform}:`, error);
        res.status(500).json({ error: 'Internal server error' });
    }
}
