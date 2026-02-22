import { useState } from 'react'
import { motion } from 'framer-motion'

function EyeIcon({ open }: { open: boolean }) {
    if (open) return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
            <circle cx="12" cy="12" r="3" />
        </svg>
    )
    return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
            <line x1="1" y1="1" x2="23" y2="23" />
        </svg>
    )
}

export default function Login({ onLogin }: { onLogin: () => void }) {
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [showPassword, setShowPassword] = useState(false)
    const [emailFocus, setEmailFocus] = useState(false)
    const [passFocus, setPassFocus] = useState(false)

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        onLogin()
    }

    const inputBase: React.CSSProperties = {
        width: '100%',
        padding: '14px 16px',
        background: 'rgba(255,255,255,0.05)',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: 8,
        color: '#FFF',
        fontFamily: "'Poppins', sans-serif",
        fontSize: 14,
        outline: 'none',
        boxSizing: 'border-box',
        transition: 'border-color 0.2s ease, background 0.2s ease',
    }

    const inputFocus: React.CSSProperties = {
        ...inputBase,
        border: '1px solid rgba(255,255,255,0.35)',
        background: 'rgba(255,255,255,0.08)',
    }

    const labelStyle: React.CSSProperties = {
        display: 'block',
        fontFamily: "'Geist Mono', monospace",
        fontSize: 10,
        color: 'rgba(255,255,255,0.35)',
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        marginBottom: 8,
    }

    return (
        <div style={{ display: 'flex', width: '100vw', height: '100vh', overflow: 'hidden' }}>

            {/* ── Left Panel — Imagem ───────────────────────────────────── */}
            <div style={{
                flex: '0 0 55%',
                position: 'relative',
                background: '#F7F3F0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
            }}>
                {/* Grain texture overlay */}
                <div style={{
                    position: 'absolute', inset: 0,
                    backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 256 256\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'noise\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.9\' numOctaves=\'4\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23noise)\' opacity=\'0.035\'/%3E%3C/svg%3E")',
                    backgroundRepeat: 'repeat',
                    backgroundSize: '200px',
                    pointerEvents: 'none',
                    zIndex: 1,
                }} />

                {/* Compass image */}
                <motion.img
                    src="/bussola-northie.png"
                    alt="Bússola Northie"
                    initial={{ opacity: 0, scale: 0.96, y: 12 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    transition={{ duration: 1.1, ease: [0.25, 0.1, 0.25, 1] }}
                    style={{
                        width: '78%',
                        height: '78%',
                        objectFit: 'contain',
                        position: 'relative',
                        zIndex: 2,
                        mixBlendMode: 'multiply',
                    }}
                />

                {/* Bottom gradient */}
                <div style={{
                    position: 'absolute', bottom: 0, left: 0, right: 0,
                    height: '45%',
                    background: 'linear-gradient(to bottom, transparent, rgba(20,16,14,0.82))',
                    zIndex: 3,
                }} />

                {/* Bottom text */}
                <div style={{ position: 'absolute', bottom: 52, left: 60, right: 60, zIndex: 4 }}>
                    <motion.p
                        initial={{ opacity: 0, y: 14 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6, delay: 0.5, ease: [0.25, 0.1, 0.25, 1] }}
                        style={{
                            fontFamily: "'Poppins', sans-serif",
                            fontSize: 22,
                            fontWeight: 400,
                            color: '#FFF',
                            letterSpacing: '-0.5px',
                            lineHeight: 1.45,
                            margin: '0 0 14px',
                        }}
                    >
                        Dados que revelam,<br />decisões que constroem.
                    </motion.p>
                    <motion.p
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.5, delay: 0.75 }}
                        style={{
                            fontFamily: "'Geist Mono', monospace",
                            fontSize: 10,
                            color: 'rgba(255,255,255,0.4)',
                            letterSpacing: '0.1em',
                            margin: 0,
                            textTransform: 'uppercase',
                        }}
                    >
                        Northie — Sua central de inteligência
                    </motion.p>
                </div>
            </div>

            {/* ── Right Panel — Formulário ──────────────────────────────── */}
            <div style={{
                flex: '0 0 45%',
                background: '#1A1A1A',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                padding: '72px 80px',
                position: 'relative',
                overflowY: 'auto',
            }}>
                {/* Logo */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.4 }}
                    style={{
                        fontFamily: "'Lora', serif",
                        fontSize: 20,
                        color: 'rgba(255,255,255,0.85)',
                        marginBottom: 72,
                        letterSpacing: '-0.2px',
                    }}
                >
                    Northie
                </motion.div>

                {/* Heading */}
                <motion.div
                    initial={{ opacity: 0, y: 14 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.1, ease: [0.25, 0.1, 0.25, 1] }}
                >
                    <h1 style={{
                        fontFamily: "'Poppins', sans-serif",
                        fontSize: 34,
                        fontWeight: 400,
                        color: '#FFF',
                        letterSpacing: '-1.3px',
                        margin: '0 0 10px',
                        lineHeight: 1.1,
                    }}>
                        Bem-vindo de volta
                    </h1>
                    <p style={{
                        fontFamily: "'Poppins', sans-serif",
                        fontSize: 15,
                        color: 'rgba(255,255,255,0.35)',
                        margin: '0 0 48px',
                        lineHeight: 1.55,
                    }}>
                        Entre com seus dados para acessar o painel.
                    </p>
                </motion.div>

                {/* Form */}
                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                    {/* Email */}
                    <motion.div
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.4, delay: 0.2 }}
                    >
                        <label style={labelStyle}>Email *</label>
                        <input
                            type="email"
                            value={email}
                            onChange={e => setEmail(e.target.value)}
                            onFocus={() => setEmailFocus(true)}
                            onBlur={() => setEmailFocus(false)}
                            placeholder="ex: voce@empresa.com"
                            style={emailFocus ? inputFocus : inputBase}
                        />
                    </motion.div>

                    {/* Password */}
                    <motion.div
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.4, delay: 0.25 }}
                    >
                        <label style={labelStyle}>Senha *</label>
                        <div style={{ position: 'relative' }}>
                            <input
                                type={showPassword ? 'text' : 'password'}
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                onFocus={() => setPassFocus(true)}
                                onBlur={() => setPassFocus(false)}
                                placeholder="••••••••"
                                style={{ ...(passFocus ? inputFocus : inputBase), paddingRight: 44 }}
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                style={{
                                    position: 'absolute', right: 14, top: '50%',
                                    transform: 'translateY(-50%)',
                                    background: 'none', border: 'none', cursor: 'pointer',
                                    color: 'rgba(255,255,255,0.25)', padding: 0, display: 'flex',
                                    transition: 'color 0.2s',
                                }}
                                onMouseEnter={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.6)')}
                                onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.25)')}
                            >
                                <EyeIcon open={showPassword} />
                            </button>
                        </div>
                    </motion.div>

                    {/* Forgot password */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.3, delay: 0.3 }}
                        style={{ textAlign: 'right', marginTop: -8 }}
                    >
                        <button
                            type="button"
                            style={{
                                background: 'none', border: 'none', cursor: 'pointer',
                                fontFamily: "'Poppins', sans-serif", fontSize: 13,
                                color: 'rgba(255,255,255,0.3)',
                                textDecoration: 'underline', textUnderlineOffset: 3,
                                padding: 0,
                            }}
                        >
                            Esqueceu a senha?
                        </button>
                    </motion.div>

                    {/* CTA */}
                    <motion.button
                        type="submit"
                        whileHover={{ opacity: 0.88 }}
                        whileTap={{ scale: 0.985 }}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.4, delay: 0.35 }}
                        style={{
                            width: '100%',
                            padding: '16px',
                            background: '#FCF8F8',
                            color: '#1A1A1A',
                            border: 'none',
                            borderRadius: 8,
                            fontFamily: "'Poppins', sans-serif",
                            fontSize: 15,
                            fontWeight: 500,
                            cursor: 'pointer',
                            marginTop: 8,
                            letterSpacing: '-0.1px',
                        }}
                    >
                        Entrar
                    </motion.button>
                </form>

                {/* Footer links */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.4, delay: 0.5 }}
                    style={{ marginTop: 40, textAlign: 'center' }}
                >
                    <p style={{
                        fontFamily: "'Poppins', sans-serif",
                        fontSize: 13,
                        color: 'rgba(255,255,255,0.25)',
                        margin: 0,
                    }}>
                        Não tem conta?{' '}
                        <button style={{
                            background: 'none', border: 'none', cursor: 'pointer',
                            fontFamily: "'Poppins', sans-serif", fontSize: 13,
                            color: 'rgba(255,255,255,0.55)', fontWeight: 600, padding: 0,
                        }}>
                            Fale com a gente
                        </button>
                    </p>

                    <p style={{
                        fontFamily: "'Poppins', sans-serif",
                        fontSize: 11,
                        color: 'rgba(255,255,255,0.13)',
                        margin: '32px 0 0',
                        lineHeight: 1.6,
                    }}>
                        Ao entrar, você concorda com nossos{' '}
                        <span style={{ textDecoration: 'underline', cursor: 'pointer', textUnderlineOffset: 2 }}>Termos de Uso</span>
                        {' '}e{' '}
                        <span style={{ textDecoration: 'underline', cursor: 'pointer', textUnderlineOffset: 2 }}>Política de Privacidade</span>.
                    </p>
                </motion.div>
            </div>
        </div>
    )
}
