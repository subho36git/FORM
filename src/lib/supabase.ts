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

if (!isSupabaseConfigured) {
  // Safe warning message: Never outputs the actual values
  console.warn(
    '[FORM] Supabase connection is currently unconfigured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env file to activate database and authentication features.'
  )
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
