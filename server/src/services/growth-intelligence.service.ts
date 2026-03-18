import Anthropic from '@anthropic-ai/sdk';
import { supabase } from '../lib/supabase.js';
import { getAnthropicClient as getCentralClient } from '../lib/anthropic.js';
import { runTrafficAnalyst } from './agents/traffic-analyst.agent.js';
import { runConversionAnalyst } from './agents/conversion-analyst.agent.js';
import { runAttributionAgent } from './agents/attribution.agent.js';
import { runStrategicAdvisor } from './agents/strategic-advisor.agent.js';
import type { GrowthDiagnostic } from './agents/strategic-advisor.agent.js';

export type { GrowthDiagnostic };

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DateRange {
    start: Date;
    end: Date;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getAnthropicClient(): Anthropic {
    return getCentralClient() as Anthropic;
}

// ─── Orchestrator ─────────────────────────────────────────────────────────────

/**
 * Executa o pipeline completo de diagnóstico multi-agente para um profile.
 * Fluxo: dados Supabase → Agente 1 → Agente 2 → Agente 3 → Agente 4 → JSON final.
 *
 * Queries de dados rodam em paralelo (Promise.all).
 * Agentes rodam sequencialmente — cada um recebe o contexto dos anteriores.
 */
export async function runDiagnostic(
    profileId: string,
    dateRange: DateRange,
): Promise<GrowthDiagnostic> {
    const client = getAnthropicClient();
    const startIso = dateRange.start.toISOString();
    const endIso = dateRange.end.toISOString();
    const startDate = startIso.split('T')[0]!;
    const endDate = endIso.split('T')[0]!;

    console.log(
        `[GrowthIntelligence] Iniciando diagnóstico — profile: ${profileId} | período: ${startDate} → ${endDate}`,
    );

    // ── 1. Buscar dados de todos os agentes em paralelo ───────────────────────
    // Merge das duas queries de transactions em uma só (antes eram 2 queries separadas)
    const [metricsResult, transactionsResult, profileResult] =
        await Promise.all([
            supabase
                .from('ad_metrics')
                .select('platform, campaign_id, spend_brl, impressions, clicks, date')
                .eq('profile_id', profileId)
                .gte('date', startDate)
                .lte('date', endDate),

            supabase
                .from('transactions')
                .select(`
                    id,
                    platform,
                    status,
                    amount_gross,
                    amount_net,
                    fee_platform,
                    created_at,
                    customer_id,
                    northie_attribution_id,
                    customers(acquisition_channel, acquisition_campaign_id)
                `)
                .eq('profile_id', profileId)
                .gte('created_at', startIso)
                .lte('created_at', endIso),

            supabase
                .from('profiles')
                .select('business_type')
                .eq('id', profileId)
                .single(),
        ]);

    if (metricsResult.error) {
        throw new Error(`[GrowthIntelligence] Erro ao buscar ad_metrics: ${metricsResult.error.message}`);
    }
    if (transactionsResult.error) {
        throw new Error(`[GrowthIntelligence] Erro ao buscar transactions: ${transactionsResult.error.message}`);
    }

    const metrics = metricsResult.data ?? [];
    const allTransactions = transactionsResult.data ?? [];
    const transactions = allTransactions; // mesma referência — usado pelo ConversionAnalyst
    const businessType = profileResult.data?.business_type ?? 'desconhecido';

    // Flatten attribution data da mesma query (antes era query separada)
    const attributionData = allTransactions.map((row) => {
        const customers = (row as Record<string, unknown>).customers as Record<string, unknown> | null;
        return {
            id: row.id as string,
            customer_id: row.customer_id as string,
            amount_net: row.amount_net as number,
            created_at: row.created_at as string,
            northie_attribution_id: (row as unknown as { northie_attribution_id?: string | null }).northie_attribution_id ?? null,
            acquisition_channel: (customers?.acquisition_channel as string | null) ?? null,
            acquisition_campaign_id: (customers?.acquisition_campaign_id as string | null) ?? null,
            utm_source: null as string | null,
            utm_campaign: null as string | null,
            utm_medium: null as string | null,
        };
    });

    // ── 2. Agente 1 — TrafficAnalystAgent ─────────────────────────────────────
    console.log('[GrowthIntelligence] Agente 1: TrafficAnalyst em execução...');
    const trafficAnalysis = await runTrafficAnalyst(client, metrics);
    console.log('[GrowthIntelligence] Agente 1 concluído.');

    // ── 3. Agente 2 — ConversionAnalystAgent ──────────────────────────────────
    console.log('[GrowthIntelligence] Agente 2: ConversionAnalyst em execução...');
    const conversionAnalysis = await runConversionAnalyst(client, transactions, trafficAnalysis);
    console.log('[GrowthIntelligence] Agente 2 concluído.');

    // ── 4. Agente 3 — AttributionAgent ────────────────────────────────────────
    console.log('[GrowthIntelligence] Agente 3: AttributionAgent em execução...');
    const attributionAnalysis = await runAttributionAgent(
        client,
        attributionData,
        trafficAnalysis,
        conversionAnalysis,
    );
    console.log('[GrowthIntelligence] Agente 3 concluído.');

    // ── 5. Agente 4 — StrategicAdvisorAgent ───────────────────────────────────
    console.log('[GrowthIntelligence] Agente 4: StrategicAdvisor em execução...');
    const diagnostic = await runStrategicAdvisor(
        client,
        businessType,
        trafficAnalysis,
        conversionAnalysis,
        attributionAnalysis,
    );
    console.log('[GrowthIntelligence] Agente 4 concluído.');

    // ── 6. Salvar resultado no banco ───────────────────────────────────────────
    const { error: saveError } = await supabase.from('ai_diagnostics').insert({
        user_id: profileId,
        period_start: startIso,
        period_end: endIso,
        agent_traffic: trafficAnalysis,
        agent_conversion: conversionAnalysis,
        agent_attribution: attributionAnalysis,
        diagnostic,
    });

    if (saveError) {
        // Não bloquear — diagnóstico já foi gerado, apenas log do erro de persistência
        console.error('[GrowthIntelligence] Aviso: falha ao salvar diagnóstico no banco:', saveError.message);
    }

    console.log(`[GrowthIntelligence] Diagnóstico concluído para profile ${profileId}`);
    return diagnostic;
}

/**
 * Retorna o diagnóstico mais recente salvo para o profile.
 * Usado para exibir o último resultado sem re-rodar os agentes.
 */
export async function getLatestDiagnostic(profileId: string): Promise<GrowthDiagnostic | null> {
    const { data, error } = await supabase
        .from('ai_diagnostics')
        .select('diagnostic, created_at')
        .eq('user_id', profileId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

    if (error || !data) return null;
    return data.diagnostic as GrowthDiagnostic;
}
