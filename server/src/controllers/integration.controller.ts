import type { Request, Response } from 'express';
import { IntegrationService } from '../services/integration.service.js';
import { supabase } from '../lib/supabase.js';
import axios from 'axios';
import { backfillMetaAds, backfillGoogleAds, runAdsSyncForAllProfiles } from '../jobs/ads-sync.job.js';
import { backfillHotmart, runHotmartSyncForAllProfiles } from '../jobs/hotmart-sync.job.js';
import { backfillStripe, runStripeSyncForAllProfiles } from '../jobs/stripe-sync.job.js';
import { backfillShopify, runShopifySyncForAllProfiles } from '../jobs/shopify-sync.job.js';
import { runMetaLeadAttribution } from '../jobs/meta-lead-attribution.job.js';
import { runRfmForAllProfiles } from '../jobs/rfm-calc.job.js';
import { runSafetyNet } from '../jobs/safety-net.job.js';
import { runCapitalScoreForAllProfiles } from '../jobs/capital-score.job.js';
import { runValuationForAllProfiles } from '../jobs/valuation-calc.job.js';
import { runGrowthCorrelationsForAllProfiles } from '../jobs/growth-correlations.job.js';
import { refreshCorrelationViews } from '../jobs/correlation-refresh.job.js';
import { checkAndRefreshAll } from '../jobs/token-refresh.job.js';
import { processScheduledReports } from '../jobs/reports.job.js';

function escapeHtml(str: string): string {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

const SHOPIFY_DOMAIN_REGEX = /^[a-zA-Z0-9][a-zA-Z0-9-]*\.myshopify\.com$/;

function validateShopDomain(shop: string): string | null {
    const cleaned = shop.replace(/^https?:\/\//, '').replace(/\/+$/, '').toLowerCase();
    return SHOPIFY_DOMAIN_REGEX.test(cleaned) ? cleaned : null;
}

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
        const rawShop = req.query.shop as string | undefined;
        if (platform === 'shopify' && !rawShop) {
            return res.status(400).json({ error: 'Parâmetro shop obrigatório para Shopify' });
        }
        const shop = rawShop ? validateShopDomain(rawShop) : undefined;
        if (platform === 'shopify' && !shop) {
            return res.status(400).json({ error: 'Domínio Shopify inválido. Use o formato: sua-loja.myshopify.com' });
        }
        const authUrl = IntegrationService.getAuthorizationUrl(platform as string, profileId as string, shop ? { shop } : undefined);
        console.log(`[IntegrationController] OAuth flow iniciado para platform: ${platform}`);
        res.json({ authUrl });
    } catch (error: any) {
        console.error(`[IntegrationController] Error generating Auth URL for ${platform}:`, error.message);
        res.status(400).json({ error: error.message });
    }
}

/**
 * Handles the OAuth callback from the external platform
 */
