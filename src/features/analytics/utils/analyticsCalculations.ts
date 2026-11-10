/**
 * FORM Application — Phase 7: Analytics & Progress Intelligence
 * analyticsCalculations.ts
 * 
 * Pure, reusable calculation utilities for Body, Strength, Nutrition, and Consistency.
 * Strictly adheres to critical data rules:
 * - Excludes incomplete workout sets.
 * - Ignores e1RM estimates for sets above 10 reps.
 * - Never invents missing weight measurements.
 * - Never treats unlogged nutrition days as zero calories.
 * - Zero division guards on all calculations.
 * - Pure functions with zero React or DOM dependencies.
 */

import type {
  WeightMovingAveragePoint,
  PersonalRecord,
  WeeklyVolumePoint,
  MuscleGroupDistribution,
  MostImprovedExercise,
  DailyNutritionAggregate,
  CalorieMovingAveragePoint,
  NutritionInsight,
  MacroCaloriePercentages,
  MealCategoryDistribution,
  DailyActivityScore,
  WeeklyActivitySummary,
  LifetimeConsistencyStats,
  NutritionConsistencyStats,
  ConsistencyInsight,
  InactivePeriod,
} from '../types'
import type { WeightEntry } from '@/types'
import type { WorkoutSession, WorkoutSet, Exercise, MuscleGroup } from '@/types/workout'
import type { DbNutritionDay, DbNutritionMeal, DbNutritionFoodItem, MealCategory } from '@/features/nutrition/types'

// ==============================================================================
// Helper Date Utilities (Local Calendar, UTC-safe)
// ==============================================================================

/**
 * Normalizes an ISO date or timestamp string to local YYYY-MM-DD.
 */
export function toLocalDateString(isoOrTimestamp: string | Date): string {
  const d = typeof isoOrTimestamp === 'string' ? new Date(isoOrTimestamp) : isoOrTimestamp
  if (isNaN(d.getTime())) return ''
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * Returns the Monday start of the ISO calendar week for a given date string.
 */
export function getMondayOfWeek(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  const day = date.getDay()
  // Adjust so Monday is 0, Sunday is 6
  const diff = date.getDate() - day + (day === 0 ? -6 : 1)
  const monday = new Date(date.setDate(diff))
  return toLocalDateString(monday)
}

/**
 * Parses YYYY-MM-DD into a local Date object.
 */
export function parseLocalYmd(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d)
}

// ==============================================================================
// 1. Body Progress Analytics Calculations
// ==============================================================================

/**
 * Calculates a rolling 7-day Simple Moving Average for body weight entries.
 * Critical rule: Never invents missing measurements; averages only actual recorded weights.
 */
export function calculateWeightMovingAverage(
  entries: WeightEntry[],
  windowDays = 7
): WeightMovingAveragePoint[] {
  if (!entries || entries.length === 0) return []

  // 1. Filter valid entries and extract local date
  const validEntries = entries
    .filter((e) => typeof e.weight_kg === 'number' && e.weight_kg > 0 && e.measured_at)
    .map((e) => ({
      date: toLocalDateString(e.measured_at),
      weightKg: Number(e.weight_kg),
      isBaseline: Boolean(e.is_baseline),
      measuredAt: new Date(e.measured_at).getTime(),
    }))
    .filter((e) => Boolean(e.date) && !isNaN(e.measuredAt))

  if (validEntries.length === 0) return []

  // 2. Aggregate multiple weigh-ins on the same calendar day (mean of that day)
  const byDateMap = new Map<string, { totalWeight: number; count: number; isBaseline: boolean }>()
  for (const entry of validEntries) {
    const existing = byDateMap.get(entry.date)
    if (existing) {
      existing.totalWeight += entry.weightKg
      existing.count += 1
      existing.isBaseline = existing.isBaseline || entry.isBaseline
    } else {
      byDateMap.set(entry.date, {
        totalWeight: entry.weightKg,
        count: 1,
        isBaseline: entry.isBaseline,
      })
    }
  }

  // 3. Sort unique dates chronologically ascending
  const uniqueDates = Array.from(byDateMap.keys()).sort()
  const dailyPoints = uniqueDates.map((date) => {
    const item = byDateMap.get(date)!
    return {
      date,
      weightKg: Math.round((item.totalWeight / item.count) * 10) / 10,
      isBaseline: item.isBaseline,
    }
  })

  // 4. Calculate moving average for each recorded day using trailing windowDays
  return dailyPoints.map((point, index) => {
    const pointDate = parseLocalYmd(point.date).getTime()
    const windowStartMs = pointDate - (windowDays - 1) * 24 * 60 * 60 * 1000

    let windowSum = 0
    let windowCount = 0

    for (let i = 0; i <= index; i++) {
      const candidateDate = parseLocalYmd(dailyPoints[i].date).getTime()
      if (candidateDate >= windowStartMs && candidateDate <= pointDate) {
        windowSum += dailyPoints[i].weightKg
        windowCount++
      }
    }

    const movingAvg = windowCount > 0 ? Math.round((windowSum / windowCount) * 10) / 10 : null

    return {
      date: point.date,
      weightKg: point.weightKg,
      movingAvgKg: movingAvg,
      isBaseline: point.isBaseline,
    }
  })
}

/**
 * Calculates net weight change from baseline to current weight.
 */
export function calculateWeightChange(
  currentWeight: number | null,
  baselineWeight: number | null
): number | null {
  if (currentWeight === null || baselineWeight === null || currentWeight <= 0 || baselineWeight <= 0) {
    return null
  }
  return Math.round((currentWeight - baselineWeight) * 10) / 10
}

/**
 * Calculates the weekly rate of weight change (kg/week) over a recent window.
 * Negative indicates weight loss; positive indicates weight gain.
 */
export function calculateWeeklyWeightChangeRate(
  entries: WeightEntry[],
  daysLookback = 30
): number | null {
  const ma = calculateWeightMovingAverage(entries)
  if (ma.length < 2) return null

  const latest = ma[ma.length - 1]
  const latestMs = parseLocalYmd(latest.date).getTime()
  const cutoffMs = latestMs - daysLookback * 24 * 60 * 60 * 1000

  const windowPoints = ma.filter((p) => parseLocalYmd(p.date).getTime() >= cutoffMs)
  if (windowPoints.length < 2) return null

  const earliest = windowPoints[0]
  const deltaDays = (parseLocalYmd(latest.date).getTime() - parseLocalYmd(earliest.date).getTime()) / (24 * 60 * 60 * 1000)

  if (deltaDays < 2) return null

  const startWeight = earliest.movingAvgKg ?? earliest.weightKg
  const endWeight = latest.movingAvgKg ?? latest.weightKg
  const deltaWeight = endWeight - startWeight

  const ratePerWeek = (deltaWeight / deltaDays) * 7
  return Math.round(ratePerWeek * 100) / 100
}

/**
 * Calculates the goal progress percentage (0% to 100%).
 */
export function calculateGoalProgressPercentage(
  currentWeight: number | null,
  baselineWeight: number | null,
  goalWeight: number | null
): number | null {
  if (
    currentWeight === null ||
    baselineWeight === null ||
    goalWeight === null ||
    currentWeight <= 0 ||
    baselineWeight <= 0 ||
    goalWeight <= 0
  ) {
    return null
  }

  const totalDistance = Math.abs(baselineWeight - goalWeight)
  if (totalDistance < 0.1) return 100

  const isWeightLoss = baselineWeight > goalWeight
  const distanceCovered = isWeightLoss
    ? baselineWeight - currentWeight
    : currentWeight - baselineWeight

  if (distanceCovered <= 0) return 0
  if (distanceCovered >= totalDistance) return 100

  return Math.min(100, Math.max(0, Math.round((distanceCovered / totalDistance) * 100)))
}

