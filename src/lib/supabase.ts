import { createClient } from '@supabase/supabase-js'

const supabaseUrl = (import.meta as any).env.VITE_SUPABASE_URL || 'https://ucwlgqowqpfmotcofqoz.supabase.co'
const supabaseAnonKey = (import.meta as any).env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVjd2xncW93cXBmbW90Y29mcW96Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE4ODUzNDAsImV4cCI6MjA4NzQ2MTM0MH0.ZQyufllPRs5ByRkR9G4Xi8HQr72390scbfZ6FDqzAW4'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
