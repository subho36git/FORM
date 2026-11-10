import React from 'react'
import { ArrowLeft, ArrowRight, Target, Dumbbell, Flame, Scale, Check } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import type { FitnessGoal } from '@/types'
import { cn } from '@/lib/utils'

interface StepGoalProps {
  goal: FitnessGoal
  onChangeGoal: (goal: FitnessGoal) => void
  onNext: () => void
  onBack: () => void
}

interface GoalOption {
  value: FitnessGoal
  title: string
  subtitle: string
  calorieAdjustmentLabel: string
  icon: React.ComponentType<{ className?: string }>
}

const goalOptions: GoalOption[] = [
  {
    value: 'muscle_gain',
    title: 'Muscle Gain',
    subtitle: 'Hypertrophy & progressive overload with a targeted caloric surplus to build lean mass.',
    calorieAdjustmentLabel: '+300 kcal surplus • 2.0 g/kg protein',
    icon: Dumbbell,
  },
  {
    value: 'fat_loss',
    title: 'Fat Loss',
    subtitle: 'Preserve lean athletic muscle while creating a structured, sustainable caloric deficit.',
    calorieAdjustmentLabel: '-500 kcal deficit • 2.2 g/kg protein',
    icon: Flame,
  },
  {
    value: 'maintenance',
    title: 'Maintenance',
    subtitle: 'Sustain current body composition, optimize athletic recovery, and maintain peak energy.',
    calorieAdjustmentLabel: 'Energy balance (0 kcal) • 1.8 g/kg protein',
    icon: Scale,
  },
]

export const StepGoal: React.FC<StepGoalProps> = ({
  goal,
  onChangeGoal,
  onNext,
  onBack,
}) => {
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onNext()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 animate-in fade-in duration-200">
      <div className="space-y-2 text-center sm:text-left">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[var(--color-accent-subtle)] text-[var(--color-accent)] text-xs font-semibold">
          <Target className="w-3.5 h-3.5" />
          <span>Step 3 • Target Objective</span>
        </div>
        <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[var(--color-text-primary)]">
          Select your primary fitness goal
        </h2>
        <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed">
          Your goal determines how we adjust your daily calories relative to your baseline Total Daily Energy Expenditure (TDEE).
        </p>
      </div>

      <div className="space-y-3">
        {goalOptions.map((opt) => {
          const Icon = opt.icon
          const isSelected = goal === opt.value

          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChangeGoal(opt.value)}
              className={cn(
                'w-full p-4 rounded-xl border text-left transition-all cursor-pointer flex items-start gap-4',
                isSelected
                  ? 'border-[var(--color-accent)] bg-[var(--color-accent-subtle)] ring-1 ring-[var(--color-accent)] shadow-xs'
                  : 'border-[var(--color-border)] bg-[var(--color-surface)] hover:bg-[var(--color-surface-hover)]'
              )}
            >
              <div
                className={cn(
                  'w-10 h-10 rounded-lg flex items-center justify-center shrink-0 transition-colors',
                  isSelected
                    ? 'bg-[var(--color-accent)] text-white shadow-xs'
                    : 'bg-[var(--color-surface-hover)] text-[var(--color-text-secondary)] border border-[var(--color-border)]'
                )}
              >
                <Icon className="w-5 h-5" />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-bold text-sm sm:text-base text-[var(--color-text-primary)]">
                    {opt.title}
                  </h3>
                  {isSelected && (
                    <div className="w-5 h-5 rounded-full bg-[var(--color-accent)] text-white flex items-center justify-center shrink-0">
                      <Check className="w-3 h-3 stroke-[3]" />
                    </div>
                  )}
                </div>
                <p className="text-xs text-[var(--color-text-secondary)] mt-0.5 leading-relaxed">
                  {opt.subtitle}
                </p>
                <span className="inline-block mt-2 text-[11px] font-semibold text-[var(--color-accent)]">
                  {opt.calorieAdjustmentLabel}
                </span>
              </div>
            </button>
          )
        })}
      </div>

      <div className="flex items-center justify-between pt-4 border-t border-[var(--color-border)]">
        <Button
          type="button"
          variant="outline"
          size="md"
          onClick={onBack}
          icon={<ArrowLeft className="w-4 h-4" />}
        >
          Back
        </Button>

        <Button
          type="submit"
          variant="primary"
          size="md"
          className="font-semibold px-5"
          icon={<ArrowRight className="w-4 h-4" />}
        >
          Next: Activity Level
        </Button>
      </div>
    </form>
  )
}
