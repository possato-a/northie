import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { CalendarIcon } from '../../icons'

const PERIODS = [
  'Últimos 7 dias',
  'Últimos 30 dias',
  'Este mês',
  'Último trimestre',
  'Este ano',
]

export default function DatePicker() {
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState<string | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div ref={containerRef} style={{ position: 'relative', display: 'inline-block' }}>
      <motion.button
        onClick={() => setOpen(o => !o)}
        whileHover={{ background: 'var(--color-bg-tertiary)' } as any}
        whileTap={{ scale: 0.98 }}
        style={{
          display: 'flex', alignItems: 'center', gap: 7,
          background: open ? 'var(--color-bg-tertiary)' : 'var(--color-bg-secondary)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-md)',
          cursor: 'pointer',
          padding: '6px 12px',
          color: 'var(--color-text-secondary)',
          transition: 'background var(--transition-base)',
        }}
      >
        <span style={{ display: 'flex', color: 'var(--color-text-tertiary)' }}>
          <CalendarIcon />
        </span>
        <span style={{
          fontFamily: 'var(--font-sans)',
          fontSize: 'var(--text-base)',
          letterSpacing: '-0.1px',
          color: selected ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
          fontWeight: selected ? 500 : 400,
        }}>
          {selected ?? 'Selecionar período'}
        </span>
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ color: 'var(--color-text-tertiary)', marginLeft: 2 }}>
          <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.97 }}
            transition={{ duration: 0.15, ease: [0.4, 0, 0.2, 1] }}
            style={{
              position: 'absolute', top: 'calc(100% + 6px)', left: 0,
              background: 'var(--color-bg-primary)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-lg)',
              padding: '6px 0',
              zIndex: 200,
              minWidth: 200,
              boxShadow: 'var(--shadow-lg)',
            }}
          >
            {PERIODS.map(period => (
              <button
                key={period}
                onClick={() => { setSelected(period); setOpen(false) }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  width: '100%', textAlign: 'left',
                  padding: '6px 14px',
                  background: selected === period ? 'var(--color-bg-secondary)' : 'none',
                  border: 'none',
                  cursor: 'pointer',
                  fontFamily: 'var(--font-sans)',
                  fontSize: 'var(--text-base)',
                  color: selected === period ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
                  fontWeight: selected === period ? 500 : 400,
                  transition: 'background var(--transition-fast)',
                }}
                onMouseEnter={e => {
                  if (selected !== period) (e.currentTarget as HTMLButtonElement).style.background = 'var(--color-bg-secondary)'
                }}
                onMouseLeave={e => {
                  if (selected !== period) (e.currentTarget as HTMLButtonElement).style.background = 'none'
                }}
              >
                {selected === period && (
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <path d="M2 6l3 3 5-5" stroke="var(--color-primary)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
                {selected !== period && <span style={{ width: 12 }} />}
                {period}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
