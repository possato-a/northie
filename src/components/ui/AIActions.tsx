/**
 * @file components/ui/AIActions.tsx
 * Feed de ações sugeridas pela IA para segmentos de clientes.
 */

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { RFMSegment } from '../../types'

interface AIAction {
    id: string
    count: number
    description: string
    action: string
    segment: RFMSegment
}

const AI_ACTIONS: AIAction[] = [
    { id: '1', count: 12, description: 'clientes compraram há mais de 90 dias e têm LTV acima de R$2.000', action: 'Criar campanha de reativação', segment: 'Champions' },
    { id: '2', count: 8, description: 'novos clientes via Google Orgânico com ticket acima de R$500 este mês', action: 'Criar Lookalike no Meta', segment: 'Novos Promissores' },
    { id: '3', count: 18, description: 'clientes Em Risco não abriram nenhum e-mail nos últimos 30 dias', action: 'Disparar sequência de reativação', segment: 'Em Risco' },
    { id: '4', count: 5, description: 'Champions compraram 3+ vezes e ainda não têm indicações registradas', action: 'Ativar programa de indicação', segment: 'Champions' },
]

export default function AIActions() {
    const [dismissed, setDismissed] = useState<Set<string>>(new Set())
    const [approved, setApproved] = useState<Set<string>>(new Set())

    const visible = AI_ACTIONS.filter(a => !dismissed.has(a.id))

    return (
        <div>
            <p style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: 'var(--color-text-tertiary)', letterSpacing: '0.06em', marginBottom: 20 }}>
                AÇÕES DA IA
            </p>
            <AnimatePresence mode="popLayout">
                {visible.length === 0 ? (
                    <motion.p
                        key="empty"
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        style={{ fontFamily: "var(--font-sans)", fontSize: 14, color: 'var(--color-text-tertiary)', padding: '8px 0' }}
                    >
                        Todas as sugestões foram processadas.
                    </motion.p>
                ) : visible.map((action, i) => {
                    const isApproved = approved.has(action.id)
                    return (
                        <motion.div
                            key={action.id}
                            layout
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, x: 24, transition: { duration: 0.2 } }}
                            transition={{ duration: 0.3, delay: i * 0.06, ease: [0.25, 0.1, 0.25, 1] }}
                            style={{
                                display: 'flex', alignItems: 'center', gap: 16,
                                padding: '16px 20px',
                                border: '1px solid var(--color-border)',
                                borderRadius: 6,
                                marginBottom: 8,
                            }}
                        >
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <p style={{ fontFamily: "var(--font-sans)", fontSize: 14, letterSpacing: '-0.4px', color: 'var(--fg)', margin: 0 }}>
                                    <span style={{ fontFamily: "var(--font-mono)", fontWeight: 500, color: 'var(--fg)' }}>{action.count}</span>
                                    {' '}{action.description}.
                                </p>
                                <p style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: 'var(--color-text-tertiary)', margin: '4px 0 0', letterSpacing: '0.03em' }}>
                                    {action.action} · {action.segment}
                                </p>
                            </div>
                            <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                                <motion.button
                                    onClick={() => {
                                        setApproved(s => new Set([...s, action.id]))
                                        setTimeout(() => setDismissed(s => new Set([...s, action.id])), 600)
                                    }}
                                    whileHover={{ opacity: isApproved ? 1 : 0.8 }}
                                    whileTap={{ scale: 0.96 }}
                                    style={{
                                        fontFamily: "var(--font-sans)", fontSize: 13, letterSpacing: '-0.3px',
                                        padding: '7px 16px', borderRadius: 3, border: 'none', cursor: 'pointer',
                                        background: isApproved ? 'var(--color-text-primary)' : 'var(--inv)',
                                        color: 'var(--on-inv)', transition: 'background 0.2s',
                                    }}
                                >
                                    {isApproved ? 'Aprovado ✓' : 'Aprovar'}
                                </motion.button>
                                <motion.button
                                    onClick={() => setDismissed(s => new Set([...s, action.id]))}
                                    whileHover={{ backgroundColor: 'var(--color-border)' }}
                                    whileTap={{ scale: 0.96 }}
                                    style={{
                                        fontFamily: "var(--font-sans)", fontSize: 13, letterSpacing: '-0.3px',
                                        padding: '7px 12px', borderRadius: 3,
                                        border: '1px solid var(--color-border)',
                                        background: 'transparent', cursor: 'pointer',
                                        color: 'var(--color-text-tertiary)',
                                    }}
                                >
                                    Ignorar
                                </motion.button>
                            </div>
                        </motion.div>
                    )
                })}
            </AnimatePresence>
        </div>
    )
}
