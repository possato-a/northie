import { useEffect, useRef, useState } from 'react'
import { motion, animate as fmAnimate } from 'framer-motion'

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
  locale = 'pt-BR',
  decimals = 0,
  delay = 0,
}: AnimatedNumberProps) {
  const [value, setValue] = useState(0)
  const ref = useRef<ReturnType<typeof fmAnimate> | null>(null)

  useEffect(() => {
    const timeout = setTimeout(() => {
      ref.current = fmAnimate(0, target, {
        duration: 1.6,
        ease: [0.16, 1, 0.3, 1],
        onUpdate(v) { setValue(v) },
      })
    }, delay * 1000)

    return () => {
      clearTimeout(timeout)
      ref.current?.stop()
    }
  }, [target, delay])

  const formatted = new Intl.NumberFormat(locale, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value)

  return <span>{prefix}{formatted}{suffix}</span>
}

// ── KpiCard — estilo original com barra "|" à esquerda do número ──────────────
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
  locale = 'pt-BR',
  decimals = 0,
  delay = 0,
  trend,
  positive,
}: KpiCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay, ease: [0.25, 0.1, 0.25, 1] }}
      style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 120 }}
    >
      {/* Label — Geist Mono uppercase */}
      <span style={{
        fontFamily: 'var(--font-mono)',
        fontSize: 'var(--text-xs)',
        fontWeight: 500,
        color: 'var(--color-text-secondary)',
        letterSpacing: '0.07em',
        textTransform: 'uppercase',
      }}>
        {label}
      </span>

      {/* Valor com barra "|" à esquerda */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {/* Barra vertical — high-tech marker */}
        <motion.div
          initial={{ scaleY: 0, opacity: 0 }}
          animate={{ scaleY: 1, opacity: 1 }}
          transition={{ duration: 0.5, delay: delay + 0.1, ease: [0.4, 0, 0.2, 1] }}
          style={{
            width: 2,
            height: 36,
            borderRadius: 2,
            background: 'rgba(62, 207, 142, 0.3)',
            flexShrink: 0,
            transformOrigin: 'top',
          }}
        />

        <span style={{
          fontFamily: 'var(--font-sans)',
          fontWeight: 500,
          fontSize: 36,
          letterSpacing: '-1.4px',
          color: 'var(--fg)',
          lineHeight: 1,
          whiteSpace: 'nowrap',
        }}>
          <AnimatedNumber
            target={value}
            prefix={prefix}
            suffix={suffix}
            locale={locale}
            decimals={decimals}
            delay={delay + 0.15}
          />
        </span>
      </div>

      {/* Trend badge */}
      {trend && (
        <motion.span
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4, delay: delay + 0.4 }}
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            fontWeight: 500,
            letterSpacing: '0.04em',
            color: positive ? 'var(--accent-green)' : 'var(--accent-red)',
          }}
        >
          {positive ? '▲' : '▼'} {trend} vs mês anterior
        </motion.span>
      )}
    </motion.div>
  )
}
