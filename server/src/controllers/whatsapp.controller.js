/**
 * @file whatsapp.controller.js
 * Endpoints da API WhatsApp Business
 */

import crypto from 'crypto';
import { supabase } from '../lib/supabase.js';
import {
    sendTextMessage,
    sendReactivationMessage,
    sendAlertMessage,
    logMessage,
    updateMessageStatus,
    testConnection,
    isConfigured,
} from '../services/whatsapp.service.js';

/**
 * GET /api/whatsapp/verify
 * Verificação do webhook Meta (challenge response)
 */
export async function verifyWebhook(req, res) {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode === 'subscribe' && token === process.env.WHATSAPP_VERIFY_TOKEN) {
        console.log('[WhatsApp] Webhook verificado com sucesso');
        return res.status(200).send(challenge);
    }
    return res.status(403).json({ error: 'Verificação falhou' });
}

/**
 * POST /api/whatsapp/webhook
 * Recebe eventos de status e mensagens recebidas do Meta
 */
export async function receiveWebhook(req, res) {
    // Verificar assinatura HMAC
    const signature = req.headers['x-hub-signature-256'];
    if (signature && process.env.WHATSAPP_APP_SECRET) {
        const expectedSig = 'sha256=' + crypto
            .createHmac('sha256', process.env.WHATSAPP_APP_SECRET)
            .update(JSON.stringify(req.body))
            .digest('hex');

        if (signature !== expectedSig) {
            return res.status(401).json({ error: 'Assinatura inválida' });
        }
    }

    // Processar eventos
    const body = req.body;
    if (body.object === 'whatsapp_business_account') {
        for (const entry of body.entry || []) {
            for (const change of entry.changes || []) {
                const value = change.value;

                // Atualização de status de mensagem
                if (value.statuses) {
                    for (const status of value.statuses) {
                        await updateMessageStatus(status.id, status.status).catch(console.error);
                    }
                }
            }
        }
    }

    res.status(200).json({ status: 'ok' });
}

/**
 * POST /api/whatsapp/send
 * Envia mensagem (autenticado)
 */
export async function sendMessage(req, res) {
    const profileId = req.headers['x-profile-id'];
    if (!profileId) return res.status(401).json({ error: 'Unauthorized' });

    const { to, type, text, templateName, params, growthActionId } = req.body;
    if (!to) return res.status(400).json({ error: 'Campo "to" é obrigatório' });

    if (!isConfigured()) {
        return res.status(503).json({ error: 'WhatsApp Business não configurado. Acesse Integrações para configurar.' });
    }

    try {
        let result;
        let content;

        if (type === 'reactivation') {
            result = await sendReactivationMessage(to, params || {});
            content = `Reativação: ${params?.customerName || to}`;
        } else if (type === 'alert') {
            result = await sendAlertMessage(to, params || {});
            content = `Alerta: ${params?.title || ''}`;
        } else if (type === 'text') {
            result = await sendTextMessage(to, text);
            content = text;
        } else {
            return res.status(400).json({ error: 'Tipo de mensagem inválido' });
        }

        const wamid = result?.messages?.[0]?.id;
        await logMessage(profileId, to, templateName || type, content, wamid, growthActionId);

        res.json({ data: { wamid, status: 'sent' } });
    } catch (err) {
        console.error('[WhatsApp] Erro ao enviar:', err.message);
        res.status(500).json({ error: err.message });
    }
}

/**
 * POST /api/whatsapp/test
 * Testa conexão com a API do WhatsApp
 */
export async function testWhatsApp(req, res) {
    const profileId = req.headers['x-profile-id'];
    if (!profileId) return res.status(401).json({ error: 'Unauthorized' });

    const result = await testConnection();
    res.json({ data: result });
}

/**
 * GET /api/whatsapp/status
 * Retorna status da configuração e mensagens recentes
 */
export async function getStatus(req, res) {
    const profileId = req.headers['x-profile-id'];
    if (!profileId) return res.status(401).json({ error: 'Unauthorized' });

    const configured = isConfigured();

    const { data: messages } = await supabase
        .from('whatsapp_messages')
        .select('id, to_number, template_name, status, created_at')
        .eq('profile_id', profileId)
        .order('created_at', { ascending: false })
        .limit(10);

    res.json({
        data: {
            configured,
            messages: messages || [],
        },
    });
}

/**
 * POST /api/whatsapp/send-alert
 * Envia alerta urgente para o founder (chamado internamente pelos jobs)
 * Protected by CRON_SECRET ou auth middleware
 */
export async function sendAlertToFounder(profileId, title, body) {
    if (!isConfigured()) return;

    // Buscar telefone do founder
    const { data: profile } = await supabase
        .from('profiles')
        .select('phone, workspace_config')
        .eq('id', profileId)
        .single();

    const phone = profile?.phone || profile?.workspace_config?.whatsapp_phone;
    if (!phone) return;

    try {
        const result = await sendAlertMessage(phone, { title, body });
        const wamid = result?.messages?.[0]?.id;
        await logMessage(profileId, phone, 'northie_alerta', `${title}: ${body}`, wamid);
    } catch (err) {
        console.error('[WhatsApp] Falha ao enviar alerta:', err.message);
    }
}
