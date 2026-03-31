import { useState, useRef, useEffect, useCallback, lazy, Suspense } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { growthApi, aiApi, skillsApi } from '../lib/api'
import { supabase } from '../lib/supabase'

// ── AI Models ─────────────────────────────────────────────────────────────────

type AIModel = 'haiku' | 'sonnet' | 'opus'
interface ModelDef { id: AIModel; label: string; description: string; icon: string }
const MODELS: ModelDef[] = [
  { id: 'haiku',  label: 'Haiku',  description: 'Rápido — perguntas simples', icon: '⚡' },
  { id: 'sonnet', label: 'Sonnet', description: 'Equilibrado — uso geral',    icon: '◆' },
  { id: 'opus',   label: 'Opus',   description: 'Análise profunda',           icon: '◈' },
]

interface SlashCmd { id: string; icon: string; label: string; description: string }
const SLASH_COMMANDS: SlashCmd[] = [
  { id: 'skills', icon: '⚡', label: 'Skills',          description: 'Use uma skill especializada' },
  { id: 'clear',  icon: '↺',  label: 'Limpar conversa', description: 'Inicia uma nova conversa'    },
]
interface SkillItem { id: string; name: string; description?: string; is_global: boolean }

export interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
}

const ContextoPage = lazy(() => import('./Contexto'))

type ActiveView = 'chat' | 'history' | 'contexto'

// ── Types ─────────────────────────────────────────────────────────────────────

type RecStatus =
  | 'pending' | 'collaborating' | 'awaiting_confirmation'
  | 'approved' | 'executing' | 'completed'
  | 'failed' | 'dismissed' | 'rejected' | 'cancelled'

interface Recommendation {
  id: string
  type: string
  status: RecStatus
  title: string
  narrative: string
  impact_estimate: string
  sources: string[]
  created_at: string
}

interface ConvItem {
  id: string
  title: string | null
  updated_at: string
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function greeting(name: string) {
  const h = new Date().getHours()
  const period = h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite'
  return `${period}, ${name}`
}

// ── Icons ─────────────────────────────────────────────────────────────────────

const ISearch = () => (
  <svg width="15" height="15" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
    <circle cx="9" cy="9" r="6" /><path d="M15 15l-3-3" />
  </svg>
)
const ISliders = () => (
  <svg width="15" height="15" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
    <path d="M4 5h12M4 10h12M4 15h12" /><circle cx="7" cy="5" r="1.5" fill="currentColor" stroke="none" /><circle cx="13" cy="10" r="1.5" fill="currentColor" stroke="none" /><circle cx="8" cy="15" r="1.5" fill="currentColor" stroke="none" />
  </svg>
)
const IChat = () => (
  <svg width="15" height="15" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 13a2 2 0 0 1-2 2H6l-4 4V4a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v9z" />
  </svg>
)

const IBolt = () => (
  <svg width="15" height="15" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <path d="M11 2L4 11h7l-2 7 9-10h-7l2-6z" />
  </svg>
)
const IPlug = () => (
  <svg width="15" height="15" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <path d="M7 7v-4M13 7v-4M5 7h10v4a5 5 0 0 1-10 0V7z" /><path d="M10 15v2" />
  </svg>
)
const IPlus = () => (
  <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <path d="M10 4v12M4 10h12" />
  </svg>
)
const ISend = () => (
  <svg width="15" height="15" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 1L9.5 10.5M19 1L13 19l-3.5-8.5L1 7l18-6z" />
  </svg>
)
const IVoice = () => (
  <svg width="15" height="15" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
    <rect x="7" y="1" width="6" height="10" rx="3" /><path d="M3 10a7 7 0 0 0 14 0M10 17v2M7 19h6" />
  </svg>
)

const ICheck = () => (
  <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 8l3.5 3.5L13 4" />
  </svg>
)
const IClose = () => (
  <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <path d="M4 4l8 8M12 4l-8 8" />
  </svg>
)
const ISpin = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
    style={{ animation: 'spin 0.9s linear infinite' }}>
    <path d="M21 12a9 9 0 1 1-6.219-8.56" />
  </svg>
)

// ── Sidebar nav item ──────────────────────────────────────────────────────────

function NavItem({ icon, label, badge, active, onClick }: {
  icon: React.ReactNode
  label: string
  badge?: number
  active?: boolean
  onClick?: () => void
}) {
  const [hovered, setHovered] = useState(false)
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        width: '100%', display: 'flex', alignItems: 'center', gap: 10,
        padding: '7px 12px', borderRadius: 8, border: 'none', cursor: 'pointer',
        background: active || hovered ? 'var(--color-bg-tertiary)' : 'transparent',
        fontFamily: 'var(--font-sans)', fontSize: 13.5, fontWeight: active ? 500 : 400,
        color: active ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
        transition: 'background 0.12s, color 0.12s',
        textAlign: 'left',
      }}
    >
      <span style={{ flexShrink: 0, opacity: active ? 1 : 0.75 }}>{icon}</span>
      <span style={{ flex: 1 }}>{label}</span>
      {badge != null && badge > 0 && (
        <span style={{
          fontFamily: 'var(--font-sans)', fontSize: 10.5, fontWeight: 700,
          background: 'var(--color-primary)', color: 'white',
          borderRadius: 99, padding: '1px 6px', lineHeight: 1.5,
        }}>{badge}</span>
      )}
    </button>
  )
}