/**
 * Projects the goal completion date based on current weight and weekly rate.
 * Returns null if rate is moving away from target or is zero.
 */
export function calculateProjectedCompletionDate(
  currentWeight: number | null,
  goalWeight: number | null,
  weeklyRateKg: number | null,
  fromDate: Date = new Date()
): string | null {
  if (
    currentWeight === null ||
    goalWeight === null ||
    weeklyRateKg === null ||
    currentWeight <= 0 ||
    goalWeight <= 0
  ) {
    return null
  }

  const distanceNeeded = Math.abs(currentWeight - goalWeight)
  if (distanceNeeded < 0.1) {
    return toLocalDateString(fromDate)
  }

  if (Math.abs(weeklyRateKg) < 0.02) {
    return null // Rate is too flat to project reliably
  }

  const isLossNeeded = currentWeight > goalWeight

  // Guard: If moving in the opposite direction, target is unreachable at current rate
  if (isLossNeeded && weeklyRateKg >= 0) return null
  if (!isLossNeeded && weeklyRateKg <= 0) return null

  const weeksNeeded = distanceNeeded / Math.abs(weeklyRateKg)
  if (weeksNeeded > 520) return null // Guard: >10 years

  const daysNeeded = Math.round(weeksNeeded * 7)
  const projectedMs = fromDate.getTime() + daysNeeded * 24 * 60 * 60 * 1000
  return toLocalDateString(new Date(projectedMs))
}

/**
 * Calculates Body Mass Index (BMI).
 */
export function calculateBmi(weightKg: number | null, heightCm: number | null): number | null {
  if (!weightKg || !heightCm || weightKg <= 0 || heightCm <= 0) return null
  const heightM = heightCm / 100
  const bmi = weightKg / (heightM * heightM)
  return Math.round(bmi * 10) / 10
}

// ==============================================================================
// 2. Strength & Workout Analytics Calculations
// ==============================================================================

/**
 * Calculates Estimated 1-Rep Max using the Epley formula: w * (1 + r / 30).
 * Critical rule: Ignore e1RM estimates for sets above 10 reps (returns load or 0).
 */
export function calculateEpley1Rm(weightKg: number, reps: number): number {
  if (weightKg <= 0 || reps <= 0) return 0
  if (reps === 1) return Math.round(weightKg * 10) / 10
  // Critical rule: Ignore e1RM estimates for sets above 10 reps
  if (reps > 10) {
    return Math.round(weightKg * 10) / 10
  }
  const e1rm = weightKg * (1 + reps / 30)
  return Math.round(e1rm * 10) / 10
}

/**
 * Calculates total volume for a list of workout sets.
 * Critical rule: Excludes incomplete sets (!is_completed).
 */
export function calculateTrainingVolume(sets: WorkoutSet[]): number {
  if (!sets || sets.length === 0) return 0
  return sets.reduce((total, s) => {
    if (!s.is_completed || !s.reps || s.reps <= 0 || !s.weight_kg || s.weight_kg <= 0) {
      return total
    }
    return total + s.weight_kg * s.reps
  }, 0)
}

/**
 * Aggregates workout sessions into weekly volume and completed set points.
 */
export function calculateWeeklyVolumeAggregation(
  sessions: WorkoutSession[]
): WeeklyVolumePoint[] {
  if (!sessions || sessions.length === 0) return []

  const completedSessions = sessions.filter((s) => s.completed_at)
  const weekMap = new Map<string, { volume: number; sets: number; workouts: number }>()

  for (const session of completedSessions) {
    const sessionDate = toLocalDateString(session.completed_at || session.started_at)
    if (!sessionDate) continue

    const monday = getMondayOfWeek(sessionDate)
    const validSets = (session.sets || []).filter((s) => s.is_completed && s.reps > 0)
    const sessionVolume = validSets.reduce((sum, s) => sum + (s.weight_kg || 0) * s.reps, 0)

    const existing = weekMap.get(monday) || { volume: 0, sets: 0, workouts: 0 }
    existing.volume += sessionVolume
    existing.sets += validSets.length
    existing.workouts += 1
    weekMap.set(monday, existing)
  }

  const sortedMondays = Array.from(weekMap.keys()).sort()
  return sortedMondays.map((monday) => {
    const data = weekMap.get(monday)!
    return {
      weekStartDate: monday,
      totalVolumeKg: Math.round(data.volume),
      completedSets: data.sets,
      completedWorkouts: data.workouts,
    }
  })
}

/**
 * Calculates set and volume distribution across muscle groups.
 * Critical rule: Excludes incomplete sets.
 */
export function calculateMuscleGroupDistribution(
  sets: WorkoutSet[],
  exercises: Exercise[]
): MuscleGroupDistribution[] {
  if (!sets || sets.length === 0) return []

  const exerciseMap = new Map<string, Exercise>()
  for (const ex of exercises) {
    exerciseMap.set(ex.id, ex)
  }

  const validSets = sets.filter((s) => s.is_completed && s.reps > 0)
  if (validSets.length === 0) return []

  const muscleMap = new Map<MuscleGroup, { sets: number; volume: number }>()
  const allGroups: MuscleGroup[] = ['chest', 'back', 'legs', 'shoulders', 'arms', 'core', 'full_body', 'other']

  for (const g of allGroups) {
    muscleMap.set(g, { sets: 0, volume: 0 })
  }

  for (const set of validSets) {
    const ex = set.exercise || exerciseMap.get(set.exercise_id)
    const group: MuscleGroup = ex?.muscle_group || 'other'
    const vol = (set.weight_kg || 0) * set.reps

    const current = muscleMap.get(group) || { sets: 0, volume: 0 }
    current.sets += 1
    current.volume += vol
    muscleMap.set(group, current)
  }

  const totalSets = validSets.length
  return allGroups
    .map((g) => {
      const data = muscleMap.get(g)!
      const percentage = totalSets > 0 ? Math.round((data.sets / totalSets) * 1000) / 10 : 0
      return {
        muscleGroup: g,
        sets: data.sets,
        percentage,
        volumeKg: Math.round(data.volume),
      }
    })
    .filter((g) => g.sets > 0)
    .sort((a, b) => b.sets - a.sets)
}

/**
 * Detects personal records (max weight, max e1RM <= 10 reps, max volume) per exercise.
 */
