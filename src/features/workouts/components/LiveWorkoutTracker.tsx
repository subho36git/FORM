import React, { useState, useEffect } from 'react'
import {
  Clock,
  Dumbbell,
  Check,
  Plus,
  Trash2,
  AlertTriangle,
  Flame,
  Save,
} from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { ExerciseLibraryModal } from './ExerciseLibraryModal'
import { useWorkout } from '../hooks/useWorkout'
import { useUnit } from '@/hooks/useUnit'
import type { SetType, Exercise } from '@/types/workout'
import { cn } from '@/lib/utils'

export const LiveWorkoutTracker: React.FC = () => {
  const { weightUnit } = useUnit()
  const {
    activeWorkout,
    addExerciseToActiveWorkout,
    removeExerciseFromActiveWorkout,
    addSetToExercise,
    removeSetFromExercise,
    updateSet,
    toggleSetCompleted,
    finishActiveWorkout,
    discardActiveWorkout,
  } = useWorkout()

  const [isExercisePickerOpen, setIsExercisePickerOpen] = useState(false)
  const [isDiscardConfirmOpen, setIsDiscardConfirmOpen] = useState(false)
  const [isFinishing, setIsFinishing] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [elapsedSeconds, setElapsedSeconds] = useState(0)

  // Real-time elapsed duration clock
  useEffect(() => {
    if (!activeWorkout) return

    const startMs = new Date(activeWorkout.startedAt).getTime()
    const updateDuration = () => {
      const nowMs = Date.now()
      const diffSec = Math.max(0, Math.floor((nowMs - startMs) / 1000))
      setElapsedSeconds(diffSec)
    }

    updateDuration()
    const interval = setInterval(updateDuration, 1000)
    return () => clearInterval(interval)
  }, [activeWorkout])

  // Escape key closes discard modal if open
  useEffect(() => {
    if (!isDiscardConfirmOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsDiscardConfirmOpen(false)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isDiscardConfirmOpen])

  if (!activeWorkout) return null

  const formatDuration = (totalSec: number) => {
    const hrs = Math.floor(totalSec / 3600)
    const mins = Math.floor((totalSec % 3600) / 60)
    const secs = totalSec % 60
    if (hrs > 0) {
      return `${hrs}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
    }
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
  }

  // Live total volume calculation (weight * reps for completed sets)
  let liveVolumeKg = 0
  let totalSetsCount = 0
  let completedSetsCount = 0

  activeWorkout.exercises.forEach((ex) => {
    ex.sets.forEach((s) => {
      totalSetsCount++
      if (s.is_completed) {
        completedSetsCount++
        const w = typeof s.weight_kg === 'number' ? s.weight_kg : parseFloat(s.weight_kg) || 0
        const r = typeof s.reps === 'number' ? s.reps : parseInt(s.reps, 10) || 0
        liveVolumeKg += w * r
      }
    })
  })

  const handleFinish = async () => {
    setIsFinishing(true)
    setSaveError(null)
    try {
      await finishActiveWorkout()
    } catch (err: unknown) {
      console.error('[LiveWorkoutTracker] Error persisting workout:', err)
      const message =
        err instanceof Error
          ? err.message
          : 'Failed to persist workout session. Your logged sets are preserved locally. Please check your network and retry.'
      setSaveError(message)
    } finally {
      setIsFinishing(false)
    }
  }

  const setTypeOptions: { value: SetType; label: string }[] = [
    { value: 'normal', label: 'Normal' },
    { value: 'warmup', label: 'Warm-up' },
    { value: 'dropset', label: 'Drop set' },
    { value: 'failure', label: 'Failure' },
  ]

  return (
    <div className="space-y-6">
      {/* Active Workout Top Banner */}
      <Card className="border-2 border-[var(--color-accent)] shadow-xl overflow-hidden bg-[var(--color-surface)]">
        <div className="bg-[var(--color-accent-subtle)] border-b border-[var(--color-border)] px-6 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[var(--color-accent)] animate-ping" />
            <span className="text-xs font-bold uppercase tracking-wider text-[var(--color-accent-text)]">
              Live Session Active
            </span>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 text-xs font-mono font-bold text-[var(--color-text-primary)] bg-[var(--color-surface)] px-3 py-1 rounded-lg border border-[var(--color-border)]">
              <Clock className="w-3.5 h-3.5 text-[var(--color-accent)]" />
              <span>{formatDuration(elapsedSeconds)}</span>
            </div>

            <div className="flex items-center gap-1.5 text-xs font-semibold text-[var(--color-text-primary)] bg-[var(--color-surface)] px-3 py-1 rounded-lg border border-[var(--color-border)]">
              <Flame className="w-3.5 h-3.5 text-amber-500" />
              <span>{Math.round(liveVolumeKg).toLocaleString()} {weightUnit} volume</span>
            </div>

            <div className="flex items-center gap-1.5 text-xs font-semibold text-[var(--color-text-primary)] bg-[var(--color-surface)] px-3 py-1 rounded-lg border border-[var(--color-border)]">
              <Check className="w-3.5 h-3.5 text-[var(--color-accent)]" />
              <span>
                {completedSetsCount}/{totalSetsCount} sets
              </span>
            </div>
          </div>
        </div>

        <CardHeader className="py-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <CardTitle className="text-xl md:text-2xl font-black text-[var(--color-text-primary)]">
                {activeWorkout.name}
              </CardTitle>
              <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                Started at {new Date(activeWorkout.startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • Unfinished state is safely preserved across refreshes.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="danger"
                size="sm"
                icon={<Trash2 className="w-3.5 h-3.5" />}
                onClick={() => setIsDiscardConfirmOpen(true)}
              >
                Discard
              </Button>
              <Button
                variant="primary"
                size="sm"
                icon={<Save className="w-4 h-4" />}
                onClick={handleFinish}
                disabled={isFinishing}
              >
                {isFinishing ? 'Saving...' : 'Finish Workout'}
              </Button>
            </div>
          </div>

          {saveError && (
            <div className="mt-4 p-3 rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400 text-xs flex items-center justify-between gap-3 animate-in fade-in">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-rose-500" />
                <span>{saveError}</span>
              </div>
              <Button
                variant="secondary"
                size="sm"
                onClick={handleFinish}
                disabled={isFinishing}
                className="shrink-0 text-xs py-1 px-3 h-auto"
              >
                Retry
              </Button>
            </div>
          )}
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Exercises In Active Workout */}
          {activeWorkout.exercises.length === 0 ? (
            <div className="py-12 text-center border-2 border-dashed border-[var(--color-border)] rounded-2xl p-6 space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-[var(--color-surface-subtle)] text-[var(--color-text-muted)] flex items-center justify-center mx-auto">
                <Dumbbell className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h4 className="text-sm font-semibold text-[var(--color-text-primary)]">
                  Workout is currently empty
                </h4>
                <p className="text-xs text-[var(--color-text-secondary)]">
                  Add an exercise from your library to start logging working sets.
                </p>
              </div>
              <Button
                variant="primary"
                size="sm"
                icon={<Plus className="w-3.5 h-3.5" />}
                onClick={() => setIsExercisePickerOpen(true)}
              >
                Add Exercise
              </Button>
            </div>
          ) : (
            <div className="space-y-6">
              {activeWorkout.exercises.map((activeEx, exIndex) => (
                <div
                  key={activeEx.id}
                  className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-subtle)] overflow-hidden space-y-3 p-4"
                >
                  {/* Exercise Title Bar */}
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="w-6 h-6 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] flex items-center justify-center text-xs font-bold text-[var(--color-text-muted)] shrink-0">
                        {exIndex + 1}
                      </span>
                      <div className="min-w-0">
                        <h4 className="text-sm font-bold text-[var(--color-text-primary)] truncate">
                          {activeEx.exercise.name}
                        </h4>
                        <div className="flex items-center gap-2 text-[10px] text-[var(--color-text-muted)]">
                          <span className="capitalize">{activeEx.exercise.muscle_group}</span>
                          <span>•</span>
                          <span className="capitalize">{activeEx.exercise.equipment}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        icon={<Plus className="w-3 h-3" />}
                        onClick={() => addSetToExercise(activeEx.id)}
                      >
                        Add Set
                      </Button>
                      <button
                        type="button"
                        onClick={() => removeExerciseFromActiveWorkout(activeEx.id)}
                        className="p-1.5 rounded-lg text-[var(--color-text-muted)] hover:text-red-500 hover:bg-red-500/10 transition-colors"
                        title="Remove Movement"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Sets Table */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-muted)] border-b border-[var(--color-border)]">
                          <th className="text-left py-2 px-2 w-12">Set</th>
                          <th className="text-left py-2 px-2 w-28">Type</th>
                          <th className="text-left py-2 px-2 w-28">Weight ({weightUnit})</th>
                          <th className="text-left py-2 px-2 w-24">Reps</th>
                          <th className="text-center py-2 px-2 w-20">Done</th>
                          <th className="w-10"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--color-border)]">
                        {activeEx.sets.map((set) => (
                          <tr
                            key={set.id}
                            className={cn(
                              'transition-colors',
                              set.is_completed && 'bg-[var(--color-accent-subtle)]'
                            )}
                          >
                            {/* Set Number */}
                            <td className="py-2 px-2 font-bold text-[var(--color-text-primary)]">
                              {set.set_number}
                            </td>

                            {/* Set Type Dropdown */}
                            <td className="py-2 px-2">
                              <select
                                value={set.set_type}
                                onChange={(e) =>
                                   updateSet(activeEx.id, set.id, {
                                     set_type: e.target.value as SetType,
                                   })
                                }
                                className="w-full text-xs px-2 py-1 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text-primary)] hover:border-[var(--color-text-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)] focus:border-[var(--color-accent)] transition-all cursor-pointer"
                              >
                                {setTypeOptions.map((opt) => (
                                  <option key={opt.value} value={opt.value}>
                                    {opt.label}
                                  </option>
                                ))}
                              </select>
                            </td>

                            {/* Weight (kg/lb) */}
                            <td className="py-2 px-2">
                              <div className="flex items-center gap-1">
                                <Input
                                  type="number"
                                  step="0.5"
                                  min={0}
                                  max={1000}
                                  placeholder="0"
                                  value={set.weight_kg}
                                  onChange={(e) =>
                                    updateSet(activeEx.id, set.id, {
                                      weight_kg: e.target.value,
                                    })
                                  }
                                  className="w-20 text-xs py-1 font-bold"
                                />
                                <span className="text-[10px] text-[var(--color-text-muted)] font-medium">
                                  {weightUnit}
                                </span>
                              </div>
                            </td>

                            {/* Reps */}
                            <td className="py-2 px-2">
                              <Input
                                type="number"
                                min={0}
                                max={500}
                                placeholder="0"
                                value={set.reps}
                                onChange={(e) =>
                                  updateSet(activeEx.id, set.id, {
                                    reps: e.target.value,
                                  })
                                }
                                className="w-16 text-xs py-1 font-bold"
                              />
                            </td>

                            {/* Complete Checkbox Button */}
                            <td className="py-2 px-2 text-center">
                              <button
                                type="button"
                                onClick={() => toggleSetCompleted(activeEx.id, set.id)}
                                className={cn(
                                  'w-7 h-7 rounded-lg inline-flex items-center justify-center transition-all cursor-pointer border',
                                  set.is_completed
                                    ? 'bg-[var(--color-accent)] text-white border-[var(--color-accent)] shadow-xs scale-105'
                                    : 'bg-[var(--color-surface)] border-[var(--color-border)] text-[var(--color-text-muted)] hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]'
                                )}
                                title={set.is_completed ? 'Mark incomplete' : 'Mark complete & start rest timer'}
                              >
                                <Check className="w-4 h-4 stroke-[3]" />
                              </button>
                            </td>

                            {/* Remove Set Button */}
                            <td className="py-2 px-1 text-right">
                              <button
                                type="button"
                                onClick={() => removeSetFromExercise(activeEx.id, set.id)}
                                disabled={activeEx.sets.length <= 1}
                                className="p-1 rounded text-[var(--color-text-muted)] hover:text-red-500 disabled:opacity-20 disabled:cursor-not-allowed"
                                title="Remove Set"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}

              <div className="flex justify-center pt-2">
                <Button
                  variant="outline"
                  size="md"
                  icon={<Plus className="w-4 h-4" />}
                  onClick={() => setIsExercisePickerOpen(true)}
                >
                  Add Another Movement
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Discard Confirmation Modal */}
      {isDiscardConfirmOpen && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsDiscardConfirmOpen(false)
          }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150"
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="discard-workout-title"
            className="w-full max-w-sm bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-6 space-y-4 shadow-2xl animate-in zoom-in-95 duration-150"
          >
            <div className="flex items-center gap-3 text-red-500">
              <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h4 id="discard-workout-title" className="text-base font-bold text-[var(--color-text-primary)]">
                  Discard Active Workout?
                </h4>
                <p className="text-xs text-[var(--color-text-secondary)]">
                  All logged sets in this active session will be permanently erased.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setIsDiscardConfirmOpen(false)}
              >
                Continue Workout
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={() => {
                  discardActiveWorkout()
                  setIsDiscardConfirmOpen(false)
                }}
              >
                Yes, Discard
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Exercise Picker Modal */}
      <ExerciseLibraryModal
        isOpen={isExercisePickerOpen}
        onClose={() => setIsExercisePickerOpen(false)}
        onSelectExercise={(ex: Exercise) => addExerciseToActiveWorkout(ex)}
        isSelectMode={true}
      />
    </div>
  )
}
