import { motion, AnimatePresence } from 'framer-motion'
import { KpiCard } from '../components/ui/KpiCard'
import TopBar from '../components/layout/TopBar'
import { useState, useEffect, useMemo, useRef } from 'react'
import { dashboardApi } from '../lib/api'
import { fmtBR } from '../lib/utils'
import DateRangePicker, { type DateRange } from '../components/ui/DateRangePicker'

// ── Mock data ────────────────────────────────────────────────────────────────────

const MOCK_CAMPAIGNS = [
  {
    campaign_id: 'meta_1', campaign_name: 'ESCRITA-MEMÓRIAS | Conversão | Broad', platform: 'meta',
    status: 'ACTIVE', objective: 'OUTCOME_SALES', account_name: 'Conta Northie Demo',
    spend_brl: 3240, purchase_value: 9870, purchases: 27, leads: 0,
    impressions: 184200, clicks: 2940, landing_page_views: 1820, roas: 3.05,
    cac: 120, ctr: 1.60, reach: 92400, frequency: 2.0, cpm_brl: 17.6, cpc_brl: 1.10,
    link_clicks: 2740, video_views: 0,
  },
  {
    campaign_id: 'meta_2', campaign_name: 'ESCRITA-MEMÓRIAS | Retargeting | Visitantes 30d', platform: 'meta',
    status: 'ACTIVE', objective: 'OUTCOME_SALES', account_name: 'Conta Northie Demo',
    spend_brl: 890, purchase_value: 3560, purchases: 11, leads: 0,
    impressions: 42100, clicks: 1240, landing_page_views: 980, roas: 4.00,
    cac: 80.9, ctr: 2.95, reach: 18700, frequency: 2.25, cpm_brl: 21.1, cpc_brl: 0.72,
    link_clicks: 1180, video_views: 0,
  },
  {
    campaign_id: 'meta_3', campaign_name: 'ESCRITA-MEMÓRIAS | Leads | Lookalike 3%', platform: 'meta',
    status: 'PAUSED', objective: 'OUTCOME_LEADS', account_name: 'Conta Northie Demo',
    spend_brl: 520, purchase_value: 0, purchases: 0, leads: 94,
    impressions: 61800, clicks: 680, landing_page_views: 490, roas: 0,
    cac: 0, ctr: 1.10, reach: 34200, frequency: 1.81, cpm_brl: 8.4, cpc_brl: 0.76,
    link_clicks: 640, video_views: 0,
  },
  {
    campaign_id: 'meta_4', campaign_name: 'LANÇAMENTO JAN | Conversão | Interesses frios', platform: 'meta',
    status: 'ARCHIVED', objective: 'OUTCOME_SALES', account_name: 'Conta Northie Demo',
    spend_brl: 1640, purchase_value: 2460, purchases: 7, leads: 0,
    impressions: 98400, clicks: 1180, landing_page_views: 740, roas: 1.50,
    cac: 234.3, ctr: 1.20, reach: 61200, frequency: 1.61, cpm_brl: 16.7, cpc_brl: 1.39,
    link_clicks: 1080, video_views: 0,
  },
  {
    campaign_id: 'google_1', campaign_name: 'Escrita de Memórias | Search | Branded', platform: 'google',
    status: 'ACTIVE', objective: 'CONVERSIONS', account_name: 'Google Ads Demo',
    spend_brl: 740, purchase_value: 2960, purchases: 8, leads: 0,
    impressions: 9200, clicks: 820, landing_page_views: 680, roas: 4.00,
    cac: 92.5, ctr: 8.91, reach: 0, frequency: 0, cpm_brl: 80.4, cpc_brl: 0.90,
    link_clicks: 820, video_views: 0,
  },
  {
    campaign_id: 'google_2', campaign_name: 'Escrita de Memórias | Search | Genérico', platform: 'google',
    status: 'ACTIVE', objective: 'CONVERSIONS', account_name: 'Google Ads Demo',
    spend_brl: 1280, purchase_value: 2560, purchases: 7, leads: 0,
    impressions: 28400, clicks: 1640, landing_page_views: 1240, roas: 2.00,
    cac: 182.9, ctr: 5.77, reach: 0, frequency: 0, cpm_brl: 45.1, cpc_brl: 0.78,
    link_clicks: 1640, video_views: 0,
  },
]

const MOCK_TRENDS: Record<string, { roas: number[]; cac: number[] }> = {
  meta: {
    roas: [2.4, 2.8, 3.1, 2.9, 3.4, 3.2, 2.7, 3.8, 4.1, 3.6, 3.3, 2.9, 3.5, 3.7, 3.9],
    cac:  [140, 125, 112, 118, 98,  105, 132, 88,  82,  95,  103, 120, 92,  88,  84],
  },
  google: {
    roas: [3.2, 3.5, 3.8, 3.1, 4.0, 3.7, 3.3, 4.2, 3.9, 4.4, 3.8, 4.1, 3.5, 4.0, 4.2],
    cac:  [110, 98,  92,  108, 84,  90,  102, 78,  88,  75,  86,  81,  94,  82,  79],
  },
}

const MOCK_CREATIVES = [
  {
    ad_id: 'cr_1', campaign_id: 'meta_1',
    ad_name: 'Depoimento — "Escrevi a história da minha família"',
    campaign_name: 'ESCRITA-MEMÓRIAS | Conversão | Broad',
    status: 'ACTIVE', creative_type: 'video' as const,
    thumbnail_url: 'https://picsum.photos/seed/northie_cr1/480/360',
    video_url: 'https://www.w3schools.com/html/mov_bbb.mp4',
    spend_brl: 1640, impressions: 91200, clicks: 1480, link_clicks: 1480,
    ctr: 1.62, cpc_brl: 1.11, cpm_brl: 17.98, roas: 3.41, purchases: 16, leads: 0, reach: 48300, frequency: 1.89,
  },
  {
    ad_id: 'cr_2', campaign_id: 'meta_2',
    ad_name: 'Processo Criativo — Bastidores do livro | 30s',
    campaign_name: 'ESCRITA-MEMÓRIAS | Retargeting | Visitantes 30d',
    status: 'ACTIVE', creative_type: 'video' as const,
    thumbnail_url: 'https://picsum.photos/seed/northie_cr2/480/360',
    video_url: 'https://www.w3schools.com/html/mov_bbb.mp4',
    spend_brl: 890, impressions: 42100, clicks: 1180, link_clicks: 1180,
    ctr: 2.80, cpc_brl: 0.75, cpm_brl: 21.14, roas: 4.00, purchases: 11, leads: 0, reach: 18700, frequency: 2.25,
  },
  {
    ad_id: 'cr_3', campaign_id: 'meta_1',
    ad_name: 'Capa do Livro — Produto físico | Estático',
    campaign_name: 'ESCRITA-MEMÓRIAS | Conversão | Broad',
    status: 'ACTIVE', creative_type: 'image' as const,
    thumbnail_url: 'https://picsum.photos/seed/northie_cr3/480/360',
    video_url: null,
    spend_brl: 980, impressions: 53800, clicks: 820, link_clicks: 820,
    ctr: 1.52, cpc_brl: 1.20, cpm_brl: 18.21, roas: 2.81, purchases: 9, leads: 0, reach: 28100, frequency: 1.91,
  },
  {
    ad_id: 'cr_4', campaign_id: 'meta_3',
    ad_name: 'Formulário Lead — "Guia gratuito: como preservar sua história"',
    campaign_name: 'ESCRITA-MEMÓRIAS | Leads | Lookalike 3%',
    status: 'PAUSED', creative_type: 'image' as const,
    thumbnail_url: 'https://picsum.photos/seed/northie_cr4/480/360',
    video_url: null,
    spend_brl: 520, impressions: 61800, clicks: 680, link_clicks: 640,
    ctr: 1.10, cpc_brl: 0.77, cpm_brl: 8.41, roas: 0, purchases: 0, leads: 94, reach: 34200, frequency: 1.81,
  },
  {
    ad_id: 'cr_5', campaign_id: 'meta_4',
    ad_name: 'Carrossel — 5 motivos para preservar sua história',
    campaign_name: 'LANÇAMENTO JAN | Conversão | Interesses frios',
    status: 'ARCHIVED', creative_type: 'carousel' as const,
    thumbnail_url: 'https://picsum.photos/seed/northie_cr5/480/360',
    video_url: null,
    spend_brl: 1640, impressions: 98400, clicks: 1180, link_clicks: 1080,
    ctr: 1.20, cpc_brl: 1.39, cpm_brl: 16.67, roas: 1.50, purchases: 7, leads: 0, reach: 61200, frequency: 1.61,
  },
  {
    ad_id: 'cr_6', campaign_id: 'meta_1',
    ad_name: 'UGC — Cliente mostrando o livro finalizado | 20s',
    campaign_name: 'ESCRITA-MEMÓRIAS | Conversão | Broad',
    status: 'ACTIVE', creative_type: 'video' as const,
    thumbnail_url: 'https://picsum.photos/seed/northie_cr6/480/360',
    video_url: 'https://www.w3schools.com/html/mov_bbb.mp4',
    spend_brl: 620, impressions: 41600, clicks: 760, link_clicks: 760,
    ctr: 1.83, cpc_brl: 0.82, cpm_brl: 14.90, roas: 2.20, purchases: 5, leads: 0, reach: 22800, frequency: 1.82,
  },
]

const MOCK_KEYWORDS = [
  { keyword: 'escrita de memórias', campaign: 'Search | Branded', match: 'Exata' as const,  impressions: 4200,  clicks: 380, ctr: 9.05, cpc_brl: 0.82, conversions: 4, cpa_brl: 77.5,  quality_score: 9, impression_share: 82 },
  { keyword: 'livro de memórias família', campaign: 'Search | Branded', match: 'Exata' as const,  impressions: 1800,  clicks: 190, ctr: 10.56, cpc_brl: 0.75, conversions: 3, cpa_brl: 47.5,  quality_score: 9, impression_share: 74 },
  { keyword: 'como escrever história da família', campaign: 'Search | Genérico', match: 'Frase' as const,  impressions: 8400,  clicks: 420, ctr: 5.00, cpc_brl: 0.68, conversions: 2, cpa_brl: 143.0, quality_score: 7, impression_share: 54 },
  { keyword: 'memórias da família', campaign: 'Search | Genérico', match: 'Ampla' as const,  impressions: 12600, clicks: 680, ctr: 5.40, cpc_brl: 0.80, conversions: 3, cpa_brl: 181.3, quality_score: 6, impression_share: 41 },
  { keyword: 'autobiografia familiar personalizada', campaign: 'Search | Genérico', match: 'Frase' as const,  impressions: 3200,  clicks: 148, ctr: 4.63, cpc_brl: 0.90, conversions: 1, cpa_brl: 133.2, quality_score: 7, impression_share: 48 },
  { keyword: 'preservar histórias da família', campaign: 'Search | Genérico', match: 'Ampla' as const,  impressions: 2800,  clicks: 194, ctr: 6.93, cpc_brl: 0.88, conversions: 1, cpa_brl: 170.7, quality_score: 5, impression_share: 37 },
  { keyword: '+escrita +memória', campaign: 'Search | Genérico', match: 'Ampla' as const,  impressions: 5600,  clicks: 252, ctr: 4.50, cpc_brl: 1.02, conversions: 0, cpa_brl: 0,     quality_score: 4, impression_share: 29 },
]

// ── Local helpers ───────────────────────────────────────────────────────────────

