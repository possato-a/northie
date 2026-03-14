import { motion } from 'framer-motion'
import { AGENT_GROUPS, AgentInfo } from '../../constants/agentDefinitions'

interface AgentSelectorProps {
  onSelect: (agentId: string) => void
}

const GROUP_ORDER = [
  'Orquestrador',
  'Aquisição & Mídia Paga',
  'Financeiro & Receita',
  'Retenção & Comportamento',
  'Produto & Operações',
  'Relacionamento & CX',
  'Valuation & Saúde',
]

export default function AgentSelector({ onSelect }: AgentSelectorProps) {
  // Build a flat index for staggered entrance delays
  const allAgents: AgentInfo[] = GROUP_ORDER.flatMap(g => AGENT_GROUPS[g] ?? [])
  const globalIndex = (agent: AgentInfo) => allAgents.findIndex(a => a.id === agent.id)

  return (
    <div style={{
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '32px 32px 32px',
      overflowY: 'auto',
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
          maxWidth: 820,
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
          Com qual agente você quer conversar?
        </h2>
        <p style={{
          fontFamily: 'var(--font-sans)',
          fontSize: 13,
          color: 'var(--color-text-tertiary)',
          margin: '0 0 32px',
          textAlign: 'center',
          lineHeight: 1.5,
        }}>
          Cada agente acessa dados reais da sua conta.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 24, width: '100%' }}>
          {GROUP_ORDER.map(group => {
            const agents = AGENT_GROUPS[group]
            if (!agents || agents.length === 0) return null
            return (
              <div key={group}>
                <p style={{
                  fontFamily: 'var(--font-sans)',
                  fontSize: 10,
                  fontWeight: 400,
                  color: 'var(--color-text-tertiary)',
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  margin: '0 0 10px',
                }}>
                  {group}
                </p>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
                  gap: 10,
                }}>
                  {agents.map(agent => {
                    const i = globalIndex(agent)
                    const sourceBadges = agent.sources.slice(0, 2)
                    return (
                      <motion.button
                        key={agent.id}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{
                          duration: 0.3,
                          ease: [0.25, 0.1, 0.25, 1],
                          delay: i * 0.03,
                        }}
                        whileHover={{ y: -2, boxShadow: 'var(--shadow-md)' }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => onSelect(agent.id)}
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 8,
                          padding: 14,
                          background: 'var(--color-bg-primary)',
                          border: '1px solid var(--color-border)',
                          borderRadius: 'var(--radius-lg)',
                          cursor: 'pointer',
                          textAlign: 'left',
                        }}
                      >
                        <span style={{
                          fontFamily: 'var(--font-sans)',
                          fontSize: 13,
                          fontWeight: 500,
                          color: 'var(--color-text-primary)',
                          lineHeight: 1.3,
                        }}>
                          {agent.name}
                        </span>
                        <span style={{
                          fontFamily: 'var(--font-sans)',
                          fontSize: 11,
                          color: 'var(--color-text-tertiary)',
                          lineHeight: 1.4,
                          overflow: 'hidden',
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                        }}>
                          {agent.description}
                        </span>
                        {sourceBadges.length > 0 && (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 2 }}>
                            {sourceBadges.map(src => (
                              <span
                                key={src}
                                style={{
                                  fontFamily: 'var(--font-sans)',
                                  fontSize: 9,
                                  color: 'var(--color-text-tertiary)',
                                  background: 'var(--color-bg-secondary)',
                                  border: '1px solid var(--color-border)',
                                  borderRadius: 4,
                                  padding: '1px 5px',
                                  lineHeight: 1.6,
                                  letterSpacing: '0.02em',
                                }}
                              >
                                {src}
                              </span>
                            ))}
                          </div>
                        )}
                      </motion.button>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      </motion.div>
    </div>
  )
}
