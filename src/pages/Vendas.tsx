import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { KpiCard } from '../components/KpiCard'
import TopBar from '../components/TopBar'
import DatePicker from '../components/DatePicker'

// ── Mock data ─────────────────────────────────────────────────────────────────
type Status = 'Pago' | 'Pendente' | 'Reembolsado'
type Channel = 'Meta Ads' | 'Google Ads' | 'Google Orgânico' | 'Email' | 'Direto'
type Method = 'Pix' | 'Cartão' | 'Boleto'

interface Transaction {
  id: string; date: string; client: string
  product: string; value: number
  method: Method; status: Status; channel: Channel
}

const TRANSACTIONS: Transaction[] = [
  { id: '1', date: '21/02', client: 'Ana Silva', product: 'Plano Pro Mensal', value: 197, method: 'Cartão', status: 'Pago', channel: 'Meta Ads' },
  { id: '2', date: '21/02', client: 'João Mendes', product: 'Consultoria 1h', value: 350, method: 'Pix', status: 'Pago', channel: 'Direto' },
  { id: '3', date: '20/02', client: 'Carla Souza', product: 'Plano Starter', value: 97, method: 'Boleto', status: 'Pendente', channel: 'Google Ads' },
  { id: '4', date: '20/02', client: 'Pedro Lima', product: 'Plano Pro Anual', value: 1764, method: 'Cartão', status: 'Pago', channel: 'Meta Ads' },
  { id: '5', date: '19/02', client: 'Mariana Costa', product: 'Curso Digital', value: 297, method: 'Pix', status: 'Pago', channel: 'Google Orgânico' },
  { id: '6', date: '19/02', client: 'Rafael Nunes', product: 'Plano Pro Mensal', value: 197, method: 'Cartão', status: 'Reembolsado', channel: 'Meta Ads' },
  { id: '7', date: '18/02', client: 'Beatriz Alves', product: 'Consultoria 1h', value: 350, method: 'Pix', status: 'Pago', channel: 'Email' },
  { id: '8', date: '18/02', client: 'Lucas Ferreira', product: 'Plano Starter', value: 97, method: 'Cartão', status: 'Pago', channel: 'Google Ads' },
  { id: '9', date: '17/02', client: 'Camila Rocha', product: 'Curso Digital', value: 297, method: 'Boleto', status: 'Pendente', channel: 'Meta Ads' },
  { id: '10', date: '17/02', client: 'Diego Santos', product: 'Plano Pro Anual', value: 1764, method: 'Cartão', status: 'Pago', channel: 'Direto' },
  { id: '11', date: '16/02', client: 'Fernanda Lima', product: 'Plano Pro Mensal', value: 197, method: 'Pix', status: 'Pago', channel: 'Google Orgânico' },
  { id: '12', date: '16/02', client: 'Thiago Oliveira', product: 'Consultoria 1h', value: 350, method: 'Cartão', status: 'Pago', channel: 'Meta Ads' },
  { id: '13', date: '15/02', client: 'Isabela Freitas', product: 'Plano Pro Mensal', value: 197, method: 'Cartão', status: 'Pago', channel: 'Email' },
  { id: '14', date: '15/02', client: 'Bruno Castro', product: 'Plano Starter', value: 97, method: 'Pix', status: 'Pendente', channel: 'Google Ads' },
  { id: '15', date: '14/02', client: 'Laura Mendes', product: 'Curso Digital', value: 297, method: 'Cartão', status: 'Pago', channel: 'Meta Ads' },
]

const PRODUCTS = [
  { name: 'Plano Pro Anual', qty: 48, revenue: 84672, avgTicket: 1764 },
  { name: 'Consultoria 1h', qty: 140, revenue: 49000, avgTicket: 350 },
  { name: 'Curso Digital', qty: 210, revenue: 62370, avgTicket: 297 },
  { name: 'Plano Pro Mensal', qty: 287, revenue: 56539, avgTicket: 197 },
  { name: 'Plano Starter', qty: 365, revenue: 35405, avgTicket: 97 },
]

