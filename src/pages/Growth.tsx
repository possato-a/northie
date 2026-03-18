import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { growthApi } from '../lib/api'
import { KpiCard } from '../components/ui/KpiCard'
import GrowthChatComponent from '../components/growth/GrowthChat'
import CollaborationModal from '../components/growth/CollaborationModal'
import ExecutionHistory, { type ExecutionHistoryItem } from '../components/growth/ExecutionHistory'

// ── Types ────────────────────────────────────────────────────────────────────

type RecStatus = 'pending' | 'collaborating' | 'awaiting_confirmation' | 'approved' | 'executing' | 'completed' | 'failed' | 'dismissed' | 'rejected' | 'cancelled'
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

const COLLABORATION_REQUIRED: RecType[] = [
  'reativacao_alto_ltv',
  'em_risco_alto_valor',
  'upsell_cohort',
  'queda_retencao_cohort',
  'cac_vs_ltv_deficit',
]

const CHANNEL_LABELS: Record<string, string> = {
  meta_ads: 'Meta Ads',
  google_ads: 'Google Ads',
  organico: 'Orgânico',
  email: 'E-mail',
  direto: 'Direto',
  afiliado: 'Afiliado',
}

const SOURCE_CONFIG: Record<string, { label: string; color: string }> = {
  stripe:     { label: 'Stripe',     color: '#635BFF' },
  hotmart:    { label: 'Hotmart',    color: '#FF3228' },
  meta_ads:   { label: 'Meta Ads',   color: '#FF5900' },
  google_ads: { label: 'Google Ads', color: '#4285F4' },
  shopify:    { label: 'Shopify',    color: '#96BF48' },
}

const EXEC_CHANNEL: Record<RecType, { label: string; color: string }> = {
  reativacao_alto_ltv:           { label: 'WhatsApp', color: '#25D366' },
  pausa_campanha_ltv_baixo:      { label: 'Meta Ads',  color: '#FF5900' },
  audience_sync_champions:       { label: 'Meta Ads',  color: '#FF5900' },
  realocacao_budget:             { label: 'Meta Ads',  color: '#FF5900' },
  upsell_cohort:                 { label: 'E-mail',    color: '#3B82F6' },
  divergencia_roi_canal:         { label: 'Meta Ads',  color: '#FF5900' },
  queda_retencao_cohort:         { label: 'E-mail',    color: '#3B82F6' },
  canal_alto_ltv_underinvested:  { label: 'Meta Ads',  color: '#FF5900' },
  cac_vs_ltv_deficit:            { label: 'Meta Ads',  color: '#FF5900' },
  em_risco_alto_valor:           { label: 'WhatsApp', color: '#25D366' },
}



const fmt = (n: number) => n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const fmtInt = (n: number) => n.toLocaleString('pt-BR')

// ── Sub-components ─────────────────────────────────────────────────────────────

const TYPE_TAG_CLASS: Record<RecType, string> = {
  reativacao_alto_ltv:          'tag tag-complete',
  pausa_campanha_ltv_baixo:     'tag tag-warning',
  audience_sync_champions:      'tag tag-complete',
  realocacao_budget:            'tag tag-planning',
  upsell_cohort:                'tag tag-complete',
  divergencia_roi_canal:        'tag tag-warning',
  queda_retencao_cohort:        'tag tag-critical',
  canal_alto_ltv_underinvested: 'tag tag-complete',
  cac_vs_ltv_deficit:           'tag tag-warning',
  em_risco_alto_valor:          'tag tag-critical',
}

function TypeTag({ type }: { type: RecType }) {
  return <span className={TYPE_TAG_CLASS[type]}>{TYPE_LABELS[type]}</span>
}

function StepIcon({ status }: { status: 'done' | 'running' | 'failed' }) {
  if (status === 'done') return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <circle cx="7" cy="7" r="6" fill="var(--accent-green)" fillOpacity="0.15" stroke="var(--accent-green)" strokeWidth="1"/>
      <path d="M4.5 7L6.5 9L9.5 5" stroke="var(--accent-green)" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
  if (status === 'failed') return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <circle cx="7" cy="7" r="6" fill="var(--accent-red)" fillOpacity="0.15" stroke="var(--accent-red)" strokeWidth="1"/>
      <path d="M5 5L9 9M9 5L5 9" stroke="var(--accent-red)" strokeWidth="1.3" strokeLinecap="round"/>
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
      background: 'var(--color-bg-secondary)',
      border: '1px solid var(--color-border)',
      borderRadius: 'var(--radius-md)',
    }}>
      {rows.map(row => (
        <div key={row.label} style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          <span style={{ fontFamily: 'var(--font-sans)', fontSize: 10, color: 'var(--color-text-tertiary)', textTransform: 'uppercase' as const, letterSpacing: '0.04em' }}>
            {row.label}
          </span>
          <span style={{ fontFamily: 'var(--font-sans)', fontSize: 13, color: 'var(--color-text-primary)', fontWeight: 500 }}>
            {row.value}
          </span>
        </div>
      ))}
    </div>
  )
}

