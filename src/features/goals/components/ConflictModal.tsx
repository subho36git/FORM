import React from 'react'
import { AlertTriangle, Check } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { useGoals } from '../hooks/useGoals'

export const ConflictModal: React.FC = () => {
  const { conflict, resolveConflict } = useGoals()

  if (!conflict?.hasConflict) return null

  return (
    <div className="p-4 rounded-xl bg-amber-500/10 border-2 border-amber-500/30 text-amber-900 dark:text-amber-200 text-xs space-y-3 animate-in fade-in">
      <div className="flex items-start gap-2.5">
        <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <h4 className="font-bold text-sm text-[var(--color-text-primary)]">
            Macro Constraint Conflict Detected
          </h4>
          <p className="leading-relaxed text-[var(--color-text-secondary)]">
            {conflict.message}
          </p>
          {conflict.suggestedAction && (
            <p className="text-[11px] font-semibold text-amber-600 dark:text-amber-400">
              {conflict.suggestedAction}
            </p>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-amber-500/20 justify-end">
        <span className="text-[11px] font-medium text-[var(--color-text-muted)] mr-auto">
          Choose a resolution:
        </span>

        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => resolveConflict('flex_carbs')}
          className="text-xs font-semibold"
        >
          <Check className="w-3.5 h-3.5 text-[var(--color-accent)] mr-1" />
          Flex Carbs
        </Button>

        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => resolveConflict('flex_fat')}
          className="text-xs font-semibold"
        >
          <Check className="w-3.5 h-3.5 text-[var(--color-accent)] mr-1" />
          Flex Fat
        </Button>

        <Button
          type="button"
          variant="primary"
          size="sm"
          onClick={() => resolveConflict('unlock_calories')}
          className="text-xs font-semibold"
        >
          Recalculate Calories to Match
        </Button>
      </div>
    </div>
  )
}
