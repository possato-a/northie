import { useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useCollaborationSession } from '../../hooks/useCollaborationSession'
import CustomerSegmentPreview from './CustomerSegmentPreview'
import CollaborationChat from './CollaborationChat'
import ExecutionConfirmBar from './ExecutionConfirmBar'

// ── Types ──────────────────────────────────────────────────────────────────────

export interface CollaborationModalProps {
  recommendationId: string
  recommendationType: string
  recommendationTitle: string
  onClose: () => void
  onExecutionComplete: () => void
}

const EXEC_CHANNEL_MAP: Record<string, { label: string; color: string }> = {
  reativacao_alto_ltv:  { label: 'WhatsApp', color: '#25D366' },
  em_risco_alto_valor:  { label: 'WhatsApp', color: '#25D366' },
  upsell_cohort:        { label: 'E-mail',   color: '#3B82F6' },
  queda_retencao_cohort:{ label: 'E-mail',   color: '#3B82F6' },
  cac_vs_ltv_deficit:   { label: 'E-mail',   color: '#3B82F6' },
}

const TYPE_DISPLAY: Record<string, string> = {
  reativacao_alto_ltv:   'Reativação de Alto LTV',
  em_risco_alto_valor:   'Clientes em Risco',
  upsell_cohort:         'Upsell por Cohort',
  queda_retencao_cohort: 'Queda de Retenção',
  cac_vs_ltv_deficit:    'Deficit CAC vs LTV',
}

// ── Loading spinner ────────────────────────────────────────────────────────────

function Spinner() {
  return (
    <motion.div
      animate={{ rotate: 360 }}
      transition={{ duration: 1.1, repeat: Infinity, ease: 'linear' }}
      style={{ width: 24, height: 24 }}
    >
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="10" stroke="var(--color-border)" strokeWidth="2" />
        <path d="M12 2A10 10 0 0 1 22 12" stroke="#FF5900" strokeWidth="2" strokeLinecap="round" />
      </svg>
    </motion.div>
  )
}

// ── Done state ─────────────────────────────────────────────────────────────────

function DoneState({
  progress,
  onClose,
}: {
  progress: { sent: number; total: number; failed: number }
  onClose: () => void
}) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        gap: 20,
        padding: 48,
        textAlign: 'center' as const,
      }}
    >
      {/* Success icon */}
      <div style={{
        width: 56,
        height: 56,
        borderRadius: '50%',
        background: 'rgba(34,197,94,0.08)',
        border: '1px solid rgba(34,197,94,0.25)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
          <path d="M5 13L9 17L19 7" stroke="#22C55E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <p style={{
          fontFamily: 'var(--font-sans)',
          fontSize: 18,
          fontWeight: 600,
          color: 'var(--color-text-primary)',
          letterSpacing: '-0.3px',
          margin: 0,
        }}>
          Campanha executada com sucesso
        </p>
        <p style={{
          fontFamily: 'var(--font-sans)',
          fontSize: 13,
          color: 'var(--color-text-secondary)',
          margin: 0,
        }}>
          {progress.sent} {progress.sent === 1 ? 'mensagem enviada' : 'mensagens enviadas'}
          {progress.failed > 0 && (
            <span style={{ color: '#EF4444' }}>
              {' '}&middot; {progress.failed} {progress.failed === 1 ? 'falha' : 'falhas'}
            </span>
          )}
        </p>
      </div>

      <motion.button
        onClick={onClose}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        style={{
          padding: '10px 28px',
          background: '#FF5900',
          color: 'white',
          border: 'none',
          borderRadius: 'var(--radius-md)',
          fontFamily: 'var(--font-sans)',
          fontSize: 13,
          fontWeight: 500,
          cursor: 'pointer',
          marginTop: 8,
        }}
      >
        Fechar
      </motion.button>
    </motion.div>
  )
}

// ── Main modal ─────────────────────────────────────────────────────────────────

