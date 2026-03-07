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

// ── KpiCard — Supabase-style: minimal, data-first ────────────────────────────
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
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 120 }}
    >
      {/* Label */}
      <span style={{
        fontFamily: 'var(--font-mono)',
        fontSize: 11,
        fontWeight: 400,
        color: 'var(--color-text-tertiary)',
        letterSpacing: '0.06em',
        textTransform: 'uppercase',
      }}>
        {label}
      </span>

      {/* Value + trend inline */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <span style={{
          fontFamily: 'var(--font-sans)',
          fontWeight: 500,
          fontSize: 28,
          letterSpacing: '-0.5px',
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
            delay={delay}
          />
        </span>

        {trend && (
          <span style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            fontWeight: 400,
            letterSpacing: '0.02em',
            color: positive ? 'var(--accent-green)' : 'var(--accent-red)',
            whiteSpace: 'nowrap',
          }}>
            {positive ? '+' : '-'}{trend}
          </span>
        )}
      </div>
    </motion.div>
  )
}
