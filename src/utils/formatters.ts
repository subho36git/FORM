/**
 * Formatting utilities for FORM
 */

/**
 * Formats a weight value into kg or lbs display text.
 */
export function formatWeight(kg: number, unit: 'metric' | 'imperial' = 'metric'): string {
  if (unit === 'imperial') {
    const lbs = kg * 2.20462
    return `${lbs.toFixed(1)} lbs`
  }
  return `${kg.toFixed(1)} kg`
}

/**
 * Formats a number with comma separators (e.g. 2400 -> "2,400").
 */
export function formatNumber(val: number): string {
  return new Intl.NumberFormat('en-US').format(val)
}
