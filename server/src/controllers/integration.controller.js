import { IntegrationService } from '../services/integration.service.js';
import { supabase } from '../lib/supabase.js';
import axios from 'axios';
import { backfillMetaAds, runAdsSyncForAllProfiles } from '../jobs/ads-sync.job.js';
import { backfillHotmart } from '../jobs/hotmart-sync.job.js';
/**
 * Redirects the user to the platform's OAuth consent screen
 */
export async function connectPlatform(req, res) {
    const { platform } = req.params;
    const profileId = req.query.profileId;
    if (!platform || !profileId) {
        return res.status(400).json({ error: 'Missing platform or profileId' });
    }
    try {
        const authUrl = IntegrationService.getAuthorizationUrl(platform, profileId);
        res.redirect(authUrl);
    }
    catch (error) {
        res.status(400).json({ error: error.message });
    }
}
/**
 * Handles the OAuth callback from the external platform
 */
export async function handleCallback(req, res) {
    const { platform } = req.params;
    const { code, state } = req.query;
    if (!code || !state) {
        return res.status(400).json({ error: 'OAuth failed: Missing code or state' });
    }
    let profileId;
    try {
        profileId = IntegrationService.validateOAuthState(state);
    }
    catch (stateErr) {
        console.warn(`[IntegrationController] Invalid OAuth state for ${platform}: ${stateErr.message}`);
        return res.status(400).json({ error: `OAuth state invalid: ${stateErr.message}` });
    }
    try {
        console.log(`[IntegrationController] Processing callback for ${platform} - Profile: ${profileId}`);
        // Safety Check: Verify profile exists or create it on the fly
        const { data: profileExists, error: pError } = await supabase.from('profiles').select('id').eq('id', profileId).single();
        if (pError || !profileExists) {
            console.log(`[IntegrationController] Profile ${profileId} not found, attempting to auto-create...`);
            // Get user info from Supabase Auth (requires service role key on backend)
            const { data: { user }, error: authError } = await supabase.auth.admin.getUserById(profileId);
            if (authError || !user) {
                console.error('[IntegrationController] Failed to fetch user from Auth:', authError);
                return res.status(404).send(`
                    <div style="font-family: sans-serif; padding: 40px; text-align: center;">
                        <h2 style="color: #d63031;">⚠️ Link de Conexão Inválido</h2>
                        <p>Não conseguimos identificar o seu usuário no sistema de autenticação.</p>
                        <p>Por favor, tente fazer o login novamente no painel principal.</p>
                    </div>
                `);
            }
            // Create the missing profile row
            const { error: insertError } = await supabase.from('profiles').insert({
                id: profileId,
                email: user.email,
                full_name: user.user_metadata?.full_name || user.email?.split('@')[0]
            });
            if (insertError) {
                console.error('[IntegrationController] Failed to auto-create profile:', insertError);
                return res.status(500).send(`
                    <div style="font-family: sans-serif; padding: 40px; text-align: center;">
                        <h2 style="color: #d63031;">⚠️ Erro ao preparar perfil</h2>
                        <p>Houve um problema técnico ao criar o seu perfil de integração.</p>
                        <p>Erro: ${insertError.message}</p>
                    </div>
                `);
            }
            console.log(`[IntegrationController] Profile auto-created successfully for ${user.email}`);
        }
        let tokens = {};
        if (platform === 'meta') {
            const redirectUri = `${process.env.BACKEND_URL || 'http://localhost:3001'}/api/integrations/callback/meta`;
            const tokenRes = await axios.get(`https://graph.facebook.com/v18.0/oauth/access_token`, {
                params: {
                    client_id: process.env.META_APP_ID,
                    client_secret: process.env.META_APP_SECRET,
                    redirect_uri: redirectUri,
                    code: code
                }
            });
            tokens = tokenRes.data;
            // Exchange for a long-lived token (usually 60 days)
            const longLivedRes = await axios.get(`https://graph.facebook.com/v18.0/oauth/access_token`, {
                params: {
                    grant_type: 'fb_exchange_token',
                    client_id: process.env.META_APP_ID,
                    client_secret: process.env.META_APP_SECRET,
                    fb_exchange_token: tokens.access_token
                }
            });
            tokens = longLivedRes.data;
        }
        else if (platform === 'google') {
            const redirectUri = `${process.env.BACKEND_URL || 'http://localhost:3001'}/api/integrations/callback/google`;
            const tokenRes = await axios.post(`https://oauth2.googleapis.com/token`, {
                client_id: process.env.GOOGLE_CLIENT_ID,
                client_secret: process.env.GOOGLE_CLIENT_SECRET,
                redirect_uri: redirectUri,
                grant_type: 'authorization_code',
                code: code
            });
            tokens = tokenRes.data;
        }
        else if (platform === 'hotmart') {
            const redirectUri = `${process.env.BACKEND_URL || 'http://localhost:3001'}/api/integrations/callback/hotmart`;
            const credentials = Buffer.from(`${process.env.HOTMART_CLIENT_ID}:${process.env.HOTMART_CLIENT_SECRET}`).toString('base64');
            const tokenRes = await axios.post('https://api-sec-vlc.hotmart.com/security/oauth/token', new URLSearchParams({
                grant_type: 'authorization_code',
                code: code,
                redirect_uri: redirectUri,
            }), { headers: { Authorization: `Basic ${credentials}`, 'Content-Type': 'application/x-www-form-urlencoded' } });
            tokens = tokenRes.data;
        }
        if (tokens.access_token) {
            await IntegrationService.saveIntegration(profileId, platform, tokens);
        }
        const frontendOrigin = process.env.FRONTEND_URL || 'http://localhost:5173';
        res.send(`
            <html>
                <head><title>Conectando Northie...</title></head>
                <body style="background: #FFF; display: flex; align-items: center; justify-content: center; height: 100vh;">
                    <div style="font-family: sans-serif; text-align: center;">
                        <p>Vinculado com sucesso!</p>
                        <p style="font-size: 12px; color: #666;">Esta janela fechará sozinha.</p>
                    </div>
                    <script>
                        (function() {
                            const platform = '${platform}';
                            const targetOrigin = '${frontendOrigin}';
                            function closeWindow() {
                                window.close();
                                // Fallback: se window.close() for bloqueado pelo browser
                                setTimeout(() => window.close(), 300);
                            }
                            if (window.opener) {
                                try {
                                    window.opener.postMessage({
                                        type: 'NORTHIE_OAUTH_SUCCESS',
                                        platform: platform
                                    }, targetOrigin);
                                    // Aguarda o postMessage ser processado antes de fechar
                                    setTimeout(closeWindow, 500);
                                } catch (e) {
                                    console.error('Failed to postMessage:', e);
                                    setTimeout(closeWindow, 500);
                                }
                            } else {
                                setTimeout(closeWindow, 500);
                            }
                        })();
                    </script>
                </body>
            </html>
        `);
    }
    catch (error) {
        console.error('[IntegrationController] Error during exchange:', error.response?.data || error.message);
        res.status(500).send(`
            <div style="font-family: sans-serif; padding: 20px; border: 1px solid #fab1a0; background: #fff5f5; color: #d63031; border-radius: 8px;">
                <h3>Erro na Integração</h3>
                <p>${error.message}</p>
                <small style="color: #636E72;">Por favor, tente fechar esta janela e clicar no link de conexão novamente.</small>
            </div>
        `);
    }
}
/**
 * Deactivates an existing integration
 */
