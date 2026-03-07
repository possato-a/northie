/**
 * @file ui/shared.tsx
 * Componentes primitivos reutilizáveis para toda a plataforma Northie.
 * Seguem o design system Notion + identidade visual Northie.
 */

import { useState } from 'react'
import { motion } from 'framer-motion'

// ── Page Header ───────────────────────────────────────────────────────────────

interface PageHeaderProps {
    title: string
    subtitle?: string
    actions?: React.ReactNode
    breadcrumb?: { label: string; onClick: () => void }
    delay?: number
}

export function PageHeader({ title, subtitle, actions, breadcrumb, delay = 0 }: PageHeaderProps) {
    return (
        <div style={{ marginBottom: 0 }}>
            {breadcrumb && (
                <motion.button
                    onClick={breadcrumb.onClick}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    whileHover={{ x: -2 }}
                    style={{
                        display: 'flex', alignItems: 'center', gap: 6,
                        background: 'none', border: 'none', cursor: 'pointer',
                        fontFamily: 'var(--font-sans)',
                        fontSize: 'var(--text-sm)',
                        color: 'var(--color-text-secondary)',
                        padding: 0, marginBottom: 16,
                        transition: 'color var(--transition-base)',
                    }}
                    onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.color = 'var(--color-text-primary)'}
                    onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.color = 'var(--color-text-secondary)'}
                >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" />
                    </svg>
                    {breadcrumb.label}
                </motion.button>
            )}
            <div style={{ display: 'flex', alignItems: subtitle ? 'flex-start' : 'center', justifyContent: 'space-between', gap: 24 }}>
                <div>
                    <motion.h1
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.45, delay, ease: [0.25, 0.1, 0.25, 1] }}
                        style={{
                            fontFamily: 'var(--font-sans)',
                            fontWeight: 500,
                            fontSize: 40,
                            letterSpacing: '-1.6px',
                            color: 'var(--fg)',
                            lineHeight: 1,
                            margin: 0,
                        }}
                    >
                        {title}
                    </motion.h1>
                    {subtitle && (
                        <motion.p
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ duration: 0.4, delay: delay + 0.1 }}
                            style={{
                                fontFamily: 'var(--font-sans)',
                                fontSize: 'var(--text-base)',
                                color: 'var(--color-text-secondary)',
                                margin: '8px 0 0',
                                letterSpacing: '-0.1px',
                            }}
                        >
                            {subtitle}
                        </motion.p>
                    )}
                </div>
                {actions && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: delay + 0.15 }}
                        style={{ flexShrink: 0 }}
                    >
                        {actions}
                    </motion.div>
                )}
            </div>
        </div>
    )
}

// ── Section Label ─────────────────────────────────────────────────────────────

export function SectionLabel({ children, gutterBottom = 20 }: { children: React.ReactNode; gutterBottom?: number }) {
    return (
        <p style={{
            fontFamily: 'var(--font-sans)',
            fontSize: 'var(--text-sm)',
            fontWeight: 500,
            color: 'var(--color-text-secondary)',
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
            marginBottom: gutterBottom,
            marginTop: 0,
        }}>
            {children}
        </p>
    )
}

// ── Table Header Cell ─────────────────────────────────────────────────────────

export function TH({ children, align = 'left' }: { children: React.ReactNode; align?: 'left' | 'right' | 'center' }) {
    return (
        <span style={{
            fontFamily: 'var(--font-sans)',
            fontSize: 'var(--text-xs)',
            fontWeight: 500,
            color: 'var(--color-text-tertiary)',
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
            textAlign: align,
            display: 'block',
        }}>
            {children}
        </span>
    )
}

// ── Divider ───────────────────────────────────────────────────────────────────

export function Divider({ margin = '40px 0' }: { margin?: string }) {
    return <div style={{ height: 1, background: 'var(--color-border)', margin }} />
}

// ── Button variants ───────────────────────────────────────────────────────────

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'
type ButtonSize = 'sm' | 'md' | 'lg'

interface ButtonProps {
    children: React.ReactNode
    onClick?: () => void
    variant?: ButtonVariant
    size?: ButtonSize
    disabled?: boolean
    type?: 'button' | 'submit' | 'reset'
    fullWidth?: boolean
    icon?: React.ReactNode
    style?: React.CSSProperties
}

