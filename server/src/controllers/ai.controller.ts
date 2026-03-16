import type { Request, Response } from 'express';
import * as AIService from '../services/ai.service.js';
import { supabase } from '../lib/supabase.js';

const HISTORY_LIMIT = 20; // últimas N mensagens enviadas ao Claude

/**
 * Main chat endpoint for "Ask Northie".
 * Inclui histórico de conversa para manter contexto entre mensagens.
 */
export async function handleChatMessage(req: Request, res: Response) {
    const { message } = req.body;
    const profileId = req.headers['x-profile-id'] as string;

    if (!profileId || !message) {
        return res.status(400).json({ error: 'Missing x-profile-id or message' });
    }

    try {
        // Parallel fetch: history + all data needed for rich context
        const [historyResult, transResult, customersResult, recsCountResult] = await Promise.all([
            supabase.from('ai_chat_history').select('role, content').eq('profile_id', profileId).order('created_at', { ascending: false }).limit(HISTORY_LIMIT),
            supabase.from('transactions').select('amount_net, created_at').eq('profile_id', profileId).eq('status', 'approved'),
            supabase.from('customers').select('email, acquisition_channel, total_ltv, churn_probability, rfm_score, last_purchase_at').eq('profile_id', profileId),
            supabase.from('growth_recommendations').select('id', { count: 'exact', head: true }).eq('profile_id', profileId).eq('status', 'pending'),
        ]);

        const history = (historyResult.data || []).reverse() as Array<{ role: 'user' | 'assistant'; content: string }>;
        const allTransactions = transResult.data || [];
        const customers = customersResult.data || [];

        // Revenue stats
        const totalRevenue = allTransactions.reduce((s, t) => s + Number(t.amount_net), 0);
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        const trans30d = allTransactions.filter(t => new Date(t.created_at) >= thirtyDaysAgo);
        const revenue30d = trans30d.reduce((s, t) => s + Number(t.amount_net), 0);
        const avgTicket = allTransactions.length > 0 ? totalRevenue / allTransactions.length : 0;

        // RFM segments
        const rfmData = customers.filter(c => c.rfm_score != null);
        const rfmSegments = {
            Champions: { count: 0, ltvSum: 0 },
            'Em Risco': { count: 0, ltvSum: 0 },
            'Novos Promissores': { count: 0, ltvSum: 0 },
            Inativos: { count: 0, ltvSum: 0 },
        };
        for (const c of rfmData) {
            const score = c.rfm_score as string;
            if (!score || score.length !== 3) {
                rfmSegments['Novos Promissores'].count++;
                rfmSegments['Novos Promissores'].ltvSum += Number(c.total_ltv);
                continue;
            }
            const r = parseInt(score[0]!), f = parseInt(score[1]!), m = parseInt(score[2]!);
            const avg = (r + f + m) / 3;
            let seg: keyof typeof rfmSegments;
            if (r >= 4 && f >= 3 && m >= 3) seg = 'Champions';
            else if ((r <= 2 && m >= 3) || (r <= 2 && f >= 3)) seg = 'Em Risco';
            else if (avg <= 2) seg = 'Inativos';
            else seg = 'Novos Promissores';
            rfmSegments[seg].count++;
            rfmSegments[seg].ltvSum += Number(c.total_ltv);
        }

        // Channel breakdown
        const channelMap: Record<string, { customers: number; ltvSum: number }> = {};
        for (const c of customers) {
            const ch = c.acquisition_channel || 'desconhecido';
            if (!channelMap[ch]) channelMap[ch] = { customers: 0, ltvSum: 0 };
            channelMap[ch]!.customers++;
            channelMap[ch]!.ltvSum += Number(c.total_ltv);
        }
        const channelBreakdown = Object.entries(channelMap)
            .map(([channel, d]) => ({ channel, customers: d.customers, avg_ltv: d.customers > 0 ? d.ltvSum / d.customers : 0, revenue: d.ltvSum }))
            .sort((a, b) => b.avg_ltv - a.avg_ltv);

        const pendingGrowthRecs = recsCountResult.count || 0;
        const pageContext = (req.body.page_context as string) || 'Visão Geral';
        const model = (req.body.model as string) || 'sonnet';

        // Top 30 customers by LTV for individual lookup
        const customerList = [...customers]
            .sort((a, b) => Number(b.total_ltv) - Number(a.total_ltv))
            .slice(0, 30)
            .map(c => ({
                email: c.email as string,
                ltv: Number(c.total_ltv),
                rfm: c.rfm_score as string,
                churn: Number(c.churn_probability || 0),
                channel: c.acquisition_channel as string,
                lastPurchase: c.last_purchase_at as string,
            }));

        const context: AIService.ChatContext = {
            profileId,
            pageContext,
            model,
            customerList,
            stats: {
                total_revenue: totalRevenue,
                total_customers: customers.length,
                total_transactions: allTransactions.length,
                avg_ticket: avgTicket,
                revenue_30d: revenue30d,
                transactions_30d: trans30d.length,
            },
            rfmSegments: {
                Champions: { count: rfmSegments.Champions.count, avg_ltv: rfmSegments.Champions.count > 0 ? rfmSegments.Champions.ltvSum / rfmSegments.Champions.count : 0, revenue: rfmSegments.Champions.ltvSum },
                'Em Risco': { count: rfmSegments['Em Risco'].count, avg_ltv: rfmSegments['Em Risco'].count > 0 ? rfmSegments['Em Risco'].ltvSum / rfmSegments['Em Risco'].count : 0, revenue: rfmSegments['Em Risco'].ltvSum },
                'Novos Promissores': { count: rfmSegments['Novos Promissores'].count, avg_ltv: rfmSegments['Novos Promissores'].count > 0 ? rfmSegments['Novos Promissores'].ltvSum / rfmSegments['Novos Promissores'].count : 0, revenue: rfmSegments['Novos Promissores'].ltvSum },
                Inativos: { count: rfmSegments.Inativos.count, avg_ltv: rfmSegments.Inativos.count > 0 ? rfmSegments.Inativos.ltvSum / rfmSegments.Inativos.count : 0, revenue: rfmSegments.Inativos.ltvSum },
            },
            channelBreakdown,
            pendingGrowthRecs,
            history,
        };

        // Fire-and-forget user message insert — does not block the AI call
        void Promise.resolve(supabase.from('ai_chat_history').insert({ profile_id: profileId, role: 'user', content: message })).catch((e: unknown) => console.error('[AI] Failed to save user msg:', e));

        // Generate response
        const response = await AIService.generateAIResponse(message, context);

        // Persist AI response (awaited — we want the DB write before returning)
        await supabase.from('ai_chat_history').insert({
            profile_id: profileId,
            role: 'assistant',
            content: response.content,
        });

        res.status(200).json(response);

    } catch (error: unknown) {
        console.error('AI Chat Error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}

/**
 * Limpa o histórico de chat de um perfil (botão "Nova conversa" no frontend).
 */
export async function clearChatHistory(req: Request, res: Response) {
    const profileId = req.headers['x-profile-id'] as string;
    if (!profileId) return res.status(400).json({ error: 'Missing x-profile-id' });

    const { error } = await supabase
        .from('ai_chat_history')
        .delete()
        .eq('profile_id', profileId);

    if (error) return res.status(500).json({ error: 'Failed to clear history' });
    res.status(200).json({ message: 'History cleared' });
}

/**
 * Growth chat endpoint — contexto expandido com recomendações e business stats.
 */
export async function handleGrowthChatMessage(req: Request, res: Response) {
    const { message } = req.body;
    const profileId = req.headers['x-profile-id'] as string;

    if (!profileId || !message) {
        return res.status(400).json({ error: 'Missing x-profile-id or message' });
    }

    try {
        // Buscar tudo em paralelo (5 queries → 1 round-trip)
        const [historyResult, transResult, customersResult, recsResult, channelPerfResult] = await Promise.all([
            supabase.from('ai_chat_history').select('role, content').eq('profile_id', profileId).order('created_at', { ascending: false }).limit(10),
            supabase.from('transactions').select('amount_net').eq('profile_id', profileId).eq('status', 'approved'),
            supabase.from('customers').select('total_ltv, churn_probability, acquisition_channel, rfm_score').eq('profile_id', profileId),
            supabase.from('growth_recommendations').select('id, type, title, narrative, impact_estimate, sources, meta, status').eq('profile_id', profileId).in('status', ['pending', 'approved', 'executing', 'completed', 'failed']).order('created_at', { ascending: false }).limit(10),
            supabase.from('mv_campaign_ltv_performance').select('acquisition_channel, customers_acquired, avg_ltv_brl, total_spend_brl, true_roi').eq('profile_id', profileId),
        ]);

        const history = (historyResult.data || []).reverse() as Array<{ role: 'user' | 'assistant'; content: string }>;
        const customers = customersResult.data || [];
        const totalRevenue = (transResult.data || []).reduce((s, t) => s + Number(t.amount_net), 0);
        const avgLtv = customers.length > 0 ? customers.reduce((s, c) => s + Number(c.total_ltv), 0) / customers.length : 0;
        const avgChurn = customers.length > 0 ? customers.reduce((s, c) => s + Number(c.churn_probability || 0), 0) / customers.length / 100 : 0;
        const channels = [...new Set(customers.map(c => c.acquisition_channel).filter(Boolean))];

        // RFM segment counts
        const rfmCounts = { Champions: 0, 'Em Risco': 0, 'Novos Promissores': 0, Inativos: 0 };
        for (const c of customers.filter(c => c.rfm_score != null)) {
            const score = c.rfm_score as string;
            if (!score || score.length !== 3) { rfmCounts['Novos Promissores']++; continue; }
            const r = parseInt(score[0]!), f = parseInt(score[1]!), m = parseInt(score[2]!);
            const avg = (r + f + m) / 3;
            if (r >= 4 && f >= 3 && m >= 3) rfmCounts['Champions']++;
            else if ((r <= 2 && m >= 3) || (r <= 2 && f >= 3)) rfmCounts['Em Risco']++;
            else if (avg <= 2) rfmCounts['Inativos']++;
            else rfmCounts['Novos Promissores']++;
        }

        const allRecs = recsResult.data || [];
        const pendingRecs = allRecs.filter(r => ['pending', 'approved', 'executing'].includes(r.status));
        const recentRecs = allRecs.filter(r => ['completed', 'failed'].includes(r.status));

        const channelPerformance = (channelPerfResult.data || []).map(row => ({
            channel: row.acquisition_channel as string,
            customers_acquired: Number(row.customers_acquired || 0),
            avg_ltv_brl: Number(row.avg_ltv_brl || 0),
            total_spend_brl: Number(row.total_spend_brl || 0),
            true_roi: row.true_roi != null ? Number(row.true_roi) : null,
        }));

        const growthModel = (req.body.model as string) || 'sonnet';

        const context: AIService.GrowthChatContext = {
            profileId,
            model: growthModel,
            businessStats: { total_revenue: totalRevenue, avg_ltv: avgLtv, avg_churn: avgChurn, active_channels: channels },
            rfmSegments: rfmCounts,
            channelPerformance,
            pendingRecs,
            recentRecs,
            history,
        };

        // Persistir mensagem do usuário
        await supabase.from('ai_chat_history').insert({ profile_id: profileId, role: 'user', content: message });

        const response = await AIService.generateGrowthAIResponse(message, context);

        // Persistir resposta
        await supabase.from('ai_chat_history').insert({ profile_id: profileId, role: 'assistant', content: response.content });

        res.status(200).json(response);
    } catch (error: unknown) {
        console.error('Growth Chat Error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}
