import { supabase } from '../lib/supabase.js';

/**
 * Normalizes raw platform data into the Northie Schema (Transactions, Customers, etc.)
 */
export async function normalizeData(rawId: string, platform: string, payload: any, profileId: string) {
    console.log(`Starting normalization for ${platform} - RawID: ${rawId}`);

    try {
        if (platform === 'stripe') {
            await handleStripeNormalization(payload, profileId);
        } else if (platform === 'hotmart') {
            await handleHotmartNormalization(payload, profileId);
        } else if (platform === 'kiwify') {
            await handleKiwifyNormalization(payload, profileId);
        } else if (platform === 'shopify') {
            await handleShopifyNormalization(payload, profileId);
        } else {
            console.warn(`No normalization handler for platform: ${platform}`);
            return;
        }

        // Mark as processed
        await supabase
            .from('platforms_data_raw')
            .update({ processed: true })
            .eq('id', rawId);

    } catch (error) {
        console.error(`Error normalizing ${platform} data:`, error);
        throw error;
    }
}

/**
 * Specific handler for Stripe Webhooks
 */
async function handleStripeNormalization(payload: any, profileId: string) {
    if (payload.type === 'checkout.session.completed') {
        const session = payload.data.object;
        const email = session.customer_details?.email;
        const amount_total = session.amount_total / 100;

        // Stripe stores custom metadata where we inject the visitorId
        const visitorId = session.metadata?.visitorId;

        if (!email) throw new Error('Customer email missing in Stripe session');
        await syncTransaction(profileId, email, 'stripe', session.id, amount_total, visitorId);
    }
}

async function handleHotmartNormalization(payload: any, profileId: string) {
    if (payload.event === 'PURCHASE_APPROVED') {
        const { data } = payload;
        const email = data.buyer.email;
        const amount = data.purchase.full_price.value;
        const transactionId = data.purchase.transaction;

        // Hotmart can send attribution in multiple fields depending on setup
        const visitorId = data.purchase.src || data.purchase.hsrc || data.hsrc || data.src;

        console.log(`[Hotmart] Normalizing sale for ${email}. VisitorId found: ${visitorId}`);

        await syncTransaction(profileId, email, 'hotmart', transactionId, amount, visitorId);
    }
}

async function handleKiwifyNormalization(payload: any, profileId: string) {
    if (payload.order_status === 'paid' || payload.order_status === 'approved') {
        const email = payload.Customer.email;
        const amount = payload.order_ref_amount / 100;
        const transactionId = payload.order_id;
        // Kiwify doesn't provide a direct visitor ID in standard webhooks,
        // so we pass undefined for now. Future integration might involve custom fields.
        const visitorId = undefined;

        await syncTransaction(profileId, email, 'kiwify', transactionId, amount, visitorId);
    }
}

/**
 * Handler para webhooks Shopify (evento orders/paid).
 * O visitorId é injetado via note_attributes pelo pixel Northie no checkout.
 */
async function handleShopifyNormalization(payload: any, profileId: string) {
    if (payload.financial_status !== 'paid') return;

    const email: string = payload.email;
    const amount: number = parseFloat(payload.total_price);
    const transactionId: string = String(payload.id);

    // Pixel injeta visitorId como note_attribute { name: 'northie_vid', value: '...' }
    const noteAttrs: Array<{ name: string; value: string }> = payload.note_attributes || [];
    const visitorId = noteAttrs.find((a: any) => a.name === 'northie_vid')?.value;

    console.log(`[Shopify] Normalizing order ${transactionId} for ${email}. VisitorId: ${visitorId}`);

    await syncTransaction(profileId, email, 'shopify', transactionId, amount, visitorId);
}

/**
 * Helper to upsert customer and insert transaction with Attribution Logic.
 * Resolve canal (utm_source), campanha e criador a partir do visitor_id.
 * Gera comissão automaticamente quando uma venda de criador é detectada.
 */
async function syncTransaction(
    profileId: string,
    email: string,
    platform: string,
    externalId: string,
    amount: number,
    visitorId?: string
) {
    // 1. Attribution Lookup (Last Click Logic)
    let channel: string = 'desconhecido';
    let campaignId: string | null = null;
    let creatorId: string | null = null;

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
        channel = latestVisit.utm_source || 'organico';
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
                    if (cc) creatorId = cc.creator_id;
                } else {
                    const { data: cc } = await supabase
                        .from('campaign_creators')
                        .select('creator_id')
                        .eq('campaign_id', campaign.id)
                        .eq('status', 'active')
                        .limit(1)
                        .single();
                    if (cc) creatorId = cc.creator_id;
                }

                console.log(`[Attribution] Campaign: ${campaignId} | Creator: ${creatorId}`);
            }
        }
    } else {
        console.log('[Attribution] No matching visit found.');
    }

    // 2. Upsert Customer
    const { data: customer, error: custError } = await supabase
        .from('customers')
        .upsert(
            { profile_id: profileId, email, acquisition_channel: channel },
            { onConflict: 'profile_id, email' }
        )
        .select()
        .single();

    if (custError) {
        console.error('[Normalization] Customer upsert error:', custError);
        throw custError;
    }

    console.log(`[Normalization] Customer synced: ${customer.id} (Channel: ${channel})`);

    // 3. Insert Transaction (com campaign_id e creator_id se resolvidos)
    console.log(`[Normalization] Inserting transaction for customer ${customer.id}`);
    const { data: transaction, error: transError } = await supabase
        .from('transactions')
        .insert({
            profile_id: profileId,
            customer_id: customer.id,
            platform,
            external_id: externalId,
            amount_gross: amount,
            amount_net: amount,
            status: 'approved',
            northie_attribution_id: visitorId,
            campaign_id: campaignId,
            creator_id: creatorId,
        })
        .select('id')
        .single();

    if (transError) {
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
            const commissionAmount = Number((amount * rate / 100).toFixed(2));
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
            } else {
                console.log(`[Normalization] Commission generated: R$${commissionAmount} for creator ${creatorId}`);
            }
        }
    }

    // 5. Update LTV
    const newLtv = (Number(customer.total_ltv) || 0) + amount;
    await supabase
        .from('customers')
        .update({ total_ltv: newLtv, last_purchase_at: new Date().toISOString() })
        .eq('id', customer.id);

    console.log(`[Normalization] LTV updated to ${newLtv} for customer ${customer.id}`);
}
