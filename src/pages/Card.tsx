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
  { value: 6, label: '6 meses' },
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
  pending_review: { label: 'Em análise',      color: '#b8860b',                     bg: 'rgba(184,134,11,0.1)' },
  approved:       { label: 'Aprovado',         color: 'var(--color-success, #22c55e)', bg: 'rgba(34,197,94,0.1)' },
  rejected:       { label: 'Não aprovado',     color: 'var(--color-error, #ef4444)',   bg: 'rgba(239,68,68,0.1)' },
}

const fmt = {
  currency: (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0, maximumFractionDigits: 0 }),
  decimal: (v: number) => v.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }),
  percent: (v: number) => v.toLocaleString('pt-BR', { style: 'percent', minimumFractionDigits: 1, maximumFractionDigits: 1 }),
}

// ── Sub-components ───────────────────────────────────────────────────────────

function OptionRow({ label, selected, onSelect, multi = false }: {
  label: string; selected: boolean; onSelect: () => void; multi?: boolean
}) {
  return (
    <motion.button
      onClick={onSelect}
      whileTap={{ scale: 0.99 }}
      style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '11px 16px', width: '100%', textAlign: 'left',
        background: selected ? 'var(--color-bg-secondary)' : 'transparent',
        border: `1px solid ${selected ? 'var(--color-text-tertiary)' : 'var(--color-border)'}`,
        borderRadius: 10, cursor: 'pointer',
        transition: 'all 0.15s ease',
      }}
    >
      <div style={{
        width: 16, height: 16, flexShrink: 0,
        borderRadius: multi ? 4 : '50%',
        border: `1.5px solid ${selected ? 'var(--color-text-primary)' : 'var(--color-border)'}`,
        background: selected ? 'var(--color-text-primary)' : 'transparent',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        transition: 'all 0.15s ease',
      }}>
        {selected && (
          <svg width="9" height="9" viewBox="0 0 10 10" fill="none">
            <path d="M2 5L4.5 7.5L8 2.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        )}
      </div>
      <span style={{
        fontFamily: 'var(--font-sans)', fontSize: 13,
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

function ScoreBanner({ score }: { score: CapitalScore }) {
  const isEligible = score.score >= 70
  const pointsNeeded = 70 - score.score

  const bannerBg = isEligible
    ? 'rgba(34,197,94,0.06)'
    : score.score >= 50
      ? 'rgba(234,179,8,0.06)'
      : 'rgba(239,68,68,0.06)'

  const bannerBorder = isEligible
    ? 'rgba(34,197,94,0.18)'
    : score.score >= 50
      ? 'rgba(234,179,8,0.18)'
      : 'rgba(239,68,68,0.18)'

  const scoreColor = isEligible
    ? 'var(--color-success, #22c55e)'
    : score.score >= 50
      ? '#eab308'
      : 'var(--color-error, #ef4444)'

  return (
    <motion.div
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.25, 0.1, 0.25, 1] }}
      style={{
        background: bannerBg,
        border: `1px solid ${bannerBorder}`,
        borderRadius: 'var(--radius-lg)',
        padding: '20px 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 24,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
        <span style={{
          fontFamily: 'var(--font-mono, var(--font-sans))',
          fontSize: 40,
          fontWeight: 700,
          color: scoreColor,
          lineHeight: 1,
          letterSpacing: '-1px',
        }}>
          {score.score}
        </span>
        <span style={{
          fontFamily: 'var(--font-sans)',
          fontSize: 14,
          color: 'var(--color-text-tertiary)',
        }}>
          / 100 — Capital Score
        </span>
      </div>

      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        {isEligible ? (
          <>
            <p style={{
              fontFamily: 'var(--font-sans)', fontSize: 13, fontWeight: 500,
              color: 'var(--color-success, #22c55e)', margin: '0 0 2px',
            }}>
              Elegivel para solicitar
            </p>
            {score.credit_limit_brl > 0 && (
              <p style={{
                fontFamily: 'var(--font-mono, var(--font-sans))', fontSize: 16, fontWeight: 600,
                color: 'var(--color-text-primary)', margin: 0, letterSpacing: '-0.3px',
              }}>
                Limite estimado: {fmt.currency(score.credit_limit_brl)}
              </p>
            )}
          </>
        ) : (
          <>
            <p style={{
              fontFamily: 'var(--font-sans)', fontSize: 13, fontWeight: 500,
              color: 'var(--color-text-primary)', margin: '0 0 2px',
            }}>
              Capital Score abaixo do minimo
            </p>
            <p style={{
              fontFamily: 'var(--font-sans)', fontSize: 12,
              color: 'var(--color-text-tertiary)', margin: 0,
            }}>
              Faltam {pointsNeeded} pontos para elegibilidade
            </p>
          </>
        )}
      </div>
    </motion.div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function Card({ onToggleChat }: PageProps) {
  const [loading, setLoading] = useState(true)
  const [score, setScore] = useState<CapitalScore | null>(null)
  const [application, setApplication] = useState<CardApplication | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  // Form state
  const [requestedLimit, setRequestedLimit] = useState('')
  const [purposes, setPurposes] = useState<string[]>([])
  const [termMonths, setTermMonths] = useState(12)

  const togglePurpose = (p: string) =>
    setPurposes(prev => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p])

  const canSubmit = !!requestedLimit && Number(requestedLimit) > 0

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

  useEffect(() => {
    fetchData()
  }, [fetchData])

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
          setSubmitError('Capital Score insuficiente. Minimo de 70 pontos necessario para solicitar o Northie Card.')
        } else {
          setSubmitError(axiosErr.response?.data?.error ?? 'Erro ao enviar solicitacao. Tente novamente.')
        }
      } else {
        setSubmitError('Erro ao enviar solicitacao. Tente novamente.')
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

  const pageWrapper: React.CSSProperties = {
    maxWidth: 640,
    margin: '0 auto',
  }

  // ── Loading ──
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

  // ── Already applied ──
  if (application) {
    return (
      <div>
        <TopBar onToggleChat={onToggleChat} />
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.25, 0.1, 0.25, 1] }}
          style={pageWrapper}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {score && <ScoreBanner score={score} />}

            <div style={{
              background: 'var(--color-bg-primary)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-lg)',
              boxShadow: 'var(--shadow-md)',
              padding: '28px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
                <div>
                  <span style={{
                    fontFamily: 'var(--font-sans)', fontSize: 10, fontWeight: 400,
                    color: 'var(--color-text-tertiary)', letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                  }}>
                    Solicitacao
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
                <span style={{
                  fontFamily: 'var(--font-sans)', fontSize: 11, color: 'var(--color-text-tertiary)',
                }}>
                  Solicitado em {new Date(application.created_at).toLocaleDateString('pt-BR')}
                </span>
                {application.updated_at !== application.created_at && (
                  <span style={{
                    fontFamily: 'var(--font-sans)', fontSize: 11, color: 'var(--color-text-tertiary)',
                  }}>
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
                style={{
                  background: 'var(--color-bg-primary)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-lg)',
                  padding: '16px 20px',
                }}
              >
                <p style={{
                  fontFamily: 'var(--font-sans)', fontSize: 13, color: 'var(--color-text-secondary)',
                  margin: 0, lineHeight: 1.65,
                }}>
                  Sua solicitacao nao foi aprovada neste momento. Continue integrando seus dados e melhorando seu Capital Score para futuras analises.
                </p>
              </motion.div>
            )}
          </div>
        </motion.div>
      </div>
    )
  }

  // ── Form (no application yet) ──
  return (
    <div>
      <TopBar onToggleChat={onToggleChat} />

      <motion.div
        key="form"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        style={pageWrapper}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* Score banner */}
          {score && <ScoreBanner score={score} />}

          {/* Hero card */}
          <HeroCard />

          {/* Form card */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: [0.25, 0.1, 0.25, 1] }}
            style={{
              background: 'var(--color-bg-primary)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-lg)',
              boxShadow: 'var(--shadow-md)',
              overflow: 'hidden',
            }}
          >
            <div style={{ padding: '28px 28px 20px' }}>
              <span style={{
                fontFamily: 'var(--font-sans)', fontSize: 10, fontWeight: 400,
                color: 'var(--color-text-tertiary)', letterSpacing: '0.06em',
                textTransform: 'uppercase',
              }}>
                Solicitar capital
              </span>
              <h3 style={{
                fontFamily: 'var(--font-sans)', fontSize: 20, fontWeight: 500,
                letterSpacing: '-0.35px', color: 'var(--color-text-primary)',
                margin: '8px 0 4px',
              }}>
                {isEligible ? 'Solicitar Northie Card' : 'Entrar na lista de espera'}
              </h3>
              <p style={{
                fontFamily: 'var(--font-sans)', fontSize: 13,
                color: 'var(--color-text-tertiary)', margin: 0,
              }}>
                {isEligible
                  ? 'Preencha os dados abaixo para solicitar seu cartao corporativo.'
                  : 'Registre seu interesse e avisaremos quando estiver elegivel.'
                }
              </p>
            </div>

            <div style={{ padding: '0 28px 4px', display: 'flex', flexDirection: 'column', gap: 20 }}>
              {/* Requested limit */}
              <div>
                <label style={{
                  fontFamily: 'var(--font-sans)', fontSize: 11,
                  color: 'var(--color-text-secondary)', letterSpacing: '0.02em',
                  textTransform: 'uppercase', display: 'block', marginBottom: 8,
                }}>
                  Limite desejado (R$)
                </label>
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
                    fontFamily: 'var(--font-sans)', fontSize: 11, color: 'var(--color-text-tertiary)',
                    margin: '6px 0 0',
                  }}>
                    Limite sugerido pelo seu Capital Score: {fmt.currency(score.credit_limit_brl)}
                  </p>
                )}
              </div>

              {/* Term months */}
              <div>
                <label style={{
                  fontFamily: 'var(--font-sans)', fontSize: 11,
                  color: 'var(--color-text-secondary)', letterSpacing: '0.02em',
                  textTransform: 'uppercase', display: 'block', marginBottom: 8,
                }}>
                  Prazo
                </label>
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

              {/* Purposes */}
              <div>
                <label style={{
                  fontFamily: 'var(--font-sans)', fontSize: 11,
                  color: 'var(--color-text-secondary)', letterSpacing: '0.02em',
                  textTransform: 'uppercase', display: 'block', marginBottom: 8,
                }}>
                  Para o que usaria o capital? (opcional)
                </label>
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
            </div>

            {/* Error */}
            <AnimatePresence>
              {submitError && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  style={{ padding: '0 28px', overflow: 'hidden' }}
                >
                  <p style={{
                    fontFamily: 'var(--font-sans)', fontSize: 12,
                    color: 'var(--color-error, #ef4444)',
                    background: 'rgba(239,68,68,0.06)',
                    border: '1px solid rgba(239,68,68,0.15)',
                    borderRadius: 8, padding: '10px 14px',
                    margin: '16px 0 0', lineHeight: 1.5,
                  }}>
                    {submitError}
                  </p>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Submit */}
            <div style={{
              padding: '20px 28px 24px',
              display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
            }}>
              <motion.button
                onClick={handleSubmit}
                disabled={!canSubmit || submitting}
                whileHover={canSubmit && !submitting ? { scale: 1.01 } : {}}
                whileTap={canSubmit && !submitting ? { scale: 0.97 } : {}}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '10px 24px',
                  background: canSubmit ? 'var(--color-text-primary)' : 'var(--color-border)',
                  color: canSubmit ? 'white' : 'var(--color-text-tertiary)',
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
                        <circle cx="6" cy="6" r="4.5" stroke="white" strokeWidth="1.5" strokeDasharray="8 20" strokeLinecap="round"/>
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
            </div>
          </motion.div>

          {/* Disclaimer */}
          <p style={{
            fontFamily: 'var(--font-sans)', fontSize: 11, color: 'var(--color-text-tertiary)',
            margin: 0, lineHeight: 1.55, padding: '0 4px',
          }}>
            Opera via parceiro financeiro regulado. Limite calculado com base nos seus dados reais — nao em score de credito tradicional.
          </p>
        </div>
      </motion.div>
    </div>
  )
}

