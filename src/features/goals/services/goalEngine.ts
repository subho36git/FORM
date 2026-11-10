/**
 * FORM Centralized Dynamic Goal Engine
 * 
 * Provides pure mathematical calculations for:
 * 1. Theoretical required calories from target completion dates.
 * 2. Projected completion dates from daily calories with full edge-case guards.
 * 3. Bidirectional macro rebalancing with driver tracking and constraint conflict detection.
 * 4. Individualized physiological safety heuristics (non-blocking warnings).
 *
 * NOTE: The 7,700 kcal/kg tissue energy equivalent is a simplified theoretical model,
 * not an exact physiological guarantee. Projected dates are theoretical estimates.
 */

import type { MacroPreference, ManualOverrides } from '@/types'

export type CalculationDriver =
  | 'target_weight'
  | 'target_date'
  | 'calories'
  | 'protein'
  | 'carbs'
  | 'fat'

export type ProjectionStatus =
  | 'normal'
  | 'achieved'
  | 'stalled'
  | 'wrong_direction'
  | 'unrealistic'

export interface ProjectedDateResult {
  status: ProjectionStatus
  projectedDays: number | null
  projectedDate: string | null
  weeklyRateKg: number
  message: string | null
  isTheoretical: boolean
}

export interface ConstraintConflict {
  hasConflict: boolean
  message: string
  conflictingFields: string[]
  suggestedAction?: string
}

export interface SafetyEvaluation {
  weeklyRateKg: number
  weeklyRatePercent: number
  deficitPercentOfTdee: number
  level: 'safe' | 'moderate' | 'aggressive' | 'extreme'
  warnings: string[]
}

export interface MacroSplit {
  proteinG: number
  carbsG: number
  fatG: number
  proteinKcal: number
  carbsKcal: number
  fatKcal: number
  totalKcal: number
}

// 1. Theoretical Calorie Requirement Calculation
export function calculateTheoreticalRequiredCalories(
  currentWeightKg: number,
  goalWeightKg: number,
  targetDateIso: string,
  tdee: number
): { requiredDailyCalories: number; dailyCaloricDelta: number; daysRemaining: number } {
  const current = Number(currentWeightKg) || 75
  const goal = Number(goalWeightKg) || 70
  const exp = Number(tdee) || 2200

  const targetDate = new Date(targetDateIso)
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  let daysRemaining = 90
  if (!isNaN(targetDate.getTime())) {
    targetDate.setHours(0, 0, 0, 0)
    const diffTime = targetDate.getTime() - today.getTime()
    daysRemaining = Math.max(1, Math.round(diffTime / (1000 * 60 * 60 * 24)))
  }

  // Theoretical tissue equivalent: ~7,700 kcal per kg of tissue
  const totalTissueEnergyKcal = (goal - current) * 7700
  const dailyCaloricDelta = Math.round(totalTissueEnergyKcal / daysRemaining)
  const requiredDailyCalories = Math.max(800, Math.round(exp + dailyCaloricDelta))

  return {
    requiredDailyCalories,
    dailyCaloricDelta,
    daysRemaining,
  }
}

