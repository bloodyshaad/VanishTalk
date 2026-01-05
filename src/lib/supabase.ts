import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl) {
    console.error('Available env vars:', Object.keys(import.meta.env))
    throw new Error('Missing VITE_SUPABASE_URL - please check Netlify environment variables')
}

if (!supabaseAnonKey) {
    console.error('Available env vars:', Object.keys(import.meta.env))
    throw new Error('Missing VITE_SUPABASE_ANON_KEY - please check Netlify environment variables')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
