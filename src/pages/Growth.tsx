import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { growthApi, aiApi } from '../lib/api'
import { AskNorthieIcon } from '../icons'

// ── Types ────────────────────────────────────────────────────────────────────

type RecStatus = 'pending' | 'approved' | 'executing' | 'completed' | 'failed' | 'dismissed'
type RecType =
  | 'reativacao_alto_ltv'
  | 'pausa_campanha_ltv_baixo'
  | 'audience_sync_champions'
  | 'realocacao_budget'
  | 'upsell_cohort'
  | 'divergencia_roi_canal'
  | 'queda_retencao_cohort'
  | 'canal_alto_ltv_underinvested'
  | 'cac_vs_ltv_deficit'
  | 'em_risco_alto_valor'

interface ExecutionStep {
  step: string
  status: 'done' | 'running' | 'failed'
  timestamp: string
  detail?: string
}

interface Recommendation {
  id: string
  type: RecType
  status: RecStatus
  title: string
  narrative: string
  impact_estimate: string
  sources: string[]
  execution_log: ExecutionStep[]
  meta: any
  created_at: string
  updated_at: string
}

interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
}

// ── Constants ─────────────────────────────────────────────────────────────────

const TYPE_LABELS: Record<RecType, string> = {
  reativacao_alto_ltv: 'Reativação',
  pausa_campanha_ltv_baixo: 'Campanha',
  audience_sync_champions: 'Audiência',
  realocacao_budget: 'Budget',
  upsell_cohort: 'Upsell',
  divergencia_roi_canal: 'ROI',
  queda_retencao_cohort: 'Retenção',
  canal_alto_ltv_underinvested: 'Oportunidade',
  cac_vs_ltv_deficit: 'Payback',
  em_risco_alto_valor: 'Em Risco',
}

const TYPE_COLORS: Record<RecType, string> = {
  reativacao_alto_ltv: '#6366F1',
  pausa_campanha_ltv_baixo: '#F59E0B',
  audience_sync_champions: '#10B981',
  realocacao_budget: '#3B82F6',
  upsell_cohort: '#8B5CF6',
  divergencia_roi_canal: '#F97316',
  queda_retencao_cohort: '#EF4444',
  canal_alto_ltv_underinvested: '#10B981',
  cac_vs_ltv_deficit: '#F59E0B',
  em_risco_alto_valor: '#EF4444',
}

const CHANNEL_LABELS: Record<string, string> = {
  meta_ads: 'Meta Ads',
  google_ads: 'Google Ads',
  organico: 'Orgânico',
  email: 'E-mail',
  direto: 'Direto',
  afiliado: 'Afiliado',
}

const CHAT_CHIPS = [
  'Explica essa recomendação',
  'Qual o impacto de pausar?',
  'Mostra os Champions',
  'Por que meu LTV caiu?',
]

const fmt = (n: number) => n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const fmtInt = (n: number) => n.toLocaleString('pt-BR')

// ── Sub-components ─────────────────────────────────────────────────────────────

function TypeTag({ type }: { type: RecType }) {
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      padding: '2px 8px',
      borderRadius: 'var(--radius-full)',
      fontFamily: 'var(--font-mono)',
      fontSize: 10,
      letterSpacing: '0.06em',
      textTransform: 'uppercase' as const,
      color: TYPE_COLORS[type],
      background: `${TYPE_COLORS[type]}18`,
      border: `1px solid ${TYPE_COLORS[type]}30`,
    }}>
      {TYPE_LABELS[type]}
    </span>
  )
}

