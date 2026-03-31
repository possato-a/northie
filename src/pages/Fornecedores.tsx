import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import TopBar from '../components/layout/TopBar'
import { fornecedoresApi } from '../lib/api'

// ── Types ────────────────────────────────────────────────────────────────────

interface Fornecedor {
  id: string
  name: string
  category: string
  monthly_cost: number
  origem: 'auto' | 'manual'
  platform?: string
  roas?: number
  status: 'saudavel' | 'neutro' | 'atencao' | 'critico'
  tendencia?: 'up' | 'down' | 'stable'
}

interface FornecedorROI {
  platform: string
  spend_total: number
  revenue_total: number
  roas: number
  ltv_medio: number
  cac: number
  ltv_cac: number
  clientes: number
}

interface NovoFornecedor {
  name: string
  supplier_name: string
  category: string
  monthly_cost_brl: string
  notes: string
}

interface PageProps {
  onToggleChat: () => void
}

// ── Constants ────────────────────────────────────────────────────────────────

const STATUS_CONFIG = {
  saudavel: { label: 'ROI positivo', color: '#0F7B6C', bg: '#DBEDDB' },
  atencao:  { label: 'Atenção',      color: '#D9730D', bg: '#FBF3DB' },
  critico:  { label: 'ROI negativo', color: '#E03E3E', bg: '#FBE4E4' },
  neutro:   { label: 'Neutro',       color: '#787774', bg: '#F1F1EF' },
} as const

const CATEGORY_LABELS: Record<string, string> = {
  ads:        'Anúncios',
  saas:       'SaaS',
  agencia:    'Agência',
  freelancer: 'Freelancer',
  plataforma: 'Plataforma',
  pessoal:    'Pessoal',
  outro:      'Outro',
}

const CATEGORY_OPTIONS = Object.entries(CATEGORY_LABELS).map(([value, label]) => ({ value, label }))

const fmt = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)

const fmtCompact = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(value)

const FADE_UP = {
  hidden: { opacity: 0, y: 16 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.32, ease: [0.25, 0.1, 0.25, 1], delay: i * 0.06 },
  }),
}

// ── Sub-components ───────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: Fornecedor['status'] }) {
  const cfg = STATUS_CONFIG[status]
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '2px 10px',
        borderRadius: 6,
        fontSize: 11,
        fontFamily: 'var(--font-mono)',
        fontWeight: 500,
        color: cfg.color,
        background: cfg.bg,
        whiteSpace: 'nowrap',
      }}
    >
      {cfg.label}
    </span>
  )
}

function OrigemTag({ origem }: { origem: 'auto' | 'manual' }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '2px 8px',
        borderRadius: 6,
        fontSize: 11,
        fontFamily: 'var(--font-mono)',
        fontWeight: 500,
        color: origem === 'auto' ? '#FF5900' : '#787774',
        background: origem === 'auto' ? '#FFF0E8' : '#F1F1EF',
        whiteSpace: 'nowrap',
      }}
    >
      {origem === 'auto' ? 'automático' : 'manual'}
    </span>
  )
}

function TendenciaArrow({ tendencia }: { tendencia?: Fornecedor['tendencia'] }) {
  if (!tendencia || tendencia === 'stable') return <span style={{ color: '#B8B5AF', fontSize: 14 }}>—</span>
  return (
    <span style={{ fontSize: 14, color: tendencia === 'up' ? '#E03E3E' : '#0F7B6C' }}>
      {tendencia === 'up' ? '↑' : '↓'}
    </span>
  )
}

function KpiCard({
  label,
  value,
  sub,
  index,
}: {
  label: string
  value: string
  sub?: string
  index: number
}) {
  return (
    <motion.div
      custom={index}
      variants={FADE_UP}
      initial="hidden"
      animate="visible"
      style={{
        background: '#FFFFFF',
        border: '1px solid rgba(66,87,138,0.12)',
        borderRadius: 10,
        padding: '20px 24px',
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
      }}
    >
      <span
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 11,
          color: '#9B9793',
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontFamily: 'var(--font-sans)',
          fontWeight: 700,
          fontSize: 28,
          color: '#37352F',
          lineHeight: 1.1,
        }}
      >
        {value}
      </span>
      {sub && (
        <span
          style={{
            fontFamily: 'var(--font-sans)',
            fontSize: 12,
            color: '#9B9793',
          }}
        >
          {sub}
        </span>
      )}
    </motion.div>
  )
}

