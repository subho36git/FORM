import React from 'react'
import { ArrowLeft, ArrowRight, Activity, Info, Scale, Ruler, Calendar } from 'lucide-react'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import type { CalorieSex } from '@/types'
import { cn } from '@/lib/utils'

export interface BodyStatsData {
  age: string
  sex: CalorieSex
  height: string
  currentWeight: string
  goalWeight: string
}

interface StepBodyStatsProps {
  data: BodyStatsData
  onChange: (field: keyof BodyStatsData, value: string | CalorieSex) => void
  onNext: () => void
  onBack: () => void
  errors: Record<string, string>
}

export const StepBodyStats: React.FC<StepBodyStatsProps> = ({
  data,
  onChange,
  onNext,
  onBack,
  errors,
}) => {
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onNext()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 animate-in fade-in duration-200">
      <div className="space-y-2 text-center sm:text-left">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[var(--color-accent-subtle)] text-[var(--color-accent)] text-xs font-semibold">
          <Activity className="w-3.5 h-3.5" />
          <span>Step 2 • Baseline Composition</span>
        </div>
        <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[var(--color-text-primary)]">
          Body stats & metabolic metrics
        </h2>
        <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed">
          These biological measurements are required to compute your Basal Metabolic Rate (BMR) using
          the Mifflin-St Jeor formula.
        </p>
      </div>

      <div className="space-y-5">
        {/* Sex for Calorie Estimation */}
        <div className="space-y-2">
          <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">
            Biological Sex for Calorie Formula
          </label>
          <div className="grid grid-cols-2 gap-3">
            {(['male', 'female'] as const).map((sexOption) => {
              const isSelected = data.sex === sexOption
              return (
                <button
                  key={sexOption}
                  type="button"
                  onClick={() => onChange('sex', sexOption)}
                  className={cn(
                    'p-3.5 rounded-xl border text-center transition-all cursor-pointer flex flex-col items-center justify-center gap-1',
                    isSelected
                      ? 'border-[var(--color-accent)] bg-[var(--color-accent-subtle)] ring-1 ring-[var(--color-accent)]'
                      : 'border-[var(--color-border)] bg-[var(--color-surface)] hover:bg-[var(--color-surface-hover)]'
                  )}
                >
                  <span className="capitalize font-bold text-sm text-[var(--color-text-primary)]">
                    {sexOption}
                  </span>
                  <span className="text-[11px] text-[var(--color-text-muted)]">
                    {sexOption === 'male' ? 'Mifflin factor: +5 kcal' : 'Mifflin factor: -161 kcal'}
                  </span>
                </button>
              )
            })}
          </div>
          <div className="flex items-start gap-1.5 text-[11px] text-[var(--color-text-muted)] pt-0.5">
            <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            <span>
              Standard metabolic formulas (e.g. Mifflin-St Jeor) require a biological sex factor to calculate basal energy expenditure.
            </span>
          </div>
        </div>

        {/* Age and Height Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            id="age"
            type="number"
            label="Age (Years)"
            placeholder="e.g. 26"
            value={data.age}
            onChange={(e) => onChange('age', e.target.value)}
            leftIcon={<Calendar className="w-4 h-4" />}
            error={errors.age}
            min={12}
            max={120}
          />

          <Input
            id="height"
            type="number"
            step="0.5"
            label="Height (cm)"
            placeholder="e.g. 178"
            value={data.height}
            onChange={(e) => onChange('height', e.target.value)}
            leftIcon={<Ruler className="w-4 h-4" />}
            error={errors.height}
            min={50}
            max={260}
          />
        </div>

        {/* Current Weight and Goal Weight Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            id="currentWeight"
            type="number"
            step="0.1"
            label="Current Weight (kg)"
            placeholder="e.g. 74.5"
            value={data.currentWeight}
            onChange={(e) => onChange('currentWeight', e.target.value)}
            leftIcon={<Scale className="w-4 h-4" />}
            error={errors.currentWeight}
            min={20}
            max={400}
          />

          <Input
            id="goalWeight"
            type="number"
            step="0.1"
            label="Goal Weight (kg)"
            placeholder="e.g. 70.0"
            value={data.goalWeight}
            onChange={(e) => onChange('goalWeight', e.target.value)}
            leftIcon={<Scale className="w-4 h-4" />}
            error={errors.goalWeight}
            helperText="Target weight you're aiming to reach."
            min={20}
            max={400}
          />
        </div>
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
          Next: Fitness Goal
        </Button>
      </div>
    </form>
  )
}
