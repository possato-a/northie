import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { KpiCard } from '../components/ui/KpiCard'
import TopBar from '../components/layout/TopBar'
import { PageHeader, Divider } from '../components/ui/shared'
import { calendarApi } from '../lib/api'

// ── Types ────────────────────────────────────────────────────────────────────

interface Lead {
  id: string
  name: string
  email: string
  phone: string | null
  company: string | null
  source: string | null
  status: LeadStatus
  value_estimate: number | null
  notes: string | null
  meta: Record<string, unknown> | null
  created_at: string
  updated_at: string
}

interface Meeting {
  id: string
  lead_id: string | null
  title: string
  scheduled_at: string
  duration_minutes: number | null
  status: MeetingStatus
  notes: string | null
  transcript_summary: string | null
  created_at: string
  updated_at: string
}

type LeadStatus = 'lead' | 'reuniao_agendada' | 'reuniao_realizada' | 'fechado' | 'perdido'
type MeetingStatus = 'agendada' | 'realizada' | 'cancelada' | 'no_show'

// ── Mock Data (fallback) ─────────────────────────────────────────────────────

const MOCK_LEADS: Lead[] = [
  { id: '1', name: 'Ana Beatriz Costa',   email: 'ana@studioab.com',   phone: null, company: 'Studio AB',        source: 'Formulário',  status: 'fechado',            value_estimate: 4800, notes: null, meta: null, created_at: '2026-03-10T10:00:00Z', updated_at: '2026-03-10T10:00:00Z' },
  { id: '2', name: 'Rafael Mendes',       email: 'rafael@mendes.com',  phone: null, company: 'Agência Mendes',   source: 'Indicação',   status: 'reuniao_realizada',  value_estimate: 7200, notes: null, meta: null, created_at: '2026-03-08T10:00:00Z', updated_at: '2026-03-08T10:00:00Z' },
  { id: '3', name: 'Camila Torres',       email: 'camila@ct.com',      phone: null, company: 'CT Educação',      source: 'Formulário',  status: 'reuniao_agendada',   value_estimate: 3600, notes: null, meta: null, created_at: '2026-03-07T10:00:00Z', updated_at: '2026-03-07T10:00:00Z' },
  { id: '4', name: 'Bruno Figueiredo',    email: 'bruno@bf.com',       phone: null, company: 'BF Soluções',      source: 'LinkedIn',    status: 'lead',               value_estimate: 9600, notes: null, meta: null, created_at: '2026-03-06T10:00:00Z', updated_at: '2026-03-06T10:00:00Z' },
  { id: '5', name: 'Mariana Souza',       email: 'mariana@ms.com',     phone: null, company: 'MS Digital',       source: 'Formulário',  status: 'fechado',            value_estimate: 2400, notes: null, meta: null, created_at: '2026-03-04T10:00:00Z', updated_at: '2026-03-04T10:00:00Z' },
  { id: '6', name: 'Pedro Almeida',       email: 'pedro@pa.com',       phone: null, company: 'PA Consultoria',   source: 'Indicação',   status: 'perdido',            value_estimate: 6000, notes: null, meta: null, created_at: '2026-03-02T10:00:00Z', updated_at: '2026-03-02T10:00:00Z' },
  { id: '7', name: 'Fernanda Lima',       email: 'fernanda@fl.com',    phone: null, company: 'FL Marketing',     source: 'Formulário',  status: 'reuniao_realizada',  value_estimate: 5400, notes: null, meta: null, created_at: '2026-03-01T10:00:00Z', updated_at: '2026-03-01T10:00:00Z' },
  { id: '8', name: 'Lucas Pereira',       email: 'lucas@lp.com',       phone: null, company: 'LP Tech',          source: 'LinkedIn',    status: 'lead',               value_estimate: 12000, notes: null, meta: null, created_at: '2026-02-28T10:00:00Z', updated_at: '2026-02-28T10:00:00Z' },
]

