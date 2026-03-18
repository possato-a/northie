/**
 * @file services/alert-recommendation-bridge.service.ts
 * Ponte entre alertas detectados e growth_recommendations.
 *
 * Quando um alerta warning/critical dispara, este service verifica se já existe
 * uma recomendação pendente do mesmo tipo nas últimas 24h (deduplicação) e, se
 * não existir, cria uma nova `growth_recommendation` correspondente para que o
 * founder veja a ação sugerida diretamente na tela de Growth.
 *
 * Mapeamento:
 *   roas_drop (meta)   → pausa_campanha         critical
 *   roas_drop (google) → pausa_campanha         critical
 *   high_churn         → reativacao_alto_ltv    high
 *   high_cac           → cac_vs_ltv_deficit     high
 *   budget_spike       → ajuste_budget          medium
 *   revenue_zero       → reativacao_alto_ltv    critical
 *   organic_spike      → (nenhuma — informativo)
 */

import { supabase } from '../lib/supabase.js';

// ── Tipos ─────────────────────────────────────────────────────────────────────

type AlertType =
    | 'roas_drop'
    | 'high_churn'
    | 'revenue_zero'
    | 'organic_spike'
    | 'high_cac'
    | 'budget_spike';

type AlertSeverity = 'warning' | 'critical';

type RecType =
    | 'reativacao_alto_ltv'
    | 'pausa_campanha_ltv_baixo'
    | 'audience_sync_champions'
    | 'realocacao_budget'
    | 'upsell_cohort'
    | 'divergencia_roi_canal'
    | 'queda_retencao_cohort'
    | 'canal_alto_ltv_underinvested'
    | 'cac_vs_ltv_deficit'
    | 'em_risco_alto_valor'
    | 'pausa_campanha'
    | 'ajuste_budget';

type RecPriority = 'critical' | 'high' | 'medium' | 'low';

interface AlertRecommendationParams {
    profileId: string;
    alertType: AlertType;
    alertMeta: Record<string, unknown>;
    alertSeverity: AlertSeverity;
}

// ── Mapeamento alertType → RecType ────────────────────────────────────────────

interface RecMapping {
    recType: RecType;
    priority: RecPriority;
}

function getMapping(alertType: AlertType, alertMeta: Record<string, unknown>): RecMapping | null {
    switch (alertType) {
        case 'roas_drop': {
            const platform = alertMeta['platform'];
            if (platform === 'meta' || platform === 'google') {
                return { recType: 'pausa_campanha', priority: 'critical' };
            }
            // plataforma desconhecida — ainda cria como critical
            return { recType: 'pausa_campanha', priority: 'critical' };
        }
        case 'high_churn':
            return { recType: 'reativacao_alto_ltv', priority: 'high' };
        case 'high_cac':
            return { recType: 'cac_vs_ltv_deficit', priority: 'high' };
        case 'budget_spike':
            return { recType: 'ajuste_budget', priority: 'medium' };
        case 'revenue_zero':
            return { recType: 'reativacao_alto_ltv', priority: 'critical' };
        case 'organic_spike':
            // Apenas informativo — nenhuma recomendação gerada
            return null;
        default:
            return null;
    }
}

// ── Geração de título e narrativa ─────────────────────────────────────────────

function buildTitle(alertType: AlertType, alertMeta: Record<string, unknown>): string {
    switch (alertType) {
        case 'roas_drop': {
            const platform = alertMeta['platform'] === 'meta' ? 'Meta' : 'Google';
            const drop = alertMeta['drop'] as number | undefined;
            return drop !== undefined
                ? `ROAS ${platform} caiu ${drop}% — pausar campanhas`
                : `ROAS ${platform} abaixo do esperado — pausar campanhas`;
        }
        case 'high_churn': {
            const pct = alertMeta['percentage'] as number | undefined;
            return pct !== undefined
                ? `${pct}% da base em risco — reativar clientes de alto LTV`
                : 'Alto risco de churn — reativar clientes de alto LTV';
        }
        case 'high_cac': {
            const cac = alertMeta['cac'] as number | undefined;
            const ltv = alertMeta['avgLtv'] as number | undefined;
            return cac !== undefined && ltv !== undefined
                ? `CAC (R$ ${cac}) acima do LTV (R$ ${ltv}) — revisar aquisição`
                : 'CAC acima do LTV médio — revisar aquisição';
        }
        case 'budget_spike': {
            const multiple = alertMeta['multiple'] as number | undefined;
            return multiple !== undefined
                ? `Gasto em ads ${multiple}x acima da média — revisar orçamento`
                : 'Spike de gasto em ads — revisar orçamento';
        }
        case 'revenue_zero':
            return 'Receita zerada hoje — reativar clientes de alto LTV';
        default:
            return 'Ação recomendada pelo sistema de alertas';
    }
}

