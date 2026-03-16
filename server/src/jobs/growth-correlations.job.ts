/**
 * @file jobs/growth-correlations.job.ts
 * Motor de correlações do Northie Growth. Detecta oportunidades cruzando
 * 2+ fontes de dados e persiste recomendações em growth_recommendations.
 * Roda imediatamente ao iniciar + a cada 30 minutos.
 */

import { supabase } from '../lib/supabase.js';

// ── Shared type for prefetched customers ─────────────────────────────────────
type CustomerRow = {
    id: string;
    email: string;
    total_ltv: number;
    cac: number;
    churn_probability: number;
    rfm_score: string | null;
    acquisition_channel: string | null;
    last_purchase_at: string | null;
};

// ── Mutex — impede execução simultânea ────────────────────────────────────────
let isRunning = false;

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
    | 'em_risco_alto_valor';

async function upsertRecommendation(
    profileId: string,
    type: RecType,
    payload: {
        title: string;
        narrative: string;
        impact_estimate: string;
        sources: string[];
        meta: Record<string, unknown>;
    }
): Promise<void> {
    // Deduplicação: não criar nova rec do mesmo tipo se já existe pending/approved nas últimas 24h
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: existing } = await supabase
        .from('growth_recommendations')
        .select('id')
        .eq('profile_id', profileId)
        .eq('type', type)
        .in('status', ['pending', 'approved', 'executing'])
        .gte('created_at', since)
        .limit(1)
        .single();

    if (existing) return;

    const { error } = await supabase.from('growth_recommendations').insert({
        profile_id: profileId,
        type,
        status: 'pending',
        ...payload,
    });

    if (error) {
        console.error(`[Growth] Failed to insert rec ${type} for ${profileId}:`, error);
    } else {
        console.log(`[Growth] ✦ Nova recomendação: ${payload.title} (profile: ${profileId})`);
    }
}

// ── Detector 1: Reativação de clientes de alto LTV ────────────────────────────
// Fontes: customers (LTV, churn_probability, last_purchase_at) + transactions (histórico)
async function detectReativacaoAltoLtv(profileId: string, allCustomers: CustomerRow[]): Promise<void> {
    if (!allCustomers.length) return;

    const avgLtv = allCustomers.reduce((s, c) => s + Number(c.total_ltv), 0) / allCustomers.length;
    if (avgLtv <= 0) return;

    const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString();

    const segment = allCustomers.filter(c =>
        Number(c.total_ltv) >= avgLtv * 2 &&
        Number(c.churn_probability) >= 60 &&
        c.last_purchase_at != null &&
        c.last_purchase_at < sixtyDaysAgo
    ).slice(0, 100);

    if (segment.length < 3) return;

    const totalLtv = segment.reduce((s, c) => s + Number(c.total_ltv), 0);
    const avgSegLtv = totalLtv / segment.length;

    await upsertRecommendation(profileId, 'reativacao_alto_ltv', {
        title: `Reativar ${segment.length} clientes de alto LTV em risco`,
        narrative: `${segment.length} clientes com LTV médio de R$ ${avgSegLtv.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} (${Math.round(avgSegLtv / avgLtv)}x acima da média) não compram há mais de 60 dias e têm churn > 60%. Cruzando LTV histórico com comportamento recente, uma campanha de reativação direcionada tem potencial significativo antes que esses clientes sejam perdidos definitivamente.`,
        impact_estimate: `~R$ ${(avgSegLtv * segment.length * 0.3).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} em receita recuperável (estimativa conservadora de 30% de conversão)`,
        sources: ['customers.total_ltv', 'customers.churn_probability', 'transactions.last_purchase_at'],
        meta: {
            segment_count: segment.length,
            avg_ltv: avgSegLtv,
            global_avg_ltv: avgLtv,
            customer_ids: segment.map(c => c.id),
            customer_emails: segment.map(c => c.email),
        },
    });
}