function fmtK(n: number): string {
  if (!n || n === 0) return '—'
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}K`
  return n.toLocaleString('pt-BR')
}

function fadeUp(delay: number) {
  return {
    initial: { opacity: 0, y: 8 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.4, delay, ease: [0.25, 0.1, 0.25, 1] as const },
  }
}

function SectionCard({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{
      background: 'var(--color-bg-primary)',
      border: '1px solid var(--color-border)',
      borderRadius: 'var(--radius-lg)',
      boxShadow: 'var(--shadow-md)',
      ...style,
    }}>
      {children}
    </div>
  )
}

function TH({ children, align = 'left' }: { children: React.ReactNode; align?: 'left' | 'right' | 'center' }) {
  return (
    <span style={{
      fontFamily: 'var(--font-sans)', fontSize: 11, fontWeight: 500,
      color: 'var(--color-text-tertiary)', letterSpacing: '0.02em',
      textTransform: 'uppercase', textAlign: align,
    }}>{children}</span>
  )
}

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
        return <span style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', color: 'var(--color-text-tertiary)', textAlign: 'right' }}>—</span>
    }
    let text = ''
    if (format === 'brl') text = `R$ ${fmtBR(value)}`
    else if (format === 'pct') text = `${value.toFixed(2)}%`
    else if (format === 'x') text = `${value.toFixed(2)}x`
    else text = value >= 1000 ? fmtBR(value) : value.toString()
    return <span style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)', textAlign: 'right' }}>{text}</span>
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
    'meta ads': '#FF5900',
    'google ads': '#D9730D',
    'instagram': '#E1306C',
    'email': 'var(--accent-green)',
    'orgânico': 'var(--accent-orange)',
    'direto / outros': 'var(--color-text-tertiary)',
}

function getChannelColor(channel: string) {
    return CHANNEL_COLORS[channel.toLowerCase()] || 'var(--color-primary)'
}


// ── Visualization 1: Spend Distribution (ranked cards) ───────────────────────

function SpendDistribution({ channelPerf, totalSpend }: { channelPerf: any[]; totalSpend: number }) {
    if (channelPerf.length === 0) return (
        <p style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', color: 'var(--color-text-tertiary)', textAlign: 'center', padding: '16px 0' }}>Sem dados no período</p>
    )

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {channelPerf.map((ch, i) => {
                const pct = totalSpend > 0 ? (ch.spend / totalSpend) * 100 : 0
                const color = getChannelColor(ch.channel)
                const roasColor = ch.roas >= 3 ? 'var(--status-complete)' : ch.roas >= 1 ? 'var(--color-primary)' : 'var(--accent-red)'
                return (
                    <motion.div
                        key={ch.channel}
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.08, ease: [0.25, 0.1, 0.25, 1] }}
                        style={{
                            display: 'flex', alignItems: 'center', gap: 14,
                            padding: '12px 16px',
                            background: 'var(--color-bg-secondary)',
                            borderRadius: 10,
                            border: '1px solid var(--color-border)',
                            borderLeft: `3px solid ${color}`,
                        }}
                    >
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--color-text-tertiary)', width: 18, flexShrink: 0 }}>
                            {String(i + 1).padStart(2, '0')}
                        </span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                                <div style={{ width: 7, height: 7, borderRadius: '50%', background: color, flexShrink: 0 }} />
                                <span style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', fontWeight: 500, color: 'var(--color-text-primary)' }}>
                                    {ch.channel}
                                </span>
                            </div>
                            {ch.roas > 0 && (
                                <span style={{ fontFamily: 'var(--font-sans)', fontSize: 10, color: roasColor }}>
                                    {ch.roas.toFixed(2)}x ROAS
                                </span>
                            )}
                            {ch.leads > 0 && ch.roas === 0 && (
                                <span style={{ fontFamily: 'var(--font-sans)', fontSize: 10, color: 'var(--color-text-tertiary)' }}>
                                    {ch.leads} leads · R$ {fmtBR(ch.cpl)}/lead
                                </span>
                            )}
                        </div>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--color-text-tertiary)', flexShrink: 0 }}>
                            {pct.toFixed(1)}%
                        </span>
                        <span style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-base)', fontWeight: 600, color: 'var(--color-text-primary)', letterSpacing: '-0.3px', flexShrink: 0, minWidth: 72, textAlign: 'right' }}>
                            R$ {fmtBR(ch.spend)}
                        </span>
                    </motion.div>
                )
            })}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 10, borderTop: '1px solid var(--color-border)', marginTop: 2 }}>
                <span style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)' }}>
                    {channelPerf.length} canal{channelPerf.length !== 1 ? 'is' : ''} ativos
                </span>
                <span style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--color-text-primary)', letterSpacing: '-0.3px' }}>
                    Total R$ {fmtBR(totalSpend)}
                </span>
            </div>
        </div>
    )
}

// ── Visualization 2: Daily Trend Chart ────────────────────────────────────────

function DailyTrendChart({ trends }: { trends: Record<string, { roas: number[]; cac: number[] }> }) {
    const [mode, setMode] = useState<'roas' | 'cac'>('roas')
    const [activePlatform, setActivePlatform] = useState<string | null>(null)
    const containerRef = useRef<HTMLDivElement>(null)
    const [containerW, setContainerW] = useState(600)

    useEffect(() => {
        const el = containerRef.current
        if (!el) return
        const obs = new ResizeObserver(([entry]) => setContainerW(entry.contentRect.width))
        obs.observe(el)
        return () => obs.disconnect()
    }, [])

    const platforms = Object.keys(trends)
    const displayPlatforms = platforms.filter(p => (trends[p]?.[mode] || []).some(v => v > 0))

    const allValues = displayPlatforms.flatMap(p => trends[p]?.[mode] || []).filter(v => v > 0)
    const rawMax = Math.max(...allValues, 0.001)
    const maxVal = rawMax * 1.18
    const minVal = 0
    const POINTS = 15

    const dateLabels = Array.from({ length: POINTS }, (_, i) => {
        const d = new Date()
        d.setDate(d.getDate() - (POINTS - 1 - i))
        return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`
    })

    const platformColors: Record<string, string> = { meta: '#FF5900', google: '#D9730D' }

    const H = 160
    const PAD_T = 10
    const PAD_B = 0

    function xOf(i: number) {
        return POINTS <= 1 ? containerW / 2 : (i / (POINTS - 1)) * containerW
    }
    function yOf(v: number) {
        return PAD_T + (1 - (v - minVal) / (maxVal - minVal)) * (H - PAD_T - PAD_B)
    }

    // Catmull-Rom → Cubic Bezier smooth path
    function smoothLine(values: number[]): string {
        if (values.length < 2) return ''
        const pts = values.map((v, i) => ({ x: xOf(i), y: yOf(v) }))
        let d = `M ${pts[0].x.toFixed(1)},${pts[0].y.toFixed(1)}`
        const t = 0.38
        for (let i = 0; i < pts.length - 1; i++) {
            const p0 = pts[Math.max(0, i - 1)]
            const p1 = pts[i]
            const p2 = pts[i + 1]
            const p3 = pts[Math.min(pts.length - 1, i + 2)]
            const cp1x = p1.x + (p2.x - p0.x) * t / 2
            const cp1y = p1.y + (p2.y - p0.y) * t / 2
            const cp2x = p2.x - (p3.x - p1.x) * t / 2
            const cp2y = p2.y - (p3.y - p1.y) * t / 2
            d += ` C ${cp1x.toFixed(1)},${cp1y.toFixed(1)} ${cp2x.toFixed(1)},${cp2y.toFixed(1)} ${p2.x.toFixed(1)},${p2.y.toFixed(1)}`
        }
        return d
    }

    function smoothArea(values: number[]): string {
        if (values.length < 2) return ''
        return `${smoothLine(values)} L ${xOf(values.length - 1).toFixed(1)},${H} L 0,${H} Z`
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
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    {platforms.map(p => (
                        <button key={p} onClick={() => setActivePlatform(activePlatform === p ? null : p)} style={{
                            display: 'flex', alignItems: 'center', gap: 5,
                            fontFamily: 'var(--font-sans)', fontSize: 10, padding: '3px 9px',
                            borderRadius: 4, border: '1px solid', cursor: 'pointer', transition: 'all 0.12s',
                            background: activePlatform === null || activePlatform === p ? `${platformColors[p]}15` : 'transparent',
                            color: activePlatform === null || activePlatform === p ? platformColors[p] : 'var(--color-text-tertiary)',
                            borderColor: activePlatform === null || activePlatform === p ? `${platformColors[p]}50` : 'var(--color-border)',
                            opacity: activePlatform !== null && activePlatform !== p ? 0.4 : 1,
                        }}>
                            <span style={{ width: 6, height: 6, borderRadius: '50%', background: platformColors[p] || '#888', flexShrink: 0 }} />
                            {p === 'meta' ? 'Meta' : p === 'google' ? 'Google' : p}
                        </button>
                    ))}
                </div>
            </div>

            {!hasData ? (
                <p style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', color: 'var(--color-text-tertiary)', textAlign: 'center', padding: '24px 0' }}>Sem dados no período</p>
            ) : (
                <div ref={containerRef} style={{ position: 'relative' }}>
                    {containerW > 0 && (
                        <svg width={containerW} height={H} style={{ display: 'block', overflow: 'visible' }}>
                            <defs>
                                {displayPlatforms.map(p => (
                                    <linearGradient key={p} id={`grad-dt-${p}`} x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor={platformColors[p] || '#888'} stopOpacity="0.2" />
                                        <stop offset="85%" stopColor={platformColors[p] || '#888'} stopOpacity="0.04" />
                                        <stop offset="100%" stopColor={platformColors[p] || '#888'} stopOpacity="0" />
                                    </linearGradient>
                                ))}
                            </defs>

                            {/* Horizontal grid lines */}
                            {[0.25, 0.5, 0.75, 1].map(pct => (
                                <line
                                    key={pct}
                                    x1={0} y1={(PAD_T + (1 - pct) * (H - PAD_T)).toFixed(1)}
                                    x2={containerW} y2={(PAD_T + (1 - pct) * (H - PAD_T)).toFixed(1)}
                                    stroke="var(--color-border)" strokeWidth={1}
                                />
                            ))}

                            {/* Breakeven line for ROAS at 1x */}
                            {mode === 'roas' && maxVal > 1 && (() => {
                                const breakevenY = yOf(1)
                                return (
                                    <>
                                        <line x1={0} y1={breakevenY.toFixed(1)} x2={containerW} y2={breakevenY.toFixed(1)}
                                            stroke="#FF5900" strokeWidth="1" strokeDasharray="5 4" opacity={0.35} />
                                        <text x={6} y={(breakevenY - 5).toFixed(1)}
                                            fontFamily="var(--font-mono)" fontSize={8} fill="#FF5900" opacity={0.5}>
                                            breakeven 1x
                                        </text>
                                    </>
                                )
                            })()}

                            {/* Y-axis max label */}
                            <text x={4} y={(PAD_T + 3).toFixed(1)}
                                fontFamily="var(--font-mono)" fontSize={8} fill="var(--color-text-tertiary)">
                                {mode === 'roas' ? `${rawMax.toFixed(1)}x` : `R$ ${fmtBR(rawMax)}`}
                            </text>

                            {/* Smooth curves per platform */}
                            {displayPlatforms.map(p => {
                                const vals = trends[p]?.[mode] || []
                                const isActive = activePlatform === null || activePlatform === p
                                const color = platformColors[p] || '#888'
                                return (
                                    <g key={p} style={{ opacity: isActive ? 1 : 0.08, transition: 'opacity 0.25s' }}>
                                        <motion.path
                                            d={smoothArea(vals)}
                                            fill={`url(#grad-dt-${p})`}
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: 1 }}
                                            transition={{ duration: 0.5 }}
                                        />
                                        <motion.path
                                            d={smoothLine(vals)}
                                            fill="none"
                                            stroke={color}
                                            strokeWidth="1.8"
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            initial={{ pathLength: 0, opacity: 0 }}
                                            animate={{ pathLength: 1, opacity: 1 }}
                                            transition={{ duration: 1.1, ease: [0.25, 0.1, 0.25, 1] }}
                                        />
                                        {/* End-point dot */}
                                        {vals.length > 0 && (
                                            <motion.circle
                                                cx={xOf(vals.length - 1).toFixed(1)}
                                                cy={yOf(vals[vals.length - 1] ?? 0).toFixed(1)}
                                                r={3}
                                                fill={color}
                                                initial={{ opacity: 0 }}
                                                animate={{ opacity: 1 }}
                                                transition={{ delay: 0.9, duration: 0.3 }}
                                            />
                                        )}
                                    </g>
                                )
                            })}
                        </svg>
                    )}
                    {/* Date axis */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
                        {[0, Math.floor((POINTS - 1) / 2), POINTS - 1].map(i => (
                            <span key={i} style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--color-text-tertiary)' }}>
                                {dateLabels[i]}
                            </span>
                        ))}
                    </div>
                </div>
            )}
        </div>
    )
}

// ── Visualization 3: Conversion Funnel ────────────────────────────────────────

