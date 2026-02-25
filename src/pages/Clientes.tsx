import { useState, useMemo, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { KpiCard } from '../components/KpiCard'
import TopBar from '../components/TopBar'
import DatePicker from '../components/DatePicker'
import { dataApi } from '../lib/api'

// ── Types ─────────────────────────────────────────────────────────────────────
type ClientStatus = 'Lucrativo' | 'Payback' | 'Risco'
type ClientChannel = 'Meta Ads' | 'Google Ads' | 'Google Orgânico' | 'Email' | 'Direto'
type RFMSegment = 'Champions' | 'Em Risco' | 'Novos Promissores' | 'Inativos'

interface Purchase { date: string; product: string; value: number }
interface Client {
  id: string; name: string; channel: ClientChannel
  totalSpent: number; cac: number; ltv: number; margin: number
  status: ClientStatus; segment: RFMSegment
  lastPurchase: string; purchases: Purchase[]; churnProb: number
}
interface CohortRow { month: string; n: number; r30: number | null; r60: number | null; r90: number | null; r180: number | null }
interface AIAction { id: string; count: number; description: string; action: string; segment: RFMSegment }

// ── Mock data ─────────────────────────────────────────────────────────────────
const CLIENTS: Client[] = [
  { id: '1', name: 'Ana Silva', channel: 'Meta Ads', totalSpent: 3940, cac: 180, ltv: 4200, margin: 62, status: 'Lucrativo', segment: 'Champions', lastPurchase: '21/02', churnProb: 8, purchases: [{ date: '21/02', product: 'Plano Pro Anual', value: 1764 }, { date: '10/01', product: 'Consultoria 1h', value: 350 }, { date: '05/12', product: 'Plano Pro Mensal', value: 197 }, { date: '03/11', product: 'Curso Digital', value: 297 }, { date: '02/08', product: 'Plano Starter', value: 97 }] },
  { id: '2', name: 'João Mendes', channel: 'Direto', totalSpent: 2870, cac: 0, ltv: 3100, margin: 78, status: 'Lucrativo', segment: 'Champions', lastPurchase: '21/02', churnProb: 12, purchases: [{ date: '21/02', product: 'Consultoria 1h', value: 350 }, { date: '15/01', product: 'Plano Pro Mensal', value: 197 }, { date: '10/12', product: 'Consultoria 1h', value: 350 }, { date: '20/09', product: 'Plano Pro Anual', value: 1764 }] },
  { id: '3', name: 'Pedro Lima', channel: 'Meta Ads', totalSpent: 3528, cac: 220, ltv: 3800, margin: 58, status: 'Lucrativo', segment: 'Champions', lastPurchase: '20/02', churnProb: 15, purchases: [{ date: '20/02', product: 'Plano Pro Anual', value: 1764 }, { date: '12/11', product: 'Plano Pro Anual', value: 1764 }] },
  { id: '4', name: 'Mariana Costa', channel: 'Google Orgânico', totalSpent: 1188, cac: 0, ltv: 1400, margin: 71, status: 'Lucrativo', segment: 'Novos Promissores', lastPurchase: '19/02', churnProb: 22, purchases: [{ date: '19/02', product: 'Curso Digital', value: 297 }, { date: '15/01', product: 'Plano Pro Mensal', value: 197 }, { date: '10/12', product: 'Plano Starter', value: 97 }] },
  { id: '5', name: 'Diego Santos', channel: 'Direto', totalSpent: 5292, cac: 0, ltv: 5800, margin: 82, status: 'Lucrativo', segment: 'Champions', lastPurchase: '17/02', churnProb: 5, purchases: [{ date: '17/02', product: 'Plano Pro Anual', value: 1764 }, { date: '10/11', product: 'Plano Pro Anual', value: 1764 }, { date: '08/08', product: 'Plano Pro Anual', value: 1764 }] },
  { id: '6', name: 'Beatriz Alves', channel: 'Email', totalSpent: 1050, cac: 45, ltv: 1200, margin: 55, status: 'Lucrativo', segment: 'Novos Promissores', lastPurchase: '18/02', churnProb: 30, purchases: [{ date: '18/02', product: 'Consultoria 1h', value: 350 }, { date: '20/01', product: 'Plano Pro Mensal', value: 197 }, { date: '10/12', product: 'Plano Starter', value: 97 }] },
  { id: '7', name: 'Fernanda Lima', channel: 'Google Orgânico', totalSpent: 591, cac: 0, ltv: 800, margin: 48, status: 'Payback', segment: 'Novos Promissores', lastPurchase: '16/02', churnProb: 35, purchases: [{ date: '16/02', product: 'Plano Pro Mensal', value: 197 }, { date: '10/01', product: 'Plano Pro Mensal', value: 197 }, { date: '05/12', product: 'Plano Starter', value: 97 }] },
  { id: '8', name: 'Lucas Ferreira', channel: 'Google Ads', totalSpent: 291, cac: 310, ltv: 600, margin: 32, status: 'Payback', segment: 'Novos Promissores', lastPurchase: '18/02', churnProb: 42, purchases: [{ date: '18/02', product: 'Plano Starter', value: 97 }, { date: '20/01', product: 'Plano Starter', value: 97 }, { date: '10/12', product: 'Plano Starter', value: 97 }] },
  { id: '9', name: 'Rafael Nunes', channel: 'Meta Ads', totalSpent: 394, cac: 280, ltv: 500, margin: 28, status: 'Payback', segment: 'Em Risco', lastPurchase: '14/01', churnProb: 68, purchases: [{ date: '14/01', product: 'Plano Pro Mensal', value: 197 }, { date: '10/12', product: 'Plano Pro Mensal', value: 197 }] },
  { id: '10', name: 'Camila Rocha', channel: 'Meta Ads', totalSpent: 297, cac: 250, ltv: 400, margin: 22, status: 'Risco', segment: 'Em Risco', lastPurchase: '10/01', churnProb: 75, purchases: [{ date: '10/01', product: 'Curso Digital', value: 297 }] },
  { id: '11', name: 'Thiago Oliveira', channel: 'Meta Ads', totalSpent: 197, cac: 195, ltv: 300, margin: 18, status: 'Risco', segment: 'Em Risco', lastPurchase: '15/01', churnProb: 80, purchases: [{ date: '15/01', product: 'Plano Pro Mensal', value: 197 }] },
  { id: '12', name: 'Isabela Freitas', channel: 'Email', totalSpent: 591, cac: 55, ltv: 700, margin: 52, status: 'Payback', segment: 'Em Risco', lastPurchase: '05/01', churnProb: 72, purchases: [{ date: '05/01', product: 'Plano Pro Mensal', value: 197 }, { date: '10/11', product: 'Plano Pro Mensal', value: 197 }, { date: '05/09', product: 'Plano Pro Mensal', value: 197 }] },
  { id: '13', name: 'Bruno Castro', channel: 'Google Ads', totalSpent: 291, cac: 320, ltv: 400, margin: 15, status: 'Risco', segment: 'Inativos', lastPurchase: '20/10', churnProb: 88, purchases: [{ date: '20/10', product: 'Plano Starter', value: 97 }, { date: '15/09', product: 'Plano Starter', value: 97 }] },
  { id: '14', name: 'Laura Mendes', channel: 'Meta Ads', totalSpent: 594, cac: 200, ltv: 700, margin: 38, status: 'Payback', segment: 'Inativos', lastPurchase: '01/11', churnProb: 83, purchases: [{ date: '01/11', product: 'Curso Digital', value: 297 }, { date: '15/08', product: 'Curso Digital', value: 297 }] },
  { id: '15', name: 'Carlos Pereira', channel: 'Direto', totalSpent: 1764, cac: 0, ltv: 2000, margin: 65, status: 'Lucrativo', segment: 'Inativos', lastPurchase: '20/10', churnProb: 60, purchases: [{ date: '20/10', product: 'Plano Pro Anual', value: 1764 }] },
]

const COHORT_DATA: Record<string, CohortRow[]> = {
  'Todos': [
    { month: 'Set/24', n: 42, r30: 85, r60: 72, r90: 61, r180: 48 },
    { month: 'Out/24', n: 38, r30: 82, r60: 68, r90: 55, r180: null },
    { month: 'Nov/24', n: 55, r30: 79, r60: 65, r90: 50, r180: null },
    { month: 'Dez/24', n: 61, r30: 75, r60: 60, r90: null, r180: null },
    { month: 'Jan/25', n: 47, r30: 80, r60: null, r90: null, r180: null },
    { month: 'Fev/25', n: 52, r30: null, r60: null, r90: null, r180: null },
  ],
  'Meta Ads': [
    { month: 'Set/24', n: 18, r30: 72, r60: 58, r90: 44, r180: 30 },
    { month: 'Out/24', n: 15, r30: 68, r60: 52, r90: 38, r180: null },
    { month: 'Nov/24', n: 22, r30: 65, r60: 48, r90: 30, r180: null },
    { month: 'Dez/24', n: 25, r30: 62, r60: 45, r90: null, r180: null },
    { month: 'Jan/25', n: 19, r30: 70, r60: null, r90: null, r180: null },
    { month: 'Fev/25', n: 21, r30: null, r60: null, r90: null, r180: null },
  ],
  'Google Orgânico': [
    { month: 'Set/24', n: 12, r30: 92, r60: 83, r90: 74, r180: 65 },
    { month: 'Out/24', n: 10, r30: 90, r60: 80, r90: 70, r180: null },
    { month: 'Nov/24', n: 14, r30: 88, r60: 78, r90: 68, r180: null },
    { month: 'Dez/24', n: 16, r30: 85, r60: 75, r90: null, r180: null },
    { month: 'Jan/25', n: 11, r30: 89, r60: null, r90: null, r180: null },
    { month: 'Fev/25', n: 13, r30: null, r60: null, r90: null, r180: null },
  ],
  'Google Ads': [
    { month: 'Set/24', n: 8, r30: 68, r60: 55, r90: 42, r180: 28 },
    { month: 'Out/24', n: 9, r30: 65, r60: 50, r90: 35, r180: null },
    { month: 'Nov/24', n: 11, r30: 62, r60: 48, r90: 28, r180: null },
    { month: 'Dez/24', n: 12, r30: 60, r60: 44, r90: null, r180: null },
    { month: 'Jan/25', n: 10, r30: 67, r60: null, r90: null, r180: null },
    { month: 'Fev/25', n: 9, r30: null, r60: null, r90: null, r180: null },
  ],
}

const AI_ACTIONS: AIAction[] = [
  { id: '1', count: 12, description: 'clientes compraram há mais de 90 dias e têm LTV acima de R$2.000', action: 'Criar campanha de reativação', segment: 'Champions' },
  { id: '2', count: 8, description: 'novos clientes via Google Orgânico com ticket acima de R$500 este mês', action: 'Criar Lookalike no Meta', segment: 'Novos Promissores' },
  { id: '3', count: 18, description: 'clientes Em Risco não abriram nenhum e-mail nos últimos 30 dias', action: 'Disparar sequência de reativação', segment: 'Em Risco' },
  { id: '4', count: 5, description: 'Champions compraram 3+ vezes e ainda não têm indicações registradas', action: 'Ativar programa de indicação', segment: 'Champions' },
]

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtBR(v: number) {
  return new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 }).format(v)
}

