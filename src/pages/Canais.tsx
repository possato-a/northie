import { motion, AnimatePresence } from 'framer-motion'
import { KpiCard } from '../components/ui/KpiCard'
import TopBar from '../components/layout/TopBar'
import { useState, useEffect, useMemo, useRef } from 'react'
import { dashboardApi } from '../lib/api'
import { fmtBR } from '../lib/utils'
import { PageHeader, SectionLabel, TH, Divider, TabBar, SectionCard, KpiGrid, SkeletonKpi, SkeletonTable } from '../components/ui/shared'

// ── Primitives ─────────────────────────────────────────────────────────────────

function StatusTag({ status }: { status: string }) {
    const s = (status || '').toUpperCase()
    let cls = 'tag tag-neutral'
    if (s === 'ACTIVE') cls = 'tag tag-complete'
    else if (s === 'PAUSED' || s === 'CAMPAIGN_PAUSED') cls = 'tag tag-neutral'
    else if (s === 'ARCHIVED' || s === 'DELETED') cls = 'tag tag-critical'
    const label = s === 'ACTIVE' ? 'Ativo' : (s === 'PAUSED' || s === 'CAMPAIGN_PAUSED') ? 'Pausado' : s === 'ARCHIVED' ? 'Arquivado' : status
    return <span className={cls}>{label}</span>
}

function MetricCell({ value, format = 'num' }: { value: number; format?: 'brl' | 'num' | 'pct' | 'x' }) {
    if (value == null || isNaN(value) || value === 0) {
        return <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-sm)', color: 'var(--color-text-tertiary)', textAlign: 'right' }}>—</span>
    }
    let text = ''
    if (format === 'brl') text = `R$ ${fmtBR(value)}`
    else if (format === 'pct') text = `${value.toFixed(2)}%`
    else if (format === 'x') text = `${value.toFixed(2)}x`
    else text = value >= 1000 ? fmtBR(value) : value.toString()
    return <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)', textAlign: 'right' }}>{text}</span>
}

const OBJECTIVE_LABELS: Record<string, string> = {
    // Meta Ads
    OUTCOME_LEADS: 'Leads',
    OUTCOME_SALES: 'Vendas',
    OUTCOME_TRAFFIC: 'Tráfego',
    OUTCOME_AWARENESS: 'Reconhecimento',
    OUTCOME_ENGAGEMENT: 'Engajamento',
    OUTCOME_APP_PROMOTION: 'App',
    LEAD_GENERATION: 'Leads',
    CONVERSIONS: 'Conversões',
    // Google Ads
    SEARCH: 'Search',
    DISPLAY: 'Display',
    VIDEO: 'YouTube',
    SHOPPING: 'Shopping',
    PERFORMANCE_MAX: 'Performance Max',
    SMART: 'Smart',
    DISCOVERY: 'Discovery',
    HOTEL: 'Hotel',
    LOCAL: 'Local',
    APP: 'App',
}

const CHANNEL_COLORS: Record<string, string> = {
    'meta ads': '#1877F2',
    'google ads': '#4285F4',
    'instagram': '#E1306C',
    'email': 'var(--accent-green)',
    'orgânico': 'var(--accent-orange)',
    'direto / outros': 'var(--color-text-tertiary)',
}

function getChannelColor(channel: string) {
    return CHANNEL_COLORS[channel.toLowerCase()] || 'var(--color-primary)'
}

// ── Period filter ──────────────────────────────────────────────────────────────

const PERIOD_OPTIONS = [
    { label: '7d', value: 7 },
    { label: '30d', value: 30 },
    { label: '90d', value: 90 },
    { label: '365d', value: 365 },
    { label: 'Tudo', value: 0 },
]

function PeriodFilter({ value, onChange }: { value: number; onChange: (v: number) => void }) {
    return (
        <div style={{ display: 'flex', gap: 4 }}>
            {PERIOD_OPTIONS.map(opt => (
                <button
                    key={opt.value}
                    onClick={() => onChange(opt.value)}
                    style={{
                        fontFamily: 'var(--font-sans)', fontSize: 'var(--text-xs)', fontWeight: 500,
                        padding: '4px 10px', borderRadius: 6, border: '1px solid', cursor: 'pointer', transition: 'all 0.15s',
                        background: value === opt.value ? 'var(--color-text-primary)' : 'transparent',
                        color: value === opt.value ? 'var(--color-bg-primary)' : 'var(--color-text-tertiary)',
                        borderColor: value === opt.value ? 'var(--color-text-primary)' : 'var(--color-border)',
                    }}
                >
                    {opt.label}
                </button>
            ))}
        </div>
    )
}

// ── Visualization 1: Spend Distribution bars ──────────────────────────────────

function SpendDistribution({ channelPerf, totalSpend }: { channelPerf: any[]; totalSpend: number }) {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {channelPerf.map((ch, i) => {
                const pct = totalSpend > 0 ? (ch.spend / totalSpend) * 100 : 0
                const color = getChannelColor(ch.channel)
                return (
                    <motion.div
                        key={ch.channel}
                        initial={{ opacity: 0, x: -4 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.07, ease: [0.25, 0.1, 0.25, 1] }}
                    >
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <div style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} />
                                <span style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', color: 'var(--color-text-primary)', fontWeight: 500 }}>{ch.channel}</span>
                            </div>
                            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)' }}>{pct.toFixed(1)}%</span>
                                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)', fontWeight: 500 }}>R$ {fmtBR(ch.spend)}</span>
                            </div>
                        </div>
                        <div style={{ height: 4, background: 'var(--color-bg-tertiary)', borderRadius: 'var(--radius-full)', overflow: 'hidden' }}>
                            <motion.div
                                style={{ height: '100%', background: color, borderRadius: 'var(--radius-full)', opacity: 0.8 }}
                                initial={{ width: '0%' }}
                                animate={{ width: `${pct}%` }}
                                transition={{ duration: 0.8, delay: i * 0.08 + 0.2, ease: [0.4, 0, 0.2, 1] }}
                            />
                        </div>
                    </motion.div>
                )
            })}
            {channelPerf.length === 0 && (
                <p style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', color: 'var(--color-text-tertiary)', textAlign: 'center', padding: '16px 0' }}>Sem dados no período</p>
            )}
        </div>
    )
}

// ── Visualization 2: Daily Trend Chart ────────────────────────────────────────

