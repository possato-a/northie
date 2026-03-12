import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

export interface DateRange {
  start: Date
  end: Date
  label?: string
}

interface Props {
  value: DateRange
  onChange: (range: DateRange) => void
}

const WEEK = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S']
const MONTHS = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']

function sod(d: Date) { return new Date(d.getFullYear(), d.getMonth(), d.getDate()) }
function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}
function fmtShort(d: Date) {
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).replace('.', '')
}

const PRESETS: { label: string; get: () => { start: Date; end: Date } }[] = [
  { label: 'Hoje', get: () => { const d = sod(new Date()); return { start: d, end: d } } },
  { label: 'Últimos 7 dias', get: () => { const e = sod(new Date()); const s = new Date(e); s.setDate(s.getDate() - 6); return { start: s, end: e } } },
  { label: 'Últimos 30 dias', get: () => { const e = sod(new Date()); const s = new Date(e); s.setDate(s.getDate() - 29); return { start: s, end: e } } },
  { label: 'Este mês', get: () => { const n = new Date(); return { start: new Date(n.getFullYear(), n.getMonth(), 1), end: sod(n) } } },
  { label: 'Últimos 3 meses', get: () => { const e = sod(new Date()); const s = new Date(e); s.setMonth(s.getMonth() - 3); return { start: s, end: e } } },
  { label: 'Este ano', get: () => { const n = new Date(); return { start: new Date(n.getFullYear(), 0, 1), end: sod(n) } } },
]

