import { motion } from 'framer-motion'
import { KpiCard } from '../components/KpiCard'
import TopBar from '../components/TopBar'

// ── Types & Mock Data ────────────────────────────────────────────────────────

interface ChannelPerformance {
    name: string
    spend: number
    revenue: number
    roas: number
    cac: number
    customers: number
    ltv: number
}

const CHANNELS_DATA: ChannelPerformance[] = [
    { name: 'Google Ads', spend: 45200, revenue: 162720, roas: 3.6, cac: 185, customers: 244, ltv: 1250 },
    { name: 'Meta Ads', spend: 38400, revenue: 107520, roas: 2.8, cac: 92, customers: 417, ltv: 310 },
    { name: 'Google Orgânico', spend: 0, revenue: 42300, roas: 0, cac: 0, customers: 112, ltv: 1100 },
    { name: 'Email', spend: 1200, revenue: 38500, roas: 32.1, cac: 15, customers: 80, ltv: 1450 },
    { name: 'Direto', spend: 0, revenue: 29800, roas: 0, cac: 0, customers: 65, ltv: 950 },
]

interface ActiveCampaign {
    id: string
    name: string
    platform: 'Meta' | 'Google'
    spendToday: number
    roasToday: number
    status: 'Ativo' | 'Pausado'
}

const ACTIVE_CAMPAIGNS: ActiveCampaign[] = [
    { id: '1', name: 'Pro Plan - Middle Funnel', platform: 'Meta', spendToday: 450.20, roasToday: 4.2, status: 'Ativo' },
    { id: '2', name: 'Search - Brand Keywords brasil', platform: 'Google', spendToday: 120.45, roasToday: 8.5, status: 'Ativo' },
    { id: '3', name: 'Retargeting - All Visitors', platform: 'Meta', spendToday: 85.00, roasToday: 2.1, status: 'Ativo' },
    { id: '4', name: 'Competitor Conquesting', platform: 'Google', spendToday: 310.00, roasToday: 1.4, status: 'Pausado' },
    { id: '5', name: 'Scaling - High LTV Lookalike', platform: 'Meta', spendToday: 680.00, roasToday: 3.8, status: 'Ativo' },
    { id: '6', name: 'Performance Max - Sales', platform: 'Google', spendToday: 215.30, roasToday: 5.1, status: 'Ativo' },
]

// ── Shared Primitives ────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
    return (
        <p style={{
            fontFamily: "'Geist Mono', 'Courier New', monospace",
            fontSize: 11, color: 'rgba(var(--fg-rgb), 0.4)',
            letterSpacing: '0.08em', marginBottom: 20,
            textTransform: 'uppercase',
            fontWeight: 500
        }}>
            {children}
        </p>
    )
}

function TH({ children, align = 'left' }: { children: React.ReactNode; align?: 'left' | 'right' }) {
    return (
        <span style={{
            fontFamily: "'Geist Mono', monospace",
            fontSize: 11, color: 'rgba(var(--fg-rgb), 0.45)',
            letterSpacing: '0.04em', textAlign: align,
            fontWeight: 500
        }}>
            {children}
        </span>
    )
}

function fmtBR(v: number) {
    return new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 }).format(v)
}

// ── Premium Line Chart Component ──────────────────────────────────────────────
function ChannelSparkline({ data, height = 40, id = 'default' }: { data: number[], height?: number, id?: string }) {
    const max = Math.max(...data)
    const min = Math.min(...data)
    const range = (max - min) || 1
    const padding = range * 0.15
    const effectiveMax = max + padding
    const effectiveMin = min - padding
    const effectiveRange = effectiveMax - effectiveMin

    const points = data.map((v, i) => ({
        x: (i / (data.length - 1)) * 100,
        y: 100 - ((v - effectiveMin) / effectiveRange) * 100
    }))

    // Generate smooth cubic bezier curve
    let pathData = `M ${points[0].x},${points[0].y}`
    for (let i = 0; i < points.length - 1; i++) {
        const p0 = points[i]
        const p1 = points[i + 1]
        const cp1x = p0.x + (p1.x - p0.x) / 3
        const cp2x = p0.x + 2 * (p1.x - p0.x) / 3
        pathData += ` C ${cp1x},${p0.y} ${cp2x},${p1.y} ${p1.x},${p1.y}`
    }

    const fillData = `${pathData} L 100,100 L 0,100 Z`
    const gradId = `chart-grad-${id.replace(/\s+/g, '-').toLowerCase()}`

    const lastPoint = points[points.length - 1]

    return (
        <div style={{ width: '100%', height, position: 'relative' }}>
            <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ width: '100%', height: '100%', display: 'block', overflow: 'visible' }}>
                <defs>
                    <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" style={{ stopColor: 'rgba(var(--fg-rgb), 0.12)' }} />
                        <stop offset="100%" style={{ stopColor: 'rgba(var(--fg-rgb), 0)' }} />
                    </linearGradient>
                </defs>
                <path d={fillData} fill={`url(#${gradId})`} />
                <motion.path
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{ duration: 1.5, ease: "easeOut" }}
                    d={pathData}
                    fill="none"
                    style={{ stroke: 'var(--fg)' }}
                    strokeWidth={1.5}
                    vectorEffect="non-scaling-stroke"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                />
            </svg>
            {/* Endpoint dot fora do SVG para não ser deformado pelo preserveAspectRatio="none" */}
            <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 1.2, duration: 0.3 }}
                style={{
                    position: 'absolute',
                    left: `${lastPoint.x}%`,
                    top: `${lastPoint.y}%`,
                    width: 7,
                    height: 7,
                    borderRadius: '50%',
                    background: 'var(--inv)',
                    transform: 'translate(-50%, -50%)',
                }}
            />
        </div>
    )
}

