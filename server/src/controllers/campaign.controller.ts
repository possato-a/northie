import type { Request, Response } from 'express';
import { supabase } from '../lib/supabase.js';

/**
 * List all campaigns for a profile
 */
export async function listCampaigns(req: Request, res: Response) {
    const profileId = req.headers['x-profile-id'] as string;

    try {
        const { data, error } = await supabase
            .from('campaigns')
            .select('*')
            .eq('profile_id', profileId)
            .order('created_at', { ascending: false });

        if (error) throw error;

        // Fetch aggregated stats for each campaign
        const campaignsWithCreators = await Promise.all(data.map(async (camp: any) => {
            const [{ count: creatorsCount }, { data: commissions }, { count: salesCount }] = await Promise.all([
                supabase.from('campaign_creators').select('*', { count: 'exact', head: true }).eq('campaign_id', camp.id),
                supabase.from('commissions').select('amount').eq('campaign_id', camp.id),
                supabase.from('transactions').select('*', { count: 'exact', head: true }).eq('campaign_id', camp.id).eq('status', 'approved'),
            ]);

            const commissionTotal = commissions?.reduce((sum: number, c: any) => sum + Number(c.amount), 0) || 0;

            return {
                ...camp,
                creators_count: creatorsCount || 0,
                commission_total: commissionTotal,
                sales_count: salesCount || 0,
            };
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
        const { data, error } = await supabase
            .from('campaign_creators')
            .select(`
                status,
                creator:creators(*)
            `)
            .eq('campaign_id', campaignId);

        if (error) throw error;

        // For each creator, calculate their personalized stats
        const creatorsWithStats = await Promise.all(data.map(async (item: any) => {
            const creator = item.creator;

            // Stats: Revenue, Sales, Pending Commission
            const { data: sales } = await supabase
                .from('transactions')
                .select('amount_net')
                .eq('campaign_id', campaignId)
                .eq('status', 'approved'); // In a real scenario, filter by creator_id if we had it in transactions or via attribution

            const { data: commissions } = await supabase
                .from('commissions')
                .select('amount, status')
                .eq('campaign_id', campaignId)
                .eq('creator_id', creator.id);

            const revenue = sales?.reduce((sum, s) => sum + Number(s.amount_net), 0) || 0;
            const paid = commissions?.filter(c => c.status === 'paid').reduce((sum, c) => sum + Number(c.amount), 0) || 0;
            const pending = commissions?.filter(c => c.status === 'pending').reduce((sum, c) => sum + Number(c.amount), 0) || 0;

            return {
                ...creator,
                revenue,
                sales_count: sales?.length || 0,
                paid_commission: paid,
                pending_commission: pending
            };
        }));

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
