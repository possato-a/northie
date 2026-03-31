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

export type Page =
  | 'visao-geral'
  | 'vendas'
  | 'clientes'
  | 'canais'
  | 'canais-meta'
  | 'canais-google'
  | 'growth'
  | 'card'
  | 'financeiro'
  | 'caixa'
  | 'fornecedores'
  | 'agentes'
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
  onClick?: () => void
  showIndicator?: boolean
}

function NavItem({ icon, label, pageId, activePage, onPageChange, collapsed, onClick, showIndicator }: NavItemProps) {
  const isActive = activePage === pageId

  return (
    <button
      onClick={() => onClick ? onClick() : onPageChange(pageId)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: collapsed ? 0 : 10,
        background: isActive ? 'var(--sidebar-item-active)' : 'transparent',
        border: 'none',
        borderRadius: 6,
        cursor: 'pointer',
        padding: collapsed ? '7px' : '7px 10px',
        color: isActive ? 'var(--color-primary)' : 'var(--sidebar-text)',
        width: '100%',
        justifyContent: collapsed ? 'center' : 'flex-start',
        fontFamily: 'var(--font-sans)',
        fontSize: 13.5,
        fontWeight: isActive ? 500 : 400,
        transition: 'background 0.15s, color 0.15s',
        position: 'relative',
      }}
      onMouseEnter={e => {
        if (!isActive) (e.currentTarget as HTMLButtonElement).style.background = 'var(--sidebar-item-hover)'
      }}
      onMouseLeave={e => {
        if (!isActive) (e.currentTarget as HTMLButtonElement).style.background = 'transparent'
      }}
    >
      <span style={{ display: 'flex', flexShrink: 0, color: isActive ? 'var(--color-primary)' : 'inherit', opacity: isActive ? 1 : 0.5 }}>
        {icon}
      </span>
      <AnimatePresence>
        {!collapsed && (
          <motion.span
            initial={{ opacity: 0, width: 0 }}
            animate={{ opacity: 1, width: 'auto' }}
            exit={{ opacity: 0, width: 0 }}
            transition={{ duration: 0.15 }}
            style={{ whiteSpace: 'nowrap', overflow: 'hidden', display: 'block' }}
          >
            {label}
          </motion.span>
        )}
      </AnimatePresence>
      {/* Active indicator dot */}
      {showIndicator && isActive && !collapsed && (
        <span style={{
          position: 'absolute',
          right: 10,
          width: 6,
          height: 6,
          borderRadius: '50%',
          background: 'var(--color-primary)',
        }} />
      )}
    </button>
  )
}

interface SidebarProps {
  activePage: Page
  onPageChange: (page: Page) => void
  collapsed: boolean
  onToggle: () => void
}

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
    <button
      onClick={() => onPageChange(pageId)}
      style={{
        display: 'flex', alignItems: 'center',
        gap: collapsed ? 0 : 8,
        padding: collapsed ? '5px 7px' : '5px 10px 5px 30px',
        borderRadius: 5, border: 'none',
        background: isActive ? 'var(--sidebar-subitem-active)' : 'transparent',
        cursor: 'pointer', width: '100%',
        justifyContent: collapsed ? 'center' : 'flex-start',
        transition: 'background 0.15s',
      }}
      onMouseEnter={e => {
        if (!isActive) (e.currentTarget as HTMLButtonElement).style.background = 'var(--sidebar-item-hover)'
      }}
      onMouseLeave={e => {
        if (!isActive) (e.currentTarget as HTMLButtonElement).style.background = isActive ? 'var(--sidebar-subitem-active)' : 'transparent'
      }}
    >
      <span style={{
        display: 'flex', flexShrink: 0,
        color: isActive ? 'var(--color-primary)' : 'var(--sidebar-text)',
        opacity: isActive ? 0.8 : 0.4,
      }}>
        {icon}
      </span>
      <AnimatePresence>
        {!collapsed && (
          <motion.span
            initial={{ opacity: 0, width: 0 }}
            animate={{ opacity: 1, width: 'auto' }}
            exit={{ opacity: 0, width: 0 }}
            transition={{ duration: 0.15 }}
            style={{
              fontFamily: 'var(--font-sans)', fontSize: 13,
              fontWeight: isActive ? 500 : 400,
              color: isActive ? 'var(--color-primary)' : 'var(--sidebar-text)',
              whiteSpace: 'nowrap', overflow: 'hidden',
            }}
          >
            {label}
          </motion.span>
        )}
      </AnimatePresence>
    </button>
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

// ── Financeiro icons ──────────────────────────────────────────────────────────
function FinanceiroIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
    </svg>
  )
}
function CaixaIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>
    </svg>
  )
}
function FornecedoresIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
    </svg>
  )
}
function AgentesIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 8V4H8"/><rect x="8" y="2" width="8" height="4" rx="1"/><rect x="4" y="8" width="16" height="14" rx="2"/><path d="M9 15h6"/><path d="M9 18h6"/>
    </svg>
  )
}

const financeiroNav: { icon: React.ReactNode; label: string; pageId: Page }[] = [
  { icon: <FinanceiroIcon />, label: 'Financeiro', pageId: 'financeiro' },
  { icon: <CaixaIcon />, label: 'Caixa', pageId: 'caixa' },
  { icon: <FornecedoresIcon />, label: 'Fornecedores', pageId: 'fornecedores' },
  { icon: <AgentesIcon />, label: 'Agentes', pageId: 'agentes' },
]

