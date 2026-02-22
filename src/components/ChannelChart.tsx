import { motion } from 'framer-motion'

const CHANNELS = [
  { name: 'Meta Ads',           value: 98400 },
  { name: 'Google Orgânico',    value: 52800 },
  { name: 'Google Ads',         value: 42600 },
  { name: 'Email Marketing',    value: 27200 },
  { name: 'Direto / Orgânico',  value: 19000 },
]

const TOTAL = CHANNELS.reduce((s, c) => s + c.value, 0)

function fmtBR(v: number) {
  return new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 }).format(v)
}

function fmtPct(v: number) {
  return ((v / TOTAL) * 100).toFixed(1) + '%'
}

export default function ChannelChart() {
  return (
    <section>
      <p
        style={{
          fontFamily: "'Geist Mono', 'Courier New', monospace",
          fontSize: 12,
          color: 'rgba(30,30,30,0.5)',
          letterSpacing: '0.06em',
          marginBottom: 28,
        }}
      >
        RECEITA POR CANAL
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
        {CHANNELS.map((ch, i) => {
          const pct = (ch.value / TOTAL) * 100
          return (
            <motion.div
              key={ch.name}
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.35, delay: i * 0.08 + 0.2, ease: [0.25, 0.1, 0.25, 1] }}
            >
              {/* Label row */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'baseline',
                  marginBottom: 9,
                }}
              >
                <span
                  style={{
                    fontFamily: "'Poppins', sans-serif",
                    fontSize: 14,
                    color: '#1E1E1E',
                    letterSpacing: '-0.3px',
                  }}
                >
                  {ch.name}
                </span>
                <div style={{ display: 'flex', gap: 12, alignItems: 'baseline' }}>
                  <span
                    style={{
                      fontFamily: "'Geist Mono', 'Courier New', monospace",
                      fontSize: 11,
                      color: 'rgba(30,30,30,0.45)',
                    }}
                  >
                    {fmtPct(ch.value)}
                  </span>
                  <span
                    style={{
                      fontFamily: "'Geist Mono', 'Courier New', monospace",
                      fontSize: 13,
                      color: 'rgba(30,30,30,0.7)',
                    }}
                  >
                    R$ {fmtBR(ch.value)}
                  </span>
                </div>
              </div>

              {/* Bar track */}
              <div
                style={{
                  height: 5,
                  background: 'rgba(30,30,30,0.07)',
                  borderRadius: 99,
                  overflow: 'hidden',
                }}
              >
                <motion.div
                  style={{ height: '100%', background: '#1E1E1E', borderRadius: 99 }}
                  initial={{ width: '0%' }}
                  animate={{ width: `${pct}%` }}
                  transition={{
                    duration: 0.9,
                    delay: i * 0.09 + 0.35,
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
