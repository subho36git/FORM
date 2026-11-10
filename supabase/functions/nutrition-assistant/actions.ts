/**
 * Action Validators & Database Executor
 * Supabase Edge Function: nutrition-assistant
 * 
 * Uses a user-scoped Supabase client respecting Row Level Security (RLS).
 */

// deno-lint-ignore-file no-explicit-any
import type { MealCategory, FoodItemPayload } from './types.ts'

export interface ActionExecutionResult {
  success: boolean
  message: string
  data?: Record<string, unknown>
  error?: string
}

function getDefaultSortOrder(category: MealCategory): number {
  switch (category) {
    case 'breakfast':
      return 10
    case 'lunch':
      return 20
    case 'snack':
      return 30
    case 'dinner':
      return 40
    default:
      return 50
  }
}

export class ActionExecutor {
  private supabase: any
  private userId: string
  private defaultDate: string

  constructor(supabaseClient: any, userId: string, defaultDate: string) {
    this.supabase = supabaseClient
    this.userId = userId
    this.defaultDate = defaultDate
  }

  // 1. LOG MEAL
  async executeLogMeal(args: {
    category: string
    items: FoodItemPayload[]
    log_date?: string
    meal_name?: string
  }): Promise<ActionExecutionResult> {
    const validCategories: MealCategory[] = ['breakfast', 'lunch', 'snack', 'dinner']
    const category = args.category?.toLowerCase() as MealCategory
    if (!validCategories.includes(category)) {
      return { success: false, message: `Invalid meal category: ${args.category}` }
    }

    if (!Array.isArray(args.items) || args.items.length === 0) {
      return { success: false, message: 'No food items provided in meal.' }
    }

    const logDate = args.log_date || this.defaultDate

    // Validate each food item
    const validatedItems: Array<{
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
    }> = []

    for (const item of args.items) {
      if (!item.food_name || !item.food_name.trim()) {
        return { success: false, message: 'Food item missing name.' }
      }
      const qty = Math.max(0.01, Number(item.quantity) || 1)
      const cal = Math.max(0, Math.round(Number(item.calories) || 0))
      const p = Math.max(0, Math.round((Number(item.protein_g) || 0) * 10) / 10)
      const c = Math.max(0, Math.round((Number(item.carbs_g) || 0) * 10) / 10)
      const f = Math.max(0, Math.round((Number(item.fat_g) || 0) * 10) / 10)
      const fiber = Math.max(0, Math.round((Number(item.fiber_g) || 0) * 10) / 10)

      validatedItems.push({
        food_name: item.food_name.trim(),
        quantity: qty,
        unit: (item.unit || 'g').trim(),
        calories: cal,
        protein_g: p,
        carbs_g: c,
        fat_g: f,
        fiber_g: fiber,
        is_estimated: Boolean(item.is_estimated),
        notes: item.notes ? item.notes.trim() : null,
      })
    }

    // A. Find or create nutrition_days
    let dayId: string
    const { data: existingDay } = await this.supabase
      .from('nutrition_days')
      .select('id, status')
      .eq('user_id', this.userId)
      .eq('log_date', logDate)
      .maybeSingle()

    if (existingDay) {
      if (existingDay.status === 'closed') {
        return {
          success: false,
          message: `The nutrition log for ${logDate} is finalized and closed. Please ask the user to reopen it before logging food.`,
        }
      }
      dayId = existingDay.id
    } else {
      const { data: newDay, error: createDayError } = await this.supabase
        .from('nutrition_days')
        .insert({
          user_id: this.userId,
          log_date: logDate,
          status: 'open',
        })
        .select('id')
        .single()

      if (createDayError) {
        return { success: false, message: `Failed to create daily log: ${createDayError.message}` }
      }
      dayId = newDay.id
    }

    // B. Find or create nutrition_meals
    let mealId: string
    const { data: existingMeal } = await this.supabase
      .from('nutrition_meals')
      .select('id')
      .eq('nutrition_day_id', dayId)
      .eq('user_id', this.userId)
      .eq('category', category)
      .maybeSingle()

    if (existingMeal) {
      mealId = existingMeal.id
    } else {
      const { data: newMeal, error: createMealError } = await this.supabase
        .from('nutrition_meals')
        .insert({
          user_id: this.userId,
          nutrition_day_id: dayId,
          category,
          meal_name: args.meal_name ? args.meal_name.trim() : null,
          sort_order: getDefaultSortOrder(category),
        })
        .select('id')
        .single()

      if (createMealError) {
        return { success: false, message: `Failed to create meal: ${createMealError.message}` }
      }
      mealId = newMeal.id
    }

    // C. Insert items into nutrition_food_items
    const rowsToInsert = validatedItems.map((item) => ({
      ...item,
      user_id: this.userId,
      meal_id: mealId,
    }))

    const { data: insertedItems, error: insertError } = await this.supabase
      .from('nutrition_food_items')
      .insert(rowsToInsert)
      .select('*')

    if (insertError) {
      return { success: false, message: `Failed to insert food items: ${insertError.message}` }
    }

    // D. Fetch updated day summary
    const updatedDay = await this.fetchDaySummary(logDate)

    return {
      success: true,
      message: `Successfully logged ${validatedItems.length} item(s) to ${category}.`,
      data: {
        category,
        insertedItems,
        daySummary: updatedDay,
      },
    }
  }

