import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Brain, AlertTriangle, TrendingUp, GitBranch, HeartPulse,
  BarChart2, Target, Users, Layers,
  Gem, DollarSign, Zap, PieChart,
  AlertCircle, Grid3X3, CalendarDays, RefreshCw,
  ShoppingCart, Mail, Kanban,
  MessageCircle, Star, BookOpen,
  LineChart,
} from 'lucide-react'
import type { LucideProps } from 'lucide-react'
import AgentSelector from './AgentSelector'
import { useAgentChat } from '../../hooks/useAgentChat'
import { supabase } from '../../lib/supabase'
import { skillsApi } from '../../lib/api'
import { AGENT_BY_ID } from '../../constants/agentDefinitions'

// ── Local types ───────────────────────────────────────────────────────────────

type AIModel = 'haiku' | 'sonnet' | 'opus'
interface ModelDef { id: AIModel; label: string; description: string; icon: string }
const MODELS: ModelDef[] = [
  { id: 'haiku',  label: 'Haiku',  description: 'Rápido — perguntas simples', icon: '⚡' },
  { id: 'sonnet', label: 'Sonnet', description: 'Equilibrado — uso geral',    icon: '◆' },
  { id: 'opus',   label: 'Opus',   description: 'Análise profunda',           icon: '◈' },
]

interface SlashCommand { id: string; icon: string; label: string; description: string }
const SLASH_COMMANDS: SlashCommand[] = [
  { id: 'skills', icon: '⚡', label: 'Skills',          description: 'Use uma skill especializada' },
  { id: 'clear',  icon: '↺',  label: 'Limpar conversa', description: 'Inicia uma nova conversa'    },
]
interface SkillItem { id: string; name: string; description?: string; is_global: boolean }

interface ConvItem {
  id: string
  agent_id: string
  title: string | null
  updated_at: string
}

// ── Constants ─────────────────────────────────────────────────────────────────

type LucideIcon = React.ComponentType<LucideProps>

const AGENT_ICONS: Record<string, LucideIcon> = {
  orchestrator: Brain,
  anomalies:    AlertTriangle,
  forecast:     TrendingUp,
  correlations: GitBranch,
  health:       HeartPulse,
  roas:         BarChart2,
  cac:          Target,
  audience:     Users,
  creatives:    Layers,
  ltv:          Gem,
  mrr:          DollarSign,
  upsell:       Zap,
  margin:       PieChart,
  churn:        AlertCircle,
  rfm:          Grid3X3,
  cohort:       CalendarDays,
  reactivation: RefreshCw,
  ecommerce:    ShoppingCart,
  email:        Mail,
  pipeline:     Kanban,
  whatsapp:     MessageCircle,
  nps:          Star,
  engagement:   BookOpen,
  valuation:    LineChart,
}

const PINNED_AGENTS = [
  { id: 'orchestrator', name: 'Northie Growth' },
  { id: 'anomalies',    name: 'Anomalias' },
  { id: 'churn',        name: 'Churn' },
  { id: 'forecast',     name: 'Forecast' },
]

const GROWTH_CHIPS = ['Analisar canais de aquisição', 'Quais clientes estão em risco?', 'Qual campanha tem melhor LTV?']

const getAgentLabel = (id: string) => AGENT_BY_ID[id]?.name ?? 'Northie AI'
const getAgentChips = (id: string) => AGENT_BY_ID[id]?.quickSuggestions ?? GROWTH_CHIPS
const getAgentSources = (id: string) => AGENT_BY_ID[id]?.sources.slice(0, 3).join(' · ') ?? ''
const getAgentIcon = (id: string): LucideIcon => AGENT_ICONS[id] ?? Brain

// ── Local components ──────────────────────────────────────────────────────────

function TypewriterText({ text, onDone }: { text: string; onDone: () => void }) {
  const [count, setCount] = useState(0)
  const onDoneRef = useRef(onDone)
  onDoneRef.current = onDone
  useEffect(() => { setCount(0) }, [text])
  useEffect(() => {
    if (count >= text.length) { onDoneRef.current(); return }
    const t = setTimeout(() => setCount(c => c + 1), 7)
    return () => clearTimeout(t)
  }, [count, text])
  return <>{text.slice(0, count)}</>
}