interface PaymentLink { name: string; slug: string; clicks: number; active: boolean }
const PAYMENT_LINKS: PaymentLink[] = [
  { name: 'Plano Pro Mensal', slug: 'northie.co/pro', clicks: 294, active: true },
  { name: 'Consultoria Estratégica', slug: 'northie.co/consult', clicks: 87, active: true },
  { name: 'Black Friday 2024', slug: 'northie.co/bf24', clicks: 1240, active: false },
]

interface CheckoutPage { name: string; visits: number; conv: number; active: boolean }
const CHECKOUT_PAGES: CheckoutPage[] = [
  { name: 'Checkout Principal', visits: 342, conv: 18, active: true },
  { name: 'Upsell Anual', visits: 89, conv: 24, active: true },
  { name: 'Landing Curso', visits: 610, conv: 11, active: false },
]

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtBR(v: number) {
  return new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 }).format(v)
}

// ── Sub-components ────────────────────────────────────────────────────────────
const STATUS_STYLE: Record<Status, React.CSSProperties> = {
  Pago: { background: 'rgba(30,30,30,0.08)', color: '#1E1E1E' },
  Pendente: { border: '1px solid rgba(30,30,30,0.18)', color: 'rgba(30,30,30,0.6)' },
  Reembolsado: { background: 'rgba(30,30,30,0.04)', color: 'rgba(30,30,30,0.38)' },
}

function StatusBadge({ status }: { status: Status }) {
  return (
    <span style={{
      fontFamily: "'Geist Mono', monospace",
      fontSize: 11, letterSpacing: '0.02em',
      padding: '4px 8px', borderRadius: 3,
      whiteSpace: 'nowrap',
      ...STATUS_STYLE[status],
    }}>
      {status}
    </span>
  )
}

function MethodBadge({ method }: { method: Method }) {
  return (
    <span style={{
      fontFamily: "'Geist Mono', monospace",
      fontSize: 11, color: 'rgba(30,30,30,0.5)',
      padding: '3px 7px',
      border: '1px solid rgba(30,30,30,0.1)',
      borderRadius: 3, whiteSpace: 'nowrap',
    }}>
      {method}
    </span>
  )
}

// ── Section label ─────────────────────────────────────────────────────────────
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p style={{
      fontFamily: "'Geist Mono', 'Courier New', monospace",
      fontSize: 12, color: 'rgba(30,30,30,0.5)',
      letterSpacing: '0.06em', marginBottom: 20,
    }}>
      {children}
    </p>
  )
}

// ── Table header cell ─────────────────────────────────────────────────────────
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

// ── Transaction list ──────────────────────────────────────────────────────────
const STATUS_FILTERS: Array<Status | 'Todos'> = ['Todos', 'Pago', 'Pendente', 'Reembolsado']
const CHANNELS: Array<Channel | 'Todos'> = ['Todos', 'Meta Ads', 'Google Ads', 'Google Orgânico', 'Email', 'Direto']

