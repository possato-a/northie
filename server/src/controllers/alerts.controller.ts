import { supabase } from '../lib/supabase.js';
import type { Request, Response } from 'express';

export async function getAlerts(req: Request, res: Response) {
    const profileId = req.headers['x-profile-id'] as string;
    if (!profileId) return res.status(400).json({ error: 'Missing profile' });

    try {
        const { data, error } = await supabase
            .from('alerts')
            .select('id, type, severity, title, body, meta, read, created_at')
            .eq('profile_id', profileId)
            .order('created_at', { ascending: false })
            .limit(20);

        if (error) throw error;
        res.json({ data: data || [] });
    } catch (err: unknown) {
        res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
}

export async function markRead(req: Request, res: Response) {
    const profileId = req.headers['x-profile-id'] as string;
    const { id } = req.params;
    if (!profileId) return res.status(400).json({ error: 'Missing profile' });

    try {
        const { error } = await supabase
            .from('alerts')
            .update({ read: true })
            .eq('id', id)
            .eq('profile_id', profileId);

        if (error) throw error;
        res.json({ success: true });
    } catch (err: unknown) {
        res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
}

export async function markAllRead(req: Request, res: Response) {
    const profileId = req.headers['x-profile-id'] as string;
    if (!profileId) return res.status(400).json({ error: 'Missing profile' });

    try {
        const { error } = await supabase
            .from('alerts')
            .update({ read: true })
            .eq('profile_id', profileId)
            .eq('read', false);

        if (error) throw error;
        res.json({ success: true });
    } catch (err: unknown) {
        res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
}
