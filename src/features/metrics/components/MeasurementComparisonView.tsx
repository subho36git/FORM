import React, { useState, useMemo } from 'react'
import {
  ArrowRight,
  Calendar,
  Scale,
  TrendingUp,
  TrendingDown,
  Minus,
  Sparkles,
} from 'lucide-react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { useUnit } from '@/hooks/useUnit'
import { useMetrics } from '../context/MetricsContext'

export const MeasurementComparisonView: React.FC = () => {
  const { circumferenceUnit, formatCircumference, formatWeight } = useUnit()
  const { measurements, compareSessions } = useMetrics()

  // Select two dates to compare
  const dateOptions = useMemo(() => {
    return measurements.map((m) => m.measuredDate)
  }, [measurements])

  const [dateA, setDateA] = useState<string>(() => dateOptions[0] || '')
  const [dateB, setDateB] = useState<string>(() => dateOptions[1] || dateOptions[0] || '')

  // Keep state synced if dates list changes
  const syncKey = `${measurements.length}_${dateOptions[0] || ''}`
  const [prevSyncKey, setPrevSyncKey] = useState(syncKey)
  if (syncKey !== prevSyncKey) {
    setPrevSyncKey(syncKey)
    if (!dateOptions.includes(dateA)) setDateA(dateOptions[0] || '')
    if (!dateOptions.includes(dateB)) setDateB(dateOptions[1] || dateOptions[0] || '')
  }

  const comparison = useMemo(() => {
    if (!dateA || !dateB || dateA === dateB) return null
    return compareSessions(dateA, dateB)
  }, [dateA, dateB, compareSessions])

  if (measurements.length < 2) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Session Comparison</CardTitle>
          <CardDescription>
            Compare two dated measurement sessions side-by-side to evaluate body composition changes.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-8 text-center text-xs text-[var(--color-text-secondary)] space-y-2">
          <p>You need at least 2 recorded measurement sessions to perform a side-by-side comparison.</p>
          <p className="text-[11px] text-[var(--color-text-muted)]">
            Currently logged: {measurements.length} session{measurements.length === 1 ? '' : 's'}.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[var(--color-accent)]" />
              <CardTitle>Session Comparison</CardTitle>
            </div>
            <CardDescription>
              Analyze changes between any two dated measurement check-ins.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Date Selector Controls */}
        <div className="p-4 rounded-xl bg-[var(--color-surface-subtle)] border border-[var(--color-border)] flex flex-col md:flex-row md:items-center justify-between gap-4 text-xs">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            {/* Session A */}
            <div className="space-y-1">
              <span className="text-[10px] uppercase font-semibold text-[var(--color-text-muted)] block">
                Session A (Recent)
              </span>
              <select
                value={dateA}
                onChange={(e) => setDateA(e.target.value)}
                className="px-3 py-1.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-primary)] font-medium text-xs hover:border-[var(--color-text-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)] focus:border-[var(--color-accent)] transition-all cursor-pointer"
              >
                {dateOptions.map((d) => (
                  <option key={`a-${d}`} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>

            <div className="hidden sm:flex items-center justify-center pt-4 text-[var(--color-text-muted)]">
              <ArrowRight className="w-4 h-4" />
            </div>

            {/* Session B */}
            <div className="space-y-1">
              <span className="text-[10px] uppercase font-semibold text-[var(--color-text-muted)] block">
                Session B (Baseline / Comparison)
              </span>
              <select
                value={dateB}
                onChange={(e) => setDateB(e.target.value)}
                className="px-3 py-1.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-primary)] font-medium text-xs hover:border-[var(--color-text-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)] focus:border-[var(--color-accent)] transition-all cursor-pointer"
              >
                {dateOptions.map((d) => (
                  <option key={`b-${d}`} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Time & Weight Delta Badge */}
          {comparison && (
            <div className="flex flex-wrap items-center gap-3 pt-2 md:pt-0">
              <Badge variant="outline" className="text-xs">
                <Calendar className="w-3 h-3 mr-1" />
                {comparison.daysBetween} days apart
              </Badge>

              {comparison.weightDiffKg !== null && (
                <Badge
                  variant={comparison.weightDiffKg < 0 ? 'accent' : 'outline'}
                  className="text-xs font-mono"
                >
                  <Scale className="w-3 h-3 mr-1" />
                  Bodyweight:{' '}
                  {comparison.weightDiffKg > 0 ? '+' : ''}
                  {formatWeight(comparison.weightDiffKg)}
                </Badge>
              )}
            </div>
          )}
        </div>

        {/* Comparison Table */}
        {comparison ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-[var(--color-border)] bg-[var(--color-surface-hover)]/40 text-[11px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">
                  <th className="py-3 px-4">Measurement Site</th>
                  <th className="py-3 px-4">{dateA}</th>
                  <th className="py-3 px-4">{dateB}</th>
                  <th className="py-3 px-4">Difference ({circumferenceUnit})</th>
                  <th className="py-3 px-4 text-right">% Change</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border-subtle)] font-mono">
                {comparison.sites.map((site) => {
                  const hasDataA = site.valACm !== null
                  const hasDataB = site.valBCm !== null
                  const isPositive = site.diffCm !== null && site.diffCm > 0
                  const isZero = site.diffCm !== null && site.diffCm === 0

                  return (
                    <tr
                      key={site.key}
                      className="hover:bg-[var(--color-surface-hover)]/40 transition-colors"
                    >
                      {/* Label */}
                      <td className="py-3 px-4 font-sans font-medium text-[var(--color-text-primary)]">
                        {site.label}
                      </td>

                      {/* Date A */}
                      <td className="py-3 px-4 text-[var(--color-text-primary)]">
                        {hasDataA ? formatCircumference(site.valACm) : (
                          <span className="text-[var(--color-text-muted)] font-sans italic text-[11px]">
                            Not recorded
                          </span>
                        )}
                      </td>

                      {/* Date B */}
                      <td className="py-3 px-4 text-[var(--color-text-secondary)]">
                        {hasDataB ? formatCircumference(site.valBCm) : (
                          <span className="text-[var(--color-text-muted)] font-sans italic text-[11px]">
                            Not recorded
                          </span>
                        )}
                      </td>

                      {/* Difference */}
                      <td className="py-3 px-4">
                        {site.diffCm !== null ? (
                          <span
                            className={`flex items-center gap-1 font-semibold ${
                              isZero
                                ? 'text-[var(--color-text-muted)]'
                                : isPositive
                                ? 'text-amber-500'
                                : 'text-blue-500'
                            }`}
                          >
                            {isZero ? (
                              <Minus className="w-3 h-3" />
                            ) : isPositive ? (
                              <TrendingUp className="w-3 h-3" />
                            ) : (
                              <TrendingDown className="w-3 h-3" />
                            )}
                            {isPositive ? '+' : ''}
                            {formatCircumference(site.diffCm)}
                          </span>
                        ) : (
                          <span className="text-[var(--color-text-muted)]">—</span>
                        )}
                      </td>

                      {/* % Change */}
                      <td className="py-3 px-4 text-right">
                        {site.pctChange !== null ? (
                          <span
                            className={`font-semibold ${
                              site.pctChange === 0
                                ? 'text-[var(--color-text-muted)]'
                                : site.pctChange > 0
                                ? 'text-amber-500'
                                : 'text-blue-500'
                            }`}
                          >
                            {site.pctChange > 0 ? '+' : ''}
                            {site.pctChange}%
                          </span>
                        ) : (
                          <span className="text-[var(--color-text-muted)]">—</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-8 text-center text-xs text-[var(--color-text-muted)]">
            Please select two distinct dates to calculate the difference.
          </div>
        )}
      </CardContent>
    </Card>
  )
}
