import { createContext, useContext, useState, useEffect } from 'react'

type Theme = 'light' | 'dark'

interface ThemeContextValue {
    theme: Theme
    isDark: boolean
    toggleTheme: () => void
    setTheme: (t: Theme) => void
    isCompact: boolean
    setCompact: (v: boolean) => void
    language: string
    setLanguage: (v: string) => void
    dateFormat: string
    setDateFormat: (v: string) => void
    startWeekMonday: boolean
    setStartWeekMonday: (v: boolean) => void
}

const ThemeContext = createContext<ThemeContextValue>({
    theme: 'light',
    isDark: false,
    toggleTheme: () => {},
    setTheme: () => {},
    isCompact: false,
    setCompact: () => {},
    language: 'Português (Brasil)',
    setLanguage: () => {},
    dateFormat: 'DD/MM/AAAA',
    setDateFormat: () => {},
    startWeekMonday: true,
    setStartWeekMonday: () => {},
})

export function ThemeProvider({ children }: { children: React.ReactNode }) {
    const [theme, setThemeState] = useState<Theme>(() => {
        try {
            const stored = localStorage.getItem('northie-theme')
            if (stored === 'dark' || stored === 'light') return stored
        } catch {}
        return window.matchMedia?.('(prefers-color-scheme: light)').matches ? 'light' : 'dark'
    })

    const [isCompact, setIsCompact] = useState<boolean>(() => {
        try { return localStorage.getItem('northie-compact') === 'true' } catch {}
        return false
    })

    const [language, setLanguageState] = useState<string>(() => {
        try { return localStorage.getItem('northie-language') || 'Português (Brasil)' } catch {}
        return 'Português (Brasil)'
    })

    const [dateFormat, setDateFormatState] = useState<string>(() => {
        try { return localStorage.getItem('northie-dateformat') || 'DD/MM/AAAA' } catch {}
        return 'DD/MM/AAAA'
    })

    const [startWeekMonday, setStartWeekMondayState] = useState<boolean>(() => {
        try { return localStorage.getItem('northie-startweekmonday') !== 'false' } catch {}
        return true
    })

    useEffect(() => {
        document.documentElement.setAttribute('data-theme', theme)
        localStorage.setItem('northie-theme', theme)
    }, [theme])

    useEffect(() => {
        document.documentElement.setAttribute('data-compact', String(isCompact))
        localStorage.setItem('northie-compact', String(isCompact))
    }, [isCompact])

    useEffect(() => {
        localStorage.setItem('northie-language', language)
    }, [language])

    useEffect(() => {
        localStorage.setItem('northie-dateformat', dateFormat)
    }, [dateFormat])

    useEffect(() => {
        localStorage.setItem('northie-startweekmonday', String(startWeekMonday))
    }, [startWeekMonday])

    const toggleTheme = () => setThemeState(t => (t === 'light' ? 'dark' : 'light'))
    const setTheme = (t: Theme) => setThemeState(t)
    const setCompact = (v: boolean) => setIsCompact(v)
    const setLanguage = (v: string) => setLanguageState(v)
    const setDateFormat = (v: string) => setDateFormatState(v)
    const setStartWeekMonday = (v: boolean) => setStartWeekMondayState(v)

    return (
        <ThemeContext.Provider value={{
            theme, isDark: theme === 'dark', toggleTheme, setTheme,
            isCompact, setCompact,
            language, setLanguage,
            dateFormat, setDateFormat,
            startWeekMonday, setStartWeekMonday,
        }}>
            {children}
        </ThemeContext.Provider>
    )
}

export const useTheme = () => useContext(ThemeContext)
