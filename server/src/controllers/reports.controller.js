import { supabase } from '../lib/supabase.js';
import { generateReportData, formatAsCsv, computeNextSendAt } from '../services/reports/report-generator.js';
import { generateReportNarrative } from '../services/reports/report-ai-analyst.js';
import { generatePdf } from '../services/reports/report-pdf.js';
// ── Helpers ───────────────────────────────────────────────────────────────────
const FREQ_MAP = {
    semanal: 'weekly', mensal: 'monthly', trimestral: 'quarterly',
    weekly: 'weekly', monthly: 'monthly', quarterly: 'quarterly',
};
function buildSnapshot(data, ai) {
    const topChannel = data.channel_economics
        .filter(c => c.channel !== 'desconhecido')
        .sort((a, b) => b.value_created - a.value_created)[0];
    const worstChannel = data.channel_economics
        .filter(c => c.status === 'prejuizo')
        .sort((a, b) => a.value_created - b.value_created)[0];
    return {
        revenue_net: data.summary.revenue_net,
        ad_spend: data.summary.ad_spend,
        roas: data.summary.roas,
        new_customers: data.summary.new_customers,
        ltv_avg: data.summary.ltv_avg,
        revenue_change_pct: data.summary.revenue_change_pct,
        situacao_geral: ai.situacao_geral,
        resumo_executivo: ai.resumo_executivo,
        top_channel: topChannel ? {
            channel: topChannel.channel,
            value_created: topChannel.value_created,
            ltv_cac_ratio: topChannel.ltv_cac_ratio,
            status: topChannel.status,
        } : null,
        worst_channel: worstChannel ? {
            channel: worstChannel.channel,
            value_created: worstChannel.value_created,
            cac: worstChannel.cac,
            avg_ltv: worstChannel.avg_ltv,
        } : null,
        at_risk_count: data.at_risk_customers.length,
        at_risk_ltv: data.at_risk_customers.reduce((s, c) => s + (c.ltv ?? 0), 0),
        diagnosticos_count: ai.diagnosticos.length,
        criticos: ai.diagnosticos.filter(d => d.severidade === 'critica').length,
    };
}
// ── Controllers ───────────────────────────────────────────────────────────────
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
export async function getReportPreview(req, res) {
    const profileId = req.headers['x-profile-id'];
    if (!profileId)
        return res.status(400).json({ error: 'Missing x-profile-id' });
    const freqRaw = req.query.frequency ?? 'monthly';
    const frequency = FREQ_MAP[freqRaw] ?? 'monthly';
    try {
        const reportData = await generateReportData(profileId, frequency);
        const aiAnalysis = await generateReportNarrative(reportData);
        return res.json({
            period: reportData.period,
            summary: reportData.summary,
            channel_economics: reportData.channel_economics,
            rfm_distribution: reportData.rfm_distribution,
            at_risk_customers: reportData.at_risk_customers,
            ai: {
                situacao_geral: aiAnalysis.situacao_geral,
                resumo_executivo: aiAnalysis.resumo_executivo,
                diagnosticos: aiAnalysis.diagnosticos,
                proximos_passos: aiAnalysis.proximos_passos,
            },
        });
    }
    catch (err) {
        console.error('[Reports] preview error:', err);
        return res.status(500).json({ error: 'Failed to generate preview' });
    }
}
export async function generateReport(req, res) {
    const profileId = req.headers['x-profile-id'];
    if (!profileId)
        return res.status(400).json({ error: 'Missing x-profile-id' });
    const freqRaw = req.body.frequency ?? 'monthly';
    const frequency = FREQ_MAP[freqRaw] ?? 'monthly';
    const format = req.body.format ?? 'csv';
    try {
        const reportData = await generateReportData(profileId, frequency);
        const aiAnalysis = await generateReportNarrative(reportData);
        const snapshot = buildSnapshot(reportData, aiAnalysis);
        await supabase.from('report_logs').insert({
            profile_id: profileId,
            frequency: freqRaw,
            format,
            period_start: reportData.period.start,
            period_end: reportData.period.end,
            status: 'generated',
            situacao_geral: aiAnalysis.situacao_geral,
            snapshot,
        });
        const dateStr = new Date().toISOString().split('T')[0];
        if (format === 'csv') {
            const csv = formatAsCsv(reportData, aiAnalysis);
            const filename = `northie-report-${freqRaw}-${dateStr}.csv`;
            res.setHeader('Content-Type', 'text/csv; charset=utf-8');
            res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
            return res.send('\ufeff' + csv);
        }
        if (format === 'pdf') {
            const pdfBuffer = await generatePdf(reportData, aiAnalysis);
            const filename = `northie-report-${freqRaw}-${dateStr}.pdf`;
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
            return res.send(pdfBuffer);
        }
        // JSON
        const filename = `northie-report-${freqRaw}-${dateStr}.json`;
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        return res.json({ ...reportData, ai_analysis: aiAnalysis });
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
        .select('id, created_at, frequency, format, status, situacao_geral, snapshot, email_status, period_start, period_end')
        .eq('profile_id', profileId)
        .order('created_at', { ascending: false })
        .limit(20);
    if (error)
        return res.status(500).json({ error: error.message });
    return res.json(data ?? []);
}
//# sourceMappingURL=reports.controller.js.map