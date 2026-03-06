import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import TopBar from '../components/layout/TopBar'
import { KpiCard } from '../components/ui/KpiCard'
import { PageHeader, Divider, Btn, SectionLabel, Modal, StatMini, EmptyState } from '../components/ui/shared'
import api from '../lib/api'

interface PageProps {
    onToggleChat: () => void
}

// ── tipos ─────────────────────────────────────────────────────────
type CardPageState = 'not_eligible' | 'eligible' | 'pending_review' | 'active'

interface NorthieCard {
    id: string
    type: 'virtual' | 'physical'
    lastFour: string
    holder: string
    expiry: string
    frozen: boolean
    limit_brl: number
}

interface CreditInfo {
    approved_limit: number
    used_amount: number
    split_rate: number
    term_months: number
    purpose: string[]
    cards: NorthieCard[]
}

// ── Capital Score Gauge ───────────────────────────────────────────
function ScoreGauge({ score, size = 180 }: { score: number; size?: number }) {
    const radius = (size - 24) / 2
    const circumference = 2 * Math.PI * radius
    const arcLength = circumference * 0.75
    const offset = arcLength - (score / 100) * arcLength

    return (
        <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
            <svg width={size} height={size} style={{ transform: 'rotate(135deg)' }}>
                <circle cx={size / 2} cy={size / 2} r={radius} fill="none"
                    stroke="var(--color-border)" strokeWidth={12}
                    strokeDasharray={`${arcLength} ${circumference}`} strokeLinecap="round" />
                <motion.circle cx={size / 2} cy={size / 2} r={radius} fill="none"
                    stroke="var(--color-text-primary)" strokeWidth={12}
                    strokeDasharray={`${arcLength} ${circumference}`} strokeLinecap="round"
                    initial={{ strokeDashoffset: arcLength }}
                    animate={{ strokeDashoffset: offset }}
                    transition={{ duration: 1.6, ease: [0.16, 1, 0.3, 1], delay: 0.3 }} />
            </svg>
            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', paddingTop: 16 }}>
                <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}
                    style={{ fontFamily: 'var(--font-mono)', fontSize: 44, fontWeight: 600, letterSpacing: '-2px', color: 'var(--color-text-primary)', lineHeight: 1 }}>
                    {score}
                </motion.span>
                <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }}
                    style={{ fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.12em', color: 'var(--color-text-tertiary)', textTransform: 'uppercase', marginTop: 4 }}>
                    / 100
                </motion.span>
            </div>
        </div>
    )
}

// ── Barra de dimensão ─────────────────────────────────────────────
function DimensionBar({ label, value, max = 25, delay = 0 }: { label: string; value: number; max?: number; delay?: number }) {
    const pct = (value / max) * 100
    return (
        <motion.div initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.35, delay, ease: [0.25, 0.1, 0.25, 1] }}
            style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <span style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)' }}>{label}</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-sm)', color: 'var(--color-text-primary)', fontWeight: 500 }}>
                    {value}<span style={{ color: 'var(--color-text-tertiary)' }}>/{max}</span>
                </span>
            </div>
            <div style={{ height: 4, background: 'var(--color-border)', borderRadius: 'var(--radius-full)', overflow: 'hidden' }}>
                <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }}
                    transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1], delay: delay + 0.2 }}
                    style={{ height: '100%', background: 'rgba(var(--fg-rgb), 0.65)', borderRadius: 'var(--radius-full)' }} />
            </div>
        </motion.div>
    )
}

