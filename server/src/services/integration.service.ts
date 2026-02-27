import { supabase } from '../lib/supabase.js';
import { encrypt, decrypt } from '../utils/encryption.js';
import axios from 'axios';
import crypto from 'crypto';
import type { OAuthTokens } from '../types/index.js';

// ─── OAuth CSRF helpers ────────────────────────────────────────────────────
// The `state` parameter encodes: <profileId>.<timestamp>.<hmac>
// The HMAC is computed over "profileId:timestamp" using OAUTH_STATE_SECRET.
// Tokens expire after 10 minutes to limit replay window.

const OAUTH_STATE_SECRET = process.env.OAUTH_STATE_SECRET || process.env.CRON_SECRET || '';
const STATE_TTL_MS = 10 * 60 * 1000; // 10 minutes

function hmacState(profileId: string, ts: number): string {
    return crypto.createHmac('sha256', OAUTH_STATE_SECRET).update(`${profileId}:${ts}`).digest('hex');
}

/**
 * Core service to manage external platform integrations (Meta, Google, etc.)
 */
export class IntegrationService {

    /**
     * Generates a signed CSRF-safe state token: "<profileId>.<ts>.<hmac>"
     */
    static generateOAuthState(profileId: string): string {
        const ts = Date.now();
        const sig = hmacState(profileId, ts);
        return `${profileId}.${ts}.${sig}`;
    }

    /**
     * Validates the state token and returns the embedded profileId,
     * or throws if tampered / expired.
     */
    static validateOAuthState(state: string): string {
        const parts = state.split('.');
        if (parts.length < 3) throw new Error('Invalid OAuth state format');
        const sig = parts.pop()!;
        const ts = Number(parts.pop()!);
        const profileId = parts.join('.'); // handle UUIDs with dots (none, but safe)
        if (Date.now() - ts > STATE_TTL_MS) throw new Error('OAuth state expired');
        const expected = hmacState(profileId, ts);
        if (!crypto.timingSafeEqual(Buffer.from(sig, 'hex'), Buffer.from(expected, 'hex'))) {
            throw new Error('OAuth state signature invalid');
        }
        return profileId;
    }

    /**
     * Generates the OAuth authorization URL for a specific platform
     */
    static getAuthorizationUrl(platform: string, profileId: string): string {
        const redirectUri = `${process.env.BACKEND_URL || 'http://localhost:3001'}/api/integrations/callback/${platform}`;
        const state = this.generateOAuthState(profileId);

        switch (platform) {
            case 'meta':
                const appId = process.env.META_APP_ID;
                return `https://www.facebook.com/v18.0/dialog/oauth?client_id=${appId}&redirect_uri=${redirectUri}&scope=ads_read,business_management&state=${encodeURIComponent(state)}`;

            case 'google':
                const clientId = process.env.GOOGLE_CLIENT_ID;
                const googleRedirectUri = `${process.env.BACKEND_URL || 'http://localhost:3001'}/api/integrations/callback/google`;
                return `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${googleRedirectUri}&response_type=code&scope=https://www.googleapis.com/auth/adwords&access_type=offline&state=${encodeURIComponent(state)}&prompt=consent`;

            case 'hotmart':
                const hotmartClientId = process.env.HOTMART_CLIENT_ID;
                return `https://api-sec-vlc.hotmart.com/security/oauth/authorize?client_id=${hotmartClientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=all&state=${encodeURIComponent(state)}`;

            default:
                throw new Error(`Platform ${platform} not supported for OAuth`);
        }
    }

