/**
 * @file controllers/growth-collaboration.controller.ts
 *
 * Controller para o fluxo de colaboração entre founder e agente de execução.
 *
 * Fluxo completo:
 * 1. POST /collaborate  — abre sessão, carrega segmento, gera mensagem de abertura
 * 2. POST /message      — loop de chat iterativo com function calling
 * 3. GET  /             — leitura do estado atual da sessão
 * 4. POST /confirm      — founder aprova template → cria itens de execução
 * 5. POST /abandon      — founder cancela a colaboração
 */

import type { Request, Response } from 'express';
import { supabase } from '../lib/supabase.js';
import {
    getExecutionAgent,
    requiresCollaboration,
    type CollaborationMessage,
    type AgentSegmentItem,
    type ExecutionPlanItem,
    type GrowthRecommendation,
} from '../services/execution-agents/index.js';
import { WhatsAppService } from '../services/whatsapp.service.js';
import { EmailExecutionService } from '../services/email-execution.service.js';

// ── Tipos internos ────────────────────────────────────────────────────────────

interface CollaborationSession {
    id: string;
    recommendation_id: string;
    profile_id: string;
    messages: CollaborationMessage[];
    segment_snapshot: AgentSegmentItem[];
    draft_message?: string;
    status: 'active' | 'confirmed' | 'abandoned';
    business_context?: string;
    created_at: string;
    updated_at: string;
}

// ── Handlers ──────────────────────────────────────────────────────────────────

/**
 * POST /api/growth/recommendations/:id/collaborate
 *
 * Abre sessão de colaboração para uma recomendação pendente.
 * Valida que a recomendação existe, está em status 'pending' e exige colaboração.
 */
export async function startCollaboration(req: Request, res: Response) {
    const profileId = req.headers['x-profile-id'] as string;
    const { id } = req.params;

    if (!profileId) return res.status(400).json({ error: 'Missing x-profile-id' });

    // Busca recomendação com todos os campos necessários
    const { data: rec, error: recErr } = await supabase
        .from('growth_recommendations')
        .select('id, type, status, title, narrative, impact_estimate, sources, meta, profile_id')
        .eq('id', id)
        .eq('profile_id', profileId)
        .single();

    if (recErr || !rec) return res.status(404).json({ error: 'Recommendation not found' });
    if (rec.status !== 'pending') {
        return res.status(409).json({
            error: `Recommendation is not in pending status (current: ${rec.status})`,
        });
    }

    if (!requiresCollaboration(rec.type as string)) {
        return res.status(400).json({
            error: 'This recommendation type does not require collaboration.',
            hint: 'Use POST /approve to execute directly.',
        });
    }

    const agent = getExecutionAgent(rec.type as string);
    if (!agent) {
        return res.status(500).json({ error: `No execution agent found for type: ${rec.type}` });
    }

    try {
        const recommendation: GrowthRecommendation = {
            id: rec.id as string,
            type: rec.type as string,
            title: rec.title as string,
            narrative: rec.narrative as string,
            impact_estimate: rec.impact_estimate as string,
            meta: (rec.meta as Record<string, unknown>) ?? {},
            status: rec.status as string,
        };

        const sessionResult = await agent.openSession(profileId, recommendation);

        const now = new Date().toISOString();
        const openingMsg: CollaborationMessage = {
            role: 'assistant',
            content: sessionResult.opening_message,
            timestamp: now,
        };

        // Cria sessão de colaboração no banco
        const { data: session, error: sessionErr } = await supabase
            .from('growth_collaboration_sessions')
            .insert({
                recommendation_id: id,
                profile_id: profileId,
                agent_type: rec.type as string,
                messages: [openingMsg],
                segment_snapshot: sessionResult.segment_snapshot,
                draft_message: sessionResult.draft_message ?? null,
                status: 'active',
                created_at: now,
                updated_at: now,
            })
            .select('id')
            .single();

        if (sessionErr || !session) {
            console.error('[Collab] Erro ao criar sessão:', sessionErr?.message);
            return res.status(500).json({ error: 'Failed to create collaboration session' });
        }

        // Atualiza recomendação para status 'collaborating' e vincula a sessão
        await supabase
            .from('growth_recommendations')
            .update({
                status: 'collaborating',
                collaboration_session_id: session.id,
                updated_at: now,
            })
            .eq('id', id);

        return res.status(201).json({
            session_id: session.id as string,
            opening_message: sessionResult.opening_message,
            segment_snapshot: sessionResult.segment_snapshot,
            draft_message: sessionResult.draft_message ?? null,
            customers_with_phone: sessionResult.customers_with_phone,
            customers_without_phone: sessionResult.customers_without_phone,
        });
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error('[Collab] startCollaboration error:', msg);
        return res.status(500).json({ error: msg });
    }
}

