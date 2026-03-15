/**
 * @file calendar.controller.js
 * Endpoints da API Google Calendar
 */

import { supabase } from '../lib/supabase.js';
import { syncCalendarEvents, getMeetings, getMeetingInsights } from '../services/calendar.service.js';
import { decrypt } from '../utils/encryption.js';

/**
 * GET /api/calendar/events
 * Lista reuniões do founder
 */
export async function getEvents(req, res) {
    const profileId = req.headers['x-profile-id'];
    if (!profileId) return res.status(401).json({ error: 'Unauthorized' });

    try {
        const limit = parseInt(req.query.limit) || 20;
        const offset = parseInt(req.query.offset) || 0;

        const meetings = await getMeetings(profileId, limit, offset);
        res.json({ data: meetings });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
}

/**
 * GET /api/calendar/insights
 * Insights gerados por IA das reuniões
 */
export async function getInsights(req, res) {
    const profileId = req.headers['x-profile-id'];
    if (!profileId) return res.status(401).json({ error: 'Unauthorized' });

    try {
        const insights = await getMeetingInsights(profileId);
        res.json({ data: insights });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
}

/**
 * POST /api/calendar/sync
 * Dispara sync manual do Google Calendar
 */
export async function triggerSync(req, res) {
    const profileId = req.headers['x-profile-id'];
    if (!profileId) return res.status(401).json({ error: 'Unauthorized' });

    try {
        // Buscar token de acesso do Google Calendar
        const { data: integration, error } = await supabase
            .from('integrations')
            .select('access_token, refresh_token, expires_at, status')
            .eq('profile_id', profileId)
            .eq('platform', 'google_calendar')
            .single();

        if (error || !integration) {
            return res.status(404).json({ error: 'Google Calendar não conectado' });
        }

        if (integration.status !== 'active') {
            return res.status(400).json({ error: 'Integração inativa ou expirada' });
        }

        const accessToken = decrypt(integration.access_token);

        // Sync em background
        res.json({ data: { message: 'Sync iniciado' } });

        syncCalendarEvents(profileId, accessToken).catch(err =>
            console.error('[Calendar] Sync failed:', err.message)
        );
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
}

/**
 * POST /api/calendar/link/:meetingId/:customerId
 * Associa reunião a um customer manualmente
 */
export async function linkToCustomer(req, res) {
    const profileId = req.headers['x-profile-id'];
    if (!profileId) return res.status(401).json({ error: 'Unauthorized' });

    const { meetingId, customerId } = req.params;

    try {
        const { error } = await supabase
            .from('meetings')
            .update({ linked_customer_id: customerId })
            .eq('id', meetingId)
            .eq('profile_id', profileId);

        if (error) throw new Error(error.message);
        res.json({ data: { success: true } });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
}

/**
 * GET /api/calendar/status
 * Verifica se Google Calendar está conectado e retorna stats básicas
 */
export async function getCalendarStatus(req, res) {
    const profileId = req.headers['x-profile-id'];
    if (!profileId) return res.status(401).json({ error: 'Unauthorized' });

    try {
        const { data: integration } = await supabase
            .from('integrations')
            .select('status, created_at, metadata')
            .eq('profile_id', profileId)
            .eq('platform', 'google_calendar')
            .single();

        const { count } = await supabase
            .from('meetings')
            .select('*', { count: 'exact', head: true })
            .eq('profile_id', profileId);

        res.json({
            data: {
                connected: !!integration && integration.status === 'active',
                status: integration?.status || 'disconnected',
                total_meetings: count || 0,
                connected_at: integration?.created_at,
            },
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
}
