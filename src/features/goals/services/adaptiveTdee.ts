/**
 * FORM Adaptive TDEE Calibration Service (Modular Standby)
 * 
 * Computes observed real-world rate of weight change and calibrated metabolic expenditure
 * from longitudinal weight entries and nutrition consumption data.
 * 
 * IMPORTANT REQUIREMENTS:
 * 1. Entries with `is_baseline = true` MUST be strictly excluded from weight trend calculations
 *    and adaptive eligibility checks, as they represent unconfirmed initial onboarding baselines.
 * 2. Adaptive calibration remains INACTIVE until BOTH criteria are met:
 *    - At least 14 days of confirmed weight history (min 4 distinct weigh-in days).
 *    - At least 7 days of logged nutrition intake.
 */

import type { WeightEntry } from '@/types'

export interface AdaptiveTdeeStatus {
  isEligible: boolean
  criteriaMet: {
    weightHistoryDays: number
    hasRequiredWeightDays: boolean
    hasRequiredNutritionDays: boolean
  }
  observedWeeklyRateKg: number | null
  adaptiveTdee: number | null
  statusMessage: string
}

export function evaluateAdaptiveTdeeEligibility(params: {
  weightEntries: WeightEntry[]
  nutritionLoggedDaysCount?: number
  averageConsumedCalories?: number
}): AdaptiveTdeeStatus {
  const { weightEntries, nutritionLoggedDaysCount = 0, averageConsumedCalories } = params

  // 1. Strict filter: Exclude all is_baseline = true entries
  const confirmedEntries = weightEntries
    .filter((entry) => !entry.is_baseline && entry.weight_kg > 0)
    .sort((a, b) => new Date(a.measured_at).getTime() - new Date(b.measured_at).getTime())

  if (confirmedEntries.length < 2) {
    return {
      isEligible: false,
      criteriaMet: {
        weightHistoryDays: 0,
        hasRequiredWeightDays: false,
        hasRequiredNutritionDays: nutritionLoggedDaysCount >= 7,
      },
      observedWeeklyRateKg: null,
      adaptiveTdee: null,
      statusMessage:
        'Adaptive calibration requires at least 14 days of confirmed weigh-ins (excluding initial baseline snapshot).',
    }
  }

  // Calculate timespan of confirmed weigh-in entries in days
  const firstTime = new Date(confirmedEntries[0].measured_at).getTime()
  const lastTime = new Date(confirmedEntries[confirmedEntries.length - 1].measured_at).getTime()
  const timespanDays = Math.round((lastTime - firstTime) / (1000 * 60 * 60 * 24))

  // Distinct measurement dates count
  const distinctDays = new Set(
    confirmedEntries.map((e) => new Date(e.measured_at).toISOString().split('T')[0])
  ).size

  const hasRequiredWeightDays = timespanDays >= 14 && distinctDays >= 4
  const hasRequiredNutritionDays = nutritionLoggedDaysCount >= 7

  if (!hasRequiredWeightDays || !hasRequiredNutritionDays) {
    const missingReasons: string[] = []
    if (!hasRequiredWeightDays) {
      missingReasons.push(
        `at least 14 days of confirmed weigh-ins (currently ${timespanDays} days across ${distinctDays} entries)`
      )
    }
    if (!hasRequiredNutritionDays) {
      missingReasons.push(
        `at least 7 days of logged nutrition entries (currently ${nutritionLoggedDaysCount} days)`
      )
    }

    return {
      isEligible: false,
      criteriaMet: {
        weightHistoryDays: timespanDays,
        hasRequiredWeightDays,
        hasRequiredNutritionDays,
      },
      observedWeeklyRateKg: null,
      adaptiveTdee: null,
      statusMessage: `Adaptive TDEE calibration is in standby mode. Requires ${missingReasons.join(' and ')}. Using theoretical Mifflin-St Jeor projections in the meantime.`,
    }
  }

  // 2. Compute Observed Weight Rate via Linear Regression over confirmed entries
  // x = days from first entry, y = weight in kg
  const n = confirmedEntries.length
  let sumX = 0
  let sumY = 0
  let sumXY = 0
  let sumXX = 0

  for (const entry of confirmedEntries) {
    const x = (new Date(entry.measured_at).getTime() - firstTime) / (1000 * 60 * 60 * 24)
    const y = Number(entry.weight_kg)
    sumX += x
    sumY += y
    sumXY += x * y
    sumXX += x * x
  }

  const slopeDailyKg = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX)
  const observedWeeklyRateKg = Math.round(slopeDailyKg * 7 * 100) / 100

  // 3. Calculate Adaptive TDEE if average consumed calories are provided
  let adaptiveTdee: number | null = null
  if (averageConsumedCalories && averageConsumedCalories > 500) {
    // Energy equation: TDEE = Intook Calories - (Daily Rate * 7700)
    adaptiveTdee = Math.round(averageConsumedCalories - (slopeDailyKg * 7700))
  }

  return {
    isEligible: true,
    criteriaMet: {
      weightHistoryDays: timespanDays,
      hasRequiredWeightDays: true,
      hasRequiredNutritionDays: true,
    },
    observedWeeklyRateKg,
    adaptiveTdee,
    statusMessage:
      'Adaptive calibration active. Real-world weekly rate calculated from confirmed weigh-in trend line.',
  }
}
