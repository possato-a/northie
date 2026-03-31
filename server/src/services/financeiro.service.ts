import { supabase } from '../lib/supabase.js';
import type { PLResult, ForecastScenario, CaixaPosicao, FornecedorUnificado } from '../types/index.js';

// ── P&L ─────────────────────────────────────────────────────────────────────

export async function calcularPL(profileId: string, inicio: string, fim: string): Promise<PLResult> {
    const [txRes, adsRes, fixedRes, prevRes] = await Promise.all([
        supabase
            .from('transactions')
            .select('amount_gross, fee_platform')
            .eq('profile_id', profileId)
            .eq('status', 'approved')
            .gte('created_at', inicio)
            .lte('created_at', fim),
        supabase
            .from('ad_metrics')
            .select('spend_brl')
            .eq('profile_id', profileId)
            .gte('date', inicio)
            .lte('date', fim),
        supabase
            .from('fixed_costs')
            .select('monthly_cost_brl')
            .eq('profile_id', profileId)
            .eq('is_active', true),
        // Mês anterior para variação
        supabase
            .from('transactions')
            .select('amount_gross, fee_platform')
            .eq('profile_id', profileId)
            .eq('status', 'approved')
            .gte('created_at', shiftMonth(inicio, -1))
            .lte('created_at', shiftMonth(fim, -1)),
    ]);

    const receita_bruta = (txRes.data ?? []).reduce((s, t) => s + Number(t.amount_gross ?? 0), 0);
    const taxas_plataforma = (txRes.data ?? []).reduce((s, t) => s + Number(t.fee_platform ?? 0), 0);
    const custo_ads = (adsRes.data ?? []).reduce((s, a) => s + Number(a.spend_brl ?? 0), 0);
    const gastos_fixos = (fixedRes.data ?? []).reduce((s, f) => s + Number(f.monthly_cost_brl ?? 0), 0);
    const margem_estimada = receita_bruta - taxas_plataforma - custo_ads - gastos_fixos;
    const margem_pct = receita_bruta > 0 ? (margem_estimada / receita_bruta) * 100 : 0;

    // Variação MoM
    const prev_receita = (prevRes.data ?? []).reduce((s, t) => s + Number(t.amount_gross ?? 0), 0);
    const prev_taxas = (prevRes.data ?? []).reduce((s, t) => s + Number(t.fee_platform ?? 0), 0);
    const prev_margem = prev_receita - prev_taxas - custo_ads - gastos_fixos;
    const variacao_mes_anterior = prev_margem !== 0 ? ((margem_estimada - prev_margem) / Math.abs(prev_margem)) * 100 : undefined;

    return {
        receita_bruta,
        taxas_plataforma,
        custo_ads,
        gastos_fixos,
        margem_estimada,
        margem_pct: Math.round(margem_pct * 100) / 100,
        periodo: { inicio, fim },
        variacao_mes_anterior: variacao_mes_anterior !== undefined ? Math.round(variacao_mes_anterior * 100) / 100 : undefined,
    };
}

// ── Extrato combinado ───────────────────────────────────────────────────────

