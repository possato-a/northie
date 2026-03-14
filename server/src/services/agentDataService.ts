import { supabase } from '../lib/supabase.js';

/**
 * Fetches real data from Supabase for each agent and returns a formatted
 * text string to be injected into the Claude system prompt.
 */
export async function getAgentContext(userId: string, agentId: string): Promise<string> {
    switch (agentId) {
        case 'roas':
            return getRoasContext(userId);
        case 'churn':
            return getChurnContext(userId);
        case 'ltv':
            return getLtvContext(userId);
        case 'audience':
            return getAudienceContext(userId);
        case 'upsell':
            return getUpsellContext(userId);
        default:
            return 'Nenhum dado disponível para este agente.';
    }
}

async function getRoasContext(userId: string): Promise<string> {
    const lines: string[] = [];

    // TODO: implementar quando ad_metrics tiver user_id diretamente via JOIN com campaigns
    // ad_metrics não possui user_id — por enquanto retorna dados globais limitados
    const { data: adData, error: adError } = await supabase
        .from('ad_metrics')
        .select('campaign_id, platform, spend_brl, date')
        .gte('date', new Date(Date.now() - 28 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
        .order('spend_brl', { ascending: false })
        .limit(10);

    if (adError) {
        console.error('[AgentData] roas ad_metrics error:', adError.message);
        lines.push('Gastos por campanha (últimas 4 semanas): dados indisponíveis no momento.');
    } else if (!adData || adData.length === 0) {
        lines.push('Gastos por campanha (últimas 4 semanas): nenhum dado de anúncios registrado ainda.');
    } else {
        lines.push('Gastos por campanha (últimas 4 semanas):');
        // Aggregate by campaign_id + platform client-side since we can't use GROUP BY via supabase-js directly
        const aggregated: Record<string, { platform: string; spend: number }> = {};
        for (const row of adData) {
            const key = `${row.campaign_id}|${row.platform}`;
            if (!aggregated[key]) aggregated[key] = { platform: row.platform, spend: 0 };
            aggregated[key].spend += Number(row.spend_brl) || 0;
        }
        const sorted = Object.entries(aggregated).sort((a, b) => b[1].spend - a[1].spend);
        for (const [key, val] of sorted) {
            const campaignId = key.split('|')[0];
            lines.push(`— Campanha ${campaignId} (${val.platform}): R$ ${val.spend.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} gasto`);
        }
    }

    lines.push('');

    // LTV médio por canal nos últimos 90 dias
    const { data: ltvData, error: ltvError } = await supabase
        .from('customers')
        .select('acquisition_channel, total_ltv')
        .eq('user_id', userId)
        .gte('created_at', new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString());

    if (ltvError) {
        console.error('[AgentData] roas customers ltv error:', ltvError.message);
        lines.push('LTV médio por canal (últimos 90 dias): dados indisponíveis.');
    } else if (!ltvData || ltvData.length === 0) {
        lines.push('LTV médio por canal (últimos 90 dias): nenhum cliente registrado ainda.');
    } else {
        lines.push('LTV médio por canal (últimos 90 dias):');
        const byChannel: Record<string, { sum: number; count: number }> = {};
        for (const row of ltvData) {
            const ch = row.acquisition_channel || 'desconhecido';
            if (!byChannel[ch]) byChannel[ch] = { sum: 0, count: 0 };
            byChannel[ch].sum += Number(row.total_ltv) || 0;
            byChannel[ch].count += 1;
        }
        for (const [channel, val] of Object.entries(byChannel)) {
            const avg = val.count > 0 ? val.sum / val.count : 0;
            lines.push(`— ${channel}: LTV médio R$ ${avg.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} | ${val.count} clientes`);
        }
    }

    return lines.join('\n');
}

async function getChurnContext(userId: string): Promise<string> {
    const lines: string[] = [];

    // Contagem de clientes por segmento RFM
    const { data: rfmData, error: rfmError } = await supabase
        .from('customers')
        .select('rfm_score, total_ltv')
        .eq('user_id', userId);

    if (rfmError) {
        console.error('[AgentData] churn rfm error:', rfmError.message);
        lines.push('Segmentação RFM: dados indisponíveis no momento.');
    } else if (!rfmData || rfmData.length === 0) {
        lines.push('Segmentação RFM: nenhum cliente registrado ainda.');
    } else {
        lines.push('Distribuição RFM da base:');
        const byRfm: Record<string, { count: number; sumLtv: number }> = {};
        for (const row of rfmData) {
            const score = row.rfm_score || 'N/A';
            if (!byRfm[score]) byRfm[score] = { count: 0, sumLtv: 0 };
            byRfm[score].count += 1;
            byRfm[score].sumLtv += Number(row.total_ltv) || 0;
        }
        for (const [score, val] of Object.entries(byRfm)) {
            const avg = val.count > 0 ? val.sumLtv / val.count : 0;
            lines.push(`— RFM ${score}: ${val.count} clientes | LTV médio R$ ${avg.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
        }
    }

    lines.push('');

    // Top 10 clientes com maior churn_probability e maior LTV
    const { data: riskData, error: riskError } = await supabase
        .from('customers')
        .select('email, total_ltv, churn_probability, last_purchase_at, acquisition_channel')
        .eq('user_id', userId)
        .gt('churn_probability', 0.5)
        .order('total_ltv', { ascending: false })
        .limit(10);

    if (riskError) {
        console.error('[AgentData] churn risk error:', riskError.message);
        lines.push('Clientes em risco de churn: dados indisponíveis.');
    } else if (!riskData || riskData.length === 0) {
        lines.push('Clientes em risco de churn (prob > 50%): nenhum identificado no momento.');
    } else {
        lines.push(`Clientes de alto LTV em risco de churn (prob > 50%) — top ${riskData.length}:`);
        for (const c of riskData) {
            const lastPurchase = c.last_purchase_at ? new Date(c.last_purchase_at).toLocaleDateString('pt-BR') : 'N/A';
            const churnPct = ((Number(c.churn_probability) || 0) * 100).toFixed(0);
            lines.push(`— ${c.email} | LTV R$ ${Number(c.total_ltv).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} | churn ${churnPct}% | ${c.acquisition_channel || 'N/A'} | última compra ${lastPurchase}`);
        }
    }

    return lines.join('\n');
}

async function getLtvContext(userId: string): Promise<string> {
    const lines: string[] = [];

    // LTV médio por canal
    const { data: channelData, error: channelError } = await supabase
        .from('customers')
        .select('acquisition_channel, total_ltv')
        .eq('user_id', userId);

    if (channelError) {
        console.error('[AgentData] ltv channel error:', channelError.message);
        lines.push('LTV médio por canal: dados indisponíveis.');
    } else if (!channelData || channelData.length === 0) {
        lines.push('LTV médio por canal: nenhum cliente registrado ainda.');
    } else {
        lines.push('LTV médio por canal de aquisição:');
        const byChannel: Record<string, { sum: number; count: number }> = {};
        for (const row of channelData) {
            const ch = row.acquisition_channel || 'desconhecido';
            if (!byChannel[ch]) byChannel[ch] = { sum: 0, count: 0 };
            byChannel[ch].sum += Number(row.total_ltv) || 0;
            byChannel[ch].count += 1;
        }
        const sorted = Object.entries(byChannel).sort((a, b) => {
            const avgA = a[1].count > 0 ? a[1].sum / a[1].count : 0;
            const avgB = b[1].count > 0 ? b[1].sum / b[1].count : 0;
            return avgB - avgA;
        });
        for (const [channel, val] of sorted) {
            const avg = val.count > 0 ? val.sum / val.count : 0;
            lines.push(`— ${channel}: LTV médio R$ ${avg.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} | ${val.count} clientes`);
        }
    }

    lines.push('');

    // Top 20 clientes por LTV
    const { data: topData, error: topError } = await supabase
        .from('customers')
        .select('email, total_ltv, acquisition_channel, rfm_score')
        .eq('user_id', userId)
        .order('total_ltv', { ascending: false })
        .limit(20);

    if (topError) {
        console.error('[AgentData] ltv top customers error:', topError.message);
        lines.push('Top clientes por LTV: dados indisponíveis.');
    } else if (!topData || topData.length === 0) {
        lines.push('Top clientes por LTV: nenhum cliente registrado ainda.');
    } else {
        lines.push(`Top ${topData.length} clientes por LTV:`);
        for (const c of topData) {
            lines.push(`— ${c.email} | LTV R$ ${Number(c.total_ltv).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} | ${c.acquisition_channel || 'N/A'} | RFM ${c.rfm_score || 'N/A'}`);
        }
    }

    return lines.join('\n');
}

async function getAudienceContext(userId: string): Promise<string> {
    const lines: string[] = [];

    // Segmentos RFM com LTV total e médio
    const { data: rfmData, error: rfmError } = await supabase
        .from('customers')
        .select('rfm_score, total_ltv')
        .eq('user_id', userId);

    if (rfmError) {
        console.error('[AgentData] audience rfm error:', rfmError.message);
        lines.push('Segmentos RFM: dados indisponíveis.');
    } else if (!rfmData || rfmData.length === 0) {
        lines.push('Segmentos RFM: nenhum cliente registrado ainda.');
    } else {
        lines.push('Segmentos RFM — qualidade de audiência:');
        const byRfm: Record<string, { count: number; sumLtv: number }> = {};
        for (const row of rfmData) {
            const score = row.rfm_score || 'N/A';
            if (!byRfm[score]) byRfm[score] = { count: 0, sumLtv: 0 };
            byRfm[score].count += 1;
            byRfm[score].sumLtv += Number(row.total_ltv) || 0;
        }
        const sorted = Object.entries(byRfm).sort((a, b) => {
            const avgA = a[1].count > 0 ? a[1].sumLtv / a[1].count : 0;
            const avgB = b[1].count > 0 ? b[1].sumLtv / b[1].count : 0;
            return avgB - avgA;
        });
        for (const [score, val] of sorted) {
            const avg = val.count > 0 ? val.sumLtv / val.count : 0;
            lines.push(`— RFM ${score}: ${val.count} clientes | LTV médio R$ ${avg.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} | LTV total R$ ${val.sumLtv.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
        }
    }

    lines.push('');

    // Total de clientes ativos nos últimos 90 dias
    const { count, error: activeError } = await supabase
        .from('customers')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .gte('last_purchase_at', new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString());

    if (activeError) {
        console.error('[AgentData] audience active customers error:', activeError.message);
        lines.push('Clientes ativos (últimos 90 dias): dados indisponíveis.');
    } else {
        lines.push(`Clientes ativos nos últimos 90 dias: ${count ?? 0}`);
    }

    return lines.join('\n');
}

async function getUpsellContext(userId: string): Promise<string> {
    const lines: string[] = [];

    // Clientes na janela de recompra: compraram entre 20 e 45 dias atrás
    const now = Date.now();
    const from = new Date(now - 45 * 24 * 60 * 60 * 1000).toISOString();
    const to = new Date(now - 20 * 24 * 60 * 60 * 1000).toISOString();

    const { data: upsellData, error: upsellError } = await supabase
        .from('customers')
        .select('email, total_ltv, last_purchase_at, acquisition_channel')
        .eq('user_id', userId)
        .gte('last_purchase_at', from)
        .lte('last_purchase_at', to)
        .order('total_ltv', { ascending: false })
        .limit(20);

    if (upsellError) {
        console.error('[AgentData] upsell error:', upsellError.message);
        lines.push('Clientes na janela de recompra (20–45 dias): dados indisponíveis.');
    } else if (!upsellData || upsellData.length === 0) {
        lines.push('Clientes na janela de recompra (última compra entre 20 e 45 dias atrás): nenhum identificado.');
    } else {
        lines.push(`Clientes na janela de recompra — última compra entre 20 e 45 dias atrás (top ${upsellData.length} por LTV):`);
        for (const c of upsellData) {
            const lastPurchase = c.last_purchase_at ? new Date(c.last_purchase_at).toLocaleDateString('pt-BR') : 'N/A';
            const diasAtras = c.last_purchase_at
                ? Math.floor((now - new Date(c.last_purchase_at).getTime()) / (24 * 60 * 60 * 1000))
                : null;
            lines.push(`— ${c.email} | LTV R$ ${Number(c.total_ltv).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} | ${c.acquisition_channel || 'N/A'} | última compra ${lastPurchase}${diasAtras !== null ? ` (${diasAtras} dias atrás)` : ''}`);
        }
    }

    return lines.join('\n');
}
