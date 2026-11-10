import React, { useState, useEffect } from 'react'
import {
  Calendar,
  Clock,
  Flame,
  ChevronDown,
  ChevronUp,
  Trash2,
  Dumbbell,
  Layers,
} from 'lucide-react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { useWorkout } from '../hooks/useWorkout'
import { useUnit } from '@/hooks/useUnit'

export const WorkoutHistoryCard: React.FC = () => {
  const { sessions, deleteSession } = useWorkout()
  const { weightUnit, kgToDisplay, formatWeight } = useUnit()

  const [expandedSessionId, setExpandedSessionId] = useState<string | null>(null)
  const [deletingSessionId, setDeletingSessionId] = useState<string | null>(null)

  const toggleExpand = (id: string) => {
    setExpandedSessionId((prev) => (prev === id ? null : id))
  }

  // Escape key cancels deletion confirmation
  useEffect(() => {
    if (!deletingSessionId) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setDeletingSessionId(null)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [deletingSessionId])

  const formatDuration = (totalSec: number) => {
    const hrs = Math.floor(totalSec / 3600)
    const mins = Math.floor((totalSec % 3600) / 60)
    const secs = totalSec % 60
    if (hrs > 0) {
      return `${hrs}h ${mins}m`
    }
    if (mins > 0) {
      return `${mins}m ${secs}s`
    }
    return `${secs}s`
  }

  const formatDate = (isoStr: string) => {
    const date = new Date(isoStr)
    return date.toLocaleDateString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }

  const formatTime = (isoStr: string) => {
    const date = new Date(isoStr)
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  return (
    <Card className="flex flex-col">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[var(--color-accent-subtle)] text-[var(--color-accent)] flex items-center justify-center shrink-0">
              <Calendar className="w-4 h-4" />
            </div>
            <div>
              <CardTitle>Workout History</CardTitle>
              <CardDescription>
                Chronological log of completed sessions, volume loads, and working set performance.
              </CardDescription>
            </div>
          </div>
          <Badge variant="outline" className="font-semibold text-xs">
            {sessions.length} Logged Session{sessions.length === 1 ? '' : 's'}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {sessions.length === 0 ? (
          <div className="py-12 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-[var(--color-surface-subtle)] text-[var(--color-text-muted)] flex items-center justify-center mx-auto">
              <Dumbbell className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h4 className="text-sm font-semibold text-[var(--color-text-primary)]">
                No completed workouts yet
              </h4>
              <p className="text-xs text-[var(--color-text-secondary)] max-w-sm mx-auto">
                Start an active workout session from your routines or log a quick workout to track historical progress.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {sessions.map((session) => {
              const isExpanded = expandedSessionId === session.id
              const completedSets = (session.sets || []).filter((s) => s.is_completed)

              // Group sets by exercise
              const exerciseGroups = new Map<string, { exerciseName: string; sets: typeof completedSets }>()
              completedSets.forEach((st) => {
                const exName = st.exercise?.name || 'Movement'
                if (!exerciseGroups.has(exName)) {
                  exerciseGroups.set(exName, { exerciseName: exName, sets: [] })
                }
                exerciseGroups.get(exName)!.sets.push(st)
              })

              return (
                <div
                  key={session.id}
                  className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] overflow-hidden transition-all shadow-2xs"
                >
                  {/* Session Header / Row */}
                  <div
                    onClick={() => toggleExpand(session.id)}
                    className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer hover:bg-[var(--color-surface-hover)] transition-colors"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <h4 className="text-base font-bold text-[var(--color-text-primary)]">
                          {session.name}
                        </h4>
                        <span className="text-xs text-[var(--color-text-muted)]">
                          {formatTime(session.completed_at || session.started_at)}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-[var(--color-text-secondary)]">
                        <Calendar className="w-3.5 h-3.5 text-[var(--color-accent)]" />
                        <span>{formatDate(session.completed_at || session.started_at)}</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-4 shrink-0">
                      <div className="flex items-center gap-3 text-xs">
                        <div className="flex items-center gap-1 text-[var(--color-text-secondary)] font-medium">
                          <Clock className="w-3.5 h-3.5 text-[var(--color-text-muted)]" />
                          <span>{formatDuration(session.duration_seconds)}</span>
                        </div>

                        <div className="flex items-center gap-1 text-[var(--color-accent)] font-bold">
                          <Flame className="w-3.5 h-3.5" />
                          <span>{formatWeight(session.total_volume_kg || 0, { decimals: 0 })}</span>
                        </div>

                        <div className="flex items-center gap-1 text-[var(--color-text-muted)]">
                          <Layers className="w-3.5 h-3.5" />
                          <span>{completedSets.length} sets</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            setDeletingSessionId(session.id)
                          }}
                          className="p-1.5 rounded-lg text-[var(--color-text-muted)] hover:text-red-500 hover:bg-red-500/10 transition-colors"
                          title="Delete Session"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                        <div className="p-1 rounded text-[var(--color-text-muted)]">
                          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Expanded Breakdown Table */}
                  {isExpanded && (
                    <div className="p-4 bg-[var(--color-surface-subtle)] border-t border-[var(--color-border)] space-y-4 animate-in fade-in duration-100">
                      {exerciseGroups.size === 0 ? (
                        <p className="text-xs text-[var(--color-text-muted)] italic">
                          No completed sets recorded in this session.
                        </p>
                      ) : (
                        Array.from(exerciseGroups.values()).map((grp, idx) => (
                          <div key={idx} className="space-y-1.5">
                            <h5 className="text-xs font-bold text-[var(--color-text-primary)] flex items-center gap-2">
                              <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-accent)]" />
                              {grp.exerciseName}
                            </h5>

                            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2">
                              {grp.sets.map((st) => (
                                <div
                                  key={st.id}
                                  className="p-2 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] text-xs flex items-center justify-between"
                                >
                                  <span className="text-[10px] text-[var(--color-text-muted)] font-bold">
                                    Set {st.set_number}
                                  </span>
                                  <strong className="text-[var(--color-text-primary)]">
                                    {kgToDisplay(st.weight_kg)} {weightUnit} × {st.reps}
                                  </strong>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))
                      )}

                      {session.notes && (
                        <div className="text-xs text-[var(--color-text-secondary)] pt-2 border-t border-[var(--color-border)]">
                          <strong>Session Notes:</strong> {session.notes}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </CardContent>

      {/* Delete Session Confirmation Modal */}
      {deletingSessionId && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setDeletingSessionId(null)
          }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150"
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-workout-session-title"
            className="w-full max-w-sm bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-6 space-y-4 shadow-xl animate-in zoom-in-95 duration-150"
          >
            <h4 id="delete-workout-session-title" className="text-base font-bold text-[var(--color-text-primary)]">
              Delete Workout Session?
            </h4>
            <p className="text-xs text-[var(--color-text-secondary)]">
              Are you sure you want to delete this completed workout session and its set logs? This cannot be undone.
            </p>
            <div className="flex items-center justify-end gap-2.5 pt-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setDeletingSessionId(null)}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={async () => {
                  await deleteSession(deletingSessionId)
                  setDeletingSessionId(null)
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