  // 2. UPDATE ITEM (Incremental corrections)
  async executeUpdateItem(args: {
    item_id?: string
    food_name?: string
    meal_category?: string
    updates: Record<string, any>
  }): Promise<ActionExecutionResult> {
    let itemId = args.item_id
    let currentMealId: string | null = null

    // Fetch today's day record
    const { data: day } = await this.supabase
      .from('nutrition_days')
      .select('id')
      .eq('user_id', this.userId)
      .eq('log_date', this.defaultDate)
      .maybeSingle()

    if (!day) {
      return {
        success: false,
        message: `No logged meals found for ${this.defaultDate} to update.`,
      }
    }

    const { meals, items } = await this.getDayMealsAndItems(day.id)

    // If item_id not provided, search by food_name in today's items
    if (!itemId && args.food_name) {
      const targetQuery = args.food_name.trim().toLowerCase()
      let matchedItems = items.filter((item: any) =>
        item.food_name.toLowerCase().includes(targetQuery)
      )

      // Filter by meal category if supplied
      if (args.meal_category) {
        const categoryMealIds = new Set(
          meals.filter((m: any) => m.category === args.meal_category).map((m: any) => m.id)
        )
        matchedItems = matchedItems.filter((i: any) => categoryMealIds.has(i.meal_id))
      }

      if (matchedItems.length === 0) {
        return {
          success: false,
          message: `No food matching "${args.food_name}" was found in today's meals to update.`,
        }
      }

      if (matchedItems.length > 1) {
        const names = matchedItems
          .map((f: any) => {
            const parent = meals.find((m: any) => m.id === f.meal_id)
            return `"${f.food_name}" (${parent?.category || 'meal'})`
          })
          .join(', ')
        return {
          success: false,
          message: `Multiple matching items found: ${names}. Please specify which meal or exact food name to update.`,
        }
      }

      itemId = matchedItems[0].id
      currentMealId = matchedItems[0].meal_id
    } else if (itemId) {
      const existing = items.find((i: any) => i.id === itemId)
      if (!existing) {
        return {
          success: false,
          message: `Food item with ID ${itemId} was not found in today's meals.`,
        }
      }
      currentMealId = existing.meal_id
    }

    if (!itemId) {
      return { success: false, message: 'Please provide either an item_id or a matching food_name to update.' }
    }

    const { updates } = args
    const payloadToUpdate: Record<string, any> = {}

    if (updates.food_name !== undefined) payloadToUpdate.food_name = String(updates.food_name).trim()
    if (updates.quantity !== undefined) payloadToUpdate.quantity = Math.max(0.01, Number(updates.quantity) || 1)
    if (updates.unit !== undefined) payloadToUpdate.unit = String(updates.unit).trim()
    if (updates.calories !== undefined) payloadToUpdate.calories = Math.max(0, Math.round(Number(updates.calories) || 0))
    if (updates.protein_g !== undefined) payloadToUpdate.protein_g = Math.max(0, Math.round((Number(updates.protein_g) || 0) * 10) / 10)
    if (updates.carbs_g !== undefined) payloadToUpdate.carbs_g = Math.max(0, Math.round((Number(updates.carbs_g) || 0) * 10) / 10)
    if (updates.fat_g !== undefined) payloadToUpdate.fat_g = Math.max(0, Math.round((Number(updates.fat_g) || 0) * 10) / 10)
    if (updates.fiber_g !== undefined) payloadToUpdate.fiber_g = Math.max(0, Math.round((Number(updates.fiber_g) || 0) * 10) / 10)
    if (updates.is_estimated !== undefined) payloadToUpdate.is_estimated = Boolean(updates.is_estimated)
    if (updates.notes !== undefined) payloadToUpdate.notes = updates.notes ? String(updates.notes).trim() : null

    // If moving item to another meal category
    if (updates.target_meal_category) {
      const targetCategory = updates.target_meal_category.toLowerCase() as MealCategory
      let targetMealId: string
      const targetMeal = meals.find((m: any) => m.category === targetCategory)

      if (targetMeal) {
        targetMealId = targetMeal.id
      } else {
        const { data: newMeal, error: newMealError } = await this.supabase
          .from('nutrition_meals')
          .insert({
            user_id: this.userId,
            nutrition_day_id: day.id,
            category: targetCategory,
            sort_order: getDefaultSortOrder(targetCategory),
          })
          .select('id')
          .single()

        if (newMealError || !newMeal) {
          return { success: false, message: `Failed to create target meal: ${newMealError?.message}` }
        }
        targetMealId = newMeal.id
      }

      payloadToUpdate.meal_id = targetMealId
    }

    const { data: updatedItem, error: updateError } = await this.supabase
      .from('nutrition_food_items')
      .update(payloadToUpdate)
      .eq('id', itemId)
      .eq('user_id', this.userId)
      .select('*')
      .single()

    if (updateError) {
      return { success: false, message: `Failed to update food item: ${updateError.message}` }
    }

    // If item was moved to another meal, check if original meal is now empty and delete if so
    if (updates.target_meal_category && currentMealId && payloadToUpdate.meal_id !== currentMealId) {
      const { count } = await this.supabase
        .from('nutrition_food_items')
        .select('id', { count: 'exact', head: true })
        .eq('meal_id', currentMealId)
        .eq('user_id', this.userId)

      if (count === 0) {
        await this.supabase.from('nutrition_meals').delete().eq('id', currentMealId).eq('user_id', this.userId)
      }
    }

    const updatedDay = await this.fetchDaySummary(this.defaultDate)

    return {
      success: true,
      message: `Updated item "${updatedItem.food_name}" successfully.`,
      data: {
        updatedItem,
        daySummary: updatedDay,
      },
    }
  }

