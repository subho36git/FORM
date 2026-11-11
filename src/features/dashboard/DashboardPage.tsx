import React from 'react'
import { Link } from 'react-router-dom'
import {
  Flame,
  Dumbbell,
  Scale,
  ArrowUpRight,
  ShieldCheck,
  Calendar,
  Wheat,
  Droplet,
  Target,
  Clock,
  Sliders,
} from 'lucide-react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { useAuth } from '@/features/auth'
import { useGoals } from '@/features/goals'
import { useUnit } from '@/hooks/useUnit'

const goalLabels: Record<string, string> = {
  fat_loss: 'Fat Loss Protocol',
  muscle_gain: 'Hypertrophy Protocol',
  maintenance: 'Maintenance Protocol',
}

const activityLabels: Record<string, string> = {
  sedentary: 'Sedentary (1.20×)',
  lightly_active: 'Lightly Active (1.375×)',
  moderately_active: 'Moderately Active (1.55×)',
  very_active: 'Very Active (1.725×)',
}

export const DashboardPage: React.FC = () => {
  const { profile, user } = useAuth()
  const { goals, projectedResult } = useGoals()
  const { formatWeight, formatHeight, weightUnit, kgToDisplay } = useUnit()

  // Authenticated athlete profile details with sensible fallbacks
  const athleteName =
    profile?.display_name ||
    (user?.user_metadata?.display_name as string) ||
    (user?.email ? user.email.split('@')[0] : 'Athlete')

  const calorieTarget = goals.dailyCalories ?? profile?.daily_calorie_target ?? null
  const proteinTarget = goals.proteinG ?? profile?.protein_target_g ?? null
  const carbsTarget = goals.carbsG ?? profile?.carbs_target_g ?? null
  const fatTarget = goals.fatG ?? profile?.fat_target_g ?? null
  const currentWeight = goals.currentWeightKg ?? profile?.current_weight_kg ?? null
  const goalWeight = goals.goalWeightKg ?? profile?.goal_weight_kg ?? null
  const targetDate = goals.targetDateIso || profile?.target_completion_date || null
  const fitnessGoal = profile?.fitness_goal ?? null
  const activityLevel = profile?.activity_level ?? null
  const age = profile?.age_years ?? null
  const sex = profile?.sex_for_calorie_formula ?? null
  const height = profile?.height_cm ?? null

  // Weight trajectory status text
  let weightStatusText = 'Target trajectory pending'
  if (currentWeight !== null && goalWeight !== null) {
    const diffKg = Math.abs(currentWeight - goalWeight)
    const diffDisplay = kgToDisplay(diffKg)
    if (diffKg < 0.1) {
      weightStatusText = `At target weight (${formatWeight(goalWeight)})`
    } else {
      weightStatusText = `${diffDisplay} ${weightUnit} to goal weight (${formatWeight(goalWeight)})`
    }
  } else if (currentWeight !== null) {
    weightStatusText = 'Last weighed today'
  }

  const activeGoalLabel = fitnessGoal ? (goalLabels[fitnessGoal] || 'Custom Protocol') : 'Protocol Active'

  return (
    <div className="p-4 sm:p-6 md:p-10 max-w-7xl mx-auto w-full space-y-6 sm:space-y-8 animate-in fade-in duration-200">
      {/* Top Welcome & Quick Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Badge variant="accent">{activeGoalLabel}</Badge>
            <span className="text-xs text-[var(--color-text-muted)] flex items-center gap-1">
              <Calendar className="w-3 h-3" /> Today's Overview
            </span>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-[var(--color-text-primary)]">
            Welcome, {athleteName}
          </h1>
          <p className="text-sm text-[var(--color-text-secondary)] mt-0.5">
            Your personal fitness and nutrition tracking environment.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Link to="/goals">
            <Button variant="secondary" size="md" icon={<Sliders className="w-4 h-4" />}>
              Adjust Targets
            </Button>
          </Link>
          <Link to="/workouts?action=start">
            <Button variant="primary" size="md" icon={<Dumbbell className="w-4 h-4" />}>
              Start Workout
            </Button>
          </Link>
        </div>
      </div>

      {/* Metrics Summary Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1: Calories */}
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
                Daily Calories
              </span>
              <div className="p-2 rounded-lg bg-[var(--color-accent-subtle)] text-[var(--color-accent-text)]">
                <Flame className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-2xl font-bold text-[var(--color-text-primary)]">
                {calorieTarget !== null ? calorieTarget.toLocaleString() : '—'}
              </span>
              <span className="text-xs text-[var(--color-text-muted)]">
                {calorieTarget !== null ? 'kcal / day' : 'kcal target'}
              </span>
            </div>
            <div className="mt-3 w-full bg-[var(--color-surface-hover)] h-1.5 rounded-full overflow-hidden">
              <div
                className="bg-[var(--color-accent)] h-full rounded-full transition-all"
                style={{ width: calorieTarget ? '100%' : '0%' }}
              />
            </div>
            <div className="mt-2 flex justify-between text-[11px] text-[var(--color-text-secondary)]">
              <span>
                {carbsTarget !== null && fatTarget !== null
                  ? `${carbsTarget}g Carbs • ${fatTarget}g Fat`
                  : 'Target budget'}
              </span>
              <span className="text-[var(--color-accent)] font-medium">
                {calorieTarget !== null ? 'Calibrated' : 'Set target'}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Metric 2: Protein Target */}
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
                Protein Intake
              </span>
              <div className="p-2 rounded-lg bg-[var(--color-accent-secondary-subtle)] text-[var(--color-accent-secondary-text)]">
                <ShieldCheck className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-2xl font-bold text-[var(--color-text-primary)]">
                {proteinTarget !== null ? `${proteinTarget}` : '—'}
              </span>
              <span className="text-xs text-[var(--color-text-muted)]">
                {proteinTarget !== null ? `g (${proteinTarget * 4} kcal)` : 'g target'}
              </span>
            </div>
            <div className="mt-3 w-full bg-[var(--color-surface-hover)] h-1.5 rounded-full overflow-hidden">
              <div
                className="bg-[var(--color-accent-secondary)] h-full rounded-full transition-all"
                style={{ width: proteinTarget ? '100%' : '0%' }}
              />
            </div>
            <div className="mt-2 flex justify-between text-[11px] text-[var(--color-text-secondary)]">
              <span>
                {calorieTarget && proteinTarget
                  ? `${Math.round(((proteinTarget * 4) / calorieTarget) * 100)}% of daily calories`
                  : 'Protein budget'}
              </span>
              <span className="text-[var(--color-accent-secondary-text)] font-medium">
                {proteinTarget !== null ? `${proteinTarget}g goal` : '—'}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Metric 3: Workout Consistency */}
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
                Workout Consistency
              </span>
              <div className="p-2 rounded-lg bg-[var(--color-accent-subtle)] text-[var(--color-accent-text)]">
                <Dumbbell className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-2xl font-bold text-[var(--color-text-primary)]">
                3
              </span>
              <span className="text-xs text-[var(--color-text-muted)]">/ 4 sessions</span>
            </div>
            <div className="mt-3 flex gap-1.5">
              {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((day, idx) => (
                <div
                  key={idx}
                  className={`flex-1 h-1.5 rounded-full ${
                    idx < 3 ? 'bg-[var(--color-accent)]' : 'bg-[var(--color-surface-hover)]'
                  }`}
                  title={`${day}: ${idx < 3 ? 'Completed' : 'Pending'}`}
                />
              ))}
            </div>
            <div className="mt-2 flex justify-between text-[11px] text-[var(--color-text-secondary)]">
              <span>On track this week</span>
              <span className="text-[var(--color-accent)] font-medium">75%</span>
            </div>
          </CardContent>
        </Card>

        {/* Metric 4: Bodyweight & Goal */}
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
                Current Weight
              </span>
              <div className="p-2 rounded-lg bg-[var(--color-lavender-surface)] text-[var(--color-lavender-text)]">
                <Scale className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-2xl font-bold text-[var(--color-text-primary)]">
                {currentWeight !== null ? kgToDisplay(currentWeight) : '—'}
              </span>
              <span className="text-xs text-[var(--color-text-muted)]">{weightUnit}</span>
            </div>
            <div className="mt-3 flex items-center gap-1.5 text-xs text-[var(--color-accent)] font-medium">
              <ArrowUpRight className="w-3.5 h-3.5" />
              <span>{weightStatusText}</span>
            </div>
            <div className="mt-2 text-[11px] text-[var(--color-text-secondary)] flex justify-between">
              <span>Goal: {goalWeight !== null ? formatWeight(goalWeight) : 'Not set'}</span>
              {height !== null && <span>Height: {formatHeight(height)}</span>}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Grid: Nutrition Protocol & Target Dates */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column (2 spans): Active Nutrition & Macro Protocol */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Active Nutrition & Target Protocol</CardTitle>
                  <CardDescription>
                    Precision targets derived from the Mifflin-St Jeor formula and interconnected goal calculations.
                  </CardDescription>
                </div>
                <Link to="/goals">
                  <Button variant="outline" size="sm" icon={<Target className="w-3.5 h-3.5" />}>
                    Manage Goals
                  </Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent className="p-5 space-y-5">
              {/* Four Nutrition Targets Breakdown */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                {/* 1. Daily Calories */}
                <div className="p-3.5 rounded-xl bg-[var(--color-surface-subtle)] border border-[var(--color-border)]">
                  <div className="flex items-center justify-between text-xs text-[var(--color-text-muted)] font-semibold uppercase">
                    <span>Calories</span>
                    <Flame className="w-3.5 h-3.5 text-[var(--color-accent)]" />
                  </div>
                  <div className="mt-2 text-xl font-bold text-[var(--color-text-primary)]">
                    {calorieTarget !== null ? calorieTarget.toLocaleString() : '—'}
                  </div>
                  <p className="text-[11px] text-[var(--color-text-secondary)] mt-0.5">
                    kcal / day
                  </p>
                </div>

                {/* 2. Protein Target */}
                <div className="p-3.5 rounded-xl bg-[var(--color-surface-subtle)] border border-[var(--color-border)]">
                  <div className="flex items-center justify-between text-xs text-[var(--color-text-muted)] font-semibold uppercase">
                    <span>Protein</span>
                    <ShieldCheck className="w-3.5 h-3.5 text-[var(--color-accent)]" />
                  </div>
                  <div className="mt-2 text-xl font-bold text-[var(--color-text-primary)]">
                    {proteinTarget !== null ? `${proteinTarget}g` : '—'}
                  </div>
                  <p className="text-[11px] text-[var(--color-text-secondary)] mt-0.5">
                    {proteinTarget !== null ? `${proteinTarget * 4} kcal` : 'target'}
                  </p>
                </div>

                {/* 3. Carbohydrates Target */}
                <div className="p-3.5 rounded-xl bg-[var(--color-surface-subtle)] border border-[var(--color-border)]">
                  <div className="flex items-center justify-between text-xs text-[var(--color-text-muted)] font-semibold uppercase">
                    <span>Carbs</span>
                    <Wheat className="w-3.5 h-3.5 text-[var(--color-accent-secondary)]" />
                  </div>
                  <div className="mt-2 text-xl font-bold text-[var(--color-text-primary)]">
                    {carbsTarget !== null ? `${carbsTarget}g` : '—'}
                  </div>
                  <p className="text-[11px] text-[var(--color-text-secondary)] mt-0.5">
                    {carbsTarget !== null ? `${carbsTarget * 4} kcal` : 'target'}
                  </p>
                </div>

                {/* 4. Dietary Fats Target */}
                <div className="p-3.5 rounded-xl bg-[var(--color-surface-subtle)] border border-[var(--color-border)]">
                  <div className="flex items-center justify-between text-xs text-[var(--color-text-muted)] font-semibold uppercase">
                    <span>Fat</span>
                    <Droplet className="w-3.5 h-3.5 text-[var(--color-lavender)]" />
                  </div>
                  <div className="mt-2 text-xl font-bold text-[var(--color-text-primary)]">
                    {fatTarget !== null ? `${fatTarget}g` : '—'}
                  </div>
                  <p className="text-[11px] text-[var(--color-text-secondary)] mt-0.5">
                    {fatTarget !== null ? `${fatTarget * 9} kcal` : 'target'}
                  </p>
                </div>
              </div>

              {/* Target Date vs. Projected Date Summary Banner */}
              <div className="p-4 rounded-xl bg-[var(--color-surface-subtle)] border border-[var(--color-border)] grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <span className="text-[10px] uppercase font-bold text-[var(--color-text-muted)] flex items-center gap-1">
                    <Calendar className="w-3 h-3 text-[var(--color-accent)]" />
                    Target Date (Your Chosen Goal)
                  </span>
                  <div className="text-sm font-bold text-[var(--color-text-primary)] mt-1">
                    {targetDate || 'Not specified'}
                  </div>
                  <span className="text-[10px] text-[var(--color-text-muted)]">
                    Fixed milestone chosen by athlete
                  </span>
                </div>

                <div>
                  <span className="text-[10px] uppercase font-bold text-[var(--color-accent)] flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    Projected Date (Theoretical Estimate)
                  </span>
                  <div className="text-sm font-bold text-[var(--color-text-primary)] mt-1">
                    {projectedResult.projectedDate || 'Calculation pending'}
                  </div>
                  <span className="text-[10px] text-[var(--color-text-muted)]">
                    {projectedResult.projectedDays !== null
                      ? `~${projectedResult.projectedDays} days remaining at current calorie budget`
                      : projectedResult.message || 'Calculated from energy delta'}
                  </span>
                </div>
              </div>

              {/* Baseline Athlete Profile Summary */}
              <div className="p-3 rounded-xl bg-[var(--color-surface-subtle)] border border-[var(--color-border)] text-xs text-[var(--color-text-secondary)] flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-1.5">
                  <Target className="w-4 h-4 text-[var(--color-accent)] shrink-0" />
                  <span>
                    Objective: <strong className="text-[var(--color-text-primary)] capitalize">{fitnessGoal ? fitnessGoal.replace('_', ' ') : 'Not set'}</strong>
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span>
                    Activity: <strong className="text-[var(--color-text-primary)]">{activityLevel ? (activityLabels[activityLevel] || activityLevel) : 'Moderate (1.55×)'}</strong>
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span>
                    Biometrics: <strong className="text-[var(--color-text-primary)] capitalize">{sex || '—'}, {age !== null ? `${age}y` : '—'}, {height !== null ? formatHeight(height) : '—'}</strong>
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column (1 span): Upcoming Routine Preview */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Next Workout</CardTitle>
              <CardDescription>Scheduled for today</CardDescription>
            </CardHeader>
            <CardContent className="p-5 space-y-4">
              <div className="p-4 rounded-lg bg-[var(--color-surface-subtle)] border border-[var(--color-border)] space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-[var(--color-text-primary)]">
                    Upper Body A (Hypertrophy)
                  </span>
                  <Badge variant="outline">45 min</Badge>
                </div>
                <p className="text-xs text-[var(--color-text-secondary)]">
                  Barbell Bench Press, Incline Dumbbell Press, Lat Pulldown, Cable Lateral Raise.
                </p>
              </div>

              <Link to="/workouts" className="block w-full">
                <Button variant="primary" className="w-full">
                  Preview Routine
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
