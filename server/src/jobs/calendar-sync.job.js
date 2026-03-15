/**
 * @file calendar-sync.job.js
 * Sincroniza eventos do Google Calendar para todos os profiles conectados.
 * Roda a cada 6 horas.
 */

import { supabase } from '../lib/supabase.js';
import { syncCalendarEvents } from '../services/calendar.service.js';
import { decrypt } from '../utils/encryption.js';

let isRunning = false;

async function runCalendarSyncForAllProfiles() {
    console.log('[CalendarSync] Starting sync for all profiles...');

    const { data: integrations, error } = await supabase
        .from('integrations')
        .select('profile_id, access_token, refresh_token, expires_at')
        .eq('platform', 'google_calendar')
        .eq('status', 'active');

    if (error) {
        console.error('[CalendarSync] Failed to fetch integrations:', error.message);
        return;
    }

    if (!integrations?.length) {
        console.log('[CalendarSync] No active Google Calendar integrations');
        return;
    }

    for (const integration of integrations) {
        try {
            const accessToken = decrypt(integration.access_token);
            const result = await syncCalendarEvents(integration.profile_id, accessToken);
            console.log(`[CalendarSync] Profile ${integration.profile_id}: ${result.synced} synced, ${result.errors} errors`);
        } catch (err) {
            console.error(`[CalendarSync] Error for profile ${integration.profile_id}:`, err.message);
        }
    }

    console.log('[CalendarSync] Sync complete.');
}

async function runWithMutex() {
    if (isRunning) {
        console.log('[CalendarSync] Already running, skipping cycle');
        return;
    }
    isRunning = true;
    try {
        await runCalendarSyncForAllProfiles();
    } finally {
        isRunning = false;
    }
}

export function startCalendarSyncJob() {
    console.log('[CalendarSync] Job registered — will run every 6 hours.');
    // 6 horas em ms
    setInterval(runWithMutex, 6 * 60 * 60 * 1000);
}

export { runCalendarSyncForAllProfiles };
