import { motion, AnimatePresence } from 'framer-motion'
import { KpiCard } from '../components/ui/KpiCard'
import TopBar from '../components/layout/TopBar'
import ChannelSparkline from '../components/charts/ChannelSparkline'
import { useState, useEffect, useMemo } from 'react'
import { dashboardApi } from '../lib/api'
import { fmtBR } from '../lib/utils'

// ── Primitives ─────────────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
    return (
        <p style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', fontWeight: 500, color: 'var(--color-text-secondary)', letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 20 }}>
            {children}
        </p>
    )
}

function TH({ children, align = 'left' }: { children: React.ReactNode; align?: 'left' | 'right' }) {
    return (
        <span style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-xs)', fontWeight: 500, color: 'var(--color-text-tertiary)', letterSpacing: '0.04em', textTransform: 'uppercase', textAlign: align }}>
            {children}
        </span>
    )
}

function ChartCard({ children }: { children: React.ReactNode }) {
    return (
        <div style={{ background: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', padding: '20px 24px' }}>
            {children}
        </div>
    )
}

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

// ── Objective label ────────────────────────────────────────────────────────────

const OBJECTIVE_LABELS: Record<string, string> = {
    OUTCOME_LEADS: 'Geração de Leads',
    OUTCOME_SALES: 'Vendas',
    OUTCOME_TRAFFIC: 'Tráfego',
    OUTCOME_AWARENESS: 'Reconhecimento',
    OUTCOME_ENGAGEMENT: 'Engajamento',
    OUTCOME_APP_PROMOTION: 'Promoção de App',
    LEAD_GENERATION: 'Geração de Leads',
    CONVERSIONS: 'Conversões',
    LINK_CLICKS: 'Cliques no Link',
    REACH: 'Alcance',
    BRAND_AWARENESS: 'Reconhecimento de Marca',
    VIDEO_VIEWS: 'Visualizações de Vídeo',
    PAGE_LIKES: 'Curtidas na Página',
    POST_ENGAGEMENT: 'Engajamento',
}

// ── Result type label ──────────────────────────────────────────────────────────

function resultLabel(type: string): string {
    if (type === 'purchase') return 'Compras'
    if (type === 'lead') return 'Leads'
    if (type === 'link_click') return 'Cliques no Link'
    return 'Resultados'
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
    const rType = resultLabel(camp.result_type)

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', justifyContent: 'flex-end' }}
        >
            {/* Backdrop */}
            <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.18)' }} />

            {/* Drawer */}
            <motion.div
                initial={{ x: 560 }}
                animate={{ x: 0 }}
                exit={{ x: 560 }}
                transition={{ ease: [0.4, 0, 0.2, 1], duration: 0.3 }}
                style={{
                    position: 'relative', width: 560, height: '100%',
                    background: 'var(--color-bg-primary)',
                    borderLeft: '1px solid var(--color-border)',
                    overflowY: 'auto', display: 'flex', flexDirection: 'column',
                }}
            >
                {/* Header */}
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
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                        </button>
                    </div>
                </div>

                <div style={{ padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: 28 }}>

                    {/* Resultado principal */}
                    {camp.results > 0 && (
                        <div style={{ background: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', padding: '16px 20px' }}>
                            <p style={{ fontFamily: 'var(--font-sans)', fontSize: 10, fontWeight: 500, color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>
                                Resultado Principal — {rType}
                            </p>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20 }}>
                                <DrawerMetric label={rType} value={camp.results?.toLocaleString('pt-BR')} />
                                <DrawerMetric label={`Custo por ${rType.slice(0, -1)}`} value={camp.cost_per_result > 0 ? `R$ ${fmtBR(camp.cost_per_result)}` : '—'} />
                                {camp.purchase_value > 0 && <DrawerMetric label="ROAS" value={camp.roas > 0 ? `${camp.roas}x` : '—'} />}
                                {camp.purchase_value > 0 && <DrawerMetric label="Receita Atribuída" value={`R$ ${fmtBR(camp.purchase_value)}`} />}
                            </div>
                        </div>
                    )}

                    {/* Métricas de distribuição */}
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

                    {/* Métricas de clique */}
                    <div>
                        <p style={{ fontFamily: 'var(--font-sans)', fontSize: 10, fontWeight: 500, color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 16 }}>Cliques e Engajamento</p>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20 }}>
                            <DrawerMetric label="Cliques (todos)" value={camp.clicks >= 1000 ? fmtBR(camp.clicks) : camp.clicks} />
                            <DrawerMetric label="CPC" value={camp.cpc_brl > 0 ? `R$ ${fmtBR(camp.cpc_brl)}` : '—'} />
                            <DrawerMetric label="Cliques no Link" value={camp.link_clicks > 0 ? camp.link_clicks.toLocaleString('pt-BR') : '—'} />
                            <DrawerMetric label="Visualizações da Pág." value={camp.landing_page_views > 0 ? camp.landing_page_views.toLocaleString('pt-BR') : '—'} />
                            <DrawerMetric label="Leads" value={camp.leads > 0 ? camp.leads.toLocaleString('pt-BR') : '—'} />
                            <DrawerMetric label="Views de Vídeo" value={camp.video_views > 0 ? camp.video_views.toLocaleString('pt-BR') : '—'} />
                        </div>
                    </div>

                    {/* Conjuntos de anúncios */}
                    <div>
                        <p style={{ fontFamily: 'var(--font-sans)', fontSize: 10, fontWeight: 500, color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>
                            Conjuntos de Anúncios
                        </p>
                        {loading ? (
                            <p style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', color: 'var(--color-text-tertiary)' }}>Carregando...</p>
                        ) : (detail?.adsets || []).length === 0 ? (
                            <p style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', color: 'var(--color-text-tertiary)' }}>Sem dados no período.</p>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                {(detail?.adsets || []).map(adset => {
                                    const ads = (detail?.ads || []).filter(a => a.adset_id === adset.adset_id)
                                    const open = expandedAdsets.has(adset.adset_id)
                                    return (
                                        <div key={adset.adset_id} style={{ border: '1px solid var(--color-border)', borderRadius: 8, overflow: 'hidden' }}>
                                            <div
                                                onClick={() => ads.length > 0 && toggleAdset(adset.adset_id)}
                                                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: 'var(--color-bg-secondary)', cursor: ads.length > 0 ? 'pointer' : 'default', gap: 8 }}
                                            >
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
                                                    {ads.length > 0 && (
                                                        <motion.span animate={{ rotate: open ? 90 : 0 }} transition={{ duration: 0.15 }} style={{ fontSize: 9, color: 'var(--color-text-tertiary)', flexShrink: 0 }}>▶</motion.span>
                                                    )}
                                                    <span style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', color: 'var(--color-text-primary)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{adset.adset_name}</span>
                                                    <StatusTag status={adset.status} />
                                                </div>
                                                <div style={{ display: 'flex', gap: 16, flexShrink: 0 }}>
                                                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)' }}>R$ {fmtBR(adset.spend_brl)}</span>
                                                    {adset.results > 0 && <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)' }}>{adset.results} res.</span>}
                                                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)' }}>{adset.impressions?.toLocaleString('pt-BR')} imp.</span>
                                                </div>
                                            </div>
                                            <AnimatePresence>
                                                {open && ads.map(ad => (
                                                    <motion.div key={ad.ad_id} initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.15 }} style={{ overflow: 'hidden' }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 14px 8px 34px', borderTop: '1px solid var(--color-border)', gap: 8 }}>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, minWidth: 0 }}>
                                                                <span style={{ color: 'var(--color-text-tertiary)', fontSize: 9, flexShrink: 0 }}>◦</span>
                                                                <span style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ad.ad_name}</span>
                                                                <StatusTag status={ad.status} />
                                                            </div>
                                                            <div style={{ display: 'flex', gap: 16, flexShrink: 0 }}>
                                                                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)' }}>R$ {fmtBR(ad.spend_brl)}</span>
                                                                {ad.results > 0 && <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)' }}>{ad.results} res.</span>}
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

// ── Table grid — Name | Status | Objetivo | Resultados | Custo/Res | Gasto | Imp | Alcance | CTR | Freq ──
const GRID = 'minmax(180px,1fr) 80px 110px 80px 90px 90px 80px 70px 60px 60px'

// ── Expandable campaign row ────────────────────────────────────────────────────

function CampaignRow({ camp, days, onOpenDrawer }: { camp: any; days: number; onOpenDrawer: (c: any) => void }) {
    const [expanded, setExpanded] = useState(false)
    const [detail, setDetail] = useState<{ adsets: any[]; ads: any[] } | null>(null)
    const [loadingDetail, setLoadingDetail] = useState(false)
    const [expandedAdsets, setExpandedAdsets] = useState<Set<string>>(new Set())

    const toggle = async () => {
        // Expandir/colapsar filhos na linha
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

    const rType = resultLabel(camp.result_type)

    return (
        <>
            <motion.div
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25 }}
                className="notion-row"
                style={{ display: 'grid', gridTemplateColumns: GRID, gap: '0 12px', alignItems: 'center', cursor: 'pointer' }}
                onClick={toggle}
            >
                {/* Name */}
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

                {/* Objetivo */}
                <span style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {OBJECTIVE_LABELS[camp.objective] || camp.objective || '—'}
                </span>

                {/* Resultados */}
                <div style={{ textAlign: 'right' }}>
                    {camp.results > 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 1 }}>
                            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-sm)', color: 'var(--color-text-primary)', fontWeight: 500 }}>{camp.results.toLocaleString('pt-BR')}</span>
                            <span style={{ fontFamily: 'var(--font-sans)', fontSize: 9, color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{rType}</span>
                        </div>
                    ) : <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-sm)', color: 'var(--color-text-tertiary)' }}>—</span>}
                </div>

                {/* Custo por resultado */}
                <MetricCell value={camp.cost_per_result} format="brl" />
                <MetricCell value={camp.spend_brl} format="brl" />
                <MetricCell value={camp.impressions} format="num" />
                <MetricCell value={camp.reach} format="num" />
                <MetricCell value={camp.ctr} format="pct" />
                <MetricCell value={camp.frequency} format="x" />
            </motion.div>

            {/* Adsets */}
            <AnimatePresence>
                {expanded && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.2 }} style={{ overflow: 'hidden' }}>
                        {loadingDetail ? (
                            <div style={{ paddingLeft: 36, paddingTop: 8, paddingBottom: 8, fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', color: 'var(--color-text-tertiary)' }}>Carregando conjuntos...</div>
                        ) : (detail?.adsets || []).map(adset => {
                            const adsetExpanded = expandedAdsets.has(adset.adset_id)
                            const adsForAdset = (detail?.ads || []).filter(a => a.adset_id === adset.adset_id)
                            return (
                                <div key={adset.adset_id}>
                                    <div
                                        className="notion-row"
                                        style={{ display: 'grid', gridTemplateColumns: GRID, gap: '0 12px', alignItems: 'center', cursor: adsForAdset.length > 0 ? 'pointer' : 'default', background: 'var(--color-bg-secondary)' }}
                                        onClick={() => adsForAdset.length > 0 && toggleAdset(adset.adset_id)}
                                    >
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, paddingLeft: 28, overflow: 'hidden' }}>
                                            {adsForAdset.length > 0 ? (
                                                <motion.span animate={{ rotate: adsetExpanded ? 90 : 0 }} transition={{ duration: 0.15 }} style={{ color: 'var(--color-text-tertiary)', fontSize: 10, flexShrink: 0 }}>▶</motion.span>
                                            ) : <span style={{ width: 10, flexShrink: 0 }} />}
                                            <span style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{adset.adset_name}</span>
                                        </div>
                                        <div><StatusTag status={adset.status} /></div>
                                        <span />
                                        <div style={{ textAlign: 'right' }}>
                                            {adset.results > 0 ? <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)' }}>{adset.results.toLocaleString('pt-BR')}</span> : <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-sm)', color: 'var(--color-text-tertiary)' }}>—</span>}
                                        </div>
                                        <MetricCell value={adset.cost_per_result} format="brl" />
                                        <MetricCell value={adset.spend_brl} format="brl" />
                                        <MetricCell value={adset.impressions} format="num" />
                                        <MetricCell value={adset.reach} format="num" />
                                        <MetricCell value={adset.ctr} format="pct" />
                                        <MetricCell value={adset.frequency} format="x" />
                                    </div>
                                    <AnimatePresence>
                                        {adsetExpanded && adsForAdset.map(ad => (
                                            <motion.div key={ad.ad_id} initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.15 }} style={{ overflow: 'hidden' }}>
                                                <div className="notion-row" style={{ display: 'grid', gridTemplateColumns: GRID, gap: '0 12px', alignItems: 'center', cursor: 'default' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, paddingLeft: 56, overflow: 'hidden' }}>
                                                        <span style={{ color: 'var(--color-text-tertiary)', fontSize: 10, flexShrink: 0 }}>◦</span>
                                                        <span style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ad.ad_name}</span>
                                                    </div>
                                                    <div><StatusTag status={ad.status} /></div>
                                                    <span />
                                                    <div style={{ textAlign: 'right' }}>
                                                        {ad.results > 0 ? <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-sm)', color: 'var(--color-text-tertiary)' }}>{ad.results.toLocaleString('pt-BR')}</span> : <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-sm)', color: 'var(--color-text-tertiary)' }}>—</span>}
                                                    </div>
                                                    <MetricCell value={ad.cost_per_result} format="brl" />
                                                    <MetricCell value={ad.spend_brl} format="brl" />
                                                    <MetricCell value={ad.impressions} format="num" />
                                                    <MetricCell value={ad.reach} format="num" />
                                                    <MetricCell value={ad.ctr} format="pct" />
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

