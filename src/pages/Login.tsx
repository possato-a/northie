import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useTheme } from '../ThemeContext'
import { supabase } from '../lib/supabase'

type AuthView = 'login' | 'signup'

// ── Icons ─────────────────────────────────────────────────────────────────────

function EyeIcon({ open }: { open: boolean }) {
    if (open) return (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
            <circle cx="12" cy="12" r="3" />
        </svg>
    )
    return (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
            <line x1="1" y1="1" x2="23" y2="23" />
        </svg>
    )
}

// ── Shared Input Styles ────────────────────────────────────────────────────────

function getInputStyle(focused: boolean): React.CSSProperties {
    return {
        width: '100%',
        padding: '9px 12px',
        background: 'var(--color-bg-primary)',
        border: `1px solid ${focused ? 'var(--color-primary)' : 'var(--color-border)'}`,
        borderRadius: 'var(--radius-md)',
        color: 'var(--color-text-primary)',
        fontFamily: 'var(--font-sans)',
        fontSize: 'var(--text-base)',
        outline: 'none',
        boxSizing: 'border-box' as const,
        boxShadow: focused ? '0 0 0 2px var(--color-primary-light)' : 'none',
        transition: 'border-color var(--transition-base), box-shadow var(--transition-base)',
    }
}

const labelStyle: React.CSSProperties = {
    display: 'block',
    fontFamily: 'var(--font-sans)',
    fontSize: 'var(--text-sm)',
    fontWeight: 500,
    color: 'var(--color-text-secondary)',
    marginBottom: 6,
}

function PasswordInput({
    value, onChange, placeholder, focused, onFocus, onBlur
}: {
    value: string
    onChange: (v: string) => void
    placeholder?: string
    focused: boolean
    onFocus: () => void
    onBlur: () => void
}) {
    const [show, setShow] = useState(false)
    return (
        <div style={{ position: 'relative' }}>
            <input
                type={show ? 'text' : 'password'}
                value={value}
                onChange={e => onChange(e.target.value)}
                onFocus={onFocus}
                onBlur={onBlur}
                placeholder={placeholder ?? '••••••••'}
                style={{ ...getInputStyle(focused), paddingRight: 40 }}
            />
            <button
                type="button"
                onClick={() => setShow(v => !v)}
                style={{
                    position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: 'var(--color-text-tertiary)', padding: 0, display: 'flex',
                    transition: 'color var(--transition-base)',
                }}
                onMouseEnter={e => (e.currentTarget.style.color = 'var(--color-text-secondary)')}
                onMouseLeave={e => (e.currentTarget.style.color = 'var(--color-text-tertiary)')}
            >
                <EyeIcon open={show} />
            </button>
        </div>
    )
}

// ── Left Image Panel ──────────────────────────────────────────────────────────

function ImagePanel() {
    const { isDark } = useTheme()
    return (
        <div style={{
            flex: '0 0 55%',
            position: 'relative',
            background: isDark ? '#000' : 'var(--color-bg-secondary)',
            overflow: 'hidden',
            borderRight: '1px solid var(--color-border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
        }}>
            <motion.img
                src={isDark ? "/northie-bussola-dark.png" : "/bussola-northie.png"}
                alt="Bússola Northie"
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 1.3, ease: [0.25, 0.1, 0.25, 1] }}
                style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'contain',
                    mixBlendMode: isDark ? 'screen' : 'multiply',
                    display: 'block',
                    marginTop: '-40px',
                    zIndex: 1,
                }}
            />

            {/* Glass card */}
            <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, delay: 0.5, ease: [0.25, 0.1, 0.25, 1] }}
                style={{
                    position: 'absolute',
                    bottom: 22,
                    left: 20,
                    right: 20,
                    zIndex: 3,
                    background: 'var(--surface-glass)',
                    backdropFilter: 'blur(22px) saturate(1.6)',
                    WebkitBackdropFilter: 'blur(22px) saturate(1.6)',
                    border: '1px solid var(--color-border)',
                    borderRadius: 'var(--radius-xl)',
                    padding: '20px 26px',
                    boxShadow: 'var(--shadow-md)',
                }}
            >
                <p style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: 17,
                    fontWeight: 400,
                    color: 'var(--color-text-primary)',
                    letterSpacing: '-0.3px',
                    lineHeight: 1.5,
                    margin: '0 0 10px',
                }}>
                    Dados que revelam,<br />decisões que constroem.
                </p>
                <p style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 'var(--text-xs)',
                    color: 'var(--color-text-tertiary)',
                    letterSpacing: '0.08em',
                    margin: 0,
                    textTransform: 'uppercase',
                }}>
                    Northie — Sua central de inteligência
                </p>
            </motion.div>
        </div>
    )
}

