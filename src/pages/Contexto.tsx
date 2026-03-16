import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import TopBar from '../components/layout/TopBar'
import {
  PageHeader, SectionLabel, Divider, Btn,
  Input, Textarea, SelectField,
} from '../components/ui/shared'
import { contextApi } from '../lib/api'

// ── Types ─────────────────────────────────────────────────────────────────────

interface BusinessContext {
  id: string
  profile_id: string
  segmento: string | null
  icp: string | null
  ticket_medio: number | null
  ciclo_vendas: string | null
  sazonalidades: string | null
  instrucoes_ia: string | null
  custom_fields: { diferenciais?: string; contexto_adicional?: string } | null
  created_at: string
  updated_at: string
}

// ── Section Card ──────────────────────────────────────────────────────────────

function SectionCard({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{
      background: 'var(--color-bg-primary)',
      border: '1px solid var(--color-border)',
      borderRadius: 'var(--radius-lg)',
      boxShadow: 'var(--shadow-md)',
      padding: '28px',
      ...style,
    }}>
      {children}
    </div>
  )
}

// ── Drop Zone ────────────────────────────────────────────────────────────────

function DropZone() {
  const [hovered, setHovered] = useState(false)

  return (
    <div style={{ position: 'relative' }}>
      <motion.div
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        animate={{
          borderColor: hovered ? 'var(--color-text-secondary)' : 'var(--color-border)',
        }}
        transition={{ duration: 0.15 }}
        style={{
          height: 120,
          border: '1px dashed var(--color-border)',
          borderRadius: 'var(--radius-lg)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
          cursor: 'default',
          opacity: 0.6,
        }}
      >
        <span style={{
          fontFamily: 'var(--font-sans)',
          fontSize: 'var(--text-sm)',
          color: 'var(--color-text-tertiary)',
        }}>
          Arraste arquivos ou clique para fazer upload
        </span>
        <span style={{
          fontFamily: 'var(--font-sans)',
          fontSize: 'var(--text-xs)',
          color: 'var(--color-text-tertiary)',
        }}>
          Pitch deck, tabela de preços, pesquisas de cliente
        </span>
      </motion.div>
      <div style={{
        position: 'absolute',
        bottom: -22,
        left: 0,
        fontFamily: 'var(--font-sans)',
        fontSize: 'var(--text-xs)',
        color: 'var(--color-text-tertiary)',
        fontStyle: 'italic',
      }}>
        Upload de arquivos sera disponibilizado em breve
      </div>
    </div>
  )
}

// ── Status Indicator ──────────────────────────────────────────────────────────

function ContextStatus({ context, loading }: { context: BusinessContext | null; loading: boolean }) {
  if (loading) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        fontFamily: 'var(--font-sans)',
        fontSize: 'var(--text-sm)',
        color: 'var(--color-text-tertiary)',
      }}>
        <motion.div
          animate={{ opacity: [0.4, 1, 0.4] }}
          transition={{ duration: 1.5, repeat: Infinity }}
          style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: 'var(--color-text-tertiary)',
          }}
        />
        Carregando contexto...
      </div>
    )
  }

  if (context) {
    const updatedAt = new Date(context.updated_at)
    const formatted = updatedAt.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })

    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        fontFamily: 'var(--font-sans)',
        fontSize: 'var(--text-sm)',
        color: 'var(--color-text-secondary)',
      }}>
        <div style={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          background: 'var(--color-success, #22c55e)',
          flexShrink: 0,
        }} />
        Contexto ativo — ultima atualizacao: {formatted}
      </div>
    )
  }

  return (
    <p style={{
      fontFamily: 'var(--font-sans)',
      fontSize: 'var(--text-base)',
      color: 'var(--color-text-secondary)',
      margin: 0,
      lineHeight: 1.6,
    }}>
      Configure o contexto para personalizar as analises da IA.
    </p>
  )
}

// ── Page Component ───────────────────────────────────────────────────────────

