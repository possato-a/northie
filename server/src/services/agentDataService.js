import { supabase } from '../lib/supabase.js';
/**
 * Fetches real data from Supabase for each agent and returns a formatted
 * text string to be injected into the Claude system prompt.
 */
export async function getAgentContext(userId, agentId) {
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
            return getAudienceContext(userId);
        case 'cohort':
            return getCohortContext(userId);
        case 'mrr':
            return getMrrContext(userId);
        case 'margin':
            return getMarginContext(userId);
        case 'reactivation':
            return getReactivationContext(userId);
        case 'creatives':
        case 'ecommerce':
        case 'email':
        case 'pipeline':
        case 'whatsapp':
        case 'nps':
        case 'engagement':
        case 'valuation':
            return `// TODO: dados de ${agentId} não disponíveis ainda — as tabelas necessárias serão implementadas em fase futura.\nResponda com base nas informações que o founder fornecer na conversa e use benchmarks do mercado digital brasileiro.`;
        default:
            return 'Nenhum dado disponível para este agente.';
    }
}
async function getRoasContext(userId) {
    const lines = [];
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
    }
    else if (!adData || adData.length === 0) {
        lines.push('Gastos por campanha (últimas 4 semanas): nenhum dado de anúncios registrado ainda.');
    }
    else {
        lines.push('Gastos por campanha (últimas 4 semanas):');
        // Aggregate by campaign_id + platform client-side since we can't use GROUP BY via supabase-js directly
        const aggregated = {};
        for (const row of adData) {
            const key = `${row.campaign_id}|${row.platform}`;
            if (!aggregated[key])
                aggregated[key] = { platform: row.platform, spend: 0 };
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
    }
    else if (!ltvData || ltvData.length === 0) {
        lines.push('LTV médio por canal (últimos 90 dias): nenhum cliente registrado ainda.');
    }
    else {
        lines.push('LTV médio por canal (últimos 90 dias):');
        const byChannel = {};
        for (const row of ltvData) {
            const ch = row.acquisition_channel || 'desconhecido';
            if (!byChannel[ch])
                byChannel[ch] = { sum: 0, count: 0 };
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
async function getChurnContext(userId) {
    const lines = [];
    // Contagem de clientes por segmento RFM
    const { data: rfmData, error: rfmError } = await supabase
        .from('customers')
        .select('rfm_score, total_ltv')
        .eq('user_id', userId);
    if (rfmError) {
        console.error('[AgentData] churn rfm error:', rfmError.message);
        lines.push('Segmentação RFM: dados indisponíveis no momento.');
    }
    else if (!rfmData || rfmData.length === 0) {
        lines.push('Segmentação RFM: nenhum cliente registrado ainda.');
    }
    else {
        lines.push('Distribuição RFM da base:');
        const byRfm = {};
        for (const row of rfmData) {
            const score = row.rfm_score || 'N/A';
            if (!byRfm[score])
                byRfm[score] = { count: 0, sumLtv: 0 };
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
    }
    else if (!riskData || riskData.length === 0) {
        lines.push('Clientes em risco de churn (prob > 50%): nenhum identificado no momento.');
    }
    else {
        lines.push(`Clientes de alto LTV em risco de churn (prob > 50%) — top ${riskData.length}:`);
        for (const c of riskData) {
            const lastPurchase = c.last_purchase_at ? new Date(c.last_purchase_at).toLocaleDateString('pt-BR') : 'N/A';
            const churnPct = ((Number(c.churn_probability) || 0) * 100).toFixed(0);
            lines.push(`— ${c.email} | LTV R$ ${Number(c.total_ltv).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} | churn ${churnPct}% | ${c.acquisition_channel || 'N/A'} | última compra ${lastPurchase}`);
        }
    }
    return lines.join('\n');
}
async function getLtvContext(userId) {
    const lines = [];
    // LTV médio por canal
    const { data: channelData, error: channelError } = await supabase
        .from('customers')
        .select('acquisition_channel, total_ltv')
        .eq('user_id', userId);
    if (channelError) {
        console.error('[AgentData] ltv channel error:', channelError.message);
        lines.push('LTV médio por canal: dados indisponíveis.');
    }
    else if (!channelData || channelData.length === 0) {
        lines.push('LTV médio por canal: nenhum cliente registrado ainda.');
    }
    else {
        lines.push('LTV médio por canal de aquisição:');
        const byChannel = {};
        for (const row of channelData) {
            const ch = row.acquisition_channel || 'desconhecido';
            if (!byChannel[ch])
                byChannel[ch] = { sum: 0, count: 0 };
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
    }
    else if (!topData || topData.length === 0) {
        lines.push('Top clientes por LTV: nenhum cliente registrado ainda.');
    }
    else {
        lines.push(`Top ${topData.length} clientes por LTV:`);
        for (const c of topData) {
            lines.push(`— ${c.email} | LTV R$ ${Number(c.total_ltv).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} | ${c.acquisition_channel || 'N/A'} | RFM ${c.rfm_score || 'N/A'}`);
        }
    }
    return lines.join('\n');
}
async function getAudienceContext(userId) {
    const lines = [];
    // Segmentos RFM com LTV total e médio
    const { data: rfmData, error: rfmError } = await supabase
        .from('customers')
        .select('rfm_score, total_ltv')
        .eq('user_id', userId);
    if (rfmError) {
        console.error('[AgentData] audience rfm error:', rfmError.message);
        lines.push('Segmentos RFM: dados indisponíveis.');
    }
    else if (!rfmData || rfmData.length === 0) {
        lines.push('Segmentos RFM: nenhum cliente registrado ainda.');
    }
    else {
        lines.push('Segmentos RFM — qualidade de audiência:');
        const byRfm = {};
        for (const row of rfmData) {
            const score = row.rfm_score || 'N/A';
            if (!byRfm[score])
                byRfm[score] = { count: 0, sumLtv: 0 };
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
    }
    else {
        lines.push(`Clientes ativos nos últimos 90 dias: ${count ?? 0}`);
    }
    return lines.join('\n');
}
async function getUpsellContext(userId) {
    const lines = [];
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
    }
    else if (!upsellData || upsellData.length === 0) {
        lines.push('Clientes na janela de recompra (última compra entre 20 e 45 dias atrás): nenhum identificado.');
    }
    else {
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
async function getHealthSnapshotContext(userId) {
    const lines = [];
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
    }
    else if (!txData || txData.length === 0) {
        lines.push('Receita (últimos 30 dias): nenhuma transação registrada ainda.');
    }
    else {
        const totalNet = txData.reduce((sum, t) => sum + (Number(t.amount_net) || 0), 0);
        const totalGross = txData.reduce((sum, t) => sum + (Number(t.amount_gross) || 0), 0);
        lines.push(`Receita líquida (últimos 30 dias): R$ ${totalNet.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
        lines.push(`Receita bruta (últimos 30 dias): R$ ${totalGross.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
        lines.push(`Total de transações aprovadas: ${txData.length}`);
        // Por plataforma
        const byPlatform = {};
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
    }
    else {
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
    }
    else if (!adData || adData.length === 0) {
        lines.push('Gasto em anúncios (últimos 30 dias): nenhum dado registrado ainda.');
    }
    else {
        const totalSpend = adData.reduce((sum, a) => sum + (Number(a.spend_brl) || 0), 0);
        lines.push(`Gasto total em anúncios (últimos 30 dias): R$ ${totalSpend.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
        const byPlatform = {};
        for (const a of adData) {
            const p = a.platform || 'desconhecido';
            byPlatform[p] = (byPlatform[p] || 0) + (Number(a.spend_brl) || 0);
        }
        for (const [platform, spend] of Object.entries(byPlatform)) {
            lines.push(`— ${platform}: R$ ${spend.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
        }
    }
    return lines.join('\n');
}
async function getCacContext(userId) {
    const lines = [];
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    // Gasto por canal de ad_metrics nos últimos 30 dias
    const { data: adData, error: adError } = await supabase
        .from('ad_metrics')
        .select('platform, spend_brl')
        .gte('date', thirtyDaysAgo);
    if (adError) {
        console.error('[AgentData] cac ad_metrics error:', adError.message);
        lines.push('Gasto por canal (últimos 30 dias): dados indisponíveis.');
    }
    else if (!adData || adData.length === 0) {
        lines.push('Gasto por canal (últimos 30 dias): nenhum dado de anúncios registrado ainda.');
    }
    else {
        lines.push('Gasto total por canal (últimos 30 dias):');
        const byPlatform = {};
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
    }
    else if (!custData || custData.length === 0) {
        lines.push('LTV por canal: nenhum cliente registrado ainda.');
    }
    else {
        lines.push('LTV médio e volume por canal de aquisição:');
        const byChannel = {};
        for (const c of custData) {
            const ch = c.acquisition_channel || 'desconhecido';
            if (!byChannel[ch])
                byChannel[ch] = { sum: 0, count: 0 };
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
async function getCohortContext(userId) {
    const lines = [];
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
    const firstPurchase = {};
    for (const t of txData) {
        if (t.customer_id && !firstPurchase[t.customer_id]) {
            const d = new Date(t.created_at);
            firstPurchase[t.customer_id] = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        }
    }
    // Agrupar clientes por cohort (mês de primeira compra)
    const cohortCount = {};
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
async function getMrrContext(userId) {
    const lines = [];
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
    const byMonth = {};
    for (const t of txData) {
        const d = new Date(t.created_at);
        const month = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        if (!byMonth[month])
            byMonth[month] = { net: 0, gross: 0, count: 0, customers: new Set() };
        byMonth[month].net += Number(t.amount_net) || 0;
        byMonth[month].gross += Number(t.amount_gross) || 0;
        byMonth[month].count += 1;
        if (t.customer_id)
            byMonth[month].customers.add(t.customer_id);
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
        const byPlatform = {};
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
async function getMarginContext(userId) {
    const lines = [];
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
    }
    else if (!txData || txData.length === 0) {
        lines.push('Dados de margem (últimos 30 dias): nenhuma transação registrada ainda.');
    }
    else {
        const totalGross = txData.reduce((sum, t) => sum + (Number(t.amount_gross) || 0), 0);
        const totalNet = txData.reduce((sum, t) => sum + (Number(t.amount_net) || 0), 0);
        const totalFees = txData.reduce((sum, t) => sum + (Number(t.fee_platform) || 0), 0);
        const grossMarginPct = totalGross > 0 ? ((totalNet / totalGross) * 100).toFixed(1) : '0.0';
        lines.push(`Receita bruta (últimos 30 dias): R$ ${totalGross.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
        lines.push(`Receita líquida após taxas: R$ ${totalNet.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
        lines.push(`Total de taxas de plataforma: R$ ${totalFees.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
        lines.push(`Margem bruta (receita líq / bruta): ${grossMarginPct}%`);
        // Por plataforma
        const byPlatform = {};
        for (const t of txData) {
            const p = t.platform || 'desconhecido';
            if (!byPlatform[p])
                byPlatform[p] = { gross: 0, net: 0, fees: 0 };
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
    }
    else if (!adData || adData.length === 0) {
        lines.push('Gasto em anúncios (últimos 30 dias): nenhum dado registrado ainda.');
    }
    else {
        const totalSpend = adData.reduce((sum, a) => sum + (Number(a.spend_brl) || 0), 0);
        lines.push(`Gasto total em anúncios (últimos 30 dias): R$ ${totalSpend.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
    }
    return lines.join('\n');
}
async function getReactivationContext(userId) {
    const lines = [];
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
//# sourceMappingURL=agentDataService.js.map