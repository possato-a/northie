import { useState } from 'react'
import { motion } from 'framer-motion'
import { KpiCard } from '../components/ui/KpiCard'
import TopBar from '../components/layout/TopBar'
import {
  PageHeader, Divider, TabBar, EmptyState,
} from '../components/ui/shared'

// ── Pipeline Stage Card ──────────────────────────────────────────────────────

function PipelineStage({ label, count, delay }: { label: string; count: number; delay: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay, ease: [0.25, 0.1, 0.25, 1] }}
      whileHover={{ scale: 1.02 }}
      style={{
        flex: 1,
        background: 'var(--color-bg-secondary)',
        borderRadius: 'var(--radius-lg)',
        padding: '24px 20px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 8,
        minWidth: 140,
      }}
    >
      <span style={{
        fontFamily: 'var(--font-mono)',
        fontSize: 'var(--text-3xl)',
        fontWeight: 500,
        color: 'var(--color-text-primary)',
        lineHeight: 1,
      }}>
        {count}
      </span>
      <span style={{
        fontFamily: 'var(--font-sans)',
        fontSize: 'var(--text-sm)',
        color: 'var(--color-text-secondary)',
        textAlign: 'center',
        lineHeight: 1.3,
      }}>
        {label}
      </span>
    </motion.div>
  )
}

// ── Pipeline Connector ───────────────────────────────────────────────────────

function PipelineConnector({ delay }: { delay: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, scaleX: 0 }}
      animate={{ opacity: 1, scaleX: 1 }}
      transition={{ duration: 0.3, delay, ease: [0.25, 0.1, 0.25, 1] }}
      style={{
        width: 32,
        height: 1,
        background: 'var(--color-border)',
        flexShrink: 0,
        alignSelf: 'center',
      }}
    />
  )
}

// ── Pipeline Visualization ───────────────────────────────────────────────────

function PipelineView() {
  const stages = [
    { label: 'Lead Capturado', count: 0 },
    { label: 'Reuniao Agendada', count: 0 },
    { label: 'Reuniao Realizada', count: 0 },
    { label: 'Fechado / Perdido', count: 0 },
  ]

  return (
    <div>
      <div style={{
        display: 'flex',
        alignItems: 'stretch',
        gap: 0,
        marginBottom: 40,
      }}>
        {stages.map((stage, i) => (
          <div key={stage.label} style={{ display: 'contents' }}>
            <PipelineStage label={stage.label} count={stage.count} delay={0.1 + i * 0.08} />
            {i < stages.length - 1 && <PipelineConnector delay={0.15 + i * 0.08} />}
          </div>
        ))}
      </div>

      <EmptyState
        title="Nenhum lead capturado"
        description="Conecte o formulario Northie e o Google Calendar para comecar a rastrear seu pipeline."
      />
    </div>
  )
}

// ── Tab Content: Reunioes ────────────────────────────────────────────────────

function ReunioesView() {
  return (
    <EmptyState
      title="Nenhuma reuniao transcrita"
      description="Conecte o Google Meet para transcrever reunioes automaticamente e cruzar com seus dados financeiros."
    />
  )
}

// ── Tab Content: Insights ────────────────────────────────────────────────────

function InsightsView() {
  return (
    <EmptyState
      title="Insights disponiveis apos primeiras reunioes"
      description="A IA analisara objecoes, perfis de lead e padroes de fechamento assim que houver dados suficientes."
    />
  )
}

// ── Page Component ───────────────────────────────────────────────────────────

const TABS = ['Pipeline', 'Reunioes', 'Insights']

export default function Conversas({ onToggleChat }: { onToggleChat?: () => void }) {
  const [activeTab, setActiveTab] = useState('Pipeline')

  return (
    <div style={{ paddingTop: 28, paddingBottom: 80 }}>
      <TopBar onToggleChat={onToggleChat} />

      <PageHeader
        title="Conversas"
        subtitle="Pipeline de vendas e inteligencia de reunioes."
      />

      <div style={{ display: 'flex', gap: 48, marginTop: 40, flexWrap: 'wrap' }}>
        <KpiCard label="LEADS CAPTURADOS" value={0} decimals={0} delay={0.1} />
        <KpiCard label="REUNIOES REALIZADAS" value={0} decimals={0} delay={0.2} />
        <KpiCard label="TAXA DE CONVERSAO" value={0} suffix="%" decimals={1} delay={0.3} />
        <KpiCard label="CICLO MEDIO" value={0} suffix=" dias" decimals={0} delay={0.4} />
      </div>

      <Divider margin="48px 0" />

      <TabBar tabs={TABS} active={activeTab} onChange={setActiveTab} />

      <motion.div
        key={activeTab}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
        style={{ marginTop: 32 }}
      >
        {activeTab === 'Pipeline' && <PipelineView />}
        {activeTab === 'Reunioes' && <ReunioesView />}
        {activeTab === 'Insights' && <InsightsView />}
      </motion.div>
    </div>
  )
}
