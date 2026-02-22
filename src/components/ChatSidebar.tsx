import { useState, useRef, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { AskNorthieIcon } from '../icons'

interface Message {
    id: string
    role: 'user' | 'assistant' | 'system'
    content: string
}

interface ChatSidebarProps {
    isOpen: boolean
    onClose: () => void
    context: string
    isFull?: boolean
    onToggleFull?: () => void
}

// ── Components ───────────────────────────────────────────────────────────────

function MaximizeIcon() {
    return (
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M9 1H13V5M5 13H1V9M13 1L9 5M1 13L5 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    )
}

function MinimizeIcon() {
    return (
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M13 5H9V1M1 9H5V13M9 5L13 1M5 9L1 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    )
}

function ThinkingIndicator({ context }: { context: string }) {
    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '0 32px' }}
        >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ display: 'flex', gap: 3 }}>
                    {[0, 1, 2].map((i) => (
                        <motion.div
                            key={i}
                            animate={{
                                opacity: [0.3, 1, 0.3],
                                scale: [1, 1.2, 1],
                            }}
                            transition={{
                                duration: 1,
                                repeat: Infinity,
                                delay: i * 0.2,
                            }}
                            style={{ width: 4, height: 4, borderRadius: '50%', background: '#1E1E1E' }}
                        />
                    ))}
                </div>
                <span style={{
                    fontFamily: "'Geist Mono', monospace",
                    fontSize: 11,
                    color: 'rgba(30,30,30,0.6)',
                    letterSpacing: '0.02em'
                }}>
                    Processando inteligência de {context}...
                </span>
            </div>
            <motion.div
                initial={{ width: 0 }}
                animate={{ width: '60%' }}
                transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                style={{ height: 1, background: 'rgba(30,30,30,0.08)', borderRadius: 1 }}
            />
        </motion.div>
    )
}

function SuggestionChip({ label, onClick }: { label: string; onClick: () => void }) {
    return (
        <motion.button
            whileHover={{ backgroundColor: 'rgba(30,30,30,0.05)', borderColor: 'rgba(30,30,30,0.2)' }}
            whileTap={{ scale: 0.97 }}
            onClick={onClick}
            style={{
                padding: '6px 12px',
                borderRadius: 16,
                border: '1px solid rgba(30,30,30,0.1)',
                background: 'transparent',
                cursor: 'pointer',
                fontFamily: "'Poppins', sans-serif",
                fontSize: 12,
                color: 'rgba(30,30,30,0.7)',
                whiteSpace: 'nowrap',
                transition: 'all 0.2s'
            }}
        >
            {label}
        </motion.button>
    )
}

// ── Main Component ──────────────────────────────────────────────────────────

