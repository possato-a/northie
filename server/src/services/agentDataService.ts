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
        case 'orchestrator':
        case 'health':
            return getHealthSnapshotContext(userId);
        case 'cac':
            return getCacContext(userId);
        case 'rfm':
            return getRfmContext(userId);
        case 'cohort':
            return getCohortContext(userId);
        case 'mrr':
            return getMrrContext(userId);
        case 'margin':
            return getMarginContext(userId);
        case 'reactivation':
            return getReactivationContext(userId);
        case 'correlations':
            return getCorrelationsContext(userId);
        case 'forecast':
            return getForecastContext(userId);
        case 'anomalies':
            return getAnomaliesContext(userId);
        case 'creatives':
            return getCreativesContext(userId);
        case 'ecommerce':
            return getEcommerceContext(userId);
        case 'email':
            return getEmailContext(userId);
        case 'pipeline':
            return getPipelineContext(userId);
        case 'whatsapp':
            return getWhatsAppContext(userId);
        case 'nps':
            return getNpsContext(userId);
        case 'engagement':
            return getEngagementContext(userId);
        case 'valuation':
            return getValuationContext(userId);
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

async function getRfmContext(userId: string): Promise<string> {
    const lines: string[] = [];

    // Distribuição completa de scores RFM com LTV por segmento
    const { data: rfmData, error: rfmError } = await supabase
        .from('customers')
        .select('rfm_score, total_ltv, last_purchase_at, churn_probability')
        .eq('user_id', userId);

    if (rfmError) {
        console.error('[AgentData] rfm customers error:', rfmError.message);
        lines.push('Distribuição RFM: dados indisponíveis no momento.');
        return lines.join('\n');
    }

    if (!rfmData || rfmData.length === 0) {
        lines.push('Distribuição RFM: nenhum cliente registrado ainda.');
        lines.push('O score RFM é calculado automaticamente após as primeiras transações.');
        return lines.join('\n');
    }

    const total = rfmData.length;

    // Distribuição por segmento RFM nominal (Champions, Loyal, etc.)
    const bySegment: Record<string, { count: number; sumLtv: number; sumChurn: number }> = {};
    for (const c of rfmData) {
        const seg = c.rfm_score || 'Sem score';
        if (!bySegment[seg]) bySegment[seg] = { count: 0, sumLtv: 0, sumChurn: 0 };
        bySegment[seg].count += 1;
        bySegment[seg].sumLtv += Number(c.total_ltv) || 0;
        bySegment[seg].sumChurn += Number(c.churn_probability) || 0;
    }

    const sortedSegments = Object.entries(bySegment).sort((a, b) => {
        const avgA = a[1].count > 0 ? a[1].sumLtv / a[1].count : 0;
        const avgB = b[1].count > 0 ? b[1].sumLtv / b[1].count : 0;
        return avgB - avgA;
    });

    lines.push(`Distribuição RFM da base (${total} clientes no total):`);
    lines.push('');

    for (const [segment, val] of sortedSegments) {
        const avgLtv = val.count > 0 ? val.sumLtv / val.count : 0;
        const avgChurn = val.count > 0 ? (val.sumChurn / val.count) * 100 : 0;
        const pct = total > 0 ? ((val.count / total) * 100).toFixed(1) : '0.0';
        lines.push(`Segmento: ${segment}`);
        lines.push(`— Clientes: ${val.count} (${pct}% da base)`);
        lines.push(`— LTV médio: R$ ${avgLtv.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
        lines.push(`— LTV total do segmento: R$ ${val.sumLtv.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
        lines.push(`— Churn médio do segmento: ${avgChurn.toFixed(1)}%`);
        lines.push('');
    }

    // Oportunidades de upsell por score — clientes de alto LTV com RFM médio
    const upsellCandidates = rfmData.filter(c => {
        const seg = (c.rfm_score || '').toLowerCase();
        return (
            seg.includes('potential') ||
            seg.includes('loyal') ||
            seg.includes('promising') ||
            seg === 'at_risk' ||
            seg === 'need_attention'
        );
    });

    if (upsellCandidates.length > 0) {
        const upsellLtv = upsellCandidates.reduce((s, c) => s + (Number(c.total_ltv) || 0), 0);
        const avgUpsellLtv = upsellLtv / upsellCandidates.length;
        lines.push(`Oportunidades de upsell identificadas (segmentos com potencial de upgrade):`);
        lines.push(`— Total de clientes elegíveis: ${upsellCandidates.length}`);
        lines.push(`— LTV médio deste grupo: R$ ${avgUpsellLtv.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
        lines.push(`— LTV total em jogo: R$ ${upsellLtv.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
        lines.push('');
    }

    // Clientes Champions — melhor segmento
    const champions = rfmData.filter(c =>
        c.rfm_score === 'Champions' ||
        c.rfm_score === '555' ||
        (c.rfm_score || '').toLowerCase() === 'champions'
    );

    if (champions.length > 0) {
        const championsLtv = champions.reduce((s, c) => s + (Number(c.total_ltv) || 0), 0);
        const champPct = ((champions.length / total) * 100).toFixed(1);
        lines.push(`Clientes Champions (top do RFM):`);
        lines.push(`— Quantidade: ${champions.length} (${champPct}% da base)`);
        lines.push(`— LTV total: R$ ${championsLtv.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
        lines.push(`— LTV médio: R$ ${(championsLtv / champions.length).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
        lines.push('');
    }

    // Clientes sem score calculado
    const noScore = rfmData.filter(c => !c.rfm_score).length;
    if (noScore > 0) {
        lines.push(`Clientes sem score RFM calculado ainda: ${noScore} (serão pontuados no próximo ciclo diário)`);
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

async function getHealthSnapshotContext(userId: string): Promise<string> {
    const lines: string[] = [];
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    // Receita dos últimos 30 dias de transactions
    const { data: txData, error: txError } = await supabase
        .from('transactions')
        .select('amount_net, amount_gross, platform, created_at')
        .eq('user_id', userId)
        .eq('status', 'approved')
        .gte('created_at', thirtyDaysAgo);

    if (txError) {
        console.error('[AgentData] health transactions error:', txError.message);
        lines.push('Receita (últimos 30 dias): dados indisponíveis.');
    } else if (!txData || txData.length === 0) {
        lines.push('Receita (últimos 30 dias): nenhuma transação registrada ainda.');
    } else {
        const totalNet = txData.reduce((sum, t) => sum + (Number(t.amount_net) || 0), 0);
        const totalGross = txData.reduce((sum, t) => sum + (Number(t.amount_gross) || 0), 0);
        lines.push(`Receita líquida (últimos 30 dias): R$ ${totalNet.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
        lines.push(`Receita bruta (últimos 30 dias): R$ ${totalGross.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
        lines.push(`Total de transações aprovadas: ${txData.length}`);
        // Por plataforma
        const byPlatform: Record<string, number> = {};
        for (const t of txData) {
            const p = t.platform || 'desconhecido';
            byPlatform[p] = (byPlatform[p] || 0) + (Number(t.amount_net) || 0);
        }
        lines.push('Receita por plataforma (últimos 30 dias):');
        for (const [platform, net] of Object.entries(byPlatform)) {
            lines.push(`— ${platform}: R$ ${net.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
        }
    }

    lines.push('');

    // Total de clientes
    const { count: totalCustomers, error: custCountError } = await supabase
        .from('customers')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId);

    if (custCountError) {
        lines.push('Total de clientes: dados indisponíveis.');
    } else {
        lines.push(`Total de clientes na base: ${totalCustomers ?? 0}`);
    }

    // LTV médio geral
    const { data: ltvData, error: ltvError } = await supabase
        .from('customers')
        .select('total_ltv')
        .eq('user_id', userId);

    if (!ltvError && ltvData && ltvData.length > 0) {
        const totalLtv = ltvData.reduce((sum, c) => sum + (Number(c.total_ltv) || 0), 0);
        const avgLtv = totalLtv / ltvData.length;
        lines.push(`LTV médio da base: R$ ${avgLtv.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
        lines.push(`LTV total acumulado: R$ ${totalLtv.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
    }

    lines.push('');

    // Gasto total em anúncios nos últimos 30 dias
    const thirtyDaysAgoDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const { data: adData, error: adError } = await supabase
        .from('ad_metrics')
        .select('spend_brl, platform')
        .gte('date', thirtyDaysAgoDate);

    if (adError) {
        console.error('[AgentData] health ad_metrics error:', adError.message);
        lines.push('Gasto em anúncios (últimos 30 dias): dados indisponíveis.');
    } else if (!adData || adData.length === 0) {
        lines.push('Gasto em anúncios (últimos 30 dias): nenhum dado registrado ainda.');
    } else {
        const totalSpend = adData.reduce((sum, a) => sum + (Number(a.spend_brl) || 0), 0);
        lines.push(`Gasto total em anúncios (últimos 30 dias): R$ ${totalSpend.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
        const byPlatform: Record<string, number> = {};
        for (const a of adData) {
            const p = a.platform || 'desconhecido';
            byPlatform[p] = (byPlatform[p] || 0) + (Number(a.spend_brl) || 0);
        }
        for (const [platform, spend] of Object.entries(byPlatform)) {
            lines.push(`— ${platform}: R$ ${spend.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
        }
    }

    lines.push('');

    // Top 3 canais de aquisição por receita líquida (últimos 30 dias)
    const { data: channelRevData, error: channelRevError } = await supabase
        .from('customers')
        .select('acquisition_channel, total_ltv')
        .eq('user_id', userId);

    if (!channelRevError && channelRevData && channelRevData.length > 0) {
        const byChannel: Record<string, number> = {};
        for (const c of channelRevData) {
            const ch = c.acquisition_channel || 'desconhecido';
            byChannel[ch] = (byChannel[ch] || 0) + (Number(c.total_ltv) || 0);
        }
        const top3 = Object.entries(byChannel)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3);
        lines.push('Top 3 canais de aquisição por LTV total acumulado:');
        for (const [channel, ltv] of top3) {
            lines.push(`— ${channel}: R$ ${ltv.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
        }
    } else if (channelRevError) {
        console.error('[AgentData] health channel revenue error:', channelRevError.message);
        lines.push('Top canais por receita: dados indisponíveis.');
    }

    lines.push('');

    // Recomendações de growth pendentes
    const { data: pendingRecs, error: pendingRecsError } = await supabase
        .from('growth_recommendations')
        .select('id, title, action_type')
        .eq('user_id', userId)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(5);

    if (pendingRecsError) {
        console.error('[AgentData] health growth_recommendations error:', pendingRecsError.message);
        lines.push('Recomendações de growth pendentes: dados indisponíveis.');
    } else if (!pendingRecs || pendingRecs.length === 0) {
        lines.push('Recomendações de growth pendentes de aprovação: nenhuma no momento.');
    } else {
        lines.push(`Recomendações de growth aguardando aprovação do founder: ${pendingRecs.length}`);
        for (const rec of pendingRecs) {
            lines.push(`— [${rec.action_type || 'ação'}] ${rec.title || rec.id}`);
        }
    }

    lines.push('');

    // Clientes em risco de churn
    const { count: riskCount, error: riskCountError } = await supabase
        .from('customers')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .gt('churn_probability', 0.5);

    if (riskCountError) {
        console.error('[AgentData] health churn risk count error:', riskCountError.message);
        lines.push('Clientes em risco de churn: dados indisponíveis.');
    } else {
        lines.push(`Clientes em risco de churn (prob > 50%): ${riskCount ?? 0}`);
    }

    return lines.join('\n');
}

async function getCacContext(userId: string): Promise<string> {
    const lines: string[] = [];
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    // Gasto por canal de ad_metrics nos últimos 30 dias
    const { data: adData, error: adError } = await supabase
        .from('ad_metrics')
        .select('platform, spend_brl')
        .gte('date', thirtyDaysAgo);

    if (adError) {
        console.error('[AgentData] cac ad_metrics error:', adError.message);
        lines.push('Gasto por canal (últimos 30 dias): dados indisponíveis.');
    } else if (!adData || adData.length === 0) {
        lines.push('Gasto por canal (últimos 30 dias): nenhum dado de anúncios registrado ainda.');
    } else {
        lines.push('Gasto total por canal (últimos 30 dias):');
        const byPlatform: Record<string, number> = {};
        for (const a of adData) {
            const p = a.platform || 'desconhecido';
            byPlatform[p] = (byPlatform[p] || 0) + (Number(a.spend_brl) || 0);
        }
        for (const [platform, spend] of Object.entries(byPlatform)) {
            lines.push(`— ${platform}: R$ ${spend.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
        }
    }

    lines.push('');

    // LTV por canal de aquisição de customers
    const { data: custData, error: custError } = await supabase
        .from('customers')
        .select('acquisition_channel, total_ltv')
        .eq('user_id', userId);

    if (custError) {
        console.error('[AgentData] cac customers error:', custError.message);
        lines.push('LTV por canal: dados indisponíveis.');
    } else if (!custData || custData.length === 0) {
        lines.push('LTV por canal: nenhum cliente registrado ainda.');
    } else {
        lines.push('LTV médio e volume por canal de aquisição:');
        const byChannel: Record<string, { sum: number; count: number }> = {};
        for (const c of custData) {
            const ch = c.acquisition_channel || 'desconhecido';
            if (!byChannel[ch]) byChannel[ch] = { sum: 0, count: 0 };
            byChannel[ch].sum += Number(c.total_ltv) || 0;
            byChannel[ch].count += 1;
        }
        const sorted = Object.entries(byChannel).sort((a, b) => b[1].count - a[1].count);
        for (const [channel, val] of sorted) {
            const avg = val.count > 0 ? val.sum / val.count : 0;
            lines.push(`— ${channel}: ${val.count} clientes | LTV médio R$ ${avg.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} | LTV total R$ ${val.sum.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
        }
    }

    return lines.join('\n');
}

async function getCohortContext(userId: string): Promise<string> {
    const lines: string[] = [];

    // Primeira transação por customer_id para determinar mês de aquisição
    const { data: txData, error: txError } = await supabase
        .from('transactions')
        .select('customer_id, created_at, amount_net')
        .eq('user_id', userId)
        .eq('status', 'approved')
        .order('created_at', { ascending: true });

    if (txError) {
        console.error('[AgentData] cohort transactions error:', txError.message);
        lines.push('Dados de cohort: dados indisponíveis.');
        return lines.join('\n');
    }

    if (!txData || txData.length === 0) {
        lines.push('Dados de cohort: nenhuma transação registrada ainda.');
        return lines.join('\n');
    }

    // Determinar mês de primeira compra por customer_id
    const firstPurchase: Record<string, string> = {};
    for (const t of txData) {
        if (t.customer_id && !firstPurchase[t.customer_id]) {
            const d = new Date(t.created_at);
            firstPurchase[t.customer_id] = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        }
    }

    // Agrupar clientes por cohort (mês de primeira compra)
    const cohortCount: Record<string, number> = {};
    for (const month of Object.values(firstPurchase)) {
        cohortCount[month] = (cohortCount[month] || 0) + 1;
    }

    const sortedCohorts = Object.entries(cohortCount).sort((a, b) => b[0].localeCompare(a[0])).slice(0, 12);
    lines.push('Clientes por cohort (mês de primeira compra) — últimos 12 meses:');
    for (const [month, count] of sortedCohorts) {
        lines.push(`— ${month}: ${count} clientes adquiridos`);
    }

    lines.push('');
    lines.push(`Total de clientes únicos com transações: ${Object.keys(firstPurchase).length}`);

    return lines.join('\n');
}

async function getMrrContext(userId: string): Promise<string> {
    const lines: string[] = [];

    // Transações dos últimos 90 dias agrupadas por mês
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();

    const { data: txData, error: txError } = await supabase
        .from('transactions')
        .select('amount_net, amount_gross, platform, created_at, customer_id')
        .eq('user_id', userId)
        .eq('status', 'approved')
        .gte('created_at', ninetyDaysAgo)
        .order('created_at', { ascending: true });

    if (txError) {
        console.error('[AgentData] mrr transactions error:', txError.message);
        lines.push('Dados de receita: dados indisponíveis.');
        return lines.join('\n');
    }

    if (!txData || txData.length === 0) {
        lines.push('Dados de receita (últimos 90 dias): nenhuma transação registrada ainda.');
        return lines.join('\n');
    }

    // Agrupar por mês
    const byMonth: Record<string, { net: number; gross: number; count: number; customers: Set<string> }> = {};
    for (const t of txData) {
        const d = new Date(t.created_at);
        const month = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        if (!byMonth[month]) byMonth[month] = { net: 0, gross: 0, count: 0, customers: new Set() };
        byMonth[month].net += Number(t.amount_net) || 0;
        byMonth[month].gross += Number(t.amount_gross) || 0;
        byMonth[month].count += 1;
        if (t.customer_id) byMonth[month].customers.add(t.customer_id);
    }

    const sortedMonths = Object.entries(byMonth).sort((a, b) => a[0].localeCompare(b[0]));
    lines.push('Receita mensal (últimos 90 dias):');
    for (const [month, val] of sortedMonths) {
        lines.push(`— ${month}: Receita líquida R$ ${val.net.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} | Bruta R$ ${val.gross.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} | ${val.count} transações | ${val.customers.size} clientes únicos`);
    }

    lines.push('');

    // Por plataforma nos últimos 30 dias
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const recentTx = txData.filter(t => t.created_at >= thirtyDaysAgo);
    if (recentTx.length > 0) {
        const byPlatform: Record<string, number> = {};
        for (const t of recentTx) {
            const p = t.platform || 'desconhecido';
            byPlatform[p] = (byPlatform[p] || 0) + (Number(t.amount_net) || 0);
        }
        lines.push('Receita líquida por plataforma (últimos 30 dias):');
        for (const [platform, net] of Object.entries(byPlatform)) {
            lines.push(`— ${platform}: R$ ${net.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
        }
    }

    return lines.join('\n');
}

async function getMarginContext(userId: string): Promise<string> {
    const lines: string[] = [];
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const thirtyDaysAgoDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    // Receita bruta, líquida e taxas de transactions
    const { data: txData, error: txError } = await supabase
        .from('transactions')
        .select('amount_gross, amount_net, fee_platform, platform')
        .eq('user_id', userId)
        .eq('status', 'approved')
        .gte('created_at', thirtyDaysAgo);

    if (txError) {
        console.error('[AgentData] margin transactions error:', txError.message);
        lines.push('Dados de margem: dados indisponíveis.');
    } else if (!txData || txData.length === 0) {
        lines.push('Dados de margem (últimos 30 dias): nenhuma transação registrada ainda.');
    } else {
        const totalGross = txData.reduce((sum, t) => sum + (Number(t.amount_gross) || 0), 0);
        const totalNet = txData.reduce((sum, t) => sum + (Number(t.amount_net) || 0), 0);
        const totalFees = txData.reduce((sum, t) => sum + (Number(t.fee_platform) || 0), 0);
        const grossMarginPct = totalGross > 0 ? ((totalNet / totalGross) * 100).toFixed(1) : '0.0';

        lines.push(`Receita bruta (últimos 30 dias): R$ ${totalGross.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
        lines.push(`Receita líquida após taxas: R$ ${totalNet.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
        lines.push(`Total de taxas de plataforma: R$ ${totalFees.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
        lines.push(`Margem bruta (receita líq / bruta): ${grossMarginPct}%`);

        // Por plataforma
        const byPlatform: Record<string, { gross: number; net: number; fees: number }> = {};
        for (const t of txData) {
            const p = t.platform || 'desconhecido';
            if (!byPlatform[p]) byPlatform[p] = { gross: 0, net: 0, fees: 0 };
            byPlatform[p].gross += Number(t.amount_gross) || 0;
            byPlatform[p].net += Number(t.amount_net) || 0;
            byPlatform[p].fees += Number(t.fee_platform) || 0;
        }
        lines.push('Margem por plataforma (últimos 30 dias):');
        for (const [platform, val] of Object.entries(byPlatform)) {
            const margin = val.gross > 0 ? ((val.net / val.gross) * 100).toFixed(1) : '0.0';
            lines.push(`— ${platform}: Bruta R$ ${val.gross.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} | Líquida R$ ${val.net.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} | Taxas R$ ${val.fees.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} | Margem ${margin}%`);
        }
    }

    lines.push('');

    // Gasto em anúncios nos últimos 30 dias
    const { data: adData, error: adError } = await supabase
        .from('ad_metrics')
        .select('platform, spend_brl')
        .gte('date', thirtyDaysAgoDate);

    if (adError) {
        console.error('[AgentData] margin ad_metrics error:', adError.message);
        lines.push('Gasto em anúncios (últimos 30 dias): dados indisponíveis.');
    } else if (!adData || adData.length === 0) {
        lines.push('Gasto em anúncios (últimos 30 dias): nenhum dado registrado ainda.');
    } else {
        const totalSpend = adData.reduce((sum, a) => sum + (Number(a.spend_brl) || 0), 0);
        lines.push(`Gasto total em anúncios (últimos 30 dias): R$ ${totalSpend.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
    }

    return lines.join('\n');
}

async function getReactivationContext(userId: string): Promise<string> {
    const lines: string[] = [];

    // Clientes com last_purchase_at > 90 dias atrás e total_ltv > 0
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();

    const { data: inactiveData, error: inactiveError } = await supabase
        .from('customers')
        .select('email, total_ltv, last_purchase_at, acquisition_channel, rfm_score')
        .eq('user_id', userId)
        .lt('last_purchase_at', ninetyDaysAgo)
        .gt('total_ltv', 0)
        .order('total_ltv', { ascending: false })
        .limit(25);

    if (inactiveError) {
        console.error('[AgentData] reactivation error:', inactiveError.message);
        lines.push('Clientes inativos para reativação: dados indisponíveis.');
        return lines.join('\n');
    }

    if (!inactiveData || inactiveData.length === 0) {
        lines.push('Clientes inativos com LTV > 0 (sem compra há mais de 90 dias): nenhum identificado.');
        return lines.join('\n');
    }

    const totalRecoverableRevenue = inactiveData.reduce((sum, c) => sum + (Number(c.total_ltv) || 0), 0);
    lines.push(`Clientes inativos (sem compra > 90 dias) com LTV positivo — top ${inactiveData.length} por LTV:`);
    lines.push(`LTV total acumulado deste grupo: R$ ${totalRecoverableRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
    lines.push('');

    const now = Date.now();
    for (const c of inactiveData) {
        const lastPurchase = c.last_purchase_at ? new Date(c.last_purchase_at).toLocaleDateString('pt-BR') : 'N/A';
        const diasInativo = c.last_purchase_at
            ? Math.floor((now - new Date(c.last_purchase_at).getTime()) / (24 * 60 * 60 * 1000))
            : null;
        lines.push(`— ${c.email} | LTV R$ ${Number(c.total_ltv).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} | ${c.acquisition_channel || 'N/A'} | RFM ${c.rfm_score || 'N/A'} | última compra ${lastPurchase}${diasInativo !== null ? ` (${diasInativo} dias atrás)` : ''}`);
    }

    return lines.join('\n');
}

async function getCorrelationsContext(userId: string): Promise<string> {
    const lines: string[] = [];
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();

    // LTV por canal de aquisição — cruzamento customers × canal
    const { data: custData, error: custError } = await supabase
        .from('customers')
        .select('acquisition_channel, total_ltv, rfm_score')
        .eq('user_id', userId);

    if (custError) {
        console.error('[AgentData] correlations customers error:', custError.message);
        lines.push('LTV por canal: dados indisponíveis.');
    } else if (!custData || custData.length === 0) {
        lines.push('LTV por canal: nenhum cliente registrado ainda.');
    } else {
        lines.push('LTV médio por canal de aquisição (todos os clientes):');
        const byChannel: Record<string, { sum: number; count: number; champions: number }> = {};
        for (const c of custData) {
            const ch = c.acquisition_channel || 'desconhecido';
            if (!byChannel[ch]) byChannel[ch] = { sum: 0, count: 0, champions: 0 };
            byChannel[ch].sum += Number(c.total_ltv) || 0;
            byChannel[ch].count += 1;
            if (c.rfm_score === 'Champions' || c.rfm_score === '555') byChannel[ch].champions += 1;
        }
        const sorted = Object.entries(byChannel).sort((a, b) => {
            const avgA = a[1].count > 0 ? a[1].sum / a[1].count : 0;
            const avgB = b[1].count > 0 ? b[1].sum / b[1].count : 0;
            return avgB - avgA;
        });
        for (const [channel, val] of sorted) {
            const avg = val.count > 0 ? val.sum / val.count : 0;
            const championsPct = val.count > 0 ? ((val.champions / val.count) * 100).toFixed(0) : '0';
            lines.push(`— ${channel}: LTV médio R$ ${avg.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} | ${val.count} clientes | ${championsPct}% Champions`);
        }
    }

    lines.push('');

    // Receita por plataforma nos últimos 90 dias (transactions)
    const { data: txData, error: txError } = await supabase
        .from('transactions')
        .select('platform, amount_net, customer_id')
        .eq('user_id', userId)
        .eq('status', 'approved')
        .gte('created_at', ninetyDaysAgo);

    if (txError) {
        console.error('[AgentData] correlations transactions error:', txError.message);
        lines.push('Receita por plataforma (últimos 90 dias): dados indisponíveis.');
    } else if (!txData || txData.length === 0) {
        lines.push('Receita por plataforma (últimos 90 dias): nenhuma transação registrada.');
    } else {
        const byPlatform: Record<string, { net: number; customers: Set<string> }> = {};
        for (const t of txData) {
            const p = t.platform || 'desconhecido';
            if (!byPlatform[p]) byPlatform[p] = { net: 0, customers: new Set() };
            byPlatform[p].net += Number(t.amount_net) || 0;
            if (t.customer_id) byPlatform[p].customers.add(t.customer_id);
        }
        lines.push('Receita e clientes únicos por plataforma (últimos 90 dias):');
        for (const [platform, val] of Object.entries(byPlatform)) {
            const avgPerCustomer = val.customers.size > 0 ? val.net / val.customers.size : 0;
            lines.push(`— ${platform}: R$ ${val.net.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} | ${val.customers.size} clientes únicos | ticket médio R$ ${avgPerCustomer.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
        }
    }

    lines.push('');

    // Gasto em anúncios nos últimos 90 dias por plataforma
    const ninetyDaysAgoDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const { data: adData, error: adError } = await supabase
        .from('ad_metrics')
        .select('platform, spend_brl')
        .gte('date', ninetyDaysAgoDate);

    if (!adError && adData && adData.length > 0) {
        const byPlatform: Record<string, number> = {};
        for (const a of adData) {
            const p = a.platform || 'desconhecido';
            byPlatform[p] = (byPlatform[p] || 0) + (Number(a.spend_brl) || 0);
        }
        lines.push('Gasto em ads por plataforma (últimos 90 dias):');
        for (const [platform, spend] of Object.entries(byPlatform)) {
            lines.push(`— ${platform}: R$ ${spend.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
        }
    }

    return lines.join('\n');
}

async function getForecastContext(userId: string): Promise<string> {
    const lines: string[] = [];

    // Receita dos últimos 90 dias por mês para calcular tendência
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();

    const { data: txData, error: txError } = await supabase
        .from('transactions')
        .select('amount_net, created_at, customer_id')
        .eq('user_id', userId)
        .eq('status', 'approved')
        .gte('created_at', ninetyDaysAgo)
        .order('created_at', { ascending: true });

    if (txError) {
        console.error('[AgentData] forecast transactions error:', txError.message);
        lines.push('Dados de receita para forecast: dados indisponíveis.');
        return lines.join('\n');
    }

    if (!txData || txData.length === 0) {
        lines.push('Dados de receita para forecast (últimos 90 dias): nenhuma transação registrada.');
        return lines.join('\n');
    }

    // Agrupar por mês
    const byMonth: Record<string, { net: number; customers: Set<string> }> = {};
    for (const t of txData) {
        const d = new Date(t.created_at);
        const month = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        if (!byMonth[month]) byMonth[month] = { net: 0, customers: new Set() };
        byMonth[month].net += Number(t.amount_net) || 0;
        if (t.customer_id) byMonth[month].customers.add(t.customer_id);
    }

    const months = Object.entries(byMonth).sort((a, b) => a[0].localeCompare(b[0]));
    lines.push('Receita mensal (base para forecast):');
    for (const [month, val] of months) {
        lines.push(`— ${month}: R$ ${val.net.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} | ${val.customers.size} clientes únicos`);
    }

    // Calcular crescimento MoM
    if (months.length >= 2) {
        const revenues = months.map(m => m[1].net);
        const growthRates: number[] = [];
        for (let i = 1; i < revenues.length; i++) {
            const prev = revenues[i - 1] ?? 0;
            const curr = revenues[i] ?? 0;
            if (prev > 0) {
                growthRates.push((curr - prev) / prev);
            }
        }
        if (growthRates.length > 0) {
            const avgGrowth = growthRates.reduce((a, b) => a + b, 0) / growthRates.length;
            const lastRevenue = revenues[revenues.length - 1] ?? 0;
            const forecast30 = lastRevenue * (1 + avgGrowth);
            const forecast60 = forecast30 * (1 + avgGrowth);
            const forecast90 = forecast60 * (1 + avgGrowth);
            lines.push('');
            lines.push(`Taxa de crescimento MoM média (últimos ${growthRates.length} meses): ${(avgGrowth * 100).toFixed(1)}%`);
            lines.push(`Receita do mês mais recente: R$ ${lastRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
            lines.push('Forecast baseado na taxa histórica:');
            lines.push(`— +30 dias: R$ ${forecast30.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
            lines.push(`— +60 dias: R$ ${forecast60.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
            lines.push(`— +90 dias: R$ ${forecast90.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
        }
    }

    lines.push('');

    // Churn probability distribuição para impacto de retenção
    const { data: churnData, error: churnError } = await supabase
        .from('customers')
        .select('churn_probability, total_ltv')
        .eq('user_id', userId)
        .gt('churn_probability', 0);

    if (!churnError && churnData && churnData.length > 0) {
        const highRisk = churnData.filter(c => Number(c.churn_probability) > 0.7);
        const medRisk = churnData.filter(c => Number(c.churn_probability) > 0.4 && Number(c.churn_probability) <= 0.7);
        const highRiskLtv = highRisk.reduce((s, c) => s + (Number(c.total_ltv) || 0), 0);
        const medRiskLtv = medRisk.reduce((s, c) => s + (Number(c.total_ltv) || 0), 0);
        lines.push(`Clientes com churn > 70% (risco alto): ${highRisk.length} | LTV exposto R$ ${highRiskLtv.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
        lines.push(`Clientes com churn 40–70% (risco médio): ${medRisk.length} | LTV exposto R$ ${medRiskLtv.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
    }

    return lines.join('\n');
}

async function getAnomaliesContext(userId: string): Promise<string> {
    const lines: string[] = [];
    const now = Date.now();

    // Receita: últimos 7 dias vs 7 dias anteriores (8–14 dias atrás)
    const sevenDaysAgo = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString();
    const fourteenDaysAgo = new Date(now - 14 * 24 * 60 * 60 * 1000).toISOString();

    const { data: recentTx, error: recentTxError } = await supabase
        .from('transactions')
        .select('amount_net, created_at')
        .eq('user_id', userId)
        .eq('status', 'approved')
        .gte('created_at', sevenDaysAgo);

    const { data: previousTx, error: previousTxError } = await supabase
        .from('transactions')
        .select('amount_net, created_at')
        .eq('user_id', userId)
        .eq('status', 'approved')
        .gte('created_at', fourteenDaysAgo)
        .lt('created_at', sevenDaysAgo);

    if (recentTxError || previousTxError) {
        lines.push('Dados de receita para detecção de anomalias: indisponíveis.');
    } else {
        const recentNet = (recentTx ?? []).reduce((s, t) => s + (Number(t.amount_net) || 0), 0);
        const previousNet = (previousTx ?? []).reduce((s, t) => s + (Number(t.amount_net) || 0), 0);
        const recentCount = (recentTx ?? []).length;
        const previousCount = (previousTx ?? []).length;

        lines.push('Receita — últimos 7 dias vs 7 dias anteriores:');
        lines.push(`— Últimos 7 dias: R$ ${recentNet.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} | ${recentCount} transações`);
        lines.push(`— 7 dias anteriores: R$ ${previousNet.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} | ${previousCount} transações`);
        if (previousNet > 0) {
            const delta = ((recentNet - previousNet) / previousNet * 100).toFixed(1);
            const sign = Number(delta) >= 0 ? '+' : '';
            lines.push(`— Variação: ${sign}${delta}%`);
        }
    }

    lines.push('');

    // Gasto em anúncios: últimos 7 dias vs semana anterior
    const sevenDaysAgoDate = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const fourteenDaysAgoDate = new Date(now - 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const todayDate = new Date(now).toISOString().split('T')[0];

    const { data: recentAds, error: recentAdsError } = await supabase
        .from('ad_metrics')
        .select('platform, spend_brl')
        .gte('date', sevenDaysAgoDate)
        .lte('date', todayDate);

    const { data: previousAds, error: previousAdsError } = await supabase
        .from('ad_metrics')
        .select('platform, spend_brl')
        .gte('date', fourteenDaysAgoDate)
        .lt('date', sevenDaysAgoDate);

    if (!recentAdsError && !previousAdsError) {
        const recentSpend = (recentAds ?? []).reduce((s, a) => s + (Number(a.spend_brl) || 0), 0);
        const previousSpend = (previousAds ?? []).reduce((s, a) => s + (Number(a.spend_brl) || 0), 0);
        lines.push('Gasto em ads — últimos 7 dias vs 7 dias anteriores:');
        lines.push(`— Últimos 7 dias: R$ ${recentSpend.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
        lines.push(`— 7 dias anteriores: R$ ${previousSpend.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
        if (previousSpend > 0) {
            const delta = ((recentSpend - previousSpend) / previousSpend * 100).toFixed(1);
            const sign = Number(delta) >= 0 ? '+' : '';
            lines.push(`— Variação de gasto: ${sign}${delta}%`);
        }
    }

    lines.push('');

    // Clientes com churn alto recentemente
    const { data: churnRisk, error: churnRiskError } = await supabase
        .from('customers')
        .select('email, total_ltv, churn_probability, last_purchase_at')
        .eq('user_id', userId)
        .gt('churn_probability', 0.7)
        .order('total_ltv', { ascending: false })
        .limit(10);

    if (!churnRiskError && churnRisk && churnRisk.length > 0) {
        const totalExposedLtv = churnRisk.reduce((s, c) => s + (Number(c.total_ltv) || 0), 0);
        lines.push(`Clientes com churn > 70% (top ${churnRisk.length} por LTV) — LTV total exposto R$ ${totalExposedLtv.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}:`);
        for (const c of churnRisk) {
            const churnPct = ((Number(c.churn_probability) || 0) * 100).toFixed(0);
            const lastPurchase = c.last_purchase_at ? new Date(c.last_purchase_at).toLocaleDateString('pt-BR') : 'N/A';
            lines.push(`— ${c.email} | LTV R$ ${Number(c.total_ltv).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} | churn ${churnPct}% | última compra ${lastPurchase}`);
        }
    } else if (!churnRiskError) {
        lines.push('Clientes com churn > 70%: nenhum identificado no momento.');
    }

    return lines.join('\n');
}

async function getCreativesContext(userId: string): Promise<string> {
    const lines: string[] = [];
    const twentyEightDaysAgoDate = new Date(Date.now() - 28 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    // Buscar campaign_ids do usuário para filtrar ad_metrics com segurança
    const { data: userCampaigns, error: campaignsError } = await supabase
        .from('ad_campaigns')
        .select('id')
        .eq('user_id', userId);

    if (campaignsError) {
        console.error('[AgentData] creatives ad_campaigns error:', campaignsError.message);
        lines.push('Dados de performance de campanhas (últimos 28 dias): indisponíveis no momento.');
        return lines.join('\n');
    }

    if (!userCampaigns || userCampaigns.length === 0) {
        lines.push('Dados de performance de campanhas (últimos 28 dias): nenhuma campanha registrada ainda.');
        lines.push('Os dados de criativos aparecerão automaticamente após conectar Meta Ads ou Google Ads na página de Integrações.');
        return lines.join('\n');
    }

    const campaignIds = userCampaigns.map(c => c.id);

    const { data: adMetrics, error: adError } = await supabase
        .from('ad_metrics')
        .select('campaign_id, platform, spend_brl, impressions, clicks, date')
        .in('campaign_id', campaignIds)
        .gte('date', twentyEightDaysAgoDate)
        .order('spend_brl', { ascending: false })
        .limit(50);

    if (adError) {
        console.error('[AgentData] creatives ad_metrics error:', adError.message);
        lines.push('Dados de performance de campanhas (últimos 28 dias): indisponíveis no momento.');
        return lines.join('\n');
    }

    if (!adMetrics || adMetrics.length === 0) {
        lines.push('Dados de performance de campanhas (últimos 28 dias): nenhum dado registrado ainda.');
        lines.push('Os dados de criativos aparecerão automaticamente após conectar Meta Ads ou Google Ads na página de Integrações.');
        return lines.join('\n');
    }

    // Agregar por campaign_id + platform client-side
    const aggregated: Record<string, { platform: string; spend: number; impressions: number; clicks: number }> = {};
    for (const row of adMetrics) {
        const key = `${row.campaign_id}|${row.platform}`;
        if (!aggregated[key]) {
            aggregated[key] = { platform: row.platform, spend: 0, impressions: 0, clicks: 0 };
        }
        aggregated[key].spend += Number(row.spend_brl) || 0;
        aggregated[key].impressions += Number(row.impressions) || 0;
        aggregated[key].clicks += Number(row.clicks) || 0;
    }

    const sorted = Object.entries(aggregated).sort((a, b) => b[1].spend - a[1].spend);

    const fatiguedCampaigns: string[] = [];
    const highSpendLowEngagement: string[] = [];

    lines.push('Performance de campanhas (últimos 28 dias) — proxy de criativos:');
    for (const [key, val] of sorted) {
        const campaignId = key.split('|')[0];
        const ctr = val.impressions > 0 ? (val.clicks / val.impressions) * 100 : 0;
        const cpc = val.clicks > 0 ? val.spend / val.clicks : 0;
        lines.push(`— Campanha ${campaignId} (${val.platform}): R$ ${val.spend.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} gasto | ${val.impressions.toLocaleString('pt-BR')} impressões | ${val.clicks.toLocaleString('pt-BR')} cliques | CTR ${ctr.toFixed(2)}% | CPC R$ ${cpc.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);

        if (ctr < 0.5 && val.impressions > 1000) {
            fatiguedCampaigns.push(`${campaignId} (${val.platform}) — CTR ${ctr.toFixed(2)}%`);
        }
        if (val.spend > 500 && val.clicks < 50) {
            highSpendLowEngagement.push(`${campaignId} (${val.platform}) — R$ ${val.spend.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} com apenas ${val.clicks} cliques`);
        }
    }

    lines.push('');

    if (fatiguedCampaigns.length > 0) {
        lines.push(`Campanhas com possível fadiga de criativo (CTR < 0,5% com volume expressivo): ${fatiguedCampaigns.length}`);
        for (const c of fatiguedCampaigns) {
            lines.push(`— ${c}`);
        }
    } else {
        lines.push('Campanhas com possível fadiga de criativo (CTR < 0,5%): nenhuma identificada.');
    }

    lines.push('');

    if (highSpendLowEngagement.length > 0) {
        lines.push(`Campanhas com gasto alto e baixo engajamento (revisar criativos): ${highSpendLowEngagement.length}`);
        for (const c of highSpendLowEngagement) {
            lines.push(`— ${c}`);
        }
    } else {
        lines.push('Campanhas com gasto alto e baixo volume de cliques: nenhuma identificada.');
    }

    lines.push('');
    lines.push('Nota: IDs de criativos individuais não estão disponíveis ainda — a análise é feita em nível de campanha como proxy de desempenho criativo.');

    return lines.join('\n');
}

async function getEcommerceContext(userId: string): Promise<string> {
    const lines: string[] = [];
    const now = Date.now();
    const thirtyDaysAgo = new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString();
    const ninetyDaysAgo = new Date(now - 90 * 24 * 60 * 60 * 1000).toISOString();
    const sixMonthsAgo = new Date(now - 180 * 24 * 60 * 60 * 1000).toISOString();

    const { data: shopifyTx, error: shopifyError } = await supabase
        .from('transactions')
        .select('amount_net, amount_gross, fee_platform, created_at, customer_id')
        .eq('user_id', userId)
        .eq('platform', 'shopify')
        .eq('status', 'approved')
        .order('created_at', { ascending: false });

    if (shopifyError) {
        console.error('[AgentData] ecommerce shopify transactions error:', shopifyError.message);
        lines.push('Dados de e-commerce Shopify: indisponíveis no momento.');
        return lines.join('\n');
    }

    if (!shopifyTx || shopifyTx.length === 0) {
        lines.push('Dados de e-commerce Shopify: nenhuma transação registrada ainda.');
        lines.push('Conecte sua loja Shopify na página de Integrações para que os pedidos comecem a aparecer aqui.');
        return lines.join('\n');
    }

    // Segmentar por período
    const tx30 = shopifyTx.filter(t => t.created_at >= thirtyDaysAgo);
    const tx90 = shopifyTx.filter(t => t.created_at >= ninetyDaysAgo);

    const totalAllTime = shopifyTx.reduce((s, t) => s + (Number(t.amount_net) || 0), 0);
    const total90 = tx90.reduce((s, t) => s + (Number(t.amount_net) || 0), 0);
    const total30 = tx30.reduce((s, t) => s + (Number(t.amount_net) || 0), 0);
    const aov = shopifyTx.length > 0 ? totalAllTime / shopifyTx.length : 0;

    const uniqueCustomersAll = new Set(shopifyTx.map(t => t.customer_id).filter(Boolean)).size;
    const uniqueCustomers30 = new Set(tx30.map(t => t.customer_id).filter(Boolean)).size;

    lines.push('Resumo Shopify — visão geral:');
    lines.push(`— Receita líquida total (all time): R$ ${totalAllTime.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
    lines.push(`— Receita líquida (últimos 90 dias): R$ ${total90.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
    lines.push(`— Receita líquida (últimos 30 dias): R$ ${total30.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
    lines.push(`— Total de pedidos aprovados: ${shopifyTx.length}`);
    lines.push(`— Pedidos nos últimos 30 dias: ${tx30.length}`);
    lines.push(`— Ticket médio (AOV): R$ ${aov.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
    lines.push(`— Clientes únicos (all time): ${uniqueCustomersAll}`);
    lines.push(`— Clientes únicos (últimos 30 dias): ${uniqueCustomers30}`);

    // Tendência mensal — últimos 6 meses
    const tx6m = shopifyTx.filter(t => t.created_at >= sixMonthsAgo);
    if (tx6m.length > 0) {
        const byMonth: Record<string, { net: number; count: number }> = {};
        for (const t of tx6m) {
            const d = new Date(t.created_at);
            const month = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            if (!byMonth[month]) byMonth[month] = { net: 0, count: 0 };
            byMonth[month].net += Number(t.amount_net) || 0;
            byMonth[month].count += 1;
        }
        const months = Object.entries(byMonth).sort((a, b) => a[0].localeCompare(b[0]));
        lines.push('');
        lines.push('Tendência de pedidos Shopify (últimos 6 meses):');
        for (const [month, val] of months) {
            lines.push(`— ${month}: R$ ${val.net.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} | ${val.count} pedidos`);
        }
    }

    // Taxa de recompra: clientes com mais de 1 pedido
    const purchaseCount: Record<string, number> = {};
    for (const t of shopifyTx) {
        if (t.customer_id) purchaseCount[t.customer_id] = (purchaseCount[t.customer_id] || 0) + 1;
    }
    const returning = Object.values(purchaseCount).filter(n => n > 1).length;
    const returnRate = uniqueCustomersAll > 0 ? ((returning / uniqueCustomersAll) * 100).toFixed(1) : '0.0';

    lines.push('');
    lines.push(`Taxa de recompra (clientes com 2+ pedidos): ${returnRate}% (${returning} de ${uniqueCustomersAll} clientes)`);

    return lines.join('\n');
}

async function getEmailContext(userId: string): Promise<string> {
    const lines: string[] = [];
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();

    const { data: emailData, error: emailError } = await supabase
        .from('email_campaigns')
        .select('status, subject, growth_action_id, created_at')
        .eq('profile_id', userId)
        .gte('created_at', ninetyDaysAgo)
        .order('created_at', { ascending: false });

    if (emailError) {
        console.error('[AgentData] email campaigns error:', emailError.message);
        lines.push('Dados de campanhas de email: indisponíveis no momento.');
        return lines.join('\n');
    }

    if (!emailData || emailData.length === 0) {
        lines.push('Campanhas de email (últimos 90 dias): nenhum email enviado via Northie ainda.');
        lines.push('Os emails de reativação e upsell enviados pelo Growth Engine aparecerão aqui.');
        lines.push('Para enviar emails via Northie, aprove uma ação de Growth que utilize o canal de email.');
        return lines.join('\n');
    }

    const recent30 = emailData.filter(e => e.created_at >= thirtyDaysAgo);
    const total90 = emailData.length;
    const total30 = recent30.length;

    // Contagem por status
    const statusCount: Record<string, number> = {};
    for (const e of emailData) {
        const s = e.status || 'desconhecido';
        statusCount[s] = (statusCount[s] || 0) + 1;
    }

    const sent90 = statusCount['sent'] || 0;
    const failed90 = statusCount['failed'] || 0;
    const successRate = total90 > 0 ? ((sent90 / total90) * 100).toFixed(1) : '0.0';

    lines.push('Resumo de emails enviados via Northie:');
    lines.push(`— Total de emails (últimos 90 dias): ${total90}`);
    lines.push(`— Total de emails (últimos 30 dias): ${total30}`);
    lines.push(`— Enviados com sucesso (90 dias): ${sent90}`);
    lines.push(`— Falhas de envio (90 dias): ${failed90}`);
    lines.push(`— Taxa de entrega: ${successRate}%`);

    lines.push('');
    lines.push('Distribuição por status (90 dias):');
    for (const [status, count] of Object.entries(statusCount)) {
        const pct = total90 > 0 ? ((count / total90) * 100).toFixed(1) : '0.0';
        lines.push(`— ${status}: ${count} emails (${pct}%)`);
    }

    // Ações de growth únicas
    const uniqueActions = new Set(emailData.map(e => e.growth_action_id).filter(Boolean));
    lines.push('');
    lines.push(`Campanhas de growth distintas que geraram emails: ${uniqueActions.size}`);

    // Últimos 5 assuntos
    const recentSubjects = emailData.slice(0, 5).map(e => e.subject).filter(Boolean);
    if (recentSubjects.length > 0) {
        lines.push('');
        lines.push('Últimos assuntos enviados:');
        for (const subject of recentSubjects) {
            lines.push(`— "${subject}"`);
        }
    }

    return lines.join('\n');
}

async function getPipelineContext(userId: string): Promise<string> {
    const lines: string[] = [];
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();

    const { data: meetings, error: meetingError } = await supabase
        .from('meetings')
        .select('title, started_at, duration_minutes, ai_result, ai_objections, ai_summary, linked_customer_id')
        .eq('profile_id', userId)
        .gte('started_at', ninetyDaysAgo)
        .order('started_at', { ascending: false });

    if (meetingError) {
        console.error('[AgentData] pipeline meetings error:', meetingError.message);
        lines.push('Dados de pipeline e reuniões: indisponíveis no momento.');
        return lines.join('\n');
    }

    if (!meetings || meetings.length === 0) {
        lines.push('Dados de pipeline (últimos 90 dias): nenhuma reunião registrada ainda.');
        lines.push('As reuniões aparecerão aqui automaticamente após conectar Google Calendar na página de Integrações.');
        lines.push('Reuniões transcritas via Google Meet terão análise de objeções e sinais de fechamento.');
        return lines.join('\n');
    }

    const total = meetings.length;
    const linked = meetings.filter(m => m.linked_customer_id).length;

    // Resultados de IA
    const resultCount: Record<string, number> = {};
    for (const m of meetings) {
        const r = m.ai_result || 'sem_análise';
        resultCount[r] = (resultCount[r] || 0) + 1;
    }

    const positiveCount = (resultCount['positivo'] || 0) + (resultCount['positive'] || 0);
    const negativeCount = (resultCount['negativo'] || 0) + (resultCount['negative'] || 0);
    const conversionRate = total > 0 ? ((positiveCount / total) * 100).toFixed(1) : '0.0';

    const meetingsWithDuration = meetings.filter(m => m.duration_minutes);
    const avgDuration = meetingsWithDuration.length > 0
        ? meetingsWithDuration.reduce((sum, m) => sum + (Number(m.duration_minutes) || 0), 0) / meetingsWithDuration.length
        : 0;

    lines.push('Resumo do pipeline de reuniões (últimos 90 dias):');
    lines.push(`— Total de reuniões: ${total}`);
    lines.push(`— Reuniões vinculadas a clientes: ${linked}`);
    lines.push(`— Resultado positivo (fechamento/avanço): ${positiveCount}`);
    lines.push(`— Resultado negativo (perdido): ${negativeCount}`);
    lines.push(`— Taxa de conversão estimada: ${conversionRate}%`);
    lines.push(`— Duração média: ${avgDuration.toFixed(0)} minutos`);

    lines.push('');
    lines.push('Distribuição por resultado de IA:');
    for (const [result, count] of Object.entries(resultCount)) {
        const pct = total > 0 ? ((count / total) * 100).toFixed(1) : '0.0';
        lines.push(`— ${result}: ${count} reuniões (${pct}%)`);
    }

    // Objeções mais comuns (ai_objections é jsonb — array de strings)
    const objectionCount: Record<string, number> = {};
    for (const m of meetings) {
        if (Array.isArray(m.ai_objections)) {
            for (const obj of m.ai_objections as string[]) {
                if (obj) objectionCount[obj] = (objectionCount[obj] || 0) + 1;
            }
        }
    }
    const topObjections = Object.entries(objectionCount).sort((a, b) => b[1] - a[1]).slice(0, 5);
    if (topObjections.length > 0) {
        lines.push('');
        lines.push('Objeções mais frequentes identificadas pela IA:');
        for (const [obj, count] of topObjections) {
            lines.push(`— "${obj}": ${count} ocorrências`);
        }
    }

    // Reuniões mais recentes
    lines.push('');
    lines.push('Reuniões mais recentes:');
    for (const m of meetings.slice(0, 5)) {
        const date = m.started_at ? new Date(m.started_at).toLocaleDateString('pt-BR') : 'N/A';
        const result = m.ai_result || 'sem análise';
        const duration = m.duration_minutes ? `${m.duration_minutes}min` : 'N/A';
        lines.push(`— ${date} | "${m.title || 'Sem título'}" | ${duration} | Resultado: ${result}`);
    }

    return lines.join('\n');
}

async function getWhatsAppContext(userId: string): Promise<string> {
    const lines: string[] = [];
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();

    const { data: waData, error: waError } = await supabase
        .from('whatsapp_messages')
        .select('status, template_name, growth_action_id, created_at')
        .eq('profile_id', userId)
        .gte('created_at', ninetyDaysAgo)
        .order('created_at', { ascending: false });

    if (waError) {
        console.error('[AgentData] whatsapp messages error:', waError.message);
        lines.push('Dados de campanhas WhatsApp: indisponíveis no momento.');
        return lines.join('\n');
    }

    if (!waData || waData.length === 0) {
        lines.push('Campanhas WhatsApp via Northie (últimos 90 dias): nenhuma mensagem enviada ainda.');
        lines.push('As mensagens de reativação e upsell via WhatsApp aparecerão aqui após aprovação de ações do Growth Engine.');
        lines.push('WhatsApp é o canal prioritário no Brasil — configure a Meta Business API para ativar este canal.');
        return lines.join('\n');
    }

    const recent30 = waData.filter(m => m.created_at >= thirtyDaysAgo);
    const total90 = waData.length;
    const total30 = recent30.length;

    // Status breakdown
    const statusCount: Record<string, number> = {};
    for (const m of waData) {
        const s = m.status || 'desconhecido';
        statusCount[s] = (statusCount[s] || 0) + 1;
    }

    const delivered = statusCount['delivered'] || 0;
    const sent = statusCount['sent'] || 0;
    const failed = statusCount['failed'] || 0;
    const deliveryRate = total90 > 0 ? (((delivered + sent) / total90) * 100).toFixed(1) : '0.0';

    lines.push('Resumo de mensagens WhatsApp enviadas via Northie:');
    lines.push(`— Total de mensagens (últimos 90 dias): ${total90}`);
    lines.push(`— Total de mensagens (últimos 30 dias): ${total30}`);
    lines.push(`— Entregues/enviadas: ${delivered + sent}`);
    lines.push(`— Falhas: ${failed}`);
    lines.push(`— Taxa de entrega: ${deliveryRate}%`);

    lines.push('');
    lines.push('Distribuição por status (90 dias):');
    for (const [status, count] of Object.entries(statusCount)) {
        const pct = total90 > 0 ? ((count / total90) * 100).toFixed(1) : '0.0';
        lines.push(`— ${status}: ${count} mensagens (${pct}%)`);
    }

    // Templates mais usados
    const templateCount: Record<string, number> = {};
    for (const m of waData) {
        if (m.template_name) templateCount[m.template_name] = (templateCount[m.template_name] || 0) + 1;
    }
    const topTemplates = Object.entries(templateCount).sort((a, b) => b[1] - a[1]).slice(0, 5);
    if (topTemplates.length > 0) {
        lines.push('');
        lines.push('Templates mais utilizados:');
        for (const [template, count] of topTemplates) {
            lines.push(`— "${template}": ${count} envios`);
        }
    }

    // Ações de growth distintas
    const uniqueActions = new Set(waData.map(m => m.growth_action_id).filter(Boolean));
    lines.push('');
    lines.push(`Campanhas de growth distintas que geraram mensagens WA: ${uniqueActions.size}`);

    return lines.join('\n');
}

async function getNpsContext(userId: string): Promise<string> {
    const lines: string[] = [];

    // Contexto de negócio fornecido pelo founder — pode conter dados de NPS manual
    const { data: ctxData, error: ctxError } = await supabase
        .from('business_context')
        .select('content, context_type, updated_at')
        .eq('profile_id', userId)
        .order('updated_at', { ascending: false });

    if (!ctxError && ctxData && ctxData.length > 0) {
        const npsContext = ctxData.find(c =>
            typeof c.content === 'string' &&
            c.content.toLowerCase().includes('nps')
        );
        if (npsContext) {
            lines.push('Dados de NPS fornecidos pelo founder (Contexto do Negócio):');
            lines.push(npsContext.content.slice(0, 500));
            lines.push('');
        }
    }

    // Proxy de satisfação: distribuição de churn_probability como indicador de saúde
    const { data: custHealth, error: healthError } = await supabase
        .from('customers')
        .select('churn_probability, total_ltv')
        .eq('user_id', userId);

    if (healthError) {
        console.error('[AgentData] nps customer health error:', healthError.message);
        lines.push('Saúde da base de clientes: dados indisponíveis.');
        return lines.join('\n');
    }

    if (!custHealth || custHealth.length === 0) {
        lines.push('Saúde da base de clientes: nenhum cliente registrado ainda.');
        lines.push('O score de saúde será calculado automaticamente após as primeiras transações.');
        return lines.join('\n');
    }

    const total = custHealth.length;
    const satisfied = custHealth.filter(c => Number(c.churn_probability) < 0.2).length;
    const neutral = custHealth.filter(c => Number(c.churn_probability) >= 0.2 && Number(c.churn_probability) <= 0.5).length;
    const atRisk = custHealth.filter(c => Number(c.churn_probability) > 0.5 && Number(c.churn_probability) <= 0.7).length;
    const critical = custHealth.filter(c => Number(c.churn_probability) > 0.7).length;
    const noData = custHealth.filter(c => c.churn_probability === null || c.churn_probability === undefined).length;

    const satisfiedPct = total > 0 ? ((satisfied / total) * 100).toFixed(1) : '0.0';
    const criticalPct = total > 0 ? ((critical / total) * 100).toFixed(1) : '0.0';

    // Proxy NPS = (promotores - detratores) / total × 100
    const proxyNps = total > 0 ? Math.round(((satisfied - critical) / total) * 100) : 0;

    const satisfiedLtv = custHealth
        .filter(c => Number(c.churn_probability) < 0.2)
        .reduce((s, c) => s + (Number(c.total_ltv) || 0), 0);
    const criticalLtv = custHealth
        .filter(c => Number(c.churn_probability) > 0.7)
        .reduce((s, c) => s + (Number(c.total_ltv) || 0), 0);

    lines.push('Saúde da base de clientes (proxy de satisfação via churn_probability):');
    lines.push(`— Total de clientes analisados: ${total}`);
    lines.push(`— Saudáveis (churn < 20%): ${satisfied} clientes (${satisfiedPct}%) | LTV R$ ${satisfiedLtv.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
    lines.push(`— Neutros (churn 20–50%): ${neutral} clientes (${total > 0 ? ((neutral / total) * 100).toFixed(1) : '0.0'}%)`);
    lines.push(`— Em risco (churn 50–70%): ${atRisk} clientes (${total > 0 ? ((atRisk / total) * 100).toFixed(1) : '0.0'}%)`);
    lines.push(`— Críticos (churn > 70%): ${critical} clientes (${criticalPct}%) | LTV exposto R$ ${criticalLtv.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
    if (noData > 0) lines.push(`— Sem score calculado ainda: ${noData} clientes`);
    lines.push('');
    lines.push(`Proxy de NPS (promotores − detratores): ${proxyNps > 0 ? '+' : ''}${proxyNps} (referência: acima de +30 é positivo)`);
    lines.push('');
    lines.push('Nota: para NPS real, adicione dados de pesquisa no Contexto do Negócio ou integre com Hotmart (formulários pós-compra). O score acima é calculado a partir do modelo de churn da Northie como proxy de satisfação.');

    return lines.join('\n');
}

async function getEngagementContext(userId: string): Promise<string> {
    const lines: string[] = [];
    const now = Date.now();
    const thirtyDaysAgo = new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString();
    const sixtyDaysAgo = new Date(now - 60 * 24 * 60 * 60 * 1000).toISOString();
    const ninetyDaysAgo = new Date(now - 90 * 24 * 60 * 60 * 1000).toISOString();
    const sixMonthsAgo = new Date(now - 180 * 24 * 60 * 60 * 1000).toISOString();

    const { data: customers, error: custError } = await supabase
        .from('customers')
        .select('total_ltv, last_purchase_at, created_at')
        .eq('user_id', userId);

    if (custError) {
        console.error('[AgentData] engagement customers error:', custError.message);
        lines.push('Dados de engajamento da base: indisponíveis no momento.');
        return lines.join('\n');
    }

    if (!customers || customers.length === 0) {
        lines.push('Dados de engajamento: nenhum cliente registrado ainda.');
        return lines.join('\n');
    }

    const total = customers.length;

    // Distribuição de recência
    const recency0_30 = customers.filter(c => c.last_purchase_at && c.last_purchase_at >= thirtyDaysAgo).length;
    const recency31_60 = customers.filter(c => {
        if (!c.last_purchase_at) return false;
        return c.last_purchase_at < thirtyDaysAgo && c.last_purchase_at >= sixtyDaysAgo;
    }).length;
    const recency61_90 = customers.filter(c => {
        if (!c.last_purchase_at) return false;
        return c.last_purchase_at < sixtyDaysAgo && c.last_purchase_at >= ninetyDaysAgo;
    }).length;
    const recency90plus = customers.filter(c => c.last_purchase_at && c.last_purchase_at < ninetyDaysAgo).length;
    const neverPurchased = customers.filter(c => !c.last_purchase_at).length;

    lines.push('Distribuição de recência da base de clientes:');
    lines.push(`— Ativos (compra nos últimos 30 dias): ${recency0_30} clientes (${total > 0 ? ((recency0_30 / total) * 100).toFixed(1) : '0.0'}%)`);
    lines.push(`— Recentes (31–60 dias): ${recency31_60} clientes (${total > 0 ? ((recency31_60 / total) * 100).toFixed(1) : '0.0'}%)`);
    lines.push(`— Esfriando (61–90 dias): ${recency61_90} clientes (${total > 0 ? ((recency61_90 / total) * 100).toFixed(1) : '0.0'}%)`);
    lines.push(`— Inativos (90+ dias): ${recency90plus} clientes (${total > 0 ? ((recency90plus / total) * 100).toFixed(1) : '0.0'}%)`);
    if (neverPurchased > 0) lines.push(`— Sem compra registrada: ${neverPurchased} clientes`);

    lines.push('');

    // Clientes novos vs recorrentes nos últimos 30 dias
    const { data: recentTx, error: txError } = await supabase
        .from('transactions')
        .select('customer_id, created_at')
        .eq('user_id', userId)
        .eq('status', 'approved')
        .gte('created_at', ninetyDaysAgo);

    if (!txError && recentTx && recentTx.length > 0) {
        const tx30 = recentTx.filter(t => t.created_at >= thirtyDaysAgo);
        const allCustomerIds30 = new Set(tx30.map(t => t.customer_id).filter(Boolean));

        const purchasedBefore30 = new Set(
            recentTx
                .filter(t => t.created_at < thirtyDaysAgo && t.customer_id)
                .map(t => t.customer_id)
        );
        const returning30 = [...allCustomerIds30].filter(id => purchasedBefore30.has(id)).length;
        const new30 = allCustomerIds30.size - returning30;

        lines.push('Clientes ativos nos últimos 30 dias:');
        lines.push(`— Total de clientes únicos com compra: ${allCustomerIds30.size}`);
        lines.push(`— Novos compradores no período: ${new30}`);
        lines.push(`— Compradores recorrentes no período: ${returning30}`);
        const returnRatePct = allCustomerIds30.size > 0 ? ((returning30 / allCustomerIds30.size) * 100).toFixed(1) : '0.0';
        lines.push(`— Taxa de recorrência no período: ${returnRatePct}%`);
    }

    lines.push('');

    // Retenção de cohort: clientes adquiridos há 6+ meses ainda comprando
    const oldCustomers = customers.filter(c => c.created_at && c.created_at < sixMonthsAgo);
    const stillActive = oldCustomers.filter(c => c.last_purchase_at && c.last_purchase_at >= ninetyDaysAgo).length;
    const retentionRate = oldCustomers.length > 0 ? ((stillActive / oldCustomers.length) * 100).toFixed(1) : 'N/A';

    lines.push('Retenção de cohort (clientes adquiridos há 6+ meses ainda comprando nos últimos 90 dias):');
    lines.push(`— Clientes na coorte (adquiridos há 6+ meses): ${oldCustomers.length}`);
    lines.push(`— Ainda ativos (compra nos últimos 90 dias): ${stillActive}`);
    lines.push(`— Taxa de retenção de longo prazo: ${retentionRate}%`);

    return lines.join('\n');
}

async function getValuationContext(userId: string): Promise<string> {
    const lines: string[] = [];
    const sixMonthsAgo = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString();

    const { data: txData, error: txError } = await supabase
        .from('transactions')
        .select('amount_net, amount_gross, fee_platform, created_at')
        .eq('user_id', userId)
        .eq('status', 'approved')
        .gte('created_at', sixMonthsAgo)
        .order('created_at', { ascending: true });

    if (txError) {
        console.error('[AgentData] valuation transactions error:', txError.message);
        lines.push('Dados de valuation: indisponíveis no momento.');
        return lines.join('\n');
    }

    if (!txData || txData.length === 0) {
        lines.push('Dados de valuation (últimos 6 meses): nenhuma transação registrada ainda.');
        lines.push('O valuation estimado do negócio será calculado automaticamente após os primeiros meses de dados.');
        return lines.join('\n');
    }

    // Agrupar por mês
    const byMonth: Record<string, { net: number; gross: number }> = {};
    for (const t of txData) {
        const d = new Date(t.created_at);
        const month = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        if (!byMonth[month]) byMonth[month] = { net: 0, gross: 0 };
        byMonth[month].net += Number(t.amount_net) || 0;
        byMonth[month].gross += Number(t.amount_gross) || 0;
    }

    const months = Object.entries(byMonth).sort((a, b) => a[0].localeCompare(b[0]));
    const revenues = months.map(m => m[1].net);

    // MRR = média dos últimos 3 meses disponíveis
    const last3 = revenues.slice(-3);
    const mrr = last3.length > 0 ? last3.reduce((a, b) => a + b, 0) / last3.length : 0;
    const arr = mrr * 12;

    // Crescimento MoM
    const growthRates: number[] = [];
    for (let i = 1; i < revenues.length; i++) {
        const prev = revenues[i - 1] ?? 0;
        const curr = revenues[i] ?? 0;
        if (prev > 0) growthRates.push(((curr - prev) / prev) * 100);
    }
    const avgGrowth = growthRates.length > 0 ? growthRates.reduce((a, b) => a + b, 0) / growthRates.length : 0;

    // Margem bruta = net/gross
    const totalNet = txData.reduce((s, t) => s + (Number(t.amount_net) || 0), 0);
    const totalGross = txData.reduce((s, t) => s + (Number(t.amount_gross) || 0), 0);
    const grossMarginPct = totalGross > 0 ? (totalNet / totalGross) * 100 : 0;

    // Rule of 40: crescimento MoM anualizado + margem
    const growthAnnualized = avgGrowth * 12;
    const ruleOf40 = growthAnnualized + grossMarginPct;

    lines.push('Métricas de valuation do negócio (últimos 6 meses):');
    lines.push('');
    lines.push('Receita mensal:');
    for (const [month, val] of months) {
        lines.push(`— ${month}: R$ ${val.net.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} líquido | R$ ${val.gross.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} bruto`);
    }

    lines.push('');
    lines.push('Indicadores financeiros principais:');
    lines.push(`— MRR (média dos últimos 3 meses): R$ ${mrr.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
    lines.push(`— ARR (MRR × 12): R$ ${arr.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
    lines.push(`— Crescimento MoM médio (${growthRates.length} meses): ${avgGrowth >= 0 ? '+' : ''}${avgGrowth.toFixed(1)}%`);
    lines.push(`— Crescimento anualizado estimado: ${growthAnnualized >= 0 ? '+' : ''}${growthAnnualized.toFixed(1)}%`);
    lines.push(`— Margem bruta (net/gross, 6 meses): ${grossMarginPct.toFixed(1)}%`);
    lines.push(`— Rule of 40 (crescimento anual + margem): ${ruleOf40.toFixed(1)} (${ruleOf40 >= 40 ? 'saudável — acima de 40' : 'abaixo de 40 — foco em eficiência ou crescimento'})`);

    lines.push('');
    lines.push('Múltiplos de valuation estimados:');
    lines.push(`— SaaS conservador (4× ARR): R$ ${(arr * 4).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
    lines.push(`— SaaS mediano (6× ARR): R$ ${(arr * 6).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
    lines.push(`— E-commerce conservador (1,5× ARR): R$ ${(arr * 1.5).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
    lines.push(`— E-commerce mediano (2,5× ARR): R$ ${(arr * 2.5).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);

    lines.push('');

    // Qualidade da base de clientes como fator de qualidade
    const { data: custData, error: custError } = await supabase
        .from('customers')
        .select('rfm_score, churn_probability, total_ltv')
        .eq('user_id', userId);

    if (!custError && custData && custData.length > 0) {
        const totalCust = custData.length;
        const champions = custData.filter(c => c.rfm_score === 'Champions' || c.rfm_score === '555').length;
        const lowChurn = custData.filter(c => Number(c.churn_probability) < 0.2).length;
        const avgLtv = custData.reduce((s, c) => s + (Number(c.total_ltv) || 0), 0) / totalCust;
        const avgChurn = custData.reduce((s, c) => s + (Number(c.churn_probability) || 0), 0) / totalCust;

        lines.push('Qualidade da base de clientes (fatores de valuation):');
        lines.push(`— Total de clientes: ${totalCust}`);
        lines.push(`— LTV médio da base: R$ ${avgLtv.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
        lines.push(`— Clientes Champions (RFM 555): ${champions} (${totalCust > 0 ? ((champions / totalCust) * 100).toFixed(1) : '0.0'}%)`);
        lines.push(`— Clientes saudáveis (churn < 20%): ${lowChurn} (${totalCust > 0 ? ((lowChurn / totalCust) * 100).toFixed(1) : '0.0'}%)`);
        lines.push(`— Churn médio da base: ${(avgChurn * 100).toFixed(1)}%`);
    }

    lines.push('');
    lines.push('Nota: valuation estimado com base em múltiplos de mercado para negócios digitais brasileiros. Fatores qualitativos como produto, mercado endereçável e equipe não estão incluídos neste cálculo automatizado.');

    return lines.join('\n');
}