const MOCK_MEETINGS: Meeting[] = [
  { id: '1', lead_id: '1', title: 'Demo Northie — Ana Beatriz',   scheduled_at: '2026-03-09T14:00:00Z', duration_minutes: 42, status: 'realizada',  notes: null, transcript_summary: 'Cliente demonstrou forte interesse na automação de reativação. Principal objeção: preço inicial. Resolvida após apresentar ROI histórico de clientes similares.', created_at: '2026-03-09T14:00:00Z', updated_at: '2026-03-09T14:00:00Z' },
  { id: '2', lead_id: '2', title: 'Reunião técnica — Rafael',     scheduled_at: '2026-03-07T10:00:00Z', duration_minutes: 58, status: 'realizada',  notes: null, transcript_summary: 'Reunião técnica aprofundada sobre integrações com Meta Ads. Cliente solicitou proposta customizada para agência com múltiplos clientes.', created_at: '2026-03-07T10:00:00Z', updated_at: '2026-03-07T10:00:00Z' },
  { id: '3', lead_id: '5', title: 'Demo Northie — Mariana',       scheduled_at: '2026-03-03T15:00:00Z', duration_minutes: 35, status: 'realizada',  notes: null, transcript_summary: 'Ciclo curto — cliente já conhecia a Northie por indicação. Decisão tomada na própria reunião. Onboarding agendado para semana seguinte.', created_at: '2026-03-03T15:00:00Z', updated_at: '2026-03-03T15:00:00Z' },
  { id: '4', lead_id: '6', title: 'Demo Northie — Pedro',         scheduled_at: '2026-02-28T16:00:00Z', duration_minutes: 48, status: 'realizada',  notes: null, transcript_summary: 'Cliente escolheu concorrente com integração nativa ao CRM legado. Abertura para revisitar em 6 meses quando renovar contrato.', created_at: '2026-02-28T16:00:00Z', updated_at: '2026-02-28T16:00:00Z' },
  { id: '5', lead_id: '7', title: 'Growth Engine demo — Fernanda', scheduled_at: '2026-03-01T14:00:00Z', duration_minutes: 51, status: 'realizada', notes: null, transcript_summary: 'Apresentação do Growth Engine. Cliente ficou muito animado com a correlação LTV × canal. Solicitou apresentação para sócio na próxima semana.', created_at: '2026-03-01T14:00:00Z', updated_at: '2026-03-01T14:00:00Z' },
]


// ── Display helpers ──────────────────────────────────────────────────────────

const fmtBRL = (n: number) => `R$ ${new Intl.NumberFormat('pt-BR').format(n)}`

const STATUS_LABEL: Record<LeadStatus, string> = {
  lead: 'Lead Capturado',
  reuniao_agendada: 'Reunião Agendada',
  reuniao_realizada: 'Reunião Realizada',
  fechado: 'Fechado',
  perdido: 'Perdido',
}

const STATUS_ORDER: LeadStatus[] = ['lead', 'reuniao_agendada', 'reuniao_realizada', 'fechado', 'perdido']

const STAGE_COLOR: Record<string, string> = {
  'Lead Capturado':    'var(--color-text-tertiary)',
  'Reunião Agendada':  'var(--accent-blue)',
  'Reunião Realizada': 'var(--accent-orange)',
  'Fechado':           'var(--status-complete)',
  'Perdido':           'var(--accent-red)',
}

const STAGE_BG: Record<string, string> = {
  'Lead Capturado':    'var(--color-bg-tertiary)',
  'Reunião Agendada':  'rgba(35,131,226,0.1)',
  'Reunião Realizada': 'rgba(217,115,13,0.1)',
  'Fechado':           'var(--status-complete-bg)',
  'Perdido':           'var(--priority-high-bg)',
}

const MEETING_STATUS_LABEL: Record<MeetingStatus, string> = {
  agendada: 'Agendada',
  realizada: 'Realizada',
  cancelada: 'Cancelada',
  no_show: 'No-show',
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

function daysBetween(from: string, to: string): number {
  return Math.round((new Date(to).getTime() - new Date(from).getTime()) / (1000 * 60 * 60 * 24))
}

// ── Shared UI ────────────────────────────────────────────────────────────────

function SectionCard({ children, style }: { children?: React.ReactNode; style?: React.CSSProperties }) {
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

const inputStyle: React.CSSProperties = {
  fontFamily: 'var(--font-sans)',
  fontSize: 'var(--text-sm)',
  color: 'var(--color-text-primary)',
  background: 'var(--color-bg-secondary)',
  border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius-md)',
  padding: '8px 12px',
  width: '100%',
  outline: 'none',
  transition: 'border-color 0.15s ease',
}

const labelStyle: React.CSSProperties = {
  fontFamily: 'var(--font-sans)',
  fontSize: 'var(--text-xs)',
  fontWeight: 500,
  color: 'var(--color-text-tertiary)',
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
  marginBottom: 4,
  display: 'block',
}

const btnPrimary: React.CSSProperties = {
  fontFamily: 'var(--font-sans)',
  fontSize: 'var(--text-sm)',
  fontWeight: 500,
  color: '#fff',
  background: 'var(--color-primary)',
  border: 'none',
  borderRadius: 'var(--radius-md)',
  padding: '8px 20px',
  cursor: 'pointer',
  transition: 'opacity 0.15s ease',
}

const btnSecondary: React.CSSProperties = {
  fontFamily: 'var(--font-sans)',
  fontSize: 'var(--text-sm)',
  fontWeight: 500,
  color: 'var(--color-text-secondary)',
  background: 'var(--color-bg-secondary)',
  border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius-md)',
  padding: '8px 20px',
  cursor: 'pointer',
  transition: 'opacity 0.15s ease',
}