// ── Login Form ────────────────────────────────────────────────────────────────

function LoginForm({ onLogin, onSwitchToSignup }: { onLogin: () => void; onSwitchToSignup: () => void }) {
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [focused, setFocused] = useState<string | null>(null)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        setError(null)

        let attempts = 0

        const attemptLogin = async (): Promise<void> => {
            const { error } = await supabase.auth.signInWithPassword({ email, password })
            if (error) {
                const isRetryable = error.status === 0 ||
                    error.message.toLowerCase().includes('fetch') ||
                    error.message.toLowerCase().includes('network')

                if (isRetryable && attempts < 3) {
                    attempts++
                    await new Promise(resolve => setTimeout(resolve, 1000 * attempts))
                    return attemptLogin()
                }
                setError(error.message)
                setLoading(false)
            } else {
                onLogin()
            }
        }

        try { await attemptLogin() } catch {
            setError('Erro inesperado na conexão.')
            setLoading(false)
        }
    }

    return (
        <motion.div
            key="login"
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -24 }}
            transition={{ duration: 0.28, ease: [0.25, 0.1, 0.25, 1] }}
            style={{
                flex: '0 0 45%',
                background: 'var(--color-bg-primary)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                padding: '52px 56px',
                overflowY: 'auto',
            }}
        >
            {/* Logo */}
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.5, delay: 0.05 }}
                style={{
                    fontFamily: 'var(--font-serif)',
                    fontSize: 20,
                    fontWeight: 400,
                    color: 'var(--color-text-primary)',
                    marginBottom: 'var(--space-12)',
                    letterSpacing: '-0.5px',
                }}
            >
                Northie
            </motion.div>

            {/* Heading */}
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, delay: 0.1 }}>
                <h1 style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: 28,
                    fontWeight: 400,
                    color: 'var(--color-text-primary)',
                    letterSpacing: '-0.8px',
                    margin: '0 0 6px',
                    lineHeight: 1.15,
                }}>
                    Bem-vindo de volta
                </h1>
                <p style={{
                    fontFamily: 'var(--font-sans)',
                    fontSize: 'var(--text-base)',
                    color: 'var(--color-text-secondary)',
                    margin: '0 0 var(--space-8)',
                    lineHeight: 1.55,
                }}>
                    Entre com seus dados para acessar o painel.
                </p>
            </motion.div>

            {/* Form */}
            <motion.form
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.18 }}
                onSubmit={handleLogin}
                style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}
            >
                {error && (
                    <div style={{
                        padding: 'var(--space-3)',
                        borderRadius: 'var(--radius-md)',
                        background: 'var(--priority-high-bg)',
                        color: 'var(--priority-high)',
                        fontFamily: 'var(--font-sans)',
                        fontSize: 'var(--text-sm)',
                        border: '1px solid rgba(224,62,62,0.2)',
                    }}>
                        {error}
                    </div>
                )}

                <div>
                    <label style={labelStyle}>Email</label>
                    <input
                        type="email"
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        onFocus={() => setFocused('email')}
                        onBlur={() => setFocused(null)}
                        placeholder="voce@empresa.com"
                        style={getInputStyle(focused === 'email')}
                        required
                    />
                </div>

                <div>
                    <label style={labelStyle}>Senha</label>
                    <PasswordInput
                        value={password}
                        onChange={setPassword}
                        focused={focused === 'password'}
                        onFocus={() => setFocused('password')}
                        onBlur={() => setFocused(null)}
                    />
                </div>

                <div style={{ textAlign: 'right', marginTop: -8 }}>
                    <button type="button" style={{
                        background: 'none', border: 'none', cursor: 'pointer',
                        fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)',
                        color: 'var(--color-text-tertiary)',
                        textDecoration: 'underline', textUnderlineOffset: 3, padding: 0,
                    }}>
                        Esqueceu a senha?
                    </button>
                </div>

                <motion.button
                    type="submit"
                    disabled={loading}
                    whileHover={loading ? {} : { opacity: 0.9 }}
                    whileTap={loading ? {} : { scale: 0.985 }}
                    style={{
                        width: '100%',
                        padding: '10px',
                        background: loading ? 'var(--color-border)' : 'var(--color-primary)',
                        color: 'white',
                        border: 'none',
                        borderRadius: 'var(--radius-md)',
                        fontFamily: 'var(--font-sans)',
                        fontSize: 'var(--text-base)',
                        fontWeight: 500,
                        cursor: loading ? 'default' : 'pointer',
                        marginTop: 4,
                        letterSpacing: '-0.1px',
                        transition: 'background var(--transition-base)',
                    }}
                >
                    {loading ? 'Entrando...' : 'Entrar'}
                </motion.button>
            </motion.form>

            {/* Footer */}
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4, delay: 0.3 }} style={{ marginTop: 'var(--space-8)', textAlign: 'center' }}>
                <p style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', color: 'var(--color-text-tertiary)', margin: 0 }}>
                    Não tem conta?{' '}
                    <button
                        onClick={onSwitchToSignup}
                        style={{
                            background: 'none', border: 'none', cursor: 'pointer',
                            fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)',
                            color: 'var(--color-primary)', fontWeight: 500, padding: 0,
                        }}
                        onMouseEnter={e => (e.currentTarget.style.color = 'var(--color-primary-hover)')}
                        onMouseLeave={e => (e.currentTarget.style.color = 'var(--color-primary)')}
                    >
                        Criar conta
                    </button>
                </p>
            </motion.div>
        </motion.div>
    )
}

