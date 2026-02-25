import { supabase } from '../lib/supabase.js';
import { IntegrationService } from '../services/integration.service.js';

/**
 * Background job to check and refresh all active OAuth integrations
 */
export async function startTokenRefreshJob() {
    console.log('[Job] Starting Token Refresh Background Worker...');

    // Run every 30 minutes
    setInterval(async () => {
        try {
            console.log('[Job] Checking integrations for renewals...');

            const { data: integrations, error } = await supabase
                .from('integrations')
                .select('profile_id, platform, status')
                .eq('status', 'active');

            if (error) throw error;

            for (const integration of integrations || []) {
                try {
                    // For now, we refresh everything to ensure stability during dev
                    // In production, we would check 'expires_at'
                    await IntegrationService.refreshTokens(integration.profile_id, integration.platform);
                } catch (err: any) {
                    console.error(`[Job] Failed to refresh ${integration.platform} for ${integration.profile_id}:`, err.message);
                }
            }
        } catch (err: any) {
            console.error('[Job] Main refresh loop error:', err.message);
        }
    }, 30 * 60 * 1000);
}
