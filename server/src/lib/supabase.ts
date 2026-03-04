import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseUrl || !supabaseKey) {
    console.error('[Supabase] SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY não configuradas. Rotas que usam o banco vão falhar.');
}

// Inicialização lazy para não crashar o módulo inteiro quando env vars faltam
let _client: SupabaseClient | null = null;

export const supabase = new Proxy({} as SupabaseClient, {
    get(_target, prop) {
        if (!_client) {
            if (!supabaseUrl || !supabaseKey) {
                throw new Error('Supabase não configurado: SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são obrigatórias no Vercel.');
            }
            _client = createClient(supabaseUrl, supabaseKey);
        }
        return (_client as any)[prop];
    }
});
