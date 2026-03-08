import { createContext, useContext, useState, useEffect } from 'react'

type Theme = 'light' | 'dark'

interface ThemeContextValue {
    theme: Theme
    isDark: boolean
    toggleTheme: () => void
}

const ThemeContext = createContext<ThemeContextValue>({
    theme: 'light',
    isDark: false,
    toggleTheme: () => {},
})

export function ThemeProvider({ children }: { children: React.ReactNode }) {
    const [theme, setTheme] = useState<Theme>(() => {
        try {
            const stored = localStorage.getItem('northie-theme')
            if (stored === 'dark' || stored === 'light') return stored
        } catch {}
        return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
    })

    useEffect(() => {
        document.documentElement.setAttribute('data-theme', theme)
        localStorage.setItem('northie-theme', theme)
    }, [theme])

    const toggleTheme = () => setTheme(t => (t === 'light' ? 'dark' : 'light'))

    return (
        <ThemeContext.Provider value={{ theme, isDark: theme === 'dark', toggleTheme }}>
            {children}
        </ThemeContext.Provider>
    )
}

export const useTheme = () => useContext(ThemeContext)
