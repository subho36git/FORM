import React from 'react'
import { Sparkles, Edit2, Trash2, Utensils, AlertCircle } from 'lucide-react'
import type { MealSummaryData, FoodItem } from '../types'
import { useNutrition } from '../context/NutritionContext'
import { Badge } from '@/components/ui/Badge'
import { cn } from '@/lib/utils'

interface FoodLoggingMealCardProps {
  summary: MealSummaryData
  className?: string
}

export const FoodLoggingMealCard: React.FC<FoodLoggingMealCardProps> = ({ summary, className }) => {
  const { meals, deleteFoodItem, setActiveEditItem } = useNutrition()
  const { category, heading, coachingObservation, mealId } = summary

  // Single source of truth: retrieve the live meal from shared meals state
  const meal = meals.find((m) => m.id === mealId) || meals.find((m) => m.category === category)
  const items = meal ? meal.items : (summary.items || [])
  const resolvedMealId = meal ? meal.id : mealId

  const totalCalories = items.reduce((sum, item) => sum + item.calories, 0)
  const totalProtein = Math.round(items.reduce((sum, item) => sum + (item.protein_g || 0), 0) * 10) / 10
  const totalCarbs = Math.round(items.reduce((sum, item) => sum + (item.carbs_g || 0), 0) * 10) / 10
  const totalFat = Math.round(items.reduce((sum, item) => sum + (item.fat_g || 0), 0) * 10) / 10

  const handleEdit = (item: FoodItem) => {
    setActiveEditItem(item)
  }

  const handleDelete = (itemId: string) => {
    deleteFoodItem(itemId, resolvedMealId)
  }

  const categoryBadgeVariant: Record<
    string,
    'accent' | 'default' | 'outline' | 'warning' | 'danger'
  > = {
    breakfast: 'accent',
    lunch: 'warning',
    dinner: 'default',
    snack: 'outline',
  }

  return (
    <div
      className={cn(
        'mt-2.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-xs overflow-hidden transition-all',
        className
      )}
    >
      {/* Meal Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-[var(--color-surface-hover)]/40 border-b border-[var(--color-border)]">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-[var(--color-accent-subtle)] text-[var(--color-accent-text)] flex items-center justify-center">
            <Utensils className="w-3.5 h-3.5" />
          </div>
          <div>
            <span className="text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider block">
              Meal Logged
            </span>
            <h4 className="text-sm font-bold text-[var(--color-text-primary)] leading-tight">
              {heading}
            </h4>
          </div>
        </div>
        <Badge variant={categoryBadgeVariant[category] || 'default'} className="capitalize text-[11px]">
          {category}
        </Badge>
      </div>

      {/* Items Table */}
      {items.length === 0 ? (
        <div className="p-6 text-center text-xs text-[var(--color-text-muted)] flex items-center justify-center gap-2">
          <AlertCircle className="w-4 h-4 text-amber-500" />
          <span>All food items from this meal have been removed.</span>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-[var(--color-border)] bg-[var(--color-surface-subtle)] text-[var(--color-text-muted)] font-semibold uppercase text-[10px] tracking-wider">
                <th className="py-2.5 px-3.5">Food Item</th>
                <th className="py-2.5 px-2 text-right">Qty</th>
                <th className="py-2.5 px-2 text-right">Kcal</th>
                <th className="py-2.5 px-2 text-right text-[var(--color-accent-text)]">P (g)</th>
                <th className="py-2.5 px-2 text-right text-[var(--color-accent-secondary-text)]">C (g)</th>
                <th className="py-2.5 px-2 text-right text-[var(--color-lavender-text)]">F (g)</th>
                <th className="py-2.5 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border)] text-[var(--color-text-secondary)]">
              {items.map((item) => (
                <tr key={item.id} className="hover:bg-[var(--color-surface-hover)]/60 transition-colors group">
                  <td className="py-2 px-3.5 font-medium text-[var(--color-text-primary)]">
                    {item.food_name}
                  </td>
                  <td className="py-2 px-2 text-right text-[var(--color-text-muted)]">
                    {item.quantity} {item.unit}
                  </td>
                  <td className="py-2 px-2 text-right font-semibold text-[var(--color-text-primary)]">
                    {item.calories}
                  </td>
                  <td className="py-2 px-2 text-right font-medium text-[var(--color-accent-text)]">
                    {item.protein_g}g
                  </td>
                  <td className="py-2 px-2 text-right font-medium text-[var(--color-accent-secondary-text)]">
                    {item.carbs_g}g
                  </td>
                  <td className="py-2 px-2 text-right font-medium text-[var(--color-lavender-text)]">
                    {item.fat_g}g
                  </td>
                  <td className="py-2 px-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        type="button"
                        onClick={() => handleEdit(item)}
                        className="p-1 rounded text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-hover)] transition-colors cursor-pointer"
                        title="Edit food item"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(item.id)}
                        className="p-1 rounded text-red-500/80 hover:text-red-600 hover:bg-red-500/10 transition-colors cursor-pointer"
                        title="Delete food item"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
            {/* Meal Total Row */}
            <tfoot>
              <tr className="border-t-2 border-[var(--color-border)] bg-[var(--color-surface-subtle)] font-bold text-[var(--color-text-primary)]">
                <td className="py-2.5 px-3.5 text-xs">Meal Total</td>
                <td className="py-2.5 px-2 text-right text-[10px] text-[var(--color-text-muted)] uppercase">
                  {items.length} {items.length === 1 ? 'item' : 'items'}
                </td>
                <td className="py-2.5 px-2 text-right text-xs font-black">
                  {totalCalories.toLocaleString()}
                </td>
                <td className="py-2.5 px-2 text-right text-xs text-[var(--color-accent-text)]">
                  {totalProtein}g
                </td>
                <td className="py-2.5 px-2 text-right text-xs text-[var(--color-accent-secondary-text)]">
                  {totalCarbs}g
                </td>
                <td className="py-2.5 px-2 text-right text-xs text-[var(--color-lavender-text)]">
                  {totalFat}g
                </td>
                <td className="py-2.5 px-3"></td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {/* Coaching Observation */}
      {coachingObservation && (
        <div className="p-3.5 bg-[var(--color-surface-hover)]/30 border-t border-[var(--color-border)] flex items-start gap-2.5 text-xs">
          <div className="w-5 h-5 rounded-full bg-[var(--color-accent-subtle)] text-[var(--color-accent-text)] flex items-center justify-center shrink-0 mt-0.5">
            <Sparkles className="w-3 h-3" />
          </div>
          <div className="space-y-0.5">
            <span className="font-semibold text-[var(--color-accent-text)] text-[11px] block">
              Coaching Observation
            </span>
            <p className="text-[var(--color-text-secondary)] leading-relaxed text-[11.5px]">
              {coachingObservation}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
