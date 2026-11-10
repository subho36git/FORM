import React from 'react'
import { Sparkles, ArrowRight, User } from 'lucide-react'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'

interface StepWelcomeProps {
  displayName: string
  onChangeDisplayName: (value: string) => void
  onNext: () => void
  error?: string
}

export const StepWelcome: React.FC<StepWelcomeProps> = ({
  displayName,
  onChangeDisplayName,
  onNext,
  error,
}) => {
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onNext()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 animate-in fade-in duration-200">
      <div className="space-y-2 text-center sm:text-left">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[var(--color-accent-subtle)] text-[var(--color-accent)] text-xs font-semibold">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Step 1 • Welcome to FORM</span>
        </div>
        <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[var(--color-text-primary)]">
          Let's calibrate your athletic profile
        </h2>
        <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed">
          FORM is designed to optimize your nutrition and athletic performance with mathematical precision.
          To get started, please confirm how you'd like your athlete profile to be addressed.
        </p>
      </div>

      <div className="p-5 rounded-xl bg-[var(--color-surface-subtle)] border border-[var(--color-border)] space-y-4">
        <Input
          id="onboarding-display-name"
          label="Athlete Display Name"
          placeholder="e.g. Alex Sterling"
          value={displayName}
          onChange={(e) => onChangeDisplayName(e.target.value)}
          leftIcon={<User className="w-4 h-4" />}
          error={error}
          helperText="This name will appear on your dashboard, session logs, and personal reports."
          autoFocus
        />
      </div>

      <div className="flex justify-end pt-2">
        <Button
          type="submit"
          variant="primary"
          size="lg"
          className="w-full sm:w-auto font-semibold px-6 cursor-pointer"
          icon={<ArrowRight className="w-4 h-4" />}
        >
          Continue to Body Stats
        </Button>
      </div>
    </form>
  )
}
