/**
 * Fitness Calculations for FORM
 */

/**
 * Calculates Estimated 1-Rep Max (1RM) using the Epley formula:
 * 1RM = Weight * (1 + Reps / 30)
 */
export function calculateEstimated1RM(weightKg: number, reps: number): number {
  if (reps <= 1) return weightKg
  return Math.round(weightKg * (1 + reps / 30) * 10) / 10
}
