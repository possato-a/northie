/**
 * @file pages/Relatorios/index.tsx
 * Página de Relatórios — preview ao vivo, histórico rico e configuração automática.
 */

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { reportsApi } from '../../lib/api'
import {
    PageHeader, SectionLabel, Btn, EmptyState, TH, NotionRow, LoadingRow,
} from '../../components/ui/shared'

// ── Types ─────────────────────────────────────────────────────────────────────

interface ReportConfig {
    enabled: boolean
    frequency: 'semanal' | 'mensal' | 'trimestral'
    format: 'csv' | 'json' | 'pdf'
    email: string
    next_send_at?: string
}

interface ChannelEcon {
    channel: string
    new_customers: number
    avg_ltv: number
    cac: number
    ltv_cac_ratio: number | null
    value_created: number
    status: 'lucrativo' | 'prejuizo' | 'organico'
}

interface Diagnosis {
    canal: string
    severidade: 'critica' | 'alta' | 'media' | 'ok'
    sintoma: string
    causa_raiz: string
    acao_recomendada: string
    consequencia_financeira_brl: number
    prazo: 'imediato' | 'esta_semana' | 'este_mes'
}

interface TopProduct {
    product_name: string
    revenue: number
    transactions: number
    pct_of_total: number
}

interface RevenueTrend {
    month: string
    revenue: number
    change_pct: number | null
}

interface PreviewData {
    period: { start: string; end: string; days: number; frequency: string }
    summary: {
        revenue_net: number
        revenue_gross: number
        ad_spend: number
        roas: number
        new_customers: number
        ltv_avg: number
        gross_margin_pct: number
        revenue_change_pct: number | null
        aov: number
        transactions: number
        refund_rate: number
        refund_amount: number
        total_customers: number
    }
    channel_economics: ChannelEcon[]
    at_risk_customers: { ltv: number; churn_probability: number | null }[]
    top_products: TopProduct[]
    revenue_trend: RevenueTrend[]
    rfm_source?: 'calculated' | 'estimated'
    business_type?: string | null
}

interface AIAnalysis {
    situacao_geral: 'saudavel' | 'atencao' | 'critica'
    resumo_executivo: string
    diagnosticos: Diagnosis[]
    proximos_passos: string[]
}

interface ReportLog {
    id: string
    created_at: string
    frequency: string
    format: string
    status: string
    situacao_geral?: 'saudavel' | 'atencao' | 'critica'
    email_status?: string
    period_start?: string
    period_end?: string
    snapshot?: {
        revenue_net: number
        roas: number
        new_customers: number
        criticos: number
    }
}

// ── Formatters ────────────────────────────────────────────────────────────────

const fmtBRL = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
const fmtNum = (n: number, d = 2) => n.toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d })
const fmtDate = (iso: string) => new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(iso))
const fmtDateShort = (iso: string) => new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' }).format(new Date(iso))

function nextReportDate(frequency: string, nextSendAt?: string): string {
    if (nextSendAt) return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' }).format(new Date(nextSendAt))
    const now = new Date()
    let next: Date
    if (frequency === 'semanal') { next = new Date(now); next.setDate(now.getDate() + (8 - now.getDay()) % 7 || 7) }
    else if (frequency === 'trimestral') { const q = Math.floor(now.getMonth() / 3); next = new Date(now.getFullYear(), (q + 1) * 3, 1) }
    else { next = new Date(now.getFullYear(), now.getMonth() + 1, 1) }
    return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' }).format(next)
}

// ── Situação geral ────────────────────────────────────────────────────────────

const SITUACAO_CONFIG = {
    saudavel: { label: 'Saudável', color: '#22C55E', bg: 'rgba(34,197,94,0.12)' },
    atencao:  { label: 'Atenção',  color: '#F59E0B', bg: 'rgba(245,158,11,0.12)' },
    critica:  { label: 'Crítica',  color: '#EF4444', bg: 'rgba(239,68,68,0.12)'  },
}

const SEVERIDADE_COLOR = {
    critica: '#EF4444', alta: '#F97316', media: '#F59E0B', ok: '#22C55E',
}

