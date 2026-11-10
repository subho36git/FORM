/**
 * Shared Type Definitions for FORM
 */

export type UnitSystem = 'metric' | 'imperial'

export type FitnessGoal = 'muscle_gain' | 'fat_loss' | 'maintenance'

export type ActivityLevel = 'sedentary' | 'lightly_active' | 'moderately_active' | 'very_active'

export type CalorieSex = 'male' | 'female'

export type MacroPreference = 'balanced' | 'high_protein' | 'low_carb' | 'custom'

export interface ManualOverrides {
  calories?: boolean
  protein?: boolean
  carbs?: boolean
  fat?: boolean
  target_date?: boolean
  target_weight?: boolean
}

export interface WeightEntry {
  id: string
  user_id: string
  weight_kg: number
  measured_at: string
  is_baseline: boolean
  created_at: string
}

export interface UserProfile {
  id: string
  display_name: string | null
  height_cm: number | null
  current_weight_kg: number | null
  goal_weight_kg: number | null
  fitness_goal: FitnessGoal | string | null
  activity_level: ActivityLevel | string | null
  age_years?: number | null
  sex_for_calorie_formula?: CalorieSex | string | null
  daily_calorie_target?: number | null
  protein_target_g?: number | null
  carbs_target_g?: number | null
  fat_target_g?: number | null
  target_completion_date?: string | null
  macro_preference?: MacroPreference | string | null
  manual_overrides?: ManualOverrides | null
  onboarding_completed?: boolean | null
  created_at?: string
  updated_at?: string
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

export * from './workout'

