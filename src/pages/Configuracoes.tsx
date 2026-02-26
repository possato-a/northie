import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useTheme } from '../ThemeContext'

// ── Types ────────────────────────────────────────────────────────────────────

type SettingsSection =
    | 'perfil' | 'preferencias' | 'notificacoes' | 'seguranca'
    | 'workspace' | 'membros' | 'integracoes' | 'planos'

interface NavGroup {
    label: string
    items: { id: SettingsSection; label: string; icon: React.ReactNode }[]
}

// ── Icons ─────────────────────────────────────────────────────────────────────

const icons = {
    user: (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="8" r="4" /><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
        </svg>
    ),
    sliders: (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <line x1="4" y1="6" x2="20" y2="6" /><line x1="4" y1="12" x2="20" y2="12" /><line x1="4" y1="18" x2="20" y2="18" />
            <circle cx="8" cy="6" r="2" fill="currentColor" stroke="none" /><circle cx="16" cy="12" r="2" fill="currentColor" stroke="none" /><circle cx="10" cy="18" r="2" fill="currentColor" stroke="none" />
        </svg>
    ),
    bell: (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
    ),
    shield: (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        </svg>
    ),
    building: (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2" /><path d="M9 9h6M9 12h6M9 15h6" />
        </svg>
    ),
    users: (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
    ),
    plug: (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 6L6 18M8 6v6M16 12v6" /><circle cx="8" cy="4" r="2" /><circle cx="16" cy="20" r="2" />
        </svg>
    ),
    credit: (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="5" width="20" height="14" rx="2" /><line x1="2" y1="10" x2="22" y2="10" />
        </svg>
    ),
}

// ── Toggle ─────────────────────────────────────────────────────────────────────

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
    return (
        <button
            onClick={() => onChange(!value)}
            style={{
                width: 40,
                height: 22,
                borderRadius: 11,
                border: 'none',
                cursor: 'pointer',
                padding: 2,
                background: value ? 'var(--color-primary)' : 'var(--color-border)',
                transition: 'background var(--transition-base)',
                display: 'flex',
                alignItems: 'center',
                flexShrink: 0,
                position: 'relative',
            }}
        >
            <motion.span
                animate={{ x: value ? 18 : 0 }}
                transition={{ duration: 0.18, ease: [0.4, 0, 0.2, 1] }}
                style={{
                    display: 'block',
                    width: 18,
                    height: 18,
                    borderRadius: '50%',
                    background: 'white',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                }}
            />
        </button>
    )
}

// ── Select dropdown ────────────────────────────────────────────────────────────

function Select({ value, options, onChange }: { value: string; options: string[]; onChange: (v: string) => void }) {
    const [open, setOpen] = useState(false)
    return (
        <div style={{ position: 'relative' }}>
            <button
                onClick={() => setOpen(o => !o)}
                style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '6px 12px',
                    border: '1px solid var(--color-border)',
                    borderRadius: 'var(--radius-md)',
                    background: open ? 'var(--color-bg-tertiary)' : 'var(--color-bg-secondary)',
                    cursor: 'pointer',
                    fontFamily: 'var(--font-sans)',
                    fontSize: 'var(--text-base)',
                    color: 'var(--color-text-primary)',
                    whiteSpace: 'nowrap',
                    transition: 'background var(--transition-base)',
                }}
            >
                {value}
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
            </button>
            <AnimatePresence>
                {open && (
                    <motion.div
                        initial={{ opacity: 0, y: -4, scale: 0.97 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -4, scale: 0.97 }}
                        transition={{ duration: 0.12 }}
                        style={{
                            position: 'absolute', top: 'calc(100% + 4px)', right: 0,
                            background: 'var(--color-bg-primary)',
                            border: '1px solid var(--color-border)',
                            borderRadius: 'var(--radius-lg)',
                            padding: '4px 0',
                            zIndex: 300,
                            minWidth: 180,
                            boxShadow: 'var(--shadow-lg)',
                        }}
                    >
                        {options.map(opt => (
                            <button
                                key={opt}
                                onClick={() => { onChange(opt); setOpen(false) }}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: 8,
                                    width: '100%', textAlign: 'left',
                                    padding: '7px 14px',
                                    background: value === opt ? 'var(--color-bg-secondary)' : 'none',
                                    border: 'none', cursor: 'pointer',
                                    fontFamily: 'var(--font-sans)',
                                    fontSize: 'var(--text-base)',
                                    color: 'var(--color-text-primary)',
                                    fontWeight: value === opt ? 500 : 400,
                                }}
                                onMouseEnter={e => {
                                    if (value !== opt) (e.currentTarget as HTMLButtonElement).style.background = 'var(--color-bg-secondary)'
                                }}
                                onMouseLeave={e => {
                                    if (value !== opt) (e.currentTarget as HTMLButtonElement).style.background = 'none'
                                }}
                            >
                                {value === opt && (
                                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                                        <path d="M2 6l3 3 5-5" stroke="var(--color-primary)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                    </svg>
                                )}
                                {value !== opt && <span style={{ width: 12 }} />}
                                {opt}
                            </button>
                        ))}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}

