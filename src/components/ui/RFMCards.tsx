/**
 * @file components/ui/RFMCards.tsx
 * Segmentação RFM detalhada — visualização por segmento com métricas reais.
 */

import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { ClientUI, RFMSegment } from '../../types'

interface RFMConfig {
    label: string
    sub: string
    criteria: string
    suggestion: string
    accentColor: string
}

const RFM_CONFIG: Record<RFMSegment, RFMConfig> = {
    'Champions': {
        label: 'Champions',
        sub: 'Recência alta · Frequência alta · Valor alto',
        criteria: 'R ≥ 4 · F ≥ 3 · M ≥ 3',
        suggestion: 'Criar Lookalike no Meta com base nesse segmento',
        accentColor: 'var(--color-text-primary)',
    },
    'Em Risco': {
        label: 'Em Risco',
        sub: 'Compravam bem, pararam de comprar',
        criteria: 'R ≤ 2 com F ≥ 3 ou M ≥ 3',
        suggestion: 'Disparar campanha de reativação urgente',
        accentColor: 'var(--color-text-tertiary)',
    },
    'Novos Promissores': {
        label: 'Novos Promissores',
        sub: 'Compra recente, potencial de crescimento',
        criteria: 'Score médio — fora dos extremos',
        suggestion: 'Nurturing pós-compra e upsell imediato',
        accentColor: 'var(--color-text-secondary)',
    },
    'Inativos': {
        label: 'Inativos',
        sub: 'Sem atividade — score geral baixo',
        criteria: 'Média RFM ≤ 2',
        suggestion: 'Campanha de winback ou exclusão de lista',
        accentColor: 'var(--color-text-tertiary)',
    },
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
        const result: Record<RFMSegment, { count: number; revenue: number; ltvSum: number; churnSum: number }> = {
            'Champions': { count: 0, revenue: 0, ltvSum: 0, churnSum: 0 },
            'Em Risco': { count: 0, revenue: 0, ltvSum: 0, churnSum: 0 },
            'Novos Promissores': { count: 0, revenue: 0, ltvSum: 0, churnSum: 0 },
            'Inativos': { count: 0, revenue: 0, ltvSum: 0, churnSum: 0 },
        }
        clients.forEach(c => {
            result[c.segment].count++
            result[c.segment].revenue += c.totalSpent
            result[c.segment].ltvSum += c.ltv
            result[c.segment].churnSum += c.churnProb
        })
        return result
    }, [clients])

    const totalClients = clients.length || 1

    // Distribuição por segmento para a barra de progressos
    const distribution = SEGMENTS.map(seg => ({
        seg,
        count: stats[seg].count,
        pct: Math.round((stats[seg].count / totalClients) * 100),
    }))

    return (
        <div>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
                <div>
                    <p style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: 'var(--color-text-tertiary)', letterSpacing: '0.06em', margin: 0 }}>
                        SEGMENTAÇÃO RFM
                    </p>
                    <p style={{ fontFamily: "var(--font-sans)", fontSize: 13, color: 'var(--color-text-tertiary)', margin: '4px 0 0', letterSpacing: '-0.2px' }}>
                        Recência · Frequência · Valor
                    </p>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                    <motion.button
                        onClick={() => setActiveIndex(p => Math.max(0, p - 1))}
                        whileTap={{ scale: 0.95 }}
                        style={{
                            background: 'none', border: '1px solid var(--color-border)', borderRadius: 4,
                            cursor: activeIndex === 0 ? 'default' : 'pointer',
                            color: 'var(--fg)', opacity: activeIndex === 0 ? 0.2 : 0.6, padding: '4px 10px',
                            fontFamily: "var(--font-sans)", fontSize: 12,
                        }}
                    >
                        ←
                    </motion.button>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: 'var(--color-text-tertiary)', alignSelf: 'center' }}>
                        {activeIndex + 1} / {SEGMENTS.length}
                    </span>
                    <motion.button
                        onClick={() => setActiveIndex(p => Math.min(SEGMENTS.length - 1, p + 1))}
                        whileTap={{ scale: 0.95 }}
                        style={{
                            background: 'none', border: '1px solid var(--color-border)', borderRadius: 4,
                            cursor: activeIndex === SEGMENTS.length - 1 ? 'default' : 'pointer',
                            color: 'var(--fg)', opacity: activeIndex === SEGMENTS.length - 1 ? 0.2 : 0.6, padding: '4px 10px',
                            fontFamily: "var(--font-sans)", fontSize: 12,
                        }}
                    >
                        →
                    </motion.button>
                </div>
            </div>

            {/* Distribuição — barra horizontal */}
            <div style={{ display: 'flex', gap: 3, marginBottom: 28, height: 4, borderRadius: 4, overflow: 'hidden' }}>
                {distribution.map(d => (
                    <motion.div
                        key={d.seg}
                        initial={{ width: 0 }}
                        animate={{ width: `${d.pct}%` }}
                        transition={{ duration: 0.6, ease: [0.4, 0, 0.2, 1] }}
                        title={`${d.seg}: ${d.count} clientes (${d.pct}%)`}
                        style={{
                            height: '100%',
                            background: RFM_CONFIG[d.seg].accentColor,
                            borderRadius: 2,
                        }}
                    />
                ))}
            </div>

            {/* Deck de cards */}
            <div style={{ position: 'relative', height: 340, width: '100%', perspective: 1000 }}>
                <AnimatePresence>
                    {SEGMENTS.map((seg, i) => {
                        const cfg = RFM_CONFIG[seg]
                        const data = stats[seg]
                        const offset = i - activeIndex
                        const isBehind = i > activeIndex
                        const isFront = i === activeIndex
                        const isPast = i < activeIndex
                        const avgLtv = data.count > 0 ? data.ltvSum / data.count : 0
                        const avgChurn = data.count > 0 ? data.churnSum / data.count : 0
                        const pctBase = Math.round((data.count / totalClients) * 100)

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
                                    boxShadow: isFront ? '0 12px 40px var(--color-border)' : '0 4px 12px var(--color-bg-secondary)',
                                    filter: isFront ? 'blur(0px)' : 'blur(1px)',
                                }}
                                exit={{ opacity: 0, x: -100, rotate: -10 }}
                                transition={{ duration: 0.45, ease: [0.25, 0.1, 0.25, 1] }}
                                style={{
                                    position: 'absolute', top: 0, left: 0,
                                    width: 'calc(100% - 110px)',
                                    background: 'var(--bg)',
                                    border: '1px solid var(--color-border)',
                                    borderRadius: 12,
                                    padding: '28px 32px',
                                    cursor: isFront ? 'default' : 'pointer',
                                }}
                                onClick={() => isBehind && setActiveIndex(i)}
                            >
                                {/* Card header */}
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
                                    <div>
                                        <p style={{ fontFamily: "var(--font-sans)", fontSize: 18, letterSpacing: '-0.5px', color: 'var(--fg)', margin: 0 }}>
                                            {cfg.label}
                                        </p>
                                        <p style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: 'var(--color-text-tertiary)', margin: '5px 0 0', letterSpacing: '0.03em' }}>
                                            {cfg.criteria}
                                        </p>
                                    </div>
                                    <div style={{
                                        padding: '3px 10px', borderRadius: 20,
                                        border: '1px solid var(--color-border)',
                                        fontFamily: "var(--font-mono)", fontSize: 11,
                                        color: 'var(--color-text-tertiary)',
                                    }}>
                                        {pctBase}% da base
                                    </div>
                                </div>

                                {/* Métricas principais */}
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 0, marginBottom: 20 }}>
                                    {[
                                        { label: 'CLIENTES', value: String(data.count) },
                                        { label: 'RECEITA TOTAL', value: `R$ ${fmtBR(data.revenue)}` },
                                        { label: 'LTV MÉDIO', value: `R$ ${fmtBR(avgLtv)}` },
                                        { label: 'CHURN MÉDIO', value: `${avgChurn.toFixed(1)}%` },
                                    ].map((m, mi) => (
                                        <div key={m.label} style={{ paddingRight: 16, borderRight: mi < 3 ? '1px solid var(--color-border)' : 'none', paddingLeft: mi > 0 ? 16 : 0 }}>
                                            <p style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: 'var(--color-text-tertiary)', letterSpacing: '0.06em', margin: '0 0 6px', textTransform: 'uppercase' as const }}>
                                                {m.label}
                                            </p>
                                            <p style={{ fontFamily: "var(--font-sans)", fontSize: mi === 0 ? 28 : 16, fontWeight: 400, letterSpacing: mi === 0 ? '-1px' : '-0.4px', color: 'var(--fg)', margin: 0, lineHeight: 1.1 }}>
                                                {m.value}
                                            </p>
                                        </div>
                                    ))}
                                </div>

                                {/* Barra de churn visual */}
                                {data.count > 0 && (
                                    <div style={{ marginBottom: 18 }}>
                                        <div style={{ height: 2, background: 'var(--color-border)', borderRadius: 2, overflow: 'hidden' }}>
                                            <motion.div
                                                initial={{ width: 0 }}
                                                animate={{ width: `${Math.min(avgChurn, 100)}%` }}
                                                transition={{ duration: 0.8, ease: [0.4, 0, 0.2, 1], delay: 0.1 }}
                                                style={{ height: '100%', background: cfg.accentColor, borderRadius: 2 }}
                                            />
                                        </div>
                                        <p style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: 'var(--color-text-tertiary)', margin: '4px 0 0', letterSpacing: '0.04em' }}>
                                            RISCO DE CHURN
                                        </p>
                                    </div>
                                )}

                                {/* Estratégia */}
                                <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" style={{ flexShrink: 0, opacity: 0.4 }}>
                                        <path d="M5 1L6.2 4.2H9.5L6.9 6.3L7.9 9.5L5 7.4L2.1 9.5L3.1 6.3L0.5 4.2H3.8L5 1Z" fill="currentColor"/>
                                    </svg>
                                    <p style={{ fontFamily: "var(--font-sans)", fontSize: 13, letterSpacing: '-0.3px', color: 'var(--color-text-secondary)', margin: 0, lineHeight: 1.4 }}>
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
