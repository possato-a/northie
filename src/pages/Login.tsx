import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

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

// ── Shared styles ─────────────────────────────────────────────────────────────

const labelStyle: React.CSSProperties = {
    display: 'block',
    fontFamily: "'Geist Mono', monospace",
    fontSize: 10,
    color: 'rgba(255,255,255,0.32)',
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    marginBottom: 7,
}

function getInputStyle(focused: boolean): React.CSSProperties {
    return {
        width: '100%',
        padding: '12px 16px',
        background: focused ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.05)',
        border: focused ? '1px solid rgba(255,255,255,0.3)' : '1px solid rgba(255,255,255,0.08)',
        borderRadius: 7,
        color: '#FFF',
        fontFamily: "'Poppins', sans-serif",
        fontSize: 14,
        outline: 'none',
        boxSizing: 'border-box' as const,
        transition: 'border-color 0.2s, background 0.2s',
    }
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
                style={{ ...getInputStyle(focused), paddingRight: 42 }}
            />
            <button
                type="button"
                onClick={() => setShow(v => !v)}
                style={{
                    position: 'absolute', right: 13, top: '50%', transform: 'translateY(-50%)',
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: 'rgba(255,255,255,0.22)', padding: 0, display: 'flex',
                    transition: 'color 0.15s',
                }}
                onMouseEnter={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.55)')}
                onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.22)')}
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
            background: '#F2EEE9',
            overflow: 'hidden',
            border: '1px solid rgba(20,16,14,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
        }}>
            {/* Bússola — ocupa o painel inteiro com espaço para o glass */}
            <motion.img
                src="/bussola-northie.png"
                alt="Bússola Northie"
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 1.3, ease: [0.25, 0.1, 0.25, 1] }}
                style={{
                    width: '90%',
                    height: 'calc(100% - 180px)',
                    objectFit: 'contain',
                    mixBlendMode: 'multiply',
                    display: 'block',
                    marginTop: '-40px',
                    zIndex: 1,
                }}
            />

            {/* Glass card — tagline */}
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
                    background: 'rgba(248, 244, 240, 0.58)',
                    backdropFilter: 'blur(22px) saturate(1.6)',
                    WebkitBackdropFilter: 'blur(22px) saturate(1.6)',
                    border: '1px solid rgba(255, 255, 255, 0.72)',
                    borderRadius: 14,
                    padding: '20px 26px',
                    boxShadow: '0 2px 24px rgba(0,0,0,0.05)',
                }}
            >
                <p style={{
                    fontFamily: "'Poppins', sans-serif",
                    fontSize: 17,
                    fontWeight: 400,
                    color: 'rgba(28,24,22,0.82)',
                    letterSpacing: '-0.3px',
                    lineHeight: 1.5,
                    margin: '0 0 10px',
                }}>
                    Dados que revelam,<br />decisões que constroem.
                </p>
                <p style={{
                    fontFamily: "'Geist Mono', monospace",
                    fontSize: 10,
                    color: 'rgba(28,24,22,0.38)',
                    letterSpacing: '0.1em',
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

    const panelStyle: React.CSSProperties = {
        flex: '0 0 45%',
        background: '#161616',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        padding: '52px 60px',
        overflowY: 'auto',
    }

    return (
        <motion.div
            key="login"
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -24 }}
            transition={{ duration: 0.28, ease: [0.25, 0.1, 0.25, 1] }}
            style={panelStyle}
        >
            {/* Logo */}
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.5, delay: 0.05 }}
                style={{ fontFamily: "'Lora', serif", fontSize: 18, color: 'rgba(255,255,255,0.78)', marginBottom: 52 }}
            >
                Northie
            </motion.div>

            {/* Heading */}
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, delay: 0.1 }}>
                <h1 style={{ fontFamily: "'Poppins', sans-serif", fontSize: 30, fontWeight: 400, color: '#FFF', letterSpacing: '-1.1px', margin: '0 0 8px', lineHeight: 1.1 }}>
                    Bem-vindo de volta
                </h1>
                <p style={{ fontFamily: "'Poppins', sans-serif", fontSize: 14, color: 'rgba(255,255,255,0.32)', margin: '0 0 40px', lineHeight: 1.6 }}>
                    Entre com seus dados para acessar o painel.
                </p>
            </motion.div>

            {/* Form */}
            <motion.form
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.18 }}
                onSubmit={e => { e.preventDefault(); onLogin() }}
                style={{ display: 'flex', flexDirection: 'column', gap: 16 }}
            >
                <div>
                    <label style={labelStyle}>Email *</label>
                    <input
                        type="email"
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        onFocus={() => setFocused('email')}
                        onBlur={() => setFocused(null)}
                        placeholder="ex: voce@empresa.com"
                        style={getInputStyle(focused === 'email')}
                    />
                </div>

                <div>
                    <label style={labelStyle}>Senha *</label>
                    <PasswordInput
                        value={password}
                        onChange={setPassword}
                        focused={focused === 'password'}
                        onFocus={() => setFocused('password')}
                        onBlur={() => setFocused(null)}
                    />
                </div>

                <div style={{ textAlign: 'right', marginTop: -4 }}>
                    <button type="button" style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: "'Poppins', sans-serif", fontSize: 12, color: 'rgba(255,255,255,0.25)', textDecoration: 'underline', textUnderlineOffset: 3, padding: 0 }}>
                        Esqueceu a senha?
                    </button>
                </div>

                <motion.button
                    type="submit"
                    whileHover={{ opacity: 0.88 }}
                    whileTap={{ scale: 0.982 }}
                    style={{ width: '100%', padding: '14px', background: '#F5F1EE', color: '#161616', border: 'none', borderRadius: 8, fontFamily: "'Poppins', sans-serif", fontSize: 14, fontWeight: 500, cursor: 'pointer', marginTop: 6, letterSpacing: '-0.1px' }}
                >
                    Entrar
                </motion.button>
            </motion.form>

            {/* Footer */}
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4, delay: 0.3 }} style={{ marginTop: 36, textAlign: 'center' }}>
                <p style={{ fontFamily: "'Poppins', sans-serif", fontSize: 13, color: 'rgba(255,255,255,0.2)', margin: 0 }}>
                    Não tem conta?{' '}
                    <button
                        onClick={onSwitchToSignup}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: "'Poppins', sans-serif", fontSize: 13, color: 'rgba(255,255,255,0.5)', fontWeight: 600, padding: 0, transition: 'color 0.15s' }}
                        onMouseEnter={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.75)')}
                        onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.5)')}
                    >
                        Criar conta
                    </button>
                </p>
                <p style={{ fontFamily: "'Poppins', sans-serif", fontSize: 11, color: 'rgba(255,255,255,0.11)', margin: '28px 0 0', lineHeight: 1.65 }}>
                    Ao entrar, você concorda com nossos{' '}
                    <span style={{ textDecoration: 'underline', cursor: 'pointer', textUnderlineOffset: 2 }}>Termos de Uso</span>
                    {' '}e{' '}
                    <span style={{ textDecoration: 'underline', cursor: 'pointer', textUnderlineOffset: 2 }}>Política de Privacidade</span>.
                </p>
            </motion.div>
        </motion.div>
    )
}

