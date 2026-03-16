/**
 * @file jobs/meta-lead-attribution.job.ts
 *
 * Atribuição retroativa via Meta Lead Ads API.
 *
 * Para founders que rodaram campanhas de Lead Generation (formulários),
 * a API do Meta retorna os emails dos leads. Cruzamos esses emails com
 * clientes na tabela `customers` e atualizamos acquisition_channel = 'meta_ads'.
 *
 * Limitações:
 * - Só funciona para campanhas de Lead Gen (formulários). Para campanhas de tráfego,
 *   use o Northie Pixel para atribuição determinística daqui em diante.
 * - Requer que o token Meta tenha acesso às Pages com os formulários.
 * - Clientes com canal já atribuído (diferente de 'desconhecido') não são alterados (first-touch).
 */

import axios from 'axios';
import { supabase } from '../lib/supabase.js';
import { IntegrationService } from '../services/integration.service.js';

const GRAPH_URL = 'https://graph.facebook.com/v25.0';

interface MetaLeadField {
    name: string;
    values: string[];
}

interface MetaLead {
    id: string;
    created_time: string;
    field_data: MetaLeadField[];
}

interface MetaPage {
    id: string;
    name: string;
    access_token: string;
}

interface MetaLeadForm {
    id: string;
    name: string;
    status?: string;
}

function extractEmail(fieldData: MetaLeadField[]): string | null {
    const emailField = fieldData.find(f =>
        f.name.toLowerCase().includes('email')
    );
    return emailField?.values?.[0]?.toLowerCase().trim() || null;
}

function extractName(fieldData: MetaLeadField[]): string | null {
    const nameField = fieldData.find(f =>
        f.name === 'full_name' || f.name === 'first_name' || f.name.includes('nome')
    );
    if (nameField?.values?.[0]) return nameField.values[0].trim();

    // Se só tiver first_name + last_name separados, concatena
    const first = fieldData.find(f => f.name === 'first_name')?.values?.[0] || '';
    const last = fieldData.find(f => f.name === 'last_name')?.values?.[0] || '';
    if (first || last) return `${first} ${last}`.trim();

    return null;
}

export interface LeadAttributionResult {
    pagesFound: number;
    formsFound: number;
    leadsProcessed: number;
    customersMatched: number;
    customersUpdated: number;
    errors: string[];
}

/**
 * Busca leads de todos os formulários do Meta associados ao token do perfil
 * e atualiza acquisition_channel dos clientes correspondentes.
 */
export async function runMetaLeadAttribution(profileId: string): Promise<LeadAttributionResult> {
    const tokens = await IntegrationService.getIntegration(profileId, 'meta');
    if (!tokens?.access_token) {
        throw new Error('Meta não conectado. Reconecte a integração no painel.');
    }

    const accessToken = tokens.access_token;
    const result: LeadAttributionResult = {
        pagesFound: 0,
        formsFound: 0,
        leadsProcessed: 0,
        customersMatched: 0,
        customersUpdated: 0,
        errors: [],
    };

    // ── 1. Busca todas as Pages conectadas ao token ────────────────────────────
    let pages: MetaPage[] = [];
    try {
        const pagesRes = await axios.get(`${GRAPH_URL}/me/accounts`, {
            params: { access_token: accessToken, fields: 'id,name,access_token', limit: 50 },
            timeout: 15000,
        });
        pages = pagesRes.data?.data || [];
        result.pagesFound = pages.length;
        console.log(`[MetaLeadAttribution] ${pages.length} page(s) found for profile ${profileId}`);
    } catch (err: unknown) {
        const axiosErr = err as { response?: { data?: { error?: { message?: string } } } };
        const msg = axiosErr.response?.data?.error?.message || (err instanceof Error ? err.message : String(err));
        console.warn(`[MetaLeadAttribution] Could not fetch pages: ${msg}`);
        result.errors.push(`Pages: ${msg}`);
        // Sem pages, tenta direto na conta do usuário (user token pode ter lead forms)
    }

    // ── 2. Processa cada page ──────────────────────────────────────────────────
    for (const page of pages) {
        let forms: MetaLeadForm[] = [];
        try {
            const formsRes = await axios.get(`${GRAPH_URL}/${page.id}/leadgen_forms`, {
                params: { access_token: page.access_token, fields: 'id,name,status', limit: 50 },
                timeout: 15000,
            });
            forms = formsRes.data?.data || [];
            result.formsFound += forms.length;
            console.log(`[MetaLeadAttribution] Page "${page.name}": ${forms.length} lead form(s)`);
        } catch (err: unknown) {
            const axiosErr = err as { response?: { data?: { error?: { message?: string } } } };
            const msg = axiosErr.response?.data?.error?.message || (err instanceof Error ? err.message : String(err));
            console.warn(`[MetaLeadAttribution] Could not fetch forms for page ${page.id}: ${msg}`);
            result.errors.push(`Forms (page ${page.id}): ${msg}`);
            continue;
        }

        // ── 3. Processa cada formulário ────────────────────────────────────────
        for (const form of forms) {
            await processFormLeads(profileId, form.id, page.access_token, result);
        }
    }

    console.log(`[MetaLeadAttribution] Done for profile ${profileId}:`, {
        pages: result.pagesFound,
        forms: result.formsFound,
        leads: result.leadsProcessed,
        matched: result.customersMatched,
        updated: result.customersUpdated,
    });

    return result;
}

