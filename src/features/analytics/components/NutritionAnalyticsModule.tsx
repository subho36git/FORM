import React, { useState, useEffect, useMemo, useCallback } from 'react'
import {
  Flame,
  Apple,
  Dumbbell,
  Target,
  TrendingUp,
  Activity,
  Sparkles,
  PieChart,
  Calendar,
  AlertCircle,
  CheckCircle2,
  Info,
  RefreshCw,
} from 'lucide-react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { useAuth } from '@/features/auth'
import { useGoals } from '@/features/goals/context/GoalContext'
import { analyticsService } from '../services/analyticsService'
import {
  calculateAverageLoggedCalories,
  calculateAverageMacros,
  calculateCalorieTargetAdherence,
  calculateMacroCaloriePercentages,
  calculateMealCategoryDistribution,
  calculateCalorieMovingAverage,
  generateNutritionInsights,
} from '../utils/analyticsCalculations'
import { TrendLineChart, type TrendLineSeries, type TargetLine } from './charts/TrendLineChart'
import { ComparisonBarChart, type ComparisonBarItem } from './charts/ComparisonBarChart'
import { DonutDistributionChart, type DonutSegment } from './charts/DonutDistributionChart'
import type { AnalyticsTimeframe } from '../types'
import type { NutritionDayData, DbNutritionMeal, DbNutritionFoodItem, MealCategory } from '@/features/nutrition/types'

const MEAL_CATEGORY_LABELS: Record<MealCategory, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
  snack: 'Snack',
}

const MEAL_CATEGORY_COLORS: Record<MealCategory, string> = {
  breakfast: '#84CEEB', // Sky Cyan
  lunch: '#5680E9', // Primary Blue
  dinner: '#8860D0', // Lavender
  snack: '#5AB9EA', // Bright Cyan Blue
}

