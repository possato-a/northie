import { useState, useRef } from 'react'
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
import { AGENT_BY_ID } from '../../constants/agentDefinitions'
import { useWindowWidth, isMobile } from '../../hooks/useWindowWidth'

// ── Icon map ──────────────────────────────────────────────────────────────────

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

// ── Config ────────────────────────────────────────────────────────────────────

const ADVANCED_IDS = ['anomalies', 'forecast', 'correlations', 'health']

const GROUPS = [
  { label: 'Aquisição & Mídia',        agents: ['roas', 'cac', 'audience', 'creatives'] },
  { label: 'Financeiro & Receita',     agents: ['ltv', 'mrr', 'upsell', 'margin'] },
  { label: 'Retenção & Comportamento', agents: ['churn', 'rfm', 'cohort', 'reactivation'] },
  { label: 'Produto & Operações',      agents: ['ecommerce', 'email', 'pipeline'] },
  { label: 'Relacionamento & CX',      agents: ['whatsapp', 'nps', 'engagement'] },
  { label: 'Valuation & Saúde',        agents: ['valuation', 'health'] },
]

const ORCHESTRATOR_CHIPS = [
  'Como está a saúde do negócio?',
  'Onde estou perdendo mais dinheiro?',
  'Quais são as 3 maiores oportunidades?',
  'O que priorizar essa semana?',
]

// ── Props ─────────────────────────────────────────────────────────────────────

interface AgentSelectorProps {
  onSelectAgent: (agentId: string, initialMessage?: string) => void
}

// ── Agent card ────────────────────────────────────────────────────────────────

function AgentCard({ agentId, onSelect, isAlert }: {
  agentId: string
  onSelect: (id: string) => void
  isAlert?: boolean
}) {
  const agent = AGENT_BY_ID[agentId]
  if (!agent) return null
  const Icon = AGENT_ICONS[agentId] ?? Brain
  const sources = agent.sources.slice(0, 2).join(' · ')
  const iconColor = isAlert ? 'var(--color-text-danger, #DC2626)' : 'var(--color-text-secondary)'

  return (
    <motion.button
      whileHover={{ y: -2, boxShadow: 'var(--shadow-md)' }}
      whileTap={{ scale: 0.97 }}
      onClick={() => onSelect(agentId)}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 5,
        padding: '12px 14px',
        background: isAlert
          ? 'color-mix(in srgb, #EF4444 5%, var(--color-bg-primary))'
          : 'var(--color-bg-primary)',
        border: isAlert
          ? '1px solid color-mix(in srgb, #EF4444 30%, var(--color-border))'
          : '1px solid var(--color-border)',
        borderRadius: 'var(--radius-lg)',
        cursor: 'pointer',
        textAlign: 'left',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Icon size={16} color={iconColor} strokeWidth={1.5} />
        {isAlert && (
          <motion.span
            animate={{ opacity: [1, 0.25, 1] }}
            transition={{ duration: 1.6, repeat: Infinity }}
            style={{
              width: 6, height: 6, borderRadius: '50%',
              background: '#EF4444', display: 'inline-block', flexShrink: 0,
            }}
          />
        )}
      </div>
      <span style={{
        fontFamily: 'var(--font-sans)',
        fontSize: 11, fontWeight: 500,
        color: isAlert ? '#DC2626' : 'var(--color-text-primary)',
        lineHeight: 1.3,
      }}>
        {agent.name}
      </span>
      {sources && (
        <span style={{
          fontFamily: 'var(--font-sans)',
          fontSize: 10,
          color: 'var(--color-text-tertiary)',
          lineHeight: 1.3,
        }}>
          {sources}
        </span>
      )}
    </motion.button>
  )
}

// ── Section headers ───────────────────────────────────────────────────────────

function SectionHeader({ label }: { label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
      <p style={{
        fontFamily: 'var(--font-sans)',
        fontSize: 10, fontWeight: 500,
        color: 'var(--color-text-tertiary)',
        letterSpacing: '0.07em',
        textTransform: 'uppercase',
        margin: 0, whiteSpace: 'nowrap',
      }}>
        {label}
      </p>
      <div style={{ flex: 1, height: 1, background: 'var(--color-border)' }} />
    </div>
  )
}

function CollapsibleHeader({ label, isCollapsed, onToggle }: {
  label: string
  isCollapsed: boolean
  onToggle: () => void
}) {
  return (
    <motion.button
      onClick={onToggle}
      whileTap={{ scale: 0.99 }}
      style={{
        display: 'flex', alignItems: 'center', gap: 12,
        width: '100%', background: 'none', border: 'none',
        cursor: 'pointer', padding: 0, marginBottom: isCollapsed ? 0 : 12,
      }}
    >
      <p style={{
        fontFamily: 'var(--font-sans)',
        fontSize: 10, fontWeight: 500,
        color: 'var(--color-text-tertiary)',
        letterSpacing: '0.07em',
        textTransform: 'uppercase',
        margin: 0, whiteSpace: 'nowrap',
      }}>
        {label}
      </p>
      <div style={{ flex: 1, height: 1, background: 'var(--color-border)' }} />
      <motion.svg
        animate={{ rotate: isCollapsed ? -90 : 0 }}
        transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
        width="10" height="10" viewBox="0 0 10 10" fill="none"
        style={{ flexShrink: 0 }}
      >
        <path d="M2 4L5 7L8 4" stroke="var(--color-text-tertiary)" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
      </motion.svg>
    </motion.button>
  )
}