// ── Detector 2: Pausa de campanha com LTV baixo ───────────────────────────────
// Fontes: ad_campaigns/ad_metrics (ROAS, spend) + customers (LTV por canal de aquisição)
async function detectPausaCampanhaLtvBaixo(profileId: string, allCustomers: CustomerRow[]): Promise<void> {
    const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]!;

    const { data: campaigns } = await supabase
        .from('ad_campaigns')
        .select('campaign_id, campaign_name, platform, spend_brl')
        .eq('profile_id', profileId)
        .eq('level', 'campaign')
        .gte('date', fourteenDaysAgo)
        .gt('spend_brl', 0);

    if (!campaigns?.length) return;

    // Agregar spend por campaign_id externo (cada linha é um dia de dados)
    const campaignSpend: Record<string, { spend: number; name: string; platform: string; campaign_id_external: string }> = {};
    for (const c of campaigns) {
        const key = c.campaign_id;
        if (!campaignSpend[key]) {
            campaignSpend[key] = { spend: 0, name: c.campaign_name, platform: c.platform, campaign_id_external: c.campaign_id };
        }
        campaignSpend[key]!.spend += Number(c.spend_brl);
    }

    // LTV médio global
    if (!allCustomers.length) return;

    const globalAvgLtv = allCustomers.reduce((s, c) => s + Number(c.total_ltv), 0) / allCustomers.length;

    // LTV médio por canal
    const ltvByChannel: Record<string, { sum: number; count: number }> = {};
    for (const c of allCustomers) {
        const ch = c.acquisition_channel || 'desconhecido';
        if (!ltvByChannel[ch]) ltvByChannel[ch] = { sum: 0, count: 0 };
        ltvByChannel[ch]!.sum += Number(c.total_ltv);
        ltvByChannel[ch]!.count += 1;
    }

    // Checar campanhas com spend > R$500 onde o LTV do canal é < 50% da média global
    const badCampaigns = [];
    for (const [id, data] of Object.entries(campaignSpend)) {
        if (data.spend < 500) continue;

        const channelKey = data.platform === 'meta' ? 'meta_ads' : data.platform === 'google' ? 'google_ads' : data.platform;
        const channelLtv = ltvByChannel[channelKey];
        if (!channelLtv || channelLtv.count < 5) continue;

        const avgChannelLtv = channelLtv.sum / channelLtv.count;
        if (avgChannelLtv < globalAvgLtv * 0.5) {
            badCampaigns.push({ id, ...data, channelLtv: avgChannelLtv });
        }
    }

    if (!badCampaigns.length) return;

    const worstCampaign = badCampaigns[0]!;
    const totalSpend = badCampaigns.reduce((s, c) => s + c.spend, 0);

    await upsertRecommendation(profileId, 'pausa_campanha_ltv_baixo', {
        title: `Pausar ${badCampaigns.length} campanha(s) com LTV abaixo da média`,
        narrative: `${badCampaigns.length} campanha(s) no ${worstCampaign.platform === 'meta' ? 'Meta Ads' : 'Google Ads'} gastaram R$ ${totalSpend.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} nos últimos 14 dias, mas o LTV médio dos clientes adquiridos por esse canal (R$ ${worstCampaign.channelLtv.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}) é menos de 50% do LTV médio global (R$ ${globalAvgLtv.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}). ROAS aparentemente saudável, mas os clientes gerados valem menos a longo prazo.`,
        impact_estimate: `Economia de ~R$ ${(totalSpend * 2).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}/mês se budget for realocado para canais de maior LTV`,
        sources: ['ad_campaigns.spend_brl', 'customers.total_ltv', 'customers.acquisition_channel'],
        meta: {
            campaigns: badCampaigns,
            global_avg_ltv: globalAvgLtv,
            total_spend_14d: totalSpend,
        },
    });
}