function DailyTrendChart({ trends }: { trends: Record<string, { roas: number[]; cac: number[] }> }) {
    const [mode, setMode] = useState<'roas' | 'cac'>('roas')
    const [activePlatform, setActivePlatform] = useState<string | null>(null)

    const platforms = Object.keys(trends)
    const displayPlatforms = platforms.filter(p => {
        const arr = trends[p]?.[mode] || []
        return arr.some(v => v > 0)
    })

    const allValues = displayPlatforms.flatMap(p => trends[p]?.[mode] || []).filter(v => v > 0)
    const maxVal = Math.max(...allValues, 0.001)
    const points = 15

    // Build date labels for last 15 days
    const dateLabels = Array.from({ length: points }, (_, i) => {
        const d = new Date()
        d.setDate(d.getDate() - (points - 1 - i))
        return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`
    })

    const platformColors: Record<string, string> = {
        meta: '#1877F2',
        google: '#4285F4',
    }

    const toPath = (values: number[]) => {
        if (!values || values.length === 0) return ''
        const w = 100 / (values.length - 1)
        return values.map((v, i) => `${i === 0 ? 'M' : 'L'} ${i * w},${80 - (v / maxVal) * 72}`).join(' ')
    }

    const toArea = (values: number[]) => {
        if (!values || values.length === 0) return ''
        const w = 100 / (values.length - 1)
        const line = values.map((v, i) => `${i === 0 ? 'M' : 'L'} ${i * w},${80 - (v / maxVal) * 72}`).join(' ')
        return `${line} L ${(values.length - 1) * w},80 L 0,80 Z`
    }

    const hasData = displayPlatforms.length > 0

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <div style={{ display: 'flex', gap: 4 }}>
                    {(['roas', 'cac'] as const).map(m => (
                        <button key={m} onClick={() => setMode(m)} style={{
                            fontFamily: 'var(--font-sans)', fontSize: 'var(--text-xs)', padding: '3px 8px',
                            borderRadius: 5, border: '1px solid', cursor: 'pointer', transition: 'all 0.12s',
                            background: mode === m ? 'var(--color-text-primary)' : 'transparent',
                            color: mode === m ? 'var(--color-bg-primary)' : 'var(--color-text-tertiary)',
                            borderColor: mode === m ? 'var(--color-text-primary)' : 'var(--color-border)',
                        }}>{m.toUpperCase()}</button>
                    ))}
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                    {platforms.map(p => (
                        <button key={p} onClick={() => setActivePlatform(activePlatform === p ? null : p)} style={{
                            fontFamily: 'var(--font-sans)', fontSize: 10, padding: '2px 7px',
                            borderRadius: 4, border: '1px solid', cursor: 'pointer', transition: 'all 0.12s',
                            background: activePlatform === null || activePlatform === p ? `${platformColors[p]}18` : 'transparent',
                            color: platformColors[p] || 'var(--color-text-secondary)',
                            borderColor: `${platformColors[p]}44` || 'var(--color-border)',
                            opacity: activePlatform !== null && activePlatform !== p ? 0.4 : 1,
                        }}>
                            {p === 'meta' ? 'Meta' : p === 'google' ? 'Google' : p}
                        </button>
                    ))}
                </div>
            </div>

            {!hasData ? (
                <p style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', color: 'var(--color-text-tertiary)', textAlign: 'center', padding: '24px 0' }}>Sem dados no período</p>
            ) : (
                <div style={{ position: 'relative' }}>
                    {/* Y axis labels */}
                    <div style={{ position: 'absolute', left: 0, top: 0, bottom: 24, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', pointerEvents: 'none' }}>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--color-text-tertiary)' }}>
                            {mode === 'roas' ? `${maxVal.toFixed(1)}x` : `R$ ${fmtBR(maxVal)}`}
                        </span>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--color-text-tertiary)' }}>0</span>
                    </div>
                    <div style={{ marginLeft: 36 }}>
                        <svg width="100%" height="96" viewBox="0 0 100 80" preserveAspectRatio="none">
                            <defs>
                                {displayPlatforms.map(p => (
                                    <linearGradient key={p} id={`grad-${p}`} x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor={platformColors[p] || '#888'} stopOpacity="0.12" />
                                        <stop offset="100%" stopColor={platformColors[p] || '#888'} stopOpacity="0" />
                                    </linearGradient>
                                ))}
                            </defs>
                            {/* Breakeven line for ROAS */}
                            {mode === 'roas' && maxVal > 1 && (
                                <line x1="0" y1={80 - (1 / maxVal) * 72} x2="100" y2={80 - (1 / maxVal) * 72}
                                    stroke="var(--color-text-tertiary)" strokeWidth="0.4" strokeDasharray="2 2" />
                            )}
                            {displayPlatforms.map(p => {
                                const vals = trends[p]?.[mode] || []
                                const isActive = activePlatform === null || activePlatform === p
                                return (
                                    <g key={p} style={{ opacity: isActive ? 1 : 0.15, transition: 'opacity 0.2s' }}>
                                        <path d={toArea(vals)} fill={`url(#grad-${p})`} />
                                        <path d={toPath(vals)} fill="none" stroke={platformColors[p] || '#888'} strokeWidth="1.2" strokeLinejoin="round" strokeLinecap="round" />
                                    </g>
                                )
                            })}
                        </svg>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            {[0, Math.floor((points - 1) / 2), points - 1].map(i => (
                                <span key={i} style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--color-text-tertiary)' }}>{dateLabels[i]}</span>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

// ── Visualization 3: Conversion Funnel ────────────────────────────────────────

function ConversionFunnel({ channelPerf, campaigns }: { channelPerf: any[]; campaigns?: any[] }) {
    const [selectedCampaign, setSelectedCampaign] = useState<string>('all')

    // If campaigns provided, build per-campaign funnel; else aggregate channels
    const totals = useMemo(() => {
        if (campaigns && campaigns.length > 0 && selectedCampaign !== 'all') {
            const camp = campaigns.find(c => c.campaign_id === selectedCampaign)
            if (camp) return {
                impressions: camp.impressions || 0,
                clicks: camp.clicks || 0,
                landing_page_views: camp.landing_page_views || 0,
                purchases: camp.purchases || 0,
            }
        }
        if (campaigns && campaigns.length > 0 && selectedCampaign === 'all') {
            return campaigns.reduce((acc, c) => ({
                impressions: acc.impressions + (c.impressions || 0),
                clicks: acc.clicks + (c.clicks || 0),
                landing_page_views: acc.landing_page_views + (c.landing_page_views || 0),
                purchases: acc.purchases + (c.purchases || 0),
            }), { impressions: 0, clicks: 0, landing_page_views: 0, purchases: 0 })
        }
        return channelPerf.reduce((acc, ch) => ({
            impressions: acc.impressions + (ch.impressions || 0),
            clicks: acc.clicks + (ch.clicks || 0),
            landing_page_views: acc.landing_page_views + (ch.landing_page_views || 0),
            purchases: acc.purchases + (ch.purchases || 0),
        }), { impressions: 0, clicks: 0, landing_page_views: 0, purchases: 0 })
    }, [channelPerf, campaigns, selectedCampaign])

    const steps = [
        { label: 'Impressões', value: totals.impressions, fmt: (v: number) => fmtBR(v) },
        { label: 'Cliques', value: totals.clicks, fmt: (v: number) => fmtBR(v) },
        { label: 'Views da Página', value: totals.landing_page_views, fmt: (v: number) => fmtBR(v) },
        { label: 'Compras', value: totals.purchases, fmt: (v: number) => v.toLocaleString('pt-BR') },
    ].filter(s => s.value > 0)

    if (steps.length < 2) return (
        <p style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', color: 'var(--color-text-tertiary)', textAlign: 'center', padding: '24px 0' }}>Dados insuficientes para o funil</p>
    )

    const maxVal = steps[0]?.value || 1

    return (
        <div>
            {/* Campaign filter dropdown — only shown when campaigns prop passed */}
            {campaigns && campaigns.length > 1 && (
                <div style={{ marginBottom: 16 }}>
                    <select
                        value={selectedCampaign}
                        onChange={e => setSelectedCampaign(e.target.value)}
                        style={{
                            fontFamily: 'var(--font-sans)', fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)',
                            background: 'var(--color-bg-tertiary)', border: '1px solid var(--color-border)',
                            borderRadius: 6, padding: '4px 8px', cursor: 'pointer', outline: 'none', width: '100%',
                        }}
                    >
                        <option value="all">Todas as campanhas</option>
                        {campaigns.filter(c => c.impressions > 0).map(c => (
                            <option key={c.campaign_id} value={c.campaign_id}>{c.campaign_name}</option>
                        ))}
                    </select>
                </div>
            )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {steps.map((step, i) => {
                const pct = (step.value / maxVal) * 100
                const convRate = i > 0 && steps[i - 1] ? ((step.value / steps[i - 1]!.value) * 100) : null
                return (
                    <motion.div key={step.label} initial={{ opacity: 0, x: -4 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.08 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--color-text-tertiary)', width: 16, textAlign: 'right' }}>{i + 1}</span>
                                <span style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)' }}>{step.label}</span>
                            </div>
                            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                                {convRate !== null && (
                                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: convRate >= 5 ? 'var(--status-complete)' : convRate >= 1 ? 'var(--color-primary)' : 'var(--color-text-tertiary)', background: 'var(--color-bg-tertiary)', padding: '1px 6px', borderRadius: 4 }}>
                                        {convRate.toFixed(1)}%
                                    </span>
                                )}
                                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-sm)', color: 'var(--color-text-primary)', fontWeight: 500 }}>
                                    {step.fmt(step.value)}
                                </span>
                            </div>
                        </div>
                        <div style={{ height: 5, background: 'var(--color-bg-tertiary)', borderRadius: 'var(--radius-full)', overflow: 'hidden' }}>
                            <motion.div
                                style={{ height: '100%', background: i === steps.length - 1 ? 'var(--status-complete)' : 'var(--color-primary)', borderRadius: 'var(--radius-full)', opacity: 0.7 + (i / steps.length) * 0.3 }}
                                initial={{ width: '0%' }}
                                animate={{ width: `${pct}%` }}
                                transition={{ duration: 0.7, delay: i * 0.1 + 0.2, ease: [0.4, 0, 0.2, 1] }}
                            />
                        </div>
                    </motion.div>
                )
            })}
        </div>
        </div>
    )
}

