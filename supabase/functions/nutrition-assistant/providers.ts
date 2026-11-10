/**
 * Multi-Provider AI Orchestrator with Free-Tier Failover
 * Supabase Edge Function: nutrition-assistant
 * 
 * Primary: Google Gemini API (gemini-3.5-flash-lite)
 * Backup:  Groq API (openai/gpt-oss-20b)
 * 
 * Strictly free-only. No OpenAI paid tier. No paid Groq tier.
 */

// deno-lint-ignore-file no-explicit-any
import { callGemini } from './gemini.ts'
import { callGroq } from './groq.ts'
import type { ChatMessagePayload } from './types.ts'

export type AIProviderName = 'gemini' | 'groq'

export interface UnifiedAIResponse {
  text?: string
  functionCalls?: Array<{
    name: string
    args: Record<string, unknown>
  }>
  providerUsed: AIProviderName
  failoverOccurred: boolean
}

export interface CallAIParams {
  systemPrompt: string
  history?: ChatMessagePayload[]
  userMessage?: string
  toolResult?: {
    toolName: string
    result: unknown
  }
  simulateGeminiFailure?: boolean
}

// In-memory provider monitoring & tracking
export const providerMetrics = {
  geminiAttempts: 0,
  geminiSuccesses: 0,
  geminiFailures: 0,
  groqAttempts: 0,
  groqSuccesses: 0,
  groqFailures: 0,
  failoverCount: 0,
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export function isTransientError(err: unknown): boolean {
  if (err instanceof Error) {
    if ((err as any).isTransient === false) return false
    if ((err as any).isTransient === true) return true
    if (err.name === 'AbortError') return true
    const msg = err.message.toLowerCase()
    if (
      msg.includes('fetch') ||
      msg.includes('timeout') ||
      msg.includes('network') ||
      msg.includes('rate_limit') ||
      msg.includes('resource_exhausted') ||
      msg.includes('quota') ||
      msg.includes('503') ||
      msg.includes('502') ||
      msg.includes('504') ||
      msg.includes('500')
    ) {
      return true
    }
    const status = (err as any).status
    if (status && [429, 500, 502, 503, 504].includes(status)) return true
  }
  return false
}

/**
 * Execute AI request with automatic transient failover from Gemini to Groq.
 * 
 * Safety invariants:
 * - Attempt Gemini first.
 * - Retry Gemini on transient errors with exponential backoff (max 2 attempts).
 * - If Gemini fails non-transiently (e.g. invalid API key), DO NOT fail over; throw immediately.
 * - If Gemini remains unavailable transiently, invoke Groq.
 * - If Groq fails transiently, retry once with backoff.
 * - If both fail, throw ALL_PROVIDERS_UNAVAILABLE.
 * - Note: This function only interacts with the AI providers. It NEVER executes database writes!
 */
export async function executeWithFailover(params: CallAIParams): Promise<UnifiedAIResponse> {
  const geminiApiKey = Deno.env.get('GEMINI_API_KEY')?.trim()
  const groqApiKey = Deno.env.get('GROQ_API_KEY')?.trim()

  if (!geminiApiKey) {
    const err = new Error('GEMINI_API_KEY_MISSING')
    ;(err as any).isTransient = false
    throw err
  }

  // --- STEP 1: Attempt Primary Provider (Gemini) ---
  let geminiTransientError: Error | null = null

  for (let attempt = 1; attempt <= 2; attempt++) {
    providerMetrics.geminiAttempts++
    try {
      if (params.simulateGeminiFailure) {
        console.warn(`[AI Orchestrator] [Diagnostic Test] Simulating Gemini HTTP 503 error on attempt ${attempt}/2`)
        const simErr = new Error('Simulated Gemini 503 Service Unavailable (Failover Diagnostic Test)')
        ;(simErr as any).status = 503
        ;(simErr as any).isTransient = true
        throw simErr
      }

      const res = await callGemini({
        apiKey: geminiApiKey,
        systemPrompt: params.systemPrompt,
        history: params.history,
        userMessage: params.userMessage,
        toolResult: params.toolResult,
      })
      providerMetrics.geminiSuccesses++
      return {
        text: res.text,
        functionCalls: res.functionCalls,
        providerUsed: 'gemini',
        failoverOccurred: false,
      }
    } catch (err: unknown) {
      providerMetrics.geminiFailures++
      const error = err instanceof Error ? err : new Error(String(err))

      // Non-transient errors (invalid API key, auth, bad request) MUST NOT failover
      if (!isTransientError(error)) {
        console.error(`[AI Orchestrator] Gemini failed non-transiently: ${error.message}. Halting without failover.`)
        throw error
      }

      geminiTransientError = error
      console.warn(`[AI Orchestrator] Gemini attempt ${attempt}/2 encountered transient error: ${error.message}`)

      if (attempt < 2) {
        // Exponential backoff before retry (500ms)
        await sleep(500 * attempt)
      }
    }
  }

  // --- STEP 2: Gemini Failed Transiently -> Failover to Backup Provider (Groq) ---
  providerMetrics.failoverCount++
  console.warn(
    `[AI Orchestrator] [Failover Event #${providerMetrics.failoverCount}] Primary provider Gemini is temporarily unavailable (${geminiTransientError?.message}). Failing over to Groq...`
  )

  if (!groqApiKey) {
    console.error('[AI Orchestrator] Groq backup key (GROQ_API_KEY) is not configured in Supabase secrets.')
    const backupMissingErr = new Error('PRIMARY_UNAVAILABLE_BACKUP_NOT_CONFIGURED')
    ;(backupMissingErr as any).status = 503
    throw backupMissingErr
  }

  let groqTransientError: Error | null = null

  for (let attempt = 1; attempt <= 2; attempt++) {
    providerMetrics.groqAttempts++
    try {
      const res = await callGroq({
        apiKey: groqApiKey,
        systemPrompt: params.systemPrompt,
        history: params.history,
        userMessage: params.userMessage,
        toolResult: params.toolResult,
      })
      providerMetrics.groqSuccesses++
      console.info(
        `[AI Orchestrator] Groq backup successfully handled request on attempt ${attempt}. Failover count: ${providerMetrics.failoverCount}`
      )
      return {
        text: res.text,
        functionCalls: res.functionCalls,
        providerUsed: 'groq',
        failoverOccurred: true,
      }
    } catch (err: unknown) {
      providerMetrics.groqFailures++
      const error = err instanceof Error ? err : new Error(String(err))

      if (!isTransientError(error)) {
        console.error(`[AI Orchestrator] Groq failed non-transiently: ${error.message}`)
        throw error
      }

      groqTransientError = error
      console.warn(`[AI Orchestrator] Groq attempt ${attempt}/2 failed transiently: ${error.message}`)

      if (attempt < 2) {
        await sleep(500 * attempt)
      }
    }
  }

  // --- STEP 3: Both Providers Failed ---
  console.error(
    `[AI Orchestrator] Both providers failed. Gemini: ${geminiTransientError?.message} | Groq: ${groqTransientError?.message}`
  )
  const allFailedErr = new Error('ALL_PROVIDERS_UNAVAILABLE')
  ;(allFailedErr as any).status = 503
  throw allFailedErr
}
