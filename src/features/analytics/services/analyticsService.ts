/**
 * FORM Application — Phase 7: Analytics & Progress Intelligence
 * analyticsService.ts
 * 
 * User-scoped data retrieval and coordination service for Analytics.
 * Respects Row Level Security (RLS) with authenticated Supabase queries.
 * Integrates directly with pure calculation utilities.
 */

import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import type {
  AnalyticsTimeframe,
  AnalyticsDataBundle,
  DailyNutritionAggregate,
} from '../types'
import {
  toLocalDateString,
  calculateWeightMovingAverage,
  calculateWeightChange,
  calculateWeeklyWeightChangeRate,
  calculateGoalProgressPercentage,
  calculateProjectedCompletionDate,
  calculateBmi,
  calculateWeeklyVolumeAggregation,
  calculateMuscleGroupDistribution,
  detectPersonalRecords,
  calculateMostImprovedExercise,
  calculateAverageLoggedCalories,
  calculateAverageMacros,
  calculateCalorieTargetAdherence,
  calculateMacroCaloriePercentages,
  calculateMealCategoryDistribution,
  generateNutritionInsights,
  calculateDailyActivityScores,
  calculateActivityStreaks,
  calculateWeeklyWorkoutFrequency,
  calculateWorkoutStreaks,
  calculateNutritionStreaks,
  calculateWeeklyActivitySummaries,
  calculateNutritionConsistency,
  calculateLifetimeConsistencyStats,
  detectWorkoutInactivePeriods,
  generateConsistencyInsights,
} from '../utils/analyticsCalculations'
import { workoutService } from '@/features/workouts/services/workoutService'
import { nutritionService } from '@/features/nutrition/services/nutritionService'
import type { WeightEntry, UserProfile } from '@/types'
import type { Exercise, WorkoutSession, WorkoutSet } from '@/types/workout'
import type { NutritionDayData, DbNutritionDay, DbNutritionMeal, DbNutritionFoodItem } from '@/features/nutrition/types'

