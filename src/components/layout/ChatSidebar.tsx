import { useState, useRef, useEffect, useMemo, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { AskNorthieIcon } from '../../icons'
import { aiApi, skillsApi } from '../../lib/api'

type AIModel = 'haiku' | 'sonnet' | 'opus'

interface ModelDef { id: AIModel; label: string; description: string; icon: string }
const MODELS: ModelDef[] = [
    { id: 'haiku',  label: 'Haiku',  description: 'Rápido — perguntas simples', icon: '⚡' },
    { id: 'sonnet', label: 'Sonnet', description: 'Equilibrado — uso geral',    icon: '◆' },
    { id: 'opus',   label: 'Opus',   description: 'Análise profunda',           icon: '◈' },
]

interface SlashCommand { id: string; icon: string; label: string; description: string }
const SLASH_COMMANDS: SlashCommand[] = [
    { id: 'skills', icon: '⚡', label: 'Skills',          description: 'Use uma skill especializada' },
    { id: 'clear',  icon: '↺',  label: 'Limpar conversa', description: 'Inicia uma nova conversa'    },
]

interface SkillItem { id: string; name: string; description?: string; is_global: boolean }

interface Message { id: string; role: 'user' | 'assistant' | 'system'; content: string }

function TypewriterText({ text, onDone }: { text: string; onDone: () => void }) {
    const [count, setCount] = useState(0)
    const onDoneRef = useRef(onDone)
    onDoneRef.current = onDone
    useEffect(() => { setCount(0) }, [text])
    useEffect(() => {
        if (count >= text.length) { onDoneRef.current(); return }
        const t = setTimeout(() => setCount(c => c + 1), 7)
        return () => clearTimeout(t)
    }, [count, text])
    return <>{text.slice(0, count)}</>
}

interface ChatSidebarProps { isOpen: boolean; onClose: () => void; context: string; isFull?: boolean; onToggleFull?: () => void }

function ThinkingIndicator() {
    return (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', padding: '0 var(--space-6)' }}>
            <div style={{ display: 'flex', gap: 4 }}>
                {[0, 1, 2].map(i => (
                    <motion.div key={i}
                        animate={{ opacity: [0.3, 1, 0.3], scale: [1, 1.1, 1] }}
                        transition={{ duration: 1, repeat: Infinity, delay: i * 0.18 }}
                        style={{ width: 5, height: 5, borderRadius: 'var(--radius-full)', background: 'var(--color-primary)' }} />
                ))}
            </div>
            <span style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', color: 'var(--color-text-tertiary)' }}>
                Processando...
            </span>
        </motion.div>
    )
}

function SuggestionChip({ label, onClick }: { label: string; onClick: () => void }) {
    return (
        <button onClick={onClick} className="tag tag-neutral"
            style={{ cursor: 'pointer', border: '1px solid var(--color-border)', background: 'var(--color-bg-secondary)', color: 'var(--color-text-secondary)', transition: 'background var(--transition-base), color var(--transition-base)', padding: '4px 12px', borderRadius: 'var(--radius-md)', fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)' }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--color-bg-tertiary)'; (e.currentTarget as HTMLButtonElement).style.color = 'var(--color-text-primary)' }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--color-bg-secondary)'; (e.currentTarget as HTMLButtonElement).style.color = 'var(--color-text-secondary)' }}>
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

    // Slash menu
    const [slashMenuOpen, setSlashMenuOpen] = useState(false)
    const [slashIndex, setSlashIndex] = useState(0)

    // Skills picker
    const [skillsPickerOpen, setSkillsPickerOpen] = useState(false)
    const [skills, setSkills] = useState<SkillItem[]>([])
    const [skillsLoading, setSkillsLoading] = useState(false)
    const [attachedSkill, setAttachedSkill] = useState<SkillItem | null>(null)

    // Model dropdown
    const [modelMenuOpen, setModelMenuOpen] = useState(false)

    const scrollRef = useRef<HTMLDivElement>(null)
    const mountedRef = useRef(true)
    const textareaRef = useRef<HTMLTextAreaElement>(null)
    const footerRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        mountedRef.current = true
        return () => { mountedRef.current = false }
    }, [])

    // Auto-resize textarea
    useEffect(() => {
        const el = textareaRef.current
        if (!el) return
        el.style.height = '0px'
        el.style.height = Math.min(Math.max(el.scrollHeight, 22), 140) + 'px'
    }, [input])

    // Close menus on outside click
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (footerRef.current && !footerRef.current.contains(e.target as Node)) {
                setSlashMenuOpen(false)
                setSkillsPickerOpen(false)
                setModelMenuOpen(false)
            }
        }
        document.addEventListener('mousedown', handler)
        return () => document.removeEventListener('mousedown', handler)
    }, [])

    const slashFilter = input.startsWith('/') ? input.slice(1).toLowerCase() : ''
    const filteredSlashCommands = SLASH_COMMANDS.filter(cmd =>
        cmd.label.toLowerCase().includes(slashFilter) || cmd.description.toLowerCase().includes(slashFilter)
    )

    const suggestions = useMemo(() => {
        switch (context) {
            case 'Clientes':      return ['Analisar Churn', 'Top 10 LTV', 'Insight RFM']
            case 'Vendas':        return ['Previsão Mensal', 'Canal mais lucrativo', 'Ticket Médio']
            case 'Visão Geral':   return ['Resumo Growth', 'Alerta de CAC', 'Performance Ads']
            case 'Northie Card':  return ['Como aumentar meu score?', 'Quando serei aprovado?', 'Split explicado']
            default:              return ['Resumo do dia', 'Próximas ações']
        }
    }, [context])

    useEffect(() => {
        if (scrollRef.current) scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
    }, [messages, isThinking])

    useEffect(() => {
        const handler = (e: Event) => {
            const query = (e as CustomEvent<string>).detail
            if (query) handleSend(query)
        }
        window.addEventListener('northie:ask', handler)
        return () => window.removeEventListener('northie:ask', handler)
    }, []) // eslint-disable-line

    const fetchSkills = useCallback(async () => {
        setSkillsLoading(true)
        try {
            const res = await skillsApi.list()
            setSkills((res.data as SkillItem[]) ?? [])
        } catch {
            setSkills([])
        } finally {
            setSkillsLoading(false)
        }
    }, [])

    const handleInputChange = (value: string) => {
        setInput(value)
        if (value.startsWith('/')) {
            setSlashMenuOpen(true)
            setSkillsPickerOpen(false)
            setModelMenuOpen(false)
            setSlashIndex(0)
        } else {
            setSlashMenuOpen(false)
        }
    }

    const selectSlashCommand = async (cmd: SlashCommand) => {
        setSlashMenuOpen(false)
        setInput('')
        if (cmd.id === 'clear') {
            setMessages([{ id: String(Date.now()), role: 'assistant', content: `Conectado. Contexto: ${context}. O que vamos analisar?` }])
            try { await aiApi.clearHistory() } catch { /* ok */ }
        } else if (cmd.id === 'skills') {
            await fetchSkills()
            setSkillsPickerOpen(true)
        }
        setTimeout(() => textareaRef.current?.focus(), 50)
    }

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (slashMenuOpen) {
            if (e.key === 'ArrowDown') { e.preventDefault(); setSlashIndex(i => Math.min(i + 1, filteredSlashCommands.length - 1)) }
            if (e.key === 'ArrowUp')   { e.preventDefault(); setSlashIndex(i => Math.max(i - 1, 0)) }
            if (e.key === 'Enter')     { e.preventDefault(); if (filteredSlashCommands[slashIndex]) selectSlashCommand(filteredSlashCommands[slashIndex]!); return }
            if (e.key === 'Escape')    { setSlashMenuOpen(false); return }
            return
        }
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
    }

    const handleSend = async (text?: string) => {
        const messageText = text || input
        if (!messageText.trim()) return

        const userMsg: Message = { id: Date.now().toString(), role: 'user', content: messageText }
        setMessages(prev => [...prev, userMsg])
        if (!text) setInput('')
        setIsThinking(true)

        try {
            const response = await aiApi.chat(messageText, context, model as 'general' | 'growth', model, attachedSkill?.id)
            if (!mountedRef.current) return
            const newId = Date.now().toString()
            setMessages(prev => [...prev, { id: newId, role: 'assistant', content: response.data.content }])
            setAnimatingId(newId)
        } catch (err: unknown) {
            if (!mountedRef.current) return
            const status = (err as { response?: { status?: number } })?.response?.status
            console.error('[ChatSidebar] Erro:', err)
            setMessages(prev => [...prev, { id: Date.now().toString(), role: 'assistant', content: `Erro ao conectar com a IA. Status: ${status || 'sem resposta'}. Verifique o console (F12).` }])
        } finally {
            if (mountedRef.current) setIsThinking(false)
        }
    }

    const currentModel = MODELS.find(m => m.id === model)!

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.aside
                    initial={{ x: isFull ? 0 : 380, opacity: 0 }}
                    animate={{ x: 0, width: isFull ? '100vw' : 380, opacity: 1 }}
                    exit={{ x: isFull ? 0 : 380, opacity: 0 }}
                    transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
                    style={{ position: 'fixed', top: 0, right: 0, bottom: 0, background: 'var(--bg)', borderLeft: '1px solid var(--color-border)', zIndex: 400, display: 'flex', flexDirection: 'column', boxShadow: isFull ? 'none' : 'var(--shadow-xl)' }}>

                    {/* Header */}
                    <div style={{ padding: isFull ? '20px 64px' : '16px 24px', borderBottom: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--color-bg-primary)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <motion.div animate={{ rotate: isThinking ? [0, 8, -8, 0] : 0 }} transition={{ repeat: Infinity, duration: 2 }}>
                                <AskNorthieIcon />
                            </motion.div>
                            <div>
                                <span style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-md)', fontWeight: 500, color: 'var(--color-text-primary)', letterSpacing: '-0.3px', display: 'block' }}>Ask Northie</span>
                                <span style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)' }}>Contexto: {context}</span>
                            </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <button onClick={async () => { setMessages([{ id: String(Date.now()), role: 'assistant', content: `Conectado. Contexto: ${context}. O que vamos analisar?` }]); try { await aiApi.clearHistory() } catch { /* ok */ } }} className="notion-btn-icon" title="Nova conversa">
                                <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 1V13M1 7H13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
                            </button>
                            <button onClick={onToggleFull} className="notion-btn-icon" title={isFull ? 'Minimizar' : 'Expandir'}>
                                {isFull ? <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M13 5H9V1M1 9H5V13M9 5L13 1M5 9L1 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                                        : <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M9 1H13V5M5 13H1V9M13 1L9 5M1 13L5 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                            </button>
                            <button onClick={onClose} className="notion-btn-icon">
                                <svg width="13" height="13" viewBox="0 0 14 14" fill="none"><line x1="1" y1="1" x2="13" y2="13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /><line x1="13" y1="1" x2="1" y2="13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
                            </button>
                        </div>
                    </div>

                    {/* Messages */}
                    <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: isFull ? 'var(--space-10) 0' : 'var(--space-6) 0', display: 'flex', flexDirection: 'column', gap: 'var(--space-6)', scrollbarWidth: 'thin' }}>
                        <div style={{ width: '100%', maxWidth: isFull ? 720 : 'none', margin: isFull ? '0 auto' : '0', display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
                            {messages.map(m => (
                                <motion.div key={m.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} style={{ padding: '0 var(--space-6)' }}>
                                    {m.role === 'assistant' ? (
                                        <div>
                                            <p style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-xs)', fontWeight: 500, color: 'var(--color-text-tertiary)', marginBottom: 'var(--space-1)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Northie AI</p>
                                            <div style={{ padding: 'var(--space-4)', background: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', fontFamily: 'var(--font-sans)', fontSize: 'var(--text-base)', lineHeight: 1.65, color: 'var(--color-text-primary)', whiteSpace: 'pre-wrap' }}>
                                                {animatingId === m.id ? <TypewriterText text={m.content} onDone={() => setAnimatingId(null)} /> : m.content}
                                            </div>
                                        </div>
                                    ) : (
                                        <div style={{ textAlign: 'right' }}>
                                            <div style={{ display: 'inline-block', padding: 'var(--space-3) var(--space-4)', background: 'var(--inv)', color: 'var(--on-inv)', borderRadius: 'var(--radius-lg)', fontFamily: 'var(--font-sans)', fontSize: 'var(--text-base)', lineHeight: 1.55, maxWidth: '85%', textAlign: 'left' }}>
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
                    <div ref={footerRef} style={{ padding: isFull ? 'var(--space-6) 0 var(--space-10)' : 'var(--space-4) var(--space-6)', borderTop: '1px solid var(--color-border)', background: 'var(--color-bg-primary)', position: 'relative' }}>
                        <div style={{ width: '100%', maxWidth: isFull ? 720 : 'none', margin: isFull ? '0 auto' : '0', padding: isFull ? '0 var(--space-8)' : '0', position: 'relative' }}>

                            {/* Slash command menu */}
                            <AnimatePresence>
                                {slashMenuOpen && filteredSlashCommands.length > 0 && (
                                    <motion.div
                                        initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 6 }}
                                        transition={{ duration: 0.15 }}
                                        style={{ position: 'absolute', bottom: 'calc(100% + 8px)', left: 0, right: 0, background: 'var(--color-bg-primary)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-lg)', overflow: 'hidden', zIndex: 500 }}>
                                        <div style={{ padding: '6px 10px 4px', borderBottom: '1px solid var(--color-border)' }}>
                                            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--color-text-tertiary)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Comandos</span>
                                        </div>
                                        {filteredSlashCommands.map((cmd, i) => (
                                            <button key={cmd.id} onMouseDown={e => { e.preventDefault(); selectSlashCommand(cmd) }}
                                                style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', background: i === slashIndex ? 'var(--color-bg-secondary)' : 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left', transition: 'background 0.12s' }}
                                                onMouseEnter={() => setSlashIndex(i)}>
                                                <span style={{ fontSize: 14, flexShrink: 0 }}>{cmd.icon}</span>
                                                <div>
                                                    <span style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', fontWeight: 500, color: 'var(--color-text-primary)', display: 'block' }}>{cmd.label}</span>
                                                    <span style={{ fontFamily: 'var(--font-sans)', fontSize: 11, color: 'var(--color-text-tertiary)' }}>{cmd.description}</span>
                                                </div>
                                            </button>
                                        ))}
                                        <div style={{ padding: '4px 12px 6px' }}>
                                            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--color-text-tertiary)' }}>↑↓ navegar · Enter selecionar · Esc fechar</span>
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>

                            {/* Skills picker */}
                            <AnimatePresence>
                                {skillsPickerOpen && (
                                    <motion.div
                                        initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 6 }}
                                        transition={{ duration: 0.15 }}
                                        style={{ position: 'absolute', bottom: 'calc(100% + 8px)', left: 0, right: 0, background: 'var(--color-bg-primary)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-lg)', overflow: 'hidden', zIndex: 500, maxHeight: 260, overflowY: 'auto' }}>
                                        <div style={{ padding: '6px 12px 4px', borderBottom: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, background: 'var(--color-bg-primary)' }}>
                                            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--color-text-tertiary)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Skills disponíveis</span>
                                            <button onMouseDown={e => { e.preventDefault(); setSkillsPickerOpen(false) }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-tertiary)', padding: 2 }}>
                                                <svg width="10" height="10" viewBox="0 0 14 14" fill="none"><line x1="1" y1="1" x2="13" y2="13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /><line x1="13" y1="1" x2="1" y2="13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
                                            </button>
                                        </div>
                                        {skillsLoading ? (
                                            <div style={{ padding: 16, textAlign: 'center', fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', color: 'var(--color-text-tertiary)' }}>Carregando...</div>
                                        ) : skills.length === 0 ? (
                                            <div style={{ padding: 16, textAlign: 'center', fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', color: 'var(--color-text-tertiary)' }}>Nenhuma skill disponível</div>
                                        ) : skills.map(skill => (
                                            <button key={skill.id}
                                                onMouseDown={e => { e.preventDefault(); setAttachedSkill(skill); setSkillsPickerOpen(false); setTimeout(() => textareaRef.current?.focus(), 50) }}
                                                style={{ width: '100%', display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 12px', background: attachedSkill?.id === skill.id ? 'var(--color-bg-secondary)' : 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left', transition: 'background 0.12s', borderBottom: '1px solid var(--color-border)' }}
                                                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--color-bg-secondary)' }}
                                                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = attachedSkill?.id === skill.id ? 'var(--color-bg-secondary)' : 'transparent' }}>
                                                <span style={{ fontSize: 14, flexShrink: 0, marginTop: 1 }}>⚡</span>
                                                <div style={{ flex: 1, minWidth: 0 }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                                        <span style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', fontWeight: 500, color: 'var(--color-text-primary)' }}>{skill.name}</span>
                                                        {skill.is_global && (
                                                            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, background: 'var(--color-bg-tertiary)', color: 'var(--color-text-tertiary)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', padding: '1px 5px', letterSpacing: '0.04em', textTransform: 'uppercase' }}>Global</span>
                                                        )}
                                                    </div>
                                                    {skill.description && <span style={{ fontFamily: 'var(--font-sans)', fontSize: 11, color: 'var(--color-text-tertiary)', display: 'block', marginTop: 1 }}>{skill.description}</span>}
                                                </div>
                                            </button>
                                        ))}
                                    </motion.div>
                                )}
                            </AnimatePresence>

                            {/* Model dropdown */}
                            <AnimatePresence>
                                {modelMenuOpen && (
                                    <motion.div
                                        initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 6 }}
                                        transition={{ duration: 0.15 }}
                                        style={{ position: 'absolute', bottom: 'calc(100% + 8px)', right: isFull ? 'var(--space-8)' : 0, width: 220, background: 'var(--color-bg-primary)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-lg)', overflow: 'hidden', zIndex: 500 }}>
                                        <div style={{ padding: '6px 12px 4px', borderBottom: '1px solid var(--color-border)' }}>
                                            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--color-text-tertiary)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Modelo</span>
                                        </div>
                                        {MODELS.map(m => (
                                            <button key={m.id} onMouseDown={e => { e.preventDefault(); setModel(m.id); setModelMenuOpen(false) }}
                                                style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', background: model === m.id ? 'var(--color-bg-secondary)' : 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left', transition: 'background 0.12s' }}
                                                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--color-bg-secondary)' }}
                                                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = model === m.id ? 'var(--color-bg-secondary)' : 'transparent' }}>
                                                <span style={{ fontSize: 13, flexShrink: 0 }}>{m.icon}</span>
                                                <div style={{ flex: 1 }}>
                                                    <span style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', fontWeight: 500, color: 'var(--color-text-primary)', display: 'block' }}>{m.label}</span>
                                                    <span style={{ fontFamily: 'var(--font-sans)', fontSize: 11, color: 'var(--color-text-tertiary)' }}>{m.description}</span>
                                                </div>
                                                {model === m.id && <span style={{ color: 'var(--color-primary)', fontSize: 12, fontWeight: 600 }}>✓</span>}
                                            </button>
                                        ))}
                                    </motion.div>
                                )}
                            </AnimatePresence>

                            {/* Suggestion chips */}
                            <div style={{ display: 'flex', gap: 'var(--space-2)', overflowX: 'auto', marginBottom: 'var(--space-3)', scrollbarWidth: 'none', paddingBottom: 2 }}>
                                {suggestions.map(s => <SuggestionChip key={s} label={s} onClick={() => handleSend(s)} />)}
                            </div>

                            {/* Attached skill badge */}
                            <AnimatePresence>
                                {attachedSkill && (
                                    <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 4 }}
                                        style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                                        <span style={{ fontFamily: 'var(--font-sans)', fontSize: 11, color: 'var(--color-text-tertiary)' }}>Skill ativa:</span>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: '2px 8px' }}>
                                            <span style={{ fontSize: 11 }}>⚡</span>
                                            <span style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', color: 'var(--color-text-primary)', fontWeight: 500 }}>{attachedSkill.name}</span>
                                            <button onClick={() => setAttachedSkill(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-tertiary)', padding: 0, lineHeight: 1, display: 'flex', alignItems: 'center' }}>
                                                <svg width="9" height="9" viewBox="0 0 14 14" fill="none"><line x1="1" y1="1" x2="13" y2="13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /><line x1="13" y1="1" x2="1" y2="13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
                                            </button>
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>

                            {/* Input box */}
                            <div style={{ display: 'flex', gap: 'var(--space-2)', background: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-3)', alignItems: 'flex-end' }}>
                                <textarea
                                    ref={textareaRef}
                                    value={input}
                                    onChange={e => handleInputChange(e.target.value)}
                                    onKeyDown={handleKeyDown}
                                    placeholder="Escreva ou / para comandos..."
                                    style={{ flex: 1, border: 'none', background: 'transparent', outline: 'none', fontFamily: 'var(--font-sans)', fontSize: 'var(--text-base)', color: 'var(--color-text-primary)', resize: 'none', minHeight: 22, maxHeight: 140, padding: 0, lineHeight: 1.55 }}
                                />

                                {/* Model button */}
                                <motion.button
                                    onMouseDown={e => { e.preventDefault(); setModelMenuOpen(v => !v); setSlashMenuOpen(false); setSkillsPickerOpen(false) }}
                                    whileTap={{ scale: 0.93 }}
                                    title="Trocar modelo de IA"
                                    style={{ background: 'none', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', padding: '3px 7px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0, color: 'var(--color-text-tertiary)' }}>
                                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.04em' }}>{currentModel.icon} {currentModel.label}</span>
                                    <svg width="8" height="8" viewBox="0 0 8 8" fill="none"><path d="M4 1L6.5 3.5M4 1L1.5 3.5M4 7L6.5 4.5M4 7L1.5 4.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                                </motion.button>

                                {/* Send button */}
                                <motion.button
                                    onClick={() => handleSend()}
                                    disabled={!input.trim() || isThinking}
                                    whileHover={{ scale: input.trim() ? 1.05 : 1 }}
                                    whileTap={{ scale: 0.95 }}
                                    style={{ background: input.trim() ? 'var(--color-primary)' : 'var(--color-border)', color: input.trim() ? 'white' : 'var(--color-text-tertiary)', border: 'none', borderRadius: 'var(--radius-md)', width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: input.trim() ? 'pointer' : 'default', flexShrink: 0, transition: 'background var(--transition-base)' }}>
                                    <svg width="13" height="13" viewBox="0 0 14 14" fill="none"><path d="M1 7H13M13 7L7 1M13 7L7 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                                </motion.button>
                            </div>
                        </div>
                    </div>
                </motion.aside>
            )}
        </AnimatePresence>
    )
}
