import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import TopBar from '../components/layout/TopBar'
import { KpiCard } from '../components/ui/KpiCard'
import { PageHeader, Divider, Btn, SectionLabel, Modal } from '../components/ui/shared'

interface PageProps {
    onToggleChat: () => void
}

// ── Capital Score Gauge ───────────────────────────────────────────
function ScoreGauge({ score, size = 200 }: { score: number; size?: number }) {
    const radius = (size - 24) / 2
    const circumference = 2 * Math.PI * radius
    // Arco de 270° (começa em 135° e vai até 405°)
    const arcLength = circumference * 0.75
    const offset = arcLength - (score / 100) * arcLength

    const getColor = (s: number) =>
        s >= 70 ? '#22c55e' : s >= 40 ? '#f59e0b' : '#ef4444'

    return (
        <div style={{ position: 'relative', width: size, height: size }}>
            <svg width={size} height={size} style={{ transform: 'rotate(135deg)' }}>
                {/* Track */}
                <circle
                    cx={size / 2} cy={size / 2} r={radius}
                    fill="none"
                    stroke="var(--color-border)"
                    strokeWidth={12}
                    strokeDasharray={`${arcLength} ${circumference}`}
                    strokeLinecap="round"
                />
                {/* Progress */}
                <motion.circle
                    cx={size / 2} cy={size / 2} r={radius}
                    fill="none"
                    stroke={getColor(score)}
                    strokeWidth={12}
                    strokeDasharray={`${arcLength} ${circumference}`}
                    strokeLinecap="round"
                    initial={{ strokeDashoffset: arcLength }}
                    animate={{ strokeDashoffset: offset }}
                    transition={{ duration: 1.6, ease: [0.16, 1, 0.3, 1], delay: 0.3 }}
                />
            </svg>
            {/* Score no centro */}
            <div style={{
                position: 'absolute', inset: 0,
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center',
                paddingTop: 16,
            }}>
                <motion.span
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.4, duration: 0.5 }}
                    style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: 48,
                        fontWeight: 600,
                        letterSpacing: '-2px',
                        color: getColor(score),
                        lineHeight: 1,
                    }}
                >
                    {score}
                </motion.span>
                <motion.span
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.6, duration: 0.4 }}
                    style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: 11,
                        letterSpacing: '0.12em',
                        color: 'var(--color-text-tertiary)',
                        textTransform: 'uppercase',
                        marginTop: 4,
                    }}
                >
                    / 100
                </motion.span>
            </div>
        </div>
    )
}

