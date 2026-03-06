import { supabase } from '../lib/supabase.js';
import crypto from 'crypto';
/**
 * Normalizes raw platform data into the Northie Schema (Transactions, Customers, etc.)
 */
export async function normalizeData(rawId, platform, payload, profileId) {
    console.log(`Starting normalization for ${platform} - RawID: ${rawId}`);
    try {
        if (platform === 'stripe') {
            await handleStripeNormalization(payload, profileId);
        }
        else if (platform === 'hotmart') {
            await handleHotmartNormalization(payload, profileId);
        }
        else if (platform === 'shopify') {
            await handleShopifyNormalization(payload, profileId);
        }
        else {
            console.warn(`No normalization handler for platform: ${platform}`);
            return;
        }
        // Mark as processed
        await supabase
            .from('platforms_data_raw')
            .update({ processed: true })
            .eq('id', rawId);
    }
    catch (error) {
        console.error(`Error normalizing ${platform} data:`, error);
        throw error;
    }
}
/**
 * Specific handler for Stripe Webhooks.
 * Handles checkout.session.completed, payment_intent.succeeded, and charge.refunded.
 */
async function handleStripeNormalization(payload, profileId) {
    const eventType = payload.type;
    const obj = payload.data?.object;
    if (eventType === 'checkout.session.completed') {
        const email = obj.customer_details?.email;
        const amount = obj.amount_total / 100;
        const visitorId = obj.metadata?.northie_vid || obj.metadata?.visitorId;
        if (!email)
            throw new Error('Customer email missing in Stripe checkout session');
        await syncTransaction(profileId, email, 'stripe', obj.id, amount, visitorId);
        return;
    }
    if (eventType === 'payment_intent.succeeded') {
        // Se veio de um checkout session, checkout.session.completed já criou a transação
        if (obj.invoice || obj.metadata?.checkout_session_id) {
            console.log(`[Stripe] payment_intent.succeeded ignorado (já processado via checkout/invoice)`);
            return;
        }
        const email = obj.receipt_email || 'unknown@stripe.com';
        const amount = obj.amount_received / 100;
        const visitorId = obj.metadata?.northie_vid || obj.metadata?.visitorId;
        await syncTransaction(profileId, email, 'stripe', obj.id, amount, visitorId);
        return;
    }
    if (eventType === 'charge.refunded') {
        const piId = typeof obj.payment_intent === 'string' ? obj.payment_intent : null;
        const email = obj.billing_details?.email || 'unknown@stripe.com';
        const refundAmount = obj.amount_refunded / 100;
        if (piId) {
            await syncRefund(profileId, email, piId, refundAmount);
        }
        return;
    }
    // Subscription lifecycle — atualiza status do cliente para cálculo de MRR/churn
    if (eventType === 'customer.subscription.deleted' || eventType === 'customer.subscription.updated') {
        const status = obj.status; // active, canceled, past_due, unpaid
        // Stripe subscription object não tem email direto — busca via customer ID no nosso banco
        // O external_id da transação original contém o payment_intent/checkout que linkamos ao customer
        const stripeCustomerId = typeof obj.customer === 'string' ? obj.customer : null;
        let customerEmail = obj.metadata?.email || null;
        // Se não tem email no metadata, tenta buscar pelo stripe customer ID nas transações existentes
        if (!customerEmail && stripeCustomerId) {
            const { data: existingTx } = await supabase
                .from('transactions')
                .select('customer_id, customers!inner(email)')
                .eq('profile_id', profileId)
                .eq('platform', 'stripe')
                .limit(1)
                .single();
            customerEmail = existingTx?.customers?.email || null;
        }
        if (customerEmail) {
            const churnStatuses = ['canceled', 'unpaid'];
            const isChurned = churnStatuses.includes(status);
            await supabase
                .from('customers')
                .update({
                subscription_status: status,
                ...(isChurned ? { churned_at: new Date().toISOString() } : { churned_at: null }),
            })
                .eq('profile_id', profileId)
                .eq('email', customerEmail);
            console.log(`[Stripe] Subscription ${eventType} for ${customerEmail}: status=${status}`);
        }
        else {
            console.warn(`[Stripe] Subscription ${eventType}: could not resolve customer email for ${stripeCustomerId}`);
        }
        return;
    }
    console.log(`[Stripe] Evento ignorado: ${eventType}`);
}
// Eventos Hotmart que representam cancelamento/falha (sem impacto financeiro positivo)
const HOTMART_CANCELLED_EVENTS = new Set([
    'PURCHASE_CANCELED',
    'PURCHASE_EXPIRED',
    'PURCHASE_DENIED',
    'PURCHASE_PROTEST',
    'PURCHASE_CHARGEBACK',
]);
async function handleHotmartNormalization(payload, profileId) {
    const { event, data } = payload;
    const transactionId = data.purchase?.transaction ?? data.subscription?.subscriber_code ?? '';
    if (!transactionId) {
        console.warn(`[Hotmart] Evento ${event} sem transaction ID — ignorando`);
        return;
    }
    // ── Venda aprovada ────────────────────────────────────────────────────────
    if (event === 'PURCHASE_APPROVED') {
        const email = data.buyer.email;
        const amount = data.purchase.full_price.value;
        const fee = data.purchase.hotmart_fee?.total?.value ?? 0;
        const visitorId = data.purchase.src || data.purchase.hsrc || data.hsrc || data.src || undefined;
        const productName = data.product?.name;
        const paymentMethod = mapPaymentType(data.purchase?.payment?.type) ?? undefined;
        const buyerName = data.buyer?.name;
        console.log(`[Hotmart] PURCHASE_APPROVED for ${email}. Fee: ${fee}. VisitorId: ${visitorId ?? 'none'}. Product: ${productName}`);
        await syncTransaction(profileId, email, 'hotmart', transactionId, amount, visitorId, fee, {
            productName, paymentMethod: paymentMethod ?? undefined, customerName: buyerName,
        });
        return;
    }
    // ── Assinatura nova ───────────────────────────────────────────────────────
    if (event === 'SUBSCRIPTION_ACTIVATED') {
        const email = data.buyer.email;
        const amount = data.purchase.full_price.value;
        const fee = data.purchase.hotmart_fee?.total?.value ?? 0;
        const visitorId = data.purchase.src || data.purchase.hsrc || undefined;
        console.log(`[Hotmart] SUBSCRIPTION_ACTIVATED for ${email} tx=${transactionId}. Fee: ${fee}`);
        await syncTransaction(profileId, email, 'hotmart', transactionId, amount, visitorId, fee, {
            productName: data.product?.name, paymentMethod: mapPaymentType(data.purchase?.payment?.type) ?? undefined, customerName: data.buyer?.name,
        });
        return;
    }
    // ── Reativação de assinatura ──────────────────────────────────────────────
    // SUBSCRIPTION_REACTIVATED = usuário pagou novamente após cancelamento.
    // Cada reativação gera uma nova cobrança com purchase.transaction único.
    // Se só temos subscriber_code (sem purchase.transaction), ignoramos para evitar duplicata.
    if (event === 'SUBSCRIPTION_REACTIVATED') {
        const purchaseTxId = data.purchase?.transaction;
        if (!purchaseTxId) {
            console.log(`[Hotmart] SUBSCRIPTION_REACTIVATED sem purchase.transaction — ignorando (subscriber_code não é único por cobrança)`);
            return;
        }
        const email = data.buyer.email;
        const amount = data.purchase.full_price.value;
        const fee = data.purchase.hotmart_fee?.total?.value ?? 0;
        console.log(`[Hotmart] SUBSCRIPTION_REACTIVATED for ${email} tx=${purchaseTxId}. Fee: ${fee}`);
        await syncTransaction(profileId, email, 'hotmart', purchaseTxId, amount, undefined, fee, {
            productName: data.product?.name, paymentMethod: mapPaymentType(data.purchase?.payment?.type) ?? undefined, customerName: data.buyer?.name,
        });
        return;
    }
    if (event === 'SUBSCRIPTION_CANCELLATION') {
        console.log(`[Hotmart] SUBSCRIPTION_CANCELLATION tx=${transactionId} — marcando como cancelled`);
        await syncCancellation(profileId, transactionId);
        return;
    }
    // ── Reembolso ─────────────────────────────────────────────────────────────
    if (event === 'PURCHASE_REFUNDED') {
        const amount = data.purchase.full_price.value;
        const email = data.buyer.email;
        console.log(`[Hotmart] PURCHASE_REFUNDED tx=${transactionId} amount=${amount}`);
        await syncRefund(profileId, email, transactionId, amount);
        return;
    }
    // ── Cancelamentos / falhas ────────────────────────────────────────────────
    if (HOTMART_CANCELLED_EVENTS.has(event)) {
        console.log(`[Hotmart] ${event} tx=${transactionId} — marcando como cancelled`);
        await syncCancellation(profileId, transactionId);
        return;
    }
    // Outros eventos (PURCHASE_COMPLETE, PURCHASE_DELAYED, etc.) — sem ação
    console.log(`[Hotmart] Evento ignorado: ${event}`);
}
/**
 * Handler para webhooks Shopify.
 * Topics suportados: orders/paid, customers/create, customers/update.
 * O visitorId é injetado via note_attributes pelo pixel Northie no checkout.
 */