// 2. Projected Completion Date Calculation
// Formula: Days = (Goal Weight - Current Weight) / (Daily Rate)
// Where Daily Rate = Weekly Rate / 7
export function calculateProjectedCompletionDate(
  currentWeightKg: number,
  goalWeightKg: number,
  dailyCalories: number,
  tdee: number,
  observedWeeklyRateKg?: number | null
): ProjectedDateResult {
  const isTheoretical = observedWeeklyRateKg === undefined || observedWeeklyRateKg === null
  const current = Number(currentWeightKg) || 75
  const goal = Number(goalWeightKg) || 70
  const cals = Number(dailyCalories) || 2000
  const exp = Number(tdee) || 2200

  const weightDeltaKg = goal - current // negative for weight loss, positive for weight gain

  // Check if goal is already reached
  if (Math.abs(weightDeltaKg) < 0.1) {
    return {
      status: 'achieved',
      projectedDays: 0,
      projectedDate: new Date().toISOString().split('T')[0],
      weeklyRateKg: 0,
      message: 'Target weight already achieved! Maintain your current energy protocol.',
      isTheoretical,
    }
  }

  // Determine effective daily rate in kg/day
  let dailyRateKg: number
  let weeklyRateKg: number

  if (!isTheoretical && observedWeeklyRateKg !== null && !isNaN(observedWeeklyRateKg)) {
    weeklyRateKg = observedWeeklyRateKg
    dailyRateKg = weeklyRateKg / 7
  } else {
    // Theoretical model: daily surplus/deficit / 7700 kcal
    const dailyCaloricDelta = cals - exp
    dailyRateKg = dailyCaloricDelta / 7700
    weeklyRateKg = dailyRateKg * 7
  }

  // Edge Case 1: Zero progress or NaN (Stalled)
  if (isNaN(dailyRateKg) || Math.abs(dailyRateKg) < 0.0028) {
    // Less than ~0.02 kg per week
    return {
      status: 'stalled',
      projectedDays: null,
      projectedDate: null,
      weeklyRateKg: isNaN(weeklyRateKg) ? 0 : Math.round(weeklyRateKg * 100) / 100,
      message:
        'Daily intake matches energy expenditure. Weight is projected to remain steady; target completion date cannot be projected from zero change.',
      isTheoretical,
    }
  }

  // Edge Case 2: Progress in the wrong direction
  // (Loss intended but gaining, OR gain intended but losing)
  if ((weightDeltaKg < 0 && dailyRateKg > 0) || (weightDeltaKg > 0 && dailyRateKg < 0)) {
    const direction = dailyRateKg > 0 ? 'upward (+ surplus)' : 'downward (- deficit)'
    const goalType = weightDeltaKg < 0 ? 'fat loss' : 'muscle gain'
    return {
      status: 'wrong_direction',
      projectedDays: null,
      projectedDate: null,
      weeklyRateKg: Math.round(weeklyRateKg * 100) / 100,
      message: `Weight is trending ${direction} while your objective is ${goalType}. Adjust your calorie target to reverse direction toward your target weight.`,
      isTheoretical,
    }
  }

  // Normal calculation: Days = (Goal - Current) / (Daily Rate)
  const projectedDays = Math.round(weightDeltaKg / dailyRateKg)

  if (isNaN(projectedDays) || !isFinite(projectedDays)) {
    return {
      status: 'stalled',
      projectedDays: null,
      projectedDate: null,
      weeklyRateKg: Math.round(weeklyRateKg * 100) / 100,
      message: 'Target date cannot be projected with current rate.',
      isTheoretical,
    }
  }

  if (projectedDays <= 0) {
    return {
      status: 'achieved',
      projectedDays: 0,
      projectedDate: new Date().toISOString().split('T')[0],
      weeklyRateKg: Math.round(weeklyRateKg * 100) / 100,
      message: 'Target weight reached!',
      isTheoretical,
    }
  }

  if (projectedDays > 365 * 5) {
    // Exceeds 5 years
    return {
      status: 'unrealistic',
      projectedDays,
      projectedDate: null,
      weeklyRateKg: Math.round(weeklyRateKg * 100) / 100,
      message:
        'Projected timeframe exceeds 5 years at this rate. A slightly larger caloric delta is needed for actionable progress.',
      isTheoretical,
    }
  }

  const projectedDate = new Date()
  projectedDate.setDate(projectedDate.getDate() + projectedDays)
  const projectedDateIso = !isNaN(projectedDate.getTime())
    ? projectedDate.toISOString().split('T')[0]
    : null

  return {
    status: 'normal',
    projectedDays,
    projectedDate: projectedDateIso,
    weeklyRateKg: Math.round(weeklyRateKg * 100) / 100,
    message: null,
    isTheoretical,
  }
}