export const analyticsService = {
  /**
   * Calculates local start and end dates based on the selected timeframe.
   */
  getTimeframeDates(timeframe: AnalyticsTimeframe, referenceDate: Date = new Date()): { startDate: string; endDate: string } {
    const end = new Date(referenceDate)
    const endDate = toLocalDateString(end)

    const start = new Date(referenceDate)
    switch (timeframe) {
      case '7d':
        start.setDate(start.getDate() - 6) // Inclusive 7 days
        break
      case '30d':
        start.setDate(start.getDate() - 29) // Inclusive 30 days
        break
      case '90d':
        start.setDate(start.getDate() - 89) // Inclusive 90 days
        break
      case '180d':
        start.setDate(start.getDate() - 179) // Inclusive 180 days
        break
      case '1y':
        start.setFullYear(start.getFullYear() - 1)
        start.setDate(start.getDate() + 1)
        break
      case 'all':
        // 5 years default lookback for full historical view
        start.setFullYear(start.getFullYear() - 5)
        break
      default:
        start.setDate(start.getDate() - 29)
    }

    const startDate = toLocalDateString(start)
    return { startDate, endDate }
  },

  /**
   * Fetches all historical weight entries for an athlete ordered chronologically ascending.
   */
  async getWeightHistory(userId: string): Promise<WeightEntry[]> {
    if (!isSupabaseConfigured || !userId) return []

    try {
      const { data, error } = await supabase
        .from('weight_entries')
        .select('*')
        .eq('user_id', userId)
        .order('measured_at', { ascending: true })

      if (error || !data) {
        console.error('[AnalyticsService] Error fetching weight entries:', error)
        return []
      }

      return data as WeightEntry[]
    } catch (err) {
      console.warn('[AnalyticsService] Failed to load weight history:', err)
      return []
    }
  },

  /**
   * Fetches user profile for goal parameters and macro targets.
   */
  async getUserProfile(userId: string): Promise<UserProfile | null> {
    if (!isSupabaseConfigured || !userId) return null

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle()

      if (error || !data) return null
      return data as UserProfile
    } catch {
      return null
    }
  },

  /**
   * Fetches completed workout sessions for an athlete within an optional date range.
   */
  async getWorkoutSessions(
    userId: string,
    exercises: Exercise[],
    startDate?: string
  ): Promise<WorkoutSession[]> {
    const allSessions = await workoutService.getWorkoutSessions(userId, exercises)
    if (!startDate) return allSessions

    return allSessions.filter((s) => {
      const sessionDate = toLocalDateString(s.completed_at || s.started_at)
      return !sessionDate || sessionDate >= startDate
    })
  },

  /**
   * Fetches nutrition day records, meals, and food items within a calendar date range.
   */
  async getNutritionHistory(
    userId: string,
    startDate: string,
    endDate: string
  ): Promise<NutritionDayData[]> {
    if (!userId) return []
    try {
      return await nutritionService.getNutritionRange(userId, startDate, endDate)
    } catch (err) {
      console.error('[AnalyticsService] Error fetching nutrition history:', err)
      return []
    }
  },

  /**
   * Master query and analytics aggregator.
   * Efficiently computes and packages the complete AnalyticsDataBundle for any selected timeframe.
   * Can reuse preloaded context objects to minimize redundant network queries.
   */
  async getAnalyticsDataBundle(
    userId: string,
    timeframe: AnalyticsTimeframe,
    preloaded?: {
      profile?: UserProfile | null
      exercises?: Exercise[]
      weightEntries?: WeightEntry[]
      sessions?: WorkoutSession[]
    }
  ): Promise<AnalyticsDataBundle> {
    const { startDate, endDate } = this.getTimeframeDates(timeframe)

    // 1. Resolve exercises catalog (built-in + athlete custom)
    const exercises = preloaded?.exercises && preloaded.exercises.length > 0
      ? preloaded.exercises
      : await workoutService.getExercises(userId)

    // 2. Fetch or reuse profile, weight entries, and workout sessions in parallel
    const [profile, weightEntries, sessions, nutritionDaysData] = await Promise.all([
      preloaded?.profile !== undefined ? preloaded.profile : this.getUserProfile(userId),
      preloaded?.weightEntries !== undefined ? preloaded.weightEntries : this.getWeightHistory(userId),
      preloaded?.sessions !== undefined
        ? preloaded.sessions
        : this.getWorkoutSessions(userId, exercises, startDate),
      this.getNutritionHistory(userId, startDate, endDate),
    ])

    // ============================================================================
    // A. BODY PROGRESS ANALYTICS
    // ============================================================================
    // Filter weight entries for moving average (provide full history for accurate rolling average, then slice)
    const weightMovingAverage = calculateWeightMovingAverage(weightEntries)
    const windowedWeightTrend = weightMovingAverage.filter((p) => p.date >= startDate && p.date <= endDate)

    // Baseline weight: from baseline entry or earliest recorded weight
    const baselineEntry = weightEntries.find((w) => w.is_baseline) || weightEntries[0]
    const baselineWeightKg = baselineEntry ? Number(baselineEntry.weight_kg) : null

    // Latest weight: from latest entry or profile
    const latestEntry = weightEntries[weightEntries.length - 1]
    const currentWeightKg = latestEntry ? Number(latestEntry.weight_kg) : (profile?.current_weight_kg ?? null)
    const goalWeightKg = profile?.goal_weight_kg ?? null

    const weightChangeKg = calculateWeightChange(currentWeightKg, baselineWeightKg)
    const weeklyChangeRateKg = calculateWeeklyWeightChangeRate(weightEntries)
    const progressPercentage = calculateGoalProgressPercentage(currentWeightKg, baselineWeightKg, goalWeightKg)
    const projectedCompletionDate = calculateProjectedCompletionDate(currentWeightKg, goalWeightKg, weeklyChangeRateKg)
    const bmi = calculateBmi(currentWeightKg, profile?.height_cm ?? null)

    const isTargetAchieved = currentWeightKg !== null && goalWeightKg !== null
      ? Math.abs(currentWeightKg - goalWeightKg) <= 0.2
      : false

    // ============================================================================
    // B. STRENGTH & WORKOUT ANALYTICS
    // ============================================================================
    // Filter sessions to those within the selected window
    const windowedSessions = sessions.filter((s) => {
      const date = toLocalDateString(s.completed_at || s.started_at)
      return date >= startDate && date <= endDate
    })

    const allWindowedSets: WorkoutSet[] = windowedSessions.flatMap((s) => s.sets || [])
    const completedSets = allWindowedSets.filter((s) => s.is_completed && s.reps > 0)
    const totalVolumeKg = completedSets.reduce((sum, s) => sum + (s.weight_kg || 0) * s.reps, 0)

    const totalDurationSeconds = windowedSessions.reduce((sum, s) => sum + (s.duration_seconds || 0), 0)
    const averageWorkoutDurationMinutes = windowedSessions.length > 0
      ? Math.round(totalDurationSeconds / windowedSessions.length / 60)
      : 0

    // Compute weekly volume aggregation, muscle distribution, PRs, and most improved exercise
    const weeklyVolume = calculateWeeklyVolumeAggregation(sessions) // use full sessions for trend
    const muscleDistribution = calculateMuscleGroupDistribution(allWindowedSets, exercises)
    const prs = detectPersonalRecords(sessions, exercises)
    const mostImproved = calculateMostImprovedExercise(sessions, exercises)

    // ============================================================================
    // C. NUTRITION ANALYTICS
    // ============================================================================
    const allMeals: DbNutritionMeal[] = []
    const allFoodItems: DbNutritionFoodItem[] = []
    const rawNutritionDays: DbNutritionDay[] = []

    const dailyIntakes: DailyNutritionAggregate[] = nutritionDaysData.map((dayData) => {
      const day = dayData.day
      if (day) rawNutritionDays.push(day)

      const meals = dayData.meals || []
      const items = meals.flatMap((m) => m.items || [])

      allMeals.push(...meals)
      allFoodItems.push(...items)

      const cal = items.reduce((sum, i) => sum + (Number(i.calories) || 0), 0)
      const p = items.reduce((sum, i) => sum + (Number(i.protein_g) || 0), 0)
      const c = items.reduce((sum, i) => sum + (Number(i.carbs_g) || 0), 0)
      const f = items.reduce((sum, i) => sum + (Number(i.fat_g) || 0), 0)
      const fib = items.reduce((sum, i) => sum + (Number(i.fiber_g) || 0), 0)

      const calTarget = profile?.daily_calorie_target ?? null
      const pTarget = profile?.protein_target_g ?? null

      const isAdherent = calTarget !== null && calTarget > 0
        ? Math.abs(cal - calTarget) <= calTarget * 0.1
        : false

      return {
        logDate: day ? day.log_date : '',
        calories: Math.round(cal),
        proteinG: Math.round(p * 10) / 10,
        carbsG: Math.round(c * 10) / 10,
        fatG: Math.round(f * 10) / 10,
        fiberG: Math.round(fib * 10) / 10,
        mealCount: meals.length,
        isAdherent,
        caloriesTarget: calTarget,
        proteinTarget: pTarget,
      }
    }).filter((d) => Boolean(d.logDate))

    const avgMacros = calculateAverageMacros(dailyIntakes)
    const averageCalories = calculateAverageLoggedCalories(dailyIntakes)
    const averageProteinG = avgMacros.averageProteinG
    const averageCarbsG = avgMacros.averageCarbsG
    const averageFatG = avgMacros.averageFatG
    const averageFiberG = avgMacros.averageFiberG

    const { adherentDaysCount, belowTargetDaysCount, aboveTargetDaysCount, totalLoggedDays, targetAdherenceRate } = calculateCalorieTargetAdherence(
      dailyIntakes,
      10 // 10% tolerance corridor
    )

    const macroPercentages = calculateMacroCaloriePercentages(averageProteinG, averageCarbsG, averageFatG)
    const mealDistribution = calculateMealCategoryDistribution(allMeals, allFoodItems)

    const insights = generateNutritionInsights({
      loggedDays: dailyIntakes.filter((d) => d.calories > 0 || d.mealCount > 0),
      averageCalories,
      calorieTarget: profile?.daily_calorie_target ?? null,
      averageProteinG,
      proteinTarget: profile?.protein_target_g ?? null,
      averageCarbsG,
      carbsTarget: profile?.carbs_target_g ?? null,
      averageFatG,
      fatTarget: profile?.fat_target_g ?? null,
      averageFiberG,
      macroPercentages,
    })

    // ============================================================================
    // D. CONSISTENCY & ACTIVITY ANALYTICS
    // ============================================================================
    const activityScores = calculateDailyActivityScores(
      startDate,
      endDate,
      sessions,
      rawNutritionDays,
      weightEntries
    )

    const { currentStreakDays, longestStreakDays } = calculateActivityStreaks(activityScores)
    const { averageWeeklyCount } = calculateWeeklyWorkoutFrequency(sessions, 4)

    const totalWorkoutDays = activityScores.filter((s) => s.workoutCompleted).length
    const totalNutritionDays = activityScores.filter((s) => s.nutritionLogged).length

    const workoutStreaks = calculateWorkoutStreaks(sessions)
    const nutritionStreaks = calculateNutritionStreaks(nutritionDaysData)
    const weeklySummaries = calculateWeeklyActivitySummaries(
      startDate,
      endDate,
      sessions,
      nutritionDaysData,
      weightEntries
    )
    const nutritionConsistency = calculateNutritionConsistency(
      startDate,
      endDate,
      nutritionDaysData
    )
    const lifetimeStats = calculateLifetimeConsistencyStats(
      sessions,
      nutritionDaysData,
      weightEntries
    )
    const inactivePeriods = detectWorkoutInactivePeriods(sessions)
    const consistencyInsights = generateConsistencyInsights({
      weeklySummaries,
      workoutStreaks,
      nutritionStreaks,
      nutritionConsistency,
      inactivePeriods,
      averageWeeklyWorkouts: averageWeeklyCount,
    })

    return {
      timeframe,
      startDate,
      endDate,
      body: {
        currentWeightKg,
        baselineWeightKg,
        goalWeightKg,
        weightChangeKg,
        weeklyChangeRateKg,
        progressPercentage,
        projectedCompletionDate,
        targetDateIso: profile?.target_completion_date ?? null,
        isTargetAchieved,
        bmi,
        totalWeighIns: weightEntries.length,
      },
      weightTrend: windowedWeightTrend,
      workout: {
        totalCompletedWorkouts: windowedSessions.length,
        totalVolumeKg: Math.round(totalVolumeKg),
        totalCompletedSets: completedSets.length,
        averageWorkoutDurationMinutes,
        prs,
        muscleDistribution,
        weeklyVolume,
        mostImproved,
      },
      nutrition: {
        averageCalories,
        averageProteinG,
        averageCarbsG,
        averageFatG,
        averageFiberG,
        targetAdherenceRate,
        adherentDaysCount,
        belowTargetDaysCount,
        aboveTargetDaysCount,
        totalLoggedDays,
        macroPercentages,
        mealDistribution,
        dailyIntakes,
        insights,
      },
      consistency: {
        currentStreakDays,
        longestStreakDays,
        totalWorkoutDays,
        totalNutritionDays,
        totalWeighInDays: weightEntries.length,
        averageWorkoutsPerWeek: averageWeeklyCount,
        activityScores,
        currentWorkoutStreakDays: workoutStreaks.currentStreakDays,
        longestWorkoutStreakDays: workoutStreaks.longestStreakDays,
        currentNutritionStreakDays: nutritionStreaks.currentStreakDays,
        longestNutritionStreakDays: nutritionStreaks.longestStreakDays,
        weeklySummaries,
        lifetimeStats,
        nutritionConsistency,
        insights: consistencyInsights,
      },
    }
  },
}