const BUTTON_STYLES: Record<ButtonVariant, React.CSSProperties> = {
    primary: {
        background: 'var(--color-primary-dark)',
        color: 'var(--color-primary-fg)',
        border: '1px solid var(--color-primary-border)',
    },
    secondary: {
        background: 'var(--color-bg-tertiary)',
        color: 'var(--color-text-primary)',
        border: '1px solid #363636',
    },
    ghost: {
        background: 'transparent',
        color: 'var(--color-text-secondary)',
        border: 'none',
    },
    danger: {
        background: 'transparent',
        color: 'var(--priority-high)',
        border: '1px solid var(--priority-high)',
    },
}

const BUTTON_HOVER: Record<ButtonVariant, React.CSSProperties> = {
    primary: { background: '#007A47', borderColor: 'rgba(62, 207, 142, 0.45)' },
    secondary: { background: '#2A2A2A', borderColor: '#444444' },
    ghost: { background: 'var(--color-bg-secondary)', color: 'var(--color-text-primary)' },
    danger: { background: 'var(--priority-high-bg)' },
}

const BUTTON_SIZE: Record<ButtonSize, React.CSSProperties> = {
    sm: { padding: '5px 10px', fontSize: 'var(--text-sm)', borderRadius: 'var(--radius-md)' },
    md: { padding: '7px 14px', fontSize: 'var(--text-base)', borderRadius: 'var(--radius-md)' },
    lg: { padding: '10px 20px', fontSize: 'var(--text-md)', borderRadius: 'var(--radius-md)' },
}

export function Btn({ children, onClick, variant = 'secondary', size = 'md', disabled = false, type = 'button', fullWidth = false, icon, style }: ButtonProps) {
    const [hovered, setHovered] = useState(false)

    return (
        <motion.button
            type={type}
            onClick={onClick}
            disabled={disabled}
            whileTap={disabled ? undefined : { scale: 0.97 }}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                fontFamily: 'var(--font-sans)',
                fontWeight: 500,
                cursor: disabled ? 'not-allowed' : 'pointer',
                opacity: disabled ? 0.5 : 1,
                transition: 'background var(--transition-base), color var(--transition-base), border-color var(--transition-base)',
                whiteSpace: 'nowrap',
                width: fullWidth ? '100%' : undefined,
                letterSpacing: '-0.1px',
                ...BUTTON_STYLES[variant],
                ...BUTTON_SIZE[size],
                ...(hovered && !disabled ? BUTTON_HOVER[variant] : {}),
                ...style,
            }}
        >
            {icon && <span style={{ display: 'flex', flexShrink: 0 }}>{icon}</span>}
            {children}
        </motion.button>
    )
}

// ── Modal ─────────────────────────────────────────────────────────────────────

interface ModalProps {
    children: React.ReactNode
    onClose: () => void
    maxWidth?: number
    title?: string
    subtitle?: string
}

export function Modal({ children, onClose, maxWidth = 520, title, subtitle }: ModalProps) {
    return (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={onClose}
                style={{ position: 'absolute', inset: 0, background: 'rgba(var(--fg-rgb), 0.3)', backdropFilter: 'blur(6px)' }}
            />
            <motion.div
                initial={{ opacity: 0, y: 24, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 12, scale: 0.97 }}
                transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                style={{
                    width: '100%',
                    maxWidth,
                    background: 'var(--color-bg-primary)',
                    border: '1px solid var(--color-border)',
                    borderRadius: 'var(--radius-xl)',
                    padding: '32px',
                    position: 'relative',
                    zIndex: 1001,
                    boxShadow: 'var(--shadow-xl)',
                    maxHeight: '90vh',
                    overflowY: 'auto',
                }}
            >
                {/* Close button */}
                <button
                    onClick={onClose}
                    style={{
                        position: 'absolute', top: 16, right: 16,
                        width: 28, height: 28, borderRadius: 'var(--radius-md)',
                        background: 'transparent', border: 'none', cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: 'var(--color-text-tertiary)',
                        transition: 'background var(--transition-base), color var(--transition-base)',
                    }}
                    onMouseEnter={e => {
                        (e.currentTarget as HTMLButtonElement).style.background = 'var(--color-bg-tertiary)'
                            ; (e.currentTarget as HTMLButtonElement).style.color = 'var(--color-text-primary)'
                    }}
                    onMouseLeave={e => {
                        (e.currentTarget as HTMLButtonElement).style.background = 'transparent'
                            ; (e.currentTarget as HTMLButtonElement).style.color = 'var(--color-text-tertiary)'
                    }}
                >
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                        <path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                    </svg>
                </button>

                {(title || subtitle) && (
                    <div style={{ marginBottom: 24 }}>
                        {title && (
                            <h2 style={{
                                fontFamily: 'var(--font-sans)',
                                fontWeight: 500,
                                fontSize: 'var(--text-xl)',
                                letterSpacing: '-0.5px',
                                color: 'var(--color-text-primary)',
                                margin: '0 0 6px',
                            }}>{title}</h2>
                        )}
                        {subtitle && (
                            <p style={{
                                fontFamily: 'var(--font-sans)',
                                fontSize: 'var(--text-sm)',
                                color: 'var(--color-text-secondary)',
                                margin: 0,
                                lineHeight: 1.5,
                            }}>{subtitle}</p>
                        )}
                        <Divider margin="16px 0 0" />
                    </div>
                )}
                {children}
            </motion.div>
        </div>
    )
}