// ── Execution card ────────────────────────────────────────────────────────────

function ExecCard({ rec, onApprove, onDismiss }: {
  rec: Recommendation
  onApprove: (id: string) => void
  onDismiss: (id: string) => void
}) {
  const isPending = rec.status === 'pending' || rec.status === 'awaiting_confirmation'
  const isRunning = rec.status === 'approved' || rec.status === 'executing'
  const isDone = rec.status === 'completed'
  const isFailed = rec.status === 'failed'
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      transition={{ duration: 0.18 }}
      style={{
        background: 'var(--color-bg-primary)', border: '1px solid var(--color-border)',
        borderRadius: 10, padding: '12px 13px', display: 'flex', flexDirection: 'column', gap: 7,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontFamily: 'var(--font-sans)', fontSize: 10, fontWeight: 500, color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          {(rec.type ?? 'growth').replace(/_/g, ' ')}
        </span>
        {isDone && <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontFamily: 'var(--font-sans)', fontSize: 10, fontWeight: 500, color: '#16a34a', background: '#f0fdf4', borderRadius: 99, padding: '2px 7px' }}><ICheck /> Concluída</span>}
        {isFailed && <span style={{ fontFamily: 'var(--font-sans)', fontSize: 10, fontWeight: 500, color: '#dc2626', background: '#fef2f2', borderRadius: 99, padding: '2px 7px' }}>Falhou</span>}
        {isRunning && <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontFamily: 'var(--font-sans)', fontSize: 10, fontWeight: 500, color: 'var(--color-primary)' }}><ISpin /> Executando</span>}
      </div>
      <span style={{ fontFamily: 'var(--font-sans)', fontSize: 12.5, fontWeight: 500, color: 'var(--color-text-primary)', lineHeight: 1.45 }}>{rec.title}</span>
      {rec.impact_estimate && <span style={{ fontFamily: 'var(--font-sans)', fontSize: 11, color: 'var(--color-text-tertiary)', lineHeight: 1.4 }}>{rec.impact_estimate}</span>}
      {isPending && (
        <div style={{ display: 'flex', gap: 6, marginTop: 2 }}>
          <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }} onClick={() => onApprove(rec.id)}
            style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, fontFamily: 'var(--font-sans)', fontSize: 11.5, fontWeight: 500, padding: '5px 0', borderRadius: 7, border: 'none', cursor: 'pointer', background: 'var(--color-primary)', color: 'white' }}>
            <ICheck /> Aprovar
          </motion.button>
          <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }} onClick={() => onDismiss(rec.id)}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 30, height: 28, borderRadius: 7, cursor: 'pointer', background: 'transparent', color: 'var(--color-text-tertiary)', border: '1px solid var(--color-border)', flexShrink: 0 }}>
            <IClose />
          </motion.button>
        </div>
      )}
    </motion.div>
  )
}

// ── Executions drawer ─────────────────────────────────────────────────────────