// ── Main Page Component ─────────────────────────────────────────────────────

export default function Canais({ onToggleChat }: { onToggleChat?: () => void }) {
    return (
        <div style={{ paddingTop: 28, paddingBottom: 80 }}>
            <TopBar onToggleChat={onToggleChat} />

            <motion.h1
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, ease: [0.25, 0.1, 0.25, 1] }}
                style={{
                    fontFamily: "'Poppins', sans-serif",
                    fontWeight: 400, fontSize: 40,
                    letterSpacing: '-1.6px', color: 'var(--fg)',
                    lineHeight: 1, margin: 0,
                }}
            >
                Canais
            </motion.h1>

            {/* Top KPIs */}
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.3, delay: 0.1 }}
                style={{ display: 'flex', gap: 48, alignItems: 'center', flexWrap: 'wrap', marginTop: 48 }}
            >
                <KpiCard label="GASTO TOTAL ADS" value={84800} prefix="R$ " decimals={0} delay={0.15} />
                <KpiCard label="RECEITA ATRIBUÍDA" value={380840} prefix="R$ " decimals={0} delay={0.25} />
                <KpiCard label="ROAS MÉDIO" value={4.49} suffix="x" decimals={2} delay={0.35} />
                <KpiCard label="CAC MÉDIO" value={101.5} prefix="R$ " decimals={1} delay={0.45} />
                <KpiCard label="CANAIS ATIVOS" value={5} decimals={0} delay={0.55} />
            </motion.div>

            {/* Block 1: Performance Table */}
            <div style={{ marginTop: 80 }}>
                <SectionLabel>PERFORMANCE POR CANAL</SectionLabel>

                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'minmax(180px, 1fr) 100px 120px 100px 100px 100px 120px',
                    gap: '0 24px',
                    paddingBottom: 16,
                    borderBottom: '1px solid rgba(var(--fg-rgb), 0.1)',
                    marginBottom: 4,
                    paddingLeft: 12,
                    paddingRight: 12,
                }}>
                    <TH>CANAL</TH>
                    <TH align="right">GASTO</TH>
                    <TH align="right">RECEITA ATR.</TH>
                    <TH align="right">ROAS</TH>
                    <TH align="right">CAC</TH>
                    <TH align="right">CLIENTES</TH>
                    <TH align="right">LTV MÉDIO</TH>
                </div>

                {CHANNELS_DATA.map((ch, i) => (
                    <motion.div
                        key={ch.name}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.4, delay: i * 0.04 + 0.2 }}
                        whileHover={{ backgroundColor: 'rgba(var(--fg-rgb), 0.02)', x: 4 }}
                        style={{
                            display: 'grid',
                            gridTemplateColumns: 'minmax(180px, 1fr) 100px 120px 100px 100px 100px 120px',
                            gap: '0 24px',
                            alignItems: 'center',
                            padding: '20px 12px',
                            borderBottom: '1px solid rgba(var(--fg-rgb), 0.05)',
                            borderRadius: 6,
                            cursor: 'default',
                            transition: 'all 0.2s ease',
                        }}
                    >
                        <span style={{ fontFamily: "'Poppins', sans-serif", fontSize: 14, letterSpacing: '-0.3px', color: 'var(--fg)', fontWeight: 500 }}>
                            {ch.name}
                        </span>
                        <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: 13, color: ch.spend > 0 ? 'var(--fg)' : 'rgba(var(--fg-rgb), 0.3)', textAlign: 'right' }}>
                            {ch.spend > 0 ? `R$ ${fmtBR(ch.spend)}` : '—'}
                        </span>
                        <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: 13, color: 'var(--fg)', textAlign: 'right', fontWeight: 500 }}>
                            R$ {fmtBR(ch.revenue)}
                        </span>
                        <span style={{
                            fontFamily: "'Geist Mono', monospace",
                            fontSize: 13,
                            color: ch.roas >= 3 ? 'var(--fg)' : ch.roas > 0 ? 'rgba(var(--fg-rgb), 0.6)' : 'rgba(var(--fg-rgb), 0.2)',
                            textAlign: 'right',
                            fontWeight: ch.roas >= 3 ? 600 : 400
                        }}>
                            {ch.roas > 0 ? `${ch.roas.toFixed(1)}x` : '—'}
                        </span>
                        <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: 13, color: 'rgba(var(--fg-rgb), 0.5)', textAlign: 'right' }}>
                            {ch.cac > 0 ? `R$ ${fmtBR(ch.cac)}` : '—'}
                        </span>
                        <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: 13, color: 'var(--fg)', textAlign: 'right' }}>
                            {ch.customers}
                        </span>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                            <span style={{
                                fontFamily: "'Geist Mono', monospace",
                                fontSize: 14,
                                color: ch.ltv >= 1000 ? 'var(--fg)' : 'rgba(var(--fg-rgb), 0.6)',
                                textAlign: 'right',
                                fontWeight: ch.ltv >= 1000 ? 500 : 400
                            }}>
                                R$ {fmtBR(ch.ltv)}
                            </span>
                            {ch.ltv > 1000 && (
                                <span style={{ fontSize: 9, color: 'rgba(var(--fg-rgb), 0.3)', fontWeight: 600, marginTop: 2 }}>HIGH VALUE</span>
                            )}
                        </div>
                    </motion.div>
                ))}
            </div>

            {/* Block 2: Charts Lado a Lado */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 64, marginTop: 80 }}>
                <div>
                    <SectionLabel>ROAS POR CANAL AO LONGO DO TEMPO</SectionLabel>
                    <div style={{
                        background: 'var(--surface)',
                        border: '1px solid rgba(var(--fg-rgb), 0.06)',
                        borderRadius: 12,
                        padding: 32,
                        boxShadow: '0 4px 20px rgba(0,0,0,0.02)'
                    }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                            {[
                                { name: 'GOOGLE', data: [2.1, 2.3, 2.8, 2.5, 2.9, 3.2, 3.1, 3.4, 3.6, 3.8], val: '3.8x', strong: true },
                                { name: 'META ADS', data: [4.2, 4.0, 3.8, 3.9, 3.5, 3.2, 3.0, 2.8, 2.7, 2.5], val: '2.5x', strong: false },
                                { name: 'EMAIL', data: [12, 14, 15, 18, 22, 25, 28, 31, 32, 30], val: '30x', strong: true }
                            ].map((item) => (
                                <div key={item.name} style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
                                    <span style={{ fontSize: 11, fontFamily: "'Geist Mono', monospace", width: 70, color: 'rgba(var(--fg-rgb), 0.4)', fontWeight: 500 }}>{item.name}</span>
                                    <div style={{ flex: 1 }}>
                                        <ChannelSparkline data={item.data} id={`roas-${item.name}`} />
                                    </div>
                                    <span style={{
                                        fontSize: 16,
                                        fontFamily: "'Poppins', sans-serif",
                                        fontWeight: 500,
                                        width: 50,
                                        textAlign: 'right',
                                        color: item.strong ? 'var(--fg)' : 'rgba(var(--fg-rgb), 0.3)'
                                    }}>
                                        {item.val}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                <div>
                    <SectionLabel>CAC POR CANAL AO LONGO DO TEMPO</SectionLabel>
                    <div style={{
                        background: 'var(--surface)',
                        border: '1px solid rgba(var(--fg-rgb), 0.06)',
                        borderRadius: 12,
                        padding: 32,
                        boxShadow: '0 4px 20px rgba(0,0,0,0.02)'
                    }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                            {[
                                { name: 'GOOGLE', data: [210, 208, 205, 202, 198, 195, 200, 190, 185, 182], val: 'R$ 182', strong: true },
                                { name: 'META ADS', data: [65, 68, 72, 75, 80, 85, 88, 90, 92, 110], val: 'R$ 110', strong: false, color: 'rgba(var(--fg-rgb), 0.3)' },
                                { name: 'EMAIL', data: [20, 19, 18, 17, 15, 16, 14, 15, 15, 16], val: 'R$ 16', strong: true }
                            ].map((item) => (
                                <div key={item.name} style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
                                    <span style={{ fontSize: 11, fontFamily: "'Geist Mono', monospace", width: 70, color: 'rgba(var(--fg-rgb), 0.4)', fontWeight: 500 }}>{item.name}</span>
                                    <div style={{ flex: 1 }}>
                                        <ChannelSparkline data={item.data} id={`cac-${item.name}`} />
                                    </div>
                                    <span style={{
                                        fontSize: 16,
                                        fontFamily: "'Poppins', sans-serif",
                                        fontWeight: 500,
                                        width: 80,
                                        textAlign: 'right',
                                        color: item.strong ? 'var(--fg)' : 'rgba(var(--fg-rgb), 0.3)'
                                    }}>
                                        {item.val}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* Block 3: Campanhas Ativas */}
            <div style={{ marginTop: 100 }}>
                <SectionLabel>CAMPANHAS ATIVAS</SectionLabel>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 32 }}>
                    {ACTIVE_CAMPAIGNS.map((camp, i) => (
                        <motion.div
                            key={camp.id}
                            initial={{ opacity: 0, scale: 0.98 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ duration: 0.4, delay: i * 0.08 + 0.4 }}
                            whileHover={{ y: -6, boxShadow: '0 12px 30px rgba(0,0,0,0.05)', borderColor: 'rgba(var(--fg-rgb), 0.15)' }}
                            style={{
                                padding: 32,
                                borderRadius: 16,
                                background: 'var(--surface-glass)',
                                backdropFilter: 'blur(8px)',
                                border: '1px solid rgba(var(--fg-rgb), 0.06)',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: 24,
                                transition: 'border-color 0.2s ease, box-shadow 0.2s ease'
                            }}
                        >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                <div>
                                    <span style={{
                                        fontSize: 10,
                                        fontFamily: "'Geist Mono', monospace",
                                        color: 'rgba(var(--fg-rgb), 0.4)',
                                        textTransform: 'uppercase',
                                        fontWeight: 500,
                                        letterSpacing: '0.04em'
                                    }}>
                                        {camp.platform}
                                    </span>
                                    <h3 style={{
                                        fontFamily: "'Poppins', sans-serif",
                                        fontSize: 18,
                                        fontWeight: 500,
                                        margin: '6px 0 0',
                                        color: 'var(--fg)',
                                        letterSpacing: '-0.4px'
                                    }}>
                                        {camp.name}
                                    </h3>
                                </div>
                                <div style={{
                                    padding: '4px 10px',
                                    borderRadius: 100,
                                    fontSize: 9,
                                    fontWeight: 700,
                                    textTransform: 'uppercase',
                                    background: camp.status === 'Ativo' ? 'var(--inv)' : 'rgba(var(--fg-rgb), 0.05)',
                                    color: camp.status === 'Ativo' ? 'var(--on-inv)' : 'rgba(var(--fg-rgb), 0.3)',
                                    letterSpacing: '0.05em'
                                }}>
                                    {camp.status}
                                </div>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, paddingTop: 8, borderTop: '1px solid rgba(var(--fg-rgb), 0.04)' }}>
                                <div>
                                    <p style={{ fontSize: 10, fontFamily: "'Geist Mono', monospace", color: 'rgba(var(--fg-rgb), 0.4)', margin: 0, textTransform: 'uppercase', fontWeight: 600 }}>Gasto Hoje</p>
                                    <p style={{ fontSize: 20, fontFamily: "'Poppins', sans-serif", fontWeight: 500, margin: '4px 0 0' }}>R$ {camp.spendToday.toFixed(2)}</p>
                                </div>
                                <div>
                                    <p style={{ fontSize: 10, fontFamily: "'Geist Mono', monospace", color: 'rgba(var(--fg-rgb), 0.4)', margin: 0, textTransform: 'uppercase', fontWeight: 600 }}>ROAS Atual</p>
                                    <p style={{
                                        fontSize: 20,
                                        fontFamily: "'Poppins', sans-serif",
                                        fontWeight: 600,
                                        margin: '4px 0 0',
                                        color: camp.roasToday > 3 ? 'var(--fg)' : '#E53E3E'
                                    }}>
                                        {camp.roasToday}x
                                    </p>
                                </div>
                            </div>
                        </motion.div>
                    ))}
                </div>
            </div>
        </div>
    )
}
