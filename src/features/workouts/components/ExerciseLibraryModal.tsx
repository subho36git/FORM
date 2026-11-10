import React, { useState, useMemo, useEffect } from 'react'
import {
  Search,
  Plus,
  Dumbbell,
  Check,
  X,
  Trash2,
  Info,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'
import { useWorkout } from '../hooks/useWorkout'
import { CreateExerciseModal } from './CreateExerciseModal'
import type { Exercise, MuscleGroup } from '@/types/workout'
import { cn } from '@/lib/utils'

interface ExerciseLibraryModalProps {
  isOpen: boolean
  onClose: () => void
  onSelectExercise?: (exercise: Exercise) => void
  isSelectMode?: boolean
}

const MUSCLE_FILTER_TABS: { value: MuscleGroup | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'chest', label: 'Chest' },
  { value: 'back', label: 'Back' },
  { value: 'shoulders', label: 'Shoulders' },
  { value: 'legs', label: 'Legs' },
  { value: 'arms', label: 'Arms' },
  { value: 'core', label: 'Core' },
]

export const ExerciseLibraryModal: React.FC<ExerciseLibraryModalProps> = ({
  isOpen,
  onClose,
  onSelectExercise,
  isSelectMode = false,
}) => {
  const { exercises, addCustomExercise, deleteCustomExercise } = useWorkout()

  const [searchQuery, setSearchQuery] = useState('')
  const [selectedMuscle, setSelectedMuscle] = useState<MuscleGroup | 'all'>('all')
  const [selectedEquipment, setSelectedEquipment] = useState<string>('all')
  const [showCustomOnly, setShowCustomOnly] = useState(false)
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [selectedDetailsExercise, setSelectedDetailsExercise] = useState<Exercise | null>(null)

  const filteredExercises = useMemo(() => {
    return exercises.filter((ex) => {
      // Muscle Group
      if (selectedMuscle !== 'all' && ex.muscle_group !== selectedMuscle) {
        return false
      }
      // Equipment
      if (selectedEquipment !== 'all' && ex.equipment !== selectedEquipment) {
        return false
      }
      // Custom filter
      if (showCustomOnly && !ex.is_custom) {
        return false
      }
      // Text search
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase()
        const matchesName = ex.name.toLowerCase().includes(query)
        const matchesMuscle = ex.muscle_group.toLowerCase().includes(query)
        const matchesEquip = ex.equipment.toLowerCase().includes(query)
        return matchesName || matchesMuscle || matchesEquip
      }
      return true
    })
  }, [exercises, selectedMuscle, selectedEquipment, showCustomOnly, searchQuery])

  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (selectedDetailsExercise) {
          setSelectedDetailsExercise(null)
        } else if (!isCreateModalOpen) {
          onClose()
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, selectedDetailsExercise, isCreateModalOpen, onClose])

  if (!isOpen) return null

  const handleCreateCustom = async (newEx: Exercise) => {
    try {
      const created = await addCustomExercise({
        name: newEx.name,
        muscle_group: newEx.muscle_group,
        equipment: newEx.equipment,
        instructions: newEx.instructions,
      })
      if (isSelectMode && onSelectExercise) {
        onSelectExercise(created)
        onClose()
      }
    } catch (e) {
      console.error(e)
    }
  }

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget && !isCreateModalOpen) {
      onClose()
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
        aria-labelledby="exercise-library-modal-title"
        className="w-full max-w-3xl max-h-[88vh] flex flex-col bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--color-border)] shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[var(--color-accent-subtle)] text-[var(--color-accent)] flex items-center justify-center">
              <Dumbbell className="w-4 h-4" />
            </div>
            <div>
              <h3 id="exercise-library-modal-title" className="text-base font-semibold text-[var(--color-text-primary)]">
                {isSelectMode ? 'Select Exercise' : 'Exercise Library'}
              </h3>
              <p className="text-xs text-[var(--color-text-muted)]">
                {filteredExercises.length} movement{filteredExercises.length === 1 ? '' : 's'} available
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              icon={<Plus className="w-3.5 h-3.5" />}
              onClick={() => setIsCreateModalOpen(true)}
            >
              New Custom
            </Button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close dialog"
              className="w-11 h-11 flex items-center justify-center rounded-xl text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-hover)] transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Filter & Search Bar */}
        <div className="p-4 border-b border-[var(--color-border)] space-y-3 shrink-0 bg-[var(--color-surface-subtle)]">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] pointer-events-none" />
              <Input
                type="text"
                placeholder="Search movements by name, muscle, equipment..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 text-xs py-2 w-full"
                autoFocus={isSelectMode}
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  aria-label="Clear search"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <select
              value={selectedEquipment}
              onChange={(e) => setSelectedEquipment(e.target.value)}
              className="px-3 py-2 text-xs rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text-primary)] hover:border-[var(--color-text-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)] focus:border-[var(--color-accent)] shrink-0 transition-all cursor-pointer"
            >
              <option value="all">All Equipment</option>
              <option value="barbell">Barbell</option>
              <option value="dumbbell">Dumbbell</option>
              <option value="machine">Machine</option>
              <option value="cable">Cable</option>
              <option value="bodyweight">Bodyweight</option>
            </select>
          </div>

          {/* Muscle Category Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            {MUSCLE_FILTER_TABS.map((tab) => {
              const isSelected = selectedMuscle === tab.value
              return (
                <button
                  key={tab.value}
                  type="button"
                  onClick={() => setSelectedMuscle(tab.value)}
                  className={cn(
                    'px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-colors cursor-pointer',
                    isSelected
                      ? 'bg-[var(--color-accent)] text-white font-semibold shadow-xs'
                      : 'bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
                  )}
                >
                  {tab.label}
                </button>
              )
            })}

            <button
              type="button"
              onClick={() => setShowCustomOnly((prev) => !prev)}
              className={cn(
                'ml-auto px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-colors cursor-pointer',
                showCustomOnly
                  ? 'bg-amber-500/20 text-amber-500 border border-amber-500/30'
                  : 'bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
              )}
            >
              Custom Only
            </button>
          </div>
        </div>

        {/* Scrollable Exercise Items List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {filteredExercises.length === 0 ? (
            <div className="py-12 text-center space-y-3">
              <div className="w-10 h-10 rounded-full bg-[var(--color-surface-hover)] text-[var(--color-text-muted)] flex items-center justify-center mx-auto">
                <Search className="w-5 h-5" />
              </div>
              <p className="text-sm font-medium text-[var(--color-text-secondary)]">
                No exercises found matching your filter criteria.
              </p>
              <Button
                variant="outline"
                size="sm"
                icon={<Plus className="w-3.5 h-3.5" />}
                onClick={() => setIsCreateModalOpen(true)}
              >
                Create "{searchQuery || 'Custom'}" Exercise
              </Button>
            </div>
          ) : (
            filteredExercises.map((ex) => (
              <div
                key={ex.id}
                className={cn(
                  'p-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] hover:bg-[var(--color-surface-hover)] transition-all flex items-center justify-between gap-3 group',
                  isSelectMode && 'cursor-pointer hover:border-[var(--color-accent)]'
                )}
                onClick={() => {
                  if (isSelectMode && onSelectExercise) {
                    onSelectExercise(ex)
                    onClose()
                  }
                }}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-[var(--color-surface-subtle)] border border-[var(--color-border)] flex items-center justify-center text-[var(--color-text-secondary)] shrink-0">
                    <Dumbbell className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-semibold text-[var(--color-text-primary)] truncate">
                        {ex.name}
                      </h4>
                      {ex.is_custom && (
                        <Badge variant="outline" className="text-[10px] bg-amber-500/10 text-amber-500 border-amber-500/20 py-0 px-1.5">
                          Custom
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5 text-[11px] text-[var(--color-text-muted)]">
                      <span className="capitalize">{ex.muscle_group}</span>
                      <span>•</span>
                      <span className="capitalize">{ex.equipment}</span>
                      {ex.instructions && (
                        <>
                          <span>•</span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              setSelectedDetailsExercise(ex)
                            }}
                            className="text-[var(--color-accent)] hover:underline flex items-center gap-0.5 cursor-pointer"
                          >
                            <Info className="w-3 h-3" /> Info
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                  {ex.is_custom && (
                    <button
                      type="button"
                      onClick={() => deleteCustomExercise(ex.id)}
                      className="p-1.5 rounded-md text-[var(--color-text-muted)] hover:text-red-500 hover:bg-red-500/10 transition-colors cursor-pointer"
                      title="Delete custom exercise"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}

                  {isSelectMode ? (
                    <Button
                      type="button"
                      variant="primary"
                      size="sm"
                      icon={<Check className="w-3.5 h-3.5" />}
                      onClick={() => {
                        if (onSelectExercise) {
                          onSelectExercise(ex)
                          onClose()
                        }
                      }}
                    >
                      Select
                    </Button>
                  ) : null}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Create Custom Exercise Modal */}
      <CreateExerciseModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onCreated={handleCreateCustom}
      />

      {/* Instructions Details Modal */}
      {selectedDetailsExercise && (
        <div
          onClick={() => setSelectedDetailsExercise(null)}
          className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-100"
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="exercise-details-title"
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-6 space-y-4 shadow-xl animate-in zoom-in-95 duration-100"
          >
            <div className="flex items-center justify-between">
              <h4 id="exercise-details-title" className="text-base font-semibold text-[var(--color-text-primary)]">
                {selectedDetailsExercise.name}
              </h4>
              <button
                type="button"
                onClick={() => setSelectedDetailsExercise(null)}
                className="w-11 h-11 flex items-center justify-center rounded-xl text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-hover)] transition-colors cursor-pointer"
                aria-label="Close details dialog"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <Badge variant="outline" className="capitalize">
                {selectedDetailsExercise.muscle_group}
              </Badge>
              <Badge variant="outline" className="capitalize">
                {selectedDetailsExercise.equipment}
              </Badge>
            </div>
            <div className="p-3.5 rounded-xl bg-[var(--color-surface-subtle)] border border-[var(--color-border)] text-xs text-[var(--color-text-secondary)] leading-relaxed">
              {selectedDetailsExercise.instructions || 'No special form notes provided.'}
            </div>
            <div className="flex justify-end">
              <Button size="sm" variant="secondary" onClick={() => setSelectedDetailsExercise(null)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
