import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import TopBar from '../components/layout/TopBar'
import { KpiCard } from '../components/ui/KpiCard'
import { PageHeader, Divider, SectionLabel, TabBar, TH } from '../components/ui/shared'
import api from '../lib/api'

interface PageProps {
    onToggleChat: () => void
}

interface ValuationSnapshot {
    snapshot_month: string
    valuation_brl: number
    multiple: number
    arr_brl: number
    mrr_brl: number
    ltv_cac_ratio: number
    churn_rate: number
    gross_margin: number
    methodology: string
    benchmark_percentile: number
}

// ── Gráfico de histórico de valuation ────────────────────────────
function ValuationChart({ data }: { data: ValuationSnapshot[] }) {
    const values = data.map(d => d.valuation_brl)
    const max = Math.max(...values)
    const min = Math.min(...values)
    const range = max - min || 1

    const WIDTH = 100
    const HEIGHT = 60
    const PAD = 4

    const points = data.map((d, i) => {
        const x = PAD + (i / (data.length - 1)) * (WIDTH - PAD * 2)
        const y = PAD + ((1 - (d.valuation_brl - min) / range) * (HEIGHT - PAD * 2))
        return `${x},${y}`
    })

    const pathD = `M ${points.join(' L ')}`
    const areaD = `M ${points[0]} L ${points.join(' L ')} L ${WIDTH - PAD},${HEIGHT - PAD} L ${PAD},${HEIGHT - PAD} Z`

    return (
        <div style={{ width: '100%', position: 'relative' }}>
            <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} style={{ width: '100%', height: 120, overflow: 'visible' }}>
                <defs>
                    <linearGradient id="vg" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--color-text-primary)" stopOpacity="0.12" />
                        <stop offset="100%" stopColor="var(--color-text-primary)" stopOpacity="0" />
                    </linearGradient>
                </defs>
                {/* Área */}
                <motion.path
                    d={areaD}
                    fill="url(#vg)"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.4, duration: 0.6 }}
                />
                {/* Linha */}
                <motion.path
                    d={pathD}
                    fill="none"
                    stroke="var(--color-text-primary)"
                    strokeWidth={1.5}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    initial={{ pathLength: 0, opacity: 0 }}
                    animate={{ pathLength: 1, opacity: 1 }}
                    transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1], delay: 0.2 }}
                />
                {/* Ponto final (destaque) */}
                <motion.circle
                    cx={parseFloat(points[points.length - 1].split(',')[0])}
                    cy={parseFloat(points[points.length - 1].split(',')[1])}
                    r={2.5}
                    fill="var(--color-text-primary)"
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: 1.3, duration: 0.3 }}
                />
            </svg>
            {/* Labels dos meses */}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
                {data.map((d, i) => (
                    <span key={i} style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: 10,
                        color: i === data.length - 1 ? 'var(--color-text-secondary)' : 'var(--color-text-tertiary)',
                        letterSpacing: '0.04em',
                    }}>
                        {d.snapshot_month}
                    </span>
                ))}
            </div>
        </div>
    )
}

