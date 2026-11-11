import React, { useState } from 'react'
import { Flame, Lock, Unlock, Zap, RotateCcw, Loader2 } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { useGoals } from '../hooks/useGoals'
import { cn } from '@/lib/utils'

export const CalorieHubCard: React.FC = () => {
  const {
    goals,
    tdee,
    bmr,
    setField,
    toggleLock,
    resetToAuto,
    isLoadingProfile,
  } = useGoals()

  const dailyCal = Number(goals.dailyCalories) || 2000
  const isCaloriesLocked = Boolean(goals.manualOverrides?.calories)
  const delta = dailyCal - tdee
  const deltaLabel =
    delta > 0
      ? `+${delta.toLocaleString()} kcal surplus`
      : delta < 0
      ? `${delta.toLocaleString()} kcal deficit`
      : 'Energy balance (0 kcal)'

  // Calorie draft state (decoupled from immediate Goal Engine recalculation)
  const [prevDailyCal, setPrevDailyCal] = useState(dailyCal)
  const [draftCalories, setDraftCalories] = useState(dailyCal > 0 ? String(dailyCal) : '')
  const [calorieError, setCalorieError] = useState<string | null>(null)

  // Sync draft state with external goal changes (e.g. initial load, slider, reset)
  if (dailyCal !== prevDailyCal) {
    setPrevDailyCal(dailyCal)
    setDraftCalories(dailyCal > 0 ? String(dailyCal) : '')
    setCalorieError(null)
  }

  const handleCaloriesKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      const trimmed = draftCalories.trim()
      if (trimmed === '') {
        setCalorieError('Please enter a daily calorie target.')
        return
      }

      const val = parseInt(trimmed, 10)
      if (isNaN(val) || val < 800 || val > 6000) {
        setCalorieError('Calorie target must be between 800 and 6,000 kcal.')
        return
      }

      setCalorieError(null)
      setField('calories', val)
    } else if (e.key === 'Escape') {
      e.preventDefault()
      setDraftCalories(dailyCal > 0 ? String(dailyCal) : '')
      setCalorieError(null)
    }
  }

  return (
    <Card className="flex flex-col">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[var(--color-accent-subtle)] text-[var(--color-accent)] flex items-center justify-center">
              <Flame className="w-4 h-4 fill-current" />
            </div>
            <div>
              <CardTitle>Daily Calorie Target</CardTitle>
              <CardDescription>
                Adjust daily intake. Changing calories recalculates macros and projected completion dates.
              </CardDescription>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => toggleLock('calories')}
              className={cn(
                'px-2.5 py-1 rounded-md text-xs font-semibold flex items-center gap-1.5 border transition-all cursor-pointer',
                isCaloriesLocked
                  ? 'border-[var(--color-accent)] bg-[var(--color-accent-subtle)] text-[var(--color-accent)]'
                  : 'border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'
              )}
              title={
                isCaloriesLocked
                  ? 'Calories are locked manually. Target date edits will not overwrite calories without confirmation.'
                  : 'Calories are flexible. Target date edits dynamically recalculate this value.'
              }
            >
              {isCaloriesLocked ? (
                <>
                  <Lock className="w-3 h-3" />
                  <span>Locked</span>
                </>
              ) : (
                <>
                  <Unlock className="w-3 h-3" />
                  <span>Auto-Flex</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => resetToAuto('calories')}
              className="p-1 rounded-md text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors cursor-pointer"
              title="Reset to theoretical calculation"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {isLoadingProfile ? (
          <div className="py-8 text-center text-xs text-[var(--color-text-muted)] flex items-center justify-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin text-[var(--color-accent)]" />
            <span>Loading calorie calculations...</span>
          </div>
        ) : (
          <>
            {/* Main Calorie Input & Slider */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">
                  Target Intake
                </span>
                <span className="text-xs font-bold text-[var(--color-accent)]">{deltaLabel}</span>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center gap-3">
                  <Input
                    type="number"
                    step="25"
                    min={800}
                    max={6000}
                    value={draftCalories}
                    onChange={(e) => {
                      setDraftCalories(e.target.value)
                      if (calorieError) setCalorieError(null)
                    }}
                    onKeyDown={handleCaloriesKeyDown}
                    className="text-2xl font-black py-2 tracking-tight"
                    placeholder="e.g. 2000"
                  />
                  <span className="text-sm font-semibold text-[var(--color-text-muted)] shrink-0">
                    kcal / day
                  </span>
                </div>
                {calorieError && (
                  <p className="text-[11px] text-red-500 font-medium">{calorieError}</p>
                )}
              </div>

              {/* Quick Step Slider */}
              <input
                type="range"
                min={1200}
                max={4500}
                step={25}
                value={dailyCal}
                onChange={(e) => {
                  const val = parseInt(e.target.value, 10)
                  setField('calories', val)
                }}
                className="w-full accent-[var(--color-accent)] cursor-pointer"
              />
            </div>

            {/* TDEE Baseline & Bio Energetics Bar */}
            <div className="p-3.5 rounded-xl bg-[var(--color-surface-subtle)] border border-[var(--color-border)] text-xs space-y-2">
              <div className="flex items-center justify-between text-[var(--color-text-secondary)]">
                <span className="flex items-center gap-1.5 font-medium">
                  <Zap className="w-3.5 h-3.5 text-amber-500" />
                  Basal Metabolic Rate (BMR):
                </span>
                <strong className="text-[var(--color-text-primary)]">
                  {(bmr || 0).toLocaleString()} kcal
                </strong>
              </div>
              <div className="flex items-center justify-between text-[var(--color-text-secondary)]">
                <span className="flex items-center gap-1.5 font-medium">
                  <Zap className="w-3.5 h-3.5 text-[var(--color-accent)]" />
                  Maintenance Expenditure (TDEE):
                </span>
                <strong className="text-[var(--color-text-primary)]">
                  {(tdee || 0).toLocaleString()} kcal
                </strong>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
