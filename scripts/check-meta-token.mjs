import { createClient } from '@supabase/supabase-js';
import axios from 'axios';
import crypto from 'crypto';

const db = createClient(
    'https://ucwlgqowqpfmotcofqoz.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVjd2xncW93cXBmbW90Y29mcW96Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTg4NTM0MCwiZXhwIjoyMDg3NDYxMzQwfQ.gdr9KNPXz4poRFHdVPBUIBQ-B-Wn4qNi5njHm_ePMoI'
);
const PROFILE_ID = '5ffb35c4-34f5-4247-925a-10639b08096a';
const KEY = 'northie-security-key-32-chars-!!';

const { data: integration } = await db.from('integrations').select('config_encrypted').eq('profile_id', PROFILE_ID).eq('platform', 'meta').single();
const parts = integration.config_encrypted.data.split(':');
const iv = Buffer.from(parts.shift(), 'hex');
const enc = Buffer.from(parts.join(':'), 'hex');
const dec = crypto.createDecipheriv('aes-256-cbc', Buffer.from(KEY), iv);
const token = JSON.parse(Buffer.concat([dec.update(enc), dec.final()]).toString()).access_token;

console.log('Token (primeiros 20 chars):', token.slice(0, 20) + '...');

// 1. /me com adaccounts
try {
    const me = await axios.get('https://graph.facebook.com/v18.0/me', {
        params: { access_token: token, fields: 'id,name,adaccounts{id,name,account_id}' }
    });
    console.log('\n/me:', JSON.stringify(me.data, null, 2));
} catch(e) {
    console.log('/me error:', e.response?.data || e.message);
}

// 2. Tenta adaccounts direto
try {
    const accounts = await axios.get('https://graph.facebook.com/v18.0/me/adaccounts', {
        params: { access_token: token, fields: 'id,name,account_id', limit: 10 }
    });
    console.log('\n/me/adaccounts:', JSON.stringify(accounts.data?.data, null, 2));

    // 3. Para cada ad account, tenta pegar os leadgen forms
    for (const acc of (accounts.data?.data || [])) {
        console.log(`\nAd account: ${acc.id} (${acc.name})`);
        try {
            const forms = await axios.get(`https://graph.facebook.com/v18.0/${acc.id}/leadgen_forms`, {
                params: { access_token: token, fields: 'id,name,status', limit: 20 }
            });
            console.log('  Lead forms:', JSON.stringify(forms.data?.data, null, 2));
        } catch(e) {
            console.log('  Lead forms error:', e.response?.data?.error?.message || e.message);
        }
    }
} catch(e) {
    console.log('adaccounts error:', e.response?.data || e.message);
}
