import { useEffect, useRef, useState } from 'react'
import { motion, animate as fmAnimate } from 'framer-motion'
import { useTheme } from '../../ThemeContext'
import { getLocale } from '../../lib/dateFormatter'

// ── AnimatedNumber ─────────────────────────────────────────────────────────────
interface AnimatedNumberProps {
  target: number
  prefix?: string
  suffix?: string
  locale?: string
  decimals?: number
  delay?: number
}

export function AnimatedNumber({
  target,
  prefix = '',
  suffix = '',
  locale,
  decimals = 0,
  delay = 0,
}: AnimatedNumberProps) {
  const { language } = useTheme()
  const resolvedLocale = locale || getLocale()
  const [value, setValue] = useState(0)
  const ref = useRef<ReturnType<typeof fmAnimate> | null>(null)

  useEffect(() => {
    const timeout = setTimeout(() => {
      ref.current = fmAnimate(0, target, {
        duration: 1.4,
        ease: [0.16, 1, 0.3, 1],
        onUpdate(v) { setValue(v) },
      })
    }, delay * 1000)

    return () => {
      clearTimeout(timeout)
      ref.current?.stop()
    }
  }, [target, delay])

  // Re-formata quando language muda (sem reiniciar a animação)
  const formatted = new Intl.NumberFormat(resolvedLocale, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value)

  // Usa language para garantir re-render quando o idioma muda
  void language

  return <span>{prefix}{formatted}{suffix}</span>
}

// ── KpiCard — Notion-style card ─────────────────────────────────────────────
interface KpiCardProps {
  label: string
  value: number
  prefix?: string
  suffix?: string
  locale?: string
  decimals?: number
  delay?: number
  trend?: string
  positive?: boolean
}

export function KpiCard({
  label,
  value,
  prefix = '',
  suffix = '',
  locale,
  decimals = 0,
  delay = 0,
  trend,
  positive,
}: KpiCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay, ease: [0.25, 0.1, 0.25, 1] }}
      style={{
        background: 'var(--color-bg-primary)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-lg)',
        boxShadow: 'var(--shadow-md)',
        padding: '18px 20px',
        display: 'flex',
        flexDirection: 'column',
        gap: 5,
      }}
    >
      {/* Label */}
      <span style={{
        fontFamily: 'var(--font-sans)',
        fontSize: 11,
        fontWeight: 400,
        color: 'var(--color-text-secondary)',
        letterSpacing: '0.02em',
        textTransform: 'uppercase',
        lineHeight: 1,
      }}>
        {label}
      </span>

      {/* Value */}
      <span style={{
        fontFamily: 'var(--font-sans)',
        fontWeight: 500,
        fontSize: 22,
        letterSpacing: '-0.4px',
        color: 'var(--color-text-primary)',
        lineHeight: 1.15,
        whiteSpace: 'nowrap',
      }}>
        <AnimatedNumber
          target={value}
          prefix={prefix}
          suffix={suffix}
          locale={locale}
          decimals={decimals}
          delay={delay + 0.1}
        />
      </span>

      {/* Trend badge */}
      {trend && (
        <motion.span
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3, delay: delay + 0.35 }}
          style={{
            fontFamily: 'var(--font-sans)',
            fontSize: 11,
            fontWeight: 500,
            color: positive ? 'var(--status-complete)' : 'var(--accent-red)',
            letterSpacing: '-0.1px',
            marginTop: 2,
          }}
        >
          {positive ? '↑' : '↓'} {trend} vs mês anterior
        </motion.span>
      )}
    </motion.div>
  )
}
