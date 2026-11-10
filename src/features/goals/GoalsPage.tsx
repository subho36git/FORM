import React from 'react'
import {
  Target,
  Save,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Info,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { useGoals } from './hooks/useGoals'
import { BodyTrajectoryCard } from './components/BodyTrajectoryCard'
import { CalorieHubCard } from './components/CalorieHubCard'
import { MacroBalancerCard } from './components/MacroBalancerCard'
import { WeighInHistoryCard } from './components/WeighInHistoryCard'
import { ConflictModal } from './components/ConflictModal'

export const GoalsPage: React.FC = () => {
  const {
    isDirty,
    isSaving,
    saveError,
    saveSuccess,
    saveGoals,
    resetToAuto,
  } = useGoals()

  const handleSave = async () => {
    await saveGoals()
  }

  return (
    <div className="p-4 sm:p-6 md:p-10 max-w-7xl mx-auto w-full space-y-6 sm:space-y-8 animate-in fade-in duration-200">
      {/* Top Header & Global Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Badge variant="accent">Dynamic Goal Engine</Badge>
            <span className="text-xs text-[var(--color-text-muted)] flex items-center gap-1">
              <Target className="w-3 h-3" /> Real-time Calorie & Macro Interconnection
            </span>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-[var(--color-text-primary)]">
            Goals & Target Management
          </h1>
          <p className="text-sm text-[var(--color-text-secondary)] mt-0.5">
            Configure bodyweight objectives, target completion dates, and synchronized macronutrient protocols.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            variant="outline"
            size="md"
            onClick={() => resetToAuto('all')}
            icon={<RotateCcw className="w-4 h-4" />}
            className="cursor-pointer"
          >
            Reset to Auto
          </Button>

          <Button
            variant="primary"
            size="md"
            onClick={handleSave}
            disabled={!isDirty || isSaving}
            icon={
              isSaving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : saveSuccess ? (
                <CheckCircle2 className="w-4 h-4" />
              ) : (
                <Save className="w-4 h-4" />
              )
            }
            className="cursor-pointer font-semibold shadow-xs"
          >
            {isSaving ? 'Saving...' : saveSuccess ? 'Saved' : isDirty ? 'Save Changes' : 'Up to Date'}
          </Button>
        </div>
      </div>

      {/* Global Alerts & Feedback */}
      {saveError && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-xs flex items-center gap-2.5">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span className="font-medium">{saveError}</span>
        </div>
      )}

      {saveSuccess && (
        <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-[var(--color-accent)] text-xs flex items-center gap-2.5">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span className="font-medium">
            Goals, target completion date, and macronutrient protocol updated in your profile!
          </span>
        </div>
      )}

      {/* Conflict Resolution Modal / In-place Prompt */}
      <ConflictModal />

      {/* Theoretical Model Notice */}
      <div className="p-3.5 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] flex items-start gap-3 text-xs text-[var(--color-text-muted)]">
        <Info className="w-4 h-4 text-[var(--color-text-secondary)] shrink-0 mt-0.5" />
        <p className="leading-relaxed">
          <strong className="text-[var(--color-text-primary)]">Theoretical Energy Model:</strong> Calculations
          use the Mifflin-St Jeor equation and an approximate 7,700 kcal per kilogram tissue energy coefficient.
          This serves as a simplified mathematical baseline for athletic planning, not an exact physiological guarantee.
          Target completion dates reflect your chosen milestones, whereas projected completion dates represent dynamic estimates based on your daily caloric budget.
        </p>
      </div>

      {/* Main Interactive Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Left Column (2 spans): Body Trajectory & Calories */}
        <div className="lg:col-span-2 space-y-6">
          <BodyTrajectoryCard />
          <CalorieHubCard />
          <WeighInHistoryCard />
        </div>

        {/* Right Column (1 span): Macro Balancer */}
        <div className="space-y-6">
          <MacroBalancerCard />
        </div>
      </div>
    </div>
  )
}