function buildNarrative(alertType: AlertType, alertMeta: Record<string, unknown>): string {
    switch (alertType) {
        case 'roas_drop': {
            const platform = alertMeta['platform'] === 'meta' ? 'Meta Ads' : 'Google Ads';
            const todayRoas = alertMeta['todayRoas'] as number | undefined;
            const avgRoas7d = alertMeta['avgRoas7d'] as number | undefined;
            const drop = alertMeta['drop'] as number | undefined;
            if (todayRoas !== undefined && avgRoas7d !== undefined && drop !== undefined) {
                return `O ROAS em ${platform} caiu ${drop}% — de ${avgRoas7d.toFixed(2)}x (média 7d) para ${todayRoas.toFixed(2)}x hoje. Pausar campanhas de baixo desempenho evita queima de budget enquanto os dados são analisados.`;
            }
            return `Queda significativa no ROAS detectada em ${platform}. Pausar campanhas de baixo desempenho é a ação recomendada.`;
        }
        case 'high_churn': {
            const highChurn = alertMeta['highChurn'] as number | undefined;
            const total = alertMeta['total'] as number | undefined;
            const pct = alertMeta['percentage'] as number | undefined;
            if (highChurn !== undefined && total !== undefined && pct !== undefined) {
                return `${highChurn} de ${total} clientes (${pct}%) estão com probabilidade de churn acima de 70%. Criar audience de reativação para o segmento de alto LTV maximiza o retorno da campanha de retenção.`;
            }
            return 'Alto percentual da base com risco de churn detectado. Recomendado criar campanha de reativação para clientes de alto LTV.';
        }
        case 'high_cac': {
            const cac = alertMeta['cac'] as number | undefined;
            const ltv = alertMeta['avgLtv'] as number | undefined;
            const totalSpend = alertMeta['totalSpend'] as number | undefined;
            if (cac !== undefined && ltv !== undefined) {
                const deficit = cac - ltv;
                return `CAC atual de R$ ${cac} está R$ ${deficit} acima do LTV médio de R$ ${ltv}${totalSpend !== undefined ? ` (gasto total: R$ ${totalSpend})` : ''}. Cada novo cliente adquirido opera no prejuízo. Revisar segmentação e criativos é urgente.`;
            }
            return 'CAC detectado acima do LTV médio da base. Aquisição operando no prejuízo — revisar canais pagos imediatamente.';
        }
        case 'budget_spike': {
            const todaySpend = alertMeta['todaySpend'] as number | undefined;
            const avgDailySpend = alertMeta['avgDailySpend'] as number | undefined;
            const multiple = alertMeta['multiple'] as number | undefined;
            if (todaySpend !== undefined && avgDailySpend !== undefined && multiple !== undefined) {
                return `Gasto de R$ ${todaySpend} hoje representa ${multiple}x a média diária de R$ ${avgDailySpend} nos últimos 30 dias. Verificar se campanhas estão rodando fora do planejado e ajustar orçamentos.`;
            }
            return 'Spike de gasto publicitário detectado. Verificar campanhas ativas e ajustar orçamentos para evitar overspend.';
        }
        case 'revenue_zero': {
            const yesterdayCount = alertMeta['yesterdayCount'] as number | undefined;
            return yesterdayCount !== undefined
                ? `Nenhuma venda registrada hoje, apesar de ${yesterdayCount} venda(s) ontem. Reativar clientes de alto LTV da base via campanha segmentada pode recuperar receita no curto prazo enquanto a causa raiz é investigada.`
                : 'Receita zerada detectada após dia com vendas. Reativar clientes de alto LTV é a ação imediata recomendada.';
        }
        default:
            return 'Ação recomendada com base em anomalia detectada pelo sistema de monitoramento.';
    }
}

function buildSources(alertType: AlertType): string[] {
    switch (alertType) {
        case 'roas_drop':
            return ['ad_metrics', 'transactions'];
        case 'high_churn':
            return ['customers', 'transactions'];
        case 'high_cac':
            return ['ad_metrics', 'customers', 'transactions'];
        case 'budget_spike':
            return ['ad_metrics'];
        case 'revenue_zero':
            return ['transactions', 'customers'];
        default:
            return ['transactions'];
    }
}

