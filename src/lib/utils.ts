/**
 * @file lib/utils.ts
 * Funções utilitárias compartilhadas por toda a plataforma Northie.
 */

/**
 * Formata número para o padrão brasileiro sem casas decimais.
 * Ex: 1234567 → "1.234.567"
 */
export function fmtBR(v: number): string {
    return new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 }).format(v)
}

/**
 * Formata número para BRL com casas decimais.
 * Ex: 1234.56 → "R$ 1.234,56"
 */
export function fmtCurrency(v: number, decimals = 2): string {
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL',
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
    }).format(v)
}

/**
 * Formata percentual.
 * Ex: 0.1234 → "12,34%"
 */
export function fmtPercent(v: number, decimals = 1): string {
    return new Intl.NumberFormat('pt-BR', {
        style: 'percent',
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
    }).format(v / 100)
}

/**
 * Formata data ISO para padrão brasileiro.
 * Ex: "2024-01-15" → "15/01/2024"
 */
export function fmtDate(iso: string): string {
    return new Date(iso).toLocaleDateString('pt-BR')
}

/**
 * Formata data ISO para padrão curto (dia + mês abreviado).
 * Ex: "2024-01-15" → "15 jan"
 */
export function fmtDateShort(iso: string): string {
    return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
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
