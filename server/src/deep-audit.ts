import { supabase } from './lib/supabase.js';
import dotenv from 'dotenv';
dotenv.config();

async function deepAudit() {
    const targetId = 'e619a586-53b7-491a-b890-66fe507b104f';
    console.log('Target ID:', targetId);

    // 1. Check if profile exists
    const { data: profile, error: pErr } = await supabase
        .from('profiles')
        .select('id, email')
        .eq('id', targetId)
        .single();

    if (pErr) console.log('Profile Check Error:', pErr.message);
    else console.log('Profile Found:', profile);

    // 2. Check table structure (via a dummy insert attempt)
    console.log('\n--- Attempting manual integration insert ---');
    const { error: iErr } = await supabase
        .from('integrations')
        .insert({
            profile_id: targetId,
            platform: 'test-audit-' + Date.now(),
            config_encrypted: { data: 'test' }
        });

    if (iErr) {
        console.log('Insert Error:', iErr.message);
        console.log('Full Error Object:', JSON.stringify(iErr, null, 2));
    } else {
        console.log('Manual Insert Success!');
    }
}

deepAudit();