/**
 * POST /api/growth/collaboration/:sessionId/message
 *
 * Envia mensagem do founder para o agente no loop de colaboração.
 * Body: { message: string }
 */
export async function sendMessage(req: Request, res: Response) {
    const profileId = req.headers['x-profile-id'] as string;
    const sessionId = req.params.sessionId as string;
    const { message } = req.body as { message?: string };

    if (!profileId) return res.status(400).json({ error: 'Missing x-profile-id' });
    if (!message || message.trim().length === 0) {
        return res.status(400).json({ error: 'message is required' });
    }

    // Busca sessão com join na recomendação
    const { data: session, error: sessErr } = await supabase
        .from('growth_collaboration_sessions')
        .select('id, recommendation_id, profile_id, messages, segment_snapshot, draft_message, status')
        .eq('id', sessionId)
        .eq('profile_id', profileId)
        .single();

    if (sessErr || !session) return res.status(404).json({ error: 'Session not found' });
    if (session.status !== 'active') {
        return res.status(409).json({ error: `Session is not active (current: ${session.status})` });
    }

    // Busca recomendação vinculada
    const { data: rec } = await supabase
        .from('growth_recommendations')
        .select('id, type, title, narrative, impact_estimate, meta, status')
        .eq('id', session.recommendation_id as string)
        .single();

    if (!rec) return res.status(404).json({ error: 'Linked recommendation not found' });

    const agent = getExecutionAgent(rec.type as string);
    if (!agent) {
        return res.status(500).json({ error: `No execution agent for type: ${rec.type}` });
    }

    // Carrega contexto de negócio para o agente
    const { data: ctxRows } = await supabase
        .from('business_context')
        .select('content, context_type')
        .eq('profile_id', profileId)
        .order('updated_at', { ascending: false });

    const businessContext = ctxRows && ctxRows.length > 0
        ? ctxRows.map(c => `[${c.context_type ?? 'geral'}]\n${c.content}`).join('\n\n')
        : 'Contexto de negócio não configurado.';

    const history = (session.messages as CollaborationMessage[]) ?? [];

    const recommendation: GrowthRecommendation = {
        id: rec.id as string,
        type: rec.type as string,
        title: rec.title as string,
        narrative: rec.narrative as string,
        impact_estimate: rec.impact_estimate as string,
        meta: (rec.meta as Record<string, unknown>) ?? {},
        status: rec.status as string,
    };

    try {
        const reply = await agent.handleMessage(sessionId, message, history, {
            recommendation,
            businessContext,
        });

        const now = new Date().toISOString();
        const userMsg: CollaborationMessage = { role: 'user', content: message, timestamp: now };
        const assistantMsg: CollaborationMessage = { role: 'assistant', content: reply, timestamp: now };

        const updatedMessages = [...history, userMsg, assistantMsg];

        // Extrai novo rascunho da resposta se presente
        const draftMatch = reply.match(/RASCUNHO:([\s\S]+?)(?:FIM DO RASCUNHO|$)/i);
        const newDraft = draftMatch ? draftMatch[1]!.trim() : (session.draft_message as string | null);

        await supabase
            .from('growth_collaboration_sessions')
            .update({
                messages: updatedMessages,
                draft_message: newDraft,
                updated_at: now,
            })
            .eq('id', sessionId);

        return res.json({
            reply,
            draft_message: newDraft ?? null,
        });
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error('[Collab] sendMessage error:', msg);
        return res.status(500).json({ error: msg });
    }
}

/**
 * GET /api/growth/collaboration/:sessionId
 *
 * Retorna estado atual da sessão de colaboração.
 */
export async function getSession(req: Request, res: Response) {
    const profileId = req.headers['x-profile-id'] as string;
    const { sessionId } = req.params;

    if (!profileId) return res.status(400).json({ error: 'Missing x-profile-id' });

    const { data: session, error } = await supabase
        .from('growth_collaboration_sessions')
        .select('id, recommendation_id, messages, segment_snapshot, draft_message, status, created_at, updated_at')
        .eq('id', sessionId)
        .eq('profile_id', profileId)
        .single();

    if (error || !session) return res.status(404).json({ error: 'Session not found' });

    return res.json({
        id: session.id,
        recommendation_id: session.recommendation_id,
        messages: session.messages,
        segment_snapshot: session.segment_snapshot,
        draft_message: session.draft_message,
        status: session.status,
        created_at: session.created_at,
        updated_at: session.updated_at,
    });
}