// ── Shared primitives ─────────────────────────────────────────────────────────
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ fontFamily: "'Geist Mono','Courier New',monospace", fontSize: 12, color: 'rgba(var(--fg-rgb), 0.5)', letterSpacing: '0.06em', marginBottom: 20 }}>
      {children}
    </p>
  )
}

function TH({ children, align = 'left' }: { children: React.ReactNode; align?: 'left' | 'right' }) {
  return (
    <span style={{ fontFamily: "'Geist Mono',monospace", fontSize: 11, color: 'rgba(var(--fg-rgb), 0.45)', letterSpacing: '0.04em', textAlign: align }}>
      {children}
    </span>
  )
}

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

// ── Client profile drawer ─────────────────────────────────────────────────────
function ClientProfile({ client, onClose }: { client: Client; onClose: () => void }) {
  const products = useMemo(() => {
    const map = new Map<string, number>()
    client.purchases.forEach(p => map.set(p.product, (map.get(p.product) ?? 0) + 1))
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1])
  }, [client])

  return (
    <>
      {/* Overlay */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        onClick={onClose}
        style={{ position: 'fixed', inset: 0, background: 'rgba(var(--fg-rgb), 0.12)', zIndex: 300 }}
      />

      {/* Panel */}
      <motion.div
        initial={{ x: 400, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: 400, opacity: 0 }}
        transition={{ duration: 0.32, ease: [0.4, 0, 0.2, 1] }}
        style={{
          position: 'fixed', top: 0, right: 0, bottom: 0,
          width: 380, background: 'var(--bg)',
          borderLeft: '1px solid rgba(var(--fg-rgb), 0.12)',
          zIndex: 301, overflowY: 'auto',
          padding: '28px 32px 48px',
          display: 'flex', flexDirection: 'column', gap: 0,
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 32 }}>
          <div>
            <p style={{ fontFamily: "'Poppins',sans-serif", fontSize: 22, fontWeight: 400, letterSpacing: '-0.8px', color: 'var(--fg)', margin: 0 }}>
              {client.name}
            </p>
            <p style={{ fontFamily: "'Geist Mono',monospace", fontSize: 11, color: 'rgba(var(--fg-rgb), 0.45)', margin: '6px 0 0', letterSpacing: '0.03em' }}>
              {client.channel} · {client.segment}
            </p>
          </div>
          <motion.button
            onClick={onClose}
            whileHover={{ opacity: 0.6 }}
            whileTap={{ scale: 0.92 }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: 'rgba(var(--fg-rgb), 0.5)', display: 'flex' }}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <line x1="1" y1="1" x2="13" y2="13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              <line x1="13" y1="1" x2="1" y2="13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </motion.button>
        </div>

        {/* Metrics */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0, marginBottom: 32 }}>
          {[
            { label: 'VALOR TOTAL', value: `R$ ${fmtBR(client.totalSpent)}` },
            { label: 'CAC', value: client.cac > 0 ? `R$ ${fmtBR(client.cac)}` : 'Orgânico' },
            { label: 'LTV', value: `R$ ${fmtBR(client.ltv)}` },
            { label: 'MARGEM', value: `${client.margin}%` },
          ].map((m) => (
            <div key={m.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '13px 0', borderBottom: '1px solid rgba(var(--fg-rgb), 0.07)' }}>
              <span style={{ fontFamily: "'Geist Mono',monospace", fontSize: 11, color: 'rgba(var(--fg-rgb), 0.45)', letterSpacing: '0.04em' }}>{m.label}</span>
              <span style={{ fontFamily: "'Poppins',sans-serif", fontSize: 15, letterSpacing: '-0.4px', color: 'var(--fg)' }}>{m.value}</span>
            </div>
          ))}

          {/* Churn probability */}
          <div style={{ padding: '13px 0', borderBottom: '1px solid rgba(var(--fg-rgb), 0.07)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <span style={{ fontFamily: "'Geist Mono',monospace", fontSize: 11, color: 'rgba(var(--fg-rgb), 0.45)', letterSpacing: '0.04em' }}>PROB. CHURN</span>
              <span style={{ fontFamily: "'Poppins',sans-serif", fontSize: 15, letterSpacing: '-0.4px', color: client.churnProb > 60 ? 'rgba(var(--fg-rgb), 0.45)' : 'var(--fg)' }}>
                {client.churnProb}%
              </span>
            </div>
            <div style={{ height: 3, background: 'rgba(var(--fg-rgb), 0.07)', borderRadius: 99 }}>
              <motion.div
                style={{ height: '100%', borderRadius: 99, background: `rgba(var(--fg-rgb), ${0.15 + client.churnProb / 100 * 0.7})` }}
                initial={{ width: 0 }}
                animate={{ width: `${client.churnProb}%` }}
                transition={{ duration: 0.8, ease: [0.4, 0, 0.2, 1] }}
              />
            </div>
          </div>
        </div>

        {/* Produtos */}
        <div style={{ marginBottom: 28 }}>
          <p style={{ fontFamily: "'Geist Mono',monospace", fontSize: 11, color: 'rgba(var(--fg-rgb), 0.45)', letterSpacing: '0.06em', marginBottom: 12 }}>PRODUTOS</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {products.map(([name, qty]) => (
              <div key={name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontFamily: "'Poppins',sans-serif", fontSize: 13, letterSpacing: '-0.3px', color: 'rgba(var(--fg-rgb), 0.8)' }}>{name}</span>
                <span style={{ fontFamily: "'Geist Mono',monospace", fontSize: 11, color: 'rgba(var(--fg-rgb), 0.4)' }}>{qty}×</span>
              </div>
            ))}
          </div>
        </div>

        {/* Purchase history */}
        <div>
          <p style={{ fontFamily: "'Geist Mono',monospace", fontSize: 11, color: 'rgba(var(--fg-rgb), 0.45)', letterSpacing: '0.06em', marginBottom: 12 }}>HISTÓRICO</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {client.purchases.map((p, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: 8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.2, delay: i * 0.04 }}
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid rgba(var(--fg-rgb), 0.055)' }}
              >
                <div>
                  <p style={{ fontFamily: "'Poppins',sans-serif", fontSize: 12, letterSpacing: '-0.3px', color: 'var(--fg)', margin: 0 }}>{p.product}</p>
                  <p style={{ fontFamily: "'Geist Mono',monospace", fontSize: 10, color: 'rgba(var(--fg-rgb), 0.38)', margin: '2px 0 0' }}>{p.date}</p>
                </div>
                <span style={{ fontFamily: "'Geist Mono',monospace", fontSize: 13, color: 'rgba(var(--fg-rgb), 0.7)' }}>R$ {fmtBR(p.value)}</span>
              </motion.div>
            ))}
          </div>
        </div>
      </motion.div>
    </>
  )
}

