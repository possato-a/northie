import { motion } from 'framer-motion'

// ── Types ──────────────────────────────────────────────────────────────────────

export interface ExecutionHistoryItem {
  recommendation_id: string
  type: string
  title: string
  rec_status: 'completed' | 'failed' | 'executing'
  rec_created_at: string
  total_items: number
  sent_count: number
  delivered_count: number
  failed_count: number
  converted_count: number
  last_activity: string | null
}

interface ExecutionHistoryProps {
  items: ExecutionHistoryItem[]
  loading: boolean
}

// ── Constants ──────────────────────────────────────────────────────────────────

const TYPE_LABELS: Record<string, string> = {
  reativacao_alto_ltv:           'Reativação',
  pausa_campanha_ltv_baixo:      'Campanha',
  audience_sync_champions:       'Audiência',
  realocacao_budget:             'Budget',
  upsell_cohort:                 'Upsell',
  divergencia_roi_canal:         'ROI',
  queda_retencao_cohort:         'Retenção',
  canal_alto_ltv_underinvested:  'Oportunidade',
  cac_vs_ltv_deficit:            'Payback',
  em_risco_alto_valor:           'Em Risco',
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function relativeDate(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins  = Math.floor(diff / 60_000)
  const hours = Math.floor(diff / 3_600_000)
  const days  = Math.floor(diff / 86_400_000)
  if (mins  < 1)   return 'agora'
  if (mins  < 60)  return `${mins}min atrás`
  if (hours < 24)  return `${hours}h atrás`
  if (days  < 7)   return `${days}d atrás`
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
}

function pct(part: number, total: number): string {
  if (total === 0) return '0%'
  return `${Math.round((part / total) * 100)}%`
}

// ── Sub-components ──────────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div style={{
      background: 'var(--color-bg-primary)',
      border: '1px solid var(--color-border)',
      borderRadius: 'var(--radius-lg)',
      padding: '14px 16px',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <motion.div
            animate={{ opacity: [0.4, 0.7, 0.4] }}
            transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
            style={{ width: 52, height: 18, borderRadius: 99, background: 'var(--color-bg-secondary)' }}
          />
          <motion.div
            animate={{ opacity: [0.4, 0.7, 0.4] }}
            transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut', delay: 0.1 }}
            style={{ width: 120, height: 14, borderRadius: 4, background: 'var(--color-bg-secondary)' }}
          />
        </div>
        <motion.div
          animate={{ opacity: [0.4, 0.7, 0.4] }}
          transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut', delay: 0.2 }}
          style={{ width: 48, height: 14, borderRadius: 4, background: 'var(--color-bg-secondary)' }}
        />
      </div>
      <motion.div
        animate={{ opacity: [0.4, 0.7, 0.4] }}
        transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut', delay: 0.15 }}
        style={{ width: '100%', height: 6, borderRadius: 99, background: 'var(--color-bg-secondary)', marginBottom: 10 }}
      />
      <div style={{ display: 'flex', gap: 16 }}>
        {[80, 96, 64, 72].map((w, i) => (
          <motion.div
            key={i}
            animate={{ opacity: [0.4, 0.7, 0.4] }}
            transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut', delay: 0.05 * i }}
            style={{ width: w, height: 12, borderRadius: 4, background: 'var(--color-bg-secondary)' }}
          />
        ))}
      </div>
    </div>
  )
}

