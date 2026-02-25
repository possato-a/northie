import { supabase } from '../lib/supabase.js';
import { encrypt, decrypt } from '../utils/encryption.js';
import axios from 'axios';

export interface OAuthTokens {
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
    token_type?: string;
    scope?: string;
}

/**
 * Core service to manage external platform integrations (Meta, Google, etc.)
 */
export class IntegrationService {

    /**
     * Generates the OAuth authorization URL for a specific platform
     */
    static getAuthorizationUrl(platform: string, profileId: string): string {
        const redirectUri = `${process.env.BACKEND_URL || 'http://localhost:3001'}/api/integrations/callback/${platform}`;

        switch (platform) {
            case 'meta':
                const appId = process.env.META_APP_ID;
                return `https://www.facebook.com/v18.0/dialog/oauth?client_id=${appId}&redirect_uri=${redirectUri}&scope=ads_read,business_management&state=${profileId}`;

            case 'google':
                const clientId = process.env.GOOGLE_CLIENT_ID;
                return `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code&scope=https://www.googleapis.com/auth/adwords&access_type=offline&state=${profileId}`;

            default:
                throw new Error(`Platform ${platform} not supported for OAuth`);
        }
    }

    /**
     * Stores encrypted tokens in the database
     */
    static async saveIntegration(profileId: string, platform: string, tokens: OAuthTokens) {
        // We store the tokens as an encrypted JSON string
        const encryptedConfig = encrypt(JSON.stringify(tokens));

        const { error } = await supabase
            .from('integrations')
            .upsert({
                profile_id: profileId,
                platform,
                config_encrypted: { data: encryptedConfig },
                status: 'active',
                last_sync_at: new Date().toISOString()
            }, { onConflict: 'profile_id, platform' });

        if (error) {
            console.error(`[IntegrationService] Error saving ${platform} integration:`, error);
            throw error;
        }

        console.log(`[IntegrationService] Successfully saved/updated ${platform} for profile ${profileId}`);
    }

    /**
     * Retrieves and decrypts integration tokens
     */
    static async getIntegration(profileId: string, platform: string): Promise<OAuthTokens | null> {
        const { data, error } = await supabase
            .from('integrations')
            .select('config_encrypted')
            .eq('profile_id', profileId)
            .eq('platform', platform)
            .single();

        if (error || !data) return null;

        try {
            const decrypted = decrypt((data.config_encrypted as any).data);
            return JSON.parse(decrypted);
        } catch (e) {
            console.error(`[IntegrationService] Failed to decrypt ${platform} tokens:`, e);
            return null;
        }
    }

    /**
     * Refreshes an expired access token using the refresh token
     */
    static async refreshTokens(profileId: string, platform: string): Promise<OAuthTokens> {
        const tokens = await this.getIntegration(profileId, platform);
        if (!tokens || !tokens.refresh_token) {
            throw new Error(`No refresh token available for ${platform}`);
        }

        console.log(`[IntegrationService] Refreshing ${platform} tokens for profile ${profileId}`);

        let refreshUrl = '';
        let payload: any = {};

        if (platform === 'google') {
            refreshUrl = 'https://oauth2.googleapis.com/token';
            payload = {
                client_id: process.env.GOOGLE_CLIENT_ID,
                client_secret: process.env.GOOGLE_CLIENT_SECRET,
                refresh_token: tokens.refresh_token,
                grant_type: 'refresh_token'
            };
        } else if (platform === 'meta') {
            // Meta (Facebook) has a different flow for long-lived tokens
            // usually you exchange a short-lived user token for a long-lived one
            refreshUrl = `https://graph.facebook.com/v18.0/oauth/access_token`;
            payload = {
                grant_type: 'fb_exchange_token',
                client_id: process.env.META_APP_ID,
                client_secret: process.env.META_APP_SECRET,
                fb_exchange_token: tokens.access_token // for Meta, we exchange the current one if it's near expiry
            };
        }

        try {
            const res = await axios.post(refreshUrl, payload);
            const newTokens: OAuthTokens = {
                ...tokens,
                access_token: res.data.access_token,
                expires_in: res.data.expires_in,
                // Refresh token might be returned again or we keep the old one
                refresh_token: res.data.refresh_token || tokens.refresh_token
            };

            await this.saveIntegration(profileId, platform, newTokens);
            return newTokens;
        } catch (error: any) {
            console.error(`[IntegrationService] Refresh failed for ${platform}:`, error.response?.data || error.message);
            throw error;
        }
    }
}