const contextNav: { icon: React.ReactNode; label: string; pageId: Page }[] = [
  { icon: <ConversasIcon />, label: 'Conversas', pageId: 'conversas' },
  { icon: <ContextoIcon />, label: 'Contexto', pageId: 'contexto' },
]

const bottomNav: { icon: React.ReactNode; label: string; pageId: Page }[] = [
  { icon: <RelatoriosIcon />, label: 'Relatórios', pageId: 'relatorios' },
  { icon: <AppStoreIcon />, label: 'App Store', pageId: 'app-store' },
  { icon: <SettingsIcon />, label: 'Configurações', pageId: 'configuracoes' },
]

export default function Sidebar({ activePage, onPageChange, collapsed, onToggle }: SidebarProps) {
  const canaisActive = activePage === 'canais' || activePage === 'canais-meta' || activePage === 'canais-google'
  const [canaisExpanded, setCanaisExpanded] = useState(canaisActive)

  useEffect(() => {
    if (!canaisActive) setCanaisExpanded(false)
  }, [canaisActive])

  const SectionLabel = ({ children }: { children: string }) => (
    !collapsed ? (
      <div style={{
        fontFamily: 'var(--font-sans)',
        fontSize: 11,
        fontWeight: 500,
        letterSpacing: '0.04em',
        color: 'var(--sidebar-section)',
        textTransform: 'uppercase',
        padding: '16px 10px 6px',
      }}>
        {children}
      </div>
    ) : <div style={{ height: 12 }} />
  )

  return (
    <motion.aside
      animate={{ width: collapsed ? 52 : 220 }}
      transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        height: '100vh',
        background: 'var(--sidebar-bg)',
        display: 'flex',
        flexDirection: 'column',
        zIndex: 100,
        overflow: 'hidden',
        borderRight: '1px solid var(--sidebar-border)',
      }}
    >
      {/* Logo area */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: collapsed ? 'center' : 'space-between',
          padding: collapsed ? '16px 10px' : '16px 14px',
          flexShrink: 0,
        }}
      >
        <AnimatePresence>
          {!collapsed && (
            <motion.button
              onClick={() => onPageChange('visao-geral')}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              whileHover={{ opacity: 0.7 }}
              whileTap={{ scale: 0.97 }}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                display: 'flex', alignItems: 'center', padding: 0,
              }}
            >
              <img
                src="/logo-northie.webp"
                alt="Northie"
                style={{ height: 20, width: 'auto', objectFit: 'contain' }}
              />
            </motion.button>
          )}
        </AnimatePresence>

        <motion.button
          onClick={onToggle}
          whileHover={{ opacity: 0.6 }}
          whileTap={{ scale: 0.9 }}
          animate={{ rotate: collapsed ? 180 : 0 }}
          transition={{ duration: 0.25 }}
          className="notion-btn-icon"
          style={{ color: 'var(--sidebar-text)', flexShrink: 0, opacity: 0.5 }}
        >
          <SidebarToggleIcon />
        </motion.button>
      </div>

      {/* Sections */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          flex: 1,
          overflowY: 'auto',
          padding: collapsed ? '0 6px' : '0 8px',
        }}
      >
        <SectionLabel>Módulos</SectionLabel>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {mainNav.map((item) => {
            const isCanais = item.pageId === 'canais'

            return (
              <div key={item.pageId}>
                <div style={{ position: 'relative' }}>
                  <NavItem
                    {...item}
                    activePage={canaisActive && isCanais ? 'canais' : activePage}
                    onPageChange={onPageChange}
                    collapsed={collapsed}
                    showIndicator
                    onClick={isCanais ? () => {
                      setCanaisExpanded(e => !e)
                      if (!canaisActive) onPageChange('canais')
                    } : undefined}
                  />
                </div>
                <AnimatePresence>
                  {isCanais && canaisExpanded && (
                    <motion.div
                      key="canais-subnav"
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.15 }}
                      style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column', gap: 1, paddingTop: 2 }}
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
        </div>

        <SectionLabel>Produtos</SectionLabel>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {productsNav.map((item) => (
            <NavItem
              key={item.pageId}
              {...item}
              activePage={activePage}
              onPageChange={onPageChange}
              collapsed={collapsed}
              showIndicator
            />
          ))}
        </div>

        <SectionLabel>Financeiro</SectionLabel>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {financeiroNav.map((item) => (
            <NavItem
              key={item.pageId}
              {...item}
              activePage={activePage}
              onPageChange={onPageChange}
              collapsed={collapsed}
            />
          ))}
        </div>

        <SectionLabel>Contexto</SectionLabel>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {contextNav.map((item) => (
            <NavItem
              key={item.pageId}
              {...item}
              activePage={activePage}
              onPageChange={onPageChange}
              collapsed={collapsed}
            />
          ))}
        </div>
      </div>

      {/* Bottom */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
          padding: collapsed ? '8px 6px' : '8px 8px',
          flexShrink: 0,
        }}
      >
        {bottomNav.map((item) => (
          <NavItem
            key={item.pageId}
            {...item}
            activePage={activePage}
            onPageChange={onPageChange}
            collapsed={collapsed}
          />
        ))}

      </div>
    </motion.aside>
  )
}
