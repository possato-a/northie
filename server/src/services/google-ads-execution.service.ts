/**
 * @file services/google-ads-execution.service.ts
 * Google Ads REST API wrapper para execução de ações do Growth Engine.
 * Versão da API: v19
 *
 * Operações suportadas:
 * - createCustomerMatchAudience  — cria Customer Match list com emails SHA256
 * - pauseCampaign                — pausa uma campanha por ID
 * - enableCampaign               — reativa uma campanha pausada
 * - updateCampaignBudget         — atualiza orçamento diário (em micros)
 */

import crypto from 'crypto';
import { IntegrationService } from './integration.service.js';

const GOOGLE_ADS_BASE = 'https://googleads.googleapis.com/v19';

// ── Tipos públicos ──────────────────────────────────────────────────────────

export interface GoogleAdsAudienceResult {
    success: boolean;
    userListId?: string;
    name?: string;
    error?: string;
}

export interface GoogleAdsCampaignResult {
    success: boolean;
    campaignId?: string;
    newStatus?: string;
    error?: string;
}

// ── Tipos internos ──────────────────────────────────────────────────────────

interface GoogleAdsApiError {
    error?: {
        message?: string;
        status?: string;
        details?: unknown[];
    };
}

interface UserListMutateResponse {
    results?: Array<{
        resourceName?: string;
    }>;
    partialFailureError?: unknown;
}

interface CampaignMutateResponse {
    results?: Array<{
        resourceName?: string;
    }>;
    partialFailureError?: unknown;
}

interface BudgetMutateResponse {
    results?: Array<{
        resourceName?: string;
    }>;
    partialFailureError?: unknown;
}

interface OfflineDataJobCreateResponse {
    resourceName?: string;
}

interface AccessibleCustomersResponse {
    resourceNames?: string[];
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function hashEmail(email: string): string {
    return crypto.createHash('sha256').update(email.trim().toLowerCase()).digest('hex');
}

function getDeveloperToken(): string {
    const token = process.env.GOOGLE_ADS_DEVELOPER_TOKEN;
    if (!token) throw new Error('[GoogleAdsExecutionService] GOOGLE_ADS_DEVELOPER_TOKEN não configurado.');
    return token;
}

function buildHeaders(accessToken: string): Record<string, string> {
    const headers: Record<string, string> = {
        Authorization: `Bearer ${accessToken}`,
        'developer-token': getDeveloperToken(),
        'Content-Type': 'application/json',
    };

    const loginCustomerId = process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID;
    if (loginCustomerId) {
        headers['login-customer-id'] = loginCustomerId;
    }

    return headers;
}

async function resolveAccessToken(profileId: string): Promise<string> {
    const tokens = await IntegrationService.getIntegration(profileId, 'google');
    if (!tokens?.access_token) {
        throw new Error(`[GoogleAdsExecutionService] Token Google Ads não encontrado para profile ${profileId}.`);
    }
    return tokens.access_token;
}

/**
 * Tenta obter o primeiro customer ID disponível na integração.
 * Prioridade: metadata.customer_ids[0] → listAccessibleCustomers API.
 */
async function resolveCustomerId(profileId: string, accessToken: string): Promise<string | null> {
    const tokens = await IntegrationService.getIntegration(profileId, 'google');
    const meta = tokens as unknown as Record<string, unknown> | null;

    // 1. Tentar customer_ids salvo no metadata
    if (meta) {
        const customerIds = meta['customer_ids'];
        if (Array.isArray(customerIds) && customerIds.length > 0) {
            return String(customerIds[0]);
        }
        const customerId = meta['customer_id'];
        if (customerId) return String(customerId);
    }

    // 2. Descoberta via API
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30_000);

        let res: Response;
        try {
            res = await fetch(`${GOOGLE_ADS_BASE}/customers:listAccessibleCustomers`, {
                method: 'GET',
                headers: buildHeaders(accessToken),
                signal: controller.signal,
            });
        } finally {
            clearTimeout(timeoutId);
        }

        if (!res.ok) return null;

