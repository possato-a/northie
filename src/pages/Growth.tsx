import { useState, useRef, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { growthApi, aiApi, skillsApi } from '../lib/api'

// ── Types ──────────────────────────────────────────────────────────────────────

type AIModel = 'haiku' | 'sonnet' | 'opus'
interface ModelDef { id: AIModel; label: string; description: string; tag: string }
const MODELS: ModelDef[] = [
  { id: 'haiku',  label: 'Haiku',  description: 'Rápido — perguntas simples', tag: 'Fast' },
  { id: 'sonnet', label: 'Sonnet', description: 'Equilibrado — uso geral',    tag: 'Std'  },
  { id: 'opus',   label: 'Opus',   description: 'Análise profunda',           tag: 'Pro'  },
]

interface SlashCmd { id: string; label: string; description: string }
const SLASH_COMMANDS: SlashCmd[] = [
  { id: 'skills',    label: 'Skills',          description: 'Aplicar uma skill especializada'             },
  { id: 'clear',     label: 'Limpar conversa', description: 'Iniciar uma nova conversa'                   },
  { id: 'insights',  label: 'Ver insights',    description: 'Listar insights pendentes do Growth Engine'  },
  { id: 'executar',  label: 'Forçar análise',  description: 'Rodar o Growth Engine agora'                 },
  { id: 'automacoes',label: 'Automações',      description: 'Ver status das automações'                   },
  { id: 'memoria',   label: 'Memória',         description: 'Ver decisões anteriores registradas'         },
  { id: 'instrucao', label: 'Instrução',       description: 'Registrar instrução permanente para a IA'    },
]

interface SkillItem { id: string; name: string; description?: string; is_global: boolean }

export interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function greeting(name: string) {
  const h = new Date().getHours()
  const period = h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite'
  return `${period}, ${name}`
}

const ERROR_MESSAGE = 'Desculpe, tive um problema ao processar sua pergunta.'

// ── Icons ──────────────────────────────────────────────────────────────────────

const ISend = () => (
  <svg width="15" height="15" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 1L9.5 10.5M19 1L13 19l-3.5-8.5L1 7l18-6z" />
  </svg>
)
const IVoice = () => (
  <svg width="15" height="15" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
    <rect x="7" y="1" width="6" height="10" rx="3" /><path d="M3 10a7 7 0 0 0 14 0M10 17v2M7 19h6" />
  </svg>
)
const IAttach = () => (
  <svg width="15" height="15" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
    <path d="M15 9l-6 6a3 3 0 0 1-4.24-4.24l7-7a2 2 0 0 1 2.83 2.83l-7 7a1 1 0 0 1-1.41-1.41L13 5" />
  </svg>
)
const ISkill = () => (
  <svg width="13" height="13" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="10,2 12.9,7.6 19,8.5 14.5,12.9 15.6,19 10,16 4.4,19 5.5,12.9 1,8.5 7.1,7.6" />
  </svg>
)
const IClear = () => (
  <svg width="13" height="13" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
    <path d="M4 6h12M7 6V4h6v2M8 10v5M12 10v5M5 6l1 11h8l1-11" />
  </svg>
)
const IChevronDown = () => (
  <svg width="9" height="9" viewBox="0 0 10 10" fill="none">
    <path d="M2 3.5l3 3 3-3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
  </svg>
)
const ICheckMark = () => (
  <svg width="11" height="11" viewBox="0 0 14 14" fill="none">
    <path d="M2.5 7L5.5 10L11.5 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
)
const IClipX = () => (
  <svg width="9" height="9" viewBox="0 0 14 14" fill="none">
    <line x1="1" y1="1" x2="13" y2="13" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
    <line x1="13" y1="1" x2="1" y2="13" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
  </svg>
)
const IPlus = () => (
  <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <path d="M10 4v12M4 10h12" />
  </svg>
)
const ISpin = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
    style={{ animation: 'spin 0.9s linear infinite' }}>
    <path d="M21 12a9 9 0 1 1-6.219-8.56" />
  </svg>
)

// Slash command icon dispatcher
function CmdIcon({ id }: { id: string }) {
  if (id === 'skills')    return <ISkill />
  if (id === 'clear')     return <IClear />
  // Generic bolt for the rest
  return (
    <svg width="13" height="13" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 2L4 11h7l-2 7 9-10h-7l2-6z" />
    </svg>
  )
}

// ── ChatMessage ────────────────────────────────────────────────────────────────

