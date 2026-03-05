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
        roas: number
        new_customers: number
        criticos: number
    }
}

// ── Formatters ────────────────────────────────────────────────────────────────

const fmtBRL = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
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

    // Generate on-demand
    const [genFrequency, setGenFrequency] = useState<ReportConfig['frequency']>('mensal')
    const [generating, setGenerating] = useState<'xlsx' | 'json' | 'pdf' | null>(null)
    const [generatingStep, setGeneratingStep] = useState<0 | 1 | 2 | 3>(0)
    const [sendingEmail, setSendingEmail] = useState(false)
    const [emailFeedback, setEmailFeedback] = useState<{ ok: boolean; msg: string } | null>(null)

    // History
    const [logs, setLogs] = useState<ReportLog[]>([])
    const [loadingLogs, setLoadingLogs] = useState(true)

    useEffect(() => {
        reportsApi.getConfig()
            .then(res => {
                if (res.data) { setConfig(res.data as ReportConfig); setSavedConfig(res.data as ReportConfig) }
            })
            .then(() => {}, () => {})

        reportsApi.getLogs()
            .then(res => setLogs((res.data as ReportLog[]) || []))
            .then(() => setLoadingLogs(false), () => setLoadingLogs(false))
    }, [])

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

    async function handleDownload(format: 'xlsx' | 'json' | 'pdf') {
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
            const mime = { xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', json: 'application/json', pdf: 'application/pdf' }[format]
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

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 40 }}>
            <PageHeader title="Relatórios" subtitle="Análise completa do seu negócio com cruzamento de dados e diagnóstico de IA." />


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
                            {(['xlsx', 'json', 'pdf'] as const).map(fmt => (
                                <Btn key={fmt} variant={fmt === 'pdf' ? 'primary' : 'secondary'}
                                    onClick={() => handleDownload(fmt)}
                                    disabled={generating !== null || sendingEmail}
                                    icon={<DownloadIcon />}>
                                    {generating === fmt ? 'Gerando...' : fmt === 'pdf' ? 'PDF com IA' : fmt === 'xlsx' ? 'Excel' : 'JSON'}
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
                                <SegmentedControl options={['pdf', 'xlsx', 'json'] as const} value={config.format}
                                    onChange={v => setConfig(c => ({ ...c, format: v }))}
                                    labels={{ pdf: 'PDF com IA', xlsx: 'Excel', json: 'JSON' }} />
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
