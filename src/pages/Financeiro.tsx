import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import TopBar from '../components/layout/TopBar'
import { financeiroApi, invalidateCache } from '../lib/api'

// ── Types ─────────────────────────────────────────────────────────────────────

interface PLData {
  receita_bruta: number
  taxas_plataforma: number
  custo_ads: number
  gastos_fixos: number
  margem_estimada: number
  margem_pct: number
  variacao_mes_anterior: number
}

interface ExtratoRow {
  date: string
  receita: number
  ads_spend: number
  plataforma: number
}

interface GastoFixo {
  id: string
  name: string
  category: string | null
  supplier_name: string | null
  monthly_cost_brl: number
  notes: string | null
}

interface GastoFixoForm {
  name: string
  supplier_name: string
  category: string
  monthly_cost_brl: string
  notes: string
}

interface PageProps {
  onToggleChat: () => void
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fadeUp(delay: number) {
  return {
    initial: { opacity: 0, y: 10 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.38, delay, ease: [0.25, 0.1, 0.25, 1] as const },
  }
}

function fmtBRL(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function fmtPct(value: number): string {
  return value.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + '%'
}

function fmtDate(iso: string): string {
  return new Date(iso + 'T00:00:00').toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

function defaultRange() {
  const end = new Date()
  const start = new Date(end)
  start.setDate(1)
  const toISO = (d: Date) => d.toISOString().slice(0, 10)
  return { inicio: toISO(start), fim: toISO(end) }
}

const CARD_STYLE: React.CSSProperties = {
  background: '#FFFFFF',
  border: '1px solid rgba(66,87,138,0.12)',
  borderRadius: 10,
  padding: '20px 24px',
}

const EMPTY_FORM: GastoFixoForm = {
  name: '',
  supplier_name: '',
  category: '',
  monthly_cost_brl: '',
  notes: '',
}

const CATEGORIES = [
  'SaaS / Ferramentas',
  'Pessoal / Freelancers',
  'Infraestrutura',
  'Marketing',
  'Operacional',
  'Outro',
]

// ── Sub-components ────────────────────────────────────────────────────────────

function Skeleton({ width = '100%', height = 16 }: { width?: string | number; height?: number }) {
  return (
    <div
      style={{
        width,
        height,
        borderRadius: 6,
        background: 'linear-gradient(90deg, #F0EFF2 25%, #E8E7EA 50%, #F0EFF2 75%)',
        backgroundSize: '200% 100%',
        animation: 'shimmer 1.4s infinite',
      }}
    />
  )
}

interface KpiCardLocalProps {
  label: string
  value: string | null
  sub?: string
  subColor?: string
  loading: boolean
}

function KpiCardLocal({ label, value, sub, subColor, loading }: KpiCardLocalProps) {
  return (
    <div style={{ ...CARD_STYLE, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <span
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 11,
          fontWeight: 500,
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          color: '#8B8585',
        }}
      >
        {label}
      </span>
      {loading ? (
        <>
          <Skeleton height={32} width="70%" />
          <Skeleton height={13} width="45%" />
        </>
      ) : (
        <>
          <span
            style={{
              fontFamily: 'var(--font-sans)',
              fontSize: 28,
              fontWeight: 700,
              color: '#37352F',
              lineHeight: 1.1,
              letterSpacing: '-0.02em',
            }}
          >
            {value ?? '—'}
          </span>
          {sub && (
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 12,
                color: subColor ?? '#8B8585',
              }}
            >
              {sub}
            </span>
          )}
        </>
      )}
    </div>
  )
}

// ── Aviso Transparência ───────────────────────────────────────────────────────

function AvisoTransparencia() {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        background: 'rgba(255,89,0,0.06)',
        border: '1px solid rgba(255,89,0,0.18)',
        borderRadius: 10,
        padding: '12px 18px',
      }}
    >
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none" style={{ flexShrink: 0 }}>
        <circle cx="9" cy="9" r="8.25" stroke="#FF5900" strokeWidth="1.5" />
        <path d="M9 5.5V9.5" stroke="#FF5900" strokeWidth="1.5" strokeLinecap="round" />
        <circle cx="9" cy="12" r="0.75" fill="#FF5900" />
      </svg>
      <span
        style={{
          fontFamily: 'var(--font-sans)',
          fontSize: 13,
          color: '#37352F',
          flex: 1,
        }}
      >
        Margem calculada com receita das plataformas conectadas, gasto em ads e gastos fixos informados por
        você. Conecte seu banco para completar o quadro financeiro.
      </span>
      <a
        href="#"
        style={{
          fontFamily: 'var(--font-sans)',
          fontSize: 13,
          fontWeight: 600,
          color: '#FF5900',
          textDecoration: 'none',
          whiteSpace: 'nowrap',
        }}
      >
        Saiba mais
      </a>
    </div>
  )
}