export function detectPersonalRecords(
  sessions: WorkoutSession[],
  exercises: Exercise[]
): PersonalRecord[] {
  if (!sessions || sessions.length === 0) return []

  const exerciseMap = new Map<string, Exercise>()
  for (const ex of exercises) {
    exerciseMap.set(ex.id, ex)
  }

  // Sort completed sessions strictly chronologically ascending
  const completedSessions = [...sessions]
    .filter((s) => Boolean(s.completed_at))
    .sort((a, b) => {
      const ta = new Date(a.completed_at || a.started_at).getTime()
      const tb = new Date(b.completed_at || b.started_at).getTime()
      return ta - tb
    })
  const prMap = new Map<string, PersonalRecord>()

  for (const session of completedSessions) {
    const sessionDate = toLocalDateString(session.completed_at || session.started_at)
    const validSets = (session.sets || []).filter(
      (s) => s.is_completed && s.reps > 0 && s.weight_kg > 0
    )

    for (const set of validSets) {
      const ex = set.exercise || exerciseMap.get(set.exercise_id)
      if (!ex) continue

      const e1rm = calculateEpley1Rm(set.weight_kg, set.reps)
      const setVol = set.weight_kg * set.reps

      const existing = prMap.get(ex.id)
      if (!existing) {
        prMap.set(ex.id, {
          exerciseId: ex.id,
          exerciseName: ex.name,
          muscleGroup: ex.muscle_group,
          maxWeightKg: set.weight_kg,
          max1RmKg: e1rm,
          maxVolumeKg: setVol,
          bestSetReps: set.reps,
          bestSetWeightKg: set.weight_kg,
          achievedAt: sessionDate,
        })
      } else {
        let isNewPr = false
        if (set.weight_kg > existing.maxWeightKg) {
          existing.maxWeightKg = set.weight_kg
          isNewPr = true
        }
        if (e1rm > existing.max1RmKg) {
          existing.max1RmKg = e1rm
          existing.bestSetReps = set.reps
          existing.bestSetWeightKg = set.weight_kg
          isNewPr = true
        }
        if (setVol > existing.maxVolumeKg) {
          existing.maxVolumeKg = setVol
        }
        if (isNewPr) {
          existing.achievedAt = sessionDate
        }
      }
    }
  }

  return Array.from(prMap.values()).sort((a, b) => a.exerciseName.localeCompare(b.exerciseName))
}

/**
 * Calculates the "Most Improved Exercise" based on chronological e1RM progression.
 * Requires sufficient comparable history: at least 2 distinct session dates with valid sets (reps > 0, weight > 0).
 * Returns null if no exercise has sufficient history with positive progression.
 */
export function calculateMostImprovedExercise(
  sessions: WorkoutSession[],
  exercises: Exercise[]
): MostImprovedExercise | null {
  if (!sessions || sessions.length === 0 || !exercises || exercises.length === 0) {
    return null
  }

  const exerciseMap = new Map<string, Exercise>()
  for (const ex of exercises) {
    exerciseMap.set(ex.id, ex)
  }

  // Sort completed sessions strictly chronologically ascending
  const completedSessions = [...sessions]
    .filter((s) => Boolean(s.completed_at))
    .sort((a, b) => {
      const ta = new Date(a.completed_at || a.started_at).getTime()
      const tb = new Date(b.completed_at || b.started_at).getTime()
      return ta - tb
    })

  if (completedSessions.length < 2) return null

  // Map each exercise to its chronological list of session e1RMs
  // Key: exerciseId -> Array<{ date: string; e1rm: number }>
  const exerciseHistory = new Map<string, Array<{ date: string; e1rm: number }>>()

  for (const session of completedSessions) {
    const sessionDate = toLocalDateString(session.completed_at || session.started_at)
    if (!sessionDate) continue

    const validSets = (session.sets || []).filter(
      (s) => s.is_completed && s.reps > 0 && s.weight_kg > 0
    )

    // Find top e1RM per exercise in this session
    const sessionExerciseE1rm = new Map<string, number>()
    for (const set of validSets) {
      const e1rm = calculateEpley1Rm(set.weight_kg, set.reps)
      if (e1rm <= 0) continue
      const current = sessionExerciseE1rm.get(set.exercise_id) || 0
      if (e1rm > current) {
        sessionExerciseE1rm.set(set.exercise_id, e1rm)
      }
    }

    for (const [exId, topE1rm] of sessionExerciseE1rm.entries()) {
      const list = exerciseHistory.get(exId) || []
      list.push({ date: sessionDate, e1rm: topE1rm })
      exerciseHistory.set(exId, list)
    }
  }

  let bestImprovement: MostImprovedExercise | null = null

  for (const [exId, points] of exerciseHistory.entries()) {
    // Sufficient comparable history requires >= 2 sessions with valid e1RM
    if (points.length < 2) continue

    const ex = exerciseMap.get(exId)
    if (!ex) continue

    const initial = points[0]
    if (initial.e1rm <= 0) continue

    // Find peak e1RM achieved across all subsequent points
    let peak = initial
    for (let i = 1; i < points.length; i++) {
      if (points[i].e1rm > peak.e1rm) {
        peak = points[i]
      }
    }

    const deltaKg = Math.round((peak.e1rm - initial.e1rm) * 10) / 10
    if (deltaKg <= 0) continue // Must have genuine positive progression

    const deltaPercent = Math.round(((peak.e1rm - initial.e1rm) / initial.e1rm) * 1000) / 10

    // Compare with current best (rank by percentage gain, tiebreak by absolute kg)
    if (
      !bestImprovement ||
      deltaPercent > bestImprovement.deltaPercent ||
      (deltaPercent === bestImprovement.deltaPercent && deltaKg > bestImprovement.deltaKg)
    ) {
      bestImprovement = {
        exerciseId: ex.id,
        exerciseName: ex.name,
        muscleGroup: ex.muscle_group,
        initial1RmKg: initial.e1rm,
        peak1RmKg: peak.e1rm,
        deltaKg,
        deltaPercent,
        sessionCount: points.length,
        baselineDate: initial.date,
        peakDate: peak.date,
      }
    }
  }

  return bestImprovement
}

// ==============================================================================
// 3. Nutrition Analytics Calculations
// ==============================================================================

/**
 * Calculates average calories strictly for logged days.
 * Critical rule: Never treats unlogged nutrition days as zero calories.
 */
export function calculateAverageLoggedCalories(days: DailyNutritionAggregate[]): number {
  if (!days || days.length === 0) return 0
  const loggedDays = days.filter((d) => d.calories > 0 || d.mealCount > 0)
  if (loggedDays.length === 0) return 0

  const sum = loggedDays.reduce((acc, d) => acc + d.calories, 0)
  return Math.round(sum / loggedDays.length)
}

/**
 * Calculates average macros across logged days.
 */
export function calculateAverageMacros(
  days: DailyNutritionAggregate[]
): { averageCalories: number; averageProteinG: number; averageCarbsG: number; averageFatG: number; averageFiberG: number } {
  if (!days || days.length === 0) {
    return { averageCalories: 0, averageProteinG: 0, averageCarbsG: 0, averageFatG: 0, averageFiberG: 0 }
  }

  const loggedDays = days.filter((d) => d.calories > 0 || d.mealCount > 0)
  if (loggedDays.length === 0) {
    return { averageCalories: 0, averageProteinG: 0, averageCarbsG: 0, averageFatG: 0, averageFiberG: 0 }
  }

  const count = loggedDays.length
  const calSum = loggedDays.reduce((a, d) => a + d.calories, 0)
  const pSum = loggedDays.reduce((a, d) => a + d.proteinG, 0)
  const cSum = loggedDays.reduce((a, d) => a + d.carbsG, 0)
  const fSum = loggedDays.reduce((a, d) => a + d.fatG, 0)
  const fibSum = loggedDays.reduce((a, d) => a + d.fiberG, 0)

  return {
    averageCalories: Math.round(calSum / count),
    averageProteinG: Math.round((pSum / count) * 10) / 10,
    averageCarbsG: Math.round((cSum / count) * 10) / 10,
    averageFatG: Math.round((fSum / count) * 10) / 10,
    averageFiberG: Math.round((fibSum / count) * 10) / 10,
  }
}

/**
 * Calculates a rolling moving average of daily calorie intake across logged days.
 * Critical rule: Never treats unlogged days as zero calories.
 */
