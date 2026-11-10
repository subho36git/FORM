/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { useAuth } from '@/features/auth'
import { nutritionService } from '../services/nutritionService'
import {
  getLocalDateString,
  parseLocalDate,
  type MealCategory,
  type DbNutritionDay,
  type DbNutritionFoodItem,
  type DbSavedFood,
  type DbSavedRecipeItem,
  type SavedRecipeWithItems,
  type NutritionMealWithItems,
  type DailyNutritionTotals,
  type AddFoodItemPayload,
} from '../types'

interface NutritionContextType {
  // Date State
  selectedDate: string
  setSelectedDate: (date: string) => void
  goToToday: () => void
  goToPreviousDay: () => void
  goToNextDay: () => void

  // Daily Data & Status
  currentDay: DbNutritionDay | null
  meals: NutritionMealWithItems[]
  isLoading: boolean
  isSaving: boolean
  error: string | null
  clearError: () => void
  refreshCurrentDay: () => Promise<void>
  isDayClosed: boolean
  finalizeDay: () => Promise<void>
  reopenDay: () => Promise<void>

  // Food Item Operations
  addFoodItem: (payload: AddFoodItemPayload) => Promise<void>
  updateFoodItem: (itemId: string, updates: Partial<DbNutritionFoodItem>) => Promise<void>
  deleteFoodItem: (itemId: string, mealId: string) => Promise<void>

  // Computed Totals
  dailyTotals: DailyNutritionTotals

  // Saved Foods & Recipes Repository
  savedFoods: DbSavedFood[]
  savedRecipes: SavedRecipeWithItems[]
  isLoadingSaved: boolean
  refreshSaved: () => Promise<void>
  saveFood: (food: Omit<DbSavedFood, 'id' | 'user_id' | 'created_at' | 'updated_at'>) => Promise<void>
  deleteSavedFood: (foodId: string) => Promise<void>
  saveRecipe: (
    name: string,
    description: string | null,
    servings: number,
    items: Omit<DbSavedRecipeItem, 'id' | 'user_id' | 'recipe_id' | 'created_at' | 'updated_at'>[]
  ) => Promise<void>
  deleteSavedRecipe: (recipeId: string) => Promise<void>
  logRecipeToMeal: (category: MealCategory, recipe: SavedRecipeWithItems, servings: number) => Promise<void>

  // Modals & UI Selection State
  isAddModalOpen: boolean
  setIsAddModalOpen: (open: boolean) => void
  selectedCategoryForAdd: MealCategory
  setSelectedCategoryForAdd: (cat: MealCategory) => void
  activeEditItem: DbNutritionFoodItem | null
  setActiveEditItem: (item: DbNutritionFoodItem | null) => void
  isSavedManagerOpen: boolean
  setIsSavedManagerOpen: (open: boolean) => void
  savedManagerTab: 'foods' | 'recipes'
  setSavedManagerTab: (tab: 'foods' | 'recipes') => void
  openSavedManager: (tab?: 'foods' | 'recipes') => void
}

const NutritionContext = createContext<NutritionContextType | undefined>(undefined)