// ── Form Field ────────────────────────────────────────────────────────────────

interface FieldProps {
    label: string
    children: React.ReactNode
    hint?: string
}

export function Field({ label, children, hint }: FieldProps) {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{
                fontFamily: 'var(--font-sans)',
                fontSize: 'var(--text-xs)',
                fontWeight: 500,
                color: 'var(--color-text-secondary)',
                letterSpacing: '0.03em',
                textTransform: 'uppercase',
            }}>
                {label}
            </label>
            {children}
            {hint && (
                <span style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)' }}>
                    {hint}
                </span>
            )}
        </div>
    )
}

// ── Input ─────────────────────────────────────────────────────────────────────

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
    label?: string
    icon?: React.ReactNode
}

export function Input({ label, icon, className: _c, style, ...rest }: InputProps) {
    const [focused, setFocused] = useState(false)

    const el = (
        <div style={{ position: 'relative', width: '100%' }}>
            {icon && (
                <span style={{
                    position: 'absolute',
                    left: 12,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    display: 'flex',
                    alignItems: 'center',
                    color: 'var(--color-text-tertiary)',
                    pointerEvents: 'none',
                    zIndex: 1,
                }}>
                    {icon}
                </span>
            )}
            <input
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
                style={{
                    padding: '8px 12px',
                    paddingLeft: icon ? 36 : 12,
                    background: 'var(--color-bg-secondary)',
                    border: `1px solid ${focused ? 'var(--color-primary)' : 'var(--color-border)'}`,
                    borderRadius: 'var(--radius-md)',
                    color: 'var(--color-text-primary)',
                    fontFamily: 'var(--font-sans)',
                    fontSize: 'var(--text-base)',
                    outline: 'none',
                    width: '100%',
                    boxShadow: focused ? '0 0 0 2px var(--color-primary-light)' : 'none',
                    transition: 'border-color var(--transition-base), box-shadow var(--transition-base)',
                    ...style,
                }}
                {...rest}
            />
        </div>
    )

    if (!label) return el
    return <Field label={label}>{el}</Field>
}

// ── Textarea ──────────────────────────────────────────────────────────────────

export function Textarea({ label, style, ...rest }: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { label?: string }) {
    const [focused, setFocused] = useState(false)

    const el = (
        <textarea
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            style={{
                padding: '8px 12px',
                background: 'var(--color-bg-secondary)',
                border: `1px solid ${focused ? 'var(--color-primary)' : 'var(--color-border)'}`,
                borderRadius: 'var(--radius-md)',
                color: 'var(--color-text-primary)',
                fontFamily: 'var(--font-sans)',
                fontSize: 'var(--text-base)',
                outline: 'none',
                width: '100%',
                resize: 'vertical',
                minHeight: 90,
                boxShadow: focused ? '0 0 0 2px var(--color-primary-light)' : 'none',
                transition: 'border-color var(--transition-base), box-shadow var(--transition-base)',
                ...style,
            }}
            {...rest}
        />
    )

    if (!label) return el
    return <Field label={label}>{el}</Field>
}

// ── Select Field ──────────────────────────────────────────────────────────────

export function SelectField({ label, style, children, ...rest }: React.SelectHTMLAttributes<HTMLSelectElement> & { label?: string }) {
    const [focused, setFocused] = useState(false)

    const el = (
        <select
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            style={{
                padding: '8px 12px',
                background: 'var(--color-bg-secondary)',
                border: `1px solid ${focused ? 'var(--color-primary)' : 'var(--color-border)'}`,
                borderRadius: 'var(--radius-md)',
                color: 'var(--color-text-primary)',
                fontFamily: 'var(--font-sans)',
                fontSize: 'var(--text-base)',
                outline: 'none',
                width: '100%',
                boxShadow: focused ? '0 0 0 2px var(--color-primary-light)' : 'none',
                transition: 'border-color var(--transition-base)',
                cursor: 'pointer',
                ...style,
            }}
            {...rest}
        >
            {children}
        </select>
    )

    if (!label) return el
    return <Field label={label}>{el}</Field>
}