// ── Modal Overlay ────────────────────────────────────────────────────────────

function ModalOverlay({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 999,
        background: 'rgba(0,0,0,0.4)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 8 }}
        transition={{ duration: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--color-bg-primary)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: 'var(--shadow-md)',
          padding: '24px 28px',
          width: 440,
          maxWidth: '90vw',
          maxHeight: '85vh',
          overflowY: 'auto',
        }}
      >
        {children}
      </motion.div>
    </motion.div>
  )
}

// ── New Lead Modal ───────────────────────────────────────────────────────────

function NewLeadModal({ onClose, onCreated }: { onClose: () => void; onCreated: (lead: Lead) => void }) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [company, setCompany] = useState('')
  const [value, setValue] = useState('')
  const [source, setSource] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async () => {
    if (!name.trim() || !email.trim()) {
      setError('Nome e email são obrigatórios.')
      return
    }
    setSaving(true)
    setError('')
    try {
      const res = await pipelineApi.createLead({
        name: name.trim(),
        email: email.trim(),
        company: company.trim() || null,
        value_estimate: value ? parseFloat(value.replace(',', '.')) : null,
        source: source.trim() || null,
      })
      onCreated(res.data)
      onClose()
    } catch {
      setError('Erro ao criar lead. Tente novamente.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <ModalOverlay onClose={onClose}>
      <h3 style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-lg)', fontWeight: 600, color: 'var(--color-text-primary)', margin: '0 0 20px' }}>Novo Lead</h3>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div>
          <label style={labelStyle}>Nome *</label>
          <input style={inputStyle} value={name} onChange={e => setName(e.target.value)} placeholder="Nome do lead" />
        </div>
        <div>
          <label style={labelStyle}>Email *</label>
          <input style={inputStyle} type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="email@empresa.com" />
        </div>
        <div>
          <label style={labelStyle}>Empresa</label>
          <input style={inputStyle} value={company} onChange={e => setCompany(e.target.value)} placeholder="Nome da empresa" />
        </div>
        <div>
          <label style={labelStyle}>Valor estimado (R$)</label>
          <input style={inputStyle} value={value} onChange={e => setValue(e.target.value)} placeholder="0,00" />
        </div>
        <div>
          <label style={labelStyle}>Fonte</label>
          <input style={inputStyle} value={source} onChange={e => setSource(e.target.value)} placeholder="Formulário, LinkedIn, Indicação..." />
        </div>
      </div>

      {error && (
        <p style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-xs)', color: 'var(--accent-red)', marginTop: 12, marginBottom: 0 }}>{error}</p>
      )}

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
        <button style={btnSecondary} onClick={onClose}>Cancelar</button>
        <motion.button
          whileTap={{ scale: 0.97 }}
          style={{ ...btnPrimary, opacity: saving ? 0.6 : 1 }}
          onClick={handleSubmit}
          disabled={saving}
        >
          {saving ? 'Salvando...' : 'Criar Lead'}
        </motion.button>
      </div>
    </ModalOverlay>
  )
}

// ── New Meeting Modal ────────────────────────────────────────────────────────

