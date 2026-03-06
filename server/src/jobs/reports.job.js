import { supabase } from '../lib/supabase.js';
import { generateReportData, formatAsCsv, computeNextSendAt, } from '../services/reports/report-generator.js';
import { generateReportNarrative } from '../services/reports/report-ai-analyst.js';
import { generatePdf } from '../services/reports/report-pdf.js';
import { generateXlsx } from '../services/reports/report-xlsx.js';
import { sendReport } from '../services/reports/report-email.js';
// ── Mutex — impede envio duplicado de relatórios em execuções simultâneas ─────
let isRunning = false;
// Normaliza frequência pt-BR → en
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
export async function processScheduledReports() {
    const now = new Date().toISOString();
    const { data: configs } = await supabase
        .from('report_configs')
        .select('*')
        .eq('enabled', true)
        .lte('next_send_at', now);
    if (!configs?.length)
        return;
    for (const config of configs) {
        const logId = crypto.randomUUID();
        const frequency = FREQ_MAP[config.frequency] ?? 'monthly';
        const format = config.format ?? 'pdf';
        const dateStr = new Date().toISOString().split('T')[0];
        try {
            const reportData = await generateReportData(config.profile_id, frequency);
            const aiAnalysis = await generateReportNarrative(reportData, config.profile_id);
            // Gera arquivo
            let fileBuffer;
            let filename;
            if (format === 'pdf') {
                fileBuffer = await generatePdf(reportData, aiAnalysis);
                filename = `northie-relatorio-${config.frequency}-${dateStr}.pdf`;
            }
            else if (format === 'xlsx') {
                fileBuffer = await generateXlsx(reportData, aiAnalysis);
                filename = `northie-relatorio-${config.frequency}-${dateStr}.xlsx`;
            }
            else if (format === 'csv') {
                fileBuffer = formatAsCsv(reportData, aiAnalysis);
                filename = `northie-relatorio-${config.frequency}-${dateStr}.csv`;
            }
            else {
                fileBuffer = JSON.stringify({ ...reportData, ai_analysis: aiAnalysis }, null, 2);
                filename = `northie-relatorio-${config.frequency}-${dateStr}.json`;
            }
            const snapshot = buildSnapshot(reportData, aiAnalysis);
            // Envia email se configurado e captura o ID do Resend
            let resendEmailId = null;
            if (config.email) {
                resendEmailId = await sendReport({
                    to: config.email,
                    frequency: config.frequency,
                    format,
                    fileBuffer,
                    filename,
                    data: reportData,
                    ai: aiAnalysis,
                });
            }
            // Log de sucesso
            await supabase.from('report_logs').insert({
                id: logId,
                profile_id: config.profile_id,
                frequency: config.frequency,
                format,
                period_start: reportData.period.start,
                period_end: reportData.period.end,
                status: 'success',
                situacao_geral: aiAnalysis.situacao_geral,
                snapshot,
                triggered_by: 'automatic',
                ...(resendEmailId ? { resend_email_id: resendEmailId, email_status: 'sent' } : {}),
            });
            // Agenda próximo envio (usa frequência normalizada p/ EN)
            await supabase
                .from('report_configs')
                .update({ next_send_at: computeNextSendAt(frequency), updated_at: now })
                .eq('id', config.id);
            console.log(`[Reports] Relatório ${format} enviado para ${config.profile_id}`);
        }
        catch (err) {
            console.error(`[Reports] Falha para profile ${config.profile_id}:`, err);
            await supabase.from('report_logs').insert({
                id: logId,
                profile_id: config.profile_id,
                frequency: config.frequency,
                format,
                status: 'error',
                triggered_by: 'automatic',
            });
        }
    }
}
async function processScheduledReportsWithMutex() {
    if (isRunning) {
        console.log('[ReportsJob] Já em execução, pulando ciclo');
        return;
    }
    isRunning = true;
    try {
        await processScheduledReports();
    }
    finally {
        isRunning = false;
    }
}
export function startReportsJob() {
    processScheduledReportsWithMutex();
    setInterval(processScheduledReportsWithMutex, 4 * 60 * 60 * 1000); // a cada 4h
    console.log('[Reports] Scheduled reports job started');
}
//# sourceMappingURL=reports.job.js.map