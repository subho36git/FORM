/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string
  readonly BASE_PATH?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
