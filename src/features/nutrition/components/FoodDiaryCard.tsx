import React, { useState } from 'react'
import {
  Plus,
  ChevronDown,
  ChevronUp,
  Edit2,
  Trash2,
  Coffee,
  Sun,
  Moon,
  Cookie,
  Lock,
  Loader2,
} from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { useNutrition } from '../context/NutritionContext'
import type { MealCategory, DbNutritionFoodItem } from '../types'

const MEAL_CONFIG: Record<
  MealCategory,
  {
    title: string
    icon: React.ComponentType<{ className?: string }>
    defaultTime: string
    colorClass: string
  }
> = {
  breakfast: {
    title: 'Breakfast',
    icon: Coffee,
    defaultTime: '08:30 AM',
    colorClass: 'text-amber-500 bg-amber-500/10',
  },
  lunch: {
    title: 'Lunch',
    icon: Sun,
    defaultTime: '01:15 PM',
    colorClass: 'text-orange-500 bg-orange-500/10',
  },
  snack: {
    title: 'Snacks & Supplements',
    icon: Cookie,
    defaultTime: '04:30 PM',
    colorClass: 'text-emerald-500 bg-emerald-500/10',
  },
  dinner: {
    title: 'Dinner',
    icon: Moon,
    defaultTime: '08:00 PM',
    colorClass: 'text-indigo-500 bg-indigo-500/10',
  },
}

