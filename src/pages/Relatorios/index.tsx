/**
 * @file pages/Relatorios/index.tsx
 * Página de Relatórios Automáticos — configuração, geração on-demand e histórico.
 */

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { reportsApi } from '../../lib/api'
import {
    PageHeader,
    SectionLabel,
    Btn,
    EmptyState,
    TH,
    NotionRow,
    LoadingRow,
} from '../../components/ui/shared'

// ── Types ─────────────────────────────────────────────────────────────────────

interface ReportConfig {
    enabled: boolean
    frequency: 'semanal' | 'mensal' | 'trimestral'
    format: 'csv' | 'json' | 'pdf'
    email: string
}

interface ReportLog {
    id: string
    created_at: string
    frequency: string
    format: string
    status: 'success' | 'error' | 'pending'
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
    return new Intl.DateTimeFormat('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    }).format(new Date(iso))
}

function nextReportDate(frequency: ReportConfig['frequency']): string {
    const now = new Date()
    let next: Date

    if (frequency === 'semanal') {
        // Next Monday
        const day = now.getDay()
        const daysUntilMonday = day === 0 ? 1 : 8 - day
        next = new Date(now)
        next.setDate(now.getDate() + daysUntilMonday)
    } else if (frequency === 'mensal') {
        // First day of next month
        next = new Date(now.getFullYear(), now.getMonth() + 1, 1)
    } else {
        // First day of next quarter
        const currentQuarter = Math.floor(now.getMonth() / 3)
        next = new Date(now.getFullYear(), (currentQuarter + 1) * 3, 1)
    }

    return new Intl.DateTimeFormat('pt-BR', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
    }).format(next)
}

function statusLabel(status: ReportLog['status']): { label: string; color: string } {
    switch (status) {
        case 'success': return { label: 'Concluido', color: 'var(--color-success, #22c55e)' }
        case 'error': return { label: 'Erro', color: 'var(--priority-high, #eb5757)' }
        case 'pending': return { label: 'Aguardando', color: 'var(--color-text-tertiary)' }
    }
}

function frequencyLabel(freq: string): string {
    switch (freq) {
        case 'semanal': return 'Semanal'
        case 'mensal': return 'Mensal'
        case 'trimestral': return 'Trimestral'
        default: return freq
    }
}

// ── Sub-components ────────────────────────────────────────────────────────────

function ToggleSwitch({ enabled, onChange }: { enabled: boolean; onChange: (v: boolean) => void }) {
    return (
        <motion.button
            onClick={() => onChange(!enabled)}
            whileTap={{ scale: 0.95 }}
            style={{
                width: 44,
                height: 24,
                borderRadius: 12,
                border: 'none',
                cursor: 'pointer',
                position: 'relative',
                flexShrink: 0,
                background: enabled ? 'var(--color-primary, #1a7fe8)' : 'var(--color-bg-tertiary)',
                transition: 'background 0.2s ease',
                padding: 0,
            }}
            aria-checked={enabled}
            role="switch"
        >
            <motion.span
                animate={{ x: enabled ? 22 : 2 }}
                transition={{ duration: 0.18, ease: [0.4, 0, 0.2, 1] }}
                style={{
                    display: 'block',
                    width: 20,
                    height: 20,
                    borderRadius: '50%',
                    background: 'white',
                    position: 'absolute',
                    top: 2,
                    boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                }}
            />
        </motion.button>
    )
}

