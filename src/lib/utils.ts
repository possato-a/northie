/**
 * @file lib/utils.ts
 * Funções utilitárias compartilhadas por toda a plataforma Northie.
 */

/** Lê o locale do usuário salvo no localStorage. */
function _locale(): string {
    try {
        const map: Record<string, string> = {
            'Português (Brasil)': 'pt-BR',
            'English (US)': 'en-US',
            'Español': 'es-ES',
        }
        return map[localStorage.getItem('northie-language') || ''] ?? 'pt-BR'
    } catch { return 'pt-BR' }
}

/**
 * Formata número respeitando o locale do usuário.
 * Ex (pt-BR): 1234567 → "1.234.567"
 */
export function fmtBR(v: number): string {
    return new Intl.NumberFormat(_locale(), { maximumFractionDigits: 0 }).format(v)
}

/**
 * Formata número para moeda respeitando o locale do usuário.
 * Ex (pt-BR): 1234.56 → "R$ 1.234,56"
 */
export function fmtCurrency(v: number, decimals = 2): string {
    return new Intl.NumberFormat(_locale(), {
        style: 'currency',
        currency: 'BRL',
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
    }).format(v)
}

/**
 * Formata percentual respeitando o locale do usuário.
 */
export function fmtPercent(v: number, decimals = 1): string {
    return new Intl.NumberFormat(_locale(), {
        style: 'percent',
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
    }).format(v / 100)
}

/**
 * Formata data ISO respeitando o locale do usuário.
 * Ex: "2024-01-15" → "15/01/2024" (pt-BR) ou "01/15/2024" (en-US)
 */
export function fmtDate(iso: string): string {
    return new Date(iso).toLocaleDateString(_locale())
}

/**
 * Formata data ISO para padrão curto respeitando o locale do usuário.
 * Ex: "2024-01-15" → "15 jan" (pt-BR)
 */
export function fmtDateShort(iso: string): string {
    return new Date(iso).toLocaleDateString(_locale(), { day: '2-digit', month: 'short' })
}

/**
 * Clamp: restringe valor entre min e max.
 */
export function clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value))
}

/**
 * Calcula variação percentual entre dois valores.
 * Retorna null se o valor anterior for zero.
 */
export function calcGrowth(current: number, previous: number): number | null {
    if (previous === 0) return null
    return ((current - previous) / previous) * 100
}

/**
 * Combina classes CSS condicionalmente (compatível com shadcn/ui).
 */
export function cn(...classes: (string | undefined | null | false)[]): string {
    return classes.filter(Boolean).join(' ')
}