function StepIcon({ status }: { status: 'done' | 'running' | 'failed' }) {
  if (status === 'done') return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <circle cx="7" cy="7" r="6" fill="#10B981" fillOpacity="0.15" stroke="#10B981" strokeWidth="1"/>
      <path d="M4.5 7L6.5 9L9.5 5" stroke="#10B981" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
  if (status === 'failed') return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <circle cx="7" cy="7" r="6" fill="#EF4444" fillOpacity="0.15" stroke="#EF4444" strokeWidth="1"/>
      <path d="M5 5L9 9M9 5L5 9" stroke="#EF4444" strokeWidth="1.3" strokeLinecap="round"/>
    </svg>
  )
  return (
    <motion.div
      animate={{ rotate: 360 }}
      transition={{ duration: 1.2, repeat: Infinity, ease: 'linear' }}
    >
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
        <circle cx="7" cy="7" r="6" stroke="var(--color-border)" strokeWidth="1"/>
        <path d="M7 1A6 6 0 0 1 13 7" stroke="var(--color-primary)" strokeWidth="1.3" strokeLinecap="round"/>
      </svg>
    </motion.div>
  )
}

// Mini-tabela de dados inline extraídos do meta da recomendação
function RecMetaInline({ type, meta }: { type: RecType; meta: any }) {
  if (!meta) return null

  const rows: { label: string; value: string }[] = []

  if (type === 'reativacao_alto_ltv') {
    if (meta.segment_count) rows.push({ label: 'Clientes', value: fmtInt(meta.segment_count) })
    if (meta.avg_ltv) rows.push({ label: 'LTV médio', value: `R$ ${fmt(meta.avg_ltv)}` })
    if (meta.global_avg_ltv) rows.push({ label: 'LTV global', value: `R$ ${fmt(meta.global_avg_ltv)}` })
  } else if (type === 'pausa_campanha_ltv_baixo') {
    if (meta.total_spend_14d) rows.push({ label: 'Gasto 14d', value: `R$ ${fmt(meta.total_spend_14d)}` })
    if (meta.global_avg_ltv) rows.push({ label: 'LTV global', value: `R$ ${fmt(meta.global_avg_ltv)}` })
    if (meta.campaigns?.length) rows.push({ label: 'Campanhas', value: fmtInt(meta.campaigns.length) })
  } else if (type === 'audience_sync_champions') {
    if (meta.champion_count) rows.push({ label: 'Champions', value: fmtInt(meta.champion_count) })
    if (meta.avg_ltv) rows.push({ label: 'LTV médio', value: `R$ ${fmt(meta.avg_ltv)}` })
  } else if (type === 'realocacao_budget') {
    if (meta.best_channel) rows.push({ label: 'Melhor canal', value: CHANNEL_LABELS[meta.best_channel.platform] || meta.best_channel.platform })
    if (meta.ltv_diff_pct) rows.push({ label: 'Diferença LTV', value: `+${meta.ltv_diff_pct}%` })
  } else if (type === 'upsell_cohort') {
    if (meta.segment_count) rows.push({ label: 'Na janela', value: fmtInt(meta.segment_count) })
    if (meta.avg_interval_days) rows.push({ label: 'Intervalo médio', value: `${meta.avg_interval_days} dias` })
    if (meta.avg_ltv) rows.push({ label: 'LTV médio', value: `R$ ${fmt(meta.avg_ltv)}` })
  } else if (type === 'divergencia_roi_canal') {
    const w = meta.worst_channel
    if (w) {
      rows.push({ label: 'ROI atual', value: `${Number(w.current_roi).toFixed(2)}x` })
      rows.push({ label: 'ROI anterior', value: `${Number(w.historic_roi).toFixed(2)}x` })
      rows.push({ label: 'Queda', value: `-${w.roi_drop_pct}%` })
    }
  } else if (type === 'queda_retencao_cohort') {
    const w = meta.worst_channel
    if (w) {
      rows.push({ label: 'Retenção atual', value: `${w.current_retention}%` })
      rows.push({ label: 'Média histórica', value: `${w.historic_avg}%` })
      rows.push({ label: 'Cohort', value: w.cohort_month?.substring(0, 7) || '—' })
    }
  } else if (type === 'canal_alto_ltv_underinvested') {
    const b = meta.best_channel
    if (b) {
      rows.push({ label: 'ROI real', value: `${Number(b.true_roi).toFixed(1)}x` })
      rows.push({ label: 'LTV médio', value: `R$ ${fmt(Number(b.avg_ltv_brl))}` })
      rows.push({ label: 'Gasto atual', value: `R$ ${fmt(Number(b.total_spend_brl))}` })
    }
  } else if (type === 'cac_vs_ltv_deficit') {
    if (meta.unprofitable_count) rows.push({ label: 'Clientes', value: fmtInt(meta.unprofitable_count) })
    if (meta.total_deficit) rows.push({ label: 'Déficit total', value: `R$ ${fmt(meta.total_deficit)}` })
    if (meta.avg_cac) rows.push({ label: 'CAC médio', value: `R$ ${fmt(meta.avg_cac)}` })
    if (meta.avg_ltv) rows.push({ label: 'LTV médio', value: `R$ ${fmt(meta.avg_ltv)}` })
  } else if (type === 'em_risco_alto_valor') {
    if (meta.at_risk_count) rows.push({ label: 'Em risco', value: fmtInt(meta.at_risk_count) })
    if (meta.avg_ltv) rows.push({ label: 'LTV médio', value: `R$ ${fmt(meta.avg_ltv)}` })
    if (meta.avg_churn_probability) rows.push({ label: 'Churn médio', value: `${meta.avg_churn_probability}%` })
  }

  if (!rows.length) return null

  return (
    <div style={{
      display: 'flex',
      gap: 8,
      flexWrap: 'wrap' as const,
      padding: '8px 12px',
      background: `${TYPE_COLORS[type]}08`,
      border: `1px solid ${TYPE_COLORS[type]}20`,
      borderRadius: 'var(--radius-md)',
    }}>
      {rows.map(row => (
        <div key={row.label} style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--color-text-tertiary)', textTransform: 'uppercase' as const, letterSpacing: '0.05em' }}>
            {row.label}
          </span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: TYPE_COLORS[type], fontWeight: 500 }}>
            {row.value}
          </span>
        </div>
      ))}
    </div>
  )
}

