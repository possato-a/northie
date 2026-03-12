import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  SidebarToggleIcon,
  VisaoGeralIcon,
  VendasIcon,
  ClientesIcon,
  CanaisIcon,
  AppStoreIcon,
  SettingsIcon,
  CardIcon,
  GrowthIcon,
  RelatoriosIcon,
  ConversasIcon,
  ContextoIcon,
} from '../../icons'
import { useTheme } from '../../ThemeContext'

export type Page =
  | 'visao-geral'
  | 'vendas'
  | 'clientes'
  | 'canais'
  | 'canais-meta'
  | 'canais-google'
  | 'growth'
  | 'card'
  | 'conversas'
  | 'contexto'
  | 'relatorios'
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
  onClick?: () => void
}

function NavItem({ icon, label, pageId, activePage, onPageChange, collapsed, delay = 0, onClick }: NavItemProps) {
  const isActive = activePage === pageId

  return (
    <motion.button
      onClick={() => onClick ? onClick() : onPageChange(pageId)}
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3, delay, ease: [0.25, 0.1, 0.25, 1] }}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: collapsed ? 0 : 10,
        background: isActive ? 'var(--color-primary-light)' : 'transparent',
        border: 'none',
        borderRadius: 'var(--radius-lg)',
        cursor: 'pointer',
        padding: collapsed ? '7px' : '7px 10px',
        color: isActive ? 'var(--color-primary)' : 'var(--color-text-secondary)',
        width: '100%',
        justifyContent: collapsed ? 'center' : 'flex-start',
        fontFamily: 'var(--font-sans)',
        fontSize: 'var(--text-base)',
        fontWeight: isActive ? 500 : 400,
        transition: 'background var(--transition-base), color var(--transition-base)',
        position: 'relative',
      }}
      onMouseEnter={e => {
        if (!isActive) (e.currentTarget as HTMLButtonElement).style.background = 'var(--color-bg-tertiary)'
      }}
      onMouseLeave={e => {
        if (!isActive) (e.currentTarget as HTMLButtonElement).style.background = 'transparent'
      }}
    >
      <motion.span
        style={{ display: 'flex', flexShrink: 0, opacity: isActive ? 1 : 0.55 }}
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

// Platform icons for channel sub-pages
function MetaIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2C6.477 2 2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.879V14.89h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.989C18.343 21.129 22 16.99 22 12c0-5.523-4.477-10-10-10z"/>
    </svg>
  )
}

function GoogleIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  )
}

function SubNavItem({
  label,
  pageId,
  activePage,
  onPageChange,
  collapsed,
  icon,
}: {
  label: string
  pageId: Page
  activePage: Page
  onPageChange: (p: Page) => void
  collapsed: boolean
  icon: React.ReactNode
}) {
  const isActive = activePage === pageId
  return (
    <motion.button
      onClick={() => onPageChange(pageId)}
      whileHover={!isActive ? { background: 'var(--color-bg-tertiary)' } : {}}
      style={{
        display: 'flex', alignItems: 'center',
        gap: collapsed ? 0 : 9,
        padding: collapsed ? '6px 7px' : '6px 10px 6px 26px',
        borderRadius: 'var(--radius-md)', border: 'none',
        background: isActive ? 'var(--color-primary-light)' : 'transparent',
        cursor: 'pointer', width: '100%',
        justifyContent: collapsed ? 'center' : 'flex-start',
        transition: 'background var(--transition-fast)',
      }}
    >
      <span style={{
        display: 'flex', flexShrink: 0,
        color: isActive ? 'var(--color-primary)' : 'var(--color-text-tertiary)',
        opacity: isActive ? 1 : 0.7,
      }}>
        {icon}
      </span>
      <AnimatePresence>
        {!collapsed && (
          <motion.span
            initial={{ opacity: 0, width: 0 }}
            animate={{ opacity: 1, width: 'auto' }}
            exit={{ opacity: 0, width: 0 }}
            transition={{ duration: 0.2 }}
            style={{
              fontFamily: 'var(--font-sans)', fontSize: 13,
              fontWeight: isActive ? 500 : 400,
              color: isActive ? 'var(--color-primary)' : 'var(--color-text-secondary)',
              whiteSpace: 'nowrap', overflow: 'hidden', letterSpacing: '-0.1px',
            }}
          >
            {label}
          </motion.span>
        )}
      </AnimatePresence>
    </motion.button>
  )
}