function StatusBadge({ status }: { status: ExecutionHistoryItem['rec_status'] }) {
  if (status === 'completed') {
    return (
      <span style={{
        fontFamily: 'var(--font-mono)',
        fontSize: 10,
        fontWeight: 500,
        letterSpacing: '0.04em',
        color: '#16A34A',
        background: 'rgba(22,163,74,0.08)',
        border: '1px solid rgba(22,163,74,0.2)',
        borderRadius: 99,
        padding: '2px 7px',
        whiteSpace: 'nowrap' as const,
      }}>
        Concluída
      </span>
    )
  }
  if (status === 'failed') {
    return (
      <span style={{
        fontFamily: 'var(--font-mono)',
        fontSize: 10,
        fontWeight: 500,
        letterSpacing: '0.04em',
        color: '#DC2626',
        background: 'rgba(220,38,38,0.08)',
        border: '1px solid rgba(220,38,38,0.2)',
        borderRadius: 99,
        padding: '2px 7px',
        whiteSpace: 'nowrap' as const,
      }}>
        Falhou
      </span>
    )
  }
  // executing
  return (
    <span style={{
      fontFamily: 'var(--font-mono)',
      fontSize: 10,
      fontWeight: 500,
      letterSpacing: '0.04em',
      color: '#D97706',
      background: 'rgba(217,119,6,0.08)',
      border: '1px solid rgba(217,119,6,0.2)',
      borderRadius: 99,
      padding: '2px 7px',
      display: 'inline-flex',
      alignItems: 'center',
      gap: 4,
      whiteSpace: 'nowrap' as const,
    }}>
      <motion.span
        animate={{ opacity: [1, 0.3, 1] }}
        transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
        style={{
          display: 'block',
          width: 5,
          height: 5,
          borderRadius: '50%',
          background: '#D97706',
          flexShrink: 0,
        }}
      />
      Executando
    </span>
  )
}

function ProgressBar({ sent, delivered, failed, total }: {
  sent: number
  delivered: number
  failed: number
  total: number
}) {
  if (total === 0) return null

  const deliveredPct = (delivered / total) * 100
  const failedPct    = (failed / total) * 100
  const pendingPct   = Math.max(0, ((sent - delivered - failed) / total) * 100)

  return (
    <div style={{
      width: '100%',
      height: 5,
      borderRadius: 99,
      background: 'var(--color-bg-secondary)',
      overflow: 'hidden',
      display: 'flex',
    }}>
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: `${deliveredPct}%` }}
        transition={{ duration: 0.6, ease: [0.25, 0.1, 0.25, 1] }}
        style={{ height: '100%', background: '#16A34A', flexShrink: 0 }}
      />
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: `${pendingPct}%` }}
        transition={{ duration: 0.6, delay: 0.1, ease: [0.25, 0.1, 0.25, 1] }}
        style={{ height: '100%', background: 'rgba(55,53,47,0.18)', flexShrink: 0 }}
      />
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: `${failedPct}%` }}
        transition={{ duration: 0.6, delay: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
        style={{ height: '100%', background: '#DC2626', flexShrink: 0 }}
      />
    </div>
  )
}