/**
 * POST /api/growth/collaboration/:sessionId/confirm
 *
 * Founder aprova o template final e dispara execução em background.
 * Body: { approved_message: string }
 */
export async function confirmExecution(req: Request, res: Response) {
    const profileId = req.headers['x-profile-id'] as string;
    const sessionId = req.params.sessionId as string;
    const { approved_message } = req.body as { approved_message?: string };

    if (!profileId) return res.status(400).json({ error: 'Missing x-profile-id' });
    if (!approved_message || approved_message.trim().length === 0) {
        return res.status(400).json({ error: 'approved_message is required' });
    }

    // Busca sessão
    const { data: session, error: sessErr } = await supabase
        .from('growth_collaboration_sessions')
        .select('id, recommendation_id, profile_id, segment_snapshot, status')
        .eq('id', sessionId)
        .eq('profile_id', profileId)
        .single();

    if (sessErr || !session) return res.status(404).json({ error: 'Session not found' });
    if (session.status !== 'active') {
        return res.status(409).json({ error: `Session is not active (current: ${session.status})` });
    }

    const recId = session.recommendation_id as string;

    // Busca recomendação
    const { data: rec } = await supabase
        .from('growth_recommendations')
        .select('id, type, title, narrative, impact_estimate, meta, status')
        .eq('id', recId)
        .single();

    if (!rec) return res.status(404).json({ error: 'Linked recommendation not found' });

    const agent = getExecutionAgent(rec.type as string);
    if (!agent) {
        return res.status(500).json({ error: `No execution agent for type: ${rec.type}` });
    }

    const recommendation: GrowthRecommendation = {
        id: rec.id as string,
        type: rec.type as string,
        title: rec.title as string,
        narrative: rec.narrative as string,
        impact_estimate: rec.impact_estimate as string,
        meta: (rec.meta as Record<string, unknown>) ?? {},
        status: rec.status as string,
    };

    const segmentSnapshot = (session.segment_snapshot as AgentSegmentItem[]) ?? [];

    // Gera plano de execução
    const executionItems: ExecutionPlanItem[] = agent.buildExecutionPlan(
        profileId,
        recommendation,
        approved_message,
        segmentSnapshot
    );

    const now = new Date().toISOString();

    // Persiste itens de execução
    if (executionItems.length > 0) {
        const itemRows = executionItems.map(item => ({
            recommendation_id: recId,
            profile_id: profileId,
            customer_id: item.customer_id ?? null,
            customer_email: item.customer_email,
            customer_phone: item.customer_phone ?? null,
            channel: item.channel,
            personalized_message: item.personalized_message,
            status: 'pending',
            created_at: now,
            updated_at: now,
        }));

        const { error: insertErr } = await supabase
            .from('growth_execution_items')
            .insert(itemRows);

        if (insertErr) {
            console.error('[Collab] Erro ao inserir execution items:', insertErr.message);
            return res.status(500).json({ error: 'Failed to create execution items' });
        }
    }

    // Atualiza sessão e recomendação
    await Promise.all([
        supabase
            .from('growth_collaboration_sessions')
            .update({ status: 'confirmed', updated_at: now })
            .eq('id', sessionId),

        supabase
            .from('growth_recommendations')
            .update({
                status: 'awaiting_confirmation',
                approved_message_template: approved_message,
                updated_at: now,
            })
            .eq('id', recId),
    ]);

    // Dispara execução em background (não-bloqueante)
    executeItemsBackground(profileId, recId, sessionId).catch(err =>
        console.error(`[Collab] Background execution error for rec ${recId}:`, err)
    );

    return res.json({
        execution_items_count: executionItems.length,
        recommendation_id: recId,
        session_id: sessionId,
    });
}

/**
 * POST /api/growth/collaboration/:sessionId/abandon
 *
 * Founder cancela a sessão de colaboração.
 * Recomendação volta para status 'pending'.
 */
