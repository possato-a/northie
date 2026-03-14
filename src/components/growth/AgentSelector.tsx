import { motion } from 'framer-motion'

interface AgentSelectorProps {
  onSelect: (agentId: string) => void
}

const AGENTS = [
  {
    id: 'roas',
    label: 'ROAS Real',
    description: 'Analisa ROAS superficial vs LTV real por campanha',
  },
  {
    id: 'churn',
    label: 'Churn Detector',
    description: 'Detecta risco de abandono antes que aconteça',
  },
  {
    id: 'ltv',
    label: 'LTV por Canal',
    description: 'Revela qual canal traz os clientes mais valiosos',
  },
  {
    id: 'audience',
    label: 'Audience Quality',
    description: 'Transforma base em audiências de alta conversão',
  },
  {
    id: 'upsell',
    label: 'Upsell Timing',
    description: 'Identifica janela de máxima propensão por cliente',
  },
]

export default function AgentSelector({ onSelect }: AgentSelectorProps) {
  return (
    <div style={{
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '0 32px 60px',
      overflow: 'hidden',
    }}>
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.25, 0.1, 0.25, 1] }}
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          width: '100%',
          maxWidth: 680,
        }}
      >
        <h2 style={{
          fontFamily: 'var(--font-sans)',
          fontSize: 22,
          fontWeight: 500,
          letterSpacing: '-0.4px',
          color: 'var(--color-text-primary)',
          margin: '0 0 6px',
          textAlign: 'center',
        }}>
          Escolha um agente
        </h2>
        <p style={{
          fontFamily: 'var(--font-sans)',
          fontSize: 13,
          color: 'var(--color-text-tertiary)',
          margin: '0 0 28px',
          textAlign: 'center',
          lineHeight: 1.5,
        }}>
          Cada agente acessa dados reais da sua conta e responde com análise específica.
        </p>

        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 12,
          justifyContent: 'center',
          width: '100%',
        }}>
          {AGENTS.map((agent, i) => (
            <motion.button
              key={agent.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: 0.3,
                ease: [0.25, 0.1, 0.25, 1],
                delay: i * 0.06,
              }}
              whileHover={{ y: -2 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => onSelect(agent.id)}
              style={{
                minWidth: 200,
                flex: '0 0 auto',
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
                padding: 18,
                background: 'var(--color-bg-primary)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-lg)',
                cursor: 'pointer',
                textAlign: 'left',
              }}
            >
              <div style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: 'var(--color-primary)',
                flexShrink: 0,
              }} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{
                  fontFamily: 'var(--font-sans)',
                  fontSize: 14,
                  fontWeight: 500,
                  color: 'var(--color-text-primary)',
                  lineHeight: 1.3,
                }}>
                  {agent.label}
                </span>
                <span style={{
                  fontFamily: 'var(--font-sans)',
                  fontSize: 12,
                  color: 'var(--color-text-tertiary)',
                  lineHeight: 1.45,
                }}>
                  {agent.description}
                </span>
              </div>
            </motion.button>
          ))}
        </div>
      </motion.div>
    </div>
  )
}