// ── Main export ───────────────────────────────────────────────────────────────

export default function AgentSelector({ onSelectAgent }: AgentSelectorProps) {
  const [input, setInput] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const width = useWindowWidth()
  const mobile = isMobile(width)
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})

  const cols = mobile ? 2 : 4

  const handleOrchestratorSend = (text: string) => {
    const trimmed = text.trim()
    if (!trimmed) return
    onSelectAgent('orchestrator', trimmed)
  }

  const toggleGroup = (label: string) =>
    setCollapsed(prev => ({ ...prev, [label]: !prev[label] }))

  return (
    <div style={{
      flex: 1,
      overflowY: 'auto',
      padding: '28px',
      scrollbarWidth: 'thin',
    }}>
      <div style={{ maxWidth: 860, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 28 }}>

        {/* ── Orchestrator card ── */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: [0.25, 0.1, 0.25, 1] }}
          style={{
            padding: '20px 24px',
            background: 'var(--color-bg-primary)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-lg)',
            boxShadow: 'var(--shadow-md)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
            <Brain size={22} color="var(--color-text-primary)" strokeWidth={1.5} />
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                <span style={{
                  fontFamily: 'var(--font-sans)', fontSize: 14, fontWeight: 500,
                  color: 'var(--color-text-primary)',
                }}>
                  Northie Growth
                </span>
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                  fontFamily: 'var(--font-sans)', fontSize: 9, fontWeight: 500,
                  color: '#16A34A',
                  background: 'color-mix(in srgb, #16A34A 10%, transparent)',
                  border: '1px solid color-mix(in srgb, #16A34A 25%, transparent)',
                  borderRadius: 'var(--radius-sm)', padding: '2px 7px',
                  letterSpacing: '0.04em', textTransform: 'uppercase',
                }}>
                  <span style={{ width: 4, height: 4, borderRadius: '50%', background: '#16A34A', display: 'inline-block' }} />
                  online
                </span>
              </div>
              <span style={{
                fontFamily: 'var(--font-sans)', fontSize: 11,
                color: 'var(--color-text-tertiary)',
              }}>
                Agente orquestrador — acesso a todos os dados
              </span>
            </div>
          </div>

          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            background: 'var(--color-bg-secondary)',
            border: '1px solid var(--color-border)',
            borderRadius: 12, padding: '10px 14px',
            marginBottom: 12,
          }}>
            <input
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleOrchestratorSend(input) }}
              placeholder="Pergunte qualquer coisa sobre o negócio..."
              style={{
                flex: 1, background: 'none', border: 'none', outline: 'none',
                fontFamily: 'var(--font-sans)', fontSize: 13,
                color: 'var(--color-text-primary)',
              }}
            />
            <motion.button
              whileTap={{ scale: 0.93 }}
              onClick={() => handleOrchestratorSend(input)}
              style={{
                width: 28, height: 28, borderRadius: '50%',
                background: 'var(--color-primary)', border: 'none',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', flexShrink: 0,
              }}
            >
              <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
                <path d="M1 7H13M13 7L7 1M13 7L7 13" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </motion.button>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {ORCHESTRATOR_CHIPS.map(chip => (
              <motion.button
                key={chip}
                whileTap={{ scale: 0.97 }}
                onClick={() => handleOrchestratorSend(chip)}
                style={{
                  padding: '5px 12px',
                  background: 'transparent',
                  border: '1px solid var(--color-border)',
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

        {/* ── Inteligência Avançada — sempre visível ── */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.05, ease: [0.25, 0.1, 0.25, 1] }}
        >
          <SectionHeader label="Inteligência Avançada" />
          <div style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${Math.min(ADVANCED_IDS.length, cols)}, minmax(0, 1fr))`,
            gap: 8,
          }}>
            {ADVANCED_IDS.map(id => (
              <AgentCard key={id} agentId={id} onSelect={onSelectAgent} isAlert={id === 'anomalies'} />
            ))}
          </div>
        </motion.div>

        {/* ── Grupos colapsáveis ── */}
        {GROUPS.map((group, gi) => {
          const isCollapsed = !!collapsed[group.label]
          return (
            <motion.div
              key={group.label}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.08 + gi * 0.04, ease: [0.25, 0.1, 0.25, 1] }}
            >
              <CollapsibleHeader
                label={group.label}
                isCollapsed={isCollapsed}
                onToggle={() => toggleGroup(group.label)}
              />
              <AnimatePresence initial={false}>
                {!isCollapsed && (
                  <motion.div
                    key="content"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
                    style={{ overflow: 'hidden' }}
                  >
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: `repeat(${Math.min(group.agents.length, cols)}, minmax(0, 1fr))`,
                      gap: 8,
                    }}>
                      {group.agents.map(id => (
                        <AgentCard key={id} agentId={id} onSelect={onSelectAgent} />
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )
        })}

      </div>
    </div>
  )
}
