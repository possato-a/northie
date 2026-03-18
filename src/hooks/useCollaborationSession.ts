import { useState, useRef, useCallback } from 'react'
import { growthApi } from '../lib/api'

// ── Types ──────────────────────────────────────────────────────────────────────

export interface CollabMessage {
  role: 'user' | 'assistant'
  content: string
  timestamp: string
}

export interface SegmentItem {
  id: string
  email: string
  phone?: string
  total_ltv: number
  rfm_score?: string
  churn_probability?: number
  last_purchase_at?: string
  days_inactive?: number
}

export type CollabPhase =
  | 'loading'
  | 'collaborating'
  | 'confirming'
  | 'executing'
  | 'done'
  | 'error'

export interface ExecutionProgress {
  sent: number
  total: number
  failed: number
}

export interface UseCollaborationSessionReturn {
  phase: CollabPhase
  messages: CollabMessage[]
  segmentItems: SegmentItem[]
  draftMessage: string
  customersWithPhone: number
  customersWithoutPhone: number
  executionProgress: ExecutionProgress
  inputValue: string
  isTyping: boolean
  error: string | null
  setInputValue: (v: string) => void
  startSession: (recommendationId: string) => Promise<void>
  sendMessage: () => Promise<void>
  confirmExecution: () => Promise<void>
  abandon: () => Promise<void>
}

// ── Hook ───────────────────────────────────────────────────────────────────────

export function useCollaborationSession(): UseCollaborationSessionReturn {
  const [phase, setPhase] = useState<CollabPhase>('loading')
  const [messages, setMessages] = useState<CollabMessage[]>([])
  const [segmentItems, setSegmentItems] = useState<SegmentItem[]>([])
  const [draftMessage, setDraftMessage] = useState('')
  const [customersWithPhone, setCustomersWithPhone] = useState(0)
  const [customersWithoutPhone, setCustomersWithoutPhone] = useState(0)
  const [executionProgress, setExecutionProgress] = useState<ExecutionProgress>({ sent: 0, total: 0, failed: 0 })
  const [inputValue, setInputValue] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const sessionIdRef = useRef<string | null>(null)
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const stopPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current)
      pollingRef.current = null
    }
  }, [])

  const startSession = useCallback(async (recommendationId: string) => {
    setPhase('loading')
    setError(null)
    setMessages([])
    setSegmentItems([])
    setDraftMessage('')
    setInputValue('')
    setCustomersWithPhone(0)
    setCustomersWithoutPhone(0)
    setExecutionProgress({ sent: 0, total: 0, failed: 0 })
    sessionIdRef.current = null

    try {
      const res = await growthApi.collaborate(recommendationId)
      const data = res.data as {
        session_id: string
        opening_message: string
        segment_snapshot: SegmentItem[]
        customers_with_phone: number
        customers_without_phone: number
      }

      sessionIdRef.current = data.session_id

      const openingMsg: CollabMessage = {
        role: 'assistant',
        content: data.opening_message,
        timestamp: new Date().toISOString(),
      }

      setMessages([openingMsg])
      setSegmentItems(data.segment_snapshot ?? [])
      setCustomersWithPhone(data.customers_with_phone ?? 0)
      setCustomersWithoutPhone(data.customers_without_phone ?? 0)
      setPhase('collaborating')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao iniciar sessão de colaboração.'
      setError(msg)
      setPhase('error')
    }
  }, [])

  const sendMessage = useCallback(async () => {
    const sessionId = sessionIdRef.current
    if (!sessionId || !inputValue.trim() || isTyping) return

    const userMsg: CollabMessage = {
      role: 'user',
      content: inputValue.trim(),
      timestamp: new Date().toISOString(),
    }

    setMessages(prev => [...prev, userMsg])
    setInputValue('')
    setIsTyping(true)

    try {
      const res = await growthApi.sendCollabMessage(sessionId, userMsg.content)
      const data = res.data as { reply: string; draft_message?: string }

      const assistantMsg: CollabMessage = {
        role: 'assistant',
        content: data.reply,
        timestamp: new Date().toISOString(),
      }

      setMessages(prev => [...prev, assistantMsg])

      if (data.draft_message) {
        setDraftMessage(data.draft_message)
      }
    } catch {
      const errMsg: CollabMessage = {
        role: 'assistant',
        content: 'Erro ao processar sua mensagem. Tente novamente.',
        timestamp: new Date().toISOString(),
      }
      setMessages(prev => [...prev, errMsg])
    } finally {
      setIsTyping(false)
    }
  }, [inputValue, isTyping])

  const confirmExecution = useCallback(async () => {
    const sessionId = sessionIdRef.current
    if (!sessionId) return

    const lastAssistantMsg = [...messages].reverse().find(m => m.role === 'assistant')
    const approvedMsg = draftMessage || lastAssistantMsg?.content || ''

    setPhase('executing')
    setExecutionProgress({ sent: 0, total: customersWithPhone, failed: 0 })

    try {
      await growthApi.confirmExecution(sessionId, approvedMsg)

      // Poll session state to track execution progress
      pollingRef.current = setInterval(async () => {
        try {
          const res = await growthApi.getCollabSession(sessionId)
          const data = res.data as {
            status: string
            execution_progress?: { sent: number; total: number; failed: number }
          }

          if (data.execution_progress) {
            setExecutionProgress(data.execution_progress)
          }

          if (data.status === 'completed' || data.status === 'failed') {
            stopPolling()
            setPhase('done')
          }
        } catch {
          // Silently continue polling — transient network error
        }
      }, 2000)

      // Safety timeout: mark done after 2 minutes if still polling
      setTimeout(() => {
        stopPolling()
        setPhase('done')
      }, 120_000)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao confirmar execução.'
      setError(msg)
      setPhase('error')
    }
  }, [draftMessage, messages, customersWithPhone, stopPolling])

  const abandon = useCallback(async () => {
    const sessionId = sessionIdRef.current
    stopPolling()

    if (sessionId) {
      try {
        await growthApi.abandonSession(sessionId)
      } catch {
        // Silently ignore — caller will close the modal regardless
      }
    }

    sessionIdRef.current = null
    setPhase('loading')
    setMessages([])
    setSegmentItems([])
    setDraftMessage('')
    setInputValue('')
    setError(null)
  }, [stopPolling])

  return {
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
  }
}
