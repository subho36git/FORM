import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Scale,
  Calendar,
  Clock,
  Plus,
  AlertTriangle,
  CheckCircle2,
  Lock,
  Unlock,
  Loader2,
  Sliders,
} from 'lucide-react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'
import { useGoals } from '../hooks/useGoals'
import { useUnit } from '@/hooks/useUnit'
import { cn } from '@/lib/utils'

export const BodyTrajectoryCard: React.FC = () => {
  const {
    goals,
    setField,
    toggleLock,
    projectedResult,
    safetyEvaluation,
    addWeightEntry,
    isLoadingProfile,
    hasConfiguredProfile,
  } = useGoals()

  const { unitSystem, weightUnit, kgToDisplay, displayToKg } = useUnit()

  const minWeight = unitSystem === 'metric' ? 25 : 55
  const maxWeight = unitSystem === 'metric' ? 350 : 770

  const [isLoggingWeight, setIsLoggingWeight] = useState(false)
  const [newWeightInput, setNewWeightInput] = useState('')
  const [weighInError, setWeighInError] = useState<string | null>(null)
  const [isSubmittingWeighIn, setIsSubmittingWeighIn] = useState(false)

  const handleAddWeighIn = async (e: React.FormEvent) => {
    e.preventDefault()
    const val = parseFloat(newWeightInput)
    if (isNaN(val) || val < minWeight || val > maxWeight) {
      setWeighInError(`Please enter a realistic weight between ${minWeight} and ${maxWeight} ${weightUnit}.`)
      return
    }

    setIsSubmittingWeighIn(true)
    setWeighInError(null)
    const weightInKg = displayToKg(val)
    const { error } = await addWeightEntry(weightInKg)
    if (error) {
      setWeighInError(error.message)
    } else {
      setNewWeightInput('')
      setIsLoggingWeight(false)
    }
    setIsSubmittingWeighIn(false)
  }

  // Safety level badge styling with fallback
  const safetyLevel = safetyEvaluation?.level || 'safe'
  const safetyBadgeStyles: Record<string, string> = {
    safe: 'bg-emerald-500/10 text-[var(--color-accent)] border-emerald-500/20',
    moderate: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
    aggressive: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
    extreme: 'bg-red-500/10 text-red-500 border-red-500/20',
  }

  // Safe numerical access
  const currentWeight = Number(goals.currentWeightKg) || 0
  const goalWeight = Number(goals.goalWeightKg) || 0
  const isTargetDateLocked = Boolean(goals.manualOverrides?.target_date)

  // Target weight draft state (decoupled from immediate Goal Engine recalculation)
  const [prevGoalWeight, setPrevGoalWeight] = useState(goalWeight)
  const [prevUnitSystem, setPrevUnitSystem] = useState(unitSystem)
  const [draftGoalWeight, setDraftGoalWeight] = useState(
    goalWeight > 0 ? String(kgToDisplay(goalWeight)) : ''
  )
  const [targetWeightError, setTargetWeightError] = useState<string | null>(null)

  // Sync draft state with external goal changes or unit system switches
  if (goalWeight !== prevGoalWeight || unitSystem !== prevUnitSystem) {
    setPrevGoalWeight(goalWeight)
    setPrevUnitSystem(unitSystem)
    setDraftGoalWeight(goalWeight > 0 ? String(kgToDisplay(goalWeight)) : '')
    setTargetWeightError(null)
  }

  const handleTargetWeightKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      const trimmed = draftGoalWeight.trim()
      if (trimmed === '') {
        setTargetWeightError('Please enter a target weight.')
        return
      }

      const val = parseFloat(trimmed)
      if (isNaN(val) || val < minWeight || val > maxWeight) {
        setTargetWeightError(`Target weight must be between ${minWeight} and ${maxWeight} ${weightUnit}.`)
        return
      }

      setTargetWeightError(null)
      // Commit canonical kg to Goal Engine draft: triggers recalculation of calories, macros, and projected date
      const weightInKg = displayToKg(val)
      setField('target_weight', weightInKg)
    } else if (e.key === 'Escape') {
      e.preventDefault()
      setDraftGoalWeight(goalWeight > 0 ? String(kgToDisplay(goalWeight)) : '')
      setTargetWeightError(null)
    }
  }

  const displayedDelta =
    currentWeight > 0 && goalWeight > 0
      ? kgToDisplay(goalWeight) - kgToDisplay(currentWeight)
      : 0

  return (
    <Card className="flex flex-col">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-500 flex items-center justify-center">
              <Scale className="w-4 h-4" />
            </div>
            <div>
              <CardTitle>Body Trajectory & Target Date</CardTitle>
              <CardDescription>
                Define your target weight and deadline. The engine recalculates required calories or projected time.
              </CardDescription>
            </div>
          </div>
          <Badge
            variant="outline"
            className={cn('text-[11px] font-semibold border', safetyBadgeStyles[safetyLevel] || safetyBadgeStyles.safe)}
          >
            {safetyLevel.toUpperCase()} RATE
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-5">
        {/* Loading State */}
        {isLoadingProfile ? (
          <div className="py-12 text-center text-xs text-[var(--color-text-muted)] flex items-center justify-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin text-[var(--color-accent)]" />
            <span>Loading body trajectory and goal parameters...</span>
          </div>
        ) : !hasConfiguredProfile ? (
          /* Empty State if profile unconfigured */
          <div className="py-8 text-center space-y-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center mx-auto">
              <Scale className="w-5 h-5" />
            </div>
            <div className="space-y-1">
              <h4 className="text-sm font-semibold text-[var(--color-text-primary)]">
                No Target Weight Configured
              </h4>
              <p className="text-xs text-[var(--color-text-secondary)] max-w-sm mx-auto">
                Complete your body stats setup to calculate Mifflin-St Jeor baselines and dynamic timelines.
              </p>
            </div>
            <Link to="/onboarding">
              <Button variant="primary" size="sm" icon={<Sliders className="w-3.5 h-3.5" />}>
                Complete Profile Setup
              </Button>
            </Link>
          </div>
        ) : (
          /* Normal Populated Trajectory View */
          <>
            {/* Current Weight & Goal Weight Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Current Weight (with Log Weigh-in action) */}
              <div className="p-4 rounded-xl bg-[var(--color-surface-subtle)] border border-[var(--color-border)] space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
                    Current Weight
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsLoggingWeight((prev) => !prev)}
                    className="text-xs text-[var(--color-accent)] font-semibold hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Log Weigh-In</span>
                  </button>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-extrabold text-[var(--color-text-primary)]">
                    {currentWeight > 0 ? kgToDisplay(currentWeight).toFixed(1) : '—'}
                  </span>
                  <span className="text-sm font-semibold text-[var(--color-text-muted)]">{weightUnit}</span>
                </div>
                <p className="text-[11px] text-[var(--color-text-muted)]">
                  Synchronized automatically from latest scale weigh-in.
                </p>

                {/* In-line Quick Log Form */}
                {isLoggingWeight && (
                  <form onSubmit={handleAddWeighIn} className="pt-2 border-t border-[var(--color-border)] space-y-2">
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        step="0.1"
                        min={minWeight}
                        max={maxWeight}
                        placeholder={unitSystem === 'metric' ? 'e.g. 74.2' : 'e.g. 163.5'}
                        value={newWeightInput}
                        onChange={(e) => setNewWeightInput(e.target.value)}
                        className="py-1.5 text-xs"
                        autoFocus
                      />
                      <Button
                        type="submit"
                        variant="primary"
                        size="sm"
                        disabled={isSubmittingWeighIn}
                        className="shrink-0 text-xs"
                      >
                        Save
                      </Button>
                    </div>
                    {weighInError && <p className="text-[10px] text-red-500">{weighInError}</p>}
                  </form>
                )}
              </div>

              {/* Goal Weight (Editable) */}
              <div className="p-4 rounded-xl bg-[var(--color-surface-subtle)] border border-[var(--color-border)] space-y-2">
                <div className="flex items-center justify-between">
                  <label
                    htmlFor="goal-weight-input"
                    className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]"
                  >
                    Target Weight
                  </label>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-accent)]">
                    Editable
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Input
                    id="goal-weight-input"
                    type="number"
                    step="0.1"
                    min={minWeight}
                    max={maxWeight}
                    value={draftGoalWeight}
                    onChange={(e) => {
                      setDraftGoalWeight(e.target.value)
                      if (targetWeightError) setTargetWeightError(null)
                    }}
                    onKeyDown={handleTargetWeightKeyDown}
                    className="text-xl font-bold py-1.5"
                    placeholder={unitSystem === 'metric' ? 'e.g. 70' : 'e.g. 154'}
                  />
                  <span className="text-sm font-semibold text-[var(--color-text-muted)]">{weightUnit}</span>
                </div>
                {targetWeightError && (
                  <p className="text-[11px] text-red-500 font-medium">{targetWeightError}</p>
                )}
                <div className="text-[11px] text-[var(--color-text-secondary)]">
                  Remaining delta:{' '}
                  <strong className="text-[var(--color-text-primary)]">
                    {currentWeight > 0 && goalWeight > 0
                      ? `${displayedDelta > 0 ? '+' : ''}${displayedDelta.toFixed(1)} ${weightUnit}`
                      : 'Pending weight input'}
                  </strong>
                </div>
              </div>
            </div>

            {/* Target Date & Projected Date Comparison */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Athlete's Chosen Target Date */}
              <div className="p-4 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)] flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-[var(--color-accent)]" />
                    Target Date (Your Choice)
                  </span>
                  <button
                    type="button"
                    onClick={() => toggleLock('target_date')}
                    className="text-[10px] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] flex items-center gap-1 cursor-pointer"
                    title={isTargetDateLocked ? 'Target date is locked' : 'Target date is dynamic'}
                  >
                    {isTargetDateLocked ? (
                      <Lock className="w-3 h-3 text-[var(--color-accent)]" />
                    ) : (
                      <Unlock className="w-3 h-3" />
                    )}
                    <span>{isTargetDateLocked ? 'Locked' : 'Flex'}</span>
                  </button>
                </div>
                <Input
                  type="date"
                  value={goals.targetDateIso || ''}
                  onChange={(e) => setField('target_date', e.target.value)}
                  className="text-sm font-semibold"
                />
                <p className="text-[11px] text-[var(--color-text-muted)]">
                  Your chosen milestone deadline. Never changed automatically.
                </p>
              </div>

              {/* Engine Projected Completion Date (Theoretical Estimate) */}
              <div className="p-4 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)] flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-blue-500" />
                    Projected Date (Estimate)
                  </span>
                  <span className="text-[10px] font-bold text-blue-500 uppercase">
                    {projectedResult?.isTheoretical ? 'Theoretical' : 'Trend-Calibrated'}
                  </span>
                </div>

                <div className="mt-1">
                  {projectedResult?.status === 'normal' && projectedResult.projectedDate && (
                    <div>
                      <div className="text-lg font-bold text-[var(--color-text-primary)]">
                        {projectedResult.projectedDate}
                      </div>
                      <div className="text-xs text-[var(--color-text-secondary)] mt-0.5">
                        ~{projectedResult.projectedDays} days remaining at current calorie intake
                      </div>
                    </div>
                  )}

                  {projectedResult?.status === 'achieved' && (
                    <div className="flex items-center gap-1.5 text-xs text-[var(--color-accent)] font-semibold">
                      <CheckCircle2 className="w-4 h-4 shrink-0" />
                      <span>{projectedResult.message}</span>
                    </div>
                  )}

                  {projectedResult?.status === 'stalled' && (
                    <div className="flex items-start gap-1.5 text-xs text-amber-500">
                      <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                      <span>{projectedResult.message}</span>
                    </div>
                  )}

                  {projectedResult?.status === 'wrong_direction' && (
                    <div className="flex items-start gap-1.5 text-xs text-red-500">
                      <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                      <span>{projectedResult.message}</span>
                    </div>
                  )}

                  {projectedResult?.status === 'unrealistic' && (
                    <div className="flex items-start gap-1.5 text-xs text-amber-500">
                      <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                      <span>{projectedResult.message}</span>
                    </div>
                  )}
                </div>
                <p className="text-[10px] text-[var(--color-text-muted)] italic">
                  Estimated from energy balance calculations; real metabolism varies.
                </p>
              </div>
            </div>

            {/* Safety Warnings Banner if any */}
            {safetyEvaluation?.warnings && safetyEvaluation.warnings.length > 0 && (
              <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-300 text-xs space-y-1">
                {safetyEvaluation.warnings.map((w, idx) => {
                  const displayMessage =
                    unitSystem === 'imperial'
                      ? w.replace(/([\d.]+) kg\/week/g, (_, kg) => `${(parseFloat(kg) * 2.20462262).toFixed(1)} lb/week`)
                      : w
                  return (
                    <div key={idx} className="flex items-start gap-2">
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-amber-500" />
                      <span>{displayMessage}</span>
                    </div>
                  )
                })}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}
