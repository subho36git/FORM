import React, { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  Dumbbell,
  Play,
  Layers,
  Calendar,
  TrendingUp,
  BookOpen,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { RoutineListCard } from './components/RoutineListCard'
import { LiveWorkoutTracker } from './components/LiveWorkoutTracker'
import { WorkoutHistoryCard } from './components/WorkoutHistoryCard'
import { ExerciseProgressCard } from './components/ExerciseProgressCard'
import { ExerciseLibraryModal } from './components/ExerciseLibraryModal'
import { RestTimerBanner } from './components/RestTimerBanner'
import { useWorkout } from './hooks/useWorkout'
import { useUnit } from '@/hooks/useUnit'
import { cn } from '@/lib/utils'

type WorkoutTab = 'routines' | 'active' | 'history' | 'progress' | 'library'

export const WorkoutsPage: React.FC = () => {
  const { activeWorkout, startWorkout, routines, sessions } = useWorkout()
  const { unitSystem } = useUnit()
  const [searchParams, setSearchParams] = useSearchParams()

  const [activeTab, setActiveTab] = useState<WorkoutTab>(() => {
    if (activeWorkout) return 'active'
    const tabParam = searchParams.get('tab') as WorkoutTab
    if (['routines', 'active', 'history', 'progress', 'library'].includes(tabParam)) {
      return tabParam
    }
    return 'routines'
  })

  // Synchronize activeTab when activeWorkout status changes during render
  const [prevHasActiveWorkout, setPrevHasActiveWorkout] = useState(Boolean(activeWorkout))
  if (Boolean(activeWorkout) !== prevHasActiveWorkout) {
    setPrevHasActiveWorkout(Boolean(activeWorkout))
    if (activeWorkout) {
      setActiveTab('active')
    }
  }

  const [isLibraryModalOpen, setIsLibraryModalOpen] = useState(false)

  // Handle action query params (e.g. /workouts?action=start)
  useEffect(() => {
    const action = searchParams.get('action')
    if (action === 'start') {
      startWorkout(null, 'Quick Workout')
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev)
          next.delete('action')
          return next
        },
        { replace: true }
      )
    }
  }, [searchParams, startWorkout, setSearchParams])

  const tabs: { key: WorkoutTab; label: string; icon: React.ReactNode; badge?: string | number }[] = [
    {
      key: 'routines',
      label: 'Routines',
      icon: <Layers className="w-4 h-4" />,
      badge: routines.length > 0 ? routines.length : undefined,
    },
    {
      key: 'active',
      label: 'Active Session',
      icon: <Play className="w-4 h-4 fill-current" />,
      badge: activeWorkout ? 'LIVE' : undefined,
    },
    {
      key: 'history',
      label: 'History',
      icon: <Calendar className="w-4 h-4" />,
      badge: sessions.length > 0 ? sessions.length : undefined,
    },
    {
      key: 'progress',
      label: 'Strength & PRs',
      icon: <TrendingUp className="w-4 h-4" />,
    },
    {
      key: 'library',
      label: 'Exercise Library',
      icon: <BookOpen className="w-4 h-4" />,
    },
  ]

  return (
    <div className="p-4 sm:p-6 md:p-10 max-w-7xl mx-auto w-full space-y-6 sm:space-y-8 animate-in fade-in duration-200">
      {/* Header & Quick Action Buttons */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Badge variant="accent">Workout Tracker</Badge>
            {activeWorkout && (
              <Badge variant="outline" className="bg-[var(--color-accent-subtle)] text-[var(--color-accent-text)] border-[var(--color-accent)]/20 font-bold animate-pulse">
                Workout In Progress
              </Badge>
            )}
          </div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-[var(--color-text-primary)]">
            Workout Tracking & Routines
          </h1>
          <p className="text-sm text-[var(--color-text-secondary)] mt-0.5">
            Build custom splits, log sets in {unitSystem === 'metric' ? 'kilograms' : 'pounds'}, and track personal record progressions.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            variant="secondary"
            size="md"
            icon={<BookOpen className="w-4 h-4" />}
            onClick={() => setIsLibraryModalOpen(true)}
          >
            Exercise Library
          </Button>

          {!activeWorkout ? (
            <Button
              variant="primary"
              size="md"
              icon={<Play className="w-4 h-4 fill-current" />}
              onClick={() => {
                startWorkout(null, 'Quick Workout')
                setActiveTab('active')
              }}
            >
              Start Empty Workout
            </Button>
          ) : (
            <Button
              variant="primary"
              size="md"
              icon={<Play className="w-4 h-4 fill-current" />}
              onClick={() => setActiveTab('active')}
            >
              Resume Live Workout
            </Button>
          )}
        </div>
      </div>

      {/* Prominent Active Workout Banner if viewing another tab */}
      {activeWorkout && activeTab !== 'active' && (
        <div
          onClick={() => setActiveTab('active')}
          className="p-4 rounded-xl bg-[var(--color-accent-subtle)] border-2 border-[var(--color-accent)] flex items-center justify-between gap-3 cursor-pointer hover:opacity-95 transition-all shadow-md"
        >
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 rounded-full bg-[var(--color-accent)] animate-ping" />
            <div>
              <div className="text-sm font-bold text-[var(--color-text-primary)]">
                Workout currently in progress: <span className="text-[var(--color-accent)]">{activeWorkout.name}</span>
              </div>
              <div className="text-xs text-[var(--color-text-muted)]">
                Click here to return to your active logging screen.
              </div>
            </div>
          </div>
          <Button variant="primary" size="sm" icon={<Play className="w-3.5 h-3.5 fill-current" />}>
            Resume
          </Button>
        </div>
      )}

      {/* Tabs Navigation */}
      <div className="flex items-center gap-1.5 p-1 bg-[var(--color-surface-hover)] rounded-xl border border-[var(--color-border)] overflow-x-auto scrollbar-none max-w-full">
        {tabs.map((tab) => {
          const isSelected = activeTab === tab.key
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                'flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer',
                isSelected
                  ? 'bg-[var(--color-surface)] text-[var(--color-text-primary)] shadow-xs font-bold'
                  : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
              )}
            >
              {tab.icon}
              <span>{tab.label}</span>
              {tab.badge !== undefined && (
                <span
                  className={cn(
                    'px-1.5 py-0.2 rounded-full text-[10px] font-bold',
                    tab.key === 'active'
                      ? 'bg-[var(--color-accent)] text-white animate-pulse'
                      : 'bg-[var(--color-surface-subtle)] border border-[var(--color-border)] text-[var(--color-text-muted)]'
                  )}
                >
                  {tab.badge}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Tab Panels */}
      <div className="space-y-6">
        {activeTab === 'routines' && <RoutineListCard />}

        {activeTab === 'active' && (
          activeWorkout ? (
            <LiveWorkoutTracker />
          ) : (
            <div className="py-16 text-center border-2 border-dashed border-[var(--color-border)] rounded-2xl p-8 space-y-4 bg-[var(--color-surface)]">
              <div className="w-14 h-14 rounded-2xl bg-[var(--color-surface-subtle)] text-[var(--color-accent)] flex items-center justify-center mx-auto shadow-2xs">
                <Dumbbell className="w-7 h-7" />
              </div>
              <div className="space-y-1 max-w-md mx-auto">
                <h3 className="text-lg font-bold text-[var(--color-text-primary)]">
                  No Workout Session In Progress
                </h3>
                <p className="text-xs text-[var(--color-text-secondary)]">
                  Launch a session from one of your saved routines or start a blank workout to log exercises and working sets in real-time.
                </p>
              </div>
              <div className="flex justify-center gap-3 pt-2">
                <Button
                  variant="primary"
                  size="md"
                  icon={<Play className="w-4 h-4 fill-current" />}
                  onClick={() => startWorkout(null, 'Quick Workout')}
                >
                  Start Empty Workout
                </Button>
                <Button
                  variant="secondary"
                  size="md"
                  icon={<Layers className="w-4 h-4" />}
                  onClick={() => setActiveTab('routines')}
                >
                  Browse Routines
                </Button>
              </div>
            </div>
          )
        )}

        {activeTab === 'history' && <WorkoutHistoryCard />}

        {activeTab === 'progress' && <ExerciseProgressCard />}

        {activeTab === 'library' && (
          <div className="py-2">
            <ExerciseLibraryModal
              isOpen={true}
              onClose={() => setActiveTab('routines')}
              isSelectMode={false}
            />
          </div>
        )}
      </div>

      {/* Global Interactive Rest Timer Banner */}
      <RestTimerBanner />

      {/* Standalone Exercise Library Modal (Accessible from any tab via top button) */}
      <ExerciseLibraryModal
        isOpen={isLibraryModalOpen}
        onClose={() => setIsLibraryModalOpen(false)}
      />
    </div>
  )
}
