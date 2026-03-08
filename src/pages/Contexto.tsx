import { useState } from 'react'
import { motion } from 'framer-motion'
import TopBar from '../components/layout/TopBar'
import {
  PageHeader, SectionLabel, Divider, Btn,
  Input, Textarea, SelectField,
} from '../components/ui/shared'

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
        Pitch deck, tabela de precos, pesquisas de cliente
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
          marginBottom: 40,
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
          gap: 48,
        }}
      >
        {/* Left column — Perfil do Negocio */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <SectionLabel gutterBottom={0}>Perfil do Negocio</SectionLabel>

          <Input
            label="Segmento"
            placeholder="Ex: SaaS B2B, E-commerce DTC, Infoproduto..."
            value={segmento}
            onChange={e => setSegmento(e.target.value)}
          />
          <Input
            label="ICP (Cliente Ideal)"
            placeholder="Ex: Gestores de RH em empresas de 50-200 funcionarios"
            value={icp}
            onChange={e => setIcp(e.target.value)}
          />
          <Input
            label="Ticket Medio"
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
            <option value="medio">Medio (7-30 dias)</option>
            <option value="consultivo">Consultivo (30+ dias)</option>
          </SelectField>
          <Textarea
            label="Diferenciais do produto"
            placeholder="O que torna seu produto unico? Quais problemas resolve?"
            value={diferenciais}
            onChange={e => setDiferenciais(e.target.value)}
            rows={4}
          />
        </div>

        {/* Right column — Instrucoes para a IA */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <SectionLabel gutterBottom={0}>Instrucoes para a IA</SectionLabel>

          <Textarea
            label="Instrucoes personalizadas"
            placeholder="Ex: Nunca recomendar desconto acima de 20%. Sempre considerar que janeiro e nosso mes mais fraco. Priorizar retencao sobre aquisicao neste trimestre."
            value={instrucoes}
            onChange={e => setInstrucoes(e.target.value)}
            rows={6}
          />
          <Textarea
            label="Contexto adicional"
            placeholder="Informacoes sobre o mercado, concorrentes, estrategia atual..."
            value={contextoAdicional}
            onChange={e => setContextoAdicional(e.target.value)}
            rows={4}
          />

          <Divider margin="32px 0" />

          <SectionLabel gutterBottom={0}>Arquivos de Referencia</SectionLabel>
          <DropZone />
        </div>
      </motion.div>

      {/* Bottom section — O que a IA sabe */}
      <Divider margin="48px 0" />

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.35, ease: [0.25, 0.1, 0.25, 1] }}
      >
        <SectionLabel>O que a IA sabe sobre voce</SectionLabel>

        <div style={{
          background: 'var(--color-bg-secondary)',
          borderRadius: 'var(--radius-lg)',
          padding: 24,
        }}>
          <p style={{
            fontFamily: 'var(--font-sans)',
            fontSize: 'var(--text-base)',
            color: 'var(--color-text-secondary)',
            margin: 0,
            lineHeight: 1.6,
          }}>
            A IA ainda nao possui contexto sobre seu negocio. Preencha os campos acima para comecar a personalizar suas analises e recomendacoes.
          </p>
        </div>

        <div style={{ marginTop: 32 }}>
          <Btn variant="primary" size="lg" disabled>
            Salvar Contexto
          </Btn>
        </div>
      </motion.div>
    </div>
  )
}
