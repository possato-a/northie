import { supabase } from '../lib/supabase.js';
import { calculateValuation } from '../services/valuation.service.js';
export async function runValuationForAllProfiles() {
    console.log('[valuation-calc.job] Starting valuation calculation for all profiles...');
    const { data: profiles, error } = await supabase
        .from('profiles')
        .select('id');
    if (error || !profiles) {
        console.error('[valuation-calc.job] Failed to fetch profiles:', error?.message);
        return;
    }
    let success = 0;
    let failed = 0;
    await Promise.allSettled(profiles.map(async (profile) => {
        try {
            await calculateValuation(profile.id);
            success++;
        }
        catch (err) {
            console.error(`[valuation-calc.job] Failed for profile ${profile.id}:`, err.message);
            failed++;
        }
    }));
    console.log(`[valuation-calc.job] Done. Success: ${success}, Failed: ${failed}`);
}
export function startValuationCalcJob() {
    if (process.env.NODE_ENV === 'production' || process.env.VERCEL)
        return;
    const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
    console.log('[valuation-calc.job] Scheduled monthly valuation job started.');
    // Não roda imediato no boot — espera o primeiro intervalo
    setInterval(() => {
        runValuationForAllProfiles().catch(console.error);
    }, THIRTY_DAYS_MS);
}
//# sourceMappingURL=valuation-calc.job.js.map