// ── Backend Shared Types ────────────────────────────────────────────────────

/**
 * OAuth tokens returned from external platforms (Meta, Google)
 */
export interface OAuthTokens {
    access_token: string
    refresh_token?: string
    expires_in?: number
    expires_at?: number   // Unix timestamp (ms) — calculado ao salvar
    token_type?: string
    scope?: string
}

/**
 * Supported platforms for OAuth and webhooks
 */
export type SupportedPlatform = 'meta' | 'google' | 'stripe' | 'hotmart' | 'shopify'

/**
 * Acquisition channels for customer attribution
 */
export type AcquisitionChannel =
    | 'meta_ads'
    | 'google_ads'
    | 'shopify'
    | 'stripe'
    | 'organico'
    | 'email'
    | 'direto'
    | 'afiliado'
    | 'desconhecido'

/**
 * Context passed to the AI service for prompt building
 */
export interface AIChatContext {
    profileId: string
    stats?: {
        total_revenue: number
        currency: string
        total_customers: number
    }
    attribution?: Record<string, unknown>[]
}

/**
 * Normalized transaction payload used internally
 */
export interface NormalizedTransaction {
    profileId: string
    email: string
    platform: string
    externalId: string
    amount: number
    visitorId?: string
}

// ── Financial Features ──────────────────────────────────────────────────────

export type ExpenseCategory = 'ads' | 'saas' | 'agencia' | 'freelancer' | 'plataforma' | 'pessoal' | 'outro'
export type FinancialAgentType = 'receita' | 'caixa' | 'gastos' | 'oportunidade'
export type AlertSeverity = 'info' | 'atencao' | 'critico'
export type AlertStatus = 'aberto' | 'resolvido' | 'ignorado'

export interface FixedCostInput {
    name: string
    supplier_name?: string
    category?: ExpenseCategory
    monthly_cost_brl: number
    notes?: string
}

export interface PLResult {
    receita_bruta: number
    taxas_plataforma: number
    custo_ads: number
    gastos_fixos: number
    margem_estimada: number
    margem_pct: number
    periodo: { inicio: string; fim: string }
    variacao_mes_anterior?: number | undefined
}

export interface ForecastScenario {
    cenario: 'base' | 'otimista' | 'pessimista'
    projecao_30d: number
    projecao_60d: number
}

export interface CaixaPosicao {
    caixa_estimado: number
    variacao_mes_anterior: number
    runway_meses: number
    custos_fixos_mensais: number
    media_ads_spend: number
}

export interface FornecedorUnificado {
    id: string
    name: string
    category: ExpenseCategory
    monthly_cost: number
    origem: 'auto' | 'manual'
    platform?: string
    roas?: number
    ltv_cac?: number
    status: 'saudavel' | 'neutro' | 'atencao' | 'critico'
    tendencia?: number
}

export interface AgentThresholds {
    queda_receita_pct?: number
    runway_minimo_meses?: number
    ltv_cac_ratio_min?: number
    custo_variacao_pct?: number
}