export default function DateRangePicker({ value, onChange }: Props) {
  const [open, setOpen] = useState(false)
  const [viewMonth, setViewMonth] = useState(() => new Date(value.end.getFullYear(), value.end.getMonth(), 1))
  const [pickStart, setPickStart] = useState<Date | null>(null)
  const [hovered, setHovered] = useState<Date | null>(null)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false); setPickStart(null)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Days grid for current view month
  const firstDow = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), 1).getDay()
  const daysInMonth = new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 0).getDate()
  const cells: (Date | null)[] = [
    ...Array(firstDow).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) =>
      new Date(viewMonth.getFullYear(), viewMonth.getMonth(), i + 1)
    )
  ]

  // Range helpers during picking
  const rangeStart = pickStart
    ? (pickStart <= (hovered ?? pickStart) ? pickStart : (hovered ?? pickStart))
    : value.start
  const rangeEnd = pickStart
    ? (pickStart <= (hovered ?? pickStart) ? (hovered ?? pickStart) : pickStart)
    : value.end

  function isStart(d: Date) { return sameDay(d, rangeStart) }
  function isEnd(d: Date) { return sameDay(d, rangeEnd) }
  function inRange(d: Date) { return d > rangeStart && d < rangeEnd }

  function handleDay(day: Date) {
    if (!pickStart) {
      setPickStart(day)
    } else {
      const s = pickStart <= day ? pickStart : day
      const e = pickStart <= day ? day : pickStart
      onChange({ start: s, end: e })
      setPickStart(null)
      setOpen(false)
    }
  }

  const label = value.label ?? `${fmtShort(value.start)} — ${fmtShort(value.end)}`

  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-block' }}>
      {/* Trigger */}
      <motion.button
        onClick={() => { setOpen(o => !o); setPickStart(null) }}
        whileTap={{ scale: 0.98 }}
        style={{
          display: 'flex', alignItems: 'center', gap: 7,
          background: open ? 'var(--color-bg-tertiary)' : 'var(--color-bg-secondary)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-md)',
          cursor: 'pointer',
          padding: '6px 12px',
          transition: 'background var(--transition-base)',
        }}
      >
        <svg width="13" height="13" viewBox="0 0 16 16" fill="none" style={{ color: 'var(--color-text-tertiary)', flexShrink: 0 }}>
          <rect x="1" y="3" width="14" height="12" rx="2" stroke="currentColor" strokeWidth="1.3" />
          <path d="M5 1v4M11 1v4M1 7h14" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
        </svg>
        <span style={{
          fontFamily: 'var(--font-sans)',
          fontSize: 'var(--text-sm)',
          fontWeight: 400,
          color: 'var(--color-text-secondary)',
          letterSpacing: '-0.1px',
          whiteSpace: 'nowrap',
        }}>
          {label}
        </span>
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" style={{ color: 'var(--color-text-tertiary)' }}>
          <path d="M2 3.5l3 3 3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </motion.button>

      {/* Dropdown */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.97 }}
            transition={{ duration: 0.14, ease: [0.4, 0, 0.2, 1] }}
            style={{
              position: 'absolute', top: 'calc(100% + 8px)', right: 0,
              display: 'flex',
              background: 'var(--color-bg-primary)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-lg)',
              boxShadow: 'var(--shadow-xl)',
              zIndex: 400,
              overflow: 'hidden',
            }}
          >
            {/* Presets */}
            <div style={{ borderRight: '1px solid var(--color-border)', padding: '10px 0', minWidth: 152 }}>
              {PRESETS.map(p => {
                const active = value.label === p.label
                return (
                  <button
                    key={p.label}
                    onClick={() => { const d = p.get(); onChange({ ...d, label: p.label }); setPickStart(null); setOpen(false) }}
                    style={{
                      display: 'block', width: '100%', textAlign: 'left',
                      padding: '6px 16px',
                      background: active ? 'var(--color-bg-secondary)' : 'none',
                      border: 'none', cursor: 'pointer',
                      fontFamily: 'var(--font-sans)',
                      fontSize: 'var(--text-sm)',
                      color: active ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
                      fontWeight: active ? 500 : 400,
                      letterSpacing: '-0.1px',
                      transition: 'background var(--transition-fast)',
                    }}
                    onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.background = 'var(--color-bg-secondary)' }}
                    onMouseLeave={e => { if (!active) (e.currentTarget as HTMLElement).style.background = 'none' }}
                  >
                    {p.label}
                  </button>
                )
              })}
            </div>

            {/* Calendar */}
            <div style={{ padding: '16px 18px', width: 264 }}>
              {/* Month nav */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <button
                  onClick={() => setViewMonth(m => new Date(m.getFullYear(), m.getMonth() - 1, 1))}
                  style={{ width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'none', border: 'none', cursor: 'pointer', borderRadius: 'var(--radius-sm)', color: 'var(--color-text-secondary)' }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--color-bg-secondary)'}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'none'}
                >
                  <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M8 2L4 6.5l4 4.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
                </button>
                <span style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', fontWeight: 500, color: 'var(--color-text-primary)', letterSpacing: '-0.1px' }}>
                  {MONTHS[viewMonth.getMonth()]} {viewMonth.getFullYear()}
                </span>
                <button
                  onClick={() => setViewMonth(m => new Date(m.getFullYear(), m.getMonth() + 1, 1))}
                  style={{ width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'none', border: 'none', cursor: 'pointer', borderRadius: 'var(--radius-sm)', color: 'var(--color-text-secondary)' }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--color-bg-secondary)'}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'none'}
                >
                  <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M5 2l4 4.5L5 11" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
                </button>
              </div>

              {/* Week headers */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', marginBottom: 4 }}>
                {WEEK.map((d, i) => (
                  <span key={i} style={{ textAlign: 'center', fontFamily: 'var(--font-sans)', fontSize: 11, fontWeight: 500, color: 'var(--color-text-tertiary)', padding: '3px 0' }}>{d}</span>
                ))}
              </div>

              {/* Days */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '2px 1px' }}>
                {cells.map((day, i) => {
                  if (!day) return <div key={`b${i}`} />
                  const start = isStart(day)
                  const end = isEnd(day)
                  const mid = inRange(day)
                  const isToday = sameDay(day, new Date())
                  const selected = start || end

                  return (
                    <button
                      key={i}
                      onClick={() => handleDay(day)}
                      onMouseEnter={() => pickStart && setHovered(day)}
                      onMouseLeave={() => pickStart && setHovered(null)}
                      style={{
                        width: '100%',
                        aspectRatio: '1',
                        border: 'none',
                        cursor: 'pointer',
                        fontFamily: 'var(--font-sans)',
                        fontSize: 12,
                        fontWeight: selected ? 500 : 400,
                        color: selected ? 'white' : mid ? 'var(--color-primary)' : isToday ? 'var(--color-primary)' : 'var(--color-text-primary)',
                        background: selected ? 'var(--color-primary)' : mid ? 'var(--color-primary-light)' : 'transparent',
                        borderRadius: 'var(--radius-sm)',
                        transition: 'background 60ms ease',
                        outline: isToday && !selected ? '1px solid var(--color-primary)' : 'none',
                        outlineOffset: -1,
                      }}
                    >
                      {day.getDate()}
                    </button>
                  )
                })}
              </div>

              {/* Picking hint */}
              <p style={{ fontFamily: 'var(--font-sans)', fontSize: 11, color: 'var(--color-text-tertiary)', textAlign: 'center', marginTop: 10, marginBottom: 0, minHeight: 16 }}>
                {pickStart ? 'Clique na data final' : ''}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
