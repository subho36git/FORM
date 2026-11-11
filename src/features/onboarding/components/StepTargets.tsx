import React from 'react'
import {
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  Flame,
  ShieldCheck,
  Wheat,
  Droplet,
  Info,
  Loader2,
  Edit3,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import type { NutritionTargets } from '@/utils/nutritionCalculations'
import type { FitnessGoal, ActivityLevel, CalorieSex } from '@/types'

interface StepTargetsProps {
  targets: NutritionTargets
  inputs: {
    displayName: string
    age: string
    sex: CalorieSex
    height: string
    currentWeight: string
    goalWeight: string
    goal: FitnessGoal
    activityLevel: ActivityLevel
  }
  onEditStep: (step: number) => void
  onBack: () => void
  onConfirm: () => void
  isSubmitting: boolean
  error: string | null
  isSuccess: boolean
}

const goalLabels: Record<FitnessGoal, string> = {
  muscle_gain: 'Muscle Gain (+300 kcal)',
  fat_loss: 'Fat Loss (-500 kcal)',
  maintenance: 'Maintenance (0 kcal)',
}

const activityLabels: Record<ActivityLevel, string> = {
  sedentary: 'Sedentary (1.20×)',
  lightly_active: 'Lightly Active (1.375×)',
  moderately_active: 'Moderately Active (1.55×)',
  very_active: 'Very Active (1.725×)',
}

export const StepTargets: React.FC<StepTargetsProps> = ({
  targets,
  inputs,
  onEditStep,
  onBack,
  onConfirm,
  isSubmitting,
  error,
  isSuccess,
}) => {
  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      <div className="space-y-2 text-center sm:text-left">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[var(--color-accent-subtle)] text-[var(--color-accent)] text-xs font-semibold">
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>Step 5 • Calibrated Targets</span>
        </div>
        <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[var(--color-text-primary)]">
          Your precision nutrition targets
        </h2>
        <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed">
          Formulated via the Mifflin-St Jeor equation and evidence-based macronutrient standards. Review your
          targets and confirm to finalize your profile.
        </p>
      </div>

      {/* General Error Banner */}
      {error && (
        <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-xs flex items-start gap-2.5">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <div className="flex-1 font-medium">{error}</div>
        </div>
      )}

      {/* Success Banner */}
      {isSuccess && (
        <div className="p-4 rounded-xl bg-[var(--color-accent-subtle)] border border-[var(--color-accent)]/20 text-[var(--color-accent-text)] text-xs flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 shrink-0" />
          <div className="font-semibold text-sm">
            Profile saved successfully! Directing you to your dashboard...
          </div>
        </div>
      )}

      {/* Primary Target: Daily Calories Card */}
      <div className="p-6 rounded-2xl bg-gradient-to-br from-[var(--color-surface)] to-[var(--color-surface-hover)] border-2 border-[var(--color-accent)] shadow-md space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-[var(--color-accent)] text-white">
                <Flame className="w-4 h-4 fill-current" />
              </span>
              <span className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted)]">
                Daily Energy Intake
              </span>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-3xl sm:text-4xl font-black text-[var(--color-text-primary)]">
                {targets.dailyCalorieTarget.toLocaleString()}
              </span>
              <span className="text-sm sm:text-base font-semibold text-[var(--color-text-muted)]">
                kcal / day
              </span>
            </div>
          </div>

          <div className="flex flex-wrap sm:flex-col sm:items-end gap-1.5 text-xs text-[var(--color-text-secondary)]">
            <span className="px-2.5 py-1 rounded-md bg-[var(--color-surface)] border border-[var(--color-border)]">
              BMR: <strong className="text-[var(--color-text-primary)]">{targets.bmr}</strong> kcal
            </span>
            <span className="px-2.5 py-1 rounded-md bg-[var(--color-surface)] border border-[var(--color-border)]">
              TDEE: <strong className="text-[var(--color-text-primary)]">{targets.tdee}</strong> kcal
            </span>
            <span className="px-2.5 py-1 rounded-md bg-[var(--color-accent-subtle)] text-[var(--color-accent)] font-semibold">
              Adjustment: {targets.calorieAdjustment >= 0 ? `+${targets.calorieAdjustment}` : targets.calorieAdjustment} kcal
            </span>
          </div>
        </div>
      </div>

      {/* Macronutrient Distribution Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
        {/* Protein Target */}
        <div className="p-4 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] flex flex-col justify-between space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-[var(--color-accent-subtle)] text-[var(--color-accent-text)] flex items-center justify-center">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <span className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-primary)]">
                Protein
              </span>
            </div>
            <span className="text-[11px] font-semibold text-[var(--color-text-muted)]">
              {Math.round((targets.proteinKcal / targets.dailyCalorieTarget) * 100)}%
            </span>
          </div>
          <div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-black text-[var(--color-text-primary)]">
                {targets.proteinG}
              </span>
              <span className="text-xs text-[var(--color-text-muted)] font-semibold">grams</span>
            </div>
            <p className="text-[11px] text-[var(--color-text-secondary)] mt-1">
              {targets.proteinKcal} kcal • Lean muscle retention
            </p>
          </div>
        </div>

        {/* Carbohydrates Target */}
        <div className="p-4 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] flex flex-col justify-between space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-[var(--color-accent-secondary-subtle)] text-[var(--color-accent-secondary-text)] flex items-center justify-center">
                <Wheat className="w-4 h-4" />
              </div>
              <span className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-primary)]">
                Carbs
              </span>
            </div>
            <span className="text-[11px] font-semibold text-[var(--color-text-muted)]">
              {Math.round((targets.carbsKcal / targets.dailyCalorieTarget) * 100)}%
            </span>
          </div>
          <div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-black text-[var(--color-text-primary)]">
                {targets.carbsG}
              </span>
              <span className="text-xs text-[var(--color-text-muted)] font-semibold">grams</span>
            </div>
            <p className="text-[11px] text-[var(--color-text-secondary)] mt-1">
              {targets.carbsKcal} kcal • Glycogen & performance
            </p>
          </div>
        </div>

        {/* Dietary Fat Target */}
        <div className="p-4 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] flex flex-col justify-between space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-[var(--color-lavender-surface)] text-[var(--color-lavender-text)] flex items-center justify-center">
                <Droplet className="w-4 h-4" />
              </div>
              <span className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-primary)]">
                Fat
              </span>
            </div>
            <span className="text-[11px] font-semibold text-[var(--color-text-muted)]">
              {Math.round((targets.fatKcal / targets.dailyCalorieTarget) * 100)}%
            </span>
          </div>
          <div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-black text-[var(--color-text-primary)]">
                {targets.fatG}
              </span>
              <span className="text-xs text-[var(--color-text-muted)] font-semibold">grams</span>
            </div>
            <p className="text-[11px] text-[var(--color-text-secondary)] mt-1">
              {targets.fatKcal} kcal • Hormonal & cellular health
            </p>
          </div>
        </div>
      </div>

      {/* Input Summary Review Card */}
      <div className="p-4 rounded-xl bg-[var(--color-surface-subtle)] border border-[var(--color-border)] space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-secondary)]">
            Input Parameters Review
          </span>
          <button
            type="button"
            onClick={() => onEditStep(2)}
            className="text-xs text-[var(--color-accent)] font-semibold hover:underline flex items-center gap-1 cursor-pointer"
          >
            <Edit3 className="w-3 h-3" />
            <span>Edit stats</span>
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
          <div className="p-2 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)]">
            <span className="block text-[10px] text-[var(--color-text-muted)] uppercase">Athlete</span>
            <span className="font-semibold text-[var(--color-text-primary)] truncate block">
              {inputs.displayName || 'Athlete'}
            </span>
          </div>
          <div className="p-2 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)]">
            <span className="block text-[10px] text-[var(--color-text-muted)] uppercase">Bio Metrics</span>
            <span className="font-semibold text-[var(--color-text-primary)] capitalize">
              {inputs.sex}, {inputs.age}y
            </span>
          </div>
          <div className="p-2 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)]">
            <span className="block text-[10px] text-[var(--color-text-muted)] uppercase">Weight Trajectory</span>
            <span className="font-semibold text-[var(--color-text-primary)]">
              {inputs.currentWeight}kg &rarr; {inputs.goalWeight}kg
            </span>
          </div>
          <div className="p-2 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)]">
            <span className="block text-[10px] text-[var(--color-text-muted)] uppercase">Goal & Activity</span>
            <span className="font-semibold text-[var(--color-text-primary)] truncate block">
              {goalLabels[inputs.goal]}
            </span>
          </div>
        </div>

        <div className="text-[11px] text-[var(--color-text-muted)]">
          Activity multiplier: {activityLabels[inputs.activityLevel]}
        </div>
      </div>

      {/* Medical/Nutritional Disclaimer */}
      <div className="p-3.5 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] flex items-start gap-3">
        <Info className="w-4 h-4 text-[var(--color-text-muted)] shrink-0 mt-0.5" />
        <p className="text-[11px] text-[var(--color-text-muted)] leading-relaxed">
          <strong className="text-[var(--color-text-secondary)]">Scientific Estimation Notice:</strong> Daily
          calorie and macronutrient numbers are calculated via the Mifflin-St Jeor formula and standard sports
          nutrition models. These figures represent mathematical estimates for fitness tracking and do not
          constitute medical, diagnostic, or clinical dietary prescriptions. Consult a licensed healthcare provider
          before undertaking major caloric shifts.
        </p>
      </div>

      {/* Navigation Actions */}
      <div className="flex items-center justify-between pt-4 border-t border-[var(--color-border)]">
        <Button
          type="button"
          variant="outline"
          size="md"
          onClick={onBack}
          disabled={isSubmitting || isSuccess}
          icon={<ArrowLeft className="w-4 h-4" />}
        >
          Back to Activity
        </Button>

        <Button
          type="button"
          variant="primary"
          size="lg"
          onClick={onConfirm}
          disabled={isSubmitting || isSuccess}
          className="font-bold px-6 shadow-md cursor-pointer"
          icon={
            isSubmitting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : isSuccess ? (
              <CheckCircle2 className="w-4 h-4" />
            ) : undefined
          }
        >
          {isSubmitting
            ? 'Saving Protocol...'
            : isSuccess
            ? 'Confirmed!'
            : 'Confirm Targets & Launch Dashboard'}
        </Button>
      </div>
    </div>
  )
}