// ── Detector 3: Audience Sync dos Champions ───────────────────────────────────
// Fontes: customers (rfm_score Champions) + integrations (Meta ativa)
async function detectAudienceSyncChampions(profileId: string, allCustomers: CustomerRow[]): Promise<void> {
    // Verifica se tem integração Meta ativa
    const { data: metaIntegration } = await supabase
        .from('integrations')
        .select('id, status')
        .eq('profile_id', profileId)
        .eq('platform', 'meta')
        .eq('status', 'active')
        .single();

    if (!metaIntegration) return;

    // Buscar Champions (rfm_score >= 444 — score alto em todas as dimensões)
    const champions = allCustomers.filter(c =>
        Number(c.total_ltv) >= 0 && c.rfm_score != null
    );

    if (!champions.length) return;

    // Champions: R >= 4 AND F >= 4 AND M >= 4 (rfm_score é TEXT "RFM" ex: "545")
    const championSegment = champions.filter(c => {
        const rfmStr = c.rfm_score as string | null;
        if (!rfmStr || rfmStr.length !== 3) return false;
        const r = parseInt(rfmStr[0]!);
        const f = parseInt(rfmStr[1]!);
        const m = parseInt(rfmStr[2]!);
        return r >= 4 && f >= 3 && m >= 3; // rfmSegment() usa r>=4 f>=3 m>=3 para Champions
    });

    if (championSegment.length < 5) return;

    const avgLtv = championSegment.reduce((s, c) => s + Number(c.total_ltv), 0) / championSegment.length;

    await upsertRecommendation(profileId, 'audience_sync_champions', {
        title: `Sincronizar ${championSegment.length} Champions com o Meta Ads`,
        narrative: `Você tem ${championSegment.length} clientes Champions (score RFM máximo — compram com frequência, recentemente, e de alto valor) com LTV médio de R$ ${avgLtv.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}. Sincronizar essa audiência com o Meta como Lookalike Audience direciona seus anúncios para pessoas com perfil financeiro similar aos seus melhores clientes — não apenas comportamental.`,
        impact_estimate: `Audiência de qualidade superior baseada em LTV real, não apenas comportamento de clique`,
        sources: ['customers.rfm_score', 'customers.total_ltv', 'integrations.meta'],
        meta: {
            champion_count: championSegment.length,
            avg_ltv: avgLtv,
            customer_ids: championSegment.map(c => c.id),
            customer_emails: championSegment.map(c => c.email),
        },
    });
}

// ── Detector 4: Realocação de Budget ─────────────────────────────────────────
// Fontes: ad_metrics (spend por canal) + customers (LTV médio por acquisition_channel)
async function detectReaLocacaoBudget(profileId: string, allCustomers: CustomerRow[]): Promise<void> {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]!;

    const { data: metrics } = await supabase
        .from('ad_metrics')
        .select('platform, spend_brl')
        .eq('profile_id', profileId)
        .gte('date', thirtyDaysAgo);

    if (!metrics?.length) return;

    // Spend por canal nos últimos 30 dias
    const spendByChannel: Record<string, number> = {};
    for (const m of metrics) {
        if (!spendByChannel[m.platform]) spendByChannel[m.platform] = 0;
        spendByChannel[m.platform]! += Number(m.spend_brl);
    }

    const activeChannels = Object.keys(spendByChannel).filter(ch => spendByChannel[ch]! > 0);
    if (activeChannels.length < 2) return;

    // LTV médio por canal de aquisição
    if (!allCustomers.length) return;

    const ltvByChannel: Record<string, { sum: number; count: number }> = {};
    for (const c of allCustomers) {
        const ch = c.acquisition_channel || 'desconhecido';
        if (!ltvByChannel[ch]) ltvByChannel[ch] = { sum: 0, count: 0 };
        ltvByChannel[ch]!.sum += Number(c.total_ltv);
        ltvByChannel[ch]!.count += 1;
    }

    // Mapear plataformas de ads para acquisition_channel
    const platformToChannel: Record<string, string> = {
        meta: 'meta_ads',
        google: 'google_ads',
    };

    const channelData = activeChannels
        .map(platform => {
            const channelKey = platformToChannel[platform] || platform;
            const ltv = ltvByChannel[channelKey];
            if (!ltv || ltv.count < 5) return null;
            return {
                platform,
                spend: spendByChannel[platform]!,
                avg_ltv: ltv.sum / ltv.count,
                customer_count: ltv.count,
            };
        })
        .filter(Boolean) as Array<{ platform: string; spend: number; avg_ltv: number; customer_count: number }>;

    if (channelData.length < 2) return;

    const maxLtv = Math.max(...channelData.map(c => c.avg_ltv));
    const minLtv = Math.min(...channelData.map(c => c.avg_ltv));

    if (maxLtv <= minLtv * 1.4) return; // diferença < 40% não justifica realocação

    const bestChannel = channelData.find(c => c.avg_ltv === maxLtv)!;
    const worstChannel = channelData.find(c => c.avg_ltv === minLtv)!;

    const platformLabel = (p: string) => p === 'meta' ? 'Meta Ads' : p === 'google' ? 'Google Ads' : p;
    const ltvDiffPct = Math.round(((maxLtv - minLtv) / minLtv) * 100);

    await upsertRecommendation(profileId, 'realocacao_budget', {
        title: `Realocar budget: ${platformLabel(bestChannel.platform)} gera ${ltvDiffPct}% mais LTV`,
        narrative: `Clientes adquiridos via ${platformLabel(bestChannel.platform)} têm LTV médio de R$ ${bestChannel.avg_ltv.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}, enquanto ${platformLabel(worstChannel.platform)} gera R$ ${worstChannel.avg_ltv.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} por cliente — uma diferença de ${ltvDiffPct}%. Com R$ ${worstChannel.spend.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} gastos em ${platformLabel(worstChannel.platform)} nos últimos 30 dias, uma realocação parcial para ${platformLabel(bestChannel.platform)} pode aumentar significativamente o LTV médio da base.`,
        impact_estimate: `+${ltvDiffPct}% em LTV médio dos novos clientes adquiridos`,
        sources: ['ad_metrics.spend_brl', 'ad_metrics.platform', 'customers.total_ltv', 'customers.acquisition_channel'],
        meta: {
            channels: channelData,
            best_channel: bestChannel,
            worst_channel: worstChannel,
            ltv_diff_pct: ltvDiffPct,
        },
    });
}

