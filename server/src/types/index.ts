// ── Backend Shared Types ────────────────────────────────────────────────────

/**
 * OAuth tokens returned from external platforms (Meta, Google)
 */
export interface OAuthTokens {
    access_token: string
    refresh_token?: string
    expires_in?: number
    token_type?: string
    scope?: string
}

/**
 * Supported platforms for OAuth and webhooks
 */
export type SupportedPlatform = 'meta' | 'google' | 'stripe' | 'hotmart' | 'kiwify' | 'shopify'

/**
 * Acquisition channels for customer attribution
 */
export type AcquisitionChannel =
    | 'meta_ads'
    | 'google_ads'
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
    attribution?: any[]
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
