import React, { useState, useEffect, useMemo, useCallback } from 'react'
import {
  Activity,
  Flame,
  Dumbbell,
  Apple,
  Scale,
  Layers,
  Award,
  TrendingUp,
  Info,
  Clock,
  AlertCircle,
  RefreshCw,
  CheckCircle2,
  BarChart3,
} from 'lucide-react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { useAuth } from '@/features/auth'
import { useWorkout } from '@/features/workouts/context/WorkoutContext'
import { useGoals } from '@/features/goals/context/GoalContext'
import { useUnit } from '@/hooks/useUnit'
import { analyticsService } from '../services/analyticsService'
import {
  toLocalDateString,
  parseLocalYmd,
  calculateDailyActivityScores,
  calculateWorkoutStreaks,
  calculateNutritionStreaks,
  calculateWeeklyWorkoutFrequency,
  calculateWeeklyActivitySummaries,
  calculateNutritionConsistency,
  calculateLifetimeConsistencyStats,
  detectWorkoutInactivePeriods,
  generateConsistencyInsights,
} from '../utils/analyticsCalculations'
import { ActivityHeatmap, type HeatmapDayData } from './charts/ActivityHeatmap'
import { ComparisonBarChart, type ComparisonBarItem } from './charts/ComparisonBarChart'
import type { AnalyticsTimeframe } from '../types'
import type { NutritionDayData } from '@/features/nutrition/types'

const TIMEFRAME_OPTIONS: { label: string; value: AnalyticsTimeframe }[] = [
  { label: '1M', value: '30d' },
  { label: '3M', value: '90d' },
  { label: '6M', value: '180d' },
  { label: '1Y', value: '1y' },
  { label: 'All', value: 'all' },
]

type WeeklySummaryMetric = 'workouts' | 'nutrition' | 'weight' | 'sets' | 'volume'