function ConversionFunnel({ channelPerf, campaigns }: { channelPerf: any[]; campaigns?: any[] }) {
    const allCamps = campaigns || []
    const salesCamps = useMemo(() => allCamps.filter(c => c.purchases > 0), [allCamps])
    const leadCamps  = useMemo(() => allCamps.filter(c => c.leads > 0 && c.purchases === 0), [allCamps])

    const hasConversion = salesCamps.length > 0
    const hasLeads      = leadCamps.length > 0

    const [objective, setObjective] = useState<'conversion' | 'leads'>(() =>
        hasConversion ? 'conversion' : 'leads'
    )
    const activeCamps = objective === 'conversion' ? salesCamps : leadCamps

    const totals = useMemo(() => {
        // If no campaign data at all, fall back to channelPerf aggregation
        if (allCamps.length === 0) {
            return channelPerf.reduce((acc, ch) => ({
                impressions:        acc.impressions        + (ch.impressions || 0),
                clicks:             acc.clicks             + (ch.clicks || 0),
                landing_page_views: acc.landing_page_views + (ch.landing_page_views || 0),
                purchases:          acc.purchases          + (ch.purchases || 0),
                leads:              0,
            }), { impressions: 0, clicks: 0, landing_page_views: 0, purchases: 0, leads: 0 })
        }

        return activeCamps.reduce((acc, c) => ({
            impressions:        acc.impressions        + (c.impressions || 0),
            clicks:             acc.clicks             + (c.clicks || 0),
            landing_page_views: acc.landing_page_views + (c.landing_page_views || 0),
            purchases:          acc.purchases          + (c.purchases || 0),
            leads:              acc.leads              + (c.leads || 0),
        }), { impressions: 0, clicks: 0, landing_page_views: 0, purchases: 0, leads: 0 })
    }, [allCamps, activeCamps, channelPerf])

    // Steps differ by objective — leads funnel ends in "Leads" (formulário), not "Compras"
    const isLeadObj = objective === 'leads'
    const steps = [
        { label: 'Impressões',    value: totals.impressions,        fmt: (v: number) => fmtBR(v) },
        { label: 'Cliques',       value: totals.clicks,             fmt: (v: number) => fmtBR(v) },
        { label: 'Views da Pág.', value: totals.landing_page_views, fmt: (v: number) => fmtBR(v) },
        isLeadObj
            ? { label: 'Leads',   value: totals.leads,              fmt: (v: number) => v.toLocaleString('pt-BR') }
            : { label: 'Compras', value: totals.purchases,           fmt: (v: number) => v.toLocaleString('pt-BR') },
    ].filter(s => s.value > 0)

    // Last step colour: green for purchases (revenue), orange for leads (not yet revenue)
    const lastRgb = isLeadObj ? '255,89,0' : '34,197,94'

    // Fixed widths to guarantee tapering shape regardless of volume ratio
    const WIDTHS = [100, 72, 52, 36]

    const noData = steps.length < 2

    return (
        <div>
            {/* ── Header — reacts to objective ── */}
            <p style={{
                fontFamily: 'var(--font-sans)', fontSize: 11, fontWeight: 500,
                color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em',
                margin: '0 0 4px',
            }}>
                {isLeadObj ? 'Geração de Leads' : 'Funil de Conversão'}
            </p>
            <p style={{
                fontFamily: 'var(--font-sans)', fontSize: 22, fontWeight: 500,
                letterSpacing: '-0.4px', color: 'var(--color-text-primary)', margin: '0 0 16px',
            }}>
                {isLeadObj
                    ? (totals.leads > 0 ? `${totals.leads.toLocaleString('pt-BR')} leads` : totals.impressions > 0 ? `${fmtBR(totals.impressions)} imp.` : '—')
                    : (totals.purchases > 0 ? `${totals.purchases.toLocaleString('pt-BR')} compras` : totals.impressions > 0 ? `${fmtBR(totals.impressions)} imp.` : '—')
                }
            </p>

            {/* ── Objective tabs — only when both types exist ── */}
            {(hasConversion || hasLeads) && allCamps.length > 0 && (
                <div style={{ display: 'flex', gap: 4, marginBottom: 12 }}>
                    {([
                        { key: 'conversion' as const, label: 'Conversão',        show: hasConversion },
                        { key: 'leads'      as const, label: 'Geração de Leads', show: hasLeads },
                    ]).filter(t => t.show).map(({ key, label }) => (
                        <button
                            key={key}
                            onClick={() => setObjective(key)}
                            style={{
                                fontFamily: 'var(--font-sans)', fontSize: 'var(--text-xs)', padding: '3px 10px',
                                borderRadius: 5, border: '1px solid', cursor: 'pointer', transition: 'all 0.12s',
                                background:   objective === key ? 'var(--color-text-primary)' : 'transparent',
                                color:        objective === key ? 'var(--color-bg-primary)'   : 'var(--color-text-tertiary)',
                                borderColor:  objective === key ? 'var(--color-text-primary)' : 'var(--color-border)',
                            }}
                        >
                            {label}
                        </button>
                    ))}
                </div>
            )}


            {/* ── Funnel ── */}
            {noData ? (
                <p style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', color: 'var(--color-text-tertiary)', textAlign: 'center', padding: '20px 0' }}>
                    {activeCamps.length === 0 ? 'Nenhuma campanha com esse objetivo no período.' : 'Dados insuficientes para o funil.'}
                </p>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 0, alignItems: 'center' }}>
                    {steps.map((step, i) => {
                        const blockW    = WIDTHS[Math.min(i, WIDTHS.length - 1)]
                        const convRate  = i > 0 && steps[i - 1] ? (step.value / steps[i - 1]!.value) * 100 : null
                        const isLast    = i === steps.length - 1
                        const baseRgb   = isLast ? lastRgb : '255,89,0'
                        const opacities = [0.10, 0.16, 0.22, 0.32]
                        const op        = opacities[Math.min(i, opacities.length - 1)]
                        return (
                            <div key={step.label} style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                {convRate !== null && (
                                    <motion.div
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        transition={{ delay: i * 0.1 }}
                                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '4px 0' }}
                                    >
                                        <span style={{
                                            fontFamily: 'var(--font-mono)', fontSize: 10,
                                            color: convRate >= 5 ? 'var(--status-complete)' : convRate >= 1 ? 'var(--color-primary)' : 'var(--color-text-tertiary)',
                                            background: 'var(--color-bg-tertiary)', padding: '1px 10px', borderRadius: 20,
                                            border: '1px solid var(--color-border)',
                                        }}>
                                            ↓ {convRate.toFixed(1)}%
                                        </span>
                                    </motion.div>
                                )}
                                <motion.div
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    transition={{ delay: i * 0.12 + 0.1, duration: 0.35, ease: [0.25, 0.1, 0.25, 1] }}
                                    style={{
                                        width: `${blockW}%`,
                                        padding: '9px 14px',
                                        background: `rgba(${baseRgb}, ${op})`,
                                        borderRadius: 6,
                                        display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8,
                                    }}
                                >
                                    <span style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)', whiteSpace: 'nowrap' }}>
                                        {step.label}
                                    </span>
                                    <span style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--color-text-primary)', letterSpacing: '-0.2px' }}>
                                        {step.fmt(step.value)}
                                    </span>
                                </motion.div>
                            </div>
                        )
                    })}
                </div>
            )}
        </div>
    )
}

// ── Visualization 4: Campaign Efficiency Chart (objective-aware) ───────────────

function EfficiencyGroup({ title, items, renderMetric, legend }: {
    title: string
    items: { camp: any; color: string; pct: number; metric: string; secondary: string }[]
    renderMetric: (camp: any) => React.ReactNode
    legend: { label: string; color: string }[]
}) {
    return (
        <div>
            <p style={{
                fontFamily: 'var(--font-sans)', fontSize: 10, fontWeight: 500,
                color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em',
                margin: '0 0 10px',
            }}>
                {title}
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {items.map(({ camp, color, pct, secondary }, i) => (
                    <motion.div
                        key={camp.campaign_id}
                        initial={{ opacity: 0, x: -6 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.07, ease: [0.25, 0.1, 0.25, 1] }}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, flex: 1 }}>
                                <StatusTag status={camp.status} />
                                <span title={camp.campaign_name} style={{
                                    fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)',
                                    color: 'var(--color-text-primary)', fontWeight: 500,
                                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                }}>
                                    {camp.campaign_name}
                                </span>
                            </div>
                            <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexShrink: 0, paddingLeft: 12 }}>
                                <span style={{ fontFamily: 'var(--font-sans)', fontSize: 10, color: 'var(--color-text-tertiary)' }}>
                                    {secondary}
                                </span>
                                {renderMetric(camp)}
                            </div>
                        </div>
                        <div style={{ height: 4, background: 'var(--color-bg-tertiary)', borderRadius: 'var(--radius-full)', overflow: 'hidden' }}>
                            <motion.div
                                style={{ height: '100%', background: color, borderRadius: 'var(--radius-full)', opacity: 0.85 }}
                                initial={{ width: '0%' }}
                                animate={{ width: `${pct}%` }}
                                transition={{ duration: 0.7, delay: i * 0.08 + 0.2, ease: [0.4, 0, 0.2, 1] }}
                            />
                        </div>
                    </motion.div>
                ))}
            </div>
            <div style={{ display: 'flex', gap: 14, marginTop: 10, flexWrap: 'wrap' }}>
                {legend.map(({ label, color }) => (
                    <span key={label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: color, flexShrink: 0 }} />
                        <span style={{ fontFamily: 'var(--font-sans)', fontSize: 10, color: 'var(--color-text-tertiary)' }}>{label}</span>
                    </span>
                ))}
            </div>
        </div>
    )
}

function CampaignEfficiencyChart({ campaigns }: { campaigns: any[] }) {
    // Split by objective: sales (ROAS) vs leads (CPL)
    const salesCamps = [...campaigns]
        .filter(c => c.spend_brl > 0 && c.purchases > 0)
        .sort((a, b) => (b.roas ?? 0) - (a.roas ?? 0))
        .slice(0, 5)

    const leadCamps = [...campaigns]
        .filter(c => c.spend_brl > 0 && c.leads > 0 && c.purchases === 0)
        .map(c => ({ ...c, cpl: c.spend_brl / c.leads }))
        .sort((a, b) => a.cpl - b.cpl) // lower CPL = better, ascending
        .slice(0, 5)

    if (salesCamps.length === 0 && leadCamps.length === 0) return (
        <p style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', color: 'var(--color-text-tertiary)', textAlign: 'center', padding: '24px 0' }}>
            Sem campanhas com gasto no período
        </p>
    )

    const maxRoas = Math.max(...salesCamps.map(c => c.roas ?? 0), 1) * 1.1

    // For CPL: lowest CPL gets widest bar (best efficiency) — inverted scale
    const cplValues = leadCamps.map(c => c.cpl)
    const minCpl = Math.min(...cplValues, 0)
    const maxCpl = Math.max(...cplValues, 1)
    const medianCpl = cplValues.length > 0
        ? [...cplValues].sort((a, b) => a - b)[Math.floor(cplValues.length / 2)]
        : 0

    const salesItems = salesCamps.map(c => {
        const roas = c.roas ?? 0
        return {
            camp: c,
            color: roas >= 3 ? 'var(--status-complete)' : roas >= 1 ? '#FF5900' : 'var(--accent-red)',
            pct: maxRoas > 0 ? (roas / maxRoas) * 100 : 0,
            metric: `${roas.toFixed(2)}x`,
            secondary: `R$ ${fmtBR(c.spend_brl)}`,
        }
    })

    const leadItems = leadCamps.map(c => {
        const range = maxCpl - minCpl || 1
        const pct = Math.max(((maxCpl - c.cpl) / range) * 100, 12)
        return {
            camp: c,
            color: c.cpl <= medianCpl ? 'var(--status-complete)' : c.cpl <= medianCpl * 2 ? '#FF5900' : 'var(--accent-red)',
            pct,
            metric: `R$ ${fmtBR(c.cpl)}/lead`,
            secondary: `${c.leads} leads`,
        }
    })

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: salesCamps.length > 0 && leadCamps.length > 0 ? 24 : 0 }}>
            {salesCamps.length > 0 && (
                <EfficiencyGroup
                    title="Conversão — ROAS"
                    items={salesItems}
                    renderMetric={camp => {
                        const roas = camp.roas ?? 0
                        const color = roas >= 3 ? 'var(--status-complete)' : roas >= 1 ? '#FF5900' : 'var(--accent-red)'
                        return (
                            <span style={{ fontFamily: 'var(--font-sans)', fontSize: 13, fontWeight: 600, color, minWidth: 42, textAlign: 'right', letterSpacing: '-0.2px' }}>
                                {roas > 0 ? `${roas.toFixed(2)}x` : '—'}
                            </span>
                        )
                    }}
                    legend={[
                        { label: 'ROAS ≥ 3x — escalar', color: 'var(--status-complete)' },
                        { label: 'ROAS 1–3x — monitorar', color: '#FF5900' },
                        { label: 'ROAS < 1x — pausar', color: 'var(--accent-red)' },
                    ]}
                />
            )}
            {leadCamps.length > 0 && (
                <EfficiencyGroup
                    title="Geração de Leads — CPL"
                    items={leadItems}
                    renderMetric={camp => {
                        const color = camp.cpl <= medianCpl ? 'var(--status-complete)' : camp.cpl <= medianCpl * 2 ? '#FF5900' : 'var(--accent-red)'
                        return (
                            <span style={{ fontFamily: 'var(--font-sans)', fontSize: 13, fontWeight: 600, color, minWidth: 58, textAlign: 'right', letterSpacing: '-0.2px' }}>
                                R$ {fmtBR(camp.cpl)}
                            </span>
                        )
                    }}
                    legend={[
                        { label: 'CPL baixo — eficiente', color: 'var(--status-complete)' },
                        { label: 'CPL médio', color: '#FF5900' },
                        { label: 'CPL alto — otimizar', color: 'var(--accent-red)' },
                    ]}
                />
            )}
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

    if (loading) return <p style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', color: 'var(--color-text-tertiary)' }}>Carregando anúncios...</p>
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
                            {/* ROAS tag — font-sans */}
                            <span className={ad.roas >= 3 ? 'tag tag-complete' : ad.roas >= 1 ? 'tag tag-planning' : 'tag tag-critical'} style={{ fontFamily: 'var(--font-sans)' }}>
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
                    <span style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-base)', fontWeight: 500, color: 'var(--color-text-primary)', letterSpacing: '-0.3px' }}>{m.value}</span>
                </div>
            ))}
        </div>
    )
}

