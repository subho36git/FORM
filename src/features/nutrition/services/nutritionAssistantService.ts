/**
 * Frontend Nutrition Assistant Service
 * Invokes the `nutrition-assistant` Supabase Edge Function with user JWT
 */

import { supabase } from '@/lib/supabase'
import type { MealCategory } from '../types'

export interface AssistantFoodItemContext {
  id: string
  food_name: string
  quantity: number
  unit: string
  calories: number
  protein_g: number
  carbs_g: number
  fat_g: number
  fiber_g: number
  is_estimated: boolean
}

export interface AssistantMealContext {
  category: MealCategory
  items: AssistantFoodItemContext[]
}

export interface AssistantContextPayload {
  localDate: string
  userProfile?: {
    goal?: string
    currentWeightKg?: number
    goalWeightKg?: number
    dailyCalorieTarget?: number
    proteinTargetG?: number
    carbsTargetG?: number
    fatTargetG?: number
  }
  todaySummary?: {
    calories: number
    protein_g: number
    carbs_g: number
    fat_g: number
    fiber_g: number
    meals: AssistantMealContext[]
  }
}

export interface AssistantChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: string
  actionsExecuted?: Array<{
    name: string
    success: boolean
    details?: Record<string, unknown>
    error?: string
  }>
  providerUsed?: 'gemini' | 'groq'
  failoverOccurred?: boolean
  isError?: boolean
}

export interface SendAssistantMessageParams {
  message: string
  history?: Array<{ role: 'user' | 'assistant'; content: string }>
  context: AssistantContextPayload
}

export interface SendAssistantMessageResult {
  success: boolean
  reply: string
  actionsExecuted: Array<{
    name: string
    success: boolean
    details?: Record<string, unknown>
    error?: string
  }>
  dayData?: Record<string, unknown> | null
  needsApiKeyConfig?: boolean
  providerUsed?: 'gemini' | 'groq'
  failoverOccurred?: boolean
  error?: string | null
}

export const nutritionAssistantService = {
  /**
   * Sends user message and contextual daily info to the nutrition-assistant Edge Function.
   */
  async sendMessage(params: SendAssistantMessageParams): Promise<SendAssistantMessageResult> {
    const { data: sessionData } = await supabase.auth.getSession()
    if (!sessionData.session) {
      throw new Error('You must be signed in to use the AI Nutrition Assistant.')
    }

    const { data, error } = await supabase.functions.invoke('nutrition-assistant', {
      body: {
        message: params.message,
        history: params.history || [],
        context: params.context,
      },
    })

    if (error) {
      console.error('[NutritionAssistantService] Edge function invoke error:', error)
      // Check if function isn't deployed or returned HTTP error
      const errorMsg = error.message || 'Failed to contact AI Nutrition Assistant.'
      if (errorMsg.includes('404') || errorMsg.includes('Failed to send a request')) {
        return {
          success: false,
          reply:
            '⚠️ **Edge Function Setup Notice**\n\nThe `nutrition-assistant` Supabase Edge Function is not yet deployed to your project.\n\nPlease deploy it using Supabase CLI:\n```bash\nsupabase functions deploy nutrition-assistant\n```\nAnd configure `GEMINI_API_KEY` (and optionally `GROQ_API_KEY` for failover) in your Supabase Secrets.',
          actionsExecuted: [],
          error: errorMsg,
        }
      }
      throw new Error(errorMsg)
    }

    if (!data) {
      throw new Error('Empty response received from nutrition assistant.')
    }

    return {
      success: data.success ?? true,
      reply: data.reply || '',
      actionsExecuted: data.actionsExecuted || [],
      dayData: data.dayData || null,
      needsApiKeyConfig: Boolean(data.needsApiKeyConfig),
      providerUsed: data.providerUsed,
      failoverOccurred: data.failoverOccurred,
      error: data.error || null,
    }
  },
}
