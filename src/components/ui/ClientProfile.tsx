/**
 * @file components/ui/ClientProfile.tsx
 * Drawer lateral com perfil detalhado de um cliente.
 */

import { useMemo } from 'react'
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
            <div
                onClick={onClose}
                style={{ position: 'fixed', inset: 0, background: 'var(--color-bg-tertiary)', zIndex: 300 }}
            />

            {/* Panel */}
            <div
                style={{
                    position: 'fixed', top: 0, right: 0, bottom: 0,
                    width: 380, background: 'var(--bg)',
                    borderLeft: '1px solid var(--color-border)',
                    zIndex: 301, overflowY: 'auto',
                    padding: '28px 32px 48px',
                    display: 'flex', flexDirection: 'column', gap: 0,
                }}
            >
                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 32 }}>
                    <div>
                        <p style={{ fontFamily: "var(--font-sans)", fontSize: 22, fontWeight: 400, letterSpacing: '-0.8px', color: 'var(--fg)', margin: 0 }}>
                            {client.name}
                        </p>
                        <p style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: 'var(--color-text-tertiary)', margin: '6px 0 0', letterSpacing: '0.03em' }}>
                            {client.channel} · {client.segment}
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: 'var(--color-text-tertiary)', display: 'flex' }}
                    >
                        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                            <line x1="1" y1="1" x2="13" y2="13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                            <line x1="13" y1="1" x2="1" y2="13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                        </svg>
                    </button>
                </div>

                {/* Metrics */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 0, marginBottom: 32 }}>
                    {[
                        { label: 'VALOR TOTAL', value: `R$ ${fmtBR(client.totalSpent)}` },
                        { label: 'CAC', value: client.cac > 0 ? `R$ ${fmtBR(client.cac)}` : 'Orgânico' },
                        { label: 'LTV', value: `R$ ${fmtBR(client.ltv)}` },
                        { label: 'MARGEM', value: `${client.margin}%` },
                    ].map((m) => (
                        <div key={m.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '13px 0', borderBottom: '1px solid var(--color-border)' }}>
                            <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: 'var(--color-text-tertiary)', letterSpacing: '0.04em' }}>{m.label}</span>
                            <span style={{ fontFamily: "var(--font-sans)", fontSize: 15, letterSpacing: '-0.4px', color: 'var(--fg)' }}>{m.value}</span>
                        </div>
                    ))}

                    {/* Churn probability */}
                    <div style={{ padding: '13px 0', borderBottom: '1px solid var(--color-border)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                            <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: 'var(--color-text-tertiary)', letterSpacing: '0.04em' }}>PROB. CHURN</span>
                            <span style={{ fontFamily: "var(--font-sans)", fontSize: 15, letterSpacing: '-0.4px', color: client.churnProb > 60 ? 'var(--color-text-tertiary)' : 'var(--fg)' }}>
                                {client.churnProb}%
                            </span>
                        </div>
                        <div style={{ height: 3, background: 'var(--color-border)', borderRadius: 99 }}>
                            <div
                                style={{ height: '100%', borderRadius: 99, background: 'var(--color-text-tertiary)', width: `${client.churnProb}%` }}
                            />
                        </div>
                    </div>
                </div>

                {/* Produtos */}
                <div style={{ marginBottom: 28 }}>
                    <p style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: 'var(--color-text-tertiary)', letterSpacing: '0.06em', marginBottom: 12 }}>PRODUTOS</p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {products.map(([name, qty]) => (
                            <div key={name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ fontFamily: "var(--font-sans)", fontSize: 13, letterSpacing: '-0.3px', color: 'var(--color-text-primary)' }}>{name}</span>
                                <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: 'var(--color-text-tertiary)' }}>{qty}×</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Purchase history */}
                <div>
                    <p style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: 'var(--color-text-tertiary)', letterSpacing: '0.06em', marginBottom: 12 }}>HISTÓRICO</p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                        {client.purchases.map((p, i) => (
                            <div
                                key={i}
                                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid var(--color-border)' }}
                            >
                                <div>
                                    <p style={{ fontFamily: "var(--font-sans)", fontSize: 12, letterSpacing: '-0.3px', color: 'var(--fg)', margin: 0 }}>{p.product}</p>
                                    <p style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: 'var(--color-text-tertiary)', margin: '2px 0 0' }}>{p.date}</p>
                                </div>
                                <span style={{ fontFamily: "var(--font-mono)", fontSize: 13, color: 'var(--color-text-secondary)' }}>
                                    R$ {fmtBR(p.value)}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </>
    )
}
