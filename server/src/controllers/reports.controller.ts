import type { Request, Response } from 'express';
import { supabase } from '../lib/supabase.js';
import {
    generateReportData, computeNextSendAt,
    type ReportFrequency, type ReportFormat
} from '../services/reports/report-generator.js';
import { generateReportNarrative, streamReportNarrative, type ReportAIAnalysis } from '../services/reports/report-ai-analyst.js';
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
const MAX_CACHE_SIZE = 50; // previne crescimento indefinido de memória

// Limpeza periódica — remove entradas expiradas para evitar acúmulo indefinido
setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of previewCache.entries()) {
        if (now - entry.ts > CACHE_TTL) {
            previewCache.delete(key);
        }
    }
}, 5 * 60 * 1000);

function getCached(key: string) {
    const e = previewCache.get(key);
    if (!e) return null;
    if (Date.now() - e.ts > CACHE_TTL) { previewCache.delete(key); return null; }
    return e.data;
}

function setCached(key: string, data: Awaited<ReturnType<typeof generateReportData>>) {
    // Evictar entrada mais antiga se cache cheio
    if (previewCache.size >= MAX_CACHE_SIZE) {
        const oldestKey = previewCache.keys().next().value;
        if (oldestKey) previewCache.delete(oldestKey);
    }
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
    // Promise.resolve() converte PromiseLike para Promise real, habilitando .catch()
    // Sem .catch(), o Supabase pode lançar exceção (projeto pausado, 522, etc.) que vira
    // unhandledRejection e termina o processo Node 15+ → Vercel retorna 500 na próxima req
    Promise.resolve(
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
        })
    ).then(({ error }) => {
        if (error) console.error('[Reports] Failed to write report_log:', error.message);
    }).catch((err: unknown) => {
        console.error('[Reports] writeReportLog threw unexpectedly:', err instanceof Error ? err.message : String(err));
    });
}

// ── Controllers ───────────────────────────────────────────────────────────────