// ── Barra de benchmark percentil ──────────────────────────────────
function BenchmarkBar({ percentile }: { percentile: number }) {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <span style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)' }}>
                    Percentil entre negócios similares
                </span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 20, fontWeight: 600, color: 'var(--color-text-primary)' }}>
                    P{percentile}
                </span>
            </div>
            <div style={{ height: 6, background: 'var(--color-border)', borderRadius: 'var(--radius-full)', overflow: 'hidden', position: 'relative' }}>
                <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${percentile}%` }}
                    transition={{ duration: 1.4, ease: [0.16, 1, 0.3, 1], delay: 0.3 }}
                    style={{
                        height: '100%',
                        background: 'linear-gradient(90deg, var(--color-border) 0%, var(--color-text-primary) 100%)',
                        borderRadius: 'var(--radius-full)',
                    }}
                />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--color-text-tertiary)' }}>0</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--color-text-tertiary)' }}>100</span>
            </div>
        </div>
    )
}

// ── Linha de métrica usada no cálculo ─────────────────────────────
function MetricRow({ label, value, benchmark }: {
    label: string; value: string; benchmark?: string; good?: boolean
}) {
    return (
        <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '12px 0',
            borderBottom: '1px solid var(--color-border)',
        }}>
            <span style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)' }}>
                {label}
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                {benchmark && (
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--color-text-tertiary)' }}>
                        benchmark {benchmark}
                    </span>
                )}
                <span style={{
                    fontFamily: 'var(--font-mono)', fontSize: 'var(--text-sm)',
                    color: 'var(--color-text-primary)',
                    fontWeight: 500,
                }}>
                    {value}
                </span>
            </div>
        </div>
    )
}

const METHODOLOGY_LABELS: Record<string, string> = {
    arr_multiple: 'Múltiplo de ARR',
    mrr_multiple: 'Múltiplo de MRR',
    ltv_multiple: 'Múltiplo de LTV',
    blended: 'Blended',
}

export default function Valuation({ onToggleChat }: PageProps) {
    const [tab, setTab] = useState<'atual' | 'historico'>('atual')
    const [current, setCurrent] = useState<ValuationSnapshot | null>(null)
    const [history, setHistory] = useState<ValuationSnapshot[]>([])

    useEffect(() => {
        api.get('/valuation/current').then(r => {
            const d = r.data
            setCurrent({
                snapshot_month: d.snapshot_month ?? '',
                valuation_brl: d.valuation_brl ?? 0,
                multiple: d.multiple ?? 0,
                arr_brl: d.arr_brl ?? 0,
                mrr_brl: d.mrr_brl ?? 0,
                ltv_cac_ratio: d.ltv_cac_ratio ?? 0,
                churn_rate: d.churn_rate ?? 0,
                gross_margin: 0,
                methodology: d.methodology ?? 'arr_multiple',
                benchmark_percentile: d.benchmark_percentile ?? 50,
            })
        }).catch(console.error)

        api.get('/valuation/history').then(r => {
            const rows = (r.data ?? []) as ValuationSnapshot[]
            setHistory(rows.map(d => ({
                snapshot_month: new Date(d.snapshot_month + 'T00:00:00').toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }),
                valuation_brl: d.valuation_brl,
                multiple: d.multiple,
                arr_brl: d.arr_brl,
                mrr_brl: d.mrr_brl,
                ltv_cac_ratio: d.ltv_cac_ratio,
                churn_rate: d.churn_rate,
                gross_margin: 0,
                methodology: d.methodology ?? 'arr_multiple',
                benchmark_percentile: d.benchmark_percentile,
            })))
        }).catch(console.error)
    }, [])

    if (!current) {
        return (
            <div style={{ paddingTop: 28, paddingBottom: 80 }}>
                <TopBar onToggleChat={onToggleChat} />
                <div style={{ paddingTop: 80, fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--color-text-tertiary)' }}>
                    Calculando valuation...
                </div>
            </div>
        )
    }

    const monthlyDelta = history.length >= 2
        ? ((history[history.length - 1].valuation_brl - history[history.length - 2].valuation_brl) / history[history.length - 2].valuation_brl * 100)
        : 0

    return (
        <div style={{ paddingTop: 28, paddingBottom: 80 }}>
            <TopBar onToggleChat={onToggleChat} />

            <PageHeader
                title="Northie Valuation"
                subtitle="Quanto o seu negócio vale hoje — calculado com base nos seus dados reais, atualizado todo mês."
            />

            {/* KPIs */}
            <div style={{ display: 'flex', gap: 48, marginTop: 40, flexWrap: 'wrap' }}>
                <KpiCard label="VALUATION ATUAL" value={current.valuation_brl / 1_000_000} prefix="R$" suffix="M" decimals={2} delay={0.10} />
                <KpiCard label="MÚLTIPLO DE ARR" value={current.multiple} suffix="x" decimals={1} delay={0.20} />
                <KpiCard label="ARR" value={current.arr_brl / 1_000} prefix="R$" suffix="k" decimals={1} delay={0.30} />
                <KpiCard label="CRESCIMENTO MÊS" value={monthlyDelta} suffix="%" decimals={1} delay={0.40} />
            </div>

            <Divider margin="48px 0" />

            <TabBar
                tabs={['Snapshot atual', 'Histórico']}
                active={tab === 'atual' ? 'Snapshot atual' : 'Histórico'}
                onChange={(t) => setTab(t === 'Snapshot atual' ? 'atual' : 'historico')}
            />

            <div style={{ marginTop: 40 }}>
                {tab === 'atual' && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 64 }}>
                        {/* Coluna esquerda: valuation + metodologia */}
                        <motion.div
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.35, ease: [0.25, 0.1, 0.25, 1] }}
                            style={{ display: 'flex', flexDirection: 'column', gap: 40 }}
                        >
                            {/* Valuation destacado */}
                            <div>
                                <SectionLabel>{METHODOLOGY_LABELS[current.methodology]} — {current.snapshot_month}</SectionLabel>
                                <div style={{ marginTop: 16, display: 'flex', alignItems: 'baseline', gap: 10 }}>
                                    <span style={{
                                        fontFamily: 'var(--font-mono)',
                                        fontSize: 56,
                                        fontWeight: 600,
                                        letterSpacing: '-2px',
                                        color: 'var(--color-text-primary)',
                                        lineHeight: 1,
                                    }}>
                                        R$ {(current.valuation_brl / 1_000_000).toFixed(2)}M
                                    </span>
                                    <motion.span
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        transition={{ delay: 0.8 }}
                                        style={{
                                            fontFamily: 'var(--font-mono)',
                                            fontSize: 14,
                                            color: 'var(--color-text-secondary)',
                                            fontWeight: 500,
                                        }}
                                    >
                                        {monthlyDelta >= 0 ? '+' : ''}{monthlyDelta.toFixed(1)}% vs mês anterior
                                    </motion.span>
                                </div>
                                <p style={{
                                    fontFamily: 'var(--font-sans)',
                                    fontSize: 'var(--text-sm)',
                                    color: 'var(--color-text-tertiary)',
                                    margin: '8px 0 0',
                                }}>
                                    Calculado com múltiplo {current.multiple}x aplicado sobre ARR de{' '}
                                    R$ {current.arr_brl.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}
                                </p>
                            </div>

                            {/* Métricas usadas no cálculo */}
                            <div>
                                <SectionLabel>Inputs do cálculo</SectionLabel>
                                <div style={{ marginTop: 4 }}>
                                    <MetricRow label="ARR" value={`R$ ${(current.arr_brl / 1_000).toFixed(1)}k`} />
                                    <MetricRow label="MRR" value={`R$ ${current.mrr_brl.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}`} />
                                    <MetricRow label="LTV/CAC ratio" value={`${current.ltv_cac_ratio.toFixed(1)}x`} benchmark="> 3x" good={current.ltv_cac_ratio >= 3} />
                                    <MetricRow label="Churn rate" value={`${(current.churn_rate * 100).toFixed(1)}%`} benchmark="< 5%" good={current.churn_rate < 0.05} />
                                    <MetricRow label="Margem bruta" value={`${(current.gross_margin * 100).toFixed(0)}%`} benchmark="> 60%" good={current.gross_margin >= 0.6} />
                                    <MetricRow label="Múltiplo aplicado" value={`${current.multiple}x`} benchmark="ARR SaaS BR" />
                                </div>
                            </div>
                        </motion.div>

                        {/* Coluna direita: benchmark + contexto */}
                        <motion.div
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.35, delay: 0.1, ease: [0.25, 0.1, 0.25, 1] }}
                            style={{ display: 'flex', flexDirection: 'column', gap: 32 }}
                        >
                            {/* Benchmark */}
                            <div style={{
                                border: '1px solid var(--color-border)',
                                borderRadius: 'var(--radius-lg)',
                                padding: 24,
                                display: 'flex',
                                flexDirection: 'column',
                                gap: 20,
                            }}>
                                <SectionLabel gutterBottom={0}>Benchmark interno</SectionLabel>
                                <BenchmarkBar percentile={current.benchmark_percentile} />
                                <p style={{
                                    fontFamily: 'var(--font-sans)',
                                    fontSize: 'var(--text-sm)',
                                    color: 'var(--color-text-secondary)',
                                    margin: 0,
                                    lineHeight: 1.6,
                                }}>
                                    Seu negócio vale mais do que <strong style={{ color: 'var(--color-text-primary)' }}>{current.benchmark_percentile}%</strong> dos negócios similares na plataforma Northie — mesmo segmento, mesmo modelo de receita.
                                </p>
                                <div style={{
                                    display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12,
                                    padding: '16px 0 0',
                                    borderTop: '1px solid var(--color-border)',
                                }}>
                                    {[
                                        { label: 'Mediana do segmento', value: 'R$ 680k' },
                                        { label: 'Negócios na amostra', value: '47' },
                                    ].map((item) => (
                                        <div key={item.label}>
                                            <p style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.08em', color: 'var(--color-text-tertiary)', textTransform: 'uppercase', margin: '0 0 4px' }}>
                                                {item.label}
                                            </p>
                                            <p style={{ fontFamily: 'var(--font-mono)', fontSize: 18, fontWeight: 600, color: 'var(--color-text-primary)', margin: 0 }}>
                                                {item.value}
                                            </p>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Como o múltiplo é definido */}
                            <div style={{
                                border: '1px solid var(--color-border)',
                                borderRadius: 'var(--radius-lg)',
                                padding: 24,
                            }}>
                                <SectionLabel gutterBottom={16}>Como o múltiplo é definido</SectionLabel>
                                <p style={{
                                    fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)',
                                    color: 'var(--color-text-secondary)', margin: 0, lineHeight: 1.6,
                                }}>
                                    O múltiplo é calculado com base no LTV/CAC ratio, churn e crescimento de receita do seu negócio — ajustado pelo benchmark de negócios similares dentro da Northie. Quanto melhores as métricas, maior o múltiplo aplicado.
                                </p>
                            </div>
                        </motion.div>
                    </div>
                )}

                {tab === 'historico' && (
                    <motion.div
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.35, ease: [0.25, 0.1, 0.25, 1] }}
                        style={{ display: 'flex', flexDirection: 'column', gap: 48 }}
                    >
                        {/* Gráfico */}
                        <div>
                            <SectionLabel>Evolução do valuation</SectionLabel>
                            <div style={{ marginTop: 24 }}>
                                <ValuationChart data={history} />
                            </div>
                        </div>

                        {/* Tabela histórica */}
                        <div>
                            <SectionLabel>Snapshots mensais</SectionLabel>
                            <div style={{ marginTop: 16 }}>
                                {/* Header */}
                                <div style={{
                                    display: 'grid',
                                    gridTemplateColumns: '80px 1fr 80px 80px 80px 80px',
                                    gap: 16,
                                    padding: '0 0 10px',
                                    borderBottom: '1px solid var(--color-border)',
                                }}>
                                    <TH>MÊS</TH>
                                    <TH>VALUATION</TH>
                                    <TH align="right">MÚLTIPLO</TH>
                                    <TH align="right">ARR</TH>
                                    <TH align="right">CHURN</TH>
                                    <TH align="right">PERCENTIL</TH>
                                </div>
                                {[...history].reverse().map((snap, i) => (
                                    <motion.div
                                        key={snap.snapshot_month}
                                        initial={{ opacity: 0, x: -4 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: 0.05 + i * 0.06, duration: 0.25 }}
                                        style={{
                                            display: 'grid',
                                            gridTemplateColumns: '80px 1fr 80px 80px 80px 80px',
                                            gap: 16,
                                            padding: '14px 0',
                                            borderBottom: '1px solid var(--color-border)',
                                            alignItems: 'center',
                                        }}
                                    >
                                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-sm)', color: 'var(--color-text-tertiary)' }}>
                                            {snap.snapshot_month}
                                        </span>
                                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-sm)', color: 'var(--color-text-primary)', fontWeight: 600 }}>
                                            R$ {(snap.valuation_brl / 1_000_000).toFixed(2)}M
                                        </span>
                                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)', textAlign: 'right' }}>
                                            {snap.multiple}x
                                        </span>
                                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)', textAlign: 'right' }}>
                                            {(snap.arr_brl / 1_000).toFixed(0)}k
                                        </span>
                                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)', textAlign: 'right' }}>
                                            {(snap.churn_rate * 100).toFixed(1)}%
                                        </span>
                                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)', textAlign: 'right' }}>
                                            P{snap.benchmark_percentile}
                                        </span>
                                    </motion.div>
                                ))}
                            </div>
                        </div>
                    </motion.div>
                )}
            </div>
        </div>
    )
}

