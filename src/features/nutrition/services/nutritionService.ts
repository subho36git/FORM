import { supabase } from '@/lib/supabase'
import type {
  MealCategory,
  DbNutritionDay,
  DbNutritionMeal,
  DbNutritionFoodItem,
  DbSavedFood,
  DbSavedRecipe,
  DbSavedRecipeItem,
  SavedRecipeWithItems,
  NutritionDayData,
  AddFoodItemPayload,
} from '../types'

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

export const nutritionService = {
  /**
   * Fetches the nutrition day, its meals, and all food items for a specific user and local date.
   */
  async getDayWithMeals(userId: string, logDate: string): Promise<NutritionDayData> {
    // 1. Fetch the day record
    const { data: dayData, error: dayError } = await supabase
      .from('nutrition_days')
      .select('*')
      .eq('user_id', userId)
      .eq('log_date', logDate)
      .maybeSingle()

    if (dayError) {
      console.error('[NutritionService] Error fetching day:', dayError)
      throw new Error(`Failed to load nutrition day: ${dayError.message}`)
    }

    if (!dayData) {
      return { day: null, meals: [] }
    }

    const day = dayData as DbNutritionDay

    // 2. Fetch meals belonging to this day
    const { data: mealsData, error: mealsError } = await supabase
      .from('nutrition_meals')
      .select('*')
      .eq('nutrition_day_id', day.id)
      .eq('user_id', userId)
      .order('sort_order', { ascending: true })
      .order('logged_at', { ascending: true })

    if (mealsError) {
      console.error('[NutritionService] Error fetching meals:', mealsError)
      throw new Error(`Failed to load meals: ${mealsError.message}`)
    }

    const meals = (mealsData || []) as DbNutritionMeal[]
    if (meals.length === 0) {
      return { day, meals: [] }
    }

    // 3. Fetch all food items belonging to these meals
    const mealIds = meals.map((m) => m.id)
    const { data: foodData, error: foodError } = await supabase
      .from('nutrition_food_items')
      .select('*')
      .eq('user_id', userId)
      .in('meal_id', mealIds)
      .order('created_at', { ascending: true })

    if (foodError) {
      console.error('[NutritionService] Error fetching food items:', foodError)
      throw new Error(`Failed to load food items: ${foodError.message}`)
    }

    const foodItems = (foodData || []) as DbNutritionFoodItem[]

    // Map food items to their parent meals
    const itemsByMealId = new Map<string, DbNutritionFoodItem[]>()
    for (const item of foodItems) {
      const list = itemsByMealId.get(item.meal_id) || []
      list.push(item)
      itemsByMealId.set(item.meal_id, list)
    }

    const mealsWithItems = meals.map((m) => ({
      ...m,
      items: itemsByMealId.get(m.id) || [],
    }))

    return { day, meals: mealsWithItems }
  },

  /**
   * Fetches all nutrition days, their meals, and food items within a calendar date range.
   * Useful for analytics and historical progress tracking.
   */
  async getNutritionRange(
    userId: string,
    startDate: string,
    endDate: string
  ): Promise<NutritionDayData[]> {
    // 1. Fetch days within range
    const { data: daysData, error: daysError } = await supabase
      .from('nutrition_days')
      .select('*')
      .eq('user_id', userId)
      .gte('log_date', startDate)
      .lte('log_date', endDate)
      .order('log_date', { ascending: true })

    if (daysError) {
      console.error('[NutritionService] Error fetching nutrition days range:', daysError)
      throw new Error(`Failed to load nutrition range: ${daysError.message}`)
    }

    if (!daysData || daysData.length === 0) {
      return []
    }

    const days = daysData as DbNutritionDay[]
    const dayIds = days.map((d) => d.id)

    // 2. Fetch all meals for these days
    const { data: mealsData, error: mealsError } = await supabase
      .from('nutrition_meals')
      .select('*')
      .eq('user_id', userId)
      .in('nutrition_day_id', dayIds)
      .order('sort_order', { ascending: true })
      .order('logged_at', { ascending: true })

    if (mealsError) {
      console.error('[NutritionService] Error fetching meals range:', mealsError)
      throw new Error(`Failed to load meals range: ${mealsError.message}`)
    }

    const meals = (mealsData || []) as DbNutritionMeal[]
    if (meals.length === 0) {
      return days.map((d) => ({ day: d, meals: [] }))
    }

    // 3. Fetch all food items for these meals
    const mealIds = meals.map((m) => m.id)
    const { data: foodData, error: foodError } = await supabase
      .from('nutrition_food_items')
      .select('*')
      .eq('user_id', userId)
      .in('meal_id', mealIds)
      .order('created_at', { ascending: true })

    if (foodError) {
      console.error('[NutritionService] Error fetching food items range:', foodError)
      throw new Error(`Failed to load food items range: ${foodError.message}`)
    }

    const foodItems = (foodData || []) as DbNutritionFoodItem[]

    // Map food items to their parent meals
    const itemsByMealId = new Map<string, DbNutritionFoodItem[]>()
    for (const item of foodItems) {
      const list = itemsByMealId.get(item.meal_id) || []
      list.push(item)
      itemsByMealId.set(item.meal_id, list)
    }

    const mealsWithItems = meals.map((m) => ({
      ...m,
      items: itemsByMealId.get(m.id) || [],
    }))

    // Map meals to days
    const mealsByDayId = new Map<string, typeof mealsWithItems>()
    for (const meal of mealsWithItems) {
      const list = mealsByDayId.get(meal.nutrition_day_id) || []
      list.push(meal)
      mealsByDayId.set(meal.nutrition_day_id, list)
    }

    return days.map((day) => ({
      day,
      meals: mealsByDayId.get(day.id) || [],
    }))
  },

  /**
   * Retrieves an existing day or creates a new open day record for the given user and date.
   */
  async getOrCreateDay(userId: string, logDate: string): Promise<DbNutritionDay> {
    // Check existing
    const { data: existing, error: fetchError } = await supabase
      .from('nutrition_days')
      .select('*')
      .eq('user_id', userId)
      .eq('log_date', logDate)
      .maybeSingle()

    if (fetchError) {
      throw new Error(`Failed checking nutrition day: ${fetchError.message}`)
    }

    if (existing) {
      return existing as DbNutritionDay
    }

    // Insert new day
    const { data: created, error: insertError } = await supabase
      .from('nutrition_days')
      .insert({
        user_id: userId,
        log_date: logDate,
        status: 'open',
      })
      .select()
      .single()

    if (insertError) {
      // In case of a concurrent insert race condition, try fetching again
      if (insertError.code === '23505') {
        const { data: retryData } = await supabase
          .from('nutrition_days')
          .select('*')
          .eq('user_id', userId)
          .eq('log_date', logDate)
          .single()

        if (retryData) return retryData as DbNutritionDay
      }
      throw new Error(`Failed to create nutrition day: ${insertError.message}`)
    }

    return created as DbNutritionDay
  },

  /**
   * Finalizes an open day (status = 'closed', finalized_at = now).
   */
  async finalizeDay(dayId: string, userId: string): Promise<DbNutritionDay> {
    const { data, error } = await supabase
      .from('nutrition_days')
      .update({
        status: 'closed',
        finalized_at: new Date().toISOString(),
      })
      .eq('id', dayId)
      .eq('user_id', userId)
      .select()
      .single()

    if (error) {
      throw new Error(`Failed to finalize day: ${error.message}`)
    }

    return data as DbNutritionDay
  },

  /**
   * Reopens a closed day (status = 'open', finalized_at = null).
   */
  async reopenDay(dayId: string, userId: string): Promise<DbNutritionDay> {
    const { data, error } = await supabase
      .from('nutrition_days')
      .update({
        status: 'open',
        finalized_at: null,
      })
      .eq('id', dayId)
      .eq('user_id', userId)
      .select()
      .single()

    if (error) {
      throw new Error(`Failed to reopen day: ${error.message}`)
    }

    return data as DbNutritionDay
  },

  /**
   * Adds a food item to a meal on the given date.
   * Creates the day and meal if they do not exist yet.
   */
  async addFoodItem(
    userId: string,
    logDate: string,
    payload: AddFoodItemPayload
  ): Promise<{ day: DbNutritionDay; meal: DbNutritionMeal; item: DbNutritionFoodItem }> {
    // 1. Get or create day
    const day = await this.getOrCreateDay(userId, logDate)
    if (day.status === 'closed') {
      throw new Error('This day is finalized and closed. Please reopen it to log more food.')
    }

    // 2. Find or create meal for category on this day
    const { data: existingMeal, error: mealFetchError } = await supabase
      .from('nutrition_meals')
      .select('*')
      .eq('nutrition_day_id', day.id)
      .eq('user_id', userId)
      .eq('category', payload.category)
      .maybeSingle()

    if (mealFetchError) {
      throw new Error(`Failed searching for meal: ${mealFetchError.message}`)
    }

    let meal: DbNutritionMeal

    if (existingMeal) {
      meal = existingMeal as DbNutritionMeal
    } else {
      const { data: newMeal, error: mealCreateError } = await supabase
        .from('nutrition_meals')
        .insert({
          user_id: userId,
          nutrition_day_id: day.id,
          category: payload.category,
          meal_name: payload.category.charAt(0).toUpperCase() + payload.category.slice(1),
          sort_order: getDefaultSortOrder(payload.category),
          logged_at: new Date().toISOString(),
        })
        .select()
        .single()

      if (mealCreateError) {
        throw new Error(`Failed to create meal category: ${mealCreateError.message}`)
      }
      meal = newMeal as DbNutritionMeal
    }

    // 3. Insert the food item
    const { data: itemData, error: itemError } = await supabase
      .from('nutrition_food_items')
      .insert({
        user_id: userId,
        meal_id: meal.id,
        food_name: payload.food_name.trim(),
        quantity: payload.quantity,
        unit: payload.unit.trim() || 'serving',
        calories: Math.max(0, payload.calories),
        protein_g: Math.max(0, payload.protein_g),
        carbs_g: Math.max(0, payload.carbs_g),
        fat_g: Math.max(0, payload.fat_g),
        fiber_g: Math.max(0, payload.fiber_g || 0),
        is_estimated: Boolean(payload.is_estimated),
        notes: payload.notes ? payload.notes.trim() : null,
      })
      .select()
      .single()

    if (itemError) {
      throw new Error(`Failed to log food item: ${itemError.message}`)
    }

    // 4. Optionally save as a reusable food
    if (payload.saveToSavedFoods) {
      try {
        await this.createSavedFood(userId, {
          name: payload.food_name.trim(),
          default_quantity: payload.quantity,
          default_unit: payload.unit.trim() || 'serving',
          calories: payload.calories,
          protein_g: payload.protein_g,
          carbs_g: payload.carbs_g,
          fat_g: payload.fat_g,
          fiber_g: payload.fiber_g || 0,
        })
      } catch (err) {
        console.warn('[NutritionService] Could not auto-save to library:', err)
      }
    }

    return { day, meal, item: itemData as DbNutritionFoodItem }
  },

  /**
   * Updates an existing food item.
   */
  async updateFoodItem(
    itemId: string,
    userId: string,
    updates: Partial<DbNutritionFoodItem>
  ): Promise<DbNutritionFoodItem> {
    const cleanUpdates: Record<string, unknown> = {}
    if (updates.food_name !== undefined) cleanUpdates.food_name = updates.food_name.trim()
    if (updates.quantity !== undefined) cleanUpdates.quantity = Number(updates.quantity)
    if (updates.unit !== undefined) cleanUpdates.unit = updates.unit.trim()
    if (updates.calories !== undefined) cleanUpdates.calories = Math.max(0, Number(updates.calories))
    if (updates.protein_g !== undefined) cleanUpdates.protein_g = Math.max(0, Number(updates.protein_g))
    if (updates.carbs_g !== undefined) cleanUpdates.carbs_g = Math.max(0, Number(updates.carbs_g))
    if (updates.fat_g !== undefined) cleanUpdates.fat_g = Math.max(0, Number(updates.fat_g))
    if (updates.fiber_g !== undefined) cleanUpdates.fiber_g = Math.max(0, Number(updates.fiber_g))
    if (updates.notes !== undefined) cleanUpdates.notes = updates.notes ? updates.notes.trim() : null
    if (updates.is_estimated !== undefined) cleanUpdates.is_estimated = updates.is_estimated

    const { data, error } = await supabase
      .from('nutrition_food_items')
      .update(cleanUpdates)
      .eq('id', itemId)
      .eq('user_id', userId)
      .select()
      .single()

    if (error) {
      throw new Error(`Failed to update food item: ${error.message}`)
    }

    return data as DbNutritionFoodItem
  },

  /**
   * Deletes a food item.
   * If the parent meal has no other items left, cleans up the empty meal.
   */
  async deleteFoodItem(itemId: string, mealId: string, userId: string): Promise<void> {
    const { error: deleteError } = await supabase
      .from('nutrition_food_items')
      .delete()
      .eq('id', itemId)
      .eq('user_id', userId)

    if (deleteError) {
      throw new Error(`Failed to delete food item: ${deleteError.message}`)
    }

    // Check remaining items in this meal
    const { count, error: countError } = await supabase
      .from('nutrition_food_items')
      .select('*', { count: 'exact', head: true })
      .eq('meal_id', mealId)
      .eq('user_id', userId)

    if (!countError && count === 0) {
      // Clean up empty meal
      await supabase
        .from('nutrition_meals')
        .delete()
        .eq('id', mealId)
        .eq('user_id', userId)
    }
  },

  // ============================================================================
  // SAVED FOODS & RECIPES
  // ============================================================================

  /**
   * Fetches all saved foods for the user.
   */
  async getSavedFoods(userId: string): Promise<DbSavedFood[]> {
    const { data, error } = await supabase
      .from('saved_foods')
      .select('*')
      .eq('user_id', userId)
      .order('name', { ascending: true })

    if (error) {
      throw new Error(`Failed to load saved foods: ${error.message}`)
    }

    return (data || []) as DbSavedFood[]
  },

  /**
   * Creates a new saved food item.
   */
  async createSavedFood(
    userId: string,
    food: Omit<DbSavedFood, 'id' | 'user_id' | 'created_at' | 'updated_at'>
  ): Promise<DbSavedFood> {
    const { data, error } = await supabase
      .from('saved_foods')
      .insert({
        user_id: userId,
        name: food.name.trim(),
        default_quantity: Number(food.default_quantity) || 100,
        default_unit: food.default_unit.trim() || 'g',
        calories: Math.max(0, Number(food.calories)),
        protein_g: Math.max(0, Number(food.protein_g)),
        carbs_g: Math.max(0, Number(food.carbs_g)),
        fat_g: Math.max(0, Number(food.fat_g)),
        fiber_g: Math.max(0, Number(food.fiber_g || 0)),
      })
      .select()
      .single()

    if (error) {
      throw new Error(`Failed to save food: ${error.message}`)
    }

    return data as DbSavedFood
  },

  /**
   * Deletes a saved food.
   */
  async deleteSavedFood(foodId: string, userId: string): Promise<void> {
    const { error } = await supabase
      .from('saved_foods')
      .delete()
      .eq('id', foodId)
      .eq('user_id', userId)

    if (error) {
      throw new Error(`Failed to delete saved food: ${error.message}`)
    }
  },

  /**
   * Fetches all saved recipes with their ingredient items.
   */
  async getSavedRecipes(userId: string): Promise<SavedRecipeWithItems[]> {
    // 1. Fetch recipes
    const { data: recipes, error: recipesError } = await supabase
      .from('saved_recipes')
      .select('*')
      .eq('user_id', userId)
      .order('name', { ascending: true })

    if (recipesError) {
      throw new Error(`Failed to load saved recipes: ${recipesError.message}`)
    }

    if (!recipes || recipes.length === 0) {
      return []
    }

    // 2. Fetch items for all recipes
    const recipeIds = recipes.map((r) => r.id)
    const { data: items, error: itemsError } = await supabase
      .from('saved_recipe_items')
      .select('*')
      .eq('user_id', userId)
      .in('recipe_id', recipeIds)
      .order('created_at', { ascending: true })

    if (itemsError) {
      throw new Error(`Failed to load recipe ingredients: ${itemsError.message}`)
    }

    const itemsByRecipeId = new Map<string, DbSavedRecipeItem[]>()
    for (const item of (items || []) as DbSavedRecipeItem[]) {
      const list = itemsByRecipeId.get(item.recipe_id) || []
      list.push(item)
      itemsByRecipeId.set(item.recipe_id, list)
    }

    return (recipes as DbSavedRecipe[]).map((r) => ({
      ...r,
      items: itemsByRecipeId.get(r.id) || [],
    }))
  },

  /**
   * Creates a saved recipe with its ingredients.
   * Compensates if ingredient insertion fails.
   */
  async createSavedRecipe(
    userId: string,
    recipe: {
      name: string
      description?: string | null
      servings: number
      items: Omit<DbSavedRecipeItem, 'id' | 'user_id' | 'recipe_id' | 'created_at' | 'updated_at'>[]
    }
  ): Promise<SavedRecipeWithItems> {
    // 1. Create recipe header
    const { data: recipeData, error: recipeError } = await supabase
      .from('saved_recipes')
      .insert({
        user_id: userId,
        name: recipe.name.trim(),
        description: recipe.description ? recipe.description.trim() : null,
        servings: Math.max(1, Number(recipe.servings) || 1),
      })
      .select()
      .single()

    if (recipeError) {
      throw new Error(`Failed to save recipe: ${recipeError.message}`)
    }

    const savedRecipe = recipeData as DbSavedRecipe

    // 2. Insert ingredients if any
    let savedItems: DbSavedRecipeItem[] = []
    if (recipe.items.length > 0) {
      const itemsToInsert = recipe.items.map((i) => ({
        user_id: userId,
        recipe_id: savedRecipe.id,
        food_name: i.food_name.trim(),
        quantity: Number(i.quantity) || 1,
        unit: i.unit.trim() || 'serving',
        calories: Math.max(0, Number(i.calories)),
        protein_g: Math.max(0, Number(i.protein_g)),
        carbs_g: Math.max(0, Number(i.carbs_g)),
        fat_g: Math.max(0, Number(i.fat_g)),
        fiber_g: Math.max(0, Number(i.fiber_g || 0)),
      }))

      const { data: itemsData, error: itemsError } = await supabase
        .from('saved_recipe_items')
        .insert(itemsToInsert)
        .select()

      if (itemsError) {
        // Compensate by deleting the orphaned recipe header
        await supabase.from('saved_recipes').delete().eq('id', savedRecipe.id).eq('user_id', userId)
        throw new Error(`Failed to save recipe ingredients: ${itemsError.message}`)
      }

      savedItems = (itemsData || []) as DbSavedRecipeItem[]
    }

    return { ...savedRecipe, items: savedItems }
  },

  /**
   * Deletes a saved recipe (cascades to items via DB FK).
   */
  async deleteSavedRecipe(recipeId: string, userId: string): Promise<void> {
    const { error } = await supabase
      .from('saved_recipes')
      .delete()
      .eq('id', recipeId)
      .eq('user_id', userId)

    if (error) {
      throw new Error(`Failed to delete recipe: ${error.message}`)
    }
  },

  /**
   * Logs a saved recipe into a meal by scaling its ingredients according to the desired servings.
   */
  async logRecipeToMeal(params: {
    userId: string
    logDate: string
    category: MealCategory
    recipe: SavedRecipeWithItems
    servingsToLog: number
  }): Promise<void> {
    const { userId, logDate, category, recipe, servingsToLog } = params

    if (recipe.items.length === 0) {
      throw new Error('This recipe has no ingredients to log.')
    }

    const scaleFactor = (Number(servingsToLog) || 1) / (Number(recipe.servings) || 1)

    // Ensure day exists and is open
    const day = await this.getOrCreateDay(userId, logDate)
    if (day.status === 'closed') {
      throw new Error('This day is finalized and closed. Please reopen it to log food.')
    }

    // Find or create meal
    const { data: existingMeal } = await supabase
      .from('nutrition_meals')
      .select('*')
      .eq('nutrition_day_id', day.id)
      .eq('user_id', userId)
      .eq('category', category)
      .maybeSingle()

    let mealId: string

    if (existingMeal) {
      mealId = (existingMeal as DbNutritionMeal).id
    } else {
      const { data: newMeal, error: mealErr } = await supabase
        .from('nutrition_meals')
        .insert({
          user_id: userId,
          nutrition_day_id: day.id,
          category,
          meal_name: category.charAt(0).toUpperCase() + category.slice(1),
          sort_order: getDefaultSortOrder(category),
          logged_at: new Date().toISOString(),
        })
        .select()
        .single()

      if (mealErr) throw new Error(`Failed creating meal for recipe: ${mealErr.message}`)
      mealId = (newMeal as DbNutritionMeal).id
    }

    // Prepare scaled items
    const foodItemsToInsert = recipe.items.map((ing) => ({
      user_id: userId,
      meal_id: mealId,
      food_name: `${ing.food_name} (${recipe.name})`,
      quantity: Math.round(ing.quantity * scaleFactor * 10) / 10,
      unit: ing.unit,
      calories: Math.round(ing.calories * scaleFactor),
      protein_g: Math.round(ing.protein_g * scaleFactor * 10) / 10,
      carbs_g: Math.round(ing.carbs_g * scaleFactor * 10) / 10,
      fat_g: Math.round(ing.fat_g * scaleFactor * 10) / 10,
      fiber_g: Math.round(ing.fiber_g * scaleFactor * 10) / 10,
      is_estimated: false,
      notes: `From recipe: ${recipe.name} (${servingsToLog} of ${recipe.servings} servings)`,
    }))

    const { error: insertErr } = await supabase.from('nutrition_food_items').insert(foodItemsToInsert)

    if (insertErr) {
      throw new Error(`Failed to log recipe ingredients: ${insertErr.message}`)
    }
  },
}