function NewMeetingModal({ leads, onClose, onCreated }: {
  leads: Lead[]
  onClose: () => void
  onCreated: (meeting: Meeting) => void
}) {
  const [title, setTitle] = useState('')
  const [scheduledAt, setScheduledAt] = useState('')
  const [leadId, setLeadId] = useState('')
  const [durationMinutes, setDurationMinutes] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async () => {
    if (!title.trim() || !scheduledAt) {
      setError('Título e data são obrigatórios.')
      return
    }
    setSaving(true)
    setError('')
    try {
      const res = await pipelineApi.createMeeting({
        title: title.trim(),
        scheduled_at: new Date(scheduledAt).toISOString(),
        lead_id: leadId || null,
        duration_minutes: durationMinutes ? parseInt(durationMinutes, 10) : null,
      })
      onCreated(res.data)
      onClose()
    } catch {
      setError('Erro ao criar reunião. Tente novamente.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <ModalOverlay onClose={onClose}>
      <h3 style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-lg)', fontWeight: 600, color: 'var(--color-text-primary)', margin: '0 0 20px' }}>Nova Reunião</h3>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div>
          <label style={labelStyle}>Título *</label>
          <input style={inputStyle} value={title} onChange={e => setTitle(e.target.value)} placeholder="Ex: Demo Northie — Cliente" />
        </div>
        <div>
          <label style={labelStyle}>Data e hora *</label>
          <input style={{ ...inputStyle, colorScheme: 'light' }} type="datetime-local" value={scheduledAt} onChange={e => setScheduledAt(e.target.value)} />
        </div>
        <div>
          <label style={labelStyle}>Lead (opcional)</label>
          <select
            style={{ ...inputStyle, cursor: 'pointer' }}
            value={leadId}
            onChange={e => setLeadId(e.target.value)}
          >
            <option value="">Nenhum lead associado</option>
            {leads.map(l => (
              <option key={l.id} value={l.id}>{l.name}{l.company ? ` — ${l.company}` : ''}</option>
            ))}
          </select>
        </div>
        <div>
          <label style={labelStyle}>Duração (min)</label>
          <input style={inputStyle} type="number" value={durationMinutes} onChange={e => setDurationMinutes(e.target.value)} placeholder="45" />
        </div>
      </div>

      {error && (
        <p style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-xs)', color: 'var(--accent-red)', marginTop: 12, marginBottom: 0 }}>{error}</p>
      )}

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
        <button style={btnSecondary} onClick={onClose}>Cancelar</button>
        <motion.button
          whileTap={{ scale: 0.97 }}
          style={{ ...btnPrimary, opacity: saving ? 0.6 : 1 }}
          onClick={handleSubmit}
          disabled={saving}
        >
          {saving ? 'Salvando...' : 'Criar Reunião'}
        </motion.button>
      </div>
    </ModalOverlay>
  )
}

// ── Status Dropdown ──────────────────────────────────────────────────────────

function StatusDropdown({ currentStatus, onSelect, onClose }: {
  currentStatus: LeadStatus
  onSelect: (status: LeadStatus) => void
  onClose: () => void
}) {
  return (
    <>
      <div style={{ position: 'fixed', inset: 0, zIndex: 998 }} onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, y: -4 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -4 }}
        transition={{ duration: 0.12 }}
        style={{
          position: 'absolute', top: '100%', left: 0, zIndex: 999,
          marginTop: 4,
          background: 'var(--color-bg-primary)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-md)',
          boxShadow: 'var(--shadow-md)',
          padding: 4,
          minWidth: 170,
        }}
      >
        {STATUS_ORDER.map(status => {
          const label = STATUS_LABEL[status]
          const isActive = status === currentStatus
          return (
            <motion.button
              key={status}
              whileHover={{ background: 'var(--color-bg-secondary)' }}
              onClick={() => { onSelect(status); onClose() }}
              style={{
                display: 'flex', alignItems: 'center', gap: 8, width: '100%',
                fontFamily: 'var(--font-sans)', fontSize: 'var(--text-xs)', fontWeight: isActive ? 500 : 400,
                color: isActive ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
                background: 'transparent',
                border: 'none', borderRadius: 'var(--radius-sm)',
                padding: '6px 10px', cursor: 'pointer', textAlign: 'left',
              }}
            >
              <span style={{
                width: 8, height: 8, borderRadius: '50%',
                background: STAGE_COLOR[label] || 'var(--color-text-tertiary)',
                flexShrink: 0,
              }} />
              {label}
            </motion.button>
          )
        })}
      </motion.div>
    </>
  )
}

// ── Pipeline Stage ───────────────────────────────────────────────────────────

function PipelineStage({ label, count, delay, isLast = false }: {
  label: string; count: number; delay: number; isLast?: boolean
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay, ease: [0.25, 0.1, 0.25, 1] }}
      style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: '28px 20px', position: 'relative' }}
    >
      {!isLast && (
        <div style={{ position: 'absolute', right: 0, top: '50%', transform: 'translateY(-50%)', width: 1, height: 40, background: 'var(--color-border)' }} />
      )}
      <span style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-3xl)', fontWeight: 500, color: count > 0 ? 'var(--color-primary)' : 'var(--color-text-primary)', letterSpacing: '-0.5px', lineHeight: 1 }}>
        {count}
      </span>
      <span style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)', textAlign: 'center', lineHeight: 1.4 }}>
        {label}
      </span>
    </motion.div>
  )
}

// ── Pipeline View ────────────────────────────────────────────────────────────