// ── Setting Row ────────────────────────────────────────────────────────────────

function SettingRow({
    title,
    description,
    children,
    divider = true
}: {
    title: string
    description?: string
    children?: React.ReactNode
    divider?: boolean
}) {
    return (
        <div>
            <div style={{
                display: 'flex',
                alignItems: description ? 'flex-start' : 'center',
                justifyContent: 'space-between',
                gap: 24,
                padding: '18px 0',
            }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{
                        fontFamily: 'var(--font-sans)',
                        fontSize: 'var(--text-base)',
                        fontWeight: 500,
                        color: 'var(--color-text-primary)',
                        margin: 0,
                        letterSpacing: '-0.1px',
                    }}>
                        {title}
                    </p>
                    {description && (
                        <p style={{
                            fontFamily: 'var(--font-sans)',
                            fontSize: 'var(--text-sm)',
                            color: 'var(--color-text-secondary)',
                            margin: '4px 0 0',
                            lineHeight: 1.55,
                        }}>
                            {description}
                        </p>
                    )}
                </div>
                {children && <div style={{ flexShrink: 0 }}>{children}</div>}
            </div>
            {divider && (
                <div style={{ height: 1, background: 'var(--color-border)' }} />
            )}
        </div>
    )
}

// ── Section heading ────────────────────────────────────────────────────────────

function SectionHeading({ children }: { children: React.ReactNode }) {
    return (
        <h2 style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 400,
            fontSize: 'var(--text-xl)',
            letterSpacing: '-0.4px',
            color: 'var(--color-text-primary)',
            margin: '0 0 var(--space-6)',
        }}>{children}</h2>
    )
}

// ── Nav Item ──────────────────────────────────────────────────────────────────

function NavItem({
    item, active, onClick
}: {
    item: { id: SettingsSection; label: string; icon: React.ReactNode }
    active: boolean
    onClick: () => void
}) {
    return (
        <button
            onClick={onClick}
            style={{
                display: 'flex', alignItems: 'center', gap: 10,
                width: '100%', textAlign: 'left',
                background: active ? 'var(--color-bg-tertiary)' : 'transparent',
                border: 'none',
                borderRadius: 'var(--radius-md)',
                cursor: 'pointer',
                padding: '6px 10px',
                color: active ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
                fontFamily: 'var(--font-sans)',
                fontSize: 'var(--text-base)',
                fontWeight: active ? 500 : 400,
                transition: 'background var(--transition-base), color var(--transition-base)',
            }}
            onMouseEnter={e => {
                if (!active) (e.currentTarget as HTMLButtonElement).style.background = 'var(--color-bg-secondary)'
            }}
            onMouseLeave={e => {
                if (!active) (e.currentTarget as HTMLButtonElement).style.background = 'transparent'
            }}
        >
            <span style={{ opacity: active ? 1 : 0.65, display: 'flex' }}>{item.icon}</span>
            {item.label}
        </button>
    )
}

// ── Settings Panels ────────────────────────────────────────────────────────────

