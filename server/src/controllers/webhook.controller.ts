import type { Request, Response } from 'express';
import { supabase } from '../lib/supabase.js';
import { normalizeData } from '../services/normalization.service.js';

/**
 * Handles incoming webhooks by persisting raw data and triggering normalization
 */
export async function handleWebhook(req: Request, res: Response) {
    const { platform } = req.params;
    const payload = req.body;
    const profileId = req.headers['x-profile-id'];

    if (!platform || typeof platform !== 'string') {
        return res.status(400).json({ error: 'Missing or invalid platform parameter' });
    }

    if (!profileId || typeof profileId !== 'string') {
        return res.status(400).json({ error: 'Missing or invalid x-profile-id header' });
    }

    try {
        // 1. Persist raw data for safety (Audit Trail)
        const { data: rawData, error: rawError } = await supabase
            .from('platforms_data_raw')
            .insert({
                profile_id: profileId as string,
                platform,
                payload,
                processed: false
            })
            .select()
            .single();

        if (rawError) throw rawError;

        // 2. Respond immediately to the platform (webhook requirement)
        res.status(200).json({ status: 'received', id: rawData.id });

        // 3. Trigger normalization (Asynchronously)
        // In production, this would be a background job (BullMQ/Redis)
        normalizeData(rawData.id, platform, payload, profileId as string).catch(err => {
            console.error(`Normalization error for ${platform} [${rawData.id}]:`, err);
        });

    } catch (error: any) {
        console.error(`Webhook error for ${platform}:`, error);
        res.status(500).json({ error: 'Internal server error' });
    }
}
