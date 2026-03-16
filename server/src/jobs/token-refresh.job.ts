import { supabase } from '../lib/supabase.js';
import { IntegrationService } from '../services/integration.service.js';

export async function checkAndRefreshAll(): Promise<void> {
    try {
        console.log('[Job] Checking integrations for renewals...');

        const { data: integrations, error } = await supabase
            .from('integrations')
            .select('profile_id, platform, status')
            .eq('status', 'active');

        if (error) throw error;

        for (const integration of integrations || []) {
            try {
                // Só renova se o token estiver próximo de expirar (evita quota abuse)
                const tokens = await IntegrationService.getIntegration(integration.profile_id, integration.platform);
                if (!tokens) continue;
                if (IntegrationService.isNearExpiry(tokens)) {
                    console.log(`[Job] Refreshing ${integration.platform} for ${integration.profile_id} (near expiry)`);
                    await IntegrationService.refreshTokens(integration.profile_id, integration.platform);
                }
            } catch (err: unknown) {
                console.error(`[Job] Failed to refresh ${integration.platform} for ${integration.profile_id}:`, err instanceof Error ? err.message : String(err));
            }
        }
    } catch (err: unknown) {
        console.error('[Job] Main refresh loop error:', err instanceof Error ? err.message : String(err));
    }
}

/**
 * Background job to check and refresh all active OAuth integrations.
 * Roda imediatamente no startup e depois a cada 30 minutos.
 * Evita janela de 30min onde tokens expirados causariam falhas após restart.
 */
export async function startTokenRefreshJob() {
    console.log('[Job] Starting Token Refresh Background Worker...');

    // Primeira verificação imediata — cobre tokens que expiraram durante downtime
    checkAndRefreshAll();

    // Ciclo contínuo a cada 30 minutos
    setInterval(checkAndRefreshAll, 30 * 60 * 1000);
}