// ── Visualization 4: Campaign Scatter Plot (ROAS vs CAC) ──────────────────────

function CampaignScatterPlot({ campaigns }: { campaigns: any[] }) {
    const [tooltip, setTooltip] = useState<{ camp: any; x: number; y: number } | null>(null)
    const svgRef = useRef<SVGSVGElement>(null)

    const platformColors: Record<string, string> = { meta: '#1877F2', google: '#4285F4' }

    const filtered = campaigns.filter(c => c.spend_brl > 0 && (c.roas > 0 || c.purchases > 0))
    if (filtered.length === 0) return (
        <p style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', color: 'var(--color-text-tertiary)', textAlign: 'center', padding: '24px 0' }}>Sem dados suficientes para o scatter</p>
    )

    const maxSpend = Math.max(...filtered.map(c => c.spend_brl), 1)
    const maxRoas = Math.max(...filtered.map(c => c.roas), 0.1)
    const maxPurchases = Math.max(...filtered.map(c => c.purchases || 1), 1)

    const W = 100, H = 80, PAD = 8

    return (
        <div style={{ position: 'relative' }}>
            {/* Y axis label */}
            <div style={{ position: 'absolute', left: 0, top: 0, bottom: 20, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', pointerEvents: 'none', paddingRight: 4 }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--color-text-tertiary)' }}>{maxRoas.toFixed(1)}x</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--color-text-tertiary)' }}>ROAS</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--color-text-tertiary)' }}>0</span>
            </div>
            <div style={{ marginLeft: 36 }}>
                <svg ref={svgRef} width="100%" height="120" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ overflow: 'visible' }}>
                    {/* ROAS=1 breakeven */}
                    <line x1={PAD} y1={H - PAD - ((1 / maxRoas) * (H - PAD * 2))} x2={W - PAD} y2={H - PAD - ((1 / maxRoas) * (H - PAD * 2))}
                        stroke="var(--color-text-tertiary)" strokeWidth="0.4" strokeDasharray="2 2" />

                    {filtered.map((c, i) => {
                        const cx = PAD + (c.spend_brl / maxSpend) * (W - PAD * 2)
                        const cy = H - PAD - ((c.roas / maxRoas) * (H - PAD * 2))
                        const r = 2.5 + ((c.purchases || 0) / maxPurchases) * 4
                        const color = platformColors[c.platform] || 'var(--color-primary)'
                        return (
                            <motion.circle
                                key={c.campaign_id}
                                cx={cx} cy={cy} r={r}
                                fill={color}
                                fillOpacity={0.6}
                                stroke={color}
                                strokeWidth="0.5"
                                initial={{ opacity: 0, r: 0 }}
                                animate={{ opacity: 1, r }}
                                transition={{ delay: i * 0.04, duration: 0.3 }}
                                style={{ cursor: 'pointer' }}
                                onMouseEnter={e => {
                                    const rect = svgRef.current?.getBoundingClientRect()
                                    if (rect) setTooltip({ camp: c, x: e.clientX - rect.left, y: e.clientY - rect.top })
                                }}
                                onMouseLeave={() => setTooltip(null)}
                            />
                        )
                    })}
                </svg>
                {/* X axis label */}
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 2 }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--color-text-tertiary)' }}>R$ 0</span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--color-text-tertiary)' }}>Gasto →</span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--color-text-tertiary)' }}>R$ {fmtBR(maxSpend)}</span>
                </div>
            </div>
            {/* Tooltip */}
            {tooltip && (
                <div style={{
                    position: 'absolute', left: tooltip.x + 8, top: tooltip.y - 8,
                    background: 'var(--color-bg-primary)', border: '1px solid var(--color-border)',
                    borderRadius: 8, padding: '8px 12px', pointerEvents: 'none', zIndex: 10,
                    boxShadow: 'var(--shadow-md)', minWidth: 160
                }}>
                    <p style={{ fontFamily: 'var(--font-sans)', fontSize: 11, fontWeight: 500, color: 'var(--color-text-primary)', margin: '0 0 4px', lineHeight: 1.3, maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {tooltip.camp.campaign_name}
                    </p>
                    <div style={{ display: 'flex', gap: 10 }}>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--color-text-secondary)' }}>
                            ROAS {tooltip.camp.roas.toFixed(2)}x
                        </span>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--color-text-tertiary)' }}>
                            R$ {fmtBR(tooltip.camp.spend_brl)}
                        </span>
                    </div>
                </div>
            )}
            {/* Legend */}
            <div style={{ display: 'flex', gap: 12, marginTop: 6, marginLeft: 36 }}>
                {Object.entries(platformColors).map(([p, color]) => (
                    <div key={p} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: color, opacity: 0.7 }} />
                        <span style={{ fontFamily: 'var(--font-sans)', fontSize: 10, color: 'var(--color-text-tertiary)' }}>{p === 'meta' ? 'Meta Ads' : 'Google Ads'}</span>
                    </div>
                ))}
                <span style={{ fontFamily: 'var(--font-sans)', fontSize: 10, color: 'var(--color-text-tertiary)', marginLeft: 4 }}>● tamanho = compras</span>
            </div>
        </div>
    )
}

