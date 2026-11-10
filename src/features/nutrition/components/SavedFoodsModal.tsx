import React, { useState, useMemo, useEffect } from 'react'
import {
  X,
  Plus,
  Bookmark,
  BookOpen,
  Trash2,
  Search,
  Loader2,
  CalendarPlus,
  Calculator,
  Sparkles,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { useNutrition } from '../context/NutritionContext'
import type { MealCategory, DbSavedFood, SavedRecipeWithItems } from '../types'

export interface SavedFoodsModalProps {
  isOpen: boolean
  onClose: () => void
  initialTab?: 'foods' | 'recipes'
  initialShowCreateRecipe?: boolean
}

export interface NewRecipeIngredientDraft {
  food_name: string
  quantity: string
  unit: string
  calories: string
  protein_g: string
  carbs_g: string
  fat_g: string
  fiber_g: string
}

export const SavedFoodsModal: React.FC<SavedFoodsModalProps> = ({
  isOpen,
  onClose,
  initialTab = 'foods',
  initialShowCreateRecipe = false,
}) => {
  const {
    savedFoods,
    savedRecipes,
    saveFood,
    deleteSavedFood,
    saveRecipe,
    deleteSavedRecipe,
    addFoodItem,
    logRecipeToMeal,
    isDayClosed,
  } = useNutrition()

  const [activeTab, setActiveTab] = useState<'foods' | 'recipes'>(initialTab)
  const [searchQuery, setSearchQuery] = useState('')

  // Create Saved Food state
  const [showCreateFood, setShowCreateFood] = useState(false)
  const [newFoodName, setNewFoodName] = useState('')
  const [newFoodQty, setNewFoodQty] = useState('100')
  const [newFoodUnit, setNewFoodUnit] = useState('g')
  const [newFoodCal, setNewFoodCal] = useState('')
  const [newFoodP, setNewFoodP] = useState('')
  const [newFoodC, setNewFoodC] = useState('')
  const [newFoodF, setNewFoodF] = useState('')
  const [newFoodFiber, setNewFoodFiber] = useState('')

  // Create Recipe state
  const [showCreateRecipe, setShowCreateRecipe] = useState(initialShowCreateRecipe)
  const [recipeName, setRecipeName] = useState('')
  const [recipeDescription, setRecipeDescription] = useState('')
  const [recipeServings, setRecipeServings] = useState('2')
  const [ingredients, setIngredients] = useState<NewRecipeIngredientDraft[]>([
    {
      food_name: '',
      quantity: '100',
      unit: 'g',
      calories: '',
      protein_g: '',
      carbs_g: '',
      fat_g: '',
      fiber_g: '',
    },
  ])

  // Quick log state
  const [quickLogCategory, setQuickLogCategory] = useState<MealCategory>('lunch')
  const [quickLogFoodId, setQuickLogFoodId] = useState<string | null>(null)
  const [quickLogRecipeId, setQuickLogRecipeId] = useState<string | null>(null)
  const [quickLogServings, setQuickLogServings] = useState('1')

  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // 1. Dynamic Nutrition Calculation for Recipe Draft (Requirement 7)
  const recipeCalculations = useMemo(() => {
    let totalCalories = 0
    let totalProtein = 0
    let totalCarbs = 0
    let totalFat = 0
    let totalFiber = 0

    for (const ing of ingredients) {
      totalCalories += Math.max(0, Number(ing.calories) || 0)
      totalProtein += Math.max(0, Number(ing.protein_g) || 0)
      totalCarbs += Math.max(0, Number(ing.carbs_g) || 0)
      totalFat += Math.max(0, Number(ing.fat_g) || 0)
      totalFiber += Math.max(0, Number(ing.fiber_g) || 0)
    }

    const servingsNum = Math.max(1, Number(recipeServings) || 1)

    return {
      total: {
        calories: Math.round(totalCalories),
        protein_g: Math.round(totalProtein * 10) / 10,
        carbs_g: Math.round(totalCarbs * 10) / 10,
        fat_g: Math.round(totalFat * 10) / 10,
        fiber_g: Math.round(totalFiber * 10) / 10,
      },
      perServing: {
        calories: Math.round(totalCalories / servingsNum),
        protein_g: Math.round((totalProtein / servingsNum) * 10) / 10,
        carbs_g: Math.round((totalCarbs / servingsNum) * 10) / 10,
        fat_g: Math.round((totalFat / servingsNum) * 10) / 10,
        fiber_g: Math.round((totalFiber / servingsNum) * 10) / 10,
      },
    }
  }, [ingredients, recipeServings])

  // ESC key to close modal (declared before early return to satisfy hook rules)
  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen) return null

  // Submit New Saved Food
  const handleCreateFood = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newFoodName.trim()) {
      setError('Please provide a food name.')
      return
    }

    setIsSubmitting(true)
    setError(null)
    setSuccessMessage(null)

    try {
      await saveFood({
        name: newFoodName.trim(),
        default_quantity: Number(newFoodQty) || 100,
        default_unit: newFoodUnit.trim() || 'g',
        calories: Number(newFoodCal) || 0,
        protein_g: Number(newFoodP) || 0,
        carbs_g: Number(newFoodC) || 0,
        fat_g: Number(newFoodF) || 0,
        fiber_g: Number(newFoodFiber) || 0,
      })
      // Reset form
      setNewFoodName('')
      setNewFoodCal('')
      setNewFoodP('')
      setNewFoodC('')
      setNewFoodF('')
      setNewFoodFiber('')
      setShowCreateFood(false)
      setSuccessMessage('Food saved to catalog!')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save food')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Add Ingredient Row to Recipe Draft
  const handleAddIngredientRow = () => {
    setIngredients((prev) => [
      ...prev,
      {
        food_name: '',
        quantity: '100',
        unit: 'g',
        calories: '',
        protein_g: '',
        carbs_g: '',
        fat_g: '',
        fiber_g: '',
      },
    ])
  }

  const handleUpdateIngredientRow = (
    index: number,
    field: keyof NewRecipeIngredientDraft,
    val: string
  ) => {
    setIngredients((prev) =>
      prev.map((ing, i) => (i === index ? { ...ing, [field]: val } : ing))
    )
  }

  const handleRemoveIngredientRow = (index: number) => {
    if (ingredients.length <= 1) return
    setIngredients((prev) => prev.filter((_, i) => i !== index))
  }

  // Quick populate ingredient row from saved food catalog
  const handleAutofillFromSavedFood = (index: number, savedFoodId: string) => {
    const food = savedFoods.find((f) => f.id === savedFoodId)
    if (!food) return
    setIngredients((prev) =>
      prev.map((ing, i) =>
        i === index
          ? {
              food_name: food.name,
              quantity: String(food.default_quantity),
              unit: food.default_unit,
              calories: String(food.calories),
              protein_g: String(food.protein_g),
              carbs_g: String(food.carbs_g),
              fat_g: String(food.fat_g),
              fiber_g: String(food.fiber_g),
            }
          : ing
      )
    )
  }

  // Submit New Recipe
  const handleCreateRecipe = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccessMessage(null)

    if (!recipeName.trim()) {
      setError('Please enter a recipe name.')
      return
    }

    const servingsNum = Number(recipeServings)
    if (isNaN(servingsNum) || servingsNum <= 0) {
      setError('Please enter a valid positive serving yield.')
      return
    }

    const validIngredients = ingredients.filter((ing) => ing.food_name.trim().length > 0)
    if (validIngredients.length === 0) {
      setError('Please add at least one named ingredient.')
      return
    }

    setIsSubmitting(true)

    try {
      await saveRecipe(
        recipeName.trim(),
        recipeDescription.trim() || null,
        servingsNum,
        validIngredients.map((i) => ({
          food_name: i.food_name.trim(),
          quantity: Math.max(0.01, Number(i.quantity) || 1),
          unit: i.unit.trim() || 'g',
          calories: Math.max(0, Number(i.calories) || 0),
          protein_g: Math.max(0, Number(i.protein_g) || 0),
          carbs_g: Math.max(0, Number(i.carbs_g) || 0),
          fat_g: Math.max(0, Number(i.fat_g) || 0),
          fiber_g: Math.max(0, Number(i.fiber_g) || 0),
        }))
      )

      // Reset form
      setRecipeName('')
      setRecipeDescription('')
      setRecipeServings('2')
      setIngredients([
        {
          food_name: '',
          quantity: '100',
          unit: 'g',
          calories: '',
          protein_g: '',
          carbs_g: '',
          fat_g: '',
          fiber_g: '',
        },
      ])
      setShowCreateRecipe(false)
      setSuccessMessage('Recipe successfully created and saved to your catalog!')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save recipe')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Quick Log Saved Food to Current Day
  const handleExecuteQuickLogFood = async (food: DbSavedFood) => {
    if (isDayClosed) {
      setError('The current day is finalized. Reopen it to log food.')
      return
    }
    setIsSubmitting(true)
    setError(null)
    try {
      await addFoodItem({
        category: quickLogCategory,
        food_name: food.name,
        quantity: food.default_quantity,
        unit: food.default_unit,
        calories: food.calories,
        protein_g: food.protein_g,
        carbs_g: food.carbs_g,
        fat_g: food.fat_g,
        fiber_g: food.fiber_g,
      })
      setQuickLogFoodId(null)
      onClose()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to log food')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Quick Log Recipe to Current Day
  const handleExecuteQuickLogRecipe = async (recipe: SavedRecipeWithItems) => {
    if (isDayClosed) {
      setError('The current day is finalized. Reopen it to log food.')
      return
    }
    setIsSubmitting(true)
    setError(null)
    try {
      await logRecipeToMeal(quickLogCategory, recipe, Number(quickLogServings) || 1)
      setQuickLogRecipeId(null)
      onClose()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to log recipe')
    } finally {
      setIsSubmitting(false)
    }
  }

  const filteredFoods = savedFoods.filter((f) =>
    f.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const filteredRecipes = savedRecipes.filter((r) =>
    r.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      const isDirty =
        (showCreateFood && newFoodName.trim() !== '') ||
        (showCreateRecipe && (recipeName.trim() !== '' || ingredients.length > 0))
      if (!isDirty) {
        onClose()
      }
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={handleBackdropClick}
    >
      <div
        className="w-full max-w-2xl bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl shadow-xl overflow-hidden animate-in zoom-in-95 duration-150 flex flex-col max-h-[92vh]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="saved-foods-title"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--color-border)] shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[var(--color-accent-subtle)] text-[var(--color-accent-text)] flex items-center justify-center">
              <Bookmark className="w-4 h-4" />
            </div>
            <div>
              <h3 id="saved-foods-title" className="text-base font-bold text-[var(--color-text-primary)]">
                Saved Foods & Recipes Catalog
              </h3>
              <p className="text-xs text-[var(--color-text-muted)]">
                Manage reusable ingredients and multi-ingredient composite recipes
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-11 h-11 flex items-center justify-center rounded-xl text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-hover)] transition-colors cursor-pointer"
            aria-label="Close dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Bar & Action Controls */}
        <div className="flex items-center justify-between border-b border-[var(--color-border)] bg-[var(--color-surface-subtle)] px-6 pt-2 shrink-0">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                setActiveTab('foods')
                setError(null)
                setSuccessMessage(null)
              }}
              className={`pb-2.5 px-3 text-xs font-semibold border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'foods'
                  ? 'border-[var(--color-accent)] text-[var(--color-accent-text)]'
                  : 'border-transparent text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
              }`}
            >
              <Bookmark className="w-3.5 h-3.5" />
              Saved Foods ({savedFoods.length})
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab('recipes')
                setError(null)
                setSuccessMessage(null)
              }}
              className={`pb-2.5 px-3 text-xs font-semibold border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'recipes'
                  ? 'border-[var(--color-accent)] text-[var(--color-accent-text)]'
                  : 'border-transparent text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5" />
              Saved Recipes ({savedRecipes.length})
            </button>
          </div>

          <div className="pb-2">
            {activeTab === 'foods' ? (
              <Button
                variant="primary"
                size="sm"
                icon={<Plus className="w-3.5 h-3.5" />}
                onClick={() => {
                  setShowCreateFood((prev) => !prev)
                  setError(null)
                  setSuccessMessage(null)
                }}
              >
                {showCreateFood ? 'Close Form' : 'New Food'}
              </Button>
            ) : (
              <Button
                variant="primary"
                size="sm"
                icon={<Plus className="w-3.5 h-3.5" />}
                onClick={() => {
                  setShowCreateRecipe((prev) => !prev)
                  setError(null)
                  setSuccessMessage(null)
                }}
              >
                {showCreateRecipe ? 'Close Form' : 'Create Recipe'}
              </Button>
            )}
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="p-6 overflow-y-auto space-y-4 flex-1">
          {error && (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-xs text-red-500 font-medium animate-in fade-in">
              {error}
            </div>
          )}

          {successMessage && (
            <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1.5 animate-in fade-in">
              <Sparkles className="w-3.5 h-3.5 shrink-0" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* TAB 1: SAVED FOODS */}
          {activeTab === 'foods' && (
            <div className="space-y-4">
              {/* Create Food Inline Form */}
              {showCreateFood && (
                <form
                  onSubmit={handleCreateFood}
                  className="p-4 rounded-xl border border-[var(--color-accent)]/30 bg-[var(--color-surface-subtle)] space-y-3 animate-in fade-in"
                >
                  <h4 className="text-xs font-bold text-[var(--color-text-primary)] uppercase tracking-wider">
                    Add New Saved Food
                  </h4>
                  <Input
                    label="Food Name"
                    placeholder="e.g. Rolled Oats"
                    value={newFoodName}
                    onChange={(e) => setNewFoodName(e.target.value)}
                    required
                  />
                  <div className="grid grid-cols-2 gap-2.5">
                    <Input
                      label="Default Quantity"
                      type="number"
                      step="any"
                      min="0.01"
                      value={newFoodQty}
                      onChange={(e) => setNewFoodQty(e.target.value)}
                      required
                    />
                    <Input
                      label="Default Unit"
                      placeholder="g, cup, serving"
                      value={newFoodUnit}
                      onChange={(e) => setNewFoodUnit(e.target.value)}
                      required
                    />
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                    <Input
                      label="Calories"
                      type="number"
                      step="any"
                      min="0"
                      value={newFoodCal}
                      onChange={(e) => setNewFoodCal(e.target.value)}
                      required
                    />
                    <Input
                      label="Protein"
                      type="number"
                      step="any"
                      min="0"
                      value={newFoodP}
                      onChange={(e) => setNewFoodP(e.target.value)}
                    />
                    <Input
                      label="Carbs"
                      type="number"
                      step="any"
                      min="0"
                      value={newFoodC}
                      onChange={(e) => setNewFoodC(e.target.value)}
                    />
                    <Input
                      label="Fat"
                      type="number"
                      step="any"
                      min="0"
                      value={newFoodF}
                      onChange={(e) => setNewFoodF(e.target.value)}
                    />
                    <Input
                      label="Fiber"
                      type="number"
                      step="any"
                      min="0"
                      value={newFoodFiber}
                      onChange={(e) => setNewFoodFiber(e.target.value)}
                    />
                  </div>
                  <div className="flex justify-end gap-2 pt-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setShowCreateFood(false)}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      variant="primary"
                      size="sm"
                      disabled={isSubmitting}
                      icon={isSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : undefined}
                    >
                      {isSubmitting ? 'Saving...' : 'Save to Catalog'}
                    </Button>
                  </div>
                </form>
              )}

              {/* Search Bar */}
              <Input
                placeholder="Search saved foods..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                leftIcon={<Search className="w-4 h-4" />}
              />

              {/* Foods List */}
              {savedFoods.length === 0 ? (
                <div className="py-12 text-center text-xs text-[var(--color-text-muted)] border border-dashed rounded-xl border-[var(--color-border)] p-6 space-y-3">
                  <Bookmark className="w-8 h-8 mx-auto opacity-30 text-[var(--color-accent)]" />
                  <p className="font-semibold text-[var(--color-text-primary)]">No saved foods yet</p>
                  <p>Click "New Food" above to create reusable foods with standard quantities and macros.</p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {filteredFoods.map((food) => (
                    <div
                      key={food.id}
                      className="p-3.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] hover:bg-[var(--color-surface-hover)]/40 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div>
                        <h4 className="text-xs font-bold text-[var(--color-text-primary)]">
                          {food.name}
                        </h4>
                        <p className="text-[11px] text-[var(--color-text-muted)] mt-0.5">
                          Per {food.default_quantity} {food.default_unit} •{' '}
                          <span className="font-semibold text-[var(--color-text-primary)]">
                            {food.calories} kcal
                          </span>{' '}
                          • <span className="text-blue-500 font-semibold">{food.protein_g}g P</span> •{' '}
                          <span className="text-amber-500 font-semibold">{food.carbs_g}g C</span> •{' '}
                          <span className="text-purple-500 font-semibold">{food.fat_g}g F</span>
                          {Number(food.fiber_g) > 0 && (
                            <span className="text-emerald-500 font-semibold"> • {food.fiber_g}g Fiber</span>
                          )}
                        </p>
                      </div>

                      <div className="flex items-center gap-2 self-end sm:self-auto">
                        {quickLogFoodId === food.id ? (
                          <div className="flex items-center gap-1.5 animate-in fade-in">
                            <select
                              value={quickLogCategory}
                              onChange={(e) => setQuickLogCategory(e.target.value as MealCategory)}
                              className="text-[11px] py-1 px-2 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text-primary)] hover:border-[var(--color-text-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)] transition-all cursor-pointer"
                            >
                              <option value="breakfast">Breakfast</option>
                              <option value="lunch">Lunch</option>
                              <option value="snack">Snack</option>
                              <option value="dinner">Dinner</option>
                            </select>
                            <Button
                              variant="primary"
                              size="sm"
                              disabled={isSubmitting}
                              onClick={() => handleExecuteQuickLogFood(food)}
                            >
                              Log
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setQuickLogFoodId(null)}
                            >
                              Cancel
                            </Button>
                          </div>
                        ) : (
                          <Button
                            variant="secondary"
                            size="sm"
                            disabled={isDayClosed}
                            icon={<CalendarPlus className="w-3.5 h-3.5" />}
                            onClick={() => setQuickLogFoodId(food.id)}
                          >
                            Log Today
                          </Button>
                        )}

                        <button
                          type="button"
                          onClick={() => deleteSavedFood(food.id)}
                          className="p-1.5 rounded-lg text-red-500/80 hover:text-red-600 hover:bg-red-500/10 transition-colors cursor-pointer"
                          title="Delete saved food"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: SAVED RECIPES */}
          {activeTab === 'recipes' && (
            <div className="space-y-4">
              {/* CREATE RECIPE FORM (Requirement 1-8) */}
              {showCreateRecipe && (
                <form
                  onSubmit={handleCreateRecipe}
                  className="p-5 rounded-2xl border border-[var(--color-accent)]/30 bg-[var(--color-surface-subtle)] space-y-4 animate-in fade-in"
                >
                  <div className="flex items-center justify-between pb-2 border-b border-[var(--color-border)]">
                    <div>
                      <h4 className="text-sm font-bold text-[var(--color-text-primary)]">
                        Create Multi-Ingredient Recipe
                      </h4>
                      <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">
                        Add ingredients and specify serving yield. Nutrition is calculated automatically.
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowCreateRecipe(false)}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>

                  {/* 1. Recipe Basics */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="sm:col-span-2">
                      <Input
                        label="Recipe Name"
                        placeholder="e.g. Post-Workout Oatmeal & Whey"
                        value={recipeName}
                        onChange={(e) => setRecipeName(e.target.value)}
                        required
                      />
                    </div>
                    <div>
                      <Input
                        label="Serving Yield"
                        type="number"
                        step="any"
                        min="1"
                        value={recipeServings}
                        onChange={(e) => setRecipeServings(e.target.value)}
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <Input
                      label="Description or Instructions (optional)"
                      placeholder="e.g. Combine rolled oats, almond milk, and whey protein"
                      value={recipeDescription}
                      onChange={(e) => setRecipeDescription(e.target.value)}
                    />
                  </div>

                  {/* 2. Ingredients Builder (Requirement 5 & 6) */}
                  <div className="space-y-3 pt-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-[var(--color-text-primary)] uppercase tracking-wider">
                        Recipe Ingredients ({ingredients.length})
                      </span>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        icon={<Plus className="w-3.5 h-3.5" />}
                        onClick={handleAddIngredientRow}
                      >
                        Add Ingredient
                      </Button>
                    </div>

                    <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
                      {ingredients.map((ing, idx) => (
                        <div
                          key={idx}
                          className="p-3.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-xs space-y-2.5"
                        >
                          {/* Row Top: Food Name, Autofill Shortcut, Delete */}
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-bold text-[var(--color-text-muted)]">
                              #{idx + 1}
                            </span>

                            {/* Saved foods quick selector if user has saved items */}
                            {savedFoods.length > 0 && (
                              <div className="flex items-center gap-1.5 ml-auto">
                                <span className="text-[10px] text-[var(--color-text-muted)]">Autofill:</span>
                                <select
                                  onChange={(e) => {
                                    if (e.target.value) {
                                      handleAutofillFromSavedFood(idx, e.target.value)
                                      e.target.value = ''
                                    }
                                  }}
                                  defaultValue=""
                                  className="text-[11px] py-0.5 px-2 rounded-md bg-[var(--color-surface-subtle)] border border-[var(--color-border)] text-[var(--color-text-primary)] hover:border-[var(--color-text-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)] transition-all cursor-pointer"
                                >
                                  <option value="" disabled>
                                    Pick saved food...
                                  </option>
                                  {savedFoods.map((f) => (
                                    <option key={f.id} value={f.id}>
                                      {f.name} ({f.calories} kcal)
                                    </option>
                                  ))}
                                </select>
                              </div>
                            )}

                            <button
                              type="button"
                              onClick={() => handleRemoveIngredientRow(idx)}
                              disabled={ingredients.length <= 1}
                              className="p-1 rounded text-red-500/80 hover:text-red-600 hover:bg-red-500/10 transition-colors disabled:opacity-30 cursor-pointer"
                              title={ingredients.length <= 1 ? 'At least one ingredient is required' : 'Remove ingredient'}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          {/* Ingredient Name, Quantity, Unit */}
                          <div className="grid grid-cols-12 gap-2">
                            <div className="col-span-12 sm:col-span-6">
                              <label className="text-[10px] font-bold text-[var(--color-text-secondary)] uppercase block mb-1">
                                Ingredient Name
                              </label>
                              <input
                                type="text"
                                placeholder="e.g. Rolled Oats"
                                value={ing.food_name}
                                onChange={(e) =>
                                  handleUpdateIngredientRow(idx, 'food_name', e.target.value)
                                }
                                className="w-full text-xs p-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-subtle)] text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-accent)]"
                                required
                              />
                            </div>
                            <div className="col-span-6 sm:col-span-3">
                              <label className="text-[10px] font-bold text-[var(--color-text-secondary)] uppercase block mb-1">
                                Quantity
                              </label>
                              <input
                                type="number"
                                step="any"
                                min="0.01"
                                placeholder="100"
                                value={ing.quantity}
                                onChange={(e) =>
                                  handleUpdateIngredientRow(idx, 'quantity', e.target.value)
                                }
                                className="w-full text-xs p-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-subtle)] text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-accent)]"
                                required
                              />
                            </div>
                            <div className="col-span-6 sm:col-span-3">
                              <label className="text-[10px] font-bold text-[var(--color-text-secondary)] uppercase block mb-1">
                                Unit
                              </label>
                              <input
                                type="text"
                                placeholder="g, ml, cup, tbsp"
                                value={ing.unit}
                                onChange={(e) =>
                                  handleUpdateIngredientRow(idx, 'unit', e.target.value)
                                }
                                className="w-full text-xs p-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-subtle)] text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-accent)]"
                                required
                              />
                            </div>
                          </div>

                          {/* Nutrition: Calories, Protein, Carbs, Fat, Fibre */}
                          <div className="grid grid-cols-5 gap-1.5">
                            <div>
                              <label className="text-[10px] text-[var(--color-text-muted)] block mb-0.5">
                                Kcal
                              </label>
                              <input
                                type="number"
                                step="any"
                                min="0"
                                placeholder="0"
                                value={ing.calories}
                                onChange={(e) =>
                                  handleUpdateIngredientRow(idx, 'calories', e.target.value)
                                }
                                className="w-full text-xs p-1.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-subtle)] text-[var(--color-text-primary)] text-center font-bold"
                              />
                            </div>
                            <div>
                              <label className="text-[10px] text-blue-500 font-semibold block mb-0.5 text-center">
                                Protein
                              </label>
                              <input
                                type="number"
                                step="any"
                                min="0"
                                placeholder="0g"
                                value={ing.protein_g}
                                onChange={(e) =>
                                  handleUpdateIngredientRow(idx, 'protein_g', e.target.value)
                                }
                                className="w-full text-xs p-1.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-subtle)] text-[var(--color-text-primary)] text-center"
                              />
                            </div>
                            <div>
                              <label className="text-[10px] text-amber-500 font-semibold block mb-0.5 text-center">
                                Carbs
                              </label>
                              <input
                                type="number"
                                step="any"
                                min="0"
                                placeholder="0g"
                                value={ing.carbs_g}
                                onChange={(e) =>
                                  handleUpdateIngredientRow(idx, 'carbs_g', e.target.value)
                                }
                                className="w-full text-xs p-1.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-subtle)] text-[var(--color-text-primary)] text-center"
                              />
                            </div>
                            <div>
                              <label className="text-[10px] text-purple-500 font-semibold block mb-0.5 text-center">
                                Fat
                              </label>
                              <input
                                type="number"
                                step="any"
                                min="0"
                                placeholder="0g"
                                value={ing.fat_g}
                                onChange={(e) =>
                                  handleUpdateIngredientRow(idx, 'fat_g', e.target.value)
                                }
                                className="w-full text-xs p-1.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-subtle)] text-[var(--color-text-primary)] text-center"
                              />
                            </div>
                            <div>
                              <label className="text-[10px] text-emerald-500 font-semibold block mb-0.5 text-center">
                                Fibre
                              </label>
                              <input
                                type="number"
                                step="any"
                                min="0"
                                placeholder="0g"
                                value={ing.fiber_g}
                                onChange={(e) =>
                                  handleUpdateIngredientRow(idx, 'fiber_g', e.target.value)
                                }
                                className="w-full text-xs p-1.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-subtle)] text-[var(--color-text-primary)] text-center"
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* 3. Live Recipe Nutrition Calculation Summary (Requirement 7) */}
                  <div className="p-3.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-xs space-y-2">
                    <div className="flex items-center justify-between text-xs font-bold text-[var(--color-text-primary)]">
                      <span className="flex items-center gap-1.5 uppercase tracking-wider text-[11px] text-[var(--color-text-secondary)]">
                        <Calculator className="w-3.5 h-3.5 text-[var(--color-accent)]" />
                        Live Calculated Nutrition
                      </span>
                      <span className="text-[11px] text-[var(--color-text-muted)] font-normal">
                        Yield: {recipeServings || 1} {Number(recipeServings) === 1 ? 'serving' : 'servings'}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-3 pt-1 border-t border-[var(--color-border)]/60">
                      {/* Total Recipe */}
                      <div className="p-2.5 rounded-lg bg-[var(--color-surface-subtle)] space-y-1">
                        <span className="text-[10px] uppercase font-bold text-[var(--color-text-muted)] tracking-wider block">
                          Total Recipe Yield
                        </span>
                        <p className="text-sm font-black text-[var(--color-text-primary)]">
                          {recipeCalculations.total.calories}{' '}
                          <span className="text-xs font-normal text-[var(--color-text-muted)]">kcal</span>
                        </p>
                        <div className="flex flex-wrap gap-x-2 gap-y-0.5 text-[11px]">
                          <span className="text-blue-500 font-semibold">{recipeCalculations.total.protein_g}g P</span>
                          <span className="text-amber-500 font-semibold">{recipeCalculations.total.carbs_g}g C</span>
                          <span className="text-purple-500 font-semibold">{recipeCalculations.total.fat_g}g F</span>
                          <span className="text-emerald-500 font-semibold">{recipeCalculations.total.fiber_g}g Fiber</span>
                        </div>
                      </div>

                      {/* Per Serving */}
                      <div className="p-2.5 rounded-lg bg-[var(--color-surface-subtle)] space-y-1">
                        <span className="text-[10px] uppercase font-bold text-[var(--color-text-muted)] tracking-wider block">
                          Per Serving
                        </span>
                        <p className="text-sm font-black text-[var(--color-accent-text)]">
                          {recipeCalculations.perServing.calories}{' '}
                          <span className="text-xs font-normal text-[var(--color-text-muted)]">kcal</span>
                        </p>
                        <div className="flex flex-wrap gap-x-2 gap-y-0.5 text-[11px]">
                          <span className="text-blue-500 font-semibold">{recipeCalculations.perServing.protein_g}g P</span>
                          <span className="text-amber-500 font-semibold">{recipeCalculations.perServing.carbs_g}g C</span>
                          <span className="text-purple-500 font-semibold">{recipeCalculations.perServing.fat_g}g F</span>
                          <span className="text-emerald-500 font-semibold">{recipeCalculations.perServing.fiber_g}g Fiber</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 4. Form Actions */}
                  <div className="flex justify-end gap-2 pt-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setShowCreateRecipe(false)}
                      disabled={isSubmitting}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      variant="primary"
                      size="sm"
                      disabled={isSubmitting}
                      icon={isSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : undefined}
                    >
                      {isSubmitting ? 'Saving Recipe...' : 'Save Recipe Template'}
                    </Button>
                  </div>
                </form>
              )}

              {/* Search Bar */}
              <Input
                placeholder="Search saved recipes..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                leftIcon={<Search className="w-4 h-4" />}
              />

              {/* Recipe List */}
              {savedRecipes.length === 0 ? (
                <div className="py-12 text-center text-xs text-[var(--color-text-muted)] border border-dashed rounded-xl border-[var(--color-border)] p-6 space-y-3">
                  <BookOpen className="w-10 h-10 mx-auto text-[var(--color-accent)] opacity-40" />
                  <div className="space-y-1">
                    <p className="font-bold text-sm text-[var(--color-text-primary)]">No saved recipes yet</p>
                    <p className="text-xs text-[var(--color-text-secondary)] max-w-sm mx-auto">
                      Build composite recipes with multiple ingredients. When logged to a meal, ingredients scale automatically.
                    </p>
                  </div>
                  {!showCreateRecipe && (
                    <Button
                      variant="primary"
                      size="sm"
                      icon={<Plus className="w-3.5 h-3.5" />}
                      onClick={() => {
                        setShowCreateRecipe(true)
                        setError(null)
                        setSuccessMessage(null)
                      }}
                    >
                      Create Recipe
                    </Button>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredRecipes.map((recipe) => {
                    const totalCal = recipe.items.reduce((acc, i) => acc + Number(i.calories || 0), 0)
                    const totalP = Math.round(recipe.items.reduce((acc, i) => acc + Number(i.protein_g || 0), 0) * 10) / 10
                    const totalC = Math.round(recipe.items.reduce((acc, i) => acc + Number(i.carbs_g || 0), 0) * 10) / 10
                    const totalF = Math.round(recipe.items.reduce((acc, i) => acc + Number(i.fat_g || 0), 0) * 10) / 10
                    const totalFiber = Math.round(recipe.items.reduce((acc, i) => acc + Number(i.fiber_g || 0), 0) * 10) / 10

                    return (
                      <div
                        key={recipe.id}
                        className="p-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] space-y-3 shadow-xs"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                          <div>
                            <h4 className="text-xs font-bold text-[var(--color-text-primary)]">
                              {recipe.name}
                            </h4>
                            {recipe.description && (
                              <p className="text-[11px] text-[var(--color-text-secondary)] mt-0.5">
                                {recipe.description}
                              </p>
                            )}
                            <p className="text-[11px] text-[var(--color-text-muted)] mt-1">
                              Yield: {recipe.servings} {recipe.servings === 1 ? 'serving' : 'servings'} • Total:{' '}
                              <span className="font-semibold text-[var(--color-text-primary)]">
                                {totalCal} kcal
                              </span>{' '}
                              ({totalP}g P • {totalC}g C • {totalF}g F
                              {totalFiber > 0 && ` • ${totalFiber}g Fiber`})
                            </p>
                          </div>

                          <div className="flex items-center gap-2">
                            {quickLogRecipeId === recipe.id ? (
                              <div className="flex items-center gap-1.5 animate-in fade-in">
                                <select
                                  value={quickLogCategory}
                                  onChange={(e) => setQuickLogCategory(e.target.value as MealCategory)}
                                  className="text-[11px] py-1 px-2 rounded-lg bg-[var(--color-surface-subtle)] border border-[var(--color-border)] text-[var(--color-text-primary)] hover:border-[var(--color-text-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)] transition-all cursor-pointer"
                                >
                                  <option value="breakfast">Breakfast</option>
                                  <option value="lunch">Lunch</option>
                                  <option value="snack">Snack</option>
                                  <option value="dinner">Dinner</option>
                                </select>
                                <input
                                  type="number"
                                  min="0.25"
                                  step="0.25"
                                  value={quickLogServings}
                                  onChange={(e) => setQuickLogServings(e.target.value)}
                                  className="w-16 text-[11px] py-1 px-1.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-subtle)]"
                                  title="Servings to log"
                                />
                                <Button
                                  variant="primary"
                                  size="sm"
                                  disabled={isSubmitting}
                                  onClick={() => handleExecuteQuickLogRecipe(recipe)}
                                >
                                  Log
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setQuickLogRecipeId(null)}
                                >
                                  Cancel
                                </Button>
                              </div>
                            ) : (
                              <Button
                                variant="secondary"
                                size="sm"
                                disabled={isDayClosed}
                                icon={<CalendarPlus className="w-3.5 h-3.5" />}
                                onClick={() => setQuickLogRecipeId(recipe.id)}
                              >
                                Log Recipe
                              </Button>
                            )}

                            <button
                              type="button"
                              onClick={() => deleteSavedRecipe(recipe.id)}
                              className="p-1.5 rounded-lg text-red-500/80 hover:text-red-600 hover:bg-red-500/10 transition-colors cursor-pointer"
                              title="Delete recipe"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>

                        {/* Ingredients Breakdown */}
                        <div className="pt-2 border-t border-[var(--color-border)]/60 text-[11px] text-[var(--color-text-muted)] space-y-1">
                          <p className="font-semibold text-[var(--color-text-secondary)] text-[10.5px] uppercase">
                            Ingredients ({recipe.items.length}):
                          </p>
                          <ul className="list-disc list-inside space-y-0.5">
                            {recipe.items.map((ing) => (
                              <li key={ing.id}>
                                <span className="font-medium text-[var(--color-text-primary)]">
                                  {ing.food_name}
                                </span>{' '}
                                — {ing.quantity} {ing.unit} ({ing.calories} kcal, {ing.protein_g}g P, {ing.carbs_g}g C, {ing.fat_g}g F{Number(ing.fiber_g) > 0 && `, ${ing.fiber_g}g Fiber`})
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
