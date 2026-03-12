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
  'facebook': 'var(--color-primary)',
  'meta ads': 'var(--color-primary)',
  'youtube': 'var(--color-text-secondary)',
  'email': 'var(--status-complete)',
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {[1, 2, 3].map(i => (
        <div key={i} style={{
          height: 40,
          background: 'var(--color-bg-secondary)',
          borderRadius: 'var(--radius-sm)',
          opacity: 1 - i * 0.25,
        }} />
      ))}
    </div>
  )

  return (
    <section>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {channels.map((ch, i) => {
          const pct = totalRevenue > 0 ? (ch.revenue / totalRevenue) * 100 : 0
          const channelKey = ch.channel.toLowerCase().trim()
          const color = CHANNEL_COLORS[channelKey] || CHANNEL_COLORS[channelKey.replace(' ads', '')] || CHANNEL_COLORS[channelKey.split(' ')[0]!] || 'var(--color-text-tertiary)'
          const isLast = i === channels.length - 1

          return (
            <motion.div
              key={ch.channel}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: i * 0.06, ease: [0.25, 0.1, 0.25, 1] }}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '11px 0',
                borderBottom: isLast ? 'none' : '1px solid var(--color-border)',
              }}
            >
              {/* Left: dot + channel name */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{
                  width: 7,
                  height: 7,
                  borderRadius: '50%',
                  background: color,
                  flexShrink: 0,
                }} />
                <span style={{
                  fontFamily: 'var(--font-sans)',
                  fontSize: 'var(--text-base)',
                  fontWeight: 400,
                  color: 'var(--color-text-primary)',
                  letterSpacing: '-0.1px',
                  textTransform: 'capitalize',
                }}>
                  {ch.channel === 'desconhecido' ? 'Direto / Outros' : ch.channel}
                </span>
              </div>

              {/* Right: revenue + percentage */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{
                  fontFamily: 'var(--font-sans)',
                  fontSize: 'var(--text-xs)',
                  fontWeight: 400,
                  color: 'var(--color-text-tertiary)',
                  minWidth: 36,
                  textAlign: 'right',
                }}>
                  {pct.toFixed(0)}%
                </span>
                <span style={{
                  fontFamily: 'var(--font-sans)',
                  fontSize: 'var(--text-base)',
                  fontWeight: 500,
                  color: 'var(--color-text-primary)',
                  minWidth: 90,
                  textAlign: 'right',
                }}>
                  R$ {fmtBR(ch.revenue)}
                </span>
              </div>
            </motion.div>
          )
        })}
      </div>
    </section>
  )
}
