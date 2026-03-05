import { useState, useMemo, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { KpiCard } from '../components/ui/KpiCard'
import TopBar from '../components/layout/TopBar'
import DatePicker from '../components/ui/DatePicker'
import CohortHeatmap from '../components/charts/CohortHeatmap'
import RFMCards from '../components/ui/RFMCards'
import AIActions from '../components/ui/AIActions'
import ClientProfile from '../components/ui/ClientProfile'
import { dataApi, dashboardApi } from '../lib/api'
import { fmtBR } from '../lib/utils'
import type { ClientUI, ClientStatus, AcquisitionChannel, RFMSegment } from '../types'

// Mapeia o valor da DB (snake_case) para o nome de exibição da UI
function mapChannel(raw: string | undefined): AcquisitionChannel {
    const s = (raw || '').toLowerCase()
    if (s === 'meta_ads' || s === 'meta') return 'Meta Ads'
    if (s === 'google_ads' || s === 'google') return 'Google Ads'
    if (s === 'organico' || s === 'organic') return 'Google Orgânico'
    if (s === 'email' || s === 'newsletter') return 'Email'
    if (s === 'afiliado' || s === 'affiliate') return 'Direto'
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
        <span style={{ fontFamily: "'Geist Mono',monospace", fontSize: 11, letterSpacing: '0.02em', padding: '4px 8px', borderRadius: 3, whiteSpace: 'nowrap', ...STATUS_STYLE[status] }}>
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
            <motion.button
                onClick={onToggle}
                whileTap={{ scale: 0.97 }}
                style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    fontFamily: "'Poppins',sans-serif", fontSize: 13, letterSpacing: '-0.3px',
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
            </motion.button>
            <AnimatePresence>
                {open && (
                    <motion.div
                        initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
                        transition={{ duration: 0.15 }}
                        style={{ position: 'absolute', top: 'calc(100% + 6px)', right: 0, background: 'var(--bg)', border: '1px solid rgba(var(--fg-rgb), 0.14)', borderRadius: 4, padding: '6px 0', zIndex: 200, minWidth: 170, boxShadow: '0 4px 20px rgba(var(--fg-rgb), 0.07)' }}
                    >
                        {options.map(opt => (
                            <motion.button
                                key={opt}
                                onClick={() => { onSelect(opt); onToggle() }}
                                whileHover={{ backgroundColor: 'rgba(var(--fg-rgb), 0.04)' }}
                                style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 14px', background: 'none', border: 'none', cursor: 'pointer', fontFamily: "'Poppins',sans-serif", fontSize: 13, letterSpacing: '-0.3px', color: value === opt ? 'var(--fg)' : 'rgba(var(--fg-rgb), 0.65)', fontWeight: value === opt ? 500 : 400 }}
                            >
                                {opt}
                            </motion.button>
                        ))}
                    </motion.div>
                )}
            </AnimatePresence>
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
            <p style={{ fontFamily: "'Geist Mono','Courier New',monospace", fontSize: 12, color: 'rgba(var(--fg-rgb), 0.5)', letterSpacing: '0.06em', marginBottom: 20 }}>CLIENTES</p>

            {/* Filters */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', gap: 4 }}>
                    {STATUS_FILTERS.map(s => (
                        <motion.button
                            key={s}
                            onClick={() => setStatusFilter(s)}
                            whileTap={{ scale: 0.97 }}
                            style={{ fontFamily: "'Poppins',sans-serif", fontSize: 13, letterSpacing: '-0.3px', padding: '5px 12px', borderRadius: 3, border: 'none', cursor: 'pointer', background: statusFilter === s ? 'rgba(var(--fg-rgb), 0.09)' : 'transparent', color: statusFilter === s ? 'var(--fg)' : 'rgba(var(--fg-rgb), 0.5)', transition: 'background 0.15s, color 0.15s' }}
                        >
                            {s}
                        </motion.button>
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
                        style={{ border: 'none', background: 'transparent', outline: 'none', fontFamily: "'Poppins',sans-serif", fontSize: 13, letterSpacing: '-0.3px', color: 'var(--fg)', width: 90 }}
                    />
                </div>
            </div>

            {/* Table header */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 90px 90px 70px 64px 90px', gap: '0 12px', paddingBottom: 10, borderBottom: '1px solid rgba(var(--fg-rgb), 0.1)', marginBottom: 2 }}>
                {['NOME', 'TOTAL GASTO', 'CAC', 'LTV', 'MARGEM', 'STATUS'].map((h, i) => (
                    <span key={h} style={{ fontFamily: "'Geist Mono',monospace", fontSize: 11, color: 'rgba(var(--fg-rgb), 0.45)', letterSpacing: '0.04em', textAlign: i > 0 && i < 5 ? 'right' : 'left' }}>
                        {h}
                    </span>
                ))}
            </div>

            {/* Rows */}
            <div style={{ minHeight: 360 }}>
                <AnimatePresence mode="popLayout" initial={false}>
                    {loading ? (
                        <motion.p key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ fontFamily: "'Poppins',sans-serif", fontSize: 14, color: 'rgba(var(--fg-rgb), 0.35)', padding: '24px 0', textAlign: 'center' }}>
                            Carregando clientes...
                        </motion.p>
                    ) : filtered.length === 0 ? (
                        <motion.p key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{ fontFamily: "'Poppins',sans-serif", fontSize: 14, color: 'rgba(var(--fg-rgb), 0.35)', padding: '24px 0', textAlign: 'center' }}>
                            Nenhum cliente encontrado
                        </motion.p>
                    ) : paginated.map((c, i) => (
                        <motion.div
                            key={c.id}
                            initial={{ opacity: 0, y: 4 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -4 }}
                            transition={{ duration: 0.25, delay: i * 0.03, ease: [0.25, 0.1, 0.25, 1] }}
                            onClick={() => onSelect(c)}
                            whileHover={{ backgroundColor: 'rgba(var(--fg-rgb), 0.025)' }}
                            style={{ display: 'grid', gridTemplateColumns: '1fr 90px 90px 70px 64px 90px', gap: '0 12px', alignItems: 'center', padding: '13px 6px', borderBottom: '1px solid rgba(var(--fg-rgb), 0.055)', cursor: 'pointer', borderRadius: 3, margin: '0 -6px' }}
                        >
                            <div>
                                <p style={{ fontFamily: "'Poppins',sans-serif", fontSize: 13, letterSpacing: '-0.3px', color: 'var(--fg)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</p>
                                <p style={{ fontFamily: "'Geist Mono',monospace", fontSize: 10, color: 'rgba(var(--fg-rgb), 0.38)', margin: '2px 0 0' }}>{c.channel}</p>
                            </div>
                            <span style={{ fontFamily: "'Geist Mono',monospace", fontSize: 13, color: 'var(--fg)', textAlign: 'right' }}>R$ {fmtBR(c.totalSpent)}</span>
                            <span style={{ fontFamily: "'Geist Mono',monospace", fontSize: 12, color: 'rgba(var(--fg-rgb), 0.6)', textAlign: 'right' }}>{c.cac > 0 ? `R$ ${fmtBR(c.cac)}` : '—'}</span>
                            <span style={{ fontFamily: "'Geist Mono',monospace", fontSize: 12, color: 'rgba(var(--fg-rgb), 0.6)', textAlign: 'right' }}>R$ {fmtBR(c.ltv)}</span>
                            <span style={{ fontFamily: "'Geist Mono',monospace", fontSize: 12, color: 'rgba(var(--fg-rgb), 0.6)', textAlign: 'right' }}>{c.margin}%</span>
                            <StatusBadge status={c.status} />
                        </motion.div>
                    ))}
                </AnimatePresence>
            </div>

            {/* Pagination */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 14 }}>
                <p style={{ fontFamily: "'Geist Mono',monospace", fontSize: 11, color: 'rgba(var(--fg-rgb), 0.35)' }}>
                    {filtered.length} cliente{filtered.length !== 1 ? 's' : ''}
                </p>
                {totalPages > 1 && (
                    <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                        <motion.button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0} whileTap={{ scale: 0.95 }} style={{ background: 'none', border: 'none', cursor: page === 0 ? 'default' : 'pointer', color: 'var(--fg)', opacity: page === 0 ? 0.2 : 0.6, padding: 4 }}>
                            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M9 11L5 7L9 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                        </motion.button>
                        <span style={{ fontFamily: "'Geist Mono',monospace", fontSize: 11, color: 'rgba(var(--fg-rgb), 0.45)' }}>{page + 1} / {totalPages}</span>
                        <motion.button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page === totalPages - 1} whileTap={{ scale: 0.95 }} style={{ background: 'none', border: 'none', cursor: page === totalPages - 1 ? 'default' : 'pointer', color: 'var(--fg)', opacity: page === totalPages - 1 ? 0.2 : 0.6, padding: 4 }}>
                            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M5 11L9 7L5 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                        </motion.button>
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
            const purchasesByCustomer = new Map<string, Array<{ date: string; product: string; value: number }>>()
            for (const tx of (txRes.data as any[])) {
                if (tx.status !== 'approved') continue
                const list = purchasesByCustomer.get(tx.customer_id) || []
                list.push({
                    date: new Date(tx.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' }),
                    product: tx.product_name || '—',
                    value: Number(tx.amount_net),
                })
                purchasesByCustomer.set(tx.customer_id, list)
            }

            const mapped = custRes.data.map((c: any) => {
                const channel = mapChannel(c.acquisition_channel)
                const cac = cacByChannel[channel] || cacByChannel[c.acquisition_channel] || 0
                const ltv = Number(c.total_ltv)
                const margin = cac > 0 && ltv > 0 ? Math.round(((ltv - cac) / ltv) * 100) : (ltv > 0 ? 70 : 0)
                const status: ClientStatus = ltv > cac && cac > 0 ? 'Lucrativo' : cac > 0 ? 'Payback' : (ltv > 0 ? 'Lucrativo' : 'Payback')
                // Ordena compras da mais recente para a mais antiga
                const purchases = (purchasesByCustomer.get(c.id) || [])
                    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                return {
                    id: c.id,
                    name: c.name || c.email || 'Cliente',
                    channel,
                    totalSpent: ltv,
                    cac,
                    ltv,
                    margin,
                    status,
                    segment: (c.rfm_segment as RFMSegment) || 'Novos Promissores',
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
        }
    }, [clients])

    return (
        <div style={{ paddingTop: 28, paddingBottom: 80 }}>
            <TopBar onToggleChat={onToggleChat} />

            <motion.h1
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, ease: [0.25, 0.1, 0.25, 1] }}
                style={{ fontFamily: "'Poppins',sans-serif", fontWeight: 400, fontSize: 40, letterSpacing: '-1.6px', color: 'var(--fg)', lineHeight: 1, margin: 0 }}
            >
                Clientes
            </motion.h1>

            {/* KPIs */}
            <motion.div
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3, delay: 0.1 }}
                style={{ display: 'flex', flexDirection: 'column', gap: 32, marginTop: 40 }}
            >
                <DatePicker />
                <div style={{ display: 'flex', gap: 48, alignItems: 'center', flexWrap: 'wrap' }}>
                    <KpiCard label="CLIENTES ATIVOS" value={kpis.ativos} decimals={0} delay={0.1} />
                    <KpiCard label="LTV MÉDIO" value={kpis.ltvMedio} prefix="R$ " decimals={0} delay={0.18} />
                    <KpiCard label="CHURN MÉDIO" value={kpis.churnMedio} suffix="%" decimals={1} delay={0.26} />
                    <KpiCard label="LUCRATIVOS" value={kpis.lucrativos} decimals={0} delay={0.34} />
                    <KpiCard label="EM PAYBACK" value={kpis.payback} decimals={0} delay={0.42} />
                </div>
            </motion.div>

            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4, delay: 0.5 }} style={{ height: 1, background: 'rgba(var(--fg-rgb), 0.08)', marginTop: 52, marginBottom: 48 }} />

            {/* Row 1: Cohort + Client List */}
            <motion.div
                initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.35, ease: [0.25, 0.1, 0.25, 1] }}
                style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1.25fr)', gap: 64, marginBottom: 64 }}
            >
                <CohortHeatmap />
                <ClientList clients={clients} loading={loading} onSelect={setSelectedClient} />
            </motion.div>

            <div style={{ height: 1, background: 'rgba(var(--fg-rgb), 0.08)', marginTop: 12, marginBottom: 48 }} />

            {/* Row 2: RFM + AI Actions */}
            <motion.div
                initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.45, ease: [0.25, 0.1, 0.25, 1] }}
                style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 64 }}
            >
                <RFMCards clients={clients} />
                <AIActions />
            </motion.div>

            {/* Client profile drawer */}
            <AnimatePresence>
                {selectedClient && (
                    <ClientProfile client={selectedClient} onClose={() => setSelectedClient(null)} />
                )}
            </AnimatePresence>
        </div>
    )
}
