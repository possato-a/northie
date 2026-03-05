import { motion } from 'framer-motion'

// ── Types ─────────────────────────────────────────────────────────────────────

export type Severidade = 'critica' | 'alta' | 'media' | 'ok'
export type Prazo = 'imediato' | 'esta_semana' | 'este_mes'

export interface Diagnostico {
    canal: string
    severidade: Severidade
    sintoma: string
    causa_raiz: string
    consequencia: string
    consequencia_financeira_brl: number
    acao_recomendada: string
    prazo: Prazo
}

// ── Severity config ───────────────────────────────────────────────────────────

const SEV: Record<Severidade, { label: string; color: string; bg: string; border: string }> = {
    critica: { label: 'CRÍTICA',  color: '#EF4444', bg: 'rgba(239,68,68,0.10)',  border: 'rgba(239,68,68,0.25)'  },
    alta:    { label: 'ALTA',     color: '#F59E0B', bg: 'rgba(245,158,11,0.10)', border: 'rgba(245,158,11,0.25)' },
    media:   { label: 'MÉDIA',    color: '#F59E0B', bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.20)' },
    ok:      { label: 'OK',       color: '#22C55E', bg: 'rgba(34,197,94,0.10)',  border: 'rgba(34,197,94,0.25)'  },
}

const PRAZO_LABEL: Record<Prazo, string> = {
    imediato:    'Imediato',
    esta_semana: 'Esta semana',
    este_mes:    'Este mês',
}

const fmtBRL = (n: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n)

// ── Sub-components ────────────────────────────────────────────────────────────

function FieldLabel({ children }: { children: string }) {
    return (
        <span style={{
            display: 'block',
            fontFamily: 'var(--font-sans)',
            fontSize: 10,
            fontWeight: 600,
            color: 'var(--color-text-secondary)',
            textTransform: 'uppercase',
            letterSpacing: '0.07em',
            marginBottom: 5,
        }}>
            {children}
        </span>
    )
}

function FieldValue({ children }: { children: React.ReactNode }) {
    return (
        <span style={{
            display: 'block',
            fontFamily: 'var(--font-sans)',
            fontSize: 13,
            color: 'var(--color-text-primary)',
            lineHeight: 1.5,
        }}>
            {children}
        </span>
    )
}

// ── DiagnosticCard ────────────────────────────────────────────────────────────

interface DiagnosticCardProps {
    diagnostico: Diagnostico
    index?: number
    isLast?: boolean
}

export function DiagnosticCard({ diagnostico: d, index = 0, isLast = false }: DiagnosticCardProps) {
    const sev = SEV[d.severidade]

    return (
        <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: index * 0.06, ease: [0.25, 0.1, 0.25, 1] }}
            style={{
                padding: '20px 0',
                borderBottom: isLast ? 'none' : '1px solid var(--color-border)',
                overflow: 'hidden',
                position: 'relative',
            }}
        >
            {/* ── Header: título + badge ─────────────────────────────────── */}
            <div style={{
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
                gap: 12,
                marginBottom: 16,
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    {/* Accent bar */}
                    <div style={{
                        width: 3,
                        height: 18,
                        borderRadius: 2,
                        background: sev.color,
                        flexShrink: 0,
                    }} />
                    <span style={{
                        fontFamily: 'var(--font-sans)',
                        fontSize: 14,
                        fontWeight: 600,
                        color: 'var(--color-text-primary)',
                        letterSpacing: '0.01em',
                    }}>
                        {d.canal}
                    </span>
                </div>

                {/* Badge — fixo no canto direito, sem sobrepor texto */}
                <span style={{
                    flexShrink: 0,
                    display: 'inline-flex',
                    alignItems: 'center',
                    padding: '3px 10px',
                    borderRadius: 6,
                    background: sev.bg,
                    border: `1px solid ${sev.border}`,
                    fontFamily: 'var(--font-sans)',
                    fontSize: 11,
                    fontWeight: 700,
                    color: sev.color,
                    letterSpacing: '0.06em',
                    whiteSpace: 'nowrap',
                }}>
                    {sev.label}
                </span>
            </div>

            {/* ── SINTOMA — largura total ────────────────────────────────── */}
            <div style={{ marginBottom: 16 }}>
                <FieldLabel>Sintoma</FieldLabel>
                <FieldValue>{d.sintoma}</FieldValue>
            </div>

            {/* ── CAUSA RAIZ + CONSEQUÊNCIA — 50/50 ─────────────────────── */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 24,
                alignItems: 'start',
                marginBottom: 16,
            }}>
                <div style={{ overflow: 'hidden', wordBreak: 'break-word', minWidth: 0 }}>
                    <FieldLabel>Causa Raiz</FieldLabel>
                    <FieldValue>{d.causa_raiz}</FieldValue>
                </div>
                <div style={{ overflow: 'hidden', wordBreak: 'break-word', minWidth: 0 }}>
                    <FieldLabel>Consequência</FieldLabel>
                    <FieldValue>{d.consequencia}</FieldValue>
                </div>
            </div>

            {/* ── Rodapé: impacto + ação + prazo ────────────────────────── */}
            <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 20,
                flexWrap: 'wrap',
                paddingTop: 12,
                borderTop: '1px solid var(--color-border)',
            }}>
                <span style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 13,
                    fontWeight: 600,
                    color: sev.color,
                }}>
                    {fmtBRL(d.consequencia_financeira_brl)}
                </span>

                <span style={{
                    fontFamily: 'var(--font-sans)',
                    fontSize: 12,
                    color: 'var(--color-text-secondary)',
                    flex: 1,
                    minWidth: 0,
                }}>
                    {d.acao_recomendada}
                </span>

                <span style={{
                    flexShrink: 0,
                    fontFamily: 'var(--font-sans)',
                    fontSize: 11,
                    fontWeight: 500,
                    color: 'var(--color-text-secondary)',
                    padding: '2px 8px',
                    borderRadius: 4,
                    border: '1px solid var(--color-border)',
                }}>
                    {PRAZO_LABEL[d.prazo]}
                </span>
            </div>
        </motion.div>
    )
}

// ── DiagnosticList ────────────────────────────────────────────────────────────

interface DiagnosticListProps {
    diagnosticos: Diagnostico[]
}

export function DiagnosticList({ diagnosticos }: DiagnosticListProps) {
    const ORDER: Record<Severidade, number> = { critica: 0, alta: 1, media: 2, ok: 3 }
    const sorted = [...diagnosticos].sort((a, b) => ORDER[a.severidade] - ORDER[b.severidade])

    if (sorted.length === 0) return null

    return (
        <div>
            {sorted.map((d, i) => (
                <DiagnosticCard
                    key={`${d.canal}-${d.severidade}`}
                    diagnostico={d}
                    index={i}
                    isLast={i === sorted.length - 1}
                />
            ))}
        </div>
    )
}
