import { createClient } from '@supabase/supabase-js'

const getEnv = (key: string, fallback: string) => {
    const val = (import.meta as any).env[key]
    if (!val || val === 'undefined' || val === 'null' || val === '') return fallback
    return val
}

const supabaseUrl = getEnv('VITE_SUPABASE_URL', 'https://ucwlgqowqpfmotcofqoz.supabase.co')
const supabaseAnonKey = getEnv('VITE_SUPABASE_ANON_KEY', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVjd2xncW93cXBmbW90Y29mcW96Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE4ODUzNDAsImV4cCI6MjA4NzQ2MTM0MH0.ZQyufllPRs5ByRkR9G4Xi8HQr72390scbfZ6FDqzAW4')

// Use standard initialization to avoid protocol conflicts
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
    }
})