// ── PL Mensal (Waterfall) ─────────────────────────────────────────────────────

interface PLMensalProps {
  data: PLData | null
  loading: boolean
}

interface WaterfallStep {
  label: string
  value: number
  type: 'positive' | 'deduct' | 'result'
}

function PLMensal({ data, loading }: PLMensalProps) {
  if (loading) {
    return (
      <div style={CARD_STYLE}>
        <div style={{ marginBottom: 16 }}>
          <Skeleton height={20} width="30%" />
        </div>
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 12 }}>
            <Skeleton height={14} width="22%" />
            <Skeleton height={28} width={`${30 + i * 12}%`} />
            <Skeleton height={14} width="15%" />
          </div>
        ))}
      </div>
    )
  }

  if (!data) return null

  const steps: WaterfallStep[] = [
    { label: 'Receita Bruta', value: data.receita_bruta, type: 'positive' },
    { label: 'Taxas de Plataforma', value: data.taxas_plataforma, type: 'deduct' },
    { label: 'Custo em Ads', value: data.custo_ads, type: 'deduct' },
    { label: 'Gastos Fixos', value: data.gastos_fixos, type: 'deduct' },
    { label: 'Margem Estimada', value: data.margem_estimada, type: 'result' },
  ]

  const maxValue = data.receita_bruta

  return (
    <div style={CARD_STYLE}>
      <div style={{ marginBottom: 20 }}>
        <h3
          style={{
            fontFamily: 'var(--font-sans)',
            fontSize: 15,
            fontWeight: 600,
            color: '#37352F',
            margin: 0,
          }}
        >
          Demonstrativo de Resultado
        </h3>
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            color: '#8B8585',
          }}
        >
          Composição da margem — mês atual
        </span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {steps.map((step, i) => {
          const pct = maxValue > 0 ? Math.abs(step.value) / maxValue : 0
          const barColor =
            step.type === 'positive'
              ? '#0F7B6C'
              : step.type === 'result'
              ? step.value >= 0
                ? '#0F7B6C'
                : '#DC2626'
              : '#FF5900'
          const isResult = step.type === 'result'

          return (
            <motion.div
              key={step.label}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.07, duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
              style={{
                display: 'grid',
                gridTemplateColumns: '180px 1fr 130px',
                alignItems: 'center',
                gap: 12,
                paddingTop: isResult ? 12 : 0,
                borderTop: isResult ? '1px solid rgba(66,87,138,0.12)' : 'none',
              }}
            >
              <span
                style={{
                  fontFamily: 'var(--font-sans)',
                  fontSize: 13,
                  fontWeight: isResult ? 600 : 400,
                  color: isResult ? '#37352F' : '#6B6560',
                  textAlign: 'right',
                }}
              >
                {step.type === 'deduct' ? '− ' : ''}{step.label}
              </span>

              <div style={{ position: 'relative', height: 28, background: 'rgba(66,87,138,0.05)', borderRadius: 6 }}>
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min(pct * 100, 100)}%` }}
                  transition={{ delay: i * 0.07 + 0.15, duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
                  style={{
                    position: 'absolute',
                    left: 0,
                    top: 0,
                    height: '100%',
                    background: barColor,
                    borderRadius: 6,
                    opacity: isResult ? 1 : 0.75,
                  }}
                />
              </div>

              <span
                style={{
                  fontFamily: 'var(--font-sans)',
                  fontSize: 13,
                  fontWeight: isResult ? 700 : 500,
                  color: isResult
                    ? step.value >= 0
                      ? '#0F7B6C'
                      : '#DC2626'
                    : '#37352F',
                  textAlign: 'right',
                }}
              >
                {step.type === 'deduct' ? `(${fmtBRL(step.value)})` : fmtBRL(step.value)}
                {isResult && (
                  <span
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: 11,
                      color: '#8B8585',
                      marginLeft: 6,
                    }}
                  >
                    {fmtPct(data.margem_pct)}
                  </span>
                )}
              </span>
            </motion.div>
          )
        })}
      </div>
    </div>
  )
}

// ── Extrato Combinado ─────────────────────────────────────────────────────────

interface ExtratoCombinado {
  rows: ExtratoRow[]
  loading: boolean
}

function ExtratoCombinado({ rows, loading }: ExtratoCombinado) {
  const COL: React.CSSProperties = {
    fontFamily: 'var(--font-sans)',
    fontSize: 13,
    padding: '10px 0',
    borderBottom: '1px solid rgba(66,87,138,0.07)',
  }

  return (
    <div style={CARD_STYLE}>
      <div style={{ marginBottom: 16 }}>
        <h3
          style={{
            fontFamily: 'var(--font-sans)',
            fontSize: 15,
            fontWeight: 600,
            color: '#37352F',
            margin: 0,
          }}
        >
          Extrato Combinado
        </h3>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: '#8B8585' }}>
          Receita + gasto por dia
        </span>
      </div>

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[...Array(6)].map((_, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 12 }}>
              {[...Array(4)].map((__, j) => (
                <Skeleton key={j} height={14} />
              ))}
            </div>
          ))}
        </div>
      ) : rows.length === 0 ? (
        <div
          style={{
            textAlign: 'center',
            padding: '48px 0',
            color: '#8B8585',
            fontFamily: 'var(--font-sans)',
            fontSize: 14,
          }}
        >
          Nenhum dado disponível para o período selecionado.
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['Data', 'Receita', 'Gasto em Ads', 'Taxas Plataforma'].map((h) => (
                  <th
                    key={h}
                    style={{
                      ...COL,
                      fontFamily: 'var(--font-mono)',
                      fontSize: 10,
                      fontWeight: 600,
                      letterSpacing: '0.06em',
                      textTransform: 'uppercase',
                      color: '#8B8585',
                      textAlign: h === 'Data' ? 'left' : 'right',
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <motion.tr
                  key={row.date}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.02, duration: 0.25 }}
                >
                  <td style={{ ...COL, color: '#6B6560' }}>{fmtDate(row.date)}</td>
                  <td style={{ ...COL, textAlign: 'right', color: '#0F7B6C', fontWeight: 500 }}>
                    {fmtBRL(row.receita)}
                  </td>
                  <td style={{ ...COL, textAlign: 'right', color: '#DC2626' }}>
                    {row.ads_spend > 0 ? `(${fmtBRL(row.ads_spend)})` : '—'}
                  </td>
                  <td style={{ ...COL, textAlign: 'right', color: '#6B6560' }}>
                    {row.plataforma > 0 ? `(${fmtBRL(row.plataforma)})` : '—'}
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ── Gasto Fixo Manager ────────────────────────────────────────────────────────

interface GastoFixoManagerProps {
  gastos: GastoFixo[]
  loading: boolean
  onRefresh: () => void
}

function GastoFixoManager({ gastos, loading, onRefresh }: GastoFixoManagerProps) {
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<GastoFixoForm>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<GastoFixoForm>(EMPTY_FORM)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const totalMensal = gastos.reduce((acc, g) => acc + g.monthly_cost_brl, 0)

  async function handleCreate() {
    if (!form.name.trim() || !form.monthly_cost_brl) return
    setSaving(true)
    try {
      await financeiroApi.createGastoFixo({
        name: form.name.trim(),
        supplier_name: form.supplier_name.trim() || undefined,
        category: form.category || undefined,
        monthly_cost_brl: parseFloat(form.monthly_cost_brl.replace(',', '.')),
        notes: form.notes.trim() || undefined,
      })
      invalidateCache('/financeiro')
      setForm(EMPTY_FORM)
      setShowForm(false)
      onRefresh()
    } finally {
      setSaving(false)
    }
  }

  async function handleUpdate(id: string) {
    setSaving(true)
    try {
      await financeiroApi.updateGastoFixo(id, {
        name: editForm.name.trim(),
        supplier_name: editForm.supplier_name.trim() || null,
        category: editForm.category || null,
        monthly_cost_brl: parseFloat(editForm.monthly_cost_brl.replace(',', '.')),
        notes: editForm.notes.trim() || null,
      })
      invalidateCache('/financeiro')
      setEditingId(null)
      onRefresh()
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    setDeletingId(id)
    try {
      await financeiroApi.deleteGastoFixo(id)
      invalidateCache('/financeiro')
      onRefresh()
    } finally {
      setDeletingId(null)
    }
  }

  function startEdit(g: GastoFixo) {
    setEditingId(g.id)
    setEditForm({
      name: g.name,
      supplier_name: g.supplier_name ?? '',
      category: g.category ?? '',
      monthly_cost_brl: g.monthly_cost_brl.toString(),
      notes: g.notes ?? '',
    })
  }

  const inputStyle: React.CSSProperties = {
    fontFamily: 'var(--font-sans)',
    fontSize: 13,
    padding: '8px 12px',
    border: '1px solid rgba(66,87,138,0.18)',
    borderRadius: 8,
    background: '#F7F7FA',
    color: '#37352F',
    outline: 'none',
    width: '100%',
    boxSizing: 'border-box',
  }

  const selectStyle: React.CSSProperties = { ...inputStyle, cursor: 'pointer' }

  return (
    <div style={CARD_STYLE}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 16,
        }}
      >
        <div>
          <h3
            style={{
              fontFamily: 'var(--font-sans)',
              fontSize: 15,
              fontWeight: 600,
              color: '#37352F',
              margin: 0,
            }}
          >
            Gastos Fixos Mensais
          </h3>
          {gastos.length > 0 && (
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: '#8B8585' }}>
              Total: {fmtBRL(totalMensal)} / mês
            </span>
          )}
        </div>

        {!showForm && (
          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => setShowForm(true)}
            style={{
              fontFamily: 'var(--font-sans)',
              fontSize: 13,
              fontWeight: 600,
              color: '#FFFFFF',
              background: '#FF5900',
              border: 'none',
              borderRadius: 8,
              padding: '8px 16px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <span style={{ fontSize: 16, lineHeight: 1 }}>+</span> Adicionar
          </motion.button>
        )}
      </div>

      {/* Add form */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25, ease: [0.25, 0.1, 0.25, 1] }}
            style={{
              overflow: 'hidden',
              marginBottom: 20,
              padding: '16px',
              background: '#F7F7FA',
              borderRadius: 10,
              border: '1px solid rgba(66,87,138,0.10)',
            }}
          >
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 10,
                marginBottom: 10,
              }}
            >
              <div>
                <label style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: '#8B8585', display: 'block', marginBottom: 4, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                  Nome *
                </label>
                <input
                  style={inputStyle}
                  placeholder="ex: Vercel, Notion, Freelancer"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                />
              </div>
              <div>
                <label style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: '#8B8585', display: 'block', marginBottom: 4, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                  Valor Mensal (R$) *
                </label>
                <input
                  style={inputStyle}
                  placeholder="ex: 250"
                  value={form.monthly_cost_brl}
                  onChange={(e) => setForm((f) => ({ ...f, monthly_cost_brl: e.target.value }))}
                  type="number"
                  min="0"
                  step="0.01"
                />
              </div>
              <div>
                <label style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: '#8B8585', display: 'block', marginBottom: 4, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                  Fornecedor
                </label>
                <input
                  style={inputStyle}
                  placeholder="ex: Vercel Inc."
                  value={form.supplier_name}
                  onChange={(e) => setForm((f) => ({ ...f, supplier_name: e.target.value }))}
                />
              </div>
              <div>
                <label style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: '#8B8585', display: 'block', marginBottom: 4, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                  Categoria
                </label>
                <select
                  style={selectStyle}
                  value={form.category}
                  onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                >
                  <option value="">Selecionar categoria</option>
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: '#8B8585', display: 'block', marginBottom: 4, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                  Observações
                </label>
                <input
                  style={inputStyle}
                  placeholder="Opcional"
                  value={form.notes}
                  onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={() => { setShowForm(false); setForm(EMPTY_FORM) }}
                style={{
                  fontFamily: 'var(--font-sans)',
                  fontSize: 13,
                  color: '#6B6560',
                  background: 'transparent',
                  border: '1px solid rgba(66,87,138,0.18)',
                  borderRadius: 8,
                  padding: '7px 16px',
                  cursor: 'pointer',
                }}
              >
                Cancelar
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.97 }}
                onClick={handleCreate}
                disabled={saving || !form.name.trim() || !form.monthly_cost_brl}
                style={{
                  fontFamily: 'var(--font-sans)',
                  fontSize: 13,
                  fontWeight: 600,
                  color: '#FFFFFF',
                  background: saving ? '#ccc' : '#FF5900',
                  border: 'none',
                  borderRadius: 8,
                  padding: '7px 20px',
                  cursor: saving ? 'not-allowed' : 'pointer',
                }}
              >
                {saving ? 'Salvando...' : 'Salvar'}
              </motion.button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Empty state */}
      {!loading && gastos.length === 0 && !showForm && (
        <div
          style={{
            textAlign: 'center',
            padding: '40px 24px',
            color: '#8B8585',
          }}
        >
          <div
            style={{
              fontFamily: 'var(--font-sans)',
              fontSize: 14,
              color: '#6B6560',
              marginBottom: 12,
              lineHeight: 1.6,
            }}
          >
            Para calcular sua margem real, adicione seus gastos fixos mensais.
            <br />
            Ferramentas, freelancers, pessoal — leva menos de 3 minutos.
          </div>
          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => setShowForm(true)}
            style={{
              fontFamily: 'var(--font-sans)',
              fontSize: 13,
              fontWeight: 600,
              color: '#FF5900',
              background: 'rgba(255,89,0,0.08)',
              border: '1px solid rgba(255,89,0,0.2)',
              borderRadius: 8,
              padding: '8px 20px',
              cursor: 'pointer',
            }}
          >
            + Adicionar gastos fixos
          </motion.button>
        </div>
      )}

      {/* Loading skeleton */}
      {loading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[...Array(3)].map((_, i) => (
            <div
              key={i}
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr auto auto',
                gap: 12,
                alignItems: 'center',
                padding: '10px 0',
                borderBottom: '1px solid rgba(66,87,138,0.07)',
              }}
            >
              <Skeleton height={14} width="60%" />
              <Skeleton height={14} width="40%" />
              <Skeleton height={14} width={70} />
              <Skeleton height={14} width={40} />
            </div>
          ))}
        </div>
      )}

      {/* List */}
      {!loading && gastos.length > 0 && (
        <div>
          {gastos.map((gasto, i) => (
            <AnimatePresence key={gasto.id} mode="wait">
              {editingId === gasto.id ? (
                <motion.div
                  key="edit"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  style={{
                    padding: '12px 0',
                    borderBottom: '1px solid rgba(66,87,138,0.07)',
                  }}
                >
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
                    <input
                      style={inputStyle}
                      value={editForm.name}
                      onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                      placeholder="Nome"
                    />
                    <input
                      style={inputStyle}
                      value={editForm.monthly_cost_brl}
                      onChange={(e) => setEditForm((f) => ({ ...f, monthly_cost_brl: e.target.value }))}
                      type="number"
                      placeholder="Valor mensal"
                    />
                    <select
                      style={selectStyle}
                      value={editForm.category}
                      onChange={(e) => setEditForm((f) => ({ ...f, category: e.target.value }))}
                    >
                      <option value="">Categoria</option>
                      {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <input
                      style={inputStyle}
                      value={editForm.notes}
                      onChange={(e) => setEditForm((f) => ({ ...f, notes: e.target.value }))}
                      placeholder="Observações"
                    />
                  </div>
                  <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                    <motion.button
                      whileTap={{ scale: 0.97 }}
                      onClick={() => setEditingId(null)}
                      style={{
                        fontFamily: 'var(--font-sans)',
                        fontSize: 12,
                        color: '#6B6560',
                        background: 'transparent',
                        border: '1px solid rgba(66,87,138,0.18)',
                        borderRadius: 7,
                        padding: '5px 12px',
                        cursor: 'pointer',
                      }}
                    >
                      Cancelar
                    </motion.button>
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.97 }}
                      onClick={() => handleUpdate(gasto.id)}
                      disabled={saving}
                      style={{
                        fontFamily: 'var(--font-sans)',
                        fontSize: 12,
                        fontWeight: 600,
                        color: '#FFFFFF',
                        background: '#FF5900',
                        border: 'none',
                        borderRadius: 7,
                        padding: '5px 14px',
                        cursor: 'pointer',
                      }}
                    >
                      {saving ? 'Salvando...' : 'Salvar'}
                    </motion.button>
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  key="view"
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04, duration: 0.25 }}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr auto auto auto',
                    alignItems: 'center',
                    gap: 16,
                    padding: '11px 0',
                    borderBottom: '1px solid rgba(66,87,138,0.07)',
                  }}
                >
                  <div>
                    <div
                      style={{
                        fontFamily: 'var(--font-sans)',
                        fontSize: 14,
                        fontWeight: 500,
                        color: '#37352F',
                      }}
                    >
                      {gasto.name}
                    </div>
                    <div style={{ display: 'flex', gap: 8, marginTop: 2, alignItems: 'center' }}>
                      {gasto.category && (
                        <span
                          style={{
                            fontFamily: 'var(--font-mono)',
                            fontSize: 10,
                            color: '#8B8585',
                            background: 'rgba(66,87,138,0.06)',
                            padding: '1px 7px',
                            borderRadius: 4,
                          }}
                        >
                          {gasto.category}
                        </span>
                      )}
                      {gasto.supplier_name && (
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: '#8B8585' }}>
                          {gasto.supplier_name}
                        </span>
                      )}
                    </div>
                  </div>

                  <span
                    style={{
                      fontFamily: 'var(--font-sans)',
                      fontSize: 14,
                      fontWeight: 600,
                      color: '#37352F',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {fmtBRL(gasto.monthly_cost_brl)}
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: '#8B8585', marginLeft: 4 }}>
                      /mês
                    </span>
                  </span>

                  <motion.button
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.93 }}
                    onClick={() => startEdit(gasto)}
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      padding: 6,
                      borderRadius: 6,
                      color: '#8B8585',
                      display: 'flex',
                      alignItems: 'center',
                    }}
                  >
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                      <path d="M9.5 1.5L12.5 4.5L5 12H2V9L9.5 1.5Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
                    </svg>
                  </motion.button>

                  <motion.button
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.93 }}
                    onClick={() => handleDelete(gasto.id)}
                    disabled={deletingId === gasto.id}
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      padding: 6,
                      borderRadius: 6,
                      color: deletingId === gasto.id ? '#ccc' : '#DC2626',
                      opacity: deletingId === gasto.id ? 0.5 : 1,
                      display: 'flex',
                      alignItems: 'center',
                    }}
                  >
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                      <path d="M2 3.5H12M5 3.5V2.5C5 2.22 5.22 2 5.5 2H8.5C8.78 2 9 2.22 9 2.5V3.5M5.5 6V10.5M8.5 6V10.5M3.5 3.5L4 11.5C4 11.78 4.22 12 4.5 12H9.5C9.78 12 10 11.78 10 11.5L10.5 3.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </motion.button>
                </motion.div>
              )}
            </AnimatePresence>
          ))}

          <div
            style={{
              display: 'flex',
              justifyContent: 'flex-end',
              paddingTop: 14,
              borderTop: '1px solid rgba(66,87,138,0.12)',
              marginTop: 4,
            }}
          >
            <span style={{ fontFamily: 'var(--font-sans)', fontSize: 13, color: '#6B6560' }}>
              Total mensal:{' '}
              <strong style={{ color: '#37352F', fontWeight: 700 }}>{fmtBRL(totalMensal)}</strong>
            </span>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function Financeiro({ onToggleChat }: PageProps) {
  const [pl, setPL] = useState<PLData | null>(null)
  const [extrato, setExtrato] = useState<ExtratoRow[]>([])
  const [gastos, setGastos] = useState<GastoFixo[]>([])

  const [loadingPL, setLoadingPL] = useState(true)
  const [loadingExtrato, setLoadingExtrato] = useState(true)
  const [loadingGastos, setLoadingGastos] = useState(true)
  const [exportando, setExportando] = useState(false)

  const { inicio, fim } = defaultRange()

  const fetchPL = useCallback(async () => {
    setLoadingPL(true)
    try {
      const res = await financeiroApi.getPL(inicio, fim)
      setPL(res.data)
    } catch {
      setPL(null)
    } finally {
      setLoadingPL(false)
    }
  }, [inicio, fim])

  const fetchExtrato = useCallback(async () => {
    setLoadingExtrato(true)
    try {
      const res = await financeiroApi.getExtrato(inicio, fim)
      setExtrato(Array.isArray(res.data) ? res.data : [])
    } catch {
      setExtrato([])
    } finally {
      setLoadingExtrato(false)
    }
  }, [inicio, fim])

  const fetchGastos = useCallback(async () => {
    setLoadingGastos(true)
    try {
      const res = await financeiroApi.listGastosFixos()
      setGastos(Array.isArray(res.data) ? res.data : [])
    } catch {
      setGastos([])
    } finally {
      setLoadingGastos(false)
    }
  }, [])

  useEffect(() => {
    fetchPL()
    fetchExtrato()
    fetchGastos()
  }, [fetchPL, fetchExtrato, fetchGastos])

  async function handleExportCSV() {
    setExportando(true)
    try {
      const res = await financeiroApi.exportCSV(inicio, fim)
      const url = URL.createObjectURL(new Blob([res.data], { type: 'text/csv;charset=utf-8;' }))
      const a = document.createElement('a')
      a.href = url
      a.download = `northie-financeiro-${inicio}-${fim}.csv`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      // Silencioso — backend retorna erro descritivo
    } finally {
      setExportando(false)
    }
  }

  // KPI derivados
  const kpiReceitaLiquida =
    pl ? fmtBRL(pl.receita_bruta - pl.taxas_plataforma) : null
  const kpiVariacao =
    pl
      ? `${pl.variacao_mes_anterior >= 0 ? '+' : ''}${fmtPct(pl.variacao_mes_anterior)} vs. mês anterior`
      : undefined
  const kpiVariacaoColor =
    pl ? (pl.variacao_mes_anterior >= 0 ? '#0F7B6C' : '#DC2626') : undefined

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#F7F7FA',
        fontFamily: 'var(--font-sans)',
      }}
    >
      <TopBar onToggleChat={onToggleChat} />

      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '32px 32px 80px' }}>
        {/* Header */}
        <motion.div
          {...fadeUp(0)}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 28,
          }}
        >
          <div>
            <h1
              style={{
                fontFamily: 'var(--font-sans)',
                fontSize: 24,
                fontWeight: 600,
                color: '#37352F',
                margin: 0,
                letterSpacing: '-0.02em',
              }}
            >
              Financeiro
            </h1>
            <p
              style={{
                fontFamily: 'var(--font-sans)',
                fontSize: 13,
                color: '#8B8585',
                margin: '4px 0 0',
              }}
            >
              {new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })} — demonstrativo consolidado
            </p>
          </div>

          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={handleExportCSV}
            disabled={exportando}
            style={{
              fontFamily: 'var(--font-sans)',
              fontSize: 13,
              fontWeight: 500,
              color: '#37352F',
              background: '#FFFFFF',
              border: '1px solid rgba(66,87,138,0.18)',
              borderRadius: 8,
              padding: '8px 18px',
              cursor: exportando ? 'not-allowed' : 'pointer',
              opacity: exportando ? 0.6 : 1,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M7 1V9M7 9L4.5 6.5M7 9L9.5 6.5M2 10.5V12C2 12.28 2.22 12.5 2.5 12.5H11.5C11.78 12.5 12 12.28 12 12V10.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {exportando ? 'Exportando...' : 'Exportar CSV'}
          </motion.button>
        </motion.div>

        {/* KPI grid */}
        <motion.div
          {...fadeUp(0.05)}
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: 16,
            marginBottom: 20,
          }}
        >
          <KpiCardLocal
            label="Receita Líquida"
            value={kpiReceitaLiquida}
            sub={kpiVariacao}
            subColor={kpiVariacaoColor}
            loading={loadingPL}
          />
          <KpiCardLocal
            label="Custo em Ads"
            value={pl ? fmtBRL(pl.custo_ads) : null}
            sub={pl ? `${fmtPct((pl.custo_ads / (pl.receita_bruta || 1)) * 100)} da receita bruta` : undefined}
            loading={loadingPL}
          />
          <KpiCardLocal
            label="Gastos Fixos"
            value={pl ? fmtBRL(pl.gastos_fixos) : null}
            sub={
              pl && pl.gastos_fixos > 0
                ? `${fmtPct((pl.gastos_fixos / (pl.receita_bruta || 1)) * 100)} da receita bruta`
                : 'Nenhum gasto cadastrado'
            }
            loading={loadingPL}
          />
          <KpiCardLocal
            label="Margem Estimada"
            value={pl ? fmtPct(pl.margem_pct) : null}
            sub={pl ? fmtBRL(pl.margem_estimada) : undefined}
            subColor={pl ? (pl.margem_estimada >= 0 ? '#0F7B6C' : '#DC2626') : undefined}
            loading={loadingPL}
          />
        </motion.div>

        {/* Aviso Transparência */}
        <motion.div {...fadeUp(0.1)} style={{ marginBottom: 20 }}>
          <AvisoTransparencia />
        </motion.div>

        {/* P&L Waterfall */}
        <motion.div {...fadeUp(0.15)} style={{ marginBottom: 20 }}>
          <PLMensal data={pl} loading={loadingPL} />
        </motion.div>

        {/* Gastos Fixos */}
        <motion.div {...fadeUp(0.2)} style={{ marginBottom: 20 }}>
          <GastoFixoManager
            gastos={gastos}
            loading={loadingGastos}
            onRefresh={() => {
              fetchGastos()
              fetchPL()
            }}
          />
        </motion.div>

        {/* Extrato */}
        <motion.div {...fadeUp(0.25)}>
          <ExtratoCombinado rows={extrato} loading={loadingExtrato} />
        </motion.div>
      </div>

      {/* Shimmer keyframe */}
      <style>{`
        @keyframes shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
      `}</style>
    </div>
  )
}
