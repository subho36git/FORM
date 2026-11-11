import React, { useState, useMemo } from 'react'
import {
  TrendingUp,
  Award,
  Flame,
  Scale,
  Layers,
  Dumbbell,
} from 'lucide-react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card'
import { useWorkout } from '../hooks/useWorkout'
import { useUnit } from '@/hooks/useUnit'

export const ExerciseProgressCard: React.FC = () => {
  const { exercises, sessions, getExerciseProgress } = useWorkout()
  const { weightUnit, kgToDisplay } = useUnit()

  // Find exercises that actually have logged sets first, or fallback to first available exercise
  const exercisesWithHistory = useMemo(() => {
    const setExIds = new Set<string>()
    sessions.forEach((s) => {
      s.sets?.forEach((st) => {
        if (st.is_completed) setExIds.add(st.exercise_id)
      })
    })
    return exercises.filter((ex) => setExIds.has(ex.id))
  }, [exercises, sessions])

  const [selectedExerciseId, setSelectedExerciseId] = useState<string>('')

  const activeExerciseId =
    selectedExerciseId || exercisesWithHistory[0]?.id || exercises[0]?.id || ''

  const progress = useMemo(() => {
    if (!activeExerciseId) return null
    return getExerciseProgress(activeExerciseId)
  }, [activeExerciseId, getExerciseProgress])

  const selectedExercise = exercises.find((e) => e.id === activeExerciseId)

  return (
    <Card className="flex flex-col">
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[var(--color-accent-subtle)] text-[var(--color-accent)] flex items-center justify-center shrink-0">
              <TrendingUp className="w-4 h-4" />
            </div>
            <div>
              <CardTitle>Strength Progression & Personal Records</CardTitle>
              <CardDescription>
                Track estimated 1-Rep Max (Epley formula), heaviest loads, and historical volume trends.
              </CardDescription>
            </div>
          </div>

          {/* Exercise Selector */}
          <div className="w-full sm:w-72">
            <select
              value={activeExerciseId}
              onChange={(e) => setSelectedExerciseId(e.target.value)}
              className="w-full px-3 py-2 text-xs font-semibold rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text-primary)] hover:border-[var(--color-text-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)] focus:border-[var(--color-accent)] transition-all cursor-pointer"
            >
              {exercises.map((ex) => {
                const hasHistory = exercisesWithHistory.some((eh) => eh.id === ex.id)
                return (
                  <option key={ex.id} value={ex.id}>
                    {ex.name} {hasHistory ? '★' : ''} ({ex.muscle_group})
                  </option>
                )
              })}
            </select>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {!selectedExercise ? (
          <div className="py-8 text-center text-xs text-[var(--color-text-muted)]">
            Please select an exercise to view strength progression.
          </div>
        ) : !progress || progress.history.length === 0 ? (
          <div className="py-12 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-[var(--color-surface-subtle)] text-[var(--color-text-muted)] flex items-center justify-center mx-auto">
              <Dumbbell className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h4 className="text-sm font-semibold text-[var(--color-text-primary)]">
                No recorded sets for {selectedExercise.name}
              </h4>
              <p className="text-xs text-[var(--color-text-secondary)] max-w-sm mx-auto">
                Log completed working sets of this movement in an active workout session to generate PR records and progressive overload analytics.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* PR Summary Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {/* Heaviest Weight */}
              <div className="p-4 rounded-xl bg-[var(--color-surface-subtle)] border border-[var(--color-border)] space-y-1">
                <div className="flex items-center justify-between text-xs text-[var(--color-text-muted)] font-semibold uppercase tracking-wider">
                  <span>Heaviest Load</span>
                  <Award className="w-4 h-4 text-amber-500" />
                </div>
                <div className="text-2xl font-black text-[var(--color-text-primary)]">
                  {kgToDisplay(progress.maxWeightKg)} <span className="text-xs font-semibold text-[var(--color-text-muted)]">{weightUnit}</span>
                </div>
                <div className="text-[10px] text-[var(--color-text-secondary)]">All-time maximum weight</div>
              </div>

              {/* Estimated 1-Rep Max */}
              <div className="p-4 rounded-xl bg-[var(--color-surface-subtle)] border border-[var(--color-border)] space-y-1">
                <div className="flex items-center justify-between text-xs text-[var(--color-text-muted)] font-semibold uppercase tracking-wider">
                  <span>Estimated 1RM</span>
                  <Scale className="w-4 h-4 text-[var(--color-accent)]" />
                </div>
                <div className="text-2xl font-black text-[var(--color-accent)]">
                  {kgToDisplay(progress.estimated1RmKg)} <span className="text-xs font-semibold text-[var(--color-text-muted)]">{weightUnit}</span>
                </div>
                <div className="text-[10px] text-[var(--color-text-secondary)]">Epley theoretical single</div>
              </div>

              {/* Best Single Session Volume */}
              <div className="p-4 rounded-xl bg-[var(--color-surface-subtle)] border border-[var(--color-border)] space-y-1">
                <div className="flex items-center justify-between text-xs text-[var(--color-text-muted)] font-semibold uppercase tracking-wider">
                  <span>Best Volume</span>
                  <Flame className="w-4 h-4 text-[var(--color-accent-secondary)]" />
                </div>
                <div className="text-2xl font-black text-[var(--color-text-primary)]">
                  {Math.round(kgToDisplay(progress.maxVolumeSessionKg)).toLocaleString()} <span className="text-xs font-semibold text-[var(--color-text-muted)]">{weightUnit}</span>
                </div>
                <div className="text-[10px] text-[var(--color-text-secondary)]">Peak single session tonnage</div>
              </div>

              {/* Total Sets Logged */}
              <div className="p-4 rounded-xl bg-[var(--color-surface-subtle)] border border-[var(--color-border)] space-y-1">
                <div className="flex items-center justify-between text-xs text-[var(--color-text-muted)] font-semibold uppercase tracking-wider">
                  <span>Completed Sets</span>
                  <Layers className="w-4 h-4 text-[var(--color-lavender)]" />
                </div>
                <div className="text-2xl font-black text-[var(--color-text-primary)]">
                  {progress.totalSetsLogged} <span className="text-xs font-semibold text-[var(--color-text-muted)]">sets</span>
                </div>
                <div className="text-[10px] text-[var(--color-text-secondary)]">Across {progress.history.length} workout days</div>
              </div>
            </div>

            {/* Historical Progression Table */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted)]">
                Performance Timeline ({progress.history.length} Sessions)
              </h4>

              <div className="overflow-x-auto rounded-xl border border-[var(--color-border)]">
                <table className="w-full text-xs text-left">
                  <thead className="bg-[var(--color-surface-subtle)] text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-muted)] border-b border-[var(--color-border)]">
                    <tr>
                      <th className="py-2.5 px-3">Date</th>
                      <th className="py-2.5 px-3">Session</th>
                      <th className="py-2.5 px-3">Top Set</th>
                      <th className="py-2.5 px-3">Est. 1RM</th>
                      <th className="py-2.5 px-3">Total Volume</th>
                      <th className="py-2.5 px-3">Sets Completed</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--color-border)]">
                    {[...progress.history].reverse().map((h, idx) => (
                      <tr key={idx} className="hover:bg-[var(--color-surface-hover)] transition-colors">
                        <td className="py-2.5 px-3 font-semibold text-[var(--color-text-primary)] whitespace-nowrap">
                          {new Date(h.sessionDate).toLocaleDateString(undefined, {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })}
                        </td>
                        <td className="py-2.5 px-3 text-[var(--color-text-secondary)] font-medium">
                          {h.sessionName}
                        </td>
                        <td className="py-2.5 px-3 font-bold text-[var(--color-text-primary)]">
                          {kgToDisplay(h.topSetWeightKg)} {weightUnit} × {h.topSetReps}
                        </td>
                        <td className="py-2.5 px-3 font-bold text-[var(--color-accent)]">
                          {kgToDisplay(h.estimated1RmKg)} {weightUnit}
                        </td>
                        <td className="py-2.5 px-3 text-[var(--color-text-primary)] font-semibold">
                          {Math.round(kgToDisplay(h.totalVolumeKg)).toLocaleString()} {weightUnit}
                        </td>
                        <td className="py-2.5 px-3 text-[var(--color-text-muted)]">
                          {h.sets.length} working set{h.sets.length === 1 ? '' : 's'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