function RecommendationCard({ rec, onApprove, onDismiss }: {
  rec: Recommendation
  onApprove: (id: string) => void
  onDismiss: (id: string) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const isActive = ['approved', 'executing', 'completed', 'failed'].includes(rec.status)

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
      style={{
        background: 'var(--color-bg-primary)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-lg)',
        padding: 'var(--space-4)',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-3)',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 'var(--space-3)' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', flex: 1 }}>
          <TypeTag type={rec.type} />
          <span style={{
            fontFamily: 'var(--font-sans)',
            fontSize: 'var(--text-base)',
            fontWeight: 500,
            color: 'var(--color-text-primary)',
            letterSpacing: '-0.2px',
            lineHeight: 1.4,
          }}>
            {rec.title}
          </span>
        </div>
        {rec.status === 'completed' && (
          <span style={{
            fontFamily: 'var(--font-mono)', fontSize: 10, color: '#10B981',
            background: '#10B98115', border: '1px solid #10B98130',
            borderRadius: 'var(--radius-full)', padding: '2px 8px', whiteSpace: 'nowrap',
          }}>Concluído</span>
        )}
        {rec.status === 'failed' && (
          <span style={{
            fontFamily: 'var(--font-mono)', fontSize: 10, color: '#EF4444',
            background: '#EF444415', border: '1px solid #EF444430',
            borderRadius: 'var(--radius-full)', padding: '2px 8px', whiteSpace: 'nowrap',
          }}>Falhou</span>
        )}
      </div>

      {/* Dados inline da correlação */}
      {!isActive && <RecMetaInline type={rec.type} meta={rec.meta} />}

      {/* Pending: narrative + actions */}
      {!isActive && (
        <>
          <div>
            <p style={{
              fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)',
              color: 'var(--color-text-secondary)', lineHeight: 1.6, margin: 0,
              display: expanded ? 'block' : '-webkit-box',
              WebkitLineClamp: expanded ? 'unset' : 3,
              WebkitBoxOrient: 'vertical' as any,
              overflow: expanded ? 'visible' : 'hidden',
            }}>
              {rec.narrative}
            </p>
            {rec.narrative.length > 180 && (
              <button
                onClick={() => setExpanded(!expanded)}
                style={{
                  background: 'none', border: 'none', padding: 0, cursor: 'pointer',
                  fontFamily: 'var(--font-sans)', fontSize: 'var(--text-xs)',
                  color: 'var(--color-primary)', marginTop: 4,
                }}
              >
                {expanded ? 'Menos' : 'Ler mais'}
              </button>
            )}
          </div>

          {rec.impact_estimate && (
            <div style={{
              padding: '8px 12px', background: 'var(--color-bg-secondary)',
              borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
                <path d="M7 1L8.5 5.5H13.5L9.5 8.5L11 13L7 10L3 13L4.5 8.5L0.5 5.5H5.5L7 1Z" fill="var(--color-primary)" fillOpacity="0.6"/>
              </svg>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)' }}>
                {rec.impact_estimate}
              </span>
            </div>
          )}

          <div style={{ display: 'flex', gap: 'var(--space-2)', marginTop: 4 }}>
            <motion.button
              onClick={() => onApprove(rec.id)}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              style={{
                flex: 1, padding: '8px 0',
                background: 'var(--color-primary)', color: 'white',
                border: 'none', borderRadius: 'var(--radius-md)',
                fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)',
                fontWeight: 500, cursor: 'pointer',
              }}
            >
              Aprovar e executar
            </motion.button>
            <motion.button
              onClick={() => onDismiss(rec.id)}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              style={{
                padding: '8px 14px', background: 'transparent',
                color: 'var(--color-text-tertiary)', border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-md)', fontFamily: 'var(--font-sans)',
                fontSize: 'var(--text-sm)', cursor: 'pointer',
              }}
            >
              Descartar
            </motion.button>
          </div>
        </>
      )}

      {/* Active: execution log */}
      {isActive && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
          {(rec.execution_log || []).map((step, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -4 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
              style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}
            >
              <div style={{ flexShrink: 0, marginTop: 1 }}>
                <StepIcon status={step.status} />
              </div>
              <div style={{ flex: 1 }}>
                <span style={{
                  fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)',
                  color: step.status === 'failed' ? '#EF4444' : 'var(--color-text-primary)',
                }}>
                  {step.step}
                </span>
                {step.detail && (
                  <p style={{ margin: '2px 0 0', fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--color-text-tertiary)' }}>
                    {step.detail}
                  </p>
                )}
              </div>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--color-text-tertiary)', whiteSpace: 'nowrap', flexShrink: 0 }}>
                {new Date(step.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </span>
            </motion.div>
          ))}
          {rec.status === 'executing' && rec.execution_log?.length === 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <StepIcon status="running" />
              <span style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)' }}>
                Iniciando execução...
              </span>
            </div>
          )}
        </div>
      )}

      {/* Sources */}
      {rec.sources?.length > 0 && (
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' as const, marginTop: 2 }}>
          {rec.sources.map(s => (
            <span key={s} style={{
              fontFamily: 'var(--font-mono)', fontSize: 9,
              color: 'var(--color-text-tertiary)', background: 'var(--color-bg-secondary)',
              border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: '1px 6px',
            }}>
              {s}
            </span>
          ))}
        </div>
      )}
    </motion.div>
  )
}

