import React, { useState, useEffect } from 'react'
import {
  Layers,
  Play,
  Plus,
  Edit2,
  Trash2,
  Clock,
  Dumbbell,
} from 'lucide-react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { RoutineEditorModal } from './RoutineEditorModal'
import { useWorkout } from '../hooks/useWorkout'
import type { Routine } from '@/types/workout'

export const RoutineListCard: React.FC = () => {
  const { routines, saveRoutine, deleteRoutine, startWorkout } = useWorkout()

  const [isEditorOpen, setIsEditorOpen] = useState(false)
  const [editingRoutine, setEditingRoutine] = useState<Routine | null>(null)
  const [deletingRoutineId, setDeletingRoutineId] = useState<string | null>(null)

  const handleEdit = (routine: Routine) => {
    setEditingRoutine(routine)
    setIsEditorOpen(true)
  }

  const handleCreateNew = () => {
    setEditingRoutine(null)
    setIsEditorOpen(true)
  }

  // Escape key cancels deletion confirmation
  useEffect(() => {
    if (!deletingRoutineId) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setDeletingRoutineId(null)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [deletingRoutineId])

  return (
    <Card className="flex flex-col">
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[var(--color-accent-subtle)] text-[var(--color-accent)] flex items-center justify-center shrink-0">
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <CardTitle>Workout Routines</CardTitle>
              <CardDescription>
                Build repeatable workout splits and launch them directly into the live logger.
              </CardDescription>
            </div>
          </div>

          <Button
            variant="primary"
            size="sm"
            icon={<Plus className="w-3.5 h-3.5" />}
            onClick={handleCreateNew}
          >
            New Routine
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {routines.length === 0 ? (
          <div className="py-12 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-[var(--color-surface-subtle)] text-[var(--color-text-muted)] flex items-center justify-center mx-auto">
              <Dumbbell className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h4 className="text-sm font-semibold text-[var(--color-text-primary)]">
                No routines created yet
              </h4>
              <p className="text-xs text-[var(--color-text-secondary)] max-w-sm mx-auto">
                Create structured routines for Push, Pull, Legs, or custom full-body days.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              icon={<Plus className="w-3.5 h-3.5" />}
              onClick={handleCreateNew}
            >
              Create Your First Routine
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {routines.map((routine) => {
              const exerciseCount = routine.exercises?.length || 0
              const totalSets = routine.exercises?.reduce((acc, curr) => acc + (curr.target_sets || 3), 0) || 0

              // Unique muscle groups targeted
              const muscles = Array.from(
                new Set(routine.exercises?.map((e) => e.exercise?.muscle_group).filter(Boolean))
              )

              return (
                <div
                  key={routine.id}
                  className="p-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] hover:border-[var(--color-accent)] transition-all flex flex-col justify-between space-y-4 group shadow-2xs"
                >
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h4 className="text-base font-bold text-[var(--color-text-primary)] group-hover:text-[var(--color-accent)] transition-colors">
                          {routine.name}
                        </h4>
                        {routine.description && (
                          <p className="text-xs text-[var(--color-text-secondary)] line-clamp-2 mt-0.5">
                            {routine.description}
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleEdit(routine)}
                          className="p-1.5 rounded-lg text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-hover)] transition-colors"
                          title="Edit Routine"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeletingRoutineId(routine.id)}
                          className="p-1.5 rounded-lg text-[var(--color-text-muted)] hover:text-red-500 hover:bg-red-500/10 transition-colors"
                          title="Delete Routine"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      <Badge variant="outline" className="text-[11px] font-semibold">
                        {exerciseCount} Movement{exerciseCount === 1 ? '' : 's'}
                      </Badge>
                      <Badge variant="outline" className="text-[11px] font-semibold">
                        {totalSets} Total Sets
                      </Badge>
                      {muscles.slice(0, 3).map((m) => (
                        <span
                          key={m}
                          className="text-[10px] uppercase font-bold tracking-wider text-[var(--color-text-muted)] bg-[var(--color-surface-subtle)] px-2 py-0.5 rounded border border-[var(--color-border)]"
                        >
                          {m}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="pt-3 border-t border-[var(--color-border)] flex items-center justify-between gap-2">
                    <span className="text-[11px] text-[var(--color-text-muted)] flex items-center gap-1">
                      <Clock className="w-3 h-3" /> ~{totalSets * 3} mins estimated
                    </span>
                    <Button
                      variant="primary"
                      size="sm"
                      icon={<Play className="w-3.5 h-3.5 fill-current" />}
                      onClick={() => startWorkout(routine)}
                    >
                      Start Routine
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>

      {/* Routine Editor Modal */}
      <RoutineEditorModal
        isOpen={isEditorOpen}
        onClose={() => {
          setIsEditorOpen(false)
          setEditingRoutine(null)
        }}
        initialRoutine={editingRoutine}
        onSave={async (data) => {
          await saveRoutine(data)
        }}
      />

      {/* Delete Routine Confirmation */}
      {deletingRoutineId && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setDeletingRoutineId(null)
          }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150"
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-routine-dialog-title"
            className="w-full max-w-sm bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-6 space-y-4 shadow-xl animate-in zoom-in-95 duration-150"
          >
            <h4 id="delete-routine-dialog-title" className="text-base font-bold text-[var(--color-text-primary)]">
              Delete Routine?
            </h4>
            <p className="text-xs text-[var(--color-text-secondary)]">
              Are you sure you want to delete this routine? This action cannot be undone. Existing logged workouts will remain saved in your history.
            </p>
            <div className="flex items-center justify-end gap-2.5 pt-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setDeletingRoutineId(null)}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={async () => {
                  await deleteRoutine(deletingRoutineId)
                  setDeletingRoutineId(null)
                }}
              >
                Delete
              </Button>
            </div>
          </div>
        </div>
      )}
    </Card>
  )
}
