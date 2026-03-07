/**
 * @file jobs/alerts.job.ts
 * Detecta anomalias e eventos importantes nos dados do workspace e persiste
 * alertas na tabela `alerts`. Roda a cada hora.
 *
 * Alertas implementados:
 *  - ROAS caiu mais de 30% em relação à média dos 7 dias anteriores
 *  - Alto churn: mais de 20% dos customers com churn_probability > 70
 *  - Receita zerada hoje (mas havia receita ontem)
 *  - Novo canal orgânico significativo (>10 clientes no mês via 'organico')
 */

import { supabase } from '../lib/supabase.js';

// ── Mutex — impede execução simultânea ────────────────────────────────────────
let isRunning = false;

// ── Tipos ─────────────────────────────────────────────────────────────────────

type AlertType = 'roas_drop' | 'high_churn' | 'revenue_zero' | 'organic_spike';
type AlertSeverity = 'info' | 'warning' | 'critical';

interface AlertPayload {
    profileId: string;
    type: AlertType;
    severity: AlertSeverity;
    title: string;
    body: string;
    meta?: Record<string, any>;
}

async function createAlert(alert: AlertPayload): Promise<void> {
    // Evitar duplicatas: não criar o mesmo tipo de alerta se já existe um não lido nas últimas 24h
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: existing } = await supabase
        .from('alerts')
        .select('id')
        .eq('profile_id', alert.profileId)
        .eq('type', alert.type)
        .eq('read', false)
        .gte('created_at', since)
        .limit(1)
        .single();

    if (existing) return; // já existe alerta recente desse tipo

    const { error } = await supabase.from('alerts').insert({
        profile_id: alert.profileId,
        type: alert.type,
        severity: alert.severity,
        title: alert.title,
        body: alert.body,
        meta: alert.meta || {},
        read: false,
    });

    if (error) {
        console.error(`[Alerts] Failed to create alert ${alert.type} for ${alert.profileId}:`, error);
    } else {
        console.log(`[Alerts] ⚡ ${alert.severity.toUpperCase()} — ${alert.title} (profile: ${alert.profileId})`);
    }
}

// ── Detectores ────────────────────────────────────────────────────────────────

async function checkRoasDrop(profileId: string): Promise<void> {
    const today = new Date().toISOString().split('T')[0]!;
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]!;
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0]!;

    const { data: metrics } = await supabase
        .from('ad_metrics')
        .select('platform, spend_brl, date')
        .eq('profile_id', profileId)
        .gte('date', sevenDaysAgo);

    if (!metrics?.length) return;

    const { data: txs } = await supabase
        .from('transactions')
        .select('amount_net, created_at, customers!inner(acquisition_channel)')
        .eq('profile_id', profileId)
        .eq('status', 'approved')
        .gte('created_at', sevenDaysAgo + 'T00:00:00Z');

    const channelMap: Record<string, string> = { meta: 'meta_ads', google: 'google_ads' };
    for (const platform of ['meta', 'google']) {
        const platformMetrics = metrics.filter(m => m.platform === platform);
        const channelKey = channelMap[platform] || platform;
        const platformTxs = txs?.filter(t => (t as any).customers?.acquisition_channel === channelKey) || [];

        if (!platformMetrics.length) continue;

        // ROAS de hoje
        const todaySpend = platformMetrics
            .filter(m => m.date === today || m.date === yesterday)
            .reduce((s, m) => s + Number(m.spend_brl), 0);
        const todayRev = platformTxs
            .filter(t => t.created_at.startsWith(today) || t.created_at.startsWith(yesterday))
            .reduce((s, t) => s + Number(t.amount_net), 0);
        const todayRoas = todaySpend > 0 ? todayRev / todaySpend : 0;

        // ROAS médio dos 7 dias
        const totalSpend7d = platformMetrics.reduce((s, m) => s + Number(m.spend_brl), 0);
        const totalRev7d = platformTxs.reduce((s, t) => s + Number(t.amount_net), 0);
        const avgRoas7d = totalSpend7d > 0 ? totalRev7d / totalSpend7d : 0;

        if (avgRoas7d > 0 && todayRoas < avgRoas7d * 0.7) {
            const drop = Math.round((1 - todayRoas / avgRoas7d) * 100);
            await createAlert({
                profileId,
                type: 'roas_drop',
                severity: drop > 50 ? 'critical' : 'warning',
                title: `ROAS ${platform === 'meta' ? 'Meta' : 'Google'} caiu ${drop}%`,
                body: `ROAS atual: ${todayRoas.toFixed(2)}x vs média 7d: ${avgRoas7d.toFixed(2)}x. Verifique seus criativos e lances.`,
                meta: { platform, todayRoas, avgRoas7d, drop },
            });
        }
    }
}

