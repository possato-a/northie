import { useState } from 'react'
import { motion } from 'framer-motion'
import { KpiCard } from '../components/ui/KpiCard'
import TopBar from '../components/layout/TopBar'
import {
  PageHeader, Divider, EmptyState,
} from '../components/ui/shared'

// ── Helpers ───────────────────────────────────────────────────────────────────

function SectionCard({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
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

// ── Pipeline Stage Card ───────────────────────────────────────────────────────

function PipelineStage({
  label,
  count,
  delay,
  isLast = false,
}: {
  label: string
  count: number
  delay: number
  isLast?: boolean
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay, ease: [0.25, 0.1, 0.25, 1] }}
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 8,
        padding: '28px 20px',
        position: 'relative',
      }}
    >
      {/* Connector line to next stage */}
      {!isLast && (
        <motion.div
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ duration: 0.4, delay: delay + 0.1, ease: [0.25, 0.1, 0.25, 1] }}
          style={{
            position: 'absolute',
            right: 0,
            top: '50%',
            transform: 'translateY(-50%)',
            width: 1,
            height: 40,
            background: 'var(--color-border)',
          }}
        />
      )}

      <span style={{
        fontFamily: 'var(--font-sans)',
        fontSize: 'var(--text-3xl)',
        fontWeight: 500,
        color: count > 0 ? 'var(--color-primary)' : 'var(--color-text-primary)',
        letterSpacing: '-0.5px',
        lineHeight: 1,
      }}>
        {count}
      </span>
      <span style={{
        fontFamily: 'var(--font-sans)',
        fontSize: 'var(--text-sm)',
        color: 'var(--color-text-secondary)',
        textAlign: 'center',
        lineHeight: 1.4,
        letterSpacing: '-0.1px',
      }}>
        {label}
      </span>
    </motion.div>
  )
}

// ── Pipeline Visualization ────────────────────────────────────────────────────

function PipelineView() {
  const stages = [
    { label: 'Lead Capturado', count: 0 },
    { label: 'Reunião Agendada', count: 0 },
    { label: 'Reunião Realizada', count: 0 },
    { label: 'Fechado / Perdido', count: 0 },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <SectionCard>
        <div style={{
          display: 'flex',
          alignItems: 'stretch',
        }}>
          {stages.map((stage, i) => (
            <PipelineStage
              key={stage.label}
              label={stage.label}
              count={stage.count}
              delay={0.1 + i * 0.07}
              isLast={i === stages.length - 1}
            />
          ))}
        </div>
      </SectionCard>

      <SectionCard style={{ padding: '0' }}>
        <EmptyState
          title="Nenhum lead capturado"
          description="Conecte o formulário Northie e o Google Calendar para começar a rastrear seu pipeline."
        />
      </SectionCard>
    </div>
  )
}

// ── Tab Content: Reuniões ─────────────────────────────────────────────────────

function ReunioesView() {
  return (
    <SectionCard>
      <EmptyState
        title="Nenhuma reunião transcrita"
        description="Conecte o Google Meet para transcrever reuniões automaticamente e cruzar com seus dados financeiros."
      />
    </SectionCard>
  )
}

// ── Tab Content: Insights ─────────────────────────────────────────────────────

function InsightsView() {
  return (
    <SectionCard>
      <EmptyState
        title="Insights disponíveis após as primeiras reuniões"
        description="A IA analisará objeções, perfis de lead e padrões de fechamento assim que houver dados suficientes."
      />
    </SectionCard>
  )
}

// ── Page Component ────────────────────────────────────────────────────────────

const TABS = ['Pipeline', 'Reuniões', 'Insights']

export default function Conversas({ onToggleChat }: { onToggleChat?: () => void }) {
  const [activeTab, setActiveTab] = useState('Pipeline')

  return (
    <div style={{ paddingTop: 28, paddingBottom: 80 }}>
      <TopBar onToggleChat={onToggleChat} />

      <PageHeader
        title="Conversas"
        subtitle="Pipeline de vendas e inteligência de reuniões."
      />

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: 16,
        marginTop: 32,
      }}>
        <KpiCard label="LEADS CAPTURADOS"    value={0} decimals={0} delay={0.05} />
        <KpiCard label="REUNIÕES REALIZADAS" value={0} decimals={0} delay={0.1} />
        <KpiCard label="TAXA DE CONVERSÃO"   value={0} suffix="%" decimals={1} delay={0.15} />
        <KpiCard label="CICLO MÉDIO"         value={0} suffix=" dias" decimals={0} delay={0.2} />
      </div>

      <Divider margin="32px 0" />

      {/* Pill subnav — idêntico ao Growth */}
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
        {activeTab === 'Pipeline'  && <PipelineView />}
        {activeTab === 'Reuniões'  && <ReunioesView />}
        {activeTab === 'Insights'  && <InsightsView />}
      </motion.div>
    </div>
  )
}
