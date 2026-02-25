import { supabase } from './lib/supabase.js';
import dotenv from 'dotenv';
dotenv.config();

async function checkProfiles() {
    const { data, error } = await supabase.from('profiles').select('id, email');
    if (error) {
        console.error('Error fetching profiles:', error);
        return;
    }
    console.log('Available Profiles:', JSON.stringify(data, null, 2));
}

checkProfiles();