function TransactionList() {
  const [statusFilter, setStatusFilter] = useState<Status | 'Todos'>('Todos')
  const [channelFilter, setChannelFilter] = useState<Channel | 'Todos'>('Todos')
  const [channelOpen, setChannelOpen] = useState(false)
  const [search, setSearch] = useState('')

  const filtered = useMemo(() => TRANSACTIONS.filter(t => {
    if (statusFilter !== 'Todos' && t.status !== statusFilter) return false
    if (channelFilter !== 'Todos' && t.channel !== channelFilter) return false
    if (search && !t.client.toLowerCase().includes(search.toLowerCase()) &&
      !t.product.toLowerCase().includes(search.toLowerCase())) return false
    return true
  }), [statusFilter, channelFilter, search])

  return (
    <div>
      <SectionLabel>TRANSAÇÕES</SectionLabel>

      {/* Filter row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        {/* Status tabs */}
        <div style={{ display: 'flex', gap: 4 }}>
          {STATUS_FILTERS.map(s => (
            <motion.button
              key={s}
              onClick={() => setStatusFilter(s)}
              whileTap={{ scale: 0.97 }}
              style={{
                fontFamily: "'Poppins', sans-serif",
                fontSize: 13, letterSpacing: '-0.3px',
                padding: '5px 12px', borderRadius: 3, border: 'none',
                cursor: 'pointer',
                background: statusFilter === s ? 'rgba(30,30,30,0.09)' : 'transparent',
                color: statusFilter === s ? '#1E1E1E' : 'rgba(30,30,30,0.5)',
                transition: 'background 0.15s, color 0.15s',
              }}
            >
              {s}
            </motion.button>
          ))}
        </div>

        {/* Spacer */}
        <div style={{ flex: 1 }} />

        {/* Channel dropdown */}
        <div style={{ position: 'relative' }}>
          <motion.button
            onClick={() => setChannelOpen(o => !o)}
            whileTap={{ scale: 0.97 }}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              fontFamily: "'Poppins', sans-serif",
              fontSize: 13, letterSpacing: '-0.3px',
              padding: '5px 12px', borderRadius: 3,
              border: '1px solid rgba(30,30,30,0.13)',
              background: 'transparent', cursor: 'pointer',
              color: channelFilter !== 'Todos' ? '#1E1E1E' : 'rgba(30,30,30,0.55)',
            }}
          >
            {channelFilter === 'Todos' ? 'Canal' : channelFilter}
            <svg width="10" height="6" viewBox="0 0 10 6" fill="none">
              <path d="M1 1l4 4 4-4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </motion.button>
          <AnimatePresence>
            {channelOpen && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.15 }}
                style={{
                  position: 'absolute', top: 'calc(100% + 6px)', right: 0,
                  background: '#FCF8F8', border: '1px solid rgba(30,30,30,0.14)',
                  borderRadius: 4, padding: '6px 0', zIndex: 200,
                  minWidth: 160, boxShadow: '0 4px 20px rgba(30,30,30,0.07)',
                }}
              >
                {CHANNELS.map(c => (
                  <motion.button
                    key={c}
                    onClick={() => { setChannelFilter(c); setChannelOpen(false) }}
                    whileHover={{ backgroundColor: 'rgba(30,30,30,0.04)' }}
                    style={{
                      display: 'block', width: '100%', textAlign: 'left',
                      padding: '8px 14px', background: 'none', border: 'none',
                      cursor: 'pointer', fontFamily: "'Poppins', sans-serif",
                      fontSize: 13, letterSpacing: '-0.3px',
                      color: channelFilter === c ? '#1E1E1E' : 'rgba(30,30,30,0.65)',
                      fontWeight: channelFilter === c ? 500 : 400,
                    }}
                  >
                    {c}
                  </motion.button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Inline search */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 7,
          border: '1px solid rgba(30,30,30,0.13)', borderRadius: 3,
          padding: '5px 10px', height: 32,
        }}>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ opacity: 0.35, flexShrink: 0 }}>
            <circle cx="5" cy="5" r="4" stroke="#1E1E1E" strokeWidth="1.3" />
            <line x1="8.5" y1="8.5" x2="11" y2="11" stroke="#1E1E1E" strokeWidth="1.3" strokeLinecap="round" />
          </svg>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar..."
            style={{
              border: 'none', background: 'transparent', outline: 'none',
              fontFamily: "'Poppins', sans-serif",
              fontSize: 13, letterSpacing: '-0.3px',
              color: '#1E1E1E', width: 90,
            }}
          />
        </div>
      </div>

      {/* Table header */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '52px 1fr 1fr 80px 72px 90px',
        gap: '0 12px',
        paddingBottom: 10,
        borderBottom: '1px solid rgba(30,30,30,0.1)',
        marginBottom: 2,
      }}>
        <TH>DATA</TH>
        <TH>CLIENTE</TH>
        <TH>PRODUTO</TH>
        <TH align="right">VALOR</TH>
        <TH>MÉTODO</TH>
        <TH>STATUS</TH>
      </div>

      {/* Rows */}
      <AnimatePresence mode="popLayout">
        {filtered.length === 0 ? (
          <motion.p
            key="empty"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              fontFamily: "'Poppins', sans-serif",
              fontSize: 14, color: 'rgba(30,30,30,0.35)',
              padding: '24px 0', textAlign: 'center',
            }}
          >
            Nenhuma transação encontrada
          </motion.p>
        ) : filtered.map((t, i) => (
          <motion.div
            key={t.id}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.25, delay: i * 0.03, ease: [0.25, 0.1, 0.25, 1] }}
            style={{
              display: 'grid',
              gridTemplateColumns: '52px 1fr 1fr 80px 72px 90px',
              gap: '0 12px',
              alignItems: 'center',
              padding: '13px 0',
              borderBottom: '1px solid rgba(30,30,30,0.055)',
            }}
          >
            <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: 12, color: 'rgba(30,30,30,0.45)' }}>
              {t.date}
            </span>
            <span style={{ fontFamily: "'Poppins', sans-serif", fontSize: 13, letterSpacing: '-0.3px', color: '#1E1E1E', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {t.client}
            </span>
            <span style={{ fontFamily: "'Poppins', sans-serif", fontSize: 13, letterSpacing: '-0.3px', color: 'rgba(30,30,30,0.65)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {t.product}
            </span>
            <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: 13, color: '#1E1E1E', textAlign: 'right' }}>
              R$ {fmtBR(t.value)}
            </span>
            <MethodBadge method={t.method} />
            <StatusBadge status={t.status} />
          </motion.div>
        ))}
      </AnimatePresence>

      {filtered.length > 0 && (
        <p style={{
          fontFamily: "'Geist Mono', monospace",
          fontSize: 11, color: 'rgba(30,30,30,0.35)',
          marginTop: 14,
        }}>
          {filtered.length} registro{filtered.length !== 1 ? 's' : ''}
        </p>
      )}
    </div>
  )
}