function PerfilPanel() {
    const [name, setName] = useState('Francisco Possato')
    const [email] = useState('francisco@empresa.com')
    const [focused, setFocused] = useState<string | null>(null)

    return (
        <div>
            <SectionHeading>Conta</SectionHeading>

            <div style={{
                padding: '20px 0',
                borderBottom: '1px solid var(--color-border)',
                display: 'flex',
                alignItems: 'center',
                gap: 16,
                marginBottom: 8,
            }}>
                <div style={{
                    width: 48, height: 48,
                    borderRadius: 'var(--radius-full)',
                    background: 'var(--color-bg-tertiary)',
                    border: '1px solid var(--color-border)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontFamily: 'var(--font-display)',
                    fontSize: 20,
                    fontWeight: 400,
                    color: 'var(--color-text-primary)',
                    flexShrink: 0,
                }}>F</div>
                <div>
                    <p style={{ fontFamily: 'var(--font-sans)', fontWeight: 500, fontSize: 'var(--text-md)', color: 'var(--color-text-primary)', margin: 0 }}>{name}</p>
                    <p style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)', margin: '2px 0 0' }}>{email}</p>
                </div>
                <button
                    className="notion-btn"
                    style={{ marginLeft: 'auto', border: '1px solid var(--color-border)' }}
                >
                    Alterar foto
                </button>
            </div>

            <SettingRow title="Nome" description="Seu nome é visível para todos os membros do workspace.">
                <input
                    value={name}
                    onChange={e => setName(e.target.value)}
                    onFocus={() => setFocused('name')}
                    onBlur={() => setFocused(null)}
                    style={{
                        padding: '7px 12px',
                        background: 'var(--color-bg-secondary)',
                        border: `1px solid ${focused === 'name' ? 'var(--color-primary)' : 'var(--color-border)'}`,
                        borderRadius: 'var(--radius-md)',
                        color: 'var(--color-text-primary)',
                        fontFamily: 'var(--font-sans)',
                        fontSize: 'var(--text-base)',
                        outline: 'none',
                        width: 220,
                        boxShadow: focused === 'name' ? '0 0 0 2px var(--color-primary-light)' : 'none',
                        transition: 'border-color var(--transition-base), box-shadow var(--transition-base)',
                    }}
                />
            </SettingRow>

            <SettingRow title="Email" description="Endereço de email associado à sua conta.">
                <span style={{
                    fontFamily: 'var(--font-sans)',
                    fontSize: 'var(--text-base)',
                    color: 'var(--color-text-secondary)',
                    padding: '7px 12px',
                    background: 'var(--color-bg-secondary)',
                    border: '1px solid var(--color-border)',
                    borderRadius: 'var(--radius-md)',
                    display: 'block',
                    width: 220,
                }}>
                    {email}
                </span>
            </SettingRow>

            <SettingRow title="Senha" description="Altere sua senha de acesso." divider={false}>
                <button className="notion-btn" style={{ border: '1px solid var(--color-border)' }}>
                    Alterar senha
                </button>
            </SettingRow>

            <div style={{ marginTop: 40 }}>
                <SectionHeading>Zona de perigo</SectionHeading>
                <div style={{
                    border: '1px solid var(--priority-high-bg)',
                    borderRadius: 'var(--radius-lg)',
                    padding: '20px 24px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 24,
                    background: 'transparent',
                }}>
                    <div>
                        <p style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-base)', fontWeight: 500, color: 'var(--color-text-primary)', margin: 0 }}>Excluir conta</p>
                        <p style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)', margin: '4px 0 0' }}>Todos os seus dados serão permanentemente removidos.</p>
                    </div>
                    <button style={{
                        padding: '7px 14px',
                        borderRadius: 'var(--radius-md)',
                        border: '1px solid var(--priority-high)',
                        background: 'transparent',
                        color: 'var(--priority-high)',
                        fontFamily: 'var(--font-sans)',
                        fontSize: 'var(--text-sm)',
                        fontWeight: 500,
                        cursor: 'pointer',
                        whiteSpace: 'nowrap',
                    }}>
                        Excluir conta
                    </button>
                </div>
            </div>
        </div>
    )
}

