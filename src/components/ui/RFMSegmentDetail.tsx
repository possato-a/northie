import { useMemo } from 'react'
import { motion } from 'framer-motion'
import { fmtBR } from '../../lib/utils'
import { RFM_CONFIG, SEGMENTS } from './RFMCards'
import type { ClientUI, RFMSegment } from '../../types'

interface RFMSegmentDetailProps {
  segment: RFMSegment
  clients: ClientUI[]
  onClose: () => void
}

export default function RFMSegmentDetail({ segment, clients, onClose }: RFMSegmentDetailProps) {
  const cfg = RFM_CONFIG[segment]

  const segClients = useMemo(
    () => clients.filter(c => c.segment === segment).sort((a, b) => b.ltv - a.ltv),
    [clients, segment]
  )

  const allStats = useMemo(() => {
    const result: Record<RFMSegment, { count: number; ltvSum: number }> = {
      'Champions':         { count: 0, ltvSum: 0 },
      'Em Risco':          { count: 0, ltvSum: 0 },
      'Novos Promissores': { count: 0, ltvSum: 0 },
      'Inativos':          { count: 0, ltvSum: 0 },
    }
    clients.forEach(c => { result[c.segment].count++; result[c.segment].ltvSum += c.ltv })
    return result
  }, [clients])

  const d = allStats[segment]
  const totalClients = clients.length || 1
  const avgLtv = d.count > 0 ? d.ltvSum / d.count : 0
  const avgChurn = segClients.length > 0
    ? (segClients.reduce((s, c) => s + c.churnProb, 0) / segClients.length) * 100
    : 0
  const totalRevenue = segClients.reduce((s, c) => s + c.totalSpent, 0)
  const pct = Math.round((d.count / totalClients) * 100)

  // Color: use inline hex fallback for the accent strip since CSS var may not work in borderColor
  const isNeutral = cfg.color === 'var(--color-text-tertiary)'

  return (
    <>
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        onClick={onClose}
        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.18)', zIndex: 300 }}
      />

      {/* Panel */}
      <motion.div
        initial={{ x: 440, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: 440, opacity: 0 }}
        transition={{ duration: 0.32, ease: [0.4, 0, 0.2, 1] }}
        style={{
          position: 'fixed', top: 0, right: 0, bottom: 0, width: 420,
          background: 'var(--color-bg-primary)',
          borderLeft: '1px solid var(--color-border)',
          zIndex: 301, overflowY: 'auto',
          display: 'flex', flexDirection: 'column',
        }}
      >
        {/* Colored accent strip */}
        <div style={{ height: 4, background: cfg.color, flexShrink: 0 }} />

        <div style={{ padding: '24px 28px 48px', flex: 1 }}>
          {/* Header */}
          <div style={{
            display: 'flex', alignItems: 'flex-start',
            justifyContent: 'space-between', marginBottom: 24,
          }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <span style={{
                  width: 8, height: 8, borderRadius: '50%',
                  background: cfg.color, flexShrink: 0,
                }} />
                <p style={{
                  fontFamily: 'var(--font-sans)', fontSize: 11, fontWeight: 500,
                  color: 'var(--color-text-tertiary)', margin: 0,
                  textTransform: 'uppercase', letterSpacing: '0.06em',
                }}>
                  Segmento RFM
                </p>
              </div>
              <p style={{
                fontFamily: 'var(--font-sans)', fontSize: 26, fontWeight: 600,
                letterSpacing: '-0.5px', color: 'var(--color-text-primary)', margin: 0,
              }}>
                {cfg.label}
              </p>
              <p style={{
                fontFamily: 'var(--font-mono)', fontSize: 11,
                color: 'var(--color-text-tertiary)', margin: '4px 0 0',
              }}>
                {cfg.criteria}
              </p>
            </div>

            <motion.button
              whileTap={{ scale: 0.93 }}
              onClick={onClose}
              style={{
                width: 30, height: 30, borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--color-border)', background: 'var(--color-bg-secondary)',
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                stroke="var(--color-text-secondary)" strokeWidth="2"
                strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </motion.button>
          </div>

          {/* Description */}
          <p style={{
            fontFamily: 'var(--font-sans)', fontSize: 13,
            color: 'var(--color-text-secondary)', lineHeight: 1.6,
            margin: '0 0 20px', paddingBottom: 20,
            borderBottom: '1px solid var(--color-border)',
          }}>
            {cfg.description}
          </p>

          {/* KPI grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20 }}>
            {[
              { label: 'Clientes', value: `${d.count}`, sub: `${pct}% da base` },
              {
                label: 'LTV Médio',
                value: d.count > 0 ? `R$ ${fmtBR(avgLtv)}` : '—',
                sub: 'por cliente',
              },
              {
                label: 'Receita Total',
                value: totalRevenue > 0 ? `R$ ${fmtBR(totalRevenue)}` : '—',
                sub: 'soma acumulada',
              },
              {
                label: 'Churn Médio',
                value: d.count > 0 ? `${avgChurn.toFixed(0)}%` : '—',
                sub: 'probabilidade',
                danger: avgChurn > 60,
                warn: avgChurn > 30 && avgChurn <= 60,
              },
            ].map(stat => (
              <div key={stat.label} style={{
                padding: '12px 14px',
                background: 'var(--color-bg-secondary)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-md)',
              }}>
                <p style={{
                  fontFamily: 'var(--font-sans)', fontSize: 10, fontWeight: 500,
                  color: 'var(--color-text-tertiary)', margin: '0 0 5px',
                  textTransform: 'uppercase', letterSpacing: '0.04em',
                }}>
                  {stat.label}
                </p>
                <p style={{
                  fontFamily: 'var(--font-sans)', fontSize: 20, fontWeight: 600,
                  margin: '0 0 2px', letterSpacing: '-0.3px',
                  color: 'danger' in stat && stat.danger
                    ? 'var(--priority-high)'
                    : 'warn' in stat && stat.warn
                      ? 'var(--status-planning)'
                      : 'var(--color-text-primary)',
                }}>
                  {stat.value}
                </p>
                <p style={{
                  fontFamily: 'var(--font-sans)', fontSize: 10,
                  color: 'var(--color-text-tertiary)', margin: 0,
                }}>
                  {stat.sub}
                </p>
              </div>
            ))}
          </div>

          {/* Segment comparison bar */}
          <div style={{ marginBottom: 20 }}>
            <p style={{
              fontFamily: 'var(--font-sans)', fontSize: 10, fontWeight: 500,
              color: 'var(--color-text-tertiary)', margin: '0 0 8px',
              textTransform: 'uppercase', letterSpacing: '0.04em',
            }}>
              Distribuição da base
            </p>
            <div style={{ display: 'flex', height: 6, borderRadius: 6, overflow: 'hidden', gap: 2, marginBottom: 8 }}>
              {SEGMENTS.map(seg => {
                const segPct = (allStats[seg].count / totalClients) * 100
                return (
                  <motion.div
                    key={seg}
                    initial={{ width: 0 }}
                    animate={{ width: `${segPct}%` }}
                    transition={{ duration: 0.6, ease: [0.25, 0.1, 0.25, 1] }}
                    style={{
                      height: '100%', background: RFM_CONFIG[seg].color,
                      borderRadius: 3, flexShrink: 0,
                      opacity: seg === segment ? 1 : 0.3,
                    }}
                  />
                )
              })}
            </div>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              {SEGMENTS.map(seg => {
                const segPct = Math.round((allStats[seg].count / totalClients) * 100)
                return (
                  <span key={seg} style={{
                    display: 'inline-flex', alignItems: 'center', gap: 4,
                    opacity: seg === segment ? 1 : 0.45,
                  }}>
                    <span style={{
                      width: 6, height: 6, borderRadius: '50%',
                      background: RFM_CONFIG[seg].color, flexShrink: 0,
                    }} />
                    <span style={{
                      fontFamily: 'var(--font-sans)', fontSize: 11,
                      color: 'var(--color-text-tertiary)',
                    }}>
                      {RFM_CONFIG[seg].label} {segPct}%
                    </span>
                  </span>
                )
              })}
            </div>
          </div>

          {/* Action recommendation */}
          <div style={{
            padding: '14px 16px',
            background: cfg.bgColor,
            border: `1px solid ${isNeutral ? 'var(--color-border)' : cfg.color}`,
            borderRadius: 'var(--radius-md)',
            marginBottom: 24,
          }}>
            <p style={{
              fontFamily: 'var(--font-sans)', fontSize: 10, fontWeight: 600,
              color: isNeutral ? 'var(--color-text-tertiary)' : cfg.color,
              margin: '0 0 6px', textTransform: 'uppercase', letterSpacing: '0.06em',
            }}>
              Ação recomendada
            </p>
            <p style={{
              fontFamily: 'var(--font-sans)', fontSize: 13, margin: 0,
              color: 'var(--color-text-secondary)', lineHeight: 1.6,
            }}>
              {cfg.action}
            </p>
          </div>

          {/* Client list */}
          <div>
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              marginBottom: 12,
            }}>
              <p style={{
                fontFamily: 'var(--font-sans)', fontSize: 10, fontWeight: 500,
                color: 'var(--color-text-tertiary)', margin: 0,
                textTransform: 'uppercase', letterSpacing: '0.04em',
              }}>
                Clientes nesse segmento
              </p>
              <span style={{
                fontFamily: 'var(--font-sans)', fontSize: 11,
                color: 'var(--color-text-tertiary)',
              }}>
                {segClients.length}
              </span>
            </div>

            {segClients.length === 0 ? (
              <p style={{
                fontFamily: 'var(--font-sans)', fontSize: 13,
                color: 'var(--color-text-tertiary)', textAlign: 'center',
                padding: '24px 0',
              }}>
                Nenhum cliente nesse segmento ainda.
              </p>
            ) : (
              <>
                {/* Table header */}
                <div style={{
                  display: 'grid', gridTemplateColumns: '1fr 88px 60px',
                  gap: '0 8px', paddingBottom: 8,
                  borderBottom: '1px solid var(--color-border)', marginBottom: 2,
                }}>
                  {['Cliente', 'LTV', 'Churn'].map((h, i) => (
                    <span key={h} style={{
                      fontFamily: 'var(--font-sans)', fontSize: 10, fontWeight: 500,
                      color: 'var(--color-text-tertiary)', letterSpacing: '0.04em',
                      textTransform: 'uppercase', textAlign: i > 0 ? 'right' : 'left',
                    }}>{h}</span>
                  ))}
                </div>

                {segClients.map((c, ci) => (
                  <div key={c.id} style={{
                    display: 'grid', gridTemplateColumns: '1fr 88px 60px',
                    gap: '0 8px', padding: '10px 0',
                    borderBottom: ci < segClients.length - 1 ? '1px solid var(--color-border)' : 'none',
                    alignItems: 'center',
                  }}>
                    <div style={{ minWidth: 0 }}>
                      <p style={{
                        fontFamily: 'var(--font-sans)', fontSize: 13, fontWeight: 500,
                        color: 'var(--color-text-primary)', margin: 0,
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>{c.name}</p>
                      <p style={{
                        fontFamily: 'var(--font-sans)', fontSize: 11,
                        color: 'var(--color-text-tertiary)', margin: '2px 0 0',
                      }}>{c.channel}</p>
                    </div>
                    <span style={{
                      fontFamily: 'var(--font-sans)', fontSize: 12,
                      color: 'var(--color-text-secondary)', textAlign: 'right',
                    }}>
                      R$ {fmtBR(c.ltv)}
                    </span>
                    <span style={{
                      fontFamily: 'var(--font-sans)', fontSize: 12, textAlign: 'right',
                      color: c.churnProb > 0.6 ? 'var(--priority-high)' : c.churnProb > 0.3 ? 'var(--status-planning)' : 'var(--color-text-secondary)',
                    }}>
                      {(c.churnProb * 100).toFixed(0)}%
                    </span>
                  </div>
                ))}
              </>
            )}
          </div>
        </div>
      </motion.div>
    </>
  )
}
