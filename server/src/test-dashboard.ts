import axios from 'axios';
import { supabase } from './lib/supabase.js';

const API_URL = 'http://localhost:3001';

async function testDashboard() {
    console.log('--- Testing Northie Dashboard API ---');

    try {
        // 1. Get a Profile ID
        const { data: profile } = await supabase.from('profiles').select('id').limit(1).single();
        if (!profile) throw new Error('No profile found. Run verify-all.ts first.');

        const profileId = profile.id;
        console.log(`Using Profile ID: ${profileId}`);

        // 2. Test General Stats
        console.log('\n1. Requesting General Stats...');
        const statsRes = await axios.get(`${API_URL}/api/dashboard/stats`, {
            headers: { 'x-profile-id': profileId }
        });
        console.log('Response:', statsRes.data);

        // 3. Test Attribution Stats
        console.log('\n2. Requesting Attribution Stats...');
        const attrRes = await axios.get(`${API_URL}/api/dashboard/attribution`, {
            headers: { 'x-profile-id': profileId }
        });
        console.log('Response:', attrRes.data);

        // 4. Test Growth Metrics
        console.log('\n3. Requesting Growth Metrics...');
        const growthRes = await axios.get(`${API_URL}/api/dashboard/growth`, {
            headers: { 'x-profile-id': profileId }
        });
        console.log('Response:', growthRes.data);

        // 5. Test Revenue Chart
        console.log('\n4. Requesting Revenue Chart...');
        const chartRes = await axios.get(`${API_URL}/api/dashboard/chart`, {
            headers: { 'x-profile-id': profileId }
        });
        console.log('Response (sample):', chartRes.data.slice(-3));

        console.log('\n--- DASHBOARD TEST COMPLETED ---');

    } catch (error: any) {
        if (error.response) {
            console.error('API Error:', error.response.status, error.response.data);
        } else {
            console.error('Error:', error.message);
        }
    }
}

testDashboard();
