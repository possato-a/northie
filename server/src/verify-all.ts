import { supabase } from './lib/supabase.js';
import axios from 'axios';
import dotenv from 'dotenv';
import { randomUUID } from 'crypto';

dotenv.config();

const API_URL = 'http://localhost:3001';
const TEST_EMAIL = 'tester@example.com';
const TEST_VISITOR_ID = randomUUID(); // Fresh UUID for each test run

async function runEndToEndTest() {
    console.log('--- Starting End-to-End Backend Test ---');

    try {
        // 0. Ensure we have a profile
        console.log('1. Checking for a profile...');
        let { data: profile } = await supabase.from('profiles').select('id').limit(1).single();

        if (!profile) {
            console.log('   !!! ATTENTION !!!');
            console.log('   No profile found in "profiles" table.');
            console.log('   The "profiles" table has a FK to "auth.users".');
            console.log('   PLEASE: Create a user in the Supabase Auth panel first,');
            console.log('   or manually insert a row in the "profiles" table.');
            console.log('   Falling back to a generic ID (this might fail if RLS/FK are strict)...');

            // Try to find ANY user in auth.users if possible (only service role can do this)
            const { data: authUsers } = await supabase.auth.admin.listUsers();
            if (authUsers?.users && authUsers.users.length > 0) {
                const firstUser = authUsers.users[0];
                if (firstUser) {
                    const userId = firstUser.id;
                    console.log(`   Found an auth user! Using ID: ${userId}`);
                    const { data: newP } = await supabase.from('profiles').insert({ id: userId, email: 'test@northie.ai' }).select().single();
                    profile = newP;
                }
            }
        }

        if (!profile) {
            throw new Error('Could not find or create a profile. Please create a user in Supabase Auth first.');
        }

        const profileId = profile.id;
        console.log(`   Using Profile ID: ${profileId}`);

        // 1. Test Pixel Event
        console.log('2. Testing Northie Pixel event...');
        const pixelResponse = await axios.post(`${API_URL}/api/pixel/event`, {
            visitor_id: TEST_VISITOR_ID,
            page_url: 'https://northie.ai/landing-page',
            utm_source: 'meta_ads',
            utm_medium: 'cpc',
            utm_campaign: 'black_friday_test'
        }, {
            headers: { 'x-profile-id': profileId }
        });
        console.log('   Pixel Response:', pixelResponse.data);

        // Wait a bit for DB to propagate (sometimes needed for real-time verification scripts)
        console.log('   Wait for persistence...');
        await new Promise(resolve => setTimeout(resolve, 2000));

        // 2. Verify Visit in DB
        const { data: visit, error: vError } = await supabase
            .from('visits')
            .select('*')
            .eq('visitor_id', TEST_VISITOR_ID)
            .limit(1)
            .single();

        if (vError) {
            console.error('   Visit Verification Query Error:', vError);
        }

        if (visit) {
            console.log('   Success: Visit recorded in database.');
        } else {
            // Check if it exists at all
            const { data: allVisits } = await supabase.from('visits').select('visitor_id').limit(5);
            console.log('   Latest visits in DB:', allVisits);
            throw new Error(`Visit for visitor_id ${TEST_VISITOR_ID} not found in database.`);
        }

        // 3. Test Webhook (Hotmart Simulation)
        console.log('3. Testing Hotmart Webhook simulation...');
        const webhookResponse = await axios.post(`${API_URL}/api/webhooks/hotmart`, {
            event: 'PURCHASE_APPROVED',
            data: {
                buyer: { email: TEST_EMAIL },
                purchase: {
                    full_price: { value: 97.00 },
                    transaction: 'HP' + Date.now(),
                    src: TEST_VISITOR_ID // Simulating attribution parameter
                }
            }
        }, {
            headers: { 'x-profile-id': profileId }
        });
        console.log('   Webhook Response:', webhookResponse.data);

        // 4. Wait for normalization (asynchronous) and verify
        console.log('4. Waiting for normalization...');
        await new Promise(resolve => setTimeout(resolve, 3000));

        const { data: customer } = await supabase
            .from('customers')
            .select('*')
            .eq('email', TEST_EMAIL)
            .eq('profile_id', profileId)
            .single();

        if (customer && Number(customer.total_ltv) >= 97) {
            console.log('   Success: Customer LTV updated correctly.');
        } else {
            console.error('Customer data:', customer);
            throw new Error('Customer or LTV not updated correctly after webhook.');
        }

        const { data: transactions, error: tError } = await supabase
            .from('transactions')
            .select('*')
            .eq('customer_id', (customer as any).id);

        if (tError) console.error('   Transaction Query Error:', tError);

        if (transactions && transactions.length > 0) {
            console.log(`   Success: Found ${transactions.length} transactions for customer.`);
            const latestTrans = transactions[0];
            console.log('   Latest Transaction Platform:', latestTrans.platform);
            console.log('   Latest Transaction Attribution:', latestTrans.northie_attribution_id);
        } else {
            // Debug: Check ALL transactions to see if IDs match
            const { data: allT } = await supabase.from('transactions').select('customer_id, platform').limit(5);
            console.log('   Sample transactions in DB:', allT);
            console.log('   Expected Customer ID:', (customer as any).id);
            throw new Error('Transaction not found in database.');
        }

        // 5. Verify Attribution
        if (customer.acquisition_channel === 'meta_ads') {
            console.log('   Success: Attribution matched to "meta_ads" correctly!');
        } else {
            console.warn(`   Warning: Attribution was "${customer.acquisition_channel}" instead of "meta_ads".`);
        }

        console.log('\n--- ALL TESTS PASSED! ---');
        console.log('Current Stats:');
        console.log(`- Visitor: ${TEST_VISITOR_ID}`);
        console.log(`- Customer: ${TEST_EMAIL}`);
        console.log(`- LTV: ${customer.total_ltv}`);

    } catch (error: any) {
        console.error('\n--- TEST FAILED ---');
        if (error.response) {
            console.error('API Error:', error.response.status, error.response.data);
        } else {
            console.error('Error:', error.message);
        }
        process.exit(1);
    }
}

runEndToEndTest();