export async function handleCallback(req: Request, res: Response) {
    const { platform: rawPlatform } = req.params;
    const { code, state } = req.query;
    const platform = String(rawPlatform || '').toLowerCase().trim();

    if (!code || !state) {
        return res.status(400).json({ error: 'OAuth failed: Missing code or state' });
    }

    let profileId: string;
    try {
        profileId = IntegrationService.validateOAuthState(state as string);
    } catch (stateErr: any) {
        console.warn(`[IntegrationController] Invalid OAuth state for ${platform}: ${stateErr.message}`);
        return res.status(400).send(`
            <div style="font-family: sans-serif; padding: 20px; border: 1px solid #fab1a0; background: #fff5f5; color: #d63031; border-radius: 8px;">
                <h3>Sessão Expirada ou Inválida</h3>
                <p>O link de conexão expirou (limite de 10 min) ou é inválido.</p>
                <p style="font-size: 12px; color: #636E72;">Erro: ${escapeHtml(stateErr.message)}</p>
                <small style="color: #636E72;">Por favor, tente fechar esta janela e clicar no link de conexão novamente.</small>
            </div>
        `);
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
                        <p>Erro: ${escapeHtml(insertError.message)}</p>
                    </div>
                `);
            }

            console.log(`[IntegrationController] Profile auto-created successfully for ${user.email}`);
        }

        let tokens: any = {};

        if (platform === 'meta') {
            const redirectUri = IntegrationService.getRedirectUri('meta');
            const tokenRes = await axios.get('https://graph.facebook.com/v25.0/oauth/access_token', {
                params: {
                    client_id: process.env.META_APP_ID,
                    client_secret: process.env.META_APP_SECRET,
                    redirect_uri: redirectUri,
                    code: code as string
                }
            });

            tokens = tokenRes.data;
            // Exchange for a long-lived token (usually 60 days)
            const longLivedRes = await axios.get('https://graph.facebook.com/v25.0/oauth/access_token', {
                params: {
                    grant_type: 'fb_exchange_token',
                    client_id: process.env.META_APP_ID,
                    client_secret: process.env.META_APP_SECRET,
                    fb_exchange_token: tokens.access_token
                }
            });
            tokens = longLivedRes.data;
        } else if (platform === 'google') {
            const googleClientId = process.env.GOOGLE_CLIENT_ID;
            const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;
            if (!googleClientId || !googleClientSecret) {
                throw new Error('Credenciais Google (GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET) não configuradas no servidor. Adicione as variáveis no Vercel.');
            }
            const redirectUri = IntegrationService.getRedirectUri('google');
            const tokenRes = await axios.post('https://oauth2.googleapis.com/token', {
                client_id: googleClientId,
                client_secret: googleClientSecret,
                redirect_uri: redirectUri,
                grant_type: 'authorization_code',
                code: code as string
            });
            tokens = tokenRes.data;
        } else if (platform === 'hotmart') {
            const redirectUri = IntegrationService.getRedirectUri('hotmart');
            const clientId = (process.env.HOTMART_CLIENT_ID || '').trim();
            const clientSecret = (process.env.HOTMART_CLIENT_SECRET || '').trim();

            if (!clientId || !clientSecret) {
                throw new Error('Credenciais Hotmart (Client ID/Secret) não encontradas no Vercel.');
            }

            const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

            try {
                const tokenRes = await axios.post(
                    'https://api-sec-vlc.hotmart.com/security/oauth/token',
                    new URLSearchParams({
                        grant_type: 'authorization_code',
                        code: code as string,
                        redirect_uri: redirectUri,
                    }),
                    {
                        headers: {
                            Authorization: `Basic ${credentials}`,
                            'Content-Type': 'application/x-www-form-urlencoded',
                            'Accept': 'application/json'
                        }
                    }
                );
                tokens = tokenRes.data;
            } catch (hotError: any) {
                const errorData = hotError.response?.data;
                const errorStatus = hotError.response?.status;
                const errorMsg = errorData?.error_description || errorData?.error || hotError.message;
                throw new Error(`Hotmart API Error (${errorStatus}): ${errorMsg} | RedirectURI: ${redirectUri}`);
            }
        } else if (platform === 'stripe') {
            const stripeSecretKey = (process.env.STRIPE_SECRET_KEY || '').trim();
            const stripeClientId = (process.env.STRIPE_CLIENT_ID || '').trim();
            if (!stripeSecretKey) {
                throw new Error('STRIPE_SECRET_KEY não configurado no servidor.');
            }
            if (!stripeClientId) {
                throw new Error('STRIPE_CLIENT_ID não configurado no servidor.');
            }
            console.log(`[IntegrationController] Stripe token exchange — client_id: ${stripeClientId.slice(0, 8)}... key prefix: ${stripeSecretKey.slice(0, 12)}...`);
            const tokenRes = await axios.post(
                'https://connect.stripe.com/oauth/token',
                new URLSearchParams({
                    grant_type: 'authorization_code',
                    code: code as string,
                    client_secret: stripeSecretKey,
                }),
                {
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
                }
            );
            tokens = {
                access_token: tokenRes.data.access_token,
                stripe_user_id: tokenRes.data.stripe_user_id,
                refresh_token: tokenRes.data.refresh_token,
                scope: tokenRes.data.scope,
                livemode: tokenRes.data.livemode,
            };
        } else if (platform === 'shopify') {
            const rawShop = req.query.shop as string;
            if (!rawShop) throw new Error('Parâmetro shop ausente no callback Shopify');
            const shop = validateShopDomain(rawShop);
            if (!shop) throw new Error('Domínio Shopify inválido no callback');
            const tokenRes = await axios.post(`https://${shop}/admin/oauth/access_token`, {
                client_id: process.env.SHOPIFY_API_KEY,
                client_secret: process.env.SHOPIFY_API_SECRET,
                code: code as string,
            });
            tokens = {
                access_token: tokenRes.data.access_token,
                scope: tokenRes.data.scope,
                shop_domain: shop,
            };
        } else {
            throw new Error(`Plataforma não suportada: ${platform}`);
        }

        if (tokens.access_token) {
            // Stripe Connect: rejeitar contas test mode em produção
            if (platform === 'stripe' && tokens.livemode === false) {
                throw new Error('Apenas contas Stripe em modo live são aceitas. Verifique se o modo de teste está desativado.');
            }
            await IntegrationService.saveIntegration(profileId, platform as string, tokens);
        } else {
            throw new Error(`A plataforma ${platform} não retornou um access_token válido.`);
        }

        // Stripe: salva stripe_account_id como coluna indexada para lookup rápido nos webhooks
        if (platform === 'stripe' && tokens.stripe_user_id) {
            await supabase
                .from('integrations')
                .update({ stripe_account_id: tokens.stripe_user_id })
                .eq('profile_id', profileId)
                .eq('platform', 'stripe');
        }

        // Shopify: salva o shop_domain e registra webhooks automaticamente
        if (platform === 'shopify') {
            const shopValidated = validateShopDomain(req.query.shop as string);
            const shopifyToken = tokens.access_token;
            if (shopValidated && shopifyToken) {
                await supabase
                    .from('integrations')
                    .update({ shopify_shop_domain: shopValidated })
                    .eq('profile_id', profileId)
                    .eq('platform', 'shopify');

                // Registra webhooks automaticamente via GraphQL Admin API (REST é legado desde out/2024)
                const backendUrl = process.env.BACKEND_URL || 'https://northie.vercel.app';
                const webhookAddress = `${backendUrl}/api/webhooks/shopify/${profileId}`;
                const SHOPIFY_WEBHOOK_TOPICS = [
                    'ORDERS_PAID',
                    'REFUNDS_CREATE',
                    'ORDERS_CANCELLED',
                    'CUSTOMERS_CREATE',
                    'CUSTOMERS_UPDATE',
                    'APP_UNINSTALLED',
                ];

                for (const topic of SHOPIFY_WEBHOOK_TOPICS) {
                    try {
                        const mutation = `
                            mutation webhookSubscriptionCreate($topic: WebhookSubscriptionTopic!, $webhookSubscription: WebhookSubscriptionInput!) {
                                webhookSubscriptionCreate(topic: $topic, webhookSubscription: $webhookSubscription) {
                                    webhookSubscription { id }
                                    userErrors { field message }
                                }
                            }
                        `;
                        const gqlRes = await axios.post(
                            `https://${shopValidated}/admin/api/2026-01/graphql.json`,
                            {
                                query: mutation,
                                variables: {
                                    topic,
                                    webhookSubscription: { callbackUrl: webhookAddress, format: 'JSON' },
                                },
                            },
                            { headers: { 'X-Shopify-Access-Token': shopifyToken, 'Content-Type': 'application/json' }, timeout: 10000 }
                        );
                        const userErrors = gqlRes.data?.data?.webhookSubscriptionCreate?.userErrors;
                        if (userErrors?.length) {
                            // Ignora erro de webhook já existente — idempotente
                            const isDuplicate = userErrors.some((e: any) => e.message?.toLowerCase().includes('already'));
                            if (!isDuplicate) {
                                console.warn(`[Shopify] GraphQL webhook error para ${topic}:`, userErrors);
                            }
                        } else {
                            console.log(`[Shopify] Webhook registrado via GraphQL: ${topic}`);
                        }
                    } catch (whErr: any) {
                        console.warn(`[Shopify] Falha ao registrar webhook ${topic}:`, whErr.response?.data ?? whErr.message);
                    }
                }
            }
        }

        // Google Ads: descobre automaticamente as contas acessíveis e salva os IDs
        if (platform === 'google') {
            const devToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN;
            if (devToken) {
                try {
                    const customersRes = await axios.get(
                        'https://googleads.googleapis.com/v23/customers:listAccessibleCustomers',
                        {
                            headers: {
                                Authorization: `Bearer ${tokens.access_token}`,
                                'developer-token': devToken,
                            },
                            timeout: 10000,
                        }
                    );
                    const resourceNames: string[] = customersRes.data?.resourceNames || [];
                    const allIds = resourceNames.map((r: string) => r.replace('customers/', ''));

                    // Separa contas MCC (manager) das contas diretas (leaf)
                    const leafIds: string[] = [];
                    const managerIds: string[] = [];
                    for (const cid of allIds) {
                        try {
                            const checkRes = await axios.post(
                                `https://googleads.googleapis.com/v23/customers/${cid}/googleAds:searchStream`,
                                { query: 'SELECT customer.id, customer.manager FROM customer' },
                                {
                                    headers: {
                                        Authorization: `Bearer ${tokens.access_token}`,
                                        'developer-token': devToken,
                                        'Content-Type': 'application/json',
                                    },
                                    timeout: 8000,
                                }
                            );
                            const results = checkRes.data?.[0]?.results || [];
                            const isManager = results[0]?.customer?.manager === true;
                            if (!isManager) {
                                leafIds.push(cid);
                            } else {
                                managerIds.push(cid);
                                console.log(`[IntegrationController] Google: ${cid} é conta MCC (manager), separada como loginCustomerId`);
                            }
                        } catch {
                            // Se não conseguir verificar, inclui como leaf por precaução
                            leafIds.push(cid);
                        }
                    }

                    const idsToStore = leafIds.length > 0 ? leafIds : allIds;
                    const loginCustomerId = managerIds.length > 0 ? managerIds[0] : null;

                    if (idsToStore.length > 0) {
                        await supabase
                            .from('integrations')
                            .update({
                                google_customer_ids: idsToStore,
                                ...(loginCustomerId && { google_login_customer_id: loginCustomerId }),
                            })
                            .eq('profile_id', profileId)
                            .eq('platform', 'google');
                        console.log(`[IntegrationController] Google: ${idsToStore.length} conta(s) leaf salvas:`, idsToStore);
                        if (loginCustomerId) {
                            console.log(`[IntegrationController] Google: loginCustomerId (MCC) salvo: ${loginCustomerId}`);
                        }
                    } else {
                        console.warn('[IntegrationController] Google: nenhuma conta encontrada.');
                    }
                } catch (discoveryErr: any) {
                    console.warn('[IntegrationController] Google: auto-discovery falhou:', discoveryErr.response?.data || discoveryErr.message);
                }
            }
        }

        // FRONTEND_URL deve ser configurada no Vercel. Fallback inteligente:
        const frontendOrigin = process.env.FRONTEND_URL
            || (process.env.BACKEND_URL ? process.env.BACKEND_URL.replace(/\/+$/, '') : null)
            || 'http://localhost:5173';
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
                                setTimeout(() => window.close(), 300);
                            }
                            if (window.opener) {
                                try {
                                    window.opener.postMessage({
                                        type: 'NORTHIE_OAUTH_SUCCESS',
                                        platform: platform
                                    }, targetOrigin);
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
    } catch (error: any) {
        console.error(`[IntegrationController] Error during exchange for ${platform}:`, error.response?.data || error.message);

        const status = error.response?.status || 500;
        const details = error.response?.data ? JSON.stringify(error.response.data) : error.message;

        res.status(status).send(`
            <div style="font-family: sans-serif; padding: 20px; border: 1px solid #fab1a0; background: #fff5f5; color: #d63031; border-radius: 8px;">
                <h3>Erro Crítico na Integração</h3>
                <p>Ocorreu um erro ao processar a resposta de <b>${platform}</b>.</p>
                <div style="background: #fdf2f2; padding: 10px; border-radius: 4px; font-family: monospace; font-size: 12px; margin: 10px 0; border: 1px solid #f9d6d6;">
                    <b>Mensagem:</b> ${escapeHtml(error.message)}<br>
                    <b>Status:</b> ${status}<br>
                    <b>Detalhes:</b> ${escapeHtml(typeof details === 'string' ? details : JSON.stringify(details))}
                </div>
                <small style="color: #636E72;">Por favor, feche esta janela e tente novamente. Se o erro persistir, informe ao suporte.</small>
            </div>
        `);
    }
}

