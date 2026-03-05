import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useTheme } from '../ThemeContext'
import { supabase } from '../lib/supabase'
import { integrationApi } from '../lib/api'

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

function PerfilPanel({ user }: { user?: any }) {
    const initialName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || ''
    const email = user?.email || ''
    const [name, setName] = useState(initialName)
    const [focused, setFocused] = useState<string | null>(null)
    const [saving, setSaving] = useState(false)
    const [saved, setSaved] = useState(false)

    const handleSave = async () => {
        if (!user?.id || !name.trim()) return
        setSaving(true)
        try {
            await supabase.from('profiles').update({ full_name: name.trim() }).eq('id', user.id)
            await supabase.auth.updateUser({ data: { full_name: name.trim() } })
            setSaved(true)
            setTimeout(() => setSaved(false), 2000)
        } finally {
            setSaving(false)
        }
    }

    const initial = name?.[0]?.toUpperCase() || email?.[0]?.toUpperCase() || 'N'

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
                }}>{initial}</div>
                <div>
                    <p style={{ fontFamily: 'var(--font-sans)', fontWeight: 500, fontSize: 'var(--text-md)', color: 'var(--color-text-primary)', margin: 0 }}>{name || email}</p>
                    <p style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)', margin: '2px 0 0' }}>{email}</p>
                </div>
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

            <SettingRow title="Senha" description="Altere sua senha de acesso.">
                <button className="notion-btn" style={{ border: '1px solid var(--color-border)' }}>
                    Alterar senha
                </button>
            </SettingRow>

            <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: 8 }}>
                <button
                    onClick={handleSave}
                    disabled={saving || !name.trim()}
                    style={{
                        padding: '7px 20px',
                        borderRadius: 'var(--radius-md)',
                        border: 'none',
                        background: saved ? 'var(--color-success, #22c55e)' : 'var(--color-primary)',
                        color: 'white',
                        fontFamily: 'var(--font-sans)',
                        fontSize: 'var(--text-sm)',
                        fontWeight: 500,
                        cursor: saving ? 'default' : 'pointer',
                        opacity: saving ? 0.7 : 1,
                        transition: 'background 0.2s',
                    }}
                >
                    {saved ? 'Salvo ✓' : saving ? 'Salvando...' : 'Salvar alterações'}
                </button>
            </div>

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

const TIMEZONES = [
    'América/São Paulo (UTC-3)',
    'América/Manaus (UTC-4)',
    'América/Belém (UTC-3)',
    'América/Fortaleza (UTC-3)',
    'América/Recife (UTC-3)',
    'GMT (UTC+0)',
    'Europa/Lisboa (UTC+0)',
    'Europa/Londres (UTC+0)',
    'América/Nova Iorque (UTC-5)',
    'América/Los Angeles (UTC-8)',
]

const CURRENCIES = ['BRL (R$)', 'USD ($)', 'EUR (€)', 'GBP (£)']

