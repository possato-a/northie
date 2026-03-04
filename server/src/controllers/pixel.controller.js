import { supabase } from '../lib/supabase.js';
import { generatePixelSnippet } from '../utils/pixel-snippet.js';
/**
 * Retorna o snippet do Northie Pixel gerado com o profileId do founder.
 * O founder copia e cola no <head> do seu site.
 */
export async function getPixelSnippet(req, res) {
    const profileId = req.headers['x-profile-id'];
    if (!profileId)
        return res.status(400).json({ error: 'Missing x-profile-id header' });
    const backendUrl = process.env.BACKEND_URL || 'https://northie.vercel.app';
    const snippet = generatePixelSnippet(profileId, backendUrl);
    return res.status(200).json({ snippet, profileId, backendUrl });
}
/**
 * Handles incoming tracking events from the Northie Pixel (UTMs, Click IDs, etc.)
 */
export async function handlePixelEvent(req, res) {
    const { visitor_id, page_url, referrer, utm_source, utm_medium, utm_campaign, utm_content, utm_term, gclid, fbclid, affiliate_id } = req.body;
    const profileId = req.headers['x-profile-id'];
    if (!profileId || !visitor_id) {
        return res.status(400).json({ error: 'Missing x-profile-id header or visitor_id' });
    }
    try {
        const { error } = await supabase
            .from('visits')
            .insert({
            profile_id: profileId,
            visitor_id,
            url: page_url,
            referrer,
            utm_source,
            utm_medium,
            utm_campaign,
            utm_content,
            utm_term,
            gclid,
            fbclid,
            affiliate_id: affiliate_id || null
        });
        if (error)
            throw error;
        res.status(200).json({ status: 'tracked' });
    }
    catch (error) {
        console.error('Pixel tracking error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}
//# sourceMappingURL=pixel.controller.js.map