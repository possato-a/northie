import { useEffect, useRef, useState } from 'react'
import { motion, animate as fmAnimate } from 'framer-motion'

// ── AnimatedNumber ────────────────────────────────────────────────────────────
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
        duration: 1.8,
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

// ── KpiCard ───────────────────────────────────────────────────────────────────
interface KpiCardProps {
  label: string
  value: number
  prefix?: string
  suffix?: string
  locale?: string
  decimals?: number
  delay?: number
}

export function KpiCard({
  label,
  value,
  prefix = '',
  suffix = '',
  locale = 'pt-BR',
  decimals = 0,
  delay = 0,
}: KpiCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay, ease: [0.25, 0.1, 0.25, 1] }}
      style={{ display: 'flex', gap: 20, alignItems: 'center' }}
    >
      <motion.div
        initial={{ scaleY: 0 }}
        animate={{ scaleY: 1 }}
        transition={{ duration: 0.4, delay: delay + 0.1, ease: [0.4, 0, 0.2, 1] }}
        style={{
          width: 1,
          height: 64,
          background: 'rgba(30,30,30,0.25)',
          transformOrigin: 'top',
          flexShrink: 0,
        }}
      />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20, justifyContent: 'center' }}>
        <span style={{
          fontFamily: "'Geist Mono', 'Courier New', monospace",
          fontWeight: 400,
          fontSize: 16,
          color: 'rgba(30,30,30,0.7)',
          lineHeight: 1,
        }}>
          {label}
        </span>
        <span style={{
          fontFamily: "'Poppins', sans-serif",
          fontWeight: 400,
          fontSize: 40,
          letterSpacing: '-1.6px',
          color: '#1E1E1E',
          lineHeight: 1,
          whiteSpace: 'nowrap',
        }}>
          <AnimatedNumber
            target={value}
            prefix={prefix}
            suffix={suffix}
            locale={locale}
            decimals={decimals}
            delay={delay + 0.2}
          />
        </span>
      </div>
    </motion.div>
  )
}
