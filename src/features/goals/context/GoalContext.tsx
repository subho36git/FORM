/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useEffect, useState, useMemo, useCallback } from 'react'
import { useAuth } from '@/features/auth'
import { supabase } from '@/lib/supabase'
import type { MacroPreference, ManualOverrides, WeightEntry } from '@/types'
import {
  calculateBmr,
  calculateTdee,
  type ActivityLevel,
  type CalorieSex,
} from '@/utils/nutritionCalculations'
import {
  calculateTheoreticalRequiredCalories,
  calculateProjectedCompletionDate,
  rebalanceMacrosWithDriver,
  evaluateSafetyHeuristics,
  calculateDefaultMacroSplit,
  type CalculationDriver,
  type ProjectedDateResult,
  type ConstraintConflict,
  type SafetyEvaluation,
} from '../services/goalEngine'
import { evaluateAdaptiveTdeeEligibility, type AdaptiveTdeeStatus } from '../services/adaptiveTdee'

export interface GoalState {
  currentWeightKg: number
  goalWeightKg: number
  targetDateIso: string
  dailyCalories: number
  proteinG: number
  carbsG: number
  fatG: number
  macroPreference: MacroPreference
  manualOverrides: ManualOverrides
  activeDriver: CalculationDriver
}

export interface GoalContextType {
  // Current values
  goals: GoalState
  tdee: number
  bmr: number
  isDirty: boolean
  isSaving: boolean
  saveError: string | null
  saveSuccess: boolean
  isLoadingProfile: boolean
  hasConfiguredProfile: boolean

  // Analysis & Engine Outputs
  projectedResult: ProjectedDateResult
  safetyEvaluation: SafetyEvaluation
  conflict: ConstraintConflict
  adaptiveStatus: AdaptiveTdeeStatus

  // Historical Weigh-ins
  weightEntries: WeightEntry[]
  isLoadingWeightEntries: boolean

  // Actions
  setField: (field: CalculationDriver, value: number | string) => void
  setMacroPreference: (preference: MacroPreference) => void
  toggleLock: (field: keyof ManualOverrides) => void
  resolveConflict: (resolution: 'flex_carbs' | 'flex_fat' | 'flex_protein' | 'unlock_calories') => void
  resetToAuto: (scope?: 'all' | 'calories' | 'macros') => void
  saveGoals: () => Promise<boolean>
  addWeightEntry: (weightKg: number, measuredAt?: string) => Promise<{ error: Error | null }>
  deleteWeightEntry: (id: string) => Promise<{ error: Error | null }>
  refreshWeightEntries: () => Promise<void>
}

const GoalContext = createContext<GoalContextType | undefined>(undefined)

function getDefaultTargetDate(): string {
  const d = new Date()
  d.setDate(d.getDate() + 90) // Default 90 days out
  return d.toISOString().split('T')[0]
}

