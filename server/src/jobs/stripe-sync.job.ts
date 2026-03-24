/**
 * @file jobs/stripe-sync.job.ts
 * Backfill histórico de pagamentos do Stripe via API.
 * Usa payment_intent.id como external_id para garantir idempotência.
 * Segue o mesmo padrão do hotmart-sync.job.ts.
 */

import Stripe from 'stripe';
import { supabase } from '../lib/supabase.js';
import { IntegrationService } from '../services/integration.service.js';

/**
 * Instancia o cliente Stripe usando a conta conectada via Connect.
 * O access_token retornado no OAuth é a secret key da conta do usuário.
 */
function getStripeClient(connectedAccountKey: string): Stripe {
    return new Stripe(connectedAccountKey, {
        apiVersion: '2026-01-28.clover',
    });
}

/**
 * Persiste um PaymentIntent aprovado no banco (idempotente via external_id).
 */
async function processPaymentIntent(
    profileId: string,
    pi: Stripe.PaymentIntent,
): Promise<'synced' | 'skipped' | 'error'> {
    try {
        // Idempotência — verifica se já existe
        const { data: existing } = await supabase
            .from('transactions')
            .select('id')
            .eq('profile_id', profileId)
            .eq('external_id', pi.id)
            .single();

        if (existing) return 'skipped';

        // Tenta extrair e-mail e nome do PaymentIntent
        const email: string = (pi as unknown as { receipt_email?: string }).receipt_email || 'unknown@stripe.com';
        const name: string = '';

        // Upsert customer
        const { data: customer, error: custError } = await supabase
            .from('customers')
            .upsert(
                {
                    profile_id: profileId,
                    email,
                    name,
                    acquisition_channel: 'direto',
                },
                { onConflict: 'profile_id, email' }
            )
            .select('id, total_ltv')
            .single();

        if (custError || !customer) {
            console.error(`[StripeSync] Customer upsert failed for ${email}:`, custError?.message);
            return 'error';
        }

        const amountGross = pi.amount / 100; // Stripe usa centavos
        const amountNet = pi.amount_received / 100;

        // Insert transaction
        const { error: txError } = await supabase.from('transactions').insert({
            profile_id: profileId,
            customer_id: customer.id,
            platform: 'stripe',
            external_id: pi.id,
            amount_gross: amountGross,
            amount_net: amountNet,
            status: 'approved',
            created_at: new Date(pi.created * 1000).toISOString(),
        });

        if (txError) {
            if (txError.code === '23505') return 'skipped'; // unique constraint — já existe
            console.error(`[StripeSync] Transaction insert failed for ${pi.id}:`, txError.message);
            return 'error';
        }

        // Atualiza LTV do cliente
        const newLtv = (Number(customer.total_ltv) || 0) + amountNet;
        await supabase
            .from('customers')
            .update({
                total_ltv: newLtv,
                last_purchase_at: new Date(pi.created * 1000).toISOString(),
            })
            .eq('id', customer.id);

        return 'synced';
    } catch (e: unknown) {
        console.error(`[StripeSync] Unexpected error processing PI ${pi.id}:`, e instanceof Error ? e.message : String(e));
        return 'error';
    }
}

/**
 * Atualiza uma transação existente para status 'refunded' e ajusta LTV.
 */
async function processRefund(profileId: string, refund: Stripe.Refund): Promise<void> {
    const { payment_intent: piId } = refund;
    if (!piId || typeof piId !== 'string') return;

    const { data: tx } = await supabase
        .from('transactions')
        .select('id, customer_id, amount_gross, status')
        .eq('profile_id', profileId)
        .eq('external_id', piId)
        .single();

    if (!tx || tx.status === 'refunded') return;

    await supabase.from('transactions').update({ status: 'refunded' }).eq('id', tx.id);

    const refundAmount = refund.amount / 100;
    const { data: customer } = await supabase
        .from('customers')
        .select('total_ltv')
        .eq('id', tx.customer_id)
        .single();

    if (customer) {
        const newLtv = Math.max(0, (Number(customer.total_ltv) || 0) - refundAmount);
        await supabase.from('customers').update({ total_ltv: newLtv }).eq('id', tx.customer_id);
    }
}

/**
 * Backfill de PaymentIntents Stripe para um perfil.
 * - days=0 ou undefined: busca os últimos 365 dias
 * - days=N: busca os últimos N dias
 */
export async function backfillStripe(
    profileId: string,
    days?: number,
): Promise<{ synced: number; skipped: number; errors: number }> {
    const effectiveDays = (!days || days <= 0) ? 365 : days;
    const startTs = Math.floor((Date.now() - effectiveDays * 24 * 60 * 60 * 1000) / 1000);

    console.log(`[StripeSync] Starting backfill for profile ${profileId} — last ${effectiveDays} days`);

    const integration = await IntegrationService.getIntegration(profileId, 'stripe');
    if (!integration) {
        throw new Error(`[StripeSync] No Stripe integration for profile ${profileId}`);
    }

    const { access_token } = integration as unknown as { access_token?: string };
    if (!access_token) {
        throw new Error(`[StripeSync] Missing access_token for profile ${profileId}`);
    }

    const stripe = getStripeClient(access_token);

    let synced = 0;
    let skipped = 0;
    let errors = 0;

    // ── PaymentIntents (succeeded) ───────────────────────────────────────────
    console.log(`[StripeSync] Fetching succeeded PaymentIntents since ${new Date(startTs * 1000).toISOString()}`);

    for await (const pi of stripe.paymentIntents.list({
        created: { gte: startTs },
        limit: 100,
    })) {
        if (pi.status !== 'succeeded') continue;
        const result = await processPaymentIntent(profileId, pi);
        if (result === 'synced') synced++;
        else if (result === 'skipped') skipped++;
        else errors++;
    }

    // ── Refunds ───────────────────────────────────────────────────────────────
    console.log(`[StripeSync] Fetching refunds since ${new Date(startTs * 1000).toISOString()}`);

    for await (const refund of stripe.refunds.list({
        created: { gte: startTs },
        limit: 100,
    })) {
        try {
            await processRefund(profileId, refund);
        } catch (e: unknown) {
            console.error(`[StripeSync] Error processing refund ${refund.id}:`, e instanceof Error ? e.message : String(e));
            errors++;
        }
    }

    console.log(`[StripeSync] Done for ${profileId}: ${synced} synced, ${skipped} skipped, ${errors} errors`);
    return { synced, skipped, errors };
}

/**
 * Roda o backfill dos últimos 2 dias para todos os profiles com Stripe ativo.
 * Usado pelo cron de reconciliação diária.
 */
export async function runStripeSyncForAllProfiles(): Promise<void> {
    const { data: integrations } = await supabase
        .from('integrations')
        .select('profile_id')
        .eq('platform', 'stripe')
        .eq('status', 'active');

    if (!integrations?.length) {
        console.log('[StripeSync] No active Stripe integrations found.');
        return;
    }

    console.log(`[StripeSync] Running cron sync for ${integrations.length} profile(s)...`);

    for (const { profile_id } of integrations) {
        try {
            await backfillStripe(profile_id, 2);
        } catch (e: unknown) {
            console.error(`[StripeSync] Cron failed for profile ${profile_id}:`, e instanceof Error ? e.message : String(e));
        }
    }
}