// ── Detail Drawer ─────────────────────────────────────────────────────────────

function FornecedorDetalhe({
  fornecedor,
  onClose,
  onDelete,
}: {
  fornecedor: Fornecedor
  onClose: () => void
  onDelete?: (id: string) => void
}) {
  const [roi, setRoi] = useState<FornecedorROI | null>(null)
  const [loading, setLoading] = useState(fornecedor.origem === 'auto')
  const [confirmDelete, setConfirmDelete] = useState(false)

  useEffect(() => {
    if (fornecedor.origem !== 'auto') return
    setLoading(true)
    fornecedoresApi.roi(fornecedor.id)
      .then((res: { data: FornecedorROI }) => setRoi(res.data))
      .catch(() => setRoi(null))
      .finally(() => setLoading(false))
  }, [fornecedor.id, fornecedor.origem])

  const roasColor = roi
    ? roi.roas >= 2 ? '#0F7B6C' : roi.roas >= 1 ? '#D9730D' : '#E03E3E'
    : '#37352F'

  return (
    <AnimatePresence>
      <motion.div
        key="overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.18 }}
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.25)',
          zIndex: 100,
        }}
      />
      <motion.div
        key="drawer"
        initial={{ x: 420, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: 420, opacity: 0 }}
        transition={{ duration: 0.28, ease: [0.4, 0, 0.2, 1] }}
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          height: '100vh',
          width: 420,
          background: '#FFFFFF',
          boxShadow: '-8px 0 32px rgba(0,0,0,0.10)',
          zIndex: 101,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '24px 24px 20px',
            borderBottom: '1px solid rgba(66,87,138,0.10)',
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: 12,
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span
                style={{
                  fontFamily: 'var(--font-sans)',
                  fontWeight: 600,
                  fontSize: 18,
                  color: '#37352F',
                }}
              >
                {fornecedor.name}
              </span>
              <OrigemTag origem={fornecedor.origem} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 11,
                  color: '#9B9793',
                  textTransform: 'uppercase',
                }}
              >
                {CATEGORY_LABELS[fornecedor.category] ?? fornecedor.category}
              </span>
              <StatusBadge status={fornecedor.status} />
            </div>
          </div>
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: '#9B9793',
              fontSize: 20,
              lineHeight: 1,
              padding: 4,
            }}
          >
            ×
          </motion.button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Cost */}
          <div
            style={{
              background: '#F7F7FA',
              borderRadius: 10,
              padding: '16px 20px',
              display: 'flex',
              flexDirection: 'column',
              gap: 4,
            }}
          >
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: '#9B9793', textTransform: 'uppercase' }}>
              Custo mensal
            </span>
            <span style={{ fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: 28, color: '#37352F' }}>
              {fmt(fornecedor.monthly_cost)}
            </span>
          </div>

          {/* ROI section for auto suppliers */}
          {fornecedor.origem === 'auto' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <span
                style={{
                  fontFamily: 'var(--font-sans)',
                  fontWeight: 600,
                  fontSize: 13,
                  color: '#37352F',
                }}
              >
                Análise de ROI
              </span>
              {loading ? (
                <div style={{ color: '#9B9793', fontSize: 13, fontFamily: 'var(--font-sans)' }}>
                  Carregando dados...
                </div>
              ) : roi ? (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  {[
                    { label: 'ROAS', value: `${roi.roas.toFixed(2)}x`, color: roasColor },
                    { label: 'LTV / CAC', value: `${roi.ltv_cac.toFixed(2)}x`, color: roi.ltv_cac >= 3 ? '#0F7B6C' : roi.ltv_cac >= 1 ? '#D9730D' : '#E03E3E' },
                    { label: 'Receita total', value: fmtCompact(roi.revenue_total) },
                    { label: 'Investimento total', value: fmtCompact(roi.spend_total) },
                    { label: 'LTV médio', value: fmtCompact(roi.ltv_medio) },
                    { label: 'CAC', value: fmtCompact(roi.cac) },
                    { label: 'Clientes adquiridos', value: roi.clientes.toLocaleString('pt-BR') },
                  ].map(({ label, value, color }) => (
                    <div
                      key={label}
                      style={{
                        background: '#FFFFFF',
                        border: '1px solid rgba(66,87,138,0.10)',
                        borderRadius: 8,
                        padding: '12px 14px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 4,
                      }}
                    >
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: '#9B9793', textTransform: 'uppercase' }}>
                        {label}
                      </span>
                      <span style={{ fontFamily: 'var(--font-sans)', fontWeight: 600, fontSize: 16, color: color ?? '#37352F' }}>
                        {value}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div
                  style={{
                    background: '#FBF3DB',
                    borderRadius: 8,
                    padding: '12px 16px',
                    fontSize: 13,
                    fontFamily: 'var(--font-sans)',
                    color: '#D9730D',
                  }}
                >
                  Dados de ROI indisponíveis para este fornecedor.
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer — only manual suppliers can be deleted */}
        {fornecedor.origem === 'manual' && (
          <div
            style={{
              padding: '16px 24px',
              borderTop: '1px solid rgba(66,87,138,0.10)',
            }}
          >
            <AnimatePresence mode="wait">
              {confirmDelete ? (
                <motion.div
                  key="confirm"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  style={{ display: 'flex', alignItems: 'center', gap: 10 }}
                >
                  <span style={{ fontFamily: 'var(--font-sans)', fontSize: 13, color: '#E03E3E', flex: 1 }}>
                    Confirmar exclusão?
                  </span>
                  <motion.button
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => onDelete?.(fornecedor.id)}
                    style={{
                      padding: '8px 16px',
                      borderRadius: 8,
                      background: '#E03E3E',
                      color: '#FFFFFF',
                      border: 'none',
                      cursor: 'pointer',
                      fontFamily: 'var(--font-sans)',
                      fontSize: 13,
                      fontWeight: 500,
                    }}
                  >
                    Excluir
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => setConfirmDelete(false)}
                    style={{
                      padding: '8px 16px',
                      borderRadius: 8,
                      background: 'rgba(66,87,138,0.08)',
                      color: '#37352F',
                      border: 'none',
                      cursor: 'pointer',
                      fontFamily: 'var(--font-sans)',
                      fontSize: 13,
                    }}
                  >
                    Cancelar
                  </motion.button>
                </motion.div>
              ) : (
                <motion.button
                  key="delete-btn"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setConfirmDelete(true)}
                  style={{
                    width: '100%',
                    padding: '10px',
                    borderRadius: 8,
                    background: 'none',
                    border: '1px solid rgba(224,62,62,0.3)',
                    color: '#E03E3E',
                    cursor: 'pointer',
                    fontFamily: 'var(--font-sans)',
                    fontSize: 13,
                    fontWeight: 500,
                  }}
                >
                  Excluir fornecedor
                </motion.button>
              )}
            </AnimatePresence>
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  )
}

