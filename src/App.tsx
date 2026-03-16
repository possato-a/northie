import { useState, useMemo, useEffect, lazy, Suspense } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Sidebar, { type Page } from './components/layout/Sidebar'
import ChatSidebar from './components/layout/ChatSidebar'
import Login from './pages/Login'
import { supabase } from './lib/supabase'
import { Session } from '@supabase/supabase-js'
import { setProfileId } from './lib/api'
import { useTheme } from './ThemeContext'
import { ErrorBoundary } from './components/ui/shared'

// ── Lazy-loaded pages ──────────────────────────────────────────────────────────
const Dashboard    = lazy(() => import('./pages/Dashboard'))
const Vendas       = lazy(() => import('./pages/Vendas'))
const Clientes     = lazy(() => import('./pages/Clientes'))
const Canais       = lazy(() => import('./pages/Canais'))
const AppStore     = lazy(() => import('./pages/AppStore'))
const Configuracoes = lazy(() => import('./pages/Configuracoes'))
const Card         = lazy(() => import('./pages/Card'))
const Growth       = lazy(() => import('./pages/Growth'))
const Conversas    = lazy(() => import('./pages/Conversas'))
const Contexto     = lazy(() => import('./pages/Contexto'))
const Relatorios   = lazy(() => import('./pages/Relatorios'))