// 3. Bidirectional Macro Rebalancing with Conflict Detection
export function rebalanceMacrosWithDriver(params: {
  dailyCalories: number
  proteinG: number
  carbsG: number
  fatG: number
  weightKg: number
  driver: CalculationDriver
  locks: ManualOverrides
  preference: MacroPreference
}): {
  macros: MacroSplit
  conflict: ConstraintConflict
  adjustedField: 'protein' | 'carbs' | 'fat' | 'calories' | null
} {
  const { dailyCalories, weightKg, driver, locks, preference } = params
  let p = Math.max(0, params.proteinG)
  let c = Math.max(0, params.carbsG)
  let f = Math.max(0, params.fatG)
  let adjustedField: 'protein' | 'carbs' | 'fat' | 'calories' | null = null

  // Helper to compute total from macros
  const sumKcal = (pro: number, carb: number, fat: number) => pro * 4 + carb * 4 + fat * 9

  // Driver 1: Carbohydrates edited
  if (driver === 'carbs') {
    if (locks.calories) {
      // Calories are locked: flex Fat (or Protein if Fat is locked)
      if (!locks.fat) {
        f = Math.max(0, Math.round((dailyCalories - (p * 4 + c * 4)) / 9))
        adjustedField = 'fat'
      } else if (!locks.protein) {
        p = Math.max(0, Math.round((dailyCalories - (c * 4 + f * 9)) / 4))
        adjustedField = 'protein'
      } else {
        return {
          macros: {
            proteinG: p,
            carbsG: c,
            fatG: f,
            proteinKcal: p * 4,
            carbsKcal: c * 4,
            fatKcal: f * 9,
            totalKcal: sumKcal(p, c, f),
          },
          conflict: {
            hasConflict: true,
            message: `Calories are locked at ${dailyCalories} kcal, but Protein (${p}g) and Fat (${f}g) are also locked. Editing Carbs creates a mathematical conflict.`,
            conflictingFields: ['calories', 'protein', 'fat', 'carbs'],
            suggestedAction: 'Unlock calories or unlock either protein or fat to absorb the change.',
          },
          adjustedField: null,
        }
      }
    } else {
      // Calories are unlocked: recalculate Calories
      const newCalories = p * 4 + c * 4 + f * 9
      return {
        macros: {
          proteinG: p,
          carbsG: c,
          fatG: f,
          proteinKcal: p * 4,
          carbsKcal: c * 4,
          fatKcal: f * 9,
          totalKcal: newCalories,
        },
        conflict: { hasConflict: false, message: '', conflictingFields: [] },
        adjustedField: 'calories',
      }
    }
  }

  // Driver 2: Protein edited
  else if (driver === 'protein') {
    if (!locks.carbs) {
      // Flex Carbs (standard behavior)
      c = Math.max(0, Math.round((dailyCalories - (p * 4 + f * 9)) / 4))
      adjustedField = 'carbs'
    } else if (!locks.fat) {
      // Carbs are locked, flex Fat
      f = Math.max(0, Math.round((dailyCalories - (p * 4 + c * 4)) / 9))
      adjustedField = 'fat'
    } else {
      // Carbs and Fat are both locked
      return {
        macros: {
          proteinG: p,
          carbsG: c,
          fatG: f,
          proteinKcal: p * 4,
          carbsKcal: c * 4,
          fatKcal: f * 9,
          totalKcal: sumKcal(p, c, f),
        },
        conflict: {
          hasConflict: true,
          message: `Both Carbs (${c}g) and Fat (${f}g) are locked. Increasing/decreasing Protein conflicts with the ${dailyCalories} kcal budget.`,
          conflictingFields: ['protein', 'carbs', 'fat'],
          suggestedAction: 'Unlock either Carbs or Fat, or unlock Calories.',
        },
        adjustedField: null,
      }
    }
  }

  // Driver 3: Fat edited
  else if (driver === 'fat') {
    if (!locks.carbs) {
      // Flex Carbs
      c = Math.max(0, Math.round((dailyCalories - (p * 4 + f * 9)) / 4))
      adjustedField = 'carbs'
    } else if (!locks.protein) {
      // Flex Protein
      p = Math.max(0, Math.round((dailyCalories - (c * 4 + f * 9)) / 4))
      adjustedField = 'protein'
    } else {
      return {
        macros: {
          proteinG: p,
          carbsG: c,
          fatG: f,
          proteinKcal: p * 4,
          carbsKcal: c * 4,
          fatKcal: f * 9,
          totalKcal: sumKcal(p, c, f),
        },
        conflict: {
          hasConflict: true,
          message: `Both Protein (${p}g) and Carbs (${c}g) are locked. Editing Fat conflicts with the ${dailyCalories} kcal budget.`,
          conflictingFields: ['protein', 'carbs', 'fat'],
          suggestedAction: 'Unlock Carbs or Protein, or update total Calories.',
        },
        adjustedField: null,
      }
    }
  }

  // Driver 4: Calories or Target Date / Target Weight edited
  else {
    // Check if all 3 macros are manually locked
    if (locks.protein && locks.carbs && locks.fat) {
      const currentSum = sumKcal(p, c, f)
      if (Math.abs(currentSum - dailyCalories) > 5) {
        return {
          macros: {
            proteinG: p,
            carbsG: c,
            fatG: f,
            proteinKcal: p * 4,
            carbsKcal: c * 4,
            fatKcal: f * 9,
            totalKcal: currentSum,
          },
          conflict: {
            hasConflict: true,
            message: `All three macros are locked (${p}g Protein, ${c}g Carbs, ${f}g Fat = ${currentSum} kcal), which conflicts with your new calorie budget of ${dailyCalories} kcal.`,
            conflictingFields: ['calories', 'protein', 'carbs', 'fat'],
            suggestedAction: 'Select which macro should absorb the calorie adjustment.',
          },
          adjustedField: null,
        }
      }
    }

    // Proportional redistribution based on preference if unlocked
    if (!locks.protein && !locks.carbs && !locks.fat) {
      const autoMacros = calculateDefaultMacroSplit(dailyCalories, weightKg, preference)
      p = autoMacros.proteinG
      c = autoMacros.carbsG
      f = autoMacros.fatG
      adjustedField = 'carbs'
    } else if (!locks.carbs) {
      // Only carbs flex
      c = Math.max(0, Math.round((dailyCalories - (p * 4 + f * 9)) / 4))
      adjustedField = 'carbs'
    } else if (!locks.fat) {
      // Only fat flexes
      f = Math.max(0, Math.round((dailyCalories - (p * 4 + c * 4)) / 9))
      adjustedField = 'fat'
    } else if (!locks.protein) {
      // Only protein flexes
      p = Math.max(0, Math.round((dailyCalories - (c * 4 + f * 9)) / 4))
      adjustedField = 'protein'
    }
  }

  const finalSum = sumKcal(p, c, f)
  return {
    macros: {
      proteinG: p,
      carbsG: c,
      fatG: f,
      proteinKcal: p * 4,
      carbsKcal: c * 4,
      fatKcal: f * 9,
      totalKcal: finalSum,
    },
    conflict: { hasConflict: false, message: '', conflictingFields: [] },
    adjustedField,
  }
}