function SituacaoBadge({ value, size = 'sm' }: { value: 'saudavel' | 'atencao' | 'critica'; size?: 'sm' | 'md' }) {
    const cfg = SITUACAO_CONFIG[value]
    return (
        <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            padding: size === 'md' ? '6px 12px' : '3px 8px',
            borderRadius: 6, background: cfg.bg, border: `1px solid ${cfg.color}33`,
            fontFamily: 'var(--font-sans)', fontSize: size === 'md' ? 13 : 11,
            fontWeight: 600, color: cfg.color, letterSpacing: '0.02em',
        }}>
            <span style={{ width: size === 'md' ? 7 : 6, height: size === 'md' ? 7 : 6, borderRadius: '50%', background: cfg.color, flexShrink: 0 }} />
            {cfg.label}
        </span>
    )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function ToggleSwitch({ enabled, onChange }: { enabled: boolean; onChange: (v: boolean) => void }) {
    return (
        <motion.button onClick={() => onChange(!enabled)} whileTap={{ scale: 0.95 }}
            style={{ width: 44, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer', position: 'relative', flexShrink: 0, background: enabled ? '#1a7fe8' : 'var(--color-bg-tertiary)', transition: 'background 0.2s', padding: 0 }}
            aria-checked={enabled} role="switch">
            <motion.span animate={{ x: enabled ? 22 : 2 }} transition={{ duration: 0.18, ease: [0.4, 0, 0.2, 1] }}
                style={{ display: 'block', width: 20, height: 20, borderRadius: '50%', background: 'white', position: 'absolute', top: 2, boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
        </motion.button>
    )
}

function SegmentedControl<T extends string>({ options, value, onChange, labels }: {
    options: readonly T[]; value: T; onChange: (v: T) => void; labels?: Record<T, string>
}) {
    return (
        <div style={{ display: 'inline-flex', background: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: 3, gap: 2 }}>
            {options.map(opt => (
                <motion.button key={opt} onClick={() => onChange(opt)} whileTap={{ scale: 0.97 }}
                    style={{ padding: '5px 14px', borderRadius: 'calc(var(--radius-md) - 2px)', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', fontWeight: value === opt ? 500 : 400, background: value === opt ? 'var(--color-bg-primary)' : 'transparent', color: value === opt ? 'var(--color-text-primary)' : 'var(--color-text-secondary)', boxShadow: value === opt ? 'var(--shadow-sm)' : 'none', transition: 'all 0.15s ease' }}>
                    {labels ? labels[opt] : opt}
                </motion.button>
            ))}
        </div>
    )
}

function KpiMini({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontFamily: 'var(--font-sans)', fontSize: 11, fontWeight: 500, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 20, fontWeight: 700, color: color ?? 'var(--color-text-primary)', letterSpacing: '-0.5px' }}>{value}</span>
            {sub && <span style={{ fontFamily: 'var(--font-sans)', fontSize: 11, color: 'var(--color-text-secondary)' }}>{sub}</span>}
        </div>
    )
}

// ── Download helper ───────────────────────────────────────────────────────────

function DownloadIcon() {
    return (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
        </svg>
    )
}

function EmailIcon() {
    return (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="4" width="20" height="16" rx="2" /><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
        </svg>
    )
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface RelatoriosProps {
    onToggleChat?: () => void
    user?: { id?: string; email?: string } | null
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function Relatorios(_props: RelatoriosProps) {
    const card: React.CSSProperties = { background: 'var(--color-bg-primary)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', padding: 28 }
    const delay = (n: number) => n * 0.07

    // Config state
    const [config, setConfig] = useState<ReportConfig>({ enabled: false, frequency: 'mensal', format: 'pdf', email: '' })
    const [savedConfig, setSavedConfig] = useState<ReportConfig | null>(null)
    const [savingConfig, setSavingConfig] = useState(false)
    const [savedFeedback, setSavedFeedback] = useState(false)

    // Preview state
    const [preview, setPreview] = useState<PreviewData | null>(null)
    const [loadingPreview, setLoadingPreview] = useState(true)
    const [aiData, setAiData] = useState<AIAnalysis | null>(null)
    const [loadingAI, setLoadingAI] = useState(false)
    const [previewFreq, setPreviewFreq] = useState<ReportConfig['frequency']>('mensal')

    // Generate on-demand
    const [genFrequency, setGenFrequency] = useState<ReportConfig['frequency']>('mensal')
    const [generating, setGenerating] = useState<'csv' | 'json' | 'pdf' | null>(null)
    const [generatingStep, setGeneratingStep] = useState<0 | 1 | 2 | 3>(0)
    const [sendingEmail, setSendingEmail] = useState(false)
    const [emailFeedback, setEmailFeedback] = useState<{ ok: boolean; msg: string } | null>(null)

    // History
    const [logs, setLogs] = useState<ReportLog[]>([])
    const [loadingLogs, setLoadingLogs] = useState(true)

    const loadPreview = useCallback((freq: string) => {
        setLoadingPreview(true)
        setAiData(null)
        reportsApi.getPreview(freq)
            .then(res => {
                setPreview(res.data as PreviewData)
                setLoadingPreview(false)
                setLoadingAI(true)
                reportsApi.getAIAnalysis(freq)
                    .then(aiRes => { setAiData(aiRes.data as AIAnalysis); setLoadingAI(false) })
                    .catch(() => setLoadingAI(false))
            })
            .catch(() => setLoadingPreview(false))
    }, [])

    useEffect(() => {
        reportsApi.getConfig()
            .then(res => {
                if (res.data) { setConfig(res.data as ReportConfig); setSavedConfig(res.data as ReportConfig) }
            })
            .then(() => {}, () => {})

        reportsApi.getLogs()
            .then(res => setLogs((res.data as ReportLog[]) || []))
            .then(() => setLoadingLogs(false), () => setLoadingLogs(false))

        loadPreview(previewFreq)
    }, []) // eslint-disable-line react-hooks/exhaustive-deps

    async function handleSaveConfig() {
        setSavingConfig(true)
        try {
            await reportsApi.saveConfig(config)
            setSavedConfig(config)
            setSavedFeedback(true)
            setTimeout(() => setSavedFeedback(false), 2500)
        } finally {
            setSavingConfig(false)
        }
    }

    async function handleDownload(format: 'csv' | 'json' | 'pdf') {
        setGenerating(format)
        setGeneratingStep(0)

        // Progress animation for PDF only
        let stepTimers: ReturnType<typeof setTimeout>[] = []
        if (format === 'pdf') {
            stepTimers = [
                setTimeout(() => setGeneratingStep(1), 100),
                setTimeout(() => setGeneratingStep(2), 8000),
                setTimeout(() => setGeneratingStep(3), 16000),
            ]
        }

        try {
            const response = await reportsApi.generate(genFrequency, format)
            const ext = format
            const mime = { csv: 'text/csv', json: 'application/json', pdf: 'application/pdf' }[format]
            const url = URL.createObjectURL(new Blob([response.data as BlobPart], { type: mime }))
            const a = document.createElement('a')
            a.href = url; a.download = `northie-relatorio-${genFrequency}-${new Date().toISOString().slice(0, 10)}.${ext}`; a.click()
            URL.revokeObjectURL(url)
            // Refresh logs
            reportsApi.getLogs().then(res => setLogs((res.data as ReportLog[]) || [])).then(() => {}, () => {})
        } finally {
            stepTimers.forEach(clearTimeout)
            setGenerating(null)
            setGeneratingStep(0)
        }
    }

    async function handleSendEmail() {
        const email = config.email || savedConfig?.email || ''
        if (!email) {
            setEmailFeedback({ ok: false, msg: 'Configure um email na seção "Envio automático" abaixo.' })
            setTimeout(() => setEmailFeedback(null), 4000)
            return
        }
        setSendingEmail(true)
        setEmailFeedback(null)
        try {
            await reportsApi.sendEmail(genFrequency, config.format ?? 'pdf', email)
            setEmailFeedback({ ok: true, msg: `Enviado para ${email} ✓` })
            reportsApi.getLogs().then(res => setLogs((res.data as ReportLog[]) || [])).then(() => {}, () => {})
        } catch (err: unknown) {
            const axiosErr = err as { response?: { data?: { error?: string } } }
            const serverMsg = (axiosErr.response?.data?.error ?? '').toLowerCase()
            const isResendMissing = serverMsg.includes('resend') || serverMsg.includes('api_key') || serverMsg.includes('não configurado')
            setEmailFeedback({
                ok: false,
                msg: isResendMissing
                    ? 'Serviço de email não configurado. Adicione RESEND_API_KEY nas variáveis de ambiente do servidor (Vercel → Settings → Env Vars).'
                    : 'Falha ao enviar. Tente novamente.',
            })
        } finally {
            setSendingEmail(false)
            setTimeout(() => setEmailFeedback(null), 5000)
        }
    }

    // Derivados do preview
    const atRiskLtv = preview?.at_risk_customers.reduce((s, c) => s + (c.ltv ?? 0), 0) ?? 0

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 40 }}>
            <PageHeader title="Relatórios" subtitle="Análise completa do seu negócio com cruzamento de dados e diagnóstico de IA." />

            {/* ── Preview ao vivo ─────────────────────────────────────────── */}
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, delay: delay(1), ease: [0.25, 0.1, 0.25, 1] }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                    <SectionLabel>Visão atual do negócio</SectionLabel>
                    <SegmentedControl
                        options={['semanal', 'mensal', 'trimestral'] as const}
                        value={previewFreq}
                        onChange={v => { setPreviewFreq(v); loadPreview(v) }}
                        labels={{ semanal: 'Semana', mensal: 'Mês', trimestral: 'Trimestre' }}
                    />
                </div>

                <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
                    {loadingPreview ? (
                        <div style={{ padding: 32, display: 'flex', alignItems: 'center', gap: 12 }}>
                            <div style={{ width: 18, height: 18, borderRadius: '50%', border: '2px solid var(--color-border)', borderTopColor: '#1a7fe8', animation: 'spin 0.8s linear infinite' }} />
                            <span style={{ fontFamily: 'var(--font-sans)', fontSize: 13, color: 'var(--color-text-secondary)' }}>Carregando dados...</span>
                        </div>
                    ) : preview ? (
                        <>
                            {/* Header do preview com situação geral */}
                            <div style={{ padding: '20px 28px', borderBottom: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                        {aiData ? (
                                            <SituacaoBadge value={aiData.situacao_geral} size="md" />
                                        ) : (
                                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 6, background: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)', fontFamily: 'var(--font-sans)', fontSize: 12, color: 'var(--color-text-secondary)', fontWeight: 500 }}>
                                                {loadingAI ? (
                                                    <><span style={{ width: 12, height: 12, borderRadius: '50%', border: '2px solid var(--color-border)', borderTopColor: '#1a7fe8', animation: 'spin 0.8s linear infinite', display: 'inline-block' }} />Analisando...</>
                                                ) : 'IA indisponível'}
                                            </span>
                                        )}
                                        <span style={{ fontFamily: 'var(--font-sans)', fontSize: 12, color: 'var(--color-text-secondary)' }}>
                                            {fmtDateShort(preview.period.start)} – {fmtDateShort(preview.period.end)}
                                        </span>
                                    </div>
                                    <p style={{ margin: 0, fontFamily: 'var(--font-sans)', fontSize: 13, color: 'var(--color-text-secondary)', maxWidth: 600, lineHeight: 1.5 }}>
                                        {aiData?.resumo_executivo ?? (loadingAI ? 'Análise em processamento...' : '')}
                                    </p>
                                </div>
                            </div>

                            {/* KPIs principais — 6 colunas */}
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 0, borderBottom: '1px solid var(--color-border)' }}>
                                {[
                                    { label: 'Receita Líquida', value: fmtBRL(preview.summary.revenue_net), sub: preview.summary.revenue_change_pct !== null ? `${preview.summary.revenue_change_pct >= 0 ? '+' : ''}${fmtNum(preview.summary.revenue_change_pct)}% vs anterior` : undefined, color: preview.summary.revenue_change_pct !== null ? (preview.summary.revenue_change_pct >= 0 ? undefined : '#EF4444') : undefined },
                                    { label: 'ROAS', value: `${fmtNum(preview.summary.roas)}x`, sub: preview.summary.ad_spend > 0 ? `Spend ${fmtBRL(preview.summary.ad_spend)}` : 'Sem ads' },
                                    { label: 'LTV Médio', value: fmtBRL(preview.summary.ltv_avg), sub: `${preview.summary.new_customers} novos clientes` },
                                    { label: 'Ticket Médio', value: fmtBRL(preview.summary.aov), sub: `${preview.summary.transactions} transações` },
                                    { label: 'Margem Bruta', value: `${fmtNum(preview.summary.gross_margin_pct)}%`, sub: `Bruto ${fmtBRL(preview.summary.revenue_gross)}` },
                                    {
                                        label: 'Reembolsos',
                                        value: `${fmtNum(preview.summary.refund_rate ?? 0)}%`,
                                        sub: fmtBRL(preview.summary.refund_amount ?? 0),
                                        color: (preview.summary.refund_rate ?? 0) > 5 ? '#EF4444' : undefined,
                                    },
                                ].map((kpi, i) => (
                                    <div key={i} style={{ padding: '16px 20px', borderRight: i < 5 ? '1px solid var(--color-border)' : 'none' }}>
                                        <KpiMini {...kpi} />
                                    </div>
                                ))}
                            </div>

                            {/* Canais + diagnósticos */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0 }}>
                                {/* Canais */}
                                <div style={{ padding: '20px 24px', borderRight: '1px solid var(--color-border)' }}>
                                    <span style={{ fontFamily: 'var(--font-sans)', fontSize: 11, fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Canais</span>
                                    <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                                        {preview.channel_economics.filter(c => c.channel !== 'desconhecido').slice(0, 4).map(ch => (
                                            <div key={ch.channel} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                    <span style={{ width: 7, height: 7, borderRadius: '50%', flexShrink: 0, background: ch.status === 'lucrativo' ? '#22C55E' : ch.status === 'prejuizo' ? '#EF4444' : '#6B7280' }} />
                                                    <span style={{ fontFamily: 'var(--font-sans)', fontSize: 13, color: 'var(--color-text-primary)' }}>{ch.channel}</span>
                                                </div>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--color-text-secondary)' }}>
                                                        {ch.ltv_cac_ratio !== null ? `LTV/CAC ${fmtNum(ch.ltv_cac_ratio)}x` : 'Orgânico'}
                                                    </span>
                                                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 600, color: ch.value_created >= 0 ? '#22C55E' : '#EF4444' }}>
                                                        {ch.value_created >= 0 ? '+' : ''}{fmtBRL(ch.value_created)}
                                                    </span>
                                                </div>
                                            </div>
                                        ))}
                                        {preview.channel_economics.length === 0 && (
                                            <span style={{ fontFamily: 'var(--font-sans)', fontSize: 13, color: 'var(--color-text-secondary)' }}>Sem dados de canais no período</span>
                                        )}
                                    </div>
                                </div>

                                {/* Diagnósticos */}
                                <div style={{ padding: '20px 24px' }}>
                                    <span style={{ fontFamily: 'var(--font-sans)', fontSize: 11, fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Diagnósticos</span>
                                    <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
                                        {loadingAI && !aiData && (
                                            <span style={{ fontFamily: 'var(--font-sans)', fontSize: 12, color: 'var(--color-text-secondary)' }}>Analisando com IA...</span>
                                        )}
                                        {(aiData?.diagnosticos ?? []).slice(0, 3).map((d, i) => (
                                            <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                                                <span style={{ width: 6, height: 6, borderRadius: '50%', background: SEVERIDADE_COLOR[d.severidade], flexShrink: 0, marginTop: 5 }} />
                                                <div>
                                                    <span style={{ fontFamily: 'var(--font-sans)', fontSize: 12, fontWeight: 600, color: 'var(--color-text-primary)' }}>{d.canal}</span>
                                                    <p style={{ margin: '2px 0 0', fontFamily: 'var(--font-sans)', fontSize: 12, color: 'var(--color-text-secondary)', lineHeight: 1.4 }}>{d.sintoma}</p>
                                                </div>
                                                <span style={{ marginLeft: 'auto', fontFamily: 'var(--font-mono)', fontSize: 11, color: SEVERIDADE_COLOR[d.severidade], fontWeight: 600, flexShrink: 0 }}>
                                                    {fmtBRL(d.consequencia_financeira_brl)}
                                                </span>
                                            </div>
                                        ))}
                                        {!loadingAI && aiData && aiData.diagnosticos.length === 0 && (
                                            <span style={{ fontFamily: 'var(--font-sans)', fontSize: 13, color: '#22C55E' }}>Nenhum problema crítico identificado ✓</span>
                                        )}
                                        {preview.at_risk_customers.length > 0 && (
                                            <div style={{ marginTop: 4, padding: '8px 12px', background: 'rgba(245,158,11,0.08)', borderRadius: 6, border: '1px solid rgba(245,158,11,0.2)' }}>
                                                <span style={{ fontFamily: 'var(--font-sans)', fontSize: 12, color: '#F59E0B' }}>
                                                    {preview.at_risk_customers.length} clientes em risco de churn — {fmtBRL(atRiskLtv)} em LTV
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Tendência de receita */}
                            {(preview.revenue_trend?.length ?? 0) >= 2 && (
                                <div style={{ padding: '14px 24px', borderTop: '1px solid var(--color-border)', background: 'var(--color-bg-secondary)' }}>
                                    <span style={{ fontFamily: 'var(--font-sans)', fontSize: 11, fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Tendência</span>
                                    <div style={{ marginTop: 10, display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                                        {preview.revenue_trend!.map((t, i) => {
                                            const hasChange = t.change_pct !== null
                                            const isUp = (t.change_pct ?? 0) >= 0
                                            return (
                                                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                                    {i > 0 && <span style={{ color: 'var(--color-text-secondary)', fontSize: 12 }}>→</span>}
                                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                                                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 600, color: 'var(--color-text-primary)' }}>{fmtBRL(t.revenue)}</span>
                                                        <span style={{ fontFamily: 'var(--font-sans)', fontSize: 10, color: hasChange ? (isUp ? '#22C55E' : '#EF4444') : 'var(--color-text-secondary)' }}>
                                                            {t.month}{hasChange ? ` ${isUp ? '↑' : '↓'}${fmtNum(Math.abs(t.change_pct!))}%` : ''}
                                                        </span>
                                                    </div>
                                                </div>
                                            )
                                        })}
                                    </div>
                                </div>
                            )}

                            {/* Top produtos */}
                            {(preview.top_products?.length ?? 0) > 0 && (
                                <div style={{ padding: '14px 24px', borderTop: '1px solid var(--color-border)' }}>
                                    <span style={{ fontFamily: 'var(--font-sans)', fontSize: 11, fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Top Produtos</span>
                                    <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
                                        {preview.top_products!.slice(0, 3).map((p, i) => (
                                            <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                    <span style={{ fontFamily: 'var(--font-sans)', fontSize: 12, color: 'var(--color-text-primary)', maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                        {p.product_name}
                                                    </span>
                                                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 600, color: 'var(--color-text-primary)' }}>
                                                        {fmtBRL(p.revenue)} <span style={{ fontWeight: 400, color: 'var(--color-text-secondary)' }}>({p.pct_of_total}%)</span>
                                                    </span>
                                                </div>
                                                <div style={{ height: 3, borderRadius: 2, background: 'var(--color-border)', overflow: 'hidden' }}>
                                                    <div style={{ height: '100%', width: `${p.pct_of_total}%`, background: '#1a7fe8', borderRadius: 2 }} />
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Próximos passos */}
                            {(aiData?.proximos_passos?.length ?? 0) > 0 && (
                                <div style={{ padding: '16px 24px', borderTop: '1px solid var(--color-border)', background: 'var(--color-bg-secondary)', display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'center' }}>
                                    <span style={{ fontFamily: 'var(--font-sans)', fontSize: 11, fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', flexShrink: 0 }}>Próximos passos</span>
                                    {aiData!.proximos_passos.slice(0, 3).map((p, i) => (
                                        <span key={i} style={{ fontFamily: 'var(--font-sans)', fontSize: 12, color: 'var(--color-text-primary)' }}>
                                            <span style={{ color: '#1a7fe8', marginRight: 6, fontWeight: 600 }}>{i + 1}.</span>{p}
                                        </span>
                                    ))}
                                </div>
                            )}
                        </>
                    ) : (
                        <EmptyState title="Sem dados suficientes" description="Conecte integrações para gerar a análise do período." />
                    )}
                </div>
            </motion.div>

            {/* ── Gerar relatório ─────────────────────────────────────────── */}
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, delay: delay(2), ease: [0.25, 0.1, 0.25, 1] }}>
                <SectionLabel gutterBottom={16}>Exportar relatório</SectionLabel>
                <div style={card}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 24, flexWrap: 'wrap' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                            <p style={{ margin: 0, fontFamily: 'var(--font-sans)', fontSize: 13, color: 'var(--color-text-secondary)' }}>
                                Gere e baixe o relatório completo com dados cruzados, análise de canais e diagnóstico de IA.
                            </p>
                            <SegmentedControl
                                options={['semanal', 'mensal', 'trimestral'] as const}
                                value={genFrequency}
                                onChange={setGenFrequency}
                                labels={{ semanal: 'Última semana', mensal: 'Último mês', trimestral: 'Último trimestre' }}
                            />
                        </div>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                            {(['csv', 'json', 'pdf'] as const).map(fmt => (
                                <Btn key={fmt} variant={fmt === 'pdf' ? 'primary' : 'secondary'}
                                    onClick={() => handleDownload(fmt)}
                                    disabled={generating !== null || sendingEmail}
                                    icon={<DownloadIcon />}>
                                    {generating === fmt ? 'Gerando...' : fmt === 'pdf' ? 'PDF com IA' : fmt.toUpperCase()}
                                </Btn>
                            ))}
                            <div style={{ width: 1, height: 24, background: 'var(--color-border)', flexShrink: 0 }} />
                            <Btn variant="secondary"
                                onClick={handleSendEmail}
                                disabled={generating !== null || sendingEmail}
                                icon={<EmailIcon />}>
                                {sendingEmail ? 'Enviando...' : 'Enviar por email'}
                            </Btn>
                        </div>
                    </div>
                    <AnimatePresence>
                        {generating === 'pdf' && (
                            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                                style={{ margin: '16px 0 0', display: 'flex', flexDirection: 'column', gap: 8 }}>
                                <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                                    {([
                                        'Coletando dados das integrações...',
                                        'Cruzando fontes e analisando com IA...',
                                        'Gerando PDF...',
                                    ] as const).map((label, idx) => {
                                        const step = idx + 1
                                        const done = generatingStep > step
                                        const active = generatingStep === step
                                        return (
                                            <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                                <div style={{
                                                    width: 18, height: 18, borderRadius: '50%',
                                                    border: done ? 'none' : `2px solid ${active ? '#1a7fe8' : 'var(--color-border)'}`,
                                                    background: done ? '#1a7fe8' : 'transparent',
                                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                    animation: active ? 'spin 0.8s linear infinite' : 'none',
                                                    borderTopColor: active ? '#1a7fe8' : undefined,
                                                    flexShrink: 0,
                                                }}>
                                                    {done && <span style={{ color: 'white', fontSize: 10, lineHeight: 1 }}>✓</span>}
                                                </div>
                                                <span style={{ fontFamily: 'var(--font-sans)', fontSize: 12, color: active ? '#1a7fe8' : done ? '#22C55E' : 'var(--color-text-secondary)', fontWeight: active ? 500 : 400 }}>
                                                    {step}/{3}: {label}
                                                </span>
                                            </div>
                                        )
                                    })}
                                </div>
                            </motion.div>
                        )}
                        {emailFeedback && (
                            <motion.p key="email-feedback" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                                style={{ margin: '12px 0 0', fontFamily: 'var(--font-sans)', fontSize: 13, color: emailFeedback.ok ? '#22C55E' : '#EF4444' }}>
                                {emailFeedback.msg}
                            </motion.p>
                        )}
                    </AnimatePresence>
                </div>
            </motion.div>

            {/* ── Config automática ───────────────────────────────────────── */}
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, delay: delay(3), ease: [0.25, 0.1, 0.25, 1] }}>
                <SectionLabel gutterBottom={16}>Envio automático</SectionLabel>
                <div style={card}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
                            <div>
                                <p style={{ margin: 0, fontFamily: 'var(--font-sans)', fontSize: 15, fontWeight: 500, color: 'var(--color-text-primary)' }}>Relatórios automáticos</p>
                                <p style={{ margin: '4px 0 0', fontFamily: 'var(--font-sans)', fontSize: 13, color: 'var(--color-text-secondary)' }}>
                                    Gerados e enviados por email na frequência configurada
                                </p>
                            </div>
                            <ToggleSwitch enabled={config.enabled} onChange={v => setConfig(c => ({ ...c, enabled: v }))} />
                        </div>

                        <div style={{ height: 1, background: 'var(--color-border)' }} />

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                <span style={{ fontFamily: 'var(--font-sans)', fontSize: 11, fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Frequência</span>
                                <SegmentedControl options={['semanal', 'mensal', 'trimestral'] as const} value={config.frequency}
                                    onChange={v => setConfig(c => ({ ...c, frequency: v }))}
                                    labels={{ semanal: 'Semanal', mensal: 'Mensal', trimestral: 'Trimestral' }} />
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                <span style={{ fontFamily: 'var(--font-sans)', fontSize: 11, fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Formato</span>
                                <SegmentedControl options={['pdf', 'csv', 'json'] as const} value={config.format}
                                    onChange={v => setConfig(c => ({ ...c, format: v }))}
                                    labels={{ pdf: 'PDF com IA', csv: 'CSV', json: 'JSON' }} />
                            </div>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                            <span style={{ fontFamily: 'var(--font-sans)', fontSize: 11, fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Email de envio</span>
                            <input type="email" placeholder="seu@email.com" value={config.email}
                                onChange={e => setConfig(c => ({ ...c, email: e.target.value }))}
                                style={{ padding: '8px 12px', background: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', color: 'var(--color-text-primary)', fontFamily: 'var(--font-sans)', fontSize: 14, outline: 'none', width: '100%', maxWidth: 360, boxSizing: 'border-box', transition: 'border-color 0.15s' }}
                                onFocus={e => (e.currentTarget.style.borderColor = '#1a7fe8')}
                                onBlur={e => (e.currentTarget.style.borderColor = 'var(--color-border)')} />
                        </div>

                        <div style={{ height: 1, background: 'var(--color-border)' }} />

                        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                            <Btn variant="primary" onClick={handleSaveConfig} disabled={savingConfig}>
                                {savingConfig ? 'Salvando...' : 'Salvar configuração'}
                            </Btn>
                            <AnimatePresence>
                                {savedFeedback && (
                                    <motion.span initial={{ opacity: 0, x: -4 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}
                                        style={{ fontFamily: 'var(--font-sans)', fontSize: 13, color: '#22c55e' }}>
                                        Salvo ✓
                                    </motion.span>
                                )}
                            </AnimatePresence>
                        </div>

                        {(savedConfig?.enabled || config.enabled) && (
                            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                                style={{ padding: '12px 16px', background: 'rgba(26,127,232,0.08)', borderRadius: 8, border: '1px solid rgba(26,127,232,0.2)', display: 'flex', alignItems: 'center', gap: 10 }}>
                                <span style={{ fontFamily: 'var(--font-sans)', fontSize: 13, color: 'var(--color-text-secondary)' }}>
                                    Próximo relatório em{' '}
                                    <span style={{ fontFamily: 'var(--font-mono)', color: '#1a7fe8', fontWeight: 600 }}>
                                        {nextReportDate(config.frequency, savedConfig?.next_send_at)}
                                    </span>
                                </span>
                            </motion.div>
                        )}
                    </div>
                </div>
            </motion.div>

            {/* ── Histórico ──────────────────────────────────────────────── */}
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, delay: delay(4), ease: [0.25, 0.1, 0.25, 1] }} style={{ paddingBottom: 40 }}>
                <SectionLabel gutterBottom={16}>Histórico de relatórios</SectionLabel>
                <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 100px 80px 120px 110px 90px', padding: '12px 20px', borderBottom: '1px solid var(--color-border)' }}>
                        <TH>Período</TH>
                        <TH>Frequência</TH>
                        <TH>Formato</TH>
                        <TH>Receita</TH>
                        <TH>Situação</TH>
                        <TH align="right">Email</TH>
                    </div>

                    {loadingLogs ? <LoadingRow /> : logs.length === 0 ? (
                        <EmptyState title="Nenhum relatório gerado ainda" description="Gere seu primeiro relatório acima ou configure o envio automático." />
                    ) : (
                        <div>
                            {logs.map(log => {
                                const freqLabel: Record<string, string> = { semanal: 'Semanal', mensal: 'Mensal', trimestral: 'Trimestral', weekly: 'Semanal', monthly: 'Mensal', quarterly: 'Trimestral' }
                                const emailStatusLabel: Record<string, { label: string; color: string }> = {
                                    sent: { label: 'Enviado', color: '#6B7280' },
                                    delivered: { label: 'Entregue ✓', color: '#22C55E' },
                                    bounced: { label: 'Bounce ✗', color: '#EF4444' },
                                    complained: { label: 'Spam', color: '#F97316' },
                                    delayed: { label: 'Atrasado', color: '#F59E0B' },
                                }
                                const emailSt = log.email_status ? emailStatusLabel[log.email_status] : null
                                return (
                                    <NotionRow key={log.id} style={{ padding: '0 20px' }}>
                                        <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 100px 80px 120px 110px 90px', width: '100%', alignItems: 'center', minHeight: 52 }}>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--color-text-primary)' }}>
                                                    {fmtDate(log.created_at)}
                                                </span>
                                                {log.period_start && log.period_end && (
                                                    <span style={{ fontFamily: 'var(--font-sans)', fontSize: 11, color: 'var(--color-text-secondary)' }}>
                                                        {fmtDateShort(log.period_start)} – {fmtDateShort(log.period_end)}
                                                    </span>
                                                )}
                                            </div>
                                            <span style={{ fontFamily: 'var(--font-sans)', fontSize: 13, color: 'var(--color-text-secondary)' }}>
                                                {freqLabel[log.frequency] ?? log.frequency}
                                            </span>
                                            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>
                                                {log.format}
                                            </span>
                                            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--color-text-primary)', fontWeight: 600 }}>
                                                {log.snapshot?.revenue_net !== undefined ? fmtBRL(log.snapshot.revenue_net) : '—'}
                                            </span>
                                            <div>
                                                {log.situacao_geral ? <SituacaoBadge value={log.situacao_geral} /> : (
                                                    <span style={{ fontFamily: 'var(--font-sans)', fontSize: 12, color: 'var(--color-text-secondary)' }}>—</span>
                                                )}
                                            </div>
                                            <div style={{ textAlign: 'right' }}>
                                                {emailSt ? (
                                                    <span style={{ fontFamily: 'var(--font-sans)', fontSize: 12, color: emailSt.color, fontWeight: 500 }}>{emailSt.label}</span>
                                                ) : (
                                                    <span style={{ fontFamily: 'var(--font-sans)', fontSize: 12, color: 'var(--color-text-secondary)' }}>—</span>
                                                )}
                                            </div>
                                        </div>
                                    </NotionRow>
                                )
                            })}
                        </div>
                    )}
                </div>
            </motion.div>
        </div>
    )
}