function RecommendationCard({ rec, onClick }: {
  rec: Recommendation
  onClick: () => void
}) {
  const ch = EXEC_CHANNEL[rec.type]
  const isActive = ['approved', 'executing', 'completed', 'failed'].includes(rec.status)
  const [hovered, setHovered] = useState(false)

  return (
    <motion.div
      onClick={onClick}
      onHoverStart={() => setHovered(true)}
      onHoverEnd={() => setHovered(false)}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
      whileHover={{ y: -1 }}
      style={{
        background: 'var(--color-bg-primary)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-lg)',
        padding: '16px 18px',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        cursor: 'pointer',
        minHeight: 148,
        boxShadow: hovered ? 'var(--shadow-md)' : 'none',
        transition: 'box-shadow 0.18s ease',
      }}
    >
      {/* Top: categoria + status */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{
          fontFamily: 'var(--font-sans)', fontSize: 10, fontWeight: 400,
          color: 'var(--color-text-tertiary)', letterSpacing: '0.06em',
          textTransform: 'uppercase' as const,
        }}>
          {TYPE_LABELS[rec.type]}
        </span>
        {isActive ? (
          <span style={{
            fontFamily: 'var(--font-sans)', fontSize: 10,
            color: 'var(--accent-green)', background: 'var(--status-complete-bg)',
            border: '1px solid var(--accent-green)',
            borderRadius: 99, padding: '1px 7px',
          }}>
            {rec.status === 'completed' ? 'Concluído' : rec.status === 'failed' ? 'Falhou' : 'Em execução'}
          </span>
        ) : rec.sources?.length > 0 && (
          <div style={{ display: 'flex', gap: 3, alignItems: 'center' }}>
            {rec.sources.map(s => {
              const cfg = SOURCE_CONFIG[s] || { color: 'var(--color-text-tertiary)' }
              return <span key={s} style={{ width: 5, height: 5, borderRadius: '50%', background: cfg.color, opacity: 0.7 }} />
            })}
          </div>
        )}
      </div>

      {/* Title */}
      <span style={{
        fontFamily: 'var(--font-sans)',
        fontSize: 13,
        fontWeight: 500,
        letterSpacing: '-0.15px',
        color: 'var(--color-text-primary)',
        lineHeight: 1.45,
        flex: 1,
        display: '-webkit-box',
        WebkitLineClamp: 3,
        WebkitBoxOrient: 'vertical' as any,
        overflow: 'hidden',
      }}>
        {rec.title}
      </span>

      {/* Bottom: canal + seta */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontFamily: 'var(--font-sans)', fontSize: 11, color: 'var(--color-text-tertiary)' }}>
          <span style={{ width: 5, height: 5, borderRadius: '50%', background: ch.color, flexShrink: 0 }} />
          via {ch.label}
        </span>
        <motion.span
          animate={{ x: hovered ? 2 : 0, opacity: hovered ? 1 : 0.4 }}
          transition={{ duration: 0.15 }}
          style={{ display: 'flex', alignItems: 'center', color: 'var(--color-text-primary)' }}
        >
          <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
            <path d="M3 7H11M11 7L7.5 3.5M11 7L7.5 10.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </motion.span>
      </div>
    </motion.div>
  )
}

