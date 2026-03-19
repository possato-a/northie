/**
 * @file jobs/alerts.job.ts
 * Detecta anomalias e eventos importantes nos dados do workspace e persiste
 * alertas na tabela `alerts`. Roda a cada 2 horas.
 *
 * Alertas implementados:
 *  - ROAS caiu mais de 30% em relação à média dos 7 dias anteriores
 *  - Alto churn: mais de 20% dos customers com churn_probability > 70
 *  - Receita zerada hoje (mas havia receita ontem)
 *  - Novo canal orgânico significativo (>10 clientes no mês via 'organico')
 *  - CAC elevado: CAC > LTV médio da base (aquisição no prejuízo)
 *  - Gasto publicitário hoje >2x a média diária dos últimos 30 dias
 */
import { supabase } from '../lib/supabase.js';
import { getResend } from '../services/reports/report-email.js';
// ── Mutex — impede execução simultânea ────────────────────────────────────────
let isRunning = false;
// ── Email de alerta ────────────────────────────────────────────────────────────
const SEVERITY_COLOR = {
    critical: '#dc2626',
    warning: '#d97706',
    info: '#2563eb',
};
async function sendAlertEmail(to, title, body, severity) {
    const resend = getResend();
    if (!resend)
        return;
    const color = SEVERITY_COLOR[severity];
    const severityLabel = { critical: 'Crítico', warning: 'Atenção', info: 'Informação' }[severity];
    const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
<div style="max-width:560px;margin:32px auto;background:white;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
    <div style="background:#111827;padding:20px 28px;display:flex;align-items:center;justify-content:space-between;">
        <div style="color:white;font-size:18px;font-weight:800;letter-spacing:-0.5px;">NORTHIE</div>
        <span style="background:${color}22;border:1px solid ${color}44;color:${color};font-size:11px;font-weight:700;padding:4px 10px;border-radius:6px;text-transform:uppercase;">${severityLabel}</span>
    </div>
    <div style="padding:24px 28px;">
        <h2 style="margin:0 0 12px;font-size:16px;font-weight:700;color:#111827;">${title}</h2>
        <p style="margin:0;font-size:14px;color:#374151;line-height:1.6;">${body}</p>
    </div>
    <div style="padding:16px 28px;background:#f9fafb;border-top:1px solid #e5e7eb;">
        <p style="margin:0;font-size:12px;color:#9ca3af;">
            Northie · Infraestrutura financeira para founders digitais<br/>
            Para ajustar alertas, acesse Configurações → Notificações.
        </p>
    </div>
</div>
</body>
</html>`;
    try {
        await resend.emails.send({
            from: process.env.RESEND_FROM_EMAIL ?? 'Northie <onboarding@resend.dev>',
            to,
            subject: `[Northie] ${title}`,
            html,
        });
        console.log(`[Alerts] Email enviado para ${to}: ${title}`);
    }
    catch (err) {
        console.warn(`[Alerts] Falha ao enviar email: ${err.message}`);
    }
}
async function createAlert(alert) {
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
    if (existing)
        return; // já existe alerta recente desse tipo
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
        return;
    }
    console.log(`[Alerts] ⚡ ${alert.severity.toUpperCase()} — ${alert.title} (profile: ${alert.profileId})`);
    // Envia email se o usuário optou por receber notificações por email
    if (alert.notifyEmail) {
        await sendAlertEmail(alert.notifyEmail, alert.title, alert.body, alert.severity);
    }
}
// ── Detectores ────────────────────────────────────────────────────────────────
async function checkRoasDrop(profileId, notifyEmail) {
    const today = new Date().toISOString().split('T')[0];
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const { data: metrics } = await supabase
        .from('ad_metrics')
        .select('platform, spend_brl, date')
        .eq('profile_id', profileId)
        .gte('date', sevenDaysAgo);
    if (!metrics?.length)
        return;
    const { data: txs } = await supabase
        .from('transactions')
        .select('amount_net, created_at, customers!inner(acquisition_channel)')
        .eq('profile_id', profileId)
        .eq('status', 'approved')
        .gte('created_at', sevenDaysAgo + 'T00:00:00Z');
    const channelMap = { meta: 'meta_ads', google: 'google_ads' };
    for (const platform of ['meta', 'google']) {
        const platformMetrics = metrics.filter(m => m.platform === platform);
        const channelKey = channelMap[platform] || platform;
        const platformTxs = txs?.filter(t => t.customers?.acquisition_channel === channelKey) || [];
        if (!platformMetrics.length)
            continue;
        const todaySpend = platformMetrics
            .filter(m => m.date === today || m.date === yesterday)
            .reduce((s, m) => s + Number(m.spend_brl), 0);
        const todayRev = platformTxs
            .filter(t => t.created_at.startsWith(today) || t.created_at.startsWith(yesterday))
            .reduce((s, t) => s + Number(t.amount_net), 0);
        const todayRoas = todaySpend > 0 ? todayRev / todaySpend : 0;
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
                notifyEmail,
            });
        }
    }
}
async function checkHighChurn(profileId, notifyEmail) {
    const { count: total } = await supabase
        .from('customers')
        .select('*', { count: 'exact', head: true })
        .eq('profile_id', profileId);
    if (!total || total < 10)
        return;
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
            notifyEmail,
        });
    }
}
async function checkRevenueZero(profileId, notifyEmail) {
    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const { count: todayCount } = await supabase
        .from('transactions')
        .select('*', { count: 'exact', head: true })
        .eq('profile_id', profileId)
        .eq('status', 'approved')
        .gte('created_at', today + 'T00:00:00Z');
    if (new Date().getHours() < 14)
        return;
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
            notifyEmail,
        });
    }
}
async function checkOrganicSpike(profileId, notifyEmail) {
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
            notifyEmail,
        });
    }
}
async function checkHighCac(profileId, notifyEmail) {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    // LTV médio da base
    const { data: ltvData } = await supabase
        .from('customers')
        .select('total_ltv')
        .eq('profile_id', profileId)
        .not('total_ltv', 'is', null);
    if (!ltvData?.length || ltvData.length < 5)
        return;
    const avgLtv = ltvData.reduce((s, c) => s + Number(c.total_ltv), 0) / ltvData.length;
    if (avgLtv <= 0)
        return;
    // Novos clientes nos últimos 30 dias (pelo menos 1 transação aprovada)
    const { count: newCustomers } = await supabase
        .from('customers')
        .select('*', { count: 'exact', head: true })
        .eq('profile_id', profileId)
        .gte('created_at', thirtyDaysAgo + 'T00:00:00Z');
    if (!newCustomers || newCustomers === 0)
        return;
    // Gasto total em ads nos últimos 30 dias
    const { data: spendData } = await supabase
        .from('ad_metrics')
        .select('spend_brl')
        .eq('profile_id', profileId)
        .gte('date', thirtyDaysAgo);
    if (!spendData?.length)
        return;
    const totalSpend = spendData.reduce((s, m) => s + Number(m.spend_brl), 0);
    const cac = totalSpend / newCustomers;
    if (cac > avgLtv) {
        await createAlert({
            profileId,
            type: 'high_cac',
            severity: cac > avgLtv * 1.5 ? 'critical' : 'warning',
            title: `CAC (R$ ${cac.toFixed(0)}) acima do LTV médio (R$ ${avgLtv.toFixed(0)})`,
            body: `Você está gastando mais para adquirir cada cliente do que ele vale historicamente. Revise seus canais pagos ou aumente o preço médio.`,
            meta: { cac: Math.round(cac), avgLtv: Math.round(avgLtv), newCustomers, totalSpend: Math.round(totalSpend) },
            notifyEmail,
        });
    }
}
async function checkBudgetSpike(profileId, notifyEmail) {
    const today = new Date().toISOString().split('T')[0];
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const { data: todayMetrics } = await supabase
        .from('ad_metrics')
        .select('spend_brl')
        .eq('profile_id', profileId)
        .in('date', [today, yesterday]);
    if (!todayMetrics?.length)
        return;
    const todaySpend = todayMetrics.reduce((s, m) => s + Number(m.spend_brl), 0);
    if (todaySpend <= 0)
        return;
    const { data: histMetrics } = await supabase
        .from('ad_metrics')
        .select('spend_brl, date')
        .eq('profile_id', profileId)
        .gte('date', thirtyDaysAgo)
        .not('date', 'in', `(${today},${yesterday})`);
    if (!histMetrics?.length)
        return;
    const uniqueDays = new Set(histMetrics.map(m => m.date)).size;
    if (uniqueDays < 7)
        return; // dados insuficientes
    const totalHist = histMetrics.reduce((s, m) => s + Number(m.spend_brl), 0);
    const avgDailySpend = totalHist / uniqueDays;
    if (avgDailySpend > 0 && todaySpend >= avgDailySpend * 2) {
        const multiple = (todaySpend / avgDailySpend).toFixed(1);
        await createAlert({
            profileId,
            type: 'budget_spike',
            severity: 'warning',
            title: `Gasto em ads hoje ${multiple}x acima da média diária`,
            body: `Você gastou R$ ${todaySpend.toFixed(0)} hoje vs média de R$ ${avgDailySpend.toFixed(0)}/dia nos últimos 30 dias. Verifique se há campanhas rodando fora do esperado.`,
            meta: { todaySpend: Math.round(todaySpend), avgDailySpend: Math.round(avgDailySpend), multiple: Number(multiple) },
            notifyEmail,
        });
    }
}
// ── Runner ────────────────────────────────────────────────────────────────────
async function runAlertsForAllProfiles() {
    console.log('[Alerts] Running alert checks...');
    const { data: profiles } = await supabase.from('profiles').select('id, workspace_config');
    for (const profile of profiles || []) {
        try {
            const notif = profile.workspace_config?.notifications ?? {};
            // Busca email do usuário se notificações por email estão ativas
            let notifyEmail;
            if (notif.email !== false) {
                const { data: userData } = await supabase.auth.admin.getUserById(profile.id);
                notifyEmail = userData?.user?.email || undefined;
            }
            const alertRoasEnabled = notif.alertRoas !== false;
            const alertCacEnabled = notif.alertCac !== false;
            const alertBudgetEnabled = notif.alertBudget === true; // default false
            const checks = [
                ...(alertRoasEnabled ? [{ fn: checkRoasDrop(profile.id, notifyEmail), name: 'checkRoasDrop' }] : []),
                ...(alertCacEnabled ? [{ fn: checkHighCac(profile.id, notifyEmail), name: 'checkHighCac' }] : []),
                ...(alertBudgetEnabled ? [{ fn: checkBudgetSpike(profile.id, notifyEmail), name: 'checkBudgetSpike' }] : []),
                { fn: checkHighChurn(profile.id, notifyEmail), name: 'checkHighChurn' },
                { fn: checkRevenueZero(profile.id, notifyEmail), name: 'checkRevenueZero' },
                { fn: checkOrganicSpike(profile.id, notifyEmail), name: 'checkOrganicSpike' },
            ];
            const results = await Promise.allSettled(checks.map(c => c.fn));
            results.forEach((r, i) => {
                if (r.status === 'rejected') {
                    console.error(`[Alerts] ${checks[i].name} failed for ${profile.id}:`, r.reason?.message);
                }
            });
        }
        catch (err) {
            console.error(`[Alerts] Error for profile ${profile.id}:`, err.message);
        }
    }
    console.log('[Alerts] Check complete.');
}
async function runAlertsWithMutex() {
    if (isRunning) {
        console.log('[AlertsJob] Já em execução, pulando ciclo');
        return;
    }
    isRunning = true;
    try {
        await runAlertsForAllProfiles();
    }
    finally {
        isRunning = false;
    }
}
export function startAlertsJob() {
    console.log('[Alerts] Job registered — will run every 2 hours.');
    setInterval(runAlertsWithMutex, 2 * 60 * 60 * 1000);
}
export { runAlertsForAllProfiles };
//# sourceMappingURL=alerts.job.js.map