function PipelineView({ leads, onLeadStatusChange, onNewLead }: {
  leads: Lead[]
  onLeadStatusChange: (id: string, status: LeadStatus) => void
  onNewLead: () => void
}) {
  const [dropdownLeadId, setDropdownLeadId] = useState<string | null>(null)

  const stages = [
    { label: 'Lead Capturado',    count: leads.filter(l => l.status === 'lead').length },
    { label: 'Reunião Agendada',  count: leads.filter(l => l.status === 'reuniao_agendada').length },
    { label: 'Reunião Realizada', count: leads.filter(l => l.status === 'reuniao_realizada').length },
    { label: 'Fechado / Perdido', count: leads.filter(l => l.status === 'fechado' || l.status === 'perdido').length },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Funil */}
      <SectionCard>
        <div style={{ display: 'flex', alignItems: 'stretch' }}>
          {stages.map((stage, i) => (
            <PipelineStage key={stage.label} label={stage.label} count={stage.count} delay={0.1 + i * 0.07} isLast={i === stages.length - 1} />
          ))}
        </div>
      </SectionCard>

      {/* Tabela de leads */}
      <SectionCard>
        {/* Header */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 140px 170px 90px 100px', gap: '0 16px', padding: '10px 20px', background: 'var(--color-bg-secondary)', borderBottom: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg) var(--radius-lg) 0 0', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-xs)', fontWeight: 500, color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Lead</span>
            <motion.button
              whileHover={{ opacity: 0.85 }}
              whileTap={{ scale: 0.96 }}
              onClick={onNewLead}
              style={{
                fontFamily: 'var(--font-sans)', fontSize: 11, fontWeight: 500,
                color: 'var(--color-primary)', background: 'transparent',
                border: '1px solid var(--color-primary)', borderRadius: 'var(--radius-sm)',
                padding: '3px 10px', cursor: 'pointer', letterSpacing: '-0.1px',
              }}
            >
              + Novo Lead
            </motion.button>
          </div>
          {['Empresa', 'Estágio', 'Valor', 'Ciclo'].map(h => (
            <span key={h} style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-xs)', fontWeight: 500, color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{h}</span>
          ))}
        </div>

        {leads.length === 0 && (
          <div style={{ padding: '32px 20px', textAlign: 'center' }}>
            <p style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', color: 'var(--color-text-tertiary)', margin: 0 }}>Nenhum lead encontrado. Crie o primeiro.</p>
          </div>
        )}

        {leads.map((lead, i) => {
          const stageLabel = STATUS_LABEL[lead.status]
          const cycleDays = daysBetween(lead.created_at, lead.updated_at)

          return (
            <motion.div
              key={lead.id}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, delay: 0.05 + i * 0.04 }}
              style={{
                display: 'grid', gridTemplateColumns: '1fr 140px 170px 90px 100px',
                gap: '0 16px', padding: '12px 20px', alignItems: 'center',
                borderBottom: i < leads.length - 1 ? '1px solid var(--color-border)' : 'none',
              }}
            >
              <div>
                <p style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-base)', fontWeight: 500, margin: 0, color: 'var(--color-text-primary)' }}>{lead.name}</p>
                <p style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)', margin: 0 }}>{lead.source || 'Sem fonte'} · {formatDate(lead.created_at)}</p>
              </div>
              <span style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)' }}>{lead.company || '—'}</span>
              <div style={{ position: 'relative' }}>
                <motion.button
                  whileTap={{ scale: 0.96 }}
                  onClick={() => setDropdownLeadId(dropdownLeadId === lead.id ? null : lead.id)}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    fontFamily: 'var(--font-sans)', fontSize: 'var(--text-xs)', fontWeight: 500,
                    padding: '3px 10px', borderRadius: 'var(--radius-full)',
                    background: STAGE_BG[stageLabel] || 'var(--color-bg-tertiary)',
                    color: STAGE_COLOR[stageLabel] || 'var(--color-text-tertiary)',
                    border: 'none', cursor: 'pointer', width: 'fit-content',
                  }}
                >
                  {stageLabel}
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </motion.button>
                <AnimatePresence>
                  {dropdownLeadId === lead.id && (
                    <StatusDropdown
                      currentStatus={lead.status}
                      onSelect={(status) => onLeadStatusChange(lead.id, status)}
                      onClose={() => setDropdownLeadId(null)}
                    />
                  )}
                </AnimatePresence>
              </div>
              <span style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', fontWeight: 500, color: 'var(--color-text-primary)' }}>
                {lead.value_estimate && lead.value_estimate > 0 ? fmtBRL(lead.value_estimate) : '—'}
              </span>
              <span style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)' }}>
                {cycleDays}d
              </span>
            </motion.div>
          )
        })}
      </SectionCard>
    </div>
  )
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface Meeting {
  id: string
  title: string
  attendees: Array<{ email: string; name?: string; organizer?: boolean }>
  started_at: string
  ended_at: string
  duration_minutes: number
  meet_link: string | null
  ai_summary: string | null
  ai_objections: string[]
  ai_result: 'positive' | 'neutral' | 'negative' | null
  ai_cycle_signal: string | null
  ai_tags: string[]
  linked_customer_id: string | null
}

interface Insight {
  type: string
  title: string
  body: string
  action: string
}