export const ConsistencyAnalyticsModule: React.FC = () => {
  const { user, profile } = useAuth()
  const userId = user?.id
  const { weightUnit, kgToDisplay } = useUnit()

  // 1. Context Data Sources
  const { sessions, isLoading: isLoadingSessions } = useWorkout()
  const { weightEntries, isLoadingWeightEntries } = useGoals()

  // 2. Local State
  const [timeframe, setTimeframe] = useState<AnalyticsTimeframe>('90d')
  const [nutritionDaysData, setNutritionDaysData] = useState<NutritionDayData[]>([])
  const [isLoadingNutrition, setIsLoadingNutrition] = useState<boolean>(true)
  const [nutritionError, setNutritionError] = useState<string | null>(null)

  // Heatmap View State
  const [heatmapWeeks, setHeatmapWeeks] = useState<12 | 52>(12)

  // Weekly summary chart metric selector
  const [weeklyMetric, setWeeklyMetric] = useState<WeeklySummaryMetric>('workouts')

  // Configured weekly workout target: strictly defaults to null ("None") unless explicitly set by the user.
  // Persisted in localStorage so user's explicit selection is preserved across tabs and reloads.
  const [configuredTarget, setConfiguredTarget] = useState<number | null>(() => {
    try {
      const saved = localStorage.getItem('form_consistency_workout_target')
      if (saved && saved !== 'none') {
        const val = parseInt(saved, 10)
        if (!isNaN(val) && val > 0) return val
      }
    } catch {
      // ignore storage access errors
    }
    return null
  })

  const handleTargetChange = (target: number | null) => {
    setConfiguredTarget(target)
    try {
      if (target === null) {
        localStorage.setItem('form_consistency_workout_target', 'none')
      } else {
        localStorage.setItem('form_consistency_workout_target', String(target))
      }
    } catch {
      // ignore storage write errors
    }
  }

  // 3. Resolve Timeframe Range for the active view
  const { startDate, endDate } = useMemo(() => {
    return analyticsService.getTimeframeDates(timeframe)
  }, [timeframe])

  // Lookback date for 52-week heatmap coverage (at least 365 days)
  const nutritionFetchStartDate = useMemo(() => {
    const end = new Date()
    const start = new Date(end)
    if (timeframe === 'all') {
      start.setFullYear(start.getFullYear() - 5)
    } else {
      // Fetch 52 weeks or timeframe startDate, whichever is earlier
      start.setDate(start.getDate() - 365)
      const tfStart = parseLocalYmd(startDate)
      if (tfStart.getTime() < start.getTime()) {
        return startDate
      }
    }
    return toLocalDateString(start)
  }, [timeframe, startDate])

  // 4. Fetch Nutrition History
  const fetchNutrition = useCallback(async () => {
    if (!userId) return
    setIsLoadingNutrition(true)
    setNutritionError(null)
    try {
      const data = await analyticsService.getNutritionHistory(userId, nutritionFetchStartDate, endDate)
      setNutritionDaysData(data)
    } catch (err: unknown) {
      console.error('[ConsistencyAnalyticsModule] Error loading nutrition:', err)
      setNutritionError(err instanceof Error ? err.message : 'Failed to load nutrition history')
    } finally {
      setIsLoadingNutrition(false)
    }
  }, [userId, nutritionFetchStartDate, endDate])

  useEffect(() => {
    let isMounted = true
    const run = async () => {
      await Promise.resolve()
      if (!isMounted) return
      await fetchNutrition()
    }
    void run()
    return () => {
      isMounted = false
    }
  }, [fetchNutrition])

  // 5. Account Registration Date Boundary (for distinguishing zero activity vs unavailable data)
  const registrationDate = useMemo<string | null>(() => {
    const raw = user?.created_at || profile?.created_at
    return raw ? toLocalDateString(raw) : null
  }, [user?.created_at, profile?.created_at])

  // 6. Filter Completed Sessions
  const completedSessions = useMemo(() => {
    return (sessions || []).filter((s) => Boolean(s.completed_at))
  }, [sessions])

  // Filter windowed completed sessions
  const windowedSessions = useMemo(() => {
    if (timeframe === 'all') return completedSessions
    return completedSessions.filter((s) => {
      const d = toLocalDateString(s.completed_at || s.started_at)
      return d >= startDate && d <= endDate
    })
  }, [completedSessions, timeframe, startDate, endDate])

  // Filter windowed nutrition days
  const windowedNutritionDays = useMemo(() => {
    if (timeframe === 'all') return nutritionDaysData
    return nutritionDaysData.filter((d) => {
      const dateStr = d.day?.log_date
      return Boolean(dateStr && dateStr >= startDate && dateStr <= endDate)
    })
  }, [nutritionDaysData, timeframe, startDate, endDate])

  // Filter windowed weight entries
  const windowedWeightEntries = useMemo(() => {
    if (timeframe === 'all') return weightEntries || []
    return (weightEntries || []).filter((w) => {
      const d = toLocalDateString(w.measured_at)
      return d >= startDate && d <= endDate
    })
  }, [weightEntries, timeframe, startDate, endDate])

  // ============================================================================
  // A. STREAKS & CORE OVERVIEW CALCULATIONS
  // ============================================================================
  // Full historical streaks (streaks track continuous activity up to today)
  const workoutStreaks = useMemo(() => {
    return calculateWorkoutStreaks(completedSessions)
  }, [completedSessions])

  const nutritionStreaks = useMemo(() => {
    return calculateNutritionStreaks(nutritionDaysData)
  }, [nutritionDaysData])

  // Average workouts per week
  const { averageWeeklyCount: avgWeeklyWorkouts, currentWeekCount: currentWeekWorkouts } = useMemo(() => {
    return calculateWeeklyWorkoutFrequency(completedSessions, 4)
  }, [completedSessions])

  // Nutrition consistency in selected timeframe
  const nutritionConsistency = useMemo(() => {
    return calculateNutritionConsistency(startDate, endDate, windowedNutritionDays)
  }, [startDate, endDate, windowedNutritionDays])

  // ============================================================================
  // B. ACTIVITY HEATMAP DATA
  // ============================================================================
  const heatmapData = useMemo<HeatmapDayData[]>(() => {
    // 52-week lookback boundary
    const hEndDate = new Date()
    const hStartDate = new Date(hEndDate)
    hStartDate.setDate(hStartDate.getDate() - 52 * 7)
    const hStartStr = toLocalDateString(hStartDate)
    const hEndStr = toLocalDateString(hEndDate)

    // Build fast lookup maps
    const workoutMap = new Map<string, string>() // date -> workout name
    for (const s of completedSessions) {
      const d = toLocalDateString(s.completed_at || s.started_at)
      if (d) {
        workoutMap.set(d, s.name || 'Completed Workout')
      }
    }

    const nutritionMap = new Map<string, number>() // date -> calories
    for (const nd of nutritionDaysData) {
      const d = nd.day?.log_date
      if (!d) continue
      const meals = nd.meals || []
      const items = meals.flatMap((m) => m.items || [])
      const calories = items.reduce((sum, item) => sum + (Number(item.calories) || 0), 0)
      if (items.length > 0 || calories > 0) {
        nutritionMap.set(d, Math.round(calories))
      }
    }

    const weightMap = new Map<string, number>() // date -> weight
    for (const w of weightEntries || []) {
      const d = toLocalDateString(w.measured_at)
      if (d) {
        weightMap.set(d, Number(w.weight_kg))
      }
    }

    // Generate score items
    const rawDays = nutritionDaysData.map((nd) => nd.day).filter(Boolean)
    const scores = calculateDailyActivityScores(
      hStartStr,
      hEndStr,
      completedSessions,
      rawDays as NonNullable<(typeof rawDays)[0]>[],
      weightEntries || []
    )

    return scores.map((sc) => {
      const isUnavailable = registrationDate ? sc.date < registrationDate : false
      return {
        date: sc.date,
        workoutCompleted: sc.workoutCompleted,
        nutritionLogged: sc.nutritionLogged,
        weightLogged: sc.weightLogged,
        score: sc.score,
        workoutName: workoutMap.get(sc.date),
        calories: nutritionMap.get(sc.date),
        weightKg: weightMap.get(sc.date),
        isUnavailable,
      }
    })
  }, [completedSessions, nutritionDaysData, weightEntries, registrationDate])

  // ============================================================================
  // C. WEEKLY ACTIVITY SUMMARY
  // ============================================================================
  const weeklySummaries = useMemo(() => {
    return calculateWeeklyActivitySummaries(
      startDate,
      endDate,
      windowedSessions,
      windowedNutritionDays,
      windowedWeightEntries
    )
  }, [startDate, endDate, windowedSessions, windowedNutritionDays, windowedWeightEntries])

  // Prepare data for ComparisonBarChart
  const barChartData = useMemo<ComparisonBarItem[]>(() => {
    return weeklySummaries.map((wk) => {
      let actual = 0
      let target: number | null = null
      let subLabel = ''

      switch (weeklyMetric) {
        case 'workouts':
          actual = wk.completedWorkouts
          target = configuredTarget
          subLabel = `${wk.completedWorkouts} workouts`
          break
        case 'nutrition':
          actual = wk.nutritionLoggedDays
          target = 7 // Ideal daily logging target
          subLabel = `${wk.nutritionLoggedDays}/7 days`
          break
        case 'weight':
          actual = wk.weighInDays
          target = null
          subLabel = `${wk.weighInDays} weigh-ins`
          break
        case 'sets':
          actual = wk.completedWorkingSets
          target = null
          subLabel = `${wk.completedWorkingSets} sets`
          break
        case 'volume':
          actual = kgToDisplay(wk.totalTrainingVolumeKg)
          target = null
          subLabel = `${Math.round(kgToDisplay(wk.totalTrainingVolumeKg)).toLocaleString()} ${weightUnit}`
          break
      }

      return {
        label: wk.label.split(' - ')[0], // Compact label, e.g. "Oct 27"
        actual,
        target,
        subLabel,
        status:
          target && actual >= target
            ? 'success'
            : target && actual < target * 0.7
              ? 'warning'
              : 'normal',
      }
    })
  }, [weeklySummaries, weeklyMetric, configuredTarget, kgToDisplay, weightUnit])

  // ============================================================================
  // D. INACTIVE / REST PERIODS
  // ============================================================================
  const inactivePeriods = useMemo(() => {
    return detectWorkoutInactivePeriods(completedSessions, 3)
  }, [completedSessions])

  // ============================================================================
  // F. LIFETIME MILESTONE STATISTICS
  // ============================================================================
  const lifetimeStats = useMemo(() => {
    return calculateLifetimeConsistencyStats(
      completedSessions,
      nutritionDaysData,
      weightEntries || []
    )
  }, [completedSessions, nutritionDaysData, weightEntries])

  // ============================================================================
  // G. CONSISTENCY INSIGHTS
  // ============================================================================
  const insights = useMemo(() => {
    return generateConsistencyInsights({
      weeklySummaries,
      workoutStreaks,
      nutritionStreaks,
      nutritionConsistency,
      inactivePeriods,
      averageWeeklyWorkouts: avgWeeklyWorkouts,
    })
  }, [
    weeklySummaries,
    workoutStreaks,
    nutritionStreaks,
    nutritionConsistency,
    inactivePeriods,
    avgWeeklyWorkouts,
  ])

  // Loading indicator
  const isLoading = isLoadingSessions || isLoadingWeightEntries || isLoadingNutrition

  // Global empty check
  const hasZeroRecords =
    !isLoading &&
    completedSessions.length === 0 &&
    nutritionDaysData.length === 0 &&
    (weightEntries || []).length === 0

  return (
    <div className="space-y-8 animate-in fade-in duration-200">
      {/* 1. Header & Global Timeframe Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Badge variant="accent">Habit Matrix</Badge>
            <span className="text-xs text-[var(--color-text-muted)] flex items-center gap-1">
              <Activity className="w-3.5 h-3.5 text-[var(--color-accent)]" />
              Consistency & Habit Intelligence
            </span>
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-[var(--color-text-primary)]">
            Consistency Analytics
          </h2>
          <p className="text-sm text-[var(--color-text-secondary)] mt-0.5">
            Cross-domain habit tracking, training adherence, logging streaks, and lifetime milestone records.
          </p>
        </div>

        {/* Global Timeframe Filter Pills */}
        <div className="flex items-center gap-1 p-1 bg-[var(--color-surface-hover)] rounded-xl border border-[var(--color-border)] self-start sm:self-auto">
          {TIMEFRAME_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setTimeframe(opt.value)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                timeframe === opt.value
                  ? 'bg-[var(--color-surface)] text-[var(--color-text-primary)] shadow-xs'
                  : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Error Banner */}
      {nutritionError && (
        <div className="p-4 rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400 text-xs flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{nutritionError}</span>
          </div>
          <Button variant="outline" size="sm" onClick={() => void fetchNutrition()} className="h-7 text-xs">
            <RefreshCw className="w-3 h-3 mr-1" /> Retry
          </Button>
        </div>
      )}

      {/* Global Empty State */}
      {hasZeroRecords && (
        <Card className="border-[var(--color-border)] bg-[var(--color-surface)] p-8 text-center">
          <div className="max-w-md mx-auto space-y-3">
            <div className="w-12 h-12 rounded-full bg-[var(--color-surface-hover)] border border-[var(--color-border)] flex items-center justify-center mx-auto text-[var(--color-text-muted)]">
              <Activity className="w-6 h-6 text-[var(--color-accent)]" />
            </div>
            <h3 className="text-base font-bold text-[var(--color-text-primary)]">
              No Activity Recorded Yet
            </h3>
            <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">
              Complete a workout session or log your daily food intake to initiate your consistency streaks, activity heatmap, and habit intelligence charts.
            </p>
          </div>
        </Card>
      )}

      {/* ======================================================================== */}
      {/* FEATURE A: CONSISTENCY OVERVIEW */}
      {/* ======================================================================== */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted)]">
            Consistency Overview
          </h3>
          <div className="flex items-center gap-1.5 text-[11px] text-[var(--color-text-muted)]">
            <Info className="w-3 h-3 text-[var(--color-accent)]" />
            <span>Strict Streak Logic: Workouts require completion; nutrition requires logged items.</span>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {/* 1. Total Completed Workouts */}
          <Card className="border-[var(--color-border)] bg-[var(--color-surface)] shadow-xs">
            <CardContent className="p-4 space-y-1">
              <div className="flex items-center justify-between text-xs text-[var(--color-text-muted)]">
                <span>Completed Workouts</span>
                <Dumbbell className="w-3.5 h-3.5 text-[var(--color-accent)]" />
              </div>
              <div className="text-2xl font-bold font-mono text-[var(--color-text-primary)]">
                {isLoadingSessions ? '—' : windowedSessions.length}
              </div>
              <p className="text-[11px] text-[var(--color-text-muted)]">
                In selected timeframe
              </p>
            </CardContent>
          </Card>

          {/* 2. Current Workout Streak */}
          <Card className="border-[var(--color-border)] bg-[var(--color-surface)] shadow-xs">
            <CardContent className="p-4 space-y-1">
              <div className="flex items-center justify-between text-xs text-[var(--color-text-muted)]">
                <span>Workout Streak</span>
                <Flame className="w-3.5 h-3.5 text-amber-500" />
              </div>
              <div className="text-2xl font-bold font-mono text-[var(--color-text-primary)] flex items-baseline gap-1">
                <span>{isLoadingSessions ? '—' : workoutStreaks.currentStreakDays}</span>
                <span className="text-xs font-normal text-[var(--color-text-muted)]">days</span>
              </div>
              <p className="text-[11px] text-[var(--color-text-muted)]">
                Active consecutive days
              </p>
            </CardContent>
          </Card>

          {/* 3. Longest Workout Streak */}
          <Card className="border-[var(--color-border)] bg-[var(--color-surface)] shadow-xs">
            <CardContent className="p-4 space-y-1">
              <div className="flex items-center justify-between text-xs text-[var(--color-text-muted)]">
                <span>Longest Workout Streak</span>
                <Award className="w-3.5 h-3.5 text-[var(--color-lavender)]" />
              </div>
              <div className="text-2xl font-bold font-mono text-[var(--color-text-primary)] flex items-baseline gap-1">
                <span>{isLoadingSessions ? '—' : workoutStreaks.longestStreakDays}</span>
                <span className="text-xs font-normal text-[var(--color-text-muted)]">days</span>
              </div>
              <p className="text-[11px] text-[var(--color-text-muted)]">
                Historical peak
              </p>
            </CardContent>
          </Card>

          {/* 4. Average Workouts per Week */}
          <Card className="border-[var(--color-border)] bg-[var(--color-surface)] shadow-xs">
            <CardContent className="p-4 space-y-1">
              <div className="flex items-center justify-between text-xs text-[var(--color-text-muted)]">
                <span>Avg Workouts / Week</span>
                <TrendingUp className="w-3.5 h-3.5 text-[var(--color-accent)]" />
              </div>
              <div className="text-2xl font-bold font-mono text-[var(--color-text-primary)] flex items-baseline gap-1">
                <span>{isLoadingSessions ? '—' : avgWeeklyWorkouts}</span>
                <span className="text-xs font-normal text-[var(--color-text-muted)]">/ wk</span>
              </div>
              <p className="text-[11px] text-[var(--color-text-muted)]">
                Recent 4-week cadence
              </p>
            </CardContent>
          </Card>

          {/* 5. Total Nutrition Logging Days */}
          <Card className="border-[var(--color-border)] bg-[var(--color-surface)] shadow-xs">
            <CardContent className="p-4 space-y-1">
              <div className="flex items-center justify-between text-xs text-[var(--color-text-muted)]">
                <span>Nutrition Logged</span>
                <Apple className="w-3.5 h-3.5 text-[var(--color-accent-secondary)]" />
              </div>
              <div className="text-2xl font-bold font-mono text-[var(--color-text-primary)] flex items-baseline gap-1">
                <span>{isLoadingNutrition ? '—' : nutritionConsistency.loggedDaysCount}</span>
                <span className="text-xs font-normal text-[var(--color-text-muted)]">days</span>
              </div>
              <p className="text-[11px] text-[var(--color-text-muted)]">
                {nutritionConsistency.loggingPercentage}% coverage in window
              </p>
            </CardContent>
          </Card>

          {/* 6. Current Nutrition Logging Streak */}
          <Card className="border-[var(--color-border)] bg-[var(--color-surface)] shadow-xs">
            <CardContent className="p-4 space-y-1">
              <div className="flex items-center justify-between text-xs text-[var(--color-text-muted)]">
                <span>Nutrition Streak</span>
                <Flame className="w-3.5 h-3.5 text-[var(--color-accent-secondary)]" />
              </div>
              <div className="text-2xl font-bold font-mono text-[var(--color-text-primary)] flex items-baseline gap-1">
                <span>{isLoadingNutrition ? '—' : nutritionStreaks.currentStreakDays}</span>
                <span className="text-xs font-normal text-[var(--color-text-muted)]">days</span>
              </div>
              <p className="text-[11px] text-[var(--color-text-muted)]">
                Best: {nutritionStreaks.longestStreakDays} days
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* ======================================================================== */}
      {/* FEATURE B: ACTIVITY HEATMAP GRID */}
      {/* ======================================================================== */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted)]">
            Activity & Habit Consistency Matrix
          </h3>
          <span className="text-xs text-[var(--color-text-muted)]">
            Interactive daily habit tracking across dual pillars
          </span>
        </div>

        <ActivityHeatmap
          data={heatmapData}
          weeks={heatmapWeeks}
          onWeeksChange={(w) => setHeatmapWeeks(w)}
          title="Daily Consistency Matrix"
          isDateUnavailable={(dateStr) => Boolean(registrationDate && dateStr < registrationDate)}
          showControls={true}
        />
      </section>

      {/* ======================================================================== */}
      {/* FEATURE C: WEEKLY ACTIVITY SUMMARY & WORKLOAD */}
      {/* ======================================================================== */}
      <section className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted)]">
              Weekly Activity Summary
            </h3>
            <p className="text-xs text-[var(--color-text-secondary)]">
              Aggregated weekly completed sessions, logged nutrition days, weigh-ins, sets, and volume.
            </p>
          </div>

          {/* Metric Selector Tabs */}
          <div className="flex items-center gap-1 p-0.5 bg-[var(--color-surface-hover)] rounded-lg border border-[var(--color-border)] self-start sm:self-auto text-xs">
            <button
              type="button"
              onClick={() => setWeeklyMetric('workouts')}
              className={`px-2.5 py-1 rounded-md font-semibold transition-all cursor-pointer ${
                weeklyMetric === 'workouts'
                  ? 'bg-[var(--color-surface)] text-[var(--color-accent)] shadow-xs'
                  : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'
              }`}
            >
              Workouts
            </button>
            <button
              type="button"
              onClick={() => setWeeklyMetric('nutrition')}
              className={`px-2.5 py-1 rounded-md font-semibold transition-all cursor-pointer ${
                weeklyMetric === 'nutrition'
                  ? 'bg-[var(--color-surface)] text-[var(--color-accent-secondary-text)] shadow-xs'
                  : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'
              }`}
            >
              Nutrition Days
            </button>
            <button
              type="button"
              onClick={() => setWeeklyMetric('weight')}
              className={`px-2.5 py-1 rounded-md font-semibold transition-all cursor-pointer ${
                weeklyMetric === 'weight'
                  ? 'bg-[var(--color-surface)] text-[var(--color-lavender-text)] shadow-xs'
                  : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'
              }`}
            >
              Weigh-ins
            </button>
            <button
              type="button"
              onClick={() => setWeeklyMetric('sets')}
              className={`px-2.5 py-1 rounded-md font-semibold transition-all cursor-pointer ${
                weeklyMetric === 'sets'
                  ? 'bg-[var(--color-surface)] text-[var(--color-accent-text)] shadow-xs'
                  : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'
              }`}
            >
              Working Sets
            </button>
            <button
              type="button"
              onClick={() => setWeeklyMetric('volume')}
              className={`px-2.5 py-1 rounded-md font-semibold transition-all cursor-pointer ${
                weeklyMetric === 'volume'
                  ? 'bg-[var(--color-surface)] text-[var(--color-cyan)] shadow-xs'
                  : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'
              }`}
            >
              Volume ({weightUnit})
            </button>
          </div>
        </div>

        {/* Visual Chart Card */}
        <Card className="border-[var(--color-border)] bg-[var(--color-surface)]">
          <CardHeader className="pb-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-[var(--color-accent)]" />
                <span>
                  {weeklyMetric === 'workouts' && 'Weekly Completed Workouts'}
                  {weeklyMetric === 'nutrition' && 'Weekly Nutrition Logging Adherence (Days / Week)'}
                  {weeklyMetric === 'weight' && 'Weekly Weigh-in Frequency'}
                  {weeklyMetric === 'sets' && 'Weekly Completed Working Sets'}
                  {weeklyMetric === 'volume' && `Weekly Training Volume Progression (${weightUnit})`}
                </span>
              </CardTitle>

              {weeklyMetric === 'workouts' && (
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-[var(--color-text-muted)]">Target:</span>
                  <div className="flex items-center gap-1">
                    {[null, 2, 3, 4, 5, 6].map((tgt) => (
                      <button
                        key={tgt ?? 'none'}
                        type="button"
                        onClick={() => handleTargetChange(tgt)}
                        className={`px-2 py-0.5 rounded text-[11px] font-semibold border transition-all cursor-pointer ${
                          configuredTarget === tgt
                            ? 'bg-[var(--color-accent)] text-white border-[var(--color-accent)]'
                            : 'bg-[var(--color-surface-hover)] text-[var(--color-text-muted)] border-[var(--color-border)] hover:text-[var(--color-text-primary)]'
                        }`}
                      >
                        {tgt ? `${tgt}/wk` : 'None'}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <CardDescription className="text-xs">
              Weekly progression across Monday–Sunday ISO training calendar weeks.
            </CardDescription>
          </CardHeader>

          <CardContent className="pt-2">
            <ComparisonBarChart
              data={barChartData}
              height={220}
              barColor={
                weeklyMetric === 'nutrition'
                  ? 'var(--color-accent-secondary)'
                  : weeklyMetric === 'weight'
                    ? 'var(--color-lavender)'
                    : weeklyMetric === 'sets'
                      ? 'var(--color-periwinkle)'
                      : weeklyMetric === 'volume'
                        ? 'var(--color-cyan)'
                        : 'var(--color-accent)'
              }
              valueFormatter={(v) =>
                weeklyMetric === 'volume'
                  ? `${Math.round(v).toLocaleString()} ${weightUnit}`
                  : weeklyMetric === 'nutrition'
                    ? `${v}/7 days`
                    : v.toLocaleString()
              }
              targetFormatter={(t) => `${t} target`}
              emptyMessage="No weekly activity recorded in this timeframe."
            />
          </CardContent>
        </Card>

        {/* Detailed Weekly Breakdown Table */}
        <Card className="border-[var(--color-border)] bg-[var(--color-surface)]">
          <CardHeader className="pb-3 border-b border-[var(--color-border-subtle)]">
            <CardTitle className="text-sm font-semibold flex items-center justify-between">
              <span>Weekly Activity Breakdown</span>
              <span className="text-xs font-normal text-[var(--color-text-muted)]">
                {weeklySummaries.length} weeks analyzed
              </span>
            </CardTitle>
          </CardHeader>
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="border-b border-[var(--color-border-subtle)] bg-[var(--color-surface-hover)]/40 text-[var(--color-text-muted)] font-medium">
                  <th className="py-2.5 px-4">Week Range</th>
                  <th className="py-2.5 px-4 text-center">🏋️ Workouts</th>
                  <th className="py-2.5 px-4 text-center">🥗 Nutrition Days</th>
                  <th className="py-2.5 px-4 text-center">⚖️ Weigh-ins</th>
                  <th className="py-2.5 px-4 text-right">🔢 Working Sets</th>
                  <th className="py-2.5 px-4 text-right">📈 Volume ({weightUnit})</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border-subtle)]">
                {weeklySummaries.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-6 text-center text-[var(--color-text-muted)]">
                      No activity logs in this timeframe.
                    </td>
                  </tr>
                ) : (
                  [...weeklySummaries].reverse().map((wk) => (
                    <tr
                      key={wk.weekStartDate}
                      className="hover:bg-[var(--color-surface-hover)]/60 transition-colors"
                    >
                      <td className="py-2.5 px-4 font-mono font-medium text-[var(--color-text-primary)]">
                        {wk.label}
                      </td>
                      <td className="py-2.5 px-4 text-center">
                        <span
                          className={`inline-flex items-center justify-center px-2 py-0.5 rounded-full font-mono font-semibold ${
                            wk.completedWorkouts > 0
                              ? 'bg-[var(--color-accent)]/15 text-[var(--color-accent)]'
                              : 'text-[var(--color-text-muted)]'
                          }`}
                        >
                          {wk.completedWorkouts}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 text-center">
                        <span
                          className={`inline-flex items-center justify-center px-2 py-0.5 rounded-full font-mono font-semibold ${
                            wk.nutritionLoggedDays >= 5
                              ? 'bg-[var(--color-accent-secondary-subtle)] text-[var(--color-accent-secondary-text)]'
                              : wk.nutritionLoggedDays > 0
                                ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                                : 'text-[var(--color-text-muted)]'
                          }`}
                        >
                          {wk.nutritionLoggedDays} / 7
                        </span>
                      </td>
                      <td className="py-2.5 px-4 text-center font-mono text-[var(--color-text-secondary)]">
                        {wk.weighInDays > 0 ? `${wk.weighInDays} / 7` : '—'}
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono text-[var(--color-text-secondary)]">
                        {wk.completedWorkingSets > 0 ? wk.completedWorkingSets : '—'}
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono font-medium text-[var(--color-text-primary)]">
                        {wk.totalTrainingVolumeKg > 0 ? `${Math.round(kgToDisplay(wk.totalTrainingVolumeKg)).toLocaleString()} ${weightUnit}` : '—'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </section>

      {/* ======================================================================== */}
      {/* FEATURE D & E: WORKOUT & NUTRITION CONSISTENCY DUAL PANELS */}
      {/* ======================================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* D. Workout Consistency & Cadence */}
        <Card className="border-[var(--color-border)] bg-[var(--color-surface)]">
          <CardHeader className="pb-3 border-b border-[var(--color-border-subtle)]">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Dumbbell className="w-4 h-4 text-[var(--color-accent)]" />
                <span>Workout Consistency</span>
              </CardTitle>
              <Badge variant="outline">
                {avgWeeklyWorkouts} avg / wk
              </Badge>
            </div>
            <CardDescription className="text-xs">
              Training frequency, consecutive sessions, and rest intermissions.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-5 space-y-4">
            {/* Target Comparison Bar if configured */}
            <div className="p-3.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-hover)]/30 space-y-2">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                <span className="font-semibold text-[var(--color-text-primary)]">
                  Weekly Workout Target
                </span>
                <div className="flex items-center gap-1">
                  {[null, 2, 3, 4, 5, 6].map((tgt) => (
                    <button
                      key={tgt ?? 'none'}
                      type="button"
                      onClick={() => handleTargetChange(tgt)}
                      className={`px-2 py-0.5 rounded text-[11px] font-semibold border transition-all cursor-pointer ${
                        configuredTarget === tgt
                          ? 'bg-[var(--color-accent)] text-white border-[var(--color-accent)]'
                          : 'bg-[var(--color-surface)] text-[var(--color-text-muted)] border-[var(--color-border)] hover:text-[var(--color-text-primary)]'
                      }`}
                    >
                      {tgt ? `${tgt}/wk` : 'None'}
                    </button>
                  ))}
                </div>
              </div>

              {configuredTarget ? (
                <>
                  <div className="w-full bg-[var(--color-border)] rounded-full h-2 overflow-hidden mt-1">
                    <div
                      className="bg-[var(--color-accent)] h-2 rounded-full transition-all duration-300"
                      style={{
                        width: `${Math.min(100, Math.round((currentWeekWorkouts / configuredTarget) * 100))}%`,
                      }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-[var(--color-text-muted)]">
                    <span>
                      {currentWeekWorkouts} / {configuredTarget} completed this week ({Math.round((currentWeekWorkouts / configuredTarget) * 100)}% of weekly quota)
                    </span>
                    <span>Target: {configuredTarget} sessions / week</span>
                  </div>
                </>
              ) : (
                <p className="text-[11px] text-[var(--color-text-muted)] pt-1">
                  No target configured. Select a weekly workout target above to track adherence, or continue tracking without quota.
                </p>
              )}
            </div>

            {/* Streak & Frequency Metric Grid */}
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-subtle)] space-y-1">
                <span className="text-[var(--color-text-muted)] text-[11px]">Current Streak</span>
                <div className="text-lg font-bold font-mono text-[var(--color-text-primary)]">
                  {workoutStreaks.currentStreakDays} days
                </div>
                <p className="text-[10px] text-[var(--color-text-muted)]">
                  Consecutive days with workouts
                </p>
              </div>

              <div className="p-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-subtle)] space-y-1">
                <span className="text-[var(--color-text-muted)] text-[11px]">Longest Streak</span>
                <div className="text-lg font-bold font-mono text-[var(--color-text-primary)]">
                  {workoutStreaks.longestStreakDays} days
                </div>
                <p className="text-[10px] text-[var(--color-text-muted)]">
                  Personal best daily sequence
                </p>
              </div>
            </div>

            {/* Inactive / Rest Intermissions (Without Judgement) */}
            <div className="space-y-2 pt-2 border-t border-[var(--color-border-subtle)]">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-[var(--color-text-primary)] flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-[var(--color-text-muted)]" />
                  <span>Rest & Intermission Windows</span>
                </span>
                <span className="text-[11px] text-[var(--color-text-muted)]">
                  Periods with 3+ rest days
                </span>
              </div>

              {inactivePeriods.length === 0 ? (
                <p className="text-xs text-[var(--color-text-muted)] italic">
                  No extended training intermissions recorded in athlete history.
                </p>
              ) : (
                <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                  {inactivePeriods.slice(0, 4).map((p, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-2 rounded-md bg-[var(--color-surface-hover)]/40 border border-[var(--color-border)] text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-accent)]" />
                        <span className="font-mono text-[var(--color-text-primary)]">
                          {p.startDate} to {p.endDate}
                        </span>
                      </div>
                      <span className="text-[var(--color-text-muted)] font-mono">
                        {p.durationDays} rest days
                      </span>
                    </div>
                  ))}
                </div>
              )}
              <p className="text-[11px] text-[var(--color-text-muted)] pt-0.5">
                Rest and recovery intervals between workouts promote systemic muscular repair and CNS recovery.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* E. Nutrition Consistency */}
        <Card className="border-[var(--color-border)] bg-[var(--color-surface)]">
          <CardHeader className="pb-3 border-b border-[var(--color-border-subtle)]">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Apple className="w-4 h-4 text-[var(--color-accent-secondary)]" />
                <span>Nutrition Consistency</span>
              </CardTitle>
              <Badge variant="outline">
                {nutritionConsistency.loggingPercentage}% logged
              </Badge>
            </div>
            <CardDescription className="text-xs">
              Daily food logging adherence and tracking streaks.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-5 space-y-4">
            {/* Logging Coverage Progress Bar */}
            <div className="p-3.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-hover)]/30 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-[var(--color-text-primary)]">
                  Logging Coverage in Timeframe
                </span>
                <span className="font-mono text-[var(--color-text-secondary)]">
                  {nutritionConsistency.loggedDaysCount} / {nutritionConsistency.totalDaysInRange} days
                </span>
              </div>
              <div className="w-full bg-[var(--color-border)] rounded-full h-2 overflow-hidden">
                <div
                  className="bg-[var(--color-accent-secondary)] h-2 rounded-full transition-all duration-300"
                  style={{ width: `${Math.min(100, nutritionConsistency.loggingPercentage)}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-[11px] text-[var(--color-text-muted)]">
                <span>{nutritionConsistency.loggingPercentage}% of calendar days recorded</span>
                <span>Active window: {startDate} to {endDate}</span>
              </div>
            </div>

            {/* Streak Grid */}
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-subtle)] space-y-1">
                <span className="text-[var(--color-text-muted)] text-[11px]">Current Logging Streak</span>
                <div className="text-lg font-bold font-mono text-[var(--color-text-primary)] flex items-baseline gap-1">
                  <span>{nutritionStreaks.currentStreakDays}</span>
                  <span className="text-xs font-normal text-[var(--color-text-muted)]">days</span>
                </div>
                <p className="text-[10px] text-[var(--color-text-muted)]">
                  Active continuous food logs
                </p>
              </div>

              <div className="p-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-subtle)] space-y-1">
                <span className="text-[var(--color-text-muted)] text-[11px]">Longest Logging Streak</span>
                <div className="text-lg font-bold font-mono text-[var(--color-text-primary)] flex items-baseline gap-1">
                  <span>{nutritionStreaks.longestStreakDays}</span>
                  <span className="text-xs font-normal text-[var(--color-text-muted)]">days</span>
                </div>
                <p className="text-[10px] text-[var(--color-text-muted)]">
                  All-time peak logging sequence
                </p>
              </div>
            </div>

            {/* Zero-Calorie Rule Integrity Note */}
            <div className="p-3 rounded-lg border border-amber-500/20 bg-amber-500/5 flex items-start gap-2.5 text-xs">
              <Info className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <div className="font-semibold text-amber-700 dark:text-amber-400">
                  Data Calculation Integrity Standard
                </div>
                <p className="text-[11px] text-[var(--color-text-secondary)] leading-relaxed">
                  Unlogged days are strictly excluded from caloric averages and are never counted as zero-calorie days. Average intake reflects only verified food log days.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ======================================================================== */}
      {/* FEATURE F: LIFETIME MILESTONE STATISTICS */}
      {/* ======================================================================== */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted)]">
            Lifetime Milestone Statistics
          </h3>
          <span className="text-xs text-[var(--color-text-muted)]">
            All-time athlete totals based strictly on actual available records
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {/* 1. Lifetime Completed Workouts */}
          <Card className="border-[var(--color-border)] bg-[var(--color-surface)] shadow-xs">
            <CardContent className="p-4 space-y-1">
              <div className="flex items-center justify-between text-xs text-[var(--color-text-muted)]">
                <span>Lifetime Workouts</span>
                <Dumbbell className="w-3.5 h-3.5 text-[var(--color-accent)]" />
              </div>
              <div className="text-xl font-bold font-mono text-[var(--color-text-primary)]">
                {isLoadingSessions ? '—' : lifetimeStats.lifetimeCompletedWorkouts.toLocaleString()}
              </div>
              <p className="text-[11px] text-[var(--color-text-muted)]">
                Completed sessions
              </p>
            </CardContent>
          </Card>

          {/* 2. Lifetime Working Sets */}
          <Card className="border-[var(--color-border)] bg-[var(--color-surface)] shadow-xs">
            <CardContent className="p-4 space-y-1">
              <div className="flex items-center justify-between text-xs text-[var(--color-text-muted)]">
                <span>Lifetime Working Sets</span>
                <Layers className="w-3.5 h-3.5 text-[var(--color-lavender)]" />
              </div>
              <div className="text-xl font-bold font-mono text-[var(--color-text-primary)]">
                {isLoadingSessions ? '—' : lifetimeStats.lifetimeWorkingSets.toLocaleString()}
              </div>
              <p className="text-[11px] text-[var(--color-text-muted)]">
                Completed reps &gt; 0
              </p>
            </CardContent>
          </Card>

          {/* 3. Lifetime Training Volume */}
          <Card className="border-[var(--color-border)] bg-[var(--color-surface)] shadow-xs">
            <CardContent className="p-4 space-y-1">
              <div className="flex items-center justify-between text-xs text-[var(--color-text-muted)]">
                <span>Lifetime Volume</span>
                <TrendingUp className="w-3.5 h-3.5 text-amber-500" />
              </div>
              <div className="text-xl font-bold font-mono text-[var(--color-text-primary)]">
                {isLoadingSessions ? '—' : `${Math.round(kgToDisplay(lifetimeStats.lifetimeTrainingVolumeKg)).toLocaleString()} ${weightUnit}`}
              </div>
              <p className="text-[11px] text-[var(--color-text-muted)]">
                Total load moved
              </p>
            </CardContent>
          </Card>

          {/* 4. Lifetime Nutrition Logging Days */}
          <Card className="border-[var(--color-border)] bg-[var(--color-surface)] shadow-xs">
            <CardContent className="p-4 space-y-1">
              <div className="flex items-center justify-between text-xs text-[var(--color-text-muted)]">
                <span>Lifetime Nutrition Days</span>
                <Apple className="w-3.5 h-3.5 text-[var(--color-accent-secondary)]" />
              </div>
              <div className="text-xl font-bold font-mono text-[var(--color-text-primary)]">
                {isLoadingNutrition ? '—' : lifetimeStats.totalNutritionDays.toLocaleString()}
              </div>
              <p className="text-[11px] text-[var(--color-text-muted)]">
                Daily food logs recorded
              </p>
            </CardContent>
          </Card>

          {/* 5. Lifetime Weigh-ins */}
          <Card className="border-[var(--color-border)] bg-[var(--color-surface)] shadow-xs">
            <CardContent className="p-4 space-y-1">
              <div className="flex items-center justify-between text-xs text-[var(--color-text-muted)]">
                <span>Lifetime Weigh-ins</span>
                <Scale className="w-3.5 h-3.5 text-[var(--color-accent)]" />
              </div>
              <div className="text-xl font-bold font-mono text-[var(--color-text-primary)]">
                {isLoadingWeightEntries ? '—' : lifetimeStats.totalWeighIns.toLocaleString()}
              </div>
              <p className="text-[11px] text-[var(--color-text-muted)]">
                Weight entries logged
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* ======================================================================== */}
      {/* FEATURE G: CONSISTENCY INSIGHTS */}
      {/* ======================================================================== */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted)]">
            Consistency Insights & Patterns
          </h3>
          <span className="text-xs text-[var(--color-text-muted)]">
            Factual historical observations without judgemental bias
          </span>
        </div>

        {insights.length === 0 ? (
          <Card className="border-[var(--color-border)] bg-[var(--color-surface)] p-5 text-center">
            <p className="text-xs text-[var(--color-text-muted)]">
              Continue recording workout sessions and nutrition logs to generate multi-week trend insights.
            </p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {insights.map((insight) => (
              <Card
                key={insight.id}
                className={`border-[var(--color-border)] bg-[var(--color-surface)] transition-all ${
                  insight.status === 'positive'
                    ? 'border-l-4 border-l-[var(--color-accent)]'
                    : insight.status === 'neutral'
                      ? 'border-l-4 border-l-[var(--color-accent-secondary)]'
                      : 'border-l-4 border-l-amber-500'
                }`}
              >
                <CardContent className="p-4 flex items-start gap-3">
                  <div className="p-1.5 rounded-md bg-[var(--color-surface-hover)] shrink-0 mt-0.5 text-[var(--color-text-muted)]">
                    {insight.status === 'positive' ? (
                      <CheckCircle2 className="w-4 h-4 text-[var(--color-accent)]" />
                    ) : (
                      <Info className="w-4 h-4 text-[var(--color-accent-secondary)]" />
                    )}
                  </div>
                  <div className="space-y-1">
                    <h4 className="text-xs font-bold text-[var(--color-text-primary)]">
                      {insight.title}
                    </h4>
                    <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">
                      {insight.message}
                    </p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
