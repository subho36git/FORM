import React, { useState, useEffect } from 'react'
import {
  Edit2,
  Trash2,
  Scale,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  Loader2,
} from 'lucide-react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { useUnit } from '@/hooks/useUnit'
import { useGoals } from '@/features/goals'
import { useMetrics } from '../context/MetricsContext'
import { MEASUREMENT_SITES, type BodyMeasurement } from '../types'

interface MeasurementHistoryTableProps {
  onEdit: (measurement: BodyMeasurement) => void
}

export const MeasurementHistoryTable: React.FC<MeasurementHistoryTableProps> = ({ onEdit }) => {
  const { formatCircumference, formatWeight } = useUnit()
  const { weightEntries } = useGoals()
  const { measurements, deleteMeasurement, isLoadingMeasurements } = useMetrics()

  const [expandedRowId, setExpandedRowId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  // ESC key to dismiss delete confirmation modal
  useEffect(() => {
    if (!deletingId) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setDeletingId(null)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [deletingId])

  // Find closest weigh-in for date
  const getWeightForDate = (dateStr: string): number | null => {
    if (!weightEntries || weightEntries.length === 0) return null
    const exact = weightEntries.find((w) => w.measured_at.startsWith(dateStr))
    if (exact) return exact.weight_kg

    const targetTime = new Date(dateStr).getTime()
    let closest: { diff: number; weight: number } | null = null
    for (const w of weightEntries) {
      const entryTime = new Date(w.measured_at.split('T')[0]).getTime()
      const diff = Math.abs(entryTime - targetTime)
      if (diff <= 7 * 86400000) {
        if (!closest || diff < closest.diff) {
          closest = { diff, weight: w.weight_kg }
        }
      }
    }
    return closest ? closest.weight : null
  }

  const handleConfirmDelete = async () => {
    if (!deletingId) return
    setIsDeleting(true)
    try {
      await deleteMeasurement(deletingId)
      setDeletingId(null)
    } finally {
      setIsDeleting(false)
    }
  }

  if (isLoadingMeasurements) {
    return (
      <Card>
        <CardContent className="p-12 text-center text-xs text-[var(--color-text-muted)] flex items-center justify-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin text-[var(--color-accent)]" /> Loading
          measurement history...
        </CardContent>
      </Card>
    )
  }

  if (measurements.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Measurement History</CardTitle>
          <CardDescription>All chronological body circumference sessions.</CardDescription>
        </CardHeader>
        <CardContent className="p-8 text-center text-xs text-[var(--color-text-secondary)]">
          No measurement entries have been recorded yet. Click &quot;Log New Session&quot; to begin.
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <CardTitle>Measurement History</CardTitle>
            <CardDescription>
              Chronological log of all {measurements.length} recorded circumference sessions.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-[var(--color-border)] bg-[var(--color-surface-hover)]/40 text-[11px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4">Weigh-in</th>
                <th className="py-3 px-4">Waist</th>
                <th className="py-3 px-4">Chest</th>
                <th className="py-3 px-4">R. Arm</th>
                <th className="py-3 px-4">R. Thigh</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border-subtle)]">
              {measurements.map((entry) => {
                const isExpanded = expandedRowId === entry.id
                const weight = getWeightForDate(entry.measuredDate)

                return (
                  <React.Fragment key={entry.id}>
                    <tr
                      className={`hover:bg-[var(--color-surface-hover)]/60 transition-colors ${
                        isExpanded ? 'bg-[var(--color-surface-hover)]/30' : ''
                      }`}
                    >
                      {/* Date */}
                      <td className="py-3 px-4 font-medium text-[var(--color-text-primary)]">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              setExpandedRowId(isExpanded ? null : entry.id)
                            }
                            className="p-1 rounded text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] cursor-pointer"
                            title={isExpanded ? 'Collapse sites' : 'Expand all 13 sites'}
                          >
                            {isExpanded ? (
                              <ChevronUp className="w-3.5 h-3.5" />
                            ) : (
                              <ChevronDown className="w-3.5 h-3.5" />
                            )}
                          </button>
                          <span className="font-mono text-xs">{entry.measuredDate}</span>
                        </div>
                      </td>

                      {/* Weight */}
                      <td className="py-3 px-4 text-[var(--color-text-secondary)]">
                        {weight !== null ? (
                          <span className="font-mono flex items-center gap-1 text-[var(--color-accent)] font-medium">
                            <Scale className="w-3 h-3" /> {formatWeight(weight)}
                          </span>
                        ) : (
                          <span className="text-[var(--color-text-muted)]">—</span>
                        )}
                      </td>

                      {/* Waist */}
                      <td className="py-3 px-4 font-mono font-medium text-[var(--color-text-primary)]">
                        {entry.waistCm ? formatCircumference(entry.waistCm) : '—'}
                      </td>

                      {/* Chest */}
                      <td className="py-3 px-4 font-mono font-medium text-[var(--color-text-primary)]">
                        {entry.chestCm ? formatCircumference(entry.chestCm) : '—'}
                      </td>

                      {/* Bicep */}
                      <td className="py-3 px-4 font-mono font-medium text-[var(--color-text-primary)]">
                        {entry.bicepRightCm ? formatCircumference(entry.bicepRightCm) : '—'}
                      </td>

                      {/* Thigh */}
                      <td className="py-3 px-4 font-mono font-medium text-[var(--color-text-primary)]">
                        {entry.thighRightCm ? formatCircumference(entry.thighRightCm) : '—'}
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => onEdit(entry)}
                            className="h-7 w-7 p-0 text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
                            title="Edit measurements"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => setDeletingId(entry.id)}
                            className="h-7 w-7 p-0 text-rose-500 hover:text-rose-600 hover:bg-rose-500/10"
                            title="Delete measurement session"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>

                    {/* Expandable Detailed Sites Drawer */}
                    {isExpanded && (
                      <tr className="bg-[var(--color-surface-hover)]/20 border-b border-[var(--color-border)]">
                        <td colSpan={7} className="p-4">
                          <div className="space-y-3">
                            <div className="flex items-center justify-between text-xs">
                              <span className="font-semibold text-[var(--color-text-primary)]">
                                Full 13-Site Breakdown for {entry.measuredDate}
                              </span>
                              {entry.notes && (
                                <span className="text-[11px] text-[var(--color-text-secondary)] italic">
                                  Notes: &quot;{entry.notes}&quot;
                                </span>
                              )}
                            </div>

                            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2 text-xs font-mono">
                              {MEASUREMENT_SITES.map((site) => {
                                const cmVal = entry[site.field] as number | null
                                return (
                                  <div
                                    key={site.key}
                                    className="p-2 rounded bg-[var(--color-surface)] border border-[var(--color-border)]"
                                  >
                                    <span className="text-[10px] text-[var(--color-text-muted)] block truncate">
                                      {site.label}
                                    </span>
                                    <span
                                      className={`font-bold ${
                                        cmVal !== null
                                          ? 'text-[var(--color-text-primary)]'
                                          : 'text-[var(--color-text-muted)]'
                                      }`}
                                    >
                                      {cmVal !== null ? formatCircumference(cmVal) : '—'}
                                    </span>
                                  </div>
                                )
                              })}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                )
              })}
            </tbody>
          </table>
        </div>
      </CardContent>

      {/* Delete Confirmation Modal */}
      {deletingId && (
        <div
          onClick={() => setDeletingId(null)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150"
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-measurement-title"
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-2xl space-y-4 animate-in zoom-in-95 duration-150"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h4 id="delete-measurement-title" className="text-sm font-bold text-[var(--color-text-primary)]">
                  Delete Measurement Entry?
                </h4>
                <p className="text-xs text-[var(--color-text-muted)]">
                  This action cannot be undone.
                </p>
              </div>
            </div>

            <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">
              Are you sure you want to permanently delete this body circumference measurement
              record?
            </p>

            <div className="flex items-center justify-end gap-2 pt-1">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setDeletingId(null)}
                disabled={isDeleting}
                className="text-xs"
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="danger"
                size="sm"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="text-xs"
              >
                {isDeleting ? 'Deleting...' : 'Confirm Delete'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </Card>
  )
}