export function calculateCalorieMovingAverage(
  days: DailyNutritionAggregate[],
  windowDays = 7
): CalorieMovingAveragePoint[] {
  if (!days || days.length === 0) return []

  const loggedDays = days
    .filter((d) => d.calories > 0 || d.mealCount > 0)
    .sort((a, b) => a.logDate.localeCompare(b.logDate))

  if (loggedDays.length === 0) return []

  return loggedDays.map((point, index) => {
    const pointDate = parseLocalYmd(point.logDate).getTime()
    const windowStartMs = pointDate - (windowDays - 1) * 24 * 60 * 60 * 1000

    let windowSum = 0
    let windowCount = 0

    for (let i = 0; i <= index; i++) {
      const candidateDate = parseLocalYmd(loggedDays[i].logDate).getTime()
      if (candidateDate >= windowStartMs && candidateDate <= pointDate) {
        windowSum += loggedDays[i].calories
        windowCount++
      }
    }

    const movingAvg = windowCount > 0 ? Math.round(windowSum / windowCount) : point.calories

    return {
      date: point.logDate,
      calories: point.calories,
      movingAvgCalories: movingAvg,
    }
  })
}

/**
 * Calculates calorie target adherence percentage within an allowable corridor.
 * Default corridor is +/- 10% of target calories.
 * Accurately tracks days below, within, and above target.
 */
export function calculateCalorieTargetAdherence(
  days: DailyNutritionAggregate[],
  tolerancePercent = 10
): {
  adherentDaysCount: number
  belowTargetDaysCount: number
  aboveTargetDaysCount: number
  totalLoggedDays: number
  targetAdherenceRate: number
} {
  if (!days || days.length === 0) {
    return {
      adherentDaysCount: 0,
      belowTargetDaysCount: 0,
      aboveTargetDaysCount: 0,
      totalLoggedDays: 0,
      targetAdherenceRate: 0,
    }
  }

  const loggedDaysWithTarget = days.filter(
    (d) => (d.calories > 0 || d.mealCount > 0) && typeof d.caloriesTarget === 'number' && d.caloriesTarget > 0
  )

  if (loggedDaysWithTarget.length === 0) {
    return {
      adherentDaysCount: 0,
      belowTargetDaysCount: 0,
      aboveTargetDaysCount: 0,
      totalLoggedDays: 0,
      targetAdherenceRate: 0,
    }
  }

  let adherentCount = 0
  let belowCount = 0
  let aboveCount = 0

  for (const day of loggedDaysWithTarget) {
    const target = day.caloriesTarget!
    const allowedDelta = target * (tolerancePercent / 100)
    const lowerBound = target - allowedDelta
    const upperBound = target + allowedDelta

    if (day.calories >= lowerBound && day.calories <= upperBound) {
      adherentCount++
    } else if (day.calories < lowerBound) {
      belowCount++
    } else {
      aboveCount++
    }
  }

  const rate = Math.round((adherentCount / loggedDaysWithTarget.length) * 1000) / 10
  return {
    adherentDaysCount: adherentCount,
    belowTargetDaysCount: belowCount,
    aboveTargetDaysCount: aboveCount,
    totalLoggedDays: loggedDaysWithTarget.length,
    targetAdherenceRate: rate,
  }
}

/**
 * Generates concise, factual, quantified nutrition insights based strictly on logged data.
 * Avoids medical claims and generic motivational text.
 */
export function generateNutritionInsights(params: {
  loggedDays: DailyNutritionAggregate[]
  averageCalories: number
  calorieTarget: number | null
  averageProteinG: number
  proteinTarget: number | null
  averageCarbsG: number
  carbsTarget: number | null
  averageFatG: number
  fatTarget: number | null
  averageFiberG: number
  macroPercentages: MacroCaloriePercentages
}): NutritionInsight[] {
  const {
    loggedDays,
    averageCalories,
    calorieTarget,
    averageProteinG,
    proteinTarget,
    averageCarbsG,
    carbsTarget,
    averageFatG,
    fatTarget,
    averageFiberG,
    macroPercentages,
  } = params

  if (!loggedDays || loggedDays.length < 3) {
    return []
  }

  const insights: NutritionInsight[] = []

  // 1. Calorie intake vs target
  if (calorieTarget && calorieTarget > 0) {
    const delta = averageCalories - calorieTarget
    const percentDelta = Math.round((Math.abs(delta) / calorieTarget) * 1000) / 10
    if (Math.abs(delta) <= calorieTarget * 0.05) {
      insights.push({
        id: 'calorie-alignment',
        category: 'calories',
        title: 'Caloric Intake Well-Aligned',
        message: `Your average intake of ${averageCalories.toLocaleString()} kcal is within ${Math.abs(delta)} kcal (${percentDelta}%) of your daily target of ${calorieTarget.toLocaleString()} kcal.`,
        status: 'positive',
      })
    } else if (delta < 0) {
      insights.push({
        id: 'calorie-deficit',
        category: 'calories',
        title: 'Caloric Intake Below Target',
        message: `Average daily intake of ${averageCalories.toLocaleString()} kcal is ${Math.abs(delta)} kcal (${percentDelta}%) below your ${calorieTarget.toLocaleString()} kcal target.`,
        status: percentDelta > 15 ? 'warning' : 'neutral',
      })
    } else {
      insights.push({
        id: 'calorie-surplus',
        category: 'calories',
        title: 'Caloric Intake Above Target',
        message: `Average daily intake of ${averageCalories.toLocaleString()} kcal is ${delta} kcal (+${percentDelta}%) above your ${calorieTarget.toLocaleString()} kcal target.`,
        status: percentDelta > 15 ? 'warning' : 'neutral',
      })
    }
  }

  // 2. Protein target consistency
  if (proteinTarget && proteinTarget > 0) {
    const daysMeetingProtein = loggedDays.filter((d) => d.proteinG >= proteinTarget * 0.9).length
    const proteinConsistencyRate = Math.round((daysMeetingProtein / loggedDays.length) * 100)
    const deltaG = Math.round((averageProteinG - proteinTarget) * 10) / 10

    if (proteinConsistencyRate >= 75) {
      insights.push({
        id: 'protein-consistency',
        category: 'protein',
        title: 'Strong Protein Consistency',
        message: `Met or neared (≥90%) your ${proteinTarget}g protein target on ${daysMeetingProtein} of ${loggedDays.length} logged days (${proteinConsistencyRate}%). Average intake is ${averageProteinG}g.`,
        status: 'positive',
      })
    } else {
      insights.push({
        id: 'protein-consistency',
        category: 'protein',
        title: 'Protein Target Gap',
        message: `Average protein intake is ${averageProteinG}g vs your ${proteinTarget}g target (${deltaG < 0 ? `${deltaG}g` : `+${deltaG}g`}). Target achieved on ${daysMeetingProtein} of ${loggedDays.length} logged days (${proteinConsistencyRate}%).`,
        status: 'warning',
      })
    }
  }

  // 3. Macro balance relative to targets
  if (calorieTarget && calorieTarget > 0 && proteinTarget && carbsTarget && fatTarget) {
    const targetProteinKcal = proteinTarget * 4
    const targetCarbsKcal = carbsTarget * 4
    const targetFatKcal = fatTarget * 9
    const totalTargetKcal = targetProteinKcal + targetCarbsKcal + targetFatKcal
    if (totalTargetKcal > 0) {
      const targetProteinPct = Math.round((targetProteinKcal / totalTargetKcal) * 100)
      const targetFatPct = Math.round((targetFatKcal / totalTargetKcal) * 100)
      const targetCarbsPct = Math.round((targetCarbsKcal / totalTargetKcal) * 100)

      const fatDiff = macroPercentages.fatPercent - targetFatPct
      if (Math.abs(fatDiff) > 8) {
        insights.push({
          id: 'macro-balance',
          category: 'macros',
          title: fatDiff > 0 ? 'Elevated Fat Proportion' : 'Lower Fat Proportion',
          message: `Fats contribute ${macroPercentages.fatPercent}% (${averageFatG}g) of your energy intake compared to your configured ${targetFatPct}% macro target (Carbs: ${macroPercentages.carbsPercent}% (${averageCarbsG}g) vs ${targetCarbsPct}%, Protein: ${macroPercentages.proteinPercent}% (${averageProteinG}g) vs ${targetProteinPct}%).`,
          status: 'neutral',
        })
      } else {
        insights.push({
          id: 'macro-balance',
          category: 'macros',
          title: 'Macro Distribution Balanced',
          message: `Macro distribution closely tracks configured targets: ${macroPercentages.proteinPercent}% Protein (${averageProteinG}g vs target ${targetProteinPct}%), ${macroPercentages.carbsPercent}% Carbs (${averageCarbsG}g vs target ${targetCarbsPct}%), ${macroPercentages.fatPercent}% Fat (${averageFatG}g vs target ${targetFatPct}%).`,
          status: 'positive',
        })
      }
    }
  }

  // 4. Fibre trend
  const fiberBenchmark = 30 // standard guideline (g/day)
  const fiberRatio = Math.round((averageFiberG / fiberBenchmark) * 100)
  if (averageFiberG >= 25) {
    insights.push({
      id: 'fiber-intake',
      category: 'fiber',
      title: 'Adequate Dietary Fibre',
      message: `Average fibre intake is ${averageFiberG}g/day, achieving ${fiberRatio}% of the 30g daily general dietary guideline.`,
      status: 'positive',
    })
  } else {
    insights.push({
      id: 'fiber-intake',
      category: 'fiber',
      title: 'Fibre Below 30g Benchmark',
      message: `Average fibre intake is ${averageFiberG}g/day (${fiberRatio}% of the 30g daily reference guideline). Increasing legumes, whole grains, and vegetables will improve this.`,
      status: 'neutral',
    })
  }

  // 5. Caloric intake change over time (if >= 6 logged days)
  if (loggedDays.length >= 6) {
    const half = Math.floor(loggedDays.length / 2)
    const firstHalf = loggedDays.slice(0, half)
    const secondHalf = loggedDays.slice(half)

    const firstAvg = Math.round(firstHalf.reduce((s, d) => s + d.calories, 0) / firstHalf.length)
    const secondAvg = Math.round(secondHalf.reduce((s, d) => s + d.calories, 0) / secondHalf.length)
    const diff = secondAvg - firstAvg

    if (Math.abs(diff) >= 50) {
      insights.push({
        id: 'intake-trajectory',
        category: 'trajectory',
        title: diff > 0 ? 'Caloric Intake Trending Up' : 'Caloric Intake Trending Down',
        message: `Recent logged intake averaged ${secondAvg.toLocaleString()} kcal/day compared to ${firstAvg.toLocaleString()} kcal/day earlier in this timeframe (${diff > 0 ? `+${diff}` : diff} kcal shift).`,
        status: 'neutral',
      })
    } else {
      insights.push({
        id: 'intake-trajectory',
        category: 'trajectory',
        title: 'Stable Caloric Trajectory',
        message: `Daily intake has remained stable throughout this window, averaging ${secondAvg.toLocaleString()} kcal recently vs ${firstAvg.toLocaleString()} kcal earlier (within ${Math.abs(diff)} kcal).`,
        status: 'positive',
      })
    }
  }

  return insights
}

