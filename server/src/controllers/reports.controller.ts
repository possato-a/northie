import type { Request, Response } from 'express';
import { supabase } from '../lib/supabase.js';
import {
    generateReportData, computeNextSendAt,
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

// ── Preview data cache — evita dupla chamada generateReportData entre preview e IA ─
const previewCache = new Map<string, { data: Awaited<ReturnType<typeof generateReportData>>; ts: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 min

function getCached(key: string) {
    const e = previewCache.get(key);
    if (!e) return null;
    if (Date.now() - e.ts > CACHE_TTL) { previewCache.delete(key); return null; }
    return e.data;
}

function setCached(key: string, data: Awaited<ReturnType<typeof generateReportData>>) {
    previewCache.set(key, { data, ts: Date.now() });
}

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

// ── Log helper (fire-and-forget — nunca bloqueia a resposta HTTP) ─────────────

function writeReportLog(params: {
    profileId: string;
    freqRaw: string;
    format: string;
    period: { start: string; end: string };
    situacao_geral: 'saudavel' | 'atencao' | 'critica' | null;
    snapshot: ReturnType<typeof buildSnapshot>;
    resendEmailId?: string | null;
    triggeredBy?: 'manual' | 'automatic' | 'email';
}) {
    const { profileId, freqRaw, format, period, situacao_geral, snapshot, resendEmailId, triggeredBy } = params;
    supabase.from('report_logs').insert({
        profile_id: profileId,
        frequency: freqRaw,
        format,
        period_start: period.start,
        period_end: period.end,
        status: 'generated',
        situacao_geral,
        snapshot,
        triggered_by: triggeredBy ?? 'manual',
        ...(resendEmailId ? { resend_email_id: resendEmailId, email_status: 'sent' } : {}),
    }).then(({ error }) => {
        if (error) console.error('[Reports] Failed to write report_log:', error.message);
    });
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

    const { frequency, format, enabled, email, period_type, custom_start, custom_end } = req.body;

    // B6: Validar email
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return res.status(400).json({ error: 'Email inválido' });
    }

    // Validar datas customizadas
    if (period_type === 'custom') {
        if (!custom_start || !custom_end) return res.status(400).json({ error: 'Datas customizadas obrigatórias' });
        if (new Date(custom_start) >= new Date(custom_end)) return res.status(400).json({ error: 'Data inicial deve ser anterior à data final' });
    }

    // B1: Preservar next_send_at se a frequência não mudou
    const { data: existing } = await supabase
        .from('report_configs')
        .select('frequency, next_send_at')
        .eq('profile_id', profileId)
        .single();

    const freqChanged = !existing || existing.frequency !== frequency;
    const nextSendAt = freqChanged
        ? computeNextSendAt(FREQ_MAP[frequency] ?? 'monthly')
        : (existing?.next_send_at ?? computeNextSendAt(FREQ_MAP[frequency] ?? 'monthly'));

    const { data, error } = await supabase
        .from('report_configs')
        .upsert({
            profile_id: profileId,
            frequency,
            format,
            enabled: enabled ?? true,
            email: email || null,
            next_send_at: nextSendAt,
            period_type: period_type ?? 'last_30_days',
            custom_start: period_type === 'custom' ? custom_start : null,
            custom_end: period_type === 'custom' ? custom_end : null,
            updated_at: new Date().toISOString(),
        }, { onConflict: 'profile_id' })
        .select()
        .single();

    if (error) return res.status(500).json({ error: error.message });
    return res.json(data);
}

// ── Custom date range helper ───────────────────────────────────────────────────

function parseDateRange(query: Record<string, unknown>): { start: Date; end: Date } | undefined {
    const { period_type, custom_start, custom_end } = query;
    if (period_type === 'custom' && custom_start && custom_end) {
        const start = new Date(custom_start as string);
        const end = new Date(custom_end as string);
        if (!isNaN(start.getTime()) && !isNaN(end.getTime())) return { start, end };
    }
    return undefined;
}

// Preview rápido — só dados, sem IA (responde em ~2-3s)
export async function getReportPreview(req: Request, res: Response) {
    const profileId = req.headers['x-profile-id'] as string;
    if (!profileId) return res.status(400).json({ error: 'Missing x-profile-id' });

    const freqRaw: string = (req.query.frequency as string) ?? 'monthly';
    const frequency: ReportFrequency = FREQ_MAP[freqRaw] ?? 'monthly';
    const customDates = parseDateRange(req.query as Record<string, unknown>);

    try {
        const cacheKey = `${profileId}:${frequency}:${customDates ? `${customDates.start.toISOString()}_${customDates.end.toISOString()}` : 'default'}`;
        let reportData = getCached(cacheKey);
        if (!reportData) {
            reportData = await generateReportData(profileId, frequency, customDates);
            setCached(cacheKey, reportData);
        }
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
    const customDates = parseDateRange(req.query as Record<string, unknown>);

    try {
        const cacheKey = `${profileId}:${frequency}:${customDates ? `${customDates.start.toISOString()}_${customDates.end.toISOString()}` : 'default'}`;
        let reportData = getCached(cacheKey);
        if (!reportData) {
            reportData = await generateReportData(profileId, frequency, customDates);
            setCached(cacheKey, reportData);
        }
        const aiAnalysis = await generateReportNarrative(reportData, profileId);
        return res.json({
            situacao_geral: aiAnalysis.situacao_geral,
            resumo_executivo: aiAnalysis.resumo_executivo,
            diagnosticos: aiAnalysis.diagnosticos,
            proximos_passos: aiAnalysis.proximos_passos,
            is_ai_fallback: aiAnalysis.is_ai_fallback ?? false,
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
    const dateStr = new Date().toISOString().split('T')[0];
    const customDates = parseDateRange(req.body);

    try {
        const reportData = await generateReportData(profileId, frequency, customDates);

        // IA só é chamada para PDF — XLSX e JSON exportam rápido sem IA
        const aiAnalysis = format === 'pdf'
            ? await generateReportNarrative(reportData, profileId)
            : { situacao_geral: 'atencao' as const, resumo_executivo: '', diagnosticos: [], proximos_passos: [], generated_at: new Date().toISOString(), model: 'n/a' };

        const snapshot = buildSnapshot(reportData, aiAnalysis);

        if (format === 'xlsx') {
            const xlsxBuffer = await generateXlsx(reportData, aiAnalysis);
            // Loga APÓS geração bem-sucedida do arquivo (fire-and-forget)
            writeReportLog({ profileId, freqRaw, format, period: reportData.period, situacao_geral: null, snapshot });
            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('Content-Disposition', `attachment; filename="northie-report-${freqRaw}-${dateStr}.xlsx"`);
            return res.send(xlsxBuffer);
        }

        if (format === 'pdf') {
            const pdfBuffer = await generatePdf(reportData, aiAnalysis);
            // Loga APÓS geração bem-sucedida do arquivo (fire-and-forget)
            writeReportLog({ profileId, freqRaw, format, period: reportData.period, situacao_geral: aiAnalysis.situacao_geral, snapshot });
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `attachment; filename="northie-report-${freqRaw}-${dateStr}.pdf"`);
            return res.send(pdfBuffer);
        }

        // JSON — estruturado em seções
        const jsonBody = {
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
            segmentacao_rfm: { fonte: reportData.rfm_source, segmentos: reportData.rfm_distribution },
            clientes_em_risco: reportData.at_risk_customers,
        };
        // Loga APÓS montar o JSON com sucesso (fire-and-forget)
        writeReportLog({ profileId, freqRaw, format, period: reportData.period, situacao_geral: null, snapshot });
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename="northie-report-${freqRaw}-${dateStr}.json"`);
        return res.json(jsonBody);

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
            const dummyAi: ReportAIAnalysis = { situacao_geral: 'atencao', resumo_executivo: '', diagnosticos: [], proximos_passos: [], generated_at: new Date().toISOString(), model: 'n/a' };
            writeReportLog({ profileId, freqRaw: freqLabel, format, period: reportData.period, situacao_geral: null, snapshot: buildSnapshot(reportData, dummyAi) });
            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('Content-Disposition', `attachment; filename="northie-report-${freqLabel}-${dateStr}.xlsx"`);
            return res.send(buf);
        }

        // PDF — sem IA para resposta rápida
        const buf = await generatePdf(reportData);
        const dummyAi: ReportAIAnalysis = { situacao_geral: 'atencao', resumo_executivo: '', diagnosticos: [], proximos_passos: [], generated_at: new Date().toISOString(), model: 'n/a' };
        writeReportLog({ profileId, freqRaw: freqLabel, format, period: reportData.period, situacao_geral: null, snapshot: buildSnapshot(reportData, dummyAi) });
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
    const formatParam = req.query.format as string;
    const format: ReportFormat = formatParam === 'xlsx' ? 'xlsx' : formatParam === 'json' ? 'json' : 'pdf';

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

        if (format === 'json') {
            res.setHeader('Content-Type', 'application/json');
            res.setHeader('Content-Disposition', `attachment; filename="northie-report-${freqRaw}-${dateStr}.json"`);
            return res.json({ period: reportData.period, summary: reportData.summary, channel_economics: reportData.channel_economics, top_products: reportData.top_products, at_risk_customers: reportData.at_risk_customers });
        }

        const aiAnalysis = await generateReportNarrative(reportData, profileId);
        const buf = await generatePdf(reportData, aiAnalysis);
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

    const page = Math.max(0, parseInt((req.query.page as string) ?? '0', 10) || 0);
    const pageSize = 20;

    const { data, error } = await supabase
        .from('report_logs')
        .select('id, created_at, frequency, format, status, situacao_geral, snapshot, email_status, period_start, period_end')
        .eq('profile_id', profileId)
        .neq('format', 'csv')              // CSV é formato legado, sem suporte na UI
        .order('created_at', { ascending: false })
        .range(page * pageSize, (page + 1) * pageSize - 1);

    if (error) return res.status(500).json({ error: error.message });
    return res.json({ data: data ?? [], page, hasMore: (data?.length ?? 0) === pageSize });
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
        // FIX 3: reutilizar cache do preview se disponível (evita duplo roundtrip ao banco)
        const cacheKey = `${profileId}:${frequency}`;
        let reportData = getCached(cacheKey);
        if (!reportData) {
            reportData = await generateReportData(profileId, frequency);
            setCached(cacheKey, reportData);
        }
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

        // Loga APÓS email enviado com sucesso (fire-and-forget)
        writeReportLog({
            profileId, freqRaw, format,
            period: reportData.period,
            situacao_geral: aiAnalysis.situacao_geral,
            snapshot,
            resendEmailId,
            triggeredBy: 'email',
        });

        return res.json({ ok: true, to: email, email_id: resendEmailId });
    } catch (err) {
        console.error('[Reports] sendReportByEmail error:', err);
        return res.status(500).json({ error: 'Falha ao enviar relatório por email' });
    }
}
