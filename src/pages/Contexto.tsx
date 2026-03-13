import { useState } from 'react'
import { motion } from 'framer-motion'
import TopBar from '../components/layout/TopBar'
import {
  PageHeader, SectionLabel, Divider, Btn,
  Input, Textarea, SelectField,
} from '../components/ui/shared'

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
        cursor: 'pointer',
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
  )
}

// ── Page Component ───────────────────────────────────────────────────────────

export default function Contexto({ onToggleChat }: { onToggleChat?: () => void }) {
  const [segmento, setSegmento] = useState('')
  const [icp, setIcp] = useState('')
  const [ticket, setTicket] = useState('')
  const [ciclo, setCiclo] = useState('')
  const [diferenciais, setDiferenciais] = useState('')
  const [instrucoes, setInstrucoes] = useState('')
  const [contextoAdicional, setContextoAdicional] = useState('')

  return (
    <div style={{ paddingTop: 28, paddingBottom: 80 }}>
      <TopBar onToggleChat={onToggleChat} />

      <PageHeader
        title="Contexto do Negócio"
        subtitle="Treine a IA com informações específicas do seu negócio."
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
        Quanto mais contexto você alimentar, mais precisas serão as recomendações do Growth Engine e as análises da Ask Northie.
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
        {/* Left column — Perfil do Negócio */}
        <SectionCard>
          <SectionLabel gutterBottom={20}>Perfil do Negócio</SectionLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <Input
              label="Segmento"
              placeholder="Ex: SaaS B2B, E-commerce DTC, Infoproduto..."
              value={segmento}
              onChange={e => setSegmento(e.target.value)}
            />
            <Input
              label="ICP (Cliente Ideal)"
              placeholder="Ex: Gestores de RH em empresas de 50-200 funcionários"
              value={icp}
              onChange={e => setIcp(e.target.value)}
            />
            <Input
              label="Ticket Médio"
              placeholder="R$ 0,00"
              value={ticket}
              onChange={e => setTicket(e.target.value)}
            />
            <SelectField
              label="Ciclo de Vendas"
              value={ciclo}
              onChange={e => setCiclo(e.target.value)}
            >
              <option value="" disabled>Selecione...</option>
              <option value="direto">Direto (checkout)</option>
              <option value="curto">Curto (&lt; 7 dias)</option>
              <option value="medio">Médio (7-30 dias)</option>
              <option value="consultivo">Consultivo (30+ dias)</option>
            </SelectField>
            <Textarea
              label="Diferenciais do produto"
              placeholder="O que torna seu produto único? Quais problemas resolve?"
              value={diferenciais}
              onChange={e => setDiferenciais(e.target.value)}
              rows={4}
            />
          </div>
        </SectionCard>

        {/* Right column — Instruções para a IA */}
        <SectionCard>
          <SectionLabel gutterBottom={20}>Instruções para a IA</SectionLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <Textarea
              label="Instruções personalizadas"
              placeholder="Ex: Nunca recomendar desconto acima de 20%. Sempre considerar que janeiro é nosso mês mais fraco. Priorizar retenção sobre aquisição neste trimestre."
              value={instrucoes}
              onChange={e => setInstrucoes(e.target.value)}
              rows={6}
            />
            <Textarea
              label="Contexto adicional"
              placeholder="Informações sobre o mercado, concorrentes, estratégia atual..."
              value={contextoAdicional}
              onChange={e => setContextoAdicional(e.target.value)}
              rows={4}
            />

            <Divider margin="8px 0" />

            <SectionLabel gutterBottom={12}>Arquivos de Referência</SectionLabel>
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
        <SectionLabel>O que a IA sabe sobre você</SectionLabel>

        <SectionCard style={{ padding: '24px' }}>
          <p style={{
            fontFamily: 'var(--font-sans)',
            fontSize: 'var(--text-base)',
            color: 'var(--color-text-secondary)',
            margin: 0,
            lineHeight: 1.6,
          }}>
            A IA ainda não possui contexto sobre seu negócio. Preencha os campos acima para começar a personalizar suas análises e recomendações.
          </p>
        </SectionCard>

        <div style={{ marginTop: 24 }}>
          <Btn variant="primary" size="lg" disabled>
            Salvar Contexto
          </Btn>
        </div>
      </motion.div>
    </div>
  )
}