export default function ChatSidebar({ isOpen, onClose, context, isFull, onToggleFull }: ChatSidebarProps) {
    const [messages, setMessages] = useState<Message[]>([
        { id: '1', role: 'assistant', content: `Olá Francisco. Estou conectado aos seus dados de **${context}**. O que vamos analisar agora?` }
    ])
    const [isThinking, setIsThinking] = useState(false)
    const [input, setInput] = useState('')
    const scrollRef = useRef<HTMLDivElement>(null)

    const suggestions = useMemo(() => {
        switch (context) {
            case 'Clientes': return ['Analisar Churn', 'Top 10 LTV', 'Insight RFM']
            case 'Vendas': return ['Previsão Mensal', 'Canal mais lucrativo', 'Ticket Médio']
            case 'Visão Geral': return ['Resumo Growth', 'Alerta de CAC', 'Performance Ads']
            default: return ['Resumo do dia', 'Próximas ações']
        }
    }, [context])

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
        }
    }, [messages, isThinking])

    const handleSend = (text?: string) => {
        const messageText = text || input
        if (!messageText.trim()) return

        const userMsg: Message = { id: Date.now().toString(), role: 'user', content: messageText }
        setMessages(prev => [...prev, userMsg])
        if (!text) setInput('')

        setIsThinking(true)

        // Mock AI Analysis Logic
        setTimeout(() => {
            setIsThinking(false)
            const aiMsg: Message = {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                content: `Baseado na sua solicitação sobre "${messageText}", identifiquei um padrão importante nos dados de ${context}:

### Insight de Análise
Atualmente, observamos uma tendência de crescimento estável, mas com um ponto de atenção no CAC.

### Dados Relevantes
\`\`\`
Métrica       | Valor     | Delta (30d)
---------------------------------------
Faturamento   | R$ 240k   | +12%
CAC Médio     | R$ 310    | +8.4% (Subindo)
LTV Médio     | R$ 2.340  | -2%
\`\`\`

**Ação Sugerida:** Reavaliar a alocação de budget no Meta Ads para reduzir o CAC sem comprometer o volume de novos clientes.`
            }
            setMessages(prev => [...prev, aiMsg])
        }, 1800)
    }

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.aside
                    initial={{ x: isFull ? 0 : 380, width: isFull ? '100vw' : 380, opacity: 0 }}
                    animate={{ x: 0, width: isFull ? '100vw' : 380, opacity: 1 }}
                    exit={{ x: isFull ? 0 : 380, opacity: 0 }}
                    transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
                    style={{
                        position: 'fixed', top: 0, right: 0, bottom: 0,
                        background: '#FCF8F8',
                        borderLeft: '1px solid rgba(30,30,30,0.1)',
                        zIndex: 400, display: 'flex', flexDirection: 'column',
                        boxShadow: isFull ? 'none' : '-10px 0 40px rgba(30,30,30,0.03)'
                    }}
                >
                    {/* Scanline pattern overlay (subtle) */}
                    <div style={{
                        position: 'absolute', inset: 0, pointerEvents: 'none',
                        background: 'linear-gradient(rgba(30,30,30,0.003) 50%, transparent 50%)',
                        backgroundSize: '100% 4px', opacity: 0.5, zIndex: 1
                    }} />

                    {/* Header */}
                    <div style={{
                        padding: isFull ? '24px 64px' : '24px 32px', borderBottom: '1px solid rgba(30,30,30,0.06)',
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between', zIndex: 2,
                        transition: 'padding 0.4s ease'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <motion.div animate={{ rotate: isThinking ? [0, 10, -10, 0] : 0 }} transition={{ repeat: Infinity, duration: 2 }}>
                                <AskNorthieIcon />
                            </motion.div>
                            <span style={{
                                fontFamily: "'Poppins', sans-serif", fontSize: 18, fontWeight: 400,
                                letterSpacing: '-0.5px', color: '#1E1E1E'
                            }}>
                                Ask Northie {isFull && <span style={{ opacity: 0.3, fontWeight: 300, fontSize: 14, marginLeft: 8 }}>/ Workstation</span>}
                            </span>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                            <motion.button
                                onClick={onToggleFull}
                                whileHover={{ opacity: 0.6, backgroundColor: 'rgba(30,30,30,0.04)' }}
                                whileTap={{ scale: 0.92 }}
                                style={{
                                    background: 'none', border: '1px solid rgba(30,30,30,0.1)',
                                    borderRadius: 4, cursor: 'pointer', padding: 6, color: 'rgba(30,30,30,0.5)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                                }}
                                title={isFull ? "Minimizar" : "Expandir para tela cheia"}
                            >
                                {isFull ? <MinimizeIcon /> : <MaximizeIcon />}
                            </motion.button>

                            <motion.button
                                onClick={onClose}
                                whileHover={{ opacity: 0.6 }}
                                whileTap={{ scale: 0.92 }}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: 'rgba(30,30,30,0.5)' }}
                            >
                                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                                    <line x1="1" y1="1" x2="13" y2="13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                                    <line x1="13" y1="1" x2="1" y2="13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                                </svg>
                            </motion.button>
                        </div>
                    </div>

                    {/* Messages Area - Center content if full screen */}
                    <div
                        ref={scrollRef}
                        style={{
                            flex: 1, overflowY: 'auto', padding: isFull ? '64px 0' : '32px 0',
                            display: 'flex', flexDirection: 'column', gap: 40,
                            zIndex: 2, scrollbarWidth: 'none',
                            transition: 'padding 0.4s ease'
                        }}
                    >
                        <div style={{
                            width: '100%', maxWidth: isFull ? 800 : 'none',
                            margin: isFull ? '0 auto' : '0',
                            display: 'flex', flexDirection: 'column', gap: 40,
                        }}>
                            {messages.map((m) => (
                                <motion.div
                                    key={m.id}
                                    initial={{ opacity: 0, y: 12 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ duration: 0.4, delay: 0.1 }}
                                    style={{
                                        padding: '0 32px',
                                        alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
                                        width: '100%', boxSizing: 'border-box'
                                    }}
                                >
                                    {m.role === 'assistant' && (
                                        <p style={{
                                            fontFamily: "'Geist Mono', monospace", fontSize: 10,
                                            color: 'rgba(30,30,30,0.3)', marginBottom: 8,
                                            letterSpacing: '0.08em', textTransform: 'uppercase'
                                        }}>
                                            Intelligence Output
                                        </p>
                                    )}

                                    <div style={{
                                        padding: m.role === 'user' ? '10px 16px' : '0',
                                        borderRadius: m.role === 'user' ? 6 : 0,
                                        background: m.role === 'user' ? 'rgba(30,30,30,0.04)' : 'none',
                                        borderLeft: m.role === 'assistant' ? '1px solid rgba(30,30,30,0.1)' : 'none',
                                        paddingLeft: m.role === 'assistant' ? 16 : 0,
                                    }}>
                                        <div style={{
                                            fontFamily: "'Poppins', sans-serif",
                                            fontSize: 14, lineHeight: 1.6, color: '#1E1E1E',
                                            letterSpacing: '-0.2px', whiteSpace: 'pre-wrap'
                                        }}>
                                            {m.content.split('```').map((part, index) => (
                                                index % 2 === 1 ? (
                                                    <div key={index} style={{
                                                        background: 'rgba(30,30,30,0.02)',
                                                        padding: '24px', borderRadius: 6,
                                                        fontFamily: "'Geist Mono', monospace",
                                                        fontSize: 13, margin: '20px 0',
                                                        border: '1px solid rgba(30,30,30,0.05)',
                                                        overflowX: 'auto', color: 'rgba(30,30,30,0.8)',
                                                        lineHeight: 1.7
                                                    }}>
                                                        {part}
                                                    </div>
                                                ) : (
                                                    <span key={index}>{part}</span>
                                                )
                                            ))}
                                        </div>
                                    </div>
                                </motion.div>
                            ))}

                            {/* Thinking state */}
                            {isThinking && <ThinkingIndicator context={context} />}
                        </div>
                    </div>

                    {/* Footer / Input Area - Center content if full screen */}
                    <div style={{
                        padding: isFull ? '32px 0 48px' : '24px 32px 32px',
                        borderTop: '1px solid rgba(30,30,30,0.06)', zIndex: 2,
                        transition: 'padding 0.4s ease'
                    }}>
                        <div style={{
                            width: '100%', maxWidth: isFull ? 800 : 'none',
                            margin: isFull ? '0 auto' : '0',
                            padding: isFull ? '0 32px' : '0',
                        }}>
                            {/* Suggestions */}
                            <div style={{
                                display: 'flex', gap: 8, overflowX: 'auto', marginBottom: 20,
                                scrollbarWidth: 'none', paddingBottom: 4
                            }}>
                                {suggestions.map((s) => (
                                    <SuggestionChip key={s} label={s} onClick={() => handleSend(s)} />
                                ))}
                            </div>

                            <div style={{
                                display: 'flex', gap: 12, background: 'transparent',
                                border: '1px solid rgba(30,30,30,0.12)', borderRadius: 6,
                                padding: '12px 14px', alignItems: 'flex-end',
                                transition: 'all 0.2s',
                                boxShadow: '0 2px 8px rgba(30,30,30,0.02)'
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
                                    placeholder="Qual o próximo passo?"
                                    style={{
                                        flex: 1, border: 'none', background: 'transparent',
                                        outline: 'none', fontFamily: "'Poppins', sans-serif",
                                        fontSize: 14, color: '#1E1E1E', resize: 'none',
                                        minHeight: 24, maxHeight: 120, padding: 0
                                    }}
                                />
                                <motion.button
                                    onClick={() => handleSend()}
                                    disabled={!input.trim() || isThinking}
                                    whileHover={{ scale: input.trim() ? 1.05 : 1, opacity: 0.8 }}
                                    whileTap={{ scale: 0.95 }}
                                    style={{
                                        background: '#1E1E1E', color: '#FCF8F8', border: 'none',
                                        borderRadius: 4, width: 28, height: 28,
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        cursor: input.trim() ? 'pointer' : 'default',
                                        opacity: input.trim() ? 1 : 0.3, flexShrink: 0
                                    }}
                                >
                                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
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
