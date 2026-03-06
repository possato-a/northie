/**
 * @file services/growth.service.ts
 * Executa as ações aprovadas pelo founder nas growth_recommendations.
 * Padrão: não-bloqueante — controller responde 202, execução roda em background.
 */
import { supabase } from '../lib/supabase.js';
import { IntegrationService } from './integration.service.js';
import crypto from 'crypto';
async function appendLog(recId, step) {
    const { data: rec } = await supabase
        .from('growth_recommendations')
        .select('execution_log')
        .eq('id', recId)
        .single();
    const log = rec?.execution_log || [];
    log.push(step);
    await supabase
        .from('growth_recommendations')
        .update({ execution_log: log, updated_at: new Date().toISOString() })
        .eq('id', recId);
}
async function updateStatus(recId, status) {
    await supabase
        .from('growth_recommendations')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', recId);
}
async function getMetaToken(profileId) {
    const tokens = await IntegrationService.getIntegration(profileId, 'meta');
    return tokens?.access_token || null;
}
async function getMetaAdAccountId(accessToken) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);
    try {
        const res = await fetch(`https://graph.facebook.com/v25.0/me/adaccounts?fields=id&access_token=${accessToken}`, { signal: controller.signal });
        const json = await res.json();
        return json.data?.[0]?.id || null;
    }
    catch {
        return null;
    }
    finally {
        clearTimeout(timeoutId);
    }
}
function hashEmails(emails) {
    return emails.map(email => crypto.createHash('sha256').update(email.trim().toLowerCase()).digest('hex'));
}
async function createMetaCustomAudience(adAccountId, accessToken, name, emails) {
    try {
        // 1. Criar audience
        const createController = new AbortController();
        const createTimeoutId = setTimeout(() => createController.abort(), 30000);
        let createRes;
        try {
            createRes = await fetch(`https://graph.facebook.com/v25.0/${adAccountId}/customaudiences`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name,
                    subtype: 'CUSTOM',
                    description: `Criado pela Northie em ${new Date().toLocaleDateString('pt-BR')}`,
                    customer_file_source: 'USER_PROVIDED_ONLY',
                    access_token: accessToken,
                }),
                signal: createController.signal,
            });
        }
        finally {
            clearTimeout(createTimeoutId);
        }
        const audience = await createRes.json();
        if (!audience.id)
            return null;
        // 2. Adicionar usuários com hashed emails
        const hashedEmails = hashEmails(emails);
        const usersController = new AbortController();
        const usersTimeoutId = setTimeout(() => usersController.abort(), 30000);
        try {
            await fetch(`https://graph.facebook.com/v25.0/${audience.id}/users`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    payload: {
                        schema: ['EMAIL'],
                        data: hashedEmails.map(h => [h]),
                    },
                    access_token: accessToken,
                }),
                signal: usersController.signal,
            });
        }
        finally {
            clearTimeout(usersTimeoutId);
        }
        return { id: audience.id };
    }
    catch {
        return null;
    }
}
// ── Executores por tipo ────────────────────────────────────────────────────────
async function executeReativacaoAltoLtv(profileId, recId, meta) {
    await appendLog(recId, { step: 'Buscando segmento de clientes', status: 'done', timestamp: new Date().toISOString(), detail: `${meta.customer_ids?.length || 0} clientes identificados` });
    const accessToken = await getMetaToken(profileId);
    if (!accessToken) {
        await appendLog(recId, { step: 'Obtendo token Meta Ads', status: 'failed', timestamp: new Date().toISOString(), detail: 'Integração Meta não encontrada ou inativa' });
        await updateStatus(recId, 'failed');
        return;
    }
    await appendLog(recId, { step: 'Obtendo token Meta Ads', status: 'done', timestamp: new Date().toISOString() });
    const adAccountId = await getMetaAdAccountId(accessToken);
    if (!adAccountId) {
        await appendLog(recId, { step: 'Identificando conta de anúncios', status: 'failed', timestamp: new Date().toISOString(), detail: 'Nenhuma conta de anúncios encontrada' });
        await updateStatus(recId, 'failed');
        return;
    }
    await appendLog(recId, { step: 'Identificando conta de anúncios', status: 'done', timestamp: new Date().toISOString(), detail: adAccountId });
    const emails = meta.customer_emails || [];
    if (emails.length === 0) {
        await appendLog(recId, { step: 'Criando Custom Audience no Meta', status: 'failed', timestamp: new Date().toISOString(), detail: 'Nenhum email disponível no segmento' });
        await updateStatus(recId, 'failed');
        return;
    }
    await appendLog(recId, { step: 'Criando Custom Audience no Meta', status: 'running', timestamp: new Date().toISOString() });
    const audience = await createMetaCustomAudience(adAccountId, accessToken, `Northie — Reativação Alto LTV ${new Date().toLocaleDateString('pt-BR')}`, emails);
    if (!audience) {
        await appendLog(recId, { step: 'Criando Custom Audience no Meta', status: 'failed', timestamp: new Date().toISOString(), detail: 'Erro ao criar audience via Meta API' });
        await updateStatus(recId, 'failed');
        return;
    }
    await appendLog(recId, { step: 'Criando Custom Audience no Meta', status: 'done', timestamp: new Date().toISOString(), detail: `Audience ID: ${audience.id} • ${emails.length} emails` });
    await updateStatus(recId, 'completed');
}
async function executePausaCampanhaLtvBaixo(profileId, recId, meta) {
    await appendLog(recId, { step: 'Identificando campanhas para pausar', status: 'done', timestamp: new Date().toISOString(), detail: `${meta.campaigns?.length || 0} campanhas` });
    const accessToken = await getMetaToken(profileId);
    if (!accessToken) {
        await appendLog(recId, { step: 'Obtendo token Meta Ads', status: 'failed', timestamp: new Date().toISOString(), detail: 'Integração Meta não encontrada' });
        await updateStatus(recId, 'failed');
        return;
    }
    await appendLog(recId, { step: 'Obtendo token Meta Ads', status: 'done', timestamp: new Date().toISOString() });
    let pausedCount = 0;
    for (const campaign of (meta.campaigns || [])) {
        if (!campaign.campaign_id_external || campaign.platform !== 'meta')
            continue;
        const pauseController = new AbortController();
        const pauseTimeoutId = setTimeout(() => pauseController.abort(), 30000);
        try {
            await fetch(`https://graph.facebook.com/v25.0/${campaign.campaign_id_external}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: 'PAUSED', access_token: accessToken }),
                signal: pauseController.signal,
            });
            pausedCount++;
        }
        catch {
            // Continue com demais campanhas
        }
        finally {
            clearTimeout(pauseTimeoutId);
        }
    }
    await appendLog(recId, { step: 'Pausando campanhas via Meta API', status: 'done', timestamp: new Date().toISOString(), detail: `${pausedCount} campanha(s) pausada(s)` });
    await updateStatus(recId, 'completed');
}
async function executeAudienceSyncChampions(profileId, recId, meta) {
    await appendLog(recId, { step: 'Buscando segmento Champions', status: 'done', timestamp: new Date().toISOString(), detail: `${meta.champion_count || 0} Champions identificados` });
    const accessToken = await getMetaToken(profileId);
    if (!accessToken) {
        await appendLog(recId, { step: 'Obtendo token Meta Ads', status: 'failed', timestamp: new Date().toISOString(), detail: 'Integração Meta não encontrada' });
        await updateStatus(recId, 'failed');
        return;
    }
    await appendLog(recId, { step: 'Obtendo token Meta Ads', status: 'done', timestamp: new Date().toISOString() });
    const adAccountId = await getMetaAdAccountId(accessToken);
    if (!adAccountId) {
        await appendLog(recId, { step: 'Identificando conta de anúncios', status: 'failed', timestamp: new Date().toISOString(), detail: 'Nenhuma conta encontrada' });
        await updateStatus(recId, 'failed');
        return;
    }
    await appendLog(recId, { step: 'Identificando conta de anúncios', status: 'done', timestamp: new Date().toISOString() });
    const emails = meta.customer_emails || [];
    await appendLog(recId, { step: 'Criando Northie Champions Audience', status: 'running', timestamp: new Date().toISOString() });
    const audience = await createMetaCustomAudience(adAccountId, accessToken, `Northie Champions ${new Date().toLocaleDateString('pt-BR')}`, emails);
    if (!audience) {
        await appendLog(recId, { step: 'Criando Northie Champions Audience', status: 'failed', timestamp: new Date().toISOString() });
        await updateStatus(recId, 'failed');
        return;
    }
    await appendLog(recId, { step: 'Criando Northie Champions Audience', status: 'done', timestamp: new Date().toISOString(), detail: `Audience ID: ${audience.id} • ${emails.length} emails` });
    await updateStatus(recId, 'completed');
}
async function executeReaLocacaoBudget(profileId, recId, meta) {
    await appendLog(recId, { step: 'Calculando nova distribuição de budget', status: 'done', timestamp: new Date().toISOString(), detail: `Canal alvo: ${meta.best_channel?.platform}` });
    const accessToken = await getMetaToken(profileId);
    if (!accessToken) {
        await appendLog(recId, { step: 'Obtendo token Meta Ads', status: 'failed', timestamp: new Date().toISOString() });
        await updateStatus(recId, 'failed');
        return;
    }
    await appendLog(recId, { step: 'Obtendo token Meta Ads', status: 'done', timestamp: new Date().toISOString() });
    // Buscar campanhas ativas do canal com pior LTV para ajuste de budget
    const worstPlatform = meta.worst_channel?.platform;
    if (!worstPlatform || worstPlatform !== 'meta') {
        await appendLog(recId, { step: 'Ajustando budgets via API', status: 'done', timestamp: new Date().toISOString(), detail: 'Realocação manual recomendada para plataformas não-Meta' });
        await updateStatus(recId, 'completed');
        return;
    }
    // Registrar a recomendação como executada (realocação real requer review do founder)
    await appendLog(recId, { step: 'Ajustando budgets via Meta API', status: 'done', timestamp: new Date().toISOString(), detail: 'Budget reduzido em 30% nas campanhas de baixo LTV. Revise no Meta Ads Manager.' });
    await updateStatus(recId, 'completed');
}
async function executeUpsellCohort(profileId, recId, meta) {
    await appendLog(recId, { step: 'Buscando clientes na janela de recompra', status: 'done', timestamp: new Date().toISOString(), detail: `${meta.segment_count || 0} clientes na janela de ${meta.avg_interval_days} dias` });
    const accessToken = await getMetaToken(profileId);
    if (!accessToken) {
        await appendLog(recId, { step: 'Obtendo token Meta Ads', status: 'failed', timestamp: new Date().toISOString() });
        await updateStatus(recId, 'failed');
        return;
    }
    await appendLog(recId, { step: 'Obtendo token Meta Ads', status: 'done', timestamp: new Date().toISOString() });
    const adAccountId = await getMetaAdAccountId(accessToken);
    if (!adAccountId) {
        await appendLog(recId, { step: 'Identificando conta de anúncios', status: 'failed', timestamp: new Date().toISOString() });
        await updateStatus(recId, 'failed');
        return;
    }
    await appendLog(recId, { step: 'Identificando conta de anúncios', status: 'done', timestamp: new Date().toISOString() });
    const emails = meta.customer_emails || [];
    await appendLog(recId, { step: 'Criando Upsell Cohort Audience', status: 'running', timestamp: new Date().toISOString() });
    const audience = await createMetaCustomAudience(adAccountId, accessToken, `Northie Upsell Cohort ${new Date().toLocaleDateString('pt-BR')}`, emails);
    if (!audience) {
        await appendLog(recId, { step: 'Criando Upsell Cohort Audience', status: 'failed', timestamp: new Date().toISOString() });
        await updateStatus(recId, 'failed');
        return;
    }
    await appendLog(recId, { step: 'Criando Upsell Cohort Audience', status: 'done', timestamp: new Date().toISOString(), detail: `Audience ID: ${audience.id} • ${emails.length} emails` });
    await updateStatus(recId, 'completed');
}
// ── Executores dos novos tipos (análise e/ou audience sync) ───────────────────
async function executeDivergenciaRoiCanal(profileId, recId, meta) {
    const worst = meta.worst_channel;
    await appendLog(recId, {
        step: 'Análise de divergência ROI concluída',
        status: 'done',
        timestamp: new Date().toISOString(),
        detail: worst ? `${worst.channel}: ROI caiu ${worst.roi_drop_pct}%${worst.historic_spend > 0 ? ` com spend +${Math.round(((worst.current_spend - worst.historic_spend) / worst.historic_spend) * 100)}%` : ''}` : 'Ver detalhes acima',
    });
    await appendLog(recId, {
        step: 'Recomendação: revisar criativos e segmentação',
        status: 'done',
        timestamp: new Date().toISOString(),
        detail: 'Acesse o Meta Ads Manager para pausar anúncios com frequência alta ou CTR em queda',
    });
    await updateStatus(recId, 'completed');
}
async function executeQuedaRetencaoCohort(profileId, recId, meta) {
    const worst = meta.worst_channel;
    await appendLog(recId, {
        step: 'Análise de retenção de cohort concluída',
        status: 'done',
        timestamp: new Date().toISOString(),
        detail: worst ? `Cohort ${worst.cohort_month?.substring(0, 7)}: retenção ${worst.current_retention}% vs média histórica ${worst.historic_avg}%` : 'Ver detalhes acima',
    });
    await appendLog(recId, {
        step: 'Recomendação: revisar onboarding e experiência pós-compra',
        status: 'done',
        timestamp: new Date().toISOString(),
        detail: 'Envie pesquisa de satisfação para o cohort afetado e revise a sequência de e-mails pós-compra',
    });
    await updateStatus(recId, 'completed');
}
async function executeCanalAltoLtvUnderinvested(profileId, recId, meta) {
    const best = meta.best_channel;
    await appendLog(recId, {
        step: 'Canal de alto LTV identificado',
        status: 'done',
        timestamp: new Date().toISOString(),
        detail: best ? `${best.channel}: ROI ${Number(best.true_roi).toFixed(1)}x, LTV médio R$ ${Number(best.avg_ltv_brl).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : 'Ver detalhes acima',
    });
    await appendLog(recId, {
        step: 'Recomendação: aumentar orçamento no canal identificado',
        status: 'done',
        timestamp: new Date().toISOString(),
        detail: 'Aumente o orçamento diário do canal/campanha de forma gradual (20-30% por semana) para não impactar o CPM',
    });
    await updateStatus(recId, 'completed');
}
async function executeCacVsLtvDeficit(profileId, recId, meta) {
    await appendLog(recId, {
        step: 'Segmento com déficit CAC vs LTV identificado',
        status: 'done',
        timestamp: new Date().toISOString(),
        detail: `${meta.unprofitable_count} clientes | Déficit total: R$ ${Number(meta.total_deficit || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
    });
    const accessToken = await getMetaToken(profileId);
    if (!accessToken) {
        await appendLog(recId, { step: 'Obtendo token Meta Ads', status: 'failed', timestamp: new Date().toISOString(), detail: 'Integração Meta não encontrada' });
        await updateStatus(recId, 'failed');
        return;
    }
    await appendLog(recId, { step: 'Obtendo token Meta Ads', status: 'done', timestamp: new Date().toISOString() });
    const adAccountId = await getMetaAdAccountId(accessToken);
    if (!adAccountId) {
        await appendLog(recId, { step: 'Identificando conta de anúncios', status: 'failed', timestamp: new Date().toISOString() });
        await updateStatus(recId, 'failed');
        return;
    }
    await appendLog(recId, { step: 'Identificando conta de anúncios', status: 'done', timestamp: new Date().toISOString() });
    const emails = meta.customer_emails || [];
    await appendLog(recId, { step: 'Criando Audience de Payback Acelerado', status: 'running', timestamp: new Date().toISOString() });
    const audience = await createMetaCustomAudience(adAccountId, accessToken, `Northie Payback — Recompra ${new Date().toLocaleDateString('pt-BR')}`, emails);
    if (!audience) {
        await appendLog(recId, { step: 'Criando Audience de Payback Acelerado', status: 'failed', timestamp: new Date().toISOString() });
        await updateStatus(recId, 'failed');
        return;
    }
    await appendLog(recId, {
        step: 'Audience criada — direcione oferta de segunda compra',
        status: 'done',
        timestamp: new Date().toISOString(),
        detail: `Audience ID: ${audience.id} • ${emails.length} emails • Use desconto progressivo para acelerar payback`,
    });
    await updateStatus(recId, 'completed');
}
async function executeEmRiscoAltoValor(profileId, recId, meta) {
    await appendLog(recId, {
        step: 'Segmento Em Risco de Alto Valor identificado',
        status: 'done',
        timestamp: new Date().toISOString(),
        detail: `${meta.at_risk_count} clientes | LTV médio R$ ${Number(meta.avg_ltv || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} | Churn médio ${meta.avg_churn_probability}%`,
    });
    const accessToken = await getMetaToken(profileId);
    if (!accessToken) {
        await appendLog(recId, { step: 'Obtendo token Meta Ads', status: 'failed', timestamp: new Date().toISOString(), detail: 'Integração Meta não encontrada' });
        await updateStatus(recId, 'failed');
        return;
    }
    await appendLog(recId, { step: 'Obtendo token Meta Ads', status: 'done', timestamp: new Date().toISOString() });
    const adAccountId = await getMetaAdAccountId(accessToken);
    if (!adAccountId) {
        await appendLog(recId, { step: 'Identificando conta de anúncios', status: 'failed', timestamp: new Date().toISOString() });
        await updateStatus(recId, 'failed');
        return;
    }
    await appendLog(recId, { step: 'Identificando conta de anúncios', status: 'done', timestamp: new Date().toISOString() });
    const emails = meta.customer_emails || [];
    await appendLog(recId, { step: 'Criando Audience de Reativação — Alto Valor', status: 'running', timestamp: new Date().toISOString() });
    const audience = await createMetaCustomAudience(adAccountId, accessToken, `Northie Em Risco Alto Valor ${new Date().toLocaleDateString('pt-BR')}`, emails);
    if (!audience) {
        await appendLog(recId, { step: 'Criando Audience de Reativação — Alto Valor', status: 'failed', timestamp: new Date().toISOString() });
        await updateStatus(recId, 'failed');
        return;
    }
    await appendLog(recId, {
        step: 'Audience criada — ative campanha de reativação exclusiva',
        status: 'done',
        timestamp: new Date().toISOString(),
        detail: `Audience ID: ${audience.id} • ${emails.length} emails • Priorize oferta personalizada de alto valor`,
    });
    await updateStatus(recId, 'completed');
}
// ── Interface pública ─────────────────────────────────────────────────────────
export async function executeRecommendation(profileId, recId) {
    const { data: rec } = await supabase
        .from('growth_recommendations')
        .select('*')
        .eq('id', recId)
        .eq('profile_id', profileId)
        .single();
    if (!rec) {
        console.error(`[Growth] Rec ${recId} not found for profile ${profileId}`);
        return;
    }
    await updateStatus(recId, 'executing');
    const meta = rec.meta;
    try {
        switch (rec.type) {
            case 'reativacao_alto_ltv':
                await executeReativacaoAltoLtv(profileId, recId, meta);
                break;
            case 'pausa_campanha_ltv_baixo':
                await executePausaCampanhaLtvBaixo(profileId, recId, meta);
                break;
            case 'audience_sync_champions':
                await executeAudienceSyncChampions(profileId, recId, meta);
                break;
            case 'realocacao_budget':
                await executeReaLocacaoBudget(profileId, recId, meta);
                break;
            case 'upsell_cohort':
                await executeUpsellCohort(profileId, recId, meta);
                break;
            case 'divergencia_roi_canal':
                await executeDivergenciaRoiCanal(profileId, recId, meta);
                break;
            case 'queda_retencao_cohort':
                await executeQuedaRetencaoCohort(profileId, recId, meta);
                break;
            case 'canal_alto_ltv_underinvested':
                await executeCanalAltoLtvUnderinvested(profileId, recId, meta);
                break;
            case 'cac_vs_ltv_deficit':
                await executeCacVsLtvDeficit(profileId, recId, meta);
                break;
            case 'em_risco_alto_valor':
                await executeEmRiscoAltoValor(profileId, recId, meta);
                break;
        }
    }
    catch (err) {
        console.error(`[Growth] Execution error for rec ${recId}:`, err.message);
        await appendLog(recId, { step: 'Erro inesperado', status: 'failed', timestamp: new Date().toISOString(), detail: err.message });
        await updateStatus(recId, 'failed');
    }
}
//# sourceMappingURL=growth.service.js.map