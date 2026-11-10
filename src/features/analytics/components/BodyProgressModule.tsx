import React, { useState, useMemo, useEffect } from 'react'
import {
  Scale,
  TrendingDown,
  TrendingUp,
  Target,
  Calendar,
  Sparkles,
  Info,
  CheckCircle2,
  AlertCircle,
  Clock,
  Plus,
  Activity,
  X,
  Loader2,
} from 'lucide-react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Input } from '@/components/ui/Input'
import { useGoals } from '@/features/goals'
import { useAuth } from '@/features/auth'
import { useUnit } from '@/hooks/useUnit'
import {
  calculateWeightMovingAverage,
  calculateWeightChange,
  calculateWeeklyWeightChangeRate,
  calculateGoalProgressPercentage,
  calculateProjectedCompletionDate,
  calculateBmi,
  toLocalDateString,
} from '../utils/analyticsCalculations'
import { analyticsService } from '../services/analyticsService'
import { TrendLineChart, type TrendLineSeries, type TargetLine } from './charts/TrendLineChart'
import type { AnalyticsTimeframe } from '../types'

interface BmiCategoryInfo {
  label: string
  color: string
  badgeVariant: 'accent' | 'outline' | 'warning' | 'danger'
}

function getBmiCategory(bmi: number | null): BmiCategoryInfo {
  if (bmi === null) {
    return { label: 'Unspecified', color: 'var(--color-text-muted)', badgeVariant: 'outline' }
  }
  if (bmi < 18.5) {
    return { label: 'Underweight', color: '#3B82F6', badgeVariant: 'outline' }
  }
  if (bmi < 25.0) {
    return { label: 'Normal Weight', color: 'var(--color-accent)', badgeVariant: 'accent' }
  }
  if (bmi < 30.0) {
    return { label: 'Overweight', color: 'var(--color-warning)', badgeVariant: 'warning' }
  }
  return { label: 'Obese Class', color: 'var(--color-danger)', badgeVariant: 'danger' }
}

