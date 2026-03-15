/**
 * @file whatsapp.service.js
 * Integração com Meta WhatsApp Cloud API.
 * Envia mensagens template e texto para founders e seus clientes.
 */

import { supabase } from '../lib/supabase.js';

const GRAPH_API_VERSION = 'v19.0';
const GRAPH_API_BASE = `https://graph.facebook.com/${GRAPH_API_VERSION}`;

function getPhoneNumberId() {
    return process.env.WHATSAPP_PHONE_NUMBER_ID;
}

function getToken() {
    return process.env.WHATSAPP_TOKEN;
}

function isConfigured() {
    return !!(getToken() && getPhoneNumberId());
}

/**
 * Envia mensagem de texto simples (apenas para testes ou mensagens ad-hoc)
 */
export async function sendTextMessage(to, text) {
    if (!isConfigured()) throw new Error('WhatsApp não configurado');

    const phoneId = getPhoneNumberId();
    const url = `${GRAPH_API_BASE}/${phoneId}/messages`;

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${getToken()}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            messaging_product: 'whatsapp',
            to,
            type: 'text',
            text: { body: text },
        }),
    });

    const data = await response.json();
    if (!response.ok) {
        throw new Error(data?.error?.message || 'Falha ao enviar mensagem WhatsApp');
    }
    return data;
}

/**
 * Envia mensagem template com parâmetros dinâmicos
 * @param {string} to - Número no formato internacional (ex: 5511999999999)
 * @param {string} templateName - Nome do template aprovado no Meta Business Manager
 * @param {Array<{type: string, text: string}>} bodyParams - Parâmetros do corpo
 * @param {string} languageCode - Código de idioma (default: pt_BR)
 */
export async function sendTemplateMessage(to, templateName, bodyParams = [], languageCode = 'pt_BR') {
    if (!isConfigured()) throw new Error('WhatsApp não configurado');

    const phoneId = getPhoneNumberId();
    const url = `${GRAPH_API_BASE}/${phoneId}/messages`;

    const payload = {
        messaging_product: 'whatsapp',
        to,
        type: 'template',
        template: {
            name: templateName,
            language: { code: languageCode },
            components: bodyParams.length > 0 ? [{
                type: 'body',
                parameters: bodyParams,
            }] : [],
        },
    };

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${getToken()}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
    });

    const data = await response.json();
    if (!response.ok) {
        throw new Error(data?.error?.message || 'Falha ao enviar template WhatsApp');
    }
    return data;
}

/**
 * Envia mensagem de reativação para cliente de alto LTV
 * @param {string} to - Número do cliente
 * @param {object} params - { customerName, daysSinceLastPurchase, founderName }
 */
export async function sendReactivationMessage(to, params) {
    const { customerName, daysSinceLastPurchase, founderName } = params;

    // Template: northie_reativacao
    // Corpo esperado: "Olá {{1}}, saudades! Faz {{2}} dias desde sua última compra. {{3}} tem uma novidade especial para você."
    return sendTemplateMessage(to, 'northie_reativacao', [
        { type: 'text', text: customerName || 'cliente' },
        { type: 'text', text: String(daysSinceLastPurchase || 30) },
        { type: 'text', text: founderName || 'Nosso time' },
    ]);
}

/**
 * Envia alerta urgente para o founder
 * @param {string} to - Número do founder
 * @param {object} params - { title, body }
 */
export async function sendAlertMessage(to, params) {
    const { title, body } = params;

    // Template: northie_alerta
    // Corpo esperado: "⚡ {{1}}: {{2}}"
    return sendTemplateMessage(to, 'northie_alerta', [
        { type: 'text', text: title },
        { type: 'text', text: body },
    ]);
}

/**
 * Persiste registro da mensagem enviada no banco
 */
export async function logMessage(profileId, to, templateName, content, wamid, growthActionId = null) {
    const { error } = await supabase.from('whatsapp_messages').insert({
        profile_id: profileId,
        to_number: to,
        template_name: templateName,
        content,
        wamid,
        status: 'sent',
        growth_action_id: growthActionId,
    });

    if (error) console.error('[WhatsApp] Falha ao logar mensagem:', error.message);
}

/**
 * Atualiza status da mensagem via webhook de status
 */
export async function updateMessageStatus(wamid, status) {
    const { error } = await supabase
        .from('whatsapp_messages')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('wamid', wamid);

    if (error) console.error('[WhatsApp] Falha ao atualizar status:', error.message);
}

/**
 * Testa a conexão com a API do WhatsApp
 */
export async function testConnection() {
    if (!isConfigured()) return { ok: false, error: 'Credenciais não configuradas' };

    try {
        const phoneId = getPhoneNumberId();
        const url = `${GRAPH_API_BASE}/${phoneId}?fields=display_phone_number,verified_name`;

        const response = await fetch(url, {
            headers: { 'Authorization': `Bearer ${getToken()}` },
        });

        const data = await response.json();
        if (!response.ok) return { ok: false, error: data?.error?.message };

        return { ok: true, phone: data.display_phone_number, name: data.verified_name };
    } catch (err) {
        return { ok: false, error: err.message };
    }
}

export { isConfigured };
