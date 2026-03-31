/**
 * @file pages/Agentes.tsx
 * Agentes Financeiros — monitoramento em tempo real, feed de alertas e configuração de thresholds.
 */

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import TopBar from '../components/layout/TopBar'
import { agentesFinanceirosApi, invalidateCache } from '../lib/api'

// ── Types ─────────────────────────────────────────────────────────────────────

interface AgentData {
  agent_type: 'receita' | 'caixa' | 'gastos' | 'oportunidade'
  is_active: boolean
  thresholds: Record<string, number>
  alertas_abertos: number
  updated_at: string
}

interface Alerta {
  id: string
  agent_type: 'receita' | 'caixa' | 'gastos' | 'oportunidade'
  severity: 'info' | 'atencao' | 'critico'
  title: string
  description: string
  suggestion: string
  status: 'aberto' | 'resolvido' | 'ignorado'
  created_at: string
}

interface PageProps {
  onToggleChat: () => void
}

// ── Constants ─────────────────────────────────────────────────────────────────

const AGENT_META: Record<string, {
  label: string
  freq: string
  desc: string
  icon: React.FC<{ size?: number }>
}> = {
  receita: {
    label: 'Agente de Receita',
    freq: 'Diário',
    desc: 'Monitora variações em receita',
    icon: ({ size = 18 }) => (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <polyline points="17 6 23 6 23 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  caixa: {
    label: 'Agente de Caixa',
    freq: 'Diário',
    desc: 'Analisa forecast e runway',
    icon: ({ size = 18 }) => (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <rect x="1" y="4" width="22" height="16" rx="2" ry="2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <line x1="1" y1="10" x2="23" y2="10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    ),
  },
  gastos: {
    label: 'Agente de Gastos',
    freq: 'Semanal',
    desc: 'Detecta gastos desproporcionais',
    icon: ({ size = 18 }) => (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <rect x="1" y="4" width="22" height="16" rx="2" ry="2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <line x1="1" y1="10" x2="23" y2="10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    ),
  },
  oportunidade: {
    label: 'Agente de Oportunidade',
    freq: 'Semanal',
    desc: 'Encontra canais sub-explorados',
    icon: ({ size = 18 }) => (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
}

const SEVERITY_CONFIG = {
  critico: { label: 'Crítico', color: '#E03E3E', bg: '#FBE4E4' },
  atencao: { label: 'Atenção', color: '#D9730D', bg: '#FBF3DB' },
  info: { label: 'Info', color: '#2F80ED', bg: '#E8F0FE' },
}

const AGENT_TYPES = ['receita', 'caixa', 'gastos', 'oportunidade'] as const

// ── Helpers ───────────────────────────────────────────────────────────────────

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'agora mesmo'
  if (m < 60) return `${m}min atrás`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h atrás`
  const d = Math.floor(h / 24)
  return `${d}d atrás`
}

function fmtShortDate(iso: string): string {
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date(iso))
}

// ── Sub-components ────────────────────────────────────────────────────────────

function ToggleSwitch({ enabled, onChange, disabled }: { enabled: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <motion.button
      onClick={() => !disabled && onChange(!enabled)}
      whileTap={disabled ? {} : { scale: 0.95 }}
      aria-checked={enabled}
      role="switch"
      style={{
        width: 40,
        height: 22,
        borderRadius: 11,
        border: 'none',
        cursor: disabled ? 'not-allowed' : 'pointer',
        position: 'relative',
        flexShrink: 0,
        background: enabled ? '#FF5900' : 'rgba(66,87,138,0.15)',
        transition: 'background 0.2s',
        padding: 0,
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <motion.span
        animate={{ x: enabled ? 20 : 2 }}
        transition={{ duration: 0.18, ease: [0.4, 0, 0.2, 1] }}
        style={{ display: 'block', width: 18, height: 18, borderRadius: '50%', background: 'white', position: 'absolute', top: 2, boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }}
      />
    </motion.button>
  )
}

const cardStyle: React.CSSProperties = {
  background: '#FFFFFF',
  border: '1px solid rgba(66,87,138,0.12)',
  borderRadius: 10,
  padding: '20px 24px',
}

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.28, ease: [0.25, 0.1, 0.25, 1] as const, delay },
})

// ── KPI Card ──────────────────────────────────────────────────────────────────

function KpiCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div style={cardStyle}>
      <div style={{ fontFamily: 'var(--font-sans)', fontSize: 12, color: '#6B7280', fontWeight: 500, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        {label}
      </div>
      <div style={{ fontFamily: 'var(--font-sans)', fontSize: 32, fontWeight: 700, color: '#37352F', lineHeight: 1 }}>
        {value}
      </div>
      {sub && (
        <div style={{ fontFamily: 'var(--font-sans)', fontSize: 12, color: '#9CA3AF', marginTop: 6 }}>
          {sub}
        </div>
      )}
    </div>
  )
}

// ── Agent Card ────────────────────────────────────────────────────────────────

interface AgentCardProps {
  data: AgentData
  onToggle: (type: string, active: boolean) => Promise<void>
  onExecutar: (type: string) => Promise<void>
  onConfigure: (type: string) => void
  configuringType: string | null
  toggling: string | null
  executing: string | null
}

function AgentCard({ data, onToggle, onExecutar, onConfigure, configuringType, toggling, executing }: AgentCardProps) {
  const meta = AGENT_META[data.agent_type]
  const Icon = meta.icon
  const isConfiguring = configuringType === data.agent_type
  const isToggling = toggling === data.agent_type
  const isExecuting = executing === data.agent_type

  return (
    <div style={{ ...cardStyle, display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 36, height: 36, borderRadius: 8, background: 'rgba(255,89,0,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#FF5900', flexShrink: 0 }}>
            <Icon size={18} />
          </div>
          <div>
            <div style={{ fontFamily: 'var(--font-sans)', fontSize: 14, fontWeight: 600, color: '#37352F' }}>
              {meta.label}
            </div>
            <div style={{ fontFamily: 'var(--font-sans)', fontSize: 12, color: '#9CA3AF', marginTop: 2 }}>
              {meta.desc}
            </div>
          </div>
        </div>
        <ToggleSwitch enabled={data.is_active} onChange={(v) => onToggle(data.agent_type, v)} disabled={isToggling} />
      </div>

      {/* Meta row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: '#9CA3AF' }}>FREQ</span>
          <span style={{ fontFamily: 'var(--font-sans)', fontSize: 12, fontWeight: 500, color: '#6B7280', background: 'rgba(66,87,138,0.07)', padding: '2px 8px', borderRadius: 4 }}>
            {meta.freq}
          </span>
        </div>
        {data.alertas_abertos > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#E03E3E', display: 'inline-block' }} />
            <span style={{ fontFamily: 'var(--font-sans)', fontSize: 12, color: '#E03E3E', fontWeight: 500 }}>
              {data.alertas_abertos} alerta{data.alertas_abertos !== 1 ? 's' : ''} aberto{data.alertas_abertos !== 1 ? 's' : ''}
            </span>
          </div>
        )}
        {data.alertas_abertos === 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#34D399', display: 'inline-block' }} />
            <span style={{ fontFamily: 'var(--font-sans)', fontSize: 12, color: '#6B7280' }}>sem alertas abertos</span>
          </div>
        )}
      </div>

      {/* Last run */}
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: '#9CA3AF' }}>
        ÚLTIMA VEZ {fmtShortDate(data.updated_at)}
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
        <motion.button
          onClick={() => onExecutar(data.agent_type)}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.97 }}
          disabled={isExecuting || !data.is_active}
          style={{ flex: 1, padding: '7px 0', fontFamily: 'var(--font-sans)', fontSize: 13, fontWeight: 500, color: data.is_active ? '#FF5900' : '#9CA3AF', background: data.is_active ? 'rgba(255,89,0,0.06)' : 'rgba(66,87,138,0.05)', border: `1px solid ${data.is_active ? 'rgba(255,89,0,0.18)' : 'rgba(66,87,138,0.10)'}`, borderRadius: 7, cursor: data.is_active ? 'pointer' : 'not-allowed', opacity: isExecuting ? 0.6 : 1 }}
        >
          {isExecuting ? 'Executando...' : 'Executar'}
        </motion.button>
        <motion.button
          onClick={() => onConfigure(data.agent_type)}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.97 }}
          style={{ flex: 1, padding: '7px 0', fontFamily: 'var(--font-sans)', fontSize: 13, fontWeight: 500, color: '#6B7280', background: 'transparent', border: '1px solid rgba(66,87,138,0.12)', borderRadius: 7, cursor: 'pointer' }}
        >
          {isConfiguring ? 'Fechar' : 'Configurar'}
        </motion.button>
      </div>
    </div>
  )
}

// ── Threshold Config ──────────────────────────────────────────────────────────

function ConfigPanel({ agent, onSave }: { agent: AgentData; onSave: (type: string, thresholds: Record<string, number>) => Promise<void> }) {
  const [draft, setDraft] = useState<Record<string, string>>(
    Object.fromEntries(Object.entries(agent.thresholds).map(([k, v]) => [k, String(v)]))
  )
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    const parsed = Object.fromEntries(Object.entries(draft).map(([k, v]) => [k, parseFloat(v) || 0]))
    await onSave(agent.agent_type, parsed)
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const hasThresholds = Object.keys(agent.thresholds).length > 0

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
      style={{ overflow: 'hidden' }}
    >
      <div style={{ marginTop: 16, padding: '16px 20px', background: '#F7F7FA', borderRadius: 8, border: '1px solid rgba(66,87,138,0.08)' }}>
        <div style={{ fontFamily: 'var(--font-sans)', fontSize: 13, fontWeight: 600, color: '#37352F', marginBottom: 12 }}>
          Thresholds — {AGENT_META[agent.agent_type].label}
        </div>
        {!hasThresholds && (
          <div style={{ fontFamily: 'var(--font-sans)', fontSize: 13, color: '#9CA3AF' }}>
            Nenhum threshold configurável disponível para este agente.
          </div>
        )}
        {hasThresholds && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {Object.entries(draft).map(([key, val]) => (
              <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <label style={{ fontFamily: 'var(--font-sans)', fontSize: 12, color: '#6B7280', minWidth: 140, textTransform: 'capitalize' }}>
                  {key.replace(/_/g, ' ')}
                </label>
                <input
                  type="number"
                  value={val}
                  onChange={(e) => setDraft(d => ({ ...d, [key]: e.target.value }))}
                  style={{ width: 100, padding: '5px 10px', fontFamily: 'var(--font-sans)', fontSize: 13, color: '#37352F', background: '#FFFFFF', border: '1px solid rgba(66,87,138,0.18)', borderRadius: 6, outline: 'none' }}
                />
              </div>
            ))}
            <motion.button
              onClick={handleSave}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.97 }}
              disabled={saving}
              style={{ alignSelf: 'flex-start', marginTop: 4, padding: '7px 20px', fontFamily: 'var(--font-sans)', fontSize: 13, fontWeight: 500, color: '#FFFFFF', background: saved ? '#34D399' : '#FF5900', border: 'none', borderRadius: 7, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1, transition: 'background 0.2s' }}
            >
              {saved ? 'Salvo!' : saving ? 'Salvando...' : 'Salvar'}
            </motion.button>
          </div>
        )}
      </div>
    </motion.div>
  )
}

// ── Alert Card ────────────────────────────────────────────────────────────────

interface AlertCardProps {
  alerta: Alerta
  onResolver: (id: string) => Promise<void>
  onIgnorar: (id: string) => Promise<void>
  mutating: string | null
}

function AlertCard({ alerta, onResolver, onIgnorar, mutating }: AlertCardProps) {
  const sev = SEVERITY_CONFIG[alerta.severity]
  const meta = AGENT_META[alerta.agent_type]
  const isMutating = mutating === alerta.id

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97 }}
      transition={{ duration: 0.22, ease: [0.25, 0.1, 0.25, 1] }}
      style={{ ...cardStyle, padding: '16px 20px' }}
    >
      <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
        {/* Severity indicator */}
        <div style={{ width: 3, minHeight: 60, borderRadius: 2, background: sev.color, flexShrink: 0, alignSelf: 'stretch' }} />

        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Top row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
            <span style={{ fontFamily: 'var(--font-sans)', fontSize: 11, fontWeight: 600, color: sev.color, background: sev.bg, padding: '2px 8px', borderRadius: 4 }}>
              {sev.label}
            </span>
            <span style={{ fontFamily: 'var(--font-sans)', fontSize: 11, color: '#9CA3AF', background: 'rgba(66,87,138,0.07)', padding: '2px 8px', borderRadius: 4 }}>
              {meta.label}
            </span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: '#9CA3AF', marginLeft: 'auto' }}>
              {timeAgo(alerta.created_at)}
            </span>
          </div>

          {/* Content */}
          <div style={{ fontFamily: 'var(--font-sans)', fontSize: 14, fontWeight: 600, color: '#37352F', marginBottom: 4 }}>
            {alerta.title}
          </div>
          <div style={{ fontFamily: 'var(--font-sans)', fontSize: 13, color: '#6B7280', lineHeight: 1.5, marginBottom: 8 }}>
            {alerta.description}
          </div>
          {alerta.suggestion && (
            <div style={{ fontFamily: 'var(--font-sans)', fontSize: 12, color: '#FF5900', lineHeight: 1.5, padding: '8px 12px', background: 'rgba(255,89,0,0.05)', borderRadius: 6, border: '1px solid rgba(255,89,0,0.12)' }}>
              Sugestão: {alerta.suggestion}
            </div>
          )}

          {/* Actions */}
          {alerta.status === 'aberto' && (
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <motion.button
                onClick={() => onResolver(alerta.id)}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.97 }}
                disabled={isMutating}
                style={{ padding: '5px 14px', fontFamily: 'var(--font-sans)', fontSize: 12, fontWeight: 500, color: '#FFFFFF', background: '#34D399', border: 'none', borderRadius: 6, cursor: isMutating ? 'not-allowed' : 'pointer', opacity: isMutating ? 0.6 : 1 }}
              >
                Resolver
              </motion.button>
              <motion.button
                onClick={() => onIgnorar(alerta.id)}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.97 }}
                disabled={isMutating}
                style={{ padding: '5px 14px', fontFamily: 'var(--font-sans)', fontSize: 12, fontWeight: 500, color: '#6B7280', background: 'transparent', border: '1px solid rgba(66,87,138,0.15)', borderRadius: 6, cursor: isMutating ? 'not-allowed' : 'pointer', opacity: isMutating ? 0.6 : 1 }}
              >
                Ignorar
              </motion.button>
            </div>
          )}
          {alerta.status !== 'aberto' && (
            <div style={{ marginTop: 10 }}>
              <span style={{ fontFamily: 'var(--font-sans)', fontSize: 11, fontWeight: 500, color: alerta.status === 'resolvido' ? '#34D399' : '#9CA3AF', background: alerta.status === 'resolvido' ? 'rgba(52,211,153,0.1)' : 'rgba(66,87,138,0.07)', padding: '2px 8px', borderRadius: 4 }}>
                {alerta.status === 'resolvido' ? 'Resolvido' : 'Ignorado'}
              </span>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  )
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function Skeleton({ w = '100%', h = 16, r = 6 }: { w?: string | number; h?: number; r?: number }) {
  return (
    <div style={{ width: w, height: h, borderRadius: r, background: 'rgba(66,87,138,0.08)', animation: 'pulse 1.5s ease-in-out infinite' }} />
  )
}

function AgentCardSkeleton() {
  return (
    <div style={cardStyle}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 10 }}>
          <Skeleton w={36} h={36} r={8} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <Skeleton w={140} h={14} />
            <Skeleton w={100} h={12} />
          </div>
        </div>
        <Skeleton w={40} h={22} r={11} />
      </div>
      <Skeleton w="60%" h={12} />
      <div style={{ marginTop: 16, display: 'flex', gap: 8 }}>
        <Skeleton w="50%" h={34} r={7} />
        <Skeleton w="50%" h={34} r={7} />
      </div>
    </div>
  )
}

// ── Filter tab ────────────────────────────────────────────────────────────────

type AlertFilter = 'aberto' | 'resolvido' | 'ignorado' | 'todos'

function FilterTabs({ active, onChange }: { active: AlertFilter; onChange: (v: AlertFilter) => void }) {
  const tabs: { key: AlertFilter; label: string }[] = [
    { key: 'todos', label: 'Todos' },
    { key: 'aberto', label: 'Abertos' },
    { key: 'resolvido', label: 'Resolvidos' },
    { key: 'ignorado', label: 'Ignorados' },
  ]
  return (
    <div style={{ display: 'inline-flex', background: 'rgba(66,87,138,0.06)', border: '1px solid rgba(66,87,138,0.10)', borderRadius: 8, padding: 3, gap: 2 }}>
      {tabs.map(tab => (
        <motion.button
          key={tab.key}
          onClick={() => onChange(tab.key)}
          whileTap={{ scale: 0.97 }}
          style={{ padding: '5px 14px', borderRadius: 6, border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)', fontSize: 13, fontWeight: active === tab.key ? 500 : 400, background: active === tab.key ? '#FFFFFF' : 'transparent', color: active === tab.key ? '#37352F' : '#9CA3AF', boxShadow: active === tab.key ? '0 1px 3px rgba(0,0,0,0.08)' : 'none', transition: 'all 0.15s ease' }}
        >
          {tab.label}
        </motion.button>
      ))}
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function Agentes({ onToggleChat }: PageProps) {
  const [agents, setAgents] = useState<AgentData[]>([])
  const [alertas, setAlertas] = useState<Alerta[]>([])
  const [loadingAgents, setLoadingAgents] = useState(true)
  const [loadingAlertas, setLoadingAlertas] = useState(true)

  const [alertFilter, setAlertFilter] = useState<AlertFilter>('aberto')
  const [configuringType, setConfiguringType] = useState<string | null>(null)
  const [toggling, setToggling] = useState<string | null>(null)
  const [executing, setExecuting] = useState<string | null>(null)
  const [mutatingAlerta, setMutatingAlerta] = useState<string | null>(null)

  // ── Data fetch ───────────────────────────────────────────────────────────────

  const fetchAgents = useCallback(async () => {
    try {
      const res = await agentesFinanceirosApi.list()
      setAgents(res.data ?? [])
    } catch {
      setAgents([])
    } finally {
      setLoadingAgents(false)
    }
  }, [])

  const fetchAlertas = useCallback(async () => {
    try {
      const res = await agentesFinanceirosApi.alertas()
      setAlertas(res.data ?? [])
    } catch {
      setAlertas([])
    } finally {
      setLoadingAlertas(false)
    }
  }, [])

  useEffect(() => {
    fetchAgents()
    fetchAlertas()
  }, [fetchAgents, fetchAlertas])

  // ── Actions ──────────────────────────────────────────────────────────────────

  const handleToggle = async (type: string, active: boolean) => {
    setToggling(type)
    try {
      await agentesFinanceirosApi.configurar(type, { is_active: active })
      invalidateCache('/agents')
      setAgents(prev => prev.map(a => a.agent_type === type ? { ...a, is_active: active } : a))
    } finally {
      setToggling(null)
    }
  }

  const handleExecutar = async (type: string) => {
    setExecuting(type)
    try {
      await agentesFinanceirosApi.executar(type)
      setTimeout(() => {
        fetchAgents()
        fetchAlertas()
      }, 1500)
    } finally {
      setExecuting(null)
    }
  }

  const handleConfigure = (type: string) => {
    setConfiguringType(prev => prev === type ? null : type)
  }

  const handleSaveThresholds = async (type: string, thresholds: Record<string, number>) => {
    await agentesFinanceirosApi.configurar(type, { thresholds })
    invalidateCache('/agents')
    setAgents(prev => prev.map(a => a.agent_type === type ? { ...a, thresholds } : a))
  }

  const handleResolver = async (id: string) => {
    setMutatingAlerta(id)
    try {
      await agentesFinanceirosApi.resolver(id)
      invalidateCache('/agents')
      setAlertas(prev => prev.map(a => a.id === id ? { ...a, status: 'resolvido' as const } : a))
      setAgents(prev => prev.map(a => {
        const alerta = alertas.find(al => al.id === id)
        if (alerta && a.agent_type === alerta.agent_type && a.alertas_abertos > 0) {
          return { ...a, alertas_abertos: a.alertas_abertos - 1 }
        }
        return a
      }))
    } finally {
      setMutatingAlerta(null)
    }
  }

  const handleIgnorar = async (id: string) => {
    setMutatingAlerta(id)
    try {
      await agentesFinanceirosApi.ignorar(id)
      invalidateCache('/agents')
      setAlertas(prev => prev.map(a => a.id === id ? { ...a, status: 'ignorado' as const } : a))
      setAgents(prev => prev.map(a => {
        const alerta = alertas.find(al => al.id === id)
        if (alerta && a.agent_type === alerta.agent_type && a.alertas_abertos > 0) {
          return { ...a, alertas_abertos: a.alertas_abertos - 1 }
        }
        return a
      }))
    } finally {
      setMutatingAlerta(null)
    }
  }

  // ── Derived metrics ──────────────────────────────────────────────────────────

  const totalAbertos = alertas.filter(a => a.status === 'aberto').length
  const totalCriticos = alertas.filter(a => a.status === 'aberto' && a.severity === 'critico').length
  const totalResolvidos = alertas.filter(a => a.status === 'resolvido').length

  const ultimaVerificacao = agents.length > 0
    ? agents.reduce((latest, a) => (new Date(a.updated_at) > new Date(latest) ? a.updated_at : latest), agents[0].updated_at)
    : null

  const filteredAlertas = alertas.filter(a => alertFilter === 'todos' || a.status === alertFilter)

  // Ensure all 4 agent types are represented (fill gaps if API returns partial data)
  const agentMap = new Map(agents.map(a => [a.agent_type, a]))
  const agentList = AGENT_TYPES.map(type => agentMap.get(type)).filter(Boolean) as AgentData[]

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div style={{ minHeight: '100vh', background: '#F7F7FA' }}>
      <TopBar onToggleChat={onToggleChat} />

      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '32px 32px 64px' }}>

        {/* Page header */}
        <motion.div {...fadeUp(0)} style={{ marginBottom: 28 }}>
          <h1 style={{ fontFamily: 'var(--font-sans)', fontSize: 24, fontWeight: 600, color: '#37352F', margin: 0, letterSpacing: '-0.3px' }}>
            Agentes Financeiros
          </h1>
          <p style={{ fontFamily: 'var(--font-sans)', fontSize: 14, color: '#9CA3AF', margin: '6px 0 0' }}>
            Monitoramento automático de receita, caixa, gastos e oportunidades
          </p>
        </motion.div>

        {/* KPI row */}
        <motion.div {...fadeUp(0.04)} style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 32 }}>
          <KpiCard
            label="Alertas Abertos"
            value={loadingAlertas ? '—' : totalAbertos}
            sub={totalAbertos > 0 ? `${totalCriticos} crítico${totalCriticos !== 1 ? 's' : ''}` : 'nenhum alerta pendente'}
          />
          <KpiCard
            label="Alertas Críticos"
            value={loadingAlertas ? '—' : totalCriticos}
            sub={totalCriticos > 0 ? 'ação imediata necessária' : 'nível normal'}
          />
          <KpiCard
            label="Resolvidos (total)"
            value={loadingAlertas ? '—' : totalResolvidos}
            sub="todos os períodos"
          />
          <KpiCard
            label="Última Verificação"
            value={loadingAgents || !ultimaVerificacao ? '—' : timeAgo(ultimaVerificacao)}
            sub={ultimaVerificacao ? fmtShortDate(ultimaVerificacao) : undefined}
          />
        </motion.div>

        {/* Section: Grid de agentes */}
        <motion.div {...fadeUp(0.08)} style={{ marginBottom: 32 }}>
          <div style={{ fontFamily: 'var(--font-sans)', fontSize: 13, fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 14 }}>
            Agentes Ativos
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
            {loadingAgents
              ? AGENT_TYPES.map(t => <AgentCardSkeleton key={t} />)
              : agentList.length === 0
                ? (
                  <div style={{ gridColumn: '1 / -1', ...cardStyle, textAlign: 'center', padding: '40px 24px' }}>
                    <div style={{ fontFamily: 'var(--font-sans)', fontSize: 14, color: '#9CA3AF' }}>
                      Nenhum agente encontrado. Verifique a conexão com o backend.
                    </div>
                  </div>
                )
                : agentList.map((agent, i) => (
                  <motion.div key={agent.agent_type} {...fadeUp(0.08 + i * 0.04)}>
                    <AgentCard
                      data={agent}
                      onToggle={handleToggle}
                      onExecutar={handleExecutar}
                      onConfigure={handleConfigure}
                      configuringType={configuringType}
                      toggling={toggling}
                      executing={executing}
                    />
                    <AnimatePresence>
                      {configuringType === agent.agent_type && (
                        <ConfigPanel
                          key={`config-${agent.agent_type}`}
                          agent={agent}
                          onSave={handleSaveThresholds}
                        />
                      )}
                    </AnimatePresence>
                  </motion.div>
                ))
            }
          </div>
        </motion.div>

        {/* Section: Feed de alertas */}
        <motion.div {...fadeUp(0.16)}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 12 }}>
            <div style={{ fontFamily: 'var(--font-sans)', fontSize: 13, fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Log de Atividade
            </div>
            <FilterTabs active={alertFilter} onChange={setAlertFilter} />
          </div>

          {loadingAlertas ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[0, 1, 2].map(i => (
                <div key={i} style={{ ...cardStyle, padding: '16px 20px' }}>
                  <div style={{ display: 'flex', gap: 14 }}>
                    <Skeleton w={3} h={60} r={2} />
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <Skeleton w={60} h={20} r={4} />
                        <Skeleton w={100} h={20} r={4} />
                      </div>
                      <Skeleton w="50%" h={14} />
                      <Skeleton w="80%" h={12} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : filteredAlertas.length === 0 ? (
            <div style={{ ...cardStyle, textAlign: 'center', padding: '48px 24px' }}>
              <div style={{ fontFamily: 'var(--font-sans)', fontSize: 14, color: '#9CA3AF' }}>
                {alertFilter === 'aberto'
                  ? 'Nenhum alerta aberto. Os agentes estão monitorando continuamente.'
                  : `Nenhum alerta ${alertFilter === 'resolvido' ? 'resolvido' : alertFilter === 'ignorado' ? 'ignorado' : ''} encontrado.`
                }
              </div>
            </div>
          ) : (
            <AnimatePresence mode="popLayout">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {filteredAlertas.map(alerta => (
                  <AlertCard
                    key={alerta.id}
                    alerta={alerta}
                    onResolver={handleResolver}
                    onIgnorar={handleIgnorar}
                    mutating={mutatingAlerta}
                  />
                ))}
              </div>
            </AnimatePresence>
          )}
        </motion.div>
      </div>

      {/* Skeleton pulse keyframe */}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.45; }
        }
      `}</style>
    </div>
  )
}
