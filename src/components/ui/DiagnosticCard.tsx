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
    critica: { label: 'CRÍTICA', color: 'var(--accent-red)',    bg: 'var(--priority-high-bg)',    border: 'var(--priority-high-bg)'    },
    alta:    { label: 'ALTA',    color: 'var(--accent-orange)', bg: 'var(--priority-medium-bg)',   border: 'var(--priority-medium-bg)'   },
    media:   { label: 'MÉDIA',   color: 'var(--accent-orange)', bg: 'var(--priority-medium-bg)',   border: 'var(--priority-medium-bg)'   },
    ok:      { label: 'OK',      color: 'var(--accent-green)',  bg: 'var(--status-complete-bg)',  border: 'var(--status-complete-bg)'  },
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
        <div style={{
            fontFamily: 'var(--font-sans)',
            fontSize: 10,
            fontWeight: 600,
            color: 'var(--color-text-secondary)',
            textTransform: 'uppercase',
            letterSpacing: '0.07em',
            marginBottom: 5,
        }}>
            {children}
        </div>
    )
}

function FieldValue({ children }: { children: React.ReactNode }) {
    return (
        <div style={{
            fontFamily: 'var(--font-sans)',
            fontSize: 13,
            color: 'var(--color-text-primary)',
            lineHeight: 1.5,
            wordBreak: 'break-word',
            overflowWrap: 'break-word',
        }}>
            {children}
        </div>
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
                // Containment obrigatório — isola o card completamente
                position: 'relative',
                overflow: 'hidden',
                isolation: 'isolate',
                width: '100%',
                boxSizing: 'border-box',

                padding: '20px 0',
                borderBottom: isLast ? 'none' : '1px solid var(--color-border)',
            }}
        >
            {/* ── Header: título (flex) + badge ────────────────────────────── */}
            <div style={{
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
                gap: 12,
                marginBottom: 16,
                width: '100%',
                minWidth: 0,
            }}>
                {/* Título com accent bar */}
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    minWidth: 0,
                    flex: 1,
                    overflow: 'hidden',
                }}>
                    <div style={{
                        width: 3,
                        height: 18,
                        borderRadius: 2,
                        background: sev.color,
                        flexShrink: 0,
                    }} />
                    <div style={{
                        fontFamily: 'var(--font-sans)',
                        fontSize: 14,
                        fontWeight: 600,
                        color: 'var(--color-text-primary)',
                        letterSpacing: '0.01em',
                        overflow: 'hidden',
                        whiteSpace: 'nowrap',
                        textOverflow: 'ellipsis',
                        minWidth: 0,
                    }}>
                        {d.canal}
                    </div>
                </div>

                {/* Badge — flexShrink 0 garante que não encolhe nem vaza */}
                <div style={{
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
                </div>
            </div>

            {/* ── SINTOMA — largura total ───────────────────────────────────── */}
            <div style={{
                width: '100%',
                boxSizing: 'border-box',
                marginBottom: 16,
                overflow: 'hidden',
            }}>
                <FieldLabel>Sintoma</FieldLabel>
                <FieldValue>{d.sintoma}</FieldValue>
            </div>

            {/* ── CAUSA RAIZ / CONSEQUÊNCIA — grid 50/50, FORA do sintoma ──── */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 24,
                alignItems: 'start',
                width: '100%',
                marginBottom: 16,
                // Sem overflow: hidden aqui — cada célula cuida do próprio
            }}>
                {/* Célula esquerda */}
                <div style={{
                    minWidth: 0,
                    overflow: 'hidden',
                    wordBreak: 'break-word',
                    overflowWrap: 'break-word',
                }}>
                    <FieldLabel>Causa Raiz</FieldLabel>
                    <FieldValue>{d.causa_raiz}</FieldValue>
                </div>

                {/* Célula direita */}
                <div style={{
                    minWidth: 0,
                    overflow: 'hidden',
                    wordBreak: 'break-word',
                    overflowWrap: 'break-word',
                }}>
                    <FieldLabel>Consequência</FieldLabel>
                    <FieldValue>{d.consequencia}</FieldValue>
                </div>
            </div>

            {/* ── RECOMENDAÇÃO — 100% largura, FORA do grid ────────────────── */}
            <div style={{
                width: '100%',
                boxSizing: 'border-box',
                background: 'var(--color-bg-secondary)',
                borderLeft: `3px solid ${sev.color}`,
                borderRadius: '0 4px 4px 0',
                padding: 12,
                marginBottom: 12,
                overflow: 'hidden',
                wordBreak: 'break-word',
                overflowWrap: 'break-word',
            }}>
                <FieldLabel>Recomendação</FieldLabel>
                <FieldValue>{d.acao_recomendada}</FieldValue>
            </div>

            {/* ── Rodapé: impacto financeiro + prazo ───────────────────────── */}
            <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                paddingTop: 8,
                borderTop: '1px solid var(--color-border)',
                width: '100%',
                minWidth: 0,
            }}>
                <div style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 13,
                    fontWeight: 600,
                    color: sev.color,
                    flex: 1,
                    minWidth: 0,
                    overflow: 'hidden',
                }}>
                    {fmtBRL(d.consequencia_financeira_brl)}
                </div>

                <div style={{
                    flexShrink: 0,
                    fontFamily: 'var(--font-sans)',
                    fontSize: 11,
                    fontWeight: 500,
                    color: 'var(--color-text-secondary)',
                    padding: '2px 8px',
                    borderRadius: 4,
                    border: '1px solid var(--color-border)',
                    whiteSpace: 'nowrap',
                }}>
                    {PRAZO_LABEL[d.prazo]}
                </div>
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
        <div style={{
            width: '100%',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
        }}>
            {sorted.map((d, i) => (
                <DiagnosticCard
                    key={`${d.canal}-${d.severidade}-${i}`}
                    diagnostico={d}
                    index={i}
                    isLast={i === sorted.length - 1}
                />
            ))}
        </div>
    )
}
