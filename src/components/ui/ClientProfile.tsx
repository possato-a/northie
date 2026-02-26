/**
 * @file components/ui/ClientProfile.tsx
 * Drawer lateral com perfil detalhado de um cliente.
 */

import { useMemo } from 'react'
import { motion } from 'framer-motion'
import { fmtBR } from '../../lib/utils'
import type { ClientUI } from '../../types'

interface ClientProfileProps {
    client: ClientUI
    onClose: () => void
}

export default function ClientProfile({ client, onClose }: ClientProfileProps) {
    const products = useMemo(() => {
        const map = new Map<string, number>()
        client.purchases.forEach(p => map.set(p.product, (map.get(p.product) ?? 0) + 1))
        return Array.from(map.entries()).sort((a, b) => b[1] - a[1])
    }, [client])

    return (
        <>
            {/* Overlay */}
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                onClick={onClose}
                style={{ position: 'fixed', inset: 0, background: 'rgba(var(--fg-rgb), 0.12)', zIndex: 300 }}
            />

            {/* Panel */}
            <motion.div
                initial={{ x: 400, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: 400, opacity: 0 }}
                transition={{ duration: 0.32, ease: [0.4, 0, 0.2, 1] }}
                style={{
                    position: 'fixed', top: 0, right: 0, bottom: 0,
                    width: 380, background: 'var(--bg)',
                    borderLeft: '1px solid rgba(var(--fg-rgb), 0.12)',
                    zIndex: 301, overflowY: 'auto',
                    padding: '28px 32px 48px',
                    display: 'flex', flexDirection: 'column', gap: 0,
                }}
            >
                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 32 }}>
                    <div>
                        <p style={{ fontFamily: "'Poppins',sans-serif", fontSize: 22, fontWeight: 400, letterSpacing: '-0.8px', color: 'var(--fg)', margin: 0 }}>
                            {client.name}
                        </p>
                        <p style={{ fontFamily: "'Geist Mono',monospace", fontSize: 11, color: 'rgba(var(--fg-rgb), 0.45)', margin: '6px 0 0', letterSpacing: '0.03em' }}>
                            {client.channel} · {client.segment}
                        </p>
                    </div>
                    <motion.button
                        onClick={onClose}
                        whileHover={{ opacity: 0.6 }}
                        whileTap={{ scale: 0.92 }}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: 'rgba(var(--fg-rgb), 0.5)', display: 'flex' }}
                    >
                        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                            <line x1="1" y1="1" x2="13" y2="13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                            <line x1="13" y1="1" x2="1" y2="13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                        </svg>
                    </motion.button>
                </div>

                {/* Metrics */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 0, marginBottom: 32 }}>
                    {[
                        { label: 'VALOR TOTAL', value: `R$ ${fmtBR(client.totalSpent)}` },
                        { label: 'CAC', value: client.cac > 0 ? `R$ ${fmtBR(client.cac)}` : 'Orgânico' },
                        { label: 'LTV', value: `R$ ${fmtBR(client.ltv)}` },
                        { label: 'MARGEM', value: `${client.margin}%` },
                    ].map((m) => (
                        <div key={m.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '13px 0', borderBottom: '1px solid rgba(var(--fg-rgb), 0.07)' }}>
                            <span style={{ fontFamily: "'Geist Mono',monospace", fontSize: 11, color: 'rgba(var(--fg-rgb), 0.45)', letterSpacing: '0.04em' }}>{m.label}</span>
                            <span style={{ fontFamily: "'Poppins',sans-serif", fontSize: 15, letterSpacing: '-0.4px', color: 'var(--fg)' }}>{m.value}</span>
                        </div>
                    ))}

                    {/* Churn probability */}
                    <div style={{ padding: '13px 0', borderBottom: '1px solid rgba(var(--fg-rgb), 0.07)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                            <span style={{ fontFamily: "'Geist Mono',monospace", fontSize: 11, color: 'rgba(var(--fg-rgb), 0.45)', letterSpacing: '0.04em' }}>PROB. CHURN</span>
                            <span style={{ fontFamily: "'Poppins',sans-serif", fontSize: 15, letterSpacing: '-0.4px', color: client.churnProb > 60 ? 'rgba(var(--fg-rgb), 0.45)' : 'var(--fg)' }}>
                                {client.churnProb}%
                            </span>
                        </div>
                        <div style={{ height: 3, background: 'rgba(var(--fg-rgb), 0.07)', borderRadius: 99 }}>
                            <motion.div
                                style={{ height: '100%', borderRadius: 99, background: `rgba(var(--fg-rgb), ${0.15 + client.churnProb / 100 * 0.7})` }}
                                initial={{ width: 0 }}
                                animate={{ width: `${client.churnProb}%` }}
                                transition={{ duration: 0.8, ease: [0.4, 0, 0.2, 1] }}
                            />
                        </div>
                    </div>
                </div>

                {/* Produtos */}
                <div style={{ marginBottom: 28 }}>
                    <p style={{ fontFamily: "'Geist Mono',monospace", fontSize: 11, color: 'rgba(var(--fg-rgb), 0.45)', letterSpacing: '0.06em', marginBottom: 12 }}>PRODUTOS</p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {products.map(([name, qty]) => (
                            <div key={name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ fontFamily: "'Poppins',sans-serif", fontSize: 13, letterSpacing: '-0.3px', color: 'rgba(var(--fg-rgb), 0.8)' }}>{name}</span>
                                <span style={{ fontFamily: "'Geist Mono',monospace", fontSize: 11, color: 'rgba(var(--fg-rgb), 0.4)' }}>{qty}×</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Purchase history */}
                <div>
                    <p style={{ fontFamily: "'Geist Mono',monospace", fontSize: 11, color: 'rgba(var(--fg-rgb), 0.45)', letterSpacing: '0.06em', marginBottom: 12 }}>HISTÓRICO</p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                        {client.purchases.map((p, i) => (
                            <motion.div
                                key={i}
                                initial={{ opacity: 0, x: 8 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ duration: 0.2, delay: i * 0.04 }}
                                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid rgba(var(--fg-rgb), 0.055)' }}
                            >
                                <div>
                                    <p style={{ fontFamily: "'Poppins',sans-serif", fontSize: 12, letterSpacing: '-0.3px', color: 'var(--fg)', margin: 0 }}>{p.product}</p>
                                    <p style={{ fontFamily: "'Geist Mono',monospace", fontSize: 10, color: 'rgba(var(--fg-rgb), 0.38)', margin: '2px 0 0' }}>{p.date}</p>
                                </div>
                                <span style={{ fontFamily: "'Geist Mono',monospace", fontSize: 13, color: 'rgba(var(--fg-rgb), 0.7)' }}>
                                    R$ {fmtBR(p.value)}
                                </span>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </motion.div>
        </>
    )
}