function PreferenciasPanel() {
    const { isDark, toggleTheme } = useTheme()
    const [language, setLanguage] = useState('Português (Brasil)')
    const [dateFormat, setDateFormat] = useState('DD/MM/AAAA')
    const [startWeekMonday, setStartWeekMonday] = useState(true)
    const [autoTimezone, setAutoTimezone] = useState(true)
    const [compactMode, setCompactMode] = useState(false)

    return (
        <div>
            <SectionHeading>Aparência</SectionHeading>
            <SettingRow
                title="Tema"
                description="Escolha entre modo claro e escuro para a plataforma."
            >
                <div style={{ display: 'flex', gap: 4 }}>
                    {['Claro', 'Escuro'].map(t => (
                        <button
                            key={t}
                            onClick={() => { if ((t === 'Escuro') !== isDark) toggleTheme() }}
                            style={{
                                padding: '6px 14px',
                                borderRadius: 'var(--radius-md)',
                                border: '1px solid var(--color-border)',
                                background: (t === 'Escuro') === isDark ? 'var(--color-bg-tertiary)' : 'var(--color-bg-secondary)',
                                color: (t === 'Escuro') === isDark ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
                                fontFamily: 'var(--font-sans)',
                                fontSize: 'var(--text-sm)',
                                fontWeight: (t === 'Escuro') === isDark ? 500 : 400,
                                cursor: 'pointer',
                                transition: 'all var(--transition-base)',
                            }}
                        >
                            {t}
                        </button>
                    ))}
                </div>
            </SettingRow>

            <SettingRow
                title="Modo compacto"
                description="Reduz o espaçamento entre elementos para exibir mais informações."
            >
                <Toggle value={compactMode} onChange={setCompactMode} />
            </SettingRow>

            <div style={{ marginTop: 32, marginBottom: 8 }}>
                <SectionHeading>Idioma e horário</SectionHeading>
            </div>

            <SettingRow title="Idioma">
                <Select
                    value={language}
                    options={['Português (Brasil)', 'English (US)', 'Español']}
                    onChange={setLanguage}
                />
            </SettingRow>

            <SettingRow title="Iniciar semana na segunda-feira" description="Afeta calendários e visões de data.">
                <Toggle value={startWeekMonday} onChange={setStartWeekMonday} />
            </SettingRow>

            <SettingRow title="Formato de data">
                <Select
                    value={dateFormat}
                    options={['DD/MM/AAAA', 'MM/DD/AAAA', 'AAAA-MM-DD', 'Relativo']}
                    onChange={setDateFormat}
                />
            </SettingRow>

            <SettingRow title="Detectar fuso horário automaticamente" description="Lembretes e notificações serão enviados no seu horário local." divider={false}>
                <Toggle value={autoTimezone} onChange={setAutoTimezone} />
            </SettingRow>
        </div>
    )
}

function NotificacoesPanel() {
    const [email, setEmail] = useState(true)
    const [browser, setBrowser] = useState(false)
    const [weeklySummary, setWeeklySummary] = useState(true)
    const [alertCac, setAlertCac] = useState(true)
    const [alertRoas, setAlertRoas] = useState(true)
    const [alertBudget, setAlertBudget] = useState(false)

    return (
        <div>
            <SectionHeading>Notificações</SectionHeading>

            <SettingRow
                title="Email"
                description="Receba resumos e alertas por email."
            >
                <Toggle value={email} onChange={setEmail} />
            </SettingRow>

            <SettingRow
                title="Navegador"
                description="Notificações push no navegador (quando a aba estiver aberta)."
            >
                <Toggle value={browser} onChange={setBrowser} />
            </SettingRow>

            <SettingRow
                title="Resumo semanal"
                description="Receba um resumo de performance toda segunda-feira às 08h."
            >
                <Toggle value={weeklySummary} onChange={setWeeklySummary} />
            </SettingRow>

            <div style={{ marginTop: 32, marginBottom: 8 }}>
                <SectionHeading>Alertas de performance</SectionHeading>
            </div>

            <SettingRow
                title="Alerta de CAC elevado"
                description="Notificar quando o custo de aquisição ultrapassar o limite definido."
            >
                <Toggle value={alertCac} onChange={setAlertCac} />
            </SettingRow>

            <SettingRow
                title="Alerta de ROAS baixo"
                description="Notificar quando o ROAS de uma campanha cair abaixo de 2x."
            >
                <Toggle value={alertRoas} onChange={setAlertRoas} />
            </SettingRow>

            <SettingRow
                title="Alerta de orçamento"
                description="Notificar quando o gasto diário atingir 90% do orçamento."
                divider={false}
            >
                <Toggle value={alertBudget} onChange={setAlertBudget} />
            </SettingRow>
        </div>
    )
}