/**
 * Calculates percentage of calories derived from Protein (4 kcal/g), Carbs (4 kcal/g), and Fat (9 kcal/g).
 */
export function calculateMacroCaloriePercentages(
  proteinG: number,
  carbsG: number,
  fatG: number
): MacroCaloriePercentages {
  const pKcal = Math.max(0, proteinG) * 4
  const cKcal = Math.max(0, carbsG) * 4
  const fKcal = Math.max(0, fatG) * 9
  const total = pKcal + cKcal + fKcal

  if (total <= 0) {
    return { proteinPercent: 0, carbsPercent: 0, fatPercent: 0 }
  }

  return {
    proteinPercent: Math.round((pKcal / total) * 1000) / 10,
    carbsPercent: Math.round((cKcal / total) * 1000) / 10,
    fatPercent: Math.round((fKcal / total) * 1000) / 10,
  }
}

/**
 * Calculates caloric distribution across standard meal categories.
 */
export function calculateMealCategoryDistribution(
  meals: DbNutritionMeal[],
  items: DbNutritionFoodItem[]
): MealCategoryDistribution[] {
  const categories: MealCategory[] = ['breakfast', 'lunch', 'dinner', 'snack']
  const map = new Map<MealCategory, { calories: number; count: number }>()

  for (const cat of categories) {
    map.set(cat, { calories: 0, count: 0 })
  }

  const mealMap = new Map<string, DbNutritionMeal>()
  for (const m of meals) {
    mealMap.set(m.id, m)
    const current = map.get(m.category) || { calories: 0, count: 0 }
    current.count += 1
    map.set(m.category, current)
  }

  for (const item of items) {
    const parentMeal = mealMap.get(item.meal_id)
    if (parentMeal) {
      const current = map.get(parentMeal.category) || { calories: 0, count: 0 }
      current.calories += Number(item.calories) || 0
      map.set(parentMeal.category, current)
    }
  }

  const totalCalories = Array.from(map.values()).reduce((sum, v) => sum + v.calories, 0)

  return categories.map((cat) => {
    const data = map.get(cat)!
    const percentage = totalCalories > 0 ? Math.round((data.calories / totalCalories) * 1000) / 10 : 0
    return {
      category: cat,
      calories: Math.round(data.calories),
      percentage,
      mealCount: data.count,
    }
  })
}

// ==============================================================================
// 4. Consistency & Activity Analytics Calculations
// ==============================================================================

/**
 * Generates an array of daily activity scores across a given local date range.
 * Score:
 * 3 = Workout completed AND Nutrition logged
 * 2 = Workout completed OR Nutrition logged
 * 1 = Weight logged only
 * 0 = Inactive
 */
export function calculateDailyActivityScores(
  startDate: string,
  endDate: string,
  sessions: WorkoutSession[],
  nutritionDays: DbNutritionDay[],
  weightEntries: WeightEntry[]
): DailyActivityScore[] {
  if (!startDate || !endDate) return []

  // Build lookup sets of dates
  const workoutDates = new Set<string>()
  for (const s of sessions) {
    if (s.completed_at) {
      const d = toLocalDateString(s.completed_at)
      if (d) workoutDates.add(d)
    }
  }

  const nutritionDates = new Set<string>()
  for (const nd of nutritionDays) {
    if (nd.log_date) nutritionDates.add(nd.log_date)
  }

  const weightDates = new Set<string>()
  for (const w of weightEntries) {
    if (w.measured_at) {
      const d = toLocalDateString(w.measured_at)
      if (d) weightDates.add(d)
    }
  }

  // Iterate day by day from startDate to endDate
  const scores: DailyActivityScore[] = []
  const current = parseLocalYmd(startDate)
  const end = parseLocalYmd(endDate)

  while (current.getTime() <= end.getTime()) {
    const dateStr = toLocalDateString(current)
    const workoutCompleted = workoutDates.has(dateStr)
    const nutritionLogged = nutritionDates.has(dateStr)
    const weightLogged = weightDates.has(dateStr)

    let score = 0
    if (workoutCompleted && nutritionLogged) {
      score = 3
    } else if (workoutCompleted || nutritionLogged) {
      score = 2
    } else if (weightLogged) {
      score = 1
    }

    scores.push({
      date: dateStr,
      workoutCompleted,
      nutritionLogged,
      weightLogged,
      score,
    })

    current.setDate(current.getDate() + 1)
  }

  return scores
}