/**
 * Deactivates an existing integration
 */
export async function disconnectPlatform(req: Request, res: Response) {
    const { platform } = req.params;
    const profileId = req.headers['x-profile-id'] as string;

    if (!platform || !profileId) {
        return res.status(400).json({ error: 'Missing platform or x-profile-id header' });
    }

    const VALID_PLATFORMS = new Set(['meta', 'google', 'hotmart', 'stripe', 'shopify', 'meta-ads', 'google-ads']);
    if (!VALID_PLATFORMS.has(platform as string)) {
        return res.status(400).json({ error: `Invalid platform: ${platform}` });
    }

    try {
        const platformName = (platform as string) === 'meta-ads' ? 'meta' : (platform as string).replace('-ads', '');
        const { error } = await supabase
            .from('integrations')
            .update({ status: 'inactive' })
            .eq('profile_id', profileId)
            .eq('platform', platformName);

        if (error) throw error;

        res.status(200).json({ message: `Successfully disconnected ${platform}` });
    } catch (error: any) {
        console.error('[IntegrationController] Disconnect Error:', error);
        res.status(500).json({ error: 'Failed to disconnect integration' });
    }
}

/**
 * Returns the list of active integrations for the current profile.
 * Used by the frontend to check connection status on load.
 */
export async function getIntegrationStatus(req: Request, res: Response) {
    const profileId = req.headers['x-profile-id'] as string;
    if (!profileId) return res.status(400).json({ error: 'Missing x-profile-id header' });

    try {
        const { data, error } = await supabase
            .from('integrations')
            .select('platform, status, last_sync_at, google_customer_ids')
            .eq('profile_id', profileId);

        if (error) throw error;

        res.status(200).json(data ?? []);
    } catch (error: any) {
        console.error('[IntegrationController] getIntegrationStatus Error:', error);
        res.status(500).json({ error: 'Failed to fetch integration status' });
    }
}

