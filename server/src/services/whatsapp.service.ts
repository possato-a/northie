/**
 * @file services/whatsapp.service.ts
 * Meta Business API (WhatsApp Cloud API) wrapper para execução de ações do Growth Engine.
 * Versão da API: v21.0 (compatível com WhatsApp Cloud API)
 */

import { supabase } from '../lib/supabase.js';
import { IntegrationService } from './integration.service.js';

const META_GRAPH_BASE = 'https://graph.facebook.com/v21.0';

// ── Tipos públicos ──────────────────────────────────────────────────────────

export interface TemplateComponent {
    type: 'header' | 'body' | 'button';
    parameters: Array<{ type: 'text'; text: string }>;
}

export interface WhatsAppBatchItem {
    to: string;
    profileId: string;
    customerId?: string;
    growthActionId?: string;
    templateName?: string;
    languageCode?: string;
    components?: TemplateComponent[];
    text?: string;
}

export interface WhatsAppSendResult {
    phone: string;
    success: boolean;
    wamid?: string;
    error?: string;
}

// ── Tipos internos ──────────────────────────────────────────────────────────

interface MetaSendResponse {
    messages?: Array<{ id: string }>;
    error?: { message: string; code: number };
}

interface MetaStatusResponse {
    id?: string;
    status?: string;
    error?: { message: string };
}

// ── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Normaliza número de telefone para formato E.164 sem o '+'.
 * Aceita: +55 11 99999-9999, 55 11 99999-9999, (11) 99999-9999, 11999999999
 * Sempre retorna: 55XXXXXXXXXXX
 */
function normalizePhone(raw: string): string {
    const digits = raw.replace(/\D/g, '');

    // Já está no formato internacional completo
    if (digits.length === 13 && digits.startsWith('55')) {
        return digits;
    }

    // Tem o código do país mas sem o zero do DDD
    if (digits.length === 12 && digits.startsWith('55')) {
        return digits;
    }

    // Número local com DDD (10 ou 11 dígitos)
    if (digits.length === 10 || digits.length === 11) {
        return `55${digits}`;
    }

    // Fallback: retorna o que veio sem não-dígitos
    return digits;
}

async function resolveAccessToken(profileId?: string): Promise<string> {
    const envToken = process.env.WHATSAPP_ACCESS_TOKEN;
    if (envToken) return envToken;

    if (!profileId) {
        throw new Error('[WhatsAppService] WHATSAPP_ACCESS_TOKEN não configurado e profileId não fornecido para fallback.');
    }

    const tokens = await IntegrationService.getIntegration(profileId, 'meta');
    if (!tokens?.access_token) {
        throw new Error(`[WhatsAppService] Token Meta não encontrado para profile ${profileId}.`);
    }
    return tokens.access_token;
}

function getPhoneNumberId(): string {
    const id = process.env.WHATSAPP_PHONE_NUMBER_ID;
    if (!id) throw new Error('[WhatsAppService] WHATSAPP_PHONE_NUMBER_ID não configurado.');
    return id;
}

async function logMessage(params: {
    profileId: string;
    customerId?: string;
    phoneTo: string;
    messageBody?: string;
    templateName?: string;
    status: 'queued' | 'sent' | 'delivered' | 'failed';
    wamid?: string;
    growthActionId?: string;
    error?: string;
}): Promise<void> {
    await supabase.from('whatsapp_messages').upsert(
        {
            profile_id: params.profileId,
            customer_id: params.customerId ?? null,
            phone_to: params.phoneTo,
            message_body: params.messageBody ?? null,
            template_name: params.templateName ?? null,
            status: params.status,
            wamid: params.wamid ?? null,
            growth_action_id: params.growthActionId ?? null,
        },
        { onConflict: 'wamid', ignoreDuplicates: false }
    );
}

/**
 * Executa um fetch com retry único em caso de rate limit (HTTP 429).
 */
