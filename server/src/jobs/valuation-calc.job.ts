import { supabase } from '../lib/supabase.js';
import { calculateValuation } from '../services/valuation.service.js';

export async function runValuationForAllProfiles(): Promise<void> {
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

    for (const profile of profiles) {
        try {
            const result = await calculateValuation(profile.id as string);
            console.log(
                `[valuation-calc.job] Profile ${profile.id as string}: valuation R$${Math.round(result.valuation_brl).toLocaleString('pt-BR')} (${result.methodology})`,
            );
            success++;
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            console.error(`[valuation-calc.job] Failed for profile ${profile.id as string}:`, message);
            failed++;
        }

        // 500ms entre perfis para não sobrecarregar o DB
        await new Promise<void>(resolve => setTimeout(resolve, 500));
    }

    console.log(`[valuation-calc.job] Done. Success: ${success}, Failed: ${failed}`);
}

export function startValuationCalcJob(): void {
    if (process.env.NODE_ENV === 'production' || process.env.VERCEL) return;

    const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

    console.log('[valuation-calc.job] Scheduled monthly valuation job started (checks daily at 03:00 UTC).');

    setInterval(() => {
        const now = new Date();
        // Roda no 1º dia do mês entre 03:00 e 03:59 UTC
        if (now.getUTCDate() === 1 && now.getUTCHours() === 3) {
            runValuationForAllProfiles().catch(console.error);
        }
    }, TWENTY_FOUR_HOURS_MS);
}
