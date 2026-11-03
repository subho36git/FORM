import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { createClient } from '@supabase/supabase-js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const envPath = path.resolve(__dirname, '../.env')

console.log('\n========================================')
console.log('   FORM • Supabase Configuration Check  ')
console.log('========================================\n')

if (!fs.existsSync(envPath)) {
  console.log('❌ .env file status: NOT FOUND')
  console.log('   Please create a .env file in the project root.\n')
  process.exit(1)
}

console.log('✅ .env file status: FOUND')

const envContent = fs.readFileSync(envPath, 'utf8')
const lines = envContent.split('\n')

let hasUrl = false
let isUrlValidFormat = false
let hasKey = false
let isKeyValidFormat = false
let isJwtFormat = false
let rawUrl = ''
let rawKey = ''
let parsedUrlObj = null

for (const line of lines) {
  const trimmed = line.trim()
  if (!trimmed || trimmed.startsWith('#')) continue

  const equalIndex = trimmed.indexOf('=')
  if (equalIndex === -1) continue

  const key = trimmed.slice(0, equalIndex).trim()
  // Strip any wrapping single or double quotes
  const value = trimmed.slice(equalIndex + 1).trim().replace(/^['"]|['"]$/g, '')

  if (key === 'VITE_SUPABASE_URL') {
    if (value.length > 0 && !value.includes('your-project')) {
      hasUrl = true
      rawUrl = value
      try {
        const parsed = new URL(value)
        parsedUrlObj = parsed
        if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
          isUrlValidFormat = true
        }
      } catch {
        isUrlValidFormat = false
      }
    }
  }

  if (key === 'VITE_SUPABASE_ANON_KEY') {
    if (value.length > 0 && !value.includes('your-anon-key')) {
      hasKey = true
      rawKey = value
      if (value.length >= 20) {
        isKeyValidFormat = true
      }
      // Standard Supabase Anon keys are 3-part JWT tokens (header.payload.signature)
      if (value.split('.').length === 3) {
        isJwtFormat = true
      }
    }
  }
}

// 1. Report loaded status without printing credential values
console.log(`• VITE_SUPABASE_URL:      ${hasUrl ? (isUrlValidFormat ? '✅ LOADED (Valid URL format)' : '⚠️ LOADED (Malformed URL)') : '❌ MISSING or EMPTY'}`)
console.log(`• VITE_SUPABASE_ANON_KEY: ${hasKey ? (isKeyValidFormat ? (isJwtFormat ? '✅ LOADED (Valid JWT format)' : '⚠️ LOADED (Not a 3-part JWT token)') : '⚠️ LOADED (Key unusually short)') : '❌ MISSING or EMPTY'}`)

// 2. Identify and report common URL configuration mistakes
let cleanBaseUrl = rawUrl.replace(/\/$/, '')
let hasSubpathIssue = false

if (parsedUrlObj) {
  if (parsedUrlObj.hostname === 'supabase.com' || parsedUrlObj.pathname.includes('/dashboard')) {
    console.log('\n⚠️  URL NOTICE: You have entered the Supabase Dashboard URL ("supabase.com/dashboard/...")')
    console.log('   Action needed: In your .env, use your Project URL instead (e.g. "https://[project-id].supabase.co").')
  } else if (parsedUrlObj.pathname !== '/' && parsedUrlObj.pathname !== '') {
    hasSubpathIssue = true
    console.log(`\n⚠️  URL NOTICE: Your VITE_SUPABASE_URL contains a subpath ("${parsedUrlObj.pathname}").`)
    console.log('   The Project URL must ONLY be the base origin, e.g. "https://[project-id].supabase.co" without "/rest/v1" or other paths.')
    console.log('   The check will automatically test against the clean base origin.')
    cleanBaseUrl = parsedUrlObj.origin
  }
}

if (hasKey && !isJwtFormat) {
  console.log('\n⚠️  ANON KEY NOTICE: Your VITE_SUPABASE_ANON_KEY does not appear to be a standard JWT token.')
  console.log('   Make sure you copied the "anon" public key (starts with "eyJ...") from:')
  console.log('   Supabase Dashboard -> Settings -> API -> Project API Keys -> "anon public".')
  console.log('   (Do not use your database password or secret service_role key).\n')
}

console.log('\n----------------------------------------')

if (hasUrl && hasKey && isUrlValidFormat && isKeyValidFormat) {
  console.log('📡 Testing live connectivity to Supabase project...')

  let isConnected = false
  let failureReason = null

  // Test 1: Query database engine via official @supabase/supabase-js client
  try {
    const client = createClient(cleanBaseUrl, rawKey)
    // Probe database with limit 0
    const { error } = await client.from('_probe_connection').select('*').limit(0)

    if (!error) {
      console.log('✅ [Database Engine]: Connected and query executed successfully.')
      isConnected = true
    } else if (error.code === '42P01' || error.message?.includes('does not exist')) {
      // Postgres error 42P01 = "undefined_table". This proves authentication succeeded!
      console.log('✅ [Database Engine]: Connected and authenticated (PostgreSQL engine is online).')
      isConnected = true
    } else if (error.code === 'PGRST301' || error.message?.includes('JWT') || error.message?.includes('apikey')) {
      console.log(`❌ [Database Engine]: Authentication Rejected (${error.message}). The Anon Key was rejected.`)
      failureReason = 'auth_rejected'
    } else {
      console.log(`ℹ️ [Database Engine Response]: ${error.message} (Code: ${error.code || 'N/A'})`)
      // If server responded with any application-level message, it reached Supabase
      if (error.code) isConnected = true
    }
  } catch (err) {
    console.log(`❌ [Database Engine]: Connection error (${err.message})`)
    failureReason = 'network_error'
  }

  // Test 2: Check REST API endpoint directly with fetch
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 6000)

    const res = await fetch(`${cleanBaseUrl}/rest/v1/`, {
      method: 'GET',
      headers: {
        apikey: rawKey,
        Authorization: `Bearer ${rawKey}`,
      },
      signal: controller.signal,
    })
    clearTimeout(timeoutId)

    if (res.ok || (res.status >= 200 && res.status < 300)) {
      console.log(`✅ [REST Gateway]: Connected (HTTP ${res.status} OK)`)
      isConnected = true
    } else if (res.status === 401 || res.status === 403) {
      console.log(`❌ [REST Gateway]: Authentication Error (HTTP ${res.status}).`)
      if (!failureReason) failureReason = 'auth_rejected'
    } else if (res.status === 404) {
      console.log(`❌ [REST Gateway]: HTTP 404 Not Found. The project URL may not exist.`)
      if (!failureReason) failureReason = 'url_not_found'
    } else {
      console.log(`⚠️ [REST Gateway]: HTTP ${res.status}`)
    }
  } catch (err) {
    if (err.name === 'AbortError') {
      console.log('❌ [REST Gateway]: Connection timed out (> 6s).')
      if (!failureReason) failureReason = 'timeout'
    } else {
      console.log(`❌ [REST Gateway]: Network unreachable (${err.code || err.message}).`)
      if (!failureReason) failureReason = 'network_error'
    }
  }

  console.log('----------------------------------------')

  if (isConnected) {
    console.log('🎉 RESULT: Supabase is online, reachable, and authenticated!')
    if (hasSubpathIssue) {
      console.log('\n💡 RECOMMENDATION: To prevent issues in the React app, please edit your .env file:')
      console.log('   Change VITE_SUPABASE_URL to just the base URL (without /rest/v1/).')
    } else {
      console.log('   All credentials are valid and ready for Phase 2.')
    }
  } else {
    console.log('⚠️ RESULT: Connectivity check failed.')
    if (failureReason === 'auth_rejected') {
      console.log('   Guidance: The Project URL is valid, but the Anon Key was rejected by Supabase.')
      console.log('   1. Go to your project on supabase.com.')
      console.log('   2. Navigate to Project Settings -> API.')
      console.log('   3. Under "Project API Keys", copy the "anon" public key (not service_role or DB password).')
      console.log('   4. Paste it as VITE_SUPABASE_ANON_KEY in your .env file.')
    } else if (failureReason === 'url_not_found') {
      console.log('   Guidance: The project URL returned 404.')
      console.log('   Verify that your Project URL in Project Settings -> API matches: https://[project-id].supabase.co')
    } else if (failureReason === 'network_error' || failureReason === 'timeout') {
      console.log('   Guidance: Check your internet connection or verify DNS resolution.')
    }
  }
} else {
  console.log('⚠️ Status: PENDING CREDENTIALS')
  console.log('   Add your credentials to .env to complete the setup.')
}

console.log('========================================\n')