async function handleShopifyNormalization(payload, profileId) {
    const topic = payload._topic ?? '';
    // ── orders/paid ──────────────────────────────────────────────────────────
    if (topic === 'orders/paid' || (!topic && payload.financial_status === 'paid')) {
        if (payload.financial_status !== 'paid')
            return;
        const email = payload.email || payload.customer?.email;
        if (!email) {
            console.warn('[Shopify] orders/paid sem email — ignorando');
            return;
        }
        const amountGross = parseFloat(payload.total_price);
        // total_price já reflete descontos — fee_platform = apenas impostos para isolar o valor líquido real
        const tax = parseFloat(payload.total_tax || '0');
        const feePlatform = parseFloat(tax.toFixed(2));
        const transactionId = String(payload.id);
        // Pixel injeta visitorId como note_attribute { name: 'northie_vid', value: '...' }
        const noteAttrs = payload.note_attributes || [];
        const visitorId = noteAttrs.find((a) => a.name === 'northie_vid')?.value;
        // Nome do produto principal (primeiro line item)
        const lineItems = payload.line_items || [];
        const productName = lineItems[0]
            ? [lineItems[0].title, lineItems[0].variant_title].filter(Boolean).join(' — ')
            : undefined;
        console.log(`[Shopify] Normalizing order ${transactionId} for ${email}. VisitorId: ${visitorId}`);
        await syncTransaction(profileId, email, 'shopify', transactionId, amountGross, visitorId, feePlatform, productName ? { productName } : undefined);
        return;
    }
    // ── customers/create | customers/update ──────────────────────────────────
    if (topic === 'customers/create' || topic === 'customers/update') {
        const email = payload.email;
        if (!email)
            return;
        const name = [payload.first_name, payload.last_name].filter(Boolean).join(' ') || undefined;
        const phone = payload.phone || undefined;
        const { error } = await supabase
            .from('customers')
            .upsert({
            profile_id: profileId,
            email,
            ...(name ? { name } : {}),
            ...(phone ? { phone } : {}),
        }, { onConflict: 'profile_id,email', ignoreDuplicates: false });
        if (error)
            console.error(`[Shopify] Customer upsert error for ${email}:`, error.message);
        else
            console.log(`[Shopify] Customer synced via ${topic}: ${email}`);
        return;
    }
    // ── refunds/create ───────────────────────────────────────────────────────
    // Payload do REFUNDS_CREATE: { id (refund_id), order_id, transactions: [{amount}] }
    // Diferente de orders/refunded (topic inexistente na Shopify API)
    if (topic === 'refunds/create') {
        const orderId = String(payload.order_id);
        if (!orderId || orderId === 'undefined') {
            console.warn(`[Shopify] refunds/create sem order_id — ignorando`);
            return;
        }
        // Soma os amounts de todas as transações do reembolso
        const refundAmount = (payload.transactions || [])
            .reduce((sum, t) => sum + parseFloat(t.amount || '0'), 0);
        console.log(`[Shopify] Reembolso refund_id=${payload.id} order_id=${orderId} valor=${refundAmount}`);
        await syncRefund(profileId, `shopify-order-${orderId}`, orderId, refundAmount);
        return;
    }
    // ── orders/cancelled ─────────────────────────────────────────────────────
    if (topic === 'orders/cancelled') {
        const transactionId = String(payload.id);
        console.log(`[Shopify] Cancelamento order ${transactionId}`);
        await syncCancellation(profileId, transactionId);
        return;
    }
    console.log(`[Shopify] Topic ignorado: ${topic}`);
}
/**
 * Marca uma transação como reembolsada e reverte o LTV do cliente.
 */
