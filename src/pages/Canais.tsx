import { useState } from 'react'
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
]

// ── Shared Primitives ────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
    return (
        <p style={{
            fontFamily: "'Geist Mono', monospace",
            fontSize: 11, color: 'rgba(30,30,30,0.4)',
            letterSpacing: '0.08em', marginBottom: 20,
            textTransform: 'uppercase'
        }}>
            {children}
        </p>
    )
}

function TH({ children, align = 'left' }: { children: React.ReactNode; align?: 'left' | 'right' }) {
    return (
        <span style={{
            fontFamily: "'Geist Mono', monospace",
            fontSize: 11, color: 'rgba(30,30,30,0.45)',
            letterSpacing: '0.04em', textAlign: align,
        }}>
            {children}
        </span>
    )
}

function fmtBR(v: number) {
    return new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 }).format(v)
}

// ── Simple Line Chart Component ──────────────────────────────────────────────
function MiniSparkline({ data, color = '#1E1E1E' }: { data: number[], color?: string }) {
    const max = Math.max(...data)
    const min = Math.min(...data)
    const range = max - min || 1
    const points = data.map((v, i) => ({
        x: (i / (data.length - 1)) * 100,
        y: 100 - ((v - min) / range) * 100
    }))

    const path = `M ${points[0].x},${points[0].y} ` + points.slice(1).map(p => `L ${p.x},${p.y}`).join(' ')

    return (
        <svg viewBox="0 0 100 100" style={{ width: 80, height: 30, overflow: 'visible' }}>
            <path d={path} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        </svg>
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
                    letterSpacing: '-1.6px', color: '#1E1E1E',
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
                    gridTemplateColumns: '1fr 90px 110px 80px 80px 90px 100px',
                    gap: '0 24px',
                    paddingBottom: 12,
                    borderBottom: '1px solid rgba(30,30,30,0.1)',
                    marginBottom: 4,
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
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3, delay: i * 0.05 + 0.2 }}
                        style={{
                            display: 'grid',
                            gridTemplateColumns: '1fr 90px 110px 80px 80px 90px 100px',
                            gap: '0 24px',
                            alignItems: 'center',
                            padding: '16px 0',
                            borderBottom: '1px solid rgba(30,30,30,0.055)',
                        }}
                    >
                        <span style={{ fontFamily: "'Poppins', sans-serif", fontSize: 13, letterSpacing: '-0.3px', color: '#1E1E1E', fontWeight: 500 }}>
                            {ch.name}
                        </span>
                        <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: 13, color: ch.spend > 0 ? '#1E1E1E' : 'rgba(30,30,30,0.35)', textAlign: 'right' }}>
                            {ch.spend > 0 ? `R$ ${fmtBR(ch.spend)}` : '—'}
                        </span>
                        <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: 13, color: '#1E1E1E', textAlign: 'right' }}>
                            R$ {fmtBR(ch.revenue)}
                        </span>
                        <span style={{
                            fontFamily: "'Geist Mono', monospace",
                            fontSize: 13,
                            color: ch.roas >= 3 ? '#1E1E1E' : ch.roas > 0 ? 'rgba(30,30,30,0.6)' : 'rgba(30,30,30,0.3)',
                            textAlign: 'right',
                            fontWeight: ch.roas >= 3 ? 500 : 400
                        }}>
                            {ch.roas > 0 ? `${ch.roas.toFixed(1)}x` : '—'}
                        </span>
                        <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: 13, color: 'rgba(30,30,30,0.65)', textAlign: 'right' }}>
                            {ch.cac > 0 ? `R$ ${fmtBR(ch.cac)}` : '—'}
                        </span>
                        <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: 13, color: '#1E1E1E', textAlign: 'right' }}>
                            {ch.customers}
                        </span>
                        <span style={{
                            fontFamily: "'Geist Mono', monospace",
                            fontSize: 13,
                            color: ch.ltv >= 1000 ? '#1E1E1E' : 'rgba(30,30,30,0.65)',
                            textAlign: 'right',
                            fontWeight: ch.ltv >= 1000 ? 500 : 400
                        }}>
                            R$ {fmtBR(ch.ltv)}
                        </span>
                    </motion.div>
                ))}
            </div>

            {/* Block 2: Charts Lado a Lado */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 64, marginTop: 80 }}>
                <div>
                    <SectionLabel>ROAS POR CANAL AO LONGO DO TEMPO</SectionLabel>
                    <div style={{ height: 200, display: 'flex', alignItems: 'flex-end', gap: 24, padding: '20px 0', borderBottom: '1px solid rgba(30,30,30,0.08)' }}>
                        {/* Simplified Visual Representation */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, width: '100%' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                <span style={{ fontSize: 11, fontFamily: "'Geist Mono', monospace", width: 80, color: 'rgba(30,30,30,0.4)' }}>GOOGLE</span>
                                <MiniSparkline data={[2.1, 2.5, 3.2, 3.1, 3.6, 3.8]} color="#1E1E1E" />
                                <span style={{ fontSize: 12, fontWeight: 500 }}>3.8x</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                <span style={{ fontSize: 11, fontFamily: "'Geist Mono', monospace", width: 80, color: 'rgba(30,30,30,0.4)' }}>META ADS</span>
                                <MiniSparkline data={[4.2, 3.8, 3.5, 3.0, 2.8, 2.5]} color="rgba(30,30,30,0.3)" />
                                <span style={{ fontSize: 12, color: 'rgba(30,30,30,0.4)' }}>2.5x</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                <span style={{ fontSize: 11, fontFamily: "'Geist Mono', monospace", width: 80, color: 'rgba(30,30,30,0.4)' }}>EMAIL</span>
                                <MiniSparkline data={[12, 15, 22, 28, 32, 30]} color="#1E1E1E" />
                                <span style={{ fontSize: 12, fontWeight: 500 }}>30x</span>
                            </div>
                        </div>
                    </div>
                </div>

                <div>
                    <SectionLabel>CAC POR CANAL AO LONGO DO TEMPO</SectionLabel>
                    <div style={{ height: 200, display: 'flex', alignItems: 'flex-end', gap: 24, padding: '20px 0', borderBottom: '1px solid rgba(30,30,30,0.08)' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, width: '100%' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                <span style={{ fontSize: 11, fontFamily: "'Geist Mono', monospace", width: 80, color: 'rgba(30,30,30,0.4)' }}>GOOGLE</span>
                                <MiniSparkline data={[210, 205, 198, 200, 185, 182]} color="#1E1E1E" />
                                <span style={{ fontSize: 12, fontWeight: 500 }}>R$ 182</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                <span style={{ fontSize: 11, fontFamily: "'Geist Mono', monospace", width: 80, color: 'rgba(30,30,30,0.4)' }}>META ADS</span>
                                <MiniSparkline data={[65, 72, 80, 88, 92, 110]} color="rgba(30,30,30,0.3)" />
                                <span style={{ fontSize: 12, color: 'rgba(30,30,30,0.4)' }}>R$ 110</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                <span style={{ fontSize: 11, fontFamily: "'Geist Mono', monospace", width: 80, color: 'rgba(30,30,30,0.4)' }}>EMAIL</span>
                                <MiniSparkline data={[20, 18, 15, 14, 15, 16]} color="#1E1E1E" />
                                <span style={{ fontSize: 12, fontWeight: 500 }}>R$ 16</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Block 3: Campanhas Ativas */}
            <div style={{ marginTop: 80 }}>
                <SectionLabel>CAMPANHAS ATIVAS (ADS MANAGER LITE)</SectionLabel>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 24 }}>
                    {ACTIVE_CAMPAIGNS.map((camp, i) => (
                        <motion.div
                            key={camp.id}
                            initial={{ opacity: 0, y: 12 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.4, delay: i * 0.1 + 0.5 }}
                            style={{
                                padding: 24,
                                borderRadius: 8,
                                background: '#FFF',
                                border: '1px solid rgba(30,30,30,0.08)',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: 16
                            }}
                        >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                <div>
                                    <span style={{ fontSize: 10, fontFamily: "'Geist Mono', monospace", color: 'rgba(30,30,30,0.4)', textTransform: 'uppercase' }}>{camp.platform}</span>
                                    <h3 style={{ fontFamily: "'Poppins', sans-serif", fontSize: 15, fontWeight: 500, margin: '4px 0 0', color: '#1E1E1E' }}>{camp.name}</h3>
                                </div>
                                <span style={{
                                    padding: '3px 7px',
                                    borderRadius: 3,
                                    fontSize: 9,
                                    fontWeight: 600,
                                    textTransform: 'uppercase',
                                    background: camp.status === 'Ativo' ? 'rgba(30,30,30,0.06)' : 'transparent',
                                    border: camp.status === 'Ativo' ? 'none' : '1px solid rgba(30,30,30,0.1)',
                                    color: camp.status === 'Ativo' ? '#1E1E1E' : 'rgba(30,30,30,0.3)'
                                }}>
                                    {camp.status}
                                </span>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                                <div>
                                    <p style={{ fontSize: 10, color: 'rgba(30,30,30,0.4)', margin: 0, textTransform: 'uppercase' }}>Gasto Hoje</p>
                                    <p style={{ fontSize: 16, fontWeight: 500, margin: '2px 0 0' }}>R$ {camp.spendToday.toFixed(2)}</p>
                                </div>
                                <div>
                                    <p style={{ fontSize: 10, color: 'rgba(30,30,30,0.4)', margin: 0, textTransform: 'uppercase' }}>ROAS Atual</p>
                                    <p style={{ fontSize: 16, fontWeight: 500, margin: '2px 0 0', color: camp.roasToday > 3 ? '#1E1E1E' : '#E53E3E' }}>{camp.roasToday}x</p>
                                </div>
                            </div>
                        </motion.div>
                    ))}
                </div>
            </div>
        </div>
    )
}
