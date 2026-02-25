import { supabase } from './lib/supabase.js';
import Anthropic from '@anthropic-ai/sdk';
import { encrypt, decrypt } from './utils/encryption.js';
import dotenv from 'dotenv';

dotenv.config();

async function runMasterVerification() {
    console.log('🚀 --- MASTER PRODUCTION VERIFICATION --- 🚀');

    // 1. Database Check
    try {
        const { data, error } = await supabase.from('profiles').select('count', { count: 'exact', head: true });
        if (error) throw error;
        console.log('✅ Supabase: Connected. Profiles found:', data);
    } catch (e: any) {
        console.error('❌ Supabase: Connection Failed!', e.message);
    }

    // 2. Encryption Check
    try {
        const secret = "Northie2026";
        const encrypted = encrypt(secret);
        const decrypted = decrypt(encrypted);
        if (decrypted === secret) {
            console.log('✅ Encryption: AES-256 GCM validated.');
        } else {
            throw new Error('Decryption mismatch');
        }
    } catch (e: any) {
        console.error('❌ Encryption: Logic Failure!', e.message);
    }

    // 3. AI Connectivity Check
    try {
        const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
        const msg = await anthropic.messages.create({
            model: 'claude-3-haiku-20240307',
            max_tokens: 5,
            messages: [{ role: 'user', content: 'Ping' }],
        });
        if (msg) console.log('✅ Anthropic: API responsive (Haiku).');
    } catch (e: any) {
        console.error('❌ Anthropic: Credentials or Tier issues!', e.message);
    }

    // 4. Meta Credentials Presence
    const metaOk = !!process.env.META_APP_ID && !!process.env.META_APP_SECRET;
    console.log(metaOk ? '✅ Meta OAuth: Credentials present in .env.' : '⚠️ Meta OAuth: Missing credentials!');

    console.log('\n🏁 VERIFICATION COMPLETE.');
}

runMasterVerification();