function ThinkingIndicator() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', padding: '0 var(--space-4)' }}
    >
      <div style={{ display: 'flex', gap: 4 }}>
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            animate={{ opacity: [0.3, 1, 0.3], scale: [1, 1.1, 1] }}
            transition={{ duration: 1, repeat: Infinity, delay: i * 0.18 }}
            style={{ width: 5, height: 5, borderRadius: 'var(--radius-full)', background: 'var(--color-primary)' }}
          />
        ))}
      </div>
      <span style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', color: 'var(--color-text-tertiary)' }}>
        Processando...
      </span>
    </motion.div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function GrowthChat() {
  const { messages, isLoading, agentId, conversationId, sendMessage, startConversation, loadConversation, reset } = useAgentChat()
  const [input, setInput] = useState('')
  const [model, setModel] = useState<AIModel>('sonnet')
  const [animatingId, setAnimatingId] = useState<string | null>(null)
  const [hoveredMsg, setHoveredMsg] = useState<string | null>(null)
  const [copied, setCopied] = useState<string | null>(null)
  const [atBottom, setAtBottom] = useState(true)
  const [convList, setConvList] = useState<ConvItem[]>([])
  const [showHome, setShowHome] = useState(true)

  // Slash & skills
  const [slashMenuOpen, setSlashMenuOpen] = useState(false)
  const [slashIndex, setSlashIndex] = useState(0)
  const [skillsPickerOpen, setSkillsPickerOpen] = useState(false)
  const [skills, setSkills] = useState<SkillItem[]>([])
  const [skillsLoading, setSkillsLoading] = useState(false)
  const [attachedSkill, setAttachedSkill] = useState<SkillItem | null>(null)
  const [modelMenuOpen, setModelMenuOpen] = useState(false)
  const inputContainerRef = useRef<HTMLDivElement>(null)

  const scrollRef = useRef<HTMLDivElement>(null)
  const emptyTextareaRef = useRef<HTMLTextAreaElement>(null)
  const activeTextareaRef = useRef<HTMLTextAreaElement>(null)
  const pendingMsgRef = useRef<string | null>(null)
  const hasMessages = messages.length > 0

  // Track last assistant message for typewriter
  const prevMessagesLen = useRef(0)
  useEffect(() => {
    const last = messages[messages.length - 1]
    if (last && last.role === 'assistant' && messages.length > prevMessagesLen.current) {
      setAnimatingId(last.id)
    }
    prevMessagesLen.current = messages.length
  }, [messages])

  useEffect(() => {
    if (atBottom && scrollRef.current) {
      scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
    }
  }, [messages, isLoading])

  // Send pending initial message once conversation is ready
  useEffect(() => {
    if (agentId && conversationId && pendingMsgRef.current) {
      const msg = pendingMsgRef.current
      pendingMsgRef.current = null
      sendMessage(msg)
    }
  }, [agentId, conversationId, sendMessage])

  // Load conversation list
  useEffect(() => {
    const loadConvs = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase
        .from('agent_conversations')
        .select('id, agent_id, title, updated_at')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false })
        .limit(20)
      if (data) setConvList(data)
    }
    loadConvs()
  }, [conversationId])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (inputContainerRef.current && !inputContainerRef.current.contains(e.target as Node)) {
        setSlashMenuOpen(false)
        setSkillsPickerOpen(false)
        setModelMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const fetchSkills = useCallback(async () => {
    setSkillsLoading(true)
    try {
      const res = await skillsApi.list()
      setSkills(res.data ?? [])
    } catch { setSkills([]) }
    finally { setSkillsLoading(false) }
  }, [])

  const handleInputChange = (value: string, ref: React.RefObject<HTMLTextAreaElement>) => {
    setInput(value)
    resizeTextarea(ref.current)
    if (value.startsWith('/')) {
      setSlashMenuOpen(true)
      setSkillsPickerOpen(false)
      setModelMenuOpen(false)
      setSlashIndex(0)
    } else {
      setSlashMenuOpen(false)
    }
  }

  const selectSlashCommand = async (cmd: SlashCommand) => {
    setSlashMenuOpen(false)
    setInput('')
    if (cmd.id === 'clear') {
      handleNewConversation()
    } else if (cmd.id === 'skills') {
      await fetchSkills()
      setSkillsPickerOpen(true)
    }
  }

  const handleScroll = () => {
    if (!scrollRef.current) return
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current
    setAtBottom(scrollHeight - scrollTop - clientHeight < 40)
  }

  const resizeTextarea = (el: HTMLTextAreaElement | null) => {
    if (!el) return
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 180) + 'px'
  }

  const handleSend = async (text?: string) => {
    const txt = text || input
    if (!txt.trim() || isLoading) return
    if (!text) setInput('')
    if (emptyTextareaRef.current) emptyTextareaRef.current.style.height = 'auto'
    if (activeTextareaRef.current) activeTextareaRef.current.style.height = 'auto'
    setAtBottom(true)
    await sendMessage(txt)
  }

  const handleSelectAgent = async (selectedAgentId: string, initialMsg?: string) => {
    if (initialMsg) pendingMsgRef.current = initialMsg
    await startConversation(selectedAgentId)
    setShowHome(false)
  }

  const handleBack = () => {
    setShowHome(true)
  }

  const handleNewConversation = () => {
    reset()
    setInput('')
    setAnimatingId(null)
    pendingMsgRef.current = null
    setShowHome(true)
  }

  const handleLoadConversation = (convId: string) => {
    loadConversation(convId)
    setShowHome(false)
  }

  const handleCopy = (id: string, content: string) => {
    navigator.clipboard.writeText(content)
    setCopied(id)
    setTimeout(() => setCopied(null), 2000)
  }

  const activeChips = agentId ? getAgentChips(agentId) : GROWTH_CHIPS
  const activeLabel = agentId ? getAgentLabel(agentId) : 'Northie AI'
  const ActiveIcon = agentId ? getAgentIcon(agentId) : Brain
  const activeSources = agentId ? getAgentSources(agentId) : ''

  const slashFilter = input.startsWith('/') ? input.slice(1).toLowerCase() : ''
  const filteredSlashCommands = SLASH_COMMANDS.filter(cmd =>
    cmd.label.toLowerCase().includes(slashFilter) || cmd.description.toLowerCase().includes(slashFilter)
  )
  const currentModel = MODELS.find(m => m.id === model)!

  // ── Shared input toolbar renderer ─────────────────────────────────────────

  const renderInputBox = (ref: React.RefObject<HTMLTextAreaElement>, placeholder: string) => (
    <div ref={inputContainerRef} style={{ position: 'relative' }}>

      {/* ── Slash command menu ── */}
      <AnimatePresence>
        {slashMenuOpen && filteredSlashCommands.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 6 }}
            transition={{ duration: 0.15 }}
            style={{ position: 'absolute', bottom: 'calc(100% + 8px)', left: 0, right: 0, background: 'var(--color-bg-primary)', border: '1px solid var(--color-border)', borderRadius: 14, boxShadow: 'var(--shadow-lg)', overflow: 'hidden', zIndex: 500 }}>
            <div style={{ padding: '6px 12px 4px', borderBottom: '1px solid var(--color-border)' }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--color-text-tertiary)', letterSpacing: '0.05em', textTransform: 'uppercase' as const }}>Comandos</span>
            </div>
            {filteredSlashCommands.map((cmd, i) => (
              <button key={cmd.id}
                onMouseDown={e => { e.preventDefault(); selectSlashCommand(cmd) }}
                style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', background: i === slashIndex ? 'var(--color-bg-secondary)' : 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left' as const, transition: 'background 0.12s' }}
                onMouseEnter={() => setSlashIndex(i)}>
                <span style={{ fontSize: 14, flexShrink: 0 }}>{cmd.icon}</span>
                <div>
                  <span style={{ fontFamily: 'var(--font-sans)', fontSize: 13, fontWeight: 500, color: 'var(--color-text-primary)', display: 'block' }}>{cmd.label}</span>
                  <span style={{ fontFamily: 'var(--font-sans)', fontSize: 11, color: 'var(--color-text-tertiary)' }}>{cmd.description}</span>
                </div>
              </button>
            ))}
            <div style={{ padding: '4px 12px 6px' }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--color-text-tertiary)' }}>↑↓ navegar · Enter selecionar · Esc fechar</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Skills picker ── */}
      <AnimatePresence>
        {skillsPickerOpen && (
          <motion.div
            initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 6 }}
            transition={{ duration: 0.15 }}
            style={{ position: 'absolute', bottom: 'calc(100% + 8px)', left: 0, right: 0, background: 'var(--color-bg-primary)', border: '1px solid var(--color-border)', borderRadius: 14, boxShadow: 'var(--shadow-lg)', overflow: 'hidden', zIndex: 500, maxHeight: 240, overflowY: 'auto' as const }}>
            <div style={{ padding: '6px 12px 4px', borderBottom: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky' as const, top: 0, background: 'var(--color-bg-primary)' }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--color-text-tertiary)', letterSpacing: '0.05em', textTransform: 'uppercase' as const }}>Skills disponíveis</span>
              <button onMouseDown={e => { e.preventDefault(); setSkillsPickerOpen(false) }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-tertiary)', padding: 2, display: 'flex', alignItems: 'center' }}>
                <svg width="10" height="10" viewBox="0 0 14 14" fill="none"><line x1="1" y1="1" x2="13" y2="13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/><line x1="13" y1="1" x2="1" y2="13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
              </button>
            </div>
            {skillsLoading ? (
              <div style={{ padding: 16, textAlign: 'center' as const, fontFamily: 'var(--font-sans)', fontSize: 13, color: 'var(--color-text-tertiary)' }}>Carregando...</div>
            ) : skills.length === 0 ? (
              <div style={{ padding: 16, textAlign: 'center' as const, fontFamily: 'var(--font-sans)', fontSize: 13, color: 'var(--color-text-tertiary)' }}>Nenhuma skill disponível</div>
            ) : skills.map(skill => (
              <button key={skill.id}
                onMouseDown={e => { e.preventDefault(); setAttachedSkill(skill); setSkillsPickerOpen(false); setTimeout(() => ref.current?.focus(), 50) }}
                style={{ width: '100%', display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 12px', background: attachedSkill?.id === skill.id ? 'var(--color-bg-secondary)' : 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left' as const, transition: 'background 0.12s', borderBottom: '1px solid var(--color-border)' }}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--color-bg-secondary)' }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = attachedSkill?.id === skill.id ? 'var(--color-bg-secondary)' : 'transparent' }}>
                <span style={{ fontSize: 14, flexShrink: 0, marginTop: 1 }}>⚡</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontFamily: 'var(--font-sans)', fontSize: 13, fontWeight: 500, color: 'var(--color-text-primary)' }}>{skill.name}</span>
                    {skill.is_global && (
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, background: 'var(--color-bg-tertiary)', color: 'var(--color-text-tertiary)', border: '1px solid var(--color-border)', borderRadius: 4, padding: '1px 5px', letterSpacing: '0.04em', textTransform: 'uppercase' as const }}>Global</span>
                    )}
                  </div>
                  {skill.description && <span style={{ fontFamily: 'var(--font-sans)', fontSize: 11, color: 'var(--color-text-tertiary)', display: 'block', marginTop: 1 }}>{skill.description}</span>}
                </div>
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Model dropdown ── */}
      <AnimatePresence>
        {modelMenuOpen && (
          <motion.div
            initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 6 }}
            transition={{ duration: 0.15 }}
            style={{ position: 'absolute', bottom: 'calc(100% + 8px)', left: 0, width: 220, background: 'var(--color-bg-primary)', border: '1px solid var(--color-border)', borderRadius: 14, boxShadow: 'var(--shadow-lg)', overflow: 'hidden', zIndex: 500 }}>
            <div style={{ padding: '6px 12px 4px', borderBottom: '1px solid var(--color-border)' }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--color-text-tertiary)', letterSpacing: '0.05em', textTransform: 'uppercase' as const }}>Modelo</span>
            </div>
            {MODELS.map(m => (
              <button key={m.id}
                onMouseDown={e => { e.preventDefault(); setModel(m.id); setModelMenuOpen(false) }}
                style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', background: model === m.id ? 'var(--color-bg-secondary)' : 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left' as const, transition: 'background 0.12s' }}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--color-bg-secondary)' }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = model === m.id ? 'var(--color-bg-secondary)' : 'transparent' }}>
                <span style={{ fontSize: 13, flexShrink: 0 }}>{m.icon}</span>
                <div style={{ flex: 1 }}>
                  <span style={{ fontFamily: 'var(--font-sans)', fontSize: 13, fontWeight: 500, color: 'var(--color-text-primary)', display: 'block' }}>{m.label}</span>
                  <span style={{ fontFamily: 'var(--font-sans)', fontSize: 11, color: 'var(--color-text-tertiary)' }}>{m.description}</span>
                </div>
                {model === m.id && <span style={{ color: 'var(--color-primary)', fontSize: 12, fontWeight: 600 }}>✓</span>}
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
              <span style={{ fontFamily: 'var(--font-sans)', fontSize: 12, color: 'var(--color-text-primary)', fontWeight: 500 }}>{attachedSkill.name}</span>
              <button onClick={() => setAttachedSkill(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-tertiary)', padding: 0, lineHeight: 1, display: 'flex', alignItems: 'center', marginLeft: 2 }}>
                <svg width="9" height="9" viewBox="0 0 14 14" fill="none"><line x1="1" y1="1" x2="13" y2="13" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/><line x1="13" y1="1" x2="1" y2="13" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Input box ── */}
      <div style={{ background: 'var(--color-bg-primary)', border: '1px solid var(--color-border)', borderRadius: 18, boxShadow: 'var(--shadow-md)', padding: '12px 14px 10px' }}>
        <textarea
          ref={ref}
          value={input}
          onChange={e => handleInputChange(e.target.value, ref)}
          onKeyDown={e => {
            if (slashMenuOpen) {
              if (e.key === 'ArrowDown') { e.preventDefault(); setSlashIndex(i => Math.min(i + 1, filteredSlashCommands.length - 1)); return }
              if (e.key === 'ArrowUp')   { e.preventDefault(); setSlashIndex(i => Math.max(i - 1, 0)); return }
              if (e.key === 'Enter')     { e.preventDefault(); if (filteredSlashCommands[slashIndex]) selectSlashCommand(filteredSlashCommands[slashIndex]); return }
              if (e.key === 'Escape')    { setSlashMenuOpen(false); return }
              return
            }
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
          }}
          placeholder={placeholder}
          rows={1}
          style={{ width: '100%', border: 'none', background: 'transparent', outline: 'none', fontFamily: 'var(--font-sans)', fontSize: 14, lineHeight: 1.55, color: 'var(--color-text-primary)', resize: 'none', minHeight: 24, maxHeight: 180, overflowY: 'auto' as const, padding: 0, boxSizing: 'border-box' as const, scrollbarWidth: 'none' as any }}
        />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
          <motion.button
            whileTap={{ scale: 0.95 }}
            onMouseDown={e => { e.preventDefault(); setModelMenuOpen(v => !v); setSlashMenuOpen(false); setSkillsPickerOpen(false) }}
            style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '3px 8px', background: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)', borderRadius: 8, cursor: 'pointer', fontFamily: 'var(--font-sans)', fontSize: 11, color: 'var(--color-text-secondary)' }}>
            <span>{currentModel.icon}</span>
            {currentModel.label}
            <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
              <path d="M2 3L4 5L6 3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
            </svg>
          </motion.button>
          <motion.button
            onClick={() => handleSend()}
            disabled={!input.trim() || isLoading}
            whileHover={input.trim() ? { scale: 1.05 } : {}}
            whileTap={input.trim() ? { scale: 0.92 } : {}}
            style={{ width: 30, height: 30, borderRadius: '50%', border: 'none', flexShrink: 0, background: input.trim() ? 'var(--color-text-primary)' : 'var(--color-border)', cursor: input.trim() ? 'pointer' : 'default', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 0.15s ease' }}>
            <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
              <path d="M1 7H13M13 7L7 1M13 7L7 13" stroke={input.trim() ? 'white' : 'var(--color-text-tertiary)'} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </motion.button>
        </div>
      </div>
    </div>
  )

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>

      {/* ── Sidebar ── */}
      <div style={{
        width: 220, flexShrink: 0,
        background: 'var(--color-bg-secondary)',
        borderRight: '1px solid var(--color-border)',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }}>
        {/* Nova conversa */}
        <div style={{ padding: '16px 12px 10px' }}>
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={handleNewConversation}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: 8,
              padding: '8px 12px',
              background: 'var(--color-bg-primary)', border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-md)', cursor: 'pointer',
              fontFamily: 'var(--font-sans)', fontSize: 13, fontWeight: 500,
              color: 'var(--color-text-primary)',
            }}
          >
            <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
              <path d="M7 1V13M1 7H13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            Nova conversa
          </motion.button>
        </div>

        {/* Recentes */}
        <div style={{ overflowY: 'auto', padding: '4px 8px 8px', scrollbarWidth: 'none' as any }}>
          <p style={{
            fontFamily: 'var(--font-sans)', fontSize: 10, fontWeight: 400,
            color: 'var(--color-text-tertiary)', letterSpacing: '0.06em',
            textTransform: 'uppercase' as const, margin: '0 0 4px', padding: '0 4px',
          }}>
            Recentes
          </p>
          {convList.length === 0 ? (
            <p style={{
              fontFamily: 'var(--font-sans)', fontSize: 11,
              color: 'var(--color-text-tertiary)', padding: '4px 4px', margin: 0,
            }}>
              Nenhuma conversa ainda
            </p>
          ) : (
            convList.map(conv => (
              <motion.button
                key={conv.id}
                whileTap={{ scale: 0.98 }}
                onClick={() => handleLoadConversation(conv.id)}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 6,
                  padding: '7px 8px', borderRadius: 'var(--radius-sm)', border: 'none',
                  background: !showHome && conversationId === conv.id ? 'var(--color-bg-primary)' : 'transparent',
                  cursor: 'pointer', textAlign: 'left' as const,
                }}
              >
                <span style={{
                  fontFamily: 'var(--font-sans)', fontSize: 12,
                  color: !showHome && conversationId === conv.id ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, lineHeight: 1.4,
                }}>
                  {conv.title ?? getAgentLabel(conv.agent_id)}
                </span>
              </motion.button>
            ))
          )}
        </div>

        {/* ── Agentes fixos ── */}
        <div style={{ padding: '8px 8px 4px', borderTop: '1px solid var(--color-border)' }}>
          <p style={{
            fontFamily: 'var(--font-sans)', fontSize: 10, fontWeight: 400,
            color: 'var(--color-text-tertiary)', letterSpacing: '0.06em',
            textTransform: 'uppercase' as const, margin: '0 0 4px', padding: '0 4px',
          }}>
            Agentes
          </p>
          {PINNED_AGENTS.map(agent => {
            const isActive = !showHome && agentId === agent.id
            const PinnedIcon = getAgentIcon(agent.id)
            return (
              <motion.button
                key={agent.id}
                whileTap={{ scale: 0.97 }}
                onClick={() => handleSelectAgent(agent.id)}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 7,
                  padding: '6px 8px', borderRadius: 'var(--radius-sm)', border: 'none',
                  background: isActive ? 'var(--color-bg-primary)' : 'transparent',
                  cursor: 'pointer', textAlign: 'left' as const,
                }}
              >
                <PinnedIcon
                  size={14}
                  strokeWidth={1.5}
                  color={isActive ? 'var(--color-primary)' : 'var(--color-text-secondary)'}
                  style={{ flexShrink: 0 }}
                />
                <span style={{
                  fontFamily: 'var(--font-sans)', fontSize: 12,
                  color: isActive ? 'var(--color-primary)' : 'var(--color-text-secondary)',
                  fontWeight: isActive ? 500 : 400,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1,
                }}>
                  {agent.name}
                </span>
              </motion.button>
            )
          })}
        </div>

        {/* Footer */}
        <div style={{
          padding: '10px 12px 14px', borderTop: '1px solid var(--color-border)',
          display: 'flex', alignItems: 'center', gap: 8, marginTop: 'auto',
        }}>
          <div style={{
            width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
            background: agentId && !showHome ? 'var(--color-primary)' : 'var(--color-border)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {(() => { const I = getAgentIcon(agentId ?? 'orchestrator'); return <I size={13} strokeWidth={1.5} color="white" /> })()}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{
              fontFamily: 'var(--font-sans)', fontSize: 12, fontWeight: 500,
              color: 'var(--color-text-primary)', margin: 0,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {agentId && !showHome ? getAgentLabel(agentId) : 'Northie AI'}
            </p>
            <p style={{ fontFamily: 'var(--font-sans)', fontSize: 10, color: 'var(--color-text-tertiary)', margin: 0 }}>
              {currentModel.label}
            </p>
          </div>
        </div>
      </div>

      {/* ── Main area ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--color-bg-primary)' }}>
        {showHome ? (

          /* ── TELA INICIAL ── */
          <AgentSelector onSelectAgent={handleSelectAgent} />

        ) : !hasMessages ? (

          /* ── AGENTE SELECIONADO, SEM MENSAGENS ── */
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

            {/* Header com voltar */}
            <div style={{
              height: 48, flexShrink: 0,
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '0 20px', borderBottom: '1px solid var(--color-border)',
            }}>
              <motion.button
                whileTap={{ scale: 0.96 }}
                onClick={handleBack}
                style={{
                  display: 'flex', alignItems: 'center', gap: 5,
                  padding: '5px 10px', background: 'transparent',
                  border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)',
                  cursor: 'pointer', fontFamily: 'var(--font-sans)', fontSize: 11,
                  color: 'var(--color-text-secondary)', flexShrink: 0,
                }}
              >
                <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
                  <path d="M8 1L3 6L8 11" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                Voltar
              </motion.button>
              {agentId && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
                  <ActiveIcon size={14} strokeWidth={1.5} color="var(--color-text-secondary)" style={{ flexShrink: 0 }} />
                  <div style={{ minWidth: 0 }}>
                    <p style={{
                      fontFamily: 'var(--font-sans)', fontSize: 13, fontWeight: 500,
                      color: 'var(--color-text-primary)', margin: 0,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {activeLabel}
                    </p>
                    {activeSources && (
                      <p style={{
                        fontFamily: 'var(--font-sans)', fontSize: 10,
                        color: 'var(--color-text-tertiary)', margin: 0,
                      }}>
                        {activeSources}
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Empty state centrado */}
            <div style={{
              flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
              justifyContent: 'center', padding: '0 32px 60px', overflow: 'hidden',
            }}>
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, ease: [0.25, 0.1, 0.25, 1] }}
                style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', maxWidth: 560 }}
              >
                <ActiveIcon size={32} strokeWidth={1.25} color="var(--color-text-secondary)" style={{ marginBottom: 14, opacity: 0.7 }} />
                <h2 style={{
                  fontFamily: 'var(--font-sans)', fontSize: 20, fontWeight: 500,
                  letterSpacing: '-0.4px', color: 'var(--color-text-primary)',
                  margin: '0 0 6px', textAlign: 'center',
                }}>
                  {activeLabel}
                </h2>
                <p style={{
                  fontFamily: 'var(--font-sans)', fontSize: 13, color: 'var(--color-text-tertiary)',
                  margin: '0 0 24px', textAlign: 'center', lineHeight: 1.5,
                }}>
                  {agentId ? (AGENT_BY_ID[agentId]?.description ?? 'Como posso ajudar?') : 'Como posso ajudar você hoje?'}
                </p>

                <div style={{ width: '100%', marginBottom: 14 }}>
                  {renderInputBox(emptyTextareaRef, `Pergunte ao ${activeLabel}...`)}
                </div>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
                  {activeChips.map(chip => (
                    <motion.button
                      key={chip}
                      whileTap={{ scale: 0.97 }}
                      onClick={() => handleSend(chip)}
                      style={{
                        padding: '6px 14px',
                        background: 'transparent', border: '1px solid var(--color-border)',
                        borderRadius: 20, cursor: 'pointer',
                        fontFamily: 'var(--font-sans)', fontSize: 12,
                        color: 'var(--color-text-secondary)',
                      }}
                    >
                      {chip}
                    </motion.button>
                  ))}
                </div>
              </motion.div>
            </div>
          </div>

        ) : (

          /* ── CONVERSA ATIVA ── */
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative' }}>

            {/* Header da conversa */}
            <div style={{
              height: 48, flexShrink: 0,
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '0 20px', borderBottom: '1px solid var(--color-border)',
              background: 'var(--color-bg-primary)',
            }}>
              <motion.button
                whileTap={{ scale: 0.96 }}
                onClick={handleBack}
                style={{
                  display: 'flex', alignItems: 'center', gap: 5,
                  padding: '5px 10px', background: 'transparent',
                  border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)',
                  cursor: 'pointer', fontFamily: 'var(--font-sans)', fontSize: 11,
                  color: 'var(--color-text-secondary)', flexShrink: 0,
                }}
              >
                <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
                  <path d="M8 1L3 6L8 11" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                Voltar
              </motion.button>

              {agentId && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
                  <ActiveIcon size={14} strokeWidth={1.5} color="var(--color-text-secondary)" style={{ flexShrink: 0 }} />
                  <p style={{
                    fontFamily: 'var(--font-sans)', fontSize: 13, fontWeight: 500,
                    color: 'var(--color-text-primary)', margin: 0,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1,
                  }}>
                    {activeLabel}
                    {activeSources && (
                      <span style={{ fontWeight: 400, color: 'var(--color-text-tertiary)', marginLeft: 8 }}>
                        {activeSources}
                      </span>
                    )}
                  </p>
                </div>
              )}

              <motion.button
                whileTap={{ scale: 0.96 }}
                onClick={handleNewConversation}
                style={{
                  display: 'flex', alignItems: 'center', gap: 5,
                  padding: '5px 10px', background: 'transparent',
                  border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)',
                  cursor: 'pointer', fontFamily: 'var(--font-sans)', fontSize: 11,
                  color: 'var(--color-text-secondary)', flexShrink: 0,
                }}
              >
                <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
                  <path d="M7 1V13M1 7H13" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
                </svg>
                Nova
              </motion.button>
            </div>

            {/* Mensagens */}
            <div
              ref={scrollRef}
              onScroll={handleScroll}
              style={{ flex: 1, overflowY: 'auto', scrollbarWidth: 'thin' as any, padding: '28px 0 12px' }}
            >
              <div style={{ maxWidth: 640, margin: '0 auto', padding: '0 24px', display: 'flex', flexDirection: 'column', gap: 24 }}>
                {messages.map(m => (
                  <motion.div
                    key={m.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.25, ease: [0.25, 0.1, 0.25, 1] }}
                    onHoverStart={() => setHoveredMsg(m.id)}
                    onHoverEnd={() => setHoveredMsg(null)}
                    style={{ display: 'flex', flexDirection: 'column', alignItems: m.role === 'user' ? 'flex-end' : 'flex-start' }}
                  >
                    {m.role === 'user' ? (
                      <div style={{
                        maxWidth: '82%', padding: '10px 16px',
                        background: 'var(--color-bg-secondary)',
                        border: '1px solid var(--color-border)',
                        borderRadius: 16,
                        fontFamily: 'var(--font-sans)', fontSize: 14, lineHeight: 1.55,
                        color: 'var(--color-text-primary)', whiteSpace: 'pre-wrap',
                      }}>
                        {m.content}
                      </div>
                    ) : (
                      <div style={{ width: '100%' }}>
                        <p style={{
                          fontFamily: 'var(--font-sans)', fontSize: 10, fontWeight: 400,
                          color: 'var(--color-text-tertiary)', letterSpacing: '0.06em',
                          textTransform: 'uppercase' as const, margin: '0 0 8px',
                        }}>
                          {activeLabel}
                        </p>
                        <div style={{
                          fontFamily: 'var(--font-sans)', fontSize: 14, lineHeight: 1.7,
                          color: 'var(--color-text-primary)', whiteSpace: 'pre-wrap',
                        }}>
                          {animatingId === m.id
                            ? <TypewriterText text={m.content} onDone={() => setAnimatingId(null)} />
                            : m.content
                          }
                        </div>
                        <AnimatePresence>
                          {hoveredMsg === m.id && (
                            <motion.div
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              exit={{ opacity: 0 }}
                              transition={{ duration: 0.12 }}
                              style={{ display: 'flex', gap: 4, marginTop: 8 }}
                            >
                              <button
                                onClick={() => handleCopy(m.id, m.content)}
                                style={{
                                  display: 'flex', alignItems: 'center', gap: 4,
                                  padding: '3px 8px', border: '1px solid var(--color-border)',
                                  borderRadius: 6, background: 'var(--color-bg-secondary)',
                                  cursor: 'pointer', fontFamily: 'var(--font-sans)', fontSize: 11,
                                  color: 'var(--color-text-tertiary)',
                                }}
                              >
                                {copied === m.id ? (
                                  <>
                                    <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
                                      <path d="M2.5 6L5 8.5L9.5 3.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
                                    </svg>
                                    Copiado
                                  </>
                                ) : (
                                  <>
                                    <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
                                      <rect x="4" y="4" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.1"/>
                                      <path d="M8 4V2.5A1.5 1.5 0 006.5 1H2.5A1.5 1.5 0 001 2.5v4A1.5 1.5 0 002.5 8H4" stroke="currentColor" strokeWidth="1.1"/>
                                    </svg>
                                    Copiar
                                  </>
                                )}
                              </button>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    )}
                  </motion.div>
                ))}
                {isLoading && <ThinkingIndicator />}
                <div style={{ height: 8 }} />
              </div>
            </div>

            {/* Scroll to bottom */}
            <AnimatePresence>
              {!atBottom && (
                <motion.button
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 6 }}
                  onClick={() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' }); setAtBottom(true) }}
                  style={{
                    position: 'absolute', bottom: 90, left: '50%', transform: 'translateX(-50%)',
                    width: 32, height: 32, borderRadius: '50%',
                    background: 'var(--color-bg-primary)', border: '1px solid var(--color-border)',
                    boxShadow: 'var(--shadow-md)', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: 'var(--color-text-secondary)',
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <path d="M7 2V12M7 12L3 8M7 12L11 8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
                  </svg>
                </motion.button>
              )}
            </AnimatePresence>

            {/* Input bottom */}
            <div style={{
              padding: '12px 24px 14px',
              borderTop: '1px solid var(--color-border)',
              background: 'var(--color-bg-primary)', flexShrink: 0,
            }}>
              <div style={{ maxWidth: 640, margin: '0 auto' }}>
                {renderInputBox(activeTextareaRef, `Pergunte ao ${activeLabel}...`)}
                <p style={{
                  fontFamily: 'var(--font-sans)', fontSize: 10, color: 'var(--color-text-tertiary)',
                  textAlign: 'center' as const, margin: '7px 0 0',
                }}>
                  Northie AI pode cometer erros. Verifique as recomendações antes de executar.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
