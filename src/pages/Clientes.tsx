import { useState, useMemo, useEffect } from 'react'
import { KpiCard } from '../components/ui/KpiCard'
import { KpiGrid, SectionCard, SkeletonTable } from '../components/ui/shared'
import TopBar from '../components/layout/TopBar'
import DatePicker from '../components/ui/DatePicker'
import CohortHeatmap from '../components/charts/CohortHeatmap'
import RFMCards from '../components/ui/RFMCards'
import ClientProfile from '../components/ui/ClientProfile'
import { dataApi, dashboardApi } from '../lib/api'
import { fmtBR } from '../lib/utils'
import type { ClientUI, ClientStatus, AcquisitionChannel, RFMSegment } from '../types'

// Deriva o segmento RFM a partir do rfm_score (ex: "345" → 'Em Risco')
function rfmSegmentFromScore(rfmScore: string | null | undefined): RFMSegment {
    if (!rfmScore || rfmScore.length !== 3) return 'Novos Promissores'
    const r = parseInt(rfmScore[0])
    const f = parseInt(rfmScore[1])
    const m = parseInt(rfmScore[2])
    const avg = (r + f + m) / 3
    if (r >= 4 && f >= 3 && m >= 3) return 'Champions'
    if ((r <= 2 && m >= 3) || (r <= 2 && f >= 3)) return 'Em Risco'
    if (avg <= 2) return 'Inativos'
    return 'Novos Promissores'
}

// Mapeia o valor da DB (snake_case) para o nome de exibição da UI
function mapChannel(raw: string | undefined): AcquisitionChannel {
    const s = (raw || '').toLowerCase()
    if (s === 'meta_ads' || s === 'meta') return 'Meta Ads'
    if (s === 'google_ads' || s === 'google') return 'Google Ads'
    if (s === 'hotmart') return 'Hotmart'
    if (s === 'organico' || s === 'organic') return 'Google Orgânico'
    if (s === 'email' || s === 'newsletter') return 'Email'
    if (s === 'afiliado' || s === 'affiliate') return 'Direto'
    if (s === 'shopify') return 'Direto'
    if (s === 'stripe') return 'Direto'
    return 'Direto'
}

// ── Filter Constants ───────────────────────────────────────────────────────────

const STATUS_FILTERS: Array<ClientStatus | 'Todos'> = ['Todos', 'Lucrativo', 'Payback', 'Risco']
const CHANNELS: Array<AcquisitionChannel | 'Todos'> = ['Todos', 'Meta Ads', 'Google Ads', 'Hotmart', 'Google Orgânico', 'Email', 'Direto']
const SEGMENTS: Array<RFMSegment | 'Todos'> = ['Todos', 'Champions', 'Em Risco', 'Novos Promissores', 'Inativos']
const PAGE_SIZE = 6

// ── Status Badge ─────────────────────────────────────────────────────────────

const STATUS_STYLE: Record<ClientStatus, React.CSSProperties> = {
    Lucrativo: { background: 'rgba(var(--fg-rgb), 0.08)', color: 'var(--fg)' },
    Payback: { border: '1px solid rgba(var(--fg-rgb), 0.18)', color: 'rgba(var(--fg-rgb), 0.6)' },
    Risco: { background: 'rgba(var(--fg-rgb), 0.04)', color: 'rgba(var(--fg-rgb), 0.38)' },
}

function StatusBadge({ status }: { status: ClientStatus }) {
    return (
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: '0.02em', padding: '4px 8px', borderRadius: 3, whiteSpace: 'nowrap', ...STATUS_STYLE[status] }}>
            {status}
        </span>
    )
}

// ── Dropdown ─────────────────────────────────────────────────────────────────

function Dropdown<T extends string>({ value, options, label, open, onToggle, onSelect }: {
    value: T; options: T[]; label: string; open: boolean
    onToggle: () => void; onSelect: (v: T) => void
}) {
    return (
        <div style={{ position: 'relative' }}>
            <button
                onClick={onToggle}
                style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    fontFamily: "var(--font-sans)", fontSize: 13, letterSpacing: '-0.3px',
                    padding: '5px 12px', borderRadius: 3,
                    border: '1px solid rgba(var(--fg-rgb), 0.13)',
                    background: 'transparent', cursor: 'pointer',
                    color: value !== 'Todos' ? 'var(--fg)' : 'rgba(var(--fg-rgb), 0.55)',
                }}
            >
                {value === 'Todos' ? label : value}
                <svg width="10" height="6" viewBox="0 0 10 6" fill="none">
                    <path d="M1 1l4 4 4-4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
            </button>
            {open && (
                <div
                    style={{ position: 'absolute', top: 'calc(100% + 6px)', right: 0, background: 'var(--bg)', border: '1px solid rgba(var(--fg-rgb), 0.14)', borderRadius: 4, padding: '6px 0', zIndex: 200, minWidth: 170, boxShadow: '0 4px 20px rgba(var(--fg-rgb), 0.07)' }}
                >
                    {options.map(opt => (
                        <button
                            key={opt}
                            onClick={() => { onSelect(opt); onToggle() }}
                            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(var(--fg-rgb), 0.04)')}
                            onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                            style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 14px', background: 'none', border: 'none', cursor: 'pointer', fontFamily: "var(--font-sans)", fontSize: 13, letterSpacing: '-0.3px', color: value === opt ? 'var(--fg)' : 'rgba(var(--fg-rgb), 0.65)', fontWeight: value === opt ? 500 : 400, transition: 'background 0.1s' }}
                        >
                            {opt}
                        </button>
                    ))}
                </div>
            )}
        </div>
    )
}