/**
 * Calculates current streak and longest streak of consecutive active days (score >= 1).
 */
export function calculateActivityStreaks(
  scores: DailyActivityScore[],
  referenceDate: Date = new Date()
): { currentStreakDays: number; longestStreakDays: number } {
  if (!scores || scores.length === 0) {
    return { currentStreakDays: 0, longestStreakDays: 0 }
  }

  const sorted = [...scores].sort((a, b) => a.date.localeCompare(b.date))

  // Longest streak
  let longest = 0
  let currentRun = 0

  for (const day of sorted) {
    if (day.score >= 1) {
      currentRun++
      if (currentRun > longest) longest = currentRun
    } else {
      currentRun = 0
    }
  }

  // Current streak counting backwards from today or yesterday
  const scoreMap = new Map<string, number>()
  for (const day of sorted) {
    scoreMap.set(day.date, day.score)
  }

  const checkDate = new Date(referenceDate)
  let checkStr = toLocalDateString(checkDate)

  // If today has no activity yet, start streak evaluation from yesterday
  if ((scoreMap.get(checkStr) || 0) < 1) {
    checkDate.setDate(checkDate.getDate() - 1)
    checkStr = toLocalDateString(checkDate)
  }

  let currentStreak = 0
  while (true) {
    const score = scoreMap.get(checkStr) || 0
    if (score >= 1) {
      currentStreak++
      checkDate.setDate(checkDate.getDate() - 1)
      checkStr = toLocalDateString(checkDate)
    } else {
      break
    }
  }

  return {
    currentStreakDays: currentStreak,
    longestStreakDays: longest,
  }
}

/**
 * Calculates weekly workout frequency over a lookback window.
 */
export function calculateWeeklyWorkoutFrequency(
  sessions: WorkoutSession[],
  lookbackWeeks = 4
): { currentWeekCount: number; averageWeeklyCount: number } {
  if (!sessions || sessions.length === 0) {
    return { currentWeekCount: 0, averageWeeklyCount: 0 }
  }

  const todayStr = toLocalDateString(new Date())
  const currentWeekMonday = getMondayOfWeek(todayStr)

  const completedSessions = sessions.filter((s) => s.completed_at)
  const weekMap = new Map<string, number>()

  for (const s of completedSessions) {
    const sDate = toLocalDateString(s.completed_at || s.started_at)
    if (!sDate) continue
    const monday = getMondayOfWeek(sDate)
    weekMap.set(monday, (weekMap.get(monday) || 0) + 1)
  }

  const currentWeekCount = weekMap.get(currentWeekMonday) || 0

  // Take recent lookbackWeeks
  const allWeeks = Array.from(weekMap.keys()).sort().reverse()
  const recentWeeks = allWeeks.slice(0, lookbackWeeks)

  if (recentWeeks.length === 0) {
    return { currentWeekCount, averageWeeklyCount: currentWeekCount }
  }

  const sum = recentWeeks.reduce((acc, w) => acc + (weekMap.get(w) || 0), 0)
  const avg = Math.round((sum / recentWeeks.length) * 10) / 10

  return {
    currentWeekCount,
    averageWeeklyCount: avg,
  }
}

/**
 * Calculates current and longest streak of consecutive calendar days with a completed workout.
 * A workout day counts ONLY when a workout session has completed_at timestamp.
 * Current streak remains active if a workout occurred today or yesterday.
 */
export function calculateWorkoutStreaks(
  sessions: WorkoutSession[],
  referenceDate: Date = new Date()
): { currentStreakDays: number; longestStreakDays: number } {
  if (!sessions || sessions.length === 0) {
    return { currentStreakDays: 0, longestStreakDays: 0 }
  }

  const completedDates = new Set<string>()
  for (const s of sessions) {
    if (s.completed_at) {
      const d = toLocalDateString(s.completed_at)
      if (d) completedDates.add(d)
    }
  }

  if (completedDates.size === 0) {
    return { currentStreakDays: 0, longestStreakDays: 0 }
  }

  const sortedDates = Array.from(completedDates).sort()

  // Longest streak: consecutive calendar days
  let longest = 0
  let currentRun = 0
  let prevTime: number | null = null

  for (const dateStr of sortedDates) {
    const curTime = parseLocalYmd(dateStr).getTime()
    if (prevTime === null) {
      currentRun = 1
    } else {
      const diffDays = Math.round((curTime - prevTime) / (1000 * 60 * 60 * 24))
      if (diffDays === 1) {
        currentRun++
      } else if (diffDays > 1) {
        currentRun = 1
      }
    }
    if (currentRun > longest) {
      longest = currentRun
    }
    prevTime = curTime
  }

  // Current streak counting backwards from today or yesterday
  const todayStr = toLocalDateString(referenceDate)
  const checkDate = new Date(referenceDate)

  // If today has no completed workout yet, check if yesterday had one
  if (!completedDates.has(todayStr)) {
    checkDate.setDate(checkDate.getDate() - 1)
  }

  let currentStreak = 0
  while (true) {
    const checkStr = toLocalDateString(checkDate)
    if (completedDates.has(checkStr)) {
      currentStreak++
      checkDate.setDate(checkDate.getDate() - 1)
    } else {
      break
    }
  }

  return {
    currentStreakDays: currentStreak,
    longestStreakDays: longest,
  }
}

/**
 * Calculates current and longest streak of consecutive calendar days with logged nutrition.
 * A nutrition day counts ONLY when food items are actually logged (calories > 0 or meals have items).
 * Current streak remains active if logged today or yesterday.
 */
export function calculateNutritionStreaks(
  nutritionDays: Array<{ log_date?: string; logDate?: string; calories?: number; meals?: Array<{ items?: unknown[] }> } | DbNutritionDay>,
  referenceDate: Date = new Date()
): { currentStreakDays: number; longestStreakDays: number } {
  if (!nutritionDays || nutritionDays.length === 0) {
    return { currentStreakDays: 0, longestStreakDays: 0 }
  }

  const loggedDates = new Set<string>()
  for (const item of nutritionDays) {
    let dateStr = ''
    if ('log_date' in item && item.log_date) dateStr = item.log_date
    else if ('logDate' in item && item.logDate) dateStr = item.logDate

    if (!dateStr) continue

    // Verify actual food was logged
    let hasFood = true
    if ('meals' in item && Array.isArray(item.meals)) {
      hasFood = item.meals.some((m) => m.items && m.items.length > 0)
    } else if ('calories' in item && typeof item.calories === 'number') {
      hasFood = item.calories > 0
    }

    if (hasFood) {
      loggedDates.add(dateStr)
    }
  }

  if (loggedDates.size === 0) {
    return { currentStreakDays: 0, longestStreakDays: 0 }
  }

  const sortedDates = Array.from(loggedDates).sort()

  let longest = 0
  let currentRun = 0
  let prevTime: number | null = null

  for (const dateStr of sortedDates) {
    const curTime = parseLocalYmd(dateStr).getTime()
    if (prevTime === null) {
      currentRun = 1
    } else {
      const diffDays = Math.round((curTime - prevTime) / (1000 * 60 * 60 * 24))
      if (diffDays === 1) {
        currentRun++
      } else if (diffDays > 1) {
        currentRun = 1
      }
    }
    if (currentRun > longest) {
      longest = currentRun
    }
    prevTime = curTime
  }

  const todayStr = toLocalDateString(referenceDate)
  const checkDate = new Date(referenceDate)

  if (!loggedDates.has(todayStr)) {
    checkDate.setDate(checkDate.getDate() - 1)
  }

  let currentStreak = 0
  while (true) {
    const checkStr = toLocalDateString(checkDate)
    if (loggedDates.has(checkStr)) {
      currentStreak++
      checkDate.setDate(checkDate.getDate() - 1)
    } else {
      break
    }
  }

  return {
    currentStreakDays: currentStreak,
    longestStreakDays: longest,
  }
}