export default function Contexto({ onToggleChat }: { onToggleChat?: () => void }) {
  const [segmento, setSegmento] = useState('')
  const [icp, setIcp] = useState('')
  const [ticket, setTicket] = useState('')
  const [ciclo, setCiclo] = useState('')
  const [diferenciais, setDiferenciais] = useState('')
  const [sazonalidades, setSazonalidades] = useState('')
  const [instrucoes, setInstrucoes] = useState('')
  const [contextoAdicional, setContextoAdicional] = useState('')

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [existingContext, setExistingContext] = useState<BusinessContext | null>(null)

  // ── Load existing context on mount ────────────────────────────────────────
  useEffect(() => {
    const loadContext = async () => {
      try {
        const res = await contextApi.get()
        const data = res.data as BusinessContext | null
        if (data) {
          setExistingContext(data)
          setSegmento(data.segmento || '')
          setIcp(data.icp || '')
          setTicket(data.ticket_medio != null ? data.ticket_medio.toLocaleString('pt-BR') : '')
          setCiclo(data.ciclo_vendas || '')
          setSazonalidades(data.sazonalidades || '')
          setInstrucoes(data.instrucoes_ia || '')
          setDiferenciais(data.custom_fields?.diferenciais || '')
          setContextoAdicional(data.custom_fields?.contexto_adicional || '')
        }
      } catch {
        // First time — no data yet, that's fine
      }
      setLoading(false)
    }
    loadContext()
  }, [])

  // ── Check if form has any content ─────────────────────────────────────────
  const hasContent = segmento || icp || ticket || ciclo || diferenciais || instrucoes || contextoAdicional || sazonalidades

  // ── Save handler ──────────────────────────────────────────────────────────
  const handleSave = useCallback(async () => {
    setSaving(true)
    setError(null)
    try {
      // Parse ticket_medio: remove formatting and convert to number
      let ticketNumeric: number | null = null
      if (ticket) {
        const cleaned = ticket.replace(/\./g, '').replace(',', '.').replace(/[^\d.]/g, '')
        const parsed = parseFloat(cleaned)
        if (!isNaN(parsed)) ticketNumeric = parsed
      }

      const res = await contextApi.save({
        segmento: segmento || null,
        icp: icp || null,
        ticket_medio: ticketNumeric,
        ciclo_vendas: ciclo || null,
        sazonalidades: sazonalidades || null,
        instrucoes_ia: instrucoes || null,
        custom_fields: {
          diferenciais: diferenciais || null,
          contexto_adicional: contextoAdicional || null,
        },
      })

      setExistingContext(res.data as BusinessContext)
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch {
      setError('Erro ao salvar contexto. Tente novamente.')
    }
    setSaving(false)
  }, [segmento, icp, ticket, ciclo, sazonalidades, instrucoes, diferenciais, contextoAdicional])

  return (
    <div style={{ paddingTop: 28, paddingBottom: 80 }}>
      <TopBar onToggleChat={onToggleChat} />

      <PageHeader
        title="Contexto do Negocio"
        subtitle="Treine a IA com informacoes especificas do seu negocio."
      />

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4, delay: 0.15 }}
        style={{
          fontFamily: 'var(--font-sans)',
          fontSize: 'var(--text-sm)',
          color: 'var(--color-text-secondary)',
          marginTop: 12,
          marginBottom: 32,
        }}
      >
        Quanto mais contexto voce alimentar, mais precisas serao as recomendacoes do Growth Engine e as analises da Ask Northie.
      </motion.p>

      {/* Two-column grid */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 24,
        }}
      >
        {/* Left column — Perfil do Negocio */}
        <SectionCard>
          <SectionLabel gutterBottom={20}>Perfil do Negocio</SectionLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <Input
              label="Segmento"
              placeholder="Ex: SaaS B2B, E-commerce DTC, Infoproduto..."
              value={segmento}
              onChange={e => setSegmento(e.target.value)}
              disabled={loading}
            />
            <Input
              label="ICP (Cliente Ideal)"
              placeholder="Ex: Gestores de RH em empresas de 50-200 funcionarios"
              value={icp}
              onChange={e => setIcp(e.target.value)}
              disabled={loading}
            />
            <Input
              label="Ticket Medio"
              placeholder="R$ 0,00"
              value={ticket}
              onChange={e => setTicket(e.target.value)}
              disabled={loading}
            />
            <SelectField
              label="Ciclo de Vendas"
              value={ciclo}
              onChange={e => setCiclo(e.target.value)}
              disabled={loading}
            >
              <option value="" disabled>Selecione...</option>
              <option value="direto">Direto (checkout)</option>
              <option value="curto">Curto (&lt; 7 dias)</option>
              <option value="medio">Medio (7-30 dias)</option>
              <option value="consultivo">Consultivo (30+ dias)</option>
            </SelectField>
            <Textarea
              label="Diferenciais do produto"
              placeholder="O que torna seu produto unico? Quais problemas resolve?"
              value={diferenciais}
              onChange={e => setDiferenciais(e.target.value)}
              rows={4}
              disabled={loading}
            />
          </div>
        </SectionCard>

        {/* Right column — Instrucoes para a IA */}
        <SectionCard>
          <SectionLabel gutterBottom={20}>Instrucoes para a IA</SectionLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <Textarea
              label="Instrucoes personalizadas"
              placeholder="Ex: Nunca recomendar desconto acima de 20%. Sempre considerar que janeiro e nosso mes mais fraco. Priorizar retencao sobre aquisicao neste trimestre."
              value={instrucoes}
              onChange={e => setInstrucoes(e.target.value)}
              rows={6}
              disabled={loading}
            />
            <Textarea
              label="Contexto adicional"
              placeholder="Informacoes sobre o mercado, concorrentes, estrategia atual..."
              value={contextoAdicional}
              onChange={e => setContextoAdicional(e.target.value)}
              rows={4}
              disabled={loading}
            />

            <Divider margin="8px 0" />

            <SectionLabel gutterBottom={12}>Arquivos de Referencia</SectionLabel>
            <DropZone />
          </div>
        </SectionCard>
      </motion.div>

      {/* Bottom section — O que a IA sabe */}
      <Divider margin="32px 0" />

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.35, ease: [0.25, 0.1, 0.25, 1] }}
      >
        <SectionLabel>O que a IA sabe sobre voce</SectionLabel>

        <SectionCard style={{ padding: '24px' }}>
          <ContextStatus context={existingContext} loading={loading} />
        </SectionCard>

        {/* Save button + status */}
        <div style={{ marginTop: 24, display: 'flex', alignItems: 'center', gap: 16 }}>
          <Btn
            variant="primary"
            size="lg"
            disabled={loading || saving || !hasContent}
            onClick={handleSave}
          >
            {saving ? 'Salvando...' : 'Salvar Contexto'}
          </Btn>

          <AnimatePresence>
            {saved && (
              <motion.span
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -8 }}
                transition={{ duration: 0.25, ease: [0.25, 0.1, 0.25, 1] }}
                style={{
                  fontFamily: 'var(--font-sans)',
                  fontSize: 'var(--text-sm)',
                  color: 'var(--color-success, #22c55e)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path
                    d="M3 8.5L6.5 12L13 4"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                Salvo!
              </motion.span>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {error && (
              <motion.span
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -8 }}
                transition={{ duration: 0.25 }}
                style={{
                  fontFamily: 'var(--font-sans)',
                  fontSize: 'var(--text-sm)',
                  color: 'var(--color-error, #ef4444)',
                }}
              >
                {error}
              </motion.span>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  )
}
