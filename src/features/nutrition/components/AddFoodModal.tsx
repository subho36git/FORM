import React, { useState, useEffect } from 'react'
import { X, Plus, Utensils, BookOpen, Bookmark, Loader2, Search } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { useNutrition } from '../context/NutritionContext'
import type { MealCategory, DbSavedFood, SavedRecipeWithItems } from '../types'

interface AddFoodModalProps {
  isOpen: boolean
  onClose: () => void
  defaultCategory?: MealCategory
}

const CATEGORIES: { value: MealCategory; label: string }[] = [
  { value: 'breakfast', label: 'Breakfast' },
  { value: 'lunch', label: 'Lunch' },
  { value: 'dinner', label: 'Dinner' },
  { value: 'snack', label: 'Snacks' },
]

export const AddFoodModal: React.FC<AddFoodModalProps> = ({
  isOpen,
  onClose,
  defaultCategory = 'breakfast',
}) => {
  const { addFoodItem, savedFoods, savedRecipes, logRecipeToMeal, openSavedManager } = useNutrition()

  // Tab: 'custom' | 'saved_food' | 'saved_recipe'
  const [activeTab, setActiveTab] = useState<'custom' | 'saved_food' | 'saved_recipe'>('custom')

  // Form Fields
  const [category, setCategory] = useState<MealCategory>(defaultCategory)
  const [name, setName] = useState('')
  const [quantity, setQuantity] = useState('100')
  const [unit, setUnit] = useState('g')
  const [calories, setCalories] = useState('')
  const [protein, setProtein] = useState('')
  const [carbs, setCarbs] = useState('')
  const [fat, setFat] = useState('')
  const [fiber, setFiber] = useState('')
  const [notes, setNotes] = useState('')
  const [saveToSaved, setSaveToSaved] = useState(false)

  // Saved selection state
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedSavedFood, setSelectedSavedFood] = useState<DbSavedFood | null>(null)
  const [savedFoodPortion, setSavedFoodPortion] = useState('100')

  // Recipe selection state
  const [selectedRecipe, setSelectedRecipe] = useState<SavedRecipeWithItems | null>(null)
  const [recipeServings, setRecipeServings] = useState('1')

  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // ESC key to close modal
  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen) return null

  // 1. Submit Custom Food
  const handleCustomSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!name.trim()) {
      setError('Please provide a food name.')
      return
    }

    const qtyNum = Number(quantity)
    if (isNaN(qtyNum) || qtyNum <= 0) {
      setError('Please enter a valid positive quantity.')
      return
    }

    const calNum = Number(calories)
    if (isNaN(calNum) || calNum < 0) {
      setError('Please enter valid non-negative calories.')
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      await addFoodItem({
        category,
        food_name: name.trim(),
        quantity: qtyNum,
        unit: unit.trim() || 'g',
        calories: calNum,
        protein_g: Number(protein) || 0,
        carbs_g: Number(carbs) || 0,
        fat_g: Number(fat) || 0,
        fiber_g: Number(fiber) || 0,
        notes: notes.trim() || null,
        saveToSavedFoods: saveToSaved,
      })
      onClose()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to add food item'
      setError(msg)
    } finally {
      setIsSubmitting(false)
    }
  }

  // 2. Submit Selected Saved Food
  const handleLogSavedFood = async () => {
    if (!selectedSavedFood) return

    const portion = Number(savedFoodPortion)
    if (isNaN(portion) || portion <= 0) {
      setError('Please enter a valid portion amount.')
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      // Scale nutrients according to portion / default_quantity
      const defaultQty = Number(selectedSavedFood.default_quantity) || 100
      const scale = portion / defaultQty

      await addFoodItem({
        category,
        food_name: selectedSavedFood.name,
        quantity: portion,
        unit: selectedSavedFood.default_unit,
        calories: Math.round(selectedSavedFood.calories * scale),
        protein_g: Math.round(selectedSavedFood.protein_g * scale * 10) / 10,
        carbs_g: Math.round(selectedSavedFood.carbs_g * scale * 10) / 10,
        fat_g: Math.round(selectedSavedFood.fat_g * scale * 10) / 10,
        fiber_g: Math.round(selectedSavedFood.fiber_g * scale * 10) / 10,
        notes: `Logged from saved food (${portion} ${selectedSavedFood.default_unit})`,
      })
      onClose()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to log saved food'
      setError(msg)
    } finally {
      setIsSubmitting(false)
    }
  }

  // 3. Submit Selected Saved Recipe
  const handleLogSavedRecipe = async () => {
    if (!selectedRecipe) return

    const servings = Number(recipeServings)
    if (isNaN(servings) || servings <= 0) {
      setError('Please enter valid recipe servings.')
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      await logRecipeToMeal(category, selectedRecipe, servings)
      onClose()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to log recipe'
      setError(msg)
    } finally {
      setIsSubmitting(false)
    }
  }

  const filteredSavedFoods = savedFoods.filter((f) =>
    f.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const filteredSavedRecipes = savedRecipes.filter((r) =>
    r.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      const isDirty =
        (activeTab === 'custom' && (name.trim() !== '' || calories !== '' || notes.trim() !== '')) ||
        (activeTab === 'saved_food' && selectedSavedFood !== null) ||
        (activeTab === 'saved_recipe' && selectedRecipe !== null)
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
        className="w-full max-w-lg bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl shadow-xl overflow-hidden animate-in zoom-in-95 duration-150 flex flex-col max-h-[90vh]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-food-title"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--color-border)] shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[var(--color-accent-subtle)] text-[var(--color-accent-text)] flex items-center justify-center">
              <Utensils className="w-4 h-4" />
            </div>
            <div>
              <h3 id="add-food-title" className="text-base font-bold text-[var(--color-text-primary)]">
                Log Food to Diary
              </h3>
              <p className="text-xs text-[var(--color-text-muted)]">Add custom items or log from your saved catalog</p>
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

        {/* Source Mode Tabs */}
        <div className="flex border-b border-[var(--color-border)] bg-[var(--color-surface-subtle)] px-6 pt-2 gap-2 shrink-0">
          <button
            type="button"
            onClick={() => {
              setActiveTab('custom')
              setError(null)
            }}
            className={`pb-2.5 px-3 text-xs font-semibold border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'custom'
                ? 'border-[var(--color-accent)] text-[var(--color-accent-text)]'
                : 'border-transparent text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
            }`}
          >
            <Plus className="w-3.5 h-3.5" />
            Custom Item
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('saved_food')
              setError(null)
            }}
            className={`pb-2.5 px-3 text-xs font-semibold border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'saved_food'
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
              setActiveTab('saved_recipe')
              setError(null)
            }}
            className={`pb-2.5 px-3 text-xs font-semibold border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'saved_recipe'
                ? 'border-[var(--color-accent)] text-[var(--color-accent-text)]'
                : 'border-transparent text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            Saved Recipes ({savedRecipes.length})
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-6 overflow-y-auto space-y-4 flex-1">
          {error && (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-xs text-red-500 font-medium">
              {error}
            </div>
          )}

          {/* Meal Category Select (Applies to all tabs) */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">
              Target Meal
            </label>
            <div className="grid grid-cols-4 gap-2">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat.value}
                  type="button"
                  onClick={() => setCategory(cat.value)}
                  className={`py-2 px-1 text-xs font-semibold rounded-lg border transition-all cursor-pointer text-center ${
                    category === cat.value
                      ? 'bg-[var(--color-accent)] text-white border-[var(--color-accent)] shadow-xs'
                      : 'bg-[var(--color-surface-subtle)] text-[var(--color-text-secondary)] border-[var(--color-border)] hover:bg-[var(--color-surface-hover)]'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </div>

          {/* TAB 1: CUSTOM FOOD ENTRY */}
          {activeTab === 'custom' && (
            <form onSubmit={handleCustomSubmit} className="space-y-4">
              <Input
                label="Food Name"
                placeholder="e.g. Grilled Chicken Breast"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />

              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="Quantity"
                  type="number"
                  step="any"
                  min="0.01"
                  placeholder="100"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  required
                />
                <Input
                  label="Unit"
                  placeholder="g, cup, serving, oz"
                  value={unit}
                  onChange={(e) => setUnit(e.target.value)}
                  required
                />
              </div>

              {/* Calories & Macros Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <Input
                  label="Calories (kcal)"
                  type="number"
                  step="any"
                  min="0"
                  placeholder="0"
                  value={calories}
                  onChange={(e) => setCalories(e.target.value)}
                  required
                />
                <Input
                  label="Protein (g)"
                  type="number"
                  step="any"
                  min="0"
                  placeholder="0"
                  value={protein}
                  onChange={(e) => setProtein(e.target.value)}
                />
                <Input
                  label="Carbs (g)"
                  type="number"
                  step="any"
                  min="0"
                  placeholder="0"
                  value={carbs}
                  onChange={(e) => setCarbs(e.target.value)}
                />
                <Input
                  label="Fat (g)"
                  type="number"
                  step="any"
                  min="0"
                  placeholder="0"
                  value={fat}
                  onChange={(e) => setFat(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="Fiber (g, optional)"
                  type="number"
                  step="any"
                  min="0"
                  placeholder="0"
                  value={fiber}
                  onChange={(e) => setFiber(e.target.value)}
                />
                <Input
                  label="Notes (optional)"
                  placeholder="e.g. Skinless, air fried"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>

              {/* Save to repository checkbox */}
              <label className="flex items-center gap-2 text-xs text-[var(--color-text-secondary)] cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={saveToSaved}
                  onChange={(e) => setSaveToSaved(e.target.checked)}
                  className="rounded text-[var(--color-accent)] focus:ring-[var(--color-accent)] w-4 h-4 cursor-pointer"
                />
                <span>Save to my Saved Foods catalog for quick reuse</span>
              </label>

              {/* Actions */}
              <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-[var(--color-border)]">
                <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  disabled={isSubmitting}
                  icon={isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                >
                  {isSubmitting ? 'Logging...' : 'Log Food'}
                </Button>
              </div>
            </form>
          )}

          {/* TAB 2: SELECT SAVED FOOD */}
          {activeTab === 'saved_food' && (
            <div className="space-y-4">
              <Input
                placeholder="Search saved foods..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                leftIcon={<Search className="w-4 h-4" />}
              />

              {savedFoods.length === 0 ? (
                <div className="p-8 text-center text-xs text-[var(--color-text-muted)] border border-dashed rounded-xl border-[var(--color-border)]">
                  <Bookmark className="w-6 h-6 mx-auto mb-2 opacity-40" />
                  <p>You have no saved foods yet.</p>
                  <p className="mt-1">Save foods when logging or create them in Saved Foods manager.</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                  {filteredSavedFoods.map((f) => {
                    const isSelected = selectedSavedFood?.id === f.id
                    return (
                      <div
                        key={f.id}
                        onClick={() => {
                          setSelectedSavedFood(f)
                          setSavedFoodPortion(f.default_quantity.toString())
                        }}
                        className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                          isSelected
                            ? 'bg-[var(--color-accent-subtle)] border-[var(--color-accent)] shadow-xs'
                            : 'bg-[var(--color-surface)] border-[var(--color-border)] hover:bg-[var(--color-surface-hover)]'
                        }`}
                      >
                        <div>
                          <p className="text-xs font-bold text-[var(--color-text-primary)]">{f.name}</p>
                          <p className="text-[11px] text-[var(--color-text-muted)]">
                            {f.default_quantity} {f.default_unit} • {f.calories} kcal • {f.protein_g}g P • {f.carbs_g}g C • {f.fat_g}g F
                          </p>
                        </div>
                        {isSelected && <span className="text-xs font-bold text-[var(--color-accent-text)]">Selected</span>}
                      </div>
                    )
                  })}
                </div>
              )}

              {selectedSavedFood && (
                <div className="p-3.5 rounded-xl bg-[var(--color-surface-subtle)] border border-[var(--color-border)] space-y-2.5">
                  <label className="block text-xs font-semibold text-[var(--color-text-primary)]">
                    Adjust Portion for {selectedSavedFood.name}:
                  </label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      step="any"
                      min="0.01"
                      value={savedFoodPortion}
                      onChange={(e) => setSavedFoodPortion(e.target.value)}
                    />
                    <span className="text-xs font-medium text-[var(--color-text-secondary)] whitespace-nowrap">
                      {selectedSavedFood.default_unit}
                    </span>
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-[var(--color-border)]">
                <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
                  Cancel
                </Button>
                <Button
                  type="button"
                  variant="primary"
                  disabled={!selectedSavedFood || isSubmitting}
                  onClick={handleLogSavedFood}
                  icon={isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                >
                  {isSubmitting ? 'Logging...' : 'Log to Meal'}
                </Button>
              </div>
            </div>
          )}

          {/* TAB 3: SELECT SAVED RECIPE */}
          {activeTab === 'saved_recipe' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-2">
                <div className="flex-1">
                  <Input
                    placeholder="Search saved recipes..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    leftIcon={<Search className="w-4 h-4" />}
                  />
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  icon={<Plus className="w-3.5 h-3.5" />}
                  onClick={() => {
                    onClose()
                    openSavedManager('recipes')
                  }}
                  title="Create a new recipe in your catalog"
                >
                  Create Recipe
                </Button>
              </div>

              {savedRecipes.length === 0 ? (
                <div className="p-8 text-center text-xs text-[var(--color-text-muted)] border border-dashed rounded-xl border-[var(--color-border)] space-y-3">
                  <BookOpen className="w-8 h-8 mx-auto text-[var(--color-accent)] opacity-40" />
                  <div className="space-y-1">
                    <p className="font-bold text-sm text-[var(--color-text-primary)]">You have no saved recipes yet</p>
                    <p>Create composite recipes with multiple ingredients to easily log them together.</p>
                  </div>
                  <Button
                    type="button"
                    variant="primary"
                    size="sm"
                    icon={<Plus className="w-3.5 h-3.5" />}
                    onClick={() => {
                      onClose()
                      openSavedManager('recipes')
                    }}
                  >
                    Create Recipe
                  </Button>
                </div>
              ) : (
                <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                  {filteredSavedRecipes.map((r) => {
                    const isSelected = selectedRecipe?.id === r.id
                    const totalCal = r.items.reduce((acc, i) => acc + Number(i.calories || 0), 0)
                    const totalP = Math.round(r.items.reduce((acc, i) => acc + Number(i.protein_g || 0), 0) * 10) / 10
                    return (
                      <div
                        key={r.id}
                        onClick={() => setSelectedRecipe(r)}
                        className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                          isSelected
                            ? 'bg-[var(--color-accent-subtle)] border-[var(--color-accent)] shadow-xs'
                            : 'bg-[var(--color-surface)] border-[var(--color-border)] hover:bg-[var(--color-surface-hover)]'
                        }`}
                      >
                        <div>
                          <p className="text-xs font-bold text-[var(--color-text-primary)]">{r.name}</p>
                          <p className="text-[11px] text-[var(--color-text-muted)]">
                            Yield: {r.servings} {r.servings === 1 ? 'serving' : 'servings'} • {r.items.length} ingredients • {totalCal} total kcal ({totalP}g P)
                          </p>
                        </div>
                        {isSelected && <span className="text-xs font-bold text-[var(--color-accent-text)]">Selected</span>}
                      </div>
                    )
                  })}
                </div>
              )}

              {selectedRecipe && (
                <div className="p-3.5 rounded-xl bg-[var(--color-surface-subtle)] border border-[var(--color-border)] space-y-2">
                  <label className="block text-xs font-semibold text-[var(--color-text-primary)]">
                    Servings to Log for {selectedRecipe.name} (Recipe yields {selectedRecipe.servings}):
                  </label>
                  <Input
                    type="number"
                    step="0.25"
                    min="0.25"
                    value={recipeServings}
                    onChange={(e) => setRecipeServings(e.target.value)}
                  />
                  <p className="text-[11px] text-[var(--color-text-muted)]">
                    All {selectedRecipe.items.length} ingredients will be scaled and logged to your meal.
                  </p>
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-[var(--color-border)]">
                <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
                  Cancel
                </Button>
                <Button
                  type="button"
                  variant="primary"
                  disabled={!selectedRecipe || isSubmitting}
                  onClick={handleLogSavedRecipe}
                  icon={isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                >
                  {isSubmitting ? 'Logging...' : 'Log Recipe Ingredients'}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