export async function obterExtrato(profileId: string, inicio: string, fim: string) {
    const [txRes, adsRes] = await Promise.all([
        supabase
            .from('transactions')
            .select('created_at, amount_gross, platform')
            .eq('profile_id', profileId)
            .eq('status', 'approved')
            .gte('created_at', inicio)
            .lte('created_at', fim)
            .order('created_at', { ascending: true }),
        supabase
            .from('ad_metrics')
            .select('date, spend_brl')
            .eq('profile_id', profileId)
            .gte('date', inicio)
            .lte('date', fim)
            .order('date', { ascending: true }),
    ]);

    // Agrupar por dia
    const dayMap = new Map<string, { receita: number; ads_spend: number; plataformas: Set<string> }>();

    for (const tx of txRes.data ?? []) {
        const day = tx.created_at.slice(0, 10);
        const entry = dayMap.get(day) ?? { receita: 0, ads_spend: 0, plataformas: new Set<string>() };
        entry.receita += Number(tx.amount_gross ?? 0);
        entry.plataformas.add(tx.platform);
        dayMap.set(day, entry);
    }

    for (const ad of adsRes.data ?? []) {
        const day = ad.date.slice(0, 10);
        const entry = dayMap.get(day) ?? { receita: 0, ads_spend: 0, plataformas: new Set<string>() };
        entry.ads_spend += Number(ad.spend_brl ?? 0);
        dayMap.set(day, entry);
    }

    return Array.from(dayMap.entries()).map(([date, d]) => ({
        date,
        receita: d.receita,
        ads_spend: d.ads_spend,
        plataforma: Array.from(d.plataformas).join(', ') || 'ads',
    }));
}

// ── Caixa: posição estimada ─────────────────────────────────────────────────

export async function calcularPosicaoCaixa(profileId: string): Promise<CaixaPosicao> {
    const now = new Date();
    const inicioMes = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const fimMes = now.toISOString();
    const inicioMesAnterior = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();
    const fimMesAnterior = new Date(now.getFullYear(), now.getMonth(), 0).toISOString();

    const [plAtual, plAnterior, fixedRes, adsRes] = await Promise.all([
        calcularPL(profileId, inicioMes, fimMes),
        calcularPL(profileId, inicioMesAnterior, fimMesAnterior),
        supabase.from('fixed_costs').select('monthly_cost_brl').eq('profile_id', profileId).eq('is_active', true),
        // Média de ads spend dos últimos 3 meses
        supabase.from('ad_metrics').select('spend_brl').eq('profile_id', profileId)
            .gte('date', new Date(now.getFullYear(), now.getMonth() - 3, 1).toISOString()),
    ]);

    const custos_fixos_mensais = (fixedRes.data ?? []).reduce((s, f) => s + Number(f.monthly_cost_brl ?? 0), 0);
    const total_ads_3m = (adsRes.data ?? []).reduce((s, a) => s + Number(a.spend_brl ?? 0), 0);
    const media_ads_spend = total_ads_3m / 3;
    const custo_mensal_total = custos_fixos_mensais + media_ads_spend;
    const caixa_estimado = plAtual.margem_estimada;
    const variacao = plAnterior.margem_estimada !== 0
        ? ((caixa_estimado - plAnterior.margem_estimada) / Math.abs(plAnterior.margem_estimada)) * 100
        : 0;
    const runway_meses = custo_mensal_total > 0 ? caixa_estimado / custo_mensal_total : 99;

    return {
        caixa_estimado,
        variacao_mes_anterior: Math.round(variacao * 100) / 100,
        runway_meses: Math.round(Math.max(0, runway_meses) * 10) / 10,
        custos_fixos_mensais,
        media_ads_spend: Math.round(media_ads_spend * 100) / 100,
    };
}

// ── Caixa: forecast 30/60 dias ──────────────────────────────────────────────