// ── Detector 5: Upsell de Cohort ──────────────────────────────────────────────
// Fontes: customers (cohort mensal) + transactions (padrão de intervalo de recompra)
async function detectUpsellCohort(profileId: string): Promise<void> {
    const { data: transactions } = await supabase
        .from('transactions')
        .select('customer_id, created_at')
        .eq('profile_id', profileId)
        .eq('status', 'approved')
        .order('customer_id')
        .order('created_at');

    if (!transactions || transactions.length < 20) return;

    // Calcular intervalo médio de recompra por cliente
    const txByCustomer: Record<string, string[]> = {};
    for (const tx of transactions) {
        if (!txByCustomer[tx.customer_id]) txByCustomer[tx.customer_id] = [];
        txByCustomer[tx.customer_id]!.push(tx.created_at);
    }

    // Clientes com 2+ compras — calcular intervalo médio
    const intervals: number[] = [];
    for (const [, dates] of Object.entries(txByCustomer)) {
        if (dates.length < 2) continue;
        for (let i = 1; i < dates.length; i++) {
            const diff = (new Date(dates[i]!).getTime() - new Date(dates[i - 1]!).getTime()) / (1000 * 60 * 60 * 24);
            intervals.push(diff);
        }
    }

    if (intervals.length < 5) return;

    const avgInterval = intervals.reduce((s, v) => s + v, 0) / intervals.length;
    if (avgInterval <= 0) return;

    // Janela de oportunidade: clientes que passaram 70-130% do intervalo médio desde a última compra
    const minWindow = avgInterval * 0.7;
    const maxWindow = avgInterval * 1.3;
    const now = Date.now();

    const opportunityCustomerIds: string[] = [];
    for (const [customerId, dates] of Object.entries(txByCustomer)) {
        const lastPurchase = new Date(dates[dates.length - 1]!).getTime();
        const daysSince = (now - lastPurchase) / (1000 * 60 * 60 * 24);
        if (daysSince >= minWindow && daysSince <= maxWindow) {
            opportunityCustomerIds.push(customerId);
        }
    }

    if (opportunityCustomerIds.length < 5) return;

    // Buscar dados dos clientes no segmento
    const { data: segmentCustomers } = await supabase
        .from('customers')
        .select('id, email, total_ltv')
        .eq('profile_id', profileId)
        .in('id', opportunityCustomerIds.slice(0, 100));

    if (!segmentCustomers?.length) return;

    const avgLtv = segmentCustomers.reduce((s, c) => s + Number(c.total_ltv), 0) / segmentCustomers.length;

    await upsertRecommendation(profileId, 'upsell_cohort', {
        title: `${opportunityCustomerIds.length} clientes no momento ideal de recompra`,
        narrative: `Analisando o padrão histórico de recompra da sua base, o intervalo médio entre compras é de ${Math.round(avgInterval)} dias. Há ${opportunityCustomerIds.length} clientes que estão exatamente nessa janela agora — compraram há ${Math.round(minWindow)}–${Math.round(maxWindow)} dias. Alcançá-los neste momento específico é significativamente mais eficaz do que uma campanha genérica.`,
        impact_estimate: `~R$ ${(avgLtv * opportunityCustomerIds.length * 0.25).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} estimados (25% de conversão no segmento)`,
        sources: ['customers.cohort', 'transactions.created_at', 'transactions.customer_id'],
        meta: {
            segment_count: opportunityCustomerIds.length,
            avg_interval_days: Math.round(avgInterval),
            avg_ltv: avgLtv,
            customer_ids: opportunityCustomerIds.slice(0, 100),
            customer_emails: segmentCustomers.map(c => c.email),
        },
    });
}

