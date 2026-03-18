/**
 * @file services/shopify-execution.service.ts
 * Shopify Admin API wrapper para execução de ações do Growth Engine.
 * Versão da API: 2024-10
 *
 * Operações suportadas:
 * - createDiscountCode    — cria price rule + código de desconto para um cliente específico
 * - tagCustomer           — adiciona tags a um cliente Shopify
 * - getCustomerByEmail    — busca cliente por email
 */

import { IntegrationService } from './integration.service.js';

const SHOPIFY_API_VERSION = '2024-10';

// ── Tipos públicos ──────────────────────────────────────────────────────────

export interface ShopifyDiscountResult {
    success: boolean;
    code?: string;
    priceRuleId?: number;
    discountId?: number;
    expiresAt?: string;
    error?: string;
}

export interface ShopifyTagResult {
    success: boolean;
    customerId?: string;
    tags?: string;
    error?: string;
}

export interface ShopifyCustomerResult {
    success: boolean;
    customerId?: string;
    email?: string;
    tags?: string;
    error?: string;
}

// ── Tipos internos ──────────────────────────────────────────────────────────

interface ShopifyPriceRule {
    id: number;
    title: string;
    value: string;
    ends_at: string | null;
}

interface ShopifyPriceRuleResponse {
    price_rule?: ShopifyPriceRule;
    errors?: Record<string, string[]> | string;
}

interface ShopifyDiscountCode {
    id: number;
    code: string;
}

interface ShopifyDiscountCodeResponse {
    discount_code?: ShopifyDiscountCode;
    errors?: Record<string, string[]> | string;
}

interface ShopifyCustomer {
    id: number;
    email: string;
    tags: string;
}

interface ShopifyCustomerResponse {
    customer?: ShopifyCustomer;
    errors?: Record<string, string[]> | string;
}

interface ShopifyCustomerSearchResponse {
    customers?: ShopifyCustomer[];
}

// ── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Normaliza o domínio da loja Shopify.
 * Aceita: "minhaloja", "minhaloja.myshopify.com"
 * Sempre retorna: "minhaloja.myshopify.com"
 */
function normalizeShopDomain(raw: string): string {
    const clean = raw.trim().toLowerCase().replace(/\/+$/, '');
    if (clean.includes('.myshopify.com')) return clean;
    return `${clean}.myshopify.com`;
}

function shopifyBaseUrl(shop: string): string {
    return `https://${normalizeShopDomain(shop)}/admin/api/${SHOPIFY_API_VERSION}`;
}

async function resolveShopifyToken(profileId: string): Promise<{ accessToken: string; shop: string }> {
    const tokens = await IntegrationService.getIntegration(profileId, 'shopify');
    if (!tokens?.access_token) {
        throw new Error(`[ShopifyExecutionService] Token Shopify não encontrado para profile ${profileId}.`);
    }

    const meta = tokens as unknown as Record<string, unknown>;
    const shop = (
        (meta['shop'] as string | undefined) ||
        (meta['domain'] as string | undefined) ||
        (meta['shopify_domain'] as string | undefined)
    );

    if (!shop) {
        throw new Error(`[ShopifyExecutionService] Domínio da loja Shopify não encontrado nos metadados do profile ${profileId}.`);
    }

    return { accessToken: tokens.access_token, shop };
}

function buildShopifyHeaders(accessToken: string): Record<string, string> {
    return {
        'X-Shopify-Access-Token': accessToken,
        'Content-Type': 'application/json',
    };
}

/**
 * Executa fetch com timeout de 30s e retry único em caso de HTTP 429.
 */
async function fetchWithRetry(url: string, init: RequestInit): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30_000);

    try {
        let res = await fetch(url, { ...init, signal: controller.signal });

        if (res.status === 429) {
            // Respeita Retry-After se presente (Shopify envia em segundos)
            const retryAfterHeader = res.headers.get('Retry-After');
            const delayMs = retryAfterHeader ? parseFloat(retryAfterHeader) * 1000 : 2_000;
            await new Promise(r => setTimeout(r, delayMs));

            const retryController = new AbortController();
            const retryTimeout = setTimeout(() => retryController.abort(), 30_000);
            try {
                res = await fetch(url, { ...init, signal: retryController.signal });
            } finally {
                clearTimeout(retryTimeout);
            }
        }

        return res;
    } finally {
        clearTimeout(timeoutId);
    }
}

function formatShopifyErrors(errors: Record<string, string[]> | string | undefined): string {
    if (!errors) return 'Erro desconhecido';
    if (typeof errors === 'string') return errors;
    return Object.entries(errors)
        .map(([field, msgs]) => `${field}: ${msgs.join(', ')}`)
        .join('; ');
}

/**
 * Gera código de desconto aleatório com prefixo NORTHIE.
 * Ex: NORTHIE3X7K2M
 */
function generateDiscountCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sem ambiguidades O/0 I/1
    let suffix = '';
    for (let i = 0; i < 6; i++) {
        suffix += chars[Math.floor(Math.random() * chars.length)];
    }
    return `NORTHIE${suffix}`;
}

// ── Classe principal ─────────────────────────────────────────────────────────

export class ShopifyExecutionService {
    /**
     * Busca um cliente Shopify pelo email.
     * Retorna o primeiro resultado da busca.
     */
    static async getCustomerByEmail(
        profileId: string,
        shop: string,
        email: string
    ): Promise<ShopifyCustomerResult> {
        let accessToken: string;
        let resolvedShop: string;

        try {
            const resolved = await resolveShopifyToken(profileId);
            accessToken = resolved.accessToken;
            // Preferir o shop passado explicitamente, mas normalizar de qualquer forma
            resolvedShop = shop || resolved.shop;
        } catch (err) {
            const errorMsg = err instanceof Error ? err.message : String(err);
            return { success: false, error: errorMsg };
        }

        const encodedEmail = encodeURIComponent(email.trim().toLowerCase());
        const url = `${shopifyBaseUrl(resolvedShop)}/customers/search.json?query=email:${encodedEmail}&limit=1`;

        let res: Response;
        try {
            res = await fetchWithRetry(url, {
                method: 'GET',
                headers: buildShopifyHeaders(accessToken),
            });
        } catch (err) {
            const errorMsg = err instanceof Error ? err.message : String(err);
            console.error(`[ShopifyExecutionService] Falha de rede ao buscar cliente ${email}:`, errorMsg);
            return { success: false, error: errorMsg };
        }

        if (!res.ok) {
            return { success: false, error: `HTTP ${res.status} ao buscar cliente por email` };
        }

        const json = await res.json() as ShopifyCustomerSearchResponse;
        const customer = json.customers?.[0];

        if (!customer) {
            return { success: false, error: `Nenhum cliente encontrado com email ${email}` };
        }

        return {
            success: true,
            customerId: String(customer.id),
            email: customer.email,
            tags: customer.tags,
        };
    }

    /**
     * Cria uma price rule + código de desconto exclusivo para um cliente.
     *
     * Fluxo:
     * 1. Localizar customerId por email se não fornecido
     * 2. Criar price rule com prerequisite_customer_ids
     * 3. Criar discount code vinculado à price rule
     */
    static async createDiscountCode(
        profileId: string,
        shop: string,
        percent: number,
        customerEmail: string,
        expiresInDays = 30
    ): Promise<ShopifyDiscountResult> {
        let accessToken: string;
        let resolvedShop: string;

        try {
            const resolved = await resolveShopifyToken(profileId);
            accessToken = resolved.accessToken;
            resolvedShop = shop || resolved.shop;
        } catch (err) {
            const errorMsg = err instanceof Error ? err.message : String(err);
            return { success: false, error: errorMsg };
        }

        // ── Passo 1: Localizar customerId ─────────────────────────────────────

        const customerResult = await ShopifyExecutionService.getCustomerByEmail(profileId, resolvedShop, customerEmail);
        if (!customerResult.success || !customerResult.customerId) {
            return {
                success: false,
                error: customerResult.error ?? `Cliente ${customerEmail} não encontrado na loja Shopify`,
            };
        }

        const customerId = customerResult.customerId;

        // ── Passo 2: Criar price rule ─────────────────────────────────────────

        const now = new Date();
        const expiresAt = new Date(now.getTime() + expiresInDays * 24 * 60 * 60 * 1000);

        const priceRulePayload = {
            price_rule: {
                title: `Northie Reativação — ${customerEmail}`,
                target_type: 'line_item',
                target_selection: 'all',
                allocation_method: 'across',
                value_type: 'percentage',
                value: `-${percent}`,
                customer_selection: 'prerequisite',
                prerequisite_customer_ids: [parseInt(customerId, 10)],
                usage_limit: 1,
                once_per_customer: true,
                starts_at: now.toISOString(),
                ends_at: expiresAt.toISOString(),
            },
        };

        const priceRuleUrl = `${shopifyBaseUrl(resolvedShop)}/price_rules.json`;

        let priceRuleRes: Response;
        try {
            priceRuleRes = await fetchWithRetry(priceRuleUrl, {
                method: 'POST',
                headers: buildShopifyHeaders(accessToken),
                body: JSON.stringify(priceRulePayload),
            });
        } catch (err) {
            const errorMsg = err instanceof Error ? err.message : String(err);
            console.error('[ShopifyExecutionService] Falha de rede ao criar price rule:', errorMsg);
            return { success: false, error: errorMsg };
        }

        const priceRuleJson = await priceRuleRes.json() as ShopifyPriceRuleResponse;

        if (!priceRuleRes.ok || !priceRuleJson.price_rule) {
            const errorMsg = formatShopifyErrors(priceRuleJson.errors) || `HTTP ${priceRuleRes.status}`;
            console.error('[ShopifyExecutionService] Erro ao criar price rule:', errorMsg);
            return { success: false, error: errorMsg };
        }

        const priceRuleId = priceRuleJson.price_rule.id;

        // ── Passo 3: Criar discount code ──────────────────────────────────────

        const code = generateDiscountCode();
        const discountCodePayload = {
            discount_code: { code },
        };

        const discountCodeUrl = `${shopifyBaseUrl(resolvedShop)}/price_rules/${priceRuleId}/discount_codes.json`;

        let discountCodeRes: Response;
        try {
            discountCodeRes = await fetchWithRetry(discountCodeUrl, {
                method: 'POST',
                headers: buildShopifyHeaders(accessToken),
                body: JSON.stringify(discountCodePayload),
            });
        } catch (err) {
            const errorMsg = err instanceof Error ? err.message : String(err);
            console.error('[ShopifyExecutionService] Falha de rede ao criar discount code:', errorMsg);
            return { success: false, priceRuleId, error: errorMsg };
        }

        const discountCodeJson = await discountCodeRes.json() as ShopifyDiscountCodeResponse;

        if (!discountCodeRes.ok || !discountCodeJson.discount_code) {
            const errorMsg = formatShopifyErrors(discountCodeJson.errors) || `HTTP ${discountCodeRes.status}`;
            console.error('[ShopifyExecutionService] Erro ao criar discount code:', errorMsg);
            return { success: false, priceRuleId, error: errorMsg };
        }

        return {
            success: true,
            code: discountCodeJson.discount_code.code,
            priceRuleId,
            discountId: discountCodeJson.discount_code.id,
            expiresAt: expiresAt.toISOString(),
        };
    }

