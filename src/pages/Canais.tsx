import { motion, AnimatePresence } from 'framer-motion'
import { KpiCard } from '../components/ui/KpiCard'
import TopBar from '../components/layout/TopBar'
import ChannelSparkline from '../components/charts/ChannelSparkline'
import { useState, useEffect, useMemo } from 'react'
import { dashboardApi } from '../lib/api'
import { fmtBR } from '../lib/utils'

// ── Primitives Notion-style ────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
    return (
        <p style={{
            fontFamily: 'var(--font-sans)',
            fontSize: 'var(--text-sm)',
            fontWeight: 500,
            color: 'var(--color-text-secondary)',
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
            marginBottom: 20,
        }}>
            {children}
        </p>
    )
}

function TH({ children, align = 'left' }: { children: React.ReactNode; align?: 'left' | 'right' }) {
    return (
        <span style={{
            fontFamily: 'var(--font-sans)',
            fontSize: 'var(--text-xs)',
            fontWeight: 500,
            color: 'var(--color-text-tertiary)',
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
            textAlign: align,
        }}>
            {children}
        </span>
    )
}

// ── Chart card wrapper Notion-style ───────────────────────────────────────────

function ChartCard({ children }: { children: React.ReactNode }) {
    return (
        <div style={{
            background: 'var(--color-bg-secondary)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-lg)',
            padding: '20px 24px',
        }}>
            {children}
        </div>
    )
}

// ── Campaign status tag ────────────────────────────────────────────────────────

function StatusTag({ status }: { status: string }) {
    const s = (status || '').toUpperCase()
    let cls = 'tag tag-neutral'
    if (s === 'ACTIVE') cls = 'tag tag-complete'
    else if (s === 'PAUSED') cls = 'tag tag-neutral'
    else if (s === 'ARCHIVED' || s === 'DELETED') cls = 'tag tag-critical'
    const label = s === 'ACTIVE' ? 'Ativo' : s === 'PAUSED' ? 'Pausado' : s === 'ARCHIVED' ? 'Arquivado' : status
    return <span className={cls}>{label}</span>
}

// ── Table grid columns ────────────────────────────────────────────────────────
// Name | Status | Spend | Impressions | Reach | Clicks | CTR | CPC | CPM | Freq
const GRID = 'minmax(200px,1fr) 80px 90px 90px 80px 70px 60px 70px 70px 60px'

function MetricCell({ value, format = 'num' }: { value: number; format?: 'brl' | 'num' | 'pct' | 'x' }) {
    if (value == null || isNaN(value) || value === 0) {
        return (
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-sm)', color: 'var(--color-text-tertiary)', textAlign: 'right' }}>
                —
            </span>
        )
    }
    let text = ''
    if (format === 'brl') text = `R$ ${fmtBR(value)}`
    else if (format === 'pct') text = `${value.toFixed(2)}%`
    else if (format === 'x') text = `${value.toFixed(2)}x`
    else text = value >= 1000 ? fmtBR(value) : value.toString()
    return (
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)', textAlign: 'right' }}>
            {text}
        </span>
    )
}

// ── Expandable campaign row ───────────────────────────────────────────────────