function RecDetailDrawer({ rec, onClose, onApprove, onDismiss, onReject, onCancel }: {
  rec: Recommendation
  onClose: () => void
  onApprove: (id: string) => void
  onDismiss: (id: string) => void
  onReject?: (id: string) => void
  onCancel?: (id: string) => void
}) {
  const isActive = ['approved', 'executing', 'completed', 'failed', 'cancelled'].includes(rec.status)
  const ch = EXEC_CHANNEL[rec.type]
  const requiresCollab = COLLABORATION_REQUIRED.includes(rec.type)

  return (
    <>
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, zIndex: 99,
          background: 'rgba(0,0,0,0.3)',
        }}
      />

      {/* Drawer */}
      <motion.div
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
        style={{
          position: 'fixed', top: 0, right: 0, bottom: 0,
          width: 420, zIndex: 100,
          background: 'var(--color-bg-primary)',
          borderLeft: '1px solid var(--color-border)',
          display: 'flex', flexDirection: 'column',
          boxShadow: '-8px 0 32px rgba(0,0,0,0.12)',
        }}
      >
        {/* Drawer header */}
        <div style={{
          padding: '20px 24px 16px',
          borderBottom: '1px solid var(--color-border)',
          flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' as const }}>
              <TypeTag type={rec.type} />
              {isActive && (
                <span style={{
                  fontFamily: 'var(--font-sans)', fontSize: 10,
                  color: 'var(--accent-green)',
                  background: 'var(--status-complete-bg)',
                  border: '1px solid var(--accent-green)',
                  borderRadius: 99, padding: '1px 7px',
                }}>
                  {rec.status === 'completed' ? 'Concluído' : rec.status === 'failed' ? 'Falhou' : 'Em execução'}
                </span>
              )}
            </div>
            <button
              onClick={onClose}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: 'var(--color-text-tertiary)', padding: 4, flexShrink: 0,
                borderRadius: 'var(--radius-sm)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M4 4L12 12M12 4L4 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </button>
          </div>

          {/* Sources */}
          {rec.sources?.length > 0 && (
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              {rec.sources.map((s, i) => {
                const cfg = SOURCE_CONFIG[s] || { label: s, color: 'var(--color-text-tertiary)' }
                return (
                  <span key={s} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    {i > 0 && <span style={{ width: 3, height: 3, borderRadius: '50%', background: 'var(--color-border)' }} />}
                    <span style={{ width: 5, height: 5, borderRadius: '50%', background: cfg.color }} />
                    <span style={{ fontFamily: 'var(--font-sans)', fontSize: 11, color: 'var(--color-text-tertiary)' }}>{cfg.label}</span>
                  </span>
                )
              })}
            </div>
          )}
        </div>

        {/* Drawer body — scrollable */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Title */}
          <span style={{
            fontFamily: 'var(--font-sans)', fontSize: 'var(--text-base)',
            fontWeight: 600, letterSpacing: '-0.3px',
            color: 'var(--color-text-primary)', lineHeight: 1.4,
          }}>
            {rec.title}
          </span>

          {/* Narrative */}
          {rec.narrative && (
            <p style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)', lineHeight: 1.65, margin: 0 }}>
              {rec.narrative}
            </p>
          )}

          {/* Meta data */}
          <RecMetaInline type={rec.type} meta={rec.meta} />

          {/* Impact estimate */}
          {!isActive && rec.impact_estimate && (
            <div style={{
              display: 'flex', alignItems: 'flex-start', gap: 10,
              padding: '10px 12px',
              background: 'rgba(249,115,22,0.06)',
              border: '1px solid rgba(249,115,22,0.18)',
              borderRadius: 'var(--radius-md)',
            }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'rgba(249,115,22,0.7)', flexShrink: 0, marginTop: 3 }} />
              <p style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', color: 'var(--color-text-primary)', margin: 0, lineHeight: 1.5 }}>
                {rec.impact_estimate}
              </p>
            </div>
          )}

          {/* Execution log */}
          {isActive && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <p style={{ fontFamily: 'var(--font-sans)', fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase' as const, color: 'var(--color-text-tertiary)', margin: '0 0 4px' }}>
                Log de Execução
              </p>
              {(rec.execution_log || []).map((step, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -4 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                  style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}
                >
                  <div style={{ flexShrink: 0, marginTop: 1 }}><StepIcon status={step.status} /></div>
                  <div style={{ flex: 1 }}>
                    <span style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', color: step.status === 'failed' ? 'var(--accent-red)' : 'var(--color-text-primary)' }}>
                      {step.step}
                    </span>
                    {step.detail && (
                      <p style={{ margin: '2px 0 0', fontFamily: 'var(--font-sans)', fontSize: 10, color: 'var(--color-text-tertiary)' }}>{step.detail}</p>
                    )}
                  </div>
                  <span style={{ fontFamily: 'var(--font-sans)', fontSize: 10, color: 'var(--color-text-tertiary)', whiteSpace: 'nowrap' as const, flexShrink: 0 }}>
                    {new Date(step.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </span>
                </motion.div>
              ))}
              {rec.status === 'executing' && rec.execution_log?.length === 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <StepIcon status="running" />
                  <span style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)' }}>Iniciando execução...</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Drawer footer — sticky action buttons */}
        {!isActive && (
          <div style={{
            padding: '16px 24px',
            borderTop: '1px solid var(--color-border)',
            background: 'var(--color-bg-primary)',
            flexShrink: 0,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontFamily: 'var(--font-sans)', fontSize: 11, color: 'var(--color-text-tertiary)' }}>
                <span style={{ width: 5, height: 5, borderRadius: '50%', background: ch.color, flexShrink: 0 }} />
                via {ch.label}
              </span>
              <div style={{ display: 'flex', gap: 8 }}>
                {rec.status === 'pending' && (
                  <>
                    <motion.button
                      onClick={() => { onApprove(rec.id); onClose() }}
                      whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                      style={{
                        padding: '8px 22px',
                        background: 'rgba(249,115,22,1)',
                        color: 'white',
                        border: 'none', borderRadius: 'var(--radius-md)', fontFamily: 'var(--font-sans)',
                        fontSize: 'var(--text-sm)', fontWeight: 500, cursor: 'pointer',
                      }}
                    >
                      {requiresCollab ? 'Ativar campanha' : 'Aprovar'}
                    </motion.button>
                    <motion.button
                      onClick={() => { onDismiss(rec.id); onClose() }}
                      whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                      style={{
                        padding: '8px 14px', background: 'transparent',
                        color: 'var(--color-text-tertiary)', border: '1px solid var(--color-border)',
                        borderRadius: 'var(--radius-md)', fontFamily: 'var(--font-sans)',
                        fontSize: 'var(--text-sm)', cursor: 'pointer',
                      }}
                    >
                      Agora não
                    </motion.button>
                    <motion.button
                      onClick={() => { onReject?.(rec.id); onClose() }}
                      whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                      style={{
                        padding: '8px 14px', background: 'transparent',
                        color: 'var(--color-error, #ef4444)', border: '1px solid var(--color-error, #ef4444)',
                        borderRadius: 'var(--radius-md)', fontFamily: 'var(--font-sans)',
                        fontSize: 'var(--text-sm)', cursor: 'pointer',
                      }}
                    >
                      Rejeitar
                    </motion.button>
                  </>
                )}
                {(rec.status === 'approved' || rec.status === 'executing') && (
                  <motion.button
                    onClick={() => { onCancel?.(rec.id); onClose() }}
                    whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                    style={{
                      padding: '8px 14px', background: 'transparent',
                      color: 'var(--color-error, #ef4444)', border: '1px solid var(--color-error, #ef4444)',
                      borderRadius: 'var(--radius-md)', fontFamily: 'var(--font-sans)',
                      fontSize: 'var(--text-sm)', cursor: 'pointer',
                    }}
                  >
                    Cancelar execução
                  </motion.button>
                )}
              </div>
            </div>
          </div>
        )}
      </motion.div>
    </>
  )
}

// ── Metrics ──────────────────────────────────────────────────────────────────

// SectionCard idêntico ao do Dashboard
function SectionCard({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{
      background: 'var(--color-bg-primary)',
      border: '1px solid var(--color-border)',
      borderRadius: 'var(--radius-lg)',
      boxShadow: 'var(--shadow-md)',
      ...style,
    }}>
      {children}
    </div>
  )
}



// Heatmap de aprovações — idêntico ao SalesHeatmap
function GrowthApprovalHeatmap({ counts }: { counts: Record<string, number> }) {
  const MONTHS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
  const DAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

  const data = (() => {
    const items: { date: Date; count: number }[] = []
    const today = new Date()
    for (let i = 111; i >= 0; i--) {
      const d = new Date()
      d.setDate(today.getDate() - i)
      const dateStr = d.toISOString().split('T')[0]!
      items.push({ date: d, count: counts[dateStr] || 0 })
    }
    return items
  })()

  const weeks = (() => {
    const result: { date: Date; count: number }[][] = []
    let current: { date: Date; count: number }[] = []
    const padding = data.length > 0 ? data[0].date.getDay() : 0
    for (let i = 0; i < padding; i++) current.push({ date: new Date(0), count: -1 })
    data.forEach(day => {
      current.push(day)
      if (current.length === 7) { result.push(current); current = [] }
    })
    if (current.length > 0) {
      while (current.length < 7) current.push({ date: new Date(0), count: -1 })
      result.push(current)
    }
    return result
  })()

  const getColor = (count: number) => {
    if (count === -1) return 'transparent'
    if (count === 0)  return 'var(--color-bg-tertiary)'
    if (count <= 1)   return 'rgba(255, 89, 0, 0.15)'
    if (count <= 2)   return 'rgba(255, 89, 0, 0.35)'
    if (count <= 3)   return 'rgba(255, 89, 0, 0.6)'
    return 'var(--color-primary)'
  }

  return (
    <div style={{ overflow: 'hidden' }}>
      <div style={{ display: 'flex', gap: 12 }}>
        {/* Day labels */}
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '24px 0 6px', height: 165 }}>
          {DAYS.map((d, i) => i % 2 === 1 && (
            <span key={d} style={{ fontFamily: 'var(--font-sans)', fontSize: 11, color: 'var(--color-text-tertiary)', lineHeight: 1 }}>{d}</span>
          ))}
        </div>
        <div style={{ flex: 1, overflowX: 'auto', scrollbarWidth: 'none' }}>
          <div style={{ display: 'flex', gap: 5 }}>
            {weeks.map((week, wi) => (
              <div key={wi} style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                {wi % 4 === 0 ? (
                  <span style={{ fontFamily: 'var(--font-sans)', fontSize: 11, color: 'var(--color-text-tertiary)', marginBottom: 6, height: 14, whiteSpace: 'nowrap' }}>
                    {MONTHS[week.find(d => d.count !== -1)?.date.getMonth() ?? 0]}
                  </span>
                ) : (
                  <div style={{ height: 20 }} />
                )}
                {week.map((day, di) => (
                  <motion.div
                    key={di}
                    whileHover={{ scale: 1.15, zIndex: 10 }}
                    title={day.count > 0 ? `${day.date.toLocaleDateString('pt-BR')}: ${day.count} ${day.count > 1 ? 'ações' : 'ação'}` : ''}
                    style={{
                      width: 20, height: 20, borderRadius: 3,
                      background: getColor(day.count),
                      cursor: day.count > 0 ? 'pointer' : 'default',
                      transition: 'background 0.3s',
                    }}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 16, justifyContent: 'flex-end' }}>
        <span style={{ fontFamily: 'var(--font-sans)', fontSize: 11, color: 'var(--color-text-tertiary)' }}>Menos</span>
        {[0, 1, 2, 3, 4].map(c => (
          <div key={c} style={{ width: 10, height: 10, borderRadius: 2, background: getColor(c) }} />
        ))}
        <span style={{ fontFamily: 'var(--font-sans)', fontSize: 11, color: 'var(--color-text-tertiary)' }}>Mais</span>
      </div>
    </div>
  )
}

// Gráfico de linhas — idêntico ao DailyTrendChart do Canais
function GrowthLineChart({ approved, dismissed }: { approved: number[]; dismissed: number[] }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [containerW, setContainerW] = useState(600)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const obs = new ResizeObserver(([entry]) => setContainerW(entry!.contentRect.width))
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  const POINTS = approved.length
  const H = 160, PAD_T = 10, PAD_B = 0
  const allVals = [...approved, ...dismissed].filter(v => v > 0)
  const rawMax = Math.max(...allVals, 1)
  const maxVal = rawMax * 1.18

  const dateLabels = Array.from({ length: POINTS }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - (POINTS - 1 - i))
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`
  })

  function xOf(i: number) {
    return POINTS <= 1 ? containerW / 2 : (i / (POINTS - 1)) * containerW
  }
  function yOf(v: number) {
    return PAD_T + (1 - v / maxVal) * (H - PAD_T - PAD_B)
  }

  // Catmull-Rom → Cubic Bezier, idêntico ao Canais
  function smoothLine(values: number[]): string {
    if (values.length < 2) return ''
    const pts = values.map((v, i) => ({ x: xOf(i), y: yOf(v) }))
    let d = `M ${pts[0].x.toFixed(1)},${pts[0].y.toFixed(1)}`
    const t = 0.38
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[Math.max(0, i - 1)]!
      const p1 = pts[i]!
      const p2 = pts[i + 1]!
      const p3 = pts[Math.min(pts.length - 1, i + 2)]!
      const cp1x = p1.x + (p2.x - p0.x) * t / 2
      const cp1y = p1.y + (p2.y - p0.y) * t / 2
      const cp2x = p2.x - (p3.x - p1.x) * t / 2
      const cp2y = p2.y - (p3.y - p1.y) * t / 2
      d += ` C ${cp1x.toFixed(1)},${cp1y.toFixed(1)} ${cp2x.toFixed(1)},${cp2y.toFixed(1)} ${p2.x.toFixed(1)},${p2.y.toFixed(1)}`
    }
    return d
  }
  function smoothArea(values: number[]): string {
    if (values.length < 2) return ''
    return `${smoothLine(values)} L ${xOf(values.length - 1).toFixed(1)},${H} L 0,${H} Z`
  }

  const series = [
    { key: 'approved',  values: approved,  color: '#FF5900',                    gradId: 'grad-growth-approved'  },
    { key: 'dismissed', values: dismissed, color: 'var(--color-text-tertiary)', gradId: 'grad-growth-dismissed' },
  ]

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      {containerW > 0 && (
        <svg width={containerW} height={H} style={{ display: 'block', overflow: 'visible' }}>
          <defs>
            {series.map(s => (
              <linearGradient key={s.gradId} id={s.gradId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%"   stopColor={s.color} stopOpacity="0.18" />
                <stop offset="85%"  stopColor={s.color} stopOpacity="0.04" />
                <stop offset="100%" stopColor={s.color} stopOpacity="0" />
              </linearGradient>
            ))}
          </defs>

          {/* Grid lines */}
          {[0.25, 0.5, 0.75, 1].map(pct => (
            <line key={pct}
              x1={0} y1={(PAD_T + (1 - pct) * (H - PAD_T)).toFixed(1)}
              x2={containerW} y2={(PAD_T + (1 - pct) * (H - PAD_T)).toFixed(1)}
              stroke="var(--color-border)" strokeWidth={1}
            />
          ))}

          {/* Y-axis max label */}
          <text x={4} y={(PAD_T + 3).toFixed(1)}
            fontFamily="var(--font-mono)" fontSize={8} fill="var(--color-text-tertiary)">
            {rawMax}
          </text>

          {/* Lines per series */}
          {series.map(s => (
            <g key={s.key}>
              <motion.path
                d={smoothArea(s.values)}
                fill={`url(#${s.gradId})`}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.5 }}
              />
              <motion.path
                d={smoothLine(s.values)}
                fill="none"
                stroke={s.color}
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                initial={{ pathLength: 0, opacity: 0 }}
                animate={{ pathLength: 1, opacity: 1 }}
                transition={{ duration: 1.1, ease: [0.25, 0.1, 0.25, 1] }}
              />
              {/* End-point dot */}
              <motion.circle
                cx={xOf(s.values.length - 1).toFixed(1)}
                cy={yOf(s.values[s.values.length - 1] ?? 0).toFixed(1)}
                r={3} fill={s.color}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.9, duration: 0.3 }}
              />
            </g>
          ))}
        </svg>
      )}

      {/* Date axis — 3 labels igual ao Canais */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
        {[0, Math.floor((POINTS - 1) / 2), POINTS - 1].map(i => (
          <span key={i} style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--color-text-tertiary)' }}>
            {dateLabels[i]}
          </span>
        ))}
      </div>
    </div>
  )
}

