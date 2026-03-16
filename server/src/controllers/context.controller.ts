import type { Request, Response } from 'express';
import { supabase } from '../lib/supabase.js';

/**
 * GET /api/context
 * Retorna o contexto de negócio do founder (ou null se ainda não preencheu).
 */
export async function getContext(req: Request, res: Response) {
    const profileId = req.headers['x-profile-id'] as string;
    if (!profileId) return res.status(400).json({ error: 'Missing x-profile-id header' });

    try {
        const { data, error } = await supabase
            .from('business_context')
            .select('id, profile_id, segmento, icp, ticket_medio, ciclo_vendas, sazonalidades, instrucoes_ia, custom_fields, created_at, updated_at')
            .eq('profile_id', profileId)
            .single();

        // PGRST116 = no rows found — not an error, just means the founder hasn't saved context yet
        if (error && error.code !== 'PGRST116') throw error;

        return res.status(200).json(data ?? null);
    } catch (err: unknown) {
        console.error('[context.controller] getContext error:', err instanceof Error ? err.message : String(err));
        return res.status(500).json({ error: 'Failed to fetch business context' });
    }
}

/**
 * POST /api/context
 * Upsert do contexto de negócio. Todos os campos são opcionais — o founder
 * pode salvar parcialmente e completar depois.
 *
 * Body: { segmento?, icp?, ticket_medio?, ciclo_vendas?, sazonalidades?, instrucoes_ia?, custom_fields? }
 */
export async function saveContext(req: Request, res: Response) {
    const profileId = req.headers['x-profile-id'] as string;
    if (!profileId) return res.status(400).json({ error: 'Missing x-profile-id header' });

    const {
        segmento,
        icp,
        ticket_medio,
        ciclo_vendas,
        sazonalidades,
        instrucoes_ia,
        custom_fields,
    } = req.body as {
        segmento?: string;
        icp?: string;
        ticket_medio?: number;
        ciclo_vendas?: string;
        sazonalidades?: string;
        instrucoes_ia?: string;
        custom_fields?: Record<string, unknown>;
    };

    try {
        const payload: Record<string, unknown> = {
            profile_id: profileId,
            updated_at: new Date().toISOString(),
        };

        // Only include fields that were explicitly sent in the body
        if (segmento !== undefined) payload.segmento = segmento;
        if (icp !== undefined) payload.icp = icp;
        if (ticket_medio !== undefined) payload.ticket_medio = ticket_medio;
        if (ciclo_vendas !== undefined) payload.ciclo_vendas = ciclo_vendas;
        if (sazonalidades !== undefined) payload.sazonalidades = sazonalidades;
        if (instrucoes_ia !== undefined) payload.instrucoes_ia = instrucoes_ia;
        if (custom_fields !== undefined) payload.custom_fields = custom_fields;

        const { data, error } = await supabase
            .from('business_context')
            .upsert(payload, { onConflict: 'profile_id' })
            .select()
            .single();

        if (error) throw error;

        console.log(`[context.controller] Business context saved for profile ${profileId}`);
        return res.status(200).json(data);
    } catch (err: unknown) {
        console.error('[context.controller] saveContext error:', err instanceof Error ? err.message : String(err));
        return res.status(500).json({ error: 'Failed to save business context' });
    }
}
