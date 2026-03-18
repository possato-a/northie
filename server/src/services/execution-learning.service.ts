/**
 * @file services/execution-learning.service.ts
 *
 * Loop de aprendizado pós-execução do Growth Engine.
 *
 * Detecta quando um cliente que recebeu uma mensagem de execução realizou uma
 * compra aprovada APÓS a data de envio — e marca isso como conversão.
 * Agrega as estatísticas por recomendação para feedback contínuo ao motor.
 */

import { supabase } from '../lib/supabase.js';

// ── Tipos internos ────────────────────────────────────────────────────────────

interface ConversionResult {
    checked: number;
    converted: number;
    revenue: number;
}

interface ExecutionItem {
    id: string;
    customer_id: string;
    created_at: string;
    recommendation_id: string;
}

interface Transaction {
    amount_net: number;
    created_at: string;
}

// ── Serviço ───────────────────────────────────────────────────────────────────

export class ExecutionLearningService {
    /**
     * Para um profile, busca todos os execution_items enviados há mais de 2 dias
     * e ainda não marcados como convertidos.
     *
     * Para cada item, verifica se o customer fez alguma compra (transactions.status='approved')
     * DEPOIS da data de criação do item.
     *
     * Se sim, marca converted=true, converted_at, converted_value (soma das transações).
     *
     * Retorna: { checked: number, converted: number, revenue: number }
     */
    static async checkConversions(profileId: string): Promise<ConversionResult> {
        const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();

        // Busca itens enviados há mais de 2 dias, ainda não convertidos, com customer vinculado
        const { data: items, error } = await supabase
            .from('growth_execution_items')
            .select('id, customer_id, created_at, recommendation_id')
            .eq('profile_id', profileId)
            .in('status', ['sent', 'delivered'])
            .eq('converted', false)
            .lt('created_at', twoDaysAgo)
            .not('customer_id', 'is', null);

        if (error) {
            console.error(
                `[ExecutionLearning] Erro ao buscar execution_items para profile ${profileId}:`,
                error.message
            );
            return { checked: 0, converted: 0, revenue: 0 };
        }

        if (!items || items.length === 0) {
            return { checked: 0, converted: 0, revenue: 0 };
        }

        const execItems = items as ExecutionItem[];
        let converted = 0;
        let totalRevenue = 0;

        for (const item of execItems) {
            const { data: transactions, error: txError } = await supabase
                .from('transactions')
                .select('amount_net, created_at')
                .eq('customer_id', item.customer_id)
                .eq('profile_id', profileId)
                .eq('status', 'approved')
                .gt('created_at', item.created_at)
                .order('created_at', { ascending: true });

            if (txError) {
                console.warn(
                    `[ExecutionLearning] Erro ao buscar transações para customer ${item.customer_id}:`,
                    txError.message
                );
                continue;
            }

            if (!transactions || transactions.length === 0) continue;

            const txs = transactions as Transaction[];
            const firstTx = txs[0]!;
            const convertedValue = txs.reduce((sum, t) => sum + Number(t.amount_net), 0);

            const { error: updateError } = await supabase
                .from('growth_execution_items')
                .update({
                    converted: true,
                    converted_at: firstTx.created_at,
                    converted_value: Number(convertedValue.toFixed(2)),
                    updated_at: new Date().toISOString(),
                })
                .eq('id', item.id);

            if (updateError) {
                console.error(
                    `[ExecutionLearning] Falha ao atualizar conversão do item ${item.id}:`,
                    updateError.message
                );
                continue;
            }

            converted++;
            totalRevenue += convertedValue;
        }

        return {
            checked: execItems.length,
            converted,
            revenue: Number(totalRevenue.toFixed(2)),
        };
    }

    /**
     * Agrega stats de conversão por recommendation_id e atualiza
     * growth_recommendations.meta com:
     * {
     *   conversion_stats: {
     *     total_sent: number,
     *     total_converted: number,
     *     conversion_rate: number,
     *     total_revenue_generated: number
     *   }
     * }
     */
    static async aggregateRecommendationStats(profileId: string): Promise<void> {
        // Busca todos os execution_items do profile agrupados por recommendation
        const { data: items, error } = await supabase
            .from('growth_execution_items')
            .select('recommendation_id, converted, converted_value')
            .eq('profile_id', profileId)
            .in('status', ['sent', 'delivered', 'failed'])
            .not('recommendation_id', 'is', null);

        if (error) {
            console.error(
                `[ExecutionLearning] Erro ao buscar itens para aggregation (profile ${profileId}):`,
                error.message
            );
            return;
        }

        if (!items || items.length === 0) return;

        // Agrupa por recommendation_id
        const statsMap = new Map<
            string,
            { total_sent: number; total_converted: number; total_revenue: number }
        >();

        for (const item of items) {
            const recId = item.recommendation_id as string;
            if (!recId) continue;

            const existing = statsMap.get(recId) ?? {
                total_sent: 0,
                total_converted: 0,
                total_revenue: 0,
            };

            existing.total_sent++;
            if (item.converted) {
                existing.total_converted++;
                existing.total_revenue += Number(item.converted_value ?? 0);
            }

            statsMap.set(recId, existing);
        }

        // Atualiza cada recomendação com merge no campo meta
        for (const [recId, stats] of statsMap.entries()) {
            const conversionRate =
                stats.total_sent > 0
                    ? Number((stats.total_converted / stats.total_sent).toFixed(4))
                    : 0;

            const conversionStats = {
                total_sent: stats.total_sent,
                total_converted: stats.total_converted,
                conversion_rate: conversionRate,
                total_revenue_generated: Number(stats.total_revenue.toFixed(2)),
            };

            // Busca meta atual para fazer merge sem sobrescrever outros campos
            const { data: rec, error: fetchError } = await supabase
                .from('growth_recommendations')
                .select('meta')
                .eq('id', recId)
                .eq('profile_id', profileId)
                .single();

            if (fetchError || !rec) continue;

            const currentMeta = (rec.meta as Record<string, unknown>) ?? {};
            const updatedMeta = { ...currentMeta, conversion_stats: conversionStats };

            const { error: updateError } = await supabase
                .from('growth_recommendations')
                .update({ meta: updatedMeta })
                .eq('id', recId)
                .eq('profile_id', profileId);

            if (updateError) {
                console.warn(
                    `[ExecutionLearning] Falha ao atualizar meta da recomendação ${recId}:`,
                    updateError.message
                );
            }
        }
    }
}