/**
 * Aggregates weekly consistency and workload summaries across a date range.
 * Each week runs Monday to Sunday.
 */
export function calculateWeeklyActivitySummaries(
  startDate: string,
  endDate: string,
  sessions: WorkoutSession[],
  nutritionDays: Array<{ log_date?: string; logDate?: string; calories?: number; meals?: Array<{ items?: unknown[] }> } | DbNutritionDay>,
  weightEntries: WeightEntry[]
): WeeklyActivitySummary[] {
  if (!startDate || !endDate) return []

  const startMonday = getMondayOfWeek(startDate)
  const endMonday = getMondayOfWeek(endDate)

  // Map completed workouts by local date
  const workoutsByDate = new Map<string, WorkoutSession[]>()
  for (const s of sessions || []) {
    if (s.completed_at) {
      const d = toLocalDateString(s.completed_at)
      if (d) {
        const arr = workoutsByDate.get(d) || []
        arr.push(s)
        workoutsByDate.set(d, arr)
      }
    }
  }

  // Nutrition logged dates set
  const nutritionDates = new Set<string>()
  for (const item of nutritionDays || []) {
    let dateStr = ''
    if ('log_date' in item && item.log_date) dateStr = item.log_date
    else if ('logDate' in item && item.logDate) dateStr = item.logDate
    if (!dateStr) continue

    let hasFood = true
    if ('meals' in item && Array.isArray(item.meals)) {
      hasFood = item.meals.some((m) => m.items && m.items.length > 0)
    } else if ('calories' in item && typeof item.calories === 'number') {
      hasFood = item.calories > 0
    }
    if (hasFood) nutritionDates.add(dateStr)
  }

  // Weigh-in dates set
  const weightDates = new Set<string>()
  for (const w of weightEntries || []) {
    if (w.measured_at) {
      const d = toLocalDateString(w.measured_at)
      if (d) weightDates.add(d)
    }
  }

  const summaries: WeeklyActivitySummary[] = []
  const cursor = parseLocalYmd(startMonday)
  const lastMonday = parseLocalYmd(endMonday)

  while (cursor.getTime() <= lastMonday.getTime()) {
    const mondayStr = toLocalDateString(cursor)
    const sunday = new Date(cursor)
    sunday.setDate(sunday.getDate() + 6)
    const sundayStr = toLocalDateString(sunday)

    let completedWorkouts = 0
    let nutritionLoggedDays = 0
    let weighInDays = 0
    let completedWorkingSets = 0
    let totalTrainingVolumeKg = 0

    // Iterate the 7 days of this week
    const dayCursor = new Date(cursor)
    for (let d = 0; d < 7; d++) {
      const dayStr = toLocalDateString(dayCursor)

      const daySessions = workoutsByDate.get(dayStr) || []
      completedWorkouts += daySessions.length
      for (const s of daySessions) {
        for (const set of s.sets || []) {
          if (set.is_completed && (set.reps || 0) > 0) {
            completedWorkingSets++
            totalTrainingVolumeKg += (Number(set.weight_kg) || 0) * Number(set.reps)
          }
        }
      }

      if (nutritionDates.has(dayStr)) {
        nutritionLoggedDays++
      }

      if (weightDates.has(dayStr)) {
        weighInDays++
      }

      dayCursor.setDate(dayCursor.getDate() + 1)
    }

    // Friendly week label: e.g. "Oct 27 - Nov 02"
    const mDate = parseLocalYmd(mondayStr)
    const sDate = parseLocalYmd(sundayStr)
    const mLabel = mDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    const sLabel = sDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    const label = `${mLabel} - ${sLabel}`

    summaries.push({
      weekStartDate: mondayStr,
      weekEndDate: sundayStr,
      label,
      completedWorkouts,
      nutritionLoggedDays,
      weighInDays,
      completedWorkingSets,
      totalTrainingVolumeKg: Math.round(totalTrainingVolumeKg),
    })

    cursor.setDate(cursor.getDate() + 7)
  }

  return summaries
}

/**
 * Calculates nutrition logging consistency metrics across a timeframe window.
 * Strictly adheres to rule: unlogged days are NOT counted as zero calories.
 */
export function calculateNutritionConsistency(
  startDate: string,
  endDate: string,
  nutritionDays: Array<{ log_date?: string; logDate?: string; calories?: number; meals?: Array<{ items?: unknown[] }> } | DbNutritionDay>,
  referenceDate: Date = new Date()
): NutritionConsistencyStats {
  if (!startDate || !endDate) {
    return {
      loggedDaysCount: 0,
      totalDaysInRange: 0,
      loggingPercentage: 0,
      currentStreakDays: 0,
      longestStreakDays: 0,
    }
  }

  const sTime = parseLocalYmd(startDate).getTime()
  const eTime = parseLocalYmd(endDate).getTime()
  const totalDaysInRange = Math.max(1, Math.round((eTime - sTime) / (1000 * 60 * 60 * 24)) + 1)

  const loggedDaysSet = new Set<string>()
  for (const item of nutritionDays || []) {
    let dateStr = ''
    if ('log_date' in item && item.log_date) dateStr = item.log_date
    else if ('logDate' in item && item.logDate) dateStr = item.logDate
    if (!dateStr || dateStr < startDate || dateStr > endDate) continue

    let hasFood = true
    if ('meals' in item && Array.isArray(item.meals)) {
      hasFood = item.meals.some((m) => m.items && m.items.length > 0)
    } else if ('calories' in item && typeof item.calories === 'number') {
      hasFood = item.calories > 0
    }
    if (hasFood) loggedDaysSet.add(dateStr)
  }

  const loggedDaysCount = loggedDaysSet.size
  const loggingPercentage = Math.round((loggedDaysCount / totalDaysInRange) * 1000) / 10

  const { currentStreakDays, longestStreakDays } = calculateNutritionStreaks(nutritionDays, referenceDate)

  return {
    loggedDaysCount,
    totalDaysInRange,
    loggingPercentage,
    currentStreakDays,
    longestStreakDays,
  }
}

/**
 * Calculates all-time milestone statistics from authentic recorded history.
 */