// ── Product revenue table ─────────────────────────────────────────────────────
function ProductRevenue() {
  const maxRevenue = Math.max(...PRODUCTS.map(p => p.revenue))

  return (
    <div>
      <SectionLabel>RECEITA POR PRODUTO</SectionLabel>

      {/* Header */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 44px 90px 90px',
        gap: '0 12px',
        paddingBottom: 10,
        borderBottom: '1px solid rgba(30,30,30,0.1)',
        marginBottom: 2,
      }}>
        <TH>PRODUTO</TH>
        <TH align="right">QTD</TH>
        <TH align="right">RECEITA</TH>
        <TH align="right">TICKET MÉD.</TH>
      </div>

      {PRODUCTS.map((p, i) => (
        <motion.div
          key={p.name}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: i * 0.07 + 0.2, ease: [0.25, 0.1, 0.25, 1] }}
        >
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 44px 90px 90px',
            gap: '0 12px',
            alignItems: 'center',
            padding: '13px 0',
            borderBottom: '1px solid rgba(30,30,30,0.055)',
          }}>
            <span style={{ fontFamily: "'Poppins', sans-serif", fontSize: 13, letterSpacing: '-0.3px', color: '#1E1E1E' }}>
              {p.name}
            </span>
            <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: 12, color: 'rgba(30,30,30,0.55)', textAlign: 'right' }}>
              {p.qty}
            </span>
            <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: 13, color: '#1E1E1E', textAlign: 'right' }}>
              R$ {fmtBR(p.revenue)}
            </span>
            <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: 13, color: 'rgba(30,30,30,0.65)', textAlign: 'right' }}>
              R$ {fmtBR(p.avgTicket)}
            </span>
          </div>

          {/* Proportion bar */}
          <motion.div
            style={{ height: 2, background: 'rgba(30,30,30,0.06)', borderRadius: 99, marginBottom: 2 }}
          >
            <motion.div
              style={{ height: '100%', background: 'rgba(30,30,30,0.35)', borderRadius: 99 }}
              initial={{ width: 0 }}
              animate={{ width: `${(p.revenue / maxRevenue) * 100}%` }}
              transition={{ duration: 0.8, delay: i * 0.08 + 0.35, ease: [0.4, 0, 0.2, 1] }}
            />
          </motion.div>
        </motion.div>
      ))}
    </div>
  )
}

