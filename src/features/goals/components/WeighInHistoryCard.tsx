import React, { useState } from 'react'
import {
  Scale,
  Calendar,
  Trash2,
  Plus,
  Loader2,
  Info,
  CheckCircle2,
} from 'lucide-react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'
import { useGoals } from '../hooks/useGoals'
import { useUnit } from '@/hooks/useUnit'

export const WeighInHistoryCard: React.FC = () => {
  const { weightEntries, isLoadingWeightEntries, addWeightEntry, deleteWeightEntry, adaptiveStatus } =
    useGoals()
  const { unitSystem, weightUnit, displayToKg, formatWeight } = useUnit()

  const minWeight = unitSystem === 'metric' ? 25 : 55
  const maxWeight = unitSystem === 'metric' ? 350 : 770

  const [isAdding, setIsAdding] = useState(false)
  const [weightInput, setWeightInput] = useState('')
  const [measuredAt, setMeasuredAt] = useState(() => new Date().toISOString().split('T')[0])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    const val = parseFloat(weightInput)
    if (isNaN(val) || val < minWeight || val > maxWeight) {
      setError(`Please enter a valid bodyweight between ${minWeight} and ${maxWeight} ${weightUnit}.`)
      return
    }

    setIsSubmitting(true)
    setError(null)
    const measuredIso = new Date(measuredAt).toISOString()
    const weightInKg = displayToKg(val)
    const { error: err } = await addWeightEntry(weightInKg, measuredIso)
    if (err) {
      setError(err.message)
    } else {
      setWeightInput('')
      setIsAdding(false)
    }
    setIsSubmitting(false)
  }

  const handleDelete = async (id: string) => {
    setDeletingId(id)
    await deleteWeightEntry(id)
    setDeletingId(null)
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <CardTitle>Bodyweight Measurements & History</CardTitle>
            <CardDescription>
              Chronological log of scale measurements. Adding or editing entries automatically updates your profile current weight.
            </CardDescription>
          </div>

          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => setIsAdding((prev) => !prev)}
            icon={<Plus className="w-3.5 h-3.5" />}
          >
            {isAdding ? 'Cancel' : 'Log Measurement'}
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-5">
        {/* Quick Add Form */}
        {isAdding && (
          <form
            onSubmit={handleAdd}
            className="p-4 rounded-xl bg-[var(--color-surface-subtle)] border border-[var(--color-border)] space-y-3"
          >
            <div className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-primary)]">
              Record Scale Weigh-In
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input
                type="number"
                step="0.1"
                min={minWeight}
                max={maxWeight}
                label={`Bodyweight (${weightUnit})`}
                placeholder={unitSystem === 'metric' ? 'e.g. 74.6' : 'e.g. 164.5'}
                value={weightInput}
                onChange={(e) => setWeightInput(e.target.value)}
                autoFocus
              />
              <Input
                type="date"
                label="Date of Measurement"
                value={measuredAt}
                onChange={(e) => setMeasuredAt(e.target.value)}
              />
            </div>
            {error && <p className="text-xs text-red-500 font-medium">{error}</p>}
            <div className="flex justify-end gap-2 pt-1">
              <Button
                type="submit"
                variant="primary"
                size="sm"
                disabled={isSubmitting}
                icon={isSubmitting ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />}
              >
                {isSubmitting ? 'Saving...' : 'Save Weigh-In'}
              </Button>
            </div>
          </form>
        )}

        {/* Adaptive TDEE Status Notice */}
        <div className="p-3.5 rounded-xl bg-[var(--color-surface-subtle)] border border-[var(--color-border)] text-xs text-[var(--color-text-secondary)] flex items-start gap-2.5">
          <Info className="w-4 h-4 text-[var(--color-accent)] shrink-0 mt-0.5" />
          <div className="space-y-1">
            <span className="font-semibold text-[var(--color-text-primary)]">
              {adaptiveStatus.isEligible ? 'Adaptive Calibration Active' : 'Adaptive TDEE Status (Standby)'}
            </span>
            <p className="text-[11px] leading-relaxed">{adaptiveStatus.statusMessage}</p>
          </div>
        </div>

        {/* Entries Table / List */}
        {isLoadingWeightEntries ? (
          <div className="py-8 text-center text-xs text-[var(--color-text-muted)] flex items-center justify-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin text-[var(--color-accent)]" />
            <span>Loading historical measurements...</span>
          </div>
        ) : weightEntries.length === 0 ? (
          <div className="py-8 text-center text-xs text-[var(--color-text-muted)] space-y-1">
            <Scale className="w-6 h-6 mx-auto opacity-30" />
            <p>No historical weigh-ins logged yet.</p>
          </div>
        ) : (
          <div className="divide-y divide-[var(--color-border)] border border-[var(--color-border)] rounded-xl overflow-hidden">
            {weightEntries.map((entry) => {
              const formattedDate = new Date(entry.measured_at).toLocaleDateString(undefined, {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })

              return (
                <div
                  key={entry.id}
                  className="p-3.5 bg-[var(--color-surface)] flex items-center justify-between text-xs transition-colors hover:bg-[var(--color-surface-hover)]"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-7 h-7 rounded-lg bg-[var(--color-surface-hover)] text-[var(--color-text-muted)] flex items-center justify-center shrink-0">
                      <Scale className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold text-sm text-[var(--color-text-primary)]">
                          {formatWeight(Number(entry.weight_kg))}
                        </span>
                        {entry.is_baseline && (
                          <Badge
                            variant="outline"
                            className="text-[9px] font-bold tracking-wider text-amber-500 border-amber-500/30 bg-amber-500/5"
                          >
                            Initial Onboarding Baseline (Approximate Date)
                          </Badge>
                        )}
                      </div>
                      <span className="text-[11px] text-[var(--color-text-muted)] flex items-center gap-1 mt-0.5">
                        <Calendar className="w-3 h-3" />
                        {formattedDate}
                        {entry.is_baseline && ' • Excluded from trend calibration'}
                      </span>
                    </div>
                  </div>

                  {!entry.is_baseline && (
                    <button
                      type="button"
                      onClick={() => handleDelete(entry.id)}
                      disabled={deletingId === entry.id}
                      className="p-1.5 rounded-md text-[var(--color-text-muted)] hover:text-red-500 hover:bg-red-500/10 transition-colors cursor-pointer"
                      title="Delete measurement"
                    >
                      {deletingId === entry.id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="w-3.5 h-3.5" />
                      )}
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
