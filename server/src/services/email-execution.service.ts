/**
 * @file services/email-execution.service.ts
 * Resend batch email sender para ações do Growth Engine.
 * Processa em grupos de 50 (limite da API Resend) com delay entre grupos.
 */

import { Resend } from 'resend';
import { supabase } from '../lib/supabase.js';

// ── Tipos públicos ──────────────────────────────────────────────────────────

export interface EmailBatchItem {
    to: string;
    subject: string;
    html: string;
    profileId: string;
    customerId?: string;
    growthActionId?: string;
}

export interface EmailSendResult {
    email: string;
    success: boolean;
    resendId?: string;
    error?: string;
}

// ── Tipos internos ──────────────────────────────────────────────────────────

interface ResendSendResult {
    data: { id: string } | null;
    error: { message: string } | null;
}

// ── Constantes ───────────────────────────────────────────────────────────────

const BATCH_SIZE = 50;
const BATCH_DELAY_MS = 100;
const FROM_ADDRESS = process.env.EMAIL_FROM ?? 'growth@northie.com.br';

// ── Instância lazy do cliente Resend ─────────────────────────────────────────

let _resend: Resend | null = null;

function getResendClient(): Resend {
    if (!_resend) {
        const apiKey = process.env.RESEND_API_KEY;
        if (!apiKey) {
            throw new Error('[EmailExecutionService] RESEND_API_KEY não configurada.');
        }
        _resend = new Resend(apiKey);
    }
    return _resend;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

async function logEmail(params: {
    profileId: string;
    customerId?: string;
    emailTo: string;
    subject: string;
    bodyHtml: string;
    status: 'queued' | 'sent' | 'failed';
    resendId?: string;
    growthActionId?: string;
}): Promise<void> {
    const { error } = await supabase.from('email_campaigns').insert({
        profile_id: params.profileId,
        customer_id: params.customerId ?? null,
        email_to: params.emailTo,
        subject: params.subject,
        body_html: params.bodyHtml,
        status: params.status,
        resend_id: params.resendId ?? null,
        growth_action_id: params.growthActionId ?? null,
    });

    if (error) {
        console.error('[EmailExecutionService] Falha ao registrar email no banco:', error.message);
    }
}

async function sendOne(
    resend: Resend,
    item: EmailBatchItem,
    fromName: string
): Promise<EmailSendResult> {
    try {
        const result = (await resend.emails.send({
            from: `${fromName} <${FROM_ADDRESS}>`,
            to: item.to,
            subject: item.subject,
            html: item.html,
        })) as ResendSendResult;

        if (result.error || !result.data) {
            const errorMsg = result.error?.message ?? 'Resposta inválida da API Resend';
            await logEmail({
                profileId: item.profileId,
                ...(item.customerId ? { customerId: item.customerId } : {}),
                emailTo: item.to,
                subject: item.subject,
                bodyHtml: item.html,
                status: 'failed',
                ...(item.growthActionId ? { growthActionId: item.growthActionId } : {}),
            });
            return { email: item.to, success: false, error: errorMsg };
        }

        await logEmail({
            profileId: item.profileId,
            ...(item.customerId ? { customerId: item.customerId } : {}),
            emailTo: item.to,
            subject: item.subject,
            bodyHtml: item.html,
            status: 'sent',
            resendId: result.data.id,
            ...(item.growthActionId ? { growthActionId: item.growthActionId } : {}),
        });

        return { email: item.to, success: true, resendId: result.data.id };
    } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        console.error(`[EmailExecutionService] Erro ao enviar para ${item.to}:`, errorMsg);

        await logEmail({
            profileId: item.profileId,
            ...(item.customerId ? { customerId: item.customerId } : {}),
            emailTo: item.to,
            subject: item.subject,
            bodyHtml: item.html,
            status: 'failed',
            ...(item.growthActionId ? { growthActionId: item.growthActionId } : {}),
        });

        return { email: item.to, success: false, error: errorMsg };
    }
}

// ── Classe principal ──────────────────────────────────────────────────────────

export class EmailExecutionService {
    /**
     * Envia um único email.
     */
    static async sendSingle(
        item: EmailBatchItem,
        fromName = 'Northie Growth'
    ): Promise<EmailSendResult> {
        const resend = getResendClient();
        return sendOne(resend, item, fromName);
    }

    /**
     * Envia em lotes de até 50 itens (limite Resend), com 100ms de delay entre grupos.
     * Retorna resultado individual por item.
     */
    static async sendBatch(
        items: EmailBatchItem[],
        fromName = 'Northie Growth'
    ): Promise<EmailSendResult[]> {
        const resend = getResendClient();
        const results: EmailSendResult[] = [];

        for (let i = 0; i < items.length; i += BATCH_SIZE) {
            const group = items.slice(i, i + BATCH_SIZE);

            const groupResults = await Promise.all(
                group.map((item) => sendOne(resend, item, fromName))
            );

            results.push(...groupResults);

            // Delay entre grupos para respeitar rate limits — exceto após o último
            if (i + BATCH_SIZE < items.length) {
                await new Promise((r) => setTimeout(r, BATCH_DELAY_MS));
            }
        }

        return results;
    }
}
