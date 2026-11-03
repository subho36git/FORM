/**
 * Shared Type Definitions for FORM
 */

export type UnitSystem = 'metric' | 'imperial'

export interface UserProfile {
  id: string
  displayName: string
  unitPreference: UnitSystem
  heightCm?: number
  targetCalories: number
  targetProteinG: number
  targetCarbsG: number
  targetFatG: number
}

export interface MetricSummary {
  dailyCalories: number
  targetCalories: number
  proteinG: number
  targetProteinG: number
  weeklyWorkoutsCompleted: number
  weeklyWorkoutsTarget: number
  currentWeightKg: number
}
