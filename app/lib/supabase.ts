import type { SupabaseClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

// Accounts are optional: without these env vars the site runs fully local (patches live in localStorage)
export const authEnabled = Boolean(url && key)

let clientPromise: Promise<SupabaseClient> | null = null

// supabase-js is ~70 kB, so it is only downloaded once someone signs in or already has a session
export function loadSupabase(): Promise<SupabaseClient> {
  if (!authEnabled || typeof window === 'undefined') return Promise.reject(new Error('Accounts are not configured'))
  clientPromise ??= import('@supabase/supabase-js').then(({ createClient }) => createClient(url!, key!, {
    auth: { flowType: 'pkce', persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
  }))
  return clientPromise
}

export function hasStoredSession() {
  try {
    return Object.keys(localStorage).some(k => k.startsWith('sb-') && k.endsWith('-auth-token'))
  } catch { return false }
}