function GrowthEmptyState() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      style={{
        padding: 'var(--space-8)', textAlign: 'center' as const,
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--space-2)',
      }}
    >
      <div style={{
        width: 8, height: 8, borderRadius: 'var(--radius-full)',
        background: '#10B981', marginBottom: 8, boxShadow: '0 0 0 4px #10B98120',
      }} />
      <p style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', fontWeight: 500, color: 'var(--color-text-primary)', margin: 0 }}>
        Nenhuma ação crítica identificada
      </p>
      <p style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)', margin: 0 }}>
        Próxima análise em &lt;30min
      </p>
    </motion.div>
  )
}

function ThinkingIndicator() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', padding: '0 var(--space-4)' }}
    >
      <div style={{ display: 'flex', gap: 4 }}>
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            animate={{ opacity: [0.3, 1, 0.3], scale: [1, 1.1, 1] }}
            transition={{ duration: 1, repeat: Infinity, delay: i * 0.18 }}
            style={{ width: 5, height: 5, borderRadius: 'var(--radius-full)', background: 'var(--color-primary)' }}
          />
        ))}
      </div>
      <span style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', color: 'var(--color-text-tertiary)' }}>
        Processando...
      </span>
    </motion.div>
  )
}

function GrowthChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: '1',
      role: 'assistant',
      content: 'Olá! Estou conectado aos seus dados de crescimento e às recomendações pendentes. O que quer analisar?',
    },
  ])
  const [input, setInput] = useState('')
  const [isThinking, setIsThinking] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
    }
  }, [messages, isThinking])

  const handleSend = async (text?: string) => {
    const messageText = text || input
    if (!messageText.trim() || isThinking) return

    const userMsg: ChatMessage = { id: Date.now().toString(), role: 'user', content: messageText }
    setMessages(prev => [...prev, userMsg])
    if (!text) setInput('')
    setIsThinking(true)

    try {
      const response = await aiApi.growthChat(messageText)
      const aiMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response.data.content,
      }
      setMessages(prev => [...prev, aiMsg])
    } catch {
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'Desculpe, tive um problema ao processar sua pergunta.',
      }])
    } finally {
      setIsThinking(false)
    }
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', borderLeft: '1px solid var(--color-border)' }}>
      {/* Chat Header */}
      <div style={{
        padding: '16px 20px', borderBottom: '1px solid var(--color-border)',
        display: 'flex', alignItems: 'center', gap: 10,
        background: 'var(--color-bg-primary)', flexShrink: 0,
      }}>
        <motion.div animate={{ rotate: isThinking ? [0, 8, -8, 0] : 0 }} transition={{ repeat: Infinity, duration: 2 }}>
          <AskNorthieIcon />
        </motion.div>
        <div>
          <span style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-base)', fontWeight: 500, color: 'var(--color-text-primary)', letterSpacing: '-0.2px', display: 'block' }}>
            Northie AI
          </span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--color-text-tertiary)' }}>
            Contexto: Growth
          </span>
        </div>
      </div>

      {/* Messages */}
      <div
        ref={scrollRef}
        style={{
          flex: 1, overflowY: 'auto', padding: 'var(--space-4)',
          display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', scrollbarWidth: 'thin',
        }}
      >
        {messages.map(m => (
          <motion.div
            key={m.id}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
          >
            {m.role === 'assistant' ? (
              <div>
                <p style={{
                  fontFamily: 'var(--font-sans)', fontSize: 'var(--text-xs)', fontWeight: 500,
                  color: 'var(--color-text-tertiary)', textTransform: 'uppercase' as const,
                  letterSpacing: '0.06em', marginBottom: 6, marginTop: 0,
                }}>
                  Northie AI
                </p>
                <div style={{
                  padding: 'var(--space-3) var(--space-4)',
                  background: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-lg)', fontFamily: 'var(--font-sans)',
                  fontSize: 'var(--text-sm)', lineHeight: 1.65, color: 'var(--color-text-primary)',
                  whiteSpace: 'pre-wrap',
                }}>
                  {m.content}
                </div>
              </div>
            ) : (
              <div style={{ textAlign: 'right' as const }}>
                <div style={{
                  display: 'inline-block', padding: 'var(--space-3) var(--space-4)',
                  background: 'var(--inv)', color: 'var(--on-inv)',
                  borderRadius: 'var(--radius-lg)', fontFamily: 'var(--font-sans)',
                  fontSize: 'var(--text-sm)', lineHeight: 1.55, maxWidth: '85%', textAlign: 'left' as const,
                }}>
                  {m.content}
                </div>
              </div>
            )}
          </motion.div>
        ))}
        {isThinking && <ThinkingIndicator />}
      </div>

      {/* Footer */}
      <div style={{ padding: 'var(--space-3) var(--space-4)', borderTop: '1px solid var(--color-border)', background: 'var(--color-bg-primary)', flexShrink: 0 }}>
        <div style={{ display: 'flex', gap: 6, overflowX: 'auto', marginBottom: 'var(--space-3)', scrollbarWidth: 'none', paddingBottom: 2 }}>
          {CHAT_CHIPS.map(chip => (
            <button
              key={chip}
              onClick={() => handleSend(chip)}
              style={{
                whiteSpace: 'nowrap', border: '1px solid var(--color-border)',
                background: 'var(--color-bg-secondary)', color: 'var(--color-text-secondary)',
                borderRadius: 'var(--radius-md)', padding: '4px 10px',
                fontFamily: 'var(--font-sans)', fontSize: 'var(--text-xs)',
                cursor: 'pointer', transition: 'background var(--transition-base)',
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--color-bg-tertiary)' }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--color-bg-secondary)' }}
            >
              {chip}
            </button>
          ))}
        </div>
        <div style={{
          display: 'flex', gap: 'var(--space-2)',
          background: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-lg)', padding: 'var(--space-2) var(--space-3)', alignItems: 'flex-end',
        }}>
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }}
            placeholder="Pergunte sobre suas métricas de crescimento..."
            style={{
              flex: 1, border: 'none', background: 'transparent', outline: 'none',
              fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)',
              color: 'var(--color-text-primary)', resize: 'none' as const,
              minHeight: 20, maxHeight: 100, padding: 0, lineHeight: 1.55,
            }}
          />
          <motion.button
            onClick={() => handleSend()}
            disabled={!input.trim() || isThinking}
            whileHover={{ scale: input.trim() ? 1.05 : 1 }}
            whileTap={{ scale: 0.95 }}
            style={{
              background: input.trim() ? 'var(--color-primary)' : 'var(--color-border)',
              color: input.trim() ? 'white' : 'var(--color-text-tertiary)',
              border: 'none', borderRadius: 'var(--radius-md)',
              width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: input.trim() ? 'pointer' : 'default', flexShrink: 0,
              transition: 'background var(--transition-base)',
            }}
          >
            <svg width="11" height="11" viewBox="0 0 14 14" fill="none">
              <path d="M1 7H13M13 7L7 1M13 7L7 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </motion.button>
        </div>
      </div>
    </div>
  )
}