function HistoryCard({ item, index }: { item: ExecutionHistoryItem; index: number }) {
  const typeLabel = TYPE_LABELS[item.type] ?? item.type

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: index * 0.05, ease: [0.25, 0.1, 0.25, 1] }}
      whileHover={{ backgroundColor: 'rgba(55,53,47,0.03)' }}
      style={{
        background: '#FFFFFF',
        border: '1px solid rgba(55,53,47,0.09)',
        borderRadius: 'var(--radius-lg)',
        padding: '14px 16px',
        cursor: 'default',
        transition: 'background 0.15s ease',
      }}
    >
      {/* Linha 1: badge de tipo + título + data + status */}
      <div style={{
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: 8,
        marginBottom: 10,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 0, flex: 1 }}>
          <span style={{
            fontFamily: 'var(--font-sans)',
            fontSize: 11,
            fontWeight: 500,
            color: '#FF5900',
            background: 'rgba(255,89,0,0.08)',
            border: '1px solid rgba(255,89,0,0.15)',
            borderRadius: 99,
            padding: '2px 8px',
            flexShrink: 0,
            lineHeight: 1.5,
          }}>
            {typeLabel}
          </span>
          <span style={{
            fontFamily: 'var(--font-sans)',
            fontSize: 13,
            fontWeight: 500,
            color: 'var(--color-text-primary)',
            letterSpacing: '-0.15px',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap' as const,
          }}>
            {item.title}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <span style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 10,
            color: 'var(--color-text-tertiary)',
          }}>
            {relativeDate(item.rec_created_at)}
          </span>
          <StatusBadge status={item.rec_status} />
        </div>
      </div>

      {/* Barra de progresso */}
      <div style={{ marginBottom: 10 }}>
        <ProgressBar
          sent={item.sent_count}
          delivered={item.delivered_count}
          failed={item.failed_count}
          total={item.total_items}
        />
      </div>

      {/* Linha 2: métricas inline */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' as const }}>
        <span style={{
          fontFamily: 'var(--font-sans)',
          fontSize: 12,
          color: 'var(--color-text-secondary)',
          display: 'flex',
          alignItems: 'center',
          gap: 4,
        }}>
          <span style={{ fontSize: 11 }}>Enviados</span>
          <span style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>
            {item.sent_count.toLocaleString('pt-BR')}
          </span>
        </span>

        <span style={{
          fontFamily: 'var(--font-sans)',
          fontSize: 12,
          color: 'var(--color-text-secondary)',
          display: 'flex',
          alignItems: 'center',
          gap: 4,
        }}>
          <span style={{ fontSize: 11, color: '#16A34A' }}>Entregues</span>
          <span style={{ fontWeight: 600, color: '#16A34A' }}>
            {item.delivered_count.toLocaleString('pt-BR')}
          </span>
          {item.sent_count > 0 && (
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--color-text-tertiary)' }}>
              ({pct(item.delivered_count, item.sent_count)})
            </span>
          )}
        </span>

        {item.failed_count > 0 && (
          <span style={{
            fontFamily: 'var(--font-sans)',
            fontSize: 12,
            color: '#DC2626',
            display: 'flex',
            alignItems: 'center',
            gap: 4,
          }}>
            <span style={{ fontSize: 11 }}>Falhas</span>
            <span style={{ fontWeight: 600 }}>
              {item.failed_count.toLocaleString('pt-BR')}
            </span>
          </span>
        )}

        {item.converted_count > 0 && (
          <span style={{
            fontFamily: 'var(--font-sans)',
            fontSize: 12,
            color: '#FF5900',
            display: 'flex',
            alignItems: 'center',
            gap: 4,
          }}>
            <span style={{ fontSize: 11 }}>Convertidos</span>
            <span style={{ fontWeight: 600 }}>
              {item.converted_count.toLocaleString('pt-BR')}
            </span>
          </span>
        )}

        {item.total_items === 0 && (
          <span style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            color: 'var(--color-text-tertiary)',
            fontStyle: 'italic',
          }}>
            sem itens de execução
          </span>
        )}
      </div>
    </motion.div>
  )
}

// ── Main Component ──────────────────────────────────────────────────────────────

export default function ExecutionHistory({ items, loading }: ExecutionHistoryProps) {
  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {[0, 1, 2].map(i => <SkeletonCard key={i} />)}
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 8,
          padding: '32px 24px',
          textAlign: 'center' as const,
        }}
      >
        <div style={{
          width: 40,
          height: 40,
          borderRadius: 'var(--radius-lg)',
          background: 'var(--color-bg-secondary)',
          border: '1px solid var(--color-border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 4,
        }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.35 }}>
            <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" />
            <rect x="9" y="3" width="6" height="4" rx="1" />
            <line x1="9" y1="12" x2="15" y2="12" />
            <line x1="9" y1="16" x2="12" y2="16" />
          </svg>
        </div>
        <p style={{
          fontFamily: 'var(--font-sans)',
          fontSize: 'var(--text-base)',
          fontWeight: 500,
          color: 'var(--color-text-secondary)',
          margin: 0,
        }}>
          Nenhuma campanha executada ainda
        </p>
        <p style={{
          fontFamily: 'var(--font-sans)',
          fontSize: 'var(--text-sm)',
          color: 'var(--color-text-tertiary)',
          margin: 0,
          maxWidth: 340,
          lineHeight: 1.6,
        }}>
          Aprove uma recomendação para começar. O resultado de cada campanha aparece aqui.
        </p>
      </motion.div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {items.map((item, i) => (
        <HistoryCard key={item.recommendation_id} item={item} index={i} />
      ))}
    </div>
  )
}