// ── Barra de dimensão do score ────────────────────────────────────
function DimensionBar({ label, value, max = 25, delay = 0 }: {
    label: string; value: number; max?: number; delay?: number
}) {
    const pct = (value / max) * 100
    return (
        <motion.div
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.35, delay, ease: [0.25, 0.1, 0.25, 1] }}
            style={{ display: 'flex', flexDirection: 'column', gap: 6 }}
        >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <span style={{
                    fontFamily: 'var(--font-sans)',
                    fontSize: 'var(--text-sm)',
                    color: 'var(--color-text-secondary)',
                }}>
                    {label}
                </span>
                <span style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 'var(--text-sm)',
                    color: 'var(--color-text-primary)',
                    fontWeight: 500,
                }}>
                    {value}<span style={{ color: 'var(--color-text-tertiary)' }}>/{max}</span>
                </span>
            </div>
            <div style={{
                height: 4,
                background: 'var(--color-border)',
                borderRadius: 'var(--radius-full)',
                overflow: 'hidden',
            }}>
                <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${pct}%` }}
                    transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1], delay: delay + 0.2 }}
                    style={{
                        height: '100%',
                        background: pct >= 70 ? '#22c55e' : pct >= 40 ? '#f59e0b' : '#ef4444',
                        borderRadius: 'var(--radius-full)',
                    }}
                />
            </div>
        </motion.div>
    )
}

// ── Status badge da aplicação ─────────────────────────────────────
const STATUS_LABEL: Record<string, string> = {
    waitlist: 'Lista de espera',
    pending_review: 'Em análise',
    approved: 'Aprovado',
    active: 'Ativo',
    rejected: 'Não elegível',
}

const STATUS_CLASS: Record<string, string> = {
    waitlist: 'tag-planning',
    pending_review: 'tag-planning',
    approved: 'tag-complete',
    active: 'tag-complete',
    rejected: 'tag-neutral',
}

export default function Card({ onToggleChat }: PageProps) {
    const [showInfoModal, setShowInfoModal] = useState(false)

    // Mock data — será substituído pela API quando backend Card estiver pronto
    const score = {
        total: 62,
        revenue: 18,
        ltv_churn: 16,
        cac_ltv: 14,
        platform_age: 14,
        credit_limit_brl: 8500,
        snapshot_month: 'Mar 2026',
    }
    const application = {
        status: 'waitlist' as const,
        position: 143,
    }
    const history = [
        { month: 'Out', score: 38 },
        { month: 'Nov', score: 44 },
        { month: 'Dez', score: 51 },
        { month: 'Jan', score: 55 },
        { month: 'Fev', score: 59 },
        { month: 'Mar', score: 62 },
    ]

    const maxHistoryScore = Math.max(...history.map(h => h.score))

    return (
        <div style={{ paddingTop: 28, paddingBottom: 80 }}>
            <TopBar onToggleChat={onToggleChat} />

            <PageHeader
                title="Northie Card"
                subtitle="Cartão corporativo com limite baseado no faturamento real do negócio."
                actions={
                    <Btn variant="ghost" size="sm" onClick={() => setShowInfoModal(true)}>
                        Como funciona
                    </Btn>
                }
            />

            {/* KPIs */}
            <div style={{ display: 'flex', gap: 48, marginTop: 40, flexWrap: 'wrap' }}>
                <KpiCard label="CAPITAL SCORE" value={score.total} suffix="/100" delay={0.10} />
                <KpiCard label="LIMITE DISPONÍVEL" value={score.credit_limit_brl} prefix="R$" decimals={0} delay={0.20} />
                <KpiCard label="LIMITE USADO" value={0} prefix="R$" decimals={0} delay={0.30} />
                <KpiCard label="POSIÇÃO NA FILA" value={application.position} suffix="°" delay={0.40} />
            </div>

            <Divider margin="48px 0" />

            {/* Score + Dimensões + Status */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 64 }}>
                {/* Coluna esquerda: gauge + dimensões */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 40 }}>
                    <div>
                        <SectionLabel>Score atual — {score.snapshot_month}</SectionLabel>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 48, marginTop: 24 }}>
                            <ScoreGauge score={score.total} size={180} />
                            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 16 }}>
                                <DimensionBar label="Consistência de receita" value={score.revenue} delay={0.15} />
                                <DimensionBar label="Qualidade da base (LTV/Churn)" value={score.ltv_churn} delay={0.25} />
                                <DimensionBar label="Eficiência de aquisição (CAC/LTV)" value={score.cac_ltv} delay={0.35} />
                                <DimensionBar label="Histórico na plataforma" value={score.platform_age} delay={0.45} />
                            </div>
                        </div>
                    </div>

                    {/* Histórico */}
                    <div>
                        <SectionLabel>Evolução do score</SectionLabel>
                        <div style={{
                            display: 'flex',
                            alignItems: 'flex-end',
                            gap: 8,
                            marginTop: 20,
                            height: 80,
                        }}>
                            {history.map((h, i) => (
                                <motion.div
                                    key={h.month}
                                    initial={{ opacity: 0, scaleY: 0 }}
                                    animate={{ opacity: 1, scaleY: 1 }}
                                    transition={{ duration: 0.5, delay: 0.1 + i * 0.08, ease: [0.16, 1, 0.3, 1] }}
                                    style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, transformOrigin: 'bottom' }}
                                >
                                    <span style={{
                                        fontFamily: 'var(--font-mono)',
                                        fontSize: 10,
                                        color: i === history.length - 1 ? 'var(--color-text-primary)' : 'var(--color-text-tertiary)',
                                        fontWeight: i === history.length - 1 ? 600 : 400,
                                    }}>
                                        {h.score}
                                    </span>
                                    <div style={{
                                        width: '100%',
                                        height: (h.score / maxHistoryScore) * 56,
                                        background: i === history.length - 1
                                            ? 'var(--color-text-primary)'
                                            : 'var(--color-border)',
                                        borderRadius: '2px 2px 0 0',
                                        minHeight: 4,
                                    }} />
                                    <span style={{
                                        fontFamily: 'var(--font-mono)',
                                        fontSize: 10,
                                        color: 'var(--color-text-tertiary)',
                                        letterSpacing: '0.05em',
                                    }}>
                                        {h.month}
                                    </span>
                                </motion.div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Coluna direita: status da aplicação + CTA */}
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, delay: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
                    style={{ display: 'flex', flexDirection: 'column', gap: 24 }}
                >
                    {/* Status card */}
                    <div style={{
                        border: '1px solid var(--color-border)',
                        borderRadius: 'var(--radius-lg)',
                        padding: 28,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 20,
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <SectionLabel gutterBottom={0}>Sua aplicação</SectionLabel>
                            <span className={`tag ${STATUS_CLASS[application.status]}`}>
                                {STATUS_LABEL[application.status]}
                            </span>
                        </div>

                        <p style={{
                            fontFamily: 'var(--font-sans)',
                            fontSize: 'var(--text-base)',
                            color: 'var(--color-text-secondary)',
                            lineHeight: 1.6,
                            margin: 0,
                        }}>
                            Você está na posição <strong style={{ color: 'var(--color-text-primary)', fontFamily: 'var(--font-mono)' }}>#{application.position}</strong> da lista de espera. Quanto mais você usa a Northie e maior fica seu Capital Score, mais rápido você sobe na fila.
                        </p>

                        <div style={{
                            background: 'var(--color-bg-secondary)',
                            borderRadius: 'var(--radius-md)',
                            padding: '16px 20px',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 10,
                        }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)' }}>Limite projetado</span>
                                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-sm)', color: 'var(--color-text-primary)', fontWeight: 500 }}>
                                    R$ {score.credit_limit_brl.toLocaleString('pt-BR')}
                                </span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)' }}>Score mínimo para aprovação</span>
                                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-sm)', color: 'var(--color-text-primary)', fontWeight: 500 }}>70/100</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)' }}>Faltam pontos</span>
                                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-sm)', color: '#f59e0b', fontWeight: 500 }}>
                                    {Math.max(0, 70 - score.total)} pts
                                </span>
                            </div>
                        </div>

                        <Btn variant="primary" style={{ width: '100%' }} disabled>
                            Cartão em breve para você
                        </Btn>
                    </div>

                    {/* Como melhorar o score */}
                    <div style={{
                        border: '1px solid var(--color-border)',
                        borderRadius: 'var(--radius-lg)',
                        padding: 28,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 16,
                    }}>
                        <SectionLabel gutterBottom={0}>Como aumentar seu score</SectionLabel>
                        {[
                            { action: 'Conecte Stripe ou Shopify', impact: '+8 pts', done: false },
                            { action: 'Mantenha churn abaixo de 5%', impact: '+6 pts', done: false },
                            { action: 'Use a Northie por 3+ meses', impact: '+4 pts', done: true },
                            { action: 'Reduza CAC/LTV ratio abaixo de 0.3', impact: '+7 pts', done: false },
                        ].map((item, i) => (
                            <motion.div
                                key={i}
                                initial={{ opacity: 0, x: 8 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: 0.3 + i * 0.07, duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    gap: 12,
                                    opacity: item.done ? 0.45 : 1,
                                }}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                    <div style={{
                                        width: 6, height: 6, borderRadius: '50%',
                                        background: item.done ? '#22c55e' : 'var(--color-text-tertiary)',
                                        flexShrink: 0,
                                    }} />
                                    <span style={{
                                        fontFamily: 'var(--font-sans)',
                                        fontSize: 'var(--text-sm)',
                                        color: 'var(--color-text-secondary)',
                                        textDecoration: item.done ? 'line-through' : 'none',
                                    }}>
                                        {item.action}
                                    </span>
                                </div>
                                <span style={{
                                    fontFamily: 'var(--font-mono)',
                                    fontSize: 11,
                                    color: item.done ? '#22c55e' : 'var(--color-text-tertiary)',
                                    whiteSpace: 'nowrap',
                                }}>
                                    {item.impact}
                                </span>
                            </motion.div>
                        ))}
                    </div>
                </motion.div>
            </div>

            {/* Modal: como funciona */}
            <AnimatePresence>
                {showInfoModal && (
                    <Modal onClose={() => setShowInfoModal(false)} title="Como funciona o Northie Card">
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                            {[
                                { step: '01', title: 'Score calculado automaticamente', body: 'O Capital Score é atualizado todo mês com base nos dados reais do seu negócio: receita, LTV, churn e eficiência de aquisição.' },
                                { step: '02', title: 'Limite baseado no faturamento real', body: 'Não avaliamos score de crédito tradicional. O limite é calculado diretamente pelos dados que a Northie já tem sobre o seu negócio.' },
                                { step: '03', title: 'Split automático na fonte', body: 'O pagamento é capturado automaticamente como percentual fixo da receita via Stripe, Hotmart ou Kiwify — antes de chegar na sua conta.' },
                                { step: '04', title: 'Capital para crescer sem equity', body: 'Use o cartão para pagar Meta Ads, Google Ads, fornecedores e ferramentas. Sem garantia física, sem diluição.' },
                            ].map((item) => (
                                <div key={item.step} style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
                                    <span style={{
                                        fontFamily: 'var(--font-mono)',
                                        fontSize: 11,
                                        color: 'var(--color-text-tertiary)',
                                        letterSpacing: '0.08em',
                                        flexShrink: 0,
                                        marginTop: 2,
                                    }}>
                                        {item.step}
                                    </span>
                                    <div>
                                        <p style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-base)', fontWeight: 500, color: 'var(--color-text-primary)', margin: '0 0 4px' }}>
                                            {item.title}
                                        </p>
                                        <p style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)', margin: 0, lineHeight: 1.6 }}>
                                            {item.body}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </Modal>
                )}
            </AnimatePresence>
        </div>
    )
}
