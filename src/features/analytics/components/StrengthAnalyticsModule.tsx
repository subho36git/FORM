import React, { useState, useMemo } from 'react'
import {
  Dumbbell,
  Trophy,
  Flame,
  Calendar,
  Layers,
  ChevronRight,
  TrendingUp,
  Activity,
  Search,
  Sparkles,
} from 'lucide-react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Input } from '@/components/ui/Input'
import { useWorkout } from '@/features/workouts/context/WorkoutContext'
import { useUnit } from '@/hooks/useUnit'
import {
  calculateEpley1Rm,
  calculateWeeklyVolumeAggregation,
  calculateMuscleGroupDistribution,
  detectPersonalRecords,
  calculateMostImprovedExercise,
  toLocalDateString,
} from '../utils/analyticsCalculations'
import { analyticsService } from '../services/analyticsService'
import { TrendLineChart, type TrendLineSeries, type TargetLine } from './charts/TrendLineChart'
import { ComparisonBarChart, type ComparisonBarItem } from './charts/ComparisonBarChart'
import { DonutDistributionChart, type DonutSegment } from './charts/DonutDistributionChart'
import type { AnalyticsTimeframe } from '../types'
import type { MuscleGroup, Exercise } from '@/types/workout'

const MUSCLE_GROUP_LABELS: Record<MuscleGroup, string> = {
  chest: 'Chest',
  back: 'Back',
  legs: 'Legs',
  shoulders: 'Shoulders',
  arms: 'Arms',
  core: 'Core',
  full_body: 'Full Body',
  other: 'Other',
}

const MUSCLE_PALETTE: Record<MuscleGroup, string> = {
  chest: '#3B82F6', // Blue
  back: '#10B981', // Emerald / Accent
  legs: '#8B5CF6', // Purple
  shoulders: '#F59E0B', // Amber
  arms: '#EC4899', // Pink
  core: '#14B8A6', // Teal
  full_body: '#6366F1', // Indigo
  other: '#94A3B8', // Slate / Muted
}