function ChatMessage({ msg }: { msg: Message }) {
  const isUser = msg.role === 'user'
  const isError = !isUser && msg.content === ERROR_MESSAGE
  return (
    <motion.div
      initial={{ opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
      style={{ display: 'flex', gap: 12, justifyContent: isUser ? 'flex-end' : 'flex-start' }}
    >
      {!isUser && (
        <div style={{
          width: 28, height: 28, borderRadius: '50%', flexShrink: 0, marginTop: 1,
          background: isError ? 'var(--color-bg-tertiary)' : 'var(--color-primary)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <svg width="13" height="13" viewBox="0 0 20 20" fill="none">
            <circle cx="10" cy="10" r="3.5" fill={isError ? 'var(--color-text-tertiary)' : 'white'} />
            <circle cx="10" cy="10" r="6.5" stroke={isError ? 'var(--color-text-tertiary)' : 'white'} strokeWidth="1.2" />
          </svg>
        </div>
      )}
      <div style={{
        maxWidth: isUser ? '68%' : '80%',
        padding: isUser ? '9px 14px' : '5px 0',
        borderRadius: isUser ? '14px 14px 4px 14px' : 0,
        background: isUser ? 'var(--color-primary)' : 'transparent',
        fontFamily: 'var(--font-sans)',
        fontSize: isError ? 12 : 14,
        lineHeight: 1.65,
        color: isUser ? 'white' : isError ? 'var(--color-text-tertiary)' : 'var(--color-text-primary)',
        whiteSpace: 'pre-wrap', wordBreak: 'break-word',
      }}>
        {msg.content}
        {isError && (
          <span style={{ display: 'block', marginTop: 4, fontSize: 11, color: 'var(--color-text-tertiary)', opacity: 0.8 }}>
            Tente enviar novamente.
          </span>
        )}
      </div>
    </motion.div>
  )
}

// ── TypingDots ─────────────────────────────────────────────────────────────────

function TypingDots() {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <div style={{ width: 28, height: 28, borderRadius: '50%', flexShrink: 0, background: 'var(--color-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <svg width="13" height="13" viewBox="0 0 20 20" fill="none"><circle cx="10" cy="10" r="3.5" fill="white" /><circle cx="10" cy="10" r="6.5" stroke="white" strokeWidth="1.2" /></svg>
      </div>
      <div style={{ display: 'flex', gap: 4 }}>
        {[0, 1, 2].map(i => (
          <motion.span key={i} animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }}
            style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--color-text-tertiary)', display: 'block' }} />
        ))}
      </div>
    </motion.div>
  )
}

// ── ChatInput ──────────────────────────────────────────────────────────────────

interface ChatInputProps {
  value: string
  onChange: (v: string) => void
  onSend: (files: File[], skillId?: string) => void
  onSlashCommand: (cmd: SlashCmd, arg?: string) => void
  inputRef: React.RefObject<HTMLTextAreaElement>
  loading: boolean
  model: AIModel
  onModelChange: (m: AIModel) => void
  onClear: () => void
}

function ChatInput({ value, onChange, onSend, onSlashCommand, inputRef, loading, model, onModelChange, onClear }: ChatInputProps) {
  const canSend = value.trim() && !loading
  const [slashMenuOpen, setSlashMenuOpen] = useState(false)
  const [slashIndex, setSlashIndex] = useState(0)
  const [skillsPickerOpen, setSkillsPickerOpen] = useState(false)
  const [skills, setSkills] = useState<SkillItem[]>([])
  const [skillsLoading, setSkillsLoading] = useState(false)
  const [attachedSkill, setAttachedSkill] = useState<SkillItem | null>(null)
  const [modelMenuOpen, setModelMenuOpen] = useState(false)
  const [attachedFiles, setAttachedFiles] = useState<File[]>([])
  const [creatingSkill, setCreatingSkill] = useState(false)
  const [newSkillName, setNewSkillName] = useState('')
  const [newSkillContent, setNewSkillContent] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const currentModel = MODELS.find(m => m.id === model)!
  const slashFilter = value.startsWith('/') ? value.slice(1).toLowerCase() : ''
  const filteredCmds = SLASH_COMMANDS.filter(c =>
    c.label.toLowerCase().includes(slashFilter) || c.description.toLowerCase().includes(slashFilter)
  )

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setSlashMenuOpen(false); setSkillsPickerOpen(false); setModelMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleChange = (v: string) => {
    onChange(v)
    if (v.startsWith('/')) { setSlashMenuOpen(true); setSkillsPickerOpen(false); setModelMenuOpen(false); setSlashIndex(0) }
    else setSlashMenuOpen(false)
  }

  const selectCmd = async (cmd: SlashCmd) => {
    setSlashMenuOpen(false)
    onChange('')
    if (cmd.id === 'clear') {
      onClear()
    } else if (cmd.id === 'skills') {
      setSkillsLoading(true)
      try { const res = await skillsApi.list(); setSkills(res.data ?? []) } catch { setSkills([]) }
      finally { setSkillsLoading(false) }
      setSkillsPickerOpen(true)
    } else if (cmd.id === 'instrucao') {
      // Prompt the user to type the instruction after selecting
      onChange('/instrucao ')
      setTimeout(() => inputRef.current?.focus(), 50)
      return
    } else {
      onSlashCommand(cmd)
    }
    setTimeout(() => inputRef.current?.focus(), 50)
  }

  const handleKey = (e: React.KeyboardEvent) => {
    if (slashMenuOpen) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setSlashIndex(i => Math.min(i + 1, filteredCmds.length - 1)); return }
      if (e.key === 'ArrowUp')   { e.preventDefault(); setSlashIndex(i => Math.max(i - 1, 0)); return }
      if (e.key === 'Enter')     { e.preventDefault(); if (filteredCmds[slashIndex]) selectCmd(filteredCmds[slashIndex]); return }
      if (e.key === 'Escape')    { setSlashMenuOpen(false); return }
      return
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      if (!value.trim() || loading) return
      e.preventDefault()
      // Handle /instrucao inline
      if (value.startsWith('/instrucao ')) {
        const arg = value.slice('/instrucao '.length).trim()
        if (arg) {
          onSlashCommand(SLASH_COMMANDS.find(c => c.id === 'instrucao')!, arg)
          onChange('')
        }
        return
      }
      onSend(attachedFiles, attachedSkill?.id)
      setAttachedFiles([])
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    if (files.length) setAttachedFiles(prev => [...prev, ...files])
    e.target.value = ''
  }

  const removeFile = (idx: number) => setAttachedFiles(prev => prev.filter((_, i) => i !== idx))

  const handleCreateSkill = async () => {
    if (!newSkillName.trim() || !newSkillContent.trim()) return
    try {
      const res = await skillsApi.create({ name: newSkillName.trim(), content: newSkillContent.trim() })
      setSkills(prev => [...prev, res.data])
      setNewSkillName(''); setNewSkillContent(''); setCreatingSkill(false)
    } catch { /* silent */ }
  }

  const menuBase: React.CSSProperties = {
    position: 'absolute', bottom: 'calc(100% + 6px)', left: 0, right: 0,
    background: 'var(--color-bg-primary)', border: '1px solid var(--color-border)',
    borderRadius: 10, boxShadow: '0 4px 20px rgba(0,0,0,0.08)', overflow: 'hidden', zIndex: 600,
  }
  const iconBtnStyle: React.CSSProperties = {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    width: 28, height: 28, borderRadius: 7, background: 'none', border: 'none',
    cursor: 'pointer', color: 'var(--color-text-tertiary)', transition: 'background 0.1s, color 0.1s',
    flexShrink: 0,
  }

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>

      {/* Slash menu */}
      <AnimatePresence>
        {slashMenuOpen && filteredCmds.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 4 }} transition={{ duration: 0.12 }} style={menuBase}>
            <div style={{ padding: '7px 12px 5px', borderBottom: '1px solid var(--color-border)' }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--color-text-tertiary)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Comandos</span>
            </div>
            {filteredCmds.map((cmd, i) => (
              <button key={cmd.id} onMouseDown={e => { e.preventDefault(); selectCmd(cmd) }}
                onMouseEnter={() => setSlashIndex(i)}
                style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: i === slashIndex ? 'var(--color-bg-secondary)' : 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left' as const, transition: 'background 0.08s' }}>
                <div style={{ width: 26, height: 26, borderRadius: 6, border: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-secondary)', flexShrink: 0 }}>
                  <CmdIcon id={cmd.id} />
                </div>
                <div>
                  <span style={{ fontFamily: 'var(--font-sans)', fontSize: 13, fontWeight: 500, color: 'var(--color-text-primary)', display: 'block', lineHeight: 1.3 }}>{cmd.label}</span>
                  <span style={{ fontFamily: 'var(--font-sans)', fontSize: 11, color: 'var(--color-text-tertiary)', lineHeight: 1.3 }}>{cmd.description}</span>
                </div>
              </button>
            ))}
            <div style={{ padding: '4px 12px 7px', borderTop: '1px solid var(--color-border)' }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--color-text-tertiary)', opacity: 0.7 }}>↑↓ navegar · Enter selecionar · Esc fechar</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Skills picker */}
      <AnimatePresence>
        {skillsPickerOpen && (
          <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 4 }} transition={{ duration: 0.12 }}
            style={{ ...menuBase, maxHeight: 260, display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '7px 12px 5px', borderBottom: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--color-text-tertiary)', letterSpacing: '0.08em', textTransform: 'uppercase' as const }}>Skills</span>
              <button onMouseDown={e => { e.preventDefault(); setSkillsPickerOpen(false) }} style={{ ...iconBtnStyle, width: 22, height: 22 }}>
                <IClipX />
              </button>
            </div>
            <div style={{ overflowY: 'auto', flex: 1 }}>
              {creatingSkill ? (
                <div style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <input value={newSkillName} onChange={e => setNewSkillName(e.target.value)} placeholder="Nome da skill"
                    style={{ fontFamily: 'var(--font-sans)', fontSize: 13, padding: '6px 10px', borderRadius: 6, border: '1px solid var(--color-border)', background: 'var(--color-bg-secondary)', color: 'var(--color-text-primary)', outline: 'none' }} />
                  <textarea value={newSkillContent} onChange={e => setNewSkillContent(e.target.value)} placeholder="Instruções para a IA..."
                    rows={3} style={{ fontFamily: 'var(--font-sans)', fontSize: 12, padding: '6px 10px', borderRadius: 6, border: '1px solid var(--color-border)', background: 'var(--color-bg-secondary)', color: 'var(--color-text-primary)', outline: 'none', resize: 'vertical' }} />
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button onMouseDown={e => { e.preventDefault(); handleCreateSkill() }}
                      style={{ flex: 1, fontFamily: 'var(--font-sans)', fontSize: 12, fontWeight: 500, padding: '5px 0', borderRadius: 6, border: 'none', cursor: 'pointer', background: 'var(--color-primary)', color: 'white' }}>Criar</button>
                    <button onMouseDown={e => { e.preventDefault(); setCreatingSkill(false); setNewSkillName(''); setNewSkillContent('') }}
                      style={{ fontFamily: 'var(--font-sans)', fontSize: 12, padding: '5px 10px', borderRadius: 6, border: '1px solid var(--color-border)', cursor: 'pointer', background: 'transparent', color: 'var(--color-text-secondary)' }}>Cancelar</button>
                  </div>
                </div>
              ) : skillsLoading
                ? <div style={{ padding: '16px 12px', fontFamily: 'var(--font-sans)', fontSize: 13, color: 'var(--color-text-tertiary)' }}>Carregando...</div>
                : skills.length === 0
                ? <div style={{ padding: '16px 12px', fontFamily: 'var(--font-sans)', fontSize: 13, color: 'var(--color-text-tertiary)' }}>Nenhuma skill disponível</div>
                : skills.map(skill => {
                  const isSelected = attachedSkill?.id === skill.id
                  return (
                    <button key={skill.id}
                      onMouseDown={e => { e.preventDefault(); setAttachedSkill(isSelected ? null : skill); setSkillsPickerOpen(false); setTimeout(() => inputRef.current?.focus(), 50) }}
                      style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', background: isSelected ? 'var(--color-bg-secondary)' : 'transparent', border: 'none', borderBottom: '1px solid var(--color-border)', cursor: 'pointer', textAlign: 'left' as const, transition: 'background 0.08s' }}
                      onMouseEnter={e => { if (!isSelected) (e.currentTarget as HTMLButtonElement).style.background = 'var(--color-bg-secondary)' }}
                      onMouseLeave={e => { if (!isSelected) (e.currentTarget as HTMLButtonElement).style.background = 'transparent' }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontFamily: 'var(--font-sans)', fontSize: 13, fontWeight: 500, color: 'var(--color-text-primary)' }}>{skill.name}</span>
                          {skill.is_global && (
                            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--color-text-tertiary)', border: '1px solid var(--color-border)', borderRadius: 3, padding: '0 4px', textTransform: 'uppercase' as const, letterSpacing: '0.06em', lineHeight: '16px' }}>Northie</span>
                          )}
                        </div>
                        {skill.description && <span style={{ fontFamily: 'var(--font-sans)', fontSize: 11, color: 'var(--color-text-tertiary)', display: 'block', marginTop: 1 }}>{skill.description}</span>}
                      </div>
                      {isSelected && <div style={{ color: 'var(--color-primary)', flexShrink: 0 }}><ICheckMark /></div>}
                    </button>
                  )
                })
              }
            </div>
            {!creatingSkill && !skillsLoading && (
              <div style={{ padding: '6px 12px 8px', borderTop: '1px solid var(--color-border)', flexShrink: 0 }}>
                <button onMouseDown={e => { e.preventDefault(); setCreatingSkill(true) }}
                  style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, fontFamily: 'var(--font-sans)', fontSize: 12, fontWeight: 500, color: 'var(--color-text-secondary)', padding: '5px 0', borderRadius: 6, border: '1px dashed var(--color-border)', cursor: 'pointer', background: 'transparent', transition: 'background 0.1s' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--color-bg-secondary)' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent' }}>
                  <IPlus /> Criar skill
                </button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Model dropdown */}
      <AnimatePresence>
        {modelMenuOpen && (
          <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 4 }} transition={{ duration: 0.12 }}
            style={{ ...menuBase, right: 'auto', width: 210 }}>
            <div style={{ padding: '7px 12px 5px', borderBottom: '1px solid var(--color-border)' }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--color-text-tertiary)', letterSpacing: '0.08em', textTransform: 'uppercase' as const }}>Modelo de IA</span>
            </div>
            {MODELS.map(m => (
              <button key={m.id} onMouseDown={e => { e.preventDefault(); onModelChange(m.id); setModelMenuOpen(false) }}
                style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: model === m.id ? 'var(--color-bg-secondary)' : 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left' as const, transition: 'background 0.08s' }}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--color-bg-secondary)' }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = model === m.id ? 'var(--color-bg-secondary)' : 'transparent' }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: model === m.id ? 'var(--color-primary)' : 'var(--color-text-tertiary)', border: `1px solid ${model === m.id ? 'var(--color-primary)' : 'var(--color-border)'}`, borderRadius: 4, padding: '1px 5px', letterSpacing: '0.04em', lineHeight: '16px', flexShrink: 0 }}>{m.tag}</span>
                <div style={{ flex: 1 }}>
                  <span style={{ fontFamily: 'var(--font-sans)', fontSize: 13, fontWeight: 500, color: 'var(--color-text-primary)', display: 'block', lineHeight: 1.3 }}>{m.label}</span>
                  <span style={{ fontFamily: 'var(--font-sans)', fontSize: 11, color: 'var(--color-text-tertiary)', lineHeight: 1.3 }}>{m.description}</span>
                </div>
                {model === m.id && <div style={{ color: 'var(--color-primary)', flexShrink: 0 }}><ICheckMark /></div>}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Context chips */}
      <AnimatePresence>
        {(attachedSkill || attachedFiles.length > 0) && (
          <motion.div initial={{ opacity: 0, y: 3 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 6 }}>
            {attachedSkill && (
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 26, padding: '0 8px 0 10px', background: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)', borderRadius: 6 }}>
                <ISkill />
                <span style={{ fontFamily: 'var(--font-sans)', fontSize: 12, fontWeight: 500, color: 'var(--color-text-primary)' }}>{attachedSkill.name}</span>
                <button onClick={() => setAttachedSkill(null)} style={{ ...iconBtnStyle, width: 16, height: 16, borderRadius: 3, marginLeft: 2 }}><IClipX /></button>
              </div>
            )}
            {attachedFiles.map((f, i) => (
              <div key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 26, padding: '0 8px 0 10px', background: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)', borderRadius: 6 }}>
                <svg width="12" height="12" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M13 2H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V7z"/><polyline points="13,2 13,7 18,7"/></svg>
                <span style={{ fontFamily: 'var(--font-sans)', fontSize: 12, color: 'var(--color-text-primary)', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</span>
                <button onClick={() => removeFile(i)} style={{ ...iconBtnStyle, width: 16, height: 16, borderRadius: 3, marginLeft: 2 }}><IClipX /></button>
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Input box */}
      <input ref={fileInputRef} type="file" multiple accept=".pdf,.csv,.txt,.xlsx,.png,.jpg,.jpeg" onChange={handleFileChange} style={{ display: 'none' }} />

      <div style={{ background: 'var(--color-bg-primary)', border: '1px solid var(--color-border)', borderRadius: 14, boxShadow: '0 1px 12px rgba(0,0,0,0.05)', overflow: 'hidden' }}>
        <div style={{ padding: '12px 14px 8px' }}>
          <textarea
            ref={inputRef}
            value={value}
            onChange={e => handleChange(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Explore seus dados — use / para comandos..."
            rows={1}
            style={{ width: '100%', border: 'none', outline: 'none', background: 'transparent', fontFamily: 'var(--font-sans)', fontSize: 14, color: 'var(--color-text-primary)', resize: 'none', lineHeight: 1.55, maxHeight: 140, padding: 0 }}
          />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', padding: '4px 8px 8px', gap: 2 }}>
          <motion.button whileTap={{ scale: 0.93 }}
            onClick={() => fileInputRef.current?.click()}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--color-bg-secondary)'; (e.currentTarget as HTMLButtonElement).style.color = 'var(--color-text-secondary)' }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'none'; (e.currentTarget as HTMLButtonElement).style.color = 'var(--color-text-tertiary)' }}
            title="Anexar arquivo" style={iconBtnStyle}>
            <IAttach />
          </motion.button>
          <motion.button whileTap={{ scale: 0.95 }}
            onMouseDown={e => { e.preventDefault(); setModelMenuOpen(v => !v); setSlashMenuOpen(false); setSkillsPickerOpen(false) }}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontFamily: 'var(--font-sans)', fontSize: 12, fontWeight: 400, color: 'var(--color-text-tertiary)', padding: '3px 8px', borderRadius: 6, border: 'none', background: 'none', cursor: 'pointer', transition: 'background 0.1s, color 0.1s', marginLeft: 2 }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--color-bg-secondary)'; (e.currentTarget as HTMLButtonElement).style.color = 'var(--color-text-secondary)' }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'none'; (e.currentTarget as HTMLButtonElement).style.color = 'var(--color-text-tertiary)' }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, border: '1px solid var(--color-border)', borderRadius: 3, padding: '0 4px', lineHeight: '15px' }}>{currentModel.tag}</span>
            {currentModel.label}
            <IChevronDown />
          </motion.button>
          <div style={{ flex: 1 }} />
          <motion.button whileTap={{ scale: 0.95 }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--color-bg-secondary)'; (e.currentTarget as HTMLButtonElement).style.color = 'var(--color-text-secondary)' }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'none'; (e.currentTarget as HTMLButtonElement).style.color = 'var(--color-text-tertiary)' }}
            style={iconBtnStyle}>
            <IVoice />
          </motion.button>
          <motion.button
            whileHover={{ scale: canSend ? 1.04 : 1 }} whileTap={{ scale: canSend ? 0.93 : 1 }}
            onClick={() => { onSend(attachedFiles, attachedSkill?.id); setAttachedFiles([]) }}
            disabled={!canSend}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 30, height: 30, borderRadius: 8, border: 'none', cursor: canSend ? 'pointer' : 'default', background: canSend ? 'var(--color-primary)' : 'var(--color-bg-tertiary)', color: canSend ? 'white' : 'var(--color-text-tertiary)', transition: 'background 0.15s, color 0.15s', flexShrink: 0 }}>
            <ISend />
          </motion.button>
        </div>
      </div>
    </div>
  )
}