export async function abandonSession(req: Request, res: Response) {
    const profileId = req.headers['x-profile-id'] as string;
    const { sessionId } = req.params;

    if (!profileId) return res.status(400).json({ error: 'Missing x-profile-id' });

    const { data: session, error: sessErr } = await supabase
        .from('growth_collaboration_sessions')
        .select('id, recommendation_id, status')
        .eq('id', sessionId)
        .eq('profile_id', profileId)
        .single();

    if (sessErr || !session) return res.status(404).json({ error: 'Session not found' });

    const now = new Date().toISOString();

    await Promise.all([
        supabase
            .from('growth_collaboration_sessions')
            .update({ status: 'abandoned', updated_at: now })
            .eq('id', sessionId),

        supabase
            .from('growth_recommendations')
            .update({
                status: 'pending',
                collaboration_session_id: null,
                updated_at: now,
            })
            .eq('id', session.recommendation_id as string),
    ]);

    return res.json({ ok: true });
}

// ── Background execution ──────────────────────────────────────────────────────

/**
 * Executa os itens de execução pendentes em background.
 * Atualiza status da recomendação ao final.
 */
async function executeItemsBackground(
    profileId: string,
    recId: string,
    sessionId: string
): Promise<void> {
    console.log(`[Collab] Starting background execution for rec ${recId} (session ${sessionId})`);

    // Marca recomendação como em execução
    await supabase
        .from('growth_recommendations')
        .update({ status: 'executing', updated_at: new Date().toISOString() })
        .eq('id', recId);

    // Busca itens pendentes
    const { data: items } = await supabase
        .from('growth_execution_items')
        .select('id, customer_email, customer_phone, channel, personalized_message, customer_id')
        .eq('recommendation_id', recId)
        .eq('status', 'pending');

    if (!items || items.length === 0) {
        console.warn(`[Collab] Nenhum item pendente para rec ${recId}`);
        await supabase
            .from('growth_recommendations')
            .update({
                status: 'completed',
                execution_log: { message: 'No pending items found.', completed_at: new Date().toISOString() },
                updated_at: new Date().toISOString(),
            })
            .eq('id', recId);
        return;
    }

    let successCount = 0;
    let failCount = 0;
    const errors: string[] = [];

    for (const item of items) {
        const channel = item.channel as 'whatsapp' | 'email';
        const itemId = item.id as string;

        try {
            if (channel === 'whatsapp' && item.customer_phone) {
                const result = await WhatsAppService.sendTextMessage(
                    item.customer_phone as string,
                    item.personalized_message as string,
                    profileId
                );
                if (!result.success) throw new Error(result.error ?? 'WhatsApp send failed');
            } else if (channel === 'email') {
                // Para mensagens combinadas (UpsellCohortAgent), extrai subject e body
                const raw = item.personalized_message as string;
                const subjectMatch = raw.match(/SUBJECT:\s*(.+?)(?:\n|$)/i);
                const bodyMatch = raw.match(/BODY:\s*([\s\S]+?)$/i);

                const subject = (subjectMatch?.[1] ?? 'Uma mensagem especial para você').trim();
                const bodyHtml = (bodyMatch?.[1] ?? raw).trim();

                const emailItem: import('../services/email-execution.service.js').EmailBatchItem = {
                    profileId,
                    to: item.customer_email as string,
                    subject,
                    html: bodyHtml,
                };
                const customerId = item.customer_id as string | null;
                if (customerId) emailItem.customerId = customerId;
                emailItem.growthActionId = recId;
                await EmailExecutionService.sendSingle(emailItem);
            }

            await supabase
                .from('growth_execution_items')
                .update({ status: 'sent', updated_at: new Date().toISOString() })
                .eq('id', itemId);

            successCount++;
        } catch (err) {
            const errorMsg = err instanceof Error ? err.message : String(err);
            failCount++;
            errors.push(`${item.customer_email}: ${errorMsg}`);
            console.error(`[Collab] Falha ao executar item ${itemId}:`, errorMsg);

            await supabase
                .from('growth_execution_items')
                .update({
                    status: 'failed',
                    error_message: errorMsg,
                    updated_at: new Date().toISOString(),
                })
                .eq('id', itemId);
        }
    }

    const finalStatus = failCount === 0 ? 'completed' : successCount > 0 ? 'completed' : 'failed';
    const completedAt = new Date().toISOString();

    await supabase
        .from('growth_recommendations')
        .update({
            status: finalStatus,
            execution_log: {
                total: items.length,
                success: successCount,
                failed: failCount,
                errors: errors.slice(0, 10), // Limita log de erros
                completed_at: completedAt,
            },
            updated_at: completedAt,
        })
        .eq('id', recId);

    console.log(
        `[Collab] Execution completed for rec ${recId}: ${successCount} sent, ${failCount} failed.`
    );
}