// ── Checkout settings ─────────────────────────────────────────────────────────
function NewButton({ label }: { label: string }) {
  return (
    <motion.button
      whileHover={{ borderColor: 'rgba(30,30,30,0.35)', color: '#1E1E1E' }}
      whileTap={{ scale: 0.97 }}
      style={{
        display: 'flex', alignItems: 'center', gap: 6,
        fontFamily: "'Poppins', sans-serif",
        fontSize: 13, letterSpacing: '-0.3px',
        color: 'rgba(30,30,30,0.5)',
        border: '1px dashed rgba(30,30,30,0.2)',
        borderRadius: 3, padding: '7px 14px',
        background: 'transparent', cursor: 'pointer',
        transition: 'border-color 0.2s, color 0.2s',
      }}
    >
      <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
        <line x1="5.5" y1="1" x2="5.5" y2="10" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
        <line x1="1" y1="5.5" x2="10" y2="5.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      </svg>
      {label}
    </motion.button>
  )
}

function ActiveDot({ active }: { active: boolean }) {
  return (
    <span style={{
      display: 'inline-block',
      width: 6, height: 6, borderRadius: '50%',
      background: active ? '#1E1E1E' : 'rgba(30,30,30,0.2)',
      flexShrink: 0,
    }} />
  )
}