// ── Client list ───────────────────────────────────────────────────────────────
const STATUS_FILTERS: Array<ClientStatus | 'Todos'> = ['Todos', 'Lucrativo', 'Payback', 'Risco']
const CHANNELS: Array<ClientChannel | 'Todos'> = ['Todos', 'Meta Ads', 'Google Ads', 'Google Orgânico', 'Email', 'Direto']
const SEGMENTS: Array<RFMSegment | 'Todos'> = ['Todos', 'Champions', 'Em Risco', 'Novos Promissores', 'Inativos']

function ClientList({ onSelect }: { onSelect: (c: Client) => void }) {
  const [realClients, setRealClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<ClientStatus | 'Todos'>('Todos')
  const [channelOpen, setChannelOpen] = useState(false)
  const [segmentOpen, setSegmentOpen] = useState(false)
  const [channelFilter, setChannelFilter] = useState<ClientChannel | 'Todos'>('Todos')
  const [segmentFilter, setRFMSegmentFilter] = useState<RFMSegment | 'Todos'>('Todos')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)
  const PAGE_SIZE = 6

  useEffect(() => {
    dataApi.getCustomers().then(res => {
      const mapped = res.data.map((c: any) => ({
        id: c.id,
        name: c.name || c.email || 'Cliente',
        channel: c.acquisition_channel || 'Direto',
        totalSpent: Number(c.total_ltv),
        cac: Number(c.cac || 0),
        ltv: Number(c.total_ltv),
        margin: Number(c.margin || 70),
        status: c.total_ltv > 0 ? 'Lucrativo' : 'Payback',
        segment: c.rfm_segment || 'Novos Promissores',
        lastPurchase: c.last_purchase_at ? new Date(c.last_purchase_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) : 'N/A',
        purchases: [],
        churnProb: Number(c.churn_probability || 0)
      }))
      setRealClients(mapped)
    }).finally(() => setLoading(false))
  }, [])

  const filtered = useMemo(() => realClients.filter(c => {
    if (statusFilter !== 'Todos' && c.status !== statusFilter) return false
    if (channelFilter !== 'Todos' && c.channel !== channelFilter) return false
    if (segmentFilter !== 'Todos' && c.segment !== segmentFilter) return false
    if (search && !c.name.toLowerCase().includes(search.toLowerCase())) return false
    return true
  }), [statusFilter, channelFilter, segmentFilter, search])

  const paginated = useMemo(() => filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE), [filtered, page])
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)

  useEffect(() => { setPage(0) }, [statusFilter, channelFilter, segmentFilter, search])

  function Dropdown<T extends string>({
    value, options, label, open, onToggle, onSelect: onSel,
  }: { value: T; options: T[]; label: string; open: boolean; onToggle: () => void; onSelect: (v: T) => void }) {
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
                  onClick={() => { onSel(opt); onToggle() }}
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

  return (
    <div>
      <SectionLabel>CLIENTES</SectionLabel>

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
        <Dropdown value={segmentFilter} options={SEGMENTS} label="Segmento" open={segmentOpen} onToggle={() => { setSegmentOpen(o => !o); setChannelOpen(false) }} onSelect={setRFMSegmentFilter} />
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
        <TH>NOME</TH>
        <TH align="right">TOTAL GASTO</TH>
        <TH align="right">CAC</TH>
        <TH align="right">LTV</TH>
        <TH align="right">MARGEM</TH>
        <TH>STATUS</TH>
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

      {/* Pagination Footer */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 14 }}>
        <p style={{ fontFamily: "'Geist Mono',monospace", fontSize: 11, color: 'rgba(var(--fg-rgb), 0.35)' }}>
          {filtered.length} cliente{filtered.length !== 1 ? 's' : ''}
        </p>

        {totalPages > 1 && (
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <motion.button
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={page === 0}
              whileTap={{ scale: 0.95 }}
              style={{
                background: 'none', border: 'none', cursor: page === 0 ? 'default' : 'pointer',
                color: 'var(--fg)', opacity: page === 0 ? 0.2 : 0.6, padding: 4
              }}
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M9 11L5 7L9 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </motion.button>
            <span style={{ fontFamily: "'Geist Mono',monospace", fontSize: 11, color: 'rgba(var(--fg-rgb), 0.45)' }}>
              {page + 1} / {totalPages}
            </span>
            <motion.button
              onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
              disabled={page === totalPages - 1}
              whileTap={{ scale: 0.95 }}
              style={{
                background: 'none', border: 'none', cursor: page === totalPages - 1 ? 'default' : 'pointer',
                color: 'var(--fg)', opacity: page === totalPages - 1 ? 0.2 : 0.6, padding: 4
              }}
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M5 11L9 7L5 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </motion.button>
          </div>
        )}
      </div>
    </div>
  )
}

