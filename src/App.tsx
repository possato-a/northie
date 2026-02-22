import { useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import Sidebar, { type Page } from './components/Sidebar'
import Dashboard from './components/Dashboard'
import Vendas from './pages/Vendas'
import Clientes from './pages/Clientes'
import Criadores from './pages/Criadores'
import ChatSidebar from './components/ChatSidebar'

export default function App() {
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
      case 'creators': return 'Criadores'
      default: return 'Início'
    }
  }, [activePage])

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#FCF8F8' }}>
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
          background: '#FCF8F8',
        }}
      >
        <div style={{ padding: '28px 64px 80px' }}>
          {activePage === 'visao-geral' && <Dashboard onToggleChat={() => setChatOpen(!chatOpen)} />}
          {activePage === 'vendas' && <Vendas onToggleChat={() => setChatOpen(!chatOpen)} />}
          {activePage === 'clientes' && <Clientes onToggleChat={() => setChatOpen(!chatOpen)} />}
          {activePage === 'creators' && <Criadores onToggleChat={() => setChatOpen(!chatOpen)} />}
          {activePage !== 'visao-geral' && activePage !== 'vendas' && activePage !== 'clientes' && activePage !== 'creators' && (
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
    </div>
  )
}