// ── Suggestion chips ───────────────────────────────────────────────────────────

const SUGGESTION_CHIPS = [
  'Qual campanha está destruindo margem?',
  'Quem são meus clientes prontos para recomprar?',
  'Qual canal devo escalar agora?',
  'Analise meu ROAS vs LTV por canal',
]

// ── Page ───────────────────────────────────────────────────────────────────────

export default function Growth() {
  const [messages, setMessages] = useState<Message[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [input, setInput] = useState('')
  const [model, setModel] = useState<AIModel>(() => (localStorage.getItem('northie:ai-model') as AIModel) || 'sonnet')
  const [userName, setUserName] = useState('você')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => { localStorage.setItem('northie:ai-model', model) }, [model])

  useEffect(() => {
    import('../lib/supabase').then(({ supabase }) => {
      supabase.auth.getUser().then(({ data: { user } }) => {
        if (!user) return
        const name = user.user_metadata?.full_name ?? user.email?.split('@')[0] ?? 'você'
        setUserName(name.split(' ')[0])
      })
    })
  }, [])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isLoading])

  useEffect(() => {
    const el = inputRef.current
    if (!el) return
    el.style.height = '0px'
    el.style.height = Math.min(Math.max(el.scrollHeight, 22), 140) + 'px'
  }, [input])

  const addAssistantMessage = useCallback((content: string) => {
    setMessages(prev => [...prev, { id: Date.now().toString(), role: 'assistant', content }])
  }, [])

  const sendMessage = useCallback(async (text: string, skillId?: string) => {
    if (!text.trim() || isLoading) return
    const userMsg: Message = { id: Date.now().toString(), role: 'user', content: text }
    setMessages(prev => [...prev, userMsg])
    setIsLoading(true)
    try {
      const res = await aiApi.chat(text, 'Growth', 'growth', model, skillId)
      const content: string = res.data?.content ?? res.data?.message ?? 'Sem resposta.'
      addAssistantMessage(content)
    } catch {
      addAssistantMessage(ERROR_MESSAGE)
    } finally {
      setIsLoading(false)
    }
  }, [isLoading, model, addAssistantMessage])

  const handleSend = useCallback(async (files: File[] = [], skillId?: string) => {
    if (!input.trim() || isLoading) return
    let text = input.trim()
    if (files.length > 0) {
      const fileList = files.map(f => f.name).join(', ')
      text = `[Arquivos anexados: ${fileList}]\n\n${text}`
    }
    setInput('')
    await sendMessage(text, skillId)
    setTimeout(() => inputRef.current?.focus(), 50)
  }, [input, isLoading, sendMessage])

  const handleSlashCommand = useCallback(async (cmd: SlashCmd, arg?: string) => {
    switch (cmd.id) {
      case 'insights': {
        setMessages(prev => [...prev, { id: Date.now().toString(), role: 'user', content: '/insights' }])
        setIsLoading(true)
        try {
          const res = await growthApi.listInsights()
          const items: { title: string; impact_estimate?: string }[] = res.data ?? []
          if (items.length === 0) {
            addAssistantMessage('Nenhum insight pendente no momento. Os agentes estão analisando seus dados continuamente.')
          } else {
            const text = `Insights pendentes (${items.length}):\n\n` + items.map((r, i) =>
              `${i + 1}. ${r.title}${r.impact_estimate ? `\n   ${r.impact_estimate}` : ''}`
            ).join('\n\n')
            addAssistantMessage(text)
          }
        } catch {
          addAssistantMessage('Não foi possível carregar os insights agora.')
        } finally {
          setIsLoading(false)
        }
        break
      }
      case 'executar': {
        setMessages(prev => [...prev, { id: Date.now().toString(), role: 'user', content: '/executar' }])
        setIsLoading(true)
        try {
          await growthApi.runEngine()
          addAssistantMessage('Growth Engine iniciado. Os resultados aparecerão em insights em instantes.')
        } catch {
          addAssistantMessage('Não foi possível iniciar o Growth Engine agora.')
        } finally {
          setIsLoading(false)
        }
        break
      }
      case 'automacoes': {
        setMessages(prev => [...prev, { id: Date.now().toString(), role: 'user', content: '/automacoes' }])
        setIsLoading(true)
        try {
          const res = await growthApi.listRecommendations()
          const items: { title: string; status: string }[] = res.data ?? []
          if (items.length === 0) {
            addAssistantMessage('Nenhuma automação registrada ainda.')
          } else {
            const text = `Automações (${items.length}):\n\n` + items.map((r, i) =>
              `${i + 1}. ${r.title} — ${r.status}`
            ).join('\n')
            addAssistantMessage(text)
          }
        } catch {
          addAssistantMessage('Não foi possível carregar as automações agora.')
        } finally {
          setIsLoading(false)
        }
        break
      }
      case 'memoria': {
        setMessages(prev => [...prev, { id: Date.now().toString(), role: 'user', content: '/memoria' }])
        setIsLoading(true)
        try {
          const res = await growthApi.getExecutionHistory()
          const items: { title: string; status: string; created_at: string }[] = res.data ?? []
          if (items.length === 0) {
            addAssistantMessage('Nenhuma decisão registrada ainda.')
          } else {
            const text = `Histórico de decisões (${items.length}):\n\n` + items.slice(0, 10).map((r, i) =>
              `${i + 1}. ${r.title} — ${r.status} (${new Date(r.created_at).toLocaleDateString('pt-BR')})`
            ).join('\n')
            addAssistantMessage(text)
          }
        } catch {
          addAssistantMessage('Não foi possível carregar o histórico agora.')
        } finally {
          setIsLoading(false)
        }
        break
      }
      case 'instrucao': {
        if (!arg?.trim()) {
          addAssistantMessage('Use /instrucao seguido do texto. Exemplo: /instrucao Sempre analise pelo ângulo do LTV.')
          return
        }
        setMessages(prev => [...prev, { id: Date.now().toString(), role: 'user', content: `/instrucao ${arg}` }])
        setIsLoading(true)
        try {
          await growthApi.addInstruction(arg.trim())
          addAssistantMessage(`Instrução registrada: "${arg.trim()}"\n\nVou considerar isso em todas as análises futuras.`)
        } catch {
          addAssistantMessage('Não foi possível registrar a instrução agora.')
        } finally {
          setIsLoading(false)
        }
        break
      }
    }
  }, [addAssistantMessage])

  const hasMessages = messages.length > 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden', background: 'var(--color-bg)' }}>

      {/* Header */}
      <div style={{ flexShrink: 0, padding: '16px 24px', borderBottom: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--color-bg-primary)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--color-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="13" height="13" viewBox="0 0 20 20" fill="none">
              <circle cx="10" cy="10" r="3.5" fill="white" />
              <circle cx="10" cy="10" r="6.5" stroke="white" strokeWidth="1.2" />
            </svg>
          </div>
          <span style={{ fontFamily: 'var(--font-sans)', fontSize: 15, fontWeight: 600, color: 'var(--color-text-primary)', letterSpacing: '-0.2px' }}>
            Northie Growth
          </span>
        </div>
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={() => { setMessages([]); setInput(''); setTimeout(() => inputRef.current?.focus(), 50) }}
          style={{ display: 'flex', alignItems: 'center', gap: 5, fontFamily: 'var(--font-sans)', fontSize: 12, color: 'var(--color-text-tertiary)', padding: '5px 10px', borderRadius: 7, border: '1px solid var(--color-border)', background: 'transparent', cursor: 'pointer', transition: 'background 0.1s' }}
          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--color-bg-secondary)' }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent' }}>
          <ISpin />
          Nova conversa
        </motion.button>
      </div>

      {/* Messages area */}
      <div style={{ flex: 1, overflowY: 'auto', scrollbarWidth: 'thin' }}>
        <div style={{ maxWidth: 800, margin: '0 auto', padding: '32px 24px 16px' }}>

          {/* Empty state */}
          <AnimatePresence>
            {!hasMessages && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.28, ease: [0.25, 0.1, 0.25, 1] }}
                style={{ paddingTop: 48, paddingBottom: 32 }}
              >
                <h2 style={{ fontFamily: 'var(--font-sans)', fontSize: 26, fontWeight: 600, color: 'var(--color-text-primary)', letterSpacing: '-0.5px', margin: '0 0 8px' }}>
                  {greeting(userName)}
                </h2>
                <p style={{ fontFamily: 'var(--font-sans)', fontSize: 15, color: 'var(--color-text-secondary)', margin: '0 0 28px', lineHeight: 1.6 }}>
                  O que você quer entender sobre seu negócio hoje?
                </p>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {SUGGESTION_CHIPS.map((chip, i) => (
                    <motion.button
                      key={i}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.97 }}
                      onClick={() => { setInput(chip); setTimeout(() => inputRef.current?.focus(), 50) }}
                      style={{ fontFamily: 'var(--font-sans)', fontSize: 13, color: 'var(--color-text-secondary)', padding: '8px 14px', borderRadius: 20, border: '1px solid var(--color-border)', background: 'var(--color-bg-primary)', cursor: 'pointer', transition: 'background 0.12s, color 0.12s', lineHeight: 1.4 }}
                      onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--color-bg-secondary)'; (e.currentTarget as HTMLButtonElement).style.color = 'var(--color-text-primary)' }}
                      onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--color-bg-primary)'; (e.currentTarget as HTMLButtonElement).style.color = 'var(--color-text-secondary)' }}
                    >
                      {chip}
                    </motion.button>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Message list */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {messages.map(msg => (
              <ChatMessage key={msg.id} msg={msg} />
            ))}
            <AnimatePresence>
              {isLoading && <TypingDots />}
            </AnimatePresence>
            <div ref={messagesEndRef} />
          </div>
        </div>
      </div>

      {/* Input */}
      <div style={{ flexShrink: 0, padding: '12px 24px 20px', background: 'var(--color-bg)' }}>
        <div style={{ maxWidth: 800, margin: '0 auto' }}>
          <ChatInput
            value={input}
            onChange={setInput}
            onSend={handleSend}
            onSlashCommand={handleSlashCommand}
            inputRef={inputRef}
            loading={isLoading}
            model={model}
            onModelChange={setModel}
            onClear={() => { setMessages([]); setInput('') }}
          />
          <p style={{ fontFamily: 'var(--font-sans)', fontSize: 11, color: 'var(--color-text-tertiary)', textAlign: 'center', margin: '10px 0 0', opacity: 0.7 }}>
            Use <span style={{ fontFamily: 'var(--font-mono)' }}>/</span> para comandos — skills, insights, automações e mais
          </p>
        </div>
      </div>
    </div>
  )
}