function CampaignRow({ camp, days }: { camp: any; days: number }) {
    const [expanded, setExpanded] = useState(false)
    const [detail, setDetail] = useState<{ adsets: any[]; ads: any[] } | null>(null)
    const [loadingDetail, setLoadingDetail] = useState(false)
    const [expandedAdsets, setExpandedAdsets] = useState<Set<string>>(new Set())

    const toggle = async () => {
        if (!expanded && !detail) {
            setLoadingDetail(true)
            try {
                const res = await dashboardApi.getAdCampaignDetail(camp.campaign_id, days)
                setDetail(res.data)
            } catch (err) {
                console.error('Failed to load campaign detail:', err)
                setDetail({ adsets: [], ads: [] })
            } finally {
                setLoadingDetail(false)
            }
        }
        setExpanded(v => !v)
    }

    const toggleAdset = (adsetId: string) => {
        setExpandedAdsets(prev => {
            const next = new Set(prev)
            if (next.has(adsetId)) next.delete(adsetId)
            else next.add(adsetId)
            return next
        })
    }

    return (
        <>
            {/* Campaign row */}
            <motion.div
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25 }}
                className="notion-row"
                style={{
                    display: 'grid',
                    gridTemplateColumns: GRID,
                    gap: '0 12px',
                    alignItems: 'center',
                    cursor: 'pointer',
                }}
                onClick={toggle}
            >
                {/* Name with chevron */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, overflow: 'hidden' }}>
                    <motion.span
                        animate={{ rotate: expanded ? 90 : 0 }}
                        transition={{ duration: 0.18 }}
                        style={{ color: 'var(--color-text-tertiary)', fontSize: 12, flexShrink: 0, lineHeight: 1 }}
                    >
                        ▶
                    </motion.span>
                    <span style={{
                        fontFamily: 'var(--font-sans)',
                        fontSize: 'var(--text-base)',
                        fontWeight: 500,
                        color: 'var(--color-text-primary)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                    }}>
                        {camp.campaign_name}
                    </span>
                </div>

                <div><StatusTag status={camp.status} /></div>
                <MetricCell value={camp.spend_brl} format="brl" />
                <MetricCell value={camp.impressions} format="num" />
                <MetricCell value={camp.reach} format="num" />
                <MetricCell value={camp.clicks} format="num" />
                <MetricCell value={camp.ctr} format="pct" />
                <MetricCell value={camp.cpc_brl} format="brl" />
                <MetricCell value={camp.cpm_brl} format="brl" />
                <MetricCell value={camp.frequency} format="x" />
            </motion.div>

            {/* Adsets */}
            <AnimatePresence>
                {expanded && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.2 }}
                        style={{ overflow: 'hidden' }}
                    >
                        {loadingDetail ? (
                            <div style={{
                                paddingLeft: 36,
                                paddingTop: 8,
                                paddingBottom: 8,
                                fontFamily: 'var(--font-sans)',
                                fontSize: 'var(--text-sm)',
                                color: 'var(--color-text-tertiary)',
                            }}>
                                Carregando conjuntos...
                            </div>
                        ) : (detail?.adsets || []).map(adset => {
                            const adsetExpanded = expandedAdsets.has(adset.adset_id)
                            const adsForAdset = (detail?.ads || []).filter(a => a.adset_id === adset.adset_id)
                            return (
                                <div key={adset.adset_id}>
                                    {/* Adset row */}
                                    <div
                                        className="notion-row"
                                        style={{
                                            display: 'grid',
                                            gridTemplateColumns: GRID,
                                            gap: '0 12px',
                                            alignItems: 'center',
                                            cursor: adsForAdset.length > 0 ? 'pointer' : 'default',
                                            background: 'var(--color-bg-secondary)',
                                        }}
                                        onClick={() => adsForAdset.length > 0 && toggleAdset(adset.adset_id)}
                                    >
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, paddingLeft: 28, overflow: 'hidden' }}>
                                            {adsForAdset.length > 0 ? (
                                                <motion.span
                                                    animate={{ rotate: adsetExpanded ? 90 : 0 }}
                                                    transition={{ duration: 0.15 }}
                                                    style={{ color: 'var(--color-text-tertiary)', fontSize: 10, flexShrink: 0 }}
                                                >
                                                    ▶
                                                </motion.span>
                                            ) : (
                                                <span style={{ width: 10, flexShrink: 0 }} />
                                            )}
                                            <span style={{
                                                fontFamily: 'var(--font-sans)',
                                                fontSize: 'var(--text-sm)',
                                                color: 'var(--color-text-secondary)',
                                                overflow: 'hidden',
                                                textOverflow: 'ellipsis',
                                                whiteSpace: 'nowrap',
                                            }}>
                                                {adset.adset_name}
                                            </span>
                                        </div>
                                        <div><StatusTag status={adset.status} /></div>
                                        <MetricCell value={adset.spend_brl} format="brl" />
                                        <MetricCell value={adset.impressions} format="num" />
                                        <MetricCell value={adset.reach} format="num" />
                                        <MetricCell value={adset.clicks} format="num" />
                                        <MetricCell value={adset.ctr} format="pct" />
                                        <MetricCell value={adset.cpc_brl} format="brl" />
                                        <MetricCell value={adset.cpm_brl} format="brl" />
                                        <MetricCell value={adset.frequency} format="x" />
                                    </div>

                                    {/* Ads */}
                                    <AnimatePresence>
                                        {adsetExpanded && adsForAdset.map(ad => (
                                            <motion.div
                                                key={ad.ad_id}
                                                initial={{ opacity: 0, height: 0 }}
                                                animate={{ opacity: 1, height: 'auto' }}
                                                exit={{ opacity: 0, height: 0 }}
                                                transition={{ duration: 0.15 }}
                                                style={{ overflow: 'hidden' }}
                                            >
                                                <div
                                                    className="notion-row"
                                                    style={{
                                                        display: 'grid',
                                                        gridTemplateColumns: GRID,
                                                        gap: '0 12px',
                                                        alignItems: 'center',
                                                        cursor: 'default',
                                                    }}
                                                >
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, paddingLeft: 56, overflow: 'hidden' }}>
                                                        <span style={{ color: 'var(--color-text-tertiary)', fontSize: 10, flexShrink: 0 }}>◦</span>
                                                        <span style={{
                                                            fontFamily: 'var(--font-sans)',
                                                            fontSize: 'var(--text-xs)',
                                                            color: 'var(--color-text-tertiary)',
                                                            overflow: 'hidden',
                                                            textOverflow: 'ellipsis',
                                                            whiteSpace: 'nowrap',
                                                        }}>
                                                            {ad.ad_name}
                                                        </span>
                                                    </div>
                                                    <div><StatusTag status={ad.status} /></div>
                                                    <MetricCell value={ad.spend_brl} format="brl" />
                                                    <MetricCell value={ad.impressions} format="num" />
                                                    <MetricCell value={ad.reach} format="num" />
                                                    <MetricCell value={ad.clicks} format="num" />
                                                    <MetricCell value={ad.ctr} format="pct" />
                                                    <MetricCell value={ad.cpc_brl} format="brl" />
                                                    <MetricCell value={ad.cpm_brl} format="brl" />
                                                    <MetricCell value={ad.frequency} format="x" />
                                                </div>
                                            </motion.div>
                                        ))}
                                    </AnimatePresence>
                                </div>
                            )
                        })}
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