function SegurancaPanel() {
    const [twoFactor, setTwoFactor] = useState(false)

    return (
        <div>
            <SectionHeading>Segurança</SectionHeading>

            <SettingRow
                title="Autenticação em dois fatores"
                description="Adicione uma camada extra de segurança à sua conta."
            >
                <Toggle value={twoFactor} onChange={setTwoFactor} />
            </SettingRow>

            <SettingRow
                title="Sessões ativas"
                description="Gerencie onde sua conta está conectada."
            >
                <button className="notion-btn" style={{ border: '1px solid var(--color-border)' }}>
                    Ver sessões
                </button>
            </SettingRow>

            <SettingRow title="Log de atividade" description="Histórico de acessos e ações da conta." divider={false}>
                <button className="notion-btn" style={{ border: '1px solid var(--color-border)' }}>
                    Exportar log
                </button>
            </SettingRow>
        </div>
    )
}

function WorkspacePanel() {
    const [wsName, setWsName] = useState('Northie')
    const [focused, setFocused] = useState(false)

    return (
        <div>
            <SectionHeading>Workspace</SectionHeading>

            <SettingRow title="Nome do workspace" description="O nome aparece na sidebar e em notificações.">
                <input
                    value={wsName}
                    onChange={e => setWsName(e.target.value)}
                    onFocus={() => setFocused(true)}
                    onBlur={() => setFocused(false)}
                    style={{
                        padding: '7px 12px',
                        background: 'var(--color-bg-secondary)',
                        border: `1px solid ${focused ? 'var(--color-primary)' : 'var(--color-border)'}`,
                        borderRadius: 'var(--radius-md)',
                        color: 'var(--color-text-primary)',
                        fontFamily: 'var(--font-sans)',
                        fontSize: 'var(--text-base)',
                        outline: 'none',
                        width: 220,
                        boxShadow: focused ? '0 0 0 2px var(--color-primary-light)' : 'none',
                        transition: 'border-color var(--transition-base), box-shadow var(--transition-base)',
                    }}
                />
            </SettingRow>

            <SettingRow title="Fuso horário" description="Horário padrão do workspace para relatórios e agendamentos.">
                <Select
                    value="América/São Paulo (UTC-3)"
                    options={['América/São Paulo (UTC-3)', 'GMT (UTC+0)', 'América/Nova Iorque (UTC-5)']}
                    onChange={() => { }}
                />
            </SettingRow>

            <SettingRow title="Moeda padrão" description="Usada em relatórios e metas financeiras.">
                <Select
                    value="BRL (R$)"
                    options={['BRL (R$)', 'USD ($)', 'EUR (€)']}
                    onChange={() => { }}
                />
            </SettingRow>

            <SettingRow title="Logo do workspace" description="Aparece na sidebar. Recomendado: 100x100px, PNG ou SVG." divider={false}>
                <button className="notion-btn" style={{ border: '1px solid var(--color-border)' }}>
                    Fazer upload
                </button>
            </SettingRow>
        </div>
    )
}

function MembrosPanel() {
    const members = [
        { name: 'Francisco Possato', email: 'francisco@empresa.com', role: 'Admin', initials: 'F' },
    ]

    return (
        <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
                <SectionHeading>Membros</SectionHeading>
                <button
                    style={{
                        padding: '7px 14px',
                        background: 'var(--color-primary)',
                        border: 'none',
                        borderRadius: 'var(--radius-md)',
                        color: 'white',
                        fontFamily: 'var(--font-sans)',
                        fontSize: 'var(--text-sm)',
                        fontWeight: 500,
                        cursor: 'pointer',
                    }}
                >
                    Convidar
                </button>
            </div>

            {/* Table header */}
            <div style={{
                display: 'grid', gridTemplateColumns: '1fr 200px 100px',
                padding: '0 0 10px', borderBottom: '1px solid var(--color-border)',
                marginBottom: 4,
            }}>
                {['Membro', 'Email', 'Função'].map(h => (
                    <span key={h} style={{
                        fontFamily: 'var(--font-sans)',
                        fontSize: 'var(--text-xs)',
                        fontWeight: 500,
                        color: 'var(--color-text-tertiary)',
                        letterSpacing: '0.04em',
                        textTransform: 'uppercase',
                    }}>{h}</span>
                ))}
            </div>

            {members.map(m => (
                <div key={m.email} className="notion-row" style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 200px 100px',
                    alignItems: 'center',
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{
                            width: 28, height: 28,
                            borderRadius: 'var(--radius-full)',
                            background: 'var(--color-bg-tertiary)',
                            border: '1px solid var(--color-border)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontFamily: 'var(--font-sans)', fontSize: 13, fontWeight: 500,
                            color: 'var(--color-text-secondary)',
                            flexShrink: 0,
                        }}>{m.initials}</div>
                        <span style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-base)', color: 'var(--color-text-primary)' }}>{m.name}</span>
                        <span className="tag tag-progress" style={{ marginLeft: 4 }}>Você</span>
                    </div>
                    <span style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)' }}>{m.email}</span>
                    <span className="tag tag-neutral">{m.role}</span>
                </div>
            ))}
        </div>
    )
}

