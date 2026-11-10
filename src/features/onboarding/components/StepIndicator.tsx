import React from 'react'
import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'

interface StepIndicatorProps {
  currentStep: number
  totalSteps: number
  stepLabels: string[]
  onStepClick?: (step: number) => void
}

export const StepIndicator: React.FC<StepIndicatorProps> = ({
  currentStep,
  totalSteps,
  stepLabels,
  onStepClick,
}) => {
  const progressPercent = ((currentStep - 1) / (totalSteps - 1)) * 100

  return (
    <div className="w-full space-y-4">
      {/* Progress Bar Header */}
      <div className="flex items-center justify-between text-xs font-semibold tracking-wider uppercase text-[var(--color-text-muted)]">
        <span>Step {currentStep} of {totalSteps}</span>
        <span className="text-[var(--color-accent)]">{stepLabels[currentStep - 1]}</span>
      </div>

      {/* Thin animated progress line */}
      <div className="w-full h-1.5 bg-[var(--color-surface-hover)] rounded-full overflow-hidden border border-[var(--color-border)]">
        <div
          className="h-full bg-[var(--color-accent)] transition-all duration-300 ease-out rounded-full"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      {/* Step Circles (Desktop & Tablet) */}
      <div className="hidden sm:flex items-center justify-between pt-1">
        {stepLabels.map((label, index) => {
          const stepNumber = index + 1
          const isCompleted = stepNumber < currentStep
          const isCurrent = stepNumber === currentStep
          const isClickable = Boolean(onStepClick && stepNumber < currentStep)

          return (
            <button
              key={label}
              type="button"
              disabled={!isClickable}
              onClick={() => isClickable && onStepClick?.(stepNumber)}
              className={cn(
                'flex items-center gap-2 text-xs transition-colors focus:outline-none',
                isClickable && 'cursor-pointer hover:opacity-80'
              )}
            >
              <div
                className={cn(
                  'w-6 h-6 rounded-full flex items-center justify-center font-bold text-[11px] transition-all',
                  isCompleted &&
                    'bg-[var(--color-accent)] text-white shadow-xs',
                  isCurrent &&
                    'border-2 border-[var(--color-accent)] text-[var(--color-accent)] bg-[var(--color-accent-subtle)] font-extrabold',
                  !isCompleted &&
                    !isCurrent &&
                    'border border-[var(--color-border)] text-[var(--color-text-muted)] bg-[var(--color-surface)]'
                )}
              >
                {isCompleted ? <Check className="w-3.5 h-3.5 stroke-[3]" /> : stepNumber}
              </div>
              <span
                className={cn(
                  'font-medium text-xs hidden md:inline',
                  isCurrent
                    ? 'text-[var(--color-text-primary)] font-semibold'
                    : isCompleted
                    ? 'text-[var(--color-text-secondary)]'
                    : 'text-[var(--color-text-muted)]'
                )}
              >
                {label}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
