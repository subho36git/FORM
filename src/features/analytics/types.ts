/**
 * FORM Application — Phase 7: Analytics & Progress Intelligence
 * types.ts
 * 
 * Strict type definitions for pure calculation utilities, service queries,
 * and unified analytics aggregation.
 */

import type { MuscleGroup } from '@/types/workout'
import type { MealCategory } from '@/features/nutrition/types'

export type AnalyticsTimeframe = '7d' | '30d' | '90d' | '180d' | '1y' | 'all'

// ==============================================================================
// 1. Body Progress Analytics Types
// ==============================================================================

export interface WeightMovingAveragePoint {
  date: string // YYYY-MM-DD
  weightKg: number
  movingAvgKg: number | null
  isBaseline?: boolean
}

export interface BodyProgressStats {
  currentWeightKg: number | null
  baselineWeightKg: number | null
  goalWeightKg: number | null
  weightChangeKg: number | null
  weeklyChangeRateKg: number | null
  progressPercentage: number | null
  projectedCompletionDate: string | null // YYYY-MM-DD
  targetDateIso: string | null
  isTargetAchieved: boolean
  bmi: number | null
  totalWeighIns: number
}

// ==============================================================================
// 2. Strength & Workout Analytics Types
// ==============================================================================

export interface Estimated1RmPoint {
  date: string // YYYY-MM-DD
  sessionId: string
  exerciseId: string
  exerciseName: string
  weightKg: number
  reps: number
  estimated1RmKg: number
}

export interface PersonalRecord {
  exerciseId: string
  exerciseName: string
  muscleGroup: MuscleGroup
  maxWeightKg: number
  max1RmKg: number
  maxVolumeKg: number
  bestSetReps: number
  bestSetWeightKg: number
  achievedAt: string
}

export interface WeeklyVolumePoint {
  weekStartDate: string // YYYY-MM-DD (Monday)
  totalVolumeKg: number
  completedSets: number
  completedWorkouts: number
}

export interface MuscleGroupDistribution {
  muscleGroup: MuscleGroup
  sets: number
  percentage: number
  volumeKg: number
}

export interface MostImprovedExercise {
  exerciseId: string
  exerciseName: string
  muscleGroup: MuscleGroup
  initial1RmKg: number
  peak1RmKg: number
  deltaKg: number
  deltaPercent: number
  sessionCount: number
  baselineDate: string
  peakDate: string
}

export interface WorkoutAnalyticsStats {
  totalCompletedWorkouts: number
  totalVolumeKg: number
  totalCompletedSets: number
  averageWorkoutDurationMinutes: number
  prs: PersonalRecord[]
  muscleDistribution: MuscleGroupDistribution[]
  weeklyVolume: WeeklyVolumePoint[]
  mostImproved?: MostImprovedExercise | null
}

// ==============================================================================
// 3. Nutrition Analytics Types
// ==============================================================================

export interface DailyNutritionAggregate {
  logDate: string // YYYY-MM-DD
  calories: number
  proteinG: number
  carbsG: number
  fatG: number
  fiberG: number
  mealCount: number
  isAdherent: boolean
  caloriesTarget: number | null
  proteinTarget: number | null
}

export interface MacroCaloriePercentages {
  proteinPercent: number
  carbsPercent: number
  fatPercent: number
}

export interface MealCategoryDistribution {
  category: MealCategory
  calories: number
  percentage: number
  mealCount: number
}

export interface CalorieMovingAveragePoint {
  date: string // YYYY-MM-DD
  calories: number
  movingAvgCalories: number
}

export interface NutritionInsight {
  id: string
  category: 'calories' | 'protein' | 'macros' | 'fiber' | 'trajectory'
  title: string
  message: string
  status: 'positive' | 'warning' | 'neutral'
}

export interface NutritionAnalyticsStats {
  averageCalories: number
  averageProteinG: number
  averageCarbsG: number
  averageFatG: number
  averageFiberG: number
  targetAdherenceRate: number // 0 to 100 percentage
  adherentDaysCount: number
  belowTargetDaysCount?: number
  aboveTargetDaysCount?: number
  totalLoggedDays: number
  macroPercentages: MacroCaloriePercentages
  mealDistribution: MealCategoryDistribution[]
  dailyIntakes: DailyNutritionAggregate[]
  insights?: NutritionInsight[]
}

// ==============================================================================
// 4. Consistency & Activity Analytics Types
// ==============================================================================

export interface DailyActivityScore {
  date: string // YYYY-MM-DD
  workoutCompleted: boolean
  nutritionLogged: boolean
  weightLogged: boolean
  score: number // 0: None, 1: Weight only, 2: Workout OR Nutrition, 3: Workout AND Nutrition
  isUnavailable?: boolean
}

export interface WeeklyActivitySummary {
  weekStartDate: string // YYYY-MM-DD (Monday)
  weekEndDate: string // YYYY-MM-DD (Sunday)
  label: string
  completedWorkouts: number
  nutritionLoggedDays: number
  weighInDays: number
  completedWorkingSets: number
  totalTrainingVolumeKg: number
}

export interface LifetimeConsistencyStats {
  lifetimeCompletedWorkouts: number
  lifetimeWorkingSets: number
  lifetimeTrainingVolumeKg: number
  totalNutritionDays: number
  totalWeighIns: number
}

export interface NutritionConsistencyStats {
  loggedDaysCount: number
  totalDaysInRange: number
  loggingPercentage: number
  currentStreakDays: number
  longestStreakDays: number
}

export interface ConsistencyInsight {
  id: string
  category: 'frequency' | 'streak' | 'logging' | 'intermission'
  title: string
  message: string
  status: 'positive' | 'neutral' | 'info'
}

export interface InactivePeriod {
  startDate: string
  endDate: string
  durationDays: number
}

export interface ConsistencyStats {
  currentStreakDays: number
  longestStreakDays: number
  totalWorkoutDays: number
  totalNutritionDays: number
  averageWorkoutsPerWeek: number
  activityScores: DailyActivityScore[]
  // Phase 7.6 extensions
  currentWorkoutStreakDays?: number
  longestWorkoutStreakDays?: number
  currentNutritionStreakDays?: number
  longestNutritionStreakDays?: number
  totalWeighInDays?: number
  weeklySummaries?: WeeklyActivitySummary[]
  lifetimeStats?: LifetimeConsistencyStats
  nutritionConsistency?: NutritionConsistencyStats
  insights?: ConsistencyInsight[]
}

// ==============================================================================
// 5. Unified Analytics Bundle
// ==============================================================================

export interface AnalyticsDataBundle {
  timeframe: AnalyticsTimeframe
  startDate: string
  endDate: string
  body: BodyProgressStats
  weightTrend: WeightMovingAveragePoint[]
  workout: WorkoutAnalyticsStats
  nutrition: NutritionAnalyticsStats
  consistency: ConsistencyStats
}
