import type { Request, Response } from 'express';
import { supabase } from '../lib/supabase.js';
import {
    generateReportData, formatAsCsv, computeNextSendAt,
    type ReportFrequency, type ReportFormat
} from '../services/reports/report-generator.js';
import { generateReportNarrative, type ReportAIAnalysis } from '../services/reports/report-ai-analyst.js';
import { generatePdf } from '../services/reports/report-pdf.js';
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
        const aiAnalysis = await generateReportNarrative(reportData);
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
    const format: ReportFormat = req.body.format ?? 'csv';

    try {
        const reportData = await generateReportData(profileId, frequency);

        // IA só é chamada para PDF — CSV e JSON exportam rápido sem IA
        const aiAnalysis = format === 'pdf'
            ? await generateReportNarrative(reportData)
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

    } catch (err) {
        console.error('[Reports] generateReport error:', err);
        return res.status(500).json({ error: 'Failed to generate report' });
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
        const aiAnalysis = await generateReportNarrative(reportData);
        const snapshot = buildSnapshot(reportData, aiAnalysis);
        const dateStr = new Date().toISOString().split('T')[0];

        let fileBuffer: Buffer | string;
        let filename: string;

        if (format === 'pdf') {
            fileBuffer = await generatePdf(reportData, aiAnalysis);
            filename = `northie-report-${freqRaw}-${dateStr}.pdf`;
        } else if (format === 'csv') {
            fileBuffer = formatAsCsv(reportData, aiAnalysis);
            filename = `northie-report-${freqRaw}-${dateStr}.csv`;
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