  // 3. DELETE ITEM
  async executeDeleteItem(args: {
    item_id?: string
    food_name?: string
    meal_category?: string
  }): Promise<ActionExecutionResult> {
    let itemId = args.item_id
    let mealId: string | null = null

    // Fetch today's day record
    const { data: day } = await this.supabase
      .from('nutrition_days')
      .select('id')
      .eq('user_id', this.userId)
      .eq('log_date', this.defaultDate)
      .maybeSingle()

    if (!day) {
      return {
        success: false,
        message: `No food diary found for today (${this.defaultDate}) to delete from.`,
      }
    }

    const { meals, items } = await this.getDayMealsAndItems(day.id)

    if (!itemId && args.food_name) {
      const targetQuery = args.food_name.trim().toLowerCase()
      let matchedItems = items.filter((item: any) =>
        item.food_name.toLowerCase().includes(targetQuery)
      )

      if (args.meal_category) {
        const categoryMealIds = new Set(
          meals.filter((m: any) => m.category === args.meal_category).map((m: any) => m.id)
        )
        matchedItems = matchedItems.filter((i: any) => categoryMealIds.has(i.meal_id))
      }

      if (matchedItems.length === 0) {
        return {
          success: false,
          message: `No food item matching "${args.food_name}" was found to delete.`,
        }
      }

      if (matchedItems.length > 1) {
        const names = matchedItems
          .map((f: any) => {
            const parent = meals.find((m: any) => m.id === f.meal_id)
            return `"${f.food_name}" in ${parent?.category || 'meal'}`
          })
          .join(', ')
        return {
          success: false,
          message: `Multiple matching items found: ${names}. Which one would you like to delete?`,
        }
      }

      itemId = matchedItems[0].id
      mealId = matchedItems[0].meal_id
    } else if (itemId) {
      const existing = items.find((i: any) => i.id === itemId)
      if (!existing) {
        return {
          success: false,
          message: `Food item with ID ${itemId} was not found in today's meals.`,
        }
      }
      mealId = existing.meal_id
    }

    if (!itemId) {
      return { success: false, message: 'Please specify which food item to delete.' }
    }

    // Get mealId before delete if not known
    if (!mealId) {
      const { data: item } = await this.supabase
        .from('nutrition_food_items')
        .select('meal_id')
        .eq('id', itemId)
        .eq('user_id', this.userId)
        .maybeSingle()
      mealId = item?.meal_id || null
    }

    const { error: deleteError } = await this.supabase
      .from('nutrition_food_items')
      .delete()
      .eq('id', itemId)
      .eq('user_id', this.userId)

    if (deleteError) {
      return { success: false, message: `Failed to delete food item: ${deleteError.message}` }
    }

    // If parent meal is now empty, clean it up
    if (mealId) {
      const { count } = await this.supabase
        .from('nutrition_food_items')
        .select('id', { count: 'exact', head: true })
        .eq('meal_id', mealId)
        .eq('user_id', this.userId)

      if (count === 0) {
        await this.supabase.from('nutrition_meals').delete().eq('id', mealId).eq('user_id', this.userId)
      }
    }

    const updatedDay = await this.fetchDaySummary(this.defaultDate)

    return {
      success: true,
      message: 'Item removed from food diary.',
      data: { daySummary: updatedDay },
    }
  }

