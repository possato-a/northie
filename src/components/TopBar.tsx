import { useState } from 'react'
import { motion } from 'framer-motion'
import { AskNorthieIcon } from '../icons'

interface TopBarProps {
  onToggleChat?: () => void
}

export default function TopBar({ onToggleChat }: TopBarProps) {
  const [query, setQuery] = useState('')
  const [focused, setFocused] = useState(false)

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.25, 0.1, 0.25, 1] }}
      style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 36 }}
    >
      {/* Search field */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          height: 40,
          border: `1px solid ${focused ? 'rgba(30,30,30,0.35)' : 'rgba(30,30,30,0.14)'}`,
          borderRadius: 4,
          paddingLeft: 14,
          paddingRight: 14,
          background: 'transparent',
          transition: 'border-color 0.2s',
        }}
      >
        <svg width="15" height="15" viewBox="0 0 15 15" fill="none" style={{ flexShrink: 0, opacity: 0.4 }}>
          <circle cx="6.5" cy="6.5" r="5.5" stroke="#1E1E1E" strokeWidth="1.3" />
          <line x1="10.5" y1="10.5" x2="14" y2="14" stroke="#1E1E1E" strokeWidth="1.3" strokeLinecap="round" />
        </svg>
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder="Buscar em Northie..."
          style={{
            flex: 1,
            border: 'none',
            background: 'transparent',
            outline: 'none',
            fontFamily: "'Poppins', sans-serif",
            fontSize: 14,
            letterSpacing: '-0.3px',
            color: '#1E1E1E',
          }}
        />
        <span style={{
          fontFamily: "'Geist Mono', monospace",
          fontSize: 11,
          color: 'rgba(30,30,30,0.35)',
          border: '1px solid rgba(30,30,30,0.14)',
          borderRadius: 3,
          padding: '2px 6px',
          flexShrink: 0,
        }}>
          ⌘K
        </span>
      </div>

      {/* Ask Northie Button */}
      <motion.button
        onClick={onToggleChat}
        whileHover={{ opacity: 0.8, backgroundColor: 'rgba(30,30,30,0.04)' }}
        whileTap={{ scale: 0.96 }}
        style={{
          display: 'flex', alignItems: 'center', gap: 8,
          height: 40, padding: '0 16px',
          border: '1px solid rgba(30,30,30,0.14)',
          borderRadius: 4, background: 'transparent',
          cursor: 'pointer', color: '#1E1E1E', flexShrink: 0,
        }}
      >
        <AskNorthieIcon />
        <span style={{
          fontFamily: "'Poppins', sans-serif",
          fontSize: 14, fontWeight: 500,
          letterSpacing: '-0.3px'
        }}>
          Consultar IA
        </span>
      </motion.button>

      {/* Notification bell */}
      <motion.button
        whileHover={{ opacity: 0.55 }}
        whileTap={{ scale: 0.92 }}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          width: 40, height: 40,
          border: '1px solid rgba(30,30,30,0.14)',
          borderRadius: 4, background: 'transparent',
          cursor: 'pointer', color: '#1E1E1E', opacity: 0.7, flexShrink: 0,
        }}
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M8 1a5 5 0 0 1 5 5v3.5l1.5 2.5H1.5L3 9.5V6a5 5 0 0 1 5-5Z"
            stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
          <path d="M6.5 13.5a1.5 1.5 0 0 0 3 0"
            stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
        </svg>
      </motion.button>

      {/* Help */}
      <motion.button
        whileHover={{ opacity: 0.55 }}
        whileTap={{ scale: 0.92 }}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          width: 40, height: 40,
          border: '1px solid rgba(30,30,30,0.14)',
          borderRadius: 4, background: 'transparent',
          cursor: 'pointer', color: '#1E1E1E', opacity: 0.7, flexShrink: 0,
        }}
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.3" />
          <path d="M6.5 6C6.5 5.17 7.17 4.5 8 4.5s1.5.67 1.5 1.5c0 1-1.5 1.5-1.5 2.5"
            stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
          <circle cx="8" cy="11" r="0.75" fill="currentColor" />
        </svg>
      </motion.button>

      {/* Avatar */}
      <motion.div
        whileHover={{ opacity: 0.8 }}
        style={{
          width: 40, height: 40, borderRadius: 4,
          border: '1px solid rgba(30,30,30,0.14)',
          background: '#1E1E1E',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', flexShrink: 0,
        }}
      >
        <span style={{
          fontFamily: "'Poppins', sans-serif",
          fontSize: 14, fontWeight: 500,
          color: '#FCF8F8', letterSpacing: '-0.3px',
        }}>
          F
        </span>
      </motion.div>
    </motion.div>
  )
}
