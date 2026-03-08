import { useState, useRef, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { AskNorthieIcon } from '../../icons'
import { aiApi } from '../../lib/api'

type AIModel = 'sonnet' | 'opus' | 'haiku'
const MODELS: AIModel[] = ['sonnet', 'opus', 'haiku']
const MODEL_LABELS: Record<AIModel, string> = { sonnet: 'Sonnet', opus: 'Opus', haiku: 'Haiku' }

interface Message {
    id: string
    role: 'user' | 'assistant' | 'system'
    content: string
}

function TypewriterText({ text, onDone }: { text: string; onDone: () => void }) {
    const [count, setCount] = useState(0)
    const onDoneRef = useRef(onDone)
    onDoneRef.current = onDone

    useEffect(() => {
        setCount(0)
    }, [text])

    useEffect(() => {
        if (count >= text.length) {
            onDoneRef.current()
            return
        }
        const timer = setTimeout(() => setCount(c => c + 1), 7)
        return () => clearTimeout(timer)
    }, [count, text])

    return <>{text.slice(0, count)}</>
}

interface ChatSidebarProps {
    isOpen: boolean
    onClose: () => void
    context: string
    isFull?: boolean
    onToggleFull?: () => void
}

function ThinkingIndicator() {
    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', padding: '0 var(--space-6)' }}
        >
            <div style={{ display: 'flex', gap: 4 }}>
                {[0, 1, 2].map((i) => (
                    <motion.div
                        key={i}
                        animate={{ opacity: [0.3, 1, 0.3], scale: [1, 1.1, 1] }}
                        transition={{ duration: 1, repeat: Infinity, delay: i * 0.18 }}
                        style={{
                            width: 5, height: 5,
                            borderRadius: 'var(--radius-full)',
                            background: 'var(--color-primary)',
                        }}
                    />
                ))}
            </div>
            <span style={{
                fontFamily: 'var(--font-sans)',
                fontSize: 'var(--text-sm)',
                color: 'var(--color-text-tertiary)',
            }}>
                Processando...
            </span>
        </motion.div>
    )
}

function SuggestionChip({ label, onClick }: { label: string; onClick: () => void }) {
    return (
        <button
            onClick={onClick}
            className="tag tag-neutral"
            style={{
                cursor: 'pointer',
                border: '1px solid var(--color-border)',
                background: 'var(--color-bg-secondary)',
                color: 'var(--color-text-secondary)',
                transition: 'background var(--transition-base), color var(--transition-base)',
                padding: '4px 12px',
                borderRadius: 'var(--radius-md)',
                fontFamily: 'var(--font-sans)',
                fontSize: 'var(--text-sm)',
            }}
            onMouseEnter={e => {
                ; (e.currentTarget as HTMLButtonElement).style.background = 'var(--color-bg-tertiary)'
                    ; (e.currentTarget as HTMLButtonElement).style.color = 'var(--color-text-primary)'
            }}
            onMouseLeave={e => {
                ; (e.currentTarget as HTMLButtonElement).style.background = 'var(--color-bg-secondary)'
                    ; (e.currentTarget as HTMLButtonElement).style.color = 'var(--color-text-secondary)'
            }}
        >
            {label}
        </button>
    )
}

