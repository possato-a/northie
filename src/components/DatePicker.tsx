import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { CalendarIcon } from '../icons'

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
        whileHover={{ opacity: 0.8 }}
        whileTap={{ scale: 0.98 }}
        style={{
          display: 'flex', alignItems: 'center', gap: 10,
          background: 'none', border: 'none', cursor: 'pointer',
          padding: '6px 0', color: '#1E1E1E',
        }}
      >
        <span style={{ display: 'flex', opacity: 0.7 }}>
          <CalendarIcon />
        </span>
        <span style={{
          fontFamily: "'Poppins', sans-serif",
          fontSize: 16, letterSpacing: '-0.64px',
          color: 'rgba(30,30,30,0.7)',
        }}>
          {selected ?? 'Selecionar período'}
        </span>
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.97 }}
            transition={{ duration: 0.18, ease: [0.4, 0, 0.2, 1] }}
            style={{
              position: 'absolute', top: 'calc(100% + 8px)', left: 0,
              background: '#FCF8F8', border: '1px solid rgba(30,30,30,0.15)',
              borderRadius: 4, padding: '8px 0', zIndex: 200,
              minWidth: 200, boxShadow: '0 4px 20px rgba(30,30,30,0.08)',
            }}
          >
            {PERIODS.map(period => (
              <motion.button
                key={period}
                onClick={() => { setSelected(period); setOpen(false) }}
                whileHover={{ backgroundColor: 'rgba(30,30,30,0.04)' }}
                style={{
                  display: 'block', width: '100%', textAlign: 'left',
                  padding: '10px 16px', background: 'none', border: 'none',
                  cursor: 'pointer', fontFamily: "'Poppins', sans-serif",
                  fontSize: 14, letterSpacing: '-0.5px',
                  color: selected === period ? '#1E1E1E' : 'rgba(30,30,30,0.7)',
                  fontWeight: selected === period ? 500 : 400,
                }}
              >
                {period}
              </motion.button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
