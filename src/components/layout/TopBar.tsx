import { useState } from 'react'
import { motion } from 'framer-motion'
import { AskNorthieIcon } from '../../icons'

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
      transition={{ duration: 0.35, ease: [0.25, 0.1, 0.25, 1] }}
      style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 32 }}
    >
      {/* Search — Notion style */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          height: 36,
          border: `1px solid ${focused ? 'var(--color-primary)' : 'var(--color-border)'}`,
          borderRadius: 'var(--radius-md)',
          paddingLeft: 12,
          paddingRight: 12,
          background: focused ? 'var(--color-bg-primary)' : 'var(--color-bg-secondary)',
          transition: 'border-color var(--transition-base), background var(--transition-base), box-shadow var(--transition-base)',
          boxShadow: focused ? '0 0 0 2px var(--color-primary-light)' : 'none',
        }}
      >
        <svg width="14" height="14" viewBox="0 0 15 15" fill="none" style={{ flexShrink: 0, color: 'var(--color-text-tertiary)' }}>
          <circle cx="6.5" cy="6.5" r="5.5" stroke="currentColor" strokeWidth="1.3" />
          <line x1="10.5" y1="10.5" x2="14" y2="14" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
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
            fontFamily: 'var(--font-sans)',
            fontSize: 'var(--text-base)',
            color: 'var(--color-text-primary)',
            letterSpacing: '-0.1px',
          }}
        />
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 'var(--text-xs)',
            color: 'var(--color-text-tertiary)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-sm)',
            padding: '2px 5px',
            flexShrink: 0,
            background: 'var(--color-bg-primary)',
          }}
        >
          ⌘K
        </span>
      </div>

      {/* Ask Northie Button — Notion primary action style */}
      <motion.button
        onClick={onToggleChat}
        whileHover={{ opacity: 0.88 }}
        whileTap={{ scale: 0.97 }}
        style={{
          display: 'flex', alignItems: 'center', gap: 7,
          height: 36, padding: '0 14px',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-md)',
          background: 'var(--color-bg-secondary)',
          cursor: 'pointer',
          color: 'var(--color-text-secondary)',
          flexShrink: 0,
          fontFamily: 'var(--font-sans)',
          fontSize: 'var(--text-sm)',
          fontWeight: 500,
          transition: 'background var(--transition-base), color var(--transition-base)',
          letterSpacing: '-0.1px',
        }}
        onMouseEnter={e => {
          (e.currentTarget as HTMLButtonElement).style.background = 'var(--color-bg-tertiary)'
            ; (e.currentTarget as HTMLButtonElement).style.color = 'var(--color-text-primary)'
        }}
        onMouseLeave={e => {
          (e.currentTarget as HTMLButtonElement).style.background = 'var(--color-bg-secondary)'
            ; (e.currentTarget as HTMLButtonElement).style.color = 'var(--color-text-secondary)'
        }}
      >
        <AskNorthieIcon />
        <span>Ask Northie</span>
      </motion.button>

      {/* Notification bell */}
      <motion.button
        whileHover={{ background: 'var(--color-bg-tertiary)' } as any}
        whileTap={{ scale: 0.93 }}
        className="notion-btn-icon"
        style={{
          width: 36, height: 36,
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-md)',
          background: 'var(--color-bg-secondary)',
          cursor: 'pointer',
          color: 'var(--color-text-secondary)',
          flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
          <path d="M8 1a5 5 0 0 1 5 5v3.5l1.5 2.5H1.5L3 9.5V6a5 5 0 0 1 5-5Z"
            stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
          <path d="M6.5 13.5a1.5 1.5 0 0 0 3 0"
            stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
        </svg>
      </motion.button>

      {/* Avatar */}
      <motion.div
        whileHover={{ opacity: 0.85 }}
        style={{
          width: 32, height: 32,
          borderRadius: 'var(--radius-full)',
          border: '1px solid var(--color-border)',
          background: 'var(--color-bg-tertiary)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', flexShrink: 0,
        }}
      >
        <span style={{
          fontFamily: 'var(--font-sans)',
          fontSize: 13,
          fontWeight: 500,
          color: 'var(--color-text-secondary)',
        }}>
          F
        </span>
      </motion.div>
    </motion.div>
  )
}
