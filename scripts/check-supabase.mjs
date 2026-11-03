import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

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
let rawUrl = ''
let rawKey = ''

for (const line of lines) {
  const trimmed = line.trim()
  if (!trimmed || trimmed.startsWith('#')) continue

  const equalIndex = trimmed.indexOf('=')
  if (equalIndex === -1) continue

  const key = trimmed.slice(0, equalIndex).trim()
  const value = trimmed.slice(equalIndex + 1).trim()

  if (key === 'VITE_SUPABASE_URL') {
    if (value.length > 0 && !value.includes('your-project')) {
      hasUrl = true
      rawUrl = value
      try {
        const parsed = new URL(value)
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
      // Standard Supabase anon keys are JWTs or tokens of at least 30 characters
      if (value.length >= 20) {
        isKeyValidFormat = true
      }
    }
  }
}

// Safe reporting without displaying credentials
console.log(`• VITE_SUPABASE_URL:      ${hasUrl ? (isUrlValidFormat ? '✅ LOADED (Valid URL structure)' : '⚠️ LOADED (Malformed URL format)') : '❌ MISSING or EMPTY'}`)
console.log(`• VITE_SUPABASE_ANON_KEY: ${hasKey ? (isKeyValidFormat ? '✅ LOADED (Valid key structure)' : '⚠️ LOADED (Key appears unusually short)') : '❌ MISSING or EMPTY'}`)

console.log('\n----------------------------------------')

if (hasUrl && hasKey && isUrlValidFormat && isKeyValidFormat) {
  console.log('📡 Testing live connectivity to Supabase project...')
  try {
    const healthUrl = `${rawUrl.replace(/\/$/, '')}/auth/v1/health`
    const res = await fetch(healthUrl, {
      method: 'GET',
      headers: { apikey: rawKey },
    })

    if (res.ok || res.status === 200) {
      console.log('✅ Network Ping: CONNECTED (Supabase API responded successfully)')
      console.log('🎉 Result: All credentials loaded and verified. Ready for Phase 2!')
    } else {
      console.log(`⚠️ Network Ping: Responded with HTTP status ${res.status}. Check project status on supabase.com.`)
    }
  } catch (err) {
    console.log('ℹ️ Network Ping: Could not reach host (check internet connection or project URL).')
  }
} else {
  console.log('⚠️ Status: PENDING CREDENTIALS')
  console.log('   Add your credentials to .env to complete the setup.')
}

console.log('========================================\n')