const mainNav: { icon: React.ReactNode; label: string; pageId: Page }[] = [
  { icon: <VisaoGeralIcon />, label: 'Visão Geral', pageId: 'visao-geral' },
  { icon: <VendasIcon />, label: 'Vendas', pageId: 'vendas' },
  { icon: <ClientesIcon />, label: 'Clientes', pageId: 'clientes' },
  { icon: <CanaisIcon />, label: 'Canais', pageId: 'canais' },
]

const canaisSubNav: { label: string; pageId: Page; icon: React.ReactNode }[] = [
  {
    label: 'Visão Geral', pageId: 'canais',
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
        <rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>
      </svg>
    ),
  },
  { label: 'Meta Ads', pageId: 'canais-meta', icon: <MetaIcon /> },
  { label: 'Google Ads', pageId: 'canais-google', icon: <GoogleIcon /> },
]

const productsNav: { icon: React.ReactNode; label: string; pageId: Page }[] = [
  { icon: <GrowthIcon />, label: 'Northie Growth', pageId: 'growth' },
  { icon: <CardIcon />, label: 'Northie Card', pageId: 'card' },
]

const contextNav: { icon: React.ReactNode; label: string; pageId: Page }[] = [
  { icon: <ConversasIcon />, label: 'Conversas', pageId: 'conversas' },
  { icon: <ContextoIcon />, label: 'Contexto', pageId: 'contexto' },
]

const bottomNav: { icon: React.ReactNode; label: string; pageId: Page }[] = [
  { icon: <RelatoriosIcon size={20} />, label: 'Relatórios', pageId: 'relatorios' },
  { icon: <AppStoreIcon />, label: 'App Store', pageId: 'app-store' },
  { icon: <SettingsIcon />, label: 'Configurações', pageId: 'configuracoes' },
]

export default function Sidebar({ activePage, onPageChange, collapsed, onToggle }: SidebarProps) {
  const { isDark, toggleTheme } = useTheme()

  const canaisActive = activePage === 'canais' || activePage === 'canais-meta' || activePage === 'canais-google'
  const [canaisExpanded, setCanaisExpanded] = useState(canaisActive)

  // Auto-collapse sub-nav when leaving canais pages
  useEffect(() => {
    if (!canaisActive) setCanaisExpanded(false)
  }, [canaisActive])

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
        background: 'var(--color-bg-primary)',
        boxShadow: '1px 0 4px rgba(0, 0, 0, 0.03)',
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
        {mainNav.map((item, i) => {
          const isCanais = item.pageId === 'canais'

          return (
            <div key={item.pageId}>
              <div style={{ position: 'relative' }}>
                <NavItem
                  {...item}
                  activePage={canaisActive && isCanais ? 'canais' : activePage}
                  onPageChange={onPageChange}
                  collapsed={collapsed}
                  delay={i * 0.03}
                  onClick={isCanais ? () => {
                    setCanaisExpanded(e => !e)
                    if (!canaisActive) onPageChange('canais')
                  } : undefined}
                />
                {/* Chevron: outer span handles CSS positioning, inner motion.span handles rotation only */}
                {isCanais && !collapsed && (
                  <span
                    style={{
                      position: 'absolute', right: 10, top: 0, bottom: 0,
                      display: 'flex', alignItems: 'center', pointerEvents: 'none',
                    }}
                  >
                    <motion.span
                      animate={{ rotate: canaisExpanded ? 90 : 0 }}
                      transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
                      style={{
                        display: 'flex',
                        color: canaisActive ? 'var(--color-primary)' : 'var(--color-text-tertiary)',
                        opacity: 0.6,
                      }}
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="9 18 15 12 9 6" />
                      </svg>
                    </motion.span>
                  </span>
                )}
              </div>
              <AnimatePresence>
                {isCanais && canaisExpanded && (
                  <motion.div
                    key="canais-subnav"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
                    style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column', gap: 3, paddingTop: 2 }}
                  >
                    {canaisSubNav.map(sub => (
                      <SubNavItem
                        key={sub.pageId}
                        label={sub.label}
                        pageId={sub.pageId}
                        activePage={activePage}
                        onPageChange={onPageChange}
                        collapsed={collapsed}
                        icon={sub.icon}
                      />
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )
        })}

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

        {/* Divisor do contexto */}
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
            Contexto
          </span>
        )}

        {contextNav.map((item, i) => (
          <NavItem
            key={item.pageId}
            {...item}
            activePage={activePage}
            onPageChange={onPageChange}
            collapsed={collapsed}
            delay={(mainNav.length + productsNav.length + i) * 0.03}
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
