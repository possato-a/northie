import { useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { CollabMessage } from '../../hooks/useCollaborationSession'

interface CollaborationChatProps {
  messages: CollabMessage[]
  isTyping: boolean
  draftMessage: string
  inputValue: string
  onInputChange: (v: string) => void
  onSend: () => void
  onUseDraft: (draft: string) => void
}

function TypingIndicator() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '12px 14px' }}>
      {[0, 1, 2].map(i => (
        <motion.span
          key={i}
          animate={{ opacity: [0.3, 1, 0.3] }}
          transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.15, ease: 'easeInOut' }}
          style={{
            display: 'block',
            width: 5,
            height: 5,
            borderRadius: '50%',
            background: 'var(--color-text-tertiary)',
            flexShrink: 0,
          }}
        />
      ))}
    </div>
  )
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

export default function CollaborationChat({
  messages,
  isTyping,
  draftMessage,
  inputValue,
  onInputChange,
  onSend,
  onUseDraft,
}: CollaborationChatProps) {
  const listRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Auto-scroll to bottom on new message
  useEffect(() => {
    const el = listRef.current
    if (!el) return
    el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
  }, [messages.length, isTyping])

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    const lineHeight = 22
    const maxLines = 4
    el.style.height = Math.min(el.scrollHeight, lineHeight * maxLines + 16) + 'px'
  }, [inputValue])

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (!isTyping && inputValue.trim()) onSend()
    }
  }, [isTyping, inputValue, onSend])

  const canSend = !isTyping && inputValue.trim().length > 0

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      overflow: 'hidden',
    }}>
      {/* Message list */}
      <div
        ref={listRef}
        style={{
          flex: 1,
          overflowY: 'auto',
          scrollbarWidth: 'thin' as const,
          padding: '20px 24px',
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}
      >
        <AnimatePresence initial={false}>
          {messages.map((msg, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, ease: [0.25, 0.1, 0.25, 1] }}
              style={{
                display: 'flex',
                justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
              }}
            >
              <div style={{ maxWidth: '82%' }}>
                <div style={{
                  padding: '11px 14px',
                  background: msg.role === 'assistant'
                    ? 'var(--color-bg-secondary)'
                    : 'transparent',
                  border: msg.role === 'assistant'
                    ? '1px solid var(--color-border)'
                    : '1px solid rgba(255,89,0,0.2)',
                  borderRadius: msg.role === 'assistant'
                    ? '0px 12px 12px 12px'
                    : '12px 12px 0px 12px',
                }}>
                  <p style={{
                    fontFamily: 'var(--font-sans)',
                    fontSize: 13,
                    lineHeight: 1.6,
                    color: msg.role === 'assistant'
                      ? 'var(--color-text-primary)'
                      : '#FF5900',
                    margin: 0,
                    whiteSpace: 'pre-wrap' as const,
                    wordBreak: 'break-word' as const,
                  }}>
                    {msg.content}
                  </p>
                </div>
                <span style={{
                  display: 'block',
                  fontFamily: 'var(--font-sans)',
                  fontSize: 10,
                  color: 'var(--color-text-tertiary)',
                  marginTop: 4,
                  textAlign: msg.role === 'user' ? 'right' as const : 'left' as const,
                  letterSpacing: '0.02em',
                }}>
                  {formatTime(msg.timestamp)}
                </span>
              </div>
            </motion.div>
          ))}

          {isTyping && (
            <motion.div
              key="typing"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              style={{ display: 'flex', justifyContent: 'flex-start' }}
            >
              <div style={{
                background: 'var(--color-bg-secondary)',
                border: '1px solid var(--color-border)',
                borderRadius: '0px 12px 12px 12px',
              }}>
                <TypingIndicator />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Draft message block */}
      <AnimatePresence>
        {draftMessage && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            transition={{ duration: 0.25, ease: [0.25, 0.1, 0.25, 1] }}
            style={{
              margin: '0 24px',
              padding: '12px 14px',
              background: 'rgba(255,89,0,0.04)',
              border: '1px solid rgba(255,89,0,0.2)',
              borderRadius: 'var(--radius-md)',
              flexShrink: 0,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 8 }}>
              <span style={{
                fontFamily: 'var(--font-sans)',
                fontSize: 10,
                fontWeight: 500,
                letterSpacing: '0.06em',
                textTransform: 'uppercase' as const,
                color: '#FF5900',
              }}>
                Rascunho da mensagem
              </span>
              <motion.button
                onClick={() => onUseDraft(draftMessage)}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                style={{
                  fontFamily: 'var(--font-sans)',
                  fontSize: 11,
                  color: '#FF5900',
                  background: 'transparent',
                  border: '1px solid rgba(255,89,0,0.35)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '3px 10px',
                  cursor: 'pointer',
                  flexShrink: 0,
                  fontWeight: 500,
                }}
              >
                Usar este rascunho
              </motion.button>
            </div>
            <p style={{
              fontFamily: 'var(--font-sans)',
              fontSize: 12,
              color: 'var(--color-text-secondary)',
              lineHeight: 1.6,
              margin: 0,
              whiteSpace: 'pre-wrap' as const,
            }}>
              {draftMessage}
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Input area */}
      <div style={{
        padding: '12px 24px 16px',
        borderTop: '1px solid var(--color-border)',
        flexShrink: 0,
        marginTop: 8,
      }}>
        {isTyping && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              fontFamily: 'var(--font-sans)',
              fontSize: 11,
              color: 'var(--color-text-tertiary)',
              margin: '0 0 8px',
              letterSpacing: '0.02em',
            }}
          >
            Agente esta digitando...
          </motion.p>
        )}
        <div style={{
          display: 'flex',
          gap: 10,
          alignItems: 'flex-end',
        }}>
          <textarea
            ref={textareaRef}
            value={inputValue}
            onChange={e => onInputChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Responda ao agente ou edite a mensagem..."
            rows={1}
            style={{
              flex: 1,
              fontFamily: 'var(--font-sans)',
              fontSize: 13,
              color: 'var(--color-text-primary)',
              background: 'var(--color-bg-secondary)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-md)',
              padding: '10px 14px',
              resize: 'none' as const,
              outline: 'none',
              lineHeight: 1.5,
              minHeight: 42,
              transition: 'border-color 0.15s ease',
            }}
            onFocus={e => { e.currentTarget.style.borderColor = 'rgba(255,89,0,0.4)' }}
            onBlur={e => { e.currentTarget.style.borderColor = 'var(--color-border)' }}
          />
          <motion.button
            onClick={onSend}
            disabled={!canSend}
            whileHover={canSend ? { scale: 1.02 } : {}}
            whileTap={canSend ? { scale: 0.97 } : {}}
            style={{
              width: 42,
              height: 42,
              borderRadius: 'var(--radius-md)',
              background: canSend ? '#FF5900' : 'var(--color-bg-secondary)',
              border: canSend ? 'none' : '1px solid var(--color-border)',
              cursor: canSend ? 'pointer' : 'not-allowed',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              transition: 'background 0.15s ease',
            }}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              style={{ color: canSend ? 'white' : 'var(--color-text-tertiary)' }}
            >
              <path
                d="M14 2L7 9M14 2L9.5 14L7 9M14 2L2 6.5L7 9"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </motion.button>
        </div>
        <p style={{
          fontFamily: 'var(--font-sans)',
          fontSize: 10,
          color: 'var(--color-text-tertiary)',
          margin: '6px 0 0',
          letterSpacing: '0.02em',
        }}>
          Enter para enviar · Shift+Enter para nova linha
        </p>
      </div>
    </div>
  )
}
