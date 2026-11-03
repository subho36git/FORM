import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

/**
 * Validation check: reports whether Supabase environment variables
 * are set and non-empty, without exposing or printing their actual values.
 */
export const isSupabaseConfigured: boolean = Boolean(
  supabaseUrl &&
  supabaseAnonKey &&
  supabaseUrl.trim().length > 0 &&
  supabaseAnonKey.trim().length > 0 &&
  !supabaseUrl.includes('your-project')
)

export interface SupabaseConfigStatus {
  hasUrl: boolean
  hasAnonKey: boolean
  isReady: boolean
}

export const getSupabaseConfigStatus = (): SupabaseConfigStatus => ({
  hasUrl: Boolean(supabaseUrl && supabaseUrl.trim().length > 0 && !supabaseUrl.includes('your-project')),
  hasAnonKey: Boolean(supabaseAnonKey && supabaseAnonKey.trim().length > 0 && !supabaseAnonKey.includes('your-anon-key')),
  isReady: isSupabaseConfigured,
})

// Safe diagnostic check: reports status in the browser console without displaying credentials
if (typeof window !== 'undefined') {
  const status = getSupabaseConfigStatus()
  if (status.isReady) {
    console.log(
      '%c[FORM • Supabase Check]%c ✅ VITE_SUPABASE_URL: Loaded | ✅ VITE_SUPABASE_ANON_KEY: Loaded (Status: Ready)',
      'color: #10B981; font-weight: bold;',
      'color: inherit;'
    )
  } else {
    console.warn(
      `[FORM • Supabase Check] VITE_SUPABASE_URL: ${status.hasUrl ? 'LOADED' : 'MISSING'} | VITE_SUPABASE_ANON_KEY: ${status.hasAnonKey ? 'LOADED' : 'MISSING'}`
    )
  }
}

// Safe fallback URL structure ensures the client can be instantiated
// without throwing a runtime constructor error when keys are pending.
const clientUrl = isSupabaseConfigured ? supabaseUrl : 'https://placeholder.supabase.co'
const clientKey = isSupabaseConfigured ? supabaseAnonKey : 'placeholder-key'

export const supabase = createClient(clientUrl, clientKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
})
