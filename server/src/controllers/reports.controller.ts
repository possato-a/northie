import type { Request, Response } from 'express';
import { supabase } from '../lib/supabase.js';
import {
    generateReportData, formatAsCsv, computeNextSendAt,
    type ReportFrequency, type ReportFormat
} from '../services/reports/report-generator.js';
import { generateReportNarrative, type ReportAIAnalysis } from '../services/reports/report-ai-analyst.js';
import { generatePdf } from '../services/reports/report-pdf.js';
import { generateXlsx } from '../services/reports/report-xlsx.js';
import { sendReport } from '../services/reports/report-email.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

const FREQ_MAP: Record<string, ReportFrequency> = {
    semanal: 'weekly', mensal: 'monthly', trimestral: 'quarterly',
    weekly: 'weekly', monthly: 'monthly', quarterly: 'quarterly',
};

function buildSnapshot(
    data: Awaited<ReturnType<typeof generateReportData>>,
    ai: ReportAIAnalysis
) {
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

export async function getReportConfig(req: Request, res: Response) {
    const profileId = req.headers['x-profile-id'] as string;
    if (!profileId) return res.status(400).json({ error: 'Missing x-profile-id' });

    const { data, error } = await supabase
        .from('report_configs')
        .select('*')
        .eq('profile_id', profileId)
        .single();

    if (error && error.code !== 'PGRST116') return res.status(500).json({ error: error.message });
    return res.json(data ?? null);
}

export async function saveReportConfig(req: Request, res: Response) {
    const profileId = req.headers['x-profile-id'] as string;
    if (!profileId) return res.status(400).json({ error: 'Missing x-profile-id' });

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

    if (error) return res.status(500).json({ error: error.message });
    return res.json(data);
}

// Preview rápido — só dados, sem IA (responde em ~2-3s)
export async function getReportPreview(req: Request, res: Response) {
    const profileId = req.headers['x-profile-id'] as string;
    if (!profileId) return res.status(400).json({ error: 'Missing x-profile-id' });

    const freqRaw: string = (req.query.frequency as string) ?? 'monthly';
    const frequency: ReportFrequency = FREQ_MAP[freqRaw] ?? 'monthly';

    try {
        const reportData = await generateReportData(profileId, frequency);
        return res.json({
            period: reportData.period,
            business_type: reportData.business_type,
            summary: reportData.summary,
            channel_economics: reportData.channel_economics,
            rfm_distribution: reportData.rfm_distribution,
            rfm_source: reportData.rfm_source,
            at_risk_customers: reportData.at_risk_customers,
            top_products: reportData.top_products,
            revenue_trend: reportData.revenue_trend,
        });
    } catch (err) {
        console.error('[Reports] preview error:', err);
        return res.status(500).json({ error: 'Failed to generate preview' });
    }
}

// Análise de IA separada — chamada lazy pelo frontend após carregar dados (pode levar ~30-60s)
export async function getReportAIAnalysis(req: Request, res: Response) {
    const profileId = req.headers['x-profile-id'] as string;
    if (!profileId) return res.status(400).json({ error: 'Missing x-profile-id' });

    const freqRaw: string = (req.query.frequency as string) ?? 'monthly';
    const frequency: ReportFrequency = FREQ_MAP[freqRaw] ?? 'monthly';

    try {
        const reportData = await generateReportData(profileId, frequency);
        const aiAnalysis = await generateReportNarrative(reportData, profileId);
        return res.json({
            situacao_geral: aiAnalysis.situacao_geral,
            resumo_executivo: aiAnalysis.resumo_executivo,
            diagnosticos: aiAnalysis.diagnosticos,
            proximos_passos: aiAnalysis.proximos_passos,
        });
    } catch (err) {
        console.error('[Reports] AI analysis error:', err);
        return res.status(500).json({ error: 'Failed to generate AI analysis' });
    }
}

export async function generateReport(req: Request, res: Response) {
    const profileId = req.headers['x-profile-id'] as string;
    if (!profileId) return res.status(400).json({ error: 'Missing x-profile-id' });

    const freqRaw: string = req.body.frequency ?? 'monthly';
    const frequency: ReportFrequency = FREQ_MAP[freqRaw] ?? 'monthly';
    const format: ReportFormat = req.body.format ?? 'xlsx';

    try {
        const reportData = await generateReportData(profileId, frequency);

        // IA só é chamada para PDF — XLSX e JSON exportam rápido sem IA
        const aiAnalysis = format === 'pdf'
            ? await generateReportNarrative(reportData, profileId)
            : { situacao_geral: 'atencao' as const, resumo_executivo: '', diagnosticos: [], proximos_passos: [], generated_at: new Date().toISOString(), model: 'n/a' };

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

        if (format === 'xlsx') {
            const xlsxBuffer = await generateXlsx(reportData, aiAnalysis);
            const filename = `northie-report-${freqRaw}-${dateStr}.xlsx`;
            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
            return res.send(xlsxBuffer);
        }

        if (format === 'pdf') {
            const pdfBuffer = await generatePdf(reportData, aiAnalysis);
            const filename = `northie-report-${freqRaw}-${dateStr}.pdf`;
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
            return res.send(pdfBuffer);
        }

        // JSON — estruturado em seções
        const filename = `northie-report-${freqRaw}-${dateStr}.json`;
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        return res.json({
            northie_relatorio: {
                gerado_em: new Date().toISOString(),
                frequencia: freqRaw,
                periodo: reportData.period,
                tipo_negocio: reportData.business_type ?? null,
            },
            resumo: {
                receita_liquida: reportData.summary.revenue_net,
                receita_bruta: reportData.summary.revenue_gross,
                margem_bruta_pct: reportData.summary.gross_margin_pct,
                variacao_receita_pct: reportData.summary.revenue_change_pct,
                transacoes: reportData.summary.transactions,
                ticket_medio: reportData.summary.aov,
                gasto_ads: reportData.summary.ad_spend,
                roas: reportData.summary.roas,
                novos_clientes: reportData.summary.new_customers,
                ltv_medio: reportData.summary.ltv_avg,
                taxa_reembolso_pct: reportData.summary.refund_rate,
                valor_reembolsado: reportData.summary.refund_amount,
                total_clientes_base: reportData.summary.total_customers,
            },
            economia_por_canal: reportData.channel_economics.map(ch => ({
                canal: ch.channel,
                novos_clientes: ch.new_customers,
                ltv_medio: ch.avg_ltv,
                cac: ch.cac,
                ltv_cac_ratio: ch.ltv_cac_ratio,
                receita_total_ltv: ch.total_ltv,
                gasto_canal: ch.total_spend,
                valor_criado: ch.value_created,
                status: ch.status,
            })),
            tendencia_receita: reportData.revenue_trend,
            top_produtos: reportData.top_products,
            segmentacao_rfm: {
                fonte: reportData.rfm_source,
                segmentos: reportData.rfm_distribution,
            },
            clientes_em_risco: reportData.at_risk_customers,
        });

    } catch (err) {
        console.error('[Reports] generateReport error:', err);
        return res.status(500).json({ error: 'Failed to generate report' });
    }
}

// GET /reports/export?format=pdf|xlsx&period=30d|90d  — download rápido sem IA
export async function exportReport(req: Request, res: Response) {
    const profileId = req.headers['x-profile-id'] as string;
    if (!profileId) return res.status(400).json({ error: 'Missing x-profile-id' });

    const format = (req.query.format as string) ?? 'pdf';
    const period = (req.query.period as string) ?? '30d';

    const periodFreqMap: Record<string, ReportFrequency> = { '30d': 'monthly', '90d': 'quarterly' };
    const frequency: ReportFrequency = periodFreqMap[period] ?? 'monthly';
    const freqLabel = period === '90d' ? 'trimestral' : 'mensal';
    const dateStr = new Date().toISOString().split('T')[0];

    try {
        const reportData = await generateReportData(profileId, frequency);

        if (format === 'xlsx') {
            const buf = await generateXlsx(reportData);
            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('Content-Disposition', `attachment; filename="northie-report-${freqLabel}-${dateStr}.xlsx"`);
            return res.send(buf);
        }

        // PDF — sem IA para resposta rápida
        const buf = await generatePdf(reportData);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="northie-report-${freqLabel}-${dateStr}.pdf"`);
        return res.send(buf);

    } catch (err) {
        console.error('[Reports] exportReport error:', err);
        return res.status(500).json({ error: 'Failed to export report' });
    }
}

export async function downloadLogReport(req: Request, res: Response) {
    const profileId = req.headers['x-profile-id'] as string;
    if (!profileId) return res.status(400).json({ error: 'Missing x-profile-id' });

    const { id } = req.params;
    const format: ReportFormat = req.query.format === 'xlsx' ? 'xlsx' : 'pdf';

    const { data: log, error: logErr } = await supabase
        .from('report_logs')
        .select('id, frequency, format, period_start, period_end, profile_id')
        .eq('id', id)
        .eq('profile_id', profileId)
        .single();

    if (logErr || !log) return res.status(404).json({ error: 'Report log not found' });

    const freqRaw: string = log.frequency ?? 'monthly';
    const frequency: ReportFrequency = FREQ_MAP[freqRaw] ?? 'monthly';
    const dates = log.period_start && log.period_end
        ? { start: new Date(log.period_start as string), end: new Date(log.period_end as string) }
        : undefined;
    const dateStr = (dates?.end ?? new Date()).toISOString().split('T')[0];

    try {
        const reportData = await generateReportData(profileId, frequency, dates);

        if (format === 'xlsx') {
            const buf = await generateXlsx(reportData);
            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('Content-Disposition', `attachment; filename="northie-report-${freqRaw}-${dateStr}.xlsx"`);
            return res.send(buf);
        }

        const buf = await generatePdf(reportData);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="northie-report-${freqRaw}-${dateStr}.pdf"`);
        return res.send(buf);
    } catch (err) {
        console.error('[Reports] downloadLogReport error:', err);
        return res.status(500).json({ error: 'Failed to regenerate report' });
    }
}