function ExecDrawer({ recs, onApprove, onDismiss, onClose }: {
  recs: Recommendation[]
  onApprove: (id: string) => void
  onDismiss: (id: string) => void
  onClose: () => void
}) {
  const pending = recs.filter(r => r.status === 'pending' || r.status === 'awaiting_confirmation')
  const running = recs.filter(r => r.status === 'approved' || r.status === 'executing')
  const done = recs.filter(r => r.status === 'completed' || r.status === 'failed')
  return (
    <motion.div
      initial={{ x: 300, opacity: 0 }} animate={{ x: 0, opacity: 1 }}
      exit={{ x: 300, opacity: 0 }}
      transition={{ duration: 0.26, ease: [0.4, 0, 0.2, 1] }}
      style={{
        position: 'fixed', top: 0, right: 0, width: 300, height: '100vh',
        background: 'var(--color-bg-secondary)', borderLeft: '1px solid var(--color-border)',
        display: 'flex', flexDirection: 'column', overflow: 'hidden', zIndex: 300,
        boxShadow: '-4px 0 32px rgba(0,0,0,0.07)',
      }}
    >
      <div style={{ padding: '16px 16px 13px', borderBottom: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontFamily: 'var(--font-sans)', fontSize: 13.5, fontWeight: 600, color: 'var(--color-text-primary)' }}>Automações</span>
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={onClose}
          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--color-bg-tertiary)' }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'none' }}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 26, height: 26, borderRadius: 6, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-tertiary)', transition: 'background 0.12s' }}>
          <IClose />
        </motion.button>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 12px', scrollbarWidth: 'thin', display: 'flex', flexDirection: 'column', gap: 16 }}>
        {pending.length > 0 && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontFamily: 'var(--font-sans)', fontSize: 10.5, fontWeight: 600, color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Pendente</span>
              <span style={{ fontFamily: 'var(--font-sans)', fontSize: 10.5, fontWeight: 700, color: 'var(--color-primary)', background: 'rgba(255,89,0,0.08)', borderRadius: 99, padding: '1px 7px' }}>{pending.length}</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <AnimatePresence>{pending.map(r => <ExecCard key={r.id} rec={r} onApprove={onApprove} onDismiss={onDismiss} />)}</AnimatePresence>
            </div>
          </div>
        )}
        {running.length > 0 && (
          <div>
            <span style={{ display: 'block', marginBottom: 8, fontFamily: 'var(--font-sans)', fontSize: 10.5, fontWeight: 600, color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Executando</span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {running.map(r => <ExecCard key={r.id} rec={r} onApprove={onApprove} onDismiss={onDismiss} />)}
            </div>
          </div>
        )}
        {done.length > 0 && (
          <div>
            <span style={{ display: 'block', marginBottom: 8, fontFamily: 'var(--font-sans)', fontSize: 10.5, fontWeight: 600, color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Concluídas</span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {done.slice(0, 6).map(r => <ExecCard key={r.id} rec={r} onApprove={onApprove} onDismiss={onDismiss} />)}
            </div>
          </div>
        )}
        {recs.length === 0 && (
          <div style={{ paddingTop: 32, textAlign: 'center' }}>
            <span style={{ fontFamily: 'var(--font-sans)', fontSize: 12.5, color: 'var(--color-text-tertiary)', lineHeight: 1.6 }}>
              Nenhuma automação ainda.<br />Converse para identificar ações.
            </span>
          </div>
        )}
      </div>
    </motion.div>
  )
}

// ── Chat message ──────────────────────────────────────────────────────────────

const ERROR_MESSAGE = 'Desculpe, tive um problema ao processar sua pergunta.'

function ChatMessage({ msg }: { msg: Message }) {
  const isUser = msg.role === 'user'
  const isError = !isUser && msg.content === ERROR_MESSAGE
  return (
    <motion.div
      initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
      style={{ display: 'flex', gap: 12, justifyContent: isUser ? 'flex-end' : 'flex-start' }}
    >
      {!isUser && (
        <div style={{
          width: 28, height: 28, borderRadius: '50%', flexShrink: 0, marginTop: 1,
          background: isError ? 'var(--color-bg-tertiary)' : 'var(--color-primary)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <svg width="13" height="13" viewBox="0 0 20 20" fill="none">
            <circle cx="10" cy="10" r="3.5" fill={isError ? 'var(--color-text-tertiary)' : 'white'} />
            <circle cx="10" cy="10" r="6.5" stroke={isError ? 'var(--color-text-tertiary)' : 'white'} strokeWidth="1.2" />
          </svg>
        </div>
      )}
      <div style={{
        maxWidth: isUser ? '68%' : '80%',
        padding: isUser ? '9px 14px' : '5px 0',
        borderRadius: isUser ? '14px 14px 4px 14px' : 0,
        background: isUser ? 'var(--color-primary)' : 'transparent',
        fontFamily: 'var(--font-sans)',
        fontSize: isError ? 12 : 14,
        lineHeight: 1.65,
        color: isUser ? 'white' : isError ? 'var(--color-text-tertiary)' : 'var(--color-text-primary)',
        whiteSpace: 'pre-wrap', wordBreak: 'break-word',
      }}>
        {msg.content}
        {isError && (
          <span style={{ display: 'block', marginTop: 4, fontSize: 11, color: 'var(--color-text-tertiary)', opacity: 0.8 }}>
            Tente enviar novamente.
          </span>
        )}
      </div>
    </motion.div>
  )
}

// ── Typing dots ───────────────────────────────────────────────────────────────

function TypingDots() {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <div style={{ width: 28, height: 28, borderRadius: '50%', flexShrink: 0, background: 'var(--color-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <svg width="13" height="13" viewBox="0 0 20 20" fill="none"><circle cx="10" cy="10" r="3.5" fill="white" /><circle cx="10" cy="10" r="6.5" stroke="white" strokeWidth="1.2" /></svg>
      </div>
      <div style={{ display: 'flex', gap: 4 }}>
        {[0, 1, 2].map(i => (
          <motion.span key={i} animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }}
            style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--color-text-tertiary)', display: 'block' }} />
        ))}
      </div>
    </motion.div>
  )
}

// ── Chat input box ────────────────────────────────────────────────────────────

function ChatInput({ value, onChange, onSend, onKeyDown, inputRef, loading, model, onModelChange, onClear }: {
  value: string
  onChange: (v: string) => void
  onSend: () => void
  onKeyDown: (e: React.KeyboardEvent) => void
  inputRef: React.RefObject<HTMLTextAreaElement>
  loading: boolean
  model: AIModel
  onModelChange: (m: AIModel) => void
  onClear: () => void
}) {
  const canSend = value.trim() && !loading
  const [slashMenuOpen, setSlashMenuOpen] = useState(false)
  const [slashIndex, setSlashIndex] = useState(0)
  const [skillsPickerOpen, setSkillsPickerOpen] = useState(false)
  const [skills, setSkills] = useState<SkillItem[]>([])
  const [skillsLoading, setSkillsLoading] = useState(false)
  const [attachedSkill, setAttachedSkill] = useState<SkillItem | null>(null)
  const [modelMenuOpen, setModelMenuOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const currentModel = MODELS.find(m => m.id === model)!
  const slashFilter = value.startsWith('/') ? value.slice(1).toLowerCase() : ''
  const filteredCmds = SLASH_COMMANDS.filter(c =>
    c.label.toLowerCase().includes(slashFilter) || c.description.toLowerCase().includes(slashFilter)
  )

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setSlashMenuOpen(false); setSkillsPickerOpen(false); setModelMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleChange = (v: string) => {
    onChange(v)
    if (v.startsWith('/')) { setSlashMenuOpen(true); setSkillsPickerOpen(false); setModelMenuOpen(false); setSlashIndex(0) }
    else setSlashMenuOpen(false)
  }

  const selectCmd = async (cmd: SlashCmd) => {
    setSlashMenuOpen(false); onChange('')
    if (cmd.id === 'clear') { onClear() }
    else if (cmd.id === 'skills') {
      setSkillsLoading(true)
      try { const res = await skillsApi.list(); setSkills(res.data ?? []) } catch { setSkills([]) }
      finally { setSkillsLoading(false) }
      setSkillsPickerOpen(true)
    }
    setTimeout(() => inputRef.current?.focus(), 50)
  }

  const handleKey = (e: React.KeyboardEvent) => {
    if (slashMenuOpen) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setSlashIndex(i => Math.min(i + 1, filteredCmds.length - 1)); return }
      if (e.key === 'ArrowUp')   { e.preventDefault(); setSlashIndex(i => Math.max(i - 1, 0)); return }
      if (e.key === 'Enter')     { e.preventDefault(); if (filteredCmds[slashIndex]) selectCmd(filteredCmds[slashIndex]); return }
      if (e.key === 'Escape')    { setSlashMenuOpen(false); return }
      return
    }
    onKeyDown(e)
  }

  const menuStyle: React.CSSProperties = {
    position: 'absolute', bottom: 'calc(100% + 8px)', left: 0, right: 0,
    background: 'var(--color-bg-primary)', border: '1px solid var(--color-border)',
    borderRadius: 14, boxShadow: '0 4px 24px rgba(0,0,0,0.10)', overflow: 'hidden', zIndex: 600,
  }

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>

      {/* ── Slash menu ── */}
      <AnimatePresence>
        {slashMenuOpen && filteredCmds.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 6 }} transition={{ duration: 0.14 }} style={menuStyle}>
            <div style={{ padding: '5px 12px 4px', borderBottom: '1px solid var(--color-border)' }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--color-text-tertiary)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Comandos</span>
            </div>
            {filteredCmds.map((cmd, i) => (
              <button key={cmd.id} onMouseDown={e => { e.preventDefault(); selectCmd(cmd) }}
                onMouseEnter={() => setSlashIndex(i)}
                style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', background: i === slashIndex ? 'var(--color-bg-secondary)' : 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left', transition: 'background 0.1s' }}>
                <span style={{ fontSize: 14 }}>{cmd.icon}</span>
                <div>
                  <span style={{ fontFamily: 'var(--font-sans)', fontSize: 13, fontWeight: 500, color: 'var(--color-text-primary)', display: 'block' }}>{cmd.label}</span>
                  <span style={{ fontFamily: 'var(--font-sans)', fontSize: 11, color: 'var(--color-text-tertiary)' }}>{cmd.description}</span>
                </div>
              </button>
            ))}
            <div style={{ padding: '3px 12px 6px' }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--color-text-tertiary)' }}>↑↓ navegar · Enter selecionar · Esc fechar</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Skills picker ── */}
      <AnimatePresence>
        {skillsPickerOpen && (
          <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 6 }} transition={{ duration: 0.14 }}
            style={{ ...menuStyle, maxHeight: 240, overflowY: 'auto' }}>
            <div style={{ padding: '5px 12px 4px', borderBottom: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, background: 'var(--color-bg-primary)' }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--color-text-tertiary)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Skills disponíveis</span>
              <button onMouseDown={e => { e.preventDefault(); setSkillsPickerOpen(false) }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-tertiary)', display: 'flex', alignItems: 'center', padding: 2 }}>
                <svg width="10" height="10" viewBox="0 0 14 14" fill="none"><line x1="1" y1="1" x2="13" y2="13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/><line x1="13" y1="1" x2="1" y2="13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
              </button>
            </div>
            {skillsLoading
              ? <div style={{ padding: 16, textAlign: 'center', fontFamily: 'var(--font-sans)', fontSize: 13, color: 'var(--color-text-tertiary)' }}>Carregando...</div>
              : skills.length === 0
              ? <div style={{ padding: 16, textAlign: 'center', fontFamily: 'var(--font-sans)', fontSize: 13, color: 'var(--color-text-tertiary)' }}>Nenhuma skill disponível</div>
              : skills.map(skill => (
                <button key={skill.id}
                  onMouseDown={e => { e.preventDefault(); setAttachedSkill(skill); setSkillsPickerOpen(false); setTimeout(() => inputRef.current?.focus(), 50) }}
                  onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--color-bg-secondary)' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = attachedSkill?.id === skill.id ? 'var(--color-bg-secondary)' : 'transparent' }}
                  style={{ width: '100%', display: 'flex', alignItems: 'flex-start', gap: 10, padding: '9px 12px', background: attachedSkill?.id === skill.id ? 'var(--color-bg-secondary)' : 'transparent', border: 'none', borderBottom: '1px solid var(--color-border)', cursor: 'pointer', textAlign: 'left', transition: 'background 0.1s' }}>
                  <span style={{ fontSize: 13, marginTop: 1 }}>⚡</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontFamily: 'var(--font-sans)', fontSize: 13, fontWeight: 500, color: 'var(--color-text-primary)' }}>{skill.name}</span>
                      {skill.is_global && <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, background: 'var(--color-bg-tertiary)', color: 'var(--color-text-tertiary)', border: '1px solid var(--color-border)', borderRadius: 4, padding: '1px 5px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Global</span>}
                    </div>
                    {skill.description && <span style={{ fontFamily: 'var(--font-sans)', fontSize: 11, color: 'var(--color-text-tertiary)', display: 'block', marginTop: 1 }}>{skill.description}</span>}
                  </div>
                </button>
              ))
            }
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Model dropdown ── */}
      <AnimatePresence>
        {modelMenuOpen && (
          <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 6 }} transition={{ duration: 0.14 }}
            style={{ ...menuStyle, right: 'auto', width: 220 }}>
            <div style={{ padding: '5px 12px 4px', borderBottom: '1px solid var(--color-border)' }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--color-text-tertiary)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Modelo</span>
            </div>
            {MODELS.map(m => (
              <button key={m.id} onMouseDown={e => { e.preventDefault(); onModelChange(m.id); setModelMenuOpen(false) }}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--color-bg-secondary)' }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = model === m.id ? 'var(--color-bg-secondary)' : 'transparent' }}
                style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', background: model === m.id ? 'var(--color-bg-secondary)' : 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left', transition: 'background 0.1s' }}>
                <span style={{ fontSize: 13 }}>{m.icon}</span>
                <div style={{ flex: 1 }}>
                  <span style={{ fontFamily: 'var(--font-sans)', fontSize: 13, fontWeight: 500, color: 'var(--color-text-primary)', display: 'block' }}>{m.label}</span>
                  <span style={{ fontFamily: 'var(--font-sans)', fontSize: 11, color: 'var(--color-text-tertiary)' }}>{m.description}</span>
                </div>
                {model === m.id && <span style={{ color: 'var(--color-primary)', fontSize: 12, fontWeight: 700 }}>✓</span>}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Attached skill badge ── */}
      <AnimatePresence>
        {attachedSkill && (
          <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 4 }}
            style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
            <span style={{ fontFamily: 'var(--font-sans)', fontSize: 11, color: 'var(--color-text-tertiary)' }}>Skill ativa:</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)', borderRadius: 8, padding: '2px 8px' }}>
              <span style={{ fontSize: 11 }}>⚡</span>
              <span style={{ fontFamily: 'var(--font-sans)', fontSize: 12, fontWeight: 500, color: 'var(--color-text-primary)' }}>{attachedSkill.name}</span>
              <button onClick={() => setAttachedSkill(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-tertiary)', padding: 0, display: 'flex', alignItems: 'center', marginLeft: 2 }}>
                <svg width="9" height="9" viewBox="0 0 14 14" fill="none"><line x1="1" y1="1" x2="13" y2="13" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/><line x1="13" y1="1" x2="1" y2="13" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Input box ── */}
      <div style={{ background: 'var(--color-bg-primary)', border: '1px solid var(--color-border)', borderRadius: 16, boxShadow: '0 2px 20px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', padding: '12px 14px 10px' }}>
          <textarea
            ref={inputRef}
            value={value}
            onChange={e => handleChange(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Pergunte sobre seus dados ou use / para comandos..."
            rows={1}
            style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', fontFamily: 'var(--font-sans)', fontSize: 14, color: 'var(--color-text-primary)', resize: 'none', lineHeight: 1.55, maxHeight: 140, padding: 0 }}
          />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', padding: '6px 10px 10px', gap: 6 }}>
          {/* Model button */}
          <motion.button whileTap={{ scale: 0.95 }}
            onMouseDown={e => { e.preventDefault(); setModelMenuOpen(v => !v); setSlashMenuOpen(false); setSkillsPickerOpen(false) }}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontFamily: 'var(--font-sans)', fontSize: 11.5, fontWeight: 500, color: 'var(--color-text-tertiary)', padding: '3px 9px', borderRadius: 99, border: '1px solid var(--color-border)', background: 'none', cursor: 'pointer' }}>
            <span>{currentModel.icon}</span>
            {currentModel.label}
            <svg width="8" height="8" viewBox="0 0 10 10" fill="none"><path d="M2 3.5l3 3 3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
          </motion.button>
          <div style={{ flex: 1 }} />
          {/* Voice */}
          <motion.button whileTap={{ scale: 0.95 }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--color-bg-secondary)' }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'none' }}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 30, height: 30, borderRadius: 8, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-tertiary)', transition: 'background 0.12s' }}>
            <IVoice />
          </motion.button>
          {/* Send */}
          <motion.button whileHover={{ scale: canSend ? 1.05 : 1 }} whileTap={{ scale: canSend ? 0.93 : 1 }} onClick={onSend} disabled={!canSend}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32, borderRadius: 10, border: 'none', cursor: canSend ? 'pointer' : 'default', background: canSend ? 'var(--color-primary)' : 'var(--color-bg-tertiary)', color: canSend ? 'white' : 'var(--color-text-tertiary)', transition: 'background 0.15s, color 0.15s', flexShrink: 0 }}>
            <ISend />
          </motion.button>
        </div>
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

