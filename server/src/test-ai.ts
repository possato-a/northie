import axios from 'axios';
import { supabase } from './lib/supabase.js';

const API_URL = 'http://localhost:3001';

async function testAIChat() {
    console.log('--- Testing "Ask Northie" (Live Claude) ---');

    try {
        // 1. Get a Profile ID
        const { data: profile } = await supabase.from('profiles').select('id').limit(1).single();
        if (!profile) throw new Error('No profile found. Run verify-all.ts first.');

        const profileId = profile.id;
        console.log(`Using Profile ID: ${profileId}`);

        // 2. Test Chat Message
        console.log('\nRequesting insight from Northie...');
        const response = await axios.post(`${API_URL}/api/ai/chat`, {
            message: 'Com base nos meus dados de faturamento, qual o seu conselho estratégico para hoje?'
        }, {
            headers: { 'x-profile-id': profileId }
        });

        console.log('\n--- NORTHIE RESPONSE ---');
        console.log(response.data.content);
        console.log('\nModel used:', response.data.model);

    } catch (error: any) {
        if (error.response) {
            console.error('API Error:', error.response.status, error.response.data);
        } else {
            console.error('Error:', error.message);
        }
    }
}

testAIChat();
