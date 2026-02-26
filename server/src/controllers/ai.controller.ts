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
        // 1. Buscar histórico das últimas N mensagens do perfil
        const { data: historyRows } = await supabase
            .from('ai_chat_history')
            .select('role, content')
            .eq('profile_id', profileId)
            .order('created_at', { ascending: false })
            .limit(HISTORY_LIMIT);

        // Reverter para ordem cronológica (mais antigas primeiro)
        const history: Array<{ role: 'user' | 'assistant'; content: string }> =
            (historyRows || []).reverse() as any;

        // 2. Buscar contexto de dados do workspace
        const { data: transData } = await supabase
            .from('transactions')
            .select('amount_net')
            .eq('profile_id', profileId)
            .eq('status', 'approved');
        const revenue = transData?.reduce((sum, t) => sum + Number(t.amount_net), 0) || 0;

        const { data: customers } = await supabase
            .from('customers')
            .select('acquisition_channel, total_ltv')
            .eq('profile_id', profileId);

        const context: AIService.ChatContext = {
            profileId,
            stats: {
                total_revenue: revenue,
                currency: 'BRL',
                total_customers: customers?.length || 0,
            },
            attribution: customers,
            history,
        };

        // 3. Persistir mensagem do usuário ANTES de gerar resposta
        await supabase.from('ai_chat_history').insert({
            profile_id: profileId,
            role: 'user',
            content: message,
        });

        // 4. Gerar resposta com histórico
        const response = await AIService.generateAIResponse(message, context);

        // 5. Persistir resposta da IA
        await supabase.from('ai_chat_history').insert({
            profile_id: profileId,
            role: 'assistant',
            content: response.content,
        });

        res.status(200).json(response);

    } catch (error: any) {
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
