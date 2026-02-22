import { useState } from 'react'
import { motion } from 'framer-motion'

const DATA = [
  { month: 'Jan', value: 168000 },
  { month: 'Fev', value: 195000 },
  { month: 'Mar', value: 182000 },
  { month: 'Abr', value: 210000 },
  { month: 'Mai', value: 198000 },
  { month: 'Jun', value: 225000 },
  { month: 'Jul', value: 215000 },
  { month: 'Ago', value: 228000 },
  { month: 'Set', value: 242000 },
  { month: 'Out', value: 258000 },
  { month: 'Nov', value: 235000 },
  { month: 'Dez', value: 240000 },
]

// ── Layout constants ──────────────────────────────────────────────────────────
const W = 900
const H = 210
const PAD = { top: 16, right: 20, bottom: 38, left: 58 }
const CW = W - PAD.left - PAD.right
const CH = H - PAD.top - PAD.bottom

const MIN_V = 148000
const MAX_V = 272000
const Y_TICKS = [160000, 190000, 220000, 250000]
const TOOLTIP_W = 136
const TOOLTIP_H = 52

// ── Helpers ───────────────────────────────────────────────────────────────────
function xAt(i: number) {
  return PAD.left + (i / (DATA.length - 1)) * CW
}

function yAt(v: number) {
  return PAD.top + CH - ((v - MIN_V) / (MAX_V - MIN_V)) * CH
}

function buildCurve(pts: { x: number; y: number }[]) {
  let d = `M ${f(pts[0].x)},${f(pts[0].y)}`
  for (let i = 1; i < pts.length; i++) {
    const cpx = f((pts[i - 1].x + pts[i].x) / 2)
    d += ` C ${cpx},${f(pts[i - 1].y)} ${cpx},${f(pts[i].y)} ${f(pts[i].x)},${f(pts[i].y)}`
  }
  return d
}

function f(n: number) { return n.toFixed(2) }

function fmtBR(v: number) {
  return new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 }).format(v)
}

// ── Derived paths ─────────────────────────────────────────────────────────────
const PTS = DATA.map((d, i) => ({ x: xAt(i), y: yAt(d.value) }))
const LINE_D = buildCurve(PTS)
const bottom = f(PAD.top + CH)
const FILL_D = `${LINE_D} L ${f(PTS[PTS.length - 1].x)},${bottom} L ${f(PTS[0].x)},${bottom} Z`

// ── Component ─────────────────────────────────────────────────────────────────
export default function RevenueChart() {
  const [hovered, setHovered] = useState<number | null>(null)

  function handleMouseMove(e: React.MouseEvent<SVGSVGElement>) {
    const rect = e.currentTarget.getBoundingClientRect()
    const svgX = ((e.clientX - rect.left) / rect.width) * W
    const raw = ((svgX - PAD.left) / CW) * (DATA.length - 1)
    setHovered(Math.max(0, Math.min(DATA.length - 1, Math.round(raw))))
  }

  const hp = hovered !== null ? PTS[hovered] : null
  const hd = hovered !== null ? DATA[hovered] : null

  return (
    <section>
      <p
        style={{
          fontFamily: "'Geist Mono', 'Courier New', monospace",
          fontSize: 12,
          color: 'rgba(30,30,30,0.5)',
          letterSpacing: '0.06em',
          marginBottom: 24,
        }}
      >
        RECEITA AO LONGO DO TEMPO
      </p>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        style={{ display: 'block', cursor: 'crosshair', overflow: 'visible' }}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setHovered(null)}
      >
        <defs>
          <linearGradient id="rev-area" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#1E1E1E" stopOpacity="0.07" />
            <stop offset="100%" stopColor="#1E1E1E" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Horizontal grid lines + Y labels */}
        {Y_TICKS.map(v => {
          const y = yAt(v)
          return (
            <g key={v}>
              <line
                x1={PAD.left} y1={y} x2={W - PAD.right} y2={y}
                stroke="rgba(30,30,30,0.07)" strokeWidth={1}
              />
              <text
                x={PAD.left - 10} y={y}
                textAnchor="end" dominantBaseline="middle"
                fontFamily="'Geist Mono', monospace" fontSize={11}
                fill="rgba(30,30,30,0.38)"
              >
                {v / 1000}k
              </text>
            </g>
          )
        })}

        {/* X labels */}
        {DATA.map((d, i) => (
          <text
            key={d.month}
            x={xAt(i)} y={H - 4}
            textAnchor="middle"
            fontFamily="'Geist Mono', monospace" fontSize={11}
            fill={hovered === i ? 'rgba(30,30,30,0.7)' : 'rgba(30,30,30,0.38)'}
            style={{ transition: 'fill 0.15s' }}
          >
            {d.month}
          </text>
        ))}

        {/* Gradient fill — fades in after line draws */}
        <motion.path
          d={FILL_D}
          fill="url(#rev-area)"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.9 }}
        />

        {/* Animated line draw */}
        <motion.path
          d={LINE_D}
          fill="none"
          stroke="#1E1E1E"
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{ duration: 1.6, ease: [0.4, 0, 0.2, 1], delay: 0.15 }}
        />

        {/* Hover indicator */}
        {hp && hd && (() => {
          const tx = hp.x + TOOLTIP_W + 20 > W ? hp.x - TOOLTIP_W - 14 : hp.x + 14
          const ty = Math.max(PAD.top, Math.min(PAD.top + CH - TOOLTIP_H, hp.y - TOOLTIP_H / 2))
          return (
            <g style={{ pointerEvents: 'none' }}>
              {/* Vertical crosshair */}
              <line
                x1={hp.x} y1={PAD.top} x2={hp.x} y2={PAD.top + CH}
                stroke="rgba(30,30,30,0.18)" strokeWidth={1} strokeDasharray="3 3"
              />
              {/* Halo + dot */}
              <circle cx={hp.x} cy={hp.y} r={7} fill="rgba(30,30,30,0.06)" />
              <circle cx={hp.x} cy={hp.y} r={3.5} fill="#FCF8F8" stroke="#1E1E1E" strokeWidth={1.5} />

              {/* Tooltip */}
              <rect
                x={tx} y={ty}
                width={TOOLTIP_W} height={TOOLTIP_H}
                rx={3} ry={3}
                fill="#FCF8F8"
                stroke="rgba(30,30,30,0.14)" strokeWidth={1}
              />
              <text
                x={tx + 13} y={ty + 19}
                fontFamily="'Geist Mono', monospace" fontSize={11}
                fill="rgba(30,30,30,0.5)"
              >
                {hd.month} 2024
              </text>
              <text
                x={tx + 13} y={ty + 37}
                fontFamily="'Poppins', sans-serif" fontSize={14} fontWeight={500}
                fill="#1E1E1E"
              >
                R$ {fmtBR(hd.value)}
              </text>
            </g>
          )
        })()}
      </svg>
    </section>
  )
}
