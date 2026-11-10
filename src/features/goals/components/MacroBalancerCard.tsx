import React, { useState } from 'react'
import {
  ShieldCheck,
  Wheat,
  Droplet,
  Lock,
  Unlock,
  RotateCcw,
  Loader2,
} from 'lucide-react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { useGoals } from '../hooks/useGoals'
import type { MacroPreference } from '@/types'
import { cn } from '@/lib/utils'

export const MacroBalancerCard: React.FC = () => {
  const {
    goals,
    setField,
    toggleLock,
    setMacroPreference,
    resetToAuto,
    isLoadingProfile,
  } = useGoals()

  const { dailyCalories, proteinG, carbsG, fatG, macroPreference } = goals
  const overrides = goals.manualOverrides || {}

  const cals = Number(dailyCalories) || 0
  const p = Number(proteinG) || 0
  const c = Number(carbsG) || 0
  const f = Number(fatG) || 0

  // Draft states decoupled from immediate Goal Engine recalculation
  const [prevProtein, setPrevProtein] = useState(p)
  const [draftProtein, setDraftProtein] = useState(p >= 0 ? String(p) : '')
  const [proteinError, setProteinError] = useState<string | null>(null)

  if (p !== prevProtein) {
    setPrevProtein(p)
    setDraftProtein(p >= 0 ? String(p) : '')
    setProteinError(null)
  }

  const [prevCarbs, setPrevCarbs] = useState(c)
  const [draftCarbs, setDraftCarbs] = useState(c >= 0 ? String(c) : '')
  const [carbsError, setCarbsError] = useState<string | null>(null)

  if (c !== prevCarbs) {
    setPrevCarbs(c)
    setDraftCarbs(c >= 0 ? String(c) : '')
    setCarbsError(null)
  }

  const [prevFat, setPrevFat] = useState(f)
  const [draftFat, setDraftFat] = useState(f >= 0 ? String(f) : '')
  const [fatError, setFatError] = useState<string | null>(null)

  if (f !== prevFat) {
    setPrevFat(f)
    setDraftFat(f >= 0 ? String(f) : '')
    setFatError(null)
  }

  const handleProteinKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      const trimmed = draftProtein.trim()
      if (trimmed === '') {
        setProteinError('Required')
        return
      }
      const val = parseInt(trimmed, 10)
      if (isNaN(val) || val < 0 || val > 500) {
        setProteinError('0–500g')
        return
      }
      setProteinError(null)
      setField('protein', val)
    } else if (e.key === 'Escape') {
      e.preventDefault()
      setDraftProtein(p >= 0 ? String(p) : '')
      setProteinError(null)
    }
  }

  const handleCarbsKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      const trimmed = draftCarbs.trim()
      if (trimmed === '') {
        setCarbsError('Required')
        return
      }
      const val = parseInt(trimmed, 10)
      if (isNaN(val) || val < 0 || val > 1000) {
        setCarbsError('0–1,000g')
        return
      }
      setCarbsError(null)
      setField('carbs', val)
    } else if (e.key === 'Escape') {
      e.preventDefault()
      setDraftCarbs(c >= 0 ? String(c) : '')
      setCarbsError(null)
    }
  }

  const handleFatKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      const trimmed = draftFat.trim()
      if (trimmed === '') {
        setFatError('Required')
        return
      }
      const val = parseInt(trimmed, 10)
      if (isNaN(val) || val < 0 || val > 400) {
        setFatError('0–400g')
        return
      }
      setFatError(null)
      setField('fat', val)
    } else if (e.key === 'Escape') {
      e.preventDefault()
      setDraftFat(f >= 0 ? String(f) : '')
      setFatError(null)
    }
  }

  const proteinKcal = p * 4
  const carbsKcal = c * 4
  const fatKcal = f * 9
  const totalMacroKcal = proteinKcal + carbsKcal + fatKcal

  const proteinPercent = cals > 0 ? Math.round((proteinKcal / cals) * 100) : 0
  const carbsPercent = cals > 0 ? Math.round((carbsKcal / cals) * 100) : 0
  const fatPercent = cals > 0 ? Math.round((fatKcal / cals) * 100) : 0

  const isProteinLocked = Boolean(overrides.protein)
  const isCarbsLocked = Boolean(overrides.carbs)
  const isFatLocked = Boolean(overrides.fat)

  const preferences: { key: MacroPreference; label: string }[] = [
    { key: 'balanced', label: 'Balanced' },
    { key: 'high_protein', label: 'High Protein' },
    { key: 'low_carb', label: 'Low Carb' },
    { key: 'custom', label: 'Custom' },
  ]

  return (
    <Card className="flex flex-col">
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <CardTitle>Macronutrient Protocol</CardTitle>
            <CardDescription>
              4 kcal/g for Protein & Carbs, 9 kcal/g for Fat. Adjusting macros dynamically rebalances energy.
            </CardDescription>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => resetToAuto('macros')}
              className="text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] flex items-center gap-1 cursor-pointer"
              title="Reset all macros to preset ratio"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset Macros</span>
            </button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {isLoadingProfile ? (
          <div className="py-12 text-center text-xs text-[var(--color-text-muted)] flex items-center justify-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin text-[var(--color-accent)]" />
            <span>Loading macronutrient protocol...</span>
          </div>
        ) : (
          <>
            {/* Preference Selector Pills */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-1 bg-[var(--color-surface-hover)] rounded-xl border border-[var(--color-border)]">
              {preferences.map((pref) => {
                const isSelected = (macroPreference || 'balanced') === pref.key
                return (
                  <button
                    key={pref.key}
                    type="button"
                    onClick={() => setMacroPreference(pref.key)}
                    className={cn(
                      'py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer',
                      isSelected
                        ? 'bg-[var(--color-surface)] text-[var(--color-text-primary)] shadow-xs'
                        : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
                    )}
                  >
                    {pref.label}
                  </button>
                )
              })}
            </div>

            {/* Macro Rows Grid */}
            <div className="space-y-3.5">
              {/* 1. Protein Row */}
              <div className="p-3.5 rounded-xl bg-[var(--color-surface-subtle)] border border-[var(--color-border)] flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-500 flex items-center justify-center shrink-0">
                    <ShieldCheck className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-primary)]">
                      Protein
                    </div>
                    <div className="text-[11px] text-[var(--color-text-muted)]">
                      {proteinKcal} kcal • {proteinPercent}% of daily budget
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="flex flex-col items-end">
                    <div className="flex items-center gap-1.5 w-24">
                      <Input
                        type="number"
                        min={0}
                        max={500}
                        value={draftProtein}
                        onChange={(e) => {
                          setDraftProtein(e.target.value)
                          if (proteinError) setProteinError(null)
                        }}
                        onKeyDown={handleProteinKeyDown}
                        className="text-right py-1 text-sm font-bold"
                        placeholder="e.g. 150"
                      />
                      <span className="text-xs text-[var(--color-text-muted)]">g</span>
                    </div>
                    {proteinError && (
                      <span className="text-[10px] text-red-500 font-medium mt-0.5">{proteinError}</span>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => toggleLock('protein')}
                    className={cn(
                      'p-1.5 rounded-md border text-xs cursor-pointer transition-colors',
                      isProteinLocked
                        ? 'border-blue-500 bg-blue-500/10 text-blue-500'
                        : 'border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'
                    )}
                    title={isProteinLocked ? 'Protein is locked' : 'Protein auto-adjusts'}
                  >
                    {isProteinLocked ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              {/* 2. Carbohydrates Row */}
              <div className="p-3.5 rounded-xl bg-[var(--color-surface-subtle)] border border-[var(--color-border)] flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-500 flex items-center justify-center shrink-0">
                    <Wheat className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-primary)]">
                      Carbohydrates
                    </div>
                    <div className="text-[11px] text-[var(--color-text-muted)]">
                      {carbsKcal} kcal • {carbsPercent}% of daily budget
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="flex flex-col items-end">
                    <div className="flex items-center gap-1.5 w-24">
                      <Input
                        type="number"
                        min={0}
                        max={1000}
                        value={draftCarbs}
                        onChange={(e) => {
                          setDraftCarbs(e.target.value)
                          if (carbsError) setCarbsError(null)
                        }}
                        onKeyDown={handleCarbsKeyDown}
                        className="text-right py-1 text-sm font-bold"
                        placeholder="e.g. 200"
                      />
                      <span className="text-xs text-[var(--color-text-muted)]">g</span>
                    </div>
                    {carbsError && (
                      <span className="text-[10px] text-red-500 font-medium mt-0.5">{carbsError}</span>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => toggleLock('carbs')}
                    className={cn(
                      'p-1.5 rounded-md border text-xs cursor-pointer transition-colors',
                      isCarbsLocked
                        ? 'border-amber-500 bg-amber-500/10 text-amber-500'
                        : 'border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'
                    )}
                    title={isCarbsLocked ? 'Carbohydrates are locked' : 'Carbohydrates auto-adjust'}
                  >
                    {isCarbsLocked ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              {/* 3. Fat Row */}
              <div className="p-3.5 rounded-xl bg-[var(--color-surface-subtle)] border border-[var(--color-border)] flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-purple-500/10 text-purple-500 flex items-center justify-center shrink-0">
                    <Droplet className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-primary)]">
                      Dietary Fat
                    </div>
                    <div className="text-[11px] text-[var(--color-text-muted)]">
                      {fatKcal} kcal • {fatPercent}% of daily budget
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="flex flex-col items-end">
                    <div className="flex items-center gap-1.5 w-24">
                      <Input
                        type="number"
                        min={0}
                        max={400}
                        value={draftFat}
                        onChange={(e) => {
                          setDraftFat(e.target.value)
                          if (fatError) setFatError(null)
                        }}
                        onKeyDown={handleFatKeyDown}
                        className="text-right py-1 text-sm font-bold"
                        placeholder="e.g. 60"
                      />
                      <span className="text-xs text-[var(--color-text-muted)]">g</span>
                    </div>
                    {fatError && (
                      <span className="text-[10px] text-red-500 font-medium mt-0.5">{fatError}</span>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => toggleLock('fat')}
                    className={cn(
                      'p-1.5 rounded-md border text-xs cursor-pointer transition-colors',
                      isFatLocked
                        ? 'border-purple-500 bg-purple-500/10 text-purple-500'
                        : 'border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'
                    )}
                    title={isFatLocked ? 'Fat is locked' : 'Fat auto-adjusts'}
                  >
                    {isFatLocked ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
            </div>

            {/* Macro Total Validation Bar */}
            <div className="flex items-center justify-between text-xs pt-2 border-t border-[var(--color-border)] text-[var(--color-text-secondary)]">
              <span>
                Total Macro Calories:{' '}
                <strong className="text-[var(--color-text-primary)]">{totalMacroKcal.toLocaleString()} kcal</strong>
              </span>
              <span
                className={cn(
                  'font-semibold',
                  Math.abs(totalMacroKcal - cals) <= 5 ? 'text-[var(--color-accent)]' : 'text-amber-500'
                )}
              >
                {Math.abs(totalMacroKcal - cals) <= 5
                  ? 'Balanced (100%)'
                  : `${totalMacroKcal - cals > 0 ? '+' : ''}${totalMacroKcal - cals} kcal delta`}
              </span>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
