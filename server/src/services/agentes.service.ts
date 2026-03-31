import { supabase } from '../lib/supabase.js';
import type { FinancialAgentType, AlertSeverity } from '../types/index.js';

const DEFAULT_THRESHOLDS: Record<FinancialAgentType, Record<string, number>> = {
    receita:      { queda_receita_pct: 15, spike_multiplicador: 3 },
    caixa:        { runway_minimo_meses: 3, forecast_custos_ratio: 2 },
    gastos:       { custo_variacao_pct: 20 },
    oportunidade: { ltv_cac_ratio_min: 5 },
};

// ── Obter configs dos agentes ───────────────────────────────────────────────

export async function obterConfigs(profileId: string) {
    const { data } = await supabase
        .from('agent_configs')
        .select('*')
        .eq('profile_id', profileId);

    const types: FinancialAgentType[] = ['receita', 'caixa', 'gastos', 'oportunidade'];
    return types.map(type => {
        const existing = (data ?? []).find(c => c.agent_type === type);
        return {
            agent_type: type,
            is_active: existing?.is_active ?? true,
            thresholds: { ...DEFAULT_THRESHOLDS[type], ...(existing?.thresholds ?? {}) },
            updated_at: existing?.updated_at ?? null,
        };
    });
}

// ── Alertas abertos ─────────────────────────────────────────────────────────

export async function listarAlertas(profileId: string, status?: string) {
    let query = supabase
        .from('agent_logs')
        .select('*')
        .eq('profile_id', profileId)
        .order('created_at', { ascending: false })
        .limit(100);

    if (status) query = query.eq('status', status);

    const { data } = await query;
    return data ?? [];
}

// ── Log por agente ──────────────────────────────────────────────────────────

export async function logPorAgente(profileId: string, agentType: FinancialAgentType) {
    const { data } = await supabase
        .from('agent_logs')
        .select('*')
        .eq('profile_id', profileId)
        .eq('agent_type', agentType)
        .order('created_at', { ascending: false })
        .limit(50);

    return data ?? [];
}

// ── Resolver / Ignorar alerta ───────────────────────────────────────────────

export async function resolverAlerta(profileId: string, alertaId: string) {
    const { data, error } = await supabase
        .from('agent_logs')
        .update({ status: 'resolvido', resolved_at: new Date().toISOString() })
        .eq('id', alertaId)
        .eq('profile_id', profileId)
        .select()
        .single();

    if (error) throw new Error(error.message);
    return data;
}

export async function ignorarAlerta(profileId: string, alertaId: string) {
    const { data, error } = await supabase
        .from('agent_logs')
        .update({ status: 'ignorado' })
        .eq('id', alertaId)
        .eq('profile_id', profileId)
        .select()
        .single();

    if (error) throw new Error(error.message);
    return data;
}

// ── Configurar thresholds ───────────────────────────────────────────────────

export async function configurarAgente(profileId: string, agentType: FinancialAgentType, thresholds: Record<string, number>, isActive?: boolean) {
    const { data, error } = await supabase
        .from('agent_configs')
        .upsert({
            profile_id: profileId,
            agent_type: agentType,
            thresholds,
            is_active: isActive ?? true,
            updated_at: new Date().toISOString(),
        }, { onConflict: 'profile_id,agent_type' })
        .select()
        .single();

    if (error) throw new Error(error.message);
    return data;
}

// ── Criar alerta (usado pelos jobs) ─────────────────────────────────────────

export async function criarAlerta(
    profileId: string,
    agentType: FinancialAgentType,
    severity: AlertSeverity,
    title: string,
    description: string,
    suggestion: string,
    data: Record<string, unknown> = {},
) {
    const { error } = await supabase
        .from('agent_logs')
        .insert({
            profile_id: profileId,
            agent_type: agentType,
            severity,
            title,
            description,
            suggestion,
            data,
        });

    if (error) console.error(`[agente-${agentType}] Erro ao criar alerta:`, error.message);
}

// ── Executar agente manualmente ─────────────────────────────────────────────

export async function executarAgente(profileId: string, agentType: FinancialAgentType) {
    // Import dinâmico dos jobs para evitar circular dependency
    switch (agentType) {
        case 'receita': {
            const { runAgenteReceita } = await import('../jobs/agente-receita.job.js');
            await runAgenteReceita(profileId);
            break;
        }
        case 'caixa': {
            const { runAgenteCaixa } = await import('../jobs/agente-caixa.job.js');
            await runAgenteCaixa(profileId);
            break;
        }
        case 'gastos': {
            const { runAgenteGastos } = await import('../jobs/agente-gastos.job.js');
            await runAgenteGastos(profileId);
            break;
        }
        case 'oportunidade': {
            const { runAgenteOportunidade } = await import('../jobs/agente-oportunidade.job.js');
            await runAgenteOportunidade(profileId);
            break;
        }
    }
}