async function syncRefund(profileId, email, externalId, amount) {
    // Busca a transação original pelo external_id
    const { data: tx } = await supabase
        .from('transactions')
        .select('id, customer_id, amount_net, status')
        .eq('profile_id', profileId)
        .eq('external_id', externalId)
        .single();
    if (!tx) {
        console.warn(`[Hotmart] Reembolso tx=${externalId} não encontrado no banco — ignorando`);
        return;
    }
    // Idempotência: evita reverter LTV mais de uma vez
    if (tx.status === 'refunded') {
        console.log(`[Hotmart] Reembolso tx=${externalId} já processado — ignorando`);
        return;
    }
    // Atualiza status da transação
    await supabase
        .from('transactions')
        .update({ status: 'refunded' })
        .eq('id', tx.id);
    // Reverte LTV do cliente usando amount_net (mesmo valor que foi somado na venda)
    const { data: customer } = await supabase
        .from('customers')
        .select('total_ltv')
        .eq('id', tx.customer_id)
        .single();
    if (customer) {
        const newLtv = Math.max(0, (Number(customer.total_ltv) || 0) - Number(tx.amount_net));
        await supabase
            .from('customers')
            .update({ total_ltv: newLtv })
            .eq('id', tx.customer_id);
        console.log(`[Hotmart] Reembolso aplicado: tx=${externalId}, revertido amount_net=${tx.amount_net}, novo LTV=${newLtv}`);
    }
    // Cancela a comissão pendente associada (não pagar comissão de venda reembolsada)
    await supabase
        .from('commissions')
        .update({ status: 'cancelled' })
        .eq('transaction_id', tx.id)
        .eq('status', 'pending');
}
/**
 * Marca uma transação como cancelada (sem reverter LTV pois nunca foi aprovada).
 */
