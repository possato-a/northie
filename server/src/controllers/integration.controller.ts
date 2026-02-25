import type { Request, Response } from 'express';
import { IntegrationService } from '../services/integration.service.js';
import { supabase } from '../lib/supabase.js';
import axios from 'axios';

/**
 * Redirects the user to the platform's OAuth consent screen
 */
export async function connectPlatform(req: Request, res: Response) {
    const { platform } = req.params;
    const profileId = req.query.profileId as string;

    if (!platform || !profileId) {
        return res.status(400).json({ error: 'Missing platform or profileId' });
    }

    try {
        const authUrl = IntegrationService.getAuthorizationUrl(platform as string, profileId as string);
        res.redirect(authUrl);
    } catch (error: any) {
        res.status(400).json({ error: error.message });
    }
}

/**
 * Handles the OAuth callback from the external platform
 */
export async function handleCallback(req: Request, res: Response) {
    console.log('[IntegrationController] Full Query Params:', JSON.stringify(req.query, null, 2));
    const { platform } = req.params;
    const { code, state: profileId } = req.query;

    if (!code || !profileId) {
        return res.status(400).json({ error: 'OAuth failed: Missing code or state (profileId)' });
    }

    try {
        console.log(`[IntegrationController] Processing callback for ${platform} - Profile: ${profileId}`);

        // Safety Check: Verify profile exists or create it on the fly
        const { data: profileExists, error: pError } = await supabase.from('profiles').select('id').eq('id', profileId).single();

        if (pError || !profileExists) {
            console.log(`[IntegrationController] Profile ${profileId} not found, attempting to auto-create...`);

            // Get user info from Supabase Auth (requires service role key on backend)
            const { data: { user }, error: authError } = await supabase.auth.admin.getUserById(profileId as string);

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

        let tokens: any = {};

        if (platform === 'meta') {
            const redirectUri = `${process.env.BACKEND_URL || 'http://localhost:3001'}/api/integrations/callback/meta`;
            const tokenRes = await axios.get(`https://graph.facebook.com/v18.0/oauth/access_token`, {
                params: {
                    client_id: process.env.META_APP_ID,
                    client_secret: process.env.META_APP_SECRET,
                    redirect_uri: redirectUri,
                    code: code as string
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

        if (tokens.access_token) {
            await IntegrationService.saveIntegration(profileId as string, platform as string, tokens);
        }

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
                            if (window.opener) {
                                try {
                                    window.opener.postMessage({ 
                                        type: 'NORTHIE_OAUTH_SUCCESS', 
                                        platform: platform 
                                    }, '*');
                                } catch (e) {
                                    console.error('Failed to postMessage:', e);
                                }
                            }
                            
                            // Multiple closure attempts for maximum reliability
                            setTimeout(() => window.close(), 10);
                            setTimeout(() => window.close(), 100);
                            setTimeout(() => window.close(), 500);
                            window.close();
                        })();
                    </script>
                </body>
            </html>
        `);
    } catch (error: any) {
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