// ── Reuniões View ─────────────────────────────────────────────────────────────

function ReunioesView() {
  const [meetings, setMeetings] = useState<Meeting[]>([])
  const [loading, setLoading] = useState(true)
  const [calendarConnected, setCalendarConnected] = useState(true)
  const [expanded, setExpanded] = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      try {
        const statusRes = await calendarApi.getStatus()
        const status = statusRes.data?.data
        setCalendarConnected(status?.connected ?? false)

        if (status?.connected) {
          const eventsRes = await calendarApi.getEvents(20, 0)
          setMeetings(eventsRes.data?.data || [])
          if (expanded === null && eventsRes.data?.data?.length > 0) {
            setExpanded(eventsRes.data.data[0].id)
          }
        }
      } catch {
        // silencioso — mostra empty state
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
  const resultColor = (r: string | null) => r === 'positive' ? 'var(--status-complete)' : r === 'negative' ? 'var(--accent-red)' : 'var(--accent-orange)'
  const resultLabel = (r: string | null) => r === 'positive' ? 'Positivo' : r === 'negative' ? 'Negativo' : 'Neutro'

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {[1,2,3].map(i => (
          <motion.div key={i} initial={{ opacity: 0 }} animate={{ opacity: [0.4, 0.7, 0.4] }} transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.15 }}>
            <SectionCard style={{ height: 64 }} />
          </motion.div>
        ))}
      </div>
    )
  }

  if (!calendarConnected) {
    return (
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <SectionCard style={{ padding: '48px 32px', textAlign: 'center' }}>
          <div style={{ fontSize: 32, marginBottom: 16 }}>📅</div>
          <h3 style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-lg)', fontWeight: 600, color: 'var(--color-text-primary)', margin: '0 0 8px' }}>Google Calendar não conectado</h3>
          <p style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)', margin: '0 0 24px', maxWidth: 400, marginInline: 'auto', lineHeight: 1.6 }}>
            Conecte seu Google Calendar para visualizar suas reuniões e obter análises de IA sobre objeções e ciclos de venda.
          </p>
          <motion.button
            whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
            onClick={() => window.dispatchEvent(new CustomEvent('northie:navigate', { detail: 'app-store' }))}
            style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', fontWeight: 500, padding: '10px 24px', borderRadius: 'var(--radius-md)', background: 'var(--color-primary)', color: 'white', border: 'none', cursor: 'pointer' }}
          >
            Conectar Google Calendar
          </motion.button>
        </SectionCard>
      </motion.div>
    )
  }

  if (meetings.length === 0) {
    return (
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
        <SectionCard style={{ padding: '48px 32px', textAlign: 'center' }}>
          <p style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)', margin: 0 }}>
            Nenhuma reunião encontrada nos últimos 90 dias.
          </p>
        </SectionCard>
      </motion.div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {meetings.map((r, i) => {
        const attendeeNames = r.attendees?.filter(a => !a.organizer).map(a => a.name || a.email).join(', ')
        return (
          <motion.div
            key={r.id}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: i * 0.05 }}
          >
            <SectionCard>
              <div
                onClick={() => setExpanded(expanded === r.id ? null : r.id)}
                style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '16px 20px', cursor: 'pointer' }}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                    <span style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-base)', fontWeight: 500, color: 'var(--color-text-primary)' }}>{r.title}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {(r.ai_tags || []).map(tag => (
                      <span key={tag} style={{ fontFamily: 'var(--font-sans)', fontSize: 10, fontWeight: 500, padding: '2px 8px', borderRadius: 'var(--radius-full)', background: 'var(--color-bg-tertiary)', color: 'var(--color-text-secondary)' }}>{tag}</span>
                    ))}
                    {attendeeNames && (
                      <span style={{ fontFamily: 'var(--font-sans)', fontSize: 10, color: 'var(--color-text-tertiary)' }}>{attendeeNames}</span>
                    )}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 24, alignItems: 'center', flexShrink: 0 }}>
                  <div style={{ textAlign: 'right' }}>
                    <p style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)', margin: 0 }}>
                      {r.started_at ? fmtDate(r.started_at) : '—'} · {r.duration_minutes ? `${r.duration_minutes}min` : '—'}
                    </p>
                    {r.ai_result && (
                      <p style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', fontWeight: 500, margin: 0, color: resultColor(r.ai_result) }}>
                        {resultLabel(r.ai_result)}
                      </p>
                    )}
                  </div>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--color-text-tertiary)', transform: expanded === r.id ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </div>
              </div>

              <AnimatePresence>
                {expanded === r.id && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.2 }}
                    style={{ borderTop: '1px solid var(--color-border)', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 14, overflow: 'hidden' }}
                  >
                    {r.ai_summary && (
                      <div>
                        <p style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-xs)', fontWeight: 500, color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6 }}>Resumo da IA</p>
                        <p style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)', lineHeight: 1.6, margin: 0 }}>{r.ai_summary}</p>
                      </div>
                    )}
                    {r.ai_cycle_signal && (
                      <div>
                        <p style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-xs)', fontWeight: 500, color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 }}>Ciclo de Decisão</p>
                        <p style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)', margin: 0 }}>{r.ai_cycle_signal}</p>
                      </div>
                    )}
                    {(r.ai_objections || []).length > 0 && (
                      <div>
                        <p style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-xs)', fontWeight: 500, color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6 }}>Objeções levantadas</p>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                          {r.ai_objections.map(obj => (
                            <span key={obj} style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-xs)', fontWeight: 500, padding: '3px 10px', borderRadius: 'var(--radius-full)', background: 'var(--priority-high-bg)', color: 'var(--accent-red)' }}>{obj}</span>
                          ))}
                        </div>
                      </div>
                    )}
                    {r.meet_link && (
                      <a href={r.meet_link} target="_blank" rel="noopener noreferrer" style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-xs)', color: 'var(--color-primary)', textDecoration: 'none' }}>
                        Abrir no Google Meet →
                      </a>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </SectionCard>
          </motion.div>
        )
      })}
    </div>
  )
}