export async function disconnectPlatform(req, res) {
    const { platform } = req.params;
    const profileId = req.headers['x-profile-id'];
    if (!platform || !profileId) {
        return res.status(400).json({ error: 'Missing platform or x-profile-id header' });
    }
    try {
        const { error } = await supabase
            .from('integrations')
            .update({ status: 'inactive' })
            .eq('profile_id', profileId)
            .eq('platform', platform === 'meta-ads' ? 'meta' : platform.replace('-ads', ''));
        if (error)
            throw error;
        res.status(200).json({ message: `Successfully disconnected ${platform}` });
    }
    catch (error) {
        console.error('[IntegrationController] Disconnect Error:', error);
        res.status(500).json({ error: 'Failed to disconnect integration' });
    }
}
/**
 * Returns the list of active integrations for the current profile.
 * Used by the frontend to check connection status on load.
 */
export async function getIntegrationStatus(req, res) {
    const profileId = req.headers['x-profile-id'];
    if (!profileId)
        return res.status(400).json({ error: 'Missing x-profile-id header' });
    try {
        const { data, error } = await supabase
            .from('integrations')
            .select('platform, status, last_sync_at')
            .eq('profile_id', profileId);
        if (error)
            throw error;
        res.status(200).json(data ?? []);
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to fetch integration status' });
    }
}
/**
 * Cron endpoint — called by Vercel Cron every 6h.
 * GET /api/integrations/cron/sync
 * Protected by CRON_SECRET env var.
 */
export async function cronSync(req, res) {
    const secret = req.headers['authorization'];
    if (secret !== `Bearer ${process.env.CRON_SECRET}`) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    try {
        await runAdsSyncForAllProfiles();
        return res.status(200).json({ message: 'Cron sync completed.' });
    }
    catch (error) {
        console.error('[cronSync] error:', error.message);
        return res.status(500).json({ error: error.message });
    }
}
/**
 * Triggers an immediate ad metrics sync for a specific platform.
 * POST /api/integrations/sync/:platform
 * Accepts optional body: { days: number } to backfill N days (default: 2).
 */
export async function triggerSync(req, res) {
    const { platform } = req.params;
    const profileId = req.headers['x-profile-id'];
    if (!profileId)
        return res.status(400).json({ error: 'Missing x-profile-id header' });
    const days = req.body?.days !== undefined ? Number(req.body.days) : 2;
    try {
        if (platform === 'meta') {
            // Run synchronously — Vercel kills background tasks after response
            await backfillMetaAds(profileId, days);
            return res.status(200).json({ message: `Meta Ads sync completed for last ${days} days.` });
        }
        if (platform === 'hotmart') {
            const result = await backfillHotmart(profileId, days);
            return res.status(200).json({
                message: `Hotmart sync completed for last ${days} days.`,
                ...result,
            });
        }
        if (platform === 'all') {
            await runAdsSyncForAllProfiles();
            return res.status(200).json({ message: 'Full sync completed for all active integrations.' });
        }
        return res.status(400).json({ error: `Sync not supported for platform: ${platform}` });
    }
    catch (error) {
        console.error('[IntegrationController] triggerSync error:', error.message);
        res.status(500).json({ error: 'Failed to trigger sync', detail: error.message });
    }
}
//# sourceMappingURL=integration.controller.js.map