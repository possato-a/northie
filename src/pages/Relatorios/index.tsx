/**
 * @file pages/Relatorios/index.tsx
 * Página de Relatórios — preview ao vivo, histórico rico e configuração automática.
 */

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { reportsApi } from '../../lib/api'
import {
    PageHeader, SectionLabel, Btn, EmptyState, TH, NotionRow, LoadingRow,
} from '../../components/ui/shared'

// ── Types ─────────────────────────────────────────────────────────────────────

interface ReportConfig {
    enabled: boolean
    frequency: 'semanal' | 'mensal' | 'trimestral'
    format: 'xlsx' | 'json' | 'pdf'
    email: string
    next_send_at?: string
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
        ad_spend: number
        roas: number
        new_customers: number
        ltv_avg: number
        revenue_change_pct: number | null
        situacao_geral?: string
        resumo_executivo?: string
        top_channel?: { channel: string; value_created: number; status: string }
        worst_channel?: { channel: string; value_created: number; status: string } | null
        at_risk_count?: number
        at_risk_ltv?: number
        diagnosticos_count?: number
        criticos: number
    }
}

interface ChannelEconomics {
    channel: string
    new_customers: number
    avg_ltv: number
    cac: number
    ltv_cac_ratio: number | null
    total_spend: number
    value_created: number
    status: 'lucrativo' | 'prejuizo' | 'organico'
}

interface PreviewData {
    period: { start: string; end: string; days: number }
    summary: {
        revenue_net: number
        revenue_gross: number
        gross_margin_pct: number
        aov: number
        ad_spend: number
        roas: number
        new_customers: number
        ltv_avg: number
        revenue_change_pct: number | null
        transactions: number
        total_customers: number
    }
    channel_economics: ChannelEconomics[]
    at_risk_customers: { ltv: number | null }[]
    revenue_trend?: { revenue: number }[]
    top_products?: { product: string; revenue: number; transactions: number }[]
    rfm_distribution?: { segment: string; count: number; avg_ltv: number }[]
    rfm_source?: string
}

// ── Formatters ────────────────────────────────────────────────────────────────

const fmtBRL = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
const fmtDate = (iso: string) => new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(iso))
const fmtDateShort = (iso: string) => new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' }).format(new Date(iso))

function isValidEmail(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

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

// ── Sparkline ─────────────────────────────────────────────────────────────────

function Sparkline({ data, width = 160, height = 28 }: { data: number[]; width?: number; height?: number }) {
    if (data.length < 2) return null
    const min = Math.min(...data)
    const max = Math.max(...data)
    const range = max - min || 1
    const points = data.map((v, i) => {
        const x = (i / (data.length - 1)) * width
        const y = height - ((v - min) / range) * (height - 6) - 3
        return `${x.toFixed(1)},${y.toFixed(1)}`
    }).join(' ')
    const trend = data[data.length - 1] >= data[0]
    return (
        <svg width={width} height={height} style={{ overflow: 'visible', flexShrink: 0 }}>
            <polyline points={points} fill="none" stroke={trend ? '#22C55E' : '#EF4444'} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
        </svg>
    )
}

// ── Preview components ────────────────────────────────────────────────────────

const CHANNEL_LABEL: Record<string, string> = {
    meta_ads: 'Meta Ads', google_ads: 'Google Ads', hotmart: 'Hotmart',
    stripe: 'Stripe', shopify: 'Shopify', organico: 'Orgânico',
    email: 'Email', direto: 'Direto', afiliado: 'Afiliado',
    escala_e_volume: 'Escala e Volume',
    escala_e_volume_de_vendas: 'Escala e Volume',
    concentracao_de_receita: 'Concentração de Receita',
    ausencia_de_dados_de_canal: 'Dados de Canal',
    ausencia_de_dados_historicos: 'Dados Históricos',
    ausencia_de_recorrencia_e_ltv: 'Recorrência e LTV',
    rastreamento_e_atribuicao: 'Rastreamento',
    concentracao_de_produto: 'Concentração de Produto',
    ok: 'OK',
}

const STATUS_STYLE: Record<string, { color: string; bg: string; label: string }> = {
    lucrativo: { color: '#22C55E', bg: 'rgba(34,197,94,0.10)',  label: 'Lucrativo' },
    prejuizo:  { color: '#EF4444', bg: 'rgba(239,68,68,0.10)',  label: 'Prejuízo'  },
    organico:  { color: '#6B7280', bg: 'rgba(107,114,128,0.10)', label: 'Orgânico' },
}

const RFM_LABELS: Record<string, { label: string; color: string }> = {
    champions:          { label: 'Champions',   color: '#22C55E' },
    loyal_customers:    { label: 'Leais',        color: '#3B82F6' },
    at_risk:            { label: 'Em Risco',     color: '#F59E0B' },
    cant_lose_them:     { label: 'Críticos',     color: '#EF4444' },
    lost:               { label: 'Perdidos',     color: '#6B7280' },
    potential_loyalists:{ label: 'Potenciais',   color: '#8B5CF6' },
    new_customers:      { label: 'Novos',        color: '#06B6D4' },
    promising:          { label: 'Promissores',  color: '#10B981' },
    need_attention:     { label: 'Atenção',      color: '#F97316' },
}

function PreviewKpi({ label, value, sub, subColor }: { label: string; value: string; sub?: string; subColor?: string }) {
    return (
        <div style={{
            display: 'flex', flexDirection: 'column', gap: 4,
            padding: '14px 16px',
            background: 'var(--color-bg-secondary)',
            border: '1px solid var(--color-border)',
            borderRadius: 8,
            minWidth: 0,
        }}>
            <span style={{ fontFamily: 'var(--font-sans)', fontSize: 10, fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                {label}
            </span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 18, fontWeight: 600, color: 'var(--color-text-primary)', lineHeight: 1.2 }}>
                {value}
            </span>
            {sub && (
                <span style={{ fontFamily: 'var(--font-sans)', fontSize: 11, color: subColor ?? 'var(--color-text-secondary)' }}>
                    {sub}
                </span>
            )}
        </div>
    )
}

function PreviewSkeleton() {
    const bar = (w: string, h = 12) => (
        <div style={{ width: w, height: h, borderRadius: 4, background: 'var(--color-bg-tertiary)', animation: 'pulse 1.4s ease-in-out infinite' }} />
    )
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
                {[0,1,2,3].map(i => (
                    <div key={i} style={{ padding: '14px 16px', background: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)', borderRadius: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {bar('50%', 10)}{bar('70%', 20)}
                    </div>
                ))}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[0,1].map(i => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '1px solid var(--color-border)' }}>
                        {bar('120px')}{bar('80px')}{bar('60px')}
                    </div>
                ))}
            </div>
        </div>
    )
}