export const StrengthAnalyticsModule: React.FC = () => {
  const { exercises, sessions, isLoading } = useWorkout()
  const { weightUnit, kgToDisplay } = useUnit()

  // Selected global timeframe filter: 1M (30d), 3M (90d), 6M (180d), 1Y (1y), All (all)
  const [timeframe, setTimeframe] = useState<AnalyticsTimeframe>('90d')

  // Dedicated timeframe filter for Weekly Workload Progression (1M, 3M, 6M, 1Y, All)
  const [volumeTimeframe, setVolumeTimeframe] = useState<AnalyticsTimeframe>('90d')

  // Selected exercise for 1RM curve analysis
  const [selectedExerciseId, setSelectedExerciseId] = useState<string>('')
  const [exerciseSearch, setExerciseSearch] = useState('')
  const [prMuscleFilter, setPrMuscleFilter] = useState<string>('all')
  const [prRecencyFilter, setPrRecencyFilter] = useState<'all' | 'new' | 'historical'>('all')

  // 1. Resolve Timeframe Range
  const { startDate, endDate } = useMemo(() => {
    return analyticsService.getTimeframeDates(timeframe)
  }, [timeframe])

  // 2. Filter completed sessions
  const completedSessions = useMemo(() => {
    return (sessions || []).filter((s) => Boolean(s.completed_at))
  }, [sessions])

  const windowedSessions = useMemo(() => {
    if (timeframe === 'all') return completedSessions
    return completedSessions.filter((s) => {
      const d = toLocalDateString(s.completed_at || s.started_at)
      return d >= startDate && d <= endDate
    })
  }, [completedSessions, timeframe, startDate, endDate])

  // 3. Flatten Sets
  const windowedSets = useMemo(() => {
    return windowedSessions.flatMap((s) => s.sets || [])
  }, [windowedSessions])

  const validCompletedSets = useMemo(() => {
    return windowedSets.filter((s) => s.is_completed && (s.reps || 0) > 0)
  }, [windowedSets])

  // 4. Global Strength Overview Calculations
  const totalVolumeKg = useMemo(() => {
    return validCompletedSets.reduce((sum, s) => sum + (Number(s.weight_kg) || 0) * Number(s.reps), 0)
  }, [validCompletedSets])

  const totalDurationMinutes = useMemo(() => {
    const sec = windowedSessions.reduce((sum, s) => sum + (s.duration_seconds || 0), 0)
    return Math.round(sec / 60)
  }, [windowedSessions])

  const averageDurationMinutes = useMemo(() => {
    return windowedSessions.length > 0
      ? Math.round(totalDurationMinutes / windowedSessions.length)
      : 0
  }, [windowedSessions.length, totalDurationMinutes])

  // 5. Personal Records Detection (All-time across all completed sessions)
  const allPersonalRecords = useMemo(() => {
    return detectPersonalRecords(completedSessions, exercises)
  }, [completedSessions, exercises])

  // 5b. Most Improved Exercise (Calculated from actual historical e1RM progression)
  const mostImprovedExercise = useMemo(() => {
    return calculateMostImprovedExercise(completedSessions, exercises)
  }, [completedSessions, exercises])

  // Helper: Evaluates PR recency against chronological workout history (last 30 calendar days)
  const getPrRecency = (achievedAt: string): { isNew: boolean; label: string } => {
    if (!achievedAt) return { isNew: false, label: 'Prior workout' }
    const [y, m, d] = achievedAt.split('-').map(Number)
    if (!y || !m || !d) return { isNew: false, label: achievedAt }
    const achievedDate = new Date(y, m - 1, d)
    const now = new Date()
    now.setHours(0, 0, 0, 0)
    achievedDate.setHours(0, 0, 0, 0)
    const diffDays = Math.round((now.getTime() - achievedDate.getTime()) / (24 * 60 * 60 * 1000))
    if (diffDays >= 0 && diffDays <= 30) {
      if (diffDays === 0) return { isNew: true, label: 'Today' }
      if (diffDays === 1) return { isNew: true, label: 'Yesterday' }
      return { isNew: true, label: `${diffDays}d ago` }
    }
    return { isNew: false, label: achievedAt }
  }

  // 5c. PR Recency Counts
  const { newPrCount, historicalPrCount } = useMemo(() => {
    let newCount = 0
    let histCount = 0
    for (const pr of allPersonalRecords) {
      if (getPrRecency(pr.achievedAt).isNew) {
        newCount++
      } else {
        histCount++
      }
    }
    return { newPrCount: newCount, historicalPrCount: histCount }
  }, [allPersonalRecords])

  // 6. Exercises with Logged History
  const exercisesWithHistory = useMemo(() => {
    const activeExIds = new Set<string>()
    for (const s of completedSessions) {
      for (const set of s.sets || []) {
        if (set.is_completed && set.reps > 0) {
          activeExIds.add(set.exercise_id)
        }
      }
    }

    const map = new Map(exercises.map((e) => [e.id, e]))
    return Array.from(activeExIds)
      .map((id) => map.get(id))
      .filter((e): e is Exercise => Boolean(e))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [completedSessions, exercises])

  // Auto-select initial exercise (prefer Bench Press, Squat, or first with history)
  const activeExerciseId = useMemo(() => {
    if (selectedExerciseId && exercisesWithHistory.some((e) => e.id === selectedExerciseId)) {
      return selectedExerciseId
    }
    // Preferred compound movements
    const preferred = exercisesWithHistory.find((e) => {
      const lower = e.name.toLowerCase()
      return lower.includes('bench press') || lower.includes('squat') || lower.includes('deadlift')
    })
    return preferred ? preferred.id : exercisesWithHistory[0]?.id || ''
  }, [selectedExerciseId, exercisesWithHistory])

  // 7. Selected Exercise Progression Curve Data
  const selectedExercise = useMemo(() => {
    return exercises.find((e) => e.id === activeExerciseId) || null
  }, [exercises, activeExerciseId])

  const exerciseProgressionData = useMemo(() => {
    if (!activeExerciseId) return { series: [], targetLine: undefined, max1Rm: 0, maxWeight: 0, totalSets: 0 }

    // Map chronologically ascending sessions containing this exercise
    const historyPoints: Array<{ date: string; topWeight: number; e1rm: number }> = []
    let maxOverall1Rm = 0
    let maxOverallWeight = 0
    let totalExerciseSets = 0

    const chronoSessions = [...completedSessions].sort((a, b) => {
      const da = new Date(a.completed_at || a.started_at).getTime()
      const db = new Date(b.completed_at || b.started_at).getTime()
      return da - db
    })

    for (const sess of chronoSessions) {
      const matchingSets = (sess.sets || []).filter(
        (s) => s.exercise_id === activeExerciseId && s.is_completed && s.reps > 0
      )
      if (matchingSets.length === 0) continue

      totalExerciseSets += matchingSets.length
      let sessionTopWeight = 0
      let sessionTop1Rm = 0

      for (const s of matchingSets) {
        const w = Number(s.weight_kg) || 0
        const r = Number(s.reps) || 0
        if (w > sessionTopWeight) sessionTopWeight = w
        if (w > maxOverallWeight) maxOverallWeight = w

        const e1rm = calculateEpley1Rm(w, r)
        if (e1rm > sessionTop1Rm) sessionTop1Rm = e1rm
        if (e1rm > maxOverall1Rm) maxOverall1Rm = e1rm
      }

      const dateStr = toLocalDateString(sess.completed_at || sess.started_at)
      if (dateStr) {
        historyPoints.push({
          date: dateStr,
          topWeight: sessionTopWeight,
          e1rm: sessionTop1Rm,
        })
      }
    }

    // Apply timeframe filter
    const windowedHistory = timeframe === 'all'
      ? historyPoints
      : historyPoints.filter((p) => p.date >= startDate && p.date <= endDate)

    if (windowedHistory.length === 0) {
      return { series: [], targetLine: undefined, max1Rm: maxOverall1Rm, maxWeight: maxOverallWeight, totalSets: totalExerciseSets }
    }

    const series: TrendLineSeries[] = [
      {
        id: 'top-weight',
        name: 'Top Set Load',
        data: windowedHistory.map((p) => ({ x: p.date, y: kgToDisplay(p.topWeight), label: 'Working Load' })),
        color: 'var(--color-text-muted)',
        isDashed: true,
        showAreaGradient: false,
        showPoints: true,
      },
      {
        id: 'est-1rm',
        name: 'Estimated 1RM (Epley)',
        data: windowedHistory.map((p) => ({ x: p.date, y: kgToDisplay(p.e1rm), label: 'Estimated 1RM' })),
        color: 'var(--color-accent)',
        isDashed: false,
        showAreaGradient: true,
        showPoints: true,
      },
    ]

    const targetLine: TargetLine | undefined = maxOverall1Rm > 0
      ? {
          value: kgToDisplay(maxOverall1Rm),
          label: 'All-Time PR',
          color: 'var(--color-warning)',
          isDashed: true,
        }
      : undefined

    return {
      series,
      targetLine,
      max1Rm: maxOverall1Rm,
      maxWeight: maxOverallWeight,
      totalSets: totalExerciseSets,
    }
  }, [activeExerciseId, completedSessions, timeframe, startDate, endDate, kgToDisplay])

  // 8. Weekly Volume Progression (Bar Chart data with dedicated timeframe)
  const { startDate: volumeStartDate, endDate: volumeEndDate } = useMemo(() => {
    return analyticsService.getTimeframeDates(volumeTimeframe)
  }, [volumeTimeframe])

  const volumeWindowedSessions = useMemo(() => {
    if (volumeTimeframe === 'all') return completedSessions
    return completedSessions.filter((s) => {
      const d = toLocalDateString(s.completed_at || s.started_at)
      return d >= volumeStartDate && d <= volumeEndDate
    })
  }, [completedSessions, volumeTimeframe, volumeStartDate, volumeEndDate])

  const weeklyVolumeBars: ComparisonBarItem[] = useMemo(() => {
    const weeklyPoints = calculateWeeklyVolumeAggregation(volumeWindowedSessions)
    return weeklyPoints.map((w, idx) => {
      const [year, month, day] = w.weekStartDate.split('-').map(Number)
      const d = new Date(year, month - 1, day)
      const formattedLabel = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      // For dense datasets (> 14 weeks), decimate x-axis labels to prevent text collision
      const showLabel = weeklyPoints.length <= 14 || idx % Math.ceil(weeklyPoints.length / 8) === 0

      return {
        id: w.weekStartDate,
        label: showLabel ? formattedLabel : '',
        actual: kgToDisplay(w.totalVolumeKg),
        subLabel: `${formattedLabel}: ${w.completedWorkouts} workouts • ${w.completedSets} sets`,
      }
    })
  }, [volumeWindowedSessions, kgToDisplay])

  const totalVolumeInWindowKg = useMemo(() => {
    return weeklyVolumeBars.reduce((sum, item) => sum + (item.actual || 0), 0)
  }, [weeklyVolumeBars])

  // 9. Muscle Group Distribution (Donut Chart segments)
  const muscleDonutSegments: DonutSegment[] = useMemo(() => {
    const dist = calculateMuscleGroupDistribution(validCompletedSets, exercises)
    return dist.map((item) => ({
      id: item.muscleGroup,
      label: MUSCLE_GROUP_LABELS[item.muscleGroup] || item.muscleGroup,
      value: item.sets,
      color: MUSCLE_PALETTE[item.muscleGroup] || 'var(--color-accent)',
      subLabel: `${Math.round(kgToDisplay(item.volumeKg)).toLocaleString()} ${weightUnit} volume`,
    }))
  }, [validCompletedSets, exercises, kgToDisplay, weightUnit])

  // 10. Filtered Personal Records (Search, Muscle, and Chronological Recency)
  const filteredPrs = useMemo(() => {
    return allPersonalRecords.filter((pr) => {
      const matchesSearch = pr.exerciseName.toLowerCase().includes(exerciseSearch.toLowerCase().trim())
      const matchesMuscle = prMuscleFilter === 'all' || pr.muscleGroup === prMuscleFilter
      const recency = getPrRecency(pr.achievedAt)
      const matchesRecency =
        prRecencyFilter === 'all' ||
        (prRecencyFilter === 'new' && recency.isNew) ||
        (prRecencyFilter === 'historical' && !recency.isNew)
      return matchesSearch && matchesMuscle && matchesRecency
    })
  }, [allPersonalRecords, exerciseSearch, prMuscleFilter, prRecencyFilter])

  // Empty state guard if no workout history exists
  if (!isLoading && completedSessions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] text-center space-y-4">
        <div className="w-14 h-14 rounded-2xl bg-[var(--color-accent-subtle)] text-[var(--color-accent)] flex items-center justify-center">
          <Dumbbell className="w-7 h-7" />
        </div>
        <div className="max-w-md space-y-1.5">
          <h3 className="text-lg font-bold text-[var(--color-text-primary)]">
            No Workout Data Recorded Yet
          </h3>
          <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">
            Complete your first workout session to unlock estimated 1RM curves, weekly tonnage progression, and muscle group volume analytics.
          </p>
        </div>
        <div className="pt-2">
          <Button
            variant="primary"
            size="md"
            icon={<Dumbbell className="w-4 h-4" />}
            onClick={() => (window.location.href = '/workouts?action=start')}
          >
            Start First Workout
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Module Sub-Header & Timeframe Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-semibold uppercase tracking-wider text-[var(--color-accent)] flex items-center gap-1.5">
              <Dumbbell className="w-3.5 h-3.5" /> Strength & Progressive Overload
            </span>
          </div>
          <h2 className="text-xl md:text-2xl font-bold tracking-tight text-[var(--color-text-primary)]">
            Strength Performance Analytics
          </h2>
          <p className="text-xs md:text-sm text-[var(--color-text-secondary)] mt-0.5">
            Epley 1RM trajectory, weekly volume workload, and muscle group balance.
          </p>
        </div>

        {/* Global Timeframe Selector */}
        <div className="flex items-center gap-1 p-1 bg-[var(--color-surface-hover)] rounded-lg border border-[var(--color-border)] self-start sm:self-auto">
          {(
            [
              { id: '30d', label: '1M' },
              { id: '90d', label: '3M' },
              { id: '180d', label: '6M' },
              { id: '1y', label: '1Y' },
              { id: 'all', label: 'All' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              onClick={() => setTimeframe(tab.id)}
              className={`text-xs font-semibold px-2.5 py-1 rounded-md transition-all ${
                timeframe === tab.id
                  ? 'bg-[var(--color-surface)] text-[var(--color-text-primary)] shadow-sm'
                  : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* 1. STRENGTH OVERVIEW METRICS GRID */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Card 1: Total Training Volume */}
        <Card>
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
                Training Volume
              </span>
              <div className="p-1.5 rounded-md bg-[var(--color-accent-subtle)] text-[var(--color-accent)]">
                <Flame className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2.5 flex items-baseline gap-1.5">
              <span className="text-2xl font-bold text-[var(--color-text-primary)] font-mono">
                {kgToDisplay(totalVolumeKg) >= 10000
                  ? `${(kgToDisplay(totalVolumeKg) / 1000).toFixed(1)}k`
                  : Math.round(kgToDisplay(totalVolumeKg)).toLocaleString()}
              </span>
              <span className="text-xs text-[var(--color-text-muted)] font-medium">{weightUnit} tonnage</span>
            </div>
            <div className="mt-2 text-[11px] text-[var(--color-text-secondary)] truncate">
              Across {windowedSessions.length} sessions in window
            </div>
          </CardContent>
        </Card>

        {/* Card 2: Completed Working Sets */}
        <Card>
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
                Working Sets
              </span>
              <div className="p-1.5 rounded-md bg-purple-500/10 text-purple-600 dark:text-purple-400">
                <Layers className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2.5 flex items-baseline gap-1.5">
              <span className="text-2xl font-bold text-[var(--color-text-primary)] font-mono">
                {validCompletedSets.length.toLocaleString()}
              </span>
              <span className="text-xs text-[var(--color-text-muted)] font-medium">completed sets</span>
            </div>
            <div className="mt-2 text-[11px] text-[var(--color-text-secondary)] truncate">
              Avg {windowedSessions.length > 0 ? Math.round(validCompletedSets.length / windowedSessions.length) : 0} sets / workout
            </div>
          </CardContent>
        </Card>

        {/* Card 3: Completed Workouts & Pace */}
        <Card>
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
                Workouts Logged
              </span>
              <div className="p-1.5 rounded-md bg-blue-500/10 text-blue-500">
                <Calendar className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2.5 flex items-baseline gap-1.5">
              <span className="text-2xl font-bold text-[var(--color-text-primary)] font-mono">
                {windowedSessions.length}
              </span>
              <span className="text-xs text-[var(--color-text-muted)] font-medium">sessions</span>
            </div>
            <div className="mt-2 text-[11px] text-[var(--color-text-secondary)] truncate">
              Avg duration: {averageDurationMinutes} mins / workout
            </div>
          </CardContent>
        </Card>

        {/* Card 4: Personal Records Logged */}
        <Card>
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
                All-Time Records
              </span>
              <div className="p-1.5 rounded-md bg-amber-500/10 text-amber-500">
                <Trophy className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2.5 flex items-baseline gap-1.5">
              <span className="text-2xl font-bold text-[var(--color-text-primary)] font-mono">
                {allPersonalRecords.length}
              </span>
              <span className="text-xs text-[var(--color-text-muted)] font-medium">exercise PRs</span>
            </div>
            <div className="mt-2 text-[11px] text-[var(--color-text-secondary)] truncate">
              {newPrCount > 0 ? `${newPrCount} achieved recently` : 'Tracked across active movements'}
            </div>
          </CardContent>
        </Card>

        {/* Card 5: Most Improved Exercise */}
        <Card>
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
                Most Improved
              </span>
              <div
                className={`p-1.5 rounded-md ${
                  mostImprovedExercise
                    ? 'bg-emerald-500/10 text-emerald-500'
                    : 'bg-[var(--color-surface-hover)] text-[var(--color-text-muted)]'
                }`}
              >
                <TrendingUp className="w-4 h-4" />
              </div>
            </div>
            {mostImprovedExercise ? (
              <>
                <div className="mt-2.5 flex items-baseline gap-1.5">
                  <span className="text-2xl font-bold text-emerald-500 font-mono">
                    +{kgToDisplay(mostImprovedExercise.deltaKg).toFixed(1)}
                  </span>
                  <span className="text-xs text-[var(--color-text-muted)] font-medium">
                    {weightUnit} ({mostImprovedExercise.deltaPercent > 0 ? `+${mostImprovedExercise.deltaPercent.toFixed(0)}%` : '0%'})
                  </span>
                </div>
                <div
                  className="mt-2 text-[11px] text-[var(--color-text-secondary)] truncate font-semibold"
                  title={`${mostImprovedExercise.exerciseName} (+${kgToDisplay(mostImprovedExercise.deltaKg).toFixed(1)}${weightUnit} e1RM across ${mostImprovedExercise.sessionCount} sessions)`}
                >
                  {mostImprovedExercise.exerciseName}
                </div>
              </>
            ) : (
              <>
                <div className="mt-2.5 flex items-baseline gap-1.5">
                  <span className="text-2xl font-bold text-[var(--color-text-muted)] font-mono">
                    —
                  </span>
                  <span className="text-xs text-[var(--color-text-muted)] font-medium">e1RM gain</span>
                </div>
                <div className="mt-2 text-[11px] text-[var(--color-text-muted)] truncate">
                  Requires ≥2 sessions per exercise
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 2. EXERCISE PROGRESSION CURVES (1RM OVER TIME) */}
      <Card>
        <CardHeader className="pb-3 border-b border-[var(--color-border-subtle)]">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-[var(--color-accent)]" />
                <span>Exercise Strength Trajectory (1RM Curves)</span>
              </CardTitle>
              <CardDescription className="text-xs">
                Estimated 1-Rep Max (Epley formula for ≤10 reps) plotted alongside working top-set load.
              </CardDescription>
            </div>

            {/* Exercise Selector Controls */}
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={activeExerciseId}
                onChange={(e) => setSelectedExerciseId(e.target.value)}
                className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-primary)] hover:border-[var(--color-text-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)] focus:border-[var(--color-accent)] transition-all cursor-pointer"
              >
                {exercisesWithHistory.map((ex) => (
                  <option key={ex.id} value={ex.id}>
                    {ex.name} ({MUSCLE_GROUP_LABELS[ex.muscle_group] || ex.muscle_group})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Quick Metrics Bar for Selected Movement */}
          {selectedExercise && (
            <div className="mt-3 pt-3 border-t border-[var(--color-border-subtle)] grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div>
                <span className="text-[10px] text-[var(--color-text-muted)] block uppercase font-semibold">
                  Movement
                </span>
                <span className="font-bold text-[var(--color-text-primary)] truncate block">
                  {selectedExercise.name}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-[var(--color-text-muted)] block uppercase font-semibold">
                  All-Time Best 1RM
                </span>
                <span className="font-bold text-[var(--color-accent)] font-mono">
                  {kgToDisplay(exerciseProgressionData.max1Rm).toFixed(1)} {weightUnit}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-[var(--color-text-muted)] block uppercase font-semibold">
                  Heaviest Working Set
                </span>
                <span className="font-bold text-[var(--color-text-primary)] font-mono">
                  {kgToDisplay(exerciseProgressionData.maxWeight).toFixed(1)} {weightUnit}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-[var(--color-text-muted)] block uppercase font-semibold">
                  Total Sets Logged
                </span>
                <span className="font-bold text-[var(--color-text-primary)] font-mono">
                  {exerciseProgressionData.totalSets} sets
                </span>
              </div>
            </div>
          )}
        </CardHeader>

        <CardContent className="pt-4">
          <TrendLineChart
            series={exerciseProgressionData.series}
            targetLine={exerciseProgressionData.targetLine}
            height={260}
            yAxisFormatter={(val) => `${val.toFixed(1)} ${weightUnit}`}
            tooltipDateFormatter={(d) => d}
            emptyMessage={`No logged sessions for ${selectedExercise?.name || 'this exercise'} in this timeframe.`}
          />
        </CardContent>
      </Card>

      {/* 3. TWO-COLUMN: WEEKLY VOLUME PROGRESSION & MUSCLE DISTRIBUTION */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Weekly Volume Workload (Bar Chart) */}
        <Card className="flex flex-col justify-between">
          <CardHeader className="pb-3 border-b border-[var(--color-border-subtle)]">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <Activity className="w-4 h-4 text-[var(--color-accent)]" />
                  <span>Weekly Workload Progression</span>
                </CardTitle>
                <CardDescription className="text-xs">
                  Total: {totalVolumeInWindowKg >= 10000 ? `${(totalVolumeInWindowKg / 1000).toFixed(1)}k ${weightUnit}` : `${Math.round(totalVolumeInWindowKg).toLocaleString()} ${weightUnit}`} lifted across {weeklyVolumeBars.length} active week{weeklyVolumeBars.length === 1 ? '' : 's'}.
                </CardDescription>
              </div>

              {/* Workload Timeframe Selector */}
              <div className="flex items-center gap-0.5 p-0.5 bg-[var(--color-surface-hover)] rounded-lg border border-[var(--color-border)] self-start sm:self-auto">
                {(
                  [
                    { id: '30d', label: '1M' },
                    { id: '90d', label: '3M' },
                    { id: '180d', label: '6M' },
                    { id: '1y', label: '1Y' },
                    { id: 'all', label: 'All' },
                  ] as const
                ).map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setVolumeTimeframe(tab.id)}
                    className={`text-[10px] font-semibold px-2 py-0.5 rounded-md transition-all ${
                      volumeTimeframe === tab.id
                        ? 'bg-[var(--color-surface)] text-[var(--color-text-primary)] shadow-sm'
                        : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-4">
            <ComparisonBarChart
              data={weeklyVolumeBars}
              height={230}
              valueFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(1)}k ${weightUnit}` : `${Math.round(v)} ${weightUnit}`)}
              barColor="var(--color-accent)"
              emptyMessage="No weekly workout data recorded in this range."
            />
          </CardContent>
        </Card>

        {/* Right: Muscle Group Volume Distribution (Donut Chart) */}
        <Card className="flex flex-col justify-between">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Layers className="w-4 h-4 text-purple-500" />
              <span>Muscle Group Volume Balance</span>
            </CardTitle>
            <CardDescription className="text-xs">
              Proportion of completed working sets allocated across target muscle groups.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-2">
            <DonutDistributionChart
              segments={muscleDonutSegments}
              size={200}
              unitLabel="working sets"
              centerLabel="Total Sets"
              valueFormatter={(v) => v.toLocaleString()}
              emptyMessage="No completed working sets in this window."
            />
          </CardContent>
        </Card>
      </div>

      {/* 4. PERSONAL RECORDS (PR) MILESTONE FEED */}
      <Card>
        <CardHeader className="pb-3 border-b border-[var(--color-border-subtle)]">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Trophy className="w-4 h-4 text-amber-500" />
                <span>Personal Records & Milestone Showcase</span>
              </CardTitle>
              <CardDescription className="text-xs">
                All-time highest load, single-set volume, and estimated 1RM detected per movement.
              </CardDescription>
            </div>

            {/* PR Recency & Filters */}
            <div className="flex flex-wrap items-center gap-2">
              {/* Recency Tabs: All, New PRs, Historical */}
              <div className="flex items-center gap-0.5 p-0.5 bg-[var(--color-surface-hover)] rounded-lg border border-[var(--color-border)]">
                <button
                  onClick={() => setPrRecencyFilter('all')}
                  className={`text-[10px] font-semibold px-2 py-0.5 rounded-md transition-all ${
                    prRecencyFilter === 'all'
                      ? 'bg-[var(--color-surface)] text-[var(--color-text-primary)] shadow-sm'
                      : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'
                  }`}
                >
                  All ({allPersonalRecords.length})
                </button>
                <button
                  onClick={() => setPrRecencyFilter('new')}
                  className={`text-[10px] font-semibold px-2 py-0.5 rounded-md transition-all flex items-center gap-1 ${
                    prRecencyFilter === 'new'
                      ? 'bg-[var(--color-surface)] text-[var(--color-accent)] shadow-sm font-bold'
                      : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'
                  }`}
                >
                  <Sparkles className="w-2.5 h-2.5 text-[var(--color-accent)]" />
                  <span>New ({newPrCount})</span>
                </button>
                <button
                  onClick={() => setPrRecencyFilter('historical')}
                  className={`text-[10px] font-semibold px-2 py-0.5 rounded-md transition-all ${
                    prRecencyFilter === 'historical'
                      ? 'bg-[var(--color-surface)] text-[var(--color-text-primary)] shadow-sm'
                      : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'
                  }`}
                >
                  Historical ({historicalPrCount})
                </button>
              </div>

              {/* Movement Search */}
              <div className="relative w-36 sm:w-44">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" />
                <Input
                  type="text"
                  placeholder="Filter movement..."
                  value={exerciseSearch}
                  onChange={(e) => setExerciseSearch(e.target.value)}
                  className="pl-8 text-xs py-1 h-7"
                />
              </div>

              {/* Muscle Group Filter */}
              <select
                value={prMuscleFilter}
                onChange={(e) => setPrMuscleFilter(e.target.value)}
                className="text-xs px-2.5 py-1 h-7 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-primary)] hover:border-[var(--color-text-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)] focus:border-[var(--color-accent)] transition-all cursor-pointer"
              >
                <option value="all">All Muscles</option>
                {Object.entries(MUSCLE_GROUP_LABELS).map(([k, label]) => (
                  <option key={k} value={k}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </CardHeader>

        <CardContent className="pt-4">
          {filteredPrs.length === 0 ? (
            <div className="p-8 text-center text-xs text-[var(--color-text-muted)]">
              No personal records found matching filter criteria.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {filteredPrs.map((pr) => {
                const isSelected = activeExerciseId === pr.exerciseId
                const recency = getPrRecency(pr.achievedAt)

                return (
                  <div
                    key={pr.exerciseId}
                    onClick={() => setSelectedExerciseId(pr.exerciseId)}
                    className={`p-3.5 rounded-xl border transition-all duration-150 cursor-pointer ${
                      isSelected
                        ? 'border-[var(--color-accent)] bg-[var(--color-accent-subtle)]/30 ring-1 ring-[var(--color-accent)]'
                        : recency.isNew
                        ? 'border-[var(--color-accent)]/40 bg-[var(--color-accent-subtle)]/5 hover:bg-[var(--color-accent-subtle)]/15 shadow-sm'
                        : 'border-[var(--color-border)] bg-[var(--color-surface-hover)]/30 hover:bg-[var(--color-surface-hover)] opacity-90'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="truncate">
                        <span className="font-bold text-xs text-[var(--color-text-primary)] truncate block">
                          {pr.exerciseName}
                        </span>
                        <span className="text-[10px] text-[var(--color-text-muted)] font-medium capitalize">
                          {MUSCLE_GROUP_LABELS[pr.muscleGroup] || pr.muscleGroup}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {recency.isNew ? (
                          <Badge variant="accent" className="text-[10px] px-1.5 py-0.5 flex items-center gap-1 font-semibold">
                            <Sparkles className="w-2.5 h-2.5" />
                            <span>New PR</span>
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0.5 text-[var(--color-text-muted)] border-[var(--color-border)]">
                            Historical PR
                          </Badge>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-[var(--color-border-subtle)] font-mono">
                      <div>
                        <span className="text-[9px] text-[var(--color-text-muted)] block font-sans">
                          Heaviest Load
                        </span>
                        <span className="font-bold text-[var(--color-text-primary)]">
                          {kgToDisplay(pr.maxWeightKg)} {weightUnit}
                        </span>
                      </div>
                      <div>
                        <span className="text-[9px] text-[var(--color-text-muted)] block font-sans">
                          Best Working Set
                        </span>
                        <span className="font-semibold text-[var(--color-text-secondary)]">
                          {kgToDisplay(pr.bestSetWeightKg)}{weightUnit} × {pr.bestSetReps}
                        </span>
                      </div>
                    </div>

                    <div className="mt-2 text-[10px] flex items-center justify-between pt-1">
                      <span className="flex items-center gap-1.5">
                        <span className="font-semibold text-[var(--color-accent)] font-mono">
                          {kgToDisplay(pr.max1RmKg).toFixed(1)} {weightUnit} 1RM
                        </span>
                        <span className="text-[var(--color-text-muted)]">•</span>
                        {recency.isNew ? (
                          <span className="text-[var(--color-accent)] font-medium">
                            Achieved {recency.label} ({pr.achievedAt})
                          </span>
                        ) : (
                          <span className="text-[var(--color-text-muted)]">
                            Record set {pr.achievedAt || 'Prior workout'}
                          </span>
                        )}
                      </span>
                      <ChevronRight className="w-3.5 h-3.5 text-[var(--color-text-muted)]" />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