// ── Main Page ──────────────────────────────────────────────────────────────────

export default function Growth() {
  const [recommendations, setRecommendations] = useState<Recommendation[]>([])
  const [loading, setLoading] = useState(true)
  const [lastAnalysis, setLastAnalysis] = useState<Date>(new Date())
  const pollingRefs = useRef<Record<string, ReturnType<typeof setInterval>>>({})

  const fetchData = useCallback(async () => {
    try {
      const recRes = await growthApi.listRecommendations()
      setRecommendations(recRes.data ?? [])
      setLastAnalysis(new Date())
    } catch {
      setRecommendations([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
    const interval = setInterval(fetchData, 60 * 1000)
    return () => clearInterval(interval)
  }, [fetchData])

  useEffect(() => {
    const refs = pollingRefs.current
    return () => { Object.values(refs).forEach(clearInterval) }
  }, [])

  const stopPolling = useCallback((id: string) => {
    if (pollingRefs.current[id]) {
      clearInterval(pollingRefs.current[id])
      delete pollingRefs.current[id]
    }
  }, [])

  const startPolling = useCallback((id: string) => {
    pollingRefs.current[id] = setInterval(async () => {
      try {
        const res = await growthApi.getStatus(id)
        const { status, execution_log } = res.data
        setRecommendations(prev => prev.map(r =>
          r.id === id ? { ...r, status, execution_log: execution_log || [] } : r
        ))
        if (status === 'completed' || status === 'failed') stopPolling(id)
      } catch { /* rede instável — continua tentando */ }
    }, 2000)
  }, [stopPolling])

  const handleApprove = async (id: string) => {
    setRecommendations(prev => prev.map(r =>
      r.id === id ? { ...r, status: 'executing', execution_log: [] } : r
    ))
    try {
      await growthApi.approve(id)
      startPolling(id)
    } catch {
      setRecommendations(prev => prev.map(r =>
        r.id === id ? { ...r, status: 'failed', execution_log: [{ step: 'Falha ao conectar com o backend', status: 'failed', timestamp: new Date().toISOString() }] } : r
      ))
    }
  }

  const handleDismiss = async (id: string) => {
    setRecommendations(prev => prev.filter(r => r.id !== id))
    try { await growthApi.dismiss(id) } catch { /* silently ok */ }
  }

  const pendingRecs = recommendations.filter(r => r.status === 'pending')
  const activeRecs = recommendations.filter(r => ['approved', 'executing', 'completed', 'failed'].includes(r.status))
  const minutesSinceAnalysis = Math.round((new Date().getTime() - lastAnalysis.getTime()) / 60000)

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.25, 0.1, 0.25, 1] }}
      style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}
    >
      {/* Header */}
      <div style={{
        padding: '28px 32px 20px', borderBottom: '1px solid var(--color-border)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0,
      }}>
        <div>
          <h1 style={{
            fontFamily: 'var(--font-sans)', fontSize: 'var(--text-md)', fontWeight: 600,
            color: 'var(--color-text-primary)', letterSpacing: '-0.4px', margin: 0,
          }}>
            Northie Growth
          </h1>
          <p style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', color: 'var(--color-text-tertiary)', margin: '4px 0 0' }}>
            Execução automática de crescimento baseada em cruzamento de dados
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 6, height: 6, borderRadius: 'var(--radius-full)', background: '#10B981', boxShadow: '0 0 0 3px #10B98120' }} />
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)' }}>
            Motor ativo · última análise há {minutesSinceAnalysis}min
          </span>
        </div>
      </div>

      {/* Split Layout */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Left panel: recommendations */}
        <div style={{
          flex: '0 0 55%', overflowY: 'auto', padding: '24px 32px',
          display: 'flex', flexDirection: 'column', scrollbarWidth: 'thin',
        }}>
          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              {[1, 2, 3].map(i => (
                <div key={i} style={{
                  height: i === 1 ? 100 : 120, borderRadius: 'var(--radius-lg)',
                  background: 'var(--color-bg-primary)', border: '1px solid var(--color-border)', opacity: 0.6,
                }} />
              ))}
            </div>
          ) : (
            <>
              {/* Seção: Em execução */}
              {activeRecs.length > 0 && (
                <div style={{ marginBottom: 24 }}>
                  <p style={{
                    fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.1em',
                    textTransform: 'uppercase' as const, color: 'var(--color-text-tertiary)',
                    marginBottom: 12, marginTop: 0,
                  }}>
                    Em execução
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                    <AnimatePresence>
                      {activeRecs.map(rec => (
                        <RecommendationCard key={rec.id} rec={rec} onApprove={handleApprove} onDismiss={handleDismiss} />
                      ))}
                    </AnimatePresence>
                  </div>
                </div>
              )}

              {/* Seção: Pendentes */}
              {pendingRecs.length > 0 ? (
                <div>
                  <p style={{
                    fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.1em',
                    textTransform: 'uppercase' as const, color: 'var(--color-text-tertiary)',
                    marginBottom: 12, marginTop: 0,
                  }}>
                    Aguardando aprovação — {pendingRecs.length} ação{pendingRecs.length > 1 ? 'ões' : ''}
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                    <AnimatePresence>
                      {pendingRecs.map(rec => (
                        <RecommendationCard key={rec.id} rec={rec} onApprove={handleApprove} onDismiss={handleDismiss} />
                      ))}
                    </AnimatePresence>
                  </div>
                </div>
              ) : activeRecs.length === 0 && (
                <GrowthEmptyState />
              )}
            </>
          )}
        </div>

        {/* Right panel: inline chat */}
        <div style={{ flex: '0 0 45%', overflow: 'hidden' }}>
          <GrowthChat />
        </div>
      </div>
    </motion.div>
  )
}