// ── Page loader fallback ───────────────────────────────────────────────────────
function PageSkeleton() {
  return (
    <div style={{
      flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
      minHeight: '100vh',
    }}>
      <motion.div
        animate={{ opacity: [0.3, 0.7, 0.3] }}
        transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
        style={{
          width: 32, height: 32, borderRadius: '50%',
          background: 'var(--color-primary)', opacity: 0.4,
        }}
      />
    </div>
  )
}

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [session, setSession] = useState<Session | null>(null)
  const [activePage, setActivePage] = useState<Page>('visao-geral')
  const [collapsed, setCollapsed] = useState(false)
  const [chatOpen, setChatOpen] = useState(false)
  const [isChatFull, setIsChatFull] = useState(false)
  const { setTheme, setCompact, setLanguage, setDateFormat, setStartWeekMonday, isCompact } = useTheme()

  // Sync preferences from DB when user logs in
  useEffect(() => {
    const uid = session?.user?.id
    if (!uid) return
    supabase.from('profiles').select('workspace_config').eq('id', uid).single()
      .then(({ data }) => {
        const prefs = data?.workspace_config?.preferences
        if (!prefs) return
        if (prefs.theme === 'light' || prefs.theme === 'dark') setTheme(prefs.theme)
        if (prefs.compactMode !== undefined) setCompact(prefs.compactMode)
        if (prefs.language) setLanguage(prefs.language)
        if (prefs.dateFormat) setDateFormat(prefs.dateFormat)
        if (prefs.startWeekMonday !== undefined) setStartWeekMonday(prefs.startWeekMonday)
      })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user?.id])

  // Listen for navigation events dispatched by TopBar
  useEffect(() => {
    function handleNav(e: Event) {
      const page = (e as CustomEvent<string>).detail as Page
      if (page) setActivePage(page)
    }
    window.addEventListener('northie:navigate', handleNav)
    return () => window.removeEventListener('northie:navigate', handleNav)
  }, [])

  // 1. Check for current session on load
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setIsLoggedIn(!!session)
      if (session?.user?.id) {
        setProfileId(session.user.id)
      }
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      setIsLoggedIn(!!session)
      if (session?.user?.id) {
        setProfileId(session.user.id)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  const sidebarWidth = collapsed ? 70 : 250
  const chatPadding = chatOpen && !isChatFull ? 380 : 0

  const pageTitle = useMemo(() => {
    switch (activePage) {
      case 'visao-geral': return 'Visão Geral'
      case 'vendas': return 'Vendas'
      case 'clientes': return 'Clientes'
      case 'canais': return 'Canais'
      case 'canais-meta': return 'Meta Ads'
      case 'canais-google': return 'Google Ads'
      case 'growth': return 'Northie Growth'
      case 'card': return 'Northie Card'
      case 'conversas': return 'Conversas'
      case 'contexto': return 'Contexto do Negócio'
      case 'relatorios': return 'Relatórios'
      case 'app-store': return 'App Store'
      case 'configuracoes': return 'Configurações'
      default: return 'Início'
    }
  }, [activePage])

  const isGrowth = activePage === 'growth'

  if (!isLoggedIn) {
    return (
      <AnimatePresence>
        <motion.div
          key="login"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4 }}
        >
          <Login onLogin={() => setIsLoggedIn(true)} />
        </motion.div>
      </AnimatePresence>
    )
  }

  return (
    <motion.div
      key="app"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5, ease: [0.25, 0.1, 0.25, 1] }}
      style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg)' }}
    >
      <Sidebar
        activePage={activePage}
        onPageChange={setActivePage}
        collapsed={collapsed}
        onToggle={() => setCollapsed(c => !c)}
      />
      <motion.main
        animate={{
          marginLeft: sidebarWidth,
          paddingRight: chatPadding
        }}
        transition={{ duration: 0.35, ease: [0.4, 0, 0.2, 1] }}
        style={{
          flex: 1,
          minHeight: '100vh',
          background: 'var(--bg)',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Growth is full-screen, rendered outside the padded wrapper */}
        <div style={{ display: isGrowth ? 'flex' : 'none', flex: 1, flexDirection: 'column' }}>
          <ErrorBoundary>
            <Suspense fallback={<PageSkeleton />}>
              <Growth />
            </Suspense>
          </ErrorBoundary>
        </div>

        {/* All other pages */}
        {!isGrowth && (
          <div style={{ padding: isCompact ? '14px 32px 48px' : '28px 64px 80px', width: '100%' }}>
            <ErrorBoundary>
              <Suspense fallback={<PageSkeleton />}>
                {activePage === 'visao-geral' && (
                  <Dashboard
                    onToggleChat={() => setChatOpen(!chatOpen)}
                    onNavigate={setActivePage}
                    user={session?.user}
                  />
                )}
                {activePage === 'vendas' && (
                  <Vendas
                    onToggleChat={() => setChatOpen(!chatOpen)}
                    user={session?.user}
                  />
                )}
                {activePage === 'clientes' && <Clientes onToggleChat={() => setChatOpen(!chatOpen)} />}
                {(activePage === 'canais' || activePage === 'canais-meta' || activePage === 'canais-google') && (
                  <Canais
                    onToggleChat={() => setChatOpen(!chatOpen)}
                    channelView={activePage === 'canais-meta' ? 'meta' : activePage === 'canais-google' ? 'google' : undefined}
                  />
                )}
                {activePage === 'app-store' && (
                  <AppStore
                    onToggleChat={() => setChatOpen(!chatOpen)}
                    user={session?.user}
                  />
                )}
                {activePage === 'card' && <Card onToggleChat={() => setChatOpen(!chatOpen)} />}
                {activePage === 'conversas' && <Conversas onToggleChat={() => setChatOpen(!chatOpen)} />}
                {activePage === 'contexto' && <Contexto onToggleChat={() => setChatOpen(!chatOpen)} />}
                {activePage === 'relatorios' && <Relatorios onToggleChat={() => setChatOpen(!chatOpen)} user={session?.user} />}
                {activePage === 'configuracoes' && (
                  <Configuracoes user={session?.user} onGoToAppStore={() => setActivePage('app-store')} />
                )}
                {activePage !== 'visao-geral' && activePage !== 'vendas' && activePage !== 'clientes' && activePage !== 'canais' && activePage !== 'canais-meta' && activePage !== 'canais-google' && activePage !== 'card' && activePage !== 'conversas' && activePage !== 'contexto' && activePage !== 'relatorios' && activePage !== 'app-store' && activePage !== 'configuracoes' && (
                  <motion.div
                    key={activePage}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
                    style={{
                      paddingTop: 64,
                      fontFamily: "'Poppins', sans-serif",
                      fontSize: 40,
                      fontWeight: 400,
                      letterSpacing: '-1.6px',
                      color: 'rgba(var(--fg-rgb), 0.25)',
                    }}
                  >
                    Em breve
                  </motion.div>
                )}
              </Suspense>
            </ErrorBoundary>
          </div>
        )}
      </motion.main>

      {/* ChatSidebar always mounted to preserve conversation state */}
      <div style={{ display: isGrowth ? 'none' : 'block' }}>
        <ChatSidebar
          isOpen={chatOpen}
          onClose={() => {
            setChatOpen(false)
            setIsChatFull(false)
          }}
          context={pageTitle}
          isFull={isChatFull}
          onToggleFull={() => setIsChatFull(!isChatFull)}
        />
      </div>
    </motion.div>
  )
}