    /**
     * Adiciona tags a um cliente Shopify sem remover as existentes.
     * Faz merge das tags existentes com as novas antes de atualizar.
     */
    static async tagCustomer(
        profileId: string,
        shop: string,
        customerId: string,
        tags: string[]
    ): Promise<ShopifyTagResult> {
        let accessToken: string;
        let resolvedShop: string;

        try {
            const resolved = await resolveShopifyToken(profileId);
            accessToken = resolved.accessToken;
            resolvedShop = shop || resolved.shop;
        } catch (err) {
            const errorMsg = err instanceof Error ? err.message : String(err);
            return { success: false, error: errorMsg };
        }

        // ── Buscar tags existentes ────────────────────────────────────────────

        const getUrl = `${shopifyBaseUrl(resolvedShop)}/customers/${customerId}.json?fields=id,tags`;

        let getRes: Response;
        try {
            getRes = await fetchWithRetry(getUrl, {
                method: 'GET',
                headers: buildShopifyHeaders(accessToken),
            });
        } catch (err) {
            const errorMsg = err instanceof Error ? err.message : String(err);
            console.error(`[ShopifyExecutionService] Falha de rede ao buscar tags do cliente ${customerId}:`, errorMsg);
            return { success: false, error: errorMsg };
        }

        let existingTags = '';
        if (getRes.ok) {
            const getJson = await getRes.json() as ShopifyCustomerResponse;
            existingTags = getJson.customer?.tags ?? '';
        }

        // Merge: preserva existentes, adiciona novas sem duplicata
        const existingTagsSet = new Set(
            existingTags
                .split(',')
                .map(t => t.trim())
                .filter(Boolean)
        );

        for (const tag of tags) {
            existingTagsSet.add(tag.trim());
        }

        // Northie sempre marca com tag de rastreio
        existingTagsSet.add('northie-reativacao');

        const mergedTags = Array.from(existingTagsSet).join(', ');

        // ── Atualizar tags ────────────────────────────────────────────────────

        const updateUrl = `${shopifyBaseUrl(resolvedShop)}/customers/${customerId}.json`;
        const updatePayload = {
            customer: {
                id: parseInt(customerId, 10),
                tags: mergedTags,
            },
        };

        let updateRes: Response;
        try {
            updateRes = await fetchWithRetry(updateUrl, {
                method: 'PUT',
                headers: buildShopifyHeaders(accessToken),
                body: JSON.stringify(updatePayload),
            });
        } catch (err) {
            const errorMsg = err instanceof Error ? err.message : String(err);
            console.error(`[ShopifyExecutionService] Falha de rede ao atualizar tags do cliente ${customerId}:`, errorMsg);
            return { success: false, error: errorMsg };
        }

        const updateJson = await updateRes.json() as ShopifyCustomerResponse;

        if (!updateRes.ok || !updateJson.customer) {
            const errorMsg = formatShopifyErrors(updateJson.errors) || `HTTP ${updateRes.status}`;
            console.error(`[ShopifyExecutionService] Erro ao atualizar tags do cliente ${customerId}:`, errorMsg);
            return { success: false, error: errorMsg };
        }

        return {
            success: true,
            customerId,
            tags: updateJson.customer.tags,
        };
    }
}
