/**
 * @file jobs/safety-net.job.ts
 *
 * Reconciliação diária de integridade de dados.
 *
 * Roda uma vez por dia (3h da manhã, via setInterval após boot).
 * Para cada perfil com Hotmart ativo:
 *   1. Consulta o total de vendas aprovadas na API da Hotmart para os últimos 30 dias.
 *   2. Compara com o count de transactions no banco para o mesmo período.
 *   3. Se detectar gap (API > DB), dispara backfill forçado do período afetado.
 *   4. Registra o resultado em sync_logs para auditoria.
 *
 * Garante que falhas de webhook (timeout, deploy, network) não resultem em
 * dados perdidos permanentemente.
 */

import axios from 'axios';
import { supabase } from '../lib/supabase.js';
import { backfillHotmart } from './hotmart-sync.job.js';

const HOTMART_AUTH_URL = 'https://api-sec-vlc.hotmart.com/security/oauth/token';
const HOTMART_API_BASE = 'https://developers.hotmart.com';

// ── Auth client credentials ────────────────────────────────────────────────

async function getClientCredentialsToken(): Promise<string> {
    const clientId = (process.env.HOTMART_CLIENT_ID || '').trim();
    const clientSecret = (process.env.HOTMART_CLIENT_SECRET || '').trim();
    if (!clientId || !clientSecret) {
        throw new Error('[SafetyNet] HOTMART_CLIENT_ID ou HOTMART_CLIENT_SECRET não configurados');
    }
    const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    const res = await axios.post(
        HOTMART_AUTH_URL,
        new URLSearchParams({ grant_type: 'client_credentials' }),
        {
            headers: { Authorization: `Basic ${credentials}`, 'Content-Type': 'application/x-www-form-urlencoded' },
            timeout: 15000,
        }
    );
    const token: string | undefined = res.data?.access_token;
    if (!token) throw new Error('[SafetyNet] Hotmart não retornou access_token');
    return token;
}

// ── API count check (1 request, sem paginação) ────────────────────────────

async function getHotmartApiCount(
    accessToken: string,
    startMs: number,
    endMs: number
): Promise<number> {
    const res = await axios.get(`${HOTMART_API_BASE}/payments/api/v1/sales/history`, {
        headers: { Authorization: `Bearer ${accessToken}` },
        params: {
            max_results: 1,
            start_date: startMs,
            end_date: endMs,
        },
        timeout: 20000,
    });
    // Hotmart retorna total_results no page_info
    return res.data?.page_info?.total_results ?? 0;
}

// ── DB count check ────────────────────────────────────────────────────────

async function getDbCount(profileId: string, startIso: string, endIso: string): Promise<number> {
    const { count } = await supabase
        .from('transactions')
        .select('id', { count: 'exact', head: true })
        .eq('profile_id', profileId)
        .eq('platform', 'hotmart')
        .eq('status', 'approved')
        .gte('created_at', startIso)
        .lte('created_at', endIso);
    return count ?? 0;
}

// ── Sync log ──────────────────────────────────────────────────────────────

async function logResult(
    profileId: string,
    apiCount: number,
    dbCount: number,
    backfillTriggered: boolean,
    gapFilled: number,
    error?: string
): Promise<void> {
    await supabase.from('sync_logs').insert({
        profile_id: profileId,
        platform: 'hotmart_safety_net',
        started_at: new Date().toISOString(),
        finished_at: new Date().toISOString(),
        status: error ? 'error' : 'success',
        rows_upserted: gapFilled,
        error_message: error ?? null,
        // Armazena detalhes no campo de metadados
        meta: JSON.stringify({ apiCount, dbCount, backfillTriggered, gap: apiCount - dbCount }),
    });
}

// ── Reconciliation for a single profile ──────────────────────────────────

async function reconcileProfile(profileId: string, accessToken: string): Promise<void> {
    const DAYS = 30;
    const endMs = Date.now();
    const startMs = endMs - DAYS * 24 * 60 * 60 * 1000;
    const startIso = new Date(startMs).toISOString();
    const endIso = new Date(endMs).toISOString();

    let apiCount = 0;
    let dbCount = 0;

    try {
        [apiCount, dbCount] = await Promise.all([
            getHotmartApiCount(accessToken, startMs, endMs),
            getDbCount(profileId, startIso, endIso),
        ]);
    } catch (err: any) {
        console.error(`[SafetyNet] Failed to fetch counts for ${profileId}:`, err.message);
        await logResult(profileId, 0, 0, false, 0, err.message);
        return;
    }

    const gap = apiCount - dbCount;
    console.log(`[SafetyNet] Profile ${profileId}: API=${apiCount}, DB=${dbCount}, gap=${gap}`);

    if (gap <= 0) {
        // Tudo sincronizado
        await logResult(profileId, apiCount, dbCount, false, 0);
        return;
    }

    // Gap detectado — dispara backfill forçado dos últimos 30 dias
    console.warn(`[SafetyNet] Gap de ${gap} transação(ões) para ${profileId} — disparando backfill`);
    try {
        const result = await backfillHotmart(profileId, DAYS, true /* force */);
        const filled = result.synced ?? 0;
        console.log(`[SafetyNet] Backfill completo para ${profileId}: ${filled} transação(ões) recuperada(s)`);
        await logResult(profileId, apiCount, dbCount, true, filled);
    } catch (err: any) {
        console.error(`[SafetyNet] Backfill falhou para ${profileId}:`, err.message);
        await logResult(profileId, apiCount, dbCount, true, 0, err.message);
    }
}

// ── Main runner ───────────────────────────────────────────────────────────

async function runSafetyNet(): Promise<void> {
    console.log('[SafetyNet] Starting daily reconciliation...');

    // Busca todos os perfis com Hotmart ativo
    const { data: integrations, error } = await supabase
        .from('integrations')
        .select('profile_id')
        .eq('platform', 'hotmart')
        .eq('status', 'active');

    if (error || !integrations?.length) {
        console.log('[SafetyNet] No active Hotmart integrations — skipping.');
        return;
    }

    // Obtém token uma única vez para todas as contas
    let accessToken: string;
    try {
        accessToken = await getClientCredentialsToken();
    } catch (err: any) {
        console.error('[SafetyNet] Could not obtain Hotmart token:', err.message);
        return;
    }

    for (const { profile_id } of integrations) {
        try {
            await reconcileProfile(profile_id, accessToken);
        } catch (err: any) {
            console.error(`[SafetyNet] Unhandled error for profile ${profile_id}:`, err.message);
        }
    }

    console.log('[SafetyNet] Reconciliation complete.');
}

// ── Job starter ───────────────────────────────────────────────────────────

export function startSafetyNetJob(): void {
    const MS_PER_DAY = 24 * 60 * 60 * 1000;
    // Aguarda 3 horas após boot para não competir com outros jobs no startup,
    // depois roda uma vez por dia.
    const INITIAL_DELAY_MS = 3 * 60 * 60 * 1000;

    console.log('[SafetyNet] Job registered — will run 3h after boot, then every 24h.');

    setTimeout(() => {
        runSafetyNet();
        setInterval(runSafetyNet, MS_PER_DAY);
    }, INITIAL_DELAY_MS);
}

export { runSafetyNet };