async function syncCancellation(profileId, externalId) {
    const { error } = await supabase
        .from('transactions')
        .update({ status: 'cancelled' })
        .eq('profile_id', profileId)
        .eq('external_id', externalId);
    if (error) {
        console.warn(`[Hotmart] Falha ao cancelar tx=${externalId}:`, error.message);
    }
}
function mapUtmToChannel(utmSource) {
    if (!utmSource)
        return 'desconhecido';
    const s = utmSource.toLowerCase();
    if (s === 'facebook' || s === 'instagram' || s === 'meta' || s === 'meta_ads')
        return 'meta_ads';
    if (s === 'google' || s === 'google_ads' || s === 'cpc')
        return 'google_ads';
    if (s === 'email' || s === 'newsletter')
        return 'email';
    if (s === 'afiliado' || s === 'affiliate')
        return 'afiliado';
    if (s === 'organico' || s === 'organic')
        return 'organico';
    if (s === 'direto' || s === 'direct')
        return 'direto';
    return 'desconhecido';
}
/**
 * Maps Hotmart payment types to display-friendly names.
 */
function mapPaymentType(type) {
    if (!type)
        return null;
    const t = type.toUpperCase();
    if (t.includes('PIX'))
        return 'Pix';
    if (t.includes('BILLET') || t.includes('BOLETO'))
        return 'Boleto';
    if (t.includes('CREDIT') || t.includes('DEBIT') || t.includes('CARD'))
        return 'Cartão';
    return type;
}
/**
 * Helper to upsert customer and insert transaction with Attribution Logic.
 * Resolve canal (utm_source), campanha e criador a partir do visitor_id.
 * Gera comissão automaticamente quando uma venda de criador é detectada.
 *
 * First-touch attribution: acquisition_channel is only set on the customer's
 * first purchase. Subsequent purchases preserve the original channel.
 */
