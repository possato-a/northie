import { supabase } from '../lib/supabase.js';
export async function getAlerts(req, res) {
    const profileId = req.headers['x-profile-id'];
    if (!profileId)
        return res.status(400).json({ error: 'Missing profile' });
    try {
        const { data, error } = await supabase
            .from('alerts')
            .select('id, type, severity, title, body, meta, read, created_at')
            .eq('profile_id', profileId)
            .order('created_at', { ascending: false })
            .limit(20);
        if (error)
            throw error;
        res.json({ data: data || [] });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
}
export async function markRead(req, res) {
    const profileId = req.headers['x-profile-id'];
    const { id } = req.params;
    if (!profileId)
        return res.status(400).json({ error: 'Missing profile' });
    try {
        const { error } = await supabase
            .from('alerts')
            .update({ read: true })
            .eq('id', id)
            .eq('profile_id', profileId);
        if (error)
            throw error;
        res.json({ success: true });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
}
export async function markAllRead(req, res) {
    const profileId = req.headers['x-profile-id'];
    if (!profileId)
        return res.status(400).json({ error: 'Missing profile' });
    try {
        const { error } = await supabase
            .from('alerts')
            .update({ read: true })
            .eq('profile_id', profileId)
            .eq('read', false);
        if (error)
            throw error;
        res.json({ success: true });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
}
//# sourceMappingURL=alerts.controller.js.map