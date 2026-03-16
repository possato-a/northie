import type { Request, Response } from 'express';
import { supabase } from '../lib/supabase.js';
import { generatePixelSnippet } from '../utils/pixel-snippet.js';

/**
 * Retorna o snippet do Northie Pixel gerado com o profileId do founder.
 * O founder copia e cola no <head> do seu site.
 */
export async function getPixelSnippet(req: Request, res: Response) {
    const profileId = req.headers['x-profile-id'] as string;
    if (!profileId) return res.status(400).json({ error: 'Missing x-profile-id header' });

    const backendUrl = process.env.BACKEND_URL || 'https://northie.vercel.app';
    const snippet = generatePixelSnippet(profileId, backendUrl);

    return res.status(200).json({ snippet, profileId, backendUrl });
}

/**
 * Handles incoming tracking events from the Northie Pixel (UTMs, Click IDs, etc.)
 */
export async function handlePixelEvent(req: Request, res: Response) {
    const {
        visitor_id,
        page_url,
        referrer,
        utm_source,
        utm_medium,
        utm_campaign,
        utm_content,
        utm_term,
        gclid,
        fbclid,
        affiliate_id
    } = req.body;

    const profileId = req.headers['x-profile-id'] as string;

    if (!profileId || !visitor_id) {
        return res.status(400).json({ error: 'Missing x-profile-id header or visitor_id' });
    }

    try {
        const { error } = await supabase
            .from('visits')
            .insert({
                profile_id: profileId,
                visitor_id,
                url: page_url,
                referrer,
                utm_source,
                utm_medium,
                utm_campaign,
                utm_content,
                utm_term,
                gclid,
                fbclid,
                affiliate_id: affiliate_id || null
            });

        if (error) throw error;

        res.status(200).json({ status: 'tracked' });
    } catch (error: unknown) {
        console.error('Pixel tracking error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}

/**
 * Retorna estatísticas de rastreamento do Northie Pixel para o founder.
 * GET /api/pixel/stats
 * Header: x-profile-id (injetado pelo authMiddleware via JWT, ou enviado diretamente)
 */
export async function getPixelStats(req: Request, res: Response) {
    const profileId = req.headers['x-profile-id'] as string;
    if (!profileId) return res.status(400).json({ error: 'Missing x-profile-id header' });

    try {
        // Total de visitas e visitantes únicos
        const { data: visitsData, error: visitsError } = await supabase
            .from('visits')
            .select('id, visitor_id, utm_source, utm_medium, utm_campaign, created_at')
            .eq('profile_id', profileId);

        if (visitsError) throw visitsError;

        const visits = visitsData ?? [];
        const total_visits = visits.length;

        // Visitantes únicos pelo visitor_id
        const uniqueVisitorIds = new Set(visits.map((v: any) => v.visitor_id).filter(Boolean));
        const unique_visitors = uniqueVisitorIds.size;

        // Visitas nos últimos 7 dias
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        const visits_last_7_days = visits.filter((v: any) =>
            v.created_at && new Date(v.created_at) >= sevenDaysAgo
        ).length;

        // Top fontes (utm_source ou 'Direto')
        const sourceCounts: Record<string, number> = {};
        for (const v of visits) {
            const source = (v as any).utm_source || 'Direto';
            sourceCounts[source] = (sourceCounts[source] || 0) + 1;
        }
        const top_sources = Object.entries(sourceCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([source, count]) => ({ source, count }));

        return res.status(200).json({
            data: {
                total_visits,
                unique_visitors,
                visits_last_7_days,
                top_sources,
            }
        });
    } catch (error: any) {
        console.error('Pixel stats error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}