// ── Visual do cartão ──────────────────────────────────────────────
function CardVisual({ card, onToggleFreeze }: { card: NorthieCard; onToggleFreeze: (id: string) => void }) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: [0.25, 0.1, 0.25, 1] }}
            style={{ position: 'relative', borderRadius: 16, overflow: 'hidden', aspectRatio: '1.586', userSelect: 'none' }}
        >
            {/* Fundo do cartão */}
            <div style={{
                width: '100%', height: '100%', padding: '20px 24px',
                background: 'linear-gradient(135deg, var(--inv) 0%, color-mix(in srgb, var(--inv) 85%, transparent) 100%)',
                display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
                boxSizing: 'border-box',
            }}>
                {/* Padrão de fundo sutil */}
                <div style={{
                    position: 'absolute', inset: 0, opacity: 0.04,
                    backgroundImage: 'radial-gradient(circle at 1px 1px, var(--on-inv) 1px, transparent 0)',
                    backgroundSize: '24px 24px',
                }} />

                {/* Topo: logo + tipo */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'relative' }}>
                    <span style={{ fontFamily: 'var(--font-serif)', fontSize: 18, color: 'var(--on-inv)', letterSpacing: '-0.3px', opacity: 0.9 }}>
                        Northie
                    </span>
                    <span style={{
                        fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.15em',
                        color: 'var(--on-inv)', opacity: 0.5, textTransform: 'uppercase',
                    }}>
                        {card.type === 'virtual' ? 'Virtual' : 'Físico'}
                    </span>
                </div>

                {/* Chip */}
                <div style={{ position: 'relative' }}>
                    <svg width="32" height="24" viewBox="0 0 32 24" fill="none">
                        <rect width="32" height="24" rx="4" fill="rgba(255,255,255,0.15)" />
                        <rect x="10" y="0" width="12" height="24" fill="rgba(255,255,255,0.08)" />
                        <rect x="0" y="8" width="32" height="8" fill="rgba(255,255,255,0.08)" />
                        <rect x="13" y="6" width="6" height="12" rx="1" fill="rgba(255,255,255,0.12)" />
                    </svg>
                </div>

                {/* Número */}
                <div style={{ position: 'relative' }}>
                    <p style={{
                        fontFamily: 'var(--font-mono)', fontSize: 15, letterSpacing: '0.18em',
                        color: 'var(--on-inv)', margin: 0, opacity: 0.85,
                    }}>
                        •••• •••• •••• {card.lastFour}
                    </p>
                </div>

                {/* Rodapé: holder + expiry */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', position: 'relative' }}>
                    <div>
                        <p style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.1em', color: 'var(--on-inv)', opacity: 0.4, margin: '0 0 3px', textTransform: 'uppercase' }}>Titular</p>
                        <p style={{ fontFamily: 'var(--font-mono)', fontSize: 12, letterSpacing: '0.08em', color: 'var(--on-inv)', opacity: 0.8, margin: 0, textTransform: 'uppercase' }}>{card.holder}</p>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                        <p style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.1em', color: 'var(--on-inv)', opacity: 0.4, margin: '0 0 3px', textTransform: 'uppercase' }}>Validade</p>
                        <p style={{ fontFamily: 'var(--font-mono)', fontSize: 12, letterSpacing: '0.08em', color: 'var(--on-inv)', opacity: 0.8, margin: 0 }}>{card.expiry}</p>
                    </div>
                </div>
            </div>

            {/* Overlay de congelado */}
            <AnimatePresence>
                {card.frozen && (
                    <motion.div
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        style={{
                            position: 'absolute', inset: 0,
                            background: 'rgba(var(--fg-rgb), 0.55)',
                            backdropFilter: 'blur(6px)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            borderRadius: 16,
                        }}
                    >
                        <div style={{ textAlign: 'center' }}>
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--on-inv)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.7 }}>
                                <rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
                            </svg>
                            <p style={{ fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.12em', color: 'var(--on-inv)', opacity: 0.7, margin: '8px 0 0', textTransform: 'uppercase' }}>
                                Congelado
                            </p>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Ação de congelar */}
            <motion.button
                onClick={() => onToggleFreeze(card.id)}
                whileHover={{ opacity: 0.8 }} whileTap={{ scale: 0.95 }}
                style={{
                    position: 'absolute', top: 12, right: 12,
                    background: 'rgba(255,255,255,0.12)', border: 'none',
                    borderRadius: 'var(--radius-md)', padding: '5px 10px',
                    cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5,
                }}
            >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    {card.frozen
                        ? <><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></>
                        : <><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 9.9-1" /></>
                    }
                </svg>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.08em', color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase' }}>
                    {card.frozen ? 'Descongelar' : 'Congelar'}
                </span>
            </motion.button>
        </motion.div>
    )
}

// ── Barra de uso de crédito ────────────────────────────────────────
function CreditUsageBar({ used, total }: { used: number; total: number }) {
    const pct = total > 0 ? (used / total) * 100 : 0
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <span style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)' }}>
                    Utilização do limite
                </span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-sm)', color: 'var(--color-text-primary)', fontWeight: 600 }}>
                    {pct.toFixed(0)}%
                </span>
            </div>
            <div style={{ height: 6, background: 'var(--color-border)', borderRadius: 'var(--radius-full)', overflow: 'hidden' }}>
                <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }}
                    transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1], delay: 0.3 }}
                    style={{ height: '100%', background: 'var(--color-text-primary)', borderRadius: 'var(--radius-full)' }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--color-text-tertiary)' }}>
                    Usado: R$ {used.toLocaleString('pt-BR')}
                </span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--color-text-tertiary)' }}>
                    Disponível: R$ {(total - used).toLocaleString('pt-BR')}
                </span>
            </div>
        </div>
    )
}