// ── Top Ads Table ─────────────────────────────────────────────────────────────

function TopAdsTable({ campaigns, days }: { campaigns: any[]; days: number }) {
    const [ads, setAds] = useState<any[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        if (campaigns.length === 0) { setLoading(false); return }
        // Fetch details for top 3 campaigns by spend
        const top3 = campaigns.slice(0, 3)
        Promise.all(top3.map(c => dashboardApi.getAdCampaignDetail(c.campaign_id, days).then(r => r.data.ads || [])))
            .then(results => {
                const allAds = results.flat().sort((a: any, b: any) => b.spend_brl - a.spend_brl)
                setAds(allAds.slice(0, 10))
            })
            .catch(() => setAds([]))
            .finally(() => setLoading(false))
    }, [campaigns.map(c => c.campaign_id).join(','), days])

    if (loading) return <SkeletonTable rows={3} columns={6} />
    if (ads.length === 0) return <p style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', color: 'var(--color-text-tertiary)' }}>Nenhum anúncio encontrado no período.</p>

    const TOP_ADS_GRID = 'minmax(180px,1.8fr) 60px 80px 70px 60px 60px'

    return (
        <div>
            <div style={{ display: 'grid', gridTemplateColumns: TOP_ADS_GRID, gap: '0 12px', paddingBottom: 8, borderBottom: '1px solid var(--color-border)', marginBottom: 2 }}>
                <TH>Anúncio</TH>
                <TH>Status</TH>
                <TH align="right">Gasto</TH>
                <TH align="right">ROAS</TH>
                <TH align="right">CTR</TH>
                <TH align="right">Compras</TH>
            </div>
            {ads.map((ad, i) => (
                <motion.div
                    key={ad.ad_id}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="notion-row"
                    style={{ display: 'grid', gridTemplateColumns: TOP_ADS_GRID, gap: '0 12px', alignItems: 'center' }}
                >
                    <span title={ad.ad_name} style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', color: 'var(--color-text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {ad.ad_name}
                    </span>
                    <div><StatusTag status={ad.status} /></div>
                    <MetricCell value={ad.spend_brl} format="brl" />
                    {ad.roas > 0 ? (
                        <div style={{ textAlign: 'right' }}>
                            <span className={ad.roas >= 3 ? 'tag tag-complete' : ad.roas >= 1 ? 'tag tag-planning' : 'tag tag-critical'} style={{ fontFamily: 'var(--font-mono)' }}>
                                {ad.roas.toFixed(2)}x
                            </span>
                        </div>
                    ) : <MetricCell value={0} />}
                    <MetricCell value={ad.ctr} format="pct" />
                    <MetricCell value={ad.purchases} format="num" />
                </motion.div>
            ))}
        </div>
    )
}

// ── Channel KPI inline row ─────────────────────────────────────────────────────

function ChannelKpiGrid({ ch }: { ch: any }) {
    const metrics = [
        { label: 'Gasto', value: ch.spend > 0 ? `R$ ${fmtBR(ch.spend)}` : '—' },
        { label: 'Receita Atr.', value: ch.revenue > 0 ? `R$ ${fmtBR(ch.revenue)}` : '—' },
        { label: 'ROAS', value: ch.roas > 0 ? `${ch.roas.toFixed(2)}x` : '—' },
        { label: 'Compras', value: ch.purchases > 0 ? ch.purchases.toLocaleString('pt-BR') : '—' },
        { label: 'Custo/Compra', value: ch.cac > 0 ? `R$ ${fmtBR(ch.cac)}` : '—' },
        { label: 'Leads', value: ch.leads > 0 ? ch.leads.toLocaleString('pt-BR') : '—' },
        { label: 'CPL', value: ch.cpl > 0 ? `R$ ${fmtBR(ch.cpl)}` : '—' },
        { label: 'Impressões', value: ch.impressions > 0 ? fmtBR(ch.impressions) : '—' },
        { label: 'CTR', value: ch.ctr > 0 ? `${ch.ctr.toFixed(2)}%` : '—' },
    ]

    return (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: '16px 24px' }}>
            {metrics.map(m => (
                <div key={m.label} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <span style={{ fontFamily: 'var(--font-sans)', fontSize: 10, fontWeight: 500, color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{m.label}</span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-base)', fontWeight: 500, color: 'var(--color-text-primary)', letterSpacing: '-0.3px' }}>{m.value}</span>
                </div>
            ))}
        </div>
    )
}

// ── Coming Soon placeholder ────────────────────────────────────────────────────

function ComingSoonChannel({ name }: { name: string }) {
    return (
        <div style={{ textAlign: 'center', padding: '64px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 40, height: 40, borderRadius: 12, background: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.4 }}>
                    <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
                </svg>
            </div>
            <p style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-lg)', fontWeight: 400, color: 'var(--color-text-secondary)', margin: 0 }}>{name}</p>
            <p style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', color: 'var(--color-text-tertiary)', margin: 0 }}>
                Integração em breve. Configure em <strong>Configurações → Integrações</strong>.
            </p>
        </div>
    )
}

// ── Campaign Drawer ────────────────────────────────────────────────────────────

function DrawerMetric({ label, value }: { label: string; value: string | number }) {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontFamily: 'var(--font-sans)', fontSize: 10, fontWeight: 500, color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-base)', fontWeight: 500, color: 'var(--color-text-primary)', letterSpacing: '-0.3px' }}>{value || '—'}</span>
        </div>
    )
}