export async function getReportConfig(req: Request, res: Response) {
    const profileId = req.headers['x-profile-id'] as string;
    if (!profileId) return res.status(400).json({ error: 'Missing x-profile-id' });

    const { data, error } = await supabase
        .from('report_configs')
        .select('frequency, format, enabled, email, next_send_at, period_type, custom_start, custom_end')
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

// Streaming SSE da análise de IA — o cliente recebe chunks em tempo real
export async function streamReportAIAnalysis(req: Request, res: Response) {
    const profileId = req.headers['x-profile-id'] as string;
    if (!profileId) return res.status(400).json({ error: 'Missing x-profile-id' });

    const freqRaw: string = (req.query.frequency as string) ?? 'monthly';
    const frequency: ReportFrequency = FREQ_MAP[freqRaw] ?? 'monthly';
    const customDates = parseDateRange(req.query as Record<string, unknown>);

    // Headers SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    const abortController = new AbortController();

    req.on('close', () => {
        abortController.abort();
    });

    const send = (payload: unknown) => res.write(`data: ${JSON.stringify(payload)}\n\n`);

    try {
        const cacheKey = `${profileId}:${frequency}:${customDates ? `${customDates.start.toISOString()}_${customDates.end.toISOString()}` : 'default'}`;
        let reportData = getCached(cacheKey);
        if (!reportData) {
            reportData = await generateReportData(profileId, frequency, customDates);
            setCached(cacheKey, reportData);
        }

        if (abortController.signal.aborted) return;

        send({ type: 'ready' }); // sinal de que os dados estão carregados, IA vai começar

        for await (const event of streamReportNarrative(reportData, abortController.signal)) {
            if (abortController.signal.aborted) break;
            send(event);
            if (event.type === 'done' || event.type === 'error') break;
        }
    } catch (err: any) {
        if (err?.name === 'AbortError') {
            console.log('[Reports] streamReportAIAnalysis: cliente desconectou, geração interrompida');
        } else {
            console.error('[Reports] streamReportAIAnalysis error:', err);
            send({ type: 'error', message: 'Falha ao gerar análise' });
        }
    } finally {
        res.end();
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
        console.log('[Reports] Starting report generation', { profileId, format, frequency });
        const reportData = await generateReportData(profileId, frequency, customDates);
        console.log('[Reports] Data fetched', { revenue: reportData.summary.revenue_net, transactions: reportData.summary.transactions });

        // IA só é chamada para PDF — XLSX e JSON exportam rápido sem IA
        const aiAnalysis = format === 'pdf'
            ? await generateReportNarrative(reportData, profileId)
            : { situacao_geral: 'atencao' as const, resumo_executivo: '', diagnosticos: [], proximos_passos: [], generated_at: new Date().toISOString(), model: 'n/a' };

        console.log('[Reports] AI done, generating file', { format });
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

        // JSON — estruturado em seções completas
        const jsonBody = {
            northie_relatorio: {
                gerado_em: new Date().toISOString(),
                frequencia: freqRaw,
                periodo: reportData.period,
                tipo_negocio: reportData.business_type ?? null,
                perfil: reportData.profile_name ?? null,
                modelo_negocio: reportData.business_model_info,
                integracoes_ativas: reportData.integrations_active,
                integracoes_faltantes: reportData.missing_integrations,
            },
            resumo_financeiro: {
                receita_liquida: reportData.summary.revenue_net,
                receita_bruta: reportData.summary.revenue_gross,
                margem_bruta_pct: reportData.summary.gross_margin_pct,
                variacao_receita_pct: reportData.summary.revenue_change_pct,
                receita_periodo_anterior: reportData.summary.prev_revenue_net,
                transacoes: reportData.summary.transactions,
                ticket_medio: reportData.summary.aov,
                taxa_reembolso_pct: reportData.summary.refund_rate,
                valor_reembolsado: reportData.summary.refund_amount,
                total_clientes_base: reportData.summary.total_customers,
            },
            metricas_aquisicao: {
                gasto_total_ads: reportData.summary.ad_spend,
                roas: reportData.summary.roas,
                novos_clientes: reportData.summary.new_customers,
                ltv_medio_novos: reportData.summary.ltv_avg,
                cac_medio: reportData.cac_overall,
                ltv_cac_ratio: reportData.ltv_cac_overall,
                impressoes: reportData.summary.impressions,
                cliques: reportData.summary.clicks,
                ctr_pct: reportData.summary.ctr,
                gasto_por_plataforma: reportData.spend_by_platform,
                receita_por_plataforma: reportData.revenue_by_platform,
            },
            saude_financeira: {
                health_score: reportData.health_score.score,
                classificacao: reportData.health_score.label,
                breakdown: reportData.health_score.breakdown,
                margem_contribuicao_pct: reportData.margin_contribution_pct,
                margem_contribuicao_brl: reportData.margin_contribution_brl,
                payback_meses: reportData.payback_months,
                mrr_projetado: reportData.mrr_projected,
                arr_projetado: reportData.arr_projected,
            },
            canais_de_aquisicao: reportData.channel_economics.map(ch => ({
                canal: ch.channel,
                novos_clientes: ch.new_customers,
                ltv_medio: ch.avg_ltv,
                ltv_total: ch.total_ltv,
                cac: ch.cac,
                ltv_cac_ratio: ch.ltv_cac_ratio,
                gasto_canal: ch.total_spend,
                valor_criado: ch.value_created,
                status: ch.status,
            })),
            produtos: {
                top_produtos: reportData.top_products,
            },
            clientes: {
                segmentacao_rfm: {
                    fonte: reportData.rfm_source,
                    segmentos: reportData.rfm_distribution,
                },
                em_risco_churn: reportData.at_risk_customers,
                top_clientes: reportData.top_customers,
            },
            tendencia_historica: {
                receita_mensal: reportData.revenue_trend,
                receita_consolidada: reportData.consolidated_revenue,
            },
            projecoes: {
                conservador: reportData.projections.conservative,
                moderado: reportData.projections.moderate,
                otimista: reportData.projections.optimistic,
                base_mensal: reportData.projections.base_monthly,
                nota_trajetoria: reportData.projections.trajectory_note,
            },
            analise_ia: {
                situacao_geral: aiAnalysis.situacao_geral,
                resumo_executivo: aiAnalysis.resumo_executivo,
                diagnosticos: aiAnalysis.diagnosticos,
                proximos_passos: aiAnalysis.proximos_passos,
                gerado_em: aiAnalysis.generated_at,
                modelo: aiAnalysis.model,
            },
            transacoes_detalhadas: reportData.transactions_detail,
        };
        // Loga APÓS montar o JSON com sucesso (fire-and-forget)
        writeReportLog({ profileId, freqRaw, format, period: reportData.period, situacao_geral: null, snapshot });
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename="northie-report-${freqRaw}-${dateStr}.json"`);
        return res.json(jsonBody);

    } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        const errStack = err instanceof Error ? err.stack : undefined;
        console.error('[PDF Generation Error]', {
            userId: profileId,
            format,
            frequency,
            error: { message: errMsg, stack: errStack },
        });

        // Detecta erro de conectividade com Supabase (projeto pausado, 522, etc.)
        const isDbDown = errMsg.includes('fetch failed') || errMsg.includes('ECONNREFUSED')
            || errMsg.includes('522') || errMsg.includes('Connection timed out')
            || errMsg.includes('network') || errMsg.includes('ENOTFOUND');

        return res.status(503).json({
            error: isDbDown
                ? 'Banco de dados temporariamente indisponível. Aguarde alguns minutos e tente novamente.'
                : 'Failed to generate report',
            debug: { message: errMsg, format, frequency },
        });
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
