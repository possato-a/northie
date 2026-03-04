import { supabase } from '../lib/supabase.js';
import { generateReportData, computeNextSendAt } from '../services/reports/report-generator.js';
import type { ReportFrequency } from '../services/reports/report-generator.js';

async function processScheduledReports() {
    const now = new Date().toISOString();

    const { data: configs } = await supabase
        .from('report_configs')
        .select('*')
        .eq('enabled', true)
        .lte('next_send_at', now);

    if (!configs?.length) return;

    for (const config of configs) {
        try {
            const reportData = await generateReportData(config.profile_id, config.frequency as ReportFrequency);

            await supabase.from('report_logs').insert({
                profile_id: config.profile_id,
                frequency: config.frequency,
                format: config.format,
                period_start: reportData.period.start,
                period_end: reportData.period.end,
                status: 'generated',
            });

            await supabase
                .from('report_configs')
                .update({ next_send_at: computeNextSendAt(config.frequency), updated_at: now })
                .eq('id', config.id);

            console.log(`[Reports] Scheduled report generated for profile ${config.profile_id}`);
        } catch (err) {
            console.error(`[Reports] Failed for profile ${config.profile_id}:`, err);
        }
    }
}

export function startReportsJob() {
    processScheduledReports();
    setInterval(processScheduledReports, 4 * 60 * 60 * 1000); // every 4h
    console.log('[Reports] Scheduled reports job started');
}