    /**
     * Stores encrypted tokens in the database.
     * Calculates expires_at from expires_in if not already set.
     */
    static async saveIntegration(profileId: string, platform: string, tokens: OAuthTokens) {
        // Derive absolute expiry timestamp from expires_in (seconds)
        const expiresAt = tokens.expires_at
            ?? (tokens.expires_in ? Date.now() + tokens.expires_in * 1000 : undefined);

        const tokensWithExpiry: OAuthTokens = { ...tokens };
        if (expiresAt !== undefined) tokensWithExpiry.expires_at = expiresAt;

        const encryptedConfig = encrypt(JSON.stringify(tokensWithExpiry));

        const { error } = await supabase
            .from('integrations')
            .upsert({
                profile_id: profileId,
                platform,
                config_encrypted: { data: encryptedConfig },
                status: 'active',
                last_sync_at: new Date().toISOString()
            }, { onConflict: 'profile_id,platform' });

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
     * Returns true if the stored token expires within the next `bufferMs` milliseconds.
     * Defaults to 7-day buffer (tokens expiring in < 7 days are considered "near expiry").
     */
    static isNearExpiry(tokens: OAuthTokens, bufferMs = 7 * 24 * 60 * 60 * 1000): boolean {
        if (!tokens.expires_at) return false; // unknown — assume still valid
        return tokens.expires_at - Date.now() < bufferMs;
    }

    /**
     * Refreshes / re-exchanges a token for the given platform.
     *
     * Meta:   Does NOT use OAuth refresh_token. Long-lived tokens (60d) are
     *         re-exchanged via fb_exchange_token when they are near expiry.
     *         If the token is still valid, this is a no-op.
     *
     * Google: Standard OAuth refresh_token flow.
     */
    static async refreshTokens(profileId: string, platform: string): Promise<OAuthTokens> {
        const tokens = await this.getIntegration(profileId, platform);
        if (!tokens) {
            throw new Error(`[IntegrationService] No tokens stored for ${platform} / ${profileId}`);
        }

        // ── Meta ──────────────────────────────────────────────────────────
        if (platform === 'meta') {
            // Meta long-lived tokens last ~60 days and cannot be refreshed with
            // a refresh_token. Instead we re-exchange when near expiry.
            if (!this.isNearExpiry(tokens)) {
                console.log(`[IntegrationService] Meta token still valid for profile ${profileId}, skipping.`);
                return tokens;
            }

            console.log(`[IntegrationService] Meta token near expiry for profile ${profileId} — re-exchanging.`);
            try {
                const res = await axios.get('https://graph.facebook.com/v18.0/oauth/access_token', {
                    params: {
                        grant_type: 'fb_exchange_token',
                        client_id: process.env.META_APP_ID,
                        client_secret: process.env.META_APP_SECRET,
                        fb_exchange_token: tokens.access_token,
                    },
                });
                // Drop expires_at so saveIntegration recalculates it from expires_in
                const { expires_at: _drop, ...rest } = tokens;
                const newTokens: OAuthTokens = {
                    ...rest,
                    access_token: res.data.access_token,
                    expires_in: res.data.expires_in,
                };
                await this.saveIntegration(profileId, platform, newTokens);
                console.log(`[IntegrationService] Meta token renewed for profile ${profileId}.`);
                return newTokens;
            } catch (error: any) {
                const detail = error.response?.data ?? error.message;
                console.error(`[IntegrationService] Meta re-exchange failed for ${profileId}:`, detail);
                // Mark integration as inactive so the user knows to reconnect
                await supabase
                    .from('integrations')
                    .update({ status: 'inactive' })
                    .eq('profile_id', profileId)
                    .eq('platform', 'meta');
                throw error;
            }
        }

        // ── Google ────────────────────────────────────────────────────────
        if (platform === 'google') {
            if (!tokens.refresh_token) {
                throw new Error(`[IntegrationService] No refresh_token for Google / ${profileId}`);
            }
            if (!this.isNearExpiry(tokens, 10 * 60 * 1000)) {
                // Google access tokens last 1h — buffer of 10 min
                console.log(`[IntegrationService] Google token still valid for profile ${profileId}, skipping.`);
                return tokens;
            }

            console.log(`[IntegrationService] Refreshing Google token for profile ${profileId}.`);
            try {
                const res = await axios.post('https://oauth2.googleapis.com/token', {
                    client_id: process.env.GOOGLE_CLIENT_ID,
                    client_secret: process.env.GOOGLE_CLIENT_SECRET,
                    refresh_token: tokens.refresh_token,
                    grant_type: 'refresh_token',
                });
                const { expires_at: _dropG, ...restG } = tokens;
                const newTokens: OAuthTokens = {
                    ...restG,
                    access_token: res.data.access_token,
                    expires_in: res.data.expires_in,
                    refresh_token: res.data.refresh_token ?? tokens.refresh_token,
                };
                await this.saveIntegration(profileId, platform, newTokens);
                return newTokens;
            } catch (error: any) {
                console.error(`[IntegrationService] Google refresh failed for ${profileId}:`, error.response?.data ?? error.message);
                await supabase
                    .from('integrations')
                    .update({ status: 'inactive' })
                    .eq('profile_id', profileId)
                    .eq('platform', 'google');
                throw error;
            }
        }

        // ── Hotmart ───────────────────────────────────────────────────────────
        if (platform === 'hotmart') {
            if (!tokens.refresh_token) {
                throw new Error(`[IntegrationService] No refresh_token for Hotmart / ${profileId}`);
            }
            if (!this.isNearExpiry(tokens, 10 * 60 * 1000)) {
                console.log(`[IntegrationService] Hotmart token still valid for profile ${profileId}, skipping.`);
                return tokens;
            }

            console.log(`[IntegrationService] Refreshing Hotmart token for profile ${profileId}.`);
            try {
                const credentials = Buffer.from(
                    `${process.env.HOTMART_CLIENT_ID}:${process.env.HOTMART_CLIENT_SECRET}`
                ).toString('base64');
                const res = await axios.post(
                    'https://api-sec-vlc.hotmart.com/security/oauth/token',
                    new URLSearchParams({
                        grant_type: 'refresh_token',
                        refresh_token: tokens.refresh_token,
                    }),
                    { headers: { Authorization: `Basic ${credentials}`, 'Content-Type': 'application/x-www-form-urlencoded' } }
                );
                const { expires_at: _drop, ...rest } = tokens;
                const newTokens: OAuthTokens = {
                    ...rest,
                    access_token: res.data.access_token,
                    expires_in: res.data.expires_in,
                    refresh_token: res.data.refresh_token ?? tokens.refresh_token,
                };
                await this.saveIntegration(profileId, platform, newTokens);
                return newTokens;
            } catch (error: any) {
                console.error(`[IntegrationService] Hotmart refresh failed for ${profileId}:`, error.response?.data ?? error.message);
                await supabase
                    .from('integrations')
                    .update({ status: 'inactive' })
                    .eq('profile_id', profileId)
                    .eq('platform', 'hotmart');
                throw error;
            }
        }

        throw new Error(`[IntegrationService] refreshTokens not implemented for platform: ${platform}`);
    }
}