// ── Campaign Drawer ────────────────────────────────────────────────────────────

function DrawerMetric({ label, value }: { label: string; value: string | number }) {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontFamily: 'var(--font-sans)', fontSize: 10, fontWeight: 500, color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</span>
            <span style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-base)', fontWeight: 500, color: 'var(--color-text-primary)', letterSpacing: '-0.3px' }}>{value || '—'}</span>
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
                            {/* h2 — font-sans, fontWeight 500 */}
                            <h2 style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-lg)', fontWeight: 500, color: 'var(--color-text-primary)', lineHeight: 1.3, margin: 0 }}>
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
                                                    {/* Adset spend — font-sans */}
                                                    <span style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)' }}>R$ {fmtBR(adset.spend_brl)}</span>
                                                    {/* Adset purchases/leads — font-sans */}
                                                    {adset.purchases > 0 && <span style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)' }}>{adset.purchases} compras</span>}
                                                    {adset.leads > 0 && <span style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)' }}>{adset.leads} leads</span>}
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
                                                                {/* Ad spend — font-sans */}
                                                                <span style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)' }}>R$ {fmtBR(ad.spend_brl)}</span>
                                                                {/* Ad impressions — font-sans */}
                                                                <span style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)' }}>{ad.impressions?.toLocaleString('pt-BR')} imp.</span>
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
                {/* Primary result — font-sans */}
                <span style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)', textAlign: 'right' }}>{primaryResult}</span>
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
                                        {/* Adset result — font-sans */}
                                        <span style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)', textAlign: 'right' }}>{adsetResult}</span>
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
                                                    {/* Ad result — font-sans */}
                                                    <span style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', color: 'var(--color-text-tertiary)', textAlign: 'right' }}>
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

// ── Campaigns Table (extracted for reuse) ─────────────────────────────────────

