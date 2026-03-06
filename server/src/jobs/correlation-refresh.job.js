/**
 * @file jobs/correlation-refresh.job.ts
 * Refresh das materialized views de correlação e snapshot mensal de performance.
 *
 * Schedule:
 *   - REFRESH das views:  diário às 03:00 (após rfm-calc.job)
 *   - Snapshot mensal:    dia 1 de cada mês às 04:00
 */
import { supabase } from '../lib/supabase.js';
// ── Refresh das Materialized Views ────────────────────────────────────────────
async function refreshCorrelationViews() {
    console.log('[CorrelationRefresh] Refreshing materialized views...');
    try {
        const { error } = await supabase.rpc('refresh_correlation_views');
        if (error) {
            console.error('[CorrelationRefresh] Error refreshing views:', error.message);
        }
        else {
            console.log('[CorrelationRefresh] ✓ All correlation views refreshed');
        }
    }
    catch (err) {
        console.error('[CorrelationRefresh] Unexpected error:', err.message);
    }
}
// ── Snapshot Mensal ───────────────────────────────────────────────────────────
async function upsertMonthlySnapshots() {
    console.log('[CorrelationRefresh] Upserting monthly snapshots...');
    const { data: profiles } = await supabase.from('profiles').select('id');
    if (!profiles?.length)
        return;
    const snapshotMonth = new Date();
    snapshotMonth.setDate(1);
    snapshotMonth.setHours(0, 0, 0, 0);
    const snapshotMonthStr = snapshotMonth.toISOString().split('T')[0];
    for (const profile of profiles) {
        try {
            // Buscar dados de performance do mês atual
            const { data: perfRows } = await supabase
                .from('mv_campaign_ltv_performance')
                .select('*')
                .eq('profile_id', profile.id);
            if (!perfRows?.length)
                continue;
            // Buscar retenção do mês atual
            const { data: retRows } = await supabase
                .from('mv_cohort_retention')
                .select('*')
                .eq('profile_id', profile.id)
                .eq('cohort_month', snapshotMonthStr);
            const retByChannel = {};
            for (const row of retRows || []) {
                retByChannel[row.acquisition_channel] = row.retention_rate_30d ?? 0;
            }
            const snapshots = perfRows.map(row => ({
                profile_id: profile.id,
                snapshot_month: snapshotMonthStr,
                channel: row.channel,
                campaign_name: row.campaign_name || '',
                customers_acquired: row.customers_acquired ?? 0,
                total_ltv_brl: row.total_ltv_brl ?? 0,
                avg_ltv_brl: row.avg_ltv_brl ?? 0,
                total_spend_brl: row.total_spend_brl ?? 0,
                true_roi: row.true_roi ?? null,
                retention_rate_30d: retByChannel[row.channel] ?? null,
                avg_churn_probability: row.avg_churn_probability
                    ? Math.round(row.avg_churn_probability)
                    : null,
                high_churn_count: row.high_churn_count ?? 0,
            }));
            const { error } = await supabase
                .from('campaign_performance_snapshots')
                .upsert(snapshots, {
                onConflict: 'profile_id,snapshot_month,channel,campaign_name',
                ignoreDuplicates: false,
            });
            if (error) {
                console.error(`[CorrelationRefresh] Snapshot upsert error (${profile.id}):`, error.message);
            }
            else {
                console.log(`[CorrelationRefresh] ✓ Snapshot ${snapshotMonthStr} para profile ${profile.id} (${snapshots.length} linhas)`);
            }
        }
        catch (err) {
            console.error(`[CorrelationRefresh] Error for profile ${profile.id}:`, err.message);
        }
    }
}
// ── Scheduler ─────────────────────────────────────────────────────────────────
function scheduleAt(hour, minute, dayOfMonth, fn) {
    let lastRun = '';
    const tick = () => {
        const now = new Date();
        const key = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}-${hour}-${minute}`;
        if (now.getHours() === hour &&
            now.getMinutes() === minute &&
            (dayOfMonth === null || now.getDate() === dayOfMonth) &&
            lastRun !== key) {
            lastRun = key;
            fn().catch(err => console.error('[CorrelationRefresh] Scheduled job error:', err));
        }
    };
    setInterval(tick, 60 * 1000);
}
export function startCorrelationRefreshJob() {
    console.log('[CorrelationRefresh] Job registered.');
    // Refresh diário das views às 03:00
    scheduleAt(3, 0, null, refreshCorrelationViews);
    // Snapshot mensal: dia 1 às 04:00
    scheduleAt(4, 0, 1, upsertMonthlySnapshots);
}
export { refreshCorrelationViews, upsertMonthlySnapshots };
//# sourceMappingURL=correlation-refresh.job.js.map