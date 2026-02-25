import { supabase } from './lib/supabase.js';
import dotenv from 'dotenv';
dotenv.config();

async function debugSchema() {
    console.log('--- Database Audit ---');

    // Check integrations table fkey
    const { data: profiles, error: pErr } = await supabase.from('profiles').select('*');
    console.log('Profiles in DB:', JSON.stringify(profiles, null, 2));

    const { data: integrations, error: iErr } = await supabase.from('integrations').select('*');
    console.log('Integrations in DB:', JSON.stringify(integrations, null, 2));
}

debugSchema();
