import { supabase } from './lib/supabase.js';

async function testConnection() {
    console.log('Testing Supabase connection...');
    try {
        const { data, error } = await supabase.from('profiles').select('count', { count: 'exact', head: true });

        if (error) {
            console.error('Connection failed:', error.message);
            if (error.message.includes('relation "profiles" does not exist')) {
                console.log('TIP: Did you run the SQL migration on the Supabase SQL Editor?');
            }
        } else {
            console.log('Success! Connected to Supabase.');
        }
    } catch (err) {
        console.error('An unexpected error occurred:', err);
    }
}

testConnection();