export const NutritionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth()
  const userId = user?.id

  // Date state initialized to today's local date
  const [selectedDate, setSelectedDate] = useState<string>(() => getLocalDateString())

  // Day data
  const [currentDay, setCurrentDay] = useState<DbNutritionDay | null>(null)
  const [meals, setMeals] = useState<NutritionMealWithItems[]>([])
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [isSaving, setIsSaving] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)

  // Saved foods & recipes state
  const [savedFoods, setSavedFoods] = useState<DbSavedFood[]>([])
  const [savedRecipes, setSavedRecipes] = useState<SavedRecipeWithItems[]>([])
  const [isLoadingSaved, setIsLoadingSaved] = useState<boolean>(false)

  // Modal states
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [selectedCategoryForAdd, setSelectedCategoryForAdd] = useState<MealCategory>('breakfast')
  const [activeEditItem, setActiveEditItem] = useState<DbNutritionFoodItem | null>(null)
  const [isSavedManagerOpen, setIsSavedManagerOpen] = useState(false)
  const [savedManagerTab, setSavedManagerTab] = useState<'foods' | 'recipes'>('foods')

  const openSavedManager = useCallback((tab: 'foods' | 'recipes' = 'foods') => {
    setSavedManagerTab(tab)
    setIsSavedManagerOpen(true)
  }, [])

  // Active request race guard
  const activeFetchDateRef = useRef<string>(selectedDate)

  const clearError = useCallback(() => {
    setError(null)
  }, [])

  // 1. Fetch Day and Meals with Race Guard
  const loadDayData = useCallback(
    async (targetDate: string) => {
      if (!userId) {
        setCurrentDay(null)
        setMeals([])
        setIsLoading(false)
        return
      }

      setIsLoading(true)
      setError(null)
      activeFetchDateRef.current = targetDate

      try {
        const data = await nutritionService.getDayWithMeals(userId, targetDate)

        // Only update if this request matches the currently selected date
        if (activeFetchDateRef.current === targetDate) {
          setCurrentDay(data.day)
          setMeals(data.meals)
        }
      } catch (err: unknown) {
        if (activeFetchDateRef.current === targetDate) {
          const msg = err instanceof Error ? err.message : 'Failed to load nutrition day'
          setError(msg)
        }
      } finally {
        if (activeFetchDateRef.current === targetDate) {
          setIsLoading(false)
        }
      }
    },
    [userId]
  )

  // Trigger load when selectedDate or userId changes
  useEffect(() => {
    let isMounted = true
    const run = async () => {
      await Promise.resolve()
      if (!isMounted) return
      await loadDayData(selectedDate)
    }
    void run()
    return () => {
      isMounted = false
    }
  }, [loadDayData, selectedDate])

  const refreshCurrentDay = useCallback(async () => {
    await loadDayData(selectedDate)
  }, [loadDayData, selectedDate])

  // 2. Fetch Saved Foods and Recipes
  const refreshSaved = useCallback(async () => {
    if (!userId) {
      setSavedFoods([])
      setSavedRecipes([])
      return
    }

    setIsLoadingSaved(true)
    try {
      const [foods, recipes] = await Promise.all([
        nutritionService.getSavedFoods(userId),
        nutritionService.getSavedRecipes(userId),
      ])
      setSavedFoods(foods)
      setSavedRecipes(recipes)
    } catch (err: unknown) {
      console.warn('[NutritionContext] Failed to load saved foods/recipes:', err)
    } finally {
      setIsLoadingSaved(false)
    }
  }, [userId])

  useEffect(() => {
    let isMounted = true
    const run = async () => {
      await Promise.resolve()
      if (!isMounted) return
      await refreshSaved()
    }
    void run()
    return () => {
      isMounted = false
    }
  }, [refreshSaved])

  // 3. Computed Totals from Actual Food Items
  const dailyTotals = useMemo<DailyNutritionTotals>(() => {
    let calories = 0
    let protein_g = 0
    let carbs_g = 0
    let fat_g = 0
    let fiber_g = 0

    for (const meal of meals) {
      for (const item of meal.items) {
        calories += Number(item.calories) || 0
        protein_g += Number(item.protein_g) || 0
        carbs_g += Number(item.carbs_g) || 0
        fat_g += Number(item.fat_g) || 0
        fiber_g += Number(item.fiber_g) || 0
      }
    }

    return {
      calories: Math.round(calories),
      protein_g: Math.round(protein_g * 10) / 10,
      carbs_g: Math.round(carbs_g * 10) / 10,
      fat_g: Math.round(fat_g * 10) / 10,
      fiber_g: Math.round(fiber_g * 10) / 10,
    }
  }, [meals])

  const isDayClosed = currentDay?.status === 'closed'

  // 4. Date Navigation
  const goToToday = useCallback(() => {
    setSelectedDate(getLocalDateString())
  }, [])

  const goToPreviousDay = useCallback(() => {
    setSelectedDate((prev) => {
      const d = parseLocalDate(prev)
      d.setDate(d.getDate() - 1)
      return getLocalDateString(d)
    })
  }, [])

  const goToNextDay = useCallback(() => {
    setSelectedDate((prev) => {
      const d = parseLocalDate(prev)
      d.setDate(d.getDate() + 1)
      return getLocalDateString(d)
    })
  }, [])

  // 5. Finalize Day
  const finalizeDay = useCallback(async () => {
    if (!userId || !currentDay) return
    setIsSaving(true)
    setError(null)
    try {
      const updated = await nutritionService.finalizeDay(currentDay.id, userId)
      setCurrentDay(updated)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to finalize day'
      setError(msg)
    } finally {
      setIsSaving(false)
    }
  }, [userId, currentDay])

  // 6. Reopen Day
  const reopenDay = useCallback(async () => {
    if (!userId || !currentDay) return
    setIsSaving(true)
    setError(null)
    try {
      const updated = await nutritionService.reopenDay(currentDay.id, userId)
      setCurrentDay(updated)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to reopen day'
      setError(msg)
    } finally {
      setIsSaving(false)
    }
  }, [userId, currentDay])

  // 7. Add Food Item
  const addFoodItem = useCallback(
    async (payload: AddFoodItemPayload) => {
      if (!userId) {
        setError('Please sign in to log food items.')
        return
      }

      setIsSaving(true)
      setError(null)

      try {
        await nutritionService.addFoodItem(userId, selectedDate, payload)
        // Refresh day and meals to reflect new item and updated structure
        await loadDayData(selectedDate)
        if (payload.saveToSavedFoods) {
          refreshSaved()
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Failed to log food item'
        setError(msg)
        throw err
      } finally {
        setIsSaving(false)
      }
    },
    [userId, selectedDate, loadDayData, refreshSaved]
  )

  // 8. Update Food Item
  const updateFoodItem = useCallback(
    async (itemId: string, updates: Partial<DbNutritionFoodItem>) => {
      if (!userId) return
      setIsSaving(true)
      setError(null)

      try {
        const updated = await nutritionService.updateFoodItem(itemId, userId, updates)
        // Immediately update local state
        setMeals((prevMeals) =>
          prevMeals.map((meal) => ({
            ...meal,
            items: meal.items.map((item) => (item.id === itemId ? updated : item)),
          }))
        )
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Failed to update food item'
        setError(msg)
        throw err
      } finally {
        setIsSaving(false)
      }
    },
    [userId]
  )

  // 9. Delete Food Item
  const deleteFoodItem = useCallback(
    async (itemId: string, mealId: string) => {
      if (!userId) return
      setIsSaving(true)
      setError(null)

      try {
        await nutritionService.deleteFoodItem(itemId, mealId, userId)
        // Immediately update local state
        setMeals((prevMeals) =>
          prevMeals
            .map((meal) => {
              if (meal.id !== mealId) return meal
              return {
                ...meal,
                items: meal.items.filter((item) => item.id !== itemId),
              }
            })
            // Remove meal if it has no items
            .filter((meal) => meal.items.length > 0)
        )
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Failed to delete food item'
        setError(msg)
        throw err
      } finally {
        setIsSaving(false)
      }
    },
    [userId]
  )

  // 10. Saved Foods Operations
  const saveFood = useCallback(
    async (food: Omit<DbSavedFood, 'id' | 'user_id' | 'created_at' | 'updated_at'>) => {
      if (!userId) return
      try {
        const created = await nutritionService.createSavedFood(userId, food)
        setSavedFoods((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)))
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Failed to save food'
        setError(msg)
        throw err
      }
    },
    [userId]
  )

  const deleteSavedFood = useCallback(
    async (foodId: string) => {
      if (!userId) return
      try {
        await nutritionService.deleteSavedFood(foodId, userId)
        setSavedFoods((prev) => prev.filter((f) => f.id !== foodId))
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Failed to delete saved food'
        setError(msg)
        throw err
      }
    },
    [userId]
  )

  // 11. Saved Recipes Operations
  const saveRecipe = useCallback(
    async (
      name: string,
      description: string | null,
      servings: number,
      items: Omit<DbSavedRecipeItem, 'id' | 'user_id' | 'recipe_id' | 'created_at' | 'updated_at'>[]
    ) => {
      if (!userId) return
      try {
        const created = await nutritionService.createSavedRecipe(userId, {
          name,
          description,
          servings,
          items,
        })
        setSavedRecipes((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)))
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Failed to save recipe'
        setError(msg)
        throw err
      }
    },
    [userId]
  )

  const deleteSavedRecipe = useCallback(
    async (recipeId: string) => {
      if (!userId) return
      try {
        await nutritionService.deleteSavedRecipe(recipeId, userId)
        setSavedRecipes((prev) => prev.filter((r) => r.id !== recipeId))
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Failed to delete saved recipe'
        setError(msg)
        throw err
      }
    },
    [userId]
  )

  const logRecipeToMeal = useCallback(
    async (category: MealCategory, recipe: SavedRecipeWithItems, servings: number) => {
      if (!userId) return
      setIsSaving(true)
      setError(null)
      try {
        await nutritionService.logRecipeToMeal({
          userId,
          logDate: selectedDate,
          category,
          recipe,
          servingsToLog: servings,
        })
        await loadDayData(selectedDate)
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Failed to log recipe to meal'
        setError(msg)
        throw err
      } finally {
        setIsSaving(false)
      }
    },
    [userId, selectedDate, loadDayData]
  )

  const value = useMemo(
    () => ({
      selectedDate,
      setSelectedDate,
      goToToday,
      goToPreviousDay,
      goToNextDay,
      currentDay,
      meals,
      isLoading,
      isSaving,
      error,
      clearError,
      refreshCurrentDay,
      isDayClosed,
      finalizeDay,
      reopenDay,
      addFoodItem,
      updateFoodItem,
      deleteFoodItem,
      dailyTotals,
      savedFoods,
      savedRecipes,
      isLoadingSaved,
      refreshSaved,
      saveFood,
      deleteSavedFood,
      saveRecipe,
      deleteSavedRecipe,
      logRecipeToMeal,
      isAddModalOpen,
      setIsAddModalOpen,
      selectedCategoryForAdd,
      setSelectedCategoryForAdd,
      activeEditItem,
      setActiveEditItem,
      isSavedManagerOpen,
      setIsSavedManagerOpen,
      savedManagerTab,
      setSavedManagerTab,
      openSavedManager,
    }),
    [
      selectedDate,
      goToToday,
      goToPreviousDay,
      goToNextDay,
      currentDay,
      meals,
      isLoading,
      isSaving,
      error,
      clearError,
      refreshCurrentDay,
      isDayClosed,
      finalizeDay,
      reopenDay,
      addFoodItem,
      updateFoodItem,
      deleteFoodItem,
      dailyTotals,
      savedFoods,
      savedRecipes,
      isLoadingSaved,
      refreshSaved,
      saveFood,
      deleteSavedFood,
      saveRecipe,
      deleteSavedRecipe,
      logRecipeToMeal,
      isAddModalOpen,
      selectedCategoryForAdd,
      activeEditItem,
      isSavedManagerOpen,
      savedManagerTab,
      openSavedManager,
    ]
  )

  return <NutritionContext.Provider value={value}>{children}</NutritionContext.Provider>
}

export const useNutrition = (): NutritionContextType => {
  const context = useContext(NutritionContext)
  if (!context) {
    throw new Error('useNutrition must be used within a NutritionProvider')
  }
  return context
}
