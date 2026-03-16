import { supabase } from '../lib/supabase.js';
import { calculateCapitalScore } from '../services/capital.service.js';

export async function runCapitalScoreForAllProfiles(): Promise<void> {
    console.log('[capital-score.job] Starting capital score calculation for all profiles...');

    const { data: profiles, error } = await supabase
        .from('profiles')
        .select('id');

    if (error || !profiles) {
        console.error('[capital-score.job] Failed to fetch profiles:', error?.message);
        return;
    }

    let success = 0;
    let failed = 0;

    await Promise.allSettled(
        profiles.map(async (profile) => {
            try {
                await calculateCapitalScore(profile.id);
                success++;
            } catch (err: unknown) {
                console.error(`[capital-score.job] Failed for profile ${profile.id}:`, err instanceof Error ? err.message : String(err));
                failed++;
            }
        })
    );

    console.log(`[capital-score.job] Done. Success: ${success}, Failed: ${failed}`);
}

export function startCapitalScoreJob(): void {
    if (process.env.NODE_ENV === 'production' || process.env.VERCEL) return;

    const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

    console.log('[capital-score.job] Scheduled monthly capital score job started.');

    // Não roda imediato no boot — espera o primeiro intervalo
    setInterval(() => {
        runCapitalScoreForAllProfiles().catch(console.error);
    }, THIRTY_DAYS_MS);
}
