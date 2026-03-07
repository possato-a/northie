import type { Request, Response } from 'express';
import { supabase } from '../lib/supabase.js';

/**
 * List all campaigns for a profile
 */
export async function listCampaigns(req: Request, res: Response) {
    const profileId = req.headers['x-profile-id'] as string;

    try {
        // Buscar tudo em paralelo (4 queries fixas, independente do número de campanhas)
        const [{ data, error }, { data: allCreators }, { data: allCommissions }, { data: allSales }] = await Promise.all([
            supabase.from('campaigns').select('id, name, type, commission_rate, description, product_name, start_date, end_date, status, created_at, updated_at').eq('profile_id', profileId).order('created_at', { ascending: false }),
            supabase.from('campaign_creators').select('campaign_id').eq('campaign_id', profileId ? undefined as any : ''),  // placeholder
            supabase.from('commissions').select('campaign_id, amount').eq('profile_id', profileId),
            supabase.from('transactions').select('campaign_id').eq('profile_id', profileId).eq('status', 'approved').not('campaign_id', 'is', null),
        ]);

        if (error) throw error;

        // Fetch creators count por campaign (1 query para todas)
        const campaignIds = (data || []).map((c: any) => c.id);
        const { data: creatorLinks } = campaignIds.length > 0
            ? await supabase.from('campaign_creators').select('campaign_id').in('campaign_id', campaignIds)
            : { data: [] };

        // Pre-index por campaign_id em O(N)
        const creatorsCountMap = new Map<string, number>();
        for (const cl of (creatorLinks ?? [])) {
            creatorsCountMap.set(cl.campaign_id, (creatorsCountMap.get(cl.campaign_id) ?? 0) + 1);
        }

        const commissionMap = new Map<string, number>();
        for (const c of (allCommissions ?? [])) {
            commissionMap.set(c.campaign_id, (commissionMap.get(c.campaign_id) ?? 0) + Number(c.amount));
        }

        const salesCountMap = new Map<string, number>();
        for (const s of (allSales ?? [])) {
            salesCountMap.set(s.campaign_id, (salesCountMap.get(s.campaign_id) ?? 0) + 1);
        }

        const campaignsWithCreators = (data || []).map((camp: any) => ({
            ...camp,
            creators_count: creatorsCountMap.get(camp.id) ?? 0,
            commission_total: commissionMap.get(camp.id) ?? 0,
            sales_count: salesCountMap.get(camp.id) ?? 0,
        }));

        res.status(200).json(campaignsWithCreators);
    } catch (error: any) {
        console.error('[CampaignController] List Error:', error);
        res.status(500).json({ error: 'Failed to list campaigns' });
    }
}

/**
 * Create a new campaign
 */
export async function createCampaign(req: Request, res: Response) {
    const profileId = req.headers['x-profile-id'] as string;
    const { name, type, commission_rate, description, product_name, start_date, end_date } = req.body;

    if (!name) return res.status(400).json({ error: 'Name is required' });

    try {
        const { data, error } = await supabase
            .from('campaigns')
            .insert([{
                profile_id: profileId,
                name,
                type: type || 'internal',
                commission_rate: commission_rate || 0,
                description,
                product_name,
                start_date,
                end_date,
                status: 'active'
            }])
            .select()
            .single();

        if (error) throw error;
        res.status(201).json(data);
    } catch (error: any) {
        console.error('[CampaignController] Create Error:', error);
        res.status(500).json({ error: 'Failed to create campaign' });
    }
}

/**
 * List creators for a specific campaign
 */
