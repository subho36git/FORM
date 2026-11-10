import React, { useState, useMemo } from 'react'
import { TrendingUp, Layers, Check } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card'
import {
  TrendLineChart,
  type TrendLineSeries,
} from '@/features/analytics/components/charts/TrendLineChart'
import { useUnit } from '@/hooks/useUnit'
import { useMetrics } from '../context/MetricsContext'
import { MEASUREMENT_SITES, type MeasurementSiteKey } from '../types'

type TimeframeOption = '1M' | '3M' | '6M' | '1Y' | 'ALL'

export const MeasurementTrendCharts: React.FC = () => {
  const { circumferenceUnit, cmToCircumferenceDisplay } = useUnit()
  const { measurements } = useMetrics()

  // Selected site for focused trend
  const [selectedSiteKey, setSelectedSiteKey] = useState<MeasurementSiteKey>('waist')
  const [timeframe, setTimeframe] = useState<TimeframeOption>('ALL')

  // Filter measurements by timeframe
  const filteredMeasurements = useMemo(() => {
    if (timeframe === 'ALL') return measurements

    const now = new Date()
    let daysCutoff = 30
    if (timeframe === '3M') daysCutoff = 90
    if (timeframe === '6M') daysCutoff = 180
    if (timeframe === '1Y') daysCutoff = 365

    const cutoffTime = now.getTime() - daysCutoff * 86400000
    return measurements.filter((m) => new Date(m.measuredDate).getTime() >= cutoffTime)
  }, [measurements, timeframe])

  // Chronologically sorted entries for the chart (earliest to latest)
  const chronologicalEntries = useMemo(() => {
    return [...filteredMeasurements].reverse()
  }, [filteredMeasurements])

  const selectedSite = MEASUREMENT_SITES.find((s) => s.key === selectedSiteKey) || MEASUREMENT_SITES[0]

  // Build chart series
  const chartSeries = useMemo<TrendLineSeries[]>(() => {
    if (chronologicalEntries.length === 0) return []

    const data = chronologicalEntries
      .map((entry) => {
        const rawCm = entry[selectedSite.field] as number | null
        const displayVal = rawCm !== null ? cmToCircumferenceDisplay(rawCm) : null
        return {
          x: entry.measuredDate,
          y: displayVal,
          label: `${entry.measuredDate}: ${displayVal !== null ? `${displayVal} ${circumferenceUnit}` : 'Not recorded'}`,
        }
      })
      .filter((pt) => pt.y !== null)

    return [
      {
        id: selectedSite.key,
        name: selectedSite.label,
        data,
        color: 'var(--color-accent)',
        showAreaGradient: true,
        showPoints: true,
      },
    ]
  }, [chronologicalEntries, selectedSite, cmToCircumferenceDisplay, circumferenceUnit])

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-[var(--color-accent)]" />
              <CardTitle>Circumference Progression Trends</CardTitle>
            </div>
            <CardDescription>
              Interactive trajectory over time. Values displayed in {circumferenceUnit}.
            </CardDescription>
          </div>

          {/* Timeframe Selector */}
          <div className="flex items-center gap-1 p-1 bg-[var(--color-surface-hover)] rounded-lg border border-[var(--color-border)] self-start sm:self-auto text-xs">
            {(['1M', '3M', '6M', '1Y', 'ALL'] as TimeframeOption[]).map((tf) => (
              <button
                key={tf}
                type="button"
                onClick={() => setTimeframe(tf)}
                className={`px-2.5 py-1 rounded-md font-semibold transition-all cursor-pointer ${
                  timeframe === tf
                    ? 'bg-[var(--color-surface)] text-[var(--color-text-primary)] shadow-xs'
                    : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'
                }`}
              >
                {tf}
              </button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Site Pill Filter Buttons */}
        <div className="flex flex-wrap items-center gap-1.5 pb-2 border-b border-[var(--color-border-subtle)]">
          <span className="text-[11px] font-semibold text-[var(--color-text-muted)] mr-1 uppercase">
            Site:
          </span>
          {MEASUREMENT_SITES.map((site) => {
            const isSelected = selectedSiteKey === site.key
            return (
              <button
                key={site.key}
                type="button"
                onClick={() => setSelectedSiteKey(site.key)}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer flex items-center gap-1 ${
                  isSelected
                    ? 'bg-[var(--color-accent)] text-white shadow-xs font-semibold'
                    : 'bg-[var(--color-surface-hover)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-hover)]/80'
                }`}
              >
                {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                <span>{site.label}</span>
              </button>
            )
          })}
        </div>

        {/* SVG Line Chart */}
        <div className="pt-2">
          {chartSeries.length > 0 && chartSeries[0].data.length > 0 ? (
            <TrendLineChart
              series={chartSeries}
              height={260}
              yAxisFormatter={(val) => `${val} ${circumferenceUnit}`}
              tooltipDateFormatter={(d) => d}
              emptyMessage={`No ${selectedSite.label} measurements recorded in this timeframe.`}
            />
          ) : (
            <div className="h-64 flex flex-col items-center justify-center rounded-xl border border-dashed border-[var(--color-border)] text-xs text-[var(--color-text-muted)] space-y-2">
              <Layers className="w-6 h-6 text-[var(--color-text-muted)]" />
              <span>No recorded measurements for {selectedSite.label} in this period.</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