export async function getReportLogs(req: Request, res: Response) {
    const profileId = req.headers['x-profile-id'] as string;
    if (!profileId) return res.status(400).json({ error: 'Missing x-profile-id' });

    const { data, error } = await supabase
        .from('report_logs')
        .select('id, created_at, frequency, format, status, situacao_geral, snapshot, email_status, period_start, period_end')
        .eq('profile_id', profileId)
        .order('created_at', { ascending: false })
        .limit(20);

    if (error) return res.status(500).json({ error: error.message });
    return res.json(data ?? []);
}

export async function sendReportByEmail(req: Request, res: Response) {
    const profileId = req.headers['x-profile-id'] as string;
    if (!profileId) return res.status(400).json({ error: 'Missing x-profile-id' });

    const freqRaw: string = req.body.frequency ?? 'monthly';
    const frequency: ReportFrequency = FREQ_MAP[freqRaw] ?? 'monthly';
    const format: ReportFormat = req.body.format ?? 'pdf';

    // Email: do body ou da config salva
    let email: string = req.body.email ?? '';
    if (!email) {
        const { data: cfg } = await supabase
            .from('report_configs')
            .select('email')
            .eq('profile_id', profileId)
            .single();
        email = cfg?.email ?? '';
    }
    if (!email) return res.status(400).json({ error: 'Email não configurado. Configure em Relatórios > Envio automático.' });

    try {
        const reportData = await generateReportData(profileId, frequency);
        const aiAnalysis = await generateReportNarrative(reportData, profileId);
        const snapshot = buildSnapshot(reportData, aiAnalysis);
        const dateStr = new Date().toISOString().split('T')[0];

        let fileBuffer: Buffer | string;
        let filename: string;

        if (format === 'pdf') {
            fileBuffer = await generatePdf(reportData, aiAnalysis);
            filename = `northie-report-${freqRaw}-${dateStr}.pdf`;
        } else if (format === 'xlsx') {
            fileBuffer = Buffer.from(await generateXlsx(reportData, aiAnalysis));
            filename = `northie-report-${freqRaw}-${dateStr}.xlsx`;
        } else {
            fileBuffer = JSON.stringify({ ...reportData, ai_analysis: aiAnalysis }, null, 2);
            filename = `northie-report-${freqRaw}-${dateStr}.json`;
        }

        const resendEmailId = await sendReport({
            to: email,
            frequency: freqRaw,
            format,
            fileBuffer,
            filename,
            data: reportData,
            ai: aiAnalysis,
        });

        await supabase.from('report_logs').insert({
            profile_id: profileId,
            frequency: freqRaw,
            format,
            period_start: reportData.period.start,
            period_end: reportData.period.end,
            status: 'generated',
            situacao_geral: aiAnalysis.situacao_geral,
            snapshot,
            ...(resendEmailId ? { resend_email_id: resendEmailId, email_status: 'sent' } : {}),
        });

        return res.json({ ok: true, to: email, email_id: resendEmailId });
    } catch (err) {
        console.error('[Reports] sendReportByEmail error:', err);
        return res.status(500).json({ error: 'Falha ao enviar relatório por email' });
    }
}
