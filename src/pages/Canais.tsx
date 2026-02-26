import { motion } from 'framer-motion'
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

function CampaignStatusTag({ status }: { status: string }) {
    const isActive = status === 'Ativo'
    return (
        <span className={isActive ? 'tag tag-complete' : 'tag tag-neutral'}>
            {status}
        </span>
    )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function Canais({ onToggleChat }: { onToggleChat?: () => void }) {
    const [performance, setPerformance] = useState<any[]>([])
    const [trends, setTrends] = useState<any>(null)
    const [campaigns, setCampaigns] = useState<any[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [perfRes, trendsRes, campsRes] = await Promise.all([
                    dashboardApi.getAttribution(),
                    dashboardApi.getChannelTrends(),
                    dashboardApi.getAdCampaigns(),
                ])
                setPerformance(perfRes.data)
                setTrends(trendsRes.data)
                setCampaigns(campsRes.data)
            } catch (error) {
                console.error('Failed to fetch channel data:', error)
            } finally {
                setLoading(false)
            }
        }
        fetchData()
    }, [])

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

            {/* Campanhas Ativas */}
            <div style={{ marginTop: 56 }}>
                <SectionLabel>Campanhas Ativas</SectionLabel>

                {loading ? (
                    <div style={{ color: 'var(--color-text-tertiary)', fontFamily: 'var(--font-sans)', fontSize: 'var(--text-base)' }}>
                        Carregando campanhas...
                    </div>
                ) : campaigns.length === 0 ? (
                    <p style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-base)', color: 'var(--color-text-tertiary)' }}>
                        Nenhuma campanha ativa encontrada.
                    </p>
                ) : (
                    /* Table layout — mais Notion que cards */
                    <>
                        {/* Header */}
                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: '1fr 120px 100px 90px 90px',
                            gap: '0 16px',
                            paddingBottom: 10,
                            borderBottom: '1px solid var(--color-border)',
                            marginBottom: 2,
                        }}>
                            <TH>Campanha</TH>
                            <TH>Plataforma</TH>
                            <TH align="right">Gasto Hoje</TH>
                            <TH align="right">ROAS</TH>
                            <TH align="right">Status</TH>
                        </div>

                        {campaigns.map((camp, i) => (
                            <motion.div
                                key={camp.id}
                                initial={{ opacity: 0, y: 4 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.3, delay: i * 0.05 + 0.3 }}
                                className="notion-row"
                                style={{
                                    display: 'grid',
                                    gridTemplateColumns: '1fr 120px 100px 90px 90px',
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
                                    fontWeight: 400,
                                    color: 'var(--color-text-primary)',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                }}>
                                    {camp.name}
                                </span>
                                <span className="tag tag-neutral" style={{ fontFamily: 'var(--font-sans)', width: 'fit-content' }}>
                                    {camp.platform}
                                </span>
                                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)', textAlign: 'right' }}>
                                    R$ {camp.spendToday.toFixed(2)}
                                </span>
                                <span style={{
                                    fontFamily: 'var(--font-mono)',
                                    fontSize: 'var(--text-sm)',
                                    textAlign: 'right',
                                    color: camp.roasToday > 3 ? 'var(--status-complete)' : camp.roasToday > 0 ? 'var(--status-planning)' : 'var(--color-text-tertiary)',
                                }}>
                                    {camp.roasToday > 0 ? `${camp.roasToday}x` : '—'}
                                </span>
                                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                                    <CampaignStatusTag status={camp.status} />
                                </div>
                            </motion.div>
                        ))}
                    </>
                )}
            </div>
        </div>
    )
}
