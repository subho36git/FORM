import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

/**
 * Merges class names cleanly while resolving any Tailwind CSS conflicts.
 * Example: cn('px-4 py-2', condition && 'bg-emerald-600')
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}