// ── Modal de solicitação de crédito (3 etapas) ────────────────────
const PURPOSES = [
    { id: 'meta', label: 'Meta Ads' },
    { id: 'google', label: 'Google Ads' },
    { id: 'fornecedores', label: 'Fornecedores' },
    { id: 'ferramentas', label: 'Ferramentas' },
    { id: 'salarios', label: 'Salários' },
    { id: 'outros', label: 'Outros' },
]
const TERMS = [6, 12, 18, 24]

function CreditRequestModal({ maxLimit, onClose, onConfirm, loading }: {
    maxLimit: number; onClose: () => void; onConfirm: (amount: number, purposes: string[], term: number) => void; loading?: boolean
}) {
    const [step, setStep] = useState<1 | 2 | 3>(1)
    const [amount, setAmount] = useState(Math.round(maxLimit * 0.5 / 1000) * 1000)
    const [purposes, setPurposes] = useState<string[]>([])
    const [term, setTerm] = useState(12)

    const splitRate = term === 6 ? 0.18 : term === 12 ? 0.12 : term === 18 ? 0.09 : 0.07
    const monthlyRepayment = amount * splitRate

    const togglePurpose = (id: string) =>
        setPurposes(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id])

    const titles = ['Quanto você precisa?', 'Para que vai usar?', 'Resumo do crédito']

    return (
        <Modal onClose={onClose} title={titles[step - 1]} maxWidth={480}>
            {/* Indicador de etapa */}
            <div style={{ display: 'flex', gap: 6, marginBottom: 28 }}>
                {[1, 2, 3].map(s => (
                    <div key={s} style={{
                        flex: 1, height: 3, borderRadius: 'var(--radius-full)',
                        background: s <= step ? 'var(--color-text-primary)' : 'var(--color-border)',
                        transition: 'background 0.3s',
                    }} />
                ))}
            </div>

            <AnimatePresence mode="wait">
                {/* Etapa 1: Valor */}
                {step === 1 && (
                    <motion.div key="step1" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }}
                        transition={{ duration: 0.2 }} style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                        <div style={{ textAlign: 'center' }}>
                            <p style={{ fontFamily: 'var(--font-mono)', fontSize: 48, fontWeight: 600, letterSpacing: '-2px', color: 'var(--color-text-primary)', margin: 0 }}>
                                R$ {amount.toLocaleString('pt-BR')}
                            </p>
                            <p style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', color: 'var(--color-text-tertiary)', margin: '6px 0 0' }}>
                                Limite máximo: R$ {maxLimit.toLocaleString('pt-BR')}
                            </p>
                        </div>
                        <input
                            type="range"
                            min={1000} max={maxLimit} step={500}
                            value={amount}
                            onChange={e => setAmount(Number(e.target.value))}
                            style={{ width: '100%', accentColor: 'var(--color-primary)', cursor: 'pointer' }}
                        />
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--color-text-tertiary)' }}>R$ 1.000</span>
                            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--color-text-tertiary)' }}>R$ {maxLimit.toLocaleString('pt-BR')}</span>
                        </div>
                        <Btn variant="primary" fullWidth onClick={() => setStep(2)}>
                            Continuar →
                        </Btn>
                    </motion.div>
                )}

                {/* Etapa 2: Finalidade */}
                {step === 2 && (
                    <motion.div key="step2" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }}
                        transition={{ duration: 0.2 }} style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                        <p style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)', margin: 0 }}>
                            Selecione todos que se aplicam.
                        </p>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                            {PURPOSES.map(p => {
                                const active = purposes.includes(p.id)
                                return (
                                    <motion.button
                                        key={p.id} onClick={() => togglePurpose(p.id)}
                                        whileTap={{ scale: 0.97 }}
                                        style={{
                                            padding: '12px 16px', border: `1px solid ${active ? 'var(--color-primary)' : 'var(--color-border)'}`,
                                            borderRadius: 'var(--radius-md)', background: active ? 'rgba(var(--color-primary-rgb, 30,100,220), 0.08)' : 'transparent',
                                            cursor: 'pointer', fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)',
                                            color: active ? 'var(--color-primary)' : 'var(--color-text-secondary)',
                                            fontWeight: active ? 500 : 400,
                                            transition: 'all var(--transition-base)',
                                            textAlign: 'left',
                                        }}
                                    >
                                        {p.label}
                                    </motion.button>
                                )
                            })}
                        </div>
                        <div style={{ display: 'flex', gap: 10 }}>
                            <Btn variant="ghost" onClick={() => setStep(1)}>← Voltar</Btn>
                            <Btn variant="primary" fullWidth disabled={purposes.length === 0} onClick={() => setStep(3)}>
                                Continuar →
                            </Btn>
                        </div>
                    </motion.div>
                )}

                {/* Etapa 3: Resumo */}
                {step === 3 && (
                    <motion.div key="step3" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }}
                        transition={{ duration: 0.2 }} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

                        {/* Prazo */}
                        <div>
                            <p style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)', margin: '0 0 10px' }}>Prazo de pagamento</p>
                            <div style={{ display: 'flex', gap: 8 }}>
                                {TERMS.map(t => (
                                    <motion.button key={t} whileTap={{ scale: 0.96 }} onClick={() => setTerm(t)}
                                        style={{
                                            flex: 1, padding: '8px 0', borderRadius: 'var(--radius-md)',
                                            border: `1px solid ${term === t ? 'var(--color-primary)' : 'var(--color-border)'}`,
                                            background: term === t ? 'var(--color-primary)' : 'transparent',
                                            color: term === t ? 'white' : 'var(--color-text-secondary)',
                                            fontFamily: 'var(--font-mono)', fontSize: 'var(--text-sm)', fontWeight: 500,
                                            cursor: 'pointer', transition: 'all var(--transition-base)',
                                        }}>
                                        {t}m
                                    </motion.button>
                                ))}
                            </div>
                        </div>

                        {/* Resumo */}
                        <div style={{ background: 'var(--color-bg-secondary)', borderRadius: 'var(--radius-md)', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                            {[
                                { label: 'Crédito solicitado', value: `R$ ${amount.toLocaleString('pt-BR')}` },
                                { label: 'Finalidade', value: purposes.map(id => PURPOSES.find(p => p.id === id)?.label).join(', ') },
                                { label: 'Prazo', value: `${term} meses` },
                                { label: 'Split automático', value: `${(splitRate * 100).toFixed(0)}% da receita mensal` },
                                { label: 'Equivale a', value: `~R$ ${Math.round(monthlyRepayment).toLocaleString('pt-BR')}/mês`, highlight: true },
                            ].map(row => (
                                <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 }}>
                                    <span style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)', flexShrink: 0 }}>{row.label}</span>
                                    <span style={{
                                        fontFamily: 'var(--font-mono)', fontSize: 'var(--text-sm)', textAlign: 'right',
                                        color: row.highlight ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
                                        fontWeight: row.highlight ? 600 : 400,
                                    }}>
                                        {row.value}
                                    </span>
                                </div>
                            ))}
                        </div>

                        <p style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', color: 'var(--color-text-tertiary)', margin: 0, lineHeight: 1.6 }}>
                            O split é capturado automaticamente via Stripe ou Hotmart. Você não precisa fazer transferências manuais.
                        </p>

                        <div style={{ display: 'flex', gap: 10 }}>
                            <Btn variant="ghost" onClick={() => setStep(2)} disabled={loading}>← Voltar</Btn>
                            <Btn variant="primary" fullWidth onClick={() => onConfirm(amount, purposes, term)} disabled={loading}>
                                {loading ? 'Enviando...' : 'Solicitar crédito'}
                            </Btn>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </Modal>
    )
}