function SignupForm({ onSwitchToLogin }: { onSwitchToLogin: () => void }) {
    const [name, setName] = useState('')
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [confirm, setConfirm] = useState('')
    const [focused, setFocused] = useState<string | null>(null)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const handleSignup = async (e: React.FormEvent) => {
        e.preventDefault()
        if (password !== confirm) {
            setError('As senhas não coincidem')
            return
        }
        setLoading(true)
        setError(null)

        const { error } = await supabase.auth.signUp({
            email,
            password,
            options: {
                data: { full_name: name },
                emailRedirectTo: window.location.origin
            }
        })

        if (error) {
            setError(error.message)
            setLoading(false)
        } else {
            setLoading(false)
            alert('Conta criada! Verifique seu email para confirmar o cadastro.')
            onSwitchToLogin()
        }
    }

    return (
        <motion.div
            key="signup"
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -24 }}
            transition={{ duration: 0.28, ease: [0.25, 0.1, 0.25, 1] }}
            style={{
                flex: '0 0 45%',
                background: 'var(--color-bg-primary)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                padding: '52px 56px',
                overflowY: 'auto',
            }}
        >
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.5, delay: 0.05 }}
                style={{
                    fontFamily: 'var(--font-serif)',
                    fontSize: 20,
                    fontWeight: 400,
                    color: 'var(--color-text-primary)',
                    marginBottom: 'var(--space-10)',
                    letterSpacing: '-0.5px',
                }}
            >
                Northie
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, delay: 0.1 }}>
                <h1 style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: 28,
                    fontWeight: 400,
                    color: 'var(--color-text-primary)',
                    letterSpacing: '-0.8px',
                    margin: '0 0 6px',
                    lineHeight: 1.15,
                }}>
                    Criar sua conta
                </h1>
                <p style={{
                    fontFamily: 'var(--font-sans)',
                    fontSize: 'var(--text-base)',
                    color: 'var(--color-text-secondary)',
                    margin: '0 0 var(--space-6)',
                    lineHeight: 1.55,
                }}>
                    Junte-se à Northie e transforme dados em decisões.
                </p>
            </motion.div>

            <motion.form
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.18 }}
                onSubmit={handleSignup}
                style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}
            >
                {error && (
                    <div style={{
                        padding: 'var(--space-3)', borderRadius: 'var(--radius-md)',
                        background: 'var(--priority-high-bg)', color: 'var(--priority-high)',
                        fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)',
                        border: '1px solid rgba(224,62,62,0.2)',
                    }}>
                        {error}
                    </div>
                )}

                <div>
                    <label style={labelStyle}>Nome completo</label>
                    <input type="text" value={name} onChange={e => setName(e.target.value)}
                        onFocus={() => setFocused('name')} onBlur={() => setFocused(null)}
                        placeholder="Lucas Montano" style={getInputStyle(focused === 'name')} required
                    />
                </div>

                <div>
                    <label style={labelStyle}>Email</label>
                    <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                        onFocus={() => setFocused('email')} onBlur={() => setFocused(null)}
                        placeholder="voce@empresa.com" style={getInputStyle(focused === 'email')} required
                    />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div>
                        <label style={labelStyle}>Senha</label>
                        <PasswordInput value={password} onChange={setPassword}
                            focused={focused === 'password'} onFocus={() => setFocused('password')} onBlur={() => setFocused(null)} />
                    </div>
                    <div>
                        <label style={labelStyle}>Confirmar</label>
                        <PasswordInput value={confirm} onChange={setConfirm}
                            focused={focused === 'confirm'} onFocus={() => setFocused('confirm')} onBlur={() => setFocused(null)} />
                    </div>
                </div>

                <p style={{
                    fontFamily: 'var(--font-sans)', fontSize: 'var(--text-xs)',
                    color: 'var(--color-text-tertiary)', margin: 0, lineHeight: 1.6,
                }}>
                    Mínimo 8 caracteres, incluindo um número e um caractere especial.
                </p>

                <motion.button
                    type="submit" disabled={loading}
                    whileHover={loading ? {} : { opacity: 0.9 }} whileTap={loading ? {} : { scale: 0.985 }}
                    style={{
                        width: '100%', padding: '10px',
                        background: loading ? 'var(--color-border)' : 'var(--color-primary)',
                        color: 'white', border: 'none', borderRadius: 'var(--radius-md)',
                        fontFamily: 'var(--font-sans)', fontSize: 'var(--text-base)', fontWeight: 500,
                        cursor: loading ? 'default' : 'pointer', marginTop: 4,
                        transition: 'background var(--transition-base)',
                    }}
                >
                    {loading ? 'Criando conta...' : 'Criar conta'}
                </motion.button>
            </motion.form>

            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4, delay: 0.3 }}
                style={{ marginTop: 'var(--space-6)', textAlign: 'center' }}>
                <p style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', color: 'var(--color-text-tertiary)', margin: 0 }}>
                    Já tem conta?{' '}
                    <button onClick={onSwitchToLogin} style={{
                        background: 'none', border: 'none', cursor: 'pointer',
                        fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)',
                        color: 'var(--color-primary)', fontWeight: 500, padding: 0,
                    }}>
                        Entrar
                    </button>
                </p>
            </motion.div>
        </motion.div>
    )
}

// ── Main Export ───────────────────────────────────────────────────────────────

export default function Login({ onLogin }: { onLogin: () => void }) {
    const [view, setView] = useState<AuthView>('login')

    return (
        <div style={{ width: '100vw', height: '100vh', display: 'flex', overflow: 'hidden' }}>
            <ImagePanel />
            <AnimatePresence mode="wait">
                {view === 'login' ? (
                    <LoginForm key="login" onLogin={onLogin} onSwitchToSignup={() => setView('signup')} />
                ) : (
                    <SignupForm key="signup" onSwitchToLogin={() => setView('login')} />
                )}
            </AnimatePresence>
        </div>
    )
}