// ── Shared cards ─────────────────────────────────────────────────────────────

function HeroCard() {
  return (
    <div style={{
      background: 'var(--color-bg-primary)',
      border: '1px solid var(--color-border)',
      borderRadius: 'var(--radius-lg)',
      boxShadow: 'var(--shadow-md)',
      padding: '32px 28px 28px',
    }}>
      <span style={{
        fontFamily: 'var(--font-sans)', fontSize: 10, fontWeight: 400,
        color: 'var(--color-text-tertiary)', letterSpacing: '0.08em',
        textTransform: 'uppercase',
      }}>
        Northie Card
      </span>
      <h2 style={{
        fontFamily: 'var(--font-sans)', fontSize: 28, fontWeight: 500,
        letterSpacing: '-0.6px', color: 'var(--color-text-primary)',
        lineHeight: 1.2, margin: '10px 0 16px',
      }}>
        Capital que cresce com o seu negocio.
      </h2>
      <p style={{
        fontFamily: 'var(--font-sans)', fontSize: 13, color: 'var(--color-text-secondary)',
        lineHeight: 1.65, margin: '0 0 24px',
      }}>
        Sem garantia fisica, sem equity, sem burocracia. O limite e calculado diretamente pelos seus dados de faturamento, LTV e saude do caixa — nao por quem voce conhece.
      </p>
      <div style={{ height: 1, background: 'var(--color-border)', marginBottom: 20 }} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {BENEFICIOS.map((b, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.35, delay: 0.1 + i * 0.07, ease: [0.25, 0.1, 0.25, 1] }}
            style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}
          >
            <div style={{
              width: 20, height: 20, borderRadius: '50%', flexShrink: 0, marginTop: 1,
              border: '1px solid var(--color-border)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                <path d="M2 5L4.5 7.5L8 2.5" stroke="var(--color-text-primary)" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <div>
              <p style={{ fontFamily: 'var(--font-sans)', fontSize: 13, fontWeight: 500, color: 'var(--color-text-primary)', margin: '0 0 2px' }}>
                {b.label}
              </p>
              <p style={{ fontFamily: 'var(--font-sans)', fontSize: 12, color: 'var(--color-text-tertiary)', margin: 0, lineHeight: 1.5 }}>
                {b.desc}
              </p>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
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