// ── Detector 6: Divergência LTV vs Spend por Canal ────────────────────────────
// Fontes: mv_campaign_ltv_performance (ROI real) + campaign_performance_snapshots (histórico)
async function detectDivergenciaRoiCanal(profileId: string): Promise<void> {
    const { data: current } = await supabase
        .from('mv_campaign_ltv_performance')
        .select('channel, total_spend_brl, true_roi, total_ltv_brl, customers_acquired')
        .eq('profile_id', profileId)
        .not('true_roi', 'is', null)
        .gt('total_spend_brl', 0);

    if (!current?.length) return;

    // Buscar snapshot do mês anterior para comparar
    const lastMonth = new Date();
    lastMonth.setDate(1);
    lastMonth.setMonth(lastMonth.getMonth() - 1);
    const lastMonthStr = lastMonth.toISOString().split('T')[0]!;

    const { data: historic } = await supabase
        .from('campaign_performance_snapshots')
        .select('channel, true_roi, total_spend_brl')
        .eq('profile_id', profileId)
        .eq('snapshot_month', lastMonthStr)
        .not('true_roi', 'is', null);

    if (!historic?.length) return;

    const historicByChannel: Record<string, { roi: number; spend: number }> = {};
    for (const row of historic) {
        historicByChannel[row.channel] = { roi: Number(row.true_roi), spend: Number(row.total_spend_brl) };
    }

    // Detectar: spend cresceu mas ROI caiu
    const divergentChannels = [];
    for (const row of current) {
        const hist = historicByChannel[row.channel];
        if (!hist) continue;

        const spendGrew = Number(row.total_spend_brl) > hist.spend * 1.1; // +10% spend
        const roiFell = Number(row.true_roi) < hist.roi * 0.85;            // -15% ROI

        if (spendGrew && roiFell) {
            divergentChannels.push({
                channel: row.channel,
                current_roi: Number(row.true_roi),
                historic_roi: hist.roi,
                current_spend: Number(row.total_spend_brl),
                historic_spend: hist.spend,
                roi_drop_pct: Math.round(((hist.roi - Number(row.true_roi)) / hist.roi) * 100),
            });
        }
    }

    if (!divergentChannels.length) return;

    const worst = divergentChannels.sort((a, b) => b.roi_drop_pct - a.roi_drop_pct)[0]!;
    const channelLabel = worst.channel === 'meta_ads' ? 'Meta Ads' : worst.channel === 'google_ads' ? 'Google Ads' : worst.channel;

    await upsertRecommendation(profileId, 'divergencia_roi_canal', {
        title: `ROI do ${channelLabel} caiu ${worst.roi_drop_pct}% com spend crescendo`,
        narrative: `O ${channelLabel} teve um aumento de gasto de R$ ${worst.historic_spend.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} para R$ ${worst.current_spend.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} no último mês — mas o ROI real (baseado em LTV, não ROAS) caiu de ${worst.historic_roi.toFixed(2)}x para ${worst.current_roi.toFixed(2)}x. Você está investindo mais e colhendo menos por cliente adquirido. O criativo ou a segmentação pode ter saturado.`,
        impact_estimate: `ROI em queda livre — revisão de criativo/targeting pode recuperar ${worst.roi_drop_pct}% de eficiência`,
        sources: ['mv_campaign_ltv_performance.true_roi', 'campaign_performance_snapshots.true_roi', 'ad_campaigns.spend_brl'],
        meta: { divergent_channels: divergentChannels, worst_channel: worst },
    });
}

