import type { Request, Response } from 'express';
import * as AIService from '../services/ai.service.js';
import { supabase } from '../lib/supabase.js';

/**
 * Main chat endpoint for "Ask Northie"
 */
export async function handleChatMessage(req: Request, res: Response) {
    const { message } = req.body;
    const profileId = req.headers['x-profile-id'] as string;

    if (!profileId || !message) {
        return res.status(400).json({ error: 'Missing x-profile-id or message' });
    }

    try {
        // 1. Fetch current context to inject into prompt
        const { data: transData } = await supabase.from('transactions').select('amount_net').eq('profile_id', profileId);
        const revenue = transData?.reduce((sum, t) => sum + Number(t.amount_net), 0) || 0;

        const { data: customers } = await supabase.from('customers').select('acquisition_channel, total_ltv').eq('profile_id', profileId);

        const context: AIService.ChatContext = {
            profileId,
            stats: {
                total_revenue: revenue,
                currency: 'BRL',
                total_customers: customers?.length || 0
            },
            attribution: customers // Detailed channel breakdown
        };

        // 2. Generate Response
        const response = await AIService.generateAIResponse(message, context);

        // 3. Store in History
        await supabase.from('ai_chat_history').insert({
            profile_id: profileId,
            role: 'user',
            content: message
        });

        await supabase.from('ai_chat_history').insert({
            profile_id: profileId,
            role: 'assistant',
            content: response.content
        });

        res.status(200).json(response);

    } catch (error: any) {
        console.error('AI Chat Error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}