async function checkHighChurn(profileId: string): Promise<void> {
    const { count: total } = await supabase
        .from('customers')
        .select('*', { count: 'exact', head: true })
        .eq('profile_id', profileId);

    if (!total || total < 10) return; // base pequena demais para alertar

    const { count: highChurn } = await supabase
        .from('customers')
        .select('*', { count: 'exact', head: true })
        .eq('profile_id', profileId)
        .gte('churn_probability', 70);

    const pct = Math.round(((highChurn || 0) / total) * 100);

    if (pct >= 20) {
        await createAlert({
            profileId,
            type: 'high_churn',
            severity: pct >= 40 ? 'critical' : 'warning',
            title: `${pct}% da base com alto risco de churn`,
            body: `${highChurn} de ${total} clientes têm probabilidade de churn acima de 70%. Considere ativar campanhas de retenção.`,
            meta: { total, highChurn, percentage: pct },
        });
    }
}

async function checkRevenueZero(profileId: string): Promise<void> {
    const today = new Date().toISOString().split('T')[0]!;
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0]!;

    const { count: todayCount } = await supabase
        .from('transactions')
        .select('*', { count: 'exact', head: true })
        .eq('profile_id', profileId)
        .eq('status', 'approved')
        .gte('created_at', today + 'T00:00:00Z');

    // Só alertar depois das 14h (dá tempo do dia ter vendas)
    if (new Date().getHours() < 14) return;

    const { count: yesterdayCount } = await supabase
        .from('transactions')
        .select('*', { count: 'exact', head: true })
        .eq('profile_id', profileId)
        .eq('status', 'approved')
        .gte('created_at', yesterday + 'T00:00:00Z')
        .lt('created_at', today + 'T00:00:00Z');

    if ((todayCount || 0) === 0 && (yesterdayCount || 0) > 0) {
        await createAlert({
            profileId,
            type: 'revenue_zero',
            severity: 'critical',
            title: 'Nenhuma venda registrada hoje',
            body: `Havia ${yesterdayCount} venda(s) ontem, mas hoje nenhuma foi registrada. Verifique seus webhooks e campanhas ativas.`,
            meta: { todayCount: 0, yesterdayCount },
        });
    }
}

async function checkOrganicSpike(profileId: string): Promise<void> {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    const { count } = await supabase
        .from('customers')
        .select('*', { count: 'exact', head: true })
        .eq('profile_id', profileId)
        .eq('acquisition_channel', 'organico')
        .gte('created_at', thirtyDaysAgo);

    if ((count || 0) >= 10) {
        await createAlert({
            profileId,
            type: 'organic_spike',
            severity: 'info',
            title: `${count} novos clientes orgânicos este mês`,
            body: `Seu canal orgânico está forte. Considere criar conteúdo adicional ou um programa de indicação para amplificar.`,
            meta: { organicCount: count },
        });
    }
}

// ── Runner ────────────────────────────────────────────────────────────────────

async function runAlertsForAllProfiles(): Promise<void> {
    console.log('[Alerts] Running alert checks...');

    const { data: profiles } = await supabase.from('profiles').select('id');

    for (const profile of profiles || []) {
        try {
            // allSettled: uma falha não cancela as outras verificações
            const results = await Promise.allSettled([
                checkRoasDrop(profile.id),
                checkHighChurn(profile.id),
                checkRevenueZero(profile.id),
                checkOrganicSpike(profile.id),
            ]);
            results.forEach((r, i) => {
                if (r.status === 'rejected') {
                    const names = ['checkRoasDrop', 'checkHighChurn', 'checkRevenueZero', 'checkOrganicSpike'];
                    console.error(`[Alerts] ${names[i]} failed for ${profile.id}:`, r.reason?.message);
                }
            });
        } catch (err: any) {
            console.error(`[Alerts] Error for profile ${profile.id}:`, err.message);
        }
    }

    console.log('[Alerts] Check complete.');
}

async function runAlertsWithMutex(): Promise<void> {
    if (isRunning) {
        console.log('[AlertsJob] Já em execução, pulando ciclo');
        return;
    }
    isRunning = true;
    try {
        await runAlertsForAllProfiles();
    } finally {
        isRunning = false;
    }
}

export function startAlertsJob(): void {
    console.log('[Alerts] Job registered — will run every 2 hours.');
    // Não roda imediato no boot — espera o primeiro intervalo para evitar sobrecarga
    setInterval(runAlertsWithMutex, 2 * 60 * 60 * 1000);
}

export { runAlertsForAllProfiles };