  // 4. GET DAY
  async executeGetDay(args: { log_date?: string }): Promise<ActionExecutionResult> {
    const logDate = args.log_date || this.defaultDate
    const daySummary = await this.fetchDaySummary(logDate)
    return {
      success: true,
      message: `Retrieved nutrition summary for ${logDate}.`,
      data: daySummary,
    }
  }

  // 5. SET WEIGHT
  async executeSetWeight(args: {
    weight_kg: number
    measured_at?: string
    notes?: string
  }): Promise<ActionExecutionResult> {
    const weight = Number(args.weight_kg)
    if (isNaN(weight) || weight < 25.0 || weight > 350.0) {
      return { success: false, message: 'Weight must be a valid number between 25.0 kg and 350.0 kg.' }
    }

    const measuredAt = args.measured_at || new Date().toISOString()
    const { data: entry, error } = await this.supabase
      .from('weight_entries')
      .insert({
        user_id: this.userId,
        weight_kg: Math.round(weight * 10) / 10,
        measured_at: measuredAt,
        notes: args.notes ? args.notes.trim() : null,
      })
      .select('*')
      .single()

    if (error) {
      return { success: false, message: `Failed to log weight: ${error.message}` }
    }

    return {
      success: true,
      message: `Bodyweight of ${entry.weight_kg} kg logged successfully for ${measuredAt.split('T')[0]}.`,
      data: { entry },
    }
  }

  // 6. FINALIZE / REOPEN DAY
  async executeFinalizeDay(args: {
    log_date?: string
    action: 'finalize' | 'reopen'
  }): Promise<ActionExecutionResult> {
    const logDate = args.log_date || this.defaultDate
    const isClosing = args.action === 'finalize'

    const { data: day, error } = await this.supabase
      .from('nutrition_days')
      .update({
        status: isClosing ? 'closed' : 'open',
        finalized_at: isClosing ? new Date().toISOString() : null,
      })
      .eq('user_id', this.userId)
      .eq('log_date', logDate)
      .select('*')
      .single()

    if (error) {
      return { success: false, message: `Failed to ${args.action} day: ${error.message}` }
    }

    return {
      success: true,
      message: `Nutrition day for ${logDate} is now ${day.status}.`,
      data: { day },
    }
  }

