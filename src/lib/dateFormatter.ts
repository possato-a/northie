/**
 * Utilitário de formatação de datas que respeita as preferências do usuário.
 * Lê direto do localStorage para funcionar em qualquer contexto (componentes, utils, etc).
 */

const LOCALE_MAP: Record<string, string> = {
    'Português (Brasil)': 'pt-BR',
    'English (US)':       'en-US',
    'Español':            'es-ES',
}

function getStoredPref(key: string, fallback: string): string {
    try { return localStorage.getItem(key) ?? fallback } catch { return fallback }
}

export function getLocale(): string {
    const lang = getStoredPref('northie-language', 'Português (Brasil)')
    return LOCALE_MAP[lang] ?? 'pt-BR'
}

export function getDateFormat(): string {
    return getStoredPref('northie-dateformat', 'DD/MM/AAAA')
}

/** Formata uma data curta (ex: 15/03/2026) respeitando o formato salvo. */
export function formatDate(date: Date | string | null | undefined): string {
    if (!date) return '—'
    const d = typeof date === 'string' ? new Date(date) : date
    if (isNaN(d.getTime())) return '—'

    const fmt = getDateFormat()

    if (fmt === 'Relativo') {
        const diff = Date.now() - d.getTime()
        const days = Math.floor(diff / 86_400_000)
        if (days === 0) return 'Hoje'
        if (days === 1) return 'Ontem'
        if (days < 7)  return `Há ${days} dias`
        if (days < 30) return `Há ${Math.floor(days / 7)} sem.`
        if (days < 365) {
            const m = Math.floor(days / 30)
            return `Há ${m} ${m === 1 ? 'mês' : 'meses'}`
        }
        const y = Math.floor(days / 365)
        return `Há ${y} ${y === 1 ? 'ano' : 'anos'}`
    }

    const day   = String(d.getDate()).padStart(2, '0')
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const year  = String(d.getFullYear())

    switch (fmt) {
        case 'MM/DD/AAAA':  return `${month}/${day}/${year}`
        case 'AAAA-MM-DD':  return `${year}-${month}-${day}`
        default:            return `${day}/${month}/${year}` // DD/MM/AAAA
    }
}

/** Formata data + hora curta (ex: 15/03/2026 14:32). */
export function formatDateTime(date: Date | string | null | undefined): string {
    if (!date) return '—'
    const d = typeof date === 'string' ? new Date(date) : date
    if (isNaN(d.getTime())) return '—'
    const h = String(d.getHours()).padStart(2, '0')
    const m = String(d.getMinutes()).padStart(2, '0')
    return `${formatDate(d)} ${h}:${m}`
}

/** Formata data por extenso respeitando o idioma. */
export function formatDateLong(date: Date | string | null | undefined): string {
    if (!date) return '—'
    const d = typeof date === 'string' ? new Date(date) : date
    if (isNaN(d.getTime())) return '—'
    return d.toLocaleDateString(getLocale(), { day: '2-digit', month: 'long', year: 'numeric' })
}

/** Formata um número monetário respeitando o locale salvo. */
export function formatCurrency(n: number, currency = 'BRL'): string {
    return n.toLocaleString(getLocale(), { style: 'currency', currency, maximumFractionDigits: 0 })
}

/** Formata um número simples respeitando o locale salvo. */
export function formatNumber(n: number, decimals = 0): string {
    return n.toLocaleString(getLocale(), {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
    })
}