function CampaignsTable({ campaigns, days, onOpenDrawer, loading }: { campaigns: any[]; days: number; onOpenDrawer: (c: any) => void; loading: boolean }) {
    return (
        <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <p style={{ fontFamily: 'var(--font-sans)', fontSize: 11, fontWeight: 500, color: 'var(--color-text-tertiary)', letterSpacing: '0.02em', textTransform: 'uppercase', margin: 0 }}>
                    Campanhas ({campaigns.length})
                </p>
            </div>
            {loading ? (
                <p style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', color: 'var(--color-text-tertiary)' }}>Carregando campanhas...</p>
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

// ── Creative Modal ────────────────────────────────────────────────────────────

function CreativeModal({ creative, onClose }: { creative: any; onClose: () => void }) {
    const isVideo = creative.creative_type === 'video' && creative.video_url
    const typeLabel = creative.creative_type === 'video' ? 'Vídeo' : creative.creative_type === 'carousel' ? 'Carrossel' : 'Imagem'

    const metrics = [
        { label: 'Investimento', value: `R$ ${fmtBR(creative.spend_brl)}` },
        { label: 'Impressões',   value: fmtK(creative.impressions) },
        { label: 'Cliques',      value: fmtK(creative.clicks) },
        { label: 'CTR',          value: `${creative.ctr.toFixed(2)}%` },
        { label: 'CPC',          value: `R$ ${fmtBR(creative.cpc_brl)}` },
        { label: 'CPM',          value: `R$ ${fmtBR(creative.cpm_brl)}` },
        { label: 'Alcance',      value: fmtK(creative.reach) },
        { label: 'Frequência',   value: `${creative.frequency.toFixed(2)}x` },
        ...(creative.roas > 0     ? [{ label: 'ROAS',    value: `${creative.roas.toFixed(2)}x` }] : []),
        ...(creative.purchases > 0 ? [{ label: 'Compras', value: String(creative.purchases) }]   : []),
        ...(creative.leads > 0     ? [{ label: 'Leads',   value: String(creative.leads) }]        : []),
    ]

    return (
        <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ position: 'fixed', inset: 0, zIndex: 400, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
        >
            <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.78)' }} />
            <motion.div
                initial={{ scale: 0.94, opacity: 0, y: 12 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.94, opacity: 0, y: 12 }}
                transition={{ ease: [0.4, 0, 0.2, 1], duration: 0.22 }}
                style={{ position: 'relative', width: '100%', maxWidth: 620, background: 'var(--color-bg-primary)', borderRadius: 14, overflow: 'hidden', border: '1px solid var(--color-border)', maxHeight: '92vh', overflowY: 'auto' }}
            >
                {/* Close button */}
                <button
                    onClick={onClose}
                    style={{ position: 'absolute', top: 12, right: 12, zIndex: 10, background: 'rgba(0,0,0,0.45)', border: 'none', borderRadius: '50%', width: 30, height: 30, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}
                >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>

                {/* Creative content */}
                {isVideo ? (
                    <video
                        key={creative.ad_id}
                        src={creative.video_url}
                        autoPlay controls playsInline
                        style={{ width: '100%', maxHeight: 340, objectFit: 'cover', background: '#000', display: 'block' }}
                    />
                ) : (
                    <img
                        src={creative.thumbnail_url}
                        alt={creative.ad_name}
                        style={{ width: '100%', maxHeight: 340, objectFit: 'cover', display: 'block' }}
                    />
                )}

                {/* Info */}
                <div style={{ padding: '20px 24px' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 18 }}>
                        <div style={{ minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                                <span style={{ fontFamily: 'var(--font-sans)', fontSize: 10, fontWeight: 500, color: 'var(--color-primary)', background: 'rgba(255,89,0,0.1)', border: '1px solid rgba(255,89,0,0.2)', borderRadius: 4, padding: '1px 7px' }}>
                                    {typeLabel}
                                </span>
                            </div>
                            <p style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-base)', fontWeight: 500, color: 'var(--color-text-primary)', margin: '0 0 4px', letterSpacing: '-0.2px' }}>
                                {creative.ad_name}
                            </p>
                            <p style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)', margin: 0 }}>
                                {creative.campaign_name}
                            </p>
                        </div>
                        <StatusTag status={creative.status} />
                    </div>

                    {/* Metrics */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '14px 16px' }}>
                        {metrics.map(({ label, value }) => (
                            <div key={label}>
                                <p style={{ fontFamily: 'var(--font-sans)', fontSize: 10, fontWeight: 500, color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 3px' }}>{label}</p>
                                <p style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', fontWeight: 500, color: 'var(--color-text-primary)', margin: 0, letterSpacing: '-0.2px' }}>{value}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </motion.div>
        </motion.div>
    )
}

// ── Creatives Table ───────────────────────────────────────────────────────────

type CreativeSortKey = 'spend_brl' | 'impressions' | 'ctr' | 'cpc_brl'

const CREATIVES_GRID = '28px minmax(220px, 1.8fr) 68px 100px 90px 72px 64px 80px'

function CreativesTable() {
    const [sortBy, setSortBy]             = useState<CreativeSortKey>('spend_brl')
    const [selectedCreative, setSelected] = useState<any>(null)

    const sorted = [...MOCK_CREATIVES].sort((a, b) => b[sortBy] - a[sortBy])

    const SORT_OPTS: { key: CreativeSortKey; label: string }[] = [
        { key: 'spend_brl',   label: 'Investimento' },
        { key: 'impressions', label: 'Impressões'   },
        { key: 'ctr',         label: 'CTR'          },
        { key: 'cpc_brl',     label: 'CPC'          },
    ]

    return (
        <div>
            {/* Table header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <p style={{ fontFamily: 'var(--font-sans)', fontSize: 11, fontWeight: 500, color: 'var(--color-text-tertiary)', letterSpacing: '0.02em', textTransform: 'uppercase', margin: 0 }}>
                        Todos os Anúncios
                    </p>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--color-text-tertiary)', background: 'var(--color-bg-tertiary)', border: '1px solid var(--color-border)', borderRadius: 4, padding: '1px 6px' }}>
                        {sorted.length}
                    </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontFamily: 'var(--font-sans)', fontSize: 11, color: 'var(--color-text-tertiary)' }}>Ordenar por:</span>
                    <div style={{ display: 'flex', gap: 4 }}>
                        {SORT_OPTS.map(opt => (
                            <button
                                key={opt.key}
                                onClick={() => setSortBy(opt.key)}
                                style={{
                                    fontFamily: 'var(--font-sans)', fontSize: 11, padding: '3px 10px',
                                    borderRadius: 5, border: '1px solid', cursor: 'pointer', transition: 'all 0.12s',
                                    background:  sortBy === opt.key ? 'var(--color-primary)' : 'transparent',
                                    color:       sortBy === opt.key ? '#fff'                  : 'var(--color-text-tertiary)',
                                    borderColor: sortBy === opt.key ? 'var(--color-primary)'  : 'var(--color-border)',
                                }}
                            >
                                {opt.label}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Column labels */}
            <div style={{ display: 'grid', gridTemplateColumns: CREATIVES_GRID, gap: '0 12px', paddingBottom: 8, borderBottom: '1px solid var(--color-border)', marginBottom: 2 }}>
                <TH>#</TH>
                <TH>Anúncio</TH>
                <TH>Status</TH>
                <TH align="right">Investimento</TH>
                <TH align="right">Impressões</TH>
                <TH align="right">Cliques</TH>
                <TH align="right">CTR</TH>
                <TH align="right">CPC</TH>
            </div>

            {/* Rows */}
            {sorted.map((cr, i) => (
                <motion.div
                    key={cr.ad_id}
                    initial={{ opacity: 0, y: 3 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.04 }}
                    className="notion-row"
                    style={{ display: 'grid', gridTemplateColumns: CREATIVES_GRID, gap: '0 12px', alignItems: 'center', cursor: 'pointer' }}
                    onClick={() => setSelected(cr)}
                >
                    {/* Rank */}
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--color-text-tertiary)', textAlign: 'right' }}>
                        {i + 1}
                    </span>

                    {/* Thumbnail + name */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                        <div style={{ position: 'relative', width: 52, height: 40, borderRadius: 6, overflow: 'hidden', flexShrink: 0, background: 'var(--color-bg-tertiary)' }}>
                            <img
                                src={cr.thumbnail_url}
                                alt=""
                                loading="lazy"
                                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                            />
                            {cr.creative_type === 'video' && (
                                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.38)' }}>
                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="white"><polygon points="5 3 19 12 5 21 5 3" /></svg>
                                </div>
                            )}
                            {cr.creative_type === 'carousel' && (
                                <div style={{ position: 'absolute', bottom: 3, right: 3, background: 'rgba(0,0,0,0.55)', borderRadius: 3, padding: '1px 4px' }}>
                                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><rect x="2" y="3" width="6" height="18" rx="1"/><rect x="9" y="3" width="6" height="18" rx="1"/><rect x="16" y="3" width="6" height="18" rx="1"/></svg>
                                </div>
                            )}
                        </div>
                        <div style={{ minWidth: 0 }}>
                            <p style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', fontWeight: 500, color: 'var(--color-text-primary)', margin: '0 0 2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {cr.ad_name}
                            </p>
                            <p style={{ fontFamily: 'var(--font-sans)', fontSize: 10, color: 'var(--color-text-tertiary)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {cr.campaign_name}
                            </p>
                        </div>
                    </div>

                    <div><StatusTag status={cr.status} /></div>
                    <span style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)', textAlign: 'right' }}>R$ {fmtBR(cr.spend_brl)}</span>
                    <span style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)', textAlign: 'right' }}>{fmtK(cr.impressions)}</span>
                    <span style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)', textAlign: 'right' }}>{fmtK(cr.clicks)}</span>
                    <span style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)', textAlign: 'right' }}>{cr.ctr.toFixed(2)}%</span>
                    <span style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)', textAlign: 'right' }}>R$ {fmtBR(cr.cpc_brl)}</span>
                </motion.div>
            ))}

            {/* Creative modal */}
            <AnimatePresence>
                {selectedCreative && (
                    <CreativeModal key={selectedCreative.ad_id} creative={selectedCreative} onClose={() => setSelected(null)} />
                )}
            </AnimatePresence>
        </div>
    )
}

// ── Meta Ads — Audience Health Card ──────────────────────────────────────────

function AudienceHealthCard({ campaigns }: { campaigns: any[] }) {
    const m = useMemo(() => {
        const totalImpressions = campaigns.reduce((s, c) => s + (c.impressions || 0), 0)
        const totalReach       = campaigns.reduce((s, c) => s + (c.reach || 0), 0)
        const totalSpend       = campaigns.reduce((s, c) => s + (c.spend_brl || 0), 0)
        const totalLinkClicks  = campaigns.reduce((s, c) => s + (c.link_clicks || 0), 0)
        const avgFreq  = totalReach > 0 ? totalImpressions / totalReach : 0
        const cpm      = totalImpressions > 0 ? (totalSpend / totalImpressions) * 1000 : 0
        const ctr      = totalImpressions > 0 ? (totalLinkClicks / totalImpressions) * 100 : 0
        return { totalImpressions, totalReach, avgFreq, cpm, ctr }
    }, [campaigns])

    const freqColor  = m.avgFreq < 2 ? 'var(--status-complete)' : m.avgFreq < 3.5 ? 'var(--color-primary)' : 'var(--accent-red)'
    const freqStatus = m.avgFreq < 2 ? 'Frequência saudável'
                     : m.avgFreq < 3.5 ? 'Atenção — próximo da fadiga'
                     : 'Fadiga de anúncio detectada'
    // Bar: 0–6x scale, capped visually at 5x
    const freqPct = Math.min((m.avgFreq / 5) * 100, 100)

    return (
        <div>
            <p style={{ fontFamily: 'var(--font-sans)', fontSize: 11, fontWeight: 500, color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 4px' }}>
                Saúde da Audiência
            </p>

            {/* Big frequency number */}
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, margin: '4px 0 10px' }}>
                <span style={{ fontFamily: 'var(--font-sans)', fontSize: 34, fontWeight: 600, color: freqColor, letterSpacing: '-1.5px', lineHeight: 1 }}>
                    {m.avgFreq > 0 ? m.avgFreq.toFixed(1) : '—'}
                </span>
                {m.avgFreq > 0 && (
                    <span style={{ fontFamily: 'var(--font-sans)', fontSize: 13, color: 'var(--color-text-tertiary)' }}>
                        freq. média
                    </span>
                )}
            </div>

            {/* Frequency bar */}
            {m.avgFreq > 0 && (
                <div style={{ marginBottom: 10 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--color-text-tertiary)' }}>0x</span>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--color-primary)', opacity: 0.6 }}>fadiga 3.5x</span>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--color-text-tertiary)' }}>5x</span>
                    </div>
                    <div style={{ height: 5, background: 'var(--color-bg-tertiary)', borderRadius: 99, overflow: 'hidden', position: 'relative' }}>
                        {/* Danger zone overlay */}
                        <div style={{ position: 'absolute', left: '70%', right: 0, top: 0, bottom: 0, background: 'rgba(239,68,68,0.12)' }} />
                        <motion.div
                            style={{ height: '100%', background: freqColor, borderRadius: 99 }}
                            initial={{ width: '0%' }}
                            animate={{ width: `${freqPct}%` }}
                            transition={{ duration: 0.8, ease: [0.4, 0, 0.2, 1] }}
                        />
                    </div>
                </div>
            )}

            {/* Status badge */}
            <div style={{ marginBottom: 20, padding: '5px 10px', borderRadius: 6, background: `color-mix(in srgb, ${freqColor} 10%, transparent)`, border: `1px solid color-mix(in srgb, ${freqColor} 25%, transparent)`, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 5, height: 5, borderRadius: '50%', background: freqColor, flexShrink: 0 }} />
                <span style={{ fontFamily: 'var(--font-sans)', fontSize: 11, color: freqColor, fontWeight: 500 }}>{freqStatus}</span>
            </div>

            {/* Metrics grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px 20px' }}>
                {[
                    { label: 'Alcance Único',   value: m.totalReach > 0 ? `${fmtBR(m.totalReach)} pessoas` : '—' },
                    { label: 'CPM',             value: m.cpm > 0 ? `R$ ${fmtBR(m.cpm)}` : '—' },
                    { label: 'CTR (link)',       value: m.ctr > 0 ? `${m.ctr.toFixed(2)}%` : '—' },
                    { label: 'Impressões',       value: m.totalImpressions > 0 ? fmtBR(m.totalImpressions) : '—' },
                ].map(({ label, value }) => (
                    <div key={label}>
                        <p style={{ fontFamily: 'var(--font-sans)', fontSize: 10, fontWeight: 500, color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 3px' }}>{label}</p>
                        <p style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-base)', fontWeight: 500, color: 'var(--color-text-primary)', letterSpacing: '-0.2px', margin: 0 }}>{value}</p>
                    </div>
                ))}
            </div>
        </div>
    )
}

// ── Meta Ads Page ─────────────────────────────────────────────────────────────

function MetaAdsContent({
    campaigns,
    channelPerf,
    trends,
    days,
    onOpenDrawer,
    loading,
    dateRange,
    setDateRange,
}: {
    campaigns: any[]
    channelPerf: any[]
    trends: Record<string, { roas: number[]; cac: number[] }>
    days: number
    onOpenDrawer: (c: any) => void
    loading: boolean
    dateRange: DateRange
    setDateRange: (r: DateRange) => void
}) {
    const ch = channelPerf.find(c => c.channel === 'Meta Ads')
    const metaTrends = { meta: trends.meta || { roas: [], cac: [] } }

    const agg = useMemo(() => campaigns.reduce((acc, c) => ({
        spend:    acc.spend    + (c.spend_brl      || 0),
        revenue:  acc.revenue  + (c.purchase_value || 0),
        purchases:acc.purchases+ (c.purchases      || 0),
        leads:    acc.leads    + (c.leads           || 0),
        reach:    acc.reach    + (c.reach           || 0),
    }), { spend: 0, revenue: 0, purchases: 0, leads: 0, reach: 0 }), [campaigns])

    const roas = agg.spend > 0 && agg.revenue > 0 ? agg.revenue / agg.spend : 0
    const cac  = agg.purchases > 0 ? agg.spend / agg.purchases : 0
    const cpl  = agg.leads > 0     ? agg.spend / agg.leads     : 0

    const kpisBase = [
        { label: 'Gasto',            value: agg.spend,    prefix: 'R$ ', decimals: 0 },
        { label: 'Receita Atribuída',value: agg.revenue,  prefix: 'R$ ', decimals: 0 },
        { label: 'ROAS',             value: roas,         suffix: 'x',   decimals: 2 },
    ]
    const kpis = [
        ...kpisBase,
        ...(agg.purchases > 0 ? [{ label: 'Custo por Compra', value: cac, prefix: 'R$ ', decimals: 0 }] : []),
        ...(agg.leads > 0     ? [{ label: 'Custo por Lead',   value: cpl, prefix: 'R$ ', decimals: 2 }] : []),
    ]

    const lpvTotal = campaigns.reduce((s, c) => s + (c.landing_page_views || 0), 0)
    const funnelChannelPerf = ch ? [{ ...ch, landing_page_views: lpvTotal }] : []

    const [metaTab, setMetaTab] = useState<'metricas' | 'gerenciador'>('metricas')

    // Ad manager aggregate metrics
    const adMgrKpis = useMemo(() => {
        const totalImpressions = campaigns.reduce((s, c) => s + (c.impressions || 0), 0)
        const totalReach       = campaigns.reduce((s, c) => s + (c.reach || 0), 0)
        const totalClicks      = campaigns.reduce((s, c) => s + (c.link_clicks || 0), 0)
        const totalSpend       = campaigns.reduce((s, c) => s + (c.spend_brl || 0), 0)
        const avgCtr           = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0
        const avgCpm           = totalImpressions > 0 ? (totalSpend / totalImpressions) * 1000 : 0
        const avgCpc           = totalClicks > 0 ? totalSpend / totalClicks : 0
        return { totalImpressions, totalReach, totalClicks, avgCtr, avgCpm, avgCpc }
    }, [campaigns])

    const TABS = [
        { key: 'metricas',    label: 'Métricas'    },
        { key: 'gerenciador', label: 'Gerenciador' },
    ] as const

    return (
        <div>
            {/* Header */}
            <motion.div {...fadeUp(0)} style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
                <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                        <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#FF5900', flexShrink: 0 }} />
                        <span style={{ fontFamily: 'var(--font-sans)', fontSize: 11, color: 'var(--color-text-tertiary)', letterSpacing: '0.02em' }}>
                            {campaigns[0]?.account_name || 'Meta Ads'} · {campaigns.length} campanha{campaigns.length !== 1 ? 's' : ''}
                        </span>
                    </div>
                    <h1 style={{ fontFamily: 'var(--font-sans)', fontWeight: 500, fontSize: 'var(--text-3xl)', letterSpacing: '-0.5px', color: 'var(--color-text-primary)', lineHeight: 1.1, margin: '0 0 5px' }}>
                        Meta Ads
                    </h1>
                    <p style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-base)', color: 'var(--color-text-secondary)', margin: 0, letterSpacing: '-0.1px' }}>
                        {agg.reach > 0 ? `${fmtBR(agg.reach)} pessoas alcançadas no período` : 'Sem dados de alcance no período.'}
                    </p>
                </div>
                <DateRangePicker value={dateRange} onChange={setDateRange} />
            </motion.div>

            {/* Tab navbar */}
            <motion.div {...fadeUp(0.04)} style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 20, padding: '4px', background: 'var(--color-bg-secondary)', borderRadius: 10, width: 'fit-content', border: '1px solid var(--color-border)' }}>
                {TABS.map(tab => (
                    <motion.button
                        key={tab.key}
                        onClick={() => setMetaTab(tab.key)}
                        whileTap={{ scale: 0.97 }}
                        style={{
                            fontFamily: 'var(--font-sans)',
                            fontSize: 13,
                            fontWeight: metaTab === tab.key ? 500 : 400,
                            color: metaTab === tab.key ? 'var(--color-text-primary)' : 'var(--color-text-tertiary)',
                            background: metaTab === tab.key ? 'var(--color-bg-primary)' : 'transparent',
                            border: metaTab === tab.key ? '1px solid var(--color-border)' : '1px solid transparent',
                            borderRadius: 7,
                            padding: '6px 16px',
                            cursor: 'pointer',
                            transition: 'all 0.15s ease',
                            letterSpacing: '-0.1px',
                        }}
                    >
                        {tab.label}
                    </motion.button>
                ))}
            </motion.div>

            <AnimatePresence mode="wait">
            {metaTab === 'metricas' ? (
                <motion.div key="metricas" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.25, ease: [0.25, 0.1, 0.25, 1] }}>
                    {/* KPIs */}
                    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${kpis.length}, 1fr)`, gap: 10, marginBottom: 14 }}>
                        {kpis.map((k, i) => (
                            <KpiCard key={k.label} label={k.label} value={k.value} prefix={k.prefix} suffix={k.suffix} decimals={k.decimals} delay={i * 0.05} />
                        ))}
                    </div>

                    {/* Trend chart */}
                    <div style={{ marginBottom: 14 }}>
                        <SectionCard style={{ padding: '20px 24px 16px' }}>
                            <p style={{ fontFamily: 'var(--font-sans)', fontSize: 11, fontWeight: 400, color: 'var(--color-text-secondary)', letterSpacing: '0.02em', textTransform: 'uppercase', margin: '0 0 4px' }}>Tendência Diária</p>
                            <p style={{ fontFamily: 'var(--font-sans)', fontSize: 22, fontWeight: 500, letterSpacing: '-0.4px', color: roas >= 1 ? 'var(--status-complete)' : 'var(--accent-red)', margin: '0 0 16px' }}>
                                {roas > 0 ? `${roas.toFixed(2)}x ROAS` : '—'}
                            </p>
                            <DailyTrendChart trends={metaTrends} />
                        </SectionCard>
                    </div>

                    {/* 2-col: Audience Health + Conversion Funnel */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
                        <SectionCard style={{ padding: '20px 24px' }}>
                            <AudienceHealthCard campaigns={campaigns} />
                        </SectionCard>
                        <SectionCard style={{ padding: '20px 24px' }}>
                            {funnelChannelPerf.length > 0 ? (
                                <ConversionFunnel channelPerf={funnelChannelPerf} campaigns={campaigns} />
                            ) : (
                                <p style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', color: 'var(--color-text-tertiary)', textAlign: 'center', padding: '24px 0' }}>Sem dados no período.</p>
                            )}
                        </SectionCard>
                    </div>

                    {/* Campaign efficiency */}
                    <div>
                        <SectionCard style={{ padding: '20px 24px' }}>
                            <p style={{ fontFamily: 'var(--font-sans)', fontSize: 11, fontWeight: 400, color: 'var(--color-text-secondary)', letterSpacing: '0.02em', textTransform: 'uppercase', margin: '0 0 4px' }}>Eficiência de Campanhas</p>
                            <p style={{ fontFamily: 'var(--font-sans)', fontSize: 22, fontWeight: 500, color: 'var(--color-text-primary)', letterSpacing: '-0.4px', margin: '0 0 20px' }}>
                                {(() => {
                                    const sc = campaigns.filter(c => c.spend_brl > 0 && c.purchases > 0)
                                    const lc = campaigns.filter(c => c.spend_brl > 0 && c.leads > 0 && c.purchases === 0)
                                    if (sc.length > 0 && lc.length > 0) return `${sc.filter(c => c.roas >= 1).length}/${sc.length} conversão · ${lc.length} de leads`
                                    if (sc.length > 0) return `${sc.filter(c => c.roas >= 1).length} de ${sc.length} campanhas lucrativas`
                                    return `${lc.length} campanha${lc.length !== 1 ? 's' : ''} de geração de leads`
                                })()}
                            </p>
                            <CampaignEfficiencyChart campaigns={campaigns} />
                        </SectionCard>
                    </div>
                </motion.div>
            ) : (
                <motion.div key="gerenciador" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.25, ease: [0.25, 0.1, 0.25, 1] }}>
                    {/* Ad manager KPIs */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 10, marginBottom: 14 }}>
                        <KpiCard label="Impressões"  value={adMgrKpis.totalImpressions} decimals={0} delay={0}    />
                        <KpiCard label="Alcance"     value={adMgrKpis.totalReach}       decimals={0} delay={0.05} />
                        <KpiCard label="Cliques"     value={adMgrKpis.totalClicks}      decimals={0} delay={0.1}  />
                        <KpiCard label="CTR"         value={adMgrKpis.avgCtr}           suffix="%"  decimals={2} delay={0.15} />
                        <KpiCard label="CPM"         value={adMgrKpis.avgCpm}           prefix="R$ " decimals={2} delay={0.2}  />
                        <KpiCard label="CPC"         value={adMgrKpis.avgCpc}           prefix="R$ " decimals={2} delay={0.25} />
                    </div>

                    {/* Creatives table */}
                    <div style={{ marginBottom: 14 }}>
                        <SectionCard style={{ padding: '20px 24px' }}>
                            <CreativesTable />
                        </SectionCard>
                    </div>

                    {/* Campaigns table */}
                    <div>
                        <SectionCard style={{ padding: '20px 24px' }}>
                            <CampaignsTable campaigns={campaigns} days={days} onOpenDrawer={onOpenDrawer} loading={loading} />
                        </SectionCard>
                    </div>
                </motion.div>
            )}
            </AnimatePresence>
        </div>
    )
}

// ── Google Ads — Search Account Health ───────────────────────────────────────

function SearchAccountHealth({ campaigns }: { campaigns: any[] }) {
    const agg = useMemo(() => {
        const totalImpressions = campaigns.reduce((s, c) => s + (c.impressions || 0), 0)
        const totalClicks      = campaigns.reduce((s, c) => s + (c.clicks || 0), 0)
        const totalSpend       = campaigns.reduce((s, c) => s + (c.spend_brl || 0), 0)
        const avgQS            = MOCK_KEYWORDS.reduce((s, k) => s + k.quality_score, 0) / MOCK_KEYWORDS.length
        const avgIS            = MOCK_KEYWORDS.reduce((s, k) => s + k.impression_share, 0) / MOCK_KEYWORDS.length
        const ctr              = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0
        const cpc              = totalClicks > 0 ? totalSpend / totalClicks : 0
        return { avgQS, avgIS, ctr, cpc, totalImpressions, totalClicks }
    }, [campaigns])

    const qsColor = agg.avgQS >= 7 ? 'var(--status-complete)' : agg.avgQS >= 5 ? '#F59E0B' : 'var(--accent-red)'
    const qsStatus = agg.avgQS >= 7 ? 'Qualidade alta' : agg.avgQS >= 5 ? 'Qualidade média' : 'Qualidade baixa'

    return (
        <div>
            <p style={{ fontFamily: 'var(--font-sans)', fontSize: 11, fontWeight: 500, color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 4px' }}>
                Saúde da Conta
            </p>

            {/* Quality score big number */}
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, margin: '4px 0 10px' }}>
                <span style={{ fontFamily: 'var(--font-sans)', fontSize: 34, fontWeight: 600, color: qsColor, letterSpacing: '-1.5px', lineHeight: 1 }}>
                    {agg.avgQS.toFixed(1)}
                </span>
                <span style={{ fontFamily: 'var(--font-sans)', fontSize: 13, color: 'var(--color-text-tertiary)' }}>
                    / 10 quality score
                </span>
            </div>

            {/* QS bar */}
            <div style={{ marginBottom: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--color-text-tertiary)' }}>0</span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: '#F59E0B', opacity: 0.7 }}>limiar 5</span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--color-text-tertiary)' }}>10</span>
                </div>
                <div style={{ height: 5, background: 'var(--color-bg-tertiary)', borderRadius: 99, overflow: 'hidden', position: 'relative' }}>
                    <div style={{ position: 'absolute', left: '50%', right: 0, top: 0, bottom: 0, background: 'rgba(245,158,11,0.08)' }} />
                    <motion.div
                        style={{ height: '100%', background: qsColor, borderRadius: 99 }}
                        initial={{ width: '0%' }}
                        animate={{ width: `${(agg.avgQS / 10) * 100}%` }}
                        transition={{ duration: 0.8, ease: [0.4, 0, 0.2, 1] }}
                    />
                </div>
            </div>

            {/* Status badge */}
            <div style={{ marginBottom: 20, padding: '5px 10px', borderRadius: 6, background: `color-mix(in srgb, ${qsColor} 10%, transparent)`, border: `1px solid color-mix(in srgb, ${qsColor} 25%, transparent)`, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 5, height: 5, borderRadius: '50%', background: qsColor, flexShrink: 0 }} />
                <span style={{ fontFamily: 'var(--font-sans)', fontSize: 11, color: qsColor, fontWeight: 500 }}>{qsStatus}</span>
            </div>

            {/* Metrics grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px 20px' }}>
                {[
                    { label: 'IS Médio',        value: `${agg.avgIS.toFixed(0)}%` },
                    { label: 'CTR',             value: `${agg.ctr.toFixed(2)}%` },
                    { label: 'CPC Médio',       value: agg.cpc > 0 ? `R$ ${fmtBR(agg.cpc)}` : '—' },
                    { label: 'Impressões',      value: fmtBR(agg.totalImpressions) },
                ].map(({ label, value }) => (
                    <div key={label}>
                        <p style={{ fontFamily: 'var(--font-sans)', fontSize: 10, fontWeight: 500, color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 3px' }}>{label}</p>
                        <p style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-base)', fontWeight: 500, color: 'var(--color-text-primary)', letterSpacing: '-0.2px', margin: 0 }}>{value}</p>
                    </div>
                ))}
            </div>
        </div>
    )
}

// ── Google Ads — Keywords Matrix ──────────────────────────────────────────────

type KwSortKey = 'impressions' | 'clicks' | 'ctr' | 'cpc_brl' | 'conversions' | 'cpa_brl' | 'quality_score'
const MATCH_STYLE: Record<string, { label: string; color: string; bg: string }> = {
    Exata: { label: 'Exata',  color: '#22C55E', bg: 'rgba(34,197,94,0.10)'  },
    Frase: { label: 'Frase',  color: '#3B82F6', bg: 'rgba(59,130,246,0.10)' },
    Ampla: { label: 'Ampla',  color: '#F59E0B', bg: 'rgba(245,158,11,0.10)' },
}
const KW_GRID = '1.8fr 78px 140px 88px 72px 58px 68px 72px 72px'

function KeywordsMatrix() {
    const [sortBy, setSortBy] = useState<KwSortKey>('impressions')

    const sorted = useMemo(() =>
        [...MOCK_KEYWORDS].sort((a, b) => {
            if (sortBy === 'cpa_brl') {
                // Zero-conversions go to bottom
                if (a.cpa_brl === 0 && b.cpa_brl === 0) return 0
                if (a.cpa_brl === 0) return 1
                if (b.cpa_brl === 0) return -1
                return a.cpa_brl - b.cpa_brl
            }
            if (sortBy === 'cpc_brl') return a.cpc_brl - b.cpc_brl
            return (b[sortBy] as number) - (a[sortBy] as number)
        }),
    [sortBy])

    const SORT_BTNS: { key: KwSortKey; label: string }[] = [
        { key: 'impressions',  label: 'Impressões' },
        { key: 'clicks',       label: 'Cliques'    },
        { key: 'ctr',          label: 'CTR'        },
        { key: 'quality_score',label: 'QS'         },
        { key: 'conversions',  label: 'Conv.'      },
    ]

    return (
        <div>
            {/* Header row */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <div>
                    <p style={{ fontFamily: 'var(--font-sans)', fontSize: 11, fontWeight: 400, color: 'var(--color-text-secondary)', letterSpacing: '0.02em', textTransform: 'uppercase', margin: '0 0 4px' }}>
                        Matriz de Palavras-chave
                    </p>
                    <p style={{ fontFamily: 'var(--font-sans)', fontSize: 22, fontWeight: 500, color: 'var(--color-text-primary)', letterSpacing: '-0.4px', margin: 0 }}>
                        {MOCK_KEYWORDS.filter(k => k.conversions > 0).length} de {MOCK_KEYWORDS.length} palavras convertendo
                    </p>
                </div>
                <div style={{ display: 'flex', gap: 4 }}>
                    {SORT_BTNS.map(btn => (
                        <motion.button
                            key={btn.key}
                            whileTap={{ scale: 0.96 }}
                            onClick={() => setSortBy(btn.key)}
                            style={{
                                fontFamily: 'var(--font-sans)', fontSize: 11, fontWeight: 500,
                                padding: '4px 10px', borderRadius: 6, cursor: 'pointer',
                                background: sortBy === btn.key ? 'var(--color-primary)' : 'var(--color-bg-secondary)',
                                color: sortBy === btn.key ? '#fff' : 'var(--color-text-secondary)',
                                border: `1px solid ${sortBy === btn.key ? 'var(--color-primary)' : 'var(--color-border)'}`,
                                transition: 'all 0.15s ease',
                            }}
                        >{btn.label}</motion.button>
                    ))}
                </div>
            </div>

            {/* Table header */}
            <div style={{ display: 'grid', gridTemplateColumns: KW_GRID, gap: '0 12px', padding: '0 0 8px', borderBottom: '1px solid var(--color-border)', marginBottom: 4 }}>
                {['Palavra-chave', 'Corresp.', 'Campanha', 'Impr.', 'Cliques', 'CTR', 'CPC', 'Conv.', 'CPA'].map((h, i) => (
                    <TH key={h} align={i >= 3 ? 'right' : 'left'}>{h}</TH>
                ))}
            </div>

            {/* Rows */}
            {sorted.map((kw, idx) => {
                const ms = MATCH_STYLE[kw.match] || MATCH_STYLE['Ampla']
                const cpaColor = kw.conversions === 0
                    ? 'var(--color-text-tertiary)'
                    : kw.cpa_brl < 100 ? 'var(--status-complete)' : kw.cpa_brl < 180 ? '#F59E0B' : 'var(--accent-red)'
                const qsColor = kw.quality_score >= 7 ? 'var(--status-complete)' : kw.quality_score >= 5 ? '#F59E0B' : 'var(--accent-red)'

                return (
                    <motion.div
                        key={kw.keyword}
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.2, delay: idx * 0.04 }}
                        style={{
                            display: 'grid', gridTemplateColumns: KW_GRID, gap: '0 12px',
                            padding: '10px 0', borderBottom: '1px solid var(--color-border)',
                            alignItems: 'center',
                        }}
                    >
                        {/* Keyword */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, overflow: 'hidden' }}>
                            {/* QS dot */}
                            <span style={{ width: 6, height: 6, borderRadius: '50%', background: qsColor, flexShrink: 0 }} />
                            <span style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', color: 'var(--color-text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {kw.keyword}
                            </span>
                        </div>

                        {/* Match type */}
                        <span style={{ fontFamily: 'var(--font-sans)', fontSize: 10, fontWeight: 500, padding: '2px 7px', borderRadius: 5, background: ms.bg, color: ms.color, border: `1px solid ${ms.color}30`, whiteSpace: 'nowrap', width: 'fit-content' }}>
                            {ms.label}
                        </span>

                        {/* Campaign */}
                        <span style={{ fontFamily: 'var(--font-sans)', fontSize: 11, color: 'var(--color-text-tertiary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {kw.campaign}
                        </span>

                        {/* Numeric columns */}
                        <MetricCell value={kw.impressions} format="num" />
                        <MetricCell value={kw.clicks}      format="num" />
                        <MetricCell value={kw.ctr}         format="pct" />
                        <MetricCell value={kw.cpc_brl}     format="brl" />

                        {/* Conversions with bar */}
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
                            <span style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', color: kw.conversions > 0 ? 'var(--status-complete)' : 'var(--color-text-tertiary)' }}>
                                {kw.conversions > 0 ? kw.conversions : '—'}
                            </span>
                            {kw.conversions > 0 && (
                                <motion.div
                                    style={{ height: 2, background: 'var(--status-complete)', borderRadius: 99 }}
                                    initial={{ width: 0 }}
                                    animate={{ width: `${Math.min((kw.conversions / 4) * 100, 100)}%` }}
                                    transition={{ duration: 0.6, delay: idx * 0.04 }}
                                />
                            )}
                        </div>

                        {/* CPA */}
                        <span style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', color: cpaColor, textAlign: 'right' }}>
                            {kw.conversions > 0 ? `R$ ${fmtBR(kw.cpa_brl)}` : '—'}
                        </span>
                    </motion.div>
                )
            })}

            {/* Footer: QS legend */}
            <div style={{ display: 'flex', gap: 16, marginTop: 12, paddingTop: 10, borderTop: '1px solid var(--color-border)' }}>
                {[{ color: 'var(--status-complete)', label: 'QS 7–10: alta' }, { color: '#F59E0B', label: 'QS 5–6: média' }, { color: 'var(--accent-red)', label: 'QS 1–4: baixa' }].map(({ color, label }) => (
                    <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: color }} />
                        <span style={{ fontFamily: 'var(--font-sans)', fontSize: 10, color: 'var(--color-text-tertiary)' }}>{label}</span>
                    </div>
                ))}
            </div>
        </div>
    )
}

// ── Google Ads Page ───────────────────────────────────────────────────────────

function GoogleAdsContent({
    campaigns,
    channelPerf,
    trends,
    days,
    onOpenDrawer,
    loading,
    dateRange,
    setDateRange,
}: {
    campaigns: any[]
    channelPerf: any[]
    trends: Record<string, { roas: number[]; cac: number[] }>
    days: number
    onOpenDrawer: (c: any) => void
    loading: boolean
    dateRange: DateRange
    setDateRange: (r: DateRange) => void
}) {
    const ch = channelPerf.find(c => c.channel === 'Google Ads')
    const googleTrends = { google: trends.google || { roas: [], cac: [] } }

    const agg = useMemo(() => campaigns.reduce((acc, c) => ({
        spend:      acc.spend      + (c.spend_brl      || 0),
        revenue:    acc.revenue    + (c.purchase_value || 0),
        purchases:  acc.purchases  + (c.purchases      || 0),
        impressions:acc.impressions+ (c.impressions     || 0),
        clicks:     acc.clicks     + (c.clicks         || 0),
    }), { spend: 0, revenue: 0, purchases: 0, impressions: 0, clicks: 0 }), [campaigns])

    const roas = agg.spend > 0 && agg.revenue > 0 ? agg.revenue / agg.spend : 0
    const cpa  = agg.purchases > 0 ? agg.spend / agg.purchases : 0

    const kpisMetricas = [
        { label: 'Gasto',            value: agg.spend,   prefix: 'R$ ', decimals: 0 },
        { label: 'Receita Atribuída',value: agg.revenue, prefix: 'R$ ', decimals: 0 },
        { label: 'ROAS',             value: roas,        suffix: 'x',   decimals: 2 },
        { label: 'Custo por Compra', value: cpa,         prefix: 'R$ ', decimals: 0 },
    ]

    const searchKpis = useMemo(() => {
        const avgCtr = agg.impressions > 0 ? (agg.clicks / agg.impressions) * 100 : 0
        const avgCpc = agg.clicks > 0 ? agg.spend / agg.clicks : 0
        const avgIS  = MOCK_KEYWORDS.reduce((s, k) => s + k.impression_share, 0) / MOCK_KEYWORDS.length
        const avgQS  = MOCK_KEYWORDS.reduce((s, k) => s + k.quality_score, 0) / MOCK_KEYWORDS.length
        const totalConv = MOCK_KEYWORDS.reduce((s, k) => s + k.conversions, 0)
        return { avgCtr, avgCpc, avgIS, avgQS, totalConv }
    }, [agg])

    const lpvTotal = campaigns.reduce((s, c) => s + (c.landing_page_views || 0), 0)
    const funnelChannelPerf = ch ? [{ ...ch, landing_page_views: lpvTotal }] : []

    const [googleTab, setGoogleTab] = useState<'metricas' | 'gerenciador'>('metricas')

    const TABS = [
        { key: 'metricas',    label: 'Métricas'    },
        { key: 'gerenciador', label: 'Gerenciador' },
    ] as const

    return (
        <div>
            {/* Header */}
            <motion.div {...fadeUp(0)} style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
                <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                        <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#4285F4', flexShrink: 0 }} />
                        <span style={{ fontFamily: 'var(--font-sans)', fontSize: 11, color: 'var(--color-text-tertiary)', letterSpacing: '0.02em' }}>
                            Google Ads · {campaigns.length} campanha{campaigns.length !== 1 ? 's' : ''}
                        </span>
                    </div>
                    <h1 style={{ fontFamily: 'var(--font-sans)', fontWeight: 500, fontSize: 'var(--text-3xl)', letterSpacing: '-0.5px', color: 'var(--color-text-primary)', lineHeight: 1.1, margin: '0 0 5px' }}>
                        Google Ads
                    </h1>
                    <p style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-base)', color: 'var(--color-text-secondary)', margin: 0, letterSpacing: '-0.1px' }}>
                        {agg.impressions > 0 ? `${fmtBR(agg.impressions)} impressões no período` : 'Sem dados no período.'}
                    </p>
                </div>
                <DateRangePicker value={dateRange} onChange={setDateRange} />
            </motion.div>

            {/* Tab navbar */}
            <motion.div {...fadeUp(0.04)} style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 20, padding: '4px', background: 'var(--color-bg-secondary)', borderRadius: 10, width: 'fit-content', border: '1px solid var(--color-border)' }}>
                {TABS.map(tab => (
                    <motion.button
                        key={tab.key}
                        onClick={() => setGoogleTab(tab.key)}
                        whileTap={{ scale: 0.97 }}
                        style={{
                            fontFamily: 'var(--font-sans)', fontSize: 13,
                            fontWeight: googleTab === tab.key ? 500 : 400,
                            color: googleTab === tab.key ? 'var(--color-text-primary)' : 'var(--color-text-tertiary)',
                            background: googleTab === tab.key ? 'var(--color-bg-primary)' : 'transparent',
                            border: googleTab === tab.key ? '1px solid var(--color-border)' : '1px solid transparent',
                            borderRadius: 7, padding: '6px 16px', cursor: 'pointer',
                            transition: 'all 0.15s ease', letterSpacing: '-0.1px',
                        }}
                    >{tab.label}</motion.button>
                ))}
            </motion.div>

            <AnimatePresence mode="wait">
            {googleTab === 'metricas' ? (
                <motion.div key="metricas" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.25, ease: [0.25, 0.1, 0.25, 1] }}>
                    {/* KPIs */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 14 }}>
                        {kpisMetricas.map((k, i) => (
                            <KpiCard key={k.label} label={k.label} value={k.value} prefix={k.prefix} suffix={k.suffix} decimals={k.decimals} delay={i * 0.05} />
                        ))}
                    </div>

                    {/* ROAS Trend */}
                    <div style={{ marginBottom: 14 }}>
                        <SectionCard style={{ padding: '20px 24px 16px' }}>
                            <p style={{ fontFamily: 'var(--font-sans)', fontSize: 11, fontWeight: 400, color: 'var(--color-text-secondary)', letterSpacing: '0.02em', textTransform: 'uppercase', margin: '0 0 4px' }}>Tendência Diária</p>
                            <p style={{ fontFamily: 'var(--font-sans)', fontSize: 22, fontWeight: 500, letterSpacing: '-0.4px', color: roas >= 1 ? 'var(--status-complete)' : 'var(--accent-red)', margin: '0 0 16px' }}>
                                {roas > 0 ? `${roas.toFixed(2)}x ROAS` : '—'}
                            </p>
                            <DailyTrendChart trends={googleTrends} />
                        </SectionCard>
                    </div>

                    {/* 2-col: Search Account Health + Conversion Funnel */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
                        <SectionCard style={{ padding: '20px 24px' }}>
                            <SearchAccountHealth campaigns={campaigns} />
                        </SectionCard>
                        <SectionCard style={{ padding: '20px 24px' }}>
                            {funnelChannelPerf.length > 0 ? (
                                <ConversionFunnel channelPerf={funnelChannelPerf} campaigns={campaigns} />
                            ) : (
                                <p style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', color: 'var(--color-text-tertiary)', textAlign: 'center', padding: '24px 0' }}>Sem dados no período.</p>
                            )}
                        </SectionCard>
                    </div>

                    {/* Campaign Efficiency */}
                    <div>
                        <SectionCard style={{ padding: '20px 24px' }}>
                            <p style={{ fontFamily: 'var(--font-sans)', fontSize: 11, fontWeight: 400, color: 'var(--color-text-secondary)', letterSpacing: '0.02em', textTransform: 'uppercase', margin: '0 0 4px' }}>Eficiência de Campanhas</p>
                            <p style={{ fontFamily: 'var(--font-sans)', fontSize: 22, fontWeight: 500, color: 'var(--color-text-primary)', letterSpacing: '-0.4px', margin: '0 0 20px' }}>
                                {(() => {
                                    const sc = campaigns.filter(c => c.purchases > 0)
                                    return `${sc.filter(c => c.roas >= 1).length} de ${sc.length} campanhas lucrativas`
                                })()}
                            </p>
                            <CampaignEfficiencyChart campaigns={campaigns} />
                        </SectionCard>
                    </div>
                </motion.div>
            ) : (
                <motion.div key="gerenciador" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.25, ease: [0.25, 0.1, 0.25, 1] }}>
                    {/* Search-specific KPIs */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10, marginBottom: 14 }}>
                        <KpiCard label="Impressões"  value={agg.impressions}        decimals={0} delay={0}    />
                        <KpiCard label="Cliques"     value={agg.clicks}             decimals={0} delay={0.05} />
                        <KpiCard label="CTR"         value={searchKpis.avgCtr}      suffix="%"  decimals={2} delay={0.1}  />
                        <KpiCard label="CPC Médio"   value={searchKpis.avgCpc}      prefix="R$ " decimals={2} delay={0.15} />
                        <KpiCard label="Imp. Share"  value={searchKpis.avgIS}       suffix="%"  decimals={1} delay={0.2}  />
                    </div>

                    {/* Keywords matrix */}
                    <div style={{ marginBottom: 14 }}>
                        <SectionCard style={{ padding: '20px 24px' }}>
                            <KeywordsMatrix />
                        </SectionCard>
                    </div>

                    {/* Campaigns table */}
                    <div>
                        <SectionCard style={{ padding: '20px 24px' }}>
                            <CampaignsTable campaigns={campaigns} days={days} onOpenDrawer={onOpenDrawer} loading={loading} />
                        </SectionCard>
                    </div>
                </motion.div>
            )}
            </AnimatePresence>
        </div>
    )
}

// ── Channel Detail Content ────────────────────────────────────────────────────

export function ChannelDetailContent({
  platformKey,
  platformLabel,
  platformColor,
  campaigns,
  channelPerf,
  trends,
  days,
  onOpenDrawer,
  loading,
  dateRange,
  setDateRange,
}: {
  platformKey: string
  platformLabel: string
  platformColor: string
  campaigns: any[]
  channelPerf: any[]
  trends: Record<string, { roas: number[]; cac: number[] }>
  days: number
  onOpenDrawer: (c: any) => void
  loading: boolean
  dateRange: DateRange
  setDateRange: (r: DateRange) => void
}) {
  const ch = channelPerf.find(c => c.channel === platformLabel)
  const channelTrends = ch ? { [platformKey]: trends[platformKey] || { roas: [], cac: [] } } : {}

  const kpis = [
    { label: 'Gasto', value: ch?.spend ?? 0, prefix: 'R$ ', decimals: 0 },
    { label: 'Receita Atribuída', value: ch?.revenue ?? 0, prefix: 'R$ ', decimals: 0 },
    { label: 'ROAS', value: ch?.roas ?? 0, suffix: 'x', decimals: 2 },
    { label: 'Custo por Compra', value: ch?.cac ?? 0, prefix: 'R$ ', decimals: 0 },
  ]

  return (
    <div>
      {/* Channel header — same pattern as Dashboard/Vendas/Clientes */}
      <motion.div {...fadeUp(0)} style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: platformColor, flexShrink: 0 }} />
            <span style={{ fontFamily: 'var(--font-sans)', fontSize: 11, color: 'var(--color-text-tertiary)', letterSpacing: '0.02em' }}>
              {campaigns.length} campanha{campaigns.length !== 1 ? 's' : ''}
            </span>
          </div>
          <h1 style={{
            fontFamily: 'var(--font-sans)', fontWeight: 500, fontSize: 'var(--text-3xl)',
            letterSpacing: '-0.5px', color: 'var(--color-text-primary)', lineHeight: 1.1, margin: '0 0 5px',
          }}>{platformLabel}</h1>
          <p style={{
            fontFamily: 'var(--font-sans)', fontSize: 'var(--text-base)',
            color: 'var(--color-text-secondary)', margin: 0, letterSpacing: '-0.1px',
          }}>
            {ch ? (ch.impressions > 0 ? `${fmtBR(ch.impressions)} impressões no período` : 'Sem dados de impressão no período.') : 'Sem dados no período selecionado.'}
          </p>
        </div>
        <DateRangePicker value={dateRange} onChange={setDateRange} />
      </motion.div>

      {/* KPI grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 14 }}>
        {kpis.map((k, i) => (
          <KpiCard key={k.label} label={k.label} value={k.value} prefix={k.prefix} suffix={k.suffix} decimals={k.decimals} delay={i * 0.05} />
        ))}
      </div>

      {/* Metrics detail card */}
      {ch && (
        <SectionCard style={{ padding: '20px 24px', marginBottom: 14 }}>
          <p style={{
            fontFamily: 'var(--font-sans)', fontSize: 10, fontWeight: 500,
            color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em',
            margin: '0 0 16px',
          }}>Métricas do Canal</p>
          <ChannelKpiGrid ch={ch} />
        </SectionCard>
      )}

      {/* Charts row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
        <SectionCard style={{ padding: '20px 24px' }}>
          {ch ? (
            <ConversionFunnel
              channelPerf={[{
                ...ch,
                landing_page_views: campaigns.reduce((s: number, c: any) => s + (c.landing_page_views || 0), 0),
              }]}
              campaigns={campaigns}
            />
          ) : (
            <p style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', color: 'var(--color-text-tertiary)', textAlign: 'center', padding: '24px 0' }}>
              Sem dados no período.
            </p>
          )}
        </SectionCard>

        <SectionCard style={{ padding: '20px 24px' }}>
          <p style={{
            fontFamily: 'var(--font-sans)', fontSize: 10, fontWeight: 500,
            color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em',
            margin: '0 0 6px',
          }}>Tendência de ROAS</p>
          <p style={{
            fontFamily: 'var(--font-sans)', fontSize: 22, fontWeight: 500,
            letterSpacing: '-0.4px',
            color: ch && ch.roas >= 1 ? 'var(--status-complete)' : 'var(--color-text-primary)',
            margin: '0 0 20px',
          }}>
            {ch && ch.roas > 0 ? `${ch.roas.toFixed(2)}x` : '—'}
          </p>
          <DailyTrendChart trends={channelTrends} />
        </SectionCard>
      </div>

      {/* Top ads */}
      {campaigns.length > 0 && (
        <SectionCard style={{ padding: '20px 24px', marginBottom: 14 }}>
          <p style={{
            fontFamily: 'var(--font-sans)', fontSize: 10, fontWeight: 500,
            color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em',
            margin: '0 0 16px',
          }}>Top Anúncios</p>
          <TopAdsTable campaigns={campaigns} days={days} />
        </SectionCard>
      )}

      {/* Campaigns table */}
      <SectionCard style={{ padding: '20px 24px' }}>
        <CampaignsTable campaigns={campaigns} days={days} onOpenDrawer={onOpenDrawer} loading={loading} />
      </SectionCard>
    </div>
  )
}

// ── Main Page ──────────────────────────────────────────────────────────────────

function defaultRange(): DateRange {
  const end = new Date()
  end.setHours(0, 0, 0, 0)
  const start = new Date(end)
  start.setDate(start.getDate() - 29)
  return { start, end, label: 'Últimos 30 dias' }
}

export default function Canais({ onToggleChat, channelView }: { onToggleChat?: () => void; channelView?: 'meta' | 'google' }) {
    const [rawCampaigns, setRawCampaigns] = useState<any[]>(MOCK_CAMPAIGNS)
    const [trends, setTrends] = useState<Record<string, { roas: number[]; cac: number[] }>>(MOCK_TRENDS)
    const [loading, setLoading] = useState(false)
    const [dateRange, setDateRange] = useState<DateRange>(defaultRange)
    const [drawerCamp, setDrawerCamp] = useState<any>(null)

    const periodDays = useMemo(
        () => Math.round((dateRange.end.getTime() - dateRange.start.getTime()) / 86400000) + 1,
        [dateRange]
    )

    useEffect(() => {
        setLoading(true)
        Promise.all([
            dashboardApi.getAdCampaigns(periodDays),
            dashboardApi.getChannelTrends(),
        ])
            .then(([campRes, trendsRes]) => {
                if (Array.isArray(campRes.data) && campRes.data.length > 0) setRawCampaigns(campRes.data)
                if (trendsRes.data && Object.keys(trendsRes.data).length > 0) setTrends(trendsRes.data)
            })
            .catch(() => {})
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

    const metaCampaigns = rawCampaigns.filter(c => c.platform === 'meta')
    const googleCampaigns = rawCampaigns.filter(c => c.platform === 'google')

    return (
        <div>
            <TopBar onToggleChat={onToggleChat} />

            <AnimatePresence mode="wait">
                <motion.div
                    key={channelView ?? 'overview'}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
                >
                    {!channelView ? (
                                /* ── Visão Geral ── */
                                <div>
                                    {/* Page header */}
                                    <motion.div {...fadeUp(0)} style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 }}>
                                        <div>
                                            <h1 style={{
                                                fontFamily: 'var(--font-sans)', fontWeight: 500, fontSize: 'var(--text-3xl)',
                                                letterSpacing: '-0.5px', color: 'var(--color-text-primary)', lineHeight: 1.1, margin: '0 0 5px',
                                            }}>Canais</h1>
                                            <p style={{
                                                fontFamily: 'var(--font-sans)', fontSize: 'var(--text-base)',
                                                color: 'var(--color-text-secondary)', margin: 0, letterSpacing: '-0.1px',
                                            }}>Análise unificada de todos os seus canais de aquisição.</p>
                                        </div>
                                        <DateRangePicker value={dateRange} onChange={setDateRange} />
                                    </motion.div>

                                    {/* KPI grid */}
                                    <motion.div {...fadeUp(0.06)} style={{ display: 'grid', gridTemplateColumns: `repeat(${totals.leads > 0 ? 5 : 4}, 1fr)`, gap: 10, marginBottom: 14 }}>
                                        <KpiCard label="Gasto Total" value={totals.spend} prefix="R$ " decimals={0} delay={0.08} />
                                        <KpiCard label="Receita Atribuída" value={totals.revenue} prefix="R$ " decimals={0} delay={0.13} />
                                        <KpiCard label="ROAS" value={avgRoas} suffix="x" decimals={2} delay={0.18} />
                                        <KpiCard label="Custo por Compra" value={avgCac} prefix="R$ " decimals={0} delay={0.23} />
                                        {totals.leads > 0 && <KpiCard label="Custo por Lead" value={avgCpl} prefix="R$ " decimals={2} delay={0.28} />}
                                    </motion.div>

                                    {/* Large trend chart — full width */}
                                    {!loading && rawCampaigns.length > 0 && (
                                        <motion.div {...fadeUp(0.14)} style={{ marginBottom: 14 }}>
                                            <SectionCard style={{ padding: '20px 24px 16px' }}>
                                                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 4 }}>
                                                    <div>
                                                        <p style={{
                                                            fontFamily: 'var(--font-sans)', fontSize: 11, fontWeight: 400,
                                                            color: 'var(--color-text-secondary)', letterSpacing: '0.02em',
                                                            textTransform: 'uppercase', margin: '0 0 4px',
                                                        }}>
                                                            Tendência Diária
                                                        </p>
                                                        <p style={{
                                                            fontFamily: 'var(--font-sans)', fontSize: 22, fontWeight: 500,
                                                            letterSpacing: '-0.4px',
                                                            color: avgRoas >= 1 ? 'var(--status-complete)' : 'var(--accent-red)',
                                                            margin: 0,
                                                        }}>
                                                            {avgRoas > 0 ? `${avgRoas.toFixed(2)}x ROAS` : '—'}
                                                        </p>
                                                    </div>
                                                </div>
                                                <DailyTrendChart trends={trends} />
                                            </SectionCard>
                                        </motion.div>
                                    )}

                                    {/* 2-col: Spend Distribution + Conversion Funnel */}
                                    {!loading && rawCampaigns.length > 0 && (
                                        <motion.div {...fadeUp(0.2)} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
                                            <SectionCard style={{ padding: '20px 24px' }}>
                                                <p style={{ fontFamily: 'var(--font-sans)', fontSize: 11, fontWeight: 400, color: 'var(--color-text-secondary)', letterSpacing: '0.02em', textTransform: 'uppercase', margin: '0 0 4px' }}>Distribuição de Gasto</p>
                                                <p style={{ fontFamily: 'var(--font-sans)', fontSize: 22, fontWeight: 500, color: 'var(--color-text-primary)', letterSpacing: '-0.4px', margin: '0 0 20px' }}>
                                                    R$ {fmtBR(totals.spend)}
                                                </p>
                                                <SpendDistribution channelPerf={channelPerf} totalSpend={totals.spend} />
                                            </SectionCard>

                                            <SectionCard style={{ padding: '20px 24px' }}>
                                                <ConversionFunnel
                                                    channelPerf={channelPerf.map(ch => ({
                                                        ...ch,
                                                        landing_page_views: rawCampaigns
                                                            .filter(c => (c.platform === 'meta' && ch.channel === 'Meta Ads') || (c.platform === 'google' && ch.channel === 'Google Ads'))
                                                            .reduce((s: number, c: any) => s + (c.landing_page_views || 0), 0)
                                                    }))}
                                                    campaigns={rawCampaigns.filter(c => c.impressions > 0)}
                                                />
                                            </SectionCard>
                                        </motion.div>
                                    )}

                                    {/* ROAS vs Spend scatter — full width */}
                                    {!loading && rawCampaigns.length > 0 && (
                                        <motion.div {...fadeUp(0.26)} style={{ marginBottom: 14 }}>
                                            <SectionCard style={{ padding: '20px 24px' }}>
                                                <p style={{ fontFamily: 'var(--font-sans)', fontSize: 11, fontWeight: 400, color: 'var(--color-text-secondary)', letterSpacing: '0.02em', textTransform: 'uppercase', margin: '0 0 4px' }}>Eficiência de Campanhas</p>
                                                <p style={{ fontFamily: 'var(--font-sans)', fontSize: 22, fontWeight: 500, color: 'var(--color-text-primary)', letterSpacing: '-0.4px', margin: '0 0 20px' }}>
                                                    {(() => {
                                                        const salesC = rawCampaigns.filter(c => c.spend_brl > 0 && c.purchases > 0)
                                                        const profitable = salesC.filter(c => c.roas >= 1).length
                                                        const leadC = rawCampaigns.filter(c => c.spend_brl > 0 && c.leads > 0 && c.purchases === 0)
                                                        if (salesC.length > 0 && leadC.length > 0) return `${profitable}/${salesC.length} conversão · ${leadC.length} de leads`
                                                        if (salesC.length > 0) return `${profitable} de ${salesC.length} campanhas lucrativas`
                                                        return `${leadC.length} campanha${leadC.length !== 1 ? 's' : ''} de geração de leads`
                                                    })()}
                                                </p>
                                                <CampaignEfficiencyChart campaigns={rawCampaigns} />
                                            </SectionCard>
                                        </motion.div>
                                    )}

                                </div>

                            ) : channelView === 'meta' ? (
                                <MetaAdsContent
                                    campaigns={metaCampaigns}
                                    channelPerf={channelPerf}
                                    trends={trends}
                                    days={periodDays}
                                    onOpenDrawer={setDrawerCamp}
                                    loading={loading}
                                    dateRange={dateRange}
                                    setDateRange={setDateRange}
                                />
                            ) : channelView === 'google' ? (
                                <GoogleAdsContent
                                    campaigns={googleCampaigns}
                                    channelPerf={channelPerf}
                                    trends={trends}
                                    days={periodDays}
                                    onOpenDrawer={setDrawerCamp}
                                    loading={loading}
                                    dateRange={dateRange}
                                    setDateRange={setDateRange}
                                />
                            ) : null}
                </motion.div>
            </AnimatePresence>

            {/* Campaign Detail Drawer */}
            <AnimatePresence>
                {drawerCamp && (
                    <CampaignDrawer key={drawerCamp.campaign_id} camp={drawerCamp} days={periodDays} onClose={() => setDrawerCamp(null)} />
                )}
            </AnimatePresence>
        </div>
    )
}