export const NutritionAnalyticsModule: React.FC = () => {
  const { user, profile } = useAuth()
  const { goals } = useGoals()
  const userId = user?.id

  // Timeframe state: 1M (30d), 3M (90d), 6M (180d), 1Y (1y), All (all)
  const [timeframe, setTimeframe] = useState<AnalyticsTimeframe>('30d')

  // Data fetching state
  const [nutritionDaysData, setNutritionDaysData] = useState<NutritionDayData[]>([])
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)

  // 1. Resolve Timeframe Range
  const { startDate, endDate } = useMemo(() => {
    return analyticsService.getTimeframeDates(timeframe)
  }, [timeframe])

  // 2. Fetch Nutrition History
  const fetchNutritionData = useCallback(async () => {
    if (!userId) return
    setIsLoading(true)
    setError(null)
    try {
      const data = await analyticsService.getNutritionHistory(userId, startDate, endDate)
      setNutritionDaysData(data)
    } catch (err: unknown) {
      console.error('[NutritionAnalyticsModule] Failed to load nutrition history:', err)
      setError(err instanceof Error ? err.message : 'Failed to load nutrition analytics.')
    } finally {
      setIsLoading(false)
    }
  }, [userId, startDate, endDate])

  useEffect(() => {
    let isMounted = true
    const run = async () => {
      await Promise.resolve()
      if (!isMounted) return
      await fetchNutritionData()
    }
    void run()
    return () => {
      isMounted = false
    }
  }, [fetchNutritionData])

  // 3. Resolve Configured User Targets (Profile priority, GoalEngine fallback)
  const calorieTarget = useMemo(() => {
    const p = profile?.daily_calorie_target
    if (typeof p === 'number' && p > 0) return p
    const g = goals?.dailyCalories
    if (typeof g === 'number' && g > 0) return g
    return null
  }, [profile?.daily_calorie_target, goals?.dailyCalories])

  const proteinTarget = useMemo(() => {
    const p = profile?.protein_target_g
    if (typeof p === 'number' && p > 0) return p
    const g = goals?.proteinG
    if (typeof g === 'number' && g > 0) return g
    return null
  }, [profile?.protein_target_g, goals?.proteinG])

  const carbsTarget = useMemo(() => {
    const p = profile?.carbs_target_g
    if (typeof p === 'number' && p > 0) return p
    const g = goals?.carbsG
    if (typeof g === 'number' && g > 0) return g
    return null
  }, [profile?.carbs_target_g, goals?.carbsG])

  const fatTarget = useMemo(() => {
    const p = profile?.fat_target_g
    if (typeof p === 'number' && p > 0) return p
    const g = goals?.fatG
    if (typeof g === 'number' && g > 0) return g
    return null
  }, [profile?.fat_target_g, goals?.fatG])

  // 4. Flatten Days, Meals, and Food Items
  const { allMeals, allFoodItems, dailyIntakes } = useMemo(() => {
    const meals: DbNutritionMeal[] = []
    const items: DbNutritionFoodItem[] = []

    const intakes = nutritionDaysData
      .map((dayData) => {
        const day = dayData.day
        const dayMeals = dayData.meals || []
        const dayItems = dayMeals.flatMap((m) => m.items || [])

        meals.push(...dayMeals)
        items.push(...dayItems)

        const cal = dayItems.reduce((sum, i) => sum + (Number(i.calories) || 0), 0)
        const p = dayItems.reduce((sum, i) => sum + (Number(i.protein_g) || 0), 0)
        const c = dayItems.reduce((sum, i) => sum + (Number(i.carbs_g) || 0), 0)
        const f = dayItems.reduce((sum, i) => sum + (Number(i.fat_g) || 0), 0)
        const fib = dayItems.reduce((sum, i) => sum + (Number(i.fiber_g) || 0), 0)

        const isAdherent =
          calorieTarget !== null && calorieTarget > 0
            ? Math.abs(cal - calorieTarget) <= calorieTarget * 0.1
            : false

        return {
          logDate: day ? day.log_date : '',
          calories: Math.round(cal),
          proteinG: Math.round(p * 10) / 10,
          carbsG: Math.round(c * 10) / 10,
          fatG: Math.round(f * 10) / 10,
          fiberG: Math.round(fib * 10) / 10,
          mealCount: dayMeals.length,
          isAdherent,
          caloriesTarget: calorieTarget,
          proteinTarget: proteinTarget,
        }
      })
      .filter((d) => Boolean(d.logDate))
      .sort((a, b) => a.logDate.localeCompare(b.logDate))

    return { allMeals: meals, allFoodItems: items, dailyIntakes: intakes }
  }, [nutritionDaysData, calorieTarget, proteinTarget])

  // Logged days strictly filtered (critical rule: never treat unlogged days as zero intake)
  const loggedDays = useMemo(() => {
    return dailyIntakes.filter((d) => d.calories > 0 || d.mealCount > 0)
  }, [dailyIntakes])

  // 5. Pure Aggregations across Logged Days
  const averageCalories = useMemo(() => {
    return calculateAverageLoggedCalories(loggedDays)
  }, [loggedDays])

  const avgMacros = useMemo(() => {
    return calculateAverageMacros(loggedDays)
  }, [loggedDays])

  const targetAdherence = useMemo(() => {
    return calculateCalorieTargetAdherence(loggedDays, 10)
  }, [loggedDays])

  const macroPercentages = useMemo(() => {
    return calculateMacroCaloriePercentages(
      avgMacros.averageProteinG,
      avgMacros.averageCarbsG,
      avgMacros.averageFatG
    )
  }, [avgMacros])

  const mealDistribution = useMemo(() => {
    return calculateMealCategoryDistribution(allMeals, allFoodItems)
  }, [allMeals, allFoodItems])

  // 6. Calorie Rolling Average Series
  const calorieTrendPoints = useMemo(() => {
    return calculateCalorieMovingAverage(loggedDays, 7)
  }, [loggedDays])

  // 7. Calorie Trajectory Chart Series
  const calorieChartSeries: TrendLineSeries[] = useMemo(() => {
    if (calorieTrendPoints.length === 0) return []

    return [
      {
        id: 'daily-calories',
        name: 'Daily Intake',
        data: calorieTrendPoints.map((p) => ({
          x: p.date,
          y: p.calories,
          label: 'Daily Intake',
        })),
        color: 'var(--color-text-muted)',
        isDashed: true,
        showAreaGradient: false,
        showPoints: true,
      },
      {
        id: 'rolling-avg-calories',
        name: '7-Day Rolling Average',
        data: calorieTrendPoints.map((p) => ({
          x: p.date,
          y: p.movingAvgCalories,
          label: '7-Day Moving Avg',
        })),
        color: 'var(--color-accent)',
        isDashed: false,
        showAreaGradient: true,
        showPoints: true,
      },
    ]
  }, [calorieTrendPoints])

  const calorieTargetLine: TargetLine | undefined = useMemo(() => {
    if (!calorieTarget || calorieTarget <= 0) return undefined
    return {
      value: calorieTarget,
      label: `Daily Target (${calorieTarget.toLocaleString()} kcal)`,
      color: 'var(--color-warning)',
      isDashed: true,
    }
  }, [calorieTarget])

  // 8. Macronutrient Trajectory Series (Protein, Carbs, Fat in grams)
  const macroChartSeries: TrendLineSeries[] = useMemo(() => {
    if (loggedDays.length === 0) return []

    return [
      {
        id: 'macro-protein',
        name: 'Protein',
        data: loggedDays.map((d) => ({ x: d.logDate, y: d.proteinG, label: 'Protein' })),
        color: '#5680E9', // Primary Blue
        isDashed: false,
        showAreaGradient: false,
        showPoints: true,
      },
      {
        id: 'macro-carbs',
        name: 'Carbohydrates',
        data: loggedDays.map((d) => ({ x: d.logDate, y: d.carbsG, label: 'Carbs' })),
        color: '#5AB9EA', // Bright Cyan Blue
        isDashed: false,
        showAreaGradient: false,
        showPoints: true,
      },
      {
        id: 'macro-fat',
        name: 'Fat',
        data: loggedDays.map((d) => ({ x: d.logDate, y: d.fatG, label: 'Fat' })),
        color: '#8860D0', // Lavender
        isDashed: false,
        showAreaGradient: false,
        showPoints: true,
      },
    ]
  }, [loggedDays])

  // 9. Macro Calorie Distribution Donut Segments
  const macroDonutSegments: DonutSegment[] = useMemo(() => {
    if (loggedDays.length === 0) return []

    const pKcal = Math.round(avgMacros.averageProteinG * 4)
    const cKcal = Math.round(avgMacros.averageCarbsG * 4)
    const fKcal = Math.round(avgMacros.averageFatG * 9)

    return [
      {
        id: 'protein',
        label: 'Protein (4 kcal/g)',
        value: macroPercentages.proteinPercent,
        color: '#5680E9',
        subLabel: `${avgMacros.averageProteinG.toFixed(1)}g avg • ${pKcal} kcal`,
      },
      {
        id: 'carbs',
        label: 'Carbs (4 kcal/g)',
        value: macroPercentages.carbsPercent,
        color: '#5AB9EA',
        subLabel: `${avgMacros.averageCarbsG.toFixed(1)}g avg • ${cKcal} kcal`,
      },
      {
        id: 'fat',
        label: 'Fat (9 kcal/g)',
        value: macroPercentages.fatPercent,
        color: '#8860D0',
        subLabel: `${avgMacros.averageFatG.toFixed(1)}g avg • ${fKcal} kcal`,
      },
    ]
  }, [loggedDays.length, avgMacros, macroPercentages])

  // 10. Calorie Adherence Comparison Bars (Recent logged days vs target)
  const adherenceBarItems: ComparisonBarItem[] = useMemo(() => {
    if (loggedDays.length === 0 || !calorieTarget) return []

    // Slice up to 14 recent logged days for clean display
    const recent = loggedDays.slice(-14)
    return recent.map((d) => {
      const delta = Math.abs(d.calories - calorieTarget)
      const allowed = calorieTarget * 0.1
      const isAdherent = delta <= allowed
      const isUnder = d.calories < calorieTarget - allowed

      const status: ComparisonBarItem['status'] = isAdherent
        ? 'success'
        : isUnder
        ? 'warning'
        : 'danger'

      // Format date label e.g. "Nov 4"
      const [year, month, day] = d.logDate.split('-').map(Number)
      const dateObj = new Date(year, month - 1, day)
      const label = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

      return {
        id: d.logDate,
        label,
        actual: d.calories,
        target: calorieTarget,
        status,
        subLabel: `${d.calories.toLocaleString()} kcal (${isAdherent ? 'On Target' : isUnder ? 'Under' : 'Over'})`,
      }
    })
  }, [loggedDays, calorieTarget])

  // 11. Fibre Intake Trajectory Series
  const fiberChartSeries: TrendLineSeries[] = useMemo(() => {
    if (loggedDays.length === 0) return []

    return [
      {
        id: 'daily-fiber',
        name: 'Daily Fibre',
        data: loggedDays.map((d) => ({
          x: d.logDate,
          y: d.fiberG,
          label: 'Fibre Intake',
        })),
        color: '#84CEEB', // Sky Cyan (Supporting Series)
        isDashed: false,
        showAreaGradient: true,
        showPoints: true,
      },
    ]
  }, [loggedDays])

  const fiberBenchmarkLine: TargetLine = {
    value: 30,
    label: 'Guideline Benchmark (30g)',
    color: 'var(--color-accent)',
    isDashed: true,
  }

  // 12. Meal Distribution Donut Segments
  const mealDonutSegments: DonutSegment[] = useMemo(() => {
    if (mealDistribution.length === 0) return []

    return mealDistribution
      .filter((m) => m.calories > 0)
      .map((m) => ({
        id: m.category,
        label: MEAL_CATEGORY_LABELS[m.category] || m.category,
        value: m.percentage,
        color: MEAL_CATEGORY_COLORS[m.category] || 'var(--color-accent)',
        subLabel: `${m.calories.toLocaleString()} kcal • ${m.mealCount} meals`,
      }))
  }, [mealDistribution])

  // Primary Caloric Driver Meal
  const mostCaloricMeal = useMemo(() => {
    if (mealDistribution.length === 0) return null
    const sorted = [...mealDistribution].sort((a, b) => b.calories - a.calories)
    return sorted[0]?.calories > 0 ? sorted[0] : null
  }, [mealDistribution])

  // 13. Algorithmic Nutrition Insights
  const nutritionInsights = useMemo(() => {
    return generateNutritionInsights({
      loggedDays,
      averageCalories,
      calorieTarget,
      averageProteinG: avgMacros.averageProteinG,
      proteinTarget,
      averageCarbsG: avgMacros.averageCarbsG,
      carbsTarget,
      averageFatG: avgMacros.averageFatG,
      fatTarget,
      averageFiberG: avgMacros.averageFiberG,
      macroPercentages,
    })
  }, [
    loggedDays,
    averageCalories,
    calorieTarget,
    avgMacros,
    proteinTarget,
    carbsTarget,
    fatTarget,
    macroPercentages,
  ])

  // Loading Skeleton State
  if (isLoading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-14 bg-[var(--color-surface-hover)] rounded-xl w-1/3" />
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-28 bg-[var(--color-surface-hover)] rounded-xl border border-[var(--color-border)]" />
          ))}
        </div>
        <div className="h-72 bg-[var(--color-surface-hover)] rounded-xl border border-[var(--color-border)]" />
      </div>
    )
  }

  // Error State
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center p-12 rounded-2xl border border-red-500/20 bg-red-500/5 text-center space-y-4">
        <div className="w-12 h-12 rounded-xl bg-red-500/10 text-red-500 flex items-center justify-center">
          <AlertCircle className="w-6 h-6" />
        </div>
        <div className="max-w-md space-y-1">
          <h3 className="text-base font-bold text-[var(--color-text-primary)]">
            Failed to Load Nutrition Analytics
          </h3>
          <p className="text-xs text-[var(--color-text-secondary)]">{error}</p>
        </div>
        <Button variant="secondary" size="sm" icon={<RefreshCw className="w-4 h-4" />} onClick={fetchNutritionData}>
          Try Again
        </Button>
      </div>
    )
  }

  // Empty State Guard when no logs exist in window
  if (loggedDays.length === 0) {
    return (
      <div className="space-y-6 animate-in fade-in duration-200">
        {/* Module Sub-Header & Timeframe Controls */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-semibold uppercase tracking-wider text-amber-500 flex items-center gap-1.5">
                <Flame className="w-3.5 h-3.5" /> Nutrition & Metabolic Adherence
              </span>
            </div>
            <h2 className="text-xl md:text-2xl font-bold tracking-tight text-[var(--color-text-primary)]">
              Nutrition Performance Analytics
            </h2>
            <p className="text-xs md:text-sm text-[var(--color-text-secondary)] mt-0.5">
              Caloric trajectory, macronutrient balance, and target adherence.
            </p>
          </div>

          {/* Timeframe Selector */}
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

        <div className="flex flex-col items-center justify-center p-12 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center">
            <Flame className="w-7 h-7" />
          </div>
          <div className="max-w-md space-y-1.5">
            <h3 className="text-lg font-bold text-[var(--color-text-primary)]">
              No Nutrition Data in Selected Timeframe
            </h3>
            <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">
              No meals or food items were logged between {startDate} and {endDate}. Start logging meals or expand your timeframe to view caloric trajectories and macro analytics.
            </p>
          </div>
          <div className="pt-2 flex items-center gap-3">
            <Button
              variant="primary"
              size="md"
              icon={<Flame className="w-4 h-4" />}
              onClick={() => (window.location.href = '/nutrition')}
            >
              Log Meals Now
            </Button>
            {timeframe !== 'all' && (
              <Button variant="secondary" size="md" onClick={() => setTimeframe('all')}>
                View All-Time Data
              </Button>
            )}
          </div>
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
            <span className="text-xs font-semibold uppercase tracking-wider text-amber-500 flex items-center gap-1.5">
              <Flame className="w-3.5 h-3.5" /> Nutrition & Metabolic Adherence
            </span>
          </div>
          <h2 className="text-xl md:text-2xl font-bold tracking-tight text-[var(--color-text-primary)]">
            Nutrition Performance Analytics
          </h2>
          <p className="text-xs md:text-sm text-[var(--color-text-secondary)] mt-0.5">
            Caloric trajectory, macronutrient balance, and target adherence.
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

      {/* 1. NUTRITION OVERVIEW METRICS GRID (6 Cards) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
        {/* Card 1: Average Daily Calories */}
        <Card>
          <CardContent className="p-3.5 sm:p-4">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
                Avg Calories
              </span>
              <div className="p-1.5 rounded-md bg-amber-500/10 text-amber-500">
                <Flame className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="mt-2 flex items-baseline gap-1">
              <span className="text-xl sm:text-2xl font-bold text-[var(--color-text-primary)] font-mono">
                {averageCalories.toLocaleString()}
              </span>
              <span className="text-[11px] text-[var(--color-text-muted)] font-medium">kcal</span>
            </div>
            <div className="mt-1.5 text-[10px] text-[var(--color-text-secondary)] truncate">
              {calorieTarget ? `Target: ${calorieTarget.toLocaleString()} kcal` : 'Across logged days'}
            </div>
          </CardContent>
        </Card>

        {/* Card 2: Average Protein */}
        <Card>
          <CardContent className="p-3.5 sm:p-4">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
                Avg Protein
              </span>
              <div className="p-1.5 rounded-md bg-[var(--color-accent-subtle)] text-[var(--color-accent)]">
                <Dumbbell className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="mt-2 flex items-baseline gap-1">
              <span className="text-xl sm:text-2xl font-bold text-[var(--color-accent)] font-mono">
                {avgMacros.averageProteinG.toFixed(1)}
              </span>
              <span className="text-[11px] text-[var(--color-text-muted)] font-medium">g</span>
            </div>
            <div className="mt-1.5 text-[10px] text-[var(--color-text-secondary)] truncate">
              {proteinTarget ? `Target: ${proteinTarget}g (${Math.round(avgMacros.averageProteinG * 4)} kcal)` : `${Math.round(avgMacros.averageProteinG * 4)} kcal`}
            </div>
          </CardContent>
        </Card>

        {/* Card 3: Average Carbohydrates */}
        <Card>
          <CardContent className="p-3.5 sm:p-4">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
                Avg Carbs
              </span>
              <div className="p-1.5 rounded-md bg-amber-500/10 text-amber-500">
                <PieChart className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="mt-2 flex items-baseline gap-1">
              <span className="text-xl sm:text-2xl font-bold text-amber-500 font-mono">
                {avgMacros.averageCarbsG.toFixed(1)}
              </span>
              <span className="text-[11px] text-[var(--color-text-muted)] font-medium">g</span>
            </div>
            <div className="mt-1.5 text-[10px] text-[var(--color-text-secondary)] truncate">
              {carbsTarget ? `Target: ${carbsTarget}g (${Math.round(avgMacros.averageCarbsG * 4)} kcal)` : `${Math.round(avgMacros.averageCarbsG * 4)} kcal`}
            </div>
          </CardContent>
        </Card>

        {/* Card 4: Average Fat */}
        <Card>
          <CardContent className="p-3.5 sm:p-4">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
                Avg Fats
              </span>
              <div className="p-1.5 rounded-md bg-pink-500/10 text-pink-500">
                <Activity className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="mt-2 flex items-baseline gap-1">
              <span className="text-xl sm:text-2xl font-bold text-pink-500 font-mono">
                {avgMacros.averageFatG.toFixed(1)}
              </span>
              <span className="text-[11px] text-[var(--color-text-muted)] font-medium">g</span>
            </div>
            <div className="mt-1.5 text-[10px] text-[var(--color-text-secondary)] truncate">
              {fatTarget ? `Target: ${fatTarget}g (${Math.round(avgMacros.averageFatG * 9)} kcal)` : `${Math.round(avgMacros.averageFatG * 9)} kcal`}
            </div>
          </CardContent>
        </Card>

        {/* Card 5: Average Fibre */}
        <Card>
          <CardContent className="p-3.5 sm:p-4">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
                Avg Fibre
              </span>
              <div className="p-1.5 rounded-md bg-[var(--color-cyan-subtle)] text-[var(--color-cyan)]">
                <Apple className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="mt-2 flex items-baseline gap-1">
              <span className="text-xl sm:text-2xl font-bold text-[var(--color-cyan)] font-mono">
                {avgMacros.averageFiberG.toFixed(1)}
              </span>
              <span className="text-[11px] text-[var(--color-text-muted)] font-medium">g</span>
            </div>
            <div className="mt-1.5 text-[10px] text-[var(--color-text-secondary)] truncate">
              Benchmark: 30g guideline
            </div>
          </CardContent>
        </Card>

        {/* Card 6: Calorie Target Adherence */}
        <Card>
          <CardContent className="p-3.5 sm:p-4">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
                Adherence (±10%)
              </span>
              <div className="p-1.5 rounded-md bg-[var(--color-accent-subtle)] text-[var(--color-accent)]">
                <Target className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="mt-2 flex items-baseline gap-1">
              <span className="text-xl sm:text-2xl font-bold text-[var(--color-accent)] font-mono">
                {targetAdherence.targetAdherenceRate.toFixed(0)}%
              </span>
              <span className="text-[11px] text-[var(--color-text-muted)] font-medium">rate</span>
            </div>
            <div className="mt-1.5 text-[10px] text-[var(--color-text-secondary)] truncate">
              {targetAdherence.adherentDaysCount} of {targetAdherence.totalLoggedDays} logged days
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 2. CALORIE TRAJECTORY & 7-DAY ROLLING TREND */}
      <Card>
        <CardHeader className="pb-3 border-b border-[var(--color-border-subtle)]">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-amber-500" />
                <span>Calorie Intake Trajectory & Rolling Trend</span>
              </CardTitle>
              <CardDescription className="text-xs">
                Daily logged intake alongside 7-day trailing moving average and target reference.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <Badge variant="accent" className="font-mono">
                {loggedDays.length} Logged Days
              </Badge>
              {calorieTarget && (
                <span className="text-[11px] text-[var(--color-text-muted)]">
                  Target: {calorieTarget.toLocaleString()} kcal
                </span>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent className="pt-4">
          <TrendLineChart
            series={calorieChartSeries}
            targetLine={calorieTargetLine}
            height={260}
            yAxisFormatter={(val) => `${Math.round(val)} kcal`}
            tooltipDateFormatter={(d) => d}
            emptyMessage="No logged calorie entries found in this timeframe."
          />
        </CardContent>
      </Card>

      {/* 3. TWO-COLUMN: MACRO DONUT & MACRO INTAKE TRENDS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Macro Calorie Distribution Donut */}
        <Card className="flex flex-col justify-between">
          <CardHeader className="pb-3 border-b border-[var(--color-border-subtle)]">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <PieChart className="w-4 h-4 text-[var(--color-accent)]" />
                  <span>Macro Calorie Distribution</span>
                </CardTitle>
                <CardDescription className="text-xs">
                  Proportion of daily calories derived from Protein (4 kcal/g), Carbs (4 kcal/g), and Fat (9 kcal/g).
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-4 flex flex-col justify-between flex-1 space-y-4">
            <DonutDistributionChart
              segments={macroDonutSegments}
              size={210}
              unitLabel="%"
              centerLabel="Macros"
              valueFormatter={(v) => `${v.toFixed(1)}%`}
              emptyMessage="No macronutrient data recorded."
            />

            {/* Target vs Actual Macro Table */}
            <div className="grid grid-cols-3 gap-2 pt-3 border-t border-[var(--color-border-subtle)] text-center text-xs">
              <div className="p-2 rounded-lg bg-[var(--color-accent-subtle)] border border-[var(--color-accent)]/20">
                <span className="text-[10px] uppercase font-semibold text-[var(--color-accent-text)] block">Protein</span>
                <span className="text-sm font-bold text-[var(--color-text-primary)] font-mono block">
                  {avgMacros.averageProteinG.toFixed(1)}g
                </span>
                <span className="text-[10px] text-[var(--color-text-muted)]">
                  {proteinTarget ? `Target: ${proteinTarget}g` : `${macroPercentages.proteinPercent}% kcal`}
                </span>
              </div>

              <div className="p-2 rounded-lg bg-[var(--color-accent-secondary-subtle)] border border-[var(--color-accent-secondary)]/20">
                <span className="text-[10px] uppercase font-semibold text-[var(--color-accent-secondary-text)] block">Carbs</span>
                <span className="text-sm font-bold text-[var(--color-text-primary)] font-mono block">
                  {avgMacros.averageCarbsG.toFixed(1)}g
                </span>
                <span className="text-[10px] text-[var(--color-text-muted)]">
                  {carbsTarget ? `Target: ${carbsTarget}g` : `${macroPercentages.carbsPercent}% kcal`}
                </span>
              </div>

              <div className="p-2 rounded-lg bg-[var(--color-lavender-surface)] border border-[var(--color-lavender)]/20">
                <span className="text-[10px] uppercase font-semibold text-[var(--color-lavender-text)] block">Fat</span>
                <span className="text-sm font-bold text-[var(--color-text-primary)] font-mono block">
                  {avgMacros.averageFatG.toFixed(1)}g
                </span>
                <span className="text-[10px] text-[var(--color-text-muted)]">
                  {fatTarget ? `Target: ${fatTarget}g` : `${macroPercentages.fatPercent}% kcal`}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Right: Macronutrient Daily Trends (g) */}
        <Card className="flex flex-col justify-between">
          <CardHeader className="pb-3 border-b border-[var(--color-border-subtle)]">
            <CardTitle className="text-base flex items-center gap-2">
              <Activity className="w-4 h-4 text-[var(--color-accent)]" />
              <span>Daily Macronutrient Quantities (g)</span>
            </CardTitle>
            <CardDescription className="text-xs">
              Daily grams consumed for Protein, Carbohydrates, and Fats across logged days.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-4 flex-1">
            <TrendLineChart
              series={macroChartSeries}
              height={260}
              yAxisFormatter={(val) => `${val.toFixed(0)}g`}
              tooltipDateFormatter={(d) => d}
              emptyMessage="No logged macronutrient data in this timeframe."
            />
          </CardContent>
        </Card>
      </div>

      {/* 4. CALORIE TARGET ADHERENCE CORRIDOR & RECENT DAYS */}
      <Card>
        <CardHeader className="pb-3 border-b border-[var(--color-border-subtle)]">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Target className="w-4 h-4 text-[var(--color-accent)]" />
                <span>Calorie Target Adherence Corridor (±10%)</span>
              </CardTitle>
              <CardDescription className="text-xs">
                Classification of logged days against your configured target. Unlogged days are excluded.
              </CardDescription>
            </div>

            {/* Adherence Summary Badges */}
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-[var(--color-accent-subtle)] text-[var(--color-accent-text)] font-semibold">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>On Target: {targetAdherence.adherentDaysCount}d</span>
              </span>
              <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-500 font-semibold">
                <span>Under: {targetAdherence.belowTargetDaysCount ?? 0}d</span>
              </span>
              <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-rose-500/10 text-rose-500 font-semibold">
                <span>Over: {targetAdherence.aboveTargetDaysCount ?? 0}d</span>
              </span>
            </div>
          </div>
        </CardHeader>

        <CardContent className="pt-4 space-y-4">
          {calorieTarget ? (
            <>
              {/* Corridor Proportional Visual Bar */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-[11px] text-[var(--color-text-secondary)] font-medium">
                  <span>Adherence Distribution ({targetAdherence.totalLoggedDays} logged days)</span>
                  <span>{targetAdherence.targetAdherenceRate.toFixed(0)}% On-Target Rate</span>
                </div>
                <div className="h-3 w-full rounded-full bg-[var(--color-surface-hover)] overflow-hidden flex">
                  {targetAdherence.totalLoggedDays > 0 && (
                    <>
                      <div
                        className="bg-amber-500 h-full transition-all"
                        style={{
                          width: `${((targetAdherence.belowTargetDaysCount ?? 0) / targetAdherence.totalLoggedDays) * 100}%`,
                        }}
                        title={`Below Target: ${targetAdherence.belowTargetDaysCount ?? 0} days`}
                      />
                      <div
                        className="bg-[var(--color-accent)] h-full transition-all"
                        style={{
                          width: `${(targetAdherence.adherentDaysCount / targetAdherence.totalLoggedDays) * 100}%`,
                        }}
                        title={`On Target: ${targetAdherence.adherentDaysCount} days`}
                      />
                      <div
                        className="bg-rose-500 h-full transition-all"
                        style={{
                          width: `${((targetAdherence.aboveTargetDaysCount ?? 0) / targetAdherence.totalLoggedDays) * 100}%`,
                        }}
                        title={`Above Target: ${targetAdherence.aboveTargetDaysCount ?? 0} days`}
                      />
                    </>
                  )}
                </div>
              </div>

              {/* Comparison Bar Chart (Recent Logged Days vs Target) */}
              <div className="pt-2">
                <ComparisonBarChart
                  data={adherenceBarItems}
                  height={220}
                  valueFormatter={(v) => `${Math.round(v)} kcal`}
                  targetFormatter={(t) => `${Math.round(t)} kcal`}
                  barColor="var(--color-accent)"
                  emptyMessage="No logged days with active calorie target in this timeframe."
                />
              </div>
            </>
          ) : (
            <div className="p-8 text-center text-xs text-[var(--color-text-muted)]">
              No daily calorie target configured in profile or goal engine. Set a calorie target to view corridor adherence.
            </div>
          )}
        </CardContent>
      </Card>

      {/* 5. TWO-COLUMN: FIBRE TRACKING & MEAL PATTERNS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Dietary Fibre Tracking */}
        <Card className="flex flex-col justify-between">
          <CardHeader className="pb-3 border-b border-[var(--color-border-subtle)]">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <Apple className="w-4 h-4 text-[var(--color-cyan)]" />
                  <span>Dietary Fibre Tracking</span>
                </CardTitle>
                <CardDescription className="text-xs">
                  Daily grams consumed compared against the standard 30g daily dietary reference guideline.
                </CardDescription>
              </div>
              <Badge variant="outline" className="text-[10px] self-start sm:self-auto font-mono">
                Avg: {avgMacros.averageFiberG.toFixed(1)}g / day
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="pt-4 flex-1 space-y-3">
            <TrendLineChart
              series={fiberChartSeries}
              targetLine={fiberBenchmarkLine}
              height={220}
              yAxisFormatter={(val) => `${val.toFixed(1)}g`}
              tooltipDateFormatter={(d) => d}
              emptyMessage="No fibre data recorded in this timeframe."
            />
            <div className="flex items-center justify-between p-2.5 rounded-lg bg-[var(--color-surface-hover)] border border-[var(--color-border)] text-xs text-[var(--color-text-secondary)]">
              <span className="flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5 text-[var(--color-cyan)]" />
                <span>General Guideline: 30g/day reference</span>
              </span>
              <span className="font-semibold text-[var(--color-text-primary)] font-mono">
                {Math.round((avgMacros.averageFiberG / 30) * 100)}% of guideline
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Right: Meal Patterns & Caloric Density */}
        <Card className="flex flex-col justify-between">
          <CardHeader className="pb-3 border-b border-[var(--color-border-subtle)]">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-amber-500" />
                  <span>Meal Patterns & Caloric Allocation</span>
                </CardTitle>
                <CardDescription className="text-xs">
                  Caloric distribution across Breakfast, Lunch, Dinner, and Snacks.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-4 flex-1 flex flex-col justify-between space-y-3">
            <DonutDistributionChart
              segments={mealDonutSegments}
              size={200}
              unitLabel="%"
              centerLabel="Meals"
              valueFormatter={(v) => `${v.toFixed(1)}%`}
              emptyMessage="No categorized meals logged in this timeframe."
            />

            {/* Meal Density Callout */}
            {mostCaloricMeal && (
              <div className="p-2.5 rounded-lg bg-[var(--color-surface-hover)] border border-[var(--color-border)] flex items-center justify-between text-xs">
                <span className="text-[var(--color-text-secondary)]">
                  Primary Caloric Driver: <strong className="text-[var(--color-text-primary)] capitalize">{mostCaloricMeal.category}</strong>
                </span>
                <span className="font-mono font-bold text-[var(--color-accent)]">
                  {mostCaloricMeal.percentage.toFixed(0)}% ({mostCaloricMeal.calories.toLocaleString()} kcal)
                </span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 6. INTELLIGENT NUTRITION INSIGHTS */}
      <Card>
        <CardHeader className="pb-3 border-b border-[var(--color-border-subtle)]">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[var(--color-accent)]" />
                <span>Dietary Intelligence & Algorithmic Insights</span>
              </CardTitle>
              <CardDescription className="text-xs">
                Quantified insights derived strictly from your logged nutritional history.
              </CardDescription>
            </div>
            <Badge variant="accent" className="text-[10px]">
              {nutritionInsights.length} Insight{nutritionInsights.length === 1 ? '' : 's'} Generated
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="pt-4">
          {nutritionInsights.length === 0 ? (
            <div className="p-8 text-center text-xs text-[var(--color-text-muted)]">
              Log at least 3 days of nutrition in this timeframe to generate algorithmic dietary insights.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {nutritionInsights.map((insight) => (
                <div
                  key={insight.id}
                  className={`p-3.5 rounded-xl border transition-all ${
                    insight.status === 'positive'
                      ? 'border-[var(--color-accent)]/20 bg-[var(--color-accent-subtle)]'
                      : insight.status === 'warning'
                      ? 'border-amber-500/20 bg-amber-500/5'
                      : 'border-[var(--color-border)] bg-[var(--color-surface-hover)]/40'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <span className="font-bold text-xs text-[var(--color-text-primary)]">
                      {insight.title}
                    </span>
                    <Badge
                      variant={
                        insight.status === 'positive'
                          ? 'accent'
                          : insight.status === 'warning'
                          ? 'warning'
                          : 'outline'
                      }
                      className="text-[9px] px-1 py-0 capitalize"
                    >
                      {insight.category}
                    </Badge>
                  </div>
                  <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">
                    {insight.message}
                  </p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
