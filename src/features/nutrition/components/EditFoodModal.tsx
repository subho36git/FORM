import React, { useState, useEffect } from 'react'
import { X, Check, Edit2, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { useNutrition } from '../context/NutritionContext'
import type { DbNutritionFoodItem } from '../types'

interface EditFoodModalProps {
  isOpen: boolean
  onClose: () => void
  item: DbNutritionFoodItem
}

export const EditFoodModal: React.FC<EditFoodModalProps> = ({
  isOpen,
  onClose,
  item,
}) => {
  const { updateFoodItem } = useNutrition()

  const [name, setName] = useState(item.food_name)
  const [quantity, setQuantity] = useState(item.quantity.toString())
  const [unit, setUnit] = useState(item.unit)
  const [calories, setCalories] = useState(item.calories.toString())
  const [protein, setProtein] = useState(item.protein_g.toString())
  const [carbs, setCarbs] = useState(item.carbs_g.toString())
  const [fat, setFat] = useState(item.fat_g.toString())
  const [fiber, setFiber] = useState(item.fiber_g ? item.fiber_g.toString() : '0')
  const [notes, setNotes] = useState(item.notes || '')
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

  const handleSubmit = async (e: React.FormEvent) => {
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
      setError('Please enter a valid non-negative calorie amount.')
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      await updateFoodItem(item.id, {
        food_name: name.trim(),
        quantity: qtyNum,
        unit: unit.trim() || 'g',
        calories: calNum,
        protein_g: Number(protein) || 0,
        carbs_g: Number(carbs) || 0,
        fat_g: Number(fat) || 0,
        fiber_g: Number(fiber) || 0,
        notes: notes.trim() || null,
      })
      onClose()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update food item'
      setError(msg)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      const isDirty =
        name.trim() !== item.food_name ||
        quantity !== item.quantity.toString() ||
        unit !== item.unit ||
        calories !== item.calories.toString() ||
        protein !== item.protein_g.toString() ||
        carbs !== item.carbs_g.toString() ||
        fat !== item.fat_g.toString() ||
        fiber !== (item.fiber_g ? item.fiber_g.toString() : '0') ||
        notes !== (item.notes || '')
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
        className="w-full max-w-md bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl shadow-xl overflow-hidden animate-in zoom-in-95 duration-150"
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-food-title"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--color-border)]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[var(--color-accent-subtle)] text-[var(--color-accent-text)] flex items-center justify-center">
              <Edit2 className="w-4 h-4" />
            </div>
            <div>
              <h3 id="edit-food-title" className="text-base font-bold text-[var(--color-text-primary)]">
                Edit Food Item
              </h3>
              <p className="text-xs text-[var(--color-text-muted)]">Update quantity or nutrition values</p>
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

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-xs text-red-500 font-medium">
              {error}
            </div>
          )}

          {/* Food Name */}
          <Input
            label="Food Name"
            placeholder="e.g. Cooked Jasmine Rice"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />

          {/* Quantity & Unit */}
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Quantity"
              type="number"
              step="any"
              min="0.01"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              required
            />
            <Input
              label="Unit"
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              required
            />
          </div>

          {/* Calories & Macros Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <Input
              label="Calories"
              type="number"
              step="any"
              min="0"
              value={calories}
              onChange={(e) => setCalories(e.target.value)}
              required
            />
            <Input
              label="Protein (g)"
              type="number"
              step="any"
              min="0"
              value={protein}
              onChange={(e) => setProtein(e.target.value)}
            />
            <Input
              label="Carbs (g)"
              type="number"
              step="any"
              min="0"
              value={carbs}
              onChange={(e) => setCarbs(e.target.value)}
            />
            <Input
              label="Fat (g)"
              type="number"
              step="any"
              min="0"
              value={fat}
              onChange={(e) => setFat(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Fiber (g)"
              type="number"
              step="any"
              min="0"
              value={fiber}
              onChange={(e) => setFiber(e.target.value)}
            />
            <Input
              label="Notes"
              placeholder="e.g. optional details"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          {/* Modal Footer */}
          <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-[var(--color-border)]">
            <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={isSubmitting}
              icon={isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            >
              {isSubmitting ? 'Saving...' : 'Save Updates'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