async function fetchWithRateLimitRetry(url: string, init: RequestInit): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30_000);

    try {
        let res = await fetch(url, { ...init, signal: controller.signal });

        if (res.status === 429) {
            await new Promise((r) => setTimeout(r, 2_000));
            const retryController = new AbortController();
            const retryTimeout = setTimeout(() => retryController.abort(), 30_000);
            try {
                res = await fetch(url, { ...init, signal: retryController.signal });
            } finally {
                clearTimeout(retryTimeout);
            }
        }

        return res;
    } finally {
        clearTimeout(timeoutId);
    }
}

// ── Classe principal ─────────────────────────────────────────────────────────

export class WhatsAppService {
    /**
     * Envia mensagem via template aprovado pela Meta (obrigatório fora da janela de 24h).
     */
    static async sendTemplateMessage(
        to: string,
        templateName: string,
        languageCode: string,
        components: TemplateComponent[],
        profileId?: string
    ): Promise<WhatsAppSendResult> {
        const phone = normalizePhone(to);
        const accessToken = await resolveAccessToken(profileId);
        const phoneNumberId = getPhoneNumberId();

        const body = {
            messaging_product: 'whatsapp',
            to: phone,
            type: 'template',
            template: {
                name: templateName,
                language: { code: languageCode },
                components,
            },
        };

        const url = `${META_GRAPH_BASE}/${phoneNumberId}/messages`;

        let res: Response;
        try {
            res = await fetchWithRateLimitRetry(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${accessToken}`,
                },
                body: JSON.stringify(body),
            });
        } catch (err) {
            const errorMsg = err instanceof Error ? err.message : String(err);
            console.error(`[WhatsAppService] Falha de rede ao enviar template para ${phone}:`, errorMsg);
            await logMessage({
                profileId: profileId ?? 'unknown',
                phoneTo: phone,
                templateName,
                status: 'failed',
            });
            return { phone, success: false, error: errorMsg };
        }

        const json = (await res.json()) as MetaSendResponse;

        if (!res.ok || json.error) {
            const errorMsg = json.error?.message ?? `HTTP ${res.status}`;
            console.error(`[WhatsAppService] API Meta retornou erro para ${phone}:`, errorMsg);
            await logMessage({
                profileId: profileId ?? 'unknown',
                phoneTo: phone,
                templateName,
                status: 'failed',
            });
            return { phone, success: false, error: errorMsg };
        }

        const wamid = json.messages?.[0]?.id;
        await logMessage({
            profileId: profileId ?? 'unknown',
            phoneTo: phone,
            templateName,
            status: 'sent',
            ...(wamid ? { wamid } : {}),
        });

        return { phone, success: true, ...(wamid ? { wamid } : {}) };
    }

    /**
     * Envia mensagem de texto livre (válido apenas dentro da janela de 24h após última mensagem do usuário).
     */
    static async sendTextMessage(
        to: string,
        text: string,
        profileId?: string
    ): Promise<WhatsAppSendResult> {
        const phone = normalizePhone(to);
        const accessToken = await resolveAccessToken(profileId);
        const phoneNumberId = getPhoneNumberId();

        const body = {
            messaging_product: 'whatsapp',
            to: phone,
            type: 'text',
            text: { body: text },
        };

        const url = `${META_GRAPH_BASE}/${phoneNumberId}/messages`;

        let res: Response;
        try {
            res = await fetchWithRateLimitRetry(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${accessToken}`,
                },
                body: JSON.stringify(body),
            });
        } catch (err) {
            const errorMsg = err instanceof Error ? err.message : String(err);
            console.error(`[WhatsAppService] Falha de rede ao enviar texto para ${phone}:`, errorMsg);
            await logMessage({
                profileId: profileId ?? 'unknown',
                phoneTo: phone,
                messageBody: text,
                status: 'failed',
            });
            return { phone, success: false, error: errorMsg };
        }

        const json = (await res.json()) as MetaSendResponse;

        if (!res.ok || json.error) {
            const errorMsg = json.error?.message ?? `HTTP ${res.status}`;
            console.error(`[WhatsAppService] API Meta retornou erro (texto) para ${phone}:`, errorMsg);
            await logMessage({
                profileId: profileId ?? 'unknown',
                phoneTo: phone,
                messageBody: text,
                status: 'failed',
            });
            return { phone, success: false, error: errorMsg };
        }

        const wamid = json.messages?.[0]?.id;
        await logMessage({
            profileId: profileId ?? 'unknown',
            phoneTo: phone,
            messageBody: text,
            status: 'sent',
            ...(wamid ? { wamid } : {}),
        });

        return { phone, success: true, ...(wamid ? { wamid } : {}) };
    }

    /**
     * Envia em lotes de até 5 itens com delay configurável entre itens.
     * Cada item pode ser template ou texto livre.
     * Retorna resultado individual por item.
     */
    static async batchSend(
        items: WhatsAppBatchItem[],
        delayMs = 200
    ): Promise<WhatsAppSendResult[]> {
        const results: WhatsAppSendResult[] = [];
        const BATCH_SIZE = 5;

        for (let i = 0; i < items.length; i += BATCH_SIZE) {
            const batch = items.slice(i, i + BATCH_SIZE);

            const batchPromises = batch.map(async (item): Promise<WhatsAppSendResult> => {
                const phone = normalizePhone(item.to);

                try {
                    let result: WhatsAppSendResult;

                    if (item.templateName) {
                        result = await this.sendTemplateMessage(
                            item.to,
                            item.templateName,
                            item.languageCode ?? 'pt_BR',
                            item.components ?? [],
                            item.profileId
                        );
                    } else if (item.text) {
                        result = await this.sendTextMessage(item.to, item.text, item.profileId);
                    } else {
                        return {
                            phone,
                            success: false,
                            error: 'Nenhum conteúdo fornecido: use templateName ou text.',
                        };
                    }

                    // Enriquecer o log com customer e growthAction se disponíveis
                    if (result.wamid && (item.customerId || item.growthActionId)) {
                        await supabase
                            .from('whatsapp_messages')
                            .update({
                                customer_id: item.customerId ?? null,
                                growth_action_id: item.growthActionId ?? null,
                            })
                            .eq('wamid', result.wamid);
                    }

                    return result;
                } catch (err) {
                    const errorMsg = err instanceof Error ? err.message : String(err);
                    console.error(`[WhatsAppService] Erro inesperado no batchSend para ${phone}:`, errorMsg);
                    return { phone, success: false, error: errorMsg };
                }
            });

            const batchResults = await Promise.all(batchPromises);
            results.push(...batchResults);

            // Aguarda entre lotes (exceto após o último)
            if (i + BATCH_SIZE < items.length) {
                await new Promise((r) => setTimeout(r, delayMs));
            }
        }

        return results;
    }

    /**
     * Consulta o status de entrega de uma mensagem pelo wamid.
     */
    static async getMessageStatus(
        messageId: string,
        profileId?: string
    ): Promise<{ status?: string; error?: string }> {
        const accessToken = await resolveAccessToken(profileId);

        const url = `${META_GRAPH_BASE}/${messageId}?fields=id,status&access_token=${accessToken}`;

        let res: Response;
        try {
            res = await fetchWithRateLimitRetry(url, { method: 'GET' });
        } catch (err) {
            const errorMsg = err instanceof Error ? err.message : String(err);
            console.error(`[WhatsAppService] Falha ao consultar status de ${messageId}:`, errorMsg);
            return { error: errorMsg };
        }

        const json = (await res.json()) as MetaStatusResponse;

        if (!res.ok || json.error) {
            return { error: json.error?.message ?? `HTTP ${res.status}` };
        }

        return { ...(json.status ? { status: json.status } : {}) };
    }
}
