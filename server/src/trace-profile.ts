import { supabase } from './lib/supabase.js';
import dotenv from 'dotenv';
dotenv.config();

async function traceProfile() {
    console.log('--- Profile Trace ---');

    // 1. Get all profiles
    const { data: profiles, error: pErr } = await supabase.from('profiles').select('*');
    if (pErr) {
        console.error('Error fetching profiles:', pErr);
        return;
    }

    if (!profiles || profiles.length === 0) {
        console.log('CRITICAL: No profiles found in the database.');
        return;
    }

    const profile = profiles[0];
    console.log('Testing with Profile:', profile.id);

    // 2. Try to insert integration
    const { error: iErr } = await supabase
        .from('integrations')
        .insert({
            profile_id: profile.id,
            platform: 'trace-test',
            config_encrypted: { data: 'test' }
        });

    if (iErr) {
        console.error('Integration Insert Failed:', iErr.message);
        console.log('Full Constraint Name from Error:', iErr.details || 'N/A');
    } else {
        console.log('Insertion SUCCESSFUL for profile', profile.id);

        // Cleanup
        await supabase.from('integrations').delete().eq('profile_id', profile.id).eq('platform', 'trace-test');
    }
}

traceProfile();