// ── Insights View ────────────────────────────────────────────────────────────

const INSIGHT_COLORS = ['var(--accent-orange)', 'var(--status-complete)', 'var(--accent-red)', 'var(--accent-blue)']

function InsightsView() {
  const [insights, setInsights] = useState<Insight[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    calendarApi.getInsights()
      .then(res => setInsights(res.data?.data || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {[1,2,3,4].map(i => (
          <motion.div key={i} initial={{ opacity: 0 }} animate={{ opacity: [0.4, 0.7, 0.4] }} transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.1 }}>
            <SectionCard style={{ height: 160 }} />
          </motion.div>
        ))}
      </div>
    )
  }

  if (insights.length === 0) {
    return (
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
        <SectionCard style={{ padding: '48px 32px', textAlign: 'center' }}>
          <p style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)', margin: 0 }}>
            Insights serão gerados após a sincronização de reuniões do Google Calendar.
          </p>
        </SectionCard>
      </motion.div>
    )
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
      {insights.map((insight, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: i * 0.07 }}
        >
          <SectionCard style={{ padding: '20px 24px', height: '100%' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 12 }}>
              <div style={{ width: 4, height: 40, borderRadius: 2, background: INSIGHT_COLORS[i % INSIGHT_COLORS.length], flexShrink: 0, marginTop: 2 }} />
              <div>
                <span style={{ fontFamily: 'var(--font-sans)', fontSize: 10, fontWeight: 500, color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{insight.type}</span>
                <h3 style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-base)', fontWeight: 600, color: 'var(--color-text-primary)', margin: '4px 0 0', lineHeight: 1.3 }}>{insight.title}</h3>
              </div>
            </div>
            <p style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)', lineHeight: 1.6, margin: '0 0 14px' }}>{insight.body}</p>
            <div style={{ padding: '10px 14px', background: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)' }}>
              <p style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-xs)', fontWeight: 500, color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.04em', margin: '0 0 3px' }}>Ação recomendada</p>
              <p style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', fontWeight: 500, color: 'var(--color-text-primary)', margin: 0 }}>{insight.action}</p>
            </div>
          </SectionCard>
        </motion.div>
      ))}
    </div>
  )
}

// ── Page Component ───────────────────────────────────────────────────────────

const TABS = ['Pipeline', 'Reuniões', 'Insights']

