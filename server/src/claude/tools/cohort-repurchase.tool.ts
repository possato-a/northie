import type Anthropic from '@anthropic-ai/sdk';
import { supabase } from '../../lib/supabase.js';

const fmt = (n: number) => n.toLocaleString('pt-BR', { minimumFractionDigits: 2 });

export const definition: Anthropic.Tool = {
    name: 'get_cohort_repurchase',
    description: 'Identifica cohorts de clientes entrando na janela de recompra nos próximos 7-14 dias com base no intervalo histórico.',
    input_schema: {
        type: 'object',
        properties: {
            window_days: {
                type: 'number',
                description: 'Janela de previsão em dias (padrão: 14)',
            },
        },
        required: [],
    },
};

export async function execute(input: { window_days?: number }, profileId: string): Promise<string> {
    const window = input.window_days ?? 14;

    const { data: transactions } = await supabase
        .from('transactions')
        .select('customer_id, created_at')
        .eq('profile_id', profileId)
        .eq('status', 'approved')
        .order('created_at', { ascending: true });

    if (!transactions || transactions.length < 10) return 'Dados insuficientes para análise de recompra.';

    // Agrupar transações por cliente
    const txByCustomer = new Map<string, string[]>();
    for (const tx of transactions) {
        if (!tx.customer_id) continue;
        const list = txByCustomer.get(tx.customer_id) ?? [];
        list.push(tx.created_at);
        txByCustomer.set(tx.customer_id, list);
    }

    // Calcular intervalo de recompra por cliente (apenas quem comprou 2+)
    const intervals: number[] = [];
    const customerIntervals = new Map<string, number>();

    for (const [customerId, dates] of txByCustomer) {
        if (dates.length < 2) continue;
        const sorted = dates.sort();
        let totalInterval = 0;
        let count = 0;
        for (let i = 1; i < sorted.length; i++) {
            const diff = (new Date(sorted[i]!).getTime() - new Date(sorted[i - 1]!).getTime()) / (1000 * 60 * 60 * 24);
            totalInterval += diff;
            count++;
        }
        const avg = totalInterval / count;
        intervals.push(avg);
        customerIntervals.set(customerId, avg);
    }

    if (intervals.length < 3) return 'Poucos clientes recorrentes para análise.';

    const avgInterval = intervals.reduce((s, v) => s + v, 0) / intervals.length;

    // Buscar clientes com last_purchase_at
    const { data: customers } = await supabase
        .from('customers')
        .select('id, email, total_ltv, last_purchase_at')
        .eq('profile_id', profileId)
        .not('last_purchase_at', 'is', null);

    if (!customers) return 'Sem dados de clientes.';

    const now = new Date();
    const readyForRepurchase = customers.filter(c => {
        const lastPurchase = new Date(c.last_purchase_at!);
        const daysSincePurchase = (now.getTime() - lastPurchase.getTime()) / (1000 * 60 * 60 * 24);
        const customerInterval = customerIntervals.get(c.id) ?? avgInterval;
        // Está na janela: entre 80% e 120% do intervalo + window
        return daysSincePurchase >= customerInterval * 0.8 && daysSincePurchase <= customerInterval + window;
    });

    if (readyForRepurchase.length === 0) {
        return `Nenhum cliente na janela de recompra nos próximos ${window} dias. Intervalo médio: ${Math.round(avgInterval)} dias.`;
    }

    const totalLtv = readyForRepurchase.reduce((s, c) => s + Number(c.total_ltv ?? 0), 0);

    // Agrupar por mês de aquisição (cohort)
    const cohorts = new Map<string, number>();
    for (const c of readyForRepurchase) {
        const month = c.last_purchase_at!.slice(0, 7);
        cohorts.set(month, (cohorts.get(month) ?? 0) + 1);
    }

    const lines = [
        `${readyForRepurchase.length} clientes na janela de recompra (próximos ${window} dias):`,
        `  LTV acumulado: R$ ${fmt(totalLtv)}`,
        `  Intervalo médio de recompra: ${Math.round(avgInterval)} dias`,
        '',
        'Por cohort de última compra:',
    ];

    for (const [month, count] of Array.from(cohorts.entries()).sort()) {
        lines.push(`  ${month}: ${count} clientes`);
    }

    return lines.join('\n');
}
