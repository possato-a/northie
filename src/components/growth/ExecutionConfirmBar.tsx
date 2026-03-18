import { useState } from 'react'
import { motion } from 'framer-motion'
import type { CollabPhase, ExecutionProgress } from '../../hooks/useCollaborationSession'

interface ExecutionConfirmBarProps {
  phase: CollabPhase
  executionChannel: { label: string; color: string }
  totalCustomers: number
  draftMessage: string
  executionProgress: ExecutionProgress
  onAbandon: () => void
  onConfirm: () => void
}

function ChannelIcon({ channel }: { channel: string }) {
  if (channel === 'WhatsApp') {
    return (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
        <path d="M12 0C5.373 0 0 5.373 0 12c0 2.126.553 4.124 1.523 5.859L0 24l6.335-1.493A11.924 11.924 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.885 0-3.65-.511-5.168-1.401l-.371-.22-3.764.887.927-3.653-.243-.388A9.953 9.953 0 0 1 2 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z" />
      </svg>
    )
  }
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
    </svg>
  )
}

function Tooltip({ text, children }: { text: string; children: React.ReactNode }) {
  const [visible, setVisible] = useState(false)
  return (
    <div
      style={{ position: 'relative', display: 'inline-block' }}
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
    >
      {children}
      {visible && (
        <div style={{
          position: 'absolute',
          bottom: '100%',
          right: 0,
          marginBottom: 6,
          background: 'var(--color-text-primary)',
          color: 'var(--color-bg-primary)',
          fontFamily: 'var(--font-sans)',
          fontSize: 11,
          padding: '4px 10px',
          borderRadius: 'var(--radius-sm)',
          whiteSpace: 'nowrap' as const,
          pointerEvents: 'none' as const,
          zIndex: 10,
        }}>
          {text}
        </div>
      )}
    </div>
  )
}

export default function ExecutionConfirmBar({
  phase,
  executionChannel,
  totalCustomers,
  draftMessage,
  executionProgress,
  onAbandon,
  onConfirm,
}: ExecutionConfirmBarProps) {
  const canConfirm = draftMessage.trim().length > 0

  if (phase === 'executing') {
    const pct = executionProgress.total > 0
      ? Math.min(100, Math.round((executionProgress.sent / executionProgress.total) * 100))
      : 0

    return (
      <div style={{
        height: 72,
        display: 'flex',
        alignItems: 'center',
        padding: '0 24px',
        borderTop: '1px solid var(--color-border)',
        background: 'var(--color-bg-primary)',
        flexShrink: 0,
        gap: 20,
      }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{
              fontFamily: 'var(--font-sans)',
              fontSize: 12,
              color: 'var(--color-text-secondary)',
            }}>
              Enviando {executionProgress.sent} de {executionProgress.total} mensagens...
            </span>
            {executionProgress.failed > 0 && (
              <span style={{
                fontFamily: 'var(--font-sans)',
                fontSize: 11,
                color: '#EF4444',
              }}>
                {executionProgress.failed} {executionProgress.failed === 1 ? 'falha' : 'falhas'}
              </span>
            )}
          </div>
          <div style={{
            height: 4,
            background: 'var(--color-bg-secondary)',
            borderRadius: 99,
            overflow: 'hidden',
          }}>
            <motion.div
              animate={{ width: `${pct}%` }}
              transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
              style={{
                height: '100%',
                background: '#FF5900',
                borderRadius: 99,
              }}
            />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={{
      height: 72,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 24px',
      borderTop: '1px solid var(--color-border)',
      background: 'var(--color-bg-primary)',
      flexShrink: 0,
    }}>
      {/* Left: channel info */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ color: executionChannel.color, display: 'flex', alignItems: 'center' }}>
          <ChannelIcon channel={executionChannel.label} />
        </span>
        <span style={{
          fontFamily: 'var(--font-sans)',
          fontSize: 13,
          color: 'var(--color-text-secondary)',
        }}>
          {executionChannel.label}
        </span>
        <span style={{
          fontFamily: 'var(--font-sans)',
          fontSize: 11,
          color: 'var(--color-text-tertiary)',
          background: 'var(--color-bg-secondary)',
          border: '1px solid var(--color-border)',
          borderRadius: 99,
          padding: '1px 8px',
        }}>
          {totalCustomers} {totalCustomers === 1 ? 'cliente' : 'clientes'}
        </span>
      </div>

      {/* Right: action buttons */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <motion.button
          onClick={onAbandon}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          style={{
            padding: '7px 14px',
            background: 'transparent',
            color: 'var(--color-text-tertiary)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-md)',
            fontFamily: 'var(--font-sans)',
            fontSize: 12,
            cursor: 'pointer',
          }}
        >
          Abandonar
        </motion.button>

        {canConfirm ? (
          <motion.button
            onClick={onConfirm}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            style={{
              padding: '7px 20px',
              background: '#FF5900',
              color: 'white',
              border: 'none',
              borderRadius: 'var(--radius-md)',
              fontFamily: 'var(--font-sans)',
              fontSize: 12,
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            Confirmar e Enviar
          </motion.button>
        ) : (
          <Tooltip text="Aguarde o agente criar a mensagem">
            <button
              disabled
              style={{
                padding: '7px 20px',
                background: 'var(--color-bg-secondary)',
                color: 'var(--color-text-tertiary)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-md)',
                fontFamily: 'var(--font-sans)',
                fontSize: 12,
                cursor: 'not-allowed',
                opacity: 0.7,
              }}
            >
              Confirmar e Enviar
            </button>
          </Tooltip>
        )}
      </div>
    </div>
  )
}