export const FoodDiaryCard: React.FC = () => {
  const {
    meals,
    isLoading,
    isDayClosed,
    deleteFoodItem,
    setActiveEditItem,
    setIsAddModalOpen,
    setSelectedCategoryForAdd,
    setIsSavedManagerOpen,
  } = useNutrition()

  // Track expanded sections (default all expanded)
  const [collapsedCategories, setCollapsedCategories] = useState<Record<string, boolean>>({})

  const toggleCategory = (cat: MealCategory) => {
    setCollapsedCategories((prev) => ({
      ...prev,
      [cat]: !prev[cat],
    }))
  }

  const handleOpenAdd = (category: MealCategory, e?: React.MouseEvent) => {
    if (e) e.stopPropagation()
    if (isDayClosed) return
    setSelectedCategoryForAdd(category)
    setIsAddModalOpen(true)
  }

  const handleEdit = (item: DbNutritionFoodItem, e: React.MouseEvent) => {
    e.stopPropagation()
    if (isDayClosed) return
    setActiveEditItem(item)
  }

  const handleDelete = async (itemId: string, mealId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (isDayClosed) return
    await deleteFoodItem(itemId, mealId)
  }

  const mealCategories: MealCategory[] = ['breakfast', 'lunch', 'snack', 'dinner']

  return (
    <Card className="overflow-hidden border-[var(--color-border)] shadow-xs">
      <CardHeader className="flex flex-row items-center justify-between pb-3 bg-[var(--color-surface-hover)]/20">
        <div>
          <div className="flex items-center gap-2">
            <CardTitle className="text-sm font-bold uppercase tracking-wider text-[var(--color-text-secondary)]">
              Daily Food Diary
            </CardTitle>
            {isDayClosed && (
              <Badge variant="outline" className="flex items-center gap-1 text-[10px] text-amber-600 dark:text-amber-400 border-amber-500/30">
                <Lock className="w-2.5 h-2.5" /> Read-Only
              </Badge>
            )}
            {isLoading && <Loader2 className="w-3.5 h-3.5 animate-spin text-[var(--color-text-muted)]" />}
          </div>
          <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
            Logged meals and macronutrient distributions
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsSavedManagerOpen(true)}
            className="text-xs"
          >
            Saved Foods
          </Button>
          <Button
            variant="secondary"
            size="sm"
            icon={<Plus className="w-3.5 h-3.5" />}
            disabled={isDayClosed}
            onClick={() => handleOpenAdd('breakfast')}
          >
            Add Food
          </Button>
        </div>
      </CardHeader>

      <CardContent className="p-4 space-y-3">
        {isDayClosed && (
          <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs text-amber-700 dark:text-amber-400 flex items-center gap-2">
            <Lock className="w-4 h-4 shrink-0" />
            <span>This day is closed and finalized. Reopen the day above to edit or add meals.</span>
          </div>
        )}

        {mealCategories.map((category) => {
          const config = MEAL_CONFIG[category]
          const Icon = config.icon
          const categoryMeals = meals.filter((m) => m.category === category)
          const allCategoryItems = categoryMeals.flatMap((m) => m.items)
          const isCollapsed = !!collapsedCategories[category]

          const mealCalories = allCategoryItems.reduce((acc, i) => acc + Number(i.calories || 0), 0)
          const mealProtein = Math.round(allCategoryItems.reduce((acc, i) => acc + Number(i.protein_g || 0), 0) * 10) / 10
          const mealCarbs = Math.round(allCategoryItems.reduce((acc, i) => acc + Number(i.carbs_g || 0), 0) * 10) / 10
          const mealFat = Math.round(allCategoryItems.reduce((acc, i) => acc + Number(i.fat_g || 0), 0) * 10) / 10

          return (
            <div
              key={category}
              className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] overflow-hidden transition-all"
            >
              {/* Category Header */}
              <div
                onClick={() => toggleCategory(category)}
                className="flex items-center justify-between p-3.5 bg-[var(--color-surface-hover)]/40 hover:bg-[var(--color-surface-hover)]/70 transition-colors cursor-pointer select-none"
              >
                <div className="flex items-center gap-2.5">
                  <div
                    className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${config.colorClass}`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-xs font-bold text-[var(--color-text-primary)]">
                        {config.title}
                      </h4>
                      <span className="text-[10px] text-[var(--color-text-muted)]">
                        {allCategoryItems.length} {allCategoryItems.length === 1 ? 'item' : 'items'}
                      </span>
                    </div>
                    {/* Subtotal preview */}
                    <div className="flex items-center gap-2 text-[11px] text-[var(--color-text-secondary)] mt-0.5 font-medium">
                      <span className="font-semibold text-[var(--color-text-primary)]">
                        {mealCalories} kcal
                      </span>
                      <span>•</span>
                      <span className="text-blue-600 dark:text-blue-400">{mealProtein}g P</span>
                      <span>•</span>
                      <span className="text-amber-600 dark:text-amber-400">{mealCarbs}g C</span>
                      <span>•</span>
                      <span className="text-purple-600 dark:text-purple-400">{mealFat}g F</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  {!isDayClosed && (
                    <button
                      type="button"
                      onClick={(e) => handleOpenAdd(category, e)}
                      className="p-1 rounded text-[var(--color-text-muted)] hover:text-[var(--color-accent-text)] hover:bg-[var(--color-surface-hover)] transition-colors cursor-pointer"
                      title={`Add food to ${config.title}`}
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  )}
                  <button
                    type="button"
                    className="p-1 rounded text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
                  >
                    {isCollapsed ? (
                      <ChevronDown className="w-4 h-4" />
                    ) : (
                      <ChevronUp className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              {/* Collapsible Food List */}
              {!isCollapsed && (
                <div className="border-t border-[var(--color-border)] divide-y divide-[var(--color-border)]/60">
                  {allCategoryItems.length === 0 ? (
                    <div className="py-5 px-4 text-center">
                      <p className="text-xs text-[var(--color-text-muted)]">
                        No food items logged for {config.title.toLowerCase()}.
                      </p>
                      {!isDayClosed && (
                        <button
                          type="button"
                          onClick={() => handleOpenAdd(category)}
                          className="mt-2 text-xs font-semibold text-[var(--color-accent-text)] hover:underline inline-flex items-center gap-1 cursor-pointer"
                        >
                          <Plus className="w-3 h-3" /> Log an item
                        </button>
                      )}
                    </div>
                  ) : (
                    categoryMeals.map((meal) =>
                      meal.items.map((item) => (
                        <div
                          key={item.id}
                          className="p-3 flex items-center justify-between hover:bg-[var(--color-surface-hover)]/30 transition-colors group"
                        >
                          <div className="space-y-0.5">
                            <p className="text-xs font-semibold text-[var(--color-text-primary)]">
                              {item.food_name}
                              {item.is_estimated && (
                                <span className="ml-1.5 text-[10px] text-amber-500 font-normal">
                                  (est.)
                                </span>
                              )}
                            </p>
                            <div className="flex items-center gap-2 text-[10.5px] text-[var(--color-text-muted)]">
                              <span>
                                {item.quantity} {item.unit}
                              </span>
                              <span>•</span>
                              <span className="font-medium text-[var(--color-text-secondary)]">
                                {item.calories} kcal
                              </span>
                              <span>•</span>
                              <span className="text-blue-600 dark:text-blue-400">
                                {item.protein_g}g P
                              </span>
                              <span>•</span>
                              <span className="text-amber-600 dark:text-amber-400">
                                {item.carbs_g}g C
                              </span>
                              <span>•</span>
                              <span className="text-purple-600 dark:text-purple-400">
                                {item.fat_g}g F
                              </span>
                              {Number(item.fiber_g) > 0 && (
                                <>
                                  <span>•</span>
                                  <span className="text-emerald-600 dark:text-emerald-400">
                                    {item.fiber_g}g Fiber
                                  </span>
                                </>
                              )}
                            </div>
                            {item.notes && (
                              <p className="text-[10px] text-[var(--color-text-muted)] italic">
                                {item.notes}
                              </p>
                            )}
                          </div>

                          {/* Item Actions */}
                          {!isDayClosed && (
                            <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                              <button
                                type="button"
                                onClick={(e) => handleEdit(item, e)}
                                className="p-1 rounded text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-hover)] transition-colors cursor-pointer"
                                title="Edit food"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={(e) => handleDelete(item.id, meal.id, e)}
                                className="p-1 rounded text-red-500/80 hover:text-red-600 hover:bg-red-500/10 transition-colors cursor-pointer"
                                title="Delete food"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}
                        </div>
                      ))
                    )
                  )}
                </div>
              )}
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}