// ── RFM segment cards ─────────────────────────────────────────────────────────
const RFM_CONFIG: Record<RFMSegment, { label: string; sub: string; suggestion: string }> = {
  'Champions': { label: 'Champions', sub: 'Compram com frequência, alto LTV', suggestion: 'Criar Lookalike no Meta' },
  'Em Risco': { label: 'Em Risco', sub: 'Alta inatividade, churn elevado', suggestion: 'Disparar reativação urgente' },
  'Novos Promissores': { label: 'Novos Promissores', sub: 'Primeira compra recente, potencial', suggestion: 'Nurturing e upsell' },
  'Inativos': { label: 'Inativos', sub: 'Sem atividade há 90+ dias', suggestion: 'Campanha de winback' },
}

function RFMCards() {
  const [activeIndex, setActiveIndex] = useState(0)

  const stats = useMemo(() => {
    const result: Record<RFMSegment, { count: number; revenue: number }> = {
      'Champions': { count: 0, revenue: 0 },
      'Em Risco': { count: 0, revenue: 0 },
      'Novos Promissores': { count: 0, revenue: 0 },
      'Inativos': { count: 0, revenue: 0 },
    }
    CLIENTS.forEach(c => {
      result[c.segment].count++
      result[c.segment].revenue += c.totalSpent
    })
    return result
  }, [])

  const segments: RFMSegment[] = ['Champions', 'Novos Promissores', 'Em Risco', 'Inativos']

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <SectionLabel>SEGMENTAÇÃO RFM</SectionLabel>
        <div style={{ display: 'flex', gap: 12 }}>
          <motion.button
            onClick={() => setActiveIndex(p => Math.max(0, p - 1))}
            whileTap={{ scale: 0.95 }}
            style={{
              background: 'none', border: '1px solid rgba(var(--fg-rgb), 0.1)', borderRadius: 4,
              cursor: activeIndex === 0 ? 'default' : 'pointer',
              color: 'var(--fg)', opacity: activeIndex === 0 ? 0.2 : 0.6, padding: '4px 8px'
            }}
          >
            Anterior
          </motion.button>
          <motion.button
            onClick={() => setActiveIndex(p => Math.min(segments.length - 1, p + 1))}
            whileTap={{ scale: 0.95 }}
            style={{
              background: 'none', border: '1px solid rgba(var(--fg-rgb), 0.1)', borderRadius: 4,
              cursor: activeIndex === segments.length - 1 ? 'default' : 'pointer',
              color: 'var(--fg)', opacity: activeIndex === segments.length - 1 ? 0.2 : 0.6, padding: '4px 8px'
            }}
          >
            Próximo
          </motion.button>
        </div>
      </div>

      <div style={{ position: 'relative', height: 320, width: '100%', perspective: 1000 }}>
        <AnimatePresence>
          {segments.map((seg, i) => {
            const cfg = RFM_CONFIG[seg]
            const data = stats[seg]
            const offset = i - activeIndex

            const isBehind = i > activeIndex
            const isFront = i === activeIndex
            const isPast = i < activeIndex

            if (isPast) return null

            return (
              <motion.div
                key={seg}
                initial={{ opacity: 0, scale: 0.9, x: 20 }}
                animate={{
                  opacity: 1,
                  scale: isFront ? 1 : 1 - (offset * 0.05),
                  x: offset * 32,
                  y: offset * -12,
                  zIndex: segments.length - i,
                  boxShadow: isFront ? '0 12px 40px rgba(var(--fg-rgb), 0.12)' : '0 4px 12px rgba(var(--fg-rgb), 0.05)',
                  filter: isFront ? 'blur(0px)' : 'blur(1px)'
                }}
                exit={{ opacity: 0, x: -100, rotate: -10 }}
                transition={{ duration: 0.45, ease: [0.25, 0.1, 0.25, 1] }}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: 'calc(100% - 100px)',
                  background: 'var(--bg)',
                  border: '1px solid rgba(var(--fg-rgb), 0.1)',
                  borderRadius: 12,
                  padding: '32px',
                  cursor: isFront ? 'default' : 'pointer'
                }}
                onClick={() => isBehind && setActiveIndex(i)}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <p style={{ fontFamily: "'Poppins',sans-serif", fontSize: 18, letterSpacing: '-0.5px', color: 'var(--fg)', margin: 0 }}>{cfg.label}</p>
                    <p style={{ fontFamily: "'Geist Mono',monospace", fontSize: 11, color: 'rgba(var(--fg-rgb), 0.4)', margin: '6px 0 24px', letterSpacing: '0.02em', maxWidth: 200 }}>{cfg.sub}</p>
                  </div>
                  <div style={{
                    width: 40, height: 40, borderRadius: '50%', border: '1px solid rgba(var(--fg-rgb), 0.1)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(var(--fg-rgb), 0.3)'
                  }}>
                    {i + 1}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 32, marginBottom: 32 }}>
                  <div>
                    <p style={{ fontFamily: "'Poppins',sans-serif", fontSize: 40, fontWeight: 400, letterSpacing: '-1.6px', color: 'var(--fg)', margin: 0, lineHeight: 1 }}>{data.count}</p>
                    <p style={{ fontFamily: "'Geist Mono',monospace", fontSize: 11, color: 'rgba(var(--fg-rgb), 0.4)', margin: '8px 0 0', letterSpacing: '0.04em' }}>CLIENTES</p>
                  </div>
                  <div style={{ width: 1, background: 'rgba(var(--fg-rgb), 0.08)', flexShrink: 0 }} />
                  <div>
                    <p style={{ fontFamily: "'Poppins',sans-serif", fontSize: 22, fontWeight: 400, letterSpacing: '-0.8px', color: 'rgba(var(--fg-rgb), 0.8)', margin: 0, lineHeight: 1.2 }}>R$ {fmtBR(data.revenue)}</p>
                    <p style={{ fontFamily: "'Geist Mono',monospace", fontSize: 11, color: 'rgba(var(--fg-rgb), 0.4)', margin: '8px 0 0', letterSpacing: '0.04em' }}>RECEITA ESTIMADA</p>
                  </div>
                </div>

                <div style={{ borderTop: '1px solid rgba(var(--fg-rgb), 0.07)', paddingTop: 24 }}>
                  <p style={{ fontFamily: "'Geist Mono',monospace", fontSize: 11, color: 'rgba(var(--fg-rgb), 0.5)', letterSpacing: '0.06em', margin: '0 0 10px' }}>IA STRATEGY</p>
                  <p style={{ fontFamily: "'Poppins',sans-serif", fontSize: 14, letterSpacing: '-0.3px', color: 'rgba(var(--fg-rgb), 0.75)', margin: 0, lineHeight: 1.5 }}>
                    {cfg.suggestion}
                  </p>
                </div>
              </motion.div>
            )
          })}
        </AnimatePresence>
      </div>
    </div>
  )
}

