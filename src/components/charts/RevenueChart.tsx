import { useState, useEffect, useMemo } from 'react'
import { dashboardApi } from '../../lib/api'

// ── Layout constants ──────────────────────────────────────────────────────────
const W = 900
const H = 210
const PAD = { top: 16, right: 20, bottom: 38, left: 58 }
const CW = W - PAD.left - PAD.right
const CH = H - PAD.top - PAD.bottom
const TOOLTIP_W = 136
const TOOLTIP_H = 52

// ── Helpers ───────────────────────────────────────────────────────────────────
function f(n: number) { return n.toFixed(2) }

function fmtBR(v: number) {
  return new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 }).format(v)
}

function buildCurve(pts: { x: number; y: number }[]) {
  if (pts.length === 0) return ''
  let d = `M ${f(pts[0].x)},${f(pts[0].y)}`
  for (let i = 1; i < pts.length; i++) {
    const cpx = f((pts[i - 1].x + pts[i].x) / 2)
    d += ` C ${cpx},${f(pts[i - 1].y)} ${cpx},${f(pts[i].y)} ${f(pts[i].x)},${f(pts[i].y)}`
  }
  return d
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function RevenueChart({ initialData }: { initialData?: { date: string; amount: number }[] } = {}) {
  const [data, setData] = useState<{ date: string; amount: number }[]>(initialData ?? [])
  const [hovered, setHovered] = useState<number | null>(null)
  const [loading, setLoading] = useState(!initialData)

  useEffect(() => {
    if (initialData) return
    dashboardApi.getChart()
      .then(res => setData(res.data))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const { pts, lineD, fillD, yTicks, minV, maxV } = useMemo(() => {
    if (data.length === 0) return { pts: [], lineD: '', fillD: '', yTicks: [], minV: 0, maxV: 0 }

    const amounts = data.map(d => d.amount)
    const min = Math.min(...amounts) * 0.95
    const max = Math.max(...amounts) * 1.05
    const range = max - min

    const xAt = (i: number) => data.length === 1 ? PAD.left + CW / 2 : PAD.left + (i / (data.length - 1)) * CW
    const yAt = (v: number) => PAD.top + CH - ((v - min) / (max - min)) * CH

    const pts = data.map((d, i) => ({ x: xAt(i), y: yAt(d.amount) }))
    const lineD = buildCurve(pts)
    const bottom = f(PAD.top + CH)
    const fillD = `${lineD} L ${f(pts[pts.length - 1].x)},${bottom} L ${f(pts[0].x)},${bottom} Z`

    const yTicks = [
      min + range * 0.25,
      min + range * 0.5,
      min + range * 0.75,
      max
    ]

    return { pts, lineD, fillD, yTicks, minV: min, maxV: max }
  }, [data])

  function handleMouseMove(e: React.MouseEvent<SVGSVGElement>) {
    if (data.length < 2) return
    const rect = e.currentTarget.getBoundingClientRect()
    const svgX = ((e.clientX - rect.left) / rect.width) * W
    const raw = ((svgX - PAD.left) / CW) * (data.length - 1)
    setHovered(Math.max(0, Math.min(data.length - 1, Math.round(raw))))
  }

  const hp = hovered !== null ? pts[hovered] : null
  const hd = hovered !== null ? data[hovered] : null

  if (loading) return <div style={{ height: H, background: 'var(--color-bg-secondary)', borderRadius: 'var(--radius-lg)' }} />

  return (
    <section>
      <p
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 11,
          color: 'var(--color-text-tertiary)',
          letterSpacing: '0.06em',
          marginBottom: 16,
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
            <stop offset="0%" style={{ stopColor: 'rgba(62, 207, 142, 0.12)' }} />
            <stop offset="100%" style={{ stopColor: 'rgba(62, 207, 142, 0)' }} />
          </linearGradient>
        </defs>

        {/* Horizontal grid lines + Y labels */}
        {yTicks.map((v, i) => {
          const y = PAD.top + CH - ((v - minV) / (maxV - minV)) * CH
          return (
            <g key={i}>
              <line
                x1={PAD.left} y1={y} x2={W - PAD.right} y2={y}
                style={{ stroke: 'var(--color-border)' }} strokeWidth={1}
              />
              <text
                x={PAD.left - 10} y={y}
                textAnchor="end" dominantBaseline="middle"
                fontFamily="'Geist Mono', monospace" fontSize={11}
                style={{ fill: 'var(--color-text-tertiary)' }}
              >
                {Math.round(v / 1000)}k
              </text>
            </g>
          )
        })}

        {/* X labels */}
        {data.map((d, i) => i % 2 === 0 && (
          <text
            key={i}
            x={pts[i].x} y={H - 4}
            textAnchor="middle"
            fontFamily="'Geist Mono', monospace" fontSize={11}
            style={{ fill: hovered === i ? 'var(--color-text-secondary)' : 'var(--color-text-tertiary)', transition: 'fill 0.15s' }}
          >
            {new Date(d.date + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
          </text>
        ))}

        {/* Area fill */}
        <path d={fillD} fill="url(#rev-area)" />

        {/* Line */}
        <path
          d={lineD}
          fill="none"
          stroke="var(--color-primary)"
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Hover indicator */}
        {hp && hd && (() => {
          const tx = hp.x + TOOLTIP_W + 20 > W ? hp.x - TOOLTIP_W - 14 : hp.x + 14
          const ty = Math.max(PAD.top, Math.min(PAD.top + CH - TOOLTIP_H, hp.y - TOOLTIP_H / 2))
          return (
            <g style={{ pointerEvents: 'none' }}>
              <line
                x1={hp.x} y1={PAD.top} x2={hp.x} y2={PAD.top + CH}
                stroke="var(--color-border)" strokeWidth={1} strokeDasharray="3 3"
              />
              <circle cx={hp.x} cy={hp.y} r={5} fill="rgba(62, 207, 142, 0.15)" />
              <circle cx={hp.x} cy={hp.y} r={3} fill="var(--color-primary)" />

              <rect
                x={tx} y={ty}
                width={TOOLTIP_W} height={TOOLTIP_H}
                rx={6} ry={6}
                fill="var(--color-bg-primary)" stroke="var(--color-border)" strokeWidth={1}
              />
              <text
                x={tx + 13} y={ty + 19}
                fontFamily="var(--font-mono)" fontSize={11}
                fill="var(--color-text-tertiary)"
              >
                {new Date(hd.date + 'T00:00:00').toLocaleDateString('pt-BR')}
              </text>
              <text
                x={tx + 13} y={ty + 37}
                fontFamily="var(--font-sans)" fontSize={14} fontWeight={500}
                style={{ fill: 'var(--fg)' }}
              >
                R$ {fmtBR(hd.amount)}
              </text>
            </g>
          )
        })()}
      </svg>
    </section>
  )
}