// ── Main Page ──────────────────────────────────────────────────────────────────

const PERIOD_OPTIONS = [
    { label: '7d', value: 7 },
    { label: '30d', value: 30 },
    { label: '90d', value: 90 },
    { label: '365d', value: 365 },
    { label: 'Tudo', value: 0 },
]

export default function Canais({ onToggleChat }: { onToggleChat?: () => void }) {
    const [performance, setPerformance] = useState<any[]>([])
    const [trends, setTrends] = useState<any>(null)
    const [campaigns, setCampaigns] = useState<any[]>([])
    const [, setLoading] = useState(true)
    const [periodDays, setPeriodDays] = useState(365)
    const [campaignsLoading, setCampaignsLoading] = useState(false)
    const [drawerCamp, setDrawerCamp] = useState<any>(null)

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [perfRes, trendsRes] = await Promise.all([dashboardApi.getAttribution(), dashboardApi.getChannelTrends()])
                setPerformance(perfRes.data)
                setTrends(trendsRes.data)
            } catch { } finally { setLoading(false) }
        }
        fetchData()
    }, [])

    useEffect(() => {
        const fetchCampaigns = async () => {
            setCampaignsLoading(true)
            try {
                const res = await dashboardApi.getAdCampaigns(periodDays)
                setCampaigns(res.data)
            } catch { } finally { setCampaignsLoading(false) }
        }
        fetchCampaigns()
    }, [periodDays])

    const totals = useMemo(() => {
        const fromCampaigns = campaigns.reduce(
            (acc: any, c: any) => ({
                spend: acc.spend + (c.spend_brl || 0),
                revenue: acc.revenue + (c.purchase_value || 0),
                purchases: acc.purchases + (c.purchases || 0),
            }),
            { spend: 0, revenue: 0, purchases: 0 }
        )
        // fallback to attribution data for customers count
        const customers = performance.reduce((acc: any, curr: any) => acc + curr.customers, 0)
        return { ...fromCampaigns, customers }
    }, [campaigns, performance])
    const avgRoas = totals.spend > 0 ? totals.revenue / totals.spend : 0
    const avgCac = totals.purchases > 0 ? totals.spend / totals.purchases : 0

    return (
        <div style={{ paddingTop: 28, paddingBottom: 80 }}>
            <TopBar onToggleChat={onToggleChat} />

            <motion.h1 initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: [0.25, 0.1, 0.25, 1] }} style={{ fontFamily: 'var(--font-display)', fontWeight: 400, fontSize: 40, letterSpacing: '-1.6px', color: 'var(--fg)', lineHeight: 1, margin: 0 }}>
                Canais
            </motion.h1>

            {/* KPIs */}
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3, delay: 0.1 }} style={{ display: 'flex', gap: 48, alignItems: 'center', flexWrap: 'wrap', marginTop: 40 }}>
                <KpiCard label="GASTO TOTAL ADS" value={totals.spend} prefix="R$ " decimals={0} delay={0.15} />
                <KpiCard label="RECEITA ATRIBUÍDA" value={totals.revenue} prefix="R$ " decimals={0} delay={0.25} />
                <KpiCard label="ROAS MÉDIO" value={avgRoas} suffix="x" decimals={2} delay={0.35} />
                <KpiCard label="CUSTO POR COMPRA" value={avgCac} prefix="R$ " decimals={1} delay={0.45} />
                <KpiCard label="CANAIS ATIVOS" value={performance.length} decimals={0} delay={0.55} />
            </motion.div>

            <div style={{ height: 1, background: 'var(--color-border)', margin: '52px 0 48px' }} />

            {/* Performance por Canal */}
            <div>
                <SectionLabel>Performance por Canal</SectionLabel>
                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(160px,1fr) 100px 120px 80px 90px 90px 110px', gap: '0 16px', paddingBottom: 10, borderBottom: '1px solid var(--color-border)', marginBottom: 2 }}>
                    <TH>Canal</TH><TH align="right">Gasto</TH><TH align="right">Receita Atr.</TH><TH align="right">ROAS</TH><TH align="right">CAC</TH><TH align="right">Clientes</TH><TH align="right">LTV Médio</TH>
                </div>
                {performance.map((ch: any, i: number) => (
                    <motion.div key={ch.channel} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: i * 0.04 + 0.2 }} className="notion-row" style={{ display: 'grid', gridTemplateColumns: 'minmax(160px,1fr) 100px 120px 80px 90px 90px 110px', gap: '0 16px', alignItems: 'center', cursor: 'default' }} onHoverStart={e => (e.target as HTMLElement).style.background = 'var(--color-bg-secondary)'} onHoverEnd={e => (e.target as HTMLElement).style.background = 'transparent'}>
                        <span style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-base)', fontWeight: 500, color: 'var(--color-text-primary)', textTransform: 'capitalize' }}>{ch.channel.replace(/_/g, ' ')}</span>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-sm)', color: 'var(--color-text-tertiary)', textAlign: 'right' }}>{ch.spend > 0 ? `R$ ${fmtBR(ch.spend)}` : '—'}</span>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)', textAlign: 'right', fontWeight: 500 }}>R$ {fmtBR(ch.revenue)}</span>
                        {ch.roas > 0 ? (<div style={{ textAlign: 'right' }}><span className={ch.roas >= 3 ? 'tag tag-complete' : 'tag tag-planning'} style={{ fontFamily: 'var(--font-mono)' }}>{ch.roas.toFixed(1)}x</span></div>) : (<span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-sm)', color: 'var(--color-text-tertiary)', textAlign: 'right' }}>—</span>)}
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)', textAlign: 'right' }}>{ch.cac > 0 ? `R$ ${fmtBR(ch.cac)}` : '—'}</span>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-sm)', color: 'var(--color-text-primary)', textAlign: 'right' }}>{ch.customers}</span>
                        <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
                            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-sm)', color: ch.ltv >= 1000 ? 'var(--status-complete)' : 'var(--color-text-secondary)', fontWeight: ch.ltv >= 1000 ? 500 : 400 }}>R$ {fmtBR(ch.ltv)}</span>
                            {ch.ltv > 1000 && <span className="tag tag-complete" style={{ fontSize: 9, padding: '1px 5px' }}>HIGH VALUE</span>}
                        </div>
                    </motion.div>
                ))}
            </div>

            {/* Charts */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 32, marginTop: 56 }}>
                <div>
                    <SectionLabel>ROAS por Canal ao longo do tempo</SectionLabel>
                    <ChartCard>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                            {trends ? [
                                { name: 'Google', data: trends.google.roas, val: `${trends.google.roas[14]}x`, good: trends.google.roas[14] >= 3 },
                                { name: 'Meta Ads', data: trends.meta.roas, val: `${trends.meta.roas[14]}x`, good: trends.meta.roas[14] >= 3 },
                            ].map((item: any) => (
                                <div key={item.name} style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                                    <span style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-xs)', fontWeight: 500, color: 'var(--color-text-secondary)', width: 64, flexShrink: 0 }}>{item.name}</span>
                                    <div style={{ flex: 1 }}><ChannelSparkline data={item.data} id={`roas-${item.name}`} /></div>
                                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-sm)', fontWeight: 500, width: 40, textAlign: 'right', color: item.good ? 'var(--status-complete)' : 'var(--color-text-secondary)', flexShrink: 0 }}>{item.val}</span>
                                </div>
                            )) : <p style={{ fontFamily: 'var(--font-sans)', color: 'var(--color-text-tertiary)', fontSize: 'var(--text-sm)' }}>Sem dados no período</p>}
                        </div>
                    </ChartCard>
                </div>
                <div>
                    <SectionLabel>CAC por Canal ao longo do tempo</SectionLabel>
                    <ChartCard>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                            {trends ? [
                                { name: 'Google', data: trends.google.cac, val: `R$ ${fmtBR(trends.google.cac[14])}` },
                                { name: 'Meta Ads', data: trends.meta.cac, val: `R$ ${fmtBR(trends.meta.cac[14])}` },
                            ].map((item: any) => (
                                <div key={item.name} style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                                    <span style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-xs)', fontWeight: 500, color: 'var(--color-text-secondary)', width: 64, flexShrink: 0 }}>{item.name}</span>
                                    <div style={{ flex: 1 }}><ChannelSparkline data={item.data} id={`cac-${item.name}`} /></div>
                                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-sm)', fontWeight: 500, width: 60, textAlign: 'right', color: 'var(--color-text-secondary)', flexShrink: 0 }}>{item.val}</span>
                                </div>
                            )) : <p style={{ fontFamily: 'var(--font-sans)', color: 'var(--color-text-tertiary)', fontSize: 'var(--text-sm)' }}>Sem dados no período</p>}
                        </div>
                    </ChartCard>
                </div>
            </div>

            {/* Campanhas */}
            <div style={{ marginTop: 56 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                    <p style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', fontWeight: 500, color: 'var(--color-text-secondary)', letterSpacing: '0.04em', textTransform: 'uppercase', margin: 0 }}>Campanhas</p>
                    <div style={{ display: 'flex', gap: 4 }}>
                        {PERIOD_OPTIONS.map(opt => (
                            <button key={opt.value} onClick={() => setPeriodDays(opt.value)} style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-xs)', fontWeight: 500, padding: '4px 10px', borderRadius: 6, border: '1px solid', cursor: 'pointer', transition: 'all 0.15s', background: periodDays === opt.value ? 'var(--color-text-primary)' : 'transparent', color: periodDays === opt.value ? 'var(--color-bg-primary)' : 'var(--color-text-tertiary)', borderColor: periodDays === opt.value ? 'var(--color-text-primary)' : 'var(--color-border)' }}>{opt.label}</button>
                        ))}
                    </div>
                </div>

                {campaignsLoading ? (
                    <div style={{ color: 'var(--color-text-tertiary)', fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', paddingTop: 12 }}>Carregando campanhas...</div>
                ) : campaigns.length === 0 ? (
                    <p style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-base)', color: 'var(--color-text-tertiary)' }}>Nenhuma campanha encontrada no período.</p>
                ) : (
                    <>
                        <div style={{ display: 'grid', gridTemplateColumns: GRID, gap: '0 12px', paddingBottom: 10, borderBottom: '1px solid var(--color-border)', marginBottom: 2 }}>
                            <TH>Campanha</TH>
                            <TH>Status</TH>
                            <TH>Objetivo</TH>
                            <TH align="right">Resultados</TH>
                            <TH align="right">Custo/Res.</TH>
                            <TH align="right">Gasto</TH>
                            <TH align="right">Impressões</TH>
                            <TH align="right">Alcance</TH>
                            <TH align="right">CTR</TH>
                            <TH align="right">Freq.</TH>
                        </div>
                        {campaigns.map(camp => (
                            <CampaignRow key={camp.campaign_id} camp={camp} days={periodDays} onOpenDrawer={setDrawerCamp} />
                        ))}
                    </>
                )}
            </div>

            {/* Campaign Detail Drawer */}
            <AnimatePresence>
                {drawerCamp && (
                    <CampaignDrawer key={drawerCamp.campaign_id} camp={drawerCamp} days={periodDays} onClose={() => setDrawerCamp(null)} />
                )}
            </AnimatePresence>
        </div>
    )
}
