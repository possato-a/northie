import { supabase } from '../lib/supabase.js';
import { generateReportData, formatAsCsv, computeNextSendAt } from '../services/reports/report-generator.js';
export async function getReportConfig(req, res) {
    const profileId = req.headers['x-profile-id'];
    if (!profileId)
        return res.status(400).json({ error: 'Missing x-profile-id' });
    const { data, error } = await supabase
        .from('report_configs')
        .select('*')
        .eq('profile_id', profileId)
        .single();
    if (error && error.code !== 'PGRST116')
        return res.status(500).json({ error: error.message });
    return res.json(data ?? null);
}
export async function saveReportConfig(req, res) {
    const profileId = req.headers['x-profile-id'];
    if (!profileId)
        return res.status(400).json({ error: 'Missing x-profile-id' });
    const { frequency, format, enabled, email } = req.body;
    const { data, error } = await supabase
        .from('report_configs')
        .upsert({
        profile_id: profileId,
        frequency,
        format,
        enabled: enabled ?? true,
        email: email || null,
        next_send_at: computeNextSendAt(frequency),
        updated_at: new Date().toISOString(),
    }, { onConflict: 'profile_id' })
        .select()
        .single();
    if (error)
        return res.status(500).json({ error: error.message });
    return res.json(data);
}
export async function generateReport(req, res) {
    const profileId = req.headers['x-profile-id'];
    if (!profileId)
        return res.status(400).json({ error: 'Missing x-profile-id' });
    const frequency = req.body.frequency ?? 'monthly';
    const format = req.body.format ?? 'csv';
    try {
        const reportData = await generateReportData(profileId, frequency);
        await supabase.from('report_logs').insert({
            profile_id: profileId,
            frequency,
            format,
            period_start: reportData.period.start,
            period_end: reportData.period.end,
            status: 'generated',
        });
        const dateStr = new Date().toISOString().split('T')[0];
        if (format === 'csv') {
            const csv = formatAsCsv(reportData);
            const filename = `northie-report-${frequency}-${dateStr}.csv`;
            res.setHeader('Content-Type', 'text/csv; charset=utf-8');
            res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
            return res.send('\ufeff' + csv);
        }
        const filename = `northie-report-${frequency}-${dateStr}.json`;
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        return res.json(reportData);
    }
    catch (err) {
        console.error('[Reports] generateReport error:', err);
        return res.status(500).json({ error: 'Failed to generate report' });
    }
}
export async function getReportLogs(req, res) {
    const profileId = req.headers['x-profile-id'];
    if (!profileId)
        return res.status(400).json({ error: 'Missing x-profile-id' });
    const { data, error } = await supabase
        .from('report_logs')
        .select('*')
        .eq('profile_id', profileId)
        .order('created_at', { ascending: false })
        .limit(20);
    if (error)
        return res.status(500).json({ error: error.message });
    return res.json(data ?? []);
}
//# sourceMappingURL=reports.controller.js.map