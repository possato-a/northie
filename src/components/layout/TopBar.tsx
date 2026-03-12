import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../../lib/supabase'
import { alertsApi } from '../../lib/api'

interface TopBarProps {
  onToggleChat?: () => void
}

interface Alert {
  id: string
  type: string
  severity: 'info' | 'warning' | 'critical'
  title: string
  body: string
  read: boolean
  created_at: string
}

const DROPDOWN_EASING = { duration: 0.14, ease: [0.25, 0.1, 0.25, 1] as const }

const SEVERITY_DOT: Record<string, string> = {
  critical: '#dc2626',
  warning: '#d97706',
  info: '#2563eb',
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'agora'
  if (m < 60) return `${m}m atrás`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h atrás`
  return `${Math.floor(h / 24)}d atrás`
}

export default function TopBar(_props: TopBarProps) {
  const [query, setQuery] = useState('')
  const [focused, setFocused] = useState(false)
  const [notifOpen, setNotifOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const [userEmail, setUserEmail] = useState('')
  const [userName, setUserName] = useState('')
  const [alerts, setAlerts] = useState<Alert[]>([])
  const notifRef = useRef<HTMLDivElement>(null)
  const profileRef = useRef<HTMLDivElement>(null)
  const prevUnreadRef = useRef(0)

  // Load current user
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUserEmail(session.user.email ?? '')
        setUserName(
          session.user.user_metadata?.full_name ||
          session.user.email?.split('@')[0] ||
          'F'
        )
      }
    })
  }, [])

  const loadAlerts = useCallback(async () => {
    try {
      const res = await alertsApi.list()
      const data: Alert[] = res.data?.data || []
      const unread = data.filter(a => !a.read).length

      // Browser notification when new unread alerts arrive
      if (unread > prevUnreadRef.current && Notification.permission === 'granted' && prevUnreadRef.current > 0) {
        const newest = data.find(a => !a.read)
        if (newest) {
          new Notification(`Northie — ${newest.title}`, { body: newest.body, icon: '/favicon.ico' })
        }
      }
      prevUnreadRef.current = unread
      setAlerts(data)
    } catch {
      // silently fail if not authenticated yet
    }
  }, [])

  // Load alerts on mount + poll every 5 minutes
  useEffect(() => {
    loadAlerts()
    const interval = setInterval(loadAlerts, 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [loadAlerts])

  // Close dropdowns when clicking outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setNotifOpen(false)
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) setProfileOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const unreadCount = alerts.filter(a => !a.read).length
  const initial = userName?.[0]?.toUpperCase() || 'F'

  function navigateTo(page: string) {
    setProfileOpen(false)
    window.dispatchEvent(new CustomEvent('northie:navigate', { detail: page }))
  }

  async function handleLogout() {
    setProfileOpen(false)
    await supabase.auth.signOut()
  }

  async function handleMarkAllRead() {
    await alertsApi.markAllRead()
    setAlerts(prev => prev.map(a => ({ ...a, read: true })))
    prevUnreadRef.current = 0
  }

  async function handleMarkRead(id: string) {
    await alertsApi.markRead(id)
    setAlerts(prev => prev.map(a => a.id === id ? { ...a, read: true } : a))
  }

  function handleOpenNotif() {
    setNotifOpen(o => !o)
    setProfileOpen(false)
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.25, 0.1, 0.25, 1] }}
      style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 32 }}
    >
      {/* Search */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          height: 36,
          border: `1px solid ${focused ? 'var(--color-primary)' : 'var(--color-border)'}`,
          borderRadius: 'var(--radius-lg)',
          paddingLeft: 12,
          paddingRight: 12,
          background: focused ? 'var(--color-bg-primary)' : 'var(--color-bg-secondary)',
          transition: 'border-color var(--transition-base), background var(--transition-base), box-shadow var(--transition-base)',
          boxShadow: focused ? '0 0 0 2px var(--color-primary-light)' : 'none',
        }}
      >
        <svg width="14" height="14" viewBox="0 0 15 15" fill="none" style={{ flexShrink: 0, color: 'var(--color-text-tertiary)' }}>
          <circle cx="6.5" cy="6.5" r="5.5" stroke="currentColor" strokeWidth="1.3" />
          <line x1="10.5" y1="10.5" x2="14" y2="14" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
        </svg>
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder="Buscar em Northie..."
          style={{
            flex: 1,
            border: 'none',
            background: 'transparent',
            outline: 'none',
            fontFamily: 'var(--font-sans)',
            fontSize: 'var(--text-base)',
            color: 'var(--color-text-primary)',
            letterSpacing: '-0.1px',
          }}
        />
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 'var(--text-xs)',
            color: 'var(--color-text-tertiary)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-sm)',
            padding: '2px 5px',
            flexShrink: 0,
            background: 'var(--color-bg-primary)',
          }}
        >
          ⌘K
        </span>
      </div>

      {/* Notification bell */}
      <div ref={notifRef} style={{ position: 'relative', flexShrink: 0 }}>
        <motion.button
          onClick={handleOpenNotif}
          whileHover={{ background: 'var(--color-bg-tertiary)' } as any}
          whileTap={{ scale: 0.93 }}
          style={{
            width: 36, height: 36,
            border: `1px solid ${notifOpen ? 'var(--color-primary)' : 'var(--color-border)'}`,
            borderRadius: 'var(--radius-lg)',
            background: notifOpen ? 'var(--color-bg-tertiary)' : 'var(--color-bg-secondary)',
            cursor: 'pointer',
            color: 'var(--color-text-secondary)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'border-color var(--transition-base), background var(--transition-base)',
            position: 'relative',
          }}
        >
          <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
            <path d="M8 1a5 5 0 0 1 5 5v3.5l1.5 2.5H1.5L3 9.5V6a5 5 0 0 1 5-5Z"
              stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
            <path d="M6.5 13.5a1.5 1.5 0 0 0 3 0"
              stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
          </svg>
          {unreadCount > 0 && (
            <motion.span
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              style={{
                position: 'absolute',
                top: 6, right: 6,
                width: 7, height: 7,
                borderRadius: '50%',
                background: '#dc2626',
                border: '1.5px solid var(--color-bg-primary)',
              }}
            />
          )}
        </motion.button>

        <AnimatePresence>
          {notifOpen && (
            <motion.div
              initial={{ opacity: 0, y: -6, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6, scale: 0.97 }}
              transition={DROPDOWN_EASING}
              style={{
                position: 'absolute', top: 'calc(100% + 8px)', right: 0,
                width: 340,
                background: 'var(--color-bg-primary)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-lg)',
                boxShadow: 'var(--shadow-lg)',
                zIndex: 500,
                overflow: 'hidden',
              }}
            >
              <div style={{
                padding: '12px 16px',
                borderBottom: '1px solid var(--color-border)',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              }}>
                <span style={{
                  fontFamily: 'var(--font-sans)',
                  fontSize: 'var(--text-sm)',
                  fontWeight: 600,
                  color: 'var(--color-text-primary)',
                  letterSpacing: '-0.1px',
                }}>
                  Notificações {unreadCount > 0 && (
                    <span style={{
                      marginLeft: 6,
                      background: '#dc262618',
                      color: '#dc2626',
                      fontFamily: 'var(--font-mono)',
                      fontSize: 10,
                      fontWeight: 700,
                      padding: '1px 6px',
                      borderRadius: 4,
                    }}>{unreadCount}</span>
                  )}
                </span>
                {unreadCount > 0 && (
                  <button
                    onClick={handleMarkAllRead}
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer',
                      fontFamily: 'var(--font-sans)', fontSize: 11,
                      color: 'var(--color-text-tertiary)',
                      padding: 0,
                    }}
                  >
                    Marcar todas como lidas
                  </button>
                )}
              </div>

              <div style={{ maxHeight: 360, overflowY: 'auto' }}>
                {alerts.length === 0 ? (
                  <div style={{ padding: '36px 16px', textAlign: 'center' }}>
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-tertiary)" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" style={{ margin: '0 auto 10px', display: 'block' }}>
                      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                    </svg>
                    <p style={{
                      fontFamily: 'var(--font-sans)',
                      fontSize: 'var(--text-sm)',
                      color: 'var(--color-text-tertiary)',
                      margin: 0,
                    }}>
                      Nenhuma notificação
                    </p>
                  </div>
                ) : alerts.map((alert) => (
                  <div
                    key={alert.id}
                    onClick={() => !alert.read && handleMarkRead(alert.id)}
                    style={{
                      padding: '12px 16px',
                      borderBottom: '1px solid var(--color-border)',
                      background: alert.read ? 'transparent' : 'var(--color-bg-secondary)',
                      cursor: alert.read ? 'default' : 'pointer',
                      display: 'flex', gap: 10, alignItems: 'flex-start',
                      transition: 'background var(--transition-base)',
                    }}
                  >
                    <div style={{
                      width: 6, height: 6,
                      borderRadius: '50%',
                      background: alert.read ? 'var(--color-border)' : SEVERITY_DOT[alert.severity] ?? '#6b7280',
                      flexShrink: 0,
                      marginTop: 5,
                    }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{
                        fontFamily: 'var(--font-sans)',
                        fontSize: 'var(--text-sm)',
                        fontWeight: alert.read ? 400 : 600,
                        color: 'var(--color-text-primary)',
                        margin: '0 0 2px',
                        letterSpacing: '-0.1px',
                      }}>
                        {alert.title}
                      </p>
                      <p style={{
                        fontFamily: 'var(--font-sans)',
                        fontSize: 11,
                        color: 'var(--color-text-tertiary)',
                        margin: '0 0 4px',
                        lineHeight: 1.5,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}>
                        {alert.body}
                      </p>
                      <span style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: 10,
                        color: 'var(--color-text-tertiary)',
                      }}>
                        {timeAgo(alert.created_at)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Avatar + profile menu */}
      <div ref={profileRef} style={{ position: 'relative', flexShrink: 0 }}>
        <motion.div
          onClick={() => { setProfileOpen(o => !o); setNotifOpen(false) }}
          whileHover={{ opacity: 0.85 }}
          whileTap={{ scale: 0.95 }}
          style={{
            width: 32, height: 32,
            borderRadius: 'var(--radius-full)',
            border: `1px solid ${profileOpen ? 'var(--color-primary)' : 'var(--color-border)'}`,
            background: 'var(--color-bg-tertiary)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer',
            transition: 'border-color var(--transition-base)',
          }}
        >
          <span style={{
            fontFamily: 'var(--font-sans)',
            fontSize: 13,
            fontWeight: 500,
            color: 'var(--color-text-secondary)',
          }}>
            {initial}
          </span>
        </motion.div>

        <AnimatePresence>
          {profileOpen && (
            <motion.div
              initial={{ opacity: 0, y: -6, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6, scale: 0.97 }}
              transition={DROPDOWN_EASING}
              style={{
                position: 'absolute', top: 'calc(100% + 8px)', right: 0,
                width: 224,
                background: 'var(--color-bg-primary)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-lg)',
                boxShadow: 'var(--shadow-lg)',
                zIndex: 500,
                overflow: 'hidden',
              }}
            >
              {/* User info header */}
              <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--color-border)' }}>
                <p style={{
                  fontFamily: 'var(--font-sans)',
                  fontSize: 'var(--text-sm)',
                  fontWeight: 500,
                  color: 'var(--color-text-primary)',
                  margin: 0,
                  letterSpacing: '-0.1px',
                }}>
                  {userName}
                </p>
                {userEmail && (
                  <p style={{
                    fontFamily: 'var(--font-sans)',
                    fontSize: 11,
                    color: 'var(--color-text-tertiary)',
                    margin: '2px 0 0',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}>
                    {userEmail}
                  </p>
                )}
              </div>

              {/* Menu items */}
              <div style={{ padding: '4px 0' }}>
                <MenuButton
                  icon={
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="8" r="4" /><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
                    </svg>
                  }
                  label="Configurações"
                  onClick={() => navigateTo('configuracoes')}
                />
              </div>

              <div style={{ height: 1, background: 'var(--color-border)', margin: '0' }} />

              <div style={{ padding: '4px 0' }}>
                <MenuButton
                  icon={
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                      <polyline points="16 17 21 12 16 7" />
                      <line x1="21" y1="12" x2="9" y2="12" />
                    </svg>
                  }
                  label="Sair"
                  onClick={handleLogout}
                  danger
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  )
}

function MenuButton({
  icon, label, onClick, danger = false
}: {
  icon: React.ReactNode
  label: string
  onClick: () => void
  danger?: boolean
}) {
  const [hovered, setHovered] = useState(false)
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 9,
        width: '100%', textAlign: 'left',
        padding: '7px 14px',
        background: hovered ? 'var(--color-bg-secondary)' : 'transparent',
        border: 'none', cursor: 'pointer',
        fontFamily: 'var(--font-sans)',
        fontSize: 'var(--text-sm)',
        color: danger
          ? (hovered ? 'var(--priority-high)' : 'var(--color-text-secondary)')
          : 'var(--color-text-primary)',
        transition: 'background var(--transition-base), color var(--transition-base)',
      }}
    >
      <span style={{ opacity: 0.65, display: 'flex', color: danger && hovered ? 'var(--priority-high)' : 'inherit' }}>
        {icon}
      </span>
      {label}
    </button>
  )
}