function GrowthMetrics({ recommendations }: { recommendations: Recommendation[] }) {
  const approvedCount  = recommendations.filter(r => ['approved', 'executing', 'completed'].includes(r.status)).length
  const dismissedCount = recommendations.filter(r => r.status === 'dismissed').length
  const pendingCount   = recommendations.filter(r => r.status === 'pending').length

  // Heatmap de aprovações — derivado das recommendations reais
  const approvalHeatmap = useMemo(() => {
    const result: Record<string, number> = {}
    recommendations
      .filter(r => ['approved', 'executing', 'completed'].includes(r.status))
      .forEach(r => {
        const date = r.updated_at.split('T')[0]
        if (date) result[date] = (result[date] || 0) + 1
      })
    return result
  }, [recommendations])

  // Ações por tipo — contagem real
  const actionsByType = useMemo(() => {
    const counts: Record<string, number> = {}
    recommendations.forEach(r => {
      const label = TYPE_LABELS[r.type] || r.type
      counts[label] = (counts[label] || 0) + 1
    })
    return Object.entries(counts)
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)
  }, [recommendations])

  const totalActions = actionsByType.reduce((s, d) => s + d.count, 0)

  // Linha — aprovadas e rejeitadas por dia (últimos 15 dias)
  const lineData = useMemo(() => {
    const approvedLine: number[] = []
    const dismissedLine: number[] = []
    for (let i = 14; i >= 0; i--) {
      const d = new Date()
      d.setDate(d.getDate() - i)
      const dateStr = d.toISOString().split('T')[0]!
      approvedLine.push(recommendations.filter(r =>
        ['approved', 'executing', 'completed'].includes(r.status) && r.updated_at.startsWith(dateStr)
      ).length)
      dismissedLine.push(recommendations.filter(r =>
        r.status === 'dismissed' && r.updated_at.startsWith(dateStr)
      ).length)
    }
    return { approved: approvedLine, dismissed: dismissedLine }
  }, [recommendations])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

      {/* KPIs — mesmo padrão do Dashboard: repeat(4, 1fr) */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.25, 0.1, 0.25, 1] }}
        style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}
      >
        <KpiCard label="Ações identificadas" value={approvedCount + dismissedCount + pendingCount} decimals={0} delay={0.05} />
        <KpiCard label="Aprovadas"  value={approvedCount}  decimals={0} delay={0.1} />
        <KpiCard label="Rejeitadas" value={dismissedCount} decimals={0} delay={0.15} />
        <KpiCard label="Taxa de aprovação" value={approvedCount + dismissedCount > 0 ? Math.round(approvedCount / (approvedCount + dismissedCount) * 100) : 0} suffix="%" decimals={0} delay={0.2} />
      </motion.div>

      {/* Linha 2: Aprovações x Rejeições  +  Impacto por tipo */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1, ease: [0.25, 0.1, 0.25, 1] }}
        style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}
      >
        {/* Heatmap de aprovações — idêntico ao SalesHeatmap do Dashboard */}
        <SectionCard style={{ padding: '20px 24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <p style={{
              fontFamily: 'var(--font-sans)', fontSize: 11, fontWeight: 400,
              color: 'var(--color-text-secondary)', letterSpacing: '0.02em',
              textTransform: 'uppercase', margin: 0,
            }}>
              Atividade de aprovações
            </p>
            <span style={{
              fontFamily: 'var(--font-sans)', fontSize: 11, color: 'var(--color-text-tertiary)',
              background: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-full)', padding: '1px 7px', fontWeight: 400,
            }}>
              112 dias
            </span>
          </div>
          <GrowthApprovalHeatmap counts={approvalHeatmap} />
        </SectionCard>

        {/* Ações por tipo — derivado das recommendations reais */}
        <SectionCard style={{ padding: '20px 24px' }}>
          <p style={{
            fontFamily: 'var(--font-sans)', fontSize: 11, fontWeight: 400,
            color: 'var(--color-text-secondary)', letterSpacing: '0.02em',
            textTransform: 'uppercase', margin: '0 0 4px',
          }}>
            Ações por tipo
          </p>
          <p style={{
            fontFamily: 'var(--font-sans)', fontSize: 22, fontWeight: 500,
            letterSpacing: '-0.4px', color: 'var(--color-text-primary)', margin: '0 0 16px',
          }}>
            {totalActions} ação{totalActions !== 1 ? 'ões' : ''} identificada{totalActions !== 1 ? 's' : ''}
          </p>
          {actionsByType.length === 0 ? (
            <p style={{ fontFamily: 'var(--font-sans)', fontSize: 13, color: 'var(--color-text-tertiary)', margin: 0 }}>
              Sem dados ainda.
            </p>
          ) : actionsByType.map((row, i, arr) => {
            const pct = totalActions > 0 ? Math.round((row.count / totalActions) * 100) : 0
            return (
              <motion.div
                key={row.label}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.15 + i * 0.06, ease: [0.25, 0.1, 0.25, 1] }}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '11px 0',
                  borderBottom: i < arr.length - 1 ? '1px solid var(--color-border)' : 'none',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--color-primary)', flexShrink: 0 }} />
                  <span style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-base)', fontWeight: 400, color: 'var(--color-text-primary)', letterSpacing: '-0.1px' }}>
                    {row.label}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-xs)', fontWeight: 400, color: 'var(--color-text-tertiary)', minWidth: 32, textAlign: 'right' as const }}>
                    {pct}%
                  </span>
                  <span style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-base)', fontWeight: 500, color: 'var(--color-text-primary)', minWidth: 28, textAlign: 'right' as const }}>
                    {row.count}
                  </span>
                </div>
              </motion.div>
            )
          })}
        </SectionCard>
      </motion.div>

      {/* Linha 3: Histórico semanal — SVG bar chart estilo RevenueChart */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
      >
        <SectionCard style={{ padding: '20px 24px 16px' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
            <div>
              <p style={{
                fontFamily: 'var(--font-sans)', fontSize: 11, fontWeight: 400,
                color: 'var(--color-text-secondary)', letterSpacing: '0.02em',
                textTransform: 'uppercase', margin: '0 0 4px',
              }}>
                Decisões por semana
              </p>
              <span style={{ fontFamily: 'var(--font-sans)', fontSize: 22, fontWeight: 500, letterSpacing: '-0.4px', color: 'var(--color-text-primary)', display: 'block' }}>
                Últimas 6 semanas
              </span>
            </div>
            <div style={{ display: 'flex', gap: 14, marginTop: 4 }}>
              {[
                { label: 'Aprovadas', color: 'var(--color-primary)' },
                { label: 'Rejeitadas', color: 'var(--color-text-tertiary)' },
              ].map(l => (
                <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <span style={{ width: 8, height: 8, borderRadius: 2, background: l.color, flexShrink: 0 }} />
                  <span style={{ fontFamily: 'var(--font-sans)', fontSize: 11, color: 'var(--color-text-tertiary)' }}>{l.label}</span>
                </div>
              ))}
            </div>
          </div>
          <GrowthLineChart approved={lineData.approved} dismissed={lineData.dismissed} />
        </SectionCard>
      </motion.div>

    </div>
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
        background: 'var(--accent-green)', marginBottom: 8, boxShadow: '0 0 0 4px var(--status-complete-bg)',
      }} />
      <p style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', fontWeight: 500, color: 'var(--color-text-primary)', margin: 0 }}>
        Nenhuma ação crítica identificada
      </p>
      <p style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)', margin: 0 }}>
        Próxima análise em &lt;30min
      </p>
    </motion.div>
  )
}