export async function calcularForecast(profileId: string): Promise<ForecastScenario[]> {
    const now = new Date();

    // Entradas: receita média dos últimos 3 meses projetada
    const [txRes, adsRes, fixedRes] = await Promise.all([
        supabase.from('transactions').select('amount_gross')
            .eq('profile_id', profileId).eq('status', 'approved')
            .gte('created_at', new Date(now.getFullYear(), now.getMonth() - 3, 1).toISOString()),
        supabase.from('ad_metrics').select('spend_brl')
            .eq('profile_id', profileId)
            .gte('date', new Date(now.getFullYear(), now.getMonth() - 3, 1).toISOString()),
        supabase.from('fixed_costs').select('monthly_cost_brl')
            .eq('profile_id', profileId).eq('is_active', true),
    ]);

    const receita_media_mensal = (txRes.data ?? []).reduce((s, t) => s + Number(t.amount_gross ?? 0), 0) / 3;
    const ads_media_mensal = (adsRes.data ?? []).reduce((s, a) => s + Number(a.spend_brl ?? 0), 0) / 3;
    const gastos_fixos = (fixedRes.data ?? []).reduce((s, f) => s + Number(f.monthly_cost_brl ?? 0), 0);
    const saida_mensal = ads_media_mensal + gastos_fixos;

    const scenarios: ForecastScenario[] = [
        {
            cenario: 'base',
            projecao_30d: receita_media_mensal - saida_mensal,
            projecao_60d: (receita_media_mensal - saida_mensal) * 2,
        },
        {
            cenario: 'otimista',
            projecao_30d: receita_media_mensal * 1.2 - saida_mensal,
            projecao_60d: (receita_media_mensal * 1.2 - saida_mensal) * 2,
        },
        {
            cenario: 'pessimista',
            projecao_30d: receita_media_mensal * 0.8 - saida_mensal * 1.1,
            projecao_60d: (receita_media_mensal * 0.8 - saida_mensal * 1.1) * 2,
        },
    ];

    return scenarios;
}

// ── Caixa: entradas e saídas previstas ──────────────────────────────────────

export async function obterEntradasSaidas(profileId: string) {
    const now = new Date();
    const tres_meses_atras = new Date(now.getFullYear(), now.getMonth() - 3, 1).toISOString();

    const [txRes, adsRes, fixedRes] = await Promise.all([
        supabase.from('transactions').select('amount_gross, platform')
            .eq('profile_id', profileId).eq('status', 'approved')
            .gte('created_at', tres_meses_atras),
        supabase.from('ad_metrics').select('spend_brl, platform')
            .eq('profile_id', profileId)
            .gte('date', tres_meses_atras),
        supabase.from('fixed_costs').select('name, category, monthly_cost_brl')
            .eq('profile_id', profileId).eq('is_active', true),
    ]);

    // Agrupar entradas por plataforma
    const entradas: Record<string, number> = {};
    for (const tx of txRes.data ?? []) {
        const p = tx.platform ?? 'outro';
        entradas[p] = (entradas[p] ?? 0) + Number(tx.amount_gross ?? 0) / 3;
    }

    // Saídas
    const saidas_ads: Record<string, number> = {};
    for (const ad of adsRes.data ?? []) {
        const p = ad.platform ?? 'ads';
        saidas_ads[p] = (saidas_ads[p] ?? 0) + Number(ad.spend_brl ?? 0) / 3;
    }

    const saidas_fixos = (fixedRes.data ?? []).map(f => ({
        name: f.name,
        category: f.category,
        valor: Number(f.monthly_cost_brl),
    }));

    return { entradas, saidas_ads, saidas_fixos };
}

// ── Fornecedores: lista unificada ───────────────────────────────────────────