export const GoalProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { profile, user, isLoading: isAuthLoading, updateProfile, refreshProfile } = useAuth()
  const userId = user?.id

  // Weight History state
  const [weightEntries, setWeightEntries] = useState<WeightEntry[]>([])
  const [isLoadingWeightEntries, setIsLoadingWeightEntries] = useState<boolean>(true)

  // Derived baseline goals from authenticated athlete's profile with rigorous normalization
  const defaultTargetDate = useMemo(() => getDefaultTargetDate(), [])

  const hasConfiguredProfile = useMemo(() => {
    return Boolean(profile?.onboarding_completed || profile?.daily_calorie_target)
  }, [profile?.onboarding_completed, profile?.daily_calorie_target])

  const profileGoals: GoalState = useMemo(() => {
    const rawWeight = Number(profile?.current_weight_kg)
    const currentWeightKg = !isNaN(rawWeight) && rawWeight > 0 ? rawWeight : 75

    const rawGoalWeight = Number(profile?.goal_weight_kg)
    const goalWeightKg = !isNaN(rawGoalWeight) && rawGoalWeight > 0 ? rawGoalWeight : 70

    const rawCalories = Number(profile?.daily_calorie_target)
    const dailyCalories = !isNaN(rawCalories) && rawCalories > 0 ? rawCalories : 2000

    const rawProtein = Number(profile?.protein_target_g)
    const proteinG = !isNaN(rawProtein) && rawProtein >= 0 ? rawProtein : 150

    const rawCarbs = Number(profile?.carbs_target_g)
    const carbsG = !isNaN(rawCarbs) && rawCarbs >= 0 ? rawCarbs : 200

    const rawFat = Number(profile?.fat_target_g)
    const fatG = !isNaN(rawFat) && rawFat >= 0 ? rawFat : 60

    const rawDate = profile?.target_completion_date
    const targetDateIso =
      rawDate && !isNaN(new Date(rawDate).getTime()) ? rawDate : defaultTargetDate

    const rawPref = profile?.macro_preference as MacroPreference
    const validPrefs: MacroPreference[] = ['balanced', 'high_protein', 'low_carb', 'custom']
    const macroPreference = validPrefs.includes(rawPref) ? rawPref : 'balanced'

    const rawOverrides = profile?.manual_overrides
    const manualOverrides: ManualOverrides =
      rawOverrides && typeof rawOverrides === 'object' && !Array.isArray(rawOverrides)
        ? rawOverrides
        : {}

    return {
      currentWeightKg,
      goalWeightKg,
      targetDateIso,
      dailyCalories,
      proteinG,
      carbsG,
      fatG,
      macroPreference,
      manualOverrides,
      activeDriver: 'calories',
    }
  }, [profile, defaultTargetDate])

  // Draft goals state (null when in sync with database profile)
  const [draftGoals, setDraftGoals] = useState<GoalState | null>(null)

  // Effective goals: draft state if athlete is editing, otherwise profile state
  const goals: GoalState = useMemo(() => {
    if (!draftGoals) return profileGoals
    const rawWeight = Number(profile?.current_weight_kg)
    const syncedWeight = !isNaN(rawWeight) && rawWeight > 0 ? rawWeight : draftGoals.currentWeightKg

    return {
      ...draftGoals,
      currentWeightKg: syncedWeight,
      manualOverrides: draftGoals.manualOverrides ?? {},
    }
  }, [draftGoals, profileGoals, profile?.current_weight_kg])

  // UI feedback state
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saveSuccess, setSaveSuccess] = useState(false)

  // Fetch weight entries from Supabase
  const fetchWeightEntries = useCallback(async () => {
    if (!userId) {
      setWeightEntries([])
      setIsLoadingWeightEntries(false)
      return
    }

    try {
      const { data, error } = await supabase
        .from('weight_entries')
        .select('*')
        .eq('user_id', userId)
        .order('measured_at', { ascending: false })

      if (error) {
        // Table might not exist yet if migration 005 has not been executed manually
        console.warn('[FORM Goals] Notice while fetching weigh-ins:', error.message)
      } else if (data) {
        setWeightEntries(data as WeightEntry[])
      }
    } catch (err) {
      console.warn('[FORM Goals] Unexpected weight entries error:', err)
    } finally {
      setIsLoadingWeightEntries(false)
    }
  }, [userId])

  useEffect(() => {
    let isMounted = true

    const loadEntries = async () => {
      if (!userId) {
        if (isMounted) {
          setWeightEntries([])
          setIsLoadingWeightEntries(false)
        }
        return
      }

      try {
        const { data, error } = await supabase
          .from('weight_entries')
          .select('*')
          .eq('user_id', userId)
          .order('measured_at', { ascending: false })

        if (isMounted) {
          if (!error && data) {
            setWeightEntries(data as WeightEntry[])
          }
        }
      } catch (err) {
        console.warn('[FORM Goals] Error loading weigh-ins:', err)
      } finally {
        if (isMounted) {
          setIsLoadingWeightEntries(false)
        }
      }
    }

    loadEntries()

    return () => {
      isMounted = false
    }
  }, [userId])

  // Calculate baseline BMR & TDEE from athlete bio profile with safe number fallbacks
  const bmr = useMemo(() => {
    const w = goals.currentWeightKg || 75
    const h = Number(profile?.height_cm) || 178
    const a = Number(profile?.age_years) || 26
    const s = (profile?.sex_for_calorie_formula as CalorieSex) || 'male'
    return calculateBmr(w, h, a, s)
  }, [goals.currentWeightKg, profile?.height_cm, profile?.age_years, profile?.sex_for_calorie_formula])

  const tdee = useMemo(() => {
    const act = (profile?.activity_level as ActivityLevel) || 'moderately_active'
    return calculateTdee(bmr, act)
  }, [bmr, profile?.activity_level])

  // Standby Adaptive TDEE evaluation (Strictly excludes is_baseline = true)
  const adaptiveStatus = useMemo(() => {
    return evaluateAdaptiveTdeeEligibility({
      weightEntries,
      nutritionLoggedDaysCount: 0, // Food diary logging in next phase
      averageConsumedCalories: goals.dailyCalories,
    })
  }, [weightEntries, goals.dailyCalories])

  // Compute Projected Completion Date (Theoretical baseline unless adaptive criteria are met)
  const projectedResult = useMemo(() => {
    const observedRate = adaptiveStatus.isEligible ? adaptiveStatus.observedWeeklyRateKg : null
    return calculateProjectedCompletionDate(
      goals.currentWeightKg,
      goals.goalWeightKg,
      goals.dailyCalories,
      tdee,
      observedRate
    )
  }, [goals.currentWeightKg, goals.goalWeightKg, goals.dailyCalories, tdee, adaptiveStatus.isEligible, adaptiveStatus.observedWeeklyRateKg])

  // Evaluate Individualized Safety Heuristics
  const safetyEvaluation = useMemo(() => {
    return evaluateSafetyHeuristics({
      currentWeightKg: goals.currentWeightKg,
      goalWeightKg: goals.goalWeightKg,
      dailyCalories: goals.dailyCalories,
      tdee,
      bmr,
    })
  }, [goals.currentWeightKg, goals.goalWeightKg, goals.dailyCalories, tdee, bmr])

  // Check Macro Rebalance & Constraint Conflicts
  const macroRebalanceResult = useMemo(() => {
    return rebalanceMacrosWithDriver({
      dailyCalories: goals.dailyCalories,
      proteinG: goals.proteinG,
      carbsG: goals.carbsG,
      fatG: goals.fatG,
      weightKg: goals.currentWeightKg,
      driver: goals.activeDriver,
      locks: goals.manualOverrides,
      preference: goals.macroPreference,
    })
  }, [goals.dailyCalories, goals.proteinG, goals.carbsG, goals.fatG, goals.currentWeightKg, goals.activeDriver, goals.manualOverrides, goals.macroPreference])

  const conflict = macroRebalanceResult.conflict

  // Check dirty state against profile
  const isDirty = useMemo(() => {
    if (!draftGoals) return false
    return (
      draftGoals.goalWeightKg !== profileGoals.goalWeightKg ||
      draftGoals.targetDateIso !== profileGoals.targetDateIso ||
      draftGoals.dailyCalories !== profileGoals.dailyCalories ||
      draftGoals.proteinG !== profileGoals.proteinG ||
      draftGoals.carbsG !== profileGoals.carbsG ||
      draftGoals.fatG !== profileGoals.fatG ||
      draftGoals.macroPreference !== profileGoals.macroPreference ||
      JSON.stringify(draftGoals.manualOverrides) !== JSON.stringify(profileGoals.manualOverrides)
    )
  }, [draftGoals, profileGoals])

  // Centralized Field Setter implementing dependency rules
  const setField = useCallback(
    (field: CalculationDriver, value: number | string) => {
      setSaveSuccess(false)
      setSaveError(null)

      setDraftGoals((prev) => {
        const current = prev ?? profileGoals
        const currentWeight = current.currentWeightKg
        const targetDate = current.targetDateIso
        const targetWeight = current.goalWeightKg
        const dailyCal = current.dailyCalories
        const overrides = current.manualOverrides || {}
        const pref = current.macroPreference

        if (field === 'target_weight') {
          const val = typeof value === 'number' ? value : parseFloat(value)
          if (isNaN(val) || val < 25 || val > 350) return current

          let newCals = dailyCal
          let newProtein = current.proteinG
          let newCarbs = current.carbsG
          let newFat = current.fatG

          if (targetDate) {
            const req = calculateTheoreticalRequiredCalories(currentWeight, val, targetDate, tdee)
            newCals = req.requiredDailyCalories
            const rebalanced = rebalanceMacrosWithDriver({
              dailyCalories: newCals,
              proteinG: newProtein,
              carbsG: newCarbs,
              fatG: newFat,
              weightKg: currentWeight,
              driver: 'calories',
              locks: overrides,
              preference: pref,
            })
            newProtein = rebalanced.macros.proteinG
            newCarbs = rebalanced.macros.carbsG
            newFat = rebalanced.macros.fatG
          }

          return {
            ...current,
            activeDriver: 'target_weight',
            goalWeightKg: val,
            dailyCalories: newCals,
            proteinG: newProtein,
            carbsG: newCarbs,
            fatG: newFat,
          }
        }

        if (field === 'target_date') {
          const dateStr = String(value)
          const req = calculateTheoreticalRequiredCalories(currentWeight, targetWeight, dateStr, tdee)
          const rebalanced = rebalanceMacrosWithDriver({
            dailyCalories: req.requiredDailyCalories,
            proteinG: current.proteinG,
            carbsG: current.carbsG,
            fatG: current.fatG,
            weightKg: currentWeight,
            driver: 'calories',
            locks: overrides,
            preference: pref,
          })

          return {
            ...current,
            activeDriver: 'target_date',
            targetDateIso: dateStr,
            dailyCalories: req.requiredDailyCalories,
            proteinG: rebalanced.macros.proteinG,
            carbsG: rebalanced.macros.carbsG,
            fatG: rebalanced.macros.fatG,
          }
        }

        if (field === 'calories') {
          const cals = typeof value === 'number' ? value : parseInt(value, 10)
          if (isNaN(cals) || cals < 800 || cals > 6000) return current

          const rebalanced = rebalanceMacrosWithDriver({
            dailyCalories: cals,
            proteinG: current.proteinG,
            carbsG: current.carbsG,
            fatG: current.fatG,
            weightKg: currentWeight,
            driver: 'calories',
            locks: overrides,
            preference: pref,
          })

          return {
            ...current,
            activeDriver: 'calories',
            dailyCalories: cals,
            proteinG: rebalanced.macros.proteinG,
            carbsG: rebalanced.macros.carbsG,
            fatG: rebalanced.macros.fatG,
            manualOverrides: { ...overrides, calories: true },
          }
        }

        if (field === 'protein') {
          const p = typeof value === 'number' ? value : parseInt(value, 10)
          if (isNaN(p) || p < 0 || p > 500) return current

          const rebalanced = rebalanceMacrosWithDriver({
            dailyCalories: dailyCal,
            proteinG: p,
            carbsG: current.carbsG,
            fatG: current.fatG,
            weightKg: currentWeight,
            driver: 'protein',
            locks: overrides,
            preference: pref,
          })

          return {
            ...current,
            activeDriver: 'protein',
            proteinG: p,
            carbsG: rebalanced.macros.carbsG,
            fatG: rebalanced.macros.fatG,
            manualOverrides: { ...overrides, protein: true },
          }
        }

        if (field === 'fat') {
          const f = typeof value === 'number' ? value : parseInt(value, 10)
          if (isNaN(f) || f < 0 || f > 400) return current

          const rebalanced = rebalanceMacrosWithDriver({
            dailyCalories: dailyCal,
            proteinG: current.proteinG,
            carbsG: current.carbsG,
            fatG: f,
            weightKg: currentWeight,
            driver: 'fat',
            locks: overrides,
            preference: pref,
          })

          return {
            ...current,
            activeDriver: 'fat',
            fatG: f,
            carbsG: rebalanced.macros.carbsG,
            proteinG: rebalanced.macros.proteinG,
            manualOverrides: { ...overrides, fat: true },
          }
        }

        if (field === 'carbs') {
          const c = typeof value === 'number' ? value : parseInt(value, 10)
          if (isNaN(c) || c < 0 || c > 1000) return current
          if (!overrides.calories) {
            const newCals = current.proteinG * 4 + c * 4 + current.fatG * 9
            return {
              ...current,
              activeDriver: 'carbs',
              carbsG: c,
              dailyCalories: newCals,
              manualOverrides: { ...overrides, carbs: true },
            }
          } else {
            const rebalanced = rebalanceMacrosWithDriver({
              dailyCalories: dailyCal,
              proteinG: current.proteinG,
              carbsG: c,
              fatG: current.fatG,
              weightKg: currentWeight,
              driver: 'carbs',
              locks: overrides,
              preference: pref,
            })
            return {
              ...current,
              activeDriver: 'carbs',
              carbsG: c,
              fatG: rebalanced.macros.fatG,
              manualOverrides: { ...overrides, carbs: true },
            }
          }
        }

        return current
      })
    },
    [profileGoals, tdee]
  )

  // Toggle Manual Lock per field
  const toggleLock = useCallback((field: keyof ManualOverrides) => {
    setDraftGoals((prev) => {
      const current = prev ?? profileGoals
      const existingLocks = current.manualOverrides || {}
      return {
        ...current,
        manualOverrides: {
          ...existingLocks,
          [field]: !existingLocks[field],
        },
      }
    })
  }, [profileGoals])

  // Change Macro Distribution Preset
  const setMacroPreference = useCallback(
    (pref: MacroPreference) => {
      setDraftGoals((prev) => {
        const current = prev ?? profileGoals
        const autoMacros = calculateDefaultMacroSplit(current.dailyCalories, current.currentWeightKg, pref)
        const locks = current.manualOverrides || {}
        return {
          ...current,
          macroPreference: pref,
          proteinG: locks.protein ? current.proteinG : autoMacros.proteinG,
          fatG: locks.fat ? current.fatG : autoMacros.fatG,
          carbsG: locks.carbs ? current.carbsG : autoMacros.carbsG,
        }
      })
    },
    [profileGoals]
  )

  // Explicit Conflict Resolution
  const resolveConflict = useCallback(
    (resolution: 'flex_carbs' | 'flex_fat' | 'flex_protein' | 'unlock_calories') => {
      setDraftGoals((prev) => {
        const current = prev ?? profileGoals
        const locks = current.manualOverrides || {}
        if (resolution === 'unlock_calories') {
          const newCals = current.proteinG * 4 + current.carbsG * 4 + current.fatG * 9
          return {
            ...current,
            dailyCalories: newCals,
            manualOverrides: { ...locks, calories: false },
          }
        } else if (resolution === 'flex_carbs') {
          const newC = Math.max(0, Math.round((current.dailyCalories - (current.proteinG * 4 + current.fatG * 9)) / 4))
          return {
            ...current,
            carbsG: newC,
            manualOverrides: { ...locks, carbs: false },
          }
        } else if (resolution === 'flex_fat') {
          const newF = Math.max(0, Math.round((current.dailyCalories - (current.proteinG * 4 + current.carbsG * 4)) / 9))
          return {
            ...current,
            fatG: newF,
            manualOverrides: { ...locks, fat: false },
          }
        } else if (resolution === 'flex_protein') {
          const newP = Math.max(0, Math.round((current.dailyCalories - (current.carbsG * 4 + current.fatG * 9)) / 4))
          return {
            ...current,
            proteinG: newP,
            manualOverrides: { ...locks, protein: false },
          }
        }
        return current
      })
    },
    [profileGoals]
  )

  // Reset to Automatic Calibrated Defaults
  const resetToAuto = useCallback(
    (scope: 'all' | 'calories' | 'macros' = 'all') => {
      setDraftGoals((prev) => {
        const current = prev ?? profileGoals
        let newCals = current.dailyCalories
        let newOverrides = { ...(current.manualOverrides || {}) }

        if (scope === 'all' || scope === 'calories') {
          const req = calculateTheoreticalRequiredCalories(
            current.currentWeightKg,
            current.goalWeightKg,
            current.targetDateIso,
            tdee
          )
          newCals = req.requiredDailyCalories
          newOverrides = { ...newOverrides, calories: false }
        }

        let newP = current.proteinG
        let newC = current.carbsG
        let newF = current.fatG

        if (scope === 'all' || scope === 'macros') {
          const auto = calculateDefaultMacroSplit(newCals, current.currentWeightKg, current.macroPreference)
          newP = auto.proteinG
          newC = auto.carbsG
          newF = auto.fatG
          newOverrides = {
            ...newOverrides,
            protein: false,
            carbs: false,
            fat: false,
          }
        }

        return {
          ...current,
          dailyCalories: newCals,
          proteinG: newP,
          carbsG: newC,
          fatG: newF,
          manualOverrides: newOverrides,
        }
      })
    },
    [profileGoals, tdee]
  )

  // Save changes to Supabase public.profiles
  const saveGoals = useCallback(async (): Promise<boolean> => {
    setIsSaving(true)
    setSaveError(null)
    setSaveSuccess(false)

    try {
      const targetState = draftGoals ?? profileGoals
      const payload = {
        goal_weight_kg: targetState.goalWeightKg,
        target_completion_date: targetState.targetDateIso,
        daily_calorie_target: targetState.dailyCalories,
        protein_target_g: targetState.proteinG,
        carbs_target_g: targetState.carbsG,
        fat_target_g: targetState.fatG,
        macro_preference: targetState.macroPreference,
        manual_overrides: targetState.manualOverrides,
      }

      const { error } = await updateProfile(payload)
      if (error) {
        setSaveError(error.message || 'Failed to save goals and targets.')
        setIsSaving(false)
        return false
      }

      setDraftGoals(null)
      setSaveSuccess(true)
      setIsSaving(false)
      return true
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'An unexpected error occurred.'
      setSaveError(msg)
      setIsSaving(false)
      return false
    }
  }, [draftGoals, profileGoals, updateProfile])

  // Add Weigh-in entry to public.weight_entries
  const addWeightEntry = useCallback(
    async (weightKg: number, measuredAt?: string) => {
      if (!userId) return { error: new Error('User is not authenticated') }

      try {
        const { error } = await supabase.from('weight_entries').insert({
          user_id: userId,
          weight_kg: weightKg,
          measured_at: measuredAt || new Date().toISOString(),
          is_baseline: false, // confirmed scale weigh-in
        })

        if (error) {
          console.error('[FORM Goals] Error adding weight entry:', error.message)
          return { error: new Error(error.message) }
        }

        await Promise.all([refreshProfile(), fetchWeightEntries()])
        return { error: null }
      } catch (err) {
        return { error: err as Error }
      }
    },
    [userId, refreshProfile, fetchWeightEntries]
  )

  // Delete Weigh-in entry from public.weight_entries
  const deleteWeightEntry = useCallback(
    async (id: string) => {
      if (!userId) return { error: new Error('User is not authenticated') }

      try {
        const { error } = await supabase
          .from('weight_entries')
          .delete()
          .eq('id', id)
          .eq('user_id', userId)
        if (error) {
          return { error: new Error(error.message) }
        }

        await Promise.all([refreshProfile(), fetchWeightEntries()])
        return { error: null }
      } catch (err) {
        return { error: err as Error }
      }
    },
    [userId, refreshProfile, fetchWeightEntries]
  )

  const value: GoalContextType = {
    goals,
    tdee,
    bmr,
    isDirty,
    isSaving,
    saveError,
    saveSuccess,
    isLoadingProfile: isAuthLoading,
    hasConfiguredProfile,
    projectedResult,
    safetyEvaluation,
    conflict,
    adaptiveStatus,
    weightEntries,
    isLoadingWeightEntries,
    setField,
    setMacroPreference,
    toggleLock,
    resolveConflict,
    resetToAuto,
    saveGoals,
    addWeightEntry,
    deleteWeightEntry,
    refreshWeightEntries: fetchWeightEntries,
  }

  return <GoalContext.Provider value={value}>{children}</GoalContext.Provider>
}

export function useGoals(): GoalContextType {
  const context = useContext(GoalContext)
  if (!context) {
    throw new Error('useGoals must be used within a GoalProvider')
  }
  return context
}
