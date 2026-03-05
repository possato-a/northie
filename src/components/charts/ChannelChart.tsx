import { useState, useEffect, useMemo } from 'react'
import { motion } from 'framer-motion'
import { dashboardApi } from '../../lib/api'

interface ChannelData {
  channel: string
  revenue: number
  customers: number
}

function fmtBR(v: number) {
  return new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 }).format(v)
}

const CHANNEL_COLORS: Record<string, string> = {
  'instagram': 'var(--accent-purple)',
  'google': 'var(--color-primary)',
  'google ads': 'var(--color-primary)',
  'facebook': 'var(--status-in-progress)',
  'meta ads': 'var(--status-in-progress)',
  'youtube': 'var(--accent-red)',
  'email': 'var(--accent-green)',
  'desconhecido': 'var(--color-text-tertiary)',
  'direto / outros': 'var(--color-text-tertiary)',
}

export default function ChannelChart({ initialData }: { initialData?: ChannelData[] } = {}) {
  const [channels, setChannels] = useState<ChannelData[]>(initialData ?? [])
  const [loading, setLoading] = useState(!initialData)

  useEffect(() => {
    if (initialData) return
    dashboardApi.getAttribution()
      .then(res => setChannels(res.data))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const totalRevenue = useMemo(() => channels.reduce((s, c) => s + c.revenue, 0), [channels])

  if (loading) return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
      {[1, 2, 3].map(i => (
        <div key={i} style={{
          height: 48,
          background: 'var(--color-bg-secondary)',
          borderRadius: 'var(--radius-md)',
          opacity: 1 - i * 0.2,
        }} />
      ))}
    </div>
  )

  return (
    <section>
      {/* Section header */}
      <p style={{
        fontFamily: 'var(--font-sans)',
        fontSize: 'var(--text-sm)',
        fontWeight: 500,
        color: 'var(--color-text-secondary)',
        letterSpacing: '0.04em',
        textTransform: 'uppercase',
        marginBottom: 'var(--space-5)',
      }}>
        Receita por Canal
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
        {channels.map((ch, i) => {
          const pct = totalRevenue > 0 ? (ch.revenue / totalRevenue) * 100 : 0
          // Normaliza o nome do canal para lookup consistente (ex: "Meta Ads" → "meta ads")
          const channelKey = ch.channel.toLowerCase().trim()
          const color = CHANNEL_COLORS[channelKey]
            || CHANNEL_COLORS[channelKey.replace(' ads', '')]
            || CHANNEL_COLORS[channelKey.split(' ')[0]!]
            || 'var(--color-text-tertiary)'

          return (
            <motion.div
              key={ch.channel}
              initial={{ opacity: 0, x: -4 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3, delay: i * 0.07, ease: [0.25, 0.1, 0.25, 1] }}
            >
              {/* Label row */}
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 'var(--space-2)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                  {/* Color dot */}
                  <div style={{
                    width: 8, height: 8,
                    borderRadius: 'var(--radius-full)',
                    background: color,
                    flexShrink: 0,
                  }} />
                  <span style={{
                    fontFamily: 'var(--font-sans)',
                    fontSize: 'var(--text-base)',
                    fontWeight: 400,
                    color: 'var(--color-text-primary)',
                    textTransform: 'capitalize',
                    letterSpacing: '-0.1px',
                  }}>
                    {ch.channel === 'desconhecido' ? 'Direto / Outros' : ch.channel}
                  </span>
                </div>

                <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'center' }}>
                  <span style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 'var(--text-xs)',
                    color: 'var(--color-text-tertiary)',
                  }}>
                    {pct.toFixed(1)}%
                  </span>
                  <span style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 'var(--text-sm)',
                    fontWeight: 500,
                    color: 'var(--color-text-secondary)',
                  }}>
                    R$ {fmtBR(ch.revenue)}
                  </span>
                </div>
              </div>

              {/* Progress bar — Notion style */}
              <div style={{
                height: 4,
                background: 'var(--color-bg-tertiary)',
                borderRadius: 'var(--radius-full)',
                overflow: 'hidden',
              }}>
                <motion.div
                  style={{
                    height: '100%',
                    background: color,
                    borderRadius: 'var(--radius-full)',
                    opacity: 0.75,
                  }}
                  initial={{ width: '0%' }}
                  animate={{ width: `${pct}%` }}
                  transition={{
                    duration: 0.8,
                    delay: i * 0.08 + 0.2,
                    ease: [0.4, 0, 0.2, 1],
                  }}
                />
              </div>
            </motion.div>
          )
        })}
      </div>
    </section>
  )
}