function CampaignDrawer({ camp, days, onClose }: { camp: any; days: number; onClose: () => void }) {
    const [detail, setDetail] = useState<{ adsets: any[]; ads: any[] } | null>(null)
    const [loading, setLoading] = useState(true)
    const [expandedAdsets, setExpandedAdsets] = useState<Set<string>>(new Set())

    useEffect(() => {
        dashboardApi.getAdCampaignDetail(camp.campaign_id, days)
            .then(r => setDetail(r.data))
            .catch(() => setDetail({ adsets: [], ads: [] }))
            .finally(() => setLoading(false))
    }, [camp.campaign_id, days])

    const toggleAdset = (id: string) => setExpandedAdsets(prev => {
        const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n
    })

    const objective = OBJECTIVE_LABELS[camp.objective] || camp.objective || '—'

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', justifyContent: 'flex-end' }}
        >
            <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.18)' }} />
            <motion.div
                initial={{ x: 560 }}
                animate={{ x: 0 }}
                exit={{ x: 560 }}
                transition={{ ease: [0.4, 0, 0.2, 1], duration: 0.3 }}
                style={{ position: 'relative', width: 560, height: '100%', background: 'var(--color-bg-primary)', borderLeft: '1px solid var(--color-border)', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}
            >
                <div style={{ padding: '24px 28px 20px', borderBottom: '1px solid var(--color-border)', position: 'sticky', top: 0, background: 'var(--color-bg-primary)', zIndex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
                                {camp.account_name || camp.platform?.toUpperCase()}
                            </p>
                            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-lg)', fontWeight: 400, color: 'var(--color-text-primary)', lineHeight: 1.3, margin: 0 }}>
                                {camp.campaign_name}
                            </h2>
                            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 10, flexWrap: 'wrap' }}>
                                <StatusTag status={camp.status} />
                                {camp.objective && (
                                    <span style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)', background: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)', borderRadius: 4, padding: '2px 8px' }}>
                                        {objective}
                                    </span>
                                )}
                            </div>
                        </div>
                        <button onClick={onClose} style={{ flexShrink: 0, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-tertiary)', padding: 4, lineHeight: 1 }}>
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                        </button>
                    </div>
                </div>

                <div style={{ padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: 28 }}>
                    {(camp.purchases > 0 || camp.leads > 0) && (
                        <div style={{ background: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', padding: '16px 20px' }}>
                            <p style={{ fontFamily: 'var(--font-sans)', fontSize: 10, fontWeight: 500, color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>Resultados Principais</p>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20 }}>
                                {camp.purchases > 0 && <DrawerMetric label="Compras" value={camp.purchases.toLocaleString('pt-BR')} />}
                                {camp.leads > 0 && <DrawerMetric label="Leads" value={camp.leads.toLocaleString('pt-BR')} />}
                                {camp.purchase_value > 0 && <DrawerMetric label="Receita Atribuída" value={`R$ ${fmtBR(camp.purchase_value)}`} />}
                                {camp.roas > 0 && <DrawerMetric label="ROAS" value={`${camp.roas.toFixed(2)}x`} />}
                                {camp.purchases > 0 && <DrawerMetric label="Custo por Compra" value={camp.spend_brl > 0 ? `R$ ${fmtBR(camp.spend_brl / camp.purchases)}` : '—'} />}
                                {camp.leads > 0 && <DrawerMetric label="Custo por Lead" value={camp.spend_brl > 0 ? `R$ ${fmtBR(camp.spend_brl / camp.leads)}` : '—'} />}
                            </div>
                        </div>
                    )}
                    <div>
                        <p style={{ fontFamily: 'var(--font-sans)', fontSize: 10, fontWeight: 500, color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 16 }}>Distribuição</p>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20 }}>
                            <DrawerMetric label="Gasto" value={`R$ ${fmtBR(camp.spend_brl)}`} />
                            <DrawerMetric label="Impressões" value={camp.impressions >= 1000 ? fmtBR(camp.impressions) : camp.impressions} />
                            <DrawerMetric label="Alcance" value={camp.reach >= 1000 ? fmtBR(camp.reach) : camp.reach} />
                            <DrawerMetric label="Frequência" value={camp.frequency > 0 ? `${camp.frequency}x` : '—'} />
                            <DrawerMetric label="CPM" value={camp.cpm_brl > 0 ? `R$ ${fmtBR(camp.cpm_brl)}` : '—'} />
                            <DrawerMetric label="CTR" value={camp.ctr > 0 ? `${camp.ctr}%` : '—'} />
                        </div>
                    </div>
                    <div>
                        <p style={{ fontFamily: 'var(--font-sans)', fontSize: 10, fontWeight: 500, color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 16 }}>Cliques e Engajamento</p>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20 }}>
                            <DrawerMetric label="Cliques (todos)" value={camp.clicks >= 1000 ? fmtBR(camp.clicks) : camp.clicks} />
                            <DrawerMetric label="CPC" value={camp.cpc_brl > 0 ? `R$ ${fmtBR(camp.cpc_brl)}` : '—'} />
                            <DrawerMetric label="Cliques no Link" value={camp.link_clicks > 0 ? camp.link_clicks.toLocaleString('pt-BR') : '—'} />
                            <DrawerMetric label="Views da Pág." value={camp.landing_page_views > 0 ? camp.landing_page_views.toLocaleString('pt-BR') : '—'} />
                            <DrawerMetric label="Views de Vídeo" value={camp.video_views > 0 ? camp.video_views.toLocaleString('pt-BR') : '—'} />
                        </div>
                    </div>
                    <div>
                        <p style={{ fontFamily: 'var(--font-sans)', fontSize: 10, fontWeight: 500, color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>Conjuntos de Anúncios</p>
                        {loading ? (
                            <p style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', color: 'var(--color-text-tertiary)' }}>Carregando...</p>
                        ) : (detail?.adsets || []).length === 0 ? (
                            <p style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', color: 'var(--color-text-tertiary)' }}>Sem dados no período.</p>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                {(detail?.adsets || []).map(adset => {
                                    const adAds = (detail?.ads || []).filter(a => a.adset_id === adset.adset_id)
                                    const open = expandedAdsets.has(adset.adset_id)
                                    return (
                                        <div key={adset.adset_id} style={{ border: '1px solid var(--color-border)', borderRadius: 8, overflow: 'hidden' }}>
                                            <div
                                                onClick={() => adAds.length > 0 && toggleAdset(adset.adset_id)}
                                                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: 'var(--color-bg-secondary)', cursor: adAds.length > 0 ? 'pointer' : 'default', gap: 8 }}
                                            >
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
                                                    {adAds.length > 0 && (
                                                        <motion.span animate={{ rotate: open ? 90 : 0 }} transition={{ duration: 0.15 }} style={{ fontSize: 9, color: 'var(--color-text-tertiary)', flexShrink: 0 }}>▶</motion.span>
                                                    )}
                                                    <span style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', color: 'var(--color-text-primary)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{adset.adset_name}</span>
                                                    <StatusTag status={adset.status} />
                                                </div>
                                                <div style={{ display: 'flex', gap: 16, flexShrink: 0, alignItems: 'center' }}>
                                                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)' }}>R$ {fmtBR(adset.spend_brl)}</span>
                                                    {adset.purchases > 0 && <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)' }}>{adset.purchases} compras</span>}
                                                    {adset.leads > 0 && <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)' }}>{adset.leads} leads</span>}
                                                </div>
                                            </div>
                                            <AnimatePresence>
                                                {open && adAds.map(ad => (
                                                    <motion.div key={ad.ad_id} initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.15 }} style={{ overflow: 'hidden' }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 14px 8px 34px', borderTop: '1px solid var(--color-border)', gap: 8 }}>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, minWidth: 0 }}>
                                                                <span style={{ color: 'var(--color-text-tertiary)', fontSize: 9, flexShrink: 0 }}>◦</span>
                                                                <span style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ad.ad_name}</span>
                                                                <StatusTag status={ad.status} />
                                                            </div>
                                                            <div style={{ display: 'flex', gap: 16, flexShrink: 0 }}>
                                                                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)' }}>R$ {fmtBR(ad.spend_brl)}</span>
                                                                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)' }}>{ad.impressions?.toLocaleString('pt-BR')} imp.</span>
                                                            </div>
                                                        </div>
                                                    </motion.div>
                                                ))}
                                            </AnimatePresence>
                                        </div>
                                    )
                                })}
                            </div>
                        )}
                    </div>
                </div>
            </motion.div>
        </motion.div>
    )
}

// ── Campaign table row ─────────────────────────────────────────────────────────

const CAMP_GRID = 'minmax(180px,1.6fr) 72px 80px 80px 90px 90px 90px 72px 60px'