// ── Empty State ───────────────────────────────────────────────────────────────

export function EmptyState({ title, description, action, icon }: { title: string; description?: string; action?: React.ReactNode; icon?: React.ReactNode }) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: [0.25, 0.1, 0.25, 1] }}
            style={{
                textAlign: 'center',
                padding: '56px 32px',
                color: 'var(--color-text-tertiary)',
                borderRadius: 'var(--radius-xl)',
                background: 'var(--color-bg-secondary)',
                border: '1px dashed var(--color-border)',
            }}
        >
            <div style={{
                width: 48, height: 48,
                borderRadius: 'var(--radius-lg)',
                background: 'var(--color-bg-tertiary)',
                border: '1px solid var(--color-border)',
                margin: '0 auto 20px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'var(--color-text-tertiary)',
            }}>
                {icon || (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.5 }}>
                        <rect x="3" y="3" width="18" height="18" rx="2" />
                        <line x1="9" y1="9" x2="15" y2="9" />
                        <line x1="9" y1="13" x2="13" y2="13" />
                    </svg>
                )}
            </div>
            <p style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-base)', fontWeight: 500, color: 'var(--color-text-secondary)', margin: '0 0 6px', letterSpacing: '-0.2px' }}>{title}</p>
            {description && (
                <p style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', color: 'var(--color-text-tertiary)', margin: '0 0 20px', maxWidth: 340, marginLeft: 'auto', marginRight: 'auto', lineHeight: 1.5 }}>{description}</p>
            )}
            {action}
        </motion.div>
    )
}

// ── Tab Bar ───────────────────────────────────────────────────────────────────

interface TabBarProps {
    tabs: string[]
    active: string
    onChange: (tab: string) => void
}

export function TabBar({ tabs, active, onChange }: TabBarProps) {
    return (
        <div style={{ display: 'flex', gap: 2, borderBottom: '1px solid var(--color-border)', marginBottom: 0 }}>
            {tabs.map(tab => (
                <button
                    key={tab}
                    onClick={() => onChange(tab)}
                    style={{
                        padding: '8px 14px',
                        fontFamily: 'var(--font-sans)',
                        fontSize: 'var(--text-sm)',
                        fontWeight: active === tab ? 500 : 400,
                        color: active === tab ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
                        background: 'none', border: 'none', cursor: 'pointer',
                        borderBottom: `2px solid ${active === tab ? 'var(--color-primary)' : 'transparent'}`,
                        marginBottom: -1,
                        transition: 'color var(--transition-base), border-color var(--transition-base)',
                    }}
                >
                    {tab}
                </button>
            ))}
        </div>
    )
}

// ── Avatar ────────────────────────────────────────────────────────────────────

export function Avatar({ name, size = 28 }: { name: string; size?: number }) {
    return (
        <div style={{
            width: size, height: size,
            borderRadius: size <= 32 ? 'var(--radius-md)' : 'var(--radius-full)',
            background: 'var(--color-bg-tertiary)',
            border: '1px solid var(--color-border)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: 'var(--font-sans)',
            fontSize: Math.max(10, size * 0.38),
            fontWeight: 500,
            color: 'var(--color-text-secondary)',
            flexShrink: 0,
        }}>
            {name.charAt(0).toUpperCase()}
        </div>
    )
}

// ── Stat mini ─────────────────────────────────────────────────────────────────

export function StatMini({ label, value }: { label: string; value: string | number }) {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{
                fontFamily: 'var(--font-sans)',
                fontSize: 'var(--text-xs)',
                fontWeight: 500,
                color: 'var(--color-text-tertiary)',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
            }}>{label}</span>
            <span style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 'var(--text-base)',
                fontWeight: 500,
                color: 'var(--color-text-primary)',
            }}>{value}</span>
        </div>
    )
}

// ── Loading state ─────────────────────────────────────────────────────────────

export function LoadingRow({ columns = 4, rows = 5 }: { columns?: number; rows?: number }) {
    return (
        <div style={{ padding: '8px 0' }}>
            {Array.from({ length: rows }).map((_, i) => (
                <div key={i} style={{
                    display: 'grid',
                    gridTemplateColumns: `repeat(${columns}, 1fr)`,
                    gap: '0 16px',
                    height: 'var(--table-row-height)',
                    alignItems: 'center',
                    borderBottom: '1px solid var(--color-border)',
                    padding: '0 4px',
                }}>
                    {Array.from({ length: columns }).map((_, j) => (
                        <div key={j} className="skeleton" style={{
                            width: j === 0 ? '75%' : '55%',
                            height: 12,
                            borderRadius: 'var(--radius-md)',
                        }} />
                    ))}
                </div>
            ))}
        </div>
    )
}

