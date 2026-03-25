import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
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
        padding: '10px 12px',
        background: '#FFFFFF',
        border: `1px solid ${focused ? '#FF5900' : 'rgba(0,0,0,0.1)'}`,
        borderRadius: 6,
        color: '#37352F',
        fontFamily: 'var(--font-sans)',
        fontSize: 14,
        outline: 'none',
        boxSizing: 'border-box' as const,
        boxShadow: focused ? '0 0 0 3px rgba(255,89,0,0.08)' : 'none',
        transition: 'border-color 0.15s, box-shadow 0.15s',
    }
}

const labelStyle: React.CSSProperties = {
    display: 'block',
    fontFamily: 'var(--font-sans)',
    fontSize: 13,
    fontWeight: 500,
    color: '#6B6B6B',
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
                    color: '#9B9A97', padding: 0, display: 'flex',
                    transition: 'color 0.15s',
                }}
                onMouseEnter={e => (e.currentTarget.style.color = '#6B6B6B')}
                onMouseLeave={e => (e.currentTarget.style.color = '#9B9A97')}
            >
                <EyeIcon open={show} />
            </button>
        </div>
    )
}

// ── Left Image Panel ──────────────────────────────────────────────────────────

function ImagePanel() {
    return (
        <div style={{
            flex: '0 0 55%',
            position: 'relative',
            overflow: 'hidden',
        }}>
            <motion.img
                src="/login-hero.png"
                alt="Northie"
                initial={{ opacity: 0, scale: 1.02 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 1, ease: [0.25, 0.1, 0.25, 1] }}
                style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    display: 'block',
                }}
            />
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
    const [resetState, setResetState] = useState<'idle' | 'sending' | 'sent'>('idle')

    const handleForgotPassword = async () => {
        if (!email.trim()) {
            setError('Digite seu email primeiro para redefinir a senha.')
            return
        }
        setResetState('sending')
        const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
            redirectTo: `${window.location.origin}/?reset_password=true`,
        })
        if (resetError) {
            setError(resetError.message)
            setResetState('idle')
        } else {
            setResetState('sent')
            setError(null)
            setTimeout(() => setResetState('idle'), 5000)
        }
    }

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
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.25, ease: [0.25, 0.1, 0.25, 1] }}
            style={{
                flex: '0 0 45%',
                background: '#FFFFFF',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                padding: '48px 56px',
                overflowY: 'auto',
            }}
        >
            {/* Logo */}
            <motion.img
                src="/logo-northie.png"
                alt="Northie"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.4, delay: 0.05 }}
                style={{ height: 22, width: 'auto', objectFit: 'contain', marginBottom: 40, alignSelf: 'flex-start' }}
            />

            {/* Heading */}
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.1 }}>
                <h1 style={{
                    fontFamily: 'var(--font-sans)',
                    fontSize: 26,
                    fontWeight: 600,
                    color: '#37352F',
                    letterSpacing: '-0.5px',
                    margin: '0 0 6px',
                    lineHeight: 1.2,
                }}>
                    Bem-vindo de volta
                </h1>
                <p style={{
                    fontFamily: 'var(--font-sans)',
                    fontSize: 14,
                    color: '#9B9A97',
                    margin: '0 0 28px',
                    lineHeight: 1.5,
                }}>
                    Entre com seus dados para acessar o painel.
                </p>
            </motion.div>

            {/* Form */}
            <motion.form
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, delay: 0.15 }}
                onSubmit={handleLogin}
                style={{ display: 'flex', flexDirection: 'column', gap: 16 }}
            >
                {error && (
                    <div style={{
                        padding: '10px 12px',
                        borderRadius: 6,
                        background: '#FFF0F0',
                        color: '#DC2626',
                        fontFamily: 'var(--font-sans)',
                        fontSize: 13,
                        border: '1px solid rgba(220,38,38,0.2)',
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
                    <button type="button" onClick={handleForgotPassword} disabled={resetState === 'sending'} style={{
                        background: 'none', border: 'none', cursor: resetState === 'sending' ? 'default' : 'pointer',
                        fontFamily: 'var(--font-sans)', fontSize: 13,
                        color: resetState === 'sent' ? '#22c55e' : '#9B9A97',
                        textDecoration: 'underline', textUnderlineOffset: 3, padding: 0,
                        opacity: resetState === 'sending' ? 0.6 : 1,
                        transition: 'color 0.15s, opacity 0.15s',
                    }}>
                        {resetState === 'sending' ? 'Enviando...' : resetState === 'sent' ? 'Email enviado!' : 'Esqueceu a senha?'}
                    </button>
                </div>

                <motion.button
                    type="submit"
                    disabled={loading}
                    whileHover={loading ? {} : { opacity: 0.9 }}
                    whileTap={loading ? {} : { scale: 0.985 }}
                    style={{
                        width: '100%',
                        padding: '11px',
                        background: loading ? 'rgba(0,0,0,0.08)' : '#FF5900',
                        color: '#FFFFFF',
                        border: 'none',
                        borderRadius: 6,
                        fontFamily: 'var(--font-sans)',
                        fontSize: 14,
                        fontWeight: 500,
                        cursor: loading ? 'default' : 'pointer',
                        marginTop: 4,
                        transition: 'background 0.15s',
                    }}
                >
                    {loading ? 'Entrando...' : 'Entrar'}
                </motion.button>
            </motion.form>

            {/* Footer */}
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3, delay: 0.25 }} style={{ marginTop: 28, textAlign: 'center' }}>
                <p style={{ fontFamily: 'var(--font-sans)', fontSize: 13, color: '#9B9A97', margin: 0 }}>
                    Não tem conta?{' '}
                    <button
                        onClick={onSwitchToSignup}
                        style={{
                            background: 'none', border: 'none', cursor: 'pointer',
                            fontFamily: 'var(--font-sans)', fontSize: 13,
                            color: '#FF5900', fontWeight: 500, padding: 0,
                        }}
                        onMouseEnter={e => (e.currentTarget.style.color = '#E64E00')}
                        onMouseLeave={e => (e.currentTarget.style.color = '#FF5900')}
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
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.25, ease: [0.25, 0.1, 0.25, 1] }}
            style={{
                flex: '0 0 45%',
                background: '#FFFFFF',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                padding: '48px 56px',
                overflowY: 'auto',
            }}
        >
            <motion.img
                src="/logo-northie.png"
                alt="Northie"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.4, delay: 0.05 }}
                style={{ height: 22, width: 'auto', objectFit: 'contain', marginBottom: 36, alignSelf: 'flex-start' }}
            />

            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.1 }}>
                <h1 style={{
                    fontFamily: 'var(--font-sans)',
                    fontSize: 26,
                    fontWeight: 600,
                    color: '#37352F',
                    letterSpacing: '-0.5px',
                    margin: '0 0 6px',
                    lineHeight: 1.2,
                }}>
                    Criar sua conta
                </h1>
                <p style={{
                    fontFamily: 'var(--font-sans)',
                    fontSize: 14,
                    color: '#9B9A97',
                    margin: '0 0 24px',
                    lineHeight: 1.5,
                }}>
                    Junte-se à Northie e transforme dados em decisões.
                </p>
            </motion.div>

            <motion.form
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, delay: 0.15 }}
                onSubmit={handleSignup}
                style={{ display: 'flex', flexDirection: 'column', gap: 14 }}
            >
                {error && (
                    <div style={{
                        padding: '10px 12px', borderRadius: 6,
                        background: '#FFF0F0', color: '#DC2626',
                        fontFamily: 'var(--font-sans)', fontSize: 13,
                        border: '1px solid rgba(220,38,38,0.2)',
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
                    fontFamily: 'var(--font-sans)', fontSize: 12,
                    color: '#9B9A97', margin: 0, lineHeight: 1.5,
                }}>
                    Mínimo 8 caracteres, incluindo um número e um caractere especial.
                </p>

                <motion.button
                    type="submit" disabled={loading}
                    whileHover={loading ? {} : { opacity: 0.9 }} whileTap={loading ? {} : { scale: 0.985 }}
                    style={{
                        width: '100%', padding: '11px',
                        background: loading ? 'rgba(0,0,0,0.08)' : '#FF5900',
                        color: '#FFFFFF', border: 'none', borderRadius: 6,
                        fontFamily: 'var(--font-sans)', fontSize: 14, fontWeight: 500,
                        cursor: loading ? 'default' : 'pointer', marginTop: 4,
                        transition: 'background 0.15s',
                    }}
                >
                    {loading ? 'Criando conta...' : 'Criar conta'}
                </motion.button>
            </motion.form>

            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3, delay: 0.25 }}
                style={{ marginTop: 24, textAlign: 'center' }}>
                <p style={{ fontFamily: 'var(--font-sans)', fontSize: 13, color: '#9B9A97', margin: 0 }}>
                    Já tem conta?{' '}
                    <button onClick={onSwitchToLogin} style={{
                        background: 'none', border: 'none', cursor: 'pointer',
                        fontFamily: 'var(--font-sans)', fontSize: 13,
                        color: '#FF5900', fontWeight: 500, padding: 0,
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
