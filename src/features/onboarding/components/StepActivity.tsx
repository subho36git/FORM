import React from 'react'
import { ArrowLeft, ArrowRight, Zap, Check, Armchair, Footprints, Flame, Trophy } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import type { ActivityLevel } from '@/types'
import { cn } from '@/lib/utils'

interface StepActivityProps {
  activityLevel: ActivityLevel
  onChangeActivityLevel: (level: ActivityLevel) => void
  onNext: () => void
  onBack: () => void
}

interface ActivityOption {
  value: ActivityLevel
  title: string
  multiplierLabel: string
  description: string
  icon: React.ComponentType<{ className?: string }>
}

const activityOptions: ActivityOption[] = [
  {
    value: 'sedentary',
    title: 'Sedentary',
    multiplierLabel: '1.20 × BMR',
    description: 'Desk job or seated work with little to no purposeful physical training or exercise.',
    icon: Armchair,
  },
  {
    value: 'lightly_active',
    title: 'Lightly Active',
    multiplierLabel: '1.375 × BMR',
    description: 'Light exercise, recreational walking, or movement sports 1 to 3 days per week.',
    icon: Footprints,
  },
  {
    value: 'moderately_active',
    title: 'Moderately Active',
    multiplierLabel: '1.55 × BMR',
    description: 'Consistent strength training, gym sessions, or athletic sports 3 to 5 days per week.',
    icon: Flame,
  },
  {
    value: 'very_active',
    title: 'Very Active',
    multiplierLabel: '1.725 × BMR',
    description: 'Intense daily training, double sessions, heavy physical labor, or competitive sports 6 to 7 days per week.',
    icon: Trophy,
  },
]

export const StepActivity: React.FC<StepActivityProps> = ({
  activityLevel,
  onChangeActivityLevel,
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
          <Zap className="w-3.5 h-3.5" />
          <span>Step 4 • Energy Expenditure</span>
        </div>
        <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[var(--color-text-primary)]">
          Weekly activity level
        </h2>
        <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed">
          Select the option that best reflects your typical weekly movement. This applies a Physical Activity Level (PAL) multiplier to your basal burn.
        </p>
      </div>

      <div className="space-y-3">
        {activityOptions.map((opt) => {
          const Icon = opt.icon
          const isSelected = activityLevel === opt.value

          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChangeActivityLevel(opt.value)}
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
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-sm sm:text-base text-[var(--color-text-primary)]">
                      {opt.title}
                    </h3>
                    <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-[var(--color-surface-hover)] border border-[var(--color-border)] text-[var(--color-text-muted)]">
                      {opt.multiplierLabel}
                    </span>
                  </div>
                  {isSelected && (
                    <div className="w-5 h-5 rounded-full bg-[var(--color-accent)] text-white flex items-center justify-center shrink-0">
                      <Check className="w-3 h-3 stroke-[3]" />
                    </div>
                  )}
                </div>
                <p className="text-xs text-[var(--color-text-secondary)] mt-1 leading-relaxed">
                  {opt.description}
                </p>
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
          Next: Calculate Targets
        </Button>
      </div>
    </form>
  )
}
