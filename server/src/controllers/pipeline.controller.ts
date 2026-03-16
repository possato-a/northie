import type { Request, Response } from 'express';
import { supabase } from '../lib/supabase.js';

const VALID_LEAD_STATUSES = ['lead', 'reuniao_agendada', 'reuniao_realizada', 'fechado', 'perdido'] as const;
const VALID_MEETING_STATUSES = ['agendada', 'realizada', 'cancelada', 'no_show'] as const;

// ── Leads ──────────────────────────────────────────────────────────────

/**
 * Lists all pipeline leads for the authenticated profile
 * @route GET /api/pipeline/leads
 */
export async function listLeads(req: Request, res: Response) {
    const profileId = req.headers['x-profile-id'] as string;

    if (!profileId) {
        return res.status(400).json({ error: 'Missing x-profile-id header' });
    }

    try {
        const { data, error } = await supabase
            .from('pipeline_leads')
            .select('*')
            .eq('profile_id', profileId)
            .order('created_at', { ascending: false })
            .limit(200);

        if (error) throw error;

        res.status(200).json(data || []);
    } catch (err: unknown) {
        console.error('[PipelineController] listLeads error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
}

/**
 * Creates a new pipeline lead
 * @route POST /api/pipeline/leads
 */
export async function createLead(req: Request, res: Response) {
    const profileId = req.headers['x-profile-id'] as string;

    if (!profileId) {
        return res.status(400).json({ error: 'Missing x-profile-id header' });
    }

    const { name, email, phone, company, source, status, value_estimate, notes } = req.body as Record<string, unknown>;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
        return res.status(400).json({ error: 'Missing required field: name' });
    }

    if (status && !VALID_LEAD_STATUSES.includes(status as typeof VALID_LEAD_STATUSES[number])) {
        return res.status(400).json({ error: `Invalid status. Must be one of: ${VALID_LEAD_STATUSES.join(', ')}` });
    }

    try {
        const { data, error } = await supabase
            .from('pipeline_leads')
            .insert({
                profile_id: profileId,
                name: (name as string).trim(),
                email: email || null,
                phone: phone || null,
                company: company || null,
                source: source || 'manual',
                status: status || 'lead',
                value_estimate: value_estimate ?? null,
                notes: notes || null,
            })
            .select()
            .single();

        if (error) throw error;

        res.status(201).json(data);
    } catch (err: unknown) {
        console.error('[PipelineController] createLead error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
}

/**
 * Updates a pipeline lead
 * @route PATCH /api/pipeline/leads/:id
 */
export async function updateLead(req: Request, res: Response) {
    const profileId = req.headers['x-profile-id'] as string;
    const { id } = req.params;

    if (!profileId) {
        return res.status(400).json({ error: 'Missing x-profile-id header' });
    }

    if (!id) {
        return res.status(400).json({ error: 'Missing lead id' });
    }

    const { name, email, phone, company, source, status, value_estimate, notes, meta } = req.body as Record<string, unknown>;

    if (status && !VALID_LEAD_STATUSES.includes(status as typeof VALID_LEAD_STATUSES[number])) {
        return res.status(400).json({ error: `Invalid status. Must be one of: ${VALID_LEAD_STATUSES.join(', ')}` });
    }

    // Build update payload — only include fields that were sent
    const updates: Record<string, unknown> = {};
    if (name !== undefined) updates.name = (name as string).trim();
    if (email !== undefined) updates.email = email;
    if (phone !== undefined) updates.phone = phone;
    if (company !== undefined) updates.company = company;
    if (source !== undefined) updates.source = source;
    if (status !== undefined) updates.status = status;
    if (value_estimate !== undefined) updates.value_estimate = value_estimate;
    if (notes !== undefined) updates.notes = notes;
    if (meta !== undefined) updates.meta = meta;

    if (Object.keys(updates).length === 0) {
        return res.status(400).json({ error: 'No fields to update' });
    }

    try {
        const { data, error } = await supabase
            .from('pipeline_leads')
            .update(updates)
            .eq('id', id)
            .eq('profile_id', profileId)
            .select()
            .single();

        if (error) throw error;

        if (!data) {
            return res.status(404).json({ error: 'Lead not found' });
        }

        res.status(200).json(data);
    } catch (err: unknown) {
        console.error('[PipelineController] updateLead error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
}

/**
 * Deletes a pipeline lead (hard delete)
 * @route DELETE /api/pipeline/leads/:id
 */
export async function deleteLead(req: Request, res: Response) {
    const profileId = req.headers['x-profile-id'] as string;
    const { id } = req.params;

    if (!profileId) {
        return res.status(400).json({ error: 'Missing x-profile-id header' });
    }

    if (!id) {
        return res.status(400).json({ error: 'Missing lead id' });
    }

    try {
        const { error } = await supabase
            .from('pipeline_leads')
            .delete()
            .eq('id', id)
            .eq('profile_id', profileId);

        if (error) throw error;

        res.status(204).send();
    } catch (err: unknown) {
        console.error('[PipelineController] deleteLead error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
}

// ── Meetings ───────────────────────────────────────────────────────────

/**
 * Lists all pipeline meetings for the authenticated profile
 * @route GET /api/pipeline/meetings
 */
export async function listMeetings(req: Request, res: Response) {
    const profileId = req.headers['x-profile-id'] as string;

    if (!profileId) {
        return res.status(400).json({ error: 'Missing x-profile-id header' });
    }

    try {
        const { data, error } = await supabase
            .from('pipeline_meetings')
            .select('*')
            .eq('profile_id', profileId)
            .order('scheduled_at', { ascending: false })
            .limit(100);

        if (error) throw error;

        res.status(200).json(data || []);
    } catch (err: unknown) {
        console.error('[PipelineController] listMeetings error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
}

/**
 * Creates a new pipeline meeting
 * @route POST /api/pipeline/meetings
 */
export async function createMeeting(req: Request, res: Response) {
    const profileId = req.headers['x-profile-id'] as string;

    if (!profileId) {
        return res.status(400).json({ error: 'Missing x-profile-id header' });
    }

    const { title, lead_id, scheduled_at, duration_minutes, notes, status } = req.body as Record<string, unknown>;

    if (!title || typeof title !== 'string' || title.trim().length === 0) {
        return res.status(400).json({ error: 'Missing required field: title' });
    }

    if (!scheduled_at) {
        return res.status(400).json({ error: 'Missing required field: scheduled_at' });
    }

    if (status && !VALID_MEETING_STATUSES.includes(status as typeof VALID_MEETING_STATUSES[number])) {
        return res.status(400).json({ error: `Invalid status. Must be one of: ${VALID_MEETING_STATUSES.join(', ')}` });
    }

    try {
        const { data, error } = await supabase
            .from('pipeline_meetings')
            .insert({
                profile_id: profileId,
                title: (title as string).trim(),
                lead_id: lead_id || null,
                scheduled_at: scheduled_at,
                duration_minutes: duration_minutes ?? null,
                notes: notes || null,
                status: status || 'agendada',
            })
            .select()
            .single();

        if (error) throw error;

        res.status(201).json(data);
    } catch (err: unknown) {
        console.error('[PipelineController] createMeeting error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
}

/**
 * Updates a pipeline meeting
 * @route PATCH /api/pipeline/meetings/:id
 */
export async function updateMeeting(req: Request, res: Response) {
    const profileId = req.headers['x-profile-id'] as string;
    const { id } = req.params;

    if (!profileId) {
        return res.status(400).json({ error: 'Missing x-profile-id header' });
    }

    if (!id) {
        return res.status(400).json({ error: 'Missing meeting id' });
    }

    const { title, lead_id, scheduled_at, duration_minutes, notes, status, transcript_summary, google_event_id } = req.body as Record<string, unknown>;

    if (status && !VALID_MEETING_STATUSES.includes(status as typeof VALID_MEETING_STATUSES[number])) {
        return res.status(400).json({ error: `Invalid status. Must be one of: ${VALID_MEETING_STATUSES.join(', ')}` });
    }

    // Build update payload — only include fields that were sent
    const updates: Record<string, unknown> = {};
    if (title !== undefined) updates.title = (title as string).trim();
    if (lead_id !== undefined) updates.lead_id = lead_id;
    if (scheduled_at !== undefined) updates.scheduled_at = scheduled_at;
    if (duration_minutes !== undefined) updates.duration_minutes = duration_minutes;
    if (notes !== undefined) updates.notes = notes;
    if (status !== undefined) updates.status = status;
    if (transcript_summary !== undefined) updates.transcript_summary = transcript_summary;
    if (google_event_id !== undefined) updates.google_event_id = google_event_id;

    if (Object.keys(updates).length === 0) {
        return res.status(400).json({ error: 'No fields to update' });
    }

    try {
        const { data, error } = await supabase
            .from('pipeline_meetings')
            .update(updates)
            .eq('id', id)
            .eq('profile_id', profileId)
            .select()
            .single();

        if (error) throw error;

        if (!data) {
            return res.status(404).json({ error: 'Meeting not found' });
        }

        res.status(200).json(data);
    } catch (err: unknown) {
        console.error('[PipelineController] updateMeeting error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
}