function WorkspacePanel({ user }: { user?: any }) {
    const [wsName, setWsName] = useState('')
    const [timezone, setTimezone] = useState('América/São Paulo (UTC-3)')
    const [currency, setCurrency] = useState('BRL (R$)')
    const [logoUrl, setLogoUrl] = useState<string | null>(null)
    const [focused, setFocused] = useState(false)
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [saved, setSaved] = useState(false)
    const [uploading, setUploading] = useState(false)
    const fileInputRef = useRef<HTMLInputElement>(null)

    useEffect(() => {
        if (!user?.id) { setLoading(false); return }
        supabase
            .from('profiles')
            .select('business_name, timezone, currency, logo_url')
            .eq('id', user.id)
            .single()
            .then(({ data }) => {
                if (data) {
                    setWsName(data.business_name || '')
                    if (data.timezone) setTimezone(data.timezone)
                    if (data.currency) setCurrency(data.currency)
                    if (data.logo_url) setLogoUrl(data.logo_url)
                }
            })
            .finally(() => setLoading(false))
    }, [user?.id])

    const handleSave = async () => {
        if (!user?.id) return
        setSaving(true)
        try {
            await supabase
                .from('profiles')
                .update({ business_name: wsName.trim() || null, timezone, currency })
                .eq('id', user.id)
            setSaved(true)
            setTimeout(() => setSaved(false), 2000)
        } finally {
            setSaving(false)
        }
    }

    const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file || !user?.id) return
        setUploading(true)
        try {
            const ext = file.name.split('.').pop() || 'png'
            const path = `${user.id}/logo.${ext}`
            const { error: uploadError } = await supabase.storage
                .from('workspace-logos')
                .upload(path, file, { upsert: true, contentType: file.type })
            if (uploadError) throw uploadError
            const { data: urlData } = supabase.storage.from('workspace-logos').getPublicUrl(path)
            const publicUrl = `${urlData.publicUrl}?t=${Date.now()}` // bust cache
            await supabase.from('profiles').update({ logo_url: publicUrl }).eq('id', user.id)
            setLogoUrl(publicUrl)
        } catch (err) {
            console.error('Logo upload error:', err)
        } finally {
            setUploading(false)
            // reset input so same file can be re-selected
            if (fileInputRef.current) fileInputRef.current.value = ''
        }
    }

    if (loading) return (
        <div style={{ padding: '60px 0', textAlign: 'center', fontFamily: 'var(--font-sans)', color: 'var(--color-text-tertiary)' }}>
            Carregando...
        </div>
    )

    const logoInitial = wsName?.[0]?.toUpperCase() || 'N'

    return (
        <div>
            <SectionHeading>Workspace</SectionHeading>

            {/* Preview card — logo + name */}
            <div style={{
                padding: '20px 0',
                borderBottom: '1px solid var(--color-border)',
                display: 'flex',
                alignItems: 'center',
                gap: 16,
                marginBottom: 8,
            }}>
                <div
                    onClick={() => fileInputRef.current?.click()}
                    title="Clique para trocar o logo"
                    style={{
                        width: 48, height: 48,
                        borderRadius: 'var(--radius-md)',
                        background: 'var(--color-bg-tertiary)',
                        border: '1px solid var(--color-border)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        cursor: 'pointer',
                        overflow: 'hidden',
                        flexShrink: 0,
                        position: 'relative',
                        transition: 'border-color var(--transition-base)',
                    }}
                >
                    {logoUrl ? (
                        <img src={logoUrl} alt="logo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                        <span style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 400, color: 'var(--color-text-secondary)' }}>
                            {logoInitial}
                        </span>
                    )}
                    {uploading && (
                        <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round">
                                <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                            </svg>
                        </div>
                    )}
                </div>
                <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/svg+xml,image/webp"
                    style={{ display: 'none' }}
                    onChange={handleLogoUpload}
                />
                <div>
                    <p style={{ fontFamily: 'var(--font-sans)', fontWeight: 500, fontSize: 'var(--text-md)', color: 'var(--color-text-primary)', margin: 0 }}>
                        {wsName || 'Sem nome'}
                    </p>
                    <p style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)', margin: '2px 0 0' }}>
                        Clique no logo para trocar — PNG, JPG ou SVG
                    </p>
                </div>
            </div>

            <SettingRow title="Nome do workspace" description="O nome aparece na sidebar e em notificações.">
                <input
                    value={wsName}
                    onChange={e => setWsName(e.target.value)}
                    onFocus={() => setFocused(true)}
                    onBlur={() => setFocused(false)}
                    placeholder="Nome da sua empresa"
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

            <SettingRow title="Fuso horário" description="Horário padrão para relatórios e agendamentos.">
                <Select value={timezone} options={TIMEZONES} onChange={setTimezone} />
            </SettingRow>

            <SettingRow title="Moeda padrão" description="Usada em relatórios e metas financeiras." divider={false}>
                <Select value={currency} options={CURRENCIES} onChange={setCurrency} />
            </SettingRow>

            <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: 20 }}>
                <button
                    onClick={handleSave}
                    disabled={saving}
                    style={{
                        padding: '7px 20px',
                        borderRadius: 'var(--radius-md)',
                        border: 'none',
                        background: saved ? 'var(--color-success, #22c55e)' : 'var(--color-primary)',
                        color: 'white',
                        fontFamily: 'var(--font-sans)',
                        fontSize: 'var(--text-sm)',
                        fontWeight: 500,
                        cursor: saving ? 'default' : 'pointer',
                        opacity: saving ? 0.7 : 1,
                        transition: 'background 0.2s',
                    }}
                >
                    {saved ? 'Salvo ✓' : saving ? 'Salvando...' : 'Salvar alterações'}
                </button>
            </div>
        </div>
    )
}

