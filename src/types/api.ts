// ── Comunidade ─────────────────────────────────────────────────────────────

export interface ComunidadeMembro {
  id: string
  name: string
  avatar_url?: string
  business_type?: string
  mrr?: number
  points?: number
  streak?: number
  joined_at: string
}

export interface ComunidadePost {
  id: string
  author_id: string
  author_name: string
  author_avatar?: string
  space: string
  content: string
  likes: string[]
  comments_count: number
  created_at: string
}

export interface ComunidadeEvent {
  id: string
  title: string
  description?: string
  type: 'live' | 'workshop' | 'mentoria' | 'replay'
  starts_at: string
  ends_at?: string
  host_name: string
  replay_url?: string
  attendees_count: number
  enrolled: boolean
}

export interface ComunidadeDrop {
  id: string
  title: string
  description?: string
  type: string
  expires_at?: string
  download_url?: string
  active: boolean
  downloads_count: number
}

// ── Agents ─────────────────────────────────────────────────────────────────

export interface AgentMessage {
  role: 'user' | 'assistant'
  content: string
  timestamp?: string
}

export interface AgentChatRequest {
  agentId: string
  message: string
  conversationHistory: AgentMessage[]
}

export interface AgentChatResponse {
  reply: string
  conversationId?: string
}

export interface AgentConversation {
  id: string
  agent_id: string
  title: string
  messages: AgentMessage[]
  updated_at: string
}

// ── WhatsApp ───────────────────────────────────────────────────────────────

export interface WhatsAppMessage {
  id: string
  from: string
  body: string
  direction: 'inbound' | 'outbound'
  status: string
  created_at: string
}

export interface WhatsAppConversation {
  id: string
  contact_name: string
  contact_phone: string
  last_message?: string
  unread_count: number
  updated_at: string
}

// ── Calendar ───────────────────────────────────────────────────────────────

export interface CalendarEvent {
  id: string
  title: string
  description?: string
  start: string
  end: string
  attendees?: string[]
  meet_url?: string
}

// ── Alerts ─────────────────────────────────────────────────────────────────

export interface Alert {
  id: string
  type: 'anomaly' | 'opportunity' | 'warning' | 'info'
  title: string
  message: string
  metric?: string
  value?: number
  threshold?: number
  read: boolean
  created_at: string
}

// ── Reports ────────────────────────────────────────────────────────────────

export interface Report {
  id: string
  title: string
  type: 'weekly' | 'monthly' | 'quarterly'
  format: 'pdf' | 'csv'
  status: 'pending' | 'generating' | 'ready' | 'failed'
  file_url?: string
  created_at: string
}