// ─────────────────────────────────────────────────────────────────
export default function Card({ onToggleChat }: PageProps) {
    const [showRequestModal, setShowRequestModal] = useState(false)
    const [submittingRequest, setSubmittingRequest] = useState(false)
    const [cards, setCards] = useState<NorthieCard[]>([])
    const [pageState, setPageState] = useState<CardPageState>('not_eligible')
    const [_pageError, setPageError] = useState<string | null>(null)
    const [scoreData, setScoreData] = useState<{
        total: number; revenue: number; ltv_churn: number; cac_ltv: number; platform_age: number;
        max_limit_brl: number; snapshot_month: string;
    }>({
        total: 0, revenue: 0, ltv_churn: 0, cac_ltv: 0, platform_age: 0,
        max_limit_brl: 0, snapshot_month: '',
    })
    const [history, setHistory] = useState<{ m: string; s: number }[]>([])
    const [credit, setCredit] = useState<CreditInfo>({
        approved_limit: 0, used_amount: 0, split_rate: 0.12, term_months: 12,
        purpose: [], cards: [],
    })

    useEffect(() => {
        let mounted = true

        // Score + histórico em paralelo
        api.get('/card/score').then(r => {
            if (!mounted) return
            const d = r.data
            const total = d.score ?? 0
            const dims = d.dimensions ?? {}
            const limitBrl = d.credit_limit_brl ?? 0
            setScoreData({
                total,
                revenue: dims.revenue_consistency ?? 0,
                ltv_churn: dims.customer_quality ?? 0,
                cac_ltv: dims.acquisition_efficiency ?? 0,
                platform_age: dims.platform_tenure ?? 0,
                max_limit_brl: limitBrl,
                snapshot_month: d.snapshot_month ?? '',
            })
            setCredit(prev => ({ ...prev, approved_limit: limitBrl }))

            // Consulta o estado da aplicação para sobrepor pageState
            api.get('/card/application').then(ar => {
                if (!mounted) return
                const app = ar.data
                if (app?.status === 'active') {
                    setPageState('active')
                } else if (app?.status === 'pending_review' || app?.status === 'approved') {
                    setPageState('pending_review')
                } else {
                    setPageState(total >= 70 ? 'eligible' : 'not_eligible')
                }
            }).catch(() => {
                if (!mounted) return
                setPageState(total >= 70 ? 'eligible' : 'not_eligible')
            })
        }).catch(() => {
            if (!mounted) return
            setPageError('Não foi possível carregar o Capital Score. Verifique as integrações.')
        })

        api.get('/card/history').then(r => {
            if (!mounted) return
            const rows: { snapshot_month: string; score: number }[] = r.data ?? []
            const mapped = rows.slice().reverse().map(row => ({
                m: new Date(row.snapshot_month + 'T00:00:00').toLocaleDateString('pt-BR', { month: 'short' }),
                s: row.score,
            }))
            if (mapped.length > 0) setHistory(mapped)
        }).catch(() => {
            if (!mounted) return
            setPageError('Não foi possível carregar o histórico do score.')
        })

        return () => { mounted = false }
    }, [])

    const score = scoreData
    const maxH = history.length > 0 ? Math.max(...history.map(h => h.s)) : 100

    const handleToggleFreeze = async (id: string) => {
        const card = cards.find(c => c.id === id)
        if (!card) return
        setCards(prev => prev.map(c => c.id === id ? { ...c, frozen: !c.frozen } : c))
        try {
            await api.patch(`/card/cards/${id}/freeze`, { frozen: !card.frozen })
        } catch {
            setCards(prev => prev.map(c => c.id === id ? { ...c, frozen: card.frozen } : c))
        }
    }

    const handleConfirmCredit = async (amount: number, purposes: string[], term: number) => {
        setSubmittingRequest(true)
        try {
            await api.post('/card/request', {
                requested_limit_brl: amount,
                purposes,
                term_months: term,
            })
            setPageState('pending_review')
            setShowRequestModal(false)
        } catch (err) {
            console.error('[Card] Erro ao solicitar crédito:', err)
            setPageError('Erro ao enviar solicitação de crédito. Tente novamente.')
        } finally {
            setSubmittingRequest(false)
        }
    }

    // KPIs dinâmicos por estado
    const kpis = pageState === 'active'
        ? [
            { label: 'CAPITAL SCORE', value: score.total, suffix: '/100', decimals: 0 },
            { label: 'LIMITE TOTAL', value: credit.approved_limit, prefix: 'R$', decimals: 0 },
            { label: 'UTILIZADO', value: credit.used_amount, prefix: 'R$', decimals: 0 },
            { label: 'DISPONÍVEL', value: credit.approved_limit - credit.used_amount, prefix: 'R$', decimals: 0 },
        ]
        : [
            { label: 'CAPITAL SCORE', value: score.total, suffix: '/100', decimals: 0 },
            { label: 'LIMITE PROJETADO', value: score.max_limit_brl, prefix: 'R$', decimals: 0 },
            { label: 'SCORE MÍNIMO', value: 70, suffix: '/100', decimals: 0 },
            { label: 'FALTAM', value: Math.max(0, 70 - score.total), suffix: ' pts', decimals: 0 },
        ]

    const recentTransactions = [
        { id: '1', merchant: 'Meta Ads', amount: 1200, date: '28 Mar', card: '4521', status: 'aprovado' },
        { id: '2', merchant: 'Google Ads', amount: 800, date: '25 Mar', card: '4521', status: 'aprovado' },
        { id: '3', merchant: 'Hotmart Tools', amount: 490, date: '20 Mar', card: '7893', status: 'aprovado' },
        { id: '4', merchant: 'Notion', amount: 32, date: '15 Mar', card: '7893', status: 'aprovado' },
        { id: '5', merchant: 'Vercel', amount: 20, date: '10 Mar', card: '4521', status: 'aprovado' },
    ]

    return (
        <div style={{ paddingTop: 28, paddingBottom: 80 }}>
            <TopBar onToggleChat={onToggleChat} />

            <PageHeader
                title="Northie Card"
                subtitle="Crédito corporativo com limite baseado no faturamento real do seu negócio."
            />

            {/* KPIs */}
            <div style={{ display: 'flex', gap: 48, marginTop: 40, flexWrap: 'wrap' }}>
                {kpis.map((k, i) => (
                    <KpiCard key={k.label} label={k.label} value={k.value}
                        prefix={k.prefix} suffix={k.suffix} decimals={k.decimals}
                        delay={0.1 + i * 0.1} />
                ))}
            </div>

            <Divider margin="48px 0" />

            {/* Score + painel direito */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 64 }}>

                {/* Coluna esquerda: gauge + dimensões + histórico */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 40 }}>
                    <div>
                        <SectionLabel>Score atual — {score.snapshot_month}</SectionLabel>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 40, marginTop: 16 }}>
                            <ScoreGauge score={score.total} size={160} />
                            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 14 }}>
                                <DimensionBar label="Consistência de receita" value={score.revenue} delay={0.15} />
                                <DimensionBar label="Qualidade da base (LTV/Churn)" value={score.ltv_churn} delay={0.25} />
                                <DimensionBar label="Eficiência de aquisição (CAC/LTV)" value={score.cac_ltv} delay={0.35} />
                                <DimensionBar label="Histórico na plataforma" value={score.platform_age} delay={0.45} />
                            </div>
                        </div>
                    </div>

                    {/* Histórico de score */}
                    <div>
                        <SectionLabel>Evolução do score</SectionLabel>
                        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 72 }}>
                            {history.map((h, i) => (
                                <motion.div key={h.m}
                                    initial={{ opacity: 0, scaleY: 0 }} animate={{ opacity: 1, scaleY: 1 }}
                                    transition={{ duration: 0.5, delay: 0.1 + i * 0.07, ease: [0.16, 1, 0.3, 1] }}
                                    style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, transformOrigin: 'bottom' }}>
                                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: i === history.length - 1 ? 'var(--color-text-primary)' : 'var(--color-text-tertiary)', fontWeight: i === history.length - 1 ? 600 : 400 }}>{h.s}</span>
                                    <div style={{ width: '100%', height: (h.s / maxH) * 48, background: i === history.length - 1 ? 'var(--color-text-primary)' : 'var(--color-border)', borderRadius: '2px 2px 0 0', minHeight: 3 }} />
                                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--color-text-tertiary)', letterSpacing: '0.05em' }}>{h.m}</span>
                                </motion.div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Coluna direita: muda conforme estado */}
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, delay: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
                    style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

                    {/* ── Estado: NÃO ELEGÍVEL ─────────────────────── */}
                    {pageState === 'not_eligible' && (
                        <>
                            <div style={{ border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', padding: 28, display: 'flex', flexDirection: 'column', gap: 20 }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                    <SectionLabel gutterBottom={0}>Elegibilidade</SectionLabel>
                                    <span className="tag tag-planning">Não elegível</span>
                                </div>
                                <p style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-base)', color: 'var(--color-text-secondary)', lineHeight: 1.6, margin: 0 }}>
                                    Você precisa atingir <strong style={{ color: 'var(--color-text-primary)', fontFamily: 'var(--font-mono)' }}>70 pts</strong> para solicitar crédito. Você está a{' '}
                                    <strong style={{ color: 'var(--color-text-primary)', fontFamily: 'var(--font-mono)' }}>{70 - score.total} pts</strong> de se tornar elegível.
                                </p>
                                {/* Progresso até 70 */}
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--color-text-tertiary)' }}>Score atual: {score.total}</span>
                                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--color-text-tertiary)' }}>Mínimo: 70</span>
                                    </div>
                                    <div style={{ height: 6, background: 'var(--color-border)', borderRadius: 'var(--radius-full)', overflow: 'hidden' }}>
                                        <motion.div initial={{ width: 0 }} animate={{ width: `${(score.total / 70) * 100}%` }}
                                            transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1], delay: 0.4 }}
                                            style={{ height: '100%', background: 'var(--color-text-primary)', borderRadius: 'var(--radius-full)' }} />
                                    </div>
                                </div>
                                <div style={{ background: 'var(--color-bg-secondary)', borderRadius: 'var(--radius-md)', padding: '12px 16px', display: 'flex', justifyContent: 'space-between' }}>
                                    <span style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)' }}>Limite projetado ao atingir 70</span>
                                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-sm)', color: 'var(--color-text-primary)', fontWeight: 500 }}>
                                        R$ {score.max_limit_brl.toLocaleString('pt-BR')}
                                    </span>
                                </div>
                            </div>
                            {/* Dicas */}
                            <div style={{ border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', padding: 28, display: 'flex', flexDirection: 'column', gap: 14 }}>
                                <SectionLabel gutterBottom={0}>Como aumentar seu score</SectionLabel>
                                {[
                                    { action: 'Conecte Stripe ou Shopify', impact: '+8 pts' },
                                    { action: 'Mantenha churn abaixo de 5%', impact: '+6 pts' },
                                    { action: 'Reduza CAC/LTV ratio abaixo de 0.3', impact: '+7 pts' },
                                    { action: 'Ative pelo menos 3 integrações', impact: '+3 pts' },
                                ].map((item, i) => (
                                    <motion.div key={i} initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: 0.3 + i * 0.07, duration: 0.3 }}
                                        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                            <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--color-text-tertiary)', flexShrink: 0 }} />
                                            <span style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)' }}>{item.action}</span>
                                        </div>
                                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--color-text-tertiary)', whiteSpace: 'nowrap' }}>{item.impact}</span>
                                    </motion.div>
                                ))}
                            </div>
                        </>
                    )}

                    {/* ── Estado: EM ANÁLISE ───────────────────────── */}
                    {pageState === 'pending_review' && (
                        <motion.div
                            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.4, ease: [0.25, 0.1, 0.25, 1] }}
                            style={{ border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', padding: 28, display: 'flex', flexDirection: 'column', gap: 20 }}
                        >
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <SectionLabel gutterBottom={0}>Solicitação enviada</SectionLabel>
                                <span className="tag tag-planning">Em análise</span>
                            </div>
                            <p style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-base)', color: 'var(--color-text-secondary)', lineHeight: 1.6, margin: 0 }}>
                                Sua solicitação de crédito foi recebida. Nossa equipe está avaliando com base no seu histórico financeiro e Capital Score. Você será notificado assim que houver uma atualização.
                            </p>
                            <div style={{ background: 'var(--color-bg-secondary)', borderRadius: 'var(--radius-md)', padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 12 }}>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-tertiary)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                                    <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
                                </svg>
                                <span style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)' }}>
                                    Prazo de análise: até 2 dias úteis
                                </span>
                            </div>
                        </motion.div>
                    )}

                    {/* ── Estado: ELEGÍVEL ─────────────────────────── */}
                    {pageState === 'eligible' && (
                        <div style={{ border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', padding: 28, display: 'flex', flexDirection: 'column', gap: 20 }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <SectionLabel gutterBottom={0}>Elegibilidade</SectionLabel>
                                <span className="tag tag-complete">Elegível</span>
                            </div>
                            <p style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-base)', color: 'var(--color-text-secondary)', lineHeight: 1.6, margin: 0 }}>
                                Seu Capital Score atingiu <strong style={{ color: 'var(--color-text-primary)', fontFamily: 'var(--font-mono)' }}>{score.total}/100</strong>. Você pode solicitar crédito agora com limite de até{' '}
                                <strong style={{ color: 'var(--color-text-primary)', fontFamily: 'var(--font-mono)' }}>R$ {score.max_limit_brl.toLocaleString('pt-BR')}</strong>.
                            </p>
                            <div style={{ background: 'var(--color-bg-secondary)', borderRadius: 'var(--radius-md)', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                                {[
                                    { label: 'Limite disponível', value: `R$ ${score.max_limit_brl.toLocaleString('pt-BR')}` },
                                    { label: 'Repagamento', value: 'Split automático na fonte' },
                                    { label: 'Garantia exigida', value: 'Nenhuma' },
                                    { label: 'Diluição de equity', value: 'Nenhuma' },
                                ].map(row => (
                                    <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between' }}>
                                        <span style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)' }}>{row.label}</span>
                                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-sm)', color: 'var(--color-text-primary)', fontWeight: 500 }}>{row.value}</span>
                                    </div>
                                ))}
                            </div>
                            <Btn variant="primary" fullWidth onClick={() => setShowRequestModal(true)}>
                                Solicitar crédito
                            </Btn>
                        </div>
                    )}

                    {/* ── Estado: ATIVO — cartões ──────────────────── */}
                    {pageState === 'active' && (
                        <>
                            <CreditUsageBar used={credit.used_amount} total={credit.approved_limit} />
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                    <SectionLabel gutterBottom={0}>Seus cartões</SectionLabel>
                                    <Btn variant="ghost" size="sm">+ Solicitar físico</Btn>
                                </div>
                                {cards.map(c => (
                                    <CardVisual key={c.id} card={c} onToggleFreeze={handleToggleFreeze} />
                                ))}
                            </div>
                            <div style={{ display: 'flex', gap: 8 }}>
                                <Btn variant="secondary" size="sm" fullWidth>Ver extrato</Btn>
                                <Btn variant="secondary" size="sm" fullWidth onClick={() => setShowRequestModal(true)}>
                                    Ampliar limite
                                </Btn>
                            </div>
                        </>
                    )}
                </motion.div>
            </div>

            {/* Seção de transações recentes (só quando ativo) */}
            {pageState === 'active' && (
                <>
                    <Divider margin="48px 0" />
                    <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 64 }}>
                        {/* Transações */}
                        <div>
                            <SectionLabel>Transações recentes</SectionLabel>
                            <div>
                                {/* Header */}
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 60px 70px', gap: 16, padding: '0 0 10px', borderBottom: '1px solid var(--color-border)' }}>
                                    {['ESTABELECIMENTO', 'CARTÃO', 'DATA', 'VALOR'].map((h, i) => (
                                        <span key={h} style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.1em', color: 'var(--color-text-tertiary)', textTransform: 'uppercase', textAlign: i === 3 ? 'right' : 'left', display: 'block' }}>{h}</span>
                                    ))}
                                </div>
                                {recentTransactions.map((tx, i) => (
                                    <motion.div key={tx.id}
                                        initial={{ opacity: 0, x: -4 }} animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: 0.1 + i * 0.06, duration: 0.25 }}
                                        style={{ display: 'grid', gridTemplateColumns: '1fr 80px 60px 70px', gap: 16, padding: '14px 0', borderBottom: '1px solid var(--color-border)', alignItems: 'center' }}>
                                        <span style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', color: 'var(--color-text-primary)', fontWeight: 500 }}>{tx.merchant}</span>
                                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--color-text-tertiary)' }}>•••• {tx.card}</span>
                                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--color-text-tertiary)' }}>{tx.date}</span>
                                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-sm)', color: 'var(--color-text-primary)', fontWeight: 500, textAlign: 'right' }}>
                                            R$ {tx.amount.toLocaleString('pt-BR')}
                                        </span>
                                    </motion.div>
                                ))}
                            </div>
                        </div>

                        {/* Resumo do crédito ativo */}
                        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.35, delay: 0.15 }}
                            style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                            <div style={{ border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
                                <SectionLabel gutterBottom={0}>Condições do crédito</SectionLabel>
                                {[
                                    { label: 'Limite aprovado', value: `R$ ${credit.approved_limit.toLocaleString('pt-BR')}` },
                                    { label: 'Split automático', value: `${(credit.split_rate * 100).toFixed(0)}% da receita` },
                                    { label: 'Prazo', value: `${credit.term_months} meses` },
                                    { label: 'Finalidade', value: credit.purpose.join(', ') },
                                    { label: 'Próx. captura', value: '01 Abr 2026' },
                                ].map(row => (
                                    <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '8px 0', borderBottom: '1px solid var(--color-border)' }}>
                                        <span style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)' }}>{row.label}</span>
                                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-sm)', color: 'var(--color-text-primary)', fontWeight: 500, textAlign: 'right' }}>{row.value}</span>
                                    </div>
                                ))}
                            </div>
                        </motion.div>
                    </div>
                </>
            )}

            {/* Evolução do Score */}
            <Divider margin="48px 0" />
            <SectionLabel>Evolução do Score</SectionLabel>
            <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, delay: 0.1, ease: [0.25, 0.1, 0.25, 1] }}
                style={{ display: 'flex', gap: 48 }}
            >
                <StatMini label="SCORE ATUAL" value="—" />
                <StatMini label="VARIAÇÃO MENSAL" value="—" />
                <StatMini label="PROJEÇÃO 3 MESES" value="—" />
            </motion.div>

            {/* Histórico de Split */}
            <Divider margin="48px 0" />
            <SectionLabel>Histórico de Split</SectionLabel>
            <EmptyState
                title="Nenhum split registrado"
                description="O split automático será ativado quando o Northie Card estiver operacional."
            />

            {/* Modal de solicitação */}
            <AnimatePresence>
                {showRequestModal && (
                    <CreditRequestModal
                        maxLimit={score.max_limit_brl}
                        onClose={() => setShowRequestModal(false)}
                        onConfirm={handleConfirmCredit}
                        loading={submittingRequest}
                    />
                )}
            </AnimatePresence>
        </div>
    )
}