// ── Main Page ──────────────────────────────────────────────────────────────────

export default function Growth() {
  const [recommendations, setRecommendations] = useState<Recommendation[]>([])
  const [loading, setLoading] = useState(true)
  const [executionHistory, setExecutionHistory] = useState<ExecutionHistoryItem[]>([])
  const [historyLoading, setHistoryLoading] = useState(true)

  const [growthTab, setGrowthTab] = useState<'metricas' | 'execucoes' | 'exploracao'>('metricas')
  const [selectedRec, setSelectedRec] = useState<Recommendation | null>(null)
  const [collabRec, setCollabRec] = useState<Recommendation | null>(null)
  const pollingRefs = useRef<Record<string, ReturnType<typeof setInterval>>>({})
  const pollingErrorCounts = useRef<Record<string, number>>({})

  const TABS = [
    { key: 'metricas',   label: 'Métricas'   },
    { key: 'execucoes',  label: 'Execuções'  },
    { key: 'exploracao', label: 'Exploração' },
  ] as const

  const fetchData = useCallback(async () => {
    try {
      const recRes = await growthApi.listRecommendations()
      setRecommendations(recRes.data ?? [])
    } catch {
      setRecommendations([])
    } finally {
      setLoading(false)
    }
  }, [])

  // Histórico de campanhas — carregado uma vez na montagem
  useEffect(() => {
    growthApi.getExecutionHistory()
      .then(res => setExecutionHistory(res.data ?? []))
      .catch(() => setExecutionHistory([]))
      .finally(() => setHistoryLoading(false))
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
    stopPolling(id)
    pollingErrorCounts.current[id] = 0
    pollingRefs.current[id] = setInterval(async () => {
      try {
        const res = await growthApi.getStatus(id)
        pollingErrorCounts.current[id] = 0
        const { status, execution_log } = res.data
        setRecommendations(prev => prev.map(r =>
          r.id === id ? { ...r, status, execution_log: execution_log || [] } : r
        ))
        if (status === 'completed' || status === 'failed') stopPolling(id)
      } catch {
        pollingErrorCounts.current[id] = (pollingErrorCounts.current[id] || 0) + 1
        if (pollingErrorCounts.current[id] >= 15) {
          stopPolling(id)
          setRecommendations(prev => prev.map(r =>
            r.id === id && r.status === 'executing'
              ? { ...r, status: 'failed' as RecStatus, execution_log: [...(r.execution_log || []), { step: 'Conexão perdida após múltiplas tentativas', status: 'failed' as const, timestamp: new Date().toISOString() }] }
              : r
          ))
        }
      }
    }, 2000)
  }, [stopPolling])

  const handleApprove = useCallback(async (id: string) => {
    const rec = recommendations.find(r => r.id === id)
    if (!rec) return

    if (COLLABORATION_REQUIRED.includes(rec.type)) {
      setCollabRec(rec)
      setSelectedRec(null)
      return
    }

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
  }, [recommendations, startPolling])

  const handleDismiss = async (id: string) => {
    setRecommendations(prev => prev.filter(r => r.id !== id))
    try { await growthApi.dismiss(id) } catch { /* silently ok */ }
  }

  const handleReject = async (id: string) => {
    setRecommendations(prev => prev.map(r =>
      r.id === id ? { ...r, status: 'rejected' as RecStatus } : r
    ))
    try { await growthApi.reject(id) } catch { /* silently ok */ }
  }

  const handleCancel = async (id: string) => {
    setRecommendations(prev => prev.map(r =>
      r.id === id ? { ...r, status: 'cancelled' as RecStatus } : r
    ))
    try { await growthApi.cancel(id) } catch { /* silently ok */ }
  }

  const pendingRecs = recommendations.filter(r => r.status === 'pending')
  const activeRecs = recommendations.filter(r => ['approved', 'executing', 'completed', 'failed', 'cancelled'].includes(r.status))
  return (
    <motion.div
      style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}
    >
      {/* Header — apenas h1 + pill subnav */}
      <div style={{ padding: '28px 32px 20px', flexShrink: 0 }}>
        <h1 style={{
          fontFamily: 'var(--font-sans)', fontWeight: 500, fontSize: 'var(--text-3xl)',
          letterSpacing: '-0.5px', color: 'var(--color-text-primary)',
          lineHeight: 1.1, margin: '0 0 4px',
        }}>
          Growth
        </h1>
        <p style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', color: 'var(--color-text-tertiary)', margin: '0 0 16px', lineHeight: 1.5 }}>
          Ações identificadas pela IA, prontas para você aprovar.
        </p>

        {/* Pill subnav — idêntico ao Canais */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px', background: 'var(--color-bg-secondary)', borderRadius: 10, width: 'fit-content', border: '1px solid var(--color-border)' }}>
          {TABS.map(tab => {
            const isActive = growthTab === tab.key
            const badge = tab.key === 'execucoes' && pendingRecs.length > 0 ? pendingRecs.length : null
            return (
              <motion.button
                key={tab.key}
                onClick={() => setGrowthTab(tab.key)}
                whileTap={{ scale: 0.97 }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  fontFamily: 'var(--font-sans)', fontSize: 13,
                  fontWeight: isActive ? 500 : 400,
                  color: isActive ? 'var(--color-text-primary)' : 'var(--color-text-tertiary)',
                  background: isActive ? 'var(--color-bg-primary)' : 'transparent',
                  border: isActive ? '1px solid var(--color-border)' : '1px solid transparent',
                  borderRadius: 7, padding: '6px 16px', cursor: 'pointer',
                  transition: 'all 0.15s ease', letterSpacing: '-0.1px',
                }}
              >
                {tab.label}
                {badge && (
                  <span style={{
                    fontFamily: 'var(--font-sans)', fontSize: 10, fontWeight: 600,
                    color: 'white', background: 'var(--color-primary)',
                    borderRadius: 99, padding: '1px 6px', lineHeight: 1.4,
                  }}>{badge}</span>
                )}
              </motion.button>
            )
          })}
        </div>
      </div>

      {/* Content */}
      <AnimatePresence mode="wait">
        {growthTab === 'exploracao' ? (
          <motion.div
            key="exploracao"
            style={{ flex: 1, overflow: 'hidden' }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <GrowthChatComponent />
          </motion.div>
        ) : growthTab === 'metricas' ? (
          <motion.div
            key="metricas"
            style={{ flex: 1, overflowY: 'auto', padding: '24px 32px', scrollbarWidth: 'thin' as any }}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.25, 0.1, 0.25, 1] }}
          >
            <GrowthMetrics recommendations={recommendations} />
          </motion.div>
        ) : (
          <motion.div
            key="execucoes"
            style={{ flex: 1, overflowY: 'auto', padding: '24px 32px', scrollbarWidth: 'thin' as any }}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.25, 0.1, 0.25, 1] }}
          >
            {loading ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
                  {[1, 2, 3, 4].map(i => (
                    <div key={i} style={{ height: 82, borderRadius: 'var(--radius-lg)', background: 'var(--color-bg-primary)', border: '1px solid var(--color-border)', opacity: 0.6 }} />
                  ))}
                </div>
                <div style={{ height: 220, borderRadius: 'var(--radius-lg)', background: 'var(--color-bg-primary)', border: '1px solid var(--color-border)', opacity: 0.6 }} />
              </div>
            ) : (() => {
              const completedCount  = recommendations.filter(r => r.status === 'completed').length
              const dismissedCount2 = recommendations.filter(r => r.status === 'dismissed').length

              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

                  {/* KPIs — repeat(4, 1fr) igual ao Métricas */}
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, ease: [0.25, 0.1, 0.25, 1] }}
                    style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}
                  >
                    <KpiCard label="Aguardando aprovação" value={pendingRecs.length}  decimals={0} delay={0.05} />
                    <KpiCard label="Em execução"          value={activeRecs.length}   decimals={0} delay={0.1}  />
                    <KpiCard label="Concluídas"           value={completedCount}      decimals={0} delay={0.15} />
                    <KpiCard label="Ignoradas"            value={dismissedCount2}     decimals={0} delay={0.2}  />
                  </motion.div>

                  {/* Aguardando aprovação */}
                  {pendingRecs.length > 0 ? (
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.4, delay: 0.1, ease: [0.25, 0.1, 0.25, 1] }}
                    >
                      <SectionCard style={{ padding: '20px 24px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                          <p style={{
                            fontFamily: 'var(--font-sans)', fontSize: 11, fontWeight: 400,
                            color: 'var(--color-text-secondary)', letterSpacing: '0.02em',
                            textTransform: 'uppercase' as const, margin: 0,
                          }}>
                            Aguardando aprovação
                          </p>
                          <span style={{
                            fontFamily: 'var(--font-sans)', fontSize: 11, color: 'var(--color-text-tertiary)',
                            background: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)',
                            borderRadius: 'var(--radius-full)', padding: '1px 7px', fontWeight: 400,
                          }}>
                            {pendingRecs.length} {pendingRecs.length > 1 ? 'ações' : 'ação'}
                          </span>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                          <AnimatePresence>
                            {pendingRecs.map(rec => (
                              <RecommendationCard key={rec.id} rec={rec} onClick={() => setSelectedRec(rec)} />
                            ))}
                          </AnimatePresence>
                        </div>
                      </SectionCard>
                    </motion.div>
                  ) : (
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.4, delay: 0.1, ease: [0.25, 0.1, 0.25, 1] }}
                    >
                      <SectionCard style={{ padding: '32px 24px' }}>
                        <p style={{
                          fontFamily: 'var(--font-sans)',
                          fontSize: 'var(--text-sm)',
                          color: 'var(--color-text-tertiary)',
                          margin: 0,
                          textAlign: 'center' as const,
                          lineHeight: 1.6,
                        }}>
                          Nenhuma recomendação ativa. O motor de correlações analisa seus dados diariamente e gera recomendações automaticamente.
                        </p>
                      </SectionCard>
                    </motion.div>
                  )}

                  {/* Em execução */}
                  {activeRecs.length > 0 && (
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.4, delay: 0.15, ease: [0.25, 0.1, 0.25, 1] }}
                    >
                      <SectionCard style={{ padding: '20px 24px' }}>
                        <p style={{
                          fontFamily: 'var(--font-sans)', fontSize: 11, fontWeight: 400,
                          color: 'var(--color-text-secondary)', letterSpacing: '0.02em',
                          textTransform: 'uppercase' as const, margin: '0 0 16px',
                        }}>
                          Em execução
                        </p>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                          <AnimatePresence>
                            {activeRecs.map(rec => (
                              <RecommendationCard key={rec.id} rec={rec} onClick={() => setSelectedRec(rec)} />
                            ))}
                          </AnimatePresence>
                        </div>
                      </SectionCard>
                    </motion.div>
                  )}

                  {/* Histórico de campanhas */}
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, delay: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
                    style={{ paddingTop: 18 }}
                  >
                    <SectionCard style={{ padding: '20px 24px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                        <p style={{
                          fontFamily: 'var(--font-sans)', fontSize: 11, fontWeight: 400,
                          color: 'var(--color-text-secondary)', letterSpacing: '0.02em',
                          textTransform: 'uppercase' as const, margin: 0,
                        }}>
                          Histórico de campanhas
                        </p>
                        {!historyLoading && executionHistory.length > 0 && (
                          <span style={{
                            fontFamily: 'var(--font-sans)', fontSize: 11, color: 'var(--color-text-tertiary)',
                            background: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)',
                            borderRadius: 'var(--radius-full)', padding: '1px 7px', fontWeight: 400,
                          }}>
                            {executionHistory.length} {executionHistory.length > 1 ? 'campanhas' : 'campanha'}
                          </span>
                        )}
                      </div>
                      <ExecutionHistory items={executionHistory} loading={historyLoading} />
                    </SectionCard>
                  </motion.div>

                  {activeRecs.length === 0 && <GrowthEmptyState />}
                </div>
              )
            })()}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Detail drawer */}
      <AnimatePresence>
        {selectedRec && (
          <RecDetailDrawer
            rec={selectedRec}
            onClose={() => setSelectedRec(null)}
            onApprove={(id) => { handleApprove(id); setSelectedRec(null) }}
            onDismiss={(id) => { handleDismiss(id); setSelectedRec(null) }}
            onReject={(id) => { handleReject(id); setSelectedRec(null) }}
            onCancel={(id) => { handleCancel(id); setSelectedRec(null) }}
          />
        )}
      </AnimatePresence>

      {/* Collaboration modal */}
      <AnimatePresence>
        {collabRec && (
          <CollaborationModal
            key={collabRec.id}
            recommendationId={collabRec.id}
            recommendationType={collabRec.type}
            recommendationTitle={collabRec.title}
            onClose={() => setCollabRec(null)}
            onExecutionComplete={() => {
              setCollabRec(null)
              fetchData()
            }}
          />
        )}
      </AnimatePresence>
    </motion.div>
  )
}
