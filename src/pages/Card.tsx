import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import TopBar from '../components/layout/TopBar'
import { cardApi } from '../lib/api'

interface PageProps {
  onToggleChat: () => void
}

// ── Types ────────────────────────────────────────────────────────────────────

interface ScoreDimensions {
  revenue_consistency: number
  customer_quality: number
  acquisition_efficiency: number
  platform_tenure: number
}

interface CapitalScore {
  score: number
  dimensions: ScoreDimensions
  credit_limit_brl: number
  snapshot_month: string
  metrics: {
    mrr_avg: number
    ltv_avg: number
    churn_rate: number
    ltv_cac_ratio: number
    months_on_platform: number
  }
}

interface CardApplication {
  id: string
  status: 'waitlist' | 'pending_review' | 'approved' | 'rejected'
  requested_limit_brl: number
  approved_limit_brl: number | null
  used_limit_brl: number | null
  split_rate: number | null
  created_at: string
  updated_at: string
}

// ── Dados ─────────────────────────────────────────────────────────────────────

const PURPOSES = [
  'Marketing e tráfego pago',
  'Contratar equipe',
  'Desenvolver produto',
  'Comprar estoque',
  'Capital de giro',
  'Outro',
]

const TERM_OPTIONS = [
  { value: 6,  label: '6 meses' },
  { value: 12, label: '12 meses' },
  { value: 18, label: '18 meses' },
  { value: 24, label: '24 meses' },
]

const BENEFICIOS = [
  { label: 'Sem garantia física', desc: 'Nenhum ativo imobilizado como garantia.' },
  { label: 'Limite real',         desc: 'Calculado pelo seu LTV, faturamento e saúde do caixa.' },
  { label: 'Split na fonte',      desc: 'Pagamento como percentual da receita diária.' },
  { label: 'Decisão em 48h',      desc: 'Análise rápida baseada nos seus dados integrados.' },
]

const STATUS_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  waitlist:       { label: 'Lista de espera', color: 'var(--color-text-secondary)', bg: 'var(--color-bg-secondary)' },
  pending_review: { label: 'Em análise',      color: 'var(--accent-orange, #b8860b)', bg: 'var(--priority-medium-bg, rgba(184,134,11,0.1))' },
  approved:       { label: 'Aprovado',         color: 'var(--color-success, #22c55e)', bg: 'rgba(34,197,94,0.1)' },
  rejected:       { label: 'Não aprovado',     color: 'var(--color-error, #ef4444)',   bg: 'rgba(239,68,68,0.1)' },
}

const fmt = {
  currency: (v: number) =>
    v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0, maximumFractionDigits: 0 }),
  decimal: (v: number) =>
    v.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }),
  percent: (v: number) =>
    v.toLocaleString('pt-BR', { style: 'percent', minimumFractionDigits: 1, maximumFractionDigits: 1 }),
}

// ── Sub-components ───────────────────────────────────────────────────────────

function OptionRow({ label, selected, onSelect, multi = false }: {
  label: string
  selected: boolean
  onSelect: () => void
  multi?: boolean
}) {
  return (
    <motion.button
      onClick={onSelect}
      whileTap={{ scale: 0.99 }}
      style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '10px 14px', width: '100%', textAlign: 'left',
        background: selected ? 'var(--color-bg-secondary)' : 'transparent',
        border: `1px solid ${selected ? 'var(--color-text-tertiary)' : 'var(--color-border)'}`,
        borderRadius: 10, cursor: 'pointer',
        transition: 'all 0.15s ease',
      }}
    >
      <div style={{
        width: 15, height: 15, flexShrink: 0,
        borderRadius: multi ? 4 : '50%',
        border: `1.5px solid ${selected ? 'var(--color-text-primary)' : 'var(--color-border)'}`,
        background: selected ? 'var(--color-text-primary)' : 'transparent',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        transition: 'all 0.15s ease',
      }}>
        {selected && (
          <svg width="8" height="8" viewBox="0 0 10 10" fill="none">
            <path d="M2 5L4.5 7.5L8 2.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        )}
      </div>
      <span style={{
        fontFamily: 'var(--font-sans)', fontSize: 12,
        color: selected ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
        fontWeight: selected ? 500 : 400, transition: 'color 0.15s ease',
      }}>
        {label}
      </span>
    </motion.button>
  )
}

function StatusBadge({ status }: { status: string }) {
  const config = STATUS_LABELS[status] ?? STATUS_LABELS.waitlist
  return (
    <span style={{
      fontFamily: 'var(--font-sans)', fontSize: 11, fontWeight: 500,
      color: config.color, background: config.bg,
      padding: '3px 10px', borderRadius: 'var(--radius-full, 999px)',
      display: 'inline-flex', alignItems: 'center',
    }}>
      {config.label}
    </span>
  )
}

