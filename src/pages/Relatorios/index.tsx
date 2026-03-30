/**
 * @file pages/Relatorios/index.tsx
 * Página de Relatórios — geração sob demanda, envio automático e histórico.
 */

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { reportsApi } from '../../lib/api'
import DateRangePicker, { type DateRange } from '../../components/ui/DateRangePicker'
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
    email_status?: string
    period_start?: string
    period_end?: string
    triggered_by?: 'manual' | 'automatic' | 'email'
}

// ── Formatters ────────────────────────────────────────────────────────────────

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

// ── Format icons ──────────────────────────────────────────────────────────────

function PdfIcon() {
    return (
        <svg width="18" height="18" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 2H5.5A1.5 1.5 0 0 0 4 3.5v13A1.5 1.5 0 0 0 5.5 18h9a1.5 1.5 0 0 0 1.5-1.5V7L12 2z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M12 2v5h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            <line x1="7.5" y1="11" x2="12.5" y2="11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            <line x1="7.5" y1="14" x2="12.5" y2="14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
    )
}

function ExcelIcon() {
    return (
        <svg width="18" height="18" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="3" y="3" width="14" height="14" rx="2" stroke="currentColor" strokeWidth="1.5"/>
            <line x1="3" y1="7" x2="17" y2="7" stroke="currentColor" strokeWidth="1.3"/>
            <line x1="3" y1="11" x2="17" y2="11" stroke="currentColor" strokeWidth="1.3"/>
            <line x1="3" y1="15" x2="17" y2="15" stroke="currentColor" strokeWidth="1.3"/>
            <line x1="8" y1="3" x2="8" y2="17" stroke="currentColor" strokeWidth="1.3"/>
        </svg>
    )
}

function JsonIcon() {
    return (
        <svg width="18" height="18" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M6 3C4.5 3 4 4 4 5v2.5C4 8.5 3 9 2 9v2c1 0 2 .5 2 1.5V15c0 1 .5 2 2 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            <path d="M14 3c1.5 0 2 1 2 2v2.5c0 1 1 1.5 2 1.5v2c-1 0-2 .5-2 1.5V15c0 1-.5 2-2 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            <circle cx="8" cy="10" r="1" fill="currentColor"/>
            <circle cx="12" cy="10" r="1" fill="currentColor"/>
        </svg>
    )
}

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

// ── Format config ─────────────────────────────────────────────────────────────

