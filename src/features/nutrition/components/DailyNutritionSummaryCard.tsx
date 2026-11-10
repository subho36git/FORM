import React from 'react'
import { Link } from 'react-router-dom'
import { Flame, ShieldCheck, Wheat, Droplet, Sliders, ArrowUpRight, Leaf, Loader2 } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { useGoals } from '@/features/goals'
import { useNutrition } from '../context/NutritionContext'

export const DailyNutritionSummaryCard: React.FC = () => {
  const { goals } = useGoals()
  const { dailyTotals, isLoading, isDayClosed } = useNutrition()

  const dailyCalories = goals.dailyCalories || 2000
  const targetProtein = goals.proteinG || 150
  const targetCarbs = goals.carbsG || 200
  const targetFat = goals.fatG || 65
  const targetFiber = 30 // Healthy athletic baseline

  const consumedCalories = dailyTotals.calories
  const consumedProtein = dailyTotals.protein_g
  const consumedCarbs = dailyTotals.carbs_g
  const consumedFat = dailyTotals.fat_g
  const consumedFiber = dailyTotals.fiber_g

  const remainingCalories = dailyCalories - consumedCalories
  const isOverCalories = remainingCalories < 0

  const calPercent = Math.min(100, Math.round((consumedCalories / dailyCalories) * 100))
  const proteinPercent = Math.min(100, Math.round((consumedProtein / targetProtein) * 100))
  const carbsPercent = Math.min(100, Math.round((consumedCarbs / targetCarbs) * 100))
  const fatPercent = Math.min(100, Math.round((consumedFat / targetFat) * 100))
  const fiberPercent = Math.min(100, Math.round((consumedFiber / targetFiber) * 100))

  return (
    <Card className="overflow-hidden border-[var(--color-border)] shadow-xs">
      <CardHeader className="flex flex-row items-center justify-between pb-3 bg-[var(--color-surface-hover)]/20">
        <div>
          <div className="flex items-center gap-2">
            <CardTitle className="text-sm font-bold uppercase tracking-wider text-[var(--color-text-secondary)]">
              Daily Nutrition Summary
            </CardTitle>
            <Badge variant="accent" className="text-[10px] py-0 px-1.5">
              Goal Engine Sync
            </Badge>
            {isDayClosed && (
              <Badge variant="outline" className="text-[10px] py-0 px-1.5 text-amber-600 dark:text-amber-400 border-amber-500/30">
                Finalized
              </Badge>
            )}
            {isLoading && <Loader2 className="w-3.5 h-3.5 animate-spin text-[var(--color-text-muted)]" />}
          </div>
          <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
            Calibrated to your active metabolic targets
          </p>
        </div>
        <Link
          to="/goals"
          className="inline-flex items-center gap-1 text-xs font-medium text-[var(--color-accent-text)] hover:underline"
        >
          <Sliders className="w-3.5 h-3.5" />
          <span>Goals</span>
          <ArrowUpRight className="w-3 h-3" />
        </Link>
      </CardHeader>

      <CardContent className="space-y-5 p-5">
        {/* Main Calorie Gauge */}
        <div className="p-4 rounded-xl bg-[var(--color-surface-subtle)] border border-[var(--color-border)]">
          <div className="flex items-start justify-between">
            <div>
              <span className="text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider flex items-center gap-1.5">
                <Flame className="w-4 h-4 text-[var(--color-accent)]" />
                Energy Budget
              </span>
              <div className="mt-1 flex items-baseline gap-1.5">
                <span className="text-3xl font-black text-[var(--color-text-primary)] tracking-tight">
                  {consumedCalories.toLocaleString()}
                </span>
                <span className="text-sm font-medium text-[var(--color-text-muted)]">
                  / {dailyCalories.toLocaleString()} kcal
                </span>
              </div>
            </div>

            <div className="text-right">
              <span className="text-[11px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider block">
                {isOverCalories ? 'Over Target' : 'Remaining'}
              </span>
              <span
                className={`text-lg font-bold block mt-0.5 ${
                  isOverCalories ? 'text-red-500' : 'text-[var(--color-accent-text)]'
                }`}
              >
                {Math.abs(remainingCalories).toLocaleString()} kcal
              </span>
            </div>
          </div>

          {/* Progress bar */}
          <div className="mt-3.5 space-y-1.5">
            <div className="w-full h-2.5 rounded-full bg-[var(--color-surface-hover)] overflow-hidden">
              <div
                className={`h-full transition-all duration-500 rounded-full ${
                  isOverCalories ? 'bg-red-500' : 'bg-[var(--color-accent)]'
                }`}
                style={{ width: `${calPercent}%` }}
              />
            </div>
            <div className="flex justify-between text-[11px] text-[var(--color-text-muted)] font-medium">
              <span>{calPercent}% consumed</span>
              <span>{Math.max(0, 100 - calPercent)}% left</span>
            </div>
          </div>
        </div>

        {/* Macronutrient Triad + Fiber */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {/* Protein */}
          <div className="p-3.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-[var(--color-text-secondary)] flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-blue-500" />
                Protein
              </span>
              <span className="font-bold text-blue-600 dark:text-blue-400 text-xs">
                {proteinPercent}%
              </span>
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-xl font-black text-[var(--color-text-primary)]">
                {consumedProtein}g
              </span>
              <span className="text-xs text-[var(--color-text-muted)]">/ {targetProtein}g</span>
            </div>
            <div className="w-full h-2 rounded-full bg-[var(--color-surface-hover)] overflow-hidden">
              <div
                className="h-full bg-blue-500 rounded-full transition-all duration-500"
                style={{ width: `${proteinPercent}%` }}
              />
            </div>
            <p className="text-[10.5px] text-[var(--color-text-muted)] flex justify-between">
              <span>Left:</span>
              <span className="font-medium text-[var(--color-text-primary)]">
                {Math.max(0, Math.round((targetProtein - consumedProtein) * 10) / 10)}g
              </span>
            </p>
          </div>

          {/* Carbs */}
          <div className="p-3.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-[var(--color-text-secondary)] flex items-center gap-1">
                <Wheat className="w-3.5 h-3.5 text-amber-500" />
                Carbs
              </span>
              <span className="font-bold text-amber-600 dark:text-amber-400 text-xs">
                {carbsPercent}%
              </span>
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-xl font-black text-[var(--color-text-primary)]">
                {consumedCarbs}g
              </span>
              <span className="text-xs text-[var(--color-text-muted)]">/ {targetCarbs}g</span>
            </div>
            <div className="w-full h-2 rounded-full bg-[var(--color-surface-hover)] overflow-hidden">
              <div
                className="h-full bg-amber-500 rounded-full transition-all duration-500"
                style={{ width: `${carbsPercent}%` }}
              />
            </div>
            <p className="text-[10.5px] text-[var(--color-text-muted)] flex justify-between">
              <span>Left:</span>
              <span className="font-medium text-[var(--color-text-primary)]">
                {Math.max(0, Math.round((targetCarbs - consumedCarbs) * 10) / 10)}g
              </span>
            </p>
          </div>

          {/* Fat */}
          <div className="p-3.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-[var(--color-text-secondary)] flex items-center gap-1">
                <Droplet className="w-3.5 h-3.5 text-purple-500" />
                Fats
              </span>
              <span className="font-bold text-purple-600 dark:text-purple-400 text-xs">
                {fatPercent}%
              </span>
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-xl font-black text-[var(--color-text-primary)]">
                {consumedFat}g
              </span>
              <span className="text-xs text-[var(--color-text-muted)]">/ {targetFat}g</span>
            </div>
            <div className="w-full h-2 rounded-full bg-[var(--color-surface-hover)] overflow-hidden">
              <div
                className="h-full bg-purple-500 rounded-full transition-all duration-500"
                style={{ width: `${fatPercent}%` }}
              />
            </div>
            <p className="text-[10.5px] text-[var(--color-text-muted)] flex justify-between">
              <span>Left:</span>
              <span className="font-medium text-[var(--color-text-primary)]">
                {Math.max(0, Math.round((targetFat - consumedFat) * 10) / 10)}g
              </span>
            </p>
          </div>

          {/* Fiber */}
          <div className="p-3.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-[var(--color-text-secondary)] flex items-center gap-1">
                <Leaf className="w-3.5 h-3.5 text-emerald-500" />
                Fiber
              </span>
              <span className="font-bold text-emerald-600 dark:text-emerald-400 text-xs">
                {fiberPercent}%
              </span>
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-xl font-black text-[var(--color-text-primary)]">
                {consumedFiber}g
              </span>
              <span className="text-xs text-[var(--color-text-muted)]">/ {targetFiber}g</span>
            </div>
            <div className="w-full h-2 rounded-full bg-[var(--color-surface-hover)] overflow-hidden">
              <div
                className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                style={{ width: `${fiberPercent}%` }}
              />
            </div>
            <p className="text-[10.5px] text-[var(--color-text-muted)] flex justify-between">
              <span>Left:</span>
              <span className="font-medium text-[var(--color-text-primary)]">
                {Math.max(0, Math.round((targetFiber - consumedFiber) * 10) / 10)}g
              </span>
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