const PERIOD_OPTIONS = [
    { label: '7d', value: 7 },
    { label: '30d', value: 30 },
    { label: '90d', value: 90 },
    { label: 'Tudo', value: 0 },
]

export default function Canais({ onToggleChat }: { onToggleChat?: () => void }) {
    const [performance, setPerformance] = useState<any[]>([])
    const [trends, setTrends] = useState<any>(null)
    const [campaigns, setCampaigns] = useState<any[]>([])
    const [, setLoading] = useState(true)
    const [periodDays, setPeriodDays] = useState(30)
    const [campaignsLoading, setCampaignsLoading] = useState(false)

    // Fetch static data once
    useEffect(() => {
        const fetchData = async () => {
            try {
                const [perfRes, trendsRes] = await Promise.all([
                    dashboardApi.getAttribution(),
                    dashboardApi.getChannelTrends(),
                ])
                setPerformance(perfRes.data)
                setTrends(trendsRes.data)
            } catch (error) {
                console.error('Failed to fetch channel data:', error)
            } finally {
                setLoading(false)
            }
        }
        fetchData()
    }, [])

    // Fetch campaigns when period changes
    useEffect(() => {
        const fetchCampaigns = async () => {
            setCampaignsLoading(true)
            try {
                const res = await dashboardApi.getAdCampaigns(periodDays)
                setCampaigns(res.data)
            } catch (error) {
                console.error('Failed to fetch campaigns:', error)
            } finally {
                setCampaignsLoading(false)
            }
        }
        fetchCampaigns()
    }, [periodDays])

    const totals = useMemo(() =>
        performance.reduce((acc: any, curr: any) => ({
            spend: acc.spend + curr.spend,
            revenue: acc.revenue + curr.revenue,
            customers: acc.customers + curr.customers,
        }), { spend: 0, revenue: 0, customers: 0 }),
        [performance]
    )

    const avgRoas = totals.spend > 0 ? totals.revenue / totals.spend : 0
    const avgCac = totals.customers > 0 ? totals.spend / totals.customers : 0

    return (
        <div style={{ paddingTop: 28, paddingBottom: 80 }}>
            <TopBar onToggleChat={onToggleChat} />

            <motion.h1
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, ease: [0.25, 0.1, 0.25, 1] }}
                style={{
                    fontFamily: 'var(--font-display)',
                    fontWeight: 400,
                    fontSize: 40,
                    letterSpacing: '-1.6px',
                    color: 'var(--fg)',
                    lineHeight: 1,
                    margin: 0,
                }}
            >
                Canais
            </motion.h1>

            {/* KPIs */}
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.3, delay: 0.1 }}
                style={{ display: 'flex', gap: 48, alignItems: 'center', flexWrap: 'wrap', marginTop: 40 }}
            >
                <KpiCard label="GASTO TOTAL ADS" value={totals.spend} prefix="R$ " decimals={0} delay={0.15} />
                <KpiCard label="RECEITA ATRIBUÍDA" value={totals.revenue} prefix="R$ " decimals={0} delay={0.25} />
                <KpiCard label="ROAS MÉDIO" value={avgRoas} suffix="x" decimals={2} delay={0.35} />
                <KpiCard label="CAC MÉDIO" value={avgCac} prefix="R$ " decimals={1} delay={0.45} />
                <KpiCard label="CANAIS ATIVOS" value={performance.length} decimals={0} delay={0.55} />
            </motion.div>

            {/* Divider */}
            <div style={{ height: 1, background: 'var(--color-border)', margin: '52px 0 48px' }} />

            {/* Performance Table */}
            <div>
                <SectionLabel>Performance por Canal</SectionLabel>

                {/* Header */}
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'minmax(160px,1fr) 100px 120px 80px 90px 90px 110px',
                    gap: '0 16px',
                    paddingBottom: 10,
                    borderBottom: '1px solid var(--color-border)',
                    marginBottom: 2,
                }}>
                    <TH>Canal</TH>
                    <TH align="right">Gasto</TH>
                    <TH align="right">Receita Atr.</TH>
                    <TH align="right">ROAS</TH>
                    <TH align="right">CAC</TH>
                    <TH align="right">Clientes</TH>
                    <TH align="right">LTV Médio</TH>
                </div>

                {performance.map((ch: any, i: number) => (
                    <motion.div
                        key={ch.channel}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3, delay: i * 0.04 + 0.2 }}
                        className="notion-row"
                        style={{
                            display: 'grid',
                            gridTemplateColumns: 'minmax(160px,1fr) 100px 120px 80px 90px 90px 110px',
                            gap: '0 16px',
                            alignItems: 'center',
                            cursor: 'default',
                        }}
                        onHoverStart={e => (e.target as HTMLElement).style.background = 'var(--color-bg-secondary)'}
                        onHoverEnd={e => (e.target as HTMLElement).style.background = 'transparent'}
                    >
                        <span style={{
                            fontFamily: 'var(--font-sans)',
                            fontSize: 'var(--text-base)',
                            fontWeight: 500,
                            color: 'var(--color-text-primary)',
                            textTransform: 'capitalize',
                        }}>
                            {ch.channel.replace(/_/g, ' ')}
                        </span>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-sm)', color: 'var(--color-text-tertiary)', textAlign: 'right' }}>
                            {ch.spend > 0 ? `R$ ${fmtBR(ch.spend)}` : '—'}
                        </span>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)', textAlign: 'right', fontWeight: 500 }}>
                            R$ {fmtBR(ch.revenue)}
                        </span>

                        {/* ROAS com tag colorida */}
                        {ch.roas > 0 ? (
                            <div style={{ textAlign: 'right' }}>
                                <span className={ch.roas >= 3 ? 'tag tag-complete' : 'tag tag-planning'} style={{ fontFamily: 'var(--font-mono)' }}>
                                    {ch.roas.toFixed(1)}x
                                </span>
                            </div>
                        ) : (
                            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-sm)', color: 'var(--color-text-tertiary)', textAlign: 'right' }}>—</span>
                        )}

                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)', textAlign: 'right' }}>
                            {ch.cac > 0 ? `R$ ${fmtBR(ch.cac)}` : '—'}
                        </span>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-sm)', color: 'var(--color-text-primary)', textAlign: 'right' }}>
                            {ch.customers}
                        </span>
                        <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
                            <span style={{
                                fontFamily: 'var(--font-mono)',
                                fontSize: 'var(--text-sm)',
                                color: ch.ltv >= 1000 ? 'var(--status-complete)' : 'var(--color-text-secondary)',
                                fontWeight: ch.ltv >= 1000 ? 500 : 400,
                            }}>
                                R$ {fmtBR(ch.ltv)}
                            </span>
                            {ch.ltv > 1000 && (
                                <span className="tag tag-complete" style={{ fontSize: 9, padding: '1px 5px' }}>HIGH VALUE</span>
                            )}
                        </div>
                    </motion.div>
                ))}
            </div>

            {/* Charts */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 32, marginTop: 56 }}>
                {/* ROAS */}
                <div>
                    <SectionLabel>ROAS por Canal ao longo do tempo</SectionLabel>
                    <ChartCard>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                            {trends ? [
                                { name: 'Google', data: trends.google.roas, val: `${trends.google.roas[14]}x`, good: trends.google.roas[14] >= 3 },
                                { name: 'Meta Ads', data: trends.meta.roas, val: `${trends.meta.roas[14]}x`, good: trends.meta.roas[14] >= 3 },
                            ].map((item: any) => (
                                <div key={item.name} style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                                    <span style={{
                                        fontFamily: 'var(--font-sans)',
                                        fontSize: 'var(--text-xs)',
                                        fontWeight: 500,
                                        color: 'var(--color-text-secondary)',
                                        width: 64,
                                        flexShrink: 0,
                                        letterSpacing: '-0.1px',
                                    }}>
                                        {item.name}
                                    </span>
                                    <div style={{ flex: 1 }}>
                                        <ChannelSparkline data={item.data} id={`roas-${item.name}`} />
                                    </div>
                                    <span style={{
                                        fontFamily: 'var(--font-mono)',
                                        fontSize: 'var(--text-sm)',
                                        fontWeight: 500,
                                        width: 40,
                                        textAlign: 'right',
                                        color: item.good ? 'var(--status-complete)' : 'var(--color-text-secondary)',
                                        flexShrink: 0,
                                    }}>
                                        {item.val}
                                    </span>
                                </div>
                            )) : (
                                <p style={{ fontFamily: 'var(--font-sans)', color: 'var(--color-text-tertiary)', fontSize: 'var(--text-sm)' }}>
                                    Sem dados no período
                                </p>
                            )}
                        </div>
                    </ChartCard>
                </div>

                {/* CAC */}
                <div>
                    <SectionLabel>CAC por Canal ao longo do tempo</SectionLabel>
                    <ChartCard>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                            {trends ? [
                                { name: 'Google', data: trends.google.cac, val: `R$ ${fmtBR(trends.google.cac[14])}` },
                                { name: 'Meta Ads', data: trends.meta.cac, val: `R$ ${fmtBR(trends.meta.cac[14])}` },
                            ].map((item: any) => (
                                <div key={item.name} style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                                    <span style={{
                                        fontFamily: 'var(--font-sans)',
                                        fontSize: 'var(--text-xs)',
                                        fontWeight: 500,
                                        color: 'var(--color-text-secondary)',
                                        width: 64,
                                        flexShrink: 0,
                                        letterSpacing: '-0.1px',
                                    }}>
                                        {item.name}
                                    </span>
                                    <div style={{ flex: 1 }}>
                                        <ChannelSparkline data={item.data} id={`cac-${item.name}`} />
                                    </div>
                                    <span style={{
                                        fontFamily: 'var(--font-mono)',
                                        fontSize: 'var(--text-sm)',
                                        fontWeight: 500,
                                        width: 60,
                                        textAlign: 'right',
                                        color: 'var(--color-text-secondary)',
                                        flexShrink: 0,
                                    }}>
                                        {item.val}
                                    </span>
                                </div>
                            )) : (
                                <p style={{ fontFamily: 'var(--font-sans)', color: 'var(--color-text-tertiary)', fontSize: 'var(--text-sm)' }}>
                                    Sem dados no período
                                </p>
                            )}
                        </div>
                    </ChartCard>
                </div>
            </div>

            {/* Campanhas */}
            <div style={{ marginTop: 56 }}>
                {/* Header row: label + period filters */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                    <p style={{
                        fontFamily: 'var(--font-sans)',
                        fontSize: 'var(--text-sm)',
                        fontWeight: 500,
                        color: 'var(--color-text-secondary)',
                        letterSpacing: '0.04em',
                        textTransform: 'uppercase',
                        margin: 0,
                    }}>
                        Campanhas
                    </p>

                    {/* Period filter pills */}
                    <div style={{ display: 'flex', gap: 4 }}>
                        {PERIOD_OPTIONS.map(opt => (
                            <button
                                key={opt.value}
                                onClick={() => setPeriodDays(opt.value)}
                                style={{
                                    fontFamily: 'var(--font-sans)',
                                    fontSize: 'var(--text-xs)',
                                    fontWeight: 500,
                                    padding: '4px 10px',
                                    borderRadius: 6,
                                    border: '1px solid',
                                    cursor: 'pointer',
                                    transition: 'all 0.15s',
                                    background: periodDays === opt.value ? 'var(--color-text-primary)' : 'transparent',
                                    color: periodDays === opt.value ? 'var(--color-bg-primary)' : 'var(--color-text-tertiary)',
                                    borderColor: periodDays === opt.value ? 'var(--color-text-primary)' : 'var(--color-border)',
                                }}
                            >
                                {opt.label}
                            </button>
                        ))}
                    </div>
                </div>

                {campaignsLoading ? (
                    <div style={{ color: 'var(--color-text-tertiary)', fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', paddingTop: 12 }}>
                        Carregando campanhas...
                    </div>
                ) : campaigns.length === 0 ? (
                    <p style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-base)', color: 'var(--color-text-tertiary)' }}>
                        Nenhuma campanha encontrada no período.
                    </p>
                ) : (
                    <>
                        {/* Table header */}
                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: GRID,
                            gap: '0 12px',
                            paddingBottom: 10,
                            borderBottom: '1px solid var(--color-border)',
                            marginBottom: 2,
                        }}>
                            <TH>Campanha</TH>
                            <TH>Status</TH>
                            <TH align="right">Gasto</TH>
                            <TH align="right">Impressões</TH>
                            <TH align="right">Alcance</TH>
                            <TH align="right">Cliques</TH>
                            <TH align="right">CTR</TH>
                            <TH align="right">CPC</TH>
                            <TH align="right">CPM</TH>
                            <TH align="right">Freq.</TH>
                        </div>

                        {campaigns.map(camp => (
                            <CampaignRow key={camp.campaign_id} camp={camp} days={periodDays} />
                        ))}
                    </>
                )}
            </div>
        </div>
    )
}
