import type Anthropic from '@anthropic-ai/sdk';
import { supabase } from '../../lib/supabase.js';

const fmt = (n: number) => n.toLocaleString('pt-BR', { minimumFractionDigits: 2 });

export const definition: Anthropic.Tool = {
    name: 'get_reactivation_candidates',
    description: 'Identifica clientes Champions (RFM alto) que estão fora da janela de recompra — prontos para reativação via email ou WhatsApp. Mostra quantidade, LTV acumulado e tempo sem compra.',
    input_schema: {
        type: 'object',
        properties: {
            min_rfm_score: {
                type: 'number',
                description: 'Score RFM mínimo (1-5, padrão: 4)',
            },
        },
        required: [],
    },
};

export async function execute(input: { min_rfm_score?: number }, profileId: string): Promise<string> {
    const minRfm = input.min_rfm_score ?? 4;

    const { data: customers } = await supabase
        .from('customers')
        .select('id, email, total_ltv, rfm_score, last_purchase_at, churn_probability')
        .eq('profile_id', profileId)
        .not('last_purchase_at', 'is', null);

    if (!customers || customers.length === 0) return 'Sem clientes com dados de compra.';

    // Calcular intervalo médio de recompra
    const now = new Date();
    const diasSemCompra = customers.map(c => ({
        ...c,
        dias: (now.getTime() - new Date(c.last_purchase_at!).getTime()) / (1000 * 60 * 60 * 24),
    }));

    const avgInterval = diasSemCompra.reduce((s, c) => s + c.dias, 0) / diasSemCompra.length;

    // Filtrar Champions fora da janela (> 1.5x intervalo médio)
    const candidates = diasSemCompra.filter(c => {
        const rfmNum = c.rfm_score ? parseInt(c.rfm_score.charAt(0), 10) : 0;
        return rfmNum >= minRfm && c.dias > avgInterval * 1.5;
    }).sort((a, b) => b.total_ltv - a.total_ltv);

    if (candidates.length === 0) {
        return `Nenhum Champion (RFM ≥ ${minRfm}) fora da janela de recompra. Intervalo médio: ${Math.round(avgInterval)} dias.`;
    }

    const totalLtv = candidates.reduce((s, c) => s + Number(c.total_ltv ?? 0), 0);
    const avgChurn = candidates.reduce((s, c) => s + Number(c.churn_probability ?? 0), 0) / candidates.length;

    const lines = [
        `${candidates.length} Champions prontos para reativação:`,
        `  LTV acumulado: R$ ${fmt(totalLtv)}`,
        `  Churn médio do grupo: ${(avgChurn * 100).toFixed(0)}%`,
        `  Intervalo médio de recompra: ${Math.round(avgInterval)} dias`,
        '',
        'Top 10 por LTV:',
    ];

    for (const c of candidates.slice(0, 10)) {
        lines.push(`  ${c.email} — LTV R$ ${fmt(c.total_ltv)} | ${Math.round(c.dias)} dias sem compra | Churn ${(Number(c.churn_probability ?? 0) * 100).toFixed(0)}%`);
    }

    return lines.join('\n');
}