const CHIPS = ['Análise de canais', 'Estratégias', 'Do Meta Ads', 'Do Google Ads', 'Do Stripe']

export default function Growth() {
  const [messages, setMessages] = useState<Message[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [input, setInput] = useState('')
  const [recommendations, setRecommendations] = useState<Recommendation[]>([])
  const [history, setHistory] = useState<ConvItem[]>([])
  const [execOpen, setExecOpen] = useState(false)
  const [activeView, setActiveView] = useState<ActiveView>('chat')
  const [model, setModel] = useState<AIModel>('sonnet')
  const [userName, setUserName] = useState('Francisco')
  const [userInitial, setUserInitial] = useState('F')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || isLoading) return
    const userMsg: Message = { id: Date.now().toString(), role: 'user', content: text }
    setMessages(prev => [...prev, userMsg])
    setIsLoading(true)
    try {
      const res = await aiApi.growthChat(text)
      const content: string = res.data?.content ?? res.data?.message ?? 'Sem resposta.'
      setMessages(prev => [...prev, { id: (Date.now() + 1).toString(), role: 'assistant', content }])
    } catch {
      setMessages(prev => [...prev, { id: (Date.now() + 1).toString(), role: 'assistant', content: ERROR_MESSAGE }])
    } finally {
      setIsLoading(false)
    }
  }, [isLoading])

  // Load recommendations
  useEffect(() => {
    growthApi.listRecommendations().then(res => setRecommendations(res.data ?? [])).catch(() => {})
  }, [])

  // Load user info + history
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      const name = user.user_metadata?.full_name ?? user.email?.split('@')[0] ?? 'Você'
      setUserName(name)
      setUserInitial(name[0]?.toUpperCase() ?? 'U')
      supabase
        .from('ai_chat_history')
        .select('id, content, created_at')
        .eq('user_id', user.id)
        .eq('mode', 'growth')
        .eq('role', 'user')
        .order('created_at', { ascending: false })
        .limit(30)
        .then(({ data }) => {
          const items = (data ?? []).map(row => ({
            id: row.id as string,
            title: (row.content as string)?.slice(0, 50) ?? null,
            updated_at: row.created_at as string,
          }))
          setHistory(items)
        })
    })
  }, [messages.length])

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isLoading])

  // Auto-resize textarea — also fires when hasMessages flips (layout shift)
  useEffect(() => {
    const el = inputRef.current
    if (!el) return
    el.style.height = '0px'
    el.style.height = Math.min(Math.max(el.scrollHeight, 22), 140) + 'px'
  }, [input, messages.length])

  const handleSend = useCallback(async () => {
    if (!input.trim() || isLoading) return
    const text = input.trim()
    setInput('')
    await sendMessage(text)
    setTimeout(() => inputRef.current?.focus(), 50)
  }, [input, isLoading, sendMessage, inputRef])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
  }

  const handleNewChat = () => {
    setMessages([])
    setInput('')
    aiApi.clearHistory('growth').catch(() => {})
  }

  const handleApprove = async (id: string) => {
    setRecommendations(prev => prev.map(r => r.id === id ? { ...r, status: 'executing' as RecStatus } : r))
    try { await growthApi.approve(id) } catch { setRecommendations(prev => prev.map(r => r.id === id ? { ...r, status: 'failed' as RecStatus } : r)) }
  }
  const handleDismiss = async (id: string) => {
    setRecommendations(prev => prev.filter(r => r.id !== id))
    try { await growthApi.dismiss(id) } catch { /* ok */ }
  }

  const pendingCount = recommendations.filter(r => r.status === 'pending' || r.status === 'awaiting_confirmation').length
  const hasMessages = messages.length > 0

  // Group history
  const todayStr = new Date().toDateString()
  const yesterdayStr = new Date(Date.now() - 86400000).toDateString()
  const histToday = history.filter(c => new Date(c.updated_at).toDateString() === todayStr)
  const histYesterday = history.filter(c => new Date(c.updated_at).toDateString() === yesterdayStr)
  const histOlder = history.filter(c => {
    const d = new Date(c.updated_at).toDateString()
    return d !== todayStr && d !== yesterdayStr
  })

  const histGroups = [
    { label: 'Hoje', items: histToday },
    { label: 'Ontem', items: histYesterday },
    { label: 'Anteriores', items: histOlder },
  ].filter(g => g.items.length > 0)

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: 'var(--color-bg)' }}>

      {/* ══════════════════════════════════════════════════════
          SIDEBAR
      ══════════════════════════════════════════════════════ */}
      <div style={{
        width: 280, flexShrink: 0, height: '100vh',
        display: 'flex', flexDirection: 'column',
        background: 'var(--color-bg-secondary)',
        borderRight: '1px solid var(--color-border)',
        overflow: 'hidden',
      }}>
        {/* Top: Nova conversa */}
        <div style={{ padding: '14px 12px 10px' }}>
          <motion.button
            whileTap={{ scale: 0.98 }}
            onClick={handleNewChat}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--color-bg-tertiary)' }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--color-bg-primary)' }}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              fontFamily: 'var(--font-sans)', fontSize: 13.5, fontWeight: 500,
              color: 'var(--color-text-primary)',
              padding: '8px 14px', borderRadius: 10,
              background: 'var(--color-bg-primary)',
              border: '1px solid var(--color-border)',
              cursor: 'pointer', transition: 'background 0.15s',
            }}
          >
            <IPlus /> Nova conversa
          </motion.button>
        </div>

        {/* Utility nav */}
        <div style={{ padding: '0 8px 6px' }}>
          <NavItem icon={<ISearch />} label="Procurar" onClick={() => {}} />
          <NavItem icon={<ISliders />} label="Personalizar" active={activeView === 'contexto'} onClick={() => setActiveView(v => v === 'contexto' ? 'chat' : 'contexto')} />
        </div>

        <div style={{ height: 1, background: 'var(--color-border)', margin: '0 12px 6px' }} />

        {/* Section: Navegação */}
        <div style={{ padding: '0 8px' }}>
          <span style={{ display: 'block', padding: '4px 12px 4px', fontFamily: 'var(--font-sans)', fontSize: 10.5, fontWeight: 600, color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Navegação
          </span>
          <NavItem icon={<IChat />} label="Conversas" active={activeView === 'history'} onClick={() => setActiveView(v => v === 'history' ? 'chat' : 'history')} />
          <NavItem icon={<IBolt />} label="Automações" badge={pendingCount} active={execOpen} onClick={() => { setExecOpen(o => !o) }} />
          <NavItem icon={<IPlug />} label="Integrações" onClick={() => window.dispatchEvent(new CustomEvent('northie:navigate', { detail: 'app-store' }))} />
        </div>

        <div style={{ height: 1, background: 'var(--color-border)', margin: '6px 12px' }} />

        {/* Section: Recentes */}
        <div style={{ flex: 1, overflowY: 'auto', scrollbarWidth: 'thin', padding: '0 8px' }}>
          <span style={{ display: 'block', padding: '2px 12px 4px', fontFamily: 'var(--font-sans)', fontSize: 10.5, fontWeight: 600, color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Recentes
          </span>

          {histGroups.length === 0 && (
            <div style={{ padding: '10px 12px' }}>
              <span style={{ fontFamily: 'var(--font-sans)', fontSize: 12, color: 'var(--color-text-tertiary)' }}>
                Nenhuma conversa ainda
              </span>
            </div>
          )}

          {histGroups.map(group => (
            <div key={group.label} style={{ marginBottom: 8 }}>
              {histGroups.length > 1 && (
                <span style={{ display: 'block', padding: '3px 12px 2px', fontFamily: 'var(--font-sans)', fontSize: 10, fontWeight: 500, color: 'var(--color-text-tertiary)', opacity: 0.7 }}>
                  {group.label}
                </span>
              )}
              {group.items.map(conv => (
                <button
                  key={conv.id}
                  onClick={() => setActiveView('chat')}
                  onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--color-bg-tertiary)' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent' }}
                  style={{
                    width: '100%', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 8,
                    padding: '6px 12px', borderRadius: 8, border: 'none', cursor: 'pointer',
                    background: 'transparent',
                    fontFamily: 'var(--font-sans)', fontSize: 13,
                    color: 'var(--color-text-secondary)',
                    transition: 'background 0.12s', overflow: 'hidden',
                  }}
                >
                  <IChat />
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                    {conv.title ?? 'Nova conversa'}
                  </span>
                </button>
              ))}
            </div>
          ))}
        </div>

        {/* Footer: user */}
        <div style={{
          flexShrink: 0, borderTop: '1px solid var(--color-border)',
          padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <div style={{
            width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
            background: 'var(--color-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: 'var(--font-sans)', fontSize: 13, fontWeight: 600, color: 'white',
          }}>
            {userInitial}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: 'var(--font-sans)', fontSize: 13, fontWeight: 500, color: 'var(--color-text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {userName}
            </div>
            <div style={{ fontFamily: 'var(--font-sans)', fontSize: 11, color: 'var(--color-text-tertiary)', marginTop: 1 }}>
              Northie Pro
            </div>
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════
          MAIN AREA
      ══════════════════════════════════════════════════════ */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden', minWidth: 0 }}>

        {/* ── VIEW: Contexto (Personalizar) ── */}
        <AnimatePresence mode="wait">
          {activeView === 'contexto' && (
            <motion.div key="contexto"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              style={{ flex: 1, overflowY: 'auto', scrollbarWidth: 'thin', padding: '0 56px' }}
            >
              <div style={{ maxWidth: 1100, margin: '0 auto' }}>
                <Suspense fallback={
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', paddingTop: 80 }}>
                    <motion.div animate={{ opacity: [0.3, 0.7, 0.3] }} transition={{ duration: 1.4, repeat: Infinity }}
                      style={{ width: 24, height: 24, borderRadius: '50%', background: 'var(--color-primary)', opacity: 0.4 }} />
                  </div>
                }>
                  <ContextoPage onToggleChat={() => {}} />
                </Suspense>
              </div>
            </motion.div>
          )}

          {/* ── VIEW: Histórico de conversas ── */}
          {activeView === 'history' && (
            <motion.div key="history"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              style={{ flex: 1, overflowY: 'auto', scrollbarWidth: 'thin', padding: '40px 48px' }}
            >
              <div style={{ maxWidth: 680, margin: '0 auto' }}>
                <h2 style={{ fontFamily: 'var(--font-sans)', fontWeight: 500, fontSize: 22, letterSpacing: '-0.5px', color: 'var(--color-text-primary)', margin: '0 0 28px' }}>
                  Conversas
                </h2>
                {history.length === 0 ? (
                  <p style={{ fontFamily: 'var(--font-sans)', fontSize: 13.5, color: 'var(--color-text-tertiary)' }}>
                    Nenhuma conversa encontrada.
                  </p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {history.map(conv => (
                      <button
                        key={conv.id}
                        onClick={() => setActiveView('chat')}
                        onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--color-bg-secondary)'}
                        onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
                        style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                          padding: '12px 16px', borderRadius: 10,
                          background: 'transparent', border: '1px solid var(--color-border)',
                          cursor: 'pointer', transition: 'background 0.12s', textAlign: 'left',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                          <IChat />
                          <span style={{ fontFamily: 'var(--font-sans)', fontSize: 13.5, color: 'var(--color-text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {conv.title ?? 'Nova conversa'}
                          </span>
                        </div>
                        <span style={{ fontFamily: 'var(--font-sans)', fontSize: 11.5, color: 'var(--color-text-tertiary)', flexShrink: 0, marginLeft: 16 }}>
                          {new Date(conv.updated_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* ── VIEW: Chat ── */}
          {activeView === 'chat' && (
            <motion.div key="chat"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
            >
              {/* Empty state */}
              {!hasMessages && (
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '0 32px 80px' }}>
                  <motion.h1
                    initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.35, ease: [0.25, 0.1, 0.25, 1] }}
                    style={{ fontFamily: 'var(--font-sans)', fontWeight: 500, fontSize: 34, letterSpacing: '-0.8px', color: 'var(--color-text-primary)', margin: '0 0 32px', textAlign: 'center' }}
                  >
                    {greeting(userName)}
                  </motion.h1>
                  <motion.div
                    initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.35, delay: 0.06, ease: [0.25, 0.1, 0.25, 1] }}
                    style={{ width: '100%', maxWidth: 680 }}
                  >
                    <ChatInput value={input} onChange={setInput} onSend={handleSend} onKeyDown={handleKeyDown} inputRef={inputRef} loading={isLoading} model={model} onModelChange={setModel} onClear={handleNewChat} />
                  </motion.div>
                  <motion.div
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                    transition={{ duration: 0.3, delay: 0.14 }}
                    style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 14, justifyContent: 'center', maxWidth: 680 }}
                  >
                    {CHIPS.map(chip => (
                      <motion.button key={chip} whileTap={{ scale: 0.97 }}
                        onClick={() => { setInput(chip); inputRef.current?.focus() }}
                        onMouseEnter={e => { const el = e.currentTarget as HTMLButtonElement; el.style.background = 'var(--color-bg-tertiary)'; el.style.borderColor = 'var(--color-text-tertiary)' }}
                        onMouseLeave={e => { const el = e.currentTarget as HTMLButtonElement; el.style.background = 'var(--color-bg-secondary)'; el.style.borderColor = 'var(--color-border)' }}
                        style={{ fontFamily: 'var(--font-sans)', fontSize: 12.5, color: 'var(--color-text-secondary)', padding: '6px 14px', borderRadius: 99, background: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)', cursor: 'pointer', transition: 'background 0.15s, border-color 0.15s', whiteSpace: 'nowrap' }}
                      >
                        {chip}
                      </motion.button>
                    ))}
                  </motion.div>
                </div>
              )}

              {/* Messages */}
              {hasMessages && (
                <>
                  <div style={{ flex: 1, overflowY: 'auto', scrollbarWidth: 'thin' }}>
                    <div style={{ maxWidth: 680, width: '100%', margin: '0 auto', padding: '40px 28px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
                      {messages.map(msg => <ChatMessage key={msg.id} msg={msg} />)}
                      <AnimatePresence>{isLoading && <TypingDots />}</AnimatePresence>
                      <div ref={messagesEndRef} />
                    </div>
                  </div>
                  <div style={{ flexShrink: 0, padding: '10px 32px 22px' }}>
                    <div style={{ maxWidth: 680, margin: '0 auto' }}>
                      <ChatInput value={input} onChange={setInput} onSend={handleSend} onKeyDown={handleKeyDown} inputRef={inputRef} loading={isLoading} model={model} onModelChange={setModel} onClear={handleNewChat} />
                      <p style={{ fontFamily: 'var(--font-sans)', fontSize: 10.5, color: 'var(--color-text-tertiary)', textAlign: 'center', marginTop: 8, marginBottom: 0 }}>
                        A Northie recomenda — você decide. Nenhuma ação é executada sem aprovação.
                      </p>
                    </div>
                  </div>
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ══════════════════════════════════════════════════════
          EXECUTIONS DRAWER (fixed overlay from right)
      ══════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {execOpen && (
          <ExecDrawer
            recs={recommendations}
            onApprove={handleApprove}
            onDismiss={handleDismiss}
            onClose={() => setExecOpen(false)}
          />
        )}
      </AnimatePresence>

    </div>
  )
}