function IntegracoesPanel() {
    const integrations = [
        { name: 'Meta Ads', description: 'Sincronize campanhas e dados de performance do Facebook e Instagram Ads.', icon: '🔵', connected: false },
        { name: 'Google Ads', description: 'Importe dados de campanhas Google Search, Display e YouTube.', icon: '🔴', connected: false },
        { name: 'Hotmart', description: 'Conecte vendas, comissões e métricas de produtos digitais.', icon: '🟠', connected: false },
        { name: 'Kiwify', description: 'Sincronize transações, abandono de carrinho e churn.', icon: '🟢', connected: false },
        { name: 'Eduzz', description: 'Conecte seus produtos e relatórios financeiros da Eduzz.', icon: '🟡', connected: false },
        { name: 'ActiveCampaign', description: 'Sincronize automações, leads e taxas de abertura de email.', icon: '⚪', connected: false },
    ]

    return (
        <div>
            <SectionHeading>Integrações</SectionHeading>
            <p style={{
                fontFamily: 'var(--font-sans)',
                fontSize: 'var(--text-base)',
                color: 'var(--color-text-secondary)',
                marginBottom: 24,
                lineHeight: 1.55,
            }}>
                Conecte suas plataformas para centralizar todos os seus dados na Northie.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {integrations.map((intg, i) => (
                    <motion.div
                        key={intg.name}
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.25, delay: i * 0.04 }}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 16,
                            padding: '16px 0',
                            borderBottom: i < integrations.length - 1 ? '1px solid var(--color-border)' : 'none',
                        }}
                    >
                        <span style={{ fontSize: 22, flexShrink: 0, width: 36, textAlign: 'center' }}>{intg.icon}</span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{ fontFamily: 'var(--font-sans)', fontWeight: 500, fontSize: 'var(--text-base)', color: 'var(--color-text-primary)', margin: 0 }}>{intg.name}</p>
                            <p style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)', margin: '3px 0 0', lineHeight: 1.4 }}>{intg.description}</p>
                        </div>
                        <button style={{
                            padding: '6px 14px',
                            borderRadius: 'var(--radius-md)',
                            border: '1px solid var(--color-border)',
                            background: 'var(--color-bg-secondary)',
                            color: 'var(--color-text-secondary)',
                            fontFamily: 'var(--font-sans)',
                            fontSize: 'var(--text-sm)',
                            fontWeight: 400,
                            cursor: 'pointer',
                            whiteSpace: 'nowrap',
                            transition: 'all var(--transition-base)',
                        }}
                            onMouseEnter={e => {
                                (e.currentTarget as HTMLButtonElement).style.background = 'var(--color-bg-tertiary)'
                                    ; (e.currentTarget as HTMLButtonElement).style.color = 'var(--color-text-primary)'
                            }}
                            onMouseLeave={e => {
                                (e.currentTarget as HTMLButtonElement).style.background = 'var(--color-bg-secondary)'
                                    ; (e.currentTarget as HTMLButtonElement).style.color = 'var(--color-text-secondary)'
                            }}
                        >
                            Conectar
                        </button>
                    </motion.div>
                ))}
            </div>
        </div>
    )
}

