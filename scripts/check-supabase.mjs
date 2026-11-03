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
let isModernPublishableKey = false
let isLegacyJwt = false
let rawUrl = ''
let rawKey = ''
let parsedUrlObj = null

for (const line of lines) {
  const trimmed = line.trim()
  if (!trimmed || trimmed.startsWith('#')) continue

  const equalIndex = trimmed.indexOf('=')
  if (equalIndex === -1) continue

  const key = trimmed.slice(0, equalIndex).trim()
  // Clean surrounding single or double quotes
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

      // Support both modern Supabase publishable keys and legacy JWT keys
      if (value.startsWith('sb_publishable_') || value.startsWith('sbp_')) {
        isModernPublishableKey = true
      } else if (value.startsWith('eyJ') && value.split('.').length === 3) {
        isLegacyJwt = true
      }
    }
  }
}

// Format status reporting without printing credentials
let keyFormatDescription = '❌ MISSING or EMPTY'
if (hasKey) {
  if (isModernPublishableKey) {
    keyFormatDescription = '✅ LOADED (Modern publishable key: sb_publishable_...)'
  } else if (isLegacyJwt) {
    keyFormatDescription = '✅ LOADED (Legacy anon JWT format)'
  } else if (rawKey.length >= 20) {
    keyFormatDescription = '✅ LOADED (Custom / Standard key format)'
  } else {
    keyFormatDescription = '⚠️ LOADED (Key appears unusually short)'
  }
}

console.log(`• VITE_SUPABASE_URL:      ${hasUrl ? (isUrlValidFormat ? '✅ LOADED (Valid URL format)' : '⚠️ LOADED (Malformed URL)') : '❌ MISSING or EMPTY'}`)
console.log(`• VITE_SUPABASE_ANON_KEY: ${keyFormatDescription}`)

// Check for subpath in VITE_SUPABASE_URL
let cleanBaseUrl = rawUrl.replace(/\/$/, '')
let hasSubpathNotice = false

if (parsedUrlObj) {
  if (parsedUrlObj.hostname === 'supabase.com' || parsedUrlObj.pathname.includes('/dashboard')) {
    console.log('\n⚠️  URL NOTICE: You have entered the Supabase Dashboard URL ("supabase.com/dashboard/...")')
    console.log('   Action: In your .env, use your Project URL instead (e.g. "https://[project-id].supabase.co").')
  } else if (parsedUrlObj.pathname !== '/' && parsedUrlObj.pathname !== '') {
    hasSubpathNotice = true
    console.log(`\n⚠️  URL NOTICE: Your VITE_SUPABASE_URL contains a subpath ("${parsedUrlObj.pathname}").`)
    console.log('   The Project URL should only be the base origin, e.g. "https://[project-id].supabase.co" without "/rest/v1/".')
    console.log('   The check will normalize to the clean origin for testing.')
    cleanBaseUrl = parsedUrlObj.origin
  }
}

console.log('\n----------------------------------------')

if (hasUrl && hasKey && isUrlValidFormat) {
  console.log('📡 Testing live connectivity via official @supabase/supabase-js client...')

  try {
    const client = createClient(cleanBaseUrl, rawKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    })

    // Probe the PostgREST database engine via official client
    const { error, status } = await client
      .from('_connection_probe')
      .select('*')
      .limit(0)

    console.log('----------------------------------------')

    // 1. Authentication Failure Check
    if (
      status === 401 ||
      status === 403 ||
      error?.code === 'PGRST301' ||
      error?.message?.toLowerCase().includes('jwt') ||
      error?.message?.toLowerCase().includes('apikey') ||
      error?.message?.toLowerCase().includes('invalid api key')
    ) {
      console.log(`❌ AUTHENTICATION ERROR (HTTP ${status || 401})`)
      console.log(`   Message: ${error?.message || 'The Anon Key was rejected by the Supabase project.'}`)
      console.log('\n   Guidance:')
      console.log('   • Go to your Supabase project -> Project Settings -> API.')
      console.log('   • Ensure you copied the public / anon key into VITE_SUPABASE_ANON_KEY.')
    }
    // 2. Project Host Not Found Check
    else if (status === 404 && (!error?.code || !error.code.startsWith('PGRST'))) {
      console.log('❌ PROJECT NOT FOUND (HTTP 404)')
      console.log('   The Supabase host returned 404. Verify the project reference in your URL.')
    }
    // 3. Project Paused / Service Unavailable
    else if (status === 502 || status === 503) {
      console.log(`⚠️ SERVICE UNAVAILABLE (HTTP ${status})`)
      console.log('   Your Supabase project might be paused. Visit supabase.com to wake it up.')
    }
    // 4. Genuine Database Response (PGRST205 / 42P01 / 200 OK)
    // PGRST205 indicates the PostgREST server authenticated the client and queried the schema cache.
    else if (
      status === 200 ||
      error?.code === 'PGRST205' ||
      error?.code === '42P01' ||
      (!error && status >= 200 && status < 300)
    ) {
      console.log('✅ DATABASE ENGINE CONNECTED & AUTHENTICATED')
      console.log(`   Server responded: ${error?.message || 'OK (HTTP ' + status + ')'}`)
      console.log('\n🎉 RESULT: Supabase is online, reachable, and authenticated!')

      if (hasSubpathNotice) {
        console.log('\n💡 Recommendation: Remove "/rest/v1/" from VITE_SUPABASE_URL in your .env so it matches standard format.')
      }
    }
    // 5. Other Unexpected Server Response
    else {
      console.log(`⚠️ UNEXPECTED RESPONSE (HTTP ${status || 'N/A'})`)
      console.log(`   Details: ${error?.message || 'Unknown response from server'}`)
    }
  } catch (err) {
    console.log('----------------------------------------')
    console.log(`❌ NETWORK FAILURE: ${err.code || err.message || 'Unable to connect to host'}`)
    console.log('   Guidance: Check your internet connection or verify that the Project URL is spelled correctly.')
  }
} else {
  console.log('⚠️ Status: PENDING CREDENTIALS')
  console.log('   Add your credentials to .env to complete the setup.')
}

console.log('========================================\n')