interface LeadsPageResponse {
    data: MetaLead[];
    paging?: { next?: string };
}

async function fetchLeadsPage(url: string, params: Record<string, unknown>): Promise<LeadsPageResponse> {
    const axiosRes = await axios.get<LeadsPageResponse>(url, { params, timeout: 20000 });
    return axiosRes.data;
}

async function processFormLeads(
    profileId: string,
    formId: string,
    pageToken: string,
    result: LeadAttributionResult,
): Promise<void> {
    const firstUrl = `${GRAPH_URL}/${formId}/leads`;
    const firstParams: Record<string, unknown> = {
        access_token: pageToken,
        fields: 'field_data,created_time',
        limit: 100,
    };

    let pageUrl: string | null = firstUrl;
    let pageParams: Record<string, unknown> = firstParams;

    while (pageUrl !== null) {
        let page: LeadsPageResponse;

        try {
            page = await fetchLeadsPage(pageUrl, pageParams);
        } catch (err: unknown) {
            const axiosErr = err as { response?: { data?: { error?: { message?: string } } } };
            const msg = axiosErr.response?.data?.error?.message ?? (err instanceof Error ? err.message : String(err));
            console.warn(`[MetaLeadAttribution] Could not fetch leads for form ${formId}: ${msg}`);
            result.errors.push(`Leads (form ${formId}): ${msg}`);
            break;
        }

        const leads: MetaLead[] = page.data ?? [];
        const nextPage: string | undefined = page.paging?.next;

        result.leadsProcessed += leads.length;

        for (const lead of leads) {
            const email = extractEmail(lead.field_data);
            if (!email) continue;

            // Busca cliente por email
            const { data: customer } = await supabase
                .from('customers')
                .select('id, acquisition_channel, name')
                .eq('profile_id', profileId)
                .eq('email', email)
                .single();

            if (!customer) continue;
            result.customersMatched++;

            // First-touch: só atualiza se não tiver canal atribuído
            const hasChannel = customer.acquisition_channel &&
                customer.acquisition_channel !== 'desconhecido';
            if (hasChannel) continue;

            const updatePayload: Record<string, unknown> = { acquisition_channel: 'meta_ads' };

            // Se nome ainda não foi preenchido, tenta extrair do formulário
            if (!customer.name) {
                const name = extractName(lead.field_data);
                if (name) updatePayload.name = name;
            }

            const { error } = await supabase
                .from('customers')
                .update(updatePayload)
                .eq('id', customer.id);

            if (!error) {
                result.customersUpdated++;
                console.log(`[MetaLeadAttribution] Updated customer ${email}: meta_ads`);
            }
        }

        // Próxima página — next URL já inclui todos os params
        pageUrl = nextPage ?? null;
        pageParams = {};
    }
}
