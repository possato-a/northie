import { useState, useEffect } from 'react'
import TopBar from '../components/layout/TopBar'
import { KpiCard } from '../components/ui/KpiCard'
import { PageHeader, Divider, Btn, SectionLabel, Modal, StatMini, EmptyState, KpiGrid } from '../components/ui/shared'
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

// ── Simple Score Display ──────────────────────────────────────────
function ScoreDisplay({ score }: { score: number }) {
    const eligible = score >= 70
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
                <span style={{
                    fontFamily: 'var(--font-mono)', fontSize: 48, fontWeight: 600,
                    letterSpacing: '-2px', color: 'var(--fg)', lineHeight: 1,
                }}>
                    {score}
                </span>
                <span style={{
                    fontFamily: 'var(--font-mono)', fontSize: 14, color: 'var(--color-text-tertiary)',
                    marginLeft: 4,
                }}>
                    / 100
                </span>
            </div>
            <span style={{
                fontFamily: 'var(--font-mono)', fontSize: 13,
                color: eligible ? 'var(--color-primary)' : 'var(--color-text-tertiary)',
            }}>
                {eligible ? 'Elegivel' : 'Nao elegivel'}
            </span>
            <div style={{ height: 4, background: 'var(--color-border)', borderRadius: 2, overflow: 'hidden', maxWidth: 240 }}>
                <div style={{
                    height: '100%', width: `${score}%`,
                    background: 'var(--color-primary)', borderRadius: 2,
                }} />
            </div>
        </div>
    )
}

// ── Static Dimension Bar ──────────────────────────────────────────
function DimensionBar({ label, value, max = 25 }: { label: string; value: number; max?: number }) {
    const pct = (value / max) * 100
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <span style={{ fontFamily: 'var(--font-sans)', fontSize: 13, color: 'var(--color-text-secondary)' }}>{label}</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--fg)', fontWeight: 500 }}>
                    {value}<span style={{ color: 'var(--color-text-tertiary)' }}>/{max}</span>
                </span>
            </div>
            <div style={{ height: 4, background: 'var(--color-border)', borderRadius: 2, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${pct}%`, background: 'var(--fg)', opacity: 0.65, borderRadius: 2 }} />
            </div>
        </div>
    )
}

// ── Minimal Card Display ──────────────────────────────────────────
function CardVisual({ card, onToggleFreeze }: { card: NorthieCard; onToggleFreeze: (id: string) => void }) {
    return (
        <div style={{
            border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)',
            background: 'var(--color-bg-primary)', padding: '20px 24px',
            display: 'flex', flexDirection: 'column', gap: 16,
        }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 15, letterSpacing: '0.18em', color: 'var(--fg)' }}>
                    {'\u2022\u2022\u2022\u2022'} {'\u2022\u2022\u2022\u2022'} {'\u2022\u2022\u2022\u2022'} {card.lastFour}
                </span>
                {card.frozen && (
                    <span style={{
                        fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.08em',
                        color: 'var(--accent-red)', textTransform: 'uppercase',
                        border: '1px solid var(--accent-red)', borderRadius: 'var(--radius-md)',
                        padding: '2px 8px',
                    }}>
                        Congelado
                    </span>
                )}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                <div style={{ display: 'flex', gap: 32 }}>
                    <div>
                        <p style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.1em', color: 'var(--color-text-tertiary)', margin: '0 0 2px', textTransform: 'uppercase' }}>Titular</p>
                        <p style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--color-text-secondary)', margin: 0, textTransform: 'uppercase' }}>{card.holder}</p>
                    </div>
                    <div>
                        <p style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.1em', color: 'var(--color-text-tertiary)', margin: '0 0 2px', textTransform: 'uppercase' }}>Validade</p>
                        <p style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--color-text-secondary)', margin: 0 }}>{card.expiry}</p>
                    </div>
                    <div>
                        <p style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.1em', color: 'var(--color-text-tertiary)', margin: '0 0 2px', textTransform: 'uppercase' }}>Tipo</p>
                        <p style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--color-text-secondary)', margin: 0 }}>{card.type === 'virtual' ? 'Virtual' : 'Fisico'}</p>
                    </div>
                </div>
                <button
                    onClick={() => onToggleFreeze(card.id)}
                    style={{
                        background: 'none', border: '1px solid var(--color-border)',
                        borderRadius: 'var(--radius-md)', padding: '4px 12px',
                        cursor: 'pointer', fontFamily: 'var(--font-mono)', fontSize: 11,
                        color: 'var(--color-text-secondary)', letterSpacing: '0.05em',
                    }}
                >
                    {card.frozen ? 'Descongelar' : 'Congelar'}
                </button>
            </div>
        </div>
    )
}

// ── Credit Usage Bar (static) ─────────────────────────────────────
function CreditUsageBar({ used, total }: { used: number; total: number }) {
    const pct = total > 0 ? (used / total) * 100 : 0
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <span style={{ fontFamily: 'var(--font-sans)', fontSize: 13, color: 'var(--color-text-secondary)' }}>
                    Utilizacao do limite
                </span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--fg)', fontWeight: 600 }}>
                    {pct.toFixed(0)}%
                </span>
            </div>
            <div style={{ height: 4, background: 'var(--color-border)', borderRadius: 2, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${pct}%`, background: 'var(--fg)', borderRadius: 2 }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--color-text-tertiary)' }}>
                    Usado: R$ {used.toLocaleString('pt-BR')}
                </span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--color-text-tertiary)' }}>
                    Disponivel: R$ {(total - used).toLocaleString('pt-BR')}
                </span>
            </div>
        </div>
    )
}