  // 7. SAVE RECIPE
  async executeSaveRecipe(args: {
    name: string
    description?: string
    servings: number
    items: Array<{
      food_name: string
      quantity: number
      unit: string
      calories: number
      protein_g: number
      carbs_g: number
      fat_g: number
      fiber_g?: number
    }>
  }): Promise<ActionExecutionResult> {
    if (!args.name || !args.name.trim()) {
      return { success: false, message: 'Recipe name is required.' }
    }
    const servings = Math.max(1, Number(args.servings) || 1)
    if (!Array.isArray(args.items) || args.items.length === 0) {
      return { success: false, message: 'Recipe must contain at least one ingredient.' }
    }

    // Check if recipe with same name already exists
    const { data: existing } = await this.supabase
      .from('saved_recipes')
      .select('id, name')
      .eq('user_id', this.userId)
      .ilike('name', args.name.trim())
      .maybeSingle()

    if (existing) {
      return {
        success: false,
        message: `A saved recipe named "${existing.name}" already exists. Would you like to overwrite it or choose another name?`,
      }
    }

    // Create recipe header
    const { data: recipeData, error: recipeError } = await this.supabase
      .from('saved_recipes')
      .insert({
        user_id: this.userId,
        name: args.name.trim(),
        description: args.description ? args.description.trim() : null,
        servings,
      })
      .select('*')
      .single()

    if (recipeError) {
      return { success: false, message: `Failed to save recipe: ${recipeError.message}` }
    }

    const itemsToInsert = args.items.map((i) => ({
      user_id: this.userId,
      recipe_id: recipeData.id,
      food_name: i.food_name.trim(),
      quantity: Math.max(0.01, Number(i.quantity) || 1),
      unit: (i.unit || 'g').trim(),
      calories: Math.max(0, Math.round(Number(i.calories) || 0)),
      protein_g: Math.max(0, Math.round((Number(i.protein_g) || 0) * 10) / 10),
      carbs_g: Math.max(0, Math.round((Number(i.carbs_g) || 0) * 10) / 10),
      fat_g: Math.max(0, Math.round((Number(i.fat_g) || 0) * 10) / 10),
      fiber_g: Math.max(0, Math.round((Number(i.fiber_g) || 0) * 10) / 10),
    }))

    const { data: itemsData, error: itemsError } = await this.supabase
      .from('saved_recipe_items')
      .insert(itemsToInsert)
      .select('*')

    if (itemsError) {
      // Compensate rollback
      await this.supabase.from('saved_recipes').delete().eq('id', recipeData.id).eq('user_id', this.userId)
      return { success: false, message: `Failed to save recipe ingredients: ${itemsError.message}` }
    }

    return {
      success: true,
      message: `Recipe "${recipeData.name}" (${servings} servings, ${itemsData.length} ingredients) saved to catalog.`,
      data: { recipe: { ...recipeData, items: itemsData } },
    }
  }

  // 8. LIST RECIPES
  async executeListRecipes(args: { search_query?: string }): Promise<ActionExecutionResult> {
    let query = this.supabase
      .from('saved_recipes')
      .select('*, saved_recipe_items(*)')
      .eq('user_id', this.userId)
      .order('name', { ascending: true })

    if (args.search_query && args.search_query.trim()) {
      query = query.ilike('name', `%${args.search_query.trim()}%`)
    }

    const { data: recipes, error } = await query

    if (error) {
      return { success: false, message: `Failed to list recipes: ${error.message}` }
    }

    return {
      success: true,
      message: `Found ${recipes?.length || 0} saved recipe(s).`,
      data: { recipes: recipes || [] },
    }
  }

