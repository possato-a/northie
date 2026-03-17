// ── Frontend Shared Types ────────────────────────────────────────────────────

/**
 * Navigation pages available in the sidebar
 */
export type Page =
    | 'visao-geral'
    | 'growth'
    | 'card'
    | 'vendas'
    | 'clientes'
    | 'canais'
    | 'canais-meta'
    | 'canais-google'
    | 'conversas'
    | 'contexto'
    | 'relatorios'
    | 'creators'
    | 'app-store'
    | 'configuracoes'

// ── Dashboard ────────────────────────────────────────────────────────────────

export interface KpiData {
    label: string
    value: number
    prefix?: string
    suffix?: string
    decimals?: number
}

export interface DashboardStats {
    total_revenue: number
    total_customers: number
    total_transactions: number
    average_ticket: number
    active_customers: number
    churn_rate: number
    currency: string
}

export interface ChannelAttribution {
    channel: string
    revenue: number
    spend: number
    customers: number
    roas: number
    cac: number
    ltv: number
}

export interface ChartPoint {
    date: string
    amount: number
}

export interface ChannelTrends {
    meta: { roas: number[]; cac: number[] }
    google: { roas: number[]; cac: number[] }
}

export interface AdCampaign {
    campaign_id: string
    campaign_name: string
    platform: string
    spend_brl: number
    roas: number
    impressions: number
    clicks: number
    ctr: number
    cpc_brl: number
    cpm_brl: number
    purchases: number
    purchase_value: number
    leads: number
    results: number
    result_type: string
    cost_per_result: number
    status: string | null
    objective: string | null
}

/** @deprecated alias — use RecStatus */
export type RecommendationStatus = 'pending' | 'approved' | 'executing' | 'completed' | 'failed' | 'dismissed' | 'rejected' | 'cancelled'

// ── Customers ────────────────────────────────────────────────────────────────

export interface Customer {
    id: string
    email: string
    name?: string
    phone?: string
    total_ltv: number
    acquisition_channel: string
    rfm_score?: { r: number; f: number; m: number }
    rfm_segment?: string
    churn_probability: number
    last_purchase_at?: string
    cac?: number
    created_at: string
}

export interface TopCustomer {
    name?: string
    email: string
    total_ltv: number
    cac?: number
}

export type ClientStatus = 'Lucrativo' | 'Payback' | 'Risco'
export type RFMSegment = 'Champions' | 'Em Risco' | 'Novos Promissores' | 'Inativos'
export type AcquisitionChannel = 'Meta Ads' | 'Google Ads' | 'Hotmart' | 'Google Orgânico' | 'Email' | 'Direto'

export interface ClientUI {
    id: string
    name: string
    channel: AcquisitionChannel
    totalSpent: number
    cac: number
    ltv: number
    margin: number
    status: ClientStatus
    segment: RFMSegment
    lastPurchase: string
    purchases: Purchase[]
    churnProb: number
}

export interface Purchase {
    date: string
    product: string
    value: number
}

// ── Transactions ─────────────────────────────────────────────────────────────

export type TransactionStatus = 'Pago' | 'Pendente' | 'Reembolsado' | 'Cancelado' | 'Estorno'
export type PaymentMethod = 'Pix' | 'Cartão' | 'Boleto'

export interface Transaction {
    id: string
    date: string
    client: string
    product: string
    value: number
    method: PaymentMethod
    status: TransactionStatus
    channel: AcquisitionChannel
}

// ── Campaigns & Creators ─────────────────────────────────────────────────────

export interface Creator {
    id: string
    name: string
    email: string
    instagram?: string
    sales_count: number
    revenue: number
    paid_commission: number
    pending_commission: number
    status: 'active' | 'inactive'
}

export interface Campaign {
    id: string
    name: string
    product_name: string
    type: 'percentual' | 'fixo'
    commission_rate: number
    description?: string
    start_date?: string
    end_date?: string
    status: string
    creators_count: number
    sales_count?: number
    commission_total?: number
    creators?: Creator[]
}

// ── Integrations ─────────────────────────────────────────────────────────────

export interface Integration {
    platform: string
    status: 'active' | 'inactive'
}

// ── Retention ────────────────────────────────────────────────────────────────

export interface CohortRow {
    month: string
    n: number
    retentions: {
        '30d': number | null
        '60d': number | null
        '90d': number | null
        '180d': number | null
    }
}