function MembrosPanel({ user }: { user?: any }) {
    const name = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Founder'
    const email = user?.email || ''
    const initial = name?.[0]?.toUpperCase() || 'F'
    const members = [
        { name, email, role: 'Admin', initials: initial },
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

function IntegracoesPanel({ onGoToAppStore }: { onGoToAppStore?: () => void }) {
    const INTEGRATION_META = [
        { platform: 'meta', name: 'Meta Ads', description: 'Campanhas Facebook e Instagram Ads — ROAS, CAC e conversões.', logoUrl: '/logos/logo-meta.png' },
        { platform: 'google', name: 'Google Ads', description: 'Search, Display e YouTube — custo, cliques e atribuição GCLID.', logoUrl: '/logos/logo-googleads.png' },
        { platform: 'hotmart', name: 'Hotmart', description: 'Vendas, reembolsos e assinaturas de produtos digitais em tempo real.', logoUrl: '/logos/logo-hotmart.jpg' },
        { platform: 'stripe', name: 'Stripe', description: 'Transações, MRR e churn de assinaturas e pagamentos globais.', logoUrl: '/logos/logo-stripe.png' },
        { platform: 'shopify', name: 'Shopify', description: 'Pedidos, clientes e estoque do seu e-commerce.', logoUrl: '/logos/logo-shopify.png' },
    ]

    const [statuses, setStatuses] = useState<Record<string, string>>({})

    useEffect(() => {
        integrationApi.getStatus()
            .then(({ data }) => {
                if (!Array.isArray(data)) return
                const map: Record<string, string> = {}
                for (const item of data) map[item.platform] = item.status
                setStatuses(map)
            })
            .catch(() => { })
    }, [])

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
                Gerencie suas conexões de plataforma. Para conectar ou reconectar, acesse a <strong>App Store</strong>.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {INTEGRATION_META.map((intg, i) => {
                    const status = statuses[intg.platform]
                    const isActive = status === 'active'
                    const isExpired = status === 'expired' || status === 'inactive'
                    return (
                        <motion.div
                            key={intg.platform}
                            initial={{ opacity: 0, y: 4 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.25, delay: i * 0.04 }}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 16,
                                padding: '16px 0',
                                borderBottom: i < INTEGRATION_META.length - 1 ? '1px solid var(--color-border)' : 'none',
                            }}
                        >
                            <div style={{
                                width: 36, height: 36, borderRadius: 'var(--radius-md)',
                                background: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                overflow: 'hidden', flexShrink: 0,
                            }}>
                                <img src={intg.logoUrl} alt={intg.name} style={{ width: 22, height: 22, objectFit: 'contain' }} />
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <p style={{ fontFamily: 'var(--font-sans)', fontWeight: 500, fontSize: 'var(--text-base)', color: 'var(--color-text-primary)', margin: 0 }}>{intg.name}</p>
                                    {isActive && <span className="tag tag-complete" style={{ fontSize: 9 }}>Conectado</span>}
                                    {isExpired && <span className="tag tag-warning" style={{ fontSize: 9 }}>Expirado</span>}
                                </div>
                                <p style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)', margin: '3px 0 0', lineHeight: 1.4 }}>{intg.description}</p>
                            </div>
                            <button
                                onClick={onGoToAppStore}
                                style={{
                                    padding: '6px 14px',
                                    borderRadius: 'var(--radius-md)',
                                    border: `1px solid ${isExpired ? 'var(--status-critical)' : 'var(--color-border)'}`,
                                    background: 'var(--color-bg-secondary)',
                                    color: isExpired ? 'var(--status-critical)' : 'var(--color-text-secondary)',
                                    fontFamily: 'var(--font-sans)',
                                    fontSize: 'var(--text-sm)',
                                    fontWeight: 400,
                                    cursor: 'pointer',
                                    whiteSpace: 'nowrap',
                                    transition: 'all var(--transition-base)',
                                }}
                            >
                                {isExpired ? 'Reconectar' : isActive ? 'Gerenciar' : 'Conectar'}
                            </button>
                        </motion.div>
                    )
                })}
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

// ── Main ─────────────────────────────────────────────────────────────────────

export default function Configuracoes({ user, onGoToAppStore }: { user?: any; onGoToAppStore?: () => void }) {
    const [active, setActive] = useState<SettingsSection>('preferencias')

    const renderPanel = () => {
        switch (active) {
            case 'perfil': return <PerfilPanel user={user} />
            case 'integracoes': return <IntegracoesPanel onGoToAppStore={onGoToAppStore} />
            case 'preferencias': return <PreferenciasPanel />
            case 'notificacoes': return <NotificacoesPanel />
            case 'seguranca': return <SegurancaPanel />
            case 'workspace': return <WorkspacePanel user={user} />
            case 'membros': return <MembrosPanel user={user} />
            case 'planos': return <PlanosPanel />
        }
    }

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
                        {renderPanel()}
                    </motion.div>
                </AnimatePresence>
            </div>
        </div>
    )
}
