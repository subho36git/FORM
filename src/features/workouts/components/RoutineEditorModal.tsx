import React, { useState, useEffect } from 'react'
import {
  X,
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  Layers,
  Clock,
  Repeat,
  Loader2,
  Dumbbell,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { ExerciseLibraryModal } from './ExerciseLibraryModal'
import type { Routine, Exercise } from '@/types/workout'

interface RoutineEditorModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (routineData: {
    id?: string
    name: string
    description?: string | null
    exercises: {
      exercise_id: string
      order_index: number
      target_sets: number
      target_reps: string
      rest_seconds: number
      notes?: string | null
    }[]
  }) => Promise<void>
  initialRoutine?: Routine | null
}

interface RoutineDraftItem {
  id: string
  exercise: Exercise
  target_sets: number
  target_reps: string
  rest_seconds: number
  notes?: string
}

export const RoutineEditorModal: React.FC<RoutineEditorModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialRoutine,
}) => {
  const [name, setName] = useState(initialRoutine?.name || '')
  const [description, setDescription] = useState(initialRoutine?.description || '')
  const [items, setItems] = useState<RoutineDraftItem[]>(() => {
    if (!initialRoutine?.exercises) return []
    return initialRoutine.exercises.map((re, idx) => ({
      id: re.id || `draft-re-${idx}`,
      exercise: re.exercise!,
      target_sets: re.target_sets || 3,
      target_reps: re.target_reps || '8-12',
      rest_seconds: re.rest_seconds || 90,
      notes: re.notes || '',
    }))
  })

  const [isExercisePickerOpen, setIsExercisePickerOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Track initialRoutine changes when opening modal
  const [prevInitial, setPrevInitial] = useState(initialRoutine)
  if (initialRoutine !== prevInitial) {
    setPrevInitial(initialRoutine)
    setName(initialRoutine?.name || '')
    setDescription(initialRoutine?.description || '')
    setItems(
      initialRoutine?.exercises?.map((re, idx) => ({
        id: re.id || `draft-re-${idx}`,
        exercise: re.exercise!,
        target_sets: re.target_sets || 3,
        target_reps: re.target_reps || '8-12',
        rest_seconds: re.rest_seconds || 90,
        notes: re.notes || '',
      })) || []
    )
    setError(null)
  }

  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isExercisePickerOpen) {
        if (!name.trim()) onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, isExercisePickerOpen, name, onClose])

  if (!isOpen) return null

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget && !isExercisePickerOpen && !name.trim() && items.length === 0) {
      onClose()
    }
  }

  const handleAddExercise = (exercise: Exercise) => {
    setItems((prev) => [
      ...prev,
      {
        id: `item-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        exercise,
        target_sets: 3,
        target_reps: '8-12',
        rest_seconds: 90,
        notes: '',
      },
    ])
  }

  const handleRemoveItem = (id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id))
  }

  const handleMoveUp = (index: number) => {
    if (index <= 0) return
    setItems((prev) => {
      const next = [...prev]
      const temp = next[index - 1]
      next[index - 1] = next[index]
      next[index] = temp
      return next
    })
  }

  const handleMoveDown = (index: number) => {
    if (index >= items.length - 1) return
    setItems((prev) => {
      const next = [...prev]
      const temp = next[index + 1]
      next[index + 1] = next[index]
      next[index] = temp
      return next
    })
  }

  const handleUpdateItem = (id: string, updates: Partial<RoutineDraftItem>) => {
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, ...updates } : item)))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) {
      setError('Please provide a name for this routine.')
      return
    }
    if (items.length === 0) {
      setError('Please add at least one exercise to the routine.')
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      await onSave({
        id: initialRoutine?.id,
        name: name.trim(),
        description: description.trim() || null,
        exercises: items.map((item, idx) => ({
          exercise_id: item.exercise.id,
          order_index: idx,
          target_sets: Number(item.target_sets) || 3,
          target_reps: item.target_reps || '8-12',
          rest_seconds: Number(item.rest_seconds) || 90,
          notes: item.notes?.trim() || null,
        })),
      })
      onClose()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to save routine'
      setError(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div
      onClick={handleBackdropClick}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="routine-editor-modal-title"
        className="w-full max-w-2xl max-h-[90vh] flex flex-col bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--color-border)] shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[var(--color-accent-subtle)] text-[var(--color-accent)] flex items-center justify-center">
              <Layers className="w-4 h-4" />
            </div>
            <h3 id="routine-editor-modal-title" className="text-base font-semibold text-[var(--color-text-primary)]">
              {initialRoutine ? 'Edit Workout Routine' : 'Create Custom Routine'}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="w-11 h-11 flex items-center justify-center rounded-xl text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-hover)] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
          {error && (
            <div className="p-3 text-xs rounded-lg bg-red-500/10 border border-red-500/20 text-red-500 font-medium">
              {error}
            </div>
          )}

          {/* Routine Meta Info */}
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">
                Routine Name <span className="text-red-500">*</span>
              </label>
              <Input
                type="text"
                placeholder="e.g. Upper Body Hypertrophy (Push Focus)"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="text-sm font-semibold"
                autoFocus
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">
                Description / Target Goals (Optional)
              </label>
              <Input
                type="text"
                placeholder="e.g. 4-day split focus on chest, shoulders and triceps"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="text-xs"
              />
            </div>
          </div>

          {/* Exercises Section */}
          <div className="space-y-3 pt-2 border-t border-[var(--color-border)]">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-primary)]">
                  Routine Movements ({items.length})
                </h4>
                <p className="text-[11px] text-[var(--color-text-muted)]">
                  Configure target sets, rep ranges, rest periods, and order.
                </p>
              </div>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                icon={<Plus className="w-3.5 h-3.5" />}
                onClick={() => setIsExercisePickerOpen(true)}
              >
                Add Movement
              </Button>
            </div>

            {items.length === 0 ? (
              <div
                onClick={() => setIsExercisePickerOpen(true)}
                className="py-10 text-center border-2 border-dashed border-[var(--color-border)] rounded-xl p-6 space-y-2 hover:border-[var(--color-accent)] cursor-pointer transition-colors"
              >
                <div className="w-10 h-10 rounded-full bg-[var(--color-surface-subtle)] text-[var(--color-text-muted)] flex items-center justify-center mx-auto">
                  <Dumbbell className="w-5 h-5" />
                </div>
                <div className="text-xs font-medium text-[var(--color-text-secondary)]">
                  No movements added yet. Click to select from the Exercise Library.
                </div>
              </div>
            ) : (
              <div className="space-y-2.5">
                {items.map((item, index) => (
                  <div
                    key={item.id}
                    className="p-3.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-subtle)] space-y-3"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="w-5 h-5 rounded-md bg-[var(--color-surface)] border border-[var(--color-border)] flex items-center justify-center text-[10px] font-bold text-[var(--color-text-muted)] shrink-0">
                          {index + 1}
                        </span>
                        <div className="min-w-0">
                          <h5 className="text-xs font-bold text-[var(--color-text-primary)] truncate">
                            {item.exercise.name}
                          </h5>
                          <span className="text-[10px] text-[var(--color-text-muted)] capitalize">
                            {item.exercise.muscle_group} • {item.exercise.equipment}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleMoveUp(index)}
                          disabled={index === 0}
                          className="p-1 rounded-md text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] disabled:opacity-30 disabled:cursor-not-allowed"
                          title="Move Up"
                        >
                          <ArrowUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleMoveDown(index)}
                          disabled={index === items.length - 1}
                          className="p-1 rounded-md text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] disabled:opacity-30 disabled:cursor-not-allowed"
                          title="Move Down"
                        >
                          <ArrowDown className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(item.id)}
                          className="p-1 rounded-md text-[var(--color-text-muted)] hover:text-red-500 transition-colors"
                          title="Remove Exercise"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Target Sets, Reps, and Rest Grid */}
                    <div className="grid grid-cols-3 gap-2.5 pt-1 text-xs">
                      <div>
                        <span className="text-[10px] font-semibold text-[var(--color-text-secondary)] flex items-center gap-1 mb-1">
                          <Layers className="w-3 h-3 text-[var(--color-accent)]" /> Target Sets
                        </span>
                        <Input
                          type="number"
                          min={1}
                          max={20}
                          value={item.target_sets}
                          onChange={(e) =>
                            handleUpdateItem(item.id, {
                              target_sets: parseInt(e.target.value, 10) || 1,
                            })
                          }
                          className="text-xs py-1"
                        />
                      </div>

                      <div>
                        <span className="text-[10px] font-semibold text-[var(--color-text-secondary)] flex items-center gap-1 mb-1">
                          <Repeat className="w-3 h-3 text-[var(--color-accent)]" /> Rep Range
                        </span>
                        <Input
                          type="text"
                          placeholder="e.g. 8-12"
                          value={item.target_reps}
                          onChange={(e) => handleUpdateItem(item.id, { target_reps: e.target.value })}
                          className="text-xs py-1"
                        />
                      </div>

                      <div>
                        <span className="text-[10px] font-semibold text-[var(--color-text-secondary)] flex items-center gap-1 mb-1">
                          <Clock className="w-3 h-3 text-amber-500" /> Rest (sec)
                        </span>
                        <Input
                          type="number"
                          step={15}
                          min={0}
                          max={600}
                          value={item.rest_seconds}
                          onChange={(e) =>
                            handleUpdateItem(item.id, {
                              rest_seconds: parseInt(e.target.value, 10) || 0,
                            })
                          }
                          className="text-xs py-1"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-[var(--color-border)] shrink-0">
            <Button type="button" variant="secondary" size="md" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="md" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Saving...
                </>
              ) : initialRoutine ? (
                'Save Changes'
              ) : (
                'Create Routine'
              )}
            </Button>
          </div>
        </form>
      </div>

      {/* Movement Selector Modal */}
      <ExerciseLibraryModal
        isOpen={isExercisePickerOpen}
        onClose={() => setIsExercisePickerOpen(false)}
        onSelectExercise={handleAddExercise}
        isSelectMode={true}
      />
    </div>
  )
}