function CheckoutSettings() {
  return (
    <div>
      <SectionLabel>CONFIGURAÇÕES DE CHECKOUT</SectionLabel>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 48 }}>

        {/* Links de Pagamento */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1, ease: [0.25, 0.1, 0.25, 1] }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
            <span style={{ fontFamily: "'Poppins', sans-serif", fontSize: 14, letterSpacing: '-0.4px', color: '#1E1E1E' }}>
              Links de Pagamento
            </span>
            <NewButton label="Novo link" />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {PAYMENT_LINKS.map((link, i) => (
              <motion.div
                key={link.slug}
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3, delay: i * 0.07 + 0.2 }}
                whileHover={{ backgroundColor: 'rgba(30,30,30,0.025)' }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '11px 12px', borderRadius: 3, cursor: 'pointer',
                  opacity: link.active ? 1 : 0.45,
                }}
              >
                <ActiveDot active={link.active} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontFamily: "'Poppins', sans-serif", fontSize: 13, letterSpacing: '-0.3px', color: '#1E1E1E', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {link.name}
                  </p>
                  <p style={{ fontFamily: "'Geist Mono', monospace", fontSize: 11, color: 'rgba(30,30,30,0.45)', margin: '2px 0 0' }}>
                    {link.slug}
                  </p>
                </div>
                <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: 11, color: 'rgba(30,30,30,0.4)', whiteSpace: 'nowrap' }}>
                  {fmtBR(link.clicks)} cliques
                </span>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Páginas de Checkout */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.18, ease: [0.25, 0.1, 0.25, 1] }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
            <span style={{ fontFamily: "'Poppins', sans-serif", fontSize: 14, letterSpacing: '-0.4px', color: '#1E1E1E' }}>
              Páginas de Checkout
            </span>
            <NewButton label="Nova página" />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {CHECKOUT_PAGES.map((page, i) => (
              <motion.div
                key={page.name}
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3, delay: i * 0.07 + 0.25 }}
                whileHover={{ backgroundColor: 'rgba(30,30,30,0.025)' }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '11px 12px', borderRadius: 3, cursor: 'pointer',
                  opacity: page.active ? 1 : 0.45,
                }}
              >
                <ActiveDot active={page.active} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontFamily: "'Poppins', sans-serif", fontSize: 13, letterSpacing: '-0.3px', color: '#1E1E1E', margin: 0 }}>
                    {page.name}
                  </p>
                  <p style={{ fontFamily: "'Geist Mono', monospace", fontSize: 11, color: 'rgba(30,30,30,0.45)', margin: '2px 0 0' }}>
                    {fmtBR(page.visits)} visitas
                  </p>
                </div>
                <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: 11, color: 'rgba(30,30,30,0.5)', whiteSpace: 'nowrap' }}>
                  {page.conv}% conv.
                </span>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Assinaturas Recorrentes */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.26, ease: [0.25, 0.1, 0.25, 1] }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
            <span style={{ fontFamily: "'Poppins', sans-serif", fontSize: 14, letterSpacing: '-0.4px', color: '#1E1E1E' }}>
              Assinaturas Recorrentes
            </span>
            <NewButton label="Nova assinatura" />
          </div>

          {[
            { label: 'Ativas', value: 487, dot: true },
            { label: 'Trials em andamento', value: 23, dot: true },
            { label: 'Pendentes renovação', value: 8, dot: false },
          ].map((row, i) => (
            <motion.div
              key={row.label}
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3, delay: i * 0.07 + 0.3 }}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '13px 12px',
                borderBottom: i < 2 ? '1px solid rgba(30,30,30,0.06)' : 'none',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <ActiveDot active={row.dot} />
                <span style={{ fontFamily: "'Poppins', sans-serif", fontSize: 13, letterSpacing: '-0.3px', color: 'rgba(30,30,30,0.7)' }}>
                  {row.label}
                </span>
              </div>
              <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: 18, letterSpacing: '-0.5px', color: '#1E1E1E' }}>
                {row.value}
              </span>
            </motion.div>
          ))}
        </motion.div>

      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function Vendas({ onToggleChat }: { onToggleChat?: () => void }) {
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
        Vendas
      </motion.h1>

      {/* KPIs */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3, delay: 0.1 }}
        style={{ display: 'flex', flexDirection: 'column', gap: 32, marginTop: 40 }}
      >
        <DatePicker />
        <div style={{ display: 'flex', gap: 48, alignItems: 'center', flexWrap: 'wrap' }}>
          <KpiCard label="FATURAMENTO" value={240000} prefix="R$ " decimals={0} delay={0.1} />
          <KpiCard label="TRANSAÇÕES" value={1244} decimals={0} delay={0.18} />
          <KpiCard label="TICKET MÉDIO" value={192.9} prefix="R$ " decimals={2} delay={0.26} />
          <KpiCard label="TAXA DE CONVERSÃO" value={3.2} suffix="%" decimals={1} delay={0.34} />
          <KpiCard label="REEMBOLSOS" value={4800} prefix="R$ " decimals={0} delay={0.42} />
        </div>
      </motion.div>

      {/* Divider */}
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }}
        transition={{ duration: 0.4, delay: 0.5 }}
        style={{ height: 1, background: 'rgba(30,30,30,0.08)', marginTop: 52, marginBottom: 48 }}
      />

      {/* Transactions + Products */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.35, ease: [0.25, 0.1, 0.25, 1] }}
        style={{ display: 'grid', gridTemplateColumns: '1.35fr 1fr', gap: 56 }}
      >
        <TransactionList />
        <ProductRevenue />
      </motion.div>

      {/* Divider */}
      <div style={{ height: 1, background: 'rgba(30,30,30,0.08)', marginTop: 52, marginBottom: 48 }} />

      {/* Checkout settings */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.45, ease: [0.25, 0.1, 0.25, 1] }}
      >
        <CheckoutSettings />
      </motion.div>
    </div>
  )
}