/**
 * Cron endpoint — relatórios automáticos (a cada 4h via Vercel Cron)
 */
export async function cronReports(req: Request, res: Response) {
    const secret = req.headers['authorization'];
    if (secret !== `Bearer ${process.env.CRON_SECRET}`) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    try {
        await processScheduledReports();
        return res.status(200).json({ ok: true, ran_at: new Date().toISOString() });
    } catch (error: any) {
        console.error('[cronReports] error:', error.message);
        return res.status(500).json({ error: error.message });
    }
}

/**
 * Cron endpoint — sync completo diário
 */
export async function cronSync(req: Request, res: Response) {
    const secret = req.headers['authorization'];
    if (secret !== `Bearer ${process.env.CRON_SECRET}`) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    try {
        // ── SEQUENCIAL para não sobrecarregar DB Micro (512MB) ──
        // Cada fase espera a anterior terminar antes de iniciar

        // Fase 0: renovar tokens
        await checkAndRefreshAll();

        // Fase 1: sync de dados — SEQUENCIAL (cada sync é pesado)
        await runAdsSyncForAllProfiles().catch(e => console.error('[cronSync] ads:', e.message));
        await runHotmartSyncForAllProfiles().catch(e => console.error('[cronSync] hotmart:', e.message));
        await runStripeSyncForAllProfiles().catch(e => console.error('[cronSync] stripe:', e.message));
        await runShopifySyncForAllProfiles().catch(e => console.error('[cronSync] shopify:', e.message));

        // Fase 2: jobs analíticos — SEQUENCIAL
        await runRfmForAllProfiles().catch(e => console.error('[cronSync] rfm:', e.message));
        await runSafetyNet().catch(e => console.error('[cronSync] safety-net:', e.message));
        await runCapitalScoreForAllProfiles().catch(e => console.error('[cronSync] capital:', e.message));
        await runValuationForAllProfiles().catch(e => console.error('[cronSync] valuation:', e.message));

        // Fase 3: correlações (após RFM)
        await refreshCorrelationViews().catch(e => console.error('[cronSync] views:', e.message));
        await runGrowthCorrelationsForAllProfiles().catch(e => console.error('[cronSync] growth:', e.message));

        // Fase 4: relatórios
        await processScheduledReports().catch(e => console.error('[cronSync] reports:', e.message));

        return res.status(200).json({ message: 'Cron sync completed.' });
    } catch (error: any) {
        console.error('[cronSync] error:', error.message);
        return res.status(500).json({ error: error.message });
    }
}

