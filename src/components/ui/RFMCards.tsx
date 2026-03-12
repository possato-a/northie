import { useMemo } from 'react'
import { motion } from 'framer-motion'
import { fmtBR } from '../../lib/utils'
import type { ClientUI, RFMSegment } from '../../types'

// ── Config ────────────────────────────────────────────────────────────────────

export interface RFMConfig {
  label: string
  criteria: string
  action: string
  color: string
  bgColor: string
  description: string
}

export const RFM_CONFIG: Record<RFMSegment, RFMConfig> = {
  'Champions': {
    label: 'Champions',
    criteria: 'R ≥ 4 · F ≥ 3 · M ≥ 3',
    description: 'Compraram recentemente, compram com frequência e gastam muito. São o núcleo do negócio.',
    action: 'Criar Lookalike no Meta com base nesse segmento. Oferecer upsell imediato — esses clientes têm a maior probabilidade de conversão.',
    color: 'var(--status-complete)',
    bgColor: 'var(--status-complete-bg)',
  },
  'Novos Promissores': {
    label: 'Novos Promissores',
    criteria: 'Compra recente · Score médio',
    description: 'Compraram recentemente mas ainda têm frequência e ticket baixos. Janela de nurturing aberta.',
    action: 'Nurturing pós-compra nos primeiros 30 dias. Apresentar produto complementar antes da janela de inatividade fechar.',
    color: 'var(--color-primary)',
    bgColor: 'var(--color-primary-light)',
  },
  'Em Risco': {
    label: 'Em Risco',
    criteria: 'R ≤ 2 com F ≥ 3 ou M ≥ 3',
    description: 'Foram bons clientes mas estão sumindo. Já compraram bastante — o risco de perda é alto.',
    action: 'Campanha de reativação urgente via WhatsApp. Janela de recuperação curta — agir em até 7 dias.',
    color: 'var(--status-planning)',
    bgColor: 'var(--status-planning-bg)',
  },
  'Inativos': {
    label: 'Inativos',
    criteria: 'Média RFM ≤ 2',
    description: 'Pouca recência, frequência e valor. Custo de reativação pode superar o retorno esperado.',
    action: 'Winback com oferta agressiva ou exclusão da lista de remarketing para reduzir CAC.',
    color: 'var(--color-text-tertiary)',
    bgColor: 'var(--color-bg-tertiary)',
  },
}

export const SEGMENTS: RFMSegment[] = ['Champions', 'Novos Promissores', 'Em Risco', 'Inativos']

// ── Component ─────────────────────────────────────────────────────────────────

interface RFMCardsProps {
  clients: ClientUI[]
  onSelect: (seg: RFMSegment) => void
}

