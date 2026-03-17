/**
 * @file pages/Relatorios/index.tsx
 * Página de Relatórios — geração sob demanda, análise de IA, envio automático e histórico.
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
    period_type?: 'last_7_days' | 'last_30_days' | 'last_90_days' | 'custom'
    custom_start?: string
    custom_end?: string
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
    triggered_by?: 'manual' | 'automatic' | 'email'
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

// ── Formatters ────────────────────────────────────────────────────────────────

const fmtBRL = (n: number | null | undefined) => (n ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
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
    saudavel: { label: 'Saudável', color: 'var(--accent-green)',  bg: 'var(--status-complete-bg)' },
    atencao:  { label: 'Atenção',  color: 'var(--accent-orange)', bg: 'var(--priority-medium-bg)' },
    critica:  { label: 'Crítica',  color: 'var(--accent-red)',    bg: 'var(--priority-high-bg)'  },
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
            style={{ width: 44, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer', position: 'relative', flexShrink: 0, background: enabled ? 'var(--color-primary)' : 'var(--color-bg-tertiary)', transition: 'background 0.2s', padding: 0 }}
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

// ── Channel label map ─────────────────────────────────────────────────────────

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
    is_ai_fallback?: boolean
}

const SEV_STYLE: Record<string, { color: string; label: string }> = {
    critica: { color: 'var(--accent-red)',    label: 'CRÍTICA' },
    alta:    { color: 'var(--accent-orange)', label: 'ALTA'    },
    media:   { color: 'var(--accent-orange)', label: 'MÉDIA'   },
    ok:      { color: 'var(--accent-green)',  label: 'OK'      },
}

// ── Icons ─────────────────────────────────────────────────────────────────────

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

function EyeIcon() {
    return (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" />
        </svg>
    )
}

function CloseIcon() {
    return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 6 6 18M6 6l12 12" />
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
    if (step === 0) return 'Consultando banco de dados...'
    if (step === 1) return 'Cruzando fontes e calculando métricas...'
    if (step === 2) return format === 'pdf' ? 'Enviando para análise de IA — pode levar até 45s...' : `Montando arquivo ${format?.toUpperCase() ?? ''}...`
    return 'Compilando PDF e finalizando...'
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function Relatorios(_props: RelatoriosProps) {
    const card: React.CSSProperties = { background: 'var(--color-bg-primary)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', padding: 28 }
    const delay = (n: number) => n * 0.07

    // Active tab
    const [activeTab, setActiveTab] = useState<'gerar' | 'ai' | 'automatico' | 'historico'>('gerar')

    // Config state
    const [config, setConfig] = useState<ReportConfig>({ enabled: false, frequency: 'mensal', format: 'pdf', email: '' })
    const [savedConfig, setSavedConfig] = useState<ReportConfig | null>(null)
    const [savingConfig, setSavingConfig] = useState(false)
    const [savedFeedback, setSavedFeedback] = useState(false)
    const [emailError, setEmailError] = useState<string | null>(null)

    // AI Analysis (lazy — só carrega quando o usuário pede)
    const [aiAnalysis, setAiAnalysis] = useState<AIAnalysis | null>(null)
    const [loadingAI, setLoadingAI] = useState(false)
    const [aiStreamText, setAiStreamText] = useState('')
    const [aiReady, setAiReady] = useState(false)
    const [aiError, setAiError] = useState(false)
    const [aiTimedOut, setAiTimedOut] = useState(false)

    // Generate on-demand
    const [genFrequency, setGenFrequency] = useState<ReportConfig['frequency']>('mensal')
    const [genFormat, setGenFormat] = useState<'pdf' | 'xlsx' | 'json'>('pdf')
    const [generating, setGenerating] = useState<'xlsx' | 'json' | 'pdf' | null>(null)
    const [generatingStep, setGeneratingStep] = useState<0 | 1 | 2 | 3>(0)
    const [sendingEmail, setSendingEmail] = useState(false)
    const [emailFeedback, setEmailFeedback] = useState<{ ok: boolean; msg: string } | null>(null)

    // PDF Preview modal
    const [previewingPdf, setPreviewingPdf] = useState(false)
    const [previewBlobUrl, setPreviewBlobUrl] = useState<string | null>(null)
    const [previewPdfLoading, setPreviewPdfLoading] = useState(false)

    // Custom date range
    const [periodType, setPeriodType] = useState<'last_7_days' | 'last_30_days' | 'last_90_days' | 'custom'>('last_30_days')
    const [customStart, setCustomStart] = useState('')
    const [customEnd, setCustomEnd] = useState('')

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

    async function handleRequestAI() {
        setLoadingAI(true)
        setAiError(false)
        setAiTimedOut(false)
        setAiStreamText('')
        setAiReady(false)
        setAiAnalysis(null)

        const params = new URLSearchParams({ frequency: genFrequency, ...getCustomDates() as Record<string, string> })
        const { supabase } = await import('../../lib/supabase')
        const { data: { session } } = await supabase.auth.getSession()
        const token = session?.access_token ?? ''
        const profileId = session?.user?.id ?? ''

        try {
            const res = await fetch(`/api/reports/ai-stream?${params}`, {
                headers: { 'x-profile-id': profileId, 'Authorization': `Bearer ${token}` },
            })
            if (!res.ok || !res.body) throw new Error('stream_failed')

            const reader = res.body.getReader()
            const decoder = new TextDecoder()
            let buffer = ''

            let streamError = false
            let streamDone = false
            while (true) {
                const { done, value } = await reader.read()
                if (done) break
                buffer += decoder.decode(value, { stream: true })

                const lines = buffer.split('\n')
                buffer = lines.pop() ?? ''

                for (const line of lines) {
                    if (!line.startsWith('data: ')) continue
                    let event: { type: string; text?: string; result?: AIAnalysis } | null = null
                    try {
                        event = JSON.parse(line.slice(6))
                    } catch { /* linha malformada — ignorar */ }
                    if (!event) continue
                    if (event.type === 'ready') {
                        setAiReady(true)
                    } else if (event.type === 'chunk') {
                        setAiStreamText(prev => prev + (event!.text ?? ''))
                    } else if (event.type === 'done') {
                        streamDone = true
                        setAiAnalysis(event.result as AIAnalysis)
                        setLoadingAI(false)
                    } else if (event.type === 'error') {
                        streamError = true
                        break
                    }
                }
                if (streamError) break
            }
            if (streamError) throw new Error('stream_error')
            if (!streamDone) throw new Error('stream_incomplete')
        } catch (err: unknown) {
            const e = err as { message?: string }
            setAiTimedOut((e?.message ?? '').includes('timeout'))
            setAiError(true)
            setLoadingAI(false)
        } finally {
            setAiStreamText('')
            setAiReady(false)
            setLoadingAI(false)
        }
    }

    async function handleSaveConfig() {
        if (config.email && !isValidEmail(config.email)) {
            setEmailError('Email inválido')
            return
        }
        setSavingConfig(true)
        try {
            const payload = {
                ...config,
                period_type: periodType,
                ...(periodType === 'custom' ? { custom_start: customStart, custom_end: customEnd } : {}),
            }
            await reportsApi.saveConfig(payload)
            setSavedConfig(config)
            setSavedFeedback(true)
            setTimeout(() => setSavedFeedback(false), 2500)
        } finally {
            setSavingConfig(false)
        }
    }

    const getCustomDates = () =>
        periodType === 'custom' && customStart && customEnd
            ? { period_type: 'custom', custom_start: customStart, custom_end: customEnd }
            : {}

    async function handleDownload(format: 'xlsx' | 'json' | 'pdf') {
        setGenerating(format)
        setGeneratingStep(0)
        setEmailFeedback(null)

        const isPdf = format === 'pdf'
        const t1 = setTimeout(() => setGeneratingStep(1), 3000)
        const t2 = setTimeout(() => setGeneratingStep(2), isPdf ? 8000 : 5000)
        const t3 = isPdf ? setTimeout(() => setGeneratingStep(3), 30000) : null

        try {
            const response = await reportsApi.generate(genFrequency, format, getCustomDates())
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
            if (t3) clearTimeout(t3)
            setGenerating(null)
            setGeneratingStep(0)
        }
    }

    async function handlePreviewPdf() {
        setPreviewPdfLoading(true)
        try {
            const periodParam = periodType === 'last_7_days' ? '7d' : periodType === 'last_90_days' ? '90d' : '30d'
            const res = await reportsApi.exportQuick('pdf', periodParam)
            const url = URL.createObjectURL(new Blob([res.data as BlobPart], { type: 'application/pdf' }))
            if (previewBlobUrl) URL.revokeObjectURL(previewBlobUrl)
            setPreviewBlobUrl(url)
            setPreviewingPdf(true)
        } catch {
            setEmailFeedback({ ok: false, msg: 'Não foi possível gerar a pré-visualização.' })
            setTimeout(() => setEmailFeedback(null), 4000)
        } finally {
            setPreviewPdfLoading(false)
        }
    }

    function closePdfPreview() {
        setPreviewingPdf(false)
        if (previewBlobUrl) { URL.revokeObjectURL(previewBlobUrl); setPreviewBlobUrl(null) }
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
            setDownloadError(log.id)
        } finally {
            setDownloadingLogId(null)
        }
    }

    async function handleSendEmail() {
        const email = config.email || savedConfig?.email || ''
        if (!email) {
            setEmailFeedback({ ok: false, msg: 'Configure um email na aba "Configurar envio".' })
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

    const emailButtonLabel = sendingEmail
        ? 'Enviando...'
        : genFormat === 'pdf'
            ? 'Enviar PDF por email'
            : genFormat === 'xlsx'
                ? 'Enviar Excel por email'
                : 'Enviar JSON por email'

    const TABS = [
        { id: 'gerar',      label: 'Gerar'            },
        { id: 'ai',         label: 'Análise IA'        },
        { id: 'automatico', label: 'Configurar envio'  },
        { id: 'historico',  label: 'Histórico'         },
    ] as const

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
            <PageHeader title="Relatórios" subtitle="Análise completa do seu negócio com cruzamento de dados e diagnóstico de IA." />

            {/* ── PDF Preview Modal ──────────────────────────────────────── */}
            <AnimatePresence>
                {previewingPdf && previewBlobUrl && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        style={{
                            position: 'fixed', inset: 0, zIndex: 1000,
                            background: 'rgba(0,0,0,0.72)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}
                        onClick={closePdfPreview}
                    >
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.95, opacity: 0 }}
                            transition={{ duration: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
                            onClick={e => e.stopPropagation()}
                            style={{
                                background: 'var(--color-bg-primary)',
                                borderRadius: 12,
                                overflow: 'hidden',
                                width: '88vw', height: '90vh',
                                maxWidth: 900,
                                display: 'flex', flexDirection: 'column',
                                boxShadow: '0 24px 80px rgba(0,0,0,0.4)',
                            }}
                        >
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderBottom: '1px solid var(--color-border)', flexShrink: 0 }}>
                                <span style={{ fontFamily: 'var(--font-sans)', fontSize: 14, fontWeight: 600, color: 'var(--color-text-primary)' }}>Pré-visualização do PDF</span>
                                <span style={{ fontFamily: 'var(--font-sans)', fontSize: 11, color: 'var(--color-text-secondary)', marginLeft: 8, flex: 1 }}>
                                    Versão simplificada — sem análise de IA (geração rápida)
                                </span>
                                <motion.button
                                    whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                                    onClick={closePdfPreview}
                                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 30, height: 30, borderRadius: 6, border: '1px solid var(--color-border)', background: 'transparent', cursor: 'pointer', color: 'var(--color-text-secondary)' }}>
                                    <CloseIcon />
                                </motion.button>
                            </div>
                            <iframe
                                src={previewBlobUrl}
                                style={{ flex: 1, border: 'none', background: '#525659' }}
                                title="Preview do relatório PDF"
                            />
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ── Subnav ──────────────────────────────────────────────────── */}
            <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.28, delay: delay(1), ease: [0.25, 0.1, 0.25, 1] }}
                style={{ paddingBottom: 40 }}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 28, padding: '4px', background: 'var(--color-bg-secondary)', borderRadius: 10, width: 'fit-content', border: '1px solid var(--color-border)' }}>
                    {TABS.map(tab => (
                        <motion.button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            whileTap={{ scale: 0.97 }}
                            style={{
                                fontFamily: 'var(--font-sans)',
                                fontSize: 13,
                                fontWeight: activeTab === tab.id ? 500 : 400,
                                color: activeTab === tab.id ? 'var(--color-text-primary)' : 'var(--color-text-tertiary)',
                                background: activeTab === tab.id ? 'var(--color-bg-primary)' : 'transparent',
                                border: activeTab === tab.id ? '1px solid var(--color-border)' : '1px solid transparent',
                                borderRadius: 7,
                                padding: '6px 16px',
                                cursor: 'pointer',
                                transition: 'all 0.15s ease',
                                letterSpacing: '-0.1px',
                            }}
                        >
                            {tab.label}
                        </motion.button>
                    ))}
                </div>

                <AnimatePresence mode="wait">

                    {/* ── TAB: Gerar ───────────────────────────────────────── */}
                    {activeTab === 'gerar' && (
                        <motion.div key="tab-gerar" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.22, ease: [0.25, 0.1, 0.25, 1] }}>
                            <SectionLabel gutterBottom={16}>Exportar relatório</SectionLabel>
                            <div style={card}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                                    <p style={{ margin: 0, fontFamily: 'var(--font-sans)', fontSize: 13, color: 'var(--color-text-secondary)' }}>
                                        Gere e baixe o relatório completo com dados cruzados, análise de canais e diagnóstico de IA.
                                    </p>

                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
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
                                            <span style={{ fontFamily: 'var(--font-sans)', fontSize: 11, fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Intervalo customizado</span>
                                            <SegmentedControl
                                                options={['last_7_days', 'last_30_days', 'last_90_days', 'custom'] as const}
                                                value={periodType}
                                                onChange={setPeriodType}
                                                labels={{ last_7_days: '7 dias', last_30_days: '30 dias', last_90_days: '90 dias', custom: 'Personalizado' }}
                                            />
                                        </div>
                                    </div>

                                    {/* Custom date range pickers */}
                                    <AnimatePresence>
                                        {periodType === 'custom' && (
                                            <motion.div
                                                initial={{ opacity: 0, height: 0 }}
                                                animate={{ opacity: 1, height: 'auto' }}
                                                exit={{ opacity: 0, height: 0 }}
                                                style={{ overflow: 'hidden' }}
                                            >
                                                <div style={{ display: 'flex', gap: 12, alignItems: 'center', paddingTop: 4 }}>
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                                        <span style={{ fontFamily: 'var(--font-sans)', fontSize: 11, color: 'var(--color-text-secondary)' }}>De</span>
                                                        <input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)}
                                                            style={{ padding: '7px 10px', background: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)', borderRadius: 6, color: 'var(--color-text-primary)', fontFamily: 'var(--font-mono)', fontSize: 13, outline: 'none' }} />
                                                    </div>
                                                    <span style={{ fontFamily: 'var(--font-sans)', fontSize: 13, color: 'var(--color-text-secondary)', marginTop: 20 }}>→</span>
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                                        <span style={{ fontFamily: 'var(--font-sans)', fontSize: 11, color: 'var(--color-text-secondary)' }}>Até</span>
                                                        <input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)}
                                                            style={{ padding: '7px 10px', background: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)', borderRadius: 6, color: 'var(--color-text-primary)', fontFamily: 'var(--font-mono)', fontSize: 13, outline: 'none' }} />
                                                    </div>
                                                </div>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>

                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                        <span style={{ fontFamily: 'var(--font-sans)', fontSize: 11, fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Formato para email</span>
                                        <SegmentedControl
                                            options={['pdf', 'xlsx', 'json'] as const}
                                            value={genFormat}
                                            onChange={setGenFormat}
                                            labels={{ pdf: 'PDF com IA', xlsx: 'Excel', json: 'JSON' }}
                                        />
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
                                        <Btn variant="secondary"
                                            onClick={handlePreviewPdf}
                                            disabled={generating !== null || previewPdfLoading}
                                            icon={<EyeIcon />}>
                                            {previewPdfLoading ? 'Carregando...' : 'Pré-visualizar PDF'}
                                        </Btn>
                                        <div style={{ width: 1, height: 24, background: 'var(--color-border)', flexShrink: 0 }} />
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
                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" strokeWidth="2" strokeLinecap="round" style={{ animation: 'spin 0.9s linear infinite', flexShrink: 0 }}>
                                                <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                                            </svg>
                                            <span style={{ fontFamily: 'var(--font-sans)', fontSize: 12, color: 'var(--color-text-secondary)' }}>
                                                {getStepMessage(generatingStep, generating)}
                                            </span>
                                        </motion.div>
                                    )}
                                    {emailFeedback && (
                                        <motion.p key="email-feedback" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                                            style={{ margin: '12px 0 0', fontFamily: 'var(--font-sans)', fontSize: 13, color: emailFeedback.ok ? 'var(--accent-green)' : 'var(--accent-red)' }}>
                                            {emailFeedback.msg}
                                        </motion.p>
                                    )}
                                </AnimatePresence>
                            </div>
                        </motion.div>
                    )}

                    {/* ── TAB: Análise IA ──────────────────────────────────── */}
                    {activeTab === 'ai' && (
                        <motion.div key="tab-ai" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.22, ease: [0.25, 0.1, 0.25, 1] }}>
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
                                            <Btn variant="primary" onClick={handleRequestAI}>
                                                Analisar com IA
                                            </Btn>
                                        </motion.div>
                                    )}

                                    {loadingAI && (
                                        <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                                            style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '4px 0' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" strokeWidth="2" strokeLinecap="round" style={{ animation: 'spin 0.9s linear infinite', flexShrink: 0 }}>
                                                    <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                                                </svg>
                                                <span style={{ fontFamily: 'var(--font-sans)', fontSize: 13, fontWeight: 500, color: 'var(--color-text-primary)' }}>
                                                    {!aiReady ? 'Carregando dados...' : 'Analisando com IA...'}
                                                </span>
                                            </div>
                                            {aiStreamText && (
                                                <div style={{
                                                    fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--color-text-secondary)',
                                                    lineHeight: 1.6, maxHeight: 160, overflow: 'hidden',
                                                    padding: '10px 14px',
                                                    background: 'var(--color-bg-secondary)',
                                                    borderRadius: 8,
                                                    border: '1px solid var(--color-border)',
                                                    whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                                                    position: 'relative',
                                                }}>
                                                    {aiStreamText.slice(-600)}
                                                    <span style={{ animation: 'pulse 0.8s ease-in-out infinite', color: 'var(--color-primary)' }}>▋</span>
                                                    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 32, background: 'linear-gradient(to bottom, var(--color-bg-secondary), transparent)', borderRadius: '8px 8px 0 0', pointerEvents: 'none' }} />
                                                </div>
                                            )}
                                        </motion.div>
                                    )}

                                    {aiError && !loadingAI && (
                                        <motion.div key="error" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                                            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
                                            <span style={{ fontFamily: 'var(--font-sans)', fontSize: 13, color: 'var(--accent-red)' }}>
                                                {aiTimedOut
                                                    ? 'A análise excedeu o tempo limite. O servidor pode estar sob carga — aguarde alguns instantes e tente novamente.'
                                                    : 'Falha na análise. Verifique as integrações e tente novamente.'}
                                            </span>
                                            <Btn variant="secondary" onClick={handleRequestAI}>Tentar novamente</Btn>
                                        </motion.div>
                                    )}

                                    {aiAnalysis && !loadingAI && (
                                        <motion.div key="result" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                                            style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

                                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
                                                <SituacaoBadge value={aiAnalysis.situacao_geral} size="md" />
                                                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                                                    {aiAnalysis.is_ai_fallback && (
                                                        <span style={{
                                                            display: 'inline-flex', alignItems: 'center', gap: 5,
                                                            fontFamily: 'var(--font-sans)', fontSize: 10, fontWeight: 600,
                                                            color: '#F59E0B', background: 'rgba(245,158,11,0.10)',
                                                            border: '1px solid rgba(245,158,11,0.25)',
                                                            padding: '2px 8px', borderRadius: 4, letterSpacing: '0.04em',
                                                            textTransform: 'uppercase', width: 'fit-content',
                                                        }}>
                                                            Análise simplificada — IA indisponível no momento
                                                        </span>
                                                    )}
                                                    <p style={{ margin: 0, fontFamily: 'var(--font-sans)', fontSize: 13, color: 'var(--color-text-secondary)', lineHeight: 1.6 }}>
                                                        {aiAnalysis.resumo_executivo}
                                                    </p>
                                                </div>
                                            </div>

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

                                            {aiAnalysis.proximos_passos.length > 0 && (
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '14px 16px', background: 'var(--color-bg-secondary)', borderRadius: 8 }}>
                                                    <span style={{ fontFamily: 'var(--font-sans)', fontSize: 11, fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                                                        Próximos passos
                                                    </span>
                                                    {aiAnalysis.proximos_passos.map((step, i) => (
                                                        <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                                                            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 600, color: 'var(--color-primary)', flexShrink: 0, marginTop: 1 }}>
                                                                {String(i + 1).padStart(2, '0')}
                                                            </span>
                                                            <span style={{ fontFamily: 'var(--font-sans)', fontSize: 13, color: 'var(--color-text-primary)', lineHeight: 1.5 }}>
                                                                {step}
                                                            </span>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}

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
                    )}

                    {/* ── TAB: Configurar envio ────────────────────────────── */}
                    {activeTab === 'automatico' && (
                        <motion.div key="tab-automatico" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.22, ease: [0.25, 0.1, 0.25, 1] }}>
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
                                                border: `1px solid ${emailError ? 'var(--accent-red)' : 'var(--color-border)'}`,
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
                                            onFocus={e => { if (!emailError) e.currentTarget.style.borderColor = 'var(--color-primary)' }}
                                        />
                                        <AnimatePresence>
                                            {emailError && (
                                                <motion.span
                                                    initial={{ opacity: 0, y: -4 }}
                                                    animate={{ opacity: 1, y: 0 }}
                                                    exit={{ opacity: 0, y: -4 }}
                                                    style={{ fontFamily: 'var(--font-sans)', fontSize: 11, color: 'var(--accent-red)' }}
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
                                                    style={{ fontFamily: 'var(--font-sans)', fontSize: 13, color: 'var(--accent-green)' }}>
                                                    Salvo
                                                </motion.span>
                                            )}
                                        </AnimatePresence>
                                    </div>

                                    {(savedConfig?.enabled || config.enabled) && (
                                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                                            style={{ padding: '12px 16px', background: 'var(--status-in-progress-bg)', borderRadius: 8, border: '1px solid var(--status-in-progress)', display: 'flex', alignItems: 'center', gap: 10 }}>
                                            <span style={{ fontFamily: 'var(--font-sans)', fontSize: 13, color: 'var(--color-text-secondary)' }}>
                                                Próximo relatório em{' '}
                                                <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-primary)', fontWeight: 600 }}>
                                                    {nextReportDate(config.frequency, savedConfig?.next_send_at)}
                                                </span>
                                            </span>
                                        </motion.div>
                                    )}
                                </div>
                            </div>
                        </motion.div>
                    )}

                    {/* ── TAB: Histórico ───────────────────────────────────── */}
                    {activeTab === 'historico' && (
                        <motion.div key="tab-historico" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.22, ease: [0.25, 0.1, 0.25, 1] }}>
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
                                    <EmptyState title="Nenhum relatório gerado ainda" description="Gere seu primeiro relatório na aba Gerar ou configure o envio automático." />
                                ) : (
                                    <div>
                                        {logs.map(log => {
                                            const freqLabel: Record<string, string> = { semanal: 'Semanal', mensal: 'Mensal', trimestral: 'Trimestral', weekly: 'Semanal', monthly: 'Mensal', quarterly: 'Trimestral' }
                                            const emailStatusLabel: Record<string, { label: string; color: string }> = {
                                                sent: { label: 'Enviado', color: 'var(--color-text-secondary)' },
                                                delivered: { label: 'Entregue', color: 'var(--accent-green)' },
                                                bounced: { label: 'Bounce', color: 'var(--accent-red)' },
                                                complained: { label: 'Spam', color: 'var(--accent-orange)' },
                                                delayed: { label: 'Atrasado', color: 'var(--accent-orange)' },
                                            }
                                            const emailSt = log.email_status ? emailStatusLabel[log.email_status] : null
                                            const isError = log.status === 'error'
                                            const canRedownload = !isError && (log.format === 'pdf' || log.format === 'xlsx' || log.format === 'json')
                                            const isExpanded = expandedLogId === log.id
                                            const snap = log.snapshot

                                            return (
                                                <div key={log.id}>
                                                    <NotionRow
                                                        style={{ padding: '0 20px', opacity: isError ? 0.6 : 1, cursor: snap ? 'pointer' : 'default' }}
                                                        onClick={() => snap && setExpandedLogId(isExpanded ? null : log.id)}
                                                    >
                                                        <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 100px 80px 120px 110px 80px 52px', width: '100%', alignItems: 'center', minHeight: 52 }}>
                                                            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
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
                                                                        <span style={{ fontFamily: 'var(--font-sans)', fontSize: 10, fontWeight: 700, color: 'var(--accent-red)', background: 'var(--priority-high-bg)', padding: '2px 6px', borderRadius: 4, letterSpacing: '0.04em' }}>ERRO</span>
                                                                    )}
                                                                </div>
                                                                {log.period_start && log.period_end && (
                                                                    <span style={{ fontFamily: 'var(--font-sans)', fontSize: 11, color: 'var(--color-text-secondary)', marginLeft: snap ? 18 : 0 }}>
                                                                        {fmtDateShort(log.period_start)} – {fmtDateShort(log.period_end)}
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                                                                <span style={{ fontFamily: 'var(--font-sans)', fontSize: 13, color: 'var(--color-text-secondary)' }}>
                                                                    {freqLabel[log.frequency] ?? log.frequency}
                                                                </span>
                                                                {log.triggered_by && log.triggered_by !== 'manual' && (
                                                                    <span style={{
                                                                        display: 'inline-block', fontFamily: 'var(--font-sans)', fontSize: 9, fontWeight: 700,
                                                                        letterSpacing: '0.06em', textTransform: 'uppercase', padding: '1px 5px', borderRadius: 3,
                                                                        color: log.triggered_by === 'automatic' ? 'var(--accent-purple)' : 'var(--color-primary)',
                                                                        background: log.triggered_by === 'automatic' ? 'var(--status-not-started-bg)' : 'var(--status-in-progress-bg)',
                                                                    }}>
                                                                        {log.triggered_by === 'automatic' ? 'Auto' : 'Email'}
                                                                    </span>
                                                                )}
                                                            </div>
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
                                                                    downloadError === log.id ? (
                                                                        <motion.button
                                                                            whileTap={{ scale: 0.95 }}
                                                                            onClick={(e) => { e.stopPropagation(); handleRedownload(log) }}
                                                                            style={{ display: 'flex', alignItems: 'center', gap: 4, fontFamily: 'var(--font-sans)', fontSize: 11, color: 'var(--accent-red)', background: 'transparent', border: 'none', cursor: 'pointer', padding: '2px 4px' }}
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
                                                                            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 30, height: 30, borderRadius: 6, border: '1px solid var(--color-border)', background: 'transparent', cursor: downloadingLogId ? 'default' : 'pointer', color: downloadingLogId === log.id ? 'var(--color-primary)' : 'var(--color-text-secondary)', opacity: downloadingLogId && downloadingLogId !== log.id ? 0.4 : 1 }}>
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

                                                    {/* Expandable snapshot detail */}
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
                                                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 12 }}>
                                                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                                                            <span style={{ fontFamily: 'var(--font-sans)', fontSize: 10, fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Receita líquida</span>
                                                                            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 14, fontWeight: 600, color: 'var(--color-text-primary)' }}>{fmtBRL(snap.revenue_net)}</span>
                                                                            {snap.revenue_change_pct !== null && snap.revenue_change_pct !== undefined && (
                                                                                <span style={{ fontFamily: 'var(--font-sans)', fontSize: 11, color: snap.revenue_change_pct >= 0 ? 'var(--accent-green)' : 'var(--accent-red)' }}>
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

                                                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: snap.resumo_executivo ? 12 : 0 }}>
                                                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                                                            <span style={{ fontFamily: 'var(--font-sans)', fontSize: 10, fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Canal top</span>
                                                                            {snap.top_channel ? (
                                                                                <>
                                                                                    <span style={{ fontFamily: 'var(--font-sans)', fontSize: 13, fontWeight: 500, color: 'var(--color-text-primary)' }}>
                                                                                        {CHANNEL_LABEL[snap.top_channel.channel] ?? snap.top_channel.channel}
                                                                                    </span>
                                                                                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--accent-green)' }}>
                                                                                        {fmtBRL(snap.top_channel.value_created)}
                                                                                    </span>
                                                                                </>
                                                                            ) : (
                                                                                <span style={{ fontFamily: 'var(--font-sans)', fontSize: 13, color: 'var(--color-text-secondary)' }}>—</span>
                                                                            )}
                                                                        </div>

                                                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                                                            <span style={{ fontFamily: 'var(--font-sans)', fontSize: 10, fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Canal em prejuízo</span>
                                                                            {snap.worst_channel ? (
                                                                                <>
                                                                                    <span style={{ fontFamily: 'var(--font-sans)', fontSize: 13, fontWeight: 500, color: 'var(--color-text-primary)' }}>
                                                                                        {CHANNEL_LABEL[snap.worst_channel.channel] ?? snap.worst_channel.channel}
                                                                                    </span>
                                                                                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--accent-red)' }}>
                                                                                        {fmtBRL(snap.worst_channel.value_created)}
                                                                                    </span>
                                                                                </>
                                                                            ) : (
                                                                                <span style={{ fontFamily: 'var(--font-sans)', fontSize: 13, color: 'var(--color-text-secondary)' }}>—</span>
                                                                            )}
                                                                        </div>

                                                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                                                            <span style={{ fontFamily: 'var(--font-sans)', fontSize: 10, fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Clientes em risco</span>
                                                                            {snap.at_risk_count !== undefined ? (
                                                                                <>
                                                                                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 600, color: 'var(--accent-orange)' }}>{snap.at_risk_count}</span>
                                                                                    {snap.at_risk_ltv !== undefined && (
                                                                                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--color-text-secondary)' }}>{fmtBRL(snap.at_risk_ltv)} em LTV</span>
                                                                                    )}
                                                                                </>
                                                                            ) : (
                                                                                <span style={{ fontFamily: 'var(--font-sans)', fontSize: 13, color: 'var(--color-text-secondary)' }}>—</span>
                                                                            )}
                                                                        </div>

                                                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                                                            <span style={{ fontFamily: 'var(--font-sans)', fontSize: 10, fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Diagnósticos críticos</span>
                                                                            {snap.diagnosticos_count !== undefined ? (
                                                                                <>
                                                                                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 600, color: snap.criticos > 0 ? 'var(--accent-red)' : 'var(--color-text-primary)' }}>
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
                                                    style={{ fontFamily: 'var(--font-sans)', fontSize: 13, color: loadingMore ? 'var(--color-text-secondary)' : 'var(--color-primary)', background: 'transparent', border: 'none', cursor: loadingMore ? 'default' : 'pointer', padding: '4px 12px' }}>
                                                    {loadingMore ? 'Carregando...' : 'Carregar mais'}
                                                </motion.button>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    )}

                </AnimatePresence>
            </motion.div>
        </div>
    )
}
