import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Sidebar, { type Page } from './components/Sidebar'
import Dashboard from './components/Dashboard'
import Vendas from './pages/Vendas'
import Clientes from './pages/Clientes'
import Canais from './pages/Canais'
import Criadores from './pages/Criadores'
import AppStore from './pages/AppStore'
import ChatSidebar from './components/ChatSidebar'
import Login from './pages/Login'

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [activePage, setActivePage] = useState<Page>('visao-geral')
  const [collapsed, setCollapsed] = useState(false)
  const [chatOpen, setChatOpen] = useState(false)
  const [isChatFull, setIsChatFull] = useState(false)

  const sidebarWidth = collapsed ? 70 : 250
  const chatPadding = chatOpen && !isChatFull ? 380 : 0

  const pageTitle = useMemo(() => {
    switch (activePage) {
      case 'visao-geral': return 'Visão Geral'
      case 'vendas': return 'Vendas'
      case 'clientes': return 'Clientes'
      case 'canais': return 'Canais'
      case 'creators': return 'Criadores'
      case 'app-store': return 'App Store'
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
        }}
      >
        <div style={{ padding: '28px 64px 80px' }}>
          {activePage === 'visao-geral' && <Dashboard onToggleChat={() => setChatOpen(!chatOpen)} />}
          {activePage === 'vendas' && <Vendas onToggleChat={() => setChatOpen(!chatOpen)} />}
          {activePage === 'clientes' && <Clientes onToggleChat={() => setChatOpen(!chatOpen)} />}
          {activePage === 'canais' && <Canais onToggleChat={() => setChatOpen(!chatOpen)} />}
          {activePage === 'creators' && <Criadores onToggleChat={() => setChatOpen(!chatOpen)} />}
          {activePage === 'app-store' && <AppStore onToggleChat={() => setChatOpen(!chatOpen)} />}
          {activePage !== 'visao-geral' && activePage !== 'vendas' && activePage !== 'clientes' && activePage !== 'canais' && activePage !== 'creators' && activePage !== 'app-store' && (
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
      </motion.main>
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
    </motion.div>
  )
}