export async function listCampaignCreators(req: Request, res: Response) {
    const { id: campaignId } = req.params;
    const profileId = req.headers['x-profile-id'] as string;

    const { data: ownerCheck } = await supabase
        .from('campaigns')
        .select('id')
        .eq('id', campaignId)
        .eq('profile_id', profileId)
        .single();
    if (!ownerCheck) return res.status(403).json({ error: 'Campanha não encontrada' });

    try {
        // 3 queries fixas em paralelo (antes: 2N queries dentro de loop)
        const [{ data, error }, { data: campaignSales }, { data: allCommissions }] = await Promise.all([
            supabase
                .from('campaign_creators')
                .select(`
                    status,
                    creator:creators(*)
                `)
                .eq('campaign_id', campaignId),
            supabase
                .from('transactions')
                .select('amount_net')
                .eq('campaign_id', campaignId)
                .eq('status', 'approved'),
            supabase
                .from('commissions')
                .select('amount, status, creator_id')
                .eq('campaign_id', campaignId),
        ]);

        if (error) throw error;

        const totalRevenue = (campaignSales ?? []).reduce((sum, s) => sum + Number(s.amount_net), 0);
        const totalSalesCount = campaignSales?.length ?? 0;

        // Pre-index commissions por creator_id
        const commByCreator = new Map<string, { paid: number; pending: number }>();
        for (const c of (allCommissions ?? [])) {
            if (!commByCreator.has(c.creator_id)) commByCreator.set(c.creator_id, { paid: 0, pending: 0 });
            const entry = commByCreator.get(c.creator_id)!;
            if (c.status === 'paid') entry.paid += Number(c.amount);
            else if (c.status === 'pending') entry.pending += Number(c.amount);
        }

        const creatorsWithStats = (data ?? []).map((item: any) => {
            const creator = item.creator;
            const comm = commByCreator.get(creator.id) ?? { paid: 0, pending: 0 };
            return {
                ...creator,
                revenue: totalRevenue,
                sales_count: totalSalesCount,
                paid_commission: comm.paid,
                pending_commission: comm.pending,
            };
        });

        res.status(200).json(creatorsWithStats);
    } catch (error: any) {
        console.error('[CampaignController] List Creators Error:', error);
        res.status(500).json({ error: 'Failed to list creators' });
    }
}

/**
 * Add a creator to a campaign
 */
export async function addCreatorToCampaign(req: Request, res: Response) {
    const profileId = req.headers['x-profile-id'] as string;
    const { campaignId, name, email, instagram } = req.body;

    const { data: campaignOwnerCheck } = await supabase
        .from('campaigns')
        .select('id')
        .eq('id', campaignId)
        .eq('profile_id', profileId)
        .single();
    if (!campaignOwnerCheck) return res.status(403).json({ error: 'Acesso negado' });

    try {
        // 1. Create creator if doesn't exist (by email) or just create new
        const { data: creator, error: cError } = await supabase
            .from('creators')
            .insert([{ profile_id: profileId, name, email, instagram }])
            .select()
            .single();

        if (cError) throw cError;

        // 2. Link creator to campaign
        const { error: lError } = await supabase
            .from('campaign_creators')
            .insert([{ campaign_id: campaignId, creator_id: creator.id }]);

        if (lError) throw lError;

        res.status(201).json(creator);
    } catch (error: any) {
        console.error('[CampaignController] Add Creator Error:', error);
        res.status(500).json({ error: 'Failed to add creator' });
    }
}

/**
 * Confirm payout for a creator in a campaign
 */
export async function confirmPayout(req: Request, res: Response) {
    const { campaignId, creatorId } = req.body;
    const profileId = req.headers['x-profile-id'] as string;

    const [{ data: ownerCheck }, { data: campaignCheck }] = await Promise.all([
        supabase
            .from('campaign_creators')
            .select('id')
            .eq('id', creatorId)
            .eq('campaign_id', campaignId)
            .single(),
        supabase
            .from('campaigns')
            .select('id')
            .eq('id', campaignId)
            .eq('profile_id', profileId)
            .single(),
    ]);
    if (!ownerCheck || !campaignCheck) return res.status(403).json({ error: 'Acesso negado' });

    try {
        const { error } = await supabase
            .from('commissions')
            .update({ status: 'paid', paid_at: new Date().toISOString() })
            .eq('campaign_id', campaignId)
            .eq('creator_id', creatorId)
            .eq('status', 'pending');

        if (error) throw error;

        res.status(200).json({ message: 'Payout confirmed' });
    } catch (error: any) {
        console.error('[CampaignController] Confirm Payout Error:', error);
        res.status(500).json({ error: 'Failed to confirm payout' });
    }
}
