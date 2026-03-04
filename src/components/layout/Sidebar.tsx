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
  CardIcon,
  RaiseIcon,
  ValuationIcon,
  GrowthIcon,
} from '../../icons'
import { useTheme } from '../../ThemeContext'

export type Page =
  | 'visao-geral'
  | 'vendas'
  | 'clientes'
  | 'canais'
  | 'creators'
  | 'growth'
  | 'card'
  | 'raise'
  | 'valuation'
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
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3, delay, ease: [0.25, 0.1, 0.25, 1] }}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: collapsed ? 0 : 10,
        background: isActive ? 'var(--color-bg-tertiary)' : 'transparent',
        border: 'none',
        borderRadius: 'var(--radius-md)',
        cursor: 'pointer',
        padding: collapsed ? '7px' : '7px 10px',
        color: isActive ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
        width: '100%',
        justifyContent: collapsed ? 'center' : 'flex-start',
        fontFamily: 'var(--font-sans)',
        fontSize: 'var(--text-base)',
        fontWeight: isActive ? 500 : 400,
        transition: 'background var(--transition-base), color var(--transition-base)',
        position: 'relative',
      }}
      onMouseEnter={e => {
        if (!isActive) (e.currentTarget as HTMLButtonElement).style.background = 'var(--color-bg-secondary)'
      }}
      onMouseLeave={e => {
        if (!isActive) (e.currentTarget as HTMLButtonElement).style.background = 'transparent'
      }}
    >
      <motion.span
        style={{ display: 'flex', flexShrink: 0, opacity: isActive ? 1 : 0.65 }}
        animate={{ scale: isActive ? 1.02 : 1 }}
        transition={{ duration: 0.15 }}
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
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              display: 'block',
              letterSpacing: '-0.1px',
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

const productsNav: { icon: React.ReactNode; label: string; pageId: Page }[] = [
  { icon: <GrowthIcon />, label: 'Northie Growth', pageId: 'growth' },
  { icon: <CardIcon />, label: 'Northie Card', pageId: 'card' },
  { icon: <RaiseIcon />, label: 'Northie Raise', pageId: 'raise' },
  { icon: <ValuationIcon />, label: 'Valuation', pageId: 'valuation' },
]

const bottomNav: { icon: React.ReactNode; label: string; pageId: Page }[] = [
  { icon: <AppStoreIcon />, label: 'App Store', pageId: 'app-store' },
  { icon: <SettingsIcon />, label: 'Configurações', pageId: 'configuracoes' },
]

export default function Sidebar({ activePage, onPageChange, collapsed, onToggle }: SidebarProps) {
  const { isDark, toggleTheme } = useTheme()

  return (
    <motion.aside
      animate={{ width: collapsed ? 58 : 240 }}
      transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        height: '100vh',
        borderRight: '1px solid var(--color-border)',
        background: 'var(--bg)',
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
          padding: collapsed ? '18px 12px' : '18px 16px',
          flexShrink: 0,
          minHeight: 56,
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
                fontFamily: 'var(--font-serif)',
                fontWeight: 400,
                fontSize: 20,
                letterSpacing: '-0.5px',
                color: 'var(--color-text-primary)',
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
          className="notion-btn-icon"
          style={{ color: 'var(--color-text-tertiary)', flexShrink: 0 }}
        >
          <SidebarToggleIcon />
        </motion.button>
      </div>

      {/* Divider */}
      <div style={{ height: 1, background: 'var(--color-border)', flexShrink: 0, margin: '0 8px' }} />

      {/* Main nav */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
          padding: collapsed ? '12px 6px' : '12px 10px',
          flex: 1,
          overflowY: 'auto',
        }}
      >
        {mainNav.map((item, i) => (
          <NavItem
            key={item.pageId}
            {...item}
            activePage={activePage}
            onPageChange={onPageChange}
            collapsed={collapsed}
            delay={i * 0.03}
          />
        ))}

        {/* Divisor dos produtos */}
        <div style={{ height: 1, background: 'var(--color-border)', margin: '8px 0' }} />

        {!collapsed && (
          <span style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 9,
            letterSpacing: '0.12em',
            color: 'var(--color-text-tertiary)',
            textTransform: 'uppercase',
            padding: '2px 10px 6px',
          }}>
            Produtos
          </span>
        )}

        {productsNav.map((item, i) => (
          <NavItem
            key={item.pageId}
            {...item}
            activePage={activePage}
            onPageChange={onPageChange}
            collapsed={collapsed}
            delay={(mainNav.length + i) * 0.03}
          />
        ))}
      </div>

      {/* Bottom divider */}
      <div style={{ height: 1, background: 'var(--color-border)', flexShrink: 0, margin: '0 8px' }} />

      {/* Bottom nav */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
          padding: collapsed ? '10px 6px' : '10px 10px',
          flexShrink: 0,
        }}
      >
        {/* Theme toggle */}
        <button
          onClick={toggleTheme}
          className="notion-btn"
          style={{
            width: '100%',
            justifyContent: collapsed ? 'center' : 'flex-start',
            padding: collapsed ? '7px' : '7px 10px',
            gap: collapsed ? 0 : 10,
          }}
        >
          {isDark ? (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="5" /><line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" /><line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" /><line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" /><line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
            </svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
            </svg>
          )}
          {!collapsed && (
            <span style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-base)', whiteSpace: 'nowrap', letterSpacing: '-0.1px' }}>
              {isDark ? 'Modo Claro' : 'Modo Escuro'}
            </span>
          )}
        </button>

        {bottomNav.map((item, i) => (
          <NavItem
            key={item.pageId}
            {...item}
            activePage={activePage}
            onPageChange={onPageChange}
            collapsed={collapsed}
            delay={(mainNav.length + i) * 0.03}
          />
        ))}
      </div>
    </motion.aside>
  )
}
