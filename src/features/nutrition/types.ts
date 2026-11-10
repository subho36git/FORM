/**
 * Phase 6.3 Nutrition Types
 * Source of truth: supabase/migrations/007_nutrition_tracking.sql
 */

export type MealCategory = 'breakfast' | 'lunch' | 'snack' | 'dinner'

export type NutritionDayStatus = 'open' | 'closed'

/**
 * Database Entity: public.nutrition_days
 */
export interface DbNutritionDay {
  id: string
  user_id: string
  log_date: string // YYYY-MM-DD (local calendar date)
  status: NutritionDayStatus
  finalized_at: string | null
  created_at: string
  updated_at: string
}

/**
 * Database Entity: public.nutrition_meals
 */
export interface DbNutritionMeal {
  id: string
  user_id: string
  nutrition_day_id: string
  category: MealCategory
  meal_name: string | null
  logged_at: string
  sort_order: number
  created_at: string
  updated_at: string
}

/**
 * Database Entity: public.nutrition_food_items
 */
export interface DbNutritionFoodItem {
  id: string
  user_id: string
  meal_id: string
  food_name: string
  quantity: number
  unit: string
  calories: number
  protein_g: number
  carbs_g: number
  fat_g: number
  fiber_g: number
  is_estimated: boolean
  notes: string | null
  created_at: string
  updated_at: string
}

export type FoodItem = DbNutritionFoodItem

/**
 * Database Entity: public.saved_foods
 */
export interface DbSavedFood {
  id: string
  user_id: string
  name: string
  default_quantity: number
  default_unit: string
  calories: number
  protein_g: number
  carbs_g: number
  fat_g: number
  fiber_g: number
  created_at: string
  updated_at: string
}

/**
 * Database Entity: public.saved_recipes
 */
export interface DbSavedRecipe {
  id: string
  user_id: string
  name: string
  description: string | null
  servings: number
  created_at: string
  updated_at: string
}

/**
 * Database Entity: public.saved_recipe_items
 */
export interface DbSavedRecipeItem {
  id: string
  user_id: string
  recipe_id: string
  food_name: string
  quantity: number
  unit: string
  calories: number
  protein_g: number
  carbs_g: number
  fat_g: number
  fiber_g: number
  created_at: string
  updated_at: string
}

/**
 * Composite Saved Recipe with ingredients
 */
export interface SavedRecipeWithItems extends DbSavedRecipe {
  items: DbSavedRecipeItem[]
}

/**
 * Domain Model: Meal with its food items
 */
export interface NutritionMealWithItems extends DbNutritionMeal {
  items: DbNutritionFoodItem[]
}

/**
 * Domain Model: Complete day log
 */
export interface NutritionDayData {
  day: DbNutritionDay | null
  meals: NutritionMealWithItems[]
}

/**
 * Calculated aggregate totals from actual food items
 */
export interface DailyNutritionTotals {
  calories: number
  protein_g: number
  carbs_g: number
  fat_g: number
  fiber_g: number
}

/**
 * Payload for adding a food item
 */
export interface AddFoodItemPayload {
  category: MealCategory
  food_name: string
  quantity: number
  unit: string
  calories: number
  protein_g: number
  carbs_g: number
  fat_g: number
  fiber_g?: number
  is_estimated?: boolean
  notes?: string | null
  saveToSavedFoods?: boolean
}

/**
 * Legacy chat message type retained for UI compatibility
 */
export interface MealSummaryData {
  mealId: string
  category: MealCategory
  heading: string
  coachingObservation: string
  items?: DbNutritionFoodItem[]
}

export interface ChatMessage {
  id: string
  sender: 'user' | 'assistant'
  text?: string
  mealSummary?: MealSummaryData
  timestamp: string
  isSimulated?: boolean
}

/**
 * Local date utilities to prevent UTC day-shift bugs
 */
export function getLocalDateString(d: Date = new Date()): string {
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function parseLocalDate(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number)
  return new Date(year, month - 1, day)
}

export function formatDisplayDate(dateStr: string): string {
  const date = parseLocalDate(dateStr)
  const todayStr = getLocalDateString()

  const formatted = new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date)

  if (dateStr === todayStr) {
    return `Today • ${formatted}`
  }

  // Check yesterday
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  if (dateStr === getLocalDateString(yesterday)) {
    return `Yesterday • ${formatted}`
  }

  return formatted
}