function CampaignRow({ camp, days, onOpenDrawer }: { camp: any; days: number; onOpenDrawer: (c: any) => void }) {
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
            } catch { setDetail({ adsets: [], ads: [] }) }
            finally { setLoadingDetail(false) }
        }
        setExpanded(v => !v)
    }

    const toggleAdset = (id: string) => setExpandedAdsets(prev => {
        const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n
    })

    const primaryResult = camp.purchases > 0 ? `${camp.purchases} compras` : camp.leads > 0 ? `${camp.leads} leads` : '—'
    const costPerResult = camp.purchases > 0 ? camp.spend_brl / camp.purchases : camp.leads > 0 ? camp.spend_brl / camp.leads : 0

    return (
        <>
            <motion.div
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25 }}
                className="notion-row"
                style={{ display: 'grid', gridTemplateColumns: CAMP_GRID, gap: '0 12px', alignItems: 'center', cursor: 'pointer' }}
                onClick={toggle}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, overflow: 'hidden' }}>
                    <motion.span animate={{ rotate: expanded ? 90 : 0 }} transition={{ duration: 0.18 }} style={{ color: 'var(--color-text-tertiary)', fontSize: 12, flexShrink: 0, lineHeight: 1 }}>▶</motion.span>
                    <span
                        title={camp.campaign_name}
                        onClick={(e) => { e.stopPropagation(); onOpenDrawer(camp) }}
                        style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', fontWeight: 500, color: 'var(--color-text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', cursor: 'pointer', textDecoration: 'underline', textDecorationColor: 'transparent', transition: 'text-decoration-color 0.15s' }}
                        onMouseEnter={e => (e.currentTarget.style.textDecorationColor = 'var(--color-text-tertiary)')}
                        onMouseLeave={e => (e.currentTarget.style.textDecorationColor = 'transparent')}
                    >
                        {camp.campaign_name}
                    </span>
                </div>
                <div><StatusTag status={camp.status} /></div>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)', textAlign: 'right' }}>{primaryResult}</span>
                <MetricCell value={costPerResult} format="brl" />
                <MetricCell value={camp.roas} format="x" />
                <MetricCell value={camp.spend_brl} format="brl" />
                <MetricCell value={camp.purchase_value} format="brl" />
                <MetricCell value={camp.impressions} format="num" />
                <MetricCell value={camp.ctr} format="pct" />
            </motion.div>

            <AnimatePresence>
                {expanded && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.2 }} style={{ overflow: 'hidden' }}>
                        {loadingDetail ? (
                            <div style={{ paddingLeft: 36, paddingTop: 8, paddingBottom: 8, fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', color: 'var(--color-text-tertiary)' }}>Carregando conjuntos...</div>
                        ) : (detail?.adsets || []).map(adset => {
                            const adsetExpanded = expandedAdsets.has(adset.adset_id)
                            const adsForAdset = (detail?.ads || []).filter(a => a.adset_id === adset.adset_id)
                            const adsetCostPerResult = adset.purchases > 0 ? adset.spend_brl / adset.purchases : adset.leads > 0 ? adset.spend_brl / adset.leads : 0
                            const adsetResult = adset.purchases > 0 ? `${adset.purchases} compras` : adset.leads > 0 ? `${adset.leads} leads` : '—'
                            return (
                                <div key={adset.adset_id}>
                                    <div
                                        className="notion-row"
                                        style={{ display: 'grid', gridTemplateColumns: CAMP_GRID, gap: '0 12px', alignItems: 'center', cursor: adsForAdset.length > 0 ? 'pointer' : 'default', background: 'var(--color-bg-secondary)' }}
                                        onClick={() => adsForAdset.length > 0 && toggleAdset(adset.adset_id)}
                                    >
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, paddingLeft: 28, overflow: 'hidden' }}>
                                            {adsForAdset.length > 0 ? (
                                                <motion.span animate={{ rotate: adsetExpanded ? 90 : 0 }} transition={{ duration: 0.15 }} style={{ color: 'var(--color-text-tertiary)', fontSize: 10, flexShrink: 0 }}>▶</motion.span>
                                            ) : <span style={{ width: 10, flexShrink: 0 }} />}
                                            <span style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{adset.adset_name}</span>
                                        </div>
                                        <div><StatusTag status={adset.status} /></div>
                                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)', textAlign: 'right' }}>{adsetResult}</span>
                                        <MetricCell value={adsetCostPerResult} format="brl" />
                                        <MetricCell value={adset.roas} format="x" />
                                        <MetricCell value={adset.spend_brl} format="brl" />
                                        <MetricCell value={adset.purchase_value} format="brl" />
                                        <MetricCell value={adset.impressions} format="num" />
                                        <MetricCell value={adset.ctr} format="pct" />
                                    </div>
                                    <AnimatePresence>
                                        {adsetExpanded && adsForAdset.map(ad => (
                                            <motion.div key={ad.ad_id} initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.15 }} style={{ overflow: 'hidden' }}>
                                                <div className="notion-row" style={{ display: 'grid', gridTemplateColumns: CAMP_GRID, gap: '0 12px', alignItems: 'center', cursor: 'default' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, paddingLeft: 56, overflow: 'hidden' }}>
                                                        <span style={{ color: 'var(--color-text-tertiary)', fontSize: 10, flexShrink: 0 }}>◦</span>
                                                        <span style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ad.ad_name}</span>
                                                    </div>
                                                    <div><StatusTag status={ad.status} /></div>
                                                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-sm)', color: 'var(--color-text-tertiary)', textAlign: 'right' }}>
                                                        {ad.purchases > 0 ? `${ad.purchases} compras` : ad.leads > 0 ? `${ad.leads} leads` : '—'}
                                                    </span>
                                                    <MetricCell value={ad.purchases > 0 ? ad.spend_brl / ad.purchases : ad.leads > 0 ? ad.spend_brl / ad.leads : 0} format="brl" />
                                                    <MetricCell value={ad.roas} format="x" />
                                                    <MetricCell value={ad.spend_brl} format="brl" />
                                                    <MetricCell value={ad.purchase_value} format="brl" />
                                                    <MetricCell value={ad.impressions} format="num" />
                                                    <MetricCell value={ad.ctr} format="pct" />
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

// ── Main Page ──────────────────────────────────────────────────────────────────

export default function Canais({ onToggleChat }: { onToggleChat?: () => void }) {
    const [rawCampaigns, setRawCampaigns] = useState<any[]>([])
    const [trends, setTrends] = useState<Record<string, { roas: number[]; cac: number[] }>>({})
    const [loading, setLoading] = useState(true)
    const [periodDays, setPeriodDays] = useState(30)
    const [drawerCamp, setDrawerCamp] = useState<any>(null)
    const [activeChannelTab, setActiveChannelTab] = useState('Todos')

    useEffect(() => {
        setLoading(true)
        Promise.all([
            dashboardApi.getAdCampaigns(periodDays),
            dashboardApi.getChannelTrends(),
        ])
            .then(([campRes, trendsRes]) => {
                setRawCampaigns(campRes.data)
                setTrends(trendsRes.data)
            })
            .catch(() => { setRawCampaigns([]); setTrends({}) })
            .finally(() => setLoading(false))
    }, [periodDays])

    // ── Aggregated KPIs ────────────────────────────────────────────────────────
    const totals = useMemo(() => rawCampaigns.reduce((acc, c) => ({
        spend: acc.spend + (c.spend_brl || 0),
        revenue: acc.revenue + (c.purchase_value || 0),
        purchases: acc.purchases + (c.purchases || 0),
        leads: acc.leads + (c.leads || 0),
        impressions: acc.impressions + (c.impressions || 0),
        clicks: acc.clicks + (c.clicks || 0),
        landing_page_views: acc.landing_page_views + (c.landing_page_views || 0),
    }), { spend: 0, revenue: 0, purchases: 0, leads: 0, impressions: 0, clicks: 0, landing_page_views: 0 }), [rawCampaigns])

    const avgRoas = totals.spend > 0 ? totals.revenue / totals.spend : 0
    const avgCac = totals.purchases > 0 ? totals.spend / totals.purchases : 0
    const avgCpl = totals.leads > 0 ? totals.spend / totals.leads : 0

    // ── Channel breakdown ──────────────────────────────────────────────────────
    const channelPerf = useMemo(() => {
        const map: Record<string, { spend: number; revenue: number; purchases: number; leads: number; impressions: number; clicks: number; landing_page_views: number }> = {}
        for (const c of rawCampaigns) {
            const ch = c.platform === 'meta' ? 'Meta Ads' : c.platform === 'google' ? 'Google Ads' : c.platform
            if (!map[ch]) map[ch] = { spend: 0, revenue: 0, purchases: 0, leads: 0, impressions: 0, clicks: 0, landing_page_views: 0 }
            const entry = map[ch]!
            entry.spend += c.spend_brl || 0
            entry.revenue += c.purchase_value || 0
            entry.purchases += c.purchases || 0
            entry.leads += c.leads || 0
            entry.impressions += c.impressions || 0
            entry.clicks += c.clicks || 0
            entry.landing_page_views += c.landing_page_views || 0
        }
        return Object.entries(map).map(([ch, s]) => ({
            channel: ch,
            spend: s.spend,
            revenue: s.revenue,
            purchases: s.purchases,
            leads: s.leads,
            impressions: s.impressions,
            clicks: s.clicks,
            landing_page_views: s.landing_page_views,
            ctr: s.impressions > 0 ? (s.clicks / s.impressions) * 100 : 0,
            roas: s.spend > 0 && s.revenue > 0 ? s.revenue / s.spend : 0,
            cac: s.purchases > 0 ? s.spend / s.purchases : 0,
            cpl: s.leads > 0 ? s.spend / s.leads : 0,
        })).sort((a, b) => b.spend - a.spend)
    }, [rawCampaigns])

    // ── Dynamic channel tabs ───────────────────────────────────────────────────
    // Always show "Todos" + tabs for channels with data + future channels
    const channelTabs = useMemo(() => {
        const withData = channelPerf.map(ch => ch.channel)
        const extra = ['Google Ads', 'Email', 'Orgânico'].filter(ch => !withData.includes(ch))
        return ['Todos', ...withData, ...extra]
    }, [channelPerf])

    const activeCh = channelPerf.find(c => c.channel === activeChannelTab)
    const tabCampaigns = useMemo(() => {
        if (activeChannelTab === 'Todos') return rawCampaigns
        const platformMap: Record<string, string> = { 'Meta Ads': 'meta', 'Google Ads': 'google' }
        const platform = platformMap[activeChannelTab]
        if (platform) return rawCampaigns.filter(c => c.platform === platform)
        return []
    }, [activeChannelTab, rawCampaigns])

    // Check if active tab has data
    const tabHasData = channelPerf.some(c => c.channel === activeChannelTab) || activeChannelTab === 'Todos'

    return (
        <div>
            <TopBar onToggleChat={onToggleChat} />

            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
                <PageHeader
                    title="Canais"
                    subtitle="Análise unificada de todos os seus canais de aquisição."
                />
                <PeriodFilter value={periodDays} onChange={setPeriodDays} />
            </div>

            {/* ── Seção 1: KPIs globais ── */}
            {loading ? (
                <KpiGrid style={{ marginTop: 40 }}>
                    <SkeletonKpi />
                    <SkeletonKpi />
                    <SkeletonKpi />
                    <SkeletonKpi />
                    <SkeletonKpi />
                    <SkeletonKpi />
                </KpiGrid>
            ) : (
                <KpiGrid style={{ marginTop: 40 }}>
                    <KpiCard label="GASTO TOTAL" value={totals.spend} prefix="R$ " decimals={0} delay={0.1} />
                    <KpiCard label="RECEITA ATRIBUÍDA" value={totals.revenue} prefix="R$ " decimals={0} delay={0.2} />
                    <KpiCard label="ROAS" value={avgRoas} suffix="x" decimals={2} delay={0.3} />
                    <KpiCard label="CUSTO POR COMPRA" value={avgCac} prefix="R$ " decimals={0} delay={0.4} />
                    {totals.leads > 0 && <KpiCard label="CUSTO POR LEAD" value={avgCpl} prefix="R$ " decimals={2} delay={0.5} />}
                    <KpiCard label="IMPRESSÕES" value={totals.impressions} decimals={0} delay={0.6} />
                </KpiGrid>
            )}

            {/* ── Seção 2: Visualizações (2x2 grid) ── */}
            {!loading && rawCampaigns.length > 0 && (
                <>
                    <Divider margin="52px 0 48px" />
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>

                        {/* Card 1: Distribuição de Gasto — big visual bars */}
                        <div style={{ background: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', padding: '24px 28px' }}>
                            <p style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-xs)', fontWeight: 500, color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6, marginTop: 0 }}>Distribuição de Gasto</p>
                            <p style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-2xl)', fontWeight: 500, color: 'var(--color-text-primary)', letterSpacing: '-1px', margin: '0 0 24px' }}>
                                R$ {fmtBR(totals.spend)}
                            </p>
                            <SpendDistribution channelPerf={channelPerf} totalSpend={totals.spend} />
                        </div>

                        {/* Card 2: Trend Diário */}
                        <div style={{ background: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', padding: '24px 28px' }}>
                            <p style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-xs)', fontWeight: 500, color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6, marginTop: 0 }}>Tendência Diária</p>
                            <p style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-2xl)', fontWeight: 500, color: avgRoas >= 1 ? 'var(--status-complete)' : 'var(--status-critical)', letterSpacing: '-1px', margin: '0 0 24px' }}>
                                {avgRoas > 0 ? `${avgRoas.toFixed(2)}x ROAS` : '—'}
                            </p>
                            <DailyTrendChart trends={trends} />
                        </div>

                        {/* Card 3: Funil de Conversão — global overview */}
                        <div style={{ background: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', padding: '24px 28px' }}>
                            <p style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-xs)', fontWeight: 500, color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6, marginTop: 0 }}>Funil de Conversão</p>
                            <p style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-2xl)', fontWeight: 500, color: 'var(--color-text-primary)', letterSpacing: '-1px', margin: '0 0 24px' }}>
                                {totals.purchases > 0 ? `${totals.purchases.toLocaleString('pt-BR')} compras` : totals.impressions > 0 ? `${fmtBR(totals.impressions)} imp.` : '—'}
                            </p>
                            <ConversionFunnel channelPerf={channelPerf.map(ch => ({
                                ...ch,
                                landing_page_views: rawCampaigns
                                    .filter(c => (c.platform === 'meta' && ch.channel === 'Meta Ads') || (c.platform === 'google' && ch.channel === 'Google Ads'))
                                    .reduce((s: number, c: any) => s + (c.landing_page_views || 0), 0)
                            }))} />
                        </div>

                        {/* Card 4: Scatter ROAS vs Gasto */}
                        <div style={{ background: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', padding: '24px 28px' }}>
                            <p style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-xs)', fontWeight: 500, color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6, marginTop: 0 }}>ROAS vs Gasto por Campanha</p>
                            <p style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-2xl)', fontWeight: 500, color: 'var(--color-text-primary)', letterSpacing: '-1px', margin: '0 0 24px' }}>
                                {rawCampaigns.filter(c => c.spend_brl > 0).length} campanhas
                            </p>
                            <CampaignScatterPlot campaigns={rawCampaigns} />
                        </div>
                    </div>
                </>
            )}

            {/* ── Seção 3: Análise por Canal (tabs) ── */}
            <SectionCard style={{ marginTop: 48 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 24 }}>
                    <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-2xl)', fontWeight: 400, color: 'var(--color-text-primary)', margin: 0, letterSpacing: '-0.5px' }}>
                        Análise por Canal
                    </h2>
                    <span style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', color: 'var(--color-text-tertiary)' }}>
                        Métricas detalhadas e campanhas por canal de aquisição
                    </span>
                </div>
                <TabBar tabs={channelTabs} active={activeChannelTab} onChange={setActiveChannelTab} />

                <AnimatePresence mode="wait">
                    <motion.div
                        key={activeChannelTab}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -4 }}
                        transition={{ duration: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
                        style={{ paddingTop: 32 }}
                    >
                        {activeChannelTab === 'Todos' ? (
                            /* Vista unificada: all-channel summary */
                            <div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 28, marginBottom: 40 }}>
                                    <div style={{ background: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', padding: '20px 24px' }}>
                                        <p style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-xs)', fontWeight: 500, color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 16, marginTop: 0 }}>Visão Geral — Todos os Canais</p>
                                        {channelPerf.length === 0 ? (
                                            <p style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', color: 'var(--color-text-tertiary)' }}>Sem dados.</p>
                                        ) : (
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                                {channelPerf.map(ch => (
                                                    <div key={ch.channel} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--color-border)' }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                            <div style={{ width: 8, height: 8, borderRadius: '50%', background: getChannelColor(ch.channel) }} />
                                                            <span style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', color: 'var(--color-text-primary)' }}>{ch.channel}</span>
                                                        </div>
                                                        <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                                                            {ch.roas > 0 && (
                                                                <span className={ch.roas >= 3 ? 'tag tag-complete' : ch.roas >= 1 ? 'tag tag-planning' : 'tag tag-critical'} style={{ fontFamily: 'var(--font-mono)' }}>
                                                                    {ch.roas.toFixed(2)}x ROAS
                                                                </span>
                                                            )}
                                                            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)' }}>R$ {fmtBR(ch.spend)}</span>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                    <div style={{ background: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', padding: '20px 24px' }}>
                                        <p style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-xs)', fontWeight: 500, color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 16, marginTop: 0 }}>Top Anúncios — Todos os Canais</p>
                                        <TopAdsTable campaigns={rawCampaigns} days={periodDays} />
                                    </div>
                                </div>
                                {/* Full campaigns table */}
                                <CampaignsTable campaigns={rawCampaigns} days={periodDays} onOpenDrawer={setDrawerCamp} loading={loading} />
                            </div>
                        ) : tabHasData ? (
                            /* Canal específico com dados */
                            <div>
                                {activeCh && (
                                    <div style={{ background: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', padding: '20px 24px', marginBottom: 32 }}>
                                        <p style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-xs)', fontWeight: 500, color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 16, marginTop: 0 }}>Métricas do Canal</p>
                                        <ChannelKpiGrid ch={activeCh} />
                                    </div>
                                )}

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 28, marginBottom: 40 }}>
                                    <div style={{ background: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', padding: '20px 24px' }}>
                                        <p style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-xs)', fontWeight: 500, color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 16, marginTop: 0 }}>Funil de Conversão</p>
                                        {activeCh ? (
                                            <ConversionFunnel
                                                channelPerf={[{
                                                    ...activeCh,
                                                    landing_page_views: tabCampaigns.reduce((s: number, c: any) => s + (c.landing_page_views || 0), 0)
                                                }]}
                                                campaigns={tabCampaigns}
                                            />
                                        ) : <p style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', color: 'var(--color-text-tertiary)' }}>Sem dados.</p>}
                                    </div>
                                    <div style={{ background: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', padding: '20px 24px' }}>
                                        <p style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-xs)', fontWeight: 500, color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 16, marginTop: 0 }}>Top Anúncios</p>
                                        <TopAdsTable campaigns={tabCampaigns} days={periodDays} />
                                    </div>
                                </div>

                                <CampaignsTable campaigns={tabCampaigns} days={periodDays} onOpenDrawer={setDrawerCamp} loading={loading} />
                            </div>
                        ) : (
                            /* Canal sem dados ainda */
                            <ComingSoonChannel name={activeChannelTab} />
                        )}
                    </motion.div>
                </AnimatePresence>
            </SectionCard>

            {/* Campaign Detail Drawer */}
            <AnimatePresence>
                {drawerCamp && (
                    <CampaignDrawer key={drawerCamp.campaign_id} camp={drawerCamp} days={periodDays} onClose={() => setDrawerCamp(null)} />
                )}
            </AnimatePresence>
        </div>
    )
}

// ── Campaigns Table (extracted for reuse in tabs) ─────────────────────────────

function CampaignsTable({ campaigns, days, onOpenDrawer, loading }: { campaigns: any[]; days: number; onOpenDrawer: (c: any) => void; loading: boolean }) {
    return (
        <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <SectionLabel gutterBottom={0}>Campanhas ({campaigns.length})</SectionLabel>
            </div>
            {loading ? (
                <SkeletonTable rows={5} columns={9} />
            ) : campaigns.length === 0 ? (
                <p style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-base)', color: 'var(--color-text-tertiary)' }}>Nenhuma campanha encontrada no período.</p>
            ) : (
                <>
                    <div style={{ display: 'grid', gridTemplateColumns: CAMP_GRID, gap: '0 12px', paddingBottom: 10, borderBottom: '1px solid var(--color-border)', marginBottom: 2 }}>
                        <TH>Campanha</TH>
                        <TH>Status</TH>
                        <TH align="right">Resultados</TH>
                        <TH align="right">Custo/Res.</TH>
                        <TH align="right">ROAS</TH>
                        <TH align="right">Gasto</TH>
                        <TH align="right">Receita Atr.</TH>
                        <TH align="right">Impressões</TH>
                        <TH align="right">CTR</TH>
                    </div>
                    {campaigns.map(camp => (
                        <CampaignRow key={camp.campaign_id} camp={camp} days={days} onOpenDrawer={onOpenDrawer} />
                    ))}
                </>
            )}
        </div>
    )
}
