import { useState, useMemo, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Sidebar, { type Page } from './components/layout/Sidebar'
import Dashboard from './pages/Dashboard'
import Vendas from './pages/Vendas'
import Clientes from './pages/Clientes'
import Canais from './pages/Canais'
import Criadores from './pages/Criadores'
import AppStore from './pages/AppStore'
import Configuracoes from './pages/Configuracoes'
import Card from './pages/Card'
import Valuation from './pages/Valuation'
import Growth from './pages/Growth'
import Relatorios from './pages/Relatorios'
import ChatSidebar from './components/layout/ChatSidebar'
import Login from './pages/Login'
import { supabase } from './lib/supabase'
import { Session } from '@supabase/supabase-js'
import { setProfileId } from './lib/api'

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [session, setSession] = useState<Session | null>(null)
  const [activePage, setActivePage] = useState<Page>('visao-geral')
  const [collapsed, setCollapsed] = useState(false)
  const [chatOpen, setChatOpen] = useState(false)
  const [isChatFull, setIsChatFull] = useState(false)

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
      case 'creators': return 'Criadores'
      case 'growth': return 'Northie Growth'
      case 'card': return 'Northie Card'
      case 'valuation': return 'Northie Valuation'
      case 'relatorios': return 'Relatórios'
      case 'app-store': return 'App Store'
      case 'configuracoes': return 'Configurações'
      default: return 'Início'
    }
  }, [activePage])

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
        {activePage === 'growth' ? (
          <Growth />
        ) : (
          <div style={{ padding: '28px 64px 80px' }}>
            {activePage === 'visao-geral' && (
              <Dashboard
                onToggleChat={() => setChatOpen(!chatOpen)}
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
            {activePage === 'canais' && <Canais onToggleChat={() => setChatOpen(!chatOpen)} />}
            {activePage === 'creators' && <Criadores onToggleChat={() => setChatOpen(!chatOpen)} />}
            {activePage === 'app-store' && (
              <AppStore
                onToggleChat={() => setChatOpen(!chatOpen)}
                user={session?.user}
              />
            )}
            {activePage === 'card' && <Card onToggleChat={() => setChatOpen(!chatOpen)} />}
            {activePage === 'valuation' && <Valuation onToggleChat={() => setChatOpen(!chatOpen)} />}
            {activePage === 'relatorios' && <Relatorios onToggleChat={() => setChatOpen(!chatOpen)} user={session?.user} />}
            {activePage === 'configuracoes' && <Configuracoes />}
            {activePage !== 'visao-geral' && activePage !== 'vendas' && activePage !== 'clientes' && activePage !== 'canais' && activePage !== 'creators' && activePage !== 'card' && activePage !== 'valuation' && activePage !== 'relatorios' && activePage !== 'app-store' && activePage !== 'configuracoes' && (
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
                  color: 'rgba(30,30,30,0.25)',
                }}
              >
                Em breve
              </motion.div>
            )}
          </div>
        )}
      </motion.main>
      {activePage !== 'growth' && (
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
      )}
    </motion.div>
  )
}
