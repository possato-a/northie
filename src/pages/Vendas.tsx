import { useState, useMemo, useEffect } from 'react'
import { KpiCard } from '../components/ui/KpiCard'
import TopBar from '../components/layout/TopBar'
import DatePicker from '../components/ui/DatePicker'
import { dashboardApi, dataApi } from '../lib/api'
import { fmtBR } from '../lib/utils'
import type { Transaction, TransactionStatus } from '../types'
import {
  PageHeader, SectionLabel, TH, Divider,
  Btn, Input, EmptyState,
  SectionCard, KpiGrid, SkeletonTable
} from '../components/ui/shared'

// ── Status & Method Tags ──────────────────────────────────────────────────────
function StatusTag({ status }: { status: TransactionStatus }) {
  const cls = status === 'Pago' ? 'tag-complete' : status === 'Pendente' ? 'tag-planning' : 'tag-neutral'
  return <span className={`tag ${cls}`}>{status}</span>
}

// ── Transaction List ──────────────────────────────────────────────────────────
const STATUS_FILTERS: Array<TransactionStatus | 'Todos'> = ['Todos', 'Pago', 'Pendente', 'Reembolsado']

function TransactionList({ transactions, loading }: { transactions: Transaction[], loading: boolean }) {
  const [statusFilter, setStatusFilter] = useState<TransactionStatus | 'Todos'>('Todos')
  const [search, setSearch] = useState('')

  const filtered = useMemo(() => transactions.filter(t => {
    if (statusFilter !== 'Todos' && t.status !== statusFilter) return false
    if (search && !t.client.toLowerCase().includes(search.toLowerCase()) &&
      !t.product.toLowerCase().includes(search.toLowerCase())) return false
    return true
  }), [transactions, statusFilter, search])

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <SectionLabel gutterBottom={0}>Transações ({filtered.length})</SectionLabel>
        <div style={{ display: 'flex', gap: 12 }}>
          <div style={{ display: 'flex', gap: 4 }}>
            {STATUS_FILTERS.map(s => (
              <Btn
                key={s}
                variant={statusFilter === s ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setStatusFilter(s)}
              >
                {s}
              </Btn>
            ))}
          </div>
          <Input
            placeholder="Filtrar..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ width: 140 }}
            icon={<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>}
          />
        </div>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr 80px 72px 90px',
        gap: '0 16px',
        paddingBottom: 10,
        borderBottom: '1px solid var(--color-border)',
        marginBottom: 2,
      }}>
        <TH>Cliente</TH>
        <TH>Produto</TH>
        <TH align="right">Valor</TH>
        <TH>Método</TH>
        <TH>Status</TH>
      </div>

      {loading ? (
          <SkeletonTable rows={6} columns={5} />
        ) : filtered.length === 0 ? (
          <EmptyState title="Nenhuma transação" description="Tente ajustar os filtros ou pesquisar outro termo." />
        ) : filtered.map((t) => (
          <div
            key={t.id}
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr 80px 72px 90px',
              gap: '0 16px',
              padding: '12px 6px',
              borderBottom: '1px solid var(--color-border)',
              cursor: 'default',
              transition: 'background 0.1s',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-bg-secondary)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          >
            <span style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-md)', fontWeight: 500, color: 'var(--color-text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {t.client}
            </span>
            <span style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {t.product}
            </span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-sm)', color: 'var(--color-text-primary)', textAlign: 'right' }}>
              R$ {fmtBR(t.value)}
            </span>
            <span className="tag tag-neutral">{t.method}</span>
            <StatusTag status={t.status} />
          </div>
        ))}
    </div>
  )
}