function PlanosPanel() {
    return (
        <div>
            <SectionHeading>Plano atual</SectionHeading>
            <div style={{
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-lg)',
                padding: '24px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 24,
                background: 'var(--color-bg-secondary)',
                marginBottom: 32,
            }}>
                <div>
                    <p style={{ fontFamily: 'var(--font-sans)', fontWeight: 600, fontSize: 'var(--text-lg)', color: 'var(--color-text-primary)', margin: 0 }}>
                        Northie Pro
                    </p>
                    <p style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)', margin: '4px 0 0' }}>
                        Acesso completo a todos os módulos, integrações ilimitadas e suporte prioritário.
                    </p>
                </div>
                <button className="notion-btn" style={{ border: '1px solid var(--color-border)' }}>
                    Gerenciar assinatura
                </button>
            </div>

            <SectionHeading>Faturamento</SectionHeading>
            <SettingRow title="Cartão de crédito" description="Visa terminado em ••••">
                <button className="notion-btn" style={{ border: '1px solid var(--color-border)' }}>
                    Alterar
                </button>
            </SettingRow>
            <SettingRow title="Próxima cobrança" description="26 de março de 2026" divider={false}>
                <button className="notion-btn" style={{ border: '1px solid var(--color-border)' }}>
                    Ver faturas
                </button>
            </SettingRow>
        </div>
    )
}

// ── Nav config ─────────────────────────────────────────────────────────────────

const navGroups: NavGroup[] = [
    {
        label: 'Conta',
        items: [
            { id: 'perfil', label: 'Perfil', icon: icons.user },
            { id: 'preferencias', label: 'Preferências', icon: icons.sliders },
            { id: 'notificacoes', label: 'Notificações', icon: icons.bell },
            { id: 'seguranca', label: 'Segurança', icon: icons.shield },
        ],
    },
    {
        label: 'Workspace',
        items: [
            { id: 'workspace', label: 'Geral', icon: icons.building },
            { id: 'membros', label: 'Membros', icon: icons.users },
            { id: 'integracoes', label: 'Integrações', icon: icons.plug },
        ],
    },
    {
        label: 'Planos',
        items: [
            { id: 'planos', label: 'Planos & Faturamento', icon: icons.credit },
        ],
    },
]

const PANELS: Record<SettingsSection, React.ReactNode> = {
    perfil: <PerfilPanel />,
    preferencias: <PreferenciasPanel />,
    notificacoes: <NotificacoesPanel />,
    seguranca: <SegurancaPanel />,
    workspace: <WorkspacePanel />,
    membros: <MembrosPanel />,
    integracoes: <IntegracoesPanel />,
    planos: <PlanosPanel />,
}

// ── Main ─────────────────────────────────────────────────────────────────────

export default function Configuracoes() {
    const [active, setActive] = useState<SettingsSection>('preferencias')

    return (
        <div style={{ paddingTop: 28, paddingBottom: 80, display: 'flex', gap: 0, minHeight: '80vh' }}>

            {/* Left nav */}
            <div style={{
                width: 220,
                flexShrink: 0,
                paddingRight: 32,
                paddingTop: 4,
            }}>
                {navGroups.map(group => (
                    <div key={group.label} style={{ marginBottom: 24 }}>
                        <p style={{
                            fontFamily: 'var(--font-sans)',
                            fontSize: 'var(--text-xs)',
                            fontWeight: 500,
                            color: 'var(--color-text-tertiary)',
                            letterSpacing: '0.04em',
                            textTransform: 'uppercase',
                            margin: '0 0 6px 10px',
                        }}>
                            {group.label}
                        </p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                            {group.items.map(item => (
                                <NavItem
                                    key={item.id}
                                    item={item}
                                    active={active === item.id}
                                    onClick={() => setActive(item.id)}
                                />
                            ))}
                        </div>
                    </div>
                ))}
            </div>

            {/* Vertical divider */}
            <div style={{ width: 1, background: 'var(--color-border)', flexShrink: 0, marginRight: 56 }} />

            {/* Content */}
            <div style={{ flex: 1, maxWidth: 640 }}>
                <AnimatePresence mode="wait">
                    <motion.div
                        key={active}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -4 }}
                        transition={{ duration: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
                    >
                        {PANELS[active]}
                    </motion.div>
                </AnimatePresence>
            </div>
        </div>
    )
}
