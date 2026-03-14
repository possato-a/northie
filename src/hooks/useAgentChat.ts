import { useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'

export interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
}

interface UseAgentChatReturn {
  messages: Message[]
  isLoading: boolean
  agentId: string | null
  conversationId: string | null
  sendMessage: (text: string) => Promise<void>
  startConversation: (agentId: string) => Promise<void>
  loadConversation: (conversationId: string) => Promise<void>
  reset: () => void
}

const API_URL = window.location.hostname === 'localhost'
  ? 'http://localhost:3001/api/agents/chat'
  : '/api/agents/chat'

export function useAgentChat(): UseAgentChatReturn {
  const [messages, setMessages] = useState<Message[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [agentId, setAgentId] = useState<string | null>(null)
  const [conversationId, setConversationId] = useState<string | null>(null)

  const startConversation = useCallback(async (selectedAgentId: string) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data, error } = await supabase
      .from('agent_conversations')
      .insert({
        user_id: user.id,
        agent_id: selectedAgentId,
        messages: [],
        title: null,
      })
      .select('id')
      .single()

    if (error || !data) {
      // Fallback: set agentId without persisting if table doesn't exist yet
      setAgentId(selectedAgentId)
      setConversationId(`local_${Date.now()}`)
      setMessages([])
      return
    }

    setAgentId(selectedAgentId)
    setConversationId(data.id)
    setMessages([])
  }, [])

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || isLoading) return

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: text,
    }

    const updatedMessages = [...messages, userMsg]
    setMessages(updatedMessages)
    setIsLoading(true)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token

      const conversationHistory = messages.map(m => ({ role: m.role, content: m.content }))

      const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          agentId,
          message: text,
          conversationHistory,
        }),
      })

      const responseData = await response.json()
      const assistantContent = responseData.reply ?? responseData.content ?? 'Sem resposta.'

      const assistantMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: assistantContent,
      }

      const allMessages = [...updatedMessages, assistantMsg]
      setMessages(allMessages)

      // Persist to Supabase
      if (conversationId && !conversationId.startsWith('local_')) {
        const title = updatedMessages.find(m => m.role === 'user')?.content.slice(0, 50) ?? null
        await supabase
          .from('agent_conversations')
          .update({
            messages: allMessages,
            updated_at: new Date().toISOString(),
            title,
          })
          .eq('id', conversationId)
      }
    } catch {
      const errorMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'Desculpe, tive um problema ao processar sua pergunta.',
      }
      setMessages(prev => [...prev, errorMsg])
    } finally {
      setIsLoading(false)
    }
  }, [messages, isLoading, agentId, conversationId])

  const loadConversation = useCallback(async (convId: string) => {
    const { data, error } = await supabase
      .from('agent_conversations')
      .select('id, agent_id, messages')
      .eq('id', convId)
      .single()

    if (error || !data) return

    setConversationId(data.id)
    setAgentId(data.agent_id)
    setMessages((data.messages as Message[]) ?? [])
  }, [])

  const reset = useCallback(() => {
    setMessages([])
    setAgentId(null)
    setConversationId(null)
  }, [])

  return {
    messages,
    isLoading,
    agentId,
    conversationId,
    sendMessage,
    startConversation,
    loadConversation,
    reset,
  }
}
