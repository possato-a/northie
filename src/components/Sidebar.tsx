import { motion, AnimatePresence } from 'framer-motion'
import {
  SidebarToggleIcon,
  VisaoGeralIcon,
  VendasIcon,
  ClientesIcon,
  CanaisIcon,
  CreatorsIcon,
  AppStoreIcon,
  SettingsIcon,
} from '../icons'

export type Page =
  | 'visao-geral'
  | 'vendas'
  | 'clientes'
  | 'canais'
  | 'comunidade'
  | 'creators'
  | 'finance'
  | 'app-store'
  | 'configuracoes'

interface NavItemProps {
  icon: React.ReactNode
  label: string
  pageId: Page
  activePage: Page
  onPageChange: (page: Page) => void
  collapsed: boolean
  delay?: number
}

function NavItem({ icon, label, pageId, activePage, onPageChange, collapsed, delay = 0 }: NavItemProps) {
  const isActive = activePage === pageId

  return (
    <motion.button
      onClick={() => onPageChange(pageId)}
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: isActive ? 1 : 0.7, x: 0 }}
      transition={{ duration: 0.3, delay, ease: [0.25, 0.1, 0.25, 1] }}
      whileHover={{ opacity: 1, x: collapsed ? 0 : 3 }}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: collapsed ? 0 : 10,
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        padding: 0,
        color: '#1E1E1E',
        width: '100%',
        justifyContent: collapsed ? 'center' : 'flex-start',
      }}
    >
      <motion.span
        style={{ display: 'flex', flexShrink: 0 }}
        animate={{ scale: isActive ? 1.05 : 1 }}
        transition={{ duration: 0.2 }}
      >
        {icon}
      </motion.span>
      <AnimatePresence>
        {!collapsed && (
          <motion.span
            initial={{ opacity: 0, width: 0 }}
            animate={{ opacity: 1, width: 'auto' }}
            exit={{ opacity: 0, width: 0 }}
            transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
            style={{
              fontFamily: "'Poppins', sans-serif",
              fontStyle: 'normal',
              fontSize: 16,
              letterSpacing: '-0.64px',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              display: 'block',
            }}
          >
            {label}
          </motion.span>
        )}
      </AnimatePresence>
    </motion.button>
  )
}

interface SidebarProps {
  activePage: Page
  onPageChange: (page: Page) => void
  collapsed: boolean
  onToggle: () => void
}

const mainNav: { icon: React.ReactNode; label: string; pageId: Page }[] = [
  { icon: <VisaoGeralIcon />, label: 'Visão Geral', pageId: 'visao-geral' },
  { icon: <VendasIcon />, label: 'Vendas', pageId: 'vendas' },
  { icon: <ClientesIcon />, label: 'Clientes', pageId: 'clientes' },
  { icon: <CanaisIcon />, label: 'Canais', pageId: 'canais' },
  { icon: <CreatorsIcon />, label: 'Creators', pageId: 'creators' },
]

const bottomNav: { icon: React.ReactNode; label: string; pageId: Page }[] = [
  { icon: <AppStoreIcon />, label: 'App Store', pageId: 'app-store' },
  { icon: <SettingsIcon />, label: 'Configurações', pageId: 'configuracoes' },
]

export default function Sidebar({ activePage, onPageChange, collapsed, onToggle }: SidebarProps) {
  return (
    <motion.aside
      animate={{ width: collapsed ? 70 : 250 }}
      transition={{ duration: 0.35, ease: [0.4, 0, 0.2, 1] }}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        height: '100vh',
        borderRight: '1px solid rgba(30,30,30,0.15)',
        background: '#FCF8F8',
        display: 'flex',
        flexDirection: 'column',
        zIndex: 100,
        overflow: 'hidden',
      }}
    >
      {/* Top: logo + toggle */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: collapsed ? '28px 16px' : '28px 28px',
          flexShrink: 0,
          minHeight: 73,
        }}
      >
        <AnimatePresence>
          {!collapsed && (
            <motion.span
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              style={{
                fontFamily: "'Lora', serif",
                fontWeight: 400,
                fontSize: 24,
                letterSpacing: '-0.96px',
                color: '#1E1E1E',
                lineHeight: 1,
                whiteSpace: 'nowrap',
              }}
            >
              Northie
            </motion.span>
          )}
        </AnimatePresence>

        <motion.button
          onClick={onToggle}
          whileHover={{ opacity: 0.7 }}
          whileTap={{ scale: 0.9 }}
          animate={{ rotate: collapsed ? 180 : 0 }}
          transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: 0,
            color: '#1E1E1E',
            display: 'flex',
            alignItems: 'center',
            flexShrink: 0,
            opacity: 0.7,
          }}
        >
          <SidebarToggleIcon />
        </motion.button>
      </div>

      {/* Divider */}
      <div style={{ height: 1, background: 'rgba(30,30,30,0.15)', flexShrink: 0 }} />

      {/* Main nav */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 24,
          padding: collapsed ? '36px 0' : '36px 28px',
          alignItems: collapsed ? 'center' : 'flex-start',
          flex: 1,
        }}
      >
        {mainNav.map((item, i) => (
          <NavItem
            key={item.pageId}
            {...item}
            activePage={activePage}
            onPageChange={onPageChange}
            collapsed={collapsed}
            delay={i * 0.04}
          />
        ))}
      </div>

      {/* Bottom divider */}
      <div style={{ height: 1, background: 'rgba(30,30,30,0.15)', flexShrink: 0 }} />

      {/* Bottom nav */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 24,
          padding: collapsed ? '28px 0' : '28px 28px',
          alignItems: collapsed ? 'center' : 'flex-start',
          flexShrink: 0,
        }}
      >
        {bottomNav.map((item, i) => (
          <NavItem
            key={item.pageId}
            {...item}
            activePage={activePage}
            onPageChange={onPageChange}
            collapsed={collapsed}
            delay={(mainNav.length + i) * 0.04}
          />
        ))}
      </div>
    </motion.aside>
  )
}