// ── Product Revenue ───────────────────────────────────────────────────────────
function ProductRevenue({ transactions }: { transactions: Transaction[] }) {
  const products = useMemo(() => {
    const map = new Map<string, { qty: number; revenue: number }>()
    transactions.filter(t => t.status === 'Pago').forEach(t => {
      const prev = map.get(t.product) || { qty: 0, revenue: 0 }
      map.set(t.product, { qty: prev.qty + 1, revenue: prev.revenue + t.value })
    })
    return Array.from(map.entries()).map(([name, stats]) => ({ name, ...stats }))
  }, [transactions])

  const maxRevenue = useMemo(() => Math.max(0, ...products.map(p => p.revenue)), [products])

  return (
    <div>
      <SectionLabel>Receita por Produto</SectionLabel>
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 44px 90px',
        gap: '0 12px',
        paddingBottom: 10,
        borderBottom: '1px solid var(--color-border)',
        marginBottom: 2,
      }}>
        <TH>Produto</TH>
        <TH align="right">Qtd</TH>
        <TH align="right">Receita</TH>
      </div>

      {products.map((p) => (
        <div key={p.name} style={{ padding: '12px 0', borderBottom: '1px solid var(--color-border)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 44px 90px', gap: '0 12px', marginBottom: 8 }}>
            <span style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', color: 'var(--color-text-primary)' }}>{p.name}</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)', textAlign: 'right' }}>{p.qty}</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)', textAlign: 'right' }}>R$ {fmtBR(p.revenue)}</span>
          </div>
          <div style={{ height: 3, background: 'var(--color-bg-secondary)', borderRadius: 4 }}>
            <div
              style={{ height: '100%', background: 'var(--color-primary)', borderRadius: 4, width: `${(p.revenue / maxRevenue) * 100}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Page Component ────────────────────────────────────────────────────────────
export default function Vendas({ onToggleChat }: { onToggleChat?: () => void; user?: any }) {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [stats, setStats] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState<{ label: string; days: number }>({ label: 'Últimos 30 dias', days: 30 })

  useEffect(() => {
    const txPromise = dataApi.getTransactions(period.days).catch(() => ({ data: [] }))
    const statsPromise = dashboardApi.getStats().catch(() => ({ data: {} }))
    const campaignsPromise = dashboardApi.getAdCampaigns(period.days).catch(() => ({ data: [] }))

    Promise.all([txPromise, statsPromise, campaignsPromise]).then(([txRes, statsRes, campaignsRes]) => {
      const rawTx = Array.isArray(txRes.data) ? txRes.data : []
      const mapped = rawTx.map((t: any) => ({
        id: t.id,
        date: new Date(t.created_at).toLocaleDateString('pt-BR'),
        client: t.customers?.name || t.customers?.email || 'Desconhecido',
        product: t.product_name || '—',
        value: Number(t.amount_net),
        method: t.payment_method || '—',
        status: (({ approved: 'Pago', pending: 'Pendente', refunded: 'Reembolsado', cancelled: 'Cancelado', chargeback: 'Estorno' } as Record<string, string>)[t.status] ?? 'Pendente') as TransactionStatus,
        channel: t.customers?.acquisition_channel || 'desconhecido'
      }))
      setTransactions(mapped)

      const campaigns: any[] = Array.isArray(campaignsRes.data) ? campaignsRes.data : []
      const totalLeads = campaigns.reduce((s: number, c: any) => s + (c.leads || 0), 0)
      const totalPurchases = campaigns.reduce((s: number, c: any) => s + (c.purchases || 0), 0)
      const convRate = totalLeads > 0 ? (totalPurchases / totalLeads) * 100 : null

      setStats({ ...(statsRes.data as any), convRate })
    }).finally(() => setLoading(false))
  }, [period.days])

  return (
    <div style={{ paddingBottom: 40 }}>
      <TopBar onToggleChat={onToggleChat} />

      <PageHeader
        title="Vendas"
        subtitle="Analise cada transação e o desempenho de seus produtos em tempo real."
        actions={<DatePicker value={period.label} onChange={(label, days) => setPeriod({ label, days })} />}
      />

      <KpiGrid style={{ marginTop: 40 }}>
        <KpiCard label="FATURAMENTO" value={stats?.total_revenue || 0} prefix="R$ " decimals={0} delay={0.1} />
        <KpiCard label="TRANSAÇÕES" value={transactions.length} decimals={0} delay={0.2} />
        <KpiCard label="TICKET MÉDIO" value={stats?.average_ticket || 0} prefix="R$ " decimals={2} delay={0.3} />
        <KpiCard label="TAXA CONVERSÃO" value={stats?.convRate ?? 0} suffix="%" decimals={1} delay={0.4} />
        <KpiCard label="REEMBOLSOS" value={transactions.filter(t => t.status === 'Reembolsado').length} decimals={0} delay={0.5} />
        <KpiCard label="TAXA REEMBOLSO" value={transactions.length > 0 ? (transactions.filter(t => t.status === 'Reembolsado').length / transactions.length) * 100 : 0} suffix="%" decimals={1} delay={0.6} />
      </KpiGrid>

      <Divider margin="48px 0" />

      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 32 }}>
        <SectionCard>
          <TransactionList transactions={transactions} loading={loading} />
        </SectionCard>
        <SectionCard>
          <ProductRevenue transactions={transactions} />
        </SectionCard>
      </div>
    </div>
  )
}