function SegmentedControl<T extends string>({
    options,
    value,
    onChange,
    labels,
}: {
    options: T[]
    value: T
    onChange: (v: T) => void
    labels?: Record<T, string>
}) {
    return (
        <div
            style={{
                display: 'inline-flex',
                background: 'var(--color-bg-secondary)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-md)',
                padding: 3,
                gap: 2,
            }}
        >
            {options.map(opt => (
                <motion.button
                    key={opt}
                    onClick={() => onChange(opt)}
                    whileTap={{ scale: 0.97 }}
                    style={{
                        padding: '5px 14px',
                        borderRadius: 'calc(var(--radius-md) - 2px)',
                        border: 'none',
                        cursor: 'pointer',
                        fontFamily: 'var(--font-sans)',
                        fontSize: 'var(--text-sm)',
                        fontWeight: value === opt ? 500 : 400,
                        background: value === opt ? 'var(--color-bg-primary)' : 'transparent',
                        color: value === opt ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
                        boxShadow: value === opt ? 'var(--shadow-sm, 0 1px 3px rgba(0,0,0,0.08))' : 'none',
                        transition: 'background 0.15s ease, color 0.15s ease, box-shadow 0.15s ease',
                        letterSpacing: '-0.1px',
                    }}
                >
                    {labels ? labels[opt] : opt}
                </motion.button>
            ))}
        </div>
    )
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface RelatoriosProps {
    onToggleChat?: () => void
    user?: { id?: string; email?: string } | null
}

// ── Page Component ────────────────────────────────────────────────────────────

export default function Relatorios(_props: RelatoriosProps) {
    // Config state
    const [config, setConfig] = useState<ReportConfig>({
        enabled: false,
        frequency: 'mensal',
        format: 'pdf',
        email: '',
    })
    const [savedConfig, setSavedConfig] = useState<ReportConfig | null>(null)
    const [savingConfig, setSavingConfig] = useState(false)
    const [savedFeedback, setSavedFeedback] = useState(false)

    // Generate on-demand state
    const [genFrequency, setGenFrequency] = useState<ReportConfig['frequency']>('mensal')
    const [generating, setGenerating] = useState<'csv' | 'json' | 'pdf' | null>(null)

    // History state
    const [logs, setLogs] = useState<ReportLog[]>([])
    const [loadingLogs, setLoadingLogs] = useState(true)

    // Load config and logs on mount
    useEffect(() => {
        reportsApi.getConfig()
            .then(res => {
                const data = res.data
                if (data) {
                    setConfig(data)
                    setSavedConfig(data)
                }
            })
            .catch(() => {
                // Config not found — keep defaults
            })

        reportsApi.getLogs()
            .then(res => { setLogs(res.data || []) })
            .then(() => setLoadingLogs(false), () => { setLogs([]); setLoadingLogs(false) })
    }, [])

    // Save configuration
    async function handleSaveConfig() {
        setSavingConfig(true)
        try {
            await reportsApi.saveConfig(config)
            setSavedConfig(config)
            setSavedFeedback(true)
            setTimeout(() => setSavedFeedback(false), 2500)
        } catch {
            // Silently fail — production would show a toast
        } finally {
            setSavingConfig(false)
        }
    }

    // Download report
    async function handleDownload(format: 'csv' | 'json' | 'pdf') {
        setGenerating(format)
        try {
            const response = await reportsApi.generate(genFrequency, format)
            const extMap = { csv: 'csv', json: 'json', pdf: 'pdf' }
            const ext = extMap[format]
            const filename = `northie-relatorio-${genFrequency}-${new Date().toISOString().slice(0, 10)}.${ext}`
            const mimeMap = { csv: 'text/csv', json: 'application/json', pdf: 'application/pdf' }
            const url = URL.createObjectURL(new Blob([response.data], { type: mimeMap[format] }))
            const a = document.createElement('a')
            a.href = url
            a.download = filename
            a.click()
            URL.revokeObjectURL(url)
        } catch {
            // Silently fail — production would show a toast
        } finally {
            setGenerating(null)
        }
    }

    const cardStyle: React.CSSProperties = {
        background: 'var(--color-bg-primary)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-lg)',
        padding: 28,
    }

    const sectionDelay = (n: number) => n * 0.07

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 40 }}>
            {/* Header */}
            <PageHeader
                title="Relatórios"
                subtitle="Configure relatórios periódicos gerados automaticamente com os dados do seu negócio."
            />

            {/* Config card */}
            <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, delay: sectionDelay(1), ease: [0.25, 0.1, 0.25, 1] }}
            >
                <SectionLabel gutterBottom={16}>Configuracao automatica</SectionLabel>
                <div style={cardStyle}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                        {/* Enabled toggle */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
                            <div>
                                <p style={{
                                    fontFamily: 'var(--font-sans)',
                                    fontSize: 'var(--text-base)',
                                    fontWeight: 500,
                                    color: 'var(--color-text-primary)',
                                    margin: 0,
                                    letterSpacing: '-0.1px',
                                }}>
                                    Ativar relatórios automáticos
                                </p>
                                <p style={{
                                    fontFamily: 'var(--font-sans)',
                                    fontSize: 'var(--text-sm)',
                                    color: 'var(--color-text-secondary)',
                                    margin: '4px 0 0',
                                }}>
                                    Relatórios gerados e salvos automaticamente na frequência configurada
                                </p>
                            </div>
                            <ToggleSwitch
                                enabled={config.enabled}
                                onChange={v => setConfig(c => ({ ...c, enabled: v }))}
                            />
                        </div>

                        {/* Divider */}
                        <div style={{ height: 1, background: 'var(--color-border)' }} />

                        {/* Frequency */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                            <span style={{
                                fontFamily: 'var(--font-sans)',
                                fontSize: 'var(--text-xs)',
                                fontWeight: 500,
                                color: 'var(--color-text-secondary)',
                                letterSpacing: '0.04em',
                                textTransform: 'uppercase',
                            }}>
                                Frequencia
                            </span>
                            <SegmentedControl
                                options={['semanal', 'mensal', 'trimestral'] as const}
                                value={config.frequency}
                                onChange={v => setConfig(c => ({ ...c, frequency: v }))}
                                labels={{ semanal: 'Semanal', mensal: 'Mensal', trimestral: 'Trimestral' }}
                            />
                        </div>

                        {/* Format */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                            <span style={{
                                fontFamily: 'var(--font-sans)',
                                fontSize: 'var(--text-xs)',
                                fontWeight: 500,
                                color: 'var(--color-text-secondary)',
                                letterSpacing: '0.04em',
                                textTransform: 'uppercase',
                            }}>
                                Formato
                            </span>
                            <SegmentedControl
                                options={['pdf', 'csv', 'json'] as const}
                                value={config.format}
                                onChange={v => setConfig(c => ({ ...c, format: v }))}
                                labels={{ pdf: 'PDF com IA', csv: 'CSV', json: 'JSON' }}
                            />
                        </div>

                        {/* Email */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                            <span style={{
                                fontFamily: 'var(--font-sans)',
                                fontSize: 'var(--text-xs)',
                                fontWeight: 500,
                                color: 'var(--color-text-secondary)',
                                letterSpacing: '0.04em',
                                textTransform: 'uppercase',
                            }}>
                                Email de envio
                            </span>
                            <input
                                type="email"
                                placeholder="seu@email.com — opcional, para envio futuro"
                                value={config.email}
                                onChange={e => setConfig(c => ({ ...c, email: e.target.value }))}
                                style={{
                                    padding: '8px 12px',
                                    background: 'var(--color-bg-secondary)',
                                    border: '1px solid var(--color-border)',
                                    borderRadius: 'var(--radius-md)',
                                    color: 'var(--color-text-primary)',
                                    fontFamily: 'var(--font-sans)',
                                    fontSize: 'var(--text-base)',
                                    outline: 'none',
                                    width: '100%',
                                    maxWidth: 400,
                                    boxSizing: 'border-box',
                                    transition: 'border-color var(--transition-base)',
                                }}
                                onFocus={e => (e.currentTarget.style.borderColor = 'var(--color-primary, #1a7fe8)')}
                                onBlur={e => (e.currentTarget.style.borderColor = 'var(--color-border)')}
                            />
                        </div>

                        {/* Divider */}
                        <div style={{ height: 1, background: 'var(--color-border)' }} />

                        {/* Save row */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                            <Btn
                                variant="primary"
                                onClick={handleSaveConfig}
                                disabled={savingConfig}
                            >
                                {savingConfig ? 'Salvando...' : 'Salvar configuração'}
                            </Btn>
                            {savedFeedback && (
                                <motion.span
                                    initial={{ opacity: 0, x: -4 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0 }}
                                    style={{
                                        fontFamily: 'var(--font-sans)',
                                        fontSize: 'var(--text-sm)',
                                        color: 'var(--color-success, #22c55e)',
                                        letterSpacing: '-0.1px',
                                    }}
                                >
                                    Salvo
                                </motion.span>
                            )}
                        </div>

                        {/* Next report note */}
                        {(savedConfig?.enabled || config.enabled) && (
                            <motion.p
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                style={{
                                    fontFamily: 'var(--font-sans)',
                                    fontSize: 'var(--text-sm)',
                                    color: 'var(--color-text-secondary)',
                                    margin: 0,
                                    marginTop: -8,
                                }}
                            >
                                Proximo relatorio em:{' '}
                                <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-text-primary)' }}>
                                    {nextReportDate(config.frequency)}
                                </span>
                            </motion.p>
                        )}
                    </div>
                </div>
            </motion.div>

            {/* Generate on-demand card */}
            <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, delay: sectionDelay(2), ease: [0.25, 0.1, 0.25, 1] }}
            >
                <SectionLabel gutterBottom={16}>Gerar relatorio agora</SectionLabel>
                <div style={cardStyle}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                        <p style={{
                            fontFamily: 'var(--font-sans)',
                            fontSize: 'var(--text-sm)',
                            color: 'var(--color-text-secondary)',
                            margin: 0,
                        }}>
                            Gere um relatório imediato com os dados do período selecionado. O arquivo será baixado diretamente.
                        </p>

                        {/* Period selector */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                            <span style={{
                                fontFamily: 'var(--font-sans)',
                                fontSize: 'var(--text-xs)',
                                fontWeight: 500,
                                color: 'var(--color-text-secondary)',
                                letterSpacing: '0.04em',
                                textTransform: 'uppercase',
                            }}>
                                Periodo
                            </span>
                            <SegmentedControl
                                options={['semanal', 'mensal', 'trimestral'] as const}
                                value={genFrequency}
                                onChange={setGenFrequency}
                                labels={{ semanal: 'Ultima semana', mensal: 'Ultimo mes', trimestral: 'Ultimo trimestre' }}
                            />
                        </div>

                        {/* Download buttons */}
                        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                            <Btn
                                variant="secondary"
                                onClick={() => handleDownload('csv')}
                                disabled={generating !== null}
                                icon={
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                        <polyline points="7 10 12 15 17 10" />
                                        <line x1="12" y1="15" x2="12" y2="3" />
                                    </svg>
                                }
                            >
                                {generating === 'csv' ? 'Gerando...' : 'Baixar CSV'}
                            </Btn>
                            <Btn
                                variant="secondary"
                                onClick={() => handleDownload('json')}
                                disabled={generating !== null}
                                icon={
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                        <polyline points="7 10 12 15 17 10" />
                                        <line x1="12" y1="15" x2="12" y2="3" />
                                    </svg>
                                }
                            >
                                {generating === 'json' ? 'Gerando...' : 'Baixar JSON'}
                            </Btn>
                            <Btn
                                variant="primary"
                                onClick={() => handleDownload('pdf')}
                                disabled={generating !== null}
                                icon={
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                                        <polyline points="14 2 14 8 20 8" />
                                        <line x1="16" y1="13" x2="8" y2="13" />
                                        <line x1="16" y1="17" x2="8" y2="17" />
                                        <polyline points="10 9 9 9 8 9" />
                                    </svg>
                                }
                            >
                                {generating === 'pdf' ? 'Gerando PDF...' : 'PDF com IA'}
                            </Btn>
                        </div>
                        {generating === 'pdf' && (
                            <motion.p
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                style={{
                                    fontFamily: 'var(--font-sans)',
                                    fontSize: 'var(--text-xs)',
                                    color: 'var(--color-text-secondary)',
                                    margin: 0,
                                    marginTop: -8,
                                }}
                            >
                                Pode levar até 15 segundos — a IA está analisando seus dados...
                            </motion.p>
                        )}
                    </div>
                </div>
            </motion.div>

            {/* History card */}
            <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, delay: sectionDelay(3), ease: [0.25, 0.1, 0.25, 1] }}
                style={{ paddingBottom: 40 }}
            >
                <SectionLabel gutterBottom={16}>Historico de relatórios</SectionLabel>
                <div style={{ ...cardStyle, padding: 0, overflow: 'hidden' }}>
                    {/* Table header */}
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr 120px 80px 100px',
                        gap: 0,
                        padding: '12px 20px',
                        borderBottom: '1px solid var(--color-border)',
                    }}>
                        <TH>Data</TH>
                        <TH>Frequencia</TH>
                        <TH>Formato</TH>
                        <TH align="right">Status</TH>
                    </div>

                    {/* Body */}
                    {loadingLogs ? (
                        <LoadingRow />
                    ) : logs.length === 0 ? (
                        <EmptyState
                            title="Nenhum relatório gerado ainda"
                            description="Gere seu primeiro relatório acima ou configure relatórios automáticos para começar."
                        />
                    ) : (
                        <div>
                            {logs.map(log => {
                                const { label, color } = statusLabel(log.status)
                                return (
                                    <NotionRow key={log.id} style={{ padding: '0 20px' }}>
                                        <div style={{
                                            display: 'grid',
                                            gridTemplateColumns: '1fr 120px 80px 100px',
                                            width: '100%',
                                            alignItems: 'center',
                                        }}>
                                            <span style={{
                                                fontFamily: 'var(--font-mono)',
                                                fontSize: 'var(--text-sm)',
                                                color: 'var(--color-text-primary)',
                                            }}>
                                                {formatDate(log.created_at)}
                                            </span>
                                            <span style={{
                                                fontFamily: 'var(--font-sans)',
                                                fontSize: 'var(--text-sm)',
                                                color: 'var(--color-text-secondary)',
                                            }}>
                                                {frequencyLabel(log.frequency)}
                                            </span>
                                            <span style={{
                                                fontFamily: 'var(--font-mono)',
                                                fontSize: 'var(--text-sm)',
                                                color: 'var(--color-text-secondary)',
                                                textTransform: 'uppercase',
                                            }}>
                                                {log.format}
                                            </span>
                                            <span style={{
                                                fontFamily: 'var(--font-sans)',
                                                fontSize: 'var(--text-sm)',
                                                color,
                                                fontWeight: 500,
                                                textAlign: 'right',
                                            }}>
                                                {label}
                                            </span>
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