export default function RFMCards({ clients, onSelect }: RFMCardsProps) {
  const stats = useMemo(() => {
    const result: Record<RFMSegment, { count: number; ltvSum: number; churnSum: number; revenue: number }> = {
      'Champions':         { count: 0, ltvSum: 0, churnSum: 0, revenue: 0 },
      'Em Risco':          { count: 0, ltvSum: 0, churnSum: 0, revenue: 0 },
      'Novos Promissores': { count: 0, ltvSum: 0, churnSum: 0, revenue: 0 },
      'Inativos':          { count: 0, ltvSum: 0, churnSum: 0, revenue: 0 },
    }
    clients.forEach(c => {
      result[c.segment].count++
      result[c.segment].ltvSum += c.ltv
      result[c.segment].churnSum += c.churnProb
      result[c.segment].revenue += c.totalSpent
    })
    return result
  }, [clients])

  const totalClients = clients.length || 1

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {/* Distribution bar */}
      <div style={{ display: 'flex', height: 4, borderRadius: 4, overflow: 'hidden', gap: 2, marginBottom: 4 }}>
        {SEGMENTS.map(seg => {
          const pct = (stats[seg].count / totalClients) * 100
          return (
            <motion.div
              key={seg}
              initial={{ width: 0 }}
              animate={{ width: `${pct}%` }}
              transition={{ duration: 0.7, ease: [0.25, 0.1, 0.25, 1] }}
              style={{ height: '100%', background: RFM_CONFIG[seg].color, borderRadius: 2, flexShrink: 0 }}
            />
          )
        })}
      </div>

      {/* Segment blocks */}
      {SEGMENTS.map((seg, ri) => {
        const cfg = RFM_CONFIG[seg]
        const d = stats[seg]
        const pct = Math.round((d.count / totalClients) * 100)
        const avgLtv = d.count > 0 ? d.ltvSum / d.count : 0
        const avgChurn = d.count > 0 ? (d.churnSum / d.count) * 100 : 0

        return (
          <motion.button
            key={seg}
            onClick={() => onSelect(seg)}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: ri * 0.07 }}
            whileHover={{ scale: 1.005 }}
            whileTap={{ scale: 0.995 }}
            style={{
              display: 'block', width: '100%', textAlign: 'left',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-md)',
              background: 'var(--color-bg-secondary)',
              cursor: 'pointer', padding: 0,
              transition: 'border-color var(--transition-fast), box-shadow var(--transition-fast)',
              overflow: 'hidden',
            }}
          >
            {/* Colored top accent */}
            <div style={{ height: 3, background: cfg.color, opacity: d.count > 0 ? 1 : 0.25 }} />

            <div style={{ padding: '12px 14px' }}>
              {/* Top row: name + count */}
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8 }}>
                <div>
                  <p style={{
                    fontFamily: 'var(--font-sans)', fontSize: 'var(--text-base)',
                    fontWeight: 600, color: 'var(--color-text-primary)', margin: '0 0 2px',
                  }}>
                    {cfg.label}
                  </p>
                  <p style={{
                    fontFamily: 'var(--font-sans)', fontSize: 10,
                    color: 'var(--color-text-tertiary)', margin: 0,
                  }}>
                    {cfg.criteria}
                  </p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <p style={{
                    fontFamily: 'var(--font-sans)', fontSize: 22, fontWeight: 600,
                    color: d.count > 0 ? 'var(--color-text-primary)' : 'var(--color-text-tertiary)',
                    margin: '0 0 1px', lineHeight: 1,
                  }}>
                    {d.count}
                  </p>
                  <p style={{
                    fontFamily: 'var(--font-sans)', fontSize: 10,
                    color: 'var(--color-text-tertiary)', margin: 0,
                  }}>
                    {pct}% da base
                  </p>
                </div>
              </div>

              {/* Fill bar */}
              <div style={{
                width: '100%', height: 3, borderRadius: 2,
                background: 'var(--color-bg-tertiary)', overflow: 'hidden', marginBottom: 10,
              }}>
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${pct}%` }}
                  transition={{ duration: 0.65, delay: ri * 0.07 + 0.15, ease: [0.25, 0.1, 0.25, 1] }}
                  style={{ height: '100%', background: cfg.color, borderRadius: 2 }}
                />
              </div>

              {/* Bottom row: LTV + Churn */}
              <div style={{ display: 'flex', gap: 16 }}>
                <div>
                  <p style={{
                    fontFamily: 'var(--font-sans)', fontSize: 9, fontWeight: 500,
                    color: 'var(--color-text-tertiary)', margin: '0 0 2px',
                    textTransform: 'uppercase', letterSpacing: '0.04em',
                  }}>LTV Médio</p>
                  <p style={{
                    fontFamily: 'var(--font-sans)', fontSize: 12, fontWeight: 500,
                    color: 'var(--color-text-secondary)', margin: 0,
                  }}>
                    {d.count > 0 ? `R$ ${fmtBR(avgLtv)}` : '—'}
                  </p>
                </div>
                <div>
                  <p style={{
                    fontFamily: 'var(--font-sans)', fontSize: 9, fontWeight: 500,
                    color: 'var(--color-text-tertiary)', margin: '0 0 2px',
                    textTransform: 'uppercase', letterSpacing: '0.04em',
                  }}>Churn</p>
                  <p style={{
                    fontFamily: 'var(--font-sans)', fontSize: 12, fontWeight: 500,
                    margin: 0,
                    color: avgChurn > 60 ? 'var(--priority-high)' : avgChurn > 30 ? 'var(--status-planning)' : 'var(--color-text-secondary)',
                  }}>
                    {d.count > 0 ? `${avgChurn.toFixed(0)}%` : '—'}
                  </p>
                </div>
                <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                    stroke="var(--color-text-tertiary)" strokeWidth="2"
                    strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </div>
              </div>
            </div>
          </motion.button>
        )
      })}
    </div>
  )
}