// 4. Default Macro Split Generator (Balanced, High Protein, Low Carb)
export function calculateDefaultMacroSplit(
  calories: number,
  weightKg: number,
  preference: MacroPreference
): { proteinG: number; carbsG: number; fatG: number } {
  let proteinG: number
  let fatG: number

  switch (preference) {
    case 'high_protein': {
      proteinG = Math.round(weightKg * 2.2)
      fatG = Math.round((calories * 0.25) / 9)
      break
    }
    case 'low_carb': {
      proteinG = Math.round(weightKg * 2.0)
      fatG = Math.round((calories * 0.35) / 9)
      break
    }
    case 'balanced':
    default: {
      proteinG = Math.round(weightKg * 2.0)
      fatG = Math.round((calories * 0.25) / 9)
      break
    }
  }

  const remainingKcal = Math.max(0, calories - (proteinG * 4 + fatG * 9))
  const carbsG = Math.round(remainingKcal / 4)

  return { proteinG, carbsG, fatG }
}

// 5. Individualized Physiological Safety Heuristics
export function evaluateSafetyHeuristics(params: {
  currentWeightKg: number
  goalWeightKg: number
  dailyCalories: number
  tdee: number
  bmr: number
}): SafetyEvaluation {
  const currentWeightKg = Math.max(25, Number(params.currentWeightKg) || 75)
  const dailyCalories = Math.max(500, Number(params.dailyCalories) || 2000)
  const tdee = Math.max(800, Number(params.tdee) || 2200)
  const bmr = Math.max(500, Number(params.bmr) || 1600)

  const dailyCaloricDelta = dailyCalories - tdee
  const weeklyRateKg = Math.abs((dailyCaloricDelta * 7) / 7700)
  const weeklyRatePercent = (weeklyRateKg / currentWeightKg) * 100
  const deficitKcal = tdee - dailyCalories
  const deficitPercentOfTdee = deficitKcal > 0 ? (deficitKcal / tdee) * 100 : 0

  const warnings: string[] = []
  let level: 'safe' | 'moderate' | 'aggressive' | 'extreme' = 'safe'

  // Evaluation for Weight Loss
  if (dailyCaloricDelta < 0) {
    if (weeklyRatePercent > 1.5 || deficitPercentOfTdee > 35) {
      level = 'extreme'
      warnings.push(
        `High rate of weight loss (${weeklyRateKg.toFixed(1)} kg/week, ${weeklyRatePercent.toFixed(1)}% of body weight). Deficits over 35% of TDEE increase the risk of muscle loss, nutrient deficiencies, and fatigue.`
      )
    } else if (weeklyRatePercent > 1.0 || deficitPercentOfTdee > 25) {
      level = 'aggressive'
      warnings.push(
        `Aggressive rate of weight loss (${weeklyRateKg.toFixed(1)} kg/week, ${weeklyRatePercent.toFixed(1)}% of body weight). Monitor energy and recovery closely.`
      )
    } else if (weeklyRatePercent > 0.75) {
      level = 'moderate'
    }

    if (dailyCalories < bmr * 0.8) {
      warnings.push(
        `Daily target (${dailyCalories} kcal) is significantly below your Basal Metabolic Rate (${bmr} kcal). Consider a more moderate deficit to support health.`
      )
    }
  }

  // Evaluation for Weight Gain
  if (dailyCaloricDelta > 0) {
    if (weeklyRatePercent > 0.75 || dailyCaloricDelta > 600) {
      level = 'aggressive'
      warnings.push(
        `Rapid surplus (+${dailyCaloricDelta} kcal/day, +${weeklyRateKg.toFixed(1)} kg/week). Weight gains above 0.5% body weight/week tend to result in higher fat accumulation rather than lean muscle.`
      )
    }
  }

  return {
    weeklyRateKg: Math.round(weeklyRateKg * 100) / 100,
    weeklyRatePercent: Math.round(weeklyRatePercent * 10) / 10,
    deficitPercentOfTdee: Math.round(deficitPercentOfTdee),
    level,
    warnings,
  }
}