  // 9. SET TARGETS
  async executeSetTargets(args: {
    daily_calories?: number
    protein_g?: number
    carbs_g?: number
    fat_g?: number
    goal_weight_kg?: number
  }): Promise<ActionExecutionResult> {
    const updates: Record<string, any> = {}

    if (args.daily_calories !== undefined) {
      const cal = Number(args.daily_calories)
      if (cal >= 500 && cal <= 10000) updates.daily_calorie_target = Math.round(cal)
    }
    if (args.protein_g !== undefined) {
      const p = Number(args.protein_g)
      if (p >= 0 && p <= 500) updates.protein_target_g = Math.round(p)
    }
    if (args.carbs_g !== undefined) {
      const c = Number(args.carbs_g)
      if (c >= 0 && c <= 1000) updates.carbs_target_g = Math.round(c)
    }
    if (args.fat_g !== undefined) {
      const f = Number(args.fat_g)
      if (f >= 0 && f <= 300) updates.fat_target_g = Math.round(f)
    }
    if (args.goal_weight_kg !== undefined) {
      const gw = Number(args.goal_weight_kg)
      if (gw >= 25.0 && gw <= 350.0) updates.goal_weight_kg = Math.round(gw * 10) / 10
    }

    if (Object.keys(updates).length === 0) {
      return { success: false, message: 'No valid target values provided to update.' }
    }

    const { data: profile, error } = await this.supabase
      .from('profiles')
      .update(updates)
      .eq('id', this.userId)
      .select('*')
      .single()

    if (error) {
      return { success: false, message: `Failed to update targets: ${error.message}` }
    }

    return {
      success: true,
      message: 'Nutrition targets updated successfully in your profile.',
      data: { profile },
    }
  }

  // Helper: Fetch all meals and their food items reliably without fragile PostgREST embedded joins
  async getDayMealsAndItems(dayId: string): Promise<{ meals: any[]; items: any[] }> {
    const { data: mealsData, error: mealsError } = await this.supabase
      .from('nutrition_meals')
      .select('*')
      .eq('nutrition_day_id', dayId)
      .eq('user_id', this.userId)
      .order('sort_order', { ascending: true })

    if (mealsError || !mealsData || mealsData.length === 0) {
      return { meals: [], items: [] }
    }

    const mealIds = mealsData.map((m: any) => m.id)
    const { data: foodData, error: foodError } = await this.supabase
      .from('nutrition_food_items')
      .select('*')
      .eq('user_id', this.userId)
      .in('meal_id', mealIds)
      .order('created_at', { ascending: true })

    const foodItems = (foodError ? [] : foodData) || []

    const meals = mealsData.map((m: any) => {
      const itemsForMeal = foodItems.filter((f: any) => f.meal_id === m.id)
      return {
        ...m,
        nutrition_food_items: itemsForMeal,
        items: itemsForMeal,
      }
    })

    return { meals, items: foodItems }
  }

  // Internal Helper: Fetch Day Summary with Exact Macro Sums
  async fetchDaySummary(logDate: string): Promise<Record<string, any>> {
    const { data: day } = await this.supabase
      .from('nutrition_days')
      .select('*')
      .eq('user_id', this.userId)
      .eq('log_date', logDate)
      .maybeSingle()

    if (!day) {
      return {
        log_date: logDate,
        status: 'open',
        meals: [],
        totals: { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0, fiber_g: 0 },
      }
    }

    const { meals, items } = await this.getDayMealsAndItems(day.id)

    let calories = 0
    let protein_g = 0
    let carbs_g = 0
    let fat_g = 0
    let fiber_g = 0

    for (const item of items) {
      calories += Number(item.calories) || 0
      protein_g += Number(item.protein_g) || 0
      carbs_g += Number(item.carbs_g) || 0
      fat_g += Number(item.fat_g) || 0
      fiber_g += Number(item.fiber_g) || 0
    }

    return {
      day,
      meals,
      totals: {
        calories: Math.round(calories),
        protein_g: Math.round(protein_g * 10) / 10,
        carbs_g: Math.round(carbs_g * 10) / 10,
        fat_g: Math.round(fat_g * 10) / 10,
        fiber_g: Math.round(fiber_g * 10) / 10,
      },
    }
  }
}