export async function listarFornecedores(profileId: string): Promise<FornecedorUnificado[]> {
    const now = new Date();
    const inicioMes = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const fimMes = now.toISOString();
    const inicioMesAnterior = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();
    const fimMesAnterior = new Date(now.getFullYear(), now.getMonth(), 0).toISOString();

    const [adsAtual, adsAnterior, txRes, fixedRes] = await Promise.all([
        supabase.from('ad_metrics').select('platform, spend_brl')
            .eq('profile_id', profileId).gte('date', inicioMes).lte('date', fimMes),
        supabase.from('ad_metrics').select('platform, spend_brl')
            .eq('profile_id', profileId).gte('date', inicioMesAnterior).lte('date', fimMesAnterior),
        supabase.from('transactions').select('platform, amount_gross, fee_platform')
            .eq('profile_id', profileId).eq('status', 'approved')
            .gte('created_at', inicioMes).lte('created_at', fimMes),
        supabase.from('fixed_costs').select('*')
            .eq('profile_id', profileId).eq('is_active', true),
    ]);

    const fornecedores: FornecedorUnificado[] = [];

    // Fornecedores de ads (automáticos)
    const adsPlatforms = new Map<string, { current: number; previous: number }>();
    for (const ad of adsAtual.data ?? []) {
        const p = ad.platform;
        const entry = adsPlatforms.get(p) ?? { current: 0, previous: 0 };
        entry.current += Number(ad.spend_brl ?? 0);
        adsPlatforms.set(p, entry);
    }
    for (const ad of adsAnterior.data ?? []) {
        const p = ad.platform;
        const entry = adsPlatforms.get(p) ?? { current: 0, previous: 0 };
        entry.previous += Number(ad.spend_brl ?? 0);
        adsPlatforms.set(p, entry);
    }

    // Receita por plataforma para calcular ROAS
    const revenueByPlatform = new Map<string, number>();
    for (const tx of txRes.data ?? []) {
        const p = tx.platform;
        revenueByPlatform.set(p, (revenueByPlatform.get(p) ?? 0) + Number(tx.amount_gross ?? 0));
    }

    const platformNames: Record<string, string> = { meta: 'Meta Ads', google: 'Google Ads' };
    for (const [platform, spend] of adsPlatforms) {
        const revenue = revenueByPlatform.get(platform) ?? 0;
        const roas = spend.current > 0 ? revenue / spend.current : 0;
        const tendencia = spend.previous > 0 ? ((spend.current - spend.previous) / spend.previous) * 100 : 0;

        let status: FornecedorUnificado['status'] = 'neutro';
        if (roas >= 3) status = 'saudavel';
        else if (roas >= 1.5) status = 'neutro';
        else if (spend.current > 0) status = 'atencao';

        fornecedores.push({
            id: `auto-ads-${platform}`,
            name: platformNames[platform] ?? platform,
            category: 'ads',
            monthly_cost: spend.current,
            origem: 'auto',
            platform,
            roas: Math.round(roas * 100) / 100,
            status,
            tendencia: Math.round(tendencia * 100) / 100,
        });
    }

    // Fornecedores de plataforma (taxas — automáticos)
    const feeByPlatform = new Map<string, number>();
    for (const tx of txRes.data ?? []) {
        const p = tx.platform;
        feeByPlatform.set(p, (feeByPlatform.get(p) ?? 0) + Number(tx.fee_platform ?? 0));
    }

    const platformFeeNames: Record<string, string> = { hotmart: 'Hotmart', stripe: 'Stripe', shopify: 'Shopify' };
    for (const [platform, fee] of feeByPlatform) {
        if (fee <= 0) continue;
        fornecedores.push({
            id: `auto-fee-${platform}`,
            name: platformFeeNames[platform] ?? platform,
            category: 'plataforma',
            monthly_cost: fee,
            origem: 'auto',
            platform,
            status: 'neutro',
        });
    }

    // Fornecedores manuais (fixed_costs)
    for (const fc of fixedRes.data ?? []) {
        fornecedores.push({
            id: fc.id,
            name: fc.supplier_name ?? fc.name,
            category: fc.category ?? 'outro',
            monthly_cost: Number(fc.monthly_cost_brl),
            origem: 'manual',
            status: 'neutro',
        });
    }

    return fornecedores;
}

// ── Fornecedor: detalhe com histórico ───────────────────────────────────────

export async function detalheFornecedor(profileId: string, fornecedorId: string) {
    // Manual
    if (!fornecedorId.startsWith('auto-')) {
        const { data } = await supabase.from('fixed_costs').select('*')
            .eq('id', fornecedorId).eq('profile_id', profileId).single();
        return data;
    }

    // Auto: buscar histórico de ads spend por platform
    const platform = fornecedorId.replace('auto-ads-', '').replace('auto-fee-', '');
    const { data } = await supabase.from('ad_metrics').select('date, spend_brl')
        .eq('profile_id', profileId).eq('platform', platform)
        .order('date', { ascending: true }).limit(90);

    return { platform, historico: data ?? [] };
}