        const json = await res.json() as AccessibleCustomersResponse;
        const resourceNames = json.resourceNames ?? [];

        // Filtra contas gerenciadoras (MCC) — resource names no formato "customers/{id}"
        for (const rn of resourceNames) {
            const match = rn.match(/^customers\/(\d+)$/);
            if (match) return match[1]!;
        }
    } catch {
        // Silencioso — retorna null
    }

    return null;
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
            await new Promise(r => setTimeout(r, 2_000));
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

function extractResourceId(resourceName: string | undefined): string | undefined {
    if (!resourceName) return undefined;
    const parts = resourceName.split('/');
    return parts[parts.length - 1];
}

// ── Classe principal ─────────────────────────────────────────────────────────

export class GoogleAdsExecutionService {
    /**
     * Cria uma Customer Match audience no Google Ads e popula com emails SHA256.
     *
     * Fluxo de 3 passos:
     * 1. Criar UserList via userLists:mutate
     * 2. Criar OfflineUserDataJob do tipo CUSTOMER_MATCH_USER_LIST
     * 3. Adicionar membros (hashed emails) e executar o job
     */
    static async createCustomerMatchAudience(
        profileId: string,
        name: string,
        emails: string[]
    ): Promise<GoogleAdsAudienceResult> {
        let accessToken: string;
        try {
            accessToken = await resolveAccessToken(profileId);
        } catch (err) {
            const errorMsg = err instanceof Error ? err.message : String(err);
            return { success: false, error: errorMsg };
        }

        const customerId = await resolveCustomerId(profileId, accessToken);
        if (!customerId) {
            return { success: false, error: 'Nenhum customer ID do Google Ads encontrado para este perfil.' };
        }

        // ── Passo 1: Criar UserList ───────────────────────────────────────────

        const userListPayload = {
            operations: [
                {
                    create: {
                        name,
                        membershipLifeSpan: 30,
                        crmBasedUserList: {
                            uploadKeyType: 'CONTACT_INFO',
                            dataSourceType: 'FIRST_PARTY',
                        },
                    },
                },
            ],
        };

        let createListRes: Response;
        try {
            createListRes = await fetchWithRetry(
                `${GOOGLE_ADS_BASE}/customers/${customerId}/userLists:mutate`,
                {
                    method: 'POST',
                    headers: buildHeaders(accessToken),
                    body: JSON.stringify(userListPayload),
                }
            );
        } catch (err) {
            const errorMsg = err instanceof Error ? err.message : String(err);
            console.error('[GoogleAdsExecutionService] Falha de rede ao criar UserList:', errorMsg);
            return { success: false, error: errorMsg };
        }

        const createListJson = await createListRes.json() as UserListMutateResponse & GoogleAdsApiError;

        if (!createListRes.ok || createListJson.error) {
            const errorMsg = createListJson.error?.message ?? `HTTP ${createListRes.status}`;
            console.error('[GoogleAdsExecutionService] Erro ao criar UserList:', errorMsg);
            return { success: false, error: errorMsg };
        }

        const userListResourceName = createListJson.results?.[0]?.resourceName;
        const userListId = extractResourceId(userListResourceName);

        if (!userListId) {
            return { success: false, error: 'UserList criada mas ID não retornado pela API.' };
        }

        // Delay entre etapas conforme recomendação da API
        await new Promise(r => setTimeout(r, 500));

        // ── Passo 2: Criar OfflineUserDataJob ─────────────────────────────────

        const jobPayload = {
            type: 'CUSTOMER_MATCH_USER_LIST',
            customerMatchUserListMetadata: {
                userList: `customers/${customerId}/userLists/${userListId}`,
            },
        };

        let createJobRes: Response;
        try {
            createJobRes = await fetchWithRetry(
                `${GOOGLE_ADS_BASE}/customers/${customerId}/offlineUserDataJobs:create`,
                {
                    method: 'POST',
                    headers: buildHeaders(accessToken),
                    body: JSON.stringify(jobPayload),
                }
            );
        } catch (err) {
            const errorMsg = err instanceof Error ? err.message : String(err);
            console.error('[GoogleAdsExecutionService] Falha de rede ao criar OfflineUserDataJob:', errorMsg);
            // UserList foi criada mesmo assim — retorna sucesso parcial sem membros
            return { success: true, userListId, name, error: 'Audience criada mas membros não adicionados: ' + errorMsg };
        }

        const createJobJson = await createJobRes.json() as OfflineDataJobCreateResponse & GoogleAdsApiError;

        if (!createJobRes.ok || (createJobJson as GoogleAdsApiError).error) {
            const errorMsg = (createJobJson as GoogleAdsApiError).error?.message ?? `HTTP ${createJobRes.status}`;
            console.error('[GoogleAdsExecutionService] Erro ao criar OfflineUserDataJob:', errorMsg);
            return { success: true, userListId, name, error: 'Audience criada mas membros não adicionados: ' + errorMsg };
        }

        const jobResourceName = createJobJson.resourceName;
        const jobId = extractResourceId(jobResourceName);

        if (!jobId) {
            return { success: true, userListId, name, error: 'Job criado mas ID não retornado.' };
        }

        await new Promise(r => setTimeout(r, 500));

        // ── Passo 3: Adicionar membros ────────────────────────────────────────

        const hashedEmails = emails.map(hashEmail);
        const operations = hashedEmails.map(hashed => ({
            create: {
                userIdentifiers: [
                    {
                        hashedEmail: hashed,
                    },
                ],
            },
        }));

        const addOpsPayload = {
            operations,
            enablePartialFailure: true,
        };

        let addOpsRes: Response;
        try {
            addOpsRes = await fetchWithRetry(
                `${GOOGLE_ADS_BASE}/customers/${customerId}/offlineUserDataJobs/${jobId}:addOperations`,
                {
                    method: 'POST',
                    headers: buildHeaders(accessToken),
                    body: JSON.stringify(addOpsPayload),
                }
            );
        } catch (err) {
            const errorMsg = err instanceof Error ? err.message : String(err);
            console.error('[GoogleAdsExecutionService] Falha de rede ao adicionar membros ao job:', errorMsg);
            return { success: true, userListId, name, error: 'Membros não adicionados: ' + errorMsg };
        }

        if (!addOpsRes.ok) {
            const errJson = await addOpsRes.json().catch(() => ({})) as GoogleAdsApiError;
            const errorMsg = errJson.error?.message ?? `HTTP ${addOpsRes.status}`;
            console.error('[GoogleAdsExecutionService] Erro ao adicionar membros:', errorMsg);
            return { success: true, userListId, name, error: 'Membros não adicionados: ' + errorMsg };
        }

        await new Promise(r => setTimeout(r, 500));

        // ── Passo 4: Executar o job ────────────────────────────────────────────

        let runJobRes: Response;
        try {
            runJobRes = await fetchWithRetry(
                `${GOOGLE_ADS_BASE}/customers/${customerId}/offlineUserDataJobs/${jobId}:run`,
                {
                    method: 'POST',
                    headers: buildHeaders(accessToken),
                    body: JSON.stringify({}),
                }
            );
        } catch (err) {
            const errorMsg = err instanceof Error ? err.message : String(err);
            console.error('[GoogleAdsExecutionService] Falha de rede ao executar job:', errorMsg);
            return { success: true, userListId, name, error: 'Job não executado: ' + errorMsg };
        }

        if (!runJobRes.ok) {
            const errJson = await runJobRes.json().catch(() => ({})) as GoogleAdsApiError;
            const errorMsg = errJson.error?.message ?? `HTTP ${runJobRes.status}`;
            console.error('[GoogleAdsExecutionService] Erro ao executar job:', errorMsg);
            return { success: true, userListId, name, error: 'Job não executado: ' + errorMsg };
        }

        return { success: true, userListId, name };
    }