function MetricBlock({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p style={{
        fontFamily: 'var(--font-sans)', fontSize: 10, color: 'var(--color-text-tertiary)',
        margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: '0.04em',
      }}>
        {label}
      </p>
      <p style={{
        fontFamily: 'var(--font-mono, var(--font-sans))', fontSize: 18, fontWeight: 600,
        color: 'var(--color-text-primary)', margin: 0, letterSpacing: '-0.3px',
      }}>
        {value}
      </p>
    </div>
  )
}

// ── Checkmark icon for benefits list ─────────────────────────────────────────

function CheckIcon() {
  return (
    <div style={{
      width: 20, height: 20, borderRadius: '50%', flexShrink: 0, marginTop: 1,
      border: '1px solid var(--color-border)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
        <path
          d="M2 5L4.5 7.5L8 2.5"
          stroke="var(--color-text-primary)"
          strokeWidth="1.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  )
}

// ── Shared card style ─────────────────────────────────────────────────────────

const cardStyle: React.CSSProperties = {
  background: 'var(--color-bg-primary)',
  border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius-lg)',
  boxShadow: 'var(--shadow-md)',
  padding: '32px 28px',
}

const sectionLabelStyle: React.CSSProperties = {
  fontFamily: 'var(--font-sans)',
  fontSize: 11,
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  color: 'var(--color-text-secondary)',
  display: 'block',
  marginBottom: 10,
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function Card({ onToggleChat }: PageProps) {
  const [loading, setLoading]       = useState(true)
  const [score, setScore]           = useState<CapitalScore | null>(null)
  const [application, setApplication] = useState<CardApplication | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  // Form state
  const [requestedLimit, setRequestedLimit] = useState('')
  const [purposes, setPurposes]             = useState<string[]>([])
  const [termMonths, setTermMonths]         = useState(12)

  const togglePurpose = (p: string) =>
    setPurposes(prev => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p])

  const canSubmit  = !!requestedLimit && Number(requestedLimit) > 0
  const isEligible = score !== null && score.score >= 70

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [scoreRes, appRes] = await Promise.all([
        cardApi.getScore().catch(() => ({ data: null })),
        cardApi.getApplication().catch(() => ({ data: null })),
      ])
      setScore(scoreRes.data as CapitalScore | null)
      setApplication(appRes.data as CardApplication | null)
    } catch {
      // Individual catches already handled above
    }
    setLoading(false)
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const handleSubmit = async () => {
    if (!canSubmit) return
    setSubmitting(true)
    setSubmitError(null)
    try {
      const res = await cardApi.request({
        requested_limit_brl: Number(requestedLimit),
        purposes: purposes.length > 0 ? purposes : undefined,
        term_months: termMonths,
      })
      setApplication(res.data as CardApplication)
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'response' in err) {
        const axiosErr = err as { response?: { status?: number; data?: { error?: string } } }
        if (axiosErr.response?.status === 403) {
          setSubmitError('Capital Score insuficiente. Mínimo de 70 pontos necessário para solicitar o Northie Card.')
        } else {
          setSubmitError(axiosErr.response?.data?.error ?? 'Erro ao enviar solicitação. Tente novamente.')
        }
      } else {
        setSubmitError('Erro ao enviar solicitação. Tente novamente.')
      }
    }
    setSubmitting(false)
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', boxSizing: 'border-box',
    background: 'var(--color-bg-secondary)',
    border: '1px solid var(--color-border)',
    borderRadius: 10, padding: '11px 14px',
    fontFamily: 'var(--font-sans)', fontSize: 13, lineHeight: 1.6,
    color: 'var(--color-text-primary)', outline: 'none',
  }

  // ── Loading ──────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div>
        <TopBar onToggleChat={onToggleChat} />
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            justifyContent: 'center', paddingTop: 120, gap: 16,
          }}
        >
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1.2, repeat: Infinity, ease: 'linear' }}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="9" stroke="var(--color-border)" strokeWidth="2" />
              <path d="M12 3a9 9 0 0 1 9 9" stroke="var(--color-text-primary)" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </motion.div>
          <p style={{ fontFamily: 'var(--font-sans)', fontSize: 13, color: 'var(--color-text-tertiary)' }}>
            Carregando Capital Score...
          </p>
        </motion.div>
      </div>
    )
  }

  // ── Already applied ──────────────────────────────────────────────────────────
  if (application) {
    return (
      <div>
        <TopBar onToggleChat={onToggleChat} />
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.25, 0.1, 0.25, 1] }}
          style={{ maxWidth: 640, margin: '0 auto' }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={cardStyle}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
                <div>
                  <span style={{
                    fontFamily: 'var(--font-sans)', fontSize: 10, fontWeight: 400,
                    color: 'var(--color-text-tertiary)', letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                  }}>
                    Solicitação
                  </span>
                  <h3 style={{
                    fontFamily: 'var(--font-sans)', fontSize: 20, fontWeight: 500,
                    letterSpacing: '-0.35px', color: 'var(--color-text-primary)',
                    margin: '6px 0 0',
                  }}>
                    Status do Northie Card
                  </h3>
                </div>
                <StatusBadge status={application.status} />
              </div>

              <div style={{ height: 1, background: 'var(--color-border)', marginBottom: 20 }} />

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <MetricBlock
                  label="Limite solicitado"
                  value={fmt.currency(application.requested_limit_brl)}
                />
                {application.approved_limit_brl !== null && (
                  <MetricBlock
                    label="Limite aprovado"
                    value={fmt.currency(application.approved_limit_brl)}
                  />
                )}
                {application.used_limit_brl !== null && (
                  <MetricBlock
                    label="Limite utilizado"
                    value={fmt.currency(application.used_limit_brl)}
                  />
                )}
                {application.split_rate !== null && (
                  <MetricBlock
                    label="Split rate"
                    value={fmt.percent(application.split_rate)}
                  />
                )}
              </div>

              <div style={{ height: 1, background: 'var(--color-border)', margin: '20px 0' }} />

              <div style={{ display: 'flex', gap: 8 }}>
                <span style={{ fontFamily: 'var(--font-sans)', fontSize: 11, color: 'var(--color-text-tertiary)' }}>
                  Solicitado em {new Date(application.created_at).toLocaleDateString('pt-BR')}
                </span>
                {application.updated_at !== application.created_at && (
                  <span style={{ fontFamily: 'var(--font-sans)', fontSize: 11, color: 'var(--color-text-tertiary)' }}>
                    &middot; Atualizado em {new Date(application.updated_at).toLocaleDateString('pt-BR')}
                  </span>
                )}
              </div>
            </div>

            {application.status === 'rejected' && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                style={cardStyle}
              >
                <p style={{
                  fontFamily: 'var(--font-sans)', fontSize: 13, color: 'var(--color-text-secondary)',
                  margin: 0, lineHeight: 1.65,
                }}>
                  Sua solicitação não foi aprovada neste momento. Continue integrando seus dados e melhorando seu Capital Score para futuras análises.
                </p>
              </motion.div>
            )}
          </div>
        </motion.div>
      </div>
    )
  }

  // ── Form (no application yet) ────────────────────────────────────────────────
  return (
    <div>
      <TopBar onToggleChat={onToggleChat} />

      <motion.div
        key="form"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.25, 0.1, 0.25, 1] }}
        style={{ maxWidth: 1100, margin: '0 auto' }}
      >
        <div style={{
          display: 'grid',
          gridTemplateColumns: '5fr 7fr',
          gap: 24,
          alignItems: 'start',
        }}>

          {/* ── Left column — info & benefits ──────────────────────────────── */}
          <motion.div
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.45, ease: [0.25, 0.1, 0.25, 1] }}
            style={cardStyle}
          >
            <span style={{
              fontFamily: 'var(--font-sans)', fontSize: 10, fontWeight: 400,
              color: 'var(--color-text-tertiary)', letterSpacing: '0.08em',
              textTransform: 'uppercase',
            }}>
              Northie Card
            </span>

            <h2 style={{
              fontFamily: 'var(--font-sans)', fontSize: 28, fontWeight: 600,
              letterSpacing: '-0.6px', color: 'var(--color-text-primary)',
              lineHeight: 1.2, margin: '12px 0 16px',
            }}>
              Capital que cresce com o seu negócio.
            </h2>

            <p style={{
              fontFamily: 'var(--font-sans)', fontSize: 13, color: 'var(--color-text-secondary)',
              lineHeight: 1.65, margin: '0 0 24px',
            }}>
              Sem garantia física, sem equity, sem burocracia. O limite é calculado diretamente pelos seus dados de faturamento, LTV e saúde do caixa — não por quem você conhece.
            </p>

            <div style={{ height: 1, background: 'var(--color-border)', marginBottom: 24 }} />

            <span style={{
              fontFamily: 'var(--font-sans)', fontSize: 10, fontWeight: 400,
              color: 'var(--color-text-tertiary)', letterSpacing: '0.08em',
              textTransform: 'uppercase', display: 'block', marginBottom: 16,
            }}>
              Benefícios
            </span>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {BENEFICIOS.map((b, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.35, delay: 0.15 + i * 0.07, ease: [0.25, 0.1, 0.25, 1] }}
                  style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}
                >
                  <CheckIcon />
                  <div>
                    <p style={{
                      fontFamily: 'var(--font-sans)', fontSize: 13, fontWeight: 500,
                      color: 'var(--color-text-primary)', margin: '0 0 2px',
                    }}>
                      {b.label}
                    </p>
                    <p style={{
                      fontFamily: 'var(--font-sans)', fontSize: 12,
                      color: 'var(--color-text-tertiary)', margin: 0, lineHeight: 1.5,
                    }}>
                      {b.desc}
                    </p>
                  </div>
                </motion.div>
              ))}
            </div>

            <p style={{
              fontFamily: 'var(--font-sans)', fontSize: 11, color: 'var(--color-text-tertiary)',
              margin: '28px 0 0', lineHeight: 1.55,
            }}>
              Opera via parceiro financeiro regulado. Limite calculado com base nos seus dados reais — não em score de crédito tradicional.
            </p>
          </motion.div>

          {/* ── Right column — form ────────────────────────────────────────── */}
          <motion.div
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.45, delay: 0.05, ease: [0.25, 0.1, 0.25, 1] }}
            style={cardStyle}
          >
            {/* Section 1 — Limite desejado */}
            <div style={{ marginBottom: 24 }}>
              <label style={sectionLabelStyle}>Limite desejado (R$)</label>
              <input
                type="number"
                min="1000"
                step="1000"
                value={requestedLimit}
                onChange={e => setRequestedLimit(e.target.value)}
                placeholder="Ex: 50000"
                style={inputStyle}
                onFocus={e => { e.currentTarget.style.borderColor = 'var(--color-text-tertiary)' }}
                onBlur={e => { e.currentTarget.style.borderColor = 'var(--color-border)' }}
              />
              {score && score.credit_limit_brl > 0 && (
                <p style={{
                  fontFamily: 'var(--font-sans)', fontSize: 11,
                  color: 'var(--color-text-tertiary)', margin: '7px 0 0',
                }}>
                  Sugerido pelo seu Capital Score: {fmt.currency(score.credit_limit_brl)}
                </p>
              )}
            </div>

            {/* Section 2 — Prazo */}
            <div style={{ marginBottom: 24 }}>
              <label style={sectionLabelStyle}>Prazo</label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                {TERM_OPTIONS.map(opt => (
                  <OptionRow
                    key={opt.value}
                    label={opt.label}
                    selected={termMonths === opt.value}
                    onSelect={() => setTermMonths(opt.value)}
                  />
                ))}
              </div>
            </div>

            {/* Section 3 — Propósito */}
            <div style={{ marginBottom: 28 }}>
              <label style={sectionLabelStyle}>Para o que usaria o capital? (opcional)</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {PURPOSES.map(p => (
                  <OptionRow
                    key={p}
                    label={p}
                    selected={purposes.includes(p)}
                    onSelect={() => togglePurpose(p)}
                    multi
                  />
                ))}
              </div>
            </div>

            {/* Error */}
            <AnimatePresence>
              {submitError && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  style={{ overflow: 'hidden', marginBottom: 16 }}
                >
                  <p style={{
                    fontFamily: 'var(--font-sans)', fontSize: 12,
                    color: 'var(--color-error, #ef4444)',
                    background: 'color-mix(in srgb, var(--color-error, #ef4444) 6%, transparent)',
                    border: '1px solid color-mix(in srgb, var(--color-error, #ef4444) 20%, transparent)',
                    borderRadius: 8, padding: '10px 14px',
                    margin: 0, lineHeight: 1.5,
                  }}>
                    {submitError}
                  </p>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Submit */}
            <motion.button
              onClick={handleSubmit}
              disabled={!canSubmit || submitting}
              whileHover={canSubmit && !submitting ? { scale: 1.01 } : {}}
              whileTap={canSubmit && !submitting ? { scale: 0.97 } : {}}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                padding: '12px 0', width: '100%',
                background: canSubmit ? 'var(--color-text-primary)' : 'var(--color-border)',
                color: canSubmit ? 'var(--color-bg-primary)' : 'var(--color-text-tertiary)',
                border: 'none', borderRadius: 10,
                fontFamily: 'var(--font-sans)', fontSize: 13, fontWeight: 500,
                cursor: canSubmit && !submitting ? 'pointer' : 'default',
                transition: 'background 0.15s ease',
              }}
            >
              {submitting ? (
                <>
                  <motion.span
                    animate={{ rotate: 360 }}
                    transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
                    style={{ display: 'flex' }}
                  >
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                      <circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.5" strokeDasharray="8 20" strokeLinecap="round"/>
                    </svg>
                  </motion.span>
                  Enviando...
                </>
              ) : isEligible ? (
                'Solicitar Northie Card'
              ) : (
                'Registrar interesse'
              )}
            </motion.button>
          </motion.div>

        </div>
      </motion.div>
    </div>
  )
}