// ── Detector 7: Queda de Retenção de Cohort ───────────────────────────────────
// Fonte: mv_cohort_retention (retenção 30d do cohort atual vs média histórica)
async function detectQuedaRetencaoCohort(profileId: string): Promise<void> {
    const { data: cohorts } = await supabase
        .from('mv_cohort_retention')
        .select('acquisition_channel, cohort_month, cohort_size, retention_rate_30d')
        .eq('profile_id', profileId)
        .gt('cohort_size', 10)
        .not('retention_rate_30d', 'is', null)
        .order('cohort_month', { ascending: false })
        .limit(24); // últimos 24 meses

    if (!cohorts || cohorts.length < 3) return;

    // Agrupar por canal
    const byChannel: Record<string, { month: string; rate: number; size: number }[]> = {};
    for (const row of cohorts) {
        const ch = row.acquisition_channel;
        if (!byChannel[ch]) byChannel[ch] = [];
        byChannel[ch]!.push({
            month: row.cohort_month,
            rate: Number(row.retention_rate_30d),
            size: Number(row.cohort_size),
        });
    }

    const alerts = [];
    for (const [channel, rows] of Object.entries(byChannel)) {
        if (rows.length < 3) continue;

        const sorted = rows.sort((a, b) => b.month.localeCompare(a.month));
        const latest = sorted[0]!;
        const historical = sorted.slice(1);
        const historicAvg = historical.reduce((s, r) => s + r.rate, 0) / historical.length;

        if (latest.rate < historicAvg * 0.5) {
            alerts.push({
                channel,
                current_retention: latest.rate,
                historic_avg: Math.round(historicAvg * 10) / 10,
                cohort_month: latest.month,
                cohort_size: latest.size,
                drop_pct: Math.round(((historicAvg - latest.rate) / historicAvg) * 100),
            });
        }
    }

    if (!alerts.length) return;

    const worst = alerts.sort((a, b) => b.drop_pct - a.drop_pct)[0]!;
    const channelLabel = worst.channel === 'meta_ads' ? 'Meta Ads' : worst.channel === 'google_ads' ? 'Google Ads' : worst.channel;

    await upsertRecommendation(profileId, 'queda_retencao_cohort', {
        title: `Retenção do cohort recente (${channelLabel}) caiu ${worst.drop_pct}%`,
        narrative: `Os ${worst.cohort_size} clientes adquiridos via ${channelLabel} no último mês estão retendo em ${worst.current_retention}% — menos da metade da média histórica de ${worst.historic_avg}%. Clientes recentes estão abandonando muito mais rápido que coortes anteriores. Isso pode indicar mudança no perfil de audiência, queda na qualidade do produto ou onboarding com problemas.`,
        impact_estimate: `Risco de churn acelerado na base mais recente — intervenção precoce pode dobrar retenção`,
        sources: ['mv_cohort_retention.retention_rate_30d', 'mv_cohort_retention.cohort_month', 'customers.acquisition_channel'],
        meta: { alerts, worst_channel: worst },
    });
}

// ── Detector 8: Canal com Alto LTV Subestimado ────────────────────────────────
// Fonte: mv_campaign_ltv_performance (true_roi + avg_ltv vs média global + spend baixo)
async function detectCanalAltoLtvUnderinvested(profileId: string): Promise<void> {
    const { data: perfRows } = await supabase
        .from('mv_campaign_ltv_performance')
        .select('channel, campaign_name, true_roi, avg_ltv_brl, total_spend_brl, customers_acquired')
        .eq('profile_id', profileId)
        .not('true_roi', 'is', null)
        .gt('customers_acquired', 5);

    if (!perfRows?.length) return;

    // LTV médio global
    const globalAvgLtv = perfRows.reduce((s, r) => s + Number(r.avg_ltv_brl), 0) / perfRows.length;
    if (globalAvgLtv <= 0) return;

    const hidden = perfRows.filter(row =>
        Number(row.true_roi) > 3 &&
        Number(row.avg_ltv_brl) > globalAvgLtv * 2 &&
        Number(row.total_spend_brl) < 1000
    );

    if (!hidden.length) return;

    const best = hidden.sort((a, b) => Number(b.true_roi) - Number(a.true_roi))[0]!;
    const channelLabel = best.channel === 'meta_ads' ? 'Meta Ads' : best.channel === 'google_ads' ? 'Google Ads' : best.channel;
    const campaignLabel = best.campaign_name ? ` — campanha "${best.campaign_name}"` : '';

    await upsertRecommendation(profileId, 'canal_alto_ltv_underinvested', {
        title: `Canal subestimado: ${channelLabel}${campaignLabel} com ROI ${Number(best.true_roi).toFixed(1)}x`,
        narrative: `O ${channelLabel}${campaignLabel} está gerando clientes com LTV médio de R$ ${Number(best.avg_ltv_brl).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} — ${Math.round((Number(best.avg_ltv_brl) / globalAvgLtv - 1) * 100)}% acima da média da sua base — com um ROI real de ${Number(best.true_roi).toFixed(1)}x. E você investiu apenas R$ ${Number(best.total_spend_brl).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} nele. Esse é exatamente o canal que merece escala — não os que têm melhor ROAS superficial.`,
        impact_estimate: `Potencial de escalar ${Number(best.true_roi).toFixed(1)}x de retorno real com aumento de investimento`,
        sources: ['mv_campaign_ltv_performance.true_roi', 'mv_campaign_ltv_performance.avg_ltv_brl', 'mv_campaign_ltv_performance.total_spend_brl'],
        meta: {
            hidden_gems: hidden,
            best_channel: best,
            global_avg_ltv: globalAvgLtv,
        },
    });
}