// ── Cohort heatmap ────────────────────────────────────────────────────────────
const COHORT_CHANNELS = ['Todos', 'Meta Ads', 'Google Orgânico', 'Google Ads'] as const
const PERIOD_COLS: { key: keyof CohortRow; label: string }[] = [
  { key: 'r30', label: '30d' },
  { key: 'r60', label: '60d' },
  { key: 'r90', label: '90d' },
  { key: 'r180', label: '180d' },
]

function CohortHeatmap() {
  const [channel, setChannel] = useState<string>('Todos')
  const [dropOpen, setDropOpen] = useState(false)

  const rows = COHORT_DATA[channel] ?? COHORT_DATA['Todos']

  function cellBg(v: number | null) {
    if (v === null) return 'transparent'
    return `rgba(var(--fg-rgb), ${v / 100 * 0.6})`
  }
  function cellColor(v: number | null) {
    if (v === null) return 'rgba(var(--fg-rgb), 0.2)'
    return v > 50 ? 'var(--on-inv)' : 'var(--fg)'
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <SectionLabel>COHORT DE RETENÇÃO</SectionLabel>
        <div style={{ position: 'relative', marginBottom: 20 }}>
          <motion.button
            onClick={() => setDropOpen(o => !o)}
            whileTap={{ scale: 0.97 }}
            style={{ display: 'flex', alignItems: 'center', gap: 6, fontFamily: "'Poppins',sans-serif", fontSize: 13, letterSpacing: '-0.3px', padding: '5px 12px', borderRadius: 3, border: '1px solid rgba(var(--fg-rgb), 0.13)', background: 'transparent', cursor: 'pointer', color: channel !== 'Todos' ? 'var(--fg)' : 'rgba(var(--fg-rgb), 0.55)' }}
          >
            {channel === 'Todos' ? 'Canal de origem' : channel}
            <svg width="10" height="6" viewBox="0 0 10 6" fill="none">
              <path d="M1 1l4 4 4-4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </motion.button>
          <AnimatePresence>
            {dropOpen && (
              <motion.div
                initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.15 }}
                style={{ position: 'absolute', top: 'calc(100% + 6px)', right: 0, background: 'var(--bg)', border: '1px solid rgba(var(--fg-rgb), 0.14)', borderRadius: 4, padding: '6px 0', zIndex: 200, minWidth: 160, boxShadow: '0 4px 20px rgba(var(--fg-rgb), 0.07)' }}
              >
                {COHORT_CHANNELS.map(ch => (
                  <motion.button
                    key={ch}
                    onClick={() => { setChannel(ch); setDropOpen(false) }}
                    whileHover={{ backgroundColor: 'rgba(var(--fg-rgb), 0.04)' }}
                    style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 14px', background: 'none', border: 'none', cursor: 'pointer', fontFamily: "'Poppins',sans-serif", fontSize: 13, letterSpacing: '-0.3px', color: channel === ch ? 'var(--fg)' : 'rgba(var(--fg-rgb), 0.65)', fontWeight: channel === ch ? 500 : 400 }}
                  >
                    {ch}
                  </motion.button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <div style={{ overflowX: 'auto' }}>
        {/* Header row */}
        <div style={{ display: 'grid', gridTemplateColumns: '80px 56px repeat(4, 72px)', gap: 4, marginBottom: 4 }}>
          <span style={{ fontFamily: "'Geist Mono',monospace", fontSize: 11, color: 'rgba(var(--fg-rgb), 0.45)', letterSpacing: '0.04em' }}>SAFRA</span>
          <span style={{ fontFamily: "'Geist Mono',monospace", fontSize: 11, color: 'rgba(var(--fg-rgb), 0.45)', letterSpacing: '0.04em', textAlign: 'center' }}>N</span>
          {PERIOD_COLS.map(p => (
            <span key={p.key} style={{ fontFamily: "'Geist Mono',monospace", fontSize: 11, color: 'rgba(var(--fg-rgb), 0.45)', letterSpacing: '0.04em', textAlign: 'center' }}>{p.label}</span>
          ))}
        </div>

        {rows.map((row, ri) => (
          <motion.div
            key={row.month}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3, delay: ri * 0.06 + 0.1 }}
            style={{ display: 'grid', gridTemplateColumns: '80px 56px repeat(4, 72px)', gap: 4, marginBottom: 4 }}
          >
            <span style={{ fontFamily: "'Geist Mono',monospace", fontSize: 12, color: 'rgba(var(--fg-rgb), 0.6)', display: 'flex', alignItems: 'center' }}>{row.month}</span>
            <span style={{ fontFamily: "'Geist Mono',monospace", fontSize: 12, color: 'rgba(var(--fg-rgb), 0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{row.n}</span>
            {PERIOD_COLS.map(p => {
              const val = row[p.key] as number | null
              return (
                <div
                  key={p.key}
                  style={{ height: 48, borderRadius: 3, background: cellBg(val), display: 'flex', alignItems: 'center', justifyContent: 'center', border: val === null ? '1px dashed rgba(var(--fg-rgb), 0.07)' : 'none' }}
                >
                  <span style={{ fontFamily: "'Geist Mono',monospace", fontSize: 12, color: cellColor(val), letterSpacing: '0.02em' }}>
                    {val !== null ? `${val}%` : '—'}
                  </span>
                </div>
              )
            })}
          </motion.div>
        ))}
      </div>

      {/* Retention Insight Box */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6, duration: 0.4 }}
        style={{
          marginTop: 28, padding: '20px',
          background: 'rgba(var(--fg-rgb), 0.02)', borderRadius: 8,
          border: '1px solid rgba(var(--fg-rgb), 0.06)'
        }}
      >
        <p style={{ fontFamily: "'Geist Mono', monospace", fontSize: 10, color: 'rgba(var(--fg-rgb), 0.45)', letterSpacing: '0.08em', margin: '0 0 8px', textTransform: 'uppercase' }}>Insight de Retenção</p>
        <p style={{ fontFamily: "'Poppins', sans-serif", fontSize: 13, color: 'rgba(var(--fg-rgb), 0.7)', margin: 0, lineHeight: 1.6, letterSpacing: '-0.2px' }}>
          As safras de <span style={{ color: 'var(--fg)', fontWeight: 500 }}>Q4/24</span> apresentam retenção 12% superior à média anual.
          Clientes vindos de <span style={{ color: 'var(--fg)', fontWeight: 500 }}>Google Orgânico</span> têm o LTV mais resiliente.
        </p>
      </motion.div>
    </div>
  )
}

// ── AI actions feed ───────────────────────────────────────────────────────────
function AIActions() {
  const [dismissed, setDismissed] = useState<Set<string>>(new Set())
  const [approved, setApproved] = useState<Set<string>>(new Set())

  const visible = AI_ACTIONS.filter(a => !dismissed.has(a.id))

  return (
    <div>
      <SectionLabel>AÇÕES DA IA</SectionLabel>
      <AnimatePresence mode="popLayout">
        {visible.length === 0 ? (
          <motion.p
            key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ fontFamily: "'Poppins',sans-serif", fontSize: 14, color: 'rgba(var(--fg-rgb), 0.35)', padding: '8px 0' }}
          >
            Todas as sugestões foram processadas.
          </motion.p>
        ) : visible.map((action, i) => {
          const isApproved = approved.has(action.id)
          return (
            <motion.div
              key={action.id}
              layout
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, x: 24, transition: { duration: 0.2 } }}
              transition={{ duration: 0.3, delay: i * 0.06, ease: [0.25, 0.1, 0.25, 1] }}
              style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '16px 20px', border: '1px solid rgba(var(--fg-rgb), 0.09)', borderRadius: 6, marginBottom: 8 }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontFamily: "'Poppins',sans-serif", fontSize: 14, letterSpacing: '-0.4px', color: 'var(--fg)', margin: 0 }}>
                  <span style={{ fontFamily: "'Geist Mono',monospace", fontWeight: 500, color: 'var(--fg)' }}>{action.count}</span>
                  {' '}{action.description}.
                </p>
                <p style={{ fontFamily: "'Geist Mono',monospace", fontSize: 11, color: 'rgba(var(--fg-rgb), 0.45)', margin: '4px 0 0', letterSpacing: '0.03em' }}>
                  {action.action} · {action.segment}
                </p>
              </div>
              <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                <motion.button
                  onClick={() => { setApproved(s => new Set([...s, action.id])); setTimeout(() => setDismissed(s => new Set([...s, action.id])), 600) }}
                  whileHover={{ opacity: isApproved ? 1 : 0.8 }}
                  whileTap={{ scale: 0.96 }}
                  style={{
                    fontFamily: "'Poppins',sans-serif", fontSize: 13, letterSpacing: '-0.3px',
                    padding: '7px 16px', borderRadius: 3, border: 'none', cursor: 'pointer',
                    background: isApproved ? 'rgba(var(--fg-rgb), 0.85)' : 'var(--inv)',
                    color: 'var(--on-inv)', transition: 'background 0.2s',
                  }}
                >
                  {isApproved ? 'Aprovado ✓' : 'Aprovar'}
                </motion.button>
                <motion.button
                  onClick={() => setDismissed(s => new Set([...s, action.id]))}
                  whileHover={{ backgroundColor: 'rgba(var(--fg-rgb), 0.05)' }}
                  whileTap={{ scale: 0.96 }}
                  style={{ fontFamily: "'Poppins',sans-serif", fontSize: 13, letterSpacing: '-0.3px', padding: '7px 12px', borderRadius: 3, border: '1px solid rgba(var(--fg-rgb), 0.13)', background: 'transparent', cursor: 'pointer', color: 'rgba(var(--fg-rgb), 0.5)' }}
                >
                  Ignorar
                </motion.button>
              </div>
            </motion.div>
          )
        })}
      </AnimatePresence>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function Clientes({ onToggleChat }: { onToggleChat?: () => void }) {
  const [selectedClient, setSelectedClient] = useState<Client | null>(null)

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
          <KpiCard label="CLIENTES ATIVOS" value={847} decimals={0} delay={0.1} />
          <KpiCard label="LTV MÉDIO" value={2340} prefix="R$ " decimals={0} delay={0.18} />
          <KpiCard label="CHURN DO PERÍODO" value={4.7} suffix="%" decimals={1} delay={0.26} />
          <KpiCard label="LUCRATIVOS" value={312} decimals={0} delay={0.34} />
          <KpiCard label="EM PAYBACK" value={535} decimals={0} delay={0.42} />
        </div>
      </motion.div>

      {/* Divider */}
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4, delay: 0.5 }}
        style={{ height: 1, background: 'rgba(var(--fg-rgb), 0.08)', marginTop: 52, marginBottom: 48 }}
      />

      {/* Analysis Section (Row 1): Cohort + Client List */}
      <motion.div
        initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.35, ease: [0.25, 0.1, 0.25, 1] }}
        style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1.25fr)', gap: 64, marginBottom: 64 }}
      >
        <CohortHeatmap />
        <ClientList onSelect={setSelectedClient} />
      </motion.div>

      {/* Divider */}
      <div style={{ height: 1, background: 'rgba(var(--fg-rgb), 0.08)', marginTop: 12, marginBottom: 48 }} />

      {/* Strategy Section (Row 2): RFM cards + AI Actions */}
      <motion.div
        initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.45, ease: [0.25, 0.1, 0.25, 1] }}
        style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 64 }}
      >
        <RFMCards />
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