export const BodyProgressModule: React.FC = () => {
  const { profile } = useAuth()
  const { weightEntries, isLoadingWeightEntries, addWeightEntry, refreshWeightEntries } = useGoals()
  const { unitSystem, weightUnit, kgToDisplay, displayToKg, formatHeight } = useUnit()

  const minWeight = unitSystem === 'metric' ? 25 : 55
  const maxWeight = unitSystem === 'metric' ? 350 : 770

  // Timeframe state: 1M (30d), 3M (90d), 6M (180d), 1Y (1y), All (all)
  const [timeframe, setTimeframe] = useState<AnalyticsTimeframe>('30d')

  // Quick weigh-in modal state
  const [isWeighInOpen, setIsWeighInOpen] = useState(false)
  const [weighInWeight, setWeighInWeight] = useState('')
  const [weighInDate, setWeighInDate] = useState(() => toLocalDateString(new Date()))
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [weighInError, setWeighInError] = useState<string | null>(null)
  const [weighInSuccess, setWeighInSuccess] = useState(false)

  // ESC key to close weigh-in modal
  useEffect(() => {
    if (!isWeighInOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsWeighInOpen(false)
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isWeighInOpen])

  // 1. Resolve Core Weights
  const sortedEntries = useMemo(() => {
    return [...(weightEntries || [])].sort((a, b) => {
      const da = new Date(a.measured_at).getTime()
      const db = new Date(b.measured_at).getTime()
      return da - db
    })
  }, [weightEntries])

  const baselineEntry = useMemo(() => {
    return sortedEntries.find((w) => w.is_baseline) || sortedEntries[0] || null
  }, [sortedEntries])

  const baselineWeightKg = baselineEntry ? Number(baselineEntry.weight_kg) : null
  const latestEntry = sortedEntries.length > 0 ? sortedEntries[sortedEntries.length - 1] : null
  const currentWeightKg = latestEntry ? Number(latestEntry.weight_kg) : (profile?.current_weight_kg ? Number(profile.current_weight_kg) : null)
  const goalWeightKg = profile?.goal_weight_kg ? Number(profile.goal_weight_kg) : null
  const heightCm = profile?.height_cm ? Number(profile.height_cm) : null
  const targetDateIso = profile?.target_completion_date || null

  // 2. Pure Calculations
  const netWeightChangeKg = useMemo(() => {
    return calculateWeightChange(currentWeightKg, baselineWeightKg)
  }, [currentWeightKg, baselineWeightKg])

  const weeklyRateKg = useMemo(() => {
    return calculateWeeklyWeightChangeRate(sortedEntries, 30)
  }, [sortedEntries])

  const progressPercentage = useMemo(() => {
    return calculateGoalProgressPercentage(currentWeightKg, baselineWeightKg, goalWeightKg)
  }, [currentWeightKg, baselineWeightKg, goalWeightKg])

  const projectedDate = useMemo(() => {
    return calculateProjectedCompletionDate(currentWeightKg, goalWeightKg, weeklyRateKg)
  }, [currentWeightKg, goalWeightKg, weeklyRateKg])

  const bmi = useMemo(() => {
    return calculateBmi(currentWeightKg, heightCm)
  }, [currentWeightKg, heightCm])

  const bmiCategory = useMemo(() => getBmiCategory(bmi), [bmi])

  // 3. Moving Average & Windowed Trend Data
  const movingAveragePoints = useMemo(() => {
    return calculateWeightMovingAverage(sortedEntries, 7)
  }, [sortedEntries])

  const { startDate, endDate } = useMemo(() => {
    return analyticsService.getTimeframeDates(timeframe)
  }, [timeframe])

  const windowedTrend = useMemo(() => {
    if (timeframe === 'all') return movingAveragePoints
    return movingAveragePoints.filter((p) => p.date >= startDate && p.date <= endDate)
  }, [movingAveragePoints, timeframe, startDate, endDate])

  // Chart Series Preparation
  const chartSeries: TrendLineSeries[] = useMemo(() => {
    if (windowedTrend.length === 0) return []

    // Series A: Raw Scale Weigh-ins
    const rawData = windowedTrend.map((p) => ({
      x: p.date,
      y: kgToDisplay(p.weightKg),
      label: 'Scale weight',
    }))

    // Series B: 7-Day Moving Average
    const maData = windowedTrend.map((p) => ({
      x: p.date,
      y: p.movingAvgKg !== null ? kgToDisplay(p.movingAvgKg) : null,
      label: '7-Day Trend',
    }))

    return [
      {
        id: 'raw-weight',
        name: 'Scale Weigh-ins',
        data: rawData,
        color: 'var(--color-text-muted)',
        isDashed: true,
        showAreaGradient: false,
        showPoints: true,
      },
      {
        id: 'moving-average',
        name: '7-Day Trend (SMA)',
        data: maData,
        color: 'var(--color-accent)',
        isDashed: false,
        showAreaGradient: true,
        showPoints: false,
      },
    ]
  }, [windowedTrend, kgToDisplay])

  const chartTargetLine: TargetLine | undefined = useMemo(() => {
    if (goalWeightKg === null || goalWeightKg <= 0) return undefined
    return {
      value: kgToDisplay(goalWeightKg),
      label: 'Goal',
      color: 'var(--color-warning)',
      isDashed: true,
    }
  }, [goalWeightKg, kgToDisplay])

  // Displayed Rate & Net Change for UI
  const displayedWeeklyRate = useMemo(() => {
    if (weeklyRateKg === null) return null
    return unitSystem === 'imperial' ? weeklyRateKg * 2.20462262 : weeklyRateKg
  }, [weeklyRateKg, unitSystem])

  const displayedNetChange = useMemo(() => {
    if (netWeightChangeKg === null) return null
    return unitSystem === 'imperial' ? netWeightChangeKg * 2.20462262 : netWeightChangeKg
  }, [netWeightChangeKg, unitSystem])

  // 4. Progress Insights Engine
  const progressInsights = useMemo(() => {
    const list: Array<{ title: string; desc: string; type: 'success' | 'info' | 'warning' }> = []

    if (sortedEntries.length < 2) {
      list.push({
        title: 'Initial Calibration Active',
        desc: 'Log at least 2 scale weigh-ins on different calendar days to unlock weekly velocity trends and completion forecasts.',
        type: 'info',
      })
      return list
    }

    // Weight achievement check
    if (currentWeightKg !== null && goalWeightKg !== null) {
      const distance = Math.abs(currentWeightKg - goalWeightKg)
      if (distance <= 0.2) {
        list.push({
          title: 'Goal Weight Achieved!',
          desc: `You have reached your goal weight of ${kgToDisplay(goalWeightKg).toFixed(1)} ${weightUnit}. Consider switching to a maintenance nutrition protocol to stabilize body weight.`,
          type: 'success',
        })
      }
    }

    // Velocity insight
    if (displayedWeeklyRate !== null) {
      const absRate = Math.abs(displayedWeeklyRate)
      const isLossGoal = baselineWeightKg !== null && goalWeightKg !== null && baselineWeightKg > goalWeightKg
      const isGaining = displayedWeeklyRate > (unitSystem === 'imperial' ? 0.1 : 0.05)
      const isLosing = displayedWeeklyRate < (unitSystem === 'imperial' ? -0.1 : -0.05)
      const isPlateau = absRate <= (unitSystem === 'imperial' ? 0.1 : 0.05)

      const optimalMin = unitSystem === 'imperial' ? 0.5 : 0.25
      const optimalMax = unitSystem === 'imperial' ? 2.2 : 1.0

      if (isLossGoal) {
        if (isLosing) {
          if (absRate >= optimalMin && absRate <= optimalMax) {
            list.push({
              title: 'Optimal Weight Loss Pace',
              desc: `Your 30-day rate of change is ${absRate.toFixed(2)} ${weightUnit}/week, which aligns with a steady rate of weight change (0.5%–1.0% of body weight/week).`,
              type: 'success',
            })
          } else if (absRate > optimalMax) {
            list.push({
              title: 'Rapid Weight Loss Rate',
              desc: `Weight is decreasing at ${absRate.toFixed(2)} ${weightUnit}/week. Monitor energy levels and training recovery at this pace.`,
              type: 'warning',
            })
          }
        } else if (isGaining) {
          list.push({
            title: 'Upward Weight Drift Detected',
            desc: `Scale weight has increased by +${absRate.toFixed(2)} ${weightUnit}/week over the last 30 days while on a weight reduction goal. Review daily caloric intake and logging consistency.`,
            type: 'warning',
          })
        } else if (isPlateau) {
          list.push({
            title: 'Weight Stabilization / Plateau',
            desc: `Your average weight has remained within ±${unitSystem === 'imperial' ? '0.1 lb' : '0.05 kg'} over recent weeks. If weight loss is stalled for >3 weeks, consider adjusting daily calories.`,
            type: 'info',
          })
        }
      } else {
        // Hypertrophy / Gain goal
        if (isGaining) {
          list.push({
            title: 'Weight Gain Progression',
            desc: `Weight is trending upward at +${absRate.toFixed(2)} ${weightUnit}/week, supporting training recovery and progressive overload.`,
            type: 'success',
          })
        } else if (isLosing) {
          list.push({
            title: 'Downward Weight Drift',
            desc: `Weight has decreased by -${absRate.toFixed(2)} ${weightUnit}/week. Ensure caloric intake aligns with your weight gain target.`,
            type: 'warning',
          })
        }
      }
    }

    // Moving Average smoothing explanation
    if (sortedEntries.length >= 4) {
      list.push({
        title: '7-Day Rolling Trend Filter',
        desc: 'Daily scale weights fluctuate due to hydration, sodium, and digestion. The 7-day trendline smooths daily variance to show the underlying weight trend.',
        type: 'info',
      })
    }

    return list
  }, [
    sortedEntries,
    currentWeightKg,
    goalWeightKg,
    baselineWeightKg,
    displayedWeeklyRate,
    unitSystem,
    weightUnit,
    kgToDisplay,
  ])

  // Handle Quick Weigh-in Submit
  const handleWeighInSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const weightNum = parseFloat(weighInWeight)
    if (isNaN(weightNum) || weightNum < minWeight || weightNum > maxWeight) {
      setWeighInError(
        `Please enter a realistic weight between ${minWeight.toFixed(1)} and ${maxWeight.toFixed(1)} ${weightUnit}.`
      )
      return
    }

    setIsSubmitting(true)
    setWeighInError(null)

    try {
      const weightInKg = displayToKg(weightNum)
      const { error } = await addWeightEntry(weightInKg, new Date(weighInDate).toISOString())
      if (error) {
        setWeighInError(error.message || 'Failed to record weigh-in.')
      } else {
        setWeighInSuccess(true)
        setWeighInWeight('')
        await refreshWeightEntries()
        setTimeout(() => {
          setWeighInSuccess(false)
          setIsWeighInOpen(false)
        }, 1200)
      }
    } catch (err) {
      setWeighInError(err instanceof Error ? err.message : 'Error recording weigh-in.')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Trajectory Comparison
  const trajectoryBadge = useMemo(() => {
    if (!projectedDate || !targetDateIso) return null
    const projTime = new Date(projectedDate).getTime()
    const targetTime = new Date(targetDateIso).getTime()

    if (projTime <= targetTime) {
      return { label: 'Ahead of Target', variant: 'accent' as const, icon: CheckCircle2 }
    }
    return { label: 'Pace Adjusted', variant: 'warning' as const, icon: Clock }
  }, [projectedDate, targetDateIso])

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Module Sub-Header & Quick Weigh-In CTA */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-semibold uppercase tracking-wider text-[var(--color-accent)] flex items-center gap-1.5">
              <Scale className="w-3.5 h-3.5" /> Body Composition & Trend
            </span>
          </div>
          <h2 className="text-xl md:text-2xl font-bold tracking-tight text-[var(--color-text-primary)]">
            Body Progress Intelligence
          </h2>
          <p className="text-xs md:text-sm text-[var(--color-text-secondary)] mt-0.5">
            Rolling averages, true velocity analysis, and milestone projections.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            variant="primary"
            size="sm"
            icon={<Plus className="w-4 h-4" />}
            onClick={() => setIsWeighInOpen(true)}
          >
            Log Weigh-In
          </Button>
        </div>
      </div>

      {/* 1. BODY OVERVIEW STATS GRID */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Card 1: Current Weight */}
        <Card>
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
                Current Weight
              </span>
              <div className="p-1.5 rounded-md bg-[var(--color-accent-subtle)] text-[var(--color-accent)]">
                <Scale className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2.5 flex items-baseline gap-1.5">
              <span className="text-2xl font-bold text-[var(--color-text-primary)] font-mono">
                {currentWeightKg !== null ? kgToDisplay(currentWeightKg).toFixed(1) : '—'}
              </span>
              <span className="text-xs text-[var(--color-text-muted)] font-medium">{weightUnit}</span>
            </div>
            <div className="mt-2 text-[11px] text-[var(--color-text-secondary)] truncate">
              {latestEntry
                ? `Logged ${toLocalDateString(latestEntry.measured_at)}`
                : 'No weigh-ins yet'}
            </div>
          </CardContent>
        </Card>

        {/* Card 2: Net Weight Change */}
        <Card>
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
                Net Change
              </span>
              <div
                className={`p-1.5 rounded-md ${
                  (displayedNetChange || 0) <= 0
                    ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                    : 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                }`}
              >
                {(displayedNetChange || 0) <= 0 ? (
                  <TrendingDown className="w-4 h-4" />
                ) : (
                  <TrendingUp className="w-4 h-4" />
                )}
              </div>
            </div>
            <div className="mt-2.5 flex items-baseline gap-1.5">
              <span
                className={`text-2xl font-bold font-mono ${
                  displayedNetChange === null
                    ? 'text-[var(--color-text-primary)]'
                    : displayedNetChange <= 0
                    ? 'text-[var(--color-accent)]'
                    : 'text-amber-600 dark:text-amber-400'
                }`}
              >
                {displayedNetChange !== null
                  ? `${displayedNetChange > 0 ? '+' : ''}${displayedNetChange.toFixed(1)}`
                  : '—'}
              </span>
              <span className="text-xs text-[var(--color-text-muted)] font-medium">{weightUnit}</span>
            </div>
            <div className="mt-2 text-[11px] text-[var(--color-text-secondary)] truncate">
              From {baselineWeightKg !== null ? `${kgToDisplay(baselineWeightKg).toFixed(1)} ${weightUnit}` : 'start'}
            </div>
          </CardContent>
        </Card>

        {/* Card 3: Weekly Rate */}
        <Card>
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
                Weekly Velocity
              </span>
              <div className="p-1.5 rounded-md bg-[var(--color-surface-hover)] text-[var(--color-text-secondary)]">
                <Activity className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2.5 flex items-baseline gap-1.5">
              <span className="text-2xl font-bold text-[var(--color-text-primary)] font-mono">
                {displayedWeeklyRate !== null
                  ? `${displayedWeeklyRate > 0 ? '+' : ''}${displayedWeeklyRate.toFixed(2)}`
                  : '—'}
              </span>
              <span className="text-xs text-[var(--color-text-muted)] font-medium">{weightUnit} / wk</span>
            </div>
            <div className="mt-2 text-[11px] text-[var(--color-text-secondary)] truncate">
              {displayedWeeklyRate !== null ? '30-day moving pace' : 'Requires ≥2 logs'}
            </div>
          </CardContent>
        </Card>

        {/* Card 4: BMI Category */}
        <Card>
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
                Body Mass Index
              </span>
              <Badge variant={bmiCategory.badgeVariant} className="text-[10px] px-1.5 py-0.5">
                {bmiCategory.label}
              </Badge>
            </div>
            <div className="mt-2.5 flex items-baseline gap-1.5">
              <span className="text-2xl font-bold text-[var(--color-text-primary)] font-mono">
                {bmi !== null ? bmi.toFixed(1) : '—'}
              </span>
              <span className="text-xs text-[var(--color-text-muted)] font-medium">BMI</span>
            </div>
            <div className="mt-2 text-[11px] text-[var(--color-text-secondary)] truncate">
              {heightCm ? `Height: ${formatHeight(heightCm)}` : 'Height not set'}
            </div>
          </CardContent>
        </Card>

        {/* Card 5: Goal Progress */}
        <Card>
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
                Goal Distance
              </span>
              <div className="p-1.5 rounded-md bg-[var(--color-surface-hover)] text-[var(--color-text-secondary)]">
                <Target className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2.5 flex items-baseline gap-1.5">
              <span className="text-2xl font-bold text-[var(--color-text-primary)] font-mono">
                {progressPercentage !== null ? `${progressPercentage}%` : '—'}
              </span>
              <span className="text-xs text-[var(--color-text-muted)] font-medium">
                {goalWeightKg ? `of ${kgToDisplay(goalWeightKg).toFixed(1)} ${weightUnit}` : 'target'}
              </span>
            </div>
            <div className="mt-2 w-full bg-[var(--color-surface-hover)] h-1.5 rounded-full overflow-hidden">
              <div
                className="bg-[var(--color-accent)] h-full rounded-full transition-all duration-300"
                style={{ width: `${progressPercentage || 0}%` }}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 2. WEIGHT TREND CHART CARD */}
      <Card>
        <CardHeader className="pb-3 border-b border-[var(--color-border-subtle)]">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <span>Weight Trendline & 7-Day Moving Average</span>
              </CardTitle>
              <CardDescription className="text-xs">
                Raw weigh-ins (dashed) overlaid with a 7-day smoothed trend (solid) to remove water variance.
              </CardDescription>
            </div>

            {/* Timeframe Selector Pills */}
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
        </CardHeader>

        <CardContent className="pt-4">
          {isLoadingWeightEntries ? (
            <div className="h-64 flex flex-col items-center justify-center text-center space-y-2">
              <Loader2 className="w-7 h-7 animate-spin text-[var(--color-accent)]" />
              <p className="text-xs text-[var(--color-text-muted)]">Loading historical weigh-ins...</p>
            </div>
          ) : (
            <TrendLineChart
              series={chartSeries}
              targetLine={chartTargetLine}
              height={270}
              yAxisFormatter={(val) => `${val.toFixed(1)} ${weightUnit}`}
              tooltipDateFormatter={(d) => d}
              emptyMessage="No weigh-ins recorded in this timeframe."
            />
          )}
        </CardContent>
      </Card>

      {/* 3. GOAL PROJECTION & PROGRESS INSIGHTS GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Goal Projection Card */}
        <Card className="flex flex-col justify-between">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Target className="w-4 h-4 text-[var(--color-accent)]" />
                <span>Goal Projection & Trajectory</span>
              </CardTitle>
              {trajectoryBadge && (
                <Badge variant={trajectoryBadge.variant} className="flex items-center gap-1 text-[11px]">
                  <trajectoryBadge.icon className="w-3 h-3" />
                  {trajectoryBadge.label}
                </Badge>
              )}
            </div>
            <CardDescription className="text-xs">
              Algorithmic forecast extrapolated strictly from your trailing 30-day weight velocity.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4 pt-1">
            {projectedDate ? (
              <div className="p-4 rounded-xl bg-[var(--color-surface-hover)] border border-[var(--color-border)] space-y-3">
                <div className="flex items-baseline justify-between">
                  <span className="text-xs text-[var(--color-text-secondary)]">Projected Completion:</span>
                  <span className="text-lg font-bold text-[var(--color-accent)] font-mono">
                    {projectedDate}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-[var(--color-border-subtle)]">
                  <div>
                    <span className="text-[var(--color-text-muted)] block text-[10px] uppercase font-semibold">
                      Target Weight
                    </span>
                    <span className="font-bold text-[var(--color-text-primary)] font-mono">
                      {goalWeightKg !== null ? `${kgToDisplay(goalWeightKg).toFixed(1)} ${weightUnit}` : '—'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[var(--color-text-muted)] block text-[10px] uppercase font-semibold">
                      Estimated Rate
                    </span>
                    <span className="font-bold text-[var(--color-text-primary)] font-mono">
                      {displayedWeeklyRate !== null ? `${displayedWeeklyRate.toFixed(2)} ${weightUnit}/wk` : '—'}
                    </span>
                  </div>
                </div>

                {targetDateIso && (
                  <div className="text-[11px] text-[var(--color-text-secondary)] flex items-center gap-1.5 pt-1">
                    <Calendar className="w-3.5 h-3.5 text-[var(--color-text-muted)]" />
                    <span>Athlete Target: {targetDateIso}</span>
                  </div>
                )}
              </div>
            ) : (
              <div className="p-5 rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-surface-hover)]/40 text-center space-y-2">
                <div className="w-9 h-9 rounded-full bg-[var(--color-surface)] border border-[var(--color-border)] flex items-center justify-center mx-auto text-[var(--color-text-muted)]">
                  <Info className="w-4 h-4" />
                </div>
                <h5 className="text-xs font-semibold text-[var(--color-text-primary)]">
                  {sortedEntries.length < 2
                    ? 'Insufficient Historical Data'
                    : 'Trajectory Unprojectable'}
                </h5>
                <p className="text-[11px] text-[var(--color-text-secondary)] max-w-xs mx-auto leading-relaxed">
                  {sortedEntries.length < 2
                    ? 'Log scale weight on at least 2 separate calendar days to establish a measurable rate of change.'
                    : 'Your 30-day rate is flat (±0.02 kg/wk) or moving away from your goal weight. Projections resume once direction aligns.'}
                </p>
              </div>
            )}

            <div className="text-[10px] text-[var(--color-text-muted)] flex items-start gap-1.5">
              <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <span>
                Estimates assume caloric adherence remains consistent with your current 30-day velocity.
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Right: Progress Insights Card */}
        <Card className="flex flex-col justify-between">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[var(--color-accent)]" />
              <span>Progress Intelligence & Insights</span>
            </CardTitle>
            <CardDescription className="text-xs">
              Automated heuristics derived from your empirical weigh-in data.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-3 pt-1">
            {progressInsights.map((insight, idx) => (
              <div
                key={idx}
                className={`p-3 rounded-lg border text-xs space-y-1 ${
                  insight.type === 'success'
                    ? 'bg-emerald-500/5 border-emerald-500/20 text-emerald-900 dark:text-emerald-100'
                    : insight.type === 'warning'
                    ? 'bg-amber-500/5 border-amber-500/20 text-amber-900 dark:text-amber-100'
                    : 'bg-[var(--color-surface-hover)] border-[var(--color-border)] text-[var(--color-text-primary)]'
                }`}
              >
                <div className="font-semibold flex items-center gap-1.5">
                  {insight.type === 'success' && <CheckCircle2 className="w-3.5 h-3.5 text-[var(--color-accent)] shrink-0" />}
                  {insight.type === 'warning' && <AlertCircle className="w-3.5 h-3.5 text-amber-500 shrink-0" />}
                  {insight.type === 'info' && <Info className="w-3.5 h-3.5 text-[var(--color-text-muted)] shrink-0" />}
                  <span>{insight.title}</span>
                </div>
                <p className="text-[11px] leading-relaxed text-[var(--color-text-secondary)]">
                  {insight.desc}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* QUICK WEIGH-IN MODAL */}
      {isWeighInOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150"
          onClick={(e) => {
            if (e.target === e.currentTarget && !weighInWeight.trim()) {
              setIsWeighInOpen(false)
            }
          }}
        >
          <div
            className="w-full max-w-sm rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-2xl p-6 space-y-4 animate-in zoom-in-95 duration-150"
            role="dialog"
            aria-modal="true"
            aria-labelledby="weigh-in-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[var(--color-border-subtle)] pb-3">
              <h3 id="weigh-in-title" className="text-base font-bold text-[var(--color-text-primary)] flex items-center gap-2">
                <Scale className="w-4 h-4 text-[var(--color-accent)]" />
                <span>Record Scale Weigh-In</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsWeighInOpen(false)}
                className="w-11 h-11 flex items-center justify-center rounded-xl text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-hover)] transition-colors cursor-pointer"
                aria-label="Close weigh-in dialog"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {weighInSuccess ? (
              <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-center space-y-1.5">
                <CheckCircle2 className="w-8 h-8 mx-auto" />
                <p className="text-xs font-bold">Weigh-In Saved Successfully!</p>
                <p className="text-[11px] opacity-80">Updating trendlines and moving averages...</p>
              </div>
            ) : (
              <form onSubmit={handleWeighInSubmit} className="space-y-4">
                {weighInError && (
                  <div className="p-2.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-500 text-xs">
                    {weighInError}
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-[var(--color-text-secondary)] mb-1">
                    Body Weight ({weightUnit})
                  </label>
                  <Input
                    type="number"
                    step="0.1"
                    min={minWeight}
                    max={maxWeight}
                    placeholder={unitSystem === 'metric' ? 'e.g. 78.5' : 'e.g. 173.0'}
                    value={weighInWeight}
                    onChange={(e) => setWeighInWeight(e.target.value)}
                    required
                    autoFocus
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[var(--color-text-secondary)] mb-1">
                    Measurement Date
                  </label>
                  <Input
                    type="date"
                    value={weighInDate}
                    onChange={(e) => setWeighInDate(e.target.value)}
                    required
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsWeighInOpen(false)}
                    disabled={isSubmitting}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    variant="primary"
                    size="sm"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? 'Saving...' : 'Save Weigh-In'}
                  </Button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