function buildPotentialImpact(alertType: AlertType, alertMeta: Record<string, unknown>): number | null {
    switch (alertType) {
        case 'roas_drop': {
            // Estimativa: gasto em ads * drop% representa impacto potencial
            const todayRoas = alertMeta['todayRoas'] as number | undefined;
            const avgRoas7d = alertMeta['avgRoas7d'] as number | undefined;
            // Sem spend disponível no meta do alerta — retorna null
            if (todayRoas !== undefined && avgRoas7d !== undefined && avgRoas7d > 0) {
                return null; // spend não disponível no alertMeta do roas_drop
            }
            return null;
        }
        case 'high_cac': {
            const cac = alertMeta['cac'] as number | undefined;
            const ltv = alertMeta['avgLtv'] as number | undefined;
            const newCustomers = alertMeta['newCustomers'] as number | undefined;
            if (cac !== undefined && ltv !== undefined && newCustomers !== undefined && cac > ltv) {
                return Math.round((cac - ltv) * newCustomers);
            }
            return null;
        }
        case 'budget_spike': {
            const todaySpend = alertMeta['todaySpend'] as number | undefined;
            const avgDailySpend = alertMeta['avgDailySpend'] as number | undefined;
            if (todaySpend !== undefined && avgDailySpend !== undefined && todaySpend > avgDailySpend) {
                return Math.round(todaySpend - avgDailySpend);
            }
            return null;
        }
        default:
            return null;
    }
}

// ── Interface pública ─────────────────────────────────────────────────────────

export async function createAlertRecommendation(params: AlertRecommendationParams): Promise<void> {
    const { profileId, alertType, alertMeta, alertSeverity } = params;

    const mapping = getMapping(alertType, alertMeta);
    if (!mapping) {
        // Tipo sem mapeamento (ex: organic_spike) — não cria recomendação
        return;
    }

    // Deduplicação: verificar se já existe recomendação pendente do mesmo tipo nas últimas 24h
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: existing } = await supabase
        .from('growth_recommendations')
        .select('id')
        .eq('profile_id', profileId)
        .eq('type', mapping.recType)
        .eq('status', 'pending')
        .gte('created_at', since)
        .limit(1)
        .single();

    if (existing) {
        console.log(`[AlertBridge] Recomendação do tipo "${mapping.recType}" já existe para profile ${profileId} — pulando`);
        return;
    }

    const title = buildTitle(alertType, alertMeta);
    const narrative = buildNarrative(alertType, alertMeta);
    const sources = buildSources(alertType);
    const potentialImpact = buildPotentialImpact(alertType, alertMeta);
    const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();

    // Campos base garantidos pelo schema
    const insertPayload: Record<string, unknown> = {
        profile_id: profileId,
        type: mapping.recType,
        status: 'pending',
        title,
        narrative,
        sources,
        meta: {
            generated_from_alert: alertType,
            alert_severity: alertSeverity,
            alert_meta: alertMeta,
        },
        // Colunas adicionadas pela migration 20260318000002
        // Se ainda não existirem no schema, o insert pode ignorá-las
        // (o catch no caller já trata erros graciosamente)
        auto_generated_from_alert: true,
        expires_at: expiresAt,
    };

    // impact_estimate é TEXT no schema real — converter para string se disponível
    if (potentialImpact !== null) {
        insertPayload['impact_estimate'] = `R$ ${potentialImpact.toLocaleString('pt-BR')}`;
    }

    const { error } = await supabase
        .from('growth_recommendations')
        .insert(insertPayload);

    if (error) {
        // Se o erro for de coluna ausente (auto_generated_from_alert / expires_at),
        // tenta novamente sem as colunas novas para não bloquear o fluxo
        if (
            error.message.includes('auto_generated_from_alert') ||
            error.message.includes('expires_at')
        ) {
            console.warn(`[AlertBridge] Colunas novas ausentes — tentando insert sem elas. Erro original: ${error.message}`);
            const fallbackPayload = { ...insertPayload };
            delete fallbackPayload['auto_generated_from_alert'];
            delete fallbackPayload['expires_at'];

            const { error: fallbackError } = await supabase
                .from('growth_recommendations')
                .insert(fallbackPayload);

            if (fallbackError) {
                console.error(`[AlertBridge] Falha no insert fallback para profile ${profileId}:`, fallbackError.message);
                return;
            }
        } else {
            console.error(`[AlertBridge] Falha ao criar recomendação para profile ${profileId}:`, error.message);
            return;
        }
    }

    console.log(
        `[AlertBridge] Recomendacao "${mapping.recType}" (${mapping.priority}) criada para profile ${profileId} a partir do alerta "${alertType}"`
    );
}