// ── Add Form ──────────────────────────────────────────────────────────────────

function AdicionarFornecedor({
  onCancel,
  onSaved,
}: {
  onCancel: () => void
  onSaved: () => void
}) {
  const [form, setForm] = useState<NovoFornecedor>({
    name: '',
    supplier_name: '',
    category: '',
    monthly_cost_brl: '',
    notes: '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleChange = (field: keyof NovoFornecedor, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }))
    setError(null)
  }

  const handleSubmit = async () => {
    if (!form.name.trim()) { setError('Nome é obrigatório.'); return }
    if (!form.category) { setError('Selecione uma categoria.'); return }
    const cost = parseFloat(form.monthly_cost_brl.replace(',', '.'))
    if (isNaN(cost) || cost < 0) { setError('Custo mensal inválido.'); return }

    setSaving(true)
    try {
      await fornecedoresApi.create({
        name: form.name.trim(),
        supplier_name: form.supplier_name.trim() || undefined,
        category: form.category,
        monthly_cost_brl: cost,
        notes: form.notes.trim() || undefined,
      })
      onSaved()
    } catch {
      setError('Erro ao salvar. Tente novamente.')
    } finally {
      setSaving(false)
    }
  }

  const inputStyle = {
    width: '100%',
    padding: '10px 12px',
    borderRadius: 8,
    border: '1px solid rgba(66,87,138,0.18)',
    background: '#F7F7FA',
    fontFamily: 'var(--font-sans)',
    fontSize: 14,
    color: '#37352F',
    outline: 'none',
    boxSizing: 'border-box' as const,
  }

  const labelStyle = {
    fontFamily: 'var(--font-sans)',
    fontSize: 12,
    fontWeight: 500,
    color: '#9B9793',
    display: 'block',
    marginBottom: 6,
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.22, ease: [0.25, 0.1, 0.25, 1] }}
      style={{
        background: '#FFFFFF',
        border: '1px solid rgba(66,87,138,0.12)',
        borderRadius: 10,
        padding: '24px',
        marginBottom: 16,
      }}
    >
      <div
        style={{
          fontFamily: 'var(--font-sans)',
          fontWeight: 600,
          fontSize: 15,
          color: '#37352F',
          marginBottom: 20,
        }}
      >
        Novo fornecedor
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        <div>
          <label style={labelStyle}>Nome *</label>
          <input
            style={inputStyle}
            placeholder="Ex: Notion, Freelancer design"
            value={form.name}
            onChange={e => handleChange('name', e.target.value)}
          />
        </div>
        <div>
          <label style={labelStyle}>Razão social / fornecedor</label>
          <input
            style={inputStyle}
            placeholder="Opcional"
            value={form.supplier_name}
            onChange={e => handleChange('supplier_name', e.target.value)}
          />
        </div>
        <div>
          <label style={labelStyle}>Categoria *</label>
          <select
            style={{ ...inputStyle, cursor: 'pointer' }}
            value={form.category}
            onChange={e => handleChange('category', e.target.value)}
          >
            <option value="">Selecionar...</option>
            {CATEGORY_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label style={labelStyle}>Custo mensal (R$) *</label>
          <input
            style={inputStyle}
            placeholder="0,00"
            value={form.monthly_cost_brl}
            onChange={e => handleChange('monthly_cost_brl', e.target.value)}
            inputMode="decimal"
          />
        </div>
      </div>

      <div style={{ marginBottom: 20 }}>
        <label style={labelStyle}>Notas</label>
        <textarea
          style={{ ...inputStyle, resize: 'vertical', minHeight: 72 }}
          placeholder="Observações, contato, data de renovação..."
          value={form.notes}
          onChange={e => handleChange('notes', e.target.value)}
        />
      </div>

      {error && (
        <div
          style={{
            marginBottom: 16,
            padding: '10px 14px',
            borderRadius: 8,
            background: '#FBE4E4',
            color: '#E03E3E',
            fontFamily: 'var(--font-sans)',
            fontSize: 13,
          }}
        >
          {error}
        </div>
      )}

      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={onCancel}
          style={{
            padding: '10px 20px',
            borderRadius: 8,
            background: 'none',
            border: '1px solid rgba(66,87,138,0.18)',
            color: '#787774',
            cursor: 'pointer',
            fontFamily: 'var(--font-sans)',
            fontSize: 14,
          }}
        >
          Cancelar
        </motion.button>
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={handleSubmit}
          disabled={saving}
          style={{
            padding: '10px 24px',
            borderRadius: 8,
            background: saving ? '#FFB38A' : '#FF5900',
            color: '#FFFFFF',
            border: 'none',
            cursor: saving ? 'not-allowed' : 'pointer',
            fontFamily: 'var(--font-sans)',
            fontSize: 14,
            fontWeight: 600,
          }}
        >
          {saving ? 'Salvando...' : 'Salvar fornecedor'}
        </motion.button>
      </div>
    </motion.div>
  )
}

