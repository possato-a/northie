import { createContext, useContext, useState, useEffect } from 'react'

type Theme = 'light' | 'dark'

interface ThemeContextValue {
    theme: Theme
    isDark: boolean
    toggleTheme: () => void
    isCompact: boolean
    setCompact: (v: boolean) => void
}

const ThemeContext = createContext<ThemeContextValue>({
    theme: 'light',
    isDark: false,
    toggleTheme: () => {},
    isCompact: false,
    setCompact: () => {},
})

export function ThemeProvider({ children }: { children: React.ReactNode }) {
    const [theme, setTheme] = useState<Theme>(() => {
        try {
            const stored = localStorage.getItem('northie-theme')
            if (stored === 'dark' || stored === 'light') return stored
        } catch {}
        return window.matchMedia?.('(prefers-color-scheme: light)').matches ? 'light' : 'dark'
    })

    const [isCompact, setIsCompact] = useState<boolean>(() => {
        try {
            return localStorage.getItem('northie-compact') === 'true'
        } catch {}
        return false
    })

    useEffect(() => {
        document.documentElement.setAttribute('data-theme', theme)
        localStorage.setItem('northie-theme', theme)
    }, [theme])

    useEffect(() => {
        document.documentElement.setAttribute('data-compact', String(isCompact))
        localStorage.setItem('northie-compact', String(isCompact))
    }, [isCompact])

    const toggleTheme = () => setTheme(t => (t === 'light' ? 'dark' : 'light'))

    const setCompact = (v: boolean) => setIsCompact(v)

    return (
        <ThemeContext.Provider value={{ theme, isDark: theme === 'dark', toggleTheme, isCompact, setCompact }}>
            {children}
        </ThemeContext.Provider>
    )
}

export const useTheme = () => useContext(ThemeContext)
