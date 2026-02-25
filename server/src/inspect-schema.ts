import { supabase } from './lib/supabase.js';
import dotenv from 'dotenv';
dotenv.config();

async function inspectSchema() {
    console.log('--- Constraint Inspection ---');

    // Query to find what integrations_profile_id_fkey points to
    const query = `
        SELECT
            tc.table_name, 
            kcu.column_name, 
            ccu.table_name AS foreign_table_name,
            ccu.column_name AS foreign_column_name 
        FROM 
            information_schema.table_constraints AS tc 
            JOIN information_schema.key_column_usage AS kcu
              ON tc.constraint_name = kcu.constraint_name
              AND tc.table_schema = kcu.table_schema
            JOIN information_schema.constraint_column_usage AS ccu
              ON ccu.constraint_name = tc.constraint_name
              AND ccu.table_schema = tc.table_schema
        WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_name='integrations';
    `;

    const { data, error } = await supabase.rpc('get_raw_sql', { sql_query: query });

    // If RPC doesn't exist, we might need a workaround or check migration again
    if (error) {
        console.log('Direct query failed (no RPC). Checking data raw...');
        const { data: cols, error: cErr } = await supabase.from('integrations').select('*').limit(0);
        console.log('Columns in integrations:', Object.keys(cols?.[0] || {}));
        return;
    }
    console.log('Schema Results:', JSON.stringify(data, null, 2));
}

inspectSchema();