// ── Empty State ───────────────────────────────────────────────────────────────

function EmptyManual({ onAdd }: { onAdd: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
      style={{
        background: '#FFFFFF',
        border: '1px dashed rgba(66,87,138,0.2)',
        borderRadius: 10,
        padding: '40px 24px',
        textAlign: 'center',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 12,
      }}
    >
      <div
        style={{
          width: 48,
          height: 48,
          borderRadius: 12,
          background: '#FFF0E8',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 22,
        }}
      >
        +
      </div>
      <p
        style={{
          fontFamily: 'var(--font-sans)',
          fontSize: 14,
          color: '#9B9793',
          maxWidth: 420,
          lineHeight: 1.6,
          margin: 0,
        }}
      >
        Seus gastos com Meta Ads e Google Ads já aparecem aqui automaticamente. Adicione ferramentas, agências e freelancers para ver o quadro completo.
      </p>
      <motion.button
        whileHover={{ scale: 1.03 }}
        whileTap={{ scale: 0.97 }}
        onClick={onAdd}
        style={{
          marginTop: 4,
          padding: '10px 22px',
          borderRadius: 8,
          background: '#FF5900',
          color: '#FFFFFF',
          border: 'none',
          cursor: 'pointer',
          fontFamily: 'var(--font-sans)',
          fontSize: 14,
          fontWeight: 600,
        }}
      >
        + Adicionar fornecedor
      </motion.button>
    </motion.div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function Fornecedores({ onToggleChat }: PageProps) {
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Fornecedor | null>(null)
  const [showAdd, setShowAdd] = useState(false)

  const load = useCallback(async () => {
    try {
      const res = await fornecedoresApi.list()
      setFornecedores(res.data ?? [])
    } catch {
      setFornecedores([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const handleDelete = async (id: string) => {
    try {
      await fornecedoresApi.remove(id)
      setSelected(null)
      load()
    } catch {
      // silent — backend will reject if not manual
    }
  }

  const handleSaved = () => {
    setShowAdd(false)
    load()
  }

  // ── Derived KPIs ───────────────────────────────────────────────────
  const totalMensal = fornecedores.reduce((s, f) => s + (f.monthly_cost ?? 0), 0)
  const emAtencao = fornecedores.filter(f => f.status === 'atencao' || f.status === 'critico').length
  const maiorCusto = fornecedores.length
    ? fornecedores.reduce((a, b) => (a.monthly_cost > b.monthly_cost ? a : b))
    : null

  const temManual = fornecedores.some(f => f.origem === 'manual')

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#F7F7FA',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <TopBar onToggleChat={onToggleChat} />

      <div
        style={{
          flex: 1,
          padding: '32px 40px 48px',
          maxWidth: 1100,
          width: '100%',
          margin: '0 auto',
          boxSizing: 'border-box',
        }}
      >
        {/* Page header */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
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
                fontWeight: 600,
                fontSize: 24,
                color: '#37352F',
                margin: 0,
                lineHeight: 1.2,
              }}
            >
              Fornecedores
            </h1>
            <p
              style={{
                fontFamily: 'var(--font-sans)',
                fontSize: 14,
                color: '#9B9793',
                margin: '4px 0 0',
              }}
            >
              Todos os custos operacionais em um lugar — ads, SaaS, agências, freelancers.
            </p>
          </div>
          {!showAdd && (
            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => setShowAdd(true)}
              style={{
                padding: '10px 20px',
                borderRadius: 8,
                background: '#FF5900',
                color: '#FFFFFF',
                border: 'none',
                cursor: 'pointer',
                fontFamily: 'var(--font-sans)',
                fontSize: 14,
                fontWeight: 600,
                flexShrink: 0,
              }}
            >
              + Adicionar fornecedor
            </motion.button>
          )}
        </motion.div>

        {/* KPI cards */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: 16,
            marginBottom: 28,
          }}
        >
          <KpiCard
            index={0}
            label="Total / mês"
            value={loading ? '...' : fmtCompact(totalMensal)}
            sub={`${fornecedores.length} fornecedor${fornecedores.length !== 1 ? 'es' : ''}`}
          />
          <KpiCard
            index={1}
            label="% do faturamento"
            value="—"
            sub="Conecte integrações de receita"
          />
          <KpiCard
            index={2}
            label="Em atenção / crítico"
            value={loading ? '...' : String(emAtencao)}
            sub={emAtencao === 0 ? 'Todos saudáveis' : 'Requer análise'}
          />
          <KpiCard
            index={3}
            label="Maior custo"
            value={loading || !maiorCusto ? (loading ? '...' : '—') : fmtCompact(maiorCusto.monthly_cost)}
            sub={maiorCusto?.name ?? undefined}
          />
        </div>

        {/* Add form */}
        <AnimatePresence>
          {showAdd && (
            <AdicionarFornecedor
              key="add-form"
              onCancel={() => setShowAdd(false)}
              onSaved={handleSaved}
            />
          )}
        </AnimatePresence>

        {/* Suppliers table or empty state */}
        {loading ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            style={{
              background: '#FFFFFF',
              border: '1px solid rgba(66,87,138,0.12)',
              borderRadius: 10,
              padding: '40px 24px',
              textAlign: 'center',
              fontFamily: 'var(--font-sans)',
              fontSize: 14,
              color: '#9B9793',
            }}
          >
            Carregando fornecedores...
          </motion.div>
        ) : fornecedores.length === 0 ? (
          <EmptyManual onAdd={() => setShowAdd(true)} />
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.15, ease: [0.25, 0.1, 0.25, 1] }}
            style={{
              background: '#FFFFFF',
              border: '1px solid rgba(66,87,138,0.12)',
              borderRadius: 10,
              overflow: 'hidden',
            }}
          >
            {/* Table header */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 80px',
                padding: '12px 20px',
                borderBottom: '1px solid rgba(66,87,138,0.08)',
                gap: 12,
              }}
            >
              {['Nome', 'Categoria', 'Custo / mês', 'Origem', 'Status', 'Tendência'].map(col => (
                <span
                  key={col}
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 10,
                    fontWeight: 500,
                    color: '#B8B5AF',
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                  }}
                >
                  {col}
                </span>
              ))}
            </div>

            {/* Rows */}
            {fornecedores.map((f, i) => (
              <motion.div
                key={f.id}
                custom={i}
                variants={FADE_UP}
                initial="hidden"
                animate="visible"
                whileHover={{ background: '#FAFAF8' }}
                onClick={() => setSelected(f)}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 80px',
                  padding: '14px 20px',
                  borderBottom: i < fornecedores.length - 1 ? '1px solid rgba(66,87,138,0.06)' : 'none',
                  gap: 12,
                  cursor: 'pointer',
                  alignItems: 'center',
                  transition: 'background 0.12s',
                }}
              >
                {/* Nome */}
                <span
                  style={{
                    fontFamily: 'var(--font-sans)',
                    fontSize: 14,
                    fontWeight: 500,
                    color: '#37352F',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {f.name}
                </span>
                {/* Categoria */}
                <span
                  style={{
                    fontFamily: 'var(--font-sans)',
                    fontSize: 13,
                    color: '#787774',
                  }}
                >
                  {CATEGORY_LABELS[f.category] ?? f.category}
                </span>
                {/* Custo */}
                <span
                  style={{
                    fontFamily: 'var(--font-sans)',
                    fontSize: 14,
                    fontWeight: 600,
                    color: '#37352F',
                  }}
                >
                  {fmt(f.monthly_cost)}
                </span>
                {/* Origem */}
                <div><OrigemTag origem={f.origem} /></div>
                {/* Status */}
                <div><StatusBadge status={f.status} /></div>
                {/* Tendência */}
                <div style={{ textAlign: 'center' }}>
                  <TendenciaArrow tendencia={f.tendencia} />
                </div>
              </motion.div>
            ))}

            {/* Footer totals */}
            {!temManual && fornecedores.length > 0 && (
              <div
                style={{
                  padding: '12px 20px',
                  borderTop: '1px solid rgba(66,87,138,0.08)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <span
                  style={{
                    fontFamily: 'var(--font-sans)',
                    fontSize: 12,
                    color: '#9B9793',
                    flex: 1,
                  }}
                >
                  Adicione ferramentas, agências e freelancers para ver o custo operacional completo.
                </span>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setShowAdd(true)}
                  style={{
                    padding: '7px 16px',
                    borderRadius: 7,
                    background: 'rgba(255,89,0,0.08)',
                    color: '#FF5900',
                    border: '1px solid rgba(255,89,0,0.2)',
                    cursor: 'pointer',
                    fontFamily: 'var(--font-sans)',
                    fontSize: 13,
                    fontWeight: 500,
                  }}
                >
                  + Adicionar
                </motion.button>
              </div>
            )}
          </motion.div>
        )}
      </div>

      {/* Detail drawer */}
      <AnimatePresence>
        {selected && (
          <FornecedorDetalhe
            key={selected.id}
            fornecedor={selected}
            onClose={() => setSelected(null)}
            onDelete={handleDelete}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