// ── Modal de solicitacao de credito (3 etapas) ────────────────────
const PURPOSES = [
    { id: 'meta', label: 'Meta Ads' },
    { id: 'google', label: 'Google Ads' },
    { id: 'fornecedores', label: 'Fornecedores' },
    { id: 'ferramentas', label: 'Ferramentas' },
    { id: 'salarios', label: 'Salarios' },
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

    const titles = ['Quanto voce precisa?', 'Para que vai usar?', 'Resumo do credito']

    return (
        <Modal onClose={onClose} title={titles[step - 1]} maxWidth={480}>
            {/* Step indicator */}
            <div style={{ display: 'flex', gap: 6, marginBottom: 28 }}>
                {[1, 2, 3].map(s => (
                    <div key={s} style={{
                        flex: 1, height: 2, borderRadius: 1,
                        background: s <= step ? 'var(--fg)' : 'var(--color-border)',
                    }} />
                ))}
            </div>

            {/* Step 1: Amount */}
            {step === 1 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                    <div style={{ textAlign: 'center' }}>
                        <p style={{ fontFamily: 'var(--font-mono)', fontSize: 48, fontWeight: 600, letterSpacing: '-2px', color: 'var(--fg)', margin: 0 }}>
                            R$ {amount.toLocaleString('pt-BR')}
                        </p>
                        <p style={{ fontFamily: 'var(--font-sans)', fontSize: 13, color: 'var(--color-text-tertiary)', margin: '6px 0 0' }}>
                            Limite maximo: R$ {maxLimit.toLocaleString('pt-BR')}
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
                        Continuar
                    </Btn>
                </div>
            )}

            {/* Step 2: Purpose */}
            {step === 2 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                    <p style={{ fontFamily: 'var(--font-sans)', fontSize: 13, color: 'var(--color-text-secondary)', margin: 0 }}>
                        Selecione todos que se aplicam.
                    </p>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                        {PURPOSES.map(p => {
                            const active = purposes.includes(p.id)
                            return (
                                <button
                                    key={p.id} onClick={() => togglePurpose(p.id)}
                                    style={{
                                        padding: '10px 14px',
                                        border: `1px solid ${active ? 'var(--color-primary)' : 'var(--color-border)'}`,
                                        borderRadius: 'var(--radius-md)',
                                        background: active ? 'rgba(62, 207, 142, 0.08)' : 'transparent',
                                        cursor: 'pointer', fontFamily: 'var(--font-sans)', fontSize: 13,
                                        color: active ? 'var(--color-primary)' : 'var(--color-text-secondary)',
                                        fontWeight: active ? 500 : 400,
                                        textAlign: 'left',
                                    }}
                                >
                                    {p.label}
                                </button>
                            )
                        })}
                    </div>
                    <div style={{ display: 'flex', gap: 10 }}>
                        <Btn variant="ghost" onClick={() => setStep(1)}>Voltar</Btn>
                        <Btn variant="primary" fullWidth disabled={purposes.length === 0} onClick={() => setStep(3)}>
                            Continuar
                        </Btn>
                    </div>
                </div>
            )}

            {/* Step 3: Summary */}
            {step === 3 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                    {/* Term selection */}
                    <div>
                        <p style={{ fontFamily: 'var(--font-sans)', fontSize: 13, color: 'var(--color-text-secondary)', margin: '0 0 10px' }}>Prazo de pagamento</p>
                        <div style={{ display: 'flex', gap: 8 }}>
                            {TERMS.map(t => (
                                <button key={t} onClick={() => setTerm(t)}
                                    style={{
                                        flex: 1, padding: '8px 0', borderRadius: 'var(--radius-md)',
                                        border: `1px solid ${term === t ? 'var(--color-primary)' : 'var(--color-border)'}`,
                                        background: term === t ? 'var(--color-primary)' : 'transparent',
                                        color: term === t ? '#000' : 'var(--color-text-secondary)',
                                        fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 500,
                                        cursor: 'pointer',
                                    }}>
                                    {t}m
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Summary table */}
                    <div style={{ borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', overflow: 'hidden' }}>
                        {[
                            { label: 'Credito solicitado', value: `R$ ${amount.toLocaleString('pt-BR')}` },
                            { label: 'Finalidade', value: purposes.map(id => PURPOSES.find(p => p.id === id)?.label).join(', ') },
                            { label: 'Prazo', value: `${term} meses` },
                            { label: 'Split automatico', value: `${(splitRate * 100).toFixed(0)}% da receita mensal` },
                            { label: 'Equivale a', value: `~R$ ${Math.round(monthlyRepayment).toLocaleString('pt-BR')}/mes`, highlight: true },
                        ].map((row, i) => (
                            <div key={row.label} style={{
                                display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
                                padding: '10px 16px', gap: 12,
                                borderBottom: i < 4 ? '1px solid var(--color-border)' : 'none',
                            }}>
                                <span style={{ fontFamily: 'var(--font-sans)', fontSize: 13, color: 'var(--color-text-secondary)' }}>{row.label}</span>
                                <span style={{
                                    fontFamily: 'var(--font-mono)', fontSize: 13, textAlign: 'right',
                                    color: row.highlight ? 'var(--fg)' : 'var(--color-text-secondary)',
                                    fontWeight: row.highlight ? 600 : 400,
                                }}>
                                    {row.value}
                                </span>
                            </div>
                        ))}
                    </div>

                    <p style={{ fontFamily: 'var(--font-sans)', fontSize: 13, color: 'var(--color-text-tertiary)', margin: 0, lineHeight: 1.6 }}>
                        O split e capturado automaticamente via Stripe ou Hotmart. Voce nao precisa fazer transferencias manuais.
                    </p>

                    <div style={{ display: 'flex', gap: 10 }}>
                        <Btn variant="ghost" onClick={() => setStep(2)} disabled={loading}>Voltar</Btn>
                        <Btn variant="primary" fullWidth onClick={() => onConfirm(amount, purposes, term)} disabled={loading}>
                            {loading ? 'Enviando...' : 'Solicitar credito'}
                        </Btn>
                    </div>
                </div>
            )}
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
            setPageError('Nao foi possivel carregar o Capital Score. Verifique as integracoes.')
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
            setPageError('Nao foi possivel carregar o historico do score.')
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
            console.error('[Card] Erro ao solicitar credito:', err)
            setPageError('Erro ao enviar solicitacao de credito. Tente novamente.')
        } finally {
            setSubmittingRequest(false)
        }
    }

    // KPIs by state
    const kpis = pageState === 'active'
        ? [
            { label: 'CAPITAL SCORE', value: score.total, suffix: '/100', decimals: 0 },
            { label: 'LIMITE TOTAL', value: credit.approved_limit, prefix: 'R$', decimals: 0 },
            { label: 'UTILIZADO', value: credit.used_amount, prefix: 'R$', decimals: 0 },
            { label: 'DISPONIVEL', value: credit.approved_limit - credit.used_amount, prefix: 'R$', decimals: 0 },
        ]
        : [
            { label: 'CAPITAL SCORE', value: score.total, suffix: '/100', decimals: 0 },
            { label: 'LIMITE PROJETADO', value: score.max_limit_brl, prefix: 'R$', decimals: 0 },
            { label: 'SCORE MINIMO', value: 70, suffix: '/100', decimals: 0 },
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
        <div style={{ paddingBottom: 40 }}>
            <TopBar onToggleChat={onToggleChat} />

            <PageHeader
                title="Northie Card"
                subtitle="Credito corporativo com limite baseado no faturamento real do seu negocio."
            />

            {/* KPIs */}
            <KpiGrid style={{ marginTop: 40 }}>
                {kpis.map((k) => (
                    <KpiCard key={k.label} label={k.label} value={k.value}
                        prefix={k.prefix} suffix={k.suffix} decimals={k.decimals} />
                ))}
            </KpiGrid>

            <Divider margin="48px 0" />

            {/* Score + right panel */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 64 }}>

                {/* Left column: score + dimensions + history */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 40 }}>
                    <div>
                        <SectionLabel>Score atual{score.snapshot_month ? ` \u2014 ${score.snapshot_month}` : ''}</SectionLabel>
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 40, marginTop: 16 }}>
                            <ScoreDisplay score={score.total} />
                            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 14 }}>
                                <DimensionBar label="Consistencia de receita" value={score.revenue} />
                                <DimensionBar label="Qualidade da base (LTV/Churn)" value={score.ltv_churn} />
                                <DimensionBar label="Eficiencia de aquisicao (CAC/LTV)" value={score.cac_ltv} />
                                <DimensionBar label="Historico na plataforma" value={score.platform_age} />
                            </div>
                        </div>
                    </div>

                    {/* Score history */}
                    {history.length > 0 && (
                        <div>
                            <SectionLabel>Evolucao do score</SectionLabel>
                            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 72 }}>
                                {history.map((h, i) => (
                                    <div key={h.m} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}>
                                        <span style={{
                                            fontFamily: 'var(--font-mono)', fontSize: 10,
                                            color: i === history.length - 1 ? 'var(--fg)' : 'var(--color-text-tertiary)',
                                            fontWeight: i === history.length - 1 ? 600 : 400,
                                        }}>{h.s}</span>
                                        <div style={{
                                            width: '100%', height: (h.s / maxH) * 48, minHeight: 3,
                                            background: i === history.length - 1 ? 'var(--fg)' : 'var(--color-border)',
                                            borderRadius: '2px 2px 0 0',
                                        }} />
                                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--color-text-tertiary)', letterSpacing: '0.05em' }}>{h.m}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Right column: state-dependent */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

                    {/* NOT ELIGIBLE */}
                    {pageState === 'not_eligible' && (
                        <>
                            <div style={{ border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', padding: 28, display: 'flex', flexDirection: 'column', gap: 20 }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                    <SectionLabel gutterBottom={0}>Elegibilidade</SectionLabel>
                                    <span style={{
                                        fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--color-text-tertiary)',
                                        border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)',
                                        padding: '2px 8px',
                                    }}>Nao elegivel</span>
                                </div>
                                <p style={{ fontFamily: 'var(--font-sans)', fontSize: 14, color: 'var(--color-text-secondary)', lineHeight: 1.6, margin: 0 }}>
                                    Voce precisa atingir <strong style={{ color: 'var(--fg)', fontFamily: 'var(--font-mono)' }}>70 pts</strong> para solicitar credito. Voce esta a{' '}
                                    <strong style={{ color: 'var(--fg)', fontFamily: 'var(--font-mono)' }}>{70 - score.total} pts</strong> de se tornar elegivel.
                                </p>
                                {/* Progress to 70 */}
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--color-text-tertiary)' }}>Score atual: {score.total}</span>
                                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--color-text-tertiary)' }}>Minimo: 70</span>
                                    </div>
                                    <div style={{ height: 4, background: 'var(--color-border)', borderRadius: 2, overflow: 'hidden' }}>
                                        <div style={{ height: '100%', width: `${(score.total / 70) * 100}%`, background: 'var(--fg)', borderRadius: 2 }} />
                                    </div>
                                </div>
                                <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: 16, display: 'flex', justifyContent: 'space-between' }}>
                                    <span style={{ fontFamily: 'var(--font-sans)', fontSize: 13, color: 'var(--color-text-secondary)' }}>Limite projetado ao atingir 70</span>
                                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--fg)', fontWeight: 500 }}>
                                        R$ {score.max_limit_brl.toLocaleString('pt-BR')}
                                    </span>
                                </div>
                            </div>
                            {/* Tips */}
                            <div style={{ border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', padding: 28, display: 'flex', flexDirection: 'column', gap: 14 }}>
                                <SectionLabel gutterBottom={0}>Como aumentar seu score</SectionLabel>
                                {[
                                    { action: 'Conecte Stripe ou Shopify', impact: '+8 pts' },
                                    { action: 'Mantenha churn abaixo de 5%', impact: '+6 pts' },
                                    { action: 'Reduza CAC/LTV ratio abaixo de 0.3', impact: '+7 pts' },
                                    { action: 'Ative pelo menos 3 integracoes', impact: '+3 pts' },
                                ].map((item, i) => (
                                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                            <div style={{ width: 4, height: 4, borderRadius: '50%', background: 'var(--color-text-tertiary)', flexShrink: 0 }} />
                                            <span style={{ fontFamily: 'var(--font-sans)', fontSize: 13, color: 'var(--color-text-secondary)' }}>{item.action}</span>
                                        </div>
                                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--color-text-tertiary)', whiteSpace: 'nowrap' }}>{item.impact}</span>
                                    </div>
                                ))}
                            </div>
                        </>
                    )}

                    {/* PENDING REVIEW */}
                    {pageState === 'pending_review' && (
                        <div style={{ border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', padding: 28, display: 'flex', flexDirection: 'column', gap: 20 }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <SectionLabel gutterBottom={0}>Solicitacao enviada</SectionLabel>
                                <span style={{
                                    fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--color-text-tertiary)',
                                    border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)',
                                    padding: '2px 8px',
                                }}>Em analise</span>
                            </div>
                            <p style={{ fontFamily: 'var(--font-sans)', fontSize: 14, color: 'var(--color-text-secondary)', lineHeight: 1.6, margin: 0 }}>
                                Sua solicitacao de credito foi recebida. Nossa equipe esta avaliando com base no seu historico financeiro e Capital Score. Voce sera notificado assim que houver uma atualizacao.
                            </p>
                            <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
                                <span style={{ fontFamily: 'var(--font-sans)', fontSize: 13, color: 'var(--color-text-tertiary)' }}>
                                    Prazo de analise: ate 2 dias uteis
                                </span>
                            </div>
                        </div>
                    )}

                    {/* ELIGIBLE */}
                    {pageState === 'eligible' && (
                        <div style={{ border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', padding: 28, display: 'flex', flexDirection: 'column', gap: 20 }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <SectionLabel gutterBottom={0}>Elegibilidade</SectionLabel>
                                <span style={{
                                    fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--color-primary)',
                                    border: '1px solid var(--color-primary)', borderRadius: 'var(--radius-md)',
                                    padding: '2px 8px',
                                }}>Elegivel</span>
                            </div>
                            <p style={{ fontFamily: 'var(--font-sans)', fontSize: 14, color: 'var(--color-text-secondary)', lineHeight: 1.6, margin: 0 }}>
                                Seu Capital Score atingiu <strong style={{ color: 'var(--fg)', fontFamily: 'var(--font-mono)' }}>{score.total}/100</strong>. Voce pode solicitar credito agora com limite de ate{' '}
                                <strong style={{ color: 'var(--fg)', fontFamily: 'var(--font-mono)' }}>R$ {score.max_limit_brl.toLocaleString('pt-BR')}</strong>.
                            </p>
                            <div style={{ borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', overflow: 'hidden' }}>
                                {[
                                    { label: 'Limite disponivel', value: `R$ ${score.max_limit_brl.toLocaleString('pt-BR')}` },
                                    { label: 'Repagamento', value: 'Split automatico na fonte' },
                                    { label: 'Garantia exigida', value: 'Nenhuma' },
                                    { label: 'Diluicao de equity', value: 'Nenhuma' },
                                ].map((row, i) => (
                                    <div key={row.label} style={{
                                        display: 'flex', justifyContent: 'space-between', padding: '10px 16px',
                                        borderBottom: i < 3 ? '1px solid var(--color-border)' : 'none',
                                    }}>
                                        <span style={{ fontFamily: 'var(--font-sans)', fontSize: 13, color: 'var(--color-text-secondary)' }}>{row.label}</span>
                                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--fg)', fontWeight: 500 }}>{row.value}</span>
                                    </div>
                                ))}
                            </div>
                            <Btn variant="primary" fullWidth onClick={() => setShowRequestModal(true)}>
                                Solicitar credito
                            </Btn>
                        </div>
                    )}

                    {/* ACTIVE */}
                    {pageState === 'active' && (
                        <>
                            <CreditUsageBar used={credit.used_amount} total={credit.approved_limit} />
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                    <SectionLabel gutterBottom={0}>Seus cartoes</SectionLabel>
                                    <Btn variant="ghost" size="sm">+ Solicitar fisico</Btn>
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
                </div>
            </div>

            {/* Transaction history (active state only) */}
            {pageState === 'active' && (
                <>
                    <Divider margin="48px 0" />
                    <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 64 }}>
                        {/* Transactions table */}
                        <div>
                            <SectionLabel>Transacoes recentes</SectionLabel>
                            <div>
                                {/* Header */}
                                <div style={{
                                    display: 'grid', gridTemplateColumns: '1fr 80px 60px 70px', gap: 16,
                                    padding: '0 0 10px', borderBottom: '1px solid var(--color-border)',
                                }}>
                                    {['ESTABELECIMENTO', 'CARTAO', 'DATA', 'VALOR'].map((h, i) => (
                                        <span key={h} style={{
                                            fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.1em',
                                            color: 'var(--color-text-tertiary)', textTransform: 'uppercase',
                                            textAlign: i === 3 ? 'right' : 'left',
                                        }}>{h}</span>
                                    ))}
                                </div>
                                {/* Rows */}
                                {recentTransactions.map(tx => (
                                    <div key={tx.id} style={{
                                        display: 'grid', gridTemplateColumns: '1fr 80px 60px 70px', gap: 16,
                                        padding: '12px 0', borderBottom: '1px solid var(--color-border)', alignItems: 'center',
                                    }}>
                                        <span style={{ fontFamily: 'var(--font-sans)', fontSize: 13, color: 'var(--fg)', fontWeight: 500 }}>{tx.merchant}</span>
                                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--color-text-tertiary)' }}>{'\u2022\u2022\u2022\u2022'} {tx.card}</span>
                                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--color-text-tertiary)' }}>{tx.date}</span>
                                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--fg)', fontWeight: 500, textAlign: 'right' }}>
                                            R$ {tx.amount.toLocaleString('pt-BR')}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Active credit summary */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                            <div style={{ border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
                                <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--color-border)' }}>
                                    <SectionLabel gutterBottom={0}>Condicoes do credito</SectionLabel>
                                </div>
                                {[
                                    { label: 'Limite aprovado', value: `R$ ${credit.approved_limit.toLocaleString('pt-BR')}` },
                                    { label: 'Split automatico', value: `${(credit.split_rate * 100).toFixed(0)}% da receita` },
                                    { label: 'Prazo', value: `${credit.term_months} meses` },
                                    { label: 'Finalidade', value: credit.purpose.join(', ') },
                                    { label: 'Prox. captura', value: '01 Abr 2026' },
                                ].map((row, i, arr) => (
                                    <div key={row.label} style={{
                                        display: 'flex', justifyContent: 'space-between', gap: 12,
                                        padding: '10px 20px',
                                        borderBottom: i < arr.length - 1 ? '1px solid var(--color-border)' : 'none',
                                    }}>
                                        <span style={{ fontFamily: 'var(--font-sans)', fontSize: 13, color: 'var(--color-text-secondary)' }}>{row.label}</span>
                                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--fg)', fontWeight: 500, textAlign: 'right' }}>{row.value}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </>
            )}

            {/* Score Evolution */}
            <Divider margin="48px 0" />
            <div style={{ display: 'flex', gap: 48 }}>
                <StatMini label="SCORE ATUAL" value="\u2014" />
                <StatMini label="VARIACAO MENSAL" value="\u2014" />
                <StatMini label="PROJECAO 3 MESES" value="\u2014" />
            </div>

            {/* Split History */}
            <Divider margin="48px 0" />
            <SectionLabel>Historico de Split</SectionLabel>
            <EmptyState
                title="Nenhum split registrado"
                description="O split automatico sera ativado quando o Northie Card estiver operacional."
            />

            {/* Credit request modal */}
            {showRequestModal && (
                <CreditRequestModal
                    maxLimit={score.max_limit_brl}
                    onClose={() => setShowRequestModal(false)}
                    onConfirm={handleConfirmCredit}
                    loading={submittingRequest}
                />
            )}
        </div>
    )
}