export default function ChatSidebar({ isOpen, onClose, context, isFull, onToggleFull }: ChatSidebarProps) {
    const [messages, setMessages] = useState<Message[]>([
        { id: '1', role: 'assistant', content: `Conectado. Contexto: ${context}. O que vamos analisar?` }
    ])
    const [isThinking, setIsThinking] = useState(false)
    const [input, setInput] = useState('')
    const [model, setModel] = useState<AIModel>('sonnet')
    const [animatingId, setAnimatingId] = useState<string | null>(null)
    const scrollRef = useRef<HTMLDivElement>(null)
    const mountedRef = useRef(true)

    useEffect(() => {
        mountedRef.current = true
        return () => { mountedRef.current = false }
    }, [])

    const suggestions = useMemo(() => {
        switch (context) {
            case 'Clientes': return ['Analisar Churn', 'Top 10 LTV', 'Insight RFM']
            case 'Vendas': return ['Previsão Mensal', 'Canal mais lucrativo', 'Ticket Médio']
            case 'Visão Geral': return ['Resumo Growth', 'Alerta de CAC', 'Performance Ads']
            case 'Northie Card': return ['Como aumentar meu score?', 'Quando serei aprovado?', 'Split explicado']
            case 'Northie Valuation': return ['Por que esse múltiplo?', 'Como aumentar valuation?', 'Benchmark do segmento']
            default: return ['Resumo do dia', 'Próximas ações']
        }
    }, [context])

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
        }
    }, [messages, isThinking])

    const handleSend = async (text?: string) => {
        const messageText = text || input
        if (!messageText.trim()) return

        const userMsg: Message = { id: Date.now().toString(), role: 'user', content: messageText }
        setMessages(prev => [...prev, userMsg])
        if (!text) setInput('')
        setIsThinking(true)

        try {
            const response = await aiApi.chat(messageText, context, model)
            if (!mountedRef.current) return
            const newId = Date.now().toString()
            const aiMsg: Message = {
                id: newId,
                role: 'assistant',
                content: response.data.content
            }
            setMessages(prev => [...prev, aiMsg])
            setAnimatingId(newId)
        } catch {
            if (!mountedRef.current) return
            setMessages(prev => [...prev, {
                id: Date.now().toString(),
                role: 'assistant',
                content: 'Desculpe, tive um problema. Verifique se o servidor está rodando.'
            }])
        } finally {
            if (mountedRef.current) setIsThinking(false)
        }
    }

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.aside
                    initial={{ x: isFull ? 0 : 380, opacity: 0 }}
                    animate={{ x: 0, width: isFull ? '100vw' : 380, opacity: 1 }}
                    exit={{ x: isFull ? 0 : 380, opacity: 0 }}
                    transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
                    style={{
                        position: 'fixed', top: 0, right: 0, bottom: 0,
                        background: 'var(--bg)',
                        borderLeft: '1px solid var(--color-border)',
                        zIndex: 400,
                        display: 'flex',
                        flexDirection: 'column',
                        boxShadow: isFull ? 'none' : 'var(--shadow-xl)',
                    }}
                >
                    {/* Header */}
                    <div style={{
                        padding: isFull ? '20px 64px' : '16px 24px',
                        borderBottom: '1px solid var(--color-border)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        background: 'var(--color-bg-primary)',
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <motion.div animate={{ rotate: isThinking ? [0, 8, -8, 0] : 0 }} transition={{ repeat: Infinity, duration: 2 }}>
                                <AskNorthieIcon />
                            </motion.div>
                            <div>
                                <span style={{
                                    fontFamily: 'var(--font-sans)',
                                    fontSize: 'var(--text-md)',
                                    fontWeight: 500,
                                    color: 'var(--color-text-primary)',
                                    letterSpacing: '-0.3px',
                                    display: 'block',
                                }}>
                                    Ask Northie
                                </span>
                                <span style={{
                                    fontFamily: 'var(--font-sans)',
                                    fontSize: 'var(--text-xs)',
                                    color: 'var(--color-text-tertiary)',
                                }}>
                                    Contexto: {context}
                                </span>
                            </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <button
                                onClick={onToggleFull}
                                className="notion-btn-icon"
                                title={isFull ? 'Minimizar' : 'Expandir'}
                            >
                                {isFull ? (
                                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                                        <path d="M13 5H9V1M1 9H5V13M9 5L13 1M5 9L1 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                    </svg>
                                ) : (
                                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                                        <path d="M9 1H13V5M5 13H1V9M13 1L9 5M1 13L5 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                    </svg>
                                )}
                            </button>
                            <button onClick={onClose} className="notion-btn-icon">
                                <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
                                    <line x1="1" y1="1" x2="13" y2="13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                                    <line x1="13" y1="1" x2="1" y2="13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                                </svg>
                            </button>
                        </div>
                    </div>

                    {/* Messages */}
                    <div
                        ref={scrollRef}
                        style={{
                            flex: 1,
                            overflowY: 'auto',
                            padding: isFull ? 'var(--space-10) 0' : 'var(--space-6) 0',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 'var(--space-6)',
                            scrollbarWidth: 'thin',
                        }}
                    >
                        <div style={{
                            width: '100%',
                            maxWidth: isFull ? 720 : 'none',
                            margin: isFull ? '0 auto' : '0',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 'var(--space-5)',
                        }}>
                            {messages.map((m) => (
                                <motion.div
                                    key={m.id}
                                    initial={{ opacity: 0, y: 8 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ duration: 0.3 }}
                                    style={{ padding: '0 var(--space-6)' }}
                                >
                                    {m.role === 'assistant' ? (
                                        <div>
                                            <p style={{
                                                fontFamily: 'var(--font-sans)',
                                                fontSize: 'var(--text-xs)',
                                                fontWeight: 500,
                                                color: 'var(--color-text-tertiary)',
                                                marginBottom: 'var(--space-1)',
                                                textTransform: 'uppercase',
                                                letterSpacing: '0.06em',
                                            }}>
                                                Northie AI
                                            </p>
                                            <div style={{
                                                padding: 'var(--space-4)',
                                                background: 'var(--color-bg-secondary)',
                                                border: '1px solid var(--color-border)',
                                                borderRadius: 'var(--radius-lg)',
                                                fontFamily: 'var(--font-sans)',
                                                fontSize: 'var(--text-base)',
                                                lineHeight: 1.65,
                                                color: 'var(--color-text-primary)',
                                                whiteSpace: 'pre-wrap',
                                            }}>
                                                {animatingId === m.id
                                                    ? <TypewriterText text={m.content} onDone={() => setAnimatingId(null)} />
                                                    : m.content
                                                }
                                            </div>
                                        </div>
                                    ) : (
                                        <div style={{ textAlign: 'right' }}>
                                            <div style={{
                                                display: 'inline-block',
                                                padding: 'var(--space-3) var(--space-4)',
                                                background: 'var(--inv)',
                                                color: 'var(--on-inv)',
                                                borderRadius: 'var(--radius-lg)',
                                                fontFamily: 'var(--font-sans)',
                                                fontSize: 'var(--text-base)',
                                                lineHeight: 1.55,
                                                maxWidth: '85%',
                                                textAlign: 'left',
                                            }}>
                                                {m.content}
                                            </div>
                                        </div>
                                    )}
                                </motion.div>
                            ))}
                            {isThinking && <ThinkingIndicator />}
                        </div>
                    </div>

                    {/* Footer */}
                    <div style={{
                        padding: isFull ? 'var(--space-6) 0 var(--space-10)' : 'var(--space-4) var(--space-6)',
                        borderTop: '1px solid var(--color-border)',
                        background: 'var(--color-bg-primary)',
                    }}>
                        <div style={{
                            width: '100%',
                            maxWidth: isFull ? 720 : 'none',
                            margin: isFull ? '0 auto' : '0',
                            padding: isFull ? '0 var(--space-8)' : '0',
                        }}>
                            {/* Suggestion chips */}
                            <div style={{
                                display: 'flex',
                                gap: 'var(--space-2)',
                                overflowX: 'auto',
                                marginBottom: 'var(--space-3)',
                                scrollbarWidth: 'none',
                                paddingBottom: 2,
                            }}>
                                {suggestions.map((s) => (
                                    <SuggestionChip key={s} label={s} onClick={() => handleSend(s)} />
                                ))}
                            </div>

                            {/* Input */}
                            <div style={{
                                display: 'flex',
                                gap: 'var(--space-2)',
                                background: 'var(--color-bg-secondary)',
                                border: '1px solid var(--color-border)',
                                borderRadius: 'var(--radius-lg)',
                                padding: 'var(--space-3) var(--space-3)',
                                alignItems: 'flex-end',
                            }}>
                                <textarea
                                    value={input}
                                    onChange={e => setInput(e.target.value)}
                                    onKeyDown={e => {
                                        if (e.key === 'Enter' && !e.shiftKey) {
                                            e.preventDefault()
                                            handleSend()
                                        }
                                    }}
                                    placeholder="Escreva uma pergunta..."
                                    style={{
                                        flex: 1,
                                        border: 'none',
                                        background: 'transparent',
                                        outline: 'none',
                                        fontFamily: 'var(--font-sans)',
                                        fontSize: 'var(--text-base)',
                                        color: 'var(--color-text-primary)',
                                        resize: 'none',
                                        minHeight: 22,
                                        maxHeight: 120,
                                        padding: 0,
                                        lineHeight: 1.55,
                                    }}
                                />
                                    {/* Model switcher */}
                                    <motion.button
                                        onClick={() => setModel(m => MODELS[(MODELS.indexOf(m) + 1) % MODELS.length])}
                                        whileTap={{ scale: 0.93 }}
                                        title="Trocar modelo de IA"
                                        style={{
                                            background: 'none',
                                            border: '1px solid var(--color-border)',
                                            borderRadius: 'var(--radius-sm)',
                                            padding: '3px 7px',
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 4,
                                            flexShrink: 0,
                                            color: 'var(--color-text-tertiary)',
                                        }}
                                    >
                                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.04em' }}>
                                            {MODEL_LABELS[model]}
                                        </span>
                                        <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                                            <path d="M4 1L6.5 3.5M4 1L1.5 3.5M4 7L6.5 4.5M4 7L1.5 4.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                                        </svg>
                                    </motion.button>

                                <motion.button
                                    onClick={() => handleSend()}
                                    disabled={!input.trim() || isThinking}
                                    whileHover={{ scale: input.trim() ? 1.05 : 1 }}
                                    whileTap={{ scale: 0.95 }}
                                    style={{
                                        background: input.trim() ? 'var(--color-primary)' : 'var(--color-border)',
                                        color: input.trim() ? 'white' : 'var(--color-text-tertiary)',
                                        border: 'none',
                                        borderRadius: 'var(--radius-md)',
                                        width: 28, height: 28,
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        cursor: input.trim() ? 'pointer' : 'default',
                                        flexShrink: 0,
                                        transition: 'background var(--transition-base)',
                                    }}
                                >
                                    <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
                                        <path d="M1 7H13M13 7L7 1M13 7L7 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                    </svg>
                                </motion.button>
                            </div>
                        </div>
                    </div>
                </motion.aside>
            )}
        </AnimatePresence>
    )
}
