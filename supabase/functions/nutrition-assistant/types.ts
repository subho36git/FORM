/**
 * Supabase Edge Function Types: nutrition-assistant
 */

export type MealCategory = 'breakfast' | 'lunch' | 'snack' | 'dinner'

export interface FoodItemPayload {
  food_name: string
  quantity: number
  unit: string
  calories: number
  protein_g: number
  carbs_g: number
  fat_g: number
  fiber_g?: number
  is_estimated: boolean
  notes?: string | null
}

export interface AssistantContext {
  localDate: string // YYYY-MM-DD
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
    meals: Array<{
      category: MealCategory
      items: Array<{
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
      }>
    }>
  }
}

export interface ChatMessagePayload {
  role: 'user' | 'assistant'
  content: string
}

export interface NutritionAssistantRequest {
  message: string
  history?: ChatMessagePayload[]
  context: AssistantContext
}

export interface ExecutedActionSummary {
  name: string
  success: boolean
  details?: Record<string, unknown>
  error?: string
}

export interface NutritionAssistantResponse {
  success: boolean
  reply: string
  actionsExecuted: ExecutedActionSummary[]
  dayData?: Record<string, unknown> | null
  error?: string | null
  needsApiKeyConfig?: boolean
  providerUsed?: 'gemini' | 'groq'
  failoverOccurred?: boolean
}