// ── AI Analysis types + components ───────────────────────────────────────────

interface AIAnalysis {
    situacao_geral: 'saudavel' | 'atencao' | 'critica'
    resumo_executivo: string
    diagnosticos: {
        canal: string
        severidade: 'critica' | 'alta' | 'media' | 'ok'
        sintoma: string
        acao_recomendada: string
        consequencia_financeira_brl: number
        prazo: string
    }[]
    proximos_passos: string[]
}

const SEV_STYLE: Record<string, { color: string; label: string }> = {
    critica: { color: '#EF4444', label: 'CRÍTICA' },
    alta:    { color: '#F59E0B', label: 'ALTA'    },
    media:   { color: '#F59E0B', label: 'MÉDIA'   },
    ok:      { color: '#22C55E', label: 'OK'      },
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

function RefreshIcon({ spinning }: { spinning: boolean }) {
    return (
        <svg
            width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            style={{ transition: 'transform 0.4s linear', transform: spinning ? 'rotate(360deg)' : 'rotate(0deg)', animation: spinning ? 'spin 0.7s linear infinite' : 'none' }}
        >
            <path d="M21 2v6h-6" />
            <path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
            <path d="M3 22v-6h6" />
            <path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
        </svg>
    )
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface RelatoriosProps {
    onToggleChat?: () => void
    user?: { id?: string; email?: string } | null
}

// ── Generating step messages ──────────────────────────────────────────────────

function getStepMessage(step: 0 | 1 | 2 | 3, format: 'xlsx' | 'json' | 'pdf' | null): string {
    if (step === 0) return 'Coletando dados do período...'
    if (step === 1) return 'Cruzando fontes e calculando métricas...'
    if (step === 2) return format === 'pdf' ? 'Analisando com IA — até 90s...' : 'Processando dados...'
    return `Gerando arquivo ${format?.toUpperCase() ?? ''}...`
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
    const [emailError, setEmailError] = useState<string | null>(null)

    // Preview
    const [preview, setPreview] = useState<PreviewData | null>(null)
    const [loadingPreview, setLoadingPreview] = useState(true)
    const [previewError, setPreviewError] = useState(false)

    // AI Analysis (lazy — só carrega quando o usuário pede)
    const [aiAnalysis, setAiAnalysis] = useState<AIAnalysis | null>(null)
    const [loadingAI, setLoadingAI] = useState(false)
    const [aiError, setAiError] = useState(false)

    // Generate on-demand
    const [genFrequency, setGenFrequency] = useState<ReportConfig['frequency']>('mensal')
    const [genFormat, setGenFormat] = useState<'pdf' | 'xlsx' | 'json'>('pdf')
    const [generating, setGenerating] = useState<'xlsx' | 'json' | 'pdf' | null>(null)
    const [generatingStep, setGeneratingStep] = useState<0 | 1 | 2 | 3>(0)
    const [sendingEmail, setSendingEmail] = useState(false)
    const [emailFeedback, setEmailFeedback] = useState<{ ok: boolean; msg: string } | null>(null)

    // History
    const [logs, setLogs] = useState<ReportLog[]>([])
    const [loadingLogs, setLoadingLogs] = useState(true)
    const [logsPage, setLogsPage] = useState(0)
    const [hasMoreLogs, setHasMoreLogs] = useState(false)
    const [loadingMore, setLoadingMore] = useState(false)
    const [downloadingLogId, setDownloadingLogId] = useState<string | null>(null)
    const [downloadError, setDownloadError] = useState<string | null>(null)
    const [expandedLogId, setExpandedLogId] = useState<string | null>(null)
    const [refreshingLogs, setRefreshingLogs] = useState(false)

    useEffect(() => {
        reportsApi.getConfig()
            .then(res => {
                if (res.data) {
                    setConfig(res.data as ReportConfig)
                    setSavedConfig(res.data as ReportConfig)
                    // F1 — sync genFrequency with saved config
                    if ((res.data as ReportConfig).frequency) {
                        setGenFrequency((res.data as ReportConfig).frequency)
                    }
                }
            })
            .then(() => {}, () => {})

        reportsApi.getLogs(0)
            .then(res => {
                const { data, hasMore } = res.data as { data: ReportLog[]; hasMore: boolean }
                setLogs(data || [])
                setHasMoreLogs(hasMore)
                setLogsPage(0)
            })
            .then(() => setLoadingLogs(false), () => setLoadingLogs(false))
    }, [])

    async function handleLoadMoreLogs() {
        setLoadingMore(true)
        const nextPage = logsPage + 1
        try {
            const res = await reportsApi.getLogs(nextPage)
            const { data, hasMore } = res.data as { data: ReportLog[]; hasMore: boolean }
            setLogs(prev => [...prev, ...(data || [])])
            setHasMoreLogs(hasMore)
            setLogsPage(nextPage)
        } catch {
            // silently ignore — user can retry
        } finally {
            setLoadingMore(false)
        }
    }

    // F8 — Refresh logs handler
    async function handleRefreshLogs() {
        setRefreshingLogs(true)
        try {
            const res = await reportsApi.getLogs(0)
            const { data, hasMore } = res.data as { data: ReportLog[]; hasMore: boolean }
            setLogs(data || [])
            setHasMoreLogs(hasMore)
            setLogsPage(0)
        } catch { /* silencioso */ } finally {
            setRefreshingLogs(false)
        }
    }

    useEffect(() => {
        setLoadingPreview(true)
        setPreviewError(false)
        setAiAnalysis(null)
        setAiError(false)
        reportsApi.getPreview(genFrequency)
            .then(res => { setPreview(res.data as PreviewData) })
            .catch(() => setPreviewError(true))
            .finally(() => setLoadingPreview(false))
    }, [genFrequency])

    async function handleRequestAI() {
        setLoadingAI(true)
        setAiError(false)
        try {
            const res = await reportsApi.getAIAnalysis(genFrequency)
            setAiAnalysis(res.data as AIAnalysis)
        } catch {
            setAiError(true)
        } finally {
            setLoadingAI(false)
        }
    }

    async function handleSaveConfig() {
        // F9 — validate email before saving
        if (config.email && !isValidEmail(config.email)) {
            setEmailError('Email inválido')
            return
        }
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

    async function handleDownload(format: 'xlsx' | 'json' | 'pdf') {
        setGenerating(format)
        setGeneratingStep(0)
        setEmailFeedback(null)

        // F2 — real generating step timers
        const t1 = setTimeout(() => setGeneratingStep(1), 2000)
        const t2 = setTimeout(() => setGeneratingStep(2), 6000)
        const t3 = setTimeout(() => setGeneratingStep(3), 18000)

        try {
            const response = await reportsApi.generate(genFrequency, format)
            const mime = { xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', json: 'application/json', pdf: 'application/pdf' }[format]
            const url = URL.createObjectURL(new Blob([response.data as BlobPart], { type: mime }))
            const a = document.createElement('a')
            a.href = url; a.download = `northie-relatorio-${genFrequency}-${new Date().toISOString().slice(0, 10)}.${format}`; a.click()
            URL.revokeObjectURL(url)
            reportsApi.getLogs(0).then(res => { const { data, hasMore } = res.data as { data: ReportLog[]; hasMore: boolean }; setLogs(data || []); setHasMoreLogs(hasMore); setLogsPage(0); }).then(() => {}, () => {})
        } catch {
            setEmailFeedback({ ok: false, msg: `Falha ao gerar ${format.toUpperCase()}. Verifique as integrações e tente novamente.` })
            setTimeout(() => setEmailFeedback(null), 5000)
        } finally {
            clearTimeout(t1)
            clearTimeout(t2)
            clearTimeout(t3)
            setGenerating(null)
            setGeneratingStep(0)
        }
    }

    async function handleRedownload(log: ReportLog) {
        if (downloadingLogId) return
        const format: 'pdf' | 'xlsx' | 'json' = log.format === 'xlsx' ? 'xlsx' : log.format === 'json' ? 'json' : 'pdf'
        const mime = { xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', pdf: 'application/pdf', json: 'application/json' }[format]
        const freqLabel = { semanal: 'semanal', mensal: 'mensal', trimestral: 'trimestral', weekly: 'semanal', monthly: 'mensal', quarterly: 'trimestral' }[log.frequency] ?? log.frequency
        const dateStr = log.period_end ? log.period_end.slice(0, 10) : new Date().toISOString().slice(0, 10)

        setDownloadingLogId(log.id)
        setDownloadError(null)
        try {
            const res = await reportsApi.redownload(log.id, format)
            const url = URL.createObjectURL(new Blob([res.data as BlobPart], { type: mime }))
            const a = document.createElement('a')
            a.href = url; a.download = `northie-relatorio-${freqLabel}-${dateStr}.${format}`; a.click()
            URL.revokeObjectURL(url)
        } catch {
            // F10 — keep error visible until user retries (no auto-clear)
            setDownloadError(log.id)
        } finally {
            setDownloadingLogId(null)
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
            await reportsApi.sendEmail(genFrequency, genFormat, email)
            setEmailFeedback({ ok: true, msg: `Enviado para ${email}` })
            reportsApi.getLogs(0).then(res => { const { data, hasMore } = res.data as { data: ReportLog[]; hasMore: boolean }; setLogs(data || []); setHasMoreLogs(hasMore); setLogsPage(0); }).then(() => {}, () => {})
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

    // F3 — email button label per format
    const emailButtonLabel = sendingEmail
        ? 'Enviando...'
        : genFormat === 'pdf'
            ? 'Enviar PDF por email'
            : genFormat === 'xlsx'
                ? 'Enviar Excel por email'
                : 'Enviar JSON por email'

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 40 }}>
            <PageHeader title="Relatórios" subtitle="Análise completa do seu negócio com cruzamento de dados e diagnóstico de IA." />


            {/* ── Prévia dos dados ────────────────────────────────────────── */}
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, delay: delay(1), ease: [0.25, 0.1, 0.25, 1] }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                    <SectionLabel gutterBottom={0}>Prévia dos dados</SectionLabel>
                    {preview && !loadingPreview && (
                        <span style={{ fontFamily: 'var(--font-sans)', fontSize: 11, color: 'var(--color-text-secondary)' }}>
                            {fmtDateShort(preview.period.start)} – {fmtDateShort(preview.period.end)} · {preview.period.days} dias
                        </span>
                    )}
                </div>
                <div style={card}>
                    <AnimatePresence mode="wait">
                        {loadingPreview ? (
                            <motion.div key="skeleton" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                                <PreviewSkeleton />
                            </motion.div>
                        ) : previewError ? (
                            <motion.div key="error" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                                style={{ textAlign: 'center', padding: '24px 0', fontFamily: 'var(--font-sans)', fontSize: 13, color: 'var(--color-text-secondary)' }}>
                                Não foi possível carregar a prévia. Verifique as integrações.
                            </motion.div>
                        ) : preview ? (
                            <motion.div key="data" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                                style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

                                {/* KPI grid */}
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
                                    <PreviewKpi
                                        label="Receita Líquida"
                                        value={fmtBRL(preview.summary.revenue_net)}
                                        sub={preview.summary.revenue_change_pct !== null
                                            ? `${preview.summary.revenue_change_pct >= 0 ? '+' : ''}${preview.summary.revenue_change_pct.toFixed(1)}% vs período anterior`
                                            : `${preview.summary.transactions} transações`}
                                        subColor={preview.summary.revenue_change_pct !== null
                                            ? preview.summary.revenue_change_pct >= 0 ? '#22C55E' : '#EF4444'
                                            : undefined}
                                    />
                                    <PreviewKpi
                                        label="ROAS"
                                        value={`${preview.summary.roas.toFixed(2)}x`}
                                        sub={`Gasto em ads: ${fmtBRL(preview.summary.ad_spend)}`}
                                    />
                                    <PreviewKpi
                                        label="Novos Clientes"
                                        value={String(preview.summary.new_customers)}
                                        sub={`Base total: ${preview.summary.total_customers}`}
                                    />
                                    <PreviewKpi
                                        label="LTV Médio"
                                        value={fmtBRL(preview.summary.ltv_avg)}
                                        sub={`Margem bruta: ${preview.summary.gross_margin_pct.toFixed(1)}%`}
                                    />
                                </div>

                                {/* F4 — Sparkline de receita */}
                                {(preview.revenue_trend?.length ?? 0) >= 2 && (() => {
                                    const trendData = preview.revenue_trend!.map(t => t.revenue)
                                    const lastVal = trendData[trendData.length - 1]
                                    const firstVal = trendData[0]
                                    const trendUp = lastVal >= firstVal
                                    return (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                            <span style={{ fontFamily: 'var(--font-sans)', fontSize: 10, fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.07em', whiteSpace: 'nowrap' }}>
                                                Tendência de receita
                                            </span>
                                            <Sparkline data={trendData} width={180} height={28} />
                                            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: trendUp ? '#22C55E' : '#EF4444', whiteSpace: 'nowrap' }}>
                                                {fmtBRL(lastVal)}
                                            </span>
                                        </div>
                                    )
                                })()}

                                {/* Canais */}
                                {preview.channel_economics.filter(c => c.channel !== 'desconhecido').length > 0 && (
                                    <div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                                            <span style={{ fontFamily: 'var(--font-sans)', fontSize: 11, fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                                                Canais
                                            </span>
                                        </div>
                                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                                            {preview.channel_economics
                                                .filter(c => c.channel !== 'desconhecido')
                                                .sort((a, b) => b.value_created - a.value_created)
                                                .map((ch, i, arr) => {
                                                    const st = STATUS_STYLE[ch.status] ?? STATUS_STYLE.organico
                                                    return (
                                                        <div key={ch.channel} style={{
                                                            display: 'grid',
                                                            gridTemplateColumns: '160px 1fr 90px 90px 80px',
                                                            alignItems: 'center',
                                                            gap: 16,
                                                            padding: '10px 0',
                                                            borderBottom: i < arr.length - 1 ? '1px solid var(--color-border)' : 'none',
                                                        }}>
                                                            <span style={{ fontFamily: 'var(--font-sans)', fontSize: 13, fontWeight: 500, color: 'var(--color-text-primary)' }}>
                                                                {CHANNEL_LABEL[ch.channel] ?? ch.channel}
                                                            </span>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                                                <span style={{ fontFamily: 'var(--font-sans)', fontSize: 11, color: 'var(--color-text-secondary)' }}>
                                                                    {ch.new_customers} clientes
                                                                </span>
                                                            </div>
                                                            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--color-text-secondary)', textAlign: 'right' }}>
                                                                LTV {fmtBRL(ch.avg_ltv)}
                                                            </span>
                                                            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--color-text-secondary)', textAlign: 'right' }}>
                                                                CAC {ch.cac > 0 ? fmtBRL(ch.cac) : '—'}
                                                            </span>
                                                            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                                                                <span style={{
                                                                    fontFamily: 'var(--font-sans)', fontSize: 10, fontWeight: 600,
                                                                    padding: '2px 8px', borderRadius: 4,
                                                                    background: st.bg, color: st.color,
                                                                }}>
                                                                    {st.label}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    )
                                                })}
                                        </div>
                                    </div>
                                )}

                                {/* F5 — Top produtos */}
                                {(preview.top_products?.length ?? 0) > 0 && (
                                    <div>
                                        <span style={{ fontFamily: 'var(--font-sans)', fontSize: 11, fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.07em', display: 'block', marginBottom: 10 }}>
                                            Top Produtos
                                        </span>
                                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                                            {preview.top_products!.slice(0, 3).map((p, i, arr) => (
                                                <div key={p.product} style={{
                                                    display: 'grid',
                                                    gridTemplateColumns: '1fr auto auto',
                                                    gap: 12,
                                                    padding: '8px 0',
                                                    borderBottom: i < arr.length - 1 ? '1px solid var(--color-border)' : 'none',
                                                    alignItems: 'center',
                                                }}>
                                                    <span style={{ fontFamily: 'var(--font-sans)', fontSize: 13, color: 'var(--color-text-primary)', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                        {p.product}
                                                    </span>
                                                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--color-text-primary)', fontWeight: 600, whiteSpace: 'nowrap' }}>
                                                        {fmtBRL(p.revenue)}
                                                    </span>
                                                    <span style={{ fontFamily: 'var(--font-sans)', fontSize: 11, color: 'var(--color-text-secondary)', whiteSpace: 'nowrap' }}>
                                                        {p.transactions} transações
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* F6 — RFM pills */}
                                {(preview.rfm_distribution?.length ?? 0) > 0 && preview.rfm_source !== 'unavailable' && (
                                    <div>
                                        <span style={{ fontFamily: 'var(--font-sans)', fontSize: 11, fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.07em', display: 'block', marginBottom: 10 }}>
                                            Segmentação RFM
                                        </span>
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                                            {preview.rfm_distribution!.map(seg => {
                                                const rfmCfg = RFM_LABELS[seg.segment] ?? { label: seg.segment, color: '#6B7280' }
                                                return (
                                                    <span key={seg.segment} style={{
                                                        fontFamily: 'var(--font-sans)', fontSize: 11, fontWeight: 500,
                                                        padding: '4px 10px', borderRadius: 20,
                                                        background: rfmCfg.color + '18',
                                                        color: rfmCfg.color,
                                                        border: `1px solid ${rfmCfg.color}30`,
                                                    }}>
                                                        {rfmCfg.label} · {seg.count} clientes
                                                    </span>
                                                )
                                            })}
                                        </div>
                                    </div>
                                )}

                                {/* Clientes em risco */}
                                {preview.at_risk_customers.length > 0 && (
                                    <div style={{
                                        display: 'flex', alignItems: 'center', gap: 10,
                                        padding: '10px 14px',
                                        background: 'rgba(239,68,68,0.06)',
                                        border: '1px solid rgba(239,68,68,0.20)',
                                        borderRadius: 8,
                                    }}>
                                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#EF4444', flexShrink: 0 }} />
                                        <span style={{ fontFamily: 'var(--font-sans)', fontSize: 13, color: 'var(--color-text-primary)' }}>
                                            <strong style={{ color: '#EF4444' }}>{preview.at_risk_customers.length}</strong>
                                            {' '}clientes com risco de churn acima de 60% —{' '}
                                            <span style={{ fontFamily: 'var(--font-mono)', color: '#EF4444' }}>
                                                {fmtBRL(preview.at_risk_customers.reduce((s, c) => s + (c.ltv ?? 0), 0))}
                                            </span>
                                            {' '}em LTV em risco
                                        </span>
                                    </div>
                                )}
                            </motion.div>
                        ) : null}
                    </AnimatePresence>
                </div>
            </motion.div>

            {/* ── Análise de IA ───────────────────────────────────────────── */}
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, delay: delay(2), ease: [0.25, 0.1, 0.25, 1] }}>
                <SectionLabel gutterBottom={16}>Análise de IA</SectionLabel>
                <div style={card}>
                    <AnimatePresence mode="wait">
                        {!aiAnalysis && !loadingAI && (
                            <motion.div key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
                                <div>
                                    <p style={{ margin: 0, fontFamily: 'var(--font-sans)', fontSize: 14, fontWeight: 500, color: 'var(--color-text-primary)' }}>
                                        Diagnóstico com IA
                                    </p>
                                    <p style={{ margin: '4px 0 0', fontFamily: 'var(--font-sans)', fontSize: 13, color: 'var(--color-text-secondary)' }}>
                                        Cruzamento de canais, análise de churn e diagnósticos por severidade. Leva ~30-60s.
                                    </p>
                                </div>
                                <Btn variant="primary" onClick={handleRequestAI} disabled={loadingPreview || previewError}>
                                    Analisar com IA
                                </Btn>
                            </motion.div>
                        )}

                        {loadingAI && (
                            <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                                style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '8px 0' }}>
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1a7fe8" strokeWidth="2" strokeLinecap="round" style={{ animation: 'spin 0.9s linear infinite', flexShrink: 0 }}>
                                    <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                                </svg>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                    <span style={{ fontFamily: 'var(--font-sans)', fontSize: 14, fontWeight: 500, color: 'var(--color-text-primary)' }}>
                                        Analisando dados com IA...
                                    </span>
                                    <span style={{ fontFamily: 'var(--font-sans)', fontSize: 12, color: 'var(--color-text-secondary)' }}>
                                        Cruzando fontes e diagnosticando cada canal. Isso pode levar até 60 segundos.
                                    </span>
                                </div>
                            </motion.div>
                        )}

                        {aiError && !loadingAI && (
                            <motion.div key="error" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
                                <span style={{ fontFamily: 'var(--font-sans)', fontSize: 13, color: '#EF4444' }}>
                                    Falha na análise. Tente novamente.
                                </span>
                                <Btn variant="secondary" onClick={handleRequestAI}>Tentar novamente</Btn>
                            </motion.div>
                        )}

                        {aiAnalysis && !loadingAI && (
                            <motion.div key="result" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                                style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

                                {/* Header: situação geral + resumo */}
                                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
                                    <SituacaoBadge value={aiAnalysis.situacao_geral} size="md" />
                                    <p style={{ margin: 0, fontFamily: 'var(--font-sans)', fontSize: 13, color: 'var(--color-text-secondary)', lineHeight: 1.6, flex: 1 }}>
                                        {aiAnalysis.resumo_executivo}
                                    </p>
                                </div>

                                {/* Diagnósticos */}
                                {aiAnalysis.diagnosticos.length > 0 && (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                                        <span style={{ fontFamily: 'var(--font-sans)', fontSize: 11, fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10 }}>
                                            Diagnósticos por canal
                                        </span>
                                        {aiAnalysis.diagnosticos
                                            .sort((a, b) => (['critica','alta','media','ok'].indexOf(a.severidade)) - (['critica','alta','media','ok'].indexOf(b.severidade)))
                                            .map((d, i, arr) => {
                                                const sev = SEV_STYLE[d.severidade] ?? SEV_STYLE.media
                                                return (
                                                    <div key={i} style={{
                                                        display: 'grid',
                                                        gridTemplateColumns: 'minmax(120px, 160px) 1fr auto',
                                                        alignItems: 'start',
                                                        gap: 16,
                                                        padding: '12px 0',
                                                        borderBottom: i < arr.length - 1 ? '1px solid var(--color-border)' : 'none',
                                                    }}>
                                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0, overflowWrap: 'break-word', wordBreak: 'break-all' }}>
                                                            <span style={{ fontFamily: 'var(--font-sans)', fontSize: 12, fontWeight: 600, color: 'var(--color-text-primary)', overflowWrap: 'break-word', wordBreak: 'break-all' }}>
                                                                {CHANNEL_LABEL[d.canal] ?? d.canal}
                                                            </span>
                                                            <span style={{ display: 'inline-block', fontFamily: 'var(--font-sans)', fontSize: 10, fontWeight: 700, color: sev.color, letterSpacing: '0.06em' }}>
                                                                {sev.label}
                                                            </span>
                                                        </div>
                                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
                                                            <span style={{ fontFamily: 'var(--font-sans)', fontSize: 12, color: 'var(--color-text-primary)', lineHeight: 1.5 }}>
                                                                {d.sintoma}
                                                            </span>
                                                            <span style={{ fontFamily: 'var(--font-sans)', fontSize: 11, color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>
                                                                → {d.acao_recomendada}
                                                            </span>
                                                        </div>
                                                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 600, color: sev.color, whiteSpace: 'nowrap', minWidth: 0 }}>
                                                            {fmtBRL(d.consequencia_financeira_brl)}
                                                        </span>
                                                    </div>
                                                )
                                            })}
                                    </div>
                                )}

                                {/* Próximos passos */}
                                {aiAnalysis.proximos_passos.length > 0 && (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '14px 16px', background: 'var(--color-bg-secondary)', borderRadius: 8 }}>
                                        <span style={{ fontFamily: 'var(--font-sans)', fontSize: 11, fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                                            Próximos passos
                                        </span>
                                        {aiAnalysis.proximos_passos.map((step, i) => (
                                            <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                                                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 600, color: '#1a7fe8', flexShrink: 0, marginTop: 1 }}>
                                                    {String(i + 1).padStart(2, '0')}
                                                </span>
                                                <span style={{ fontFamily: 'var(--font-sans)', fontSize: 13, color: 'var(--color-text-primary)', lineHeight: 1.5 }}>
                                                    {step}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {/* Refazer análise */}
                                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                                    <Btn variant="secondary" onClick={handleRequestAI} disabled={loadingAI}>
                                        Atualizar análise
                                    </Btn>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
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
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                <span style={{ fontFamily: 'var(--font-sans)', fontSize: 11, fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Período</span>
                                <SegmentedControl
                                    options={['semanal', 'mensal', 'trimestral'] as const}
                                    value={genFrequency}
                                    onChange={setGenFrequency}
                                    labels={{ semanal: 'Última semana', mensal: 'Último mês', trimestral: 'Último trimestre' }}
                                />
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                <span style={{ fontFamily: 'var(--font-sans)', fontSize: 11, fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Formato para email</span>
                                <SegmentedControl
                                    options={['pdf', 'xlsx', 'json'] as const}
                                    value={genFormat}
                                    onChange={setGenFormat}
                                    labels={{ pdf: 'PDF com IA', xlsx: 'Excel', json: 'JSON' }}
                                />
                            </div>
                        </div>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                            {(['xlsx', 'json', 'pdf'] as const).map(fmt => (
                                <Btn key={fmt} variant={fmt === 'pdf' ? 'primary' : 'secondary'}
                                    onClick={() => handleDownload(fmt)}
                                    disabled={generating !== null || sendingEmail}
                                    icon={<DownloadIcon />}>
                                    {generating === fmt ? 'Gerando...' : fmt === 'pdf' ? 'PDF com IA' : fmt === 'xlsx' ? 'Excel' : 'JSON'}
                                </Btn>
                            ))}
                            <div style={{ width: 1, height: 24, background: 'var(--color-border)', flexShrink: 0 }} />
                            {/* F3 — dynamic email button label */}
                            <Btn variant="secondary"
                                onClick={handleSendEmail}
                                disabled={generating !== null || sendingEmail}
                                icon={<EmailIcon />}>
                                {emailButtonLabel}
                            </Btn>
                        </div>
                    </div>
                    <AnimatePresence>
                        {generating !== null && (
                            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                                style={{ margin: '16px 0 0', display: 'flex', alignItems: 'center', gap: 10 }}>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#1a7fe8" strokeWidth="2" strokeLinecap="round" style={{ animation: 'spin 0.9s linear infinite', flexShrink: 0 }}>
                                    <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                                </svg>
                                {/* F2 — dynamic step message */}
                                <span style={{ fontFamily: 'var(--font-sans)', fontSize: 12, color: 'var(--color-text-secondary)' }}>
                                    {getStepMessage(generatingStep, generating)}
                                </span>
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
                                <SegmentedControl options={['pdf', 'xlsx', 'json'] as const} value={config.format}
                                    onChange={v => setConfig(c => ({ ...c, format: v }))}
                                    labels={{ pdf: 'PDF com IA', xlsx: 'Excel', json: 'JSON' }} />
                            </div>
                        </div>

                        {/* F9 — email validation */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                            <span style={{ fontFamily: 'var(--font-sans)', fontSize: 11, fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Email de envio</span>
                            <input
                                type="email"
                                placeholder="seu@email.com"
                                value={config.email}
                                onChange={e => {
                                    setConfig(c => ({ ...c, email: e.target.value }))
                                    setEmailError(null)
                                }}
                                onBlur={e => {
                                    if (e.target.value && !isValidEmail(e.target.value)) {
                                        setEmailError('Email inválido')
                                    }
                                }}
                                style={{
                                    padding: '8px 12px',
                                    background: 'var(--color-bg-secondary)',
                                    border: `1px solid ${emailError ? '#EF4444' : 'var(--color-border)'}`,
                                    borderRadius: 'var(--radius-md)',
                                    color: 'var(--color-text-primary)',
                                    fontFamily: 'var(--font-sans)',
                                    fontSize: 14,
                                    outline: 'none',
                                    width: '100%',
                                    maxWidth: 360,
                                    boxSizing: 'border-box',
                                    transition: 'border-color 0.15s',
                                }}
                                onFocus={e => { if (!emailError) e.currentTarget.style.borderColor = '#1a7fe8' }}
                            />
                            <AnimatePresence>
                                {emailError && (
                                    <motion.span
                                        initial={{ opacity: 0, y: -4 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: -4 }}
                                        style={{ fontFamily: 'var(--font-sans)', fontSize: 11, color: '#EF4444' }}
                                    >
                                        {emailError}
                                    </motion.span>
                                )}
                            </AnimatePresence>
                        </div>

                        <div style={{ height: 1, background: 'var(--color-border)' }} />

                        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                            <Btn variant="primary" onClick={handleSaveConfig} disabled={savingConfig || emailError !== null}>
                                {savingConfig ? 'Salvando...' : 'Salvar configuração'}
                            </Btn>
                            <AnimatePresence>
                                {savedFeedback && (
                                    <motion.span initial={{ opacity: 0, x: -4 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}
                                        style={{ fontFamily: 'var(--font-sans)', fontSize: 13, color: '#22c55e' }}>
                                        Salvo
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
                {/* F8 — Refresh button in section header */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                    <SectionLabel gutterBottom={0}>Histórico de relatórios</SectionLabel>
                    <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={handleRefreshLogs}
                        disabled={refreshingLogs || loadingLogs}
                        title="Atualizar histórico"
                        style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            width: 32, height: 32, borderRadius: 8,
                            border: '1px solid var(--color-border)',
                            background: 'transparent',
                            cursor: refreshingLogs || loadingLogs ? 'default' : 'pointer',
                            color: 'var(--color-text-secondary)',
                            opacity: refreshingLogs || loadingLogs ? 0.5 : 1,
                        }}
                    >
                        <RefreshIcon spinning={refreshingLogs} />
                    </motion.button>
                </div>

                <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 100px 80px 120px 110px 80px 52px', padding: '12px 20px', borderBottom: '1px solid var(--color-border)' }}>
                        <TH>Período</TH>
                        <TH>Frequência</TH>
                        <TH>Formato</TH>
                        <TH>Receita</TH>
                        <TH>Situação</TH>
                        <TH align="right">Email</TH>
                        <TH align="right"> </TH>
                    </div>

                    {loadingLogs ? <LoadingRow /> : logs.length === 0 ? (
                        <EmptyState title="Nenhum relatório gerado ainda" description="Gere seu primeiro relatório acima ou configure o envio automático." />
                    ) : (
                        <div>
                            {logs.map(log => {
                                const freqLabel: Record<string, string> = { semanal: 'Semanal', mensal: 'Mensal', trimestral: 'Trimestral', weekly: 'Semanal', monthly: 'Mensal', quarterly: 'Trimestral' }
                                const emailStatusLabel: Record<string, { label: string; color: string }> = {
                                    sent: { label: 'Enviado', color: '#6B7280' },
                                    delivered: { label: 'Entregue', color: '#22C55E' },
                                    bounced: { label: 'Bounce', color: '#EF4444' },
                                    complained: { label: 'Spam', color: '#F97316' },
                                    delayed: { label: 'Atrasado', color: '#F59E0B' },
                                }
                                const emailSt = log.email_status ? emailStatusLabel[log.email_status] : null
                                const isError = log.status === 'error'
                                const canRedownload = !isError && (log.format === 'pdf' || log.format === 'xlsx' || log.format === 'json')
                                const isExpanded = expandedLogId === log.id
                                const snap = log.snapshot

                                return (
                                    <div key={log.id}>
                                        {/* F7 — clickable row for expand */}
                                        <NotionRow
                                            style={{ padding: '0 20px', opacity: isError ? 0.6 : 1, cursor: snap ? 'pointer' : 'default' }}
                                            onClick={() => snap && setExpandedLogId(isExpanded ? null : log.id)}
                                        >
                                            <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 100px 80px 120px 110px 80px 52px', width: '100%', alignItems: 'center', minHeight: 52 }}>
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                        {/* F7 — chevron indicator */}
                                                        {snap && (
                                                            <motion.span
                                                                animate={{ rotate: isExpanded ? 90 : 0 }}
                                                                transition={{ duration: 0.18, ease: [0.4, 0, 0.2, 1] }}
                                                                style={{ display: 'inline-flex', fontSize: 10, color: 'var(--color-text-secondary)', flexShrink: 0 }}
                                                            >
                                                                ▶
                                                            </motion.span>
                                                        )}
                                                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--color-text-primary)' }}>
                                                            {fmtDate(log.created_at)}
                                                        </span>
                                                        {isError && (
                                                            <span style={{ fontFamily: 'var(--font-sans)', fontSize: 10, fontWeight: 700, color: '#EF4444', background: 'rgba(239,68,68,0.10)', padding: '2px 6px', borderRadius: 4, letterSpacing: '0.04em' }}>ERRO</span>
                                                        )}
                                                    </div>
                                                    {log.period_start && log.period_end && (
                                                        <span style={{ fontFamily: 'var(--font-sans)', fontSize: 11, color: 'var(--color-text-secondary)', marginLeft: snap ? 18 : 0 }}>
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
                                                    {snap?.revenue_net !== undefined ? fmtBRL(snap.revenue_net) : '—'}
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
                                                <div style={{ display: 'flex', justifyContent: 'flex-end' }} onClick={e => e.stopPropagation()}>
                                                    {canRedownload && (
                                                        // F10 — retry button on error, no auto-clear
                                                        downloadError === log.id ? (
                                                            <motion.button
                                                                whileTap={{ scale: 0.95 }}
                                                                onClick={(e) => { e.stopPropagation(); handleRedownload(log) }}
                                                                style={{ display: 'flex', alignItems: 'center', gap: 4, fontFamily: 'var(--font-sans)', fontSize: 11, color: '#EF4444', background: 'transparent', border: 'none', cursor: 'pointer', padding: '2px 4px' }}
                                                            >
                                                                Erro — tentar novamente
                                                            </motion.button>
                                                        ) : (
                                                            <motion.button
                                                                whileHover={{ scale: downloadingLogId ? 1 : 1.08 }}
                                                                whileTap={{ scale: downloadingLogId ? 1 : 0.95 }}
                                                                onClick={(e) => { e.stopPropagation(); handleRedownload(log) }}
                                                                disabled={!!downloadingLogId}
                                                                title={downloadingLogId === log.id ? 'Gerando...' : 'Baixar novamente'}
                                                                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 30, height: 30, borderRadius: 6, border: '1px solid var(--color-border)', background: 'transparent', cursor: downloadingLogId ? 'default' : 'pointer', color: downloadingLogId === log.id ? '#1a7fe8' : 'var(--color-text-secondary)', opacity: downloadingLogId && downloadingLogId !== log.id ? 0.4 : 1 }}>
                                                                {downloadingLogId === log.id
                                                                    ? <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10" strokeOpacity="0.25" /><path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round"><animateTransform attributeName="transform" type="rotate" from="0 12 12" to="360 12 12" dur="0.8s" repeatCount="indefinite" /></path></svg>
                                                                    : <DownloadIcon />
                                                                }
                                                            </motion.button>
                                                        )
                                                    )}
                                                </div>
                                            </div>
                                        </NotionRow>

                                        {/* F7 — expandable snapshot detail */}
                                        <AnimatePresence>
                                            {isExpanded && snap && (
                                                <motion.div
                                                    key={`expand-${log.id}`}
                                                    initial={{ opacity: 0, height: 0 }}
                                                    animate={{ opacity: 1, height: 'auto' }}
                                                    exit={{ opacity: 0, height: 0 }}
                                                    transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
                                                    style={{ overflow: 'hidden' }}
                                                >
                                                    <div style={{ padding: '16px 28px 20px', background: 'var(--color-bg-secondary)', borderBottom: '1px solid var(--color-border)' }}>
                                                        {/* Row 1 — 4 core KPIs */}
                                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 12 }}>
                                                            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                                                <span style={{ fontFamily: 'var(--font-sans)', fontSize: 10, fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Receita líquida</span>
                                                                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 14, fontWeight: 600, color: 'var(--color-text-primary)' }}>{fmtBRL(snap.revenue_net)}</span>
                                                                {snap.revenue_change_pct !== null && snap.revenue_change_pct !== undefined && (
                                                                    <span style={{ fontFamily: 'var(--font-sans)', fontSize: 11, color: snap.revenue_change_pct >= 0 ? '#22C55E' : '#EF4444' }}>
                                                                        {snap.revenue_change_pct >= 0 ? '+' : ''}{snap.revenue_change_pct.toFixed(1)}%
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                                                <span style={{ fontFamily: 'var(--font-sans)', fontSize: 10, fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>ROAS</span>
                                                                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 14, fontWeight: 600, color: 'var(--color-text-primary)' }}>{snap.roas?.toFixed(2) ?? '—'}x</span>
                                                                {snap.ad_spend !== undefined && (
                                                                    <span style={{ fontFamily: 'var(--font-sans)', fontSize: 11, color: 'var(--color-text-secondary)' }}>Ads: {fmtBRL(snap.ad_spend)}</span>
                                                                )}
                                                            </div>
                                                            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                                                <span style={{ fontFamily: 'var(--font-sans)', fontSize: 10, fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Novos clientes</span>
                                                                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 14, fontWeight: 600, color: 'var(--color-text-primary)' }}>{snap.new_customers ?? '—'}</span>
                                                            </div>
                                                            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                                                <span style={{ fontFamily: 'var(--font-sans)', fontSize: 10, fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>LTV médio</span>
                                                                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 14, fontWeight: 600, color: 'var(--color-text-primary)' }}>{snap.ltv_avg !== undefined ? fmtBRL(snap.ltv_avg) : '—'}</span>
                                                            </div>
                                                        </div>

                                                        {/* Row 2 — channels + at risk + diagnostics */}
                                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: snap.resumo_executivo ? 12 : 0 }}>
                                                            {/* Canal top */}
                                                            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                                                <span style={{ fontFamily: 'var(--font-sans)', fontSize: 10, fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Canal top</span>
                                                                {snap.top_channel ? (
                                                                    <>
                                                                        <span style={{ fontFamily: 'var(--font-sans)', fontSize: 13, fontWeight: 500, color: 'var(--color-text-primary)' }}>
                                                                            {CHANNEL_LABEL[snap.top_channel.channel] ?? snap.top_channel.channel}
                                                                        </span>
                                                                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: '#22C55E' }}>
                                                                            {fmtBRL(snap.top_channel.value_created)}
                                                                        </span>
                                                                    </>
                                                                ) : (
                                                                    <span style={{ fontFamily: 'var(--font-sans)', fontSize: 13, color: 'var(--color-text-secondary)' }}>—</span>
                                                                )}
                                                            </div>

                                                            {/* Canal pior */}
                                                            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                                                <span style={{ fontFamily: 'var(--font-sans)', fontSize: 10, fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Canal em prejuízo</span>
                                                                {snap.worst_channel ? (
                                                                    <>
                                                                        <span style={{ fontFamily: 'var(--font-sans)', fontSize: 13, fontWeight: 500, color: 'var(--color-text-primary)' }}>
                                                                            {CHANNEL_LABEL[snap.worst_channel.channel] ?? snap.worst_channel.channel}
                                                                        </span>
                                                                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: '#EF4444' }}>
                                                                            {fmtBRL(snap.worst_channel.value_created)}
                                                                        </span>
                                                                    </>
                                                                ) : (
                                                                    <span style={{ fontFamily: 'var(--font-sans)', fontSize: 13, color: 'var(--color-text-secondary)' }}>—</span>
                                                                )}
                                                            </div>

                                                            {/* Clientes em risco */}
                                                            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                                                <span style={{ fontFamily: 'var(--font-sans)', fontSize: 10, fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Clientes em risco</span>
                                                                {snap.at_risk_count !== undefined ? (
                                                                    <>
                                                                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 600, color: '#F59E0B' }}>{snap.at_risk_count}</span>
                                                                        {snap.at_risk_ltv !== undefined && (
                                                                            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--color-text-secondary)' }}>{fmtBRL(snap.at_risk_ltv)} em LTV</span>
                                                                        )}
                                                                    </>
                                                                ) : (
                                                                    <span style={{ fontFamily: 'var(--font-sans)', fontSize: 13, color: 'var(--color-text-secondary)' }}>—</span>
                                                                )}
                                                            </div>

                                                            {/* Diagnósticos críticos */}
                                                            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                                                <span style={{ fontFamily: 'var(--font-sans)', fontSize: 10, fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Diagnósticos críticos</span>
                                                                {snap.diagnosticos_count !== undefined ? (
                                                                    <>
                                                                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 600, color: snap.criticos > 0 ? '#EF4444' : 'var(--color-text-primary)' }}>
                                                                            {snap.criticos} críticos
                                                                        </span>
                                                                        <span style={{ fontFamily: 'var(--font-sans)', fontSize: 11, color: 'var(--color-text-secondary)' }}>
                                                                            {snap.diagnosticos_count} total
                                                                        </span>
                                                                    </>
                                                                ) : (
                                                                    <span style={{ fontFamily: 'var(--font-sans)', fontSize: 13, color: 'var(--color-text-secondary)' }}>—</span>
                                                                )}
                                                            </div>
                                                        </div>

                                                        {/* Resumo executivo */}
                                                        {snap.resumo_executivo && (
                                                            <p style={{ margin: 0, fontFamily: 'var(--font-sans)', fontSize: 12, color: 'var(--color-text-secondary)', lineHeight: 1.6, paddingTop: 4 }}>
                                                                {snap.resumo_executivo}
                                                            </p>
                                                        )}
                                                    </div>
                                                </motion.div>
                                            )}
                                        </AnimatePresence>
                                    </div>
                                )
                            })}
                            {hasMoreLogs && (
                                <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 20px', borderTop: '1px solid var(--color-border)' }}>
                                    <motion.button
                                        whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                                        onClick={handleLoadMoreLogs}
                                        disabled={loadingMore}
                                        style={{ fontFamily: 'var(--font-sans)', fontSize: 13, color: loadingMore ? 'var(--color-text-secondary)' : '#1a7fe8', background: 'transparent', border: 'none', cursor: loadingMore ? 'default' : 'pointer', padding: '4px 12px' }}>
                                        {loadingMore ? 'Carregando...' : 'Carregar mais'}
                                    </motion.button>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </motion.div>
        </div>
    )
}