// ── Detector 9: CAC vs LTV — Clientes Não Rentabilizados ─────────────────────
// Fontes: customers.cac (calculado pelo RFM job) + customers.total_ltv
// Lógica: se LTV < CAC, o cliente ainda não pagou seu custo de aquisição
async function detectCacVsLtvDeficit(profileId: string, allCustomers: CustomerRow[]): Promise<void> {
    const customers = allCustomers.filter(c => Number(c.cac) > 0);

    if (!customers.length) return;

    const unprofitable = customers.filter(c => Number(c.total_ltv) < Number(c.cac));
    if (unprofitable.length < 3) return;

    const totalDeficit = unprofitable.reduce(
        (s, c) => s + (Number(c.cac) - Number(c.total_ltv)),
        0
    );
    const avgCac = unprofitable.reduce((s, c) => s + Number(c.cac), 0) / unprofitable.length;
    const avgLtv = unprofitable.reduce((s, c) => s + Number(c.total_ltv), 0) / unprofitable.length;
    const deficitPct = Math.round((unprofitable.length / customers.length) * 100);

    await upsertRecommendation(profileId, 'cac_vs_ltv_deficit', {
        title: `${unprofitable.length} clientes (${deficitPct}% da base) ainda não pagaram o CAC`,
        narrative: `${unprofitable.length} clientes têm LTV médio de R$ ${avgLtv.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} — abaixo do CAC médio de R$ ${avgCac.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}. O déficit total acumulado é de R$ ${totalDeficit.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}. Esses clientes foram adquiridos mas ainda não geraram retorno suficiente. Uma ação de recompra direcionada pode acelerar o payback antes que o churn os retire da equação.`,
        impact_estimate: `Recuperar R$ ${(totalDeficit * 0.4).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} em payback acelerado (estimativa de 40% de conversão em segunda compra)`,
        sources: ['customers.cac', 'customers.total_ltv', 'customers.acquisition_channel'],
        meta: {
            unprofitable_count: unprofitable.length,
            total_customers: customers.length,
            deficit_pct: deficitPct,
            total_deficit: totalDeficit,
            avg_cac: avgCac,
            avg_ltv: avgLtv,
            customer_ids: unprofitable.map(c => c.id),
            customer_emails: unprofitable.map(c => c.email),
        },
    });
}

