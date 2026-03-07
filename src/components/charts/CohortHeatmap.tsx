/**
 * @file components/charts/CohortHeatmap.tsx
 * Heatmap de cohort de retenção de clientes.
 */

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { dashboardApi } from '../../lib/api'
import type { CohortRow } from '../../types'

const PERIOD_COLS: { key: keyof CohortRow['retentions']; label: string }[] = [
    { key: '30d', label: '30d' },
    { key: '60d', label: '60d' },
    { key: '90d', label: '90d' },
    { key: '180d', label: '180d' },
]

function cellBg(v: number | null): string {
    if (v === null || v === undefined) return 'transparent'
    return `rgba(var(--fg-rgb), ${(v / 100) * 0.6})`
}

function cellColor(v: number | null): string {
    if (v === null || v === undefined) return 'rgba(var(--fg-rgb), 0.2)'
    return v > 50 ? 'var(--on-inv)' : 'var(--fg)'
}

export default function CohortHeatmap({ initialData }: { initialData?: CohortRow[] } = {}) {
    const [data, setData] = useState<CohortRow[]>(initialData ?? [])
    const [loading, setLoading] = useState(!initialData)

    useEffect(() => {
        if (initialData) return
        dashboardApi.getRetention()
            .then(res => setData(res.data))
            .catch(console.error)
            .finally(() => setLoading(false))
    }, [])

    if (loading) {
        return <div style={{ height: 300, background: 'rgba(var(--fg-rgb), 0.02)', borderRadius: 8 }} />
    }

    return (
        <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                <p style={{ fontFamily: "'Geist Mono', monospace", fontSize: 12, color: 'rgba(var(--fg-rgb), 0.5)', letterSpacing: '0.06em', margin: 0 }}>
                    COHORT DE RETENÇÃO (GERAL)
                </p>
            </div>

            <div style={{ overflowX: 'auto' }}>
                {/* Header row */}
                <div style={{ display: 'grid', gridTemplateColumns: '80px 56px repeat(4, 72px)', gap: 4, marginBottom: 4 }}>
                    <span style={{ fontFamily: "'Geist Mono',monospace", fontSize: 11, color: 'rgba(var(--fg-rgb), 0.45)', letterSpacing: '0.04em' }}>SAFRA</span>
                    <span style={{ fontFamily: "'Geist Mono',monospace", fontSize: 11, color: 'rgba(var(--fg-rgb), 0.45)', letterSpacing: '0.04em', textAlign: 'center' }}>N</span>
                    {PERIOD_COLS.map(p => (
                        <span key={p.key} style={{ fontFamily: "'Geist Mono',monospace", fontSize: 11, color: 'rgba(var(--fg-rgb), 0.45)', letterSpacing: '0.04em', textAlign: 'center' }}>
                            {p.label}
                        </span>
                    ))}
                </div>

                {data.map((row, ri) => (
                    <motion.div
                        key={row.month}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.3, delay: ri * 0.06 + 0.1 }}
                        style={{ display: 'grid', gridTemplateColumns: '80px 56px repeat(4, 72px)', gap: 4, marginBottom: 4 }}
                    >
                        <span style={{ fontFamily: "'Geist Mono',monospace", fontSize: 12, color: 'rgba(var(--fg-rgb), 0.6)', display: 'flex', alignItems: 'center' }}>
                            {row.month}
                        </span>
                        <span style={{ fontFamily: "'Geist Mono',monospace", fontSize: 12, color: 'rgba(var(--fg-rgb), 0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            {row.n}
                        </span>
                        {PERIOD_COLS.map(p => {
                            const val = row.retentions[p.key]
                            return (
                                <div
                                    key={p.key}
                                    style={{
                                        height: 48, borderRadius: 3,
                                        background: cellBg(val),
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        border: (val === null || val === undefined) ? '1px dashed rgba(var(--fg-rgb), 0.07)' : 'none',
                                    }}
                                >
                                    <span style={{ fontFamily: "'Geist Mono',monospace", fontSize: 12, color: cellColor(val), letterSpacing: '0.02em' }}>
                                        {(val !== null && val !== undefined) ? `${val}%` : '—'}
                                    </span>
                                </div>
                            )
                        })}
                    </motion.div>
                ))}
            </div>

            <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6, duration: 0.4 }}
                style={{
                    marginTop: 28, padding: '20px',
                    background: 'rgba(var(--fg-rgb), 0.02)', borderRadius: 8,
                    border: '1px solid rgba(var(--fg-rgb), 0.06)',
                }}
            >
                <p style={{ fontFamily: "'Geist Mono', monospace", fontSize: 10, color: 'rgba(var(--fg-rgb), 0.45)', letterSpacing: '0.08em', margin: '0 0 8px', textTransform: 'uppercase' }}>
                    Insight de Retenção
                </p>
                <p style={{ fontFamily: "var(--font-sans)", fontSize: 13, color: 'rgba(var(--fg-rgb), 0.7)', margin: 0, lineHeight: 1.6, letterSpacing: '-0.2px' }}>
                    Este gráfico mostra a porcentagem de clientes que realizaram uma nova compra após X dias da primeira compra, agrupados pelo mês em que se tornaram clientes (Safra).
                </p>
            </motion.div>
        </div>
    )
}
