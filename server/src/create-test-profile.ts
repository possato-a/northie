import { supabase } from './lib/supabase.js';
import dotenv from 'dotenv';
dotenv.config();

async function createTestProfile() {
    const id = 'f72a3921-1234-5678-abcd-ef0987654321'; // Dummy UUID
    console.log('Creating Test Profile:', id);

    // Note: This might fail if auth.users doesn't have this ID, 
    // but profiles.id references auth.users in init_schema.
    // Let's check if we can skip auth for testing.

    const { data: profile, error } = await supabase
        .from('profiles')
        .insert({
            id: id,
            email: 'audit-test-' + Date.now() + '@northie.ai',
            full_name: 'Audit Test'
        })
        .select();

    if (error) {
        console.error('Failed to create profile (likely due to auth.users FK):', error.message);
        // Let's find a REAL ID from auth if possible, or just use the one we have and try to REPAIR its relation.
    } else {
        console.log('Profile Created Successfully:', profile);
    }
}

createTestProfile();