export async function syncTransaction(profileId, email, platform, externalId, amount, visitorId, feePlatform = 0, extra) {
    // 1. Attribution Lookup (Last Click Logic)
    let channel = 'desconhecido';
    let campaignId = null;
    let creatorId = null;
    console.log(`[Attribution] Looking for visit with visitor_id: ${visitorId} for profile: ${profileId}`);
    const { data: latestVisit, error: vError } = await supabase
        .from('visits')
        .select('utm_source, utm_campaign, affiliate_id, visitor_id, profile_id')
        .eq('profile_id', profileId)
        .eq('visitor_id', visitorId || '00000000-0000-0000-0000-000000000000')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
    if (vError && vError.code !== 'PGRST116') {
        console.error('[Attribution] Query error:', vError);
    }
    console.log('[Attribution] Raw Latest Visit:', latestVisit);
    if (latestVisit) {
        channel = mapUtmToChannel(latestVisit.utm_source);
        console.log(`[Attribution] Match found! Channel: ${channel}`);
        // Resolver campanha e criador pelo utm_campaign
        if (latestVisit.utm_campaign) {
            const { data: campaign } = await supabase
                .from('campaigns')
                .select('id, commission_rate')
                .eq('profile_id', profileId)
                .ilike('name', latestVisit.utm_campaign)
                .eq('status', 'active')
                .single();
            if (campaign) {
                campaignId = campaign.id;
                // Resolver criador pelo affiliate_id (se existir) ou pegar o único da campanha
                if (latestVisit.affiliate_id) {
                    const { data: cc } = await supabase
                        .from('campaign_creators')
                        .select('creator_id')
                        .eq('campaign_id', campaign.id)
                        .eq('creator_id', latestVisit.affiliate_id)
                        .single();
                    if (cc)
                        creatorId = cc.creator_id;
                }
                else {
                    const { data: cc } = await supabase
                        .from('campaign_creators')
                        .select('creator_id')
                        .eq('campaign_id', campaign.id)
                        .eq('status', 'active')
                        .limit(1)
                        .single();
                    if (cc)
                        creatorId = cc.creator_id;
                }
                console.log(`[Attribution] Campaign: ${campaignId} | Creator: ${creatorId}`);
            }
        }
    }
    else {
        console.log('[Attribution] No matching visit found.');
    }
    // 2. Upsert Customer (first-touch attribution — preserve original channel)
    const { data: existingCustomer } = await supabase
        .from('customers')
        .select('id, total_ltv')
        .eq('profile_id', profileId)
        .eq('email', email)
        .single();
    const isNewCustomer = !existingCustomer;
    const upsertPayload = { profile_id: profileId, email };
    if (isNewCustomer) {
        upsertPayload.acquisition_channel = channel;
        if (extra?.customerName)
            upsertPayload.name = extra.customerName;
        if (extra?.phone)
            upsertPayload.phone = extra.phone;
    }
    const { data: customer, error: custError } = await supabase
        .from('customers')
        .upsert(upsertPayload, { onConflict: 'profile_id, email' })
        .select('id, total_ltv')
        .single();
    if (custError) {
        console.error('[Normalization] Customer upsert error:', custError);
        throw custError;
    }
    console.log(`[Normalization] Customer synced: ${customer.id} (Channel: ${channel}, New: ${isNewCustomer})`);
    // 3. Insert Transaction (com campaign_id e creator_id se resolvidos)
    console.log(`[Normalization] Inserting transaction for customer ${customer.id}`);
    const amountNet = parseFloat((amount - feePlatform).toFixed(2));
    const { data: transaction, error: transError } = await supabase
        .from('transactions')
        .insert({
        profile_id: profileId,
        customer_id: customer.id,
        platform,
        external_id: externalId,
        amount_gross: amount,
        amount_net: amountNet,
        fee_platform: feePlatform,
        status: 'approved',
        northie_attribution_id: visitorId,
        campaign_id: campaignId,
        creator_id: creatorId,
        product_name: extra?.productName || null,
        payment_method: extra?.paymentMethod || null,
        ...(extra?.createdAt ? { created_at: extra.createdAt } : {}),
    })
        .select('id')
        .single();
    if (transError) {
        // 23505 = unique_violation — transação já existe, idempotente — sem re-throw
        if (transError.code === '23505') {
            console.log(`[Normalization] Transaction ${externalId} já existe — ignorando duplicata`);
            return;
        }
        console.error('[Normalization] Transaction insert error:', transError);
        throw transError;
    }
    // 4. Gerar comissão se venda atribuída a criador
    if (campaignId && creatorId && transaction) {
        const { data: campaign } = await supabase
            .from('campaigns')
            .select('commission_rate')
            .eq('id', campaignId)
            .single();
        const rate = Number(campaign?.commission_rate || 0);
        if (rate > 0) {
            // Comissão calculada sobre amount_net — o que o produtor efetivamente recebe após taxas
            const commissionAmount = Number((amountNet * rate / 100).toFixed(2));
            const { error: commErr } = await supabase.from('commissions').insert({
                profile_id: profileId,
                campaign_id: campaignId,
                creator_id: creatorId,
                transaction_id: transaction.id,
                amount: commissionAmount,
                status: 'pending',
            });
            if (commErr) {
                console.error('[Normalization] Commission insert error:', commErr);
            }
            else {
                console.log(`[Normalization] Commission generated: R$${commissionAmount} for creator ${creatorId}`);
            }
        }
    }
    // 5. Update LTV (baseado em amount_net — o que o produtor efetivamente recebe)
    const newLtv = (Number(customer.total_ltv) || 0) + amountNet;
    await supabase
        .from('customers')
        .update({ total_ltv: newLtv, last_purchase_at: new Date().toISOString() })
        .eq('id', customer.id);
    console.log(`[Normalization] LTV updated to ${newLtv} for customer ${customer.id}`);
}
//# sourceMappingURL=normalization.service.js.map