    /**
     * Pausa uma campanha do Google Ads.
     */
    static async pauseCampaign(
        profileId: string,
        customerId: string,
        campaignId: string
    ): Promise<GoogleAdsCampaignResult> {
        return GoogleAdsExecutionService.setCampaignStatus(profileId, customerId, campaignId, 'PAUSED');
    }

    /**
     * Reativa uma campanha pausada do Google Ads.
     */
    static async enableCampaign(
        profileId: string,
        customerId: string,
        campaignId: string
    ): Promise<GoogleAdsCampaignResult> {
        return GoogleAdsExecutionService.setCampaignStatus(profileId, customerId, campaignId, 'ENABLED');
    }

    /**
     * Atualiza o orçamento diário de uma campanha.
     * @param newDailyBudgetMicros — valor em micros (BRL × 1.000.000)
     */
    static async updateCampaignBudget(
        profileId: string,
        customerId: string,
        campaignBudgetId: string,
        newDailyBudgetMicros: number
    ): Promise<GoogleAdsCampaignResult> {
        let accessToken: string;
        try {
            accessToken = await resolveAccessToken(profileId);
        } catch (err) {
            const errorMsg = err instanceof Error ? err.message : String(err);
            return { success: false, error: errorMsg };
        }

        const payload = {
            operations: [
                {
                    updateMask: 'amountMicros',
                    update: {
                        resourceName: `customers/${customerId}/campaignBudgets/${campaignBudgetId}`,
                        amountMicros: newDailyBudgetMicros,
                    },
                },
            ],
        };

        let res: Response;
        try {
            res = await fetchWithRetry(
                `${GOOGLE_ADS_BASE}/customers/${customerId}/campaignBudgets:mutate`,
                {
                    method: 'POST',
                    headers: buildHeaders(accessToken),
                    body: JSON.stringify(payload),
                }
            );
        } catch (err) {
            const errorMsg = err instanceof Error ? err.message : String(err);
            console.error('[GoogleAdsExecutionService] Falha de rede ao atualizar budget:', errorMsg);
            return { success: false, error: errorMsg };
        }

        const json = await res.json() as BudgetMutateResponse & GoogleAdsApiError;

        if (!res.ok || json.error) {
            const errorMsg = json.error?.message ?? `HTTP ${res.status}`;
            console.error('[GoogleAdsExecutionService] Erro ao atualizar budget:', errorMsg);
            return { success: false, error: errorMsg };
        }

        const resourceName = json.results?.[0]?.resourceName;
        const budgetId = extractResourceId(resourceName);

        return {
            success: true,
            campaignId: budgetId ?? campaignBudgetId,
        };
    }