// ── Client List ───────────────────────────────────────────────────────────────

function ClientList({ clients, loading, onSelect }: { clients: ClientUI[]; loading: boolean; onSelect: (c: ClientUI) => void }) {
    const [statusFilter, setStatusFilter] = useState<ClientStatus | 'Todos'>('Todos')
    const [channelOpen, setChannelOpen] = useState(false)
    const [segmentOpen, setSegmentOpen] = useState(false)
    const [channelFilter, setChannelFilter] = useState<AcquisitionChannel | 'Todos'>('Todos')
    const [segmentFilter, setSegmentFilter] = useState<RFMSegment | 'Todos'>('Todos')
    const [search, setSearch] = useState('')
    const [page, setPage] = useState(0)

    const filtered = useMemo(() => clients.filter(c => {
        if (statusFilter !== 'Todos' && c.status !== statusFilter) return false
        if (channelFilter !== 'Todos' && c.channel !== channelFilter) return false
        if (segmentFilter !== 'Todos' && c.segment !== segmentFilter) return false
        if (search && !c.name.toLowerCase().includes(search.toLowerCase())) return false
        return true
    }), [clients, statusFilter, channelFilter, segmentFilter, search])

    const paginated = useMemo(() => filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE), [filtered, page])
    const totalPages = Math.ceil(filtered.length / PAGE_SIZE)

    useEffect(() => { setPage(0) }, [statusFilter, channelFilter, segmentFilter, search])

    return (
        <div>
            <p style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: 'rgba(var(--fg-rgb), 0.5)', letterSpacing: '0.06em', marginBottom: 20 }}>CLIENTES</p>

            {/* Filters */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', gap: 4 }}>
                    {STATUS_FILTERS.map(s => (
                        <button
                            key={s}
                            onClick={() => setStatusFilter(s)}
                            style={{ fontFamily: "var(--font-sans)", fontSize: 13, letterSpacing: '-0.3px', padding: '5px 12px', borderRadius: 3, border: 'none', cursor: 'pointer', background: statusFilter === s ? 'rgba(var(--fg-rgb), 0.09)' : 'transparent', color: statusFilter === s ? 'var(--fg)' : 'rgba(var(--fg-rgb), 0.5)', transition: 'background 0.15s, color 0.15s' }}
                        >
                            {s}
                        </button>
                    ))}
                </div>
                <div style={{ flex: 1 }} />
                <Dropdown value={segmentFilter} options={SEGMENTS} label="Segmento" open={segmentOpen} onToggle={() => { setSegmentOpen(o => !o); setChannelOpen(false) }} onSelect={setSegmentFilter} />
                <Dropdown value={channelFilter} options={CHANNELS} label="Canal" open={channelOpen} onToggle={() => { setChannelOpen(o => !o); setSegmentOpen(false) }} onSelect={setChannelFilter} />
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, border: '1px solid rgba(var(--fg-rgb), 0.13)', borderRadius: 3, padding: '5px 10px', height: 32 }}>
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ opacity: 0.35, flexShrink: 0 }}>
                        <circle cx="5" cy="5" r="4" style={{ stroke: 'var(--fg)' }} strokeWidth="1.3" />
                        <line x1="8.5" y1="8.5" x2="11" y2="11" style={{ stroke: 'var(--fg)' }} strokeWidth="1.3" strokeLinecap="round" />
                    </svg>
                    <input
                        value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar..."
                        style={{ border: 'none', background: 'transparent', outline: 'none', fontFamily: "var(--font-sans)", fontSize: 13, letterSpacing: '-0.3px', color: 'var(--fg)', width: 90 }}
                    />
                </div>
            </div>

            {/* Table header */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 90px 90px 70px 64px 90px', gap: '0 12px', paddingBottom: 10, borderBottom: '1px solid rgba(var(--fg-rgb), 0.1)', marginBottom: 2 }}>
                {['NOME', 'TOTAL GASTO', 'CAC', 'LTV', 'MARGEM', 'STATUS'].map((h, i) => (
                    <span key={h} style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: 'rgba(var(--fg-rgb), 0.45)', letterSpacing: '0.04em', textAlign: i > 0 && i < 5 ? 'right' : 'left' }}>
                        {h}
                    </span>
                ))}
            </div>

            {/* Rows */}
            <div style={{ minHeight: 360 }}>
                {loading ? (
                    <div style={{ padding: '8px 0' }}>
                        <SkeletonTable rows={PAGE_SIZE} columns={6} />
                    </div>
                ) : filtered.length === 0 ? (
                    <p style={{ fontFamily: "var(--font-sans)", fontSize: 14, color: 'rgba(var(--fg-rgb), 0.35)', padding: '24px 0', textAlign: 'center' }}>
                        Nenhum cliente encontrado
                    </p>
                ) : paginated.map((c) => (
                    <div
                        key={c.id}
                        onClick={() => onSelect(c)}
                        onMouseEnter={e => (e.currentTarget.style.background = 'rgba(var(--fg-rgb), 0.025)')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                        style={{ display: 'grid', gridTemplateColumns: '1fr 90px 90px 70px 64px 90px', gap: '0 12px', alignItems: 'center', padding: '13px 6px', borderBottom: '1px solid rgba(var(--fg-rgb), 0.055)', cursor: 'pointer', borderRadius: 3, margin: '0 -6px', transition: 'background 0.1s' }}
                    >
                        <div>
                            <p style={{ fontFamily: "var(--font-sans)", fontSize: 13, letterSpacing: '-0.3px', color: 'var(--fg)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</p>
                            <p style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: 'rgba(var(--fg-rgb), 0.38)', margin: '2px 0 0' }}>{c.channel}</p>
                        </div>
                        <span style={{ fontFamily: "var(--font-mono)", fontSize: 13, color: 'var(--fg)', textAlign: 'right' }}>R$ {fmtBR(c.totalSpent)}</span>
                        <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: 'rgba(var(--fg-rgb), 0.6)', textAlign: 'right' }}>{c.cac > 0 ? `R$ ${fmtBR(c.cac)}` : '—'}</span>
                        <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: 'rgba(var(--fg-rgb), 0.6)', textAlign: 'right' }}>R$ {fmtBR(c.ltv)}</span>
                        <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: 'rgba(var(--fg-rgb), 0.6)', textAlign: 'right' }}>{c.margin}%</span>
                        <StatusBadge status={c.status} />
                    </div>
                ))}
            </div>

            {/* Pagination */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 14 }}>
                <p style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: 'rgba(var(--fg-rgb), 0.35)' }}>
                    {filtered.length} cliente{filtered.length !== 1 ? 's' : ''}
                </p>
                {totalPages > 1 && (
                    <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                        <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0} style={{ background: 'none', border: 'none', cursor: page === 0 ? 'default' : 'pointer', color: 'var(--fg)', opacity: page === 0 ? 0.2 : 0.6, padding: 4 }}>
                            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M9 11L5 7L9 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                        </button>
                        <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: 'rgba(var(--fg-rgb), 0.45)' }}>{page + 1} / {totalPages}</span>
                        <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page === totalPages - 1} style={{ background: 'none', border: 'none', cursor: page === totalPages - 1 ? 'default' : 'pointer', color: 'var(--fg)', opacity: page === totalPages - 1 ? 0.2 : 0.6, padding: 4 }}>
                            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M5 11L9 7L5 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                        </button>
                    </div>
                )}
            </div>
        </div>
    )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function Clientes({ onToggleChat }: { onToggleChat?: () => void }) {
    const [selectedClient, setSelectedClient] = useState<ClientUI | null>(null)
    const [clients, setClients] = useState<ClientUI[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const custPromise = dataApi.getCustomers().catch(() => ({ data: [] }))
        const attrPromise = dashboardApi.getAttribution().catch(() => ({ data: [] }))
        const txPromise = dataApi.getTransactions(365).catch(() => ({ data: [] }))

        Promise.all([custPromise, attrPromise, txPromise]).then(([custRes, attrRes, txRes]) => {
            // Monta mapa canal → CAC a partir dos dados de Meta/Google Ads
            const cacByChannel: Record<string, number> = {}
            for (const stat of (attrRes.data || [])) {
                const ch = (stat.channel || '').toLowerCase().replace(' ', '_')
                if (stat.cac > 0) cacByChannel[ch] = stat.cac
            }
            for (const stat of (attrRes.data || [])) {
                if (stat.cac > 0) cacByChannel[stat.channel] = stat.cac
            }

            // Monta mapa customer_id → lista de compras (apenas aprovadas)
            const purchasesByCustomer = new Map<string, Array<{ date: string; product: string; value: number; _sortDate: number }>>()
            const rawTx = Array.isArray(txRes.data) ? txRes.data : []
            for (const tx of rawTx) {
                if (tx.status !== 'approved') continue
                const list = purchasesByCustomer.get(tx.customer_id) || []
                list.push({
                    date: new Date(tx.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' }),
                    product: tx.product_name || '—',
                    value: Number(tx.amount_net),
                    _sortDate: new Date(tx.created_at).getTime(),
                })
                purchasesByCustomer.set(tx.customer_id, list)
            }

            const rawCust = Array.isArray(custRes.data) ? custRes.data : []
            const mapped = rawCust.map((c: any) => {
                const channel = mapChannel(c.acquisition_channel)
                const cac = cacByChannel[channel] || cacByChannel[c.acquisition_channel] || 0
                const ltv = Number(c.total_ltv)
                const margin = cac > 0 && ltv > 0 ? Math.round(((ltv - cac) / ltv) * 100) : (ltv > 0 ? 70 : 0)
                const status: ClientStatus = cac > 0 && ltv > cac ? 'Lucrativo' : cac > 0 && ltv <= cac ? 'Payback' : ltv > 0 ? 'Lucrativo' : 'Risco'
                // Ordena compras da mais recente para a mais antiga
                const purchases = (purchasesByCustomer.get(c.id) || [])
                    .sort((a, b) => b._sortDate - a._sortDate)
                return {
                    id: c.id,
                    name: c.name || c.email || 'Cliente',
                    channel,
                    totalSpent: ltv,
                    cac,
                    ltv,
                    margin,
                    status,
                    segment: rfmSegmentFromScore(c.rfm_score),
                    lastPurchase: c.last_purchase_at ? new Date(c.last_purchase_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) : 'N/A',
                    purchases,
                    churnProb: Number(c.churn_probability || 0),
                }
            })
            setClients(mapped)
        }).finally(() => setLoading(false))
    }, [])

    const kpis = useMemo(() => {
        const total = clients.length || 1
        return {
            ativos: clients.length,
            ltvMedio: clients.reduce((sum, c) => sum + c.ltv, 0) / total,
            churnMedio: clients.reduce((sum, c) => sum + c.churnProb, 0) / total,
            lucrativos: clients.filter(c => c.status === 'Lucrativo').length,
            payback: clients.filter(c => c.status === 'Payback').length,
            emRisco: clients.filter(c => c.status === 'Risco').length,
        }
    }, [clients])

    return (
        <div style={{ paddingBottom: 40 }}>
            <TopBar onToggleChat={onToggleChat} />

            <h1 style={{ fontFamily: "var(--font-sans)", fontWeight: 400, fontSize: 40, letterSpacing: '-1.6px', color: 'var(--fg)', lineHeight: 1, margin: 0 }}>
                Clientes
            </h1>

            {/* KPIs */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 32, marginTop: 40 }}>
                <DatePicker />
                <KpiGrid style={{ marginTop: 40 }}>
                    <KpiCard label="CLIENTES ATIVOS" value={kpis.ativos} decimals={0} />
                    <KpiCard label="LTV MÉDIO" value={kpis.ltvMedio} prefix="R$ " decimals={0} />
                    <KpiCard label="CHURN MÉDIO" value={kpis.churnMedio} suffix="%" decimals={1} />
                    <KpiCard label="LUCRATIVOS" value={kpis.lucrativos} decimals={0} />
                    <KpiCard label="EM PAYBACK" value={kpis.payback} decimals={0} />
                    <KpiCard label="EM RISCO" value={kpis.emRisco} decimals={0} />
                </KpiGrid>
            </div>

            <div style={{ height: 1, background: 'rgba(var(--fg-rgb), 0.08)', marginTop: 52, marginBottom: 48 }} />

            {/* Row 1: Cohort + Client List */}
            <SectionCard>
                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1.25fr)', gap: 64 }}>
                    <CohortHeatmap />
                    <ClientList clients={clients} loading={loading} onSelect={setSelectedClient} />
                </div>
            </SectionCard>

            <div style={{ height: 1, background: 'rgba(var(--fg-rgb), 0.08)', marginTop: 12, marginBottom: 48 }} />

            {/* Row 2: RFM */}
            <SectionCard style={{ marginTop: 0 }}>
                <RFMCards clients={clients} />
            </SectionCard>

            {/* Client profile drawer */}
            {selectedClient && (
                <ClientProfile client={selectedClient} onClose={() => setSelectedClient(null)} />
            )}
        </div>
    )
}
