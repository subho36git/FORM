/**
 * FORM Precision Nutrition Calculations
 * 
 * Provides evidence-based calculations for:
 * 1. Basal Metabolic Rate (BMR) via the Mifflin-St Jeor equation.
 * 2. Total Daily Energy Expenditure (TDEE) via Physical Activity Level (PAL) multipliers.
 * 3. Daily Calorie Target based on fitness goals (surplus / deficit / maintenance).
 * 4. Evidence-based macronutrient distributions (Protein, Fats, Carbohydrates).
 *
 * NOTE: These calculations provide scientific estimates for athletic tracking and are
 * not intended as clinical or medical prescriptions.
 */

export type FitnessGoal = 'muscle_gain' | 'fat_loss' | 'maintenance'

export type ActivityLevel = 'sedentary' | 'lightly_active' | 'moderately_active' | 'very_active'

export type CalorieSex = 'male' | 'female'

export interface CalculationParams {
  weightKg: number
  heightCm: number
  ageYears: number
  sex: CalorieSex
  goal: FitnessGoal
  activityLevel: ActivityLevel
}

export interface NutritionTargets {
  bmr: number
  tdee: number
  calorieAdjustment: number
  dailyCalorieTarget: number
  proteinG: number
  proteinKcal: number
  carbsG: number
  carbsKcal: number
  fatG: number
  fatKcal: number
}

/**
 * Calculates Basal Metabolic Rate (BMR) using the Mifflin-St Jeor Equation.
 *
 * Formulas:
 *   - Male:   (10 × weight_kg) + (6.25 × height_cm) - (5 × age_years) + 5
 *   - Female: (10 × weight_kg) + (6.25 × height_cm) - (5 × age_years) - 161
 */
export function calculateBmr(
  weightKg: number,
  heightCm: number,
  ageYears: number,
  sex: CalorieSex
): number {
  if (weightKg <= 0 || heightCm <= 0 || ageYears <= 0) return 0

  const base = 10 * weightKg + 6.25 * heightCm - 5 * ageYears
  const bmr = sex === 'male' ? base + 5 : base - 161
  return Math.round(Math.max(800, bmr))
}

/**
 * Maps activity level to standard Physical Activity Level (PAL) multiplier.
 */
export function getActivityMultiplier(level: ActivityLevel): number {
  switch (level) {
    case 'sedentary':
      return 1.2
    case 'lightly_active':
      return 1.375
    case 'moderately_active':
      return 1.55
    case 'very_active':
      return 1.725
    default:
      return 1.2
  }
}

/**
 * Calculates Total Daily Energy Expenditure (TDEE).
 */
export function calculateTdee(bmr: number, activityLevel: ActivityLevel): number {
  const multiplier = getActivityMultiplier(activityLevel)
  return Math.round(bmr * multiplier)
}

/**
 * Determines goal-specific calorie adjustment:
 * - Fat Loss: -500 kcal deficit (with physiological floor protection)
 * - Muscle Gain: +300 kcal moderate surplus
 * - Maintenance: 0 kcal adjustment
 */
export function getCalorieAdjustment(goal: FitnessGoal): number {
  switch (goal) {
    case 'fat_loss':
      return -500
    case 'muscle_gain':
      return 300
    case 'maintenance':
      return 0
    default:
      return 0
  }
}

/**
 * Calculates complete nutrition and macronutrient targets.
 *
 * Macronutrient distribution strategy:
 * 1. Protein:
 *    - Fat loss: 2.2 g/kg (elevated to spare lean muscle mass in a deficit)
 *    - Muscle gain: 2.0 g/kg (maximizes muscle protein synthesis)
 *    - Maintenance: 1.8 g/kg (sufficient for nitrogen balance and recovery)
 *    - 4 kcal per gram of protein.
 * 2. Fat:
 *    - 25% of total daily calorie target (supports endocrine hormone synthesis)
 *    - 9 kcal per gram of fat.
 * 3. Carbohydrates:
 *    - Remaining calories allocated to carbohydrates to fuel athletic glycolytic performance.
 *    - 4 kcal per gram of carbohydrate.
 */
export function calculateNutritionTargets(params: CalculationParams): NutritionTargets {
  const { weightKg, heightCm, ageYears, sex, goal, activityLevel } = params

  const bmr = calculateBmr(weightKg, heightCm, ageYears, sex)
  const tdee = calculateTdee(bmr, activityLevel)
  const calorieAdjustment = getCalorieAdjustment(goal)

  // Safe calorie floor: 1,500 kcal for males, 1,200 kcal for females
  const floor = sex === 'male' ? 1500 : 1200
  const unadjustedCalories = tdee + calorieAdjustment
  const dailyCalorieTarget = Math.max(floor, Math.round(unadjustedCalories))

  // Protein targets based on athletic goal
  let proteinPerKg = 1.8
  if (goal === 'fat_loss') {
    proteinPerKg = 2.2
  } else if (goal === 'muscle_gain') {
    proteinPerKg = 2.0
  }

  const proteinG = Math.round(weightKg * proteinPerKg)
  const proteinKcal = proteinG * 4

  // Dietary fat targets (25% of total target calories)
  const fatCaloriesTarget = dailyCalorieTarget * 0.25
  const fatG = Math.round(fatCaloriesTarget / 9)
  const fatKcal = fatG * 9

  // Carbohydrate targets (remaining calories)
  const remainingKcal = Math.max(0, dailyCalorieTarget - (proteinKcal + fatKcal))
  const carbsG = Math.round(remainingKcal / 4)
  const carbsKcal = carbsG * 4

  return {
    bmr,
    tdee,
    calorieAdjustment,
    dailyCalorieTarget,
    proteinG,
    proteinKcal,
    carbsG,
    carbsKcal,
    fatG,
    fatKcal,
  }
}
