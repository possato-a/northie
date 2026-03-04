/**
 * Roda a atribuição retroativa Meta Lead Ads → clientes Hotmart.
 * Uso: node scripts/run-meta-attribution.mjs
 */

import { createClient } from '@supabase/supabase-js';
import axios from 'axios';

const SUPABASE_URL = 'https://ucwlgqowqpfmotcofqoz.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVjd2xncW93cXBmbW90Y29mcW96Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTg4NTM0MCwiZXhwIjoyMDg3NDYxMzQwfQ.gdr9KNPXz4poRFHdVPBUIBQ-B-Wn4qNi5njHm_ePMoI';
const PROFILE_ID = '5ffb35c4-34f5-4247-925a-10639b08096a';
const GRAPH = 'https://graph.facebook.com/v18.0';

const db = createClient(SUPABASE_URL, SUPABASE_KEY);

// ── Decrypt token ─────────────────────────────────────────────────────────────
// A encryption util usa AES-256-GCM. Replicamos aqui via node:crypto.
import crypto from 'crypto';

const ENCRYPTION_KEY_HEX = process.env.ENCRYPTION_KEY;

function decrypt(encryptedData) {
    const key = ENCRYPTION_KEY_HEX; // raw 32-byte ASCII string (AES-256-CBC)
    if (!key) throw new Error('ENCRYPTION_KEY não configurada');
    const parts = encryptedData.split(':');
    const iv = Buffer.from(parts.shift(), 'hex');
    const encrypted = Buffer.from(parts.join(':'), 'hex');
    const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(key), iv);
    return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString();
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const pass = msg => console.log(`  ✅ ${msg}`);
const fail = msg => console.log(`  ❌ ${msg}`);
const info = msg => console.log(`  ℹ  ${msg}`);

function extractEmail(fieldData) {
    const f = fieldData.find(f => f.name.toLowerCase().includes('email'));
    return f?.values?.[0]?.toLowerCase().trim() || null;
}

function extractName(fieldData) {
    const full = fieldData.find(f => f.name === 'full_name' || f.name.includes('nome'));
    if (full?.values?.[0]) return full.values[0].trim();
    const first = fieldData.find(f => f.name === 'first_name')?.values?.[0] || '';
    const last = fieldData.find(f => f.name === 'last_name')?.values?.[0] || '';
    return (first + ' ' + last).trim() || null;
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function run() {
    console.log('🔗 Atribuição Retroativa — Meta Lead Ads → Clientes Hotmart\n');

    // 1. Pega token Meta do banco
    const { data: integration } = await db
        .from('integrations')
        .select('config_encrypted')
        .eq('profile_id', PROFILE_ID)
        .eq('platform', 'meta')
        .single();

    if (!integration) { fail('Meta não conectado'); return; }

    let accessToken;
    try {
        const decrypted = decrypt(integration.config_encrypted.data);
        accessToken = JSON.parse(decrypted).access_token;
        pass('Token Meta obtido');
    } catch (e) {
        fail(`Não conseguiu decriptar token: ${e.message}`);
        info('Dica: ENCRYPTION_KEY precisa estar no .env do servidor');
        return;
    }

    // 2. Busca pages
    const pagesRes = await axios.get(`${GRAPH}/me/accounts`, {
        params: { access_token: accessToken, fields: 'id,name,access_token', limit: 50 }
    }).catch(e => ({ data: { data: [] }, error: e.response?.data?.error?.message }));

    const pages = pagesRes.data?.data || [];
    info(`Pages encontradas: ${pages.length}`);

    let totalLeads = 0, matched = 0, updated = 0;

    for (const page of pages) {
        // 3. Busca formulários
        const formsRes = await axios.get(`${GRAPH}/${page.id}/leadgen_forms`, {
            params: { access_token: page.access_token, fields: 'id,name,status', limit: 50 }
        }).catch(() => ({ data: { data: [] } }));

        const forms = formsRes.data?.data || [];
        if (forms.length === 0) continue;
        info(`Page "${page.name}": ${forms.length} formulário(s)`);

        for (const form of forms) {
            let nextUrl = `${GRAPH}/${form.id}/leads`;
            let params = { access_token: page.access_token, fields: 'field_data,created_time', limit: 100 };

            while (nextUrl) {
                const res = await axios.get(nextUrl, { params }).catch(e => {
                    fail(`Erro ao buscar leads do form ${form.id}: ${e.response?.data?.error?.message || e.message}`);
                    return null;
                });
                if (!res) break;

                const leads = res.data?.data || [];
                totalLeads += leads.length;

                for (const lead of leads) {
                    const email = extractEmail(lead.field_data);
                    if (!email) continue;

                    const { data: customer } = await db
                        .from('customers')
                        .select('id, acquisition_channel, name')
                        .eq('profile_id', PROFILE_ID)
                        .eq('email', email)
                        .single();

                    if (!customer) continue;
                    matched++;

                    if (customer.acquisition_channel && customer.acquisition_channel !== 'desconhecido') {
                        info(`${email} — já atribuído: ${customer.acquisition_channel}`);
                        continue;
                    }

                    const payload = { acquisition_channel: 'meta_ads' };
                    if (!customer.name) {
                        const name = extractName(lead.field_data);
                        if (name) payload.name = name;
                    }

                    const { error } = await db.from('customers').update(payload).eq('id', customer.id);
                    if (!error) {
                        updated++;
                        pass(`${email} → meta_ads`);
                    }
                }

                nextUrl = res.data?.paging?.next || null;
                params = {};
            }
        }
    }

    console.log('\n' + '═'.repeat(50));
    console.log('📊 RESULTADO\n');
    info(`Leads processados: ${totalLeads}`);
    info(`Clientes encontrados no banco: ${matched}`);
    pass(`Clientes atualizados para meta_ads: ${updated}`);

    // Estado final
    const { data: customers } = await db
        .from('customers')
        .select('acquisition_channel')
        .eq('profile_id', PROFILE_ID);

    const byChannel = {};
    (customers || []).forEach(c => {
        const ch = c.acquisition_channel || 'desconhecido';
        byChannel[ch] = (byChannel[ch] || 0) + 1;
    });
    console.log('\n  Por canal:', JSON.stringify(byChannel));
    console.log('═'.repeat(50));
}

run().catch(console.error);
