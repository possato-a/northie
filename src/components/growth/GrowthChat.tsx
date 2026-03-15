import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import AgentSelector from './AgentSelector'
import { useAgentChat } from '../../hooks/useAgentChat'
import { supabase } from '../../lib/supabase'
import { AGENT_BY_ID } from '../../constants/agentDefinitions'

// ── Local types ───────────────────────────────────────────────────────────────

type AIModel = 'sonnet' | 'opus' | 'haiku'
const MODELS: AIModel[] = ['sonnet', 'opus', 'haiku']
const MODEL_LABELS: Record<AIModel, string> = { sonnet: 'Sonnet', opus: 'Opus', haiku: 'Haiku' }

interface ConvItem {
  id: string
  agent_id: string
  title: string | null
  updated_at: string
}

// ── Constants ─────────────────────────────────────────────────────────────────

const AGENT_ICONS: Record<string, string> = {
  orchestrator: '🧠', anomalies: '🚨', forecast: '🔮', correlations: '🔗',
  health: '🏥', roas: '📈', cac: '🎯', audience: '👥', creatives: '🖼️',
  ltv: '💎', mrr: '📦', upsell: '⚡', margin: '💸', churn: '🔄',
  rfm: '🗂️', cohort: '📅', reactivation: '🔁', ecommerce: '🛒',
  email: '📧', pipeline: '📆', whatsapp: '💬', nps: '🌟',
  engagement: '🎓', valuation: '📊',
}

const PINNED_AGENTS = [
  { id: 'orchestrator', icon: '🧠', name: 'Northie Growth' },
  { id: 'anomalies',    icon: '🚨', name: 'Anomalias' },
  { id: 'churn',        icon: '🔄', name: 'Churn' },
  { id: 'forecast',     icon: '🔮', name: 'Forecast' },
]

const GROWTH_CHIPS = ['Analisar canais de aquisição', 'Quais clientes estão em risco?', 'Qual campanha tem melhor LTV?']

const getAgentLabel = (id: string) => AGENT_BY_ID[id]?.name ?? 'Northie AI'
const getAgentChips = (id: string) => AGENT_BY_ID[id]?.quickSuggestions ?? GROWTH_CHIPS
const getAgentSources = (id: string) => AGENT_BY_ID[id]?.sources.slice(0, 3).join(' · ') ?? ''
const getAgentIcon = (id: string) => AGENT_ICONS[id] ?? '🤖'

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
  const activeIcon = agentId ? getAgentIcon(agentId) : '🧠'
  const activeSources = agentId ? getAgentSources(agentId) : ''

  // ── Shared input toolbar renderer ─────────────────────────────────────────

  const renderInputBox = (ref: React.RefObject<HTMLTextAreaElement>, placeholder: string) => (
    <div style={{
      background: 'var(--color-bg-primary)', border: '1px solid var(--color-border)',
      borderRadius: 18, boxShadow: 'var(--shadow-md)', padding: '12px 14px 10px',
    }}>
      <textarea
        ref={ref}
        value={input}
        onChange={e => { setInput(e.target.value); resizeTextarea(ref.current) }}
        onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }}
        placeholder={placeholder}
        rows={1}
        style={{
          width: '100%', border: 'none', background: 'transparent', outline: 'none',
          fontFamily: 'var(--font-sans)', fontSize: 14, lineHeight: 1.55,
          color: 'var(--color-text-primary)', resize: 'none',
          minHeight: 24, maxHeight: 180, overflowY: 'auto',
          padding: 0, boxSizing: 'border-box' as const, scrollbarWidth: 'none' as any,
        }}
      />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={() => setModel(m => MODELS[(MODELS.indexOf(m) + 1) % MODELS.length])}
          style={{
            display: 'flex', alignItems: 'center', gap: 4, padding: '3px 8px',
            background: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)',
            borderRadius: 8, cursor: 'pointer', fontFamily: 'var(--font-sans)',
            fontSize: 11, color: 'var(--color-text-secondary)',
          }}
        >
          {MODEL_LABELS[model]}
          <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
            <path d="M2 3L4 5L6 3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
          </svg>
        </motion.button>
        <motion.button
          onClick={() => handleSend()}
          disabled={!input.trim() || isLoading}
          whileHover={input.trim() ? { scale: 1.05 } : {}}
          whileTap={input.trim() ? { scale: 0.92 } : {}}
          style={{
            width: 30, height: 30, borderRadius: '50%', border: 'none', flexShrink: 0,
            background: input.trim() ? 'var(--color-text-primary)' : 'var(--color-border)',
            cursor: input.trim() ? 'pointer' : 'default',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'background 0.15s ease',
          }}
        >
          <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
            <path d="M1 7H13M13 7L7 1M13 7L7 13"
              stroke={input.trim() ? 'white' : 'var(--color-text-tertiary)'}
              strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </motion.button>
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
                <span style={{ fontSize: 13, flexShrink: 0 }}>{agent.icon}</span>
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
            fontSize: 13,
          }}>
            {agentId && !showHome ? getAgentIcon(agentId) : 'N'}
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
              {MODEL_LABELS[model]}
            </p>
          </div>
        </div>
      </div>

      {/* ── Main area ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--color-bg-primary)' }}>
        {showHome ? (

          /* ── TELA INICIAL ── */
          <AgentSelector onSelect={handleSelectAgent} />

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
                  <span style={{ fontSize: 14, flexShrink: 0 }}>{activeIcon}</span>
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
                <span style={{ fontSize: 32, marginBottom: 14, opacity: 0.7 }}>{activeIcon}</span>
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
                  <span style={{ fontSize: 14, flexShrink: 0 }}>{activeIcon}</span>
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