export default function CollaborationModal({
  recommendationId,
  recommendationType,
  recommendationTitle,
  onClose,
  onExecutionComplete,
}: CollaborationModalProps) {
  const session = useCollaborationSession()
  const {
    phase,
    messages,
    segmentItems,
    draftMessage,
    customersWithPhone,
    customersWithoutPhone,
    executionProgress,
    inputValue,
    isTyping,
    error,
    setInputValue,
    startSession,
    sendMessage,
    confirmExecution,
    abandon,
  } = session

  const execChannel = EXEC_CHANNEL_MAP[recommendationType] ?? { label: 'E-mail', color: '#3B82F6' }
  const typeDisplay = TYPE_DISPLAY[recommendationType] ?? recommendationTitle

  useEffect(() => {
    startSession(recommendationId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recommendationId])

  const handleAbandon = useCallback(async () => {
    await abandon()
    onClose()
  }, [abandon, onClose])

  const handleDone = useCallback(() => {
    onExecutionComplete()
    onClose()
  }, [onExecutionComplete, onClose])

  const handleUseDraft = useCallback((draft: string) => {
    setInputValue(draft)
  }, [setInputValue])

  const handleRetry = useCallback(() => {
    startSession(recommendationId)
  }, [startSession, recommendationId])

  return (
    <AnimatePresence>
      {/* Backdrop */}
      <motion.div
        key="collab-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        onClick={phase === 'collaborating' ? handleAbandon : undefined}
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 200,
          background: 'rgba(0,0,0,0.45)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 20,
        }}
      >
        {/* Modal card */}
        <motion.div
          key="collab-card"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 12 }}
          transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
          onClick={e => e.stopPropagation()}
          style={{
            width: 'min(1100px, 95vw)',
            height: 'min(720px, 90vh)',
            background: 'var(--color-bg-primary)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-lg)',
            boxShadow: '0 24px 64px rgba(0,0,0,0.22)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          {/* Modal header */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '16px 24px',
            borderBottom: '1px solid var(--color-border)',
            flexShrink: 0,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{
                fontFamily: 'var(--font-sans)',
                fontSize: 10,
                fontWeight: 400,
                letterSpacing: '0.06em',
                textTransform: 'uppercase' as const,
                color: 'var(--color-text-tertiary)',
              }}>
                Ativar
              </span>
              <span style={{
                fontFamily: 'var(--font-sans)',
                fontSize: 14,
                fontWeight: 500,
                color: 'var(--color-text-primary)',
                letterSpacing: '-0.2px',
              }}>
                {typeDisplay}
              </span>
              {phase === 'collaborating' && (
                <span style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                  fontFamily: 'var(--font-sans)',
                  fontSize: 11,
                  color: '#FF5900',
                  background: 'rgba(255,89,0,0.06)',
                  border: '1px solid rgba(255,89,0,0.2)',
                  borderRadius: 99,
                  padding: '2px 8px',
                }}>
                  <motion.span
                    animate={{ opacity: [1, 0.3, 1] }}
                    transition={{ duration: 1.8, repeat: Infinity }}
                    style={{ display: 'block', width: 5, height: 5, borderRadius: '50%', background: '#FF5900' }}
                  />
                  Agente ativo
                </span>
              )}
            </div>
            <motion.button
              onClick={phase === 'executing' ? undefined : handleAbandon}
              whileHover={phase !== 'executing' ? { scale: 1.05 } : {}}
              whileTap={phase !== 'executing' ? { scale: 0.95 } : {}}
              disabled={phase === 'executing'}
              style={{
                background: 'none',
                border: 'none',
                cursor: phase === 'executing' ? 'not-allowed' : 'pointer',
                color: 'var(--color-text-tertiary)',
                padding: 6,
                borderRadius: 'var(--radius-sm)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                opacity: phase === 'executing' ? 0.4 : 1,
              }}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M4 4L12 12M12 4L4 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </motion.button>
          </div>

          {/* Modal body */}
          {phase === 'loading' && (
            <div style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 16,
            }}>
              <Spinner />
              <p style={{
                fontFamily: 'var(--font-sans)',
                fontSize: 13,
                color: 'var(--color-text-secondary)',
                margin: 0,
              }}>
                Preparando sessao de colaboracao...
              </p>
            </div>
          )}

          {phase === 'error' && (
            <div style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 16,
              padding: 48,
              textAlign: 'center' as const,
            }}>
              <div style={{
                width: 48,
                height: 48,
                borderRadius: '50%',
                background: 'rgba(239,68,68,0.08)',
                border: '1px solid rgba(239,68,68,0.25)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <path d="M12 9v4M12 17h.01" stroke="#EF4444" strokeWidth="2" strokeLinecap="round" />
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" stroke="#EF4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <p style={{
                fontFamily: 'var(--font-sans)',
                fontSize: 14,
                color: 'var(--color-text-primary)',
                margin: 0,
                fontWeight: 500,
              }}>
                {error ?? 'Erro ao iniciar colaboracao.'}
              </p>
              <motion.button
                onClick={handleRetry}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                style={{
                  padding: '9px 22px',
                  background: 'var(--color-bg-secondary)',
                  color: 'var(--color-text-primary)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-md)',
                  fontFamily: 'var(--font-sans)',
                  fontSize: 13,
                  cursor: 'pointer',
                }}
              >
                Tentar novamente
              </motion.button>
            </div>
          )}

          {(phase === 'done') && (
            <div style={{ flex: 1 }}>
              <DoneState progress={executionProgress} onClose={handleDone} />
            </div>
          )}

          {(phase === 'collaborating' || phase === 'confirming' || phase === 'executing') && (
            <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
              {/* Left panel — 38% */}
              <div style={{
                width: '38%',
                borderRight: '1px solid var(--color-border)',
                flexShrink: 0,
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
              }}>
                <CustomerSegmentPreview
                  items={segmentItems}
                  customersWithPhone={customersWithPhone}
                  customersWithoutPhone={customersWithoutPhone}
                />
              </div>

              {/* Right panel — 62% */}
              <div style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
                minWidth: 0,
              }}>
                {/* Chat fills remaining space above confirm bar */}
                <div style={{ flex: 1, overflow: 'hidden' }}>
                  <CollaborationChat
                    messages={messages}
                    isTyping={isTyping}
                    draftMessage={draftMessage}
                    inputValue={inputValue}
                    onInputChange={setInputValue}
                    onSend={sendMessage}
                    onUseDraft={handleUseDraft}
                  />
                </div>

                {/* Sticky confirm bar */}
                <ExecutionConfirmBar
                  phase={phase}
                  executionChannel={execChannel}
                  totalCustomers={customersWithPhone}
                  draftMessage={draftMessage}
                  executionProgress={executionProgress}
                  onAbandon={handleAbandon}
                  onConfirm={confirmExecution}
                />
              </div>
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