// ── Detector 10: Em Risco de Alto Valor ───────────────────────────────────────
// Fontes: customers.rfm_score + customers.churn_probability + customers.total_ltv
// Lógica: clientes com M >= 3 (alto valor histórico) mas R <= 2 (pararam de comprar)
// — são os mais valiosos que estão em sinal amarelo
async function detectEmRiscoAltoValor(profileId: string, allCustomers: CustomerRow[]): Promise<void> {
    const customers = allCustomers.filter(c => c.rfm_score != null);

    if (!customers.length) return;

    // Em Risco de Alto Valor: M >= 3 (compravam bem) mas R <= 2 (sumiram)
    const atRisk = customers.filter(c => {
        const rfmStr = c.rfm_score as string | null;
        if (!rfmStr || rfmStr.length !== 3) return false;
        const r = parseInt(rfmStr[0]!);
        const m = parseInt(rfmStr[2]!);
        return r <= 2 && m >= 3;
    });

    if (atRisk.length < 3) return;

    const avgLtv = atRisk.reduce((s, c) => s + Number(c.total_ltv), 0) / atRisk.length;
    const avgChurn = Math.round(atRisk.reduce((s, c) => s + Number(c.churn_probability), 0) / atRisk.length);

    // LTV médio global para contexto
    const globalAvgLtv = customers.reduce((s, c) => s + Number(c.total_ltv), 0) / customers.length;
    const ltvMultiplier = globalAvgLtv > 0 ? Math.round(avgLtv / globalAvgLtv) : 1;

    await upsertRecommendation(profileId, 'em_risco_alto_valor', {
        title: `${atRisk.length} clientes de alto valor em silêncio — churn médio ${avgChurn}%`,
        narrative: `${atRisk.length} clientes que historicamente compravam com alto valor (LTV médio de R$ ${avgLtv.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} — ${ltvMultiplier}x acima da média) estão há muito tempo sem comprar e com probabilidade de churn de ${avgChurn}%. Esses não são clientes comuns — são os que mais contribuíram para a receita. Cada um que churnar representa uma perda significativamente maior que um cliente médio.`,
        impact_estimate: `~R$ ${(avgLtv * atRisk.length * 0.35).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} em risco imediato (35% de chance de churn sem intervenção)`,
        sources: ['customers.rfm_score', 'customers.churn_probability', 'customers.total_ltv', 'customers.last_purchase_at'],
        meta: {
            at_risk_count: atRisk.length,
            avg_ltv: avgLtv,
            avg_churn_probability: avgChurn,
            global_avg_ltv: globalAvgLtv,
            ltv_multiplier: ltvMultiplier,
            customer_ids: atRisk.map(c => c.id),
            customer_emails: atRisk.map(c => c.email),
        },
    });
}

// ── Runner ────────────────────────────────────────────────────────────────────

async function runGrowthCorrelationsForAllProfiles(): Promise<void> {
    console.log('[Growth] Running correlation detectors...');

    const { data: profiles } = await supabase.from('profiles').select('id');

    for (const profile of profiles || []) {
        try {
            // Prefetch customers ONCE per profile — used by detectors 1, 2, 3, 4, 9, 10
            const { data: customerRows } = await supabase
                .from('customers')
                .select('id, email, total_ltv, cac, churn_probability, rfm_score, acquisition_channel, last_purchase_at')
                .eq('profile_id', profile.id);

            const allCustomers: CustomerRow[] = (customerRows as CustomerRow[]) || [];

            await Promise.all([
                detectReativacaoAltoLtv(profile.id, allCustomers),
                detectPausaCampanhaLtvBaixo(profile.id, allCustomers),
                detectAudienceSyncChampions(profile.id, allCustomers),
                detectReaLocacaoBudget(profile.id, allCustomers),
                detectUpsellCohort(profile.id),
                detectDivergenciaRoiCanal(profile.id),
                detectQuedaRetencaoCohort(profile.id),
                detectCanalAltoLtvUnderinvested(profile.id),
                detectCacVsLtvDeficit(profile.id, allCustomers),
                detectEmRiscoAltoValor(profile.id, allCustomers),
            ]);
        } catch (err: unknown) {
            console.error(`[Growth] Error for profile ${profile.id}:`, err instanceof Error ? err.message : String(err));
        }
    }

    console.log('[Growth] Correlation check complete.');
}

async function runGrowthCorrelationsWithMutex(): Promise<void> {
    if (isRunning) {
        console.log('[GrowthCorrelationsJob] Já em execução, pulando ciclo');
        return;
    }
    isRunning = true;
    try {
        await runGrowthCorrelationsForAllProfiles();
    } finally {
        isRunning = false;
    }
}

export function startGrowthCorrelationsJob(): void {
    console.log('[Growth] Job registered — will run every 1 hour.');
    // Não roda imediato no boot — espera o primeiro intervalo
    setInterval(runGrowthCorrelationsWithMutex, 60 * 60 * 1000);
}

export { runGrowthCorrelationsForAllProfiles };
