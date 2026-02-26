/**
 * @file components/ui/RFMCards.tsx
 * Cards de segmentação RFM com animação de deck 3D.
 */

import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { ClientUI, RFMSegment } from '../../types'

interface RFMConfig {
    label: string
    sub: string
    suggestion: string
}

const RFM_CONFIG: Record<RFMSegment, RFMConfig> = {
    'Champions': { label: 'Champions', sub: 'Compram com frequência, alto LTV', suggestion: 'Criar Lookalike no Meta' },
    'Em Risco': { label: 'Em Risco', sub: 'Alta inatividade, churn elevado', suggestion: 'Disparar reativação urgente' },
    'Novos Promissores': { label: 'Novos Promissores', sub: 'Primeira compra recente, potencial', suggestion: 'Nurturing e upsell' },
    'Inativos': { label: 'Inativos', sub: 'Sem atividade há 90+ dias', suggestion: 'Campanha de winback' },
}

const SEGMENTS: RFMSegment[] = ['Champions', 'Novos Promissores', 'Em Risco', 'Inativos']

function fmtBR(v: number) {
    return new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 }).format(v)
}

interface RFMCardsProps {
    clients: ClientUI[]
}

export default function RFMCards({ clients }: RFMCardsProps) {
    const [activeIndex, setActiveIndex] = useState(0)

    const stats = useMemo(() => {
        const result: Record<RFMSegment, { count: number; revenue: number }> = {
            'Champions': { count: 0, revenue: 0 },
            'Em Risco': { count: 0, revenue: 0 },
            'Novos Promissores': { count: 0, revenue: 0 },
            'Inativos': { count: 0, revenue: 0 },
        }
        clients.forEach(c => {
            result[c.segment].count++
            result[c.segment].revenue += c.totalSpent
        })
        return result
    }, [clients])

    return (
        <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                <p style={{ fontFamily: "'Geist Mono',monospace", fontSize: 12, color: 'rgba(var(--fg-rgb), 0.5)', letterSpacing: '0.06em', margin: 0 }}>
                    SEGMENTAÇÃO RFM
                </p>
                <div style={{ display: 'flex', gap: 12 }}>
                    <motion.button
                        onClick={() => setActiveIndex(p => Math.max(0, p - 1))}
                        whileTap={{ scale: 0.95 }}
                        style={{
                            background: 'none', border: '1px solid rgba(var(--fg-rgb), 0.1)', borderRadius: 4,
                            cursor: activeIndex === 0 ? 'default' : 'pointer',
                            color: 'var(--fg)', opacity: activeIndex === 0 ? 0.2 : 0.6, padding: '4px 8px',
                        }}
                    >
                        Anterior
                    </motion.button>
                    <motion.button
                        onClick={() => setActiveIndex(p => Math.min(SEGMENTS.length - 1, p + 1))}
                        whileTap={{ scale: 0.95 }}
                        style={{
                            background: 'none', border: '1px solid rgba(var(--fg-rgb), 0.1)', borderRadius: 4,
                            cursor: activeIndex === SEGMENTS.length - 1 ? 'default' : 'pointer',
                            color: 'var(--fg)', opacity: activeIndex === SEGMENTS.length - 1 ? 0.2 : 0.6, padding: '4px 8px',
                        }}
                    >
                        Próximo
                    </motion.button>
                </div>
            </div>

            <div style={{ position: 'relative', height: 320, width: '100%', perspective: 1000 }}>
                <AnimatePresence>
                    {SEGMENTS.map((seg, i) => {
                        const cfg = RFM_CONFIG[seg]
                        const data = stats[seg]
                        const offset = i - activeIndex
                        const isBehind = i > activeIndex
                        const isFront = i === activeIndex
                        const isPast = i < activeIndex

                        if (isPast) return null

                        return (
                            <motion.div
                                key={seg}
                                initial={{ opacity: 0, scale: 0.9, x: 20 }}
                                animate={{
                                    opacity: 1,
                                    scale: isFront ? 1 : 1 - (offset * 0.05),
                                    x: offset * 32,
                                    y: offset * -12,
                                    zIndex: SEGMENTS.length - i,
                                    boxShadow: isFront ? '0 12px 40px rgba(var(--fg-rgb), 0.12)' : '0 4px 12px rgba(var(--fg-rgb), 0.05)',
                                    filter: isFront ? 'blur(0px)' : 'blur(1px)',
                                }}
                                exit={{ opacity: 0, x: -100, rotate: -10 }}
                                transition={{ duration: 0.45, ease: [0.25, 0.1, 0.25, 1] }}
                                style={{
                                    position: 'absolute', top: 0, left: 0,
                                    width: 'calc(100% - 100px)',
                                    background: 'var(--bg)',
                                    border: '1px solid rgba(var(--fg-rgb), 0.1)',
                                    borderRadius: 12,
                                    padding: '32px',
                                    cursor: isFront ? 'default' : 'pointer',
                                }}
                                onClick={() => isBehind && setActiveIndex(i)}
                            >
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                    <div>
                                        <p style={{ fontFamily: "'Poppins',sans-serif", fontSize: 18, letterSpacing: '-0.5px', color: 'var(--fg)', margin: 0 }}>
                                            {cfg.label}
                                        </p>
                                        <p style={{ fontFamily: "'Geist Mono',monospace", fontSize: 11, color: 'rgba(var(--fg-rgb), 0.4)', margin: '6px 0 24px', letterSpacing: '0.02em', maxWidth: 200 }}>
                                            {cfg.sub}
                                        </p>
                                    </div>
                                    <div style={{
                                        width: 40, height: 40, borderRadius: '50%',
                                        border: '1px solid rgba(var(--fg-rgb), 0.1)',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        color: 'rgba(var(--fg-rgb), 0.3)',
                                    }}>
                                        {i + 1}
                                    </div>
                                </div>

                                <div style={{ display: 'flex', gap: 32, marginBottom: 32 }}>
                                    <div>
                                        <p style={{ fontFamily: "'Poppins',sans-serif", fontSize: 40, fontWeight: 400, letterSpacing: '-1.6px', color: 'var(--fg)', margin: 0, lineHeight: 1 }}>
                                            {data.count}
                                        </p>
                                        <p style={{ fontFamily: "'Geist Mono',monospace", fontSize: 11, color: 'rgba(var(--fg-rgb), 0.4)', margin: '8px 0 0', letterSpacing: '0.04em' }}>
                                            CLIENTES
                                        </p>
                                    </div>
                                    <div style={{ width: 1, background: 'rgba(var(--fg-rgb), 0.08)', flexShrink: 0 }} />
                                    <div>
                                        <p style={{ fontFamily: "'Poppins',sans-serif", fontSize: 22, fontWeight: 400, letterSpacing: '-0.8px', color: 'rgba(var(--fg-rgb), 0.8)', margin: 0, lineHeight: 1.2 }}>
                                            R$ {fmtBR(data.revenue)}
                                        </p>
                                        <p style={{ fontFamily: "'Geist Mono',monospace", fontSize: 11, color: 'rgba(var(--fg-rgb), 0.4)', margin: '8px 0 0', letterSpacing: '0.04em' }}>
                                            RECEITA ESTIMADA
                                        </p>
                                    </div>
                                </div>

                                <div style={{ borderTop: '1px solid rgba(var(--fg-rgb), 0.07)', paddingTop: 24 }}>
                                    <p style={{ fontFamily: "'Geist Mono',monospace", fontSize: 11, color: 'rgba(var(--fg-rgb), 0.5)', letterSpacing: '0.06em', margin: '0 0 10px' }}>
                                        IA STRATEGY
                                    </p>
                                    <p style={{ fontFamily: "'Poppins',sans-serif", fontSize: 14, letterSpacing: '-0.3px', color: 'rgba(var(--fg-rgb), 0.75)', margin: 0, lineHeight: 1.5 }}>
                                        {cfg.suggestion}
                                    </p>
                                </div>
                            </motion.div>
                        )
                    })}
                </AnimatePresence>
            </div>
        </div>
    )
}