// ── Fornecedor: ROI (só ads) ────────────────────────────────────────────────

export async function calcularROIFornecedor(profileId: string, fornecedorId: string) {
    if (!fornecedorId.startsWith('auto-ads-')) {
        return { error: 'ROI disponível apenas para fornecedores de ads' };
    }

    const platform = fornecedorId.replace('auto-ads-', '');
    const now = new Date();
    const inicio = new Date(now.getFullYear(), now.getMonth() - 3, 1).toISOString();

    const [adsRes, txRes, custRes] = await Promise.all([
        supabase.from('ad_metrics').select('spend_brl').eq('profile_id', profileId)
            .eq('platform', platform).gte('date', inicio),
        supabase.from('transactions').select('amount_gross').eq('profile_id', profileId)
            .eq('status', 'approved').gte('created_at', inicio),
        supabase.from('customers').select('total_ltv, acquisition_channel')
            .eq('profile_id', profileId)
            .eq('acquisition_channel', `${platform}_ads`),
    ]);

    const spend = (adsRes.data ?? []).reduce((s, a) => s + Number(a.spend_brl ?? 0), 0);
    const revenue = (txRes.data ?? []).reduce((s, t) => s + Number(t.amount_gross ?? 0), 0);
    const customers = custRes.data ?? [];
    const avg_ltv = customers.length > 0
        ? customers.reduce((s, c) => s + Number(c.total_ltv ?? 0), 0) / customers.length
        : 0;
    const cac = customers.length > 0 ? spend / customers.length : 0;

    return {
        platform,
        spend_total: spend,
        revenue_total: revenue,
        roas: spend > 0 ? Math.round((revenue / spend) * 100) / 100 : 0,
        ltv_medio: Math.round(avg_ltv * 100) / 100,
        cac: Math.round(cac * 100) / 100,
        ltv_cac: cac > 0 ? Math.round((avg_ltv / cac) * 100) / 100 : 0,
        clientes: customers.length,
    };
}

// ── Export CSV ───────────────────────────────────────────────────────────────

export async function gerarCSV(profileId: string, inicio: string, fim: string): Promise<string> {
    const [txRes, adsRes, fixedRes] = await Promise.all([
        supabase.from('transactions').select('created_at, platform, amount_gross, fee_platform, status')
            .eq('profile_id', profileId).gte('created_at', inicio).lte('created_at', fim)
            .order('created_at', { ascending: true }),
        supabase.from('ad_metrics').select('date, platform, spend_brl')
            .eq('profile_id', profileId).gte('date', inicio).lte('date', fim),
        supabase.from('fixed_costs').select('name, category, monthly_cost_brl')
            .eq('profile_id', profileId).eq('is_active', true),
    ]);

    const lines = ['Tipo,Data,Plataforma,Descrição,Valor'];

    for (const tx of txRes.data ?? []) {
        lines.push(`Receita,${tx.created_at.slice(0, 10)},${tx.platform},Venda,${tx.amount_gross}`);
        if (Number(tx.fee_platform) > 0) {
            lines.push(`Taxa,${tx.created_at.slice(0, 10)},${tx.platform},Taxa plataforma,-${tx.fee_platform}`);
        }
    }

    for (const ad of adsRes.data ?? []) {
        lines.push(`Ads,${ad.date.slice(0, 10)},${ad.platform},Gasto ads,-${ad.spend_brl}`);
    }

    for (const fc of fixedRes.data ?? []) {
        lines.push(`Fixo,,${fc.category},${fc.name},-${fc.monthly_cost_brl}`);
    }

    return lines.join('\n');
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function shiftMonth(dateStr: string, months: number): string {
    const d = new Date(dateStr);
    d.setMonth(d.getMonth() + months);
    return d.toISOString();
}