// ── Signup Form ───────────────────────────────────────────────────────────────

function SignupForm({ onSwitchToLogin }: { onSwitchToLogin: () => void }) {
    const [name, setName] = useState('')
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [confirm, setConfirm] = useState('')
    const [focused, setFocused] = useState<string | null>(null)

    const panelStyle: React.CSSProperties = {
        flex: '0 0 45%',
        background: '#161616',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        padding: '52px 60px',
        overflowY: 'auto',
    }

    return (
        <motion.div
            key="signup"
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -24 }}
            transition={{ duration: 0.28, ease: [0.25, 0.1, 0.25, 1] }}
            style={panelStyle}
        >
            {/* Logo */}
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.5, delay: 0.05 }}
                style={{ fontFamily: "'Lora', serif", fontSize: 18, color: 'rgba(255,255,255,0.78)', marginBottom: 44 }}
            >
                Northie
            </motion.div>

            {/* Heading */}
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, delay: 0.1 }}>
                <h1 style={{ fontFamily: "'Poppins', sans-serif", fontSize: 30, fontWeight: 400, color: '#FFF', letterSpacing: '-1.1px', margin: '0 0 8px', lineHeight: 1.1 }}>
                    Criar sua conta
                </h1>
                <p style={{ fontFamily: "'Poppins', sans-serif", fontSize: 14, color: 'rgba(255,255,255,0.32)', margin: '0 0 32px', lineHeight: 1.6 }}>
                    Junte-se à Northie e transforme dados em decisões.
                </p>
            </motion.div>

            {/* Form */}
            <motion.form
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.18 }}
                onSubmit={e => e.preventDefault()}
                style={{ display: 'flex', flexDirection: 'column', gap: 14 }}
            >
                {/* Nome */}
                <div>
                    <label style={labelStyle}>Nome completo *</label>
                    <input
                        type="text"
                        value={name}
                        onChange={e => setName(e.target.value)}
                        onFocus={() => setFocused('name')}
                        onBlur={() => setFocused(null)}
                        placeholder="Ex: Lucas Montano"
                        style={getInputStyle(focused === 'name')}
                    />
                </div>

                {/* Email */}
                <div>
                    <label style={labelStyle}>Email *</label>
                    <input
                        type="email"
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        onFocus={() => setFocused('email')}
                        onBlur={() => setFocused(null)}
                        placeholder="ex: voce@empresa.com"
                        style={getInputStyle(focused === 'email')}
                    />
                </div>

                {/* Senha + Confirmar — lado a lado, como na referência */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div>
                        <label style={labelStyle}>Senha *</label>
                        <PasswordInput
                            value={password}
                            onChange={setPassword}
                            focused={focused === 'password'}
                            onFocus={() => setFocused('password')}
                            onBlur={() => setFocused(null)}
                        />
                    </div>
                    <div>
                        <label style={labelStyle}>Confirmar *</label>
                        <PasswordInput
                            value={confirm}
                            onChange={setConfirm}
                            focused={focused === 'confirm'}
                            onFocus={() => setFocused('confirm')}
                            onBlur={() => setFocused(null)}
                        />
                    </div>
                </div>

                {/* Helper text — igual à referência */}
                <p style={{ fontFamily: "'Geist Mono', monospace", fontSize: 10, color: 'rgba(255,255,255,0.18)', margin: '0', lineHeight: 1.6 }}>
                    Mínimo 8 caracteres, incluindo um número e um caractere especial.
                </p>

                <motion.button
                    type="submit"
                    whileHover={{ opacity: 0.88 }}
                    whileTap={{ scale: 0.982 }}
                    style={{ width: '100%', padding: '14px', background: '#F5F1EE', color: '#161616', border: 'none', borderRadius: 8, fontFamily: "'Poppins', sans-serif", fontSize: 14, fontWeight: 500, cursor: 'pointer', marginTop: 8, letterSpacing: '-0.1px' }}
                >
                    Criar conta
                </motion.button>
            </motion.form>

            {/* Footer */}
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4, delay: 0.3 }} style={{ marginTop: 32, textAlign: 'center' }}>
                <p style={{ fontFamily: "'Poppins', sans-serif", fontSize: 13, color: 'rgba(255,255,255,0.2)', margin: 0 }}>
                    Já tem conta?{' '}
                    <button
                        onClick={onSwitchToLogin}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: "'Poppins', sans-serif", fontSize: 13, color: 'rgba(255,255,255,0.5)', fontWeight: 600, padding: 0, transition: 'color 0.15s' }}
                        onMouseEnter={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.75)')}
                        onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.5)')}
                    >
                        Entrar
                    </button>
                </p>
                <p style={{ fontFamily: "'Poppins', sans-serif", fontSize: 11, color: 'rgba(255,255,255,0.11)', margin: '24px 0 0', lineHeight: 1.65 }}>
                    Ao criar sua conta, você concorda com nossos{' '}
                    <span style={{ textDecoration: 'underline', cursor: 'pointer', textUnderlineOffset: 2 }}>Termos de Uso</span>
                    {' '}e{' '}
                    <span style={{ textDecoration: 'underline', cursor: 'pointer', textUnderlineOffset: 2 }}>Política de Privacidade</span>.
                </p>
            </motion.div>
        </motion.div>
    )
}

// ── Main Export ───────────────────────────────────────────────────────────────

export default function Login({ onLogin }: { onLogin: () => void }) {
    const [view, setView] = useState<AuthView>('login')

    return (
        <div style={{
            width: '100vw',
            height: '100vh',
            display: 'flex',
            overflow: 'hidden',
        }}>
            <ImagePanel />

            <AnimatePresence mode="wait">
                {view === 'login' ? (
                    <LoginForm
                        key="login"
                        onLogin={onLogin}
                        onSwitchToSignup={() => setView('signup')}
                    />
                ) : (
                    <SignupForm
                        key="signup"
                        onSwitchToLogin={() => setView('login')}
                    />
                )}
            </AnimatePresence>
        </div>
    )
}