export function calculateLifetimeConsistencyStats(
  sessions: WorkoutSession[],
  nutritionDays: Array<{ log_date?: string; logDate?: string; calories?: number; meals?: Array<{ items?: unknown[] }> } | DbNutritionDay>,
  weightEntries: WeightEntry[],
  allTimeNutritionCount?: number
): LifetimeConsistencyStats {
  const completedSessions = (sessions || []).filter((s) => Boolean(s.completed_at))
  const lifetimeCompletedWorkouts = completedSessions.length

  let lifetimeWorkingSets = 0
  let lifetimeTrainingVolumeKg = 0

  for (const s of completedSessions) {
    for (const set of s.sets || []) {
      if (set.is_completed && (set.reps || 0) > 0) {
        lifetimeWorkingSets++
        lifetimeTrainingVolumeKg += (Number(set.weight_kg) || 0) * Number(set.reps)
      }
    }
  }

  let totalNutritionDays: number
  if (typeof allTimeNutritionCount === 'number') {
    totalNutritionDays = allTimeNutritionCount
  } else {
    const dates = new Set<string>()
    for (const item of nutritionDays || []) {
      let dateStr = ''
      if ('log_date' in item && item.log_date) dateStr = item.log_date
      else if ('logDate' in item && item.logDate) dateStr = item.logDate
      if (!dateStr) continue

      let hasFood = true
      if ('meals' in item && Array.isArray(item.meals)) {
        hasFood = item.meals.some((m) => m.items && m.items.length > 0)
      } else if ('calories' in item && typeof item.calories === 'number') {
        hasFood = item.calories > 0
      }
      if (hasFood) dates.add(dateStr)
    }
    totalNutritionDays = dates.size
  }

  return {
    lifetimeCompletedWorkouts,
    lifetimeWorkingSets,
    lifetimeTrainingVolumeKg: Math.round(lifetimeTrainingVolumeKg),
    totalNutritionDays,
    totalWeighIns: (weightEntries || []).length,
  }
}

/**
 * Identifies intermissions / rest periods between completed workouts without judgement.
 * Minimum threshold defaults to 3 days.
 */
export function detectWorkoutInactivePeriods(
  sessions: WorkoutSession[],
  minRestDays = 3
): InactivePeriod[] {
  const completed = (sessions || []).filter((s) => Boolean(s.completed_at))
  if (completed.length < 2) return []

  // Extract unique sorted workout dates
  const dates = Array.from(
    new Set(completed.map((s) => toLocalDateString(s.completed_at!)).filter(Boolean))
  ).sort()

  const periods: InactivePeriod[] = []

  for (let i = 1; i < dates.length; i++) {
    const prevDate = parseLocalYmd(dates[i - 1])
    const currDate = parseLocalYmd(dates[i])
    const diffDays = Math.round((currDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24))

    // If there are at least minRestDays without a workout between sessions
    if (diffDays >= minRestDays + 1) {
      const restStart = new Date(prevDate)
      restStart.setDate(restStart.getDate() + 1)
      const restEnd = new Date(currDate)
      restEnd.setDate(restEnd.getDate() - 1)

      periods.push({
        startDate: toLocalDateString(restStart),
        endDate: toLocalDateString(restEnd),
        durationDays: diffDays - 1,
      })
    }
  }

  // Return sorted descending (most recent first)
  return periods.reverse()
}

/**
 * Generates factual, objective consistency insights based on verified athlete history.
 * Avoids judgemental language or unsupported conclusions.
 */
export function generateConsistencyInsights(params: {
  weeklySummaries: WeeklyActivitySummary[]
  workoutStreaks: { currentStreakDays: number; longestStreakDays: number }
  nutritionStreaks: { currentStreakDays: number; longestStreakDays: number }
  nutritionConsistency: NutritionConsistencyStats
  inactivePeriods: InactivePeriod[]
  averageWeeklyWorkouts: number
}): ConsistencyInsight[] {
  const {
    weeklySummaries,
    workoutStreaks,
    nutritionStreaks,
    nutritionConsistency,
    inactivePeriods,
    averageWeeklyWorkouts,
  } = params

  const insights: ConsistencyInsight[] = []

  // 1. Changes in weekly workout frequency
  if (weeklySummaries.length >= 4) {
    const recent2 = weeklySummaries.slice(-2)
    const prior2 = weeklySummaries.slice(-4, -2)

    const recentAvg = Math.round(((recent2[0].completedWorkouts + recent2[1].completedWorkouts) / 2) * 10) / 10
    const priorAvg = Math.round(((prior2[0].completedWorkouts + prior2[1].completedWorkouts) / 2) * 10) / 10
    const diff = Math.round((recentAvg - priorAvg) * 10) / 10

    if (diff >= 0.5) {
      insights.push({
        id: 'freq-increase',
        category: 'frequency',
        title: 'Workout Frequency Increase',
        message: `Weekly training frequency increased to an average of ${recentAvg} sessions per week over the last 2 weeks (compared to ${priorAvg} previously).`,
        status: 'positive',
      })
    } else if (diff <= -0.5) {
      insights.push({
        id: 'freq-shift',
        category: 'frequency',
        title: 'Workout Frequency Shift',
        message: `Training frequency averaged ${recentAvg} sessions per week over the last 2 weeks compared to ${priorAvg} in the prior period.`,
        status: 'neutral',
      })
    } else {
      insights.push({
        id: 'freq-stable',
        category: 'frequency',
        title: 'Steady Training Cadence',
        message: `Weekly workout frequency has held steady at an average of ${recentAvg} sessions per week over recent weeks.`,
        status: 'positive',
      })
    }
  } else if (averageWeeklyWorkouts > 0) {
    insights.push({
      id: 'freq-baseline',
      category: 'frequency',
      title: 'Workout Cadence',
      message: `Athlete is maintaining an average of ${averageWeeklyWorkouts} workout sessions per week.`,
      status: 'neutral',
    })
  }

  // 2. Improvements or status in logging consistency
  if (nutritionConsistency.totalDaysInRange >= 7) {
    const pct = nutritionConsistency.loggingPercentage
    if (pct >= 80) {
      insights.push({
        id: 'nutrition-high-coverage',
        category: 'logging',
        title: 'High Nutrition Logging Consistency',
        message: `Food intake was logged on ${nutritionConsistency.loggedDaysCount} of ${nutritionConsistency.totalDaysInRange} days (${pct}% coverage), ensuring reliable energy and macro tracking.`,
        status: 'positive',
      })
    } else if (pct >= 50) {
      insights.push({
        id: 'nutrition-moderate-coverage',
        category: 'logging',
        title: 'Moderate Logging Coverage',
        message: `Nutrition logged on ${nutritionConsistency.loggedDaysCount} of ${nutritionConsistency.totalDaysInRange} days (${pct}%). Logging on additional days sharpens calorie and macro trends.`,
        status: 'neutral',
      })
    } else if (pct > 0) {
      insights.push({
        id: 'nutrition-sparse-coverage',
        category: 'logging',
        title: 'Partial Logging Coverage',
        message: `Food logged on ${nutritionConsistency.loggedDaysCount} days in this timeframe. Calculations exclude unlogged days to maintain average integrity.`,
        status: 'info',
      })
    }
  }

  // 3. Longest active periods
  if (workoutStreaks.longestStreakDays >= 3) {
    insights.push({
      id: 'streak-workout',
      category: 'streak',
      title: 'Sustained Workout Streak',
      message: `Your longest consecutive training sequence reached ${workoutStreaks.longestStreakDays} days with completed sessions.`,
      status: 'positive',
    })
  }

  if (nutritionStreaks.longestStreakDays >= 5) {
    insights.push({
      id: 'streak-nutrition',
      category: 'streak',
      title: 'Nutrition Logging Streak',
      message: `Your longest consecutive daily nutrition log spanned ${nutritionStreaks.longestStreakDays} days.`,
      status: 'positive',
    })
  }

  // 4. Gaps in activity (factual, non-judgmental)
  if (inactivePeriods.length > 0) {
    const latestGap = inactivePeriods[0]
    insights.push({
      id: 'intermission-recent',
      category: 'intermission',
      title: 'Training Intermission Recorded',
      message: `A ${latestGap.durationDays}-day rest and recovery interval occurred from ${latestGap.startDate} to ${latestGap.endDate}.`,
      status: 'neutral',
    })
  }

  return insights
}