    // ── Helpers estáticos privados ────────────────────────────────────────────

    private static async setCampaignStatus(
        profileId: string,
        customerId: string,
        campaignId: string,
        status: 'PAUSED' | 'ENABLED'
    ): Promise<GoogleAdsCampaignResult> {
        let accessToken: string;
        try {
            accessToken = await resolveAccessToken(profileId);
        } catch (err) {
            const errorMsg = err instanceof Error ? err.message : String(err);
            return { success: false, error: errorMsg };
        }

        const payload = {
            operations: [
                {
                    updateMask: 'status',
                    update: {
                        resourceName: `customers/${customerId}/campaigns/${campaignId}`,
                        status,
                    },
                },
            ],
        };

        let res: Response;
        try {
            res = await fetchWithRetry(
                `${GOOGLE_ADS_BASE}/customers/${customerId}/campaigns:mutate`,
                {
                    method: 'POST',
                    headers: buildHeaders(accessToken),
                    body: JSON.stringify(payload),
                }
            );
        } catch (err) {
            const errorMsg = err instanceof Error ? err.message : String(err);
            console.error(`[GoogleAdsExecutionService] Falha de rede ao definir status ${status} para campanha ${campaignId}:`, errorMsg);
            return { success: false, error: errorMsg };
        }

        const json = await res.json() as CampaignMutateResponse & GoogleAdsApiError;

        if (!res.ok || json.error) {
            const errorMsg = json.error?.message ?? `HTTP ${res.status}`;
            console.error(`[GoogleAdsExecutionService] Erro ao definir status ${status} para campanha ${campaignId}:`, errorMsg);
            return { success: false, error: errorMsg };
        }

        return {
            success: true,
            campaignId,
            newStatus: status,
        };
    }
}