export default function Conversas({ onToggleChat }: { onToggleChat?: () => void }) {
  const [activeTab, setActiveTab] = useState('Pipeline')
  const [leads, setLeads] = useState<Lead[]>([])
  const [meetings, setMeetings] = useState<Meeting[]>([])
  const [loading, setLoading] = useState(true)
  const [showNewLead, setShowNewLead] = useState(false)
  const [showNewMeeting, setShowNewMeeting] = useState(false)

  // ── Fetch data on mount ──────────────────────────────────────────────────
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [leadsRes, meetingsRes] = await Promise.all([
          pipelineApi.listLeads(),
          pipelineApi.listMeetings(),
        ])
        setLeads(leadsRes.data || [])
        setMeetings(meetingsRes.data || [])
      } catch {
        // Fallback to mock data if backend unavailable
        setLeads(MOCK_LEADS)
        setMeetings(MOCK_MEETINGS)
      }
      setLoading(false)
    }
    fetchData()
  }, [])

  // ── Lead status change ───────────────────────────────────────────────────
  const handleLeadStatusChange = useCallback(async (id: string, status: LeadStatus) => {
    // Optimistic update
    setLeads(prev => prev.map(l => l.id === id ? { ...l, status, updated_at: new Date().toISOString() } : l))
    try {
      await pipelineApi.updateLead(id, { status })
    } catch {
      // Revert on failure — refetch
      try {
        const res = await pipelineApi.listLeads()
        setLeads(res.data || [])
      } catch {
        // Keep optimistic state if refetch also fails
      }
    }
  }, [])

  // ── Lead created ─────────────────────────────────────────────────────────
  const handleLeadCreated = useCallback((lead: Lead) => {
    setLeads(prev => [lead, ...prev])
  }, [])

  // ── Meeting created ──────────────────────────────────────────────────────
  const handleMeetingCreated = useCallback((meeting: Meeting) => {
    setMeetings(prev => [meeting, ...prev])
  }, [])

  // ── KPI calculations from real data ──────────────────────────────────────
  const totalLeads = leads.length
  const totalMeetings = meetings.length
  const fechados = leads.filter(l => l.status === 'fechado').length
  const conversionRate = totalLeads > 0 ? (fechados / totalLeads) * 100 : 0

  const closedLeads = leads.filter(l => l.status === 'fechado')
  const cicloMedio = closedLeads.length > 0
    ? Math.round(closedLeads.reduce((acc, l) => acc + daysBetween(l.created_at, l.updated_at), 0) / closedLeads.length)
    : 0

  if (loading) {
    return (
      <div style={{ paddingTop: 28, paddingBottom: 80 }}>
        <TopBar onToggleChat={onToggleChat} />
        <PageHeader title="Conversas" subtitle="Pipeline de vendas e inteligência de reuniões." />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '80px 0' }}>
          <motion.div
            animate={{ opacity: [0.4, 1, 0.4] }}
            transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
            style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', color: 'var(--color-text-tertiary)' }}
          >
            Carregando dados...
          </motion.div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ paddingTop: 28, paddingBottom: 80 }}>
      <TopBar onToggleChat={onToggleChat} />

      <PageHeader
        title="Conversas"
        subtitle="Pipeline de vendas e inteligência de reuniões."
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginTop: 32 }}>
        <KpiCard label="LEADS CAPTURADOS"    value={totalLeads}       decimals={0}  delay={0.05} />
        <KpiCard label="REUNIÕES"            value={totalMeetings}    decimals={0}  delay={0.1} />
        <KpiCard label="TAXA DE CONVERSÃO"   value={conversionRate}   suffix="%"    decimals={1} delay={0.15} />
        <KpiCard label="CICLO MÉDIO"         value={cicloMedio}       suffix=" dias" decimals={0} delay={0.2} />
      </div>

      <Divider margin="32px 0" />

      {/* Pill subnav */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px', background: 'var(--color-bg-secondary)', borderRadius: 10, width: 'fit-content', border: '1px solid var(--color-border)' }}>
        {TABS.map(tab => {
          const isActive = activeTab === tab
          return (
            <motion.button
              key={tab}
              onClick={() => setActiveTab(tab)}
              whileTap={{ scale: 0.97 }}
              style={{
                fontFamily: 'var(--font-sans)', fontSize: 13,
                fontWeight: isActive ? 500 : 400,
                color: isActive ? 'var(--color-text-primary)' : 'var(--color-text-tertiary)',
                background: isActive ? 'var(--color-bg-primary)' : 'transparent',
                border: isActive ? '1px solid var(--color-border)' : '1px solid transparent',
                borderRadius: 7, padding: '6px 16px', cursor: 'pointer',
                transition: 'all 0.15s ease', letterSpacing: '-0.1px',
              }}
            >
              {tab}
            </motion.button>
          )
        })}
      </div>

      <motion.div
        key={activeTab}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
        style={{ marginTop: 20 }}
      >
        {activeTab === 'Pipeline'  && <PipelineView leads={leads} onLeadStatusChange={handleLeadStatusChange} onNewLead={() => setShowNewLead(true)} />}
        {activeTab === 'Reuniões'  && <ReunioesView meetings={meetings} leads={leads} onNewMeeting={() => setShowNewMeeting(true)} />}
        {activeTab === 'Insights'  && <InsightsView />}
      </motion.div>

      {/* Modals */}
      <AnimatePresence>
        {showNewLead && (
          <NewLeadModal
            onClose={() => setShowNewLead(false)}
            onCreated={handleLeadCreated}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showNewMeeting && (
          <NewMeetingModal
            leads={leads}
            onClose={() => setShowNewMeeting(false)}
            onCreated={handleMeetingCreated}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