const FORMAT_INFO: Record<string, { label: string; description: string; icon: () => JSX.Element }> = {
    pdf: { label: 'PDF', description: 'Relatório visual com identidade Northie', icon: PdfIcon },
    xlsx: { label: 'Excel', description: 'Planilha com dados estruturados', icon: ExcelIcon },
    json: { label: 'JSON', description: 'Dados brutos para integração', icon: JsonIcon },
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface RelatoriosProps {
    onToggleChat?: () => void
    user?: { id?: string; email?: string } | null
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function Relatorios(_props: RelatoriosProps) {
    const card: React.CSSProperties = { background: 'var(--color-bg-primary)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', padding: 28 }
    const delay = (n: number) => n * 0.07

    // Active tab
    const [activeTab, setActiveTab] = useState<'gerar' | 'automatico' | 'historico'>('gerar')

    // Config state
    const [config, setConfig] = useState<ReportConfig>({ enabled: false, frequency: 'mensal', format: 'pdf', email: '' })
    const [savedConfig, setSavedConfig] = useState<ReportConfig | null>(null)
    const [savingConfig, setSavingConfig] = useState(false)
    const [savedFeedback, setSavedFeedback] = useState(false)
    const [emailError, setEmailError] = useState<string | null>(null)

    // Generate on-demand
    const [genFormat, setGenFormat] = useState<'pdf' | 'xlsx' | 'json'>('pdf')
    const [generating, setGenerating] = useState<'xlsx' | 'json' | 'pdf' | null>(null)
    const [sendingEmail, setSendingEmail] = useState(false)
    const [feedback, setFeedback] = useState<{ ok: boolean; msg: string } | null>(null)

    // Date range (same component as Dashboard)
    const [dateRange, setDateRange] = useState<DateRange>(() => {
        const end = new Date()
        const start = new Date()
        start.setDate(start.getDate() - 29)
        return { start, end, label: 'Últimos 30 dias' }
    })

    // History
    const [logs, setLogs] = useState<ReportLog[]>([])
    const [loadingLogs, setLoadingLogs] = useState(true)
    const [logsPage, setLogsPage] = useState(0)
    const [hasMoreLogs, setHasMoreLogs] = useState(false)
    const [loadingMore, setLoadingMore] = useState(false)
    const [downloadingLogId, setDownloadingLogId] = useState<string | null>(null)
    const [downloadError, setDownloadError] = useState<string | null>(null)
    const [refreshingLogs, setRefreshingLogs] = useState(false)

    useEffect(() => {
        reportsApi.getConfig()
            .then(res => {
                if (res.data) {
                    setConfig(res.data as ReportConfig)
                    setSavedConfig(res.data as ReportConfig)
                }
            })
            .catch(() => {})

        reportsApi.getLogs(0)
            .then(res => {
                const { data, hasMore } = res.data as { data: ReportLog[]; hasMore: boolean }
                setLogs(data || [])
                setHasMoreLogs(hasMore)
            })
            .finally(() => setLoadingLogs(false))
    }, [])

    // Map dateRange to frequency label for API
    function getFrequencyFromRange(): 'semanal' | 'mensal' | 'trimestral' {
        const diffDays = Math.round((dateRange.end.getTime() - dateRange.start.getTime()) / (1000 * 60 * 60 * 24))
        if (diffDays <= 10) return 'semanal'
        if (diffDays <= 60) return 'mensal'
        return 'trimestral'
    }

    function getCustomDates() {
        return {
            period_type: 'custom' as const,
            custom_start: dateRange.start.toISOString().slice(0, 10),
            custom_end: dateRange.end.toISOString().slice(0, 10),
        }
    }

    const refreshLogs = () => {
        reportsApi.getLogs(0).then(res => {
            const { data, hasMore } = res.data as { data: ReportLog[]; hasMore: boolean }
            setLogs(data || [])
            setHasMoreLogs(hasMore)
            setLogsPage(0)
        }).catch(() => {})
    }

    async function handleDownload(format: 'xlsx' | 'json' | 'pdf') {
        setGenerating(format)
        setFeedback(null)
        try {
            const response = await reportsApi.generate(getFrequencyFromRange(), format, getCustomDates())
            const mime = { xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', json: 'application/json', pdf: 'application/pdf' }[format]
            const url = URL.createObjectURL(new Blob([response.data as BlobPart], { type: mime }))
            const a = document.createElement('a')
            a.href = url
            a.download = `northie-relatorio-${new Date().toISOString().slice(0, 10)}.${format}`
            a.click()
            URL.revokeObjectURL(url)
            setFeedback({ ok: true, msg: `${FORMAT_INFO[format].label} gerado com sucesso` })
            refreshLogs()
        } catch {
            setFeedback({ ok: false, msg: `Falha ao gerar ${format.toUpperCase()}. Verifique as integrações e tente novamente.` })
        } finally {
            setGenerating(null)
            setTimeout(() => setFeedback(null), 4000)
        }
    }

    async function handleSendEmail() {
        const email = config.email || savedConfig?.email || ''
        if (!email) {
            setFeedback({ ok: false, msg: 'Configure um email na aba "Envio automático".' })
            setTimeout(() => setFeedback(null), 4000)
            return
        }
        setSendingEmail(true)
        setFeedback(null)
        try {
            await reportsApi.sendEmail(getFrequencyFromRange(), genFormat, email)
            setFeedback({ ok: true, msg: `Enviado para ${email}` })
            refreshLogs()
        } catch (err: unknown) {
            const axiosErr = err as { response?: { data?: { error?: string } } }
            const serverMsg = (axiosErr.response?.data?.error ?? '').toLowerCase()
            const isResendMissing = serverMsg.includes('resend') || serverMsg.includes('api_key') || serverMsg.includes('não configurado')
            setFeedback({
                ok: false,
                msg: isResendMissing
                    ? 'Serviço de email não configurado. Adicione RESEND_API_KEY nas variáveis de ambiente.'
                    : 'Falha ao enviar. Tente novamente.',
            })
        } finally {
            setSendingEmail(false)
            setTimeout(() => setFeedback(null), 5000)
        }
    }

    async function handleSaveConfig() {
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

    async function handleLoadMoreLogs() {
        setLoadingMore(true)
        const nextPage = logsPage + 1
        try {
            const res = await reportsApi.getLogs(nextPage)
            const { data, hasMore } = res.data as { data: ReportLog[]; hasMore: boolean }
            setLogs(prev => [...prev, ...(data || [])])
            setHasMoreLogs(hasMore)
            setLogsPage(nextPage)
        } catch { /* silently ignore */ } finally {
            setLoadingMore(false)
        }
    }

    async function handleRefreshLogs() {
        setRefreshingLogs(true)
        try { refreshLogs() } finally {
            setTimeout(() => setRefreshingLogs(false), 600)
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
            a.href = url
            a.download = `northie-relatorio-${freqLabel}-${dateStr}.${format}`
            a.click()
            URL.revokeObjectURL(url)
        } catch {
            setDownloadError(log.id)
        } finally {
            setDownloadingLogId(null)
        }
    }

    const TABS = [
        { id: 'gerar',      label: 'Gerar relatório' },
        { id: 'automatico', label: 'Envio automático' },
        { id: 'historico',  label: 'Histórico' },
    ] as const

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
            <PageHeader title="Relatórios" subtitle="Exporte os dados do seu negócio em PDF, Excel ou JSON." />

            <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.28, delay: delay(1), ease: [0.25, 0.1, 0.25, 1] }}
                style={{ paddingBottom: 40 }}
            >
                {/* ── Tabs ──────────────────────────────────────────────── */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 28, padding: 4, background: 'var(--color-bg-secondary)', borderRadius: 10, width: 'fit-content', border: '1px solid var(--color-border)' }}>
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

                    {/* ── TAB: Gerar ───────────────────────────────────── */}
                    {activeTab === 'gerar' && (
                        <motion.div key="tab-gerar" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.22, ease: [0.25, 0.1, 0.25, 1] }}>
                            <div style={card}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

                                    {/* Interval */}
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                        <span style={{ fontFamily: 'var(--font-sans)', fontSize: 11, fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Intervalo</span>
                                        <DateRangePicker value={dateRange} onChange={setDateRange} />
                                    </div>

                                    <div style={{ height: 1, background: 'var(--color-border)' }} />

                                    {/* Format cards */}
                                    <div>
                                        <span style={{ fontFamily: 'var(--font-sans)', fontSize: 11, fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 10 }}>Formato</span>
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                                            {(['pdf', 'xlsx', 'json'] as const).map(fmt => {
                                                const info = FORMAT_INFO[fmt]
                                                const selected = genFormat === fmt
                                                const Icon = info.icon
                                                return (
                                                    <motion.button
                                                        key={fmt}
                                                        onClick={() => setGenFormat(fmt)}
                                                        whileHover={{ scale: 1.01 }}
                                                        whileTap={{ scale: 0.98 }}
                                                        style={{
                                                            display: 'flex', flexDirection: 'column', gap: 6,
                                                            padding: 16, borderRadius: 10, cursor: 'pointer',
                                                            background: selected ? 'var(--color-bg-secondary)' : 'transparent',
                                                            border: selected ? '1.5px solid var(--color-primary)' : '1px solid var(--color-border)',
                                                            textAlign: 'left', transition: 'all 0.15s ease',
                                                        }}
                                                    >
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: selected ? 'var(--color-primary)' : 'var(--color-text-secondary)' }}>
                                                            <Icon />
                                                            <span style={{ fontFamily: 'var(--font-sans)', fontSize: 14, fontWeight: 600, color: 'var(--color-text-primary)' }}>{info.label}</span>
                                                        </div>
                                                        <span style={{ fontFamily: 'var(--font-sans)', fontSize: 12, color: 'var(--color-text-secondary)', lineHeight: 1.4 }}>{info.description}</span>
                                                    </motion.button>
                                                )
                                            })}
                                        </div>
                                    </div>

                                    {/* Actions */}
                                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                                        <Btn
                                            variant="primary"
                                            onClick={() => handleDownload(genFormat)}
                                            disabled={generating !== null || sendingEmail}
                                            icon={<DownloadIcon />}
                                        >
                                            {generating === genFormat ? 'Gerando...' : `Baixar ${FORMAT_INFO[genFormat].label}`}
                                        </Btn>
                                        <Btn
                                            variant="secondary"
                                            onClick={handleSendEmail}
                                            disabled={generating !== null || sendingEmail}
                                            icon={<EmailIcon />}
                                        >
                                            {sendingEmail ? 'Enviando...' : 'Enviar por email'}
                                        </Btn>
                                    </div>

                                    {/* Generating spinner + feedback */}
                                    <AnimatePresence>
                                        {generating !== null && (
                                            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                                                style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" strokeWidth="2" strokeLinecap="round" style={{ animation: 'spin 0.9s linear infinite', flexShrink: 0 }}>
                                                    <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                                                </svg>
                                                <span style={{ fontFamily: 'var(--font-sans)', fontSize: 12, color: 'var(--color-text-secondary)' }}>
                                                    Gerando {FORMAT_INFO[generating].label}...
                                                </span>
                                            </motion.div>
                                        )}
                                        {feedback && (
                                            <motion.p key="feedback" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                                                style={{ margin: 0, fontFamily: 'var(--font-sans)', fontSize: 13, color: feedback.ok ? 'var(--accent-green)' : 'var(--accent-red)' }}>
                                                {feedback.msg}
                                            </motion.p>
                                        )}
                                    </AnimatePresence>
                                </div>
                            </div>
                        </motion.div>
                    )}

                    {/* ── TAB: Envio automático ─────────────────────────── */}
                    {activeTab === 'automatico' && (
                        <motion.div key="tab-automatico" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.22, ease: [0.25, 0.1, 0.25, 1] }}>
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
                                                labels={{ pdf: 'PDF', xlsx: 'Excel', json: 'JSON' }} />
                                        </div>
                                    </div>

                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                        <span style={{ fontFamily: 'var(--font-sans)', fontSize: 11, fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Email de envio</span>
                                        <input
                                            type="email"
                                            placeholder="seu@email.com"
                                            value={config.email}
                                            onChange={e => { setConfig(c => ({ ...c, email: e.target.value })); setEmailError(null) }}
                                            onBlur={e => { if (e.target.value && !isValidEmail(e.target.value)) setEmailError('Email inválido') }}
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
                                                <motion.span initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
                                                    style={{ fontFamily: 'var(--font-sans)', fontSize: 11, color: 'var(--accent-red)' }}>
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
                                            style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                            <span style={{ fontFamily: 'var(--font-sans)', fontSize: 13, fontWeight: 400, color: 'var(--color-text-secondary)' }}>
                                                Próximo relatório em
                                            </span>
                                            <span style={{ fontFamily: 'var(--font-sans)', fontSize: 13, fontWeight: 500, color: 'var(--color-text-primary)' }}>
                                                {nextReportDate(config.frequency, savedConfig?.next_send_at)}
                                            </span>
                                        </motion.div>
                                    )}
                                </div>
                            </div>
                        </motion.div>
                    )}

                    {/* ── TAB: Histórico ────────────────────────────────── */}
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
                                <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 100px 80px 100px 80px 52px', padding: '12px 20px', borderBottom: '1px solid var(--color-border)' }}>
                                    <TH>Data</TH>
                                    <TH>Frequência</TH>
                                    <TH>Formato</TH>
                                    <TH>Origem</TH>
                                    <TH align="right">Email</TH>
                                    <TH align="right"> </TH>
                                </div>

                                {loadingLogs ? <LoadingRow /> : logs.length === 0 ? (
                                    <EmptyState title="Nenhum relatório gerado ainda" description="Gere seu primeiro relatório na aba anterior." />
                                ) : (
                                    <div>
                                        {logs.map(log => {
                                            const freqLabel: Record<string, string> = { semanal: 'Semanal', mensal: 'Mensal', trimestral: 'Trimestral', weekly: 'Semanal', monthly: 'Mensal', quarterly: 'Trimestral' }
                                            const emailStatusLabel: Record<string, { label: string; color: string }> = {
                                                sent: { label: 'Enviado', color: 'var(--color-text-secondary)' },
                                                delivered: { label: 'Entregue', color: 'var(--accent-green)' },
                                                bounced: { label: 'Bounce', color: 'var(--accent-red)' },
                                            }
                                            const emailSt = log.email_status ? emailStatusLabel[log.email_status] : null
                                            const isError = log.status === 'error'
                                            const canRedownload = !isError && (log.format === 'pdf' || log.format === 'xlsx' || log.format === 'json')
                                            const originLabel = log.triggered_by === 'automatic' ? 'Auto' : log.triggered_by === 'email' ? 'Email' : 'Manual'

                                            return (
                                                <NotionRow key={log.id} style={{ padding: '0 20px', opacity: isError ? 0.6 : 1 }}>
                                                    <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 100px 80px 100px 80px 52px', width: '100%', alignItems: 'center', minHeight: 48 }}>
                                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                                            <span style={{ fontFamily: 'var(--font-sans)', fontSize: 13, color: 'var(--color-text-primary)' }}>
                                                                {fmtDate(log.created_at)}
                                                            </span>
                                                            {log.period_start && log.period_end && (
                                                                <span style={{ fontFamily: 'var(--font-sans)', fontSize: 11, color: 'var(--color-text-secondary)' }}>
                                                                    {fmtDateShort(log.period_start)} – {fmtDateShort(log.period_end)}
                                                                </span>
                                                            )}
                                                            {isError && (
                                                                <span style={{ fontFamily: 'var(--font-sans)', fontSize: 10, fontWeight: 700, color: 'var(--accent-red)', background: 'var(--priority-high-bg)', padding: '2px 6px', borderRadius: 4, letterSpacing: '0.04em', width: 'fit-content' }}>ERRO</span>
                                                            )}
                                                        </div>
                                                        <span style={{ fontFamily: 'var(--font-sans)', fontSize: 13, color: 'var(--color-text-secondary)' }}>
                                                            {freqLabel[log.frequency] ?? log.frequency}
                                                        </span>
                                                        <span style={{ fontFamily: 'var(--font-sans)', fontSize: 12, color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>
                                                            {log.format}
                                                        </span>
                                                        <span style={{ fontFamily: 'var(--font-sans)', fontSize: 12, color: 'var(--color-text-secondary)' }}>
                                                            {originLabel}
                                                        </span>
                                                        <div style={{ textAlign: 'right' }}>
                                                            {emailSt ? (
                                                                <span style={{ fontFamily: 'var(--font-sans)', fontSize: 12, color: emailSt.color, fontWeight: 500 }}>{emailSt.label}</span>
                                                            ) : (
                                                                <span style={{ fontFamily: 'var(--font-sans)', fontSize: 12, color: 'var(--color-text-secondary)' }}>—</span>
                                                            )}
                                                        </div>
                                                        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                                                            {canRedownload && (
                                                                downloadError === log.id ? (
                                                                    <motion.button
                                                                        whileTap={{ scale: 0.95 }}
                                                                        onClick={() => handleRedownload(log)}
                                                                        style={{ display: 'flex', alignItems: 'center', gap: 4, fontFamily: 'var(--font-sans)', fontSize: 11, color: 'var(--accent-red)', background: 'transparent', border: 'none', cursor: 'pointer', padding: '2px 4px' }}
                                                                    >
                                                                        Erro — tentar novamente
                                                                    </motion.button>
                                                                ) : (
                                                                    <motion.button
                                                                        whileHover={{ scale: downloadingLogId ? 1 : 1.08 }}
                                                                        whileTap={{ scale: downloadingLogId ? 1 : 0.95 }}
                                                                        onClick={() => handleRedownload(log)}
                                                                        disabled={!!downloadingLogId}
                                                                        title={downloadingLogId === log.id ? 'Gerando...' : 'Baixar novamente'}
                                                                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 30, height: 30, borderRadius: 6, border: '1px solid var(--color-border)', background: 'transparent', cursor: downloadingLogId ? 'default' : 'pointer', color: downloadingLogId === log.id ? 'var(--color-primary)' : 'var(--color-text-secondary)', opacity: downloadingLogId && downloadingLogId !== log.id ? 0.4 : 1 }}
                                                                    >
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