// ── Notion Row ────────────────────────────────────────────────────────────────
// Wrapper genérico para linhas de tabela estilo Notion

export function NotionRow({ children, style, onClick }: { children: React.ReactNode; style?: React.CSSProperties; onClick?: () => void }) {
    const [hovered, setHovered] = useState(false)

    return (
        <motion.div
            onClick={onClick}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            initial={false}
            animate={{ background: hovered ? 'var(--color-bg-secondary)' : 'transparent' }}
            transition={{ duration: 0.08 }}
            style={{
                borderBottom: '1px solid var(--color-border)',
                height: 'var(--table-row-height)',
                display: 'flex',
                alignItems: 'center',
                paddingLeft: 4,
                paddingRight: 4,
                borderRadius: 'var(--radius-sm)',
                cursor: onClick ? 'pointer' : 'default',
                ...style,
            }}
        >
            {children}
        </motion.div>
    )
}

// ── Section Card ─────────────────────────────────────────────────────────────
// Groups content in a subtle contained card — Notion-style but with depth

interface SectionCardProps {
    children: React.ReactNode
    style?: React.CSSProperties
    padding?: string
    hover?: boolean
}

export function SectionCard({ children, style, padding = '0', hover: _hover = false }: SectionCardProps) {
    return (
        <div style={{ padding, ...style }}>
            {children}
        </div>
    )
}

// ── KPI Grid ─────────────────────────────────────────────────────────────────
// Wraps KPI cards in a structured grid with consistent spacing

export function KpiGrid({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
    return (
        <div style={{
            display: 'flex',
            gap: 48,
            flexWrap: 'wrap',
            alignItems: 'flex-start',
            ...style,
        }}>
            {children}
        </div>
    )
}

// ── Skeleton ─────────────────────────────────────────────────────────────────
// Placeholder loading component with shimmer animation

interface SkeletonProps {
    width?: string | number
    height?: string | number
    borderRadius?: string
    style?: React.CSSProperties
}

export function Skeleton({ width = '100%', height = 16, borderRadius, style }: SkeletonProps) {
    return (
        <div
            className="skeleton"
            style={{
                width,
                height,
                borderRadius: borderRadius || 'var(--radius-md)',
                flexShrink: 0,
                ...style,
            }}
        />
    )
}

// ── Skeleton KPI ─────────────────────────────────────────────────────────────

export function SkeletonKpi() {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <Skeleton width={80} height={11} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Skeleton width={2} height={36} />
                <Skeleton width={120} height={32} />
            </div>
        </div>
    )
}

// ── Skeleton Row ─────────────────────────────────────────────────────────────

export function SkeletonRow({ columns = 4 }: { columns?: number }) {
    return (
        <div style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${columns}, 1fr)`,
            gap: '0 16px',
            height: 'var(--table-row-height)',
            alignItems: 'center',
            borderBottom: '1px solid var(--color-border)',
            padding: '0 4px',
        }}>
            {Array.from({ length: columns }).map((_, i) => (
                <Skeleton key={i} width={i === 0 ? '80%' : '60%'} height={12} />
            ))}
        </div>
    )
}

// ── Skeleton Table ───────────────────────────────────────────────────────────

export function SkeletonTable({ rows = 5, columns = 4 }: { rows?: number; columns?: number }) {
    return (
        <div>
            {Array.from({ length: rows }).map((_, i) => (
                <SkeletonRow key={i} columns={columns} />
            ))}
        </div>
    )
}

// ── Pill Category filter ───────────────────────────────────────────────────────

interface FilterPillsProps {
    options: string[]
    active: string
    onChange: (v: string) => void
}

export function FilterPills({ options, active, onChange }: FilterPillsProps) {
    return (
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {options.map(opt => (
                <motion.button
                    key={opt}
                    onClick={() => onChange(opt)}
                    whileTap={{ scale: 0.97 }}
                    style={{
                        padding: '5px 10px',
                        borderRadius: 'var(--radius-md)',
                        border: 'none',
                        cursor: 'pointer',
                        fontFamily: 'var(--font-sans)',
                        fontSize: 'var(--text-sm)',
                        fontWeight: active === opt ? 500 : 400,
                        letterSpacing: '-0.1px',
                        background: active === opt ? 'var(--color-bg-tertiary)' : 'transparent',
                        color: active === opt ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
                        transition: 'background var(--transition-base), color var(--transition-base)',
                    }}
                >
                    {opt}
                </motion.button>
            ))}
        </div>
    )
}