/**
 * Triggers an immediate ad metrics sync
 */
export async function triggerSync(req: Request, res: Response) {
    const { platform: rawPlatform } = req.params;
    const platform = String(rawPlatform || '').toLowerCase().trim();
    const profileId = req.headers['x-profile-id'] as string;

    if (!profileId) return res.status(400).json({ error: 'Missing x-profile-id header' });

    const days: number = req.body?.days !== undefined ? Number(req.body.days) : 2;

    try {
        console.log(`[IntegrationController] triggerSync started for ${platform} (Profile: ${profileId}, Days: ${days})`);

        if (platform === 'meta') {
            await backfillMetaAds(profileId, days);
            return res.status(200).json({ message: `Meta Ads sync completed for last ${days} days.` });
        }

        if (platform === 'google') {
            const result = await backfillGoogleAds(profileId, days);
            return res.status(200).json({ message: `Google Ads sync completed for last ${days} days.`, ...result });
        }

        if (platform === 'hotmart') {
            // Verify integration exists (user has connected Hotmart)
            const integration = await IntegrationService.getIntegration(profileId, 'hotmart');
            if (!integration) {
                return res.status(401).json({ error: 'Hotmart não conectado. Reconecte a integração.' });
            }
            // Run sync synchronously — uses user's OAuth token. Vercel allows up to 60s.
            const force = req.body?.force === true;
            const result = await backfillHotmart(profileId, days, force);
            return res.status(200).json({
                message: `Hotmart sync completed for last ${days} days.`,
                ...result,
            });
        }

        if (platform === 'stripe') {
            const integration = await IntegrationService.getIntegration(profileId, 'stripe');
            if (!integration) {
                return res.status(401).json({ error: 'Stripe não conectado. Reconecte a integração.' });
            }
            const result = await backfillStripe(profileId, days);
            return res.status(200).json({
                message: `Stripe sync completed for last ${days} days.`,
                ...result,
            });
        }

        if (platform === 'shopify') {
            const integration = await IntegrationService.getIntegration(profileId, 'shopify');
            if (!integration) {
                return res.status(401).json({ error: 'Shopify não conectado. Reconecte a integração.' });
            }
            const result = await backfillShopify(profileId, days);
            return res.status(200).json({
                message: `Shopify sync completed for last ${days} days.`,
                ...result,
            });
        }

        if (platform === 'all') {
            await runAdsSyncForAllProfiles();
            return res.status(200).json({ message: 'Full sync completed for all active integrations.' });
        }

        return res.status(400).json({ error: `Sync not supported for platform: ${platform}` });
    } catch (error: any) {
        const hotmartBody = error.response?.data;
        const errorMsg = hotmartBody?.error_description || hotmartBody?.error || error.message;
        const httpStatus = error.response?.status;
        console.error(`[IntegrationController] triggerSync error for ${platform} (HTTP ${httpStatus}):`, JSON.stringify(hotmartBody ?? error.message));
        return res.status(500).json({
            error: 'Failed to trigger sync',
            message: errorMsg,
            hotmart_error: hotmartBody ?? null,
            http_status: httpStatus ?? null,
            platform: platform
        });
    }
}

/**
 * Atribuição retroativa via Meta Lead Ads API.
 * Cruza emails de leads do Meta com clientes da Hotmart e atualiza acquisition_channel.
 */
export async function metaRetroactiveAttribution(req: Request, res: Response) {
    const profileId = req.headers['x-profile-id'] as string;
    if (!profileId) return res.status(400).json({ error: 'Missing x-profile-id header' });

    try {
        console.log(`[IntegrationController] metaRetroactiveAttribution started for profile ${profileId}`);
        const result = await runMetaLeadAttribution(profileId);
        return res.status(200).json({
            message: 'Atribuição retroativa concluída.',
            ...result,
        });
    } catch (error: any) {
        console.error('[IntegrationController] metaRetroactiveAttribution error:', error.message);
        return res.status(500).json({ error: error.message });
    }
}
