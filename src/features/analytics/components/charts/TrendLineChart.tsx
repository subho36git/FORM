import React, { useState, useId } from 'react'

export interface TrendLinePoint {
  x: string // YYYY-MM-DD or date label
  y: number | null
  label?: string
}

export interface TrendLineSeries {
  id: string
  name: string
  data: TrendLinePoint[]
  color?: string // CSS color or variable, e.g., 'var(--color-accent)'
  isDashed?: boolean
  showAreaGradient?: boolean
  showPoints?: boolean
}

export interface TargetLine {
  value: number
  label: string
  color?: string
  isDashed?: boolean
}

export interface TrendLineChartProps {
  series: TrendLineSeries[]
  targetLine?: TargetLine
  height?: number
  yAxisFormatter?: (val: number) => string
  tooltipDateFormatter?: (dateStr: string) => string
  emptyMessage?: string
  className?: string
}

export const TrendLineChart: React.FC<TrendLineChartProps> = ({
  series,
  targetLine,
  height = 260,
  yAxisFormatter = (val) => val.toFixed(1),
  tooltipDateFormatter = (dateStr) => dateStr,
  emptyMessage = 'No trend data recorded for this timeframe.',
  className = '',
}) => {
  const chartId = useId().replace(/:/g, '')
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)

  // 1. Gather all unique valid dates across all series (sorted chronologically)
  const allDatesSet = new Set<string>()
  for (const s of series) {
    for (const pt of s.data) {
      if (pt.x) allDatesSet.add(pt.x)
    }
  }
  const sortedDates = Array.from(allDatesSet).sort()

  // 2. Gather all non-null Y values to establish Y domain
  const allYValues: number[] = []
  for (const s of series) {
    for (const pt of s.data) {
      if (typeof pt.y === 'number' && !isNaN(pt.y)) {
        allYValues.push(pt.y)
      }
    }
  }

  if (targetLine && typeof targetLine.value === 'number') {
    allYValues.push(targetLine.value)
  }

  // Check for empty dataset
  if (sortedDates.length === 0 || allYValues.length === 0) {
    return (
      <div
        className={`flex flex-col items-center justify-center p-8 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] text-center ${className}`}
        style={{ height }}
      >
        <div className="w-10 h-10 rounded-full bg-[var(--color-surface-hover)] border border-[var(--color-border)] flex items-center justify-center mb-2.5 text-[var(--color-text-muted)]">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
          </svg>
        </div>
        <p className="text-sm font-medium text-[var(--color-text-secondary)]">{emptyMessage}</p>
        <p className="text-xs text-[var(--color-text-muted)] mt-0.5">Logs will appear here once recorded.</p>
      </div>
    )
  }

  // 3. Compute Y domain with padding
  const rawMinY = Math.min(...allYValues)
  const rawMaxY = Math.max(...allYValues)
  const ySpan = rawMaxY - rawMinY

  let domainMin = rawMinY - (ySpan > 0 ? ySpan * 0.12 : 2)
  let domainMax = rawMaxY + (ySpan > 0 ? ySpan * 0.12 : 2)

  if (domainMin === domainMax) {
    domainMin -= 2
    domainMax += 2
  }

  // Dimensions & Padding
  const viewBoxWidth = 640
  const viewBoxHeight = height
  const padLeft = 52
  const padRight = 24
  const padTop = 20
  const padBottom = 32

  const plotWidth = viewBoxWidth - padLeft - padRight
  const plotHeight = viewBoxHeight - padTop - padBottom

  // Coordinate scales
  const getX = (index: number) => {
    if (sortedDates.length <= 1) return padLeft + plotWidth / 2
    return padLeft + (index / (sortedDates.length - 1)) * plotWidth
  }

  const getY = (val: number) => {
    const ratio = (val - domainMin) / (domainMax - domainMin)
    return padTop + plotHeight - ratio * plotHeight
  }

  // 4. Build Y-axis Grid Lines & Labels (4 ticks)
  const yTicks = [
    domainMin,
    domainMin + (domainMax - domainMin) * 0.33,
    domainMin + (domainMax - domainMin) * 0.66,
    domainMax,
  ]

  // 5. Build X-axis Labels (up to 5 labels distributed evenly)
  const xLabelIndices: number[] = []
  if (sortedDates.length <= 5) {
    sortedDates.forEach((_, idx) => xLabelIndices.push(idx))
  } else {
    const step = (sortedDates.length - 1) / 4
    for (let i = 0; i < 5; i++) {
      xLabelIndices.push(Math.round(i * step))
    }
  }

  // 6. Generate SVG paths for each series
  const seriesPaths = series.map((s, sIdx) => {
    // Map dates to points
    const dateToPointMap = new Map<string, number | null>()
    for (const pt of s.data) {
      dateToPointMap.set(pt.x, pt.y)
    }

    const points: Array<{ x: number; y: number; originalVal: number; dateIndex: number }> = []
    sortedDates.forEach((date, dIdx) => {
      const val = dateToPointMap.get(date)
      if (typeof val === 'number' && !isNaN(val)) {
        points.push({
          x: getX(dIdx),
          y: getY(val),
          originalVal: val,
          dateIndex: dIdx,
        })
      }
    })

    if (points.length === 0) {
      return { series: s, linePath: '', areaPath: '', points: [] }
    }

    // Build smooth Bézier spline
    let linePath = `M ${points[0].x} ${points[0].y}`
    for (let i = 1; i < points.length; i++) {
      const prev = points[i - 1]
      const curr = points[i]
      const cp1x = prev.x + (curr.x - prev.x) / 2
      const cp1y = prev.y
      const cp2x = curr.x - (curr.x - prev.x) / 2
      const cp2y = curr.y
      linePath += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${curr.x} ${curr.y}`
    }

    // Build area fill path
    let areaPath = ''
    if (s.showAreaGradient && points.length > 1) {
      const baseY = padTop + plotHeight
      areaPath = `${linePath} L ${points[points.length - 1].x} ${baseY} L ${points[0].x} ${baseY} Z`
    }

    const defaultColor = sIdx === 0 ? 'var(--color-accent)' : '#3B82F6'
    const color = s.color || defaultColor

    return {
      series: s,
      linePath,
      areaPath,
      points,
      color,
    }
  })

  // Target line Y coordinate
  const targetY = targetLine && typeof targetLine.value === 'number' ? getY(targetLine.value) : null

  // Active hover data for tooltip
  const activeDate = hoveredIndex !== null ? sortedDates[hoveredIndex] : null
  const activeValues = hoveredIndex !== null && activeDate
    ? series.map((s) => {
        const pt = s.data.find((p) => p.x === activeDate)
        return {
          seriesName: s.name,
          color: s.color || 'var(--color-accent)',
          val: pt ? pt.y : null,
        }
      }).filter((item) => item.val !== null)
    : []

  const activeX = hoveredIndex !== null ? getX(hoveredIndex) : null

  return (
    <div className={`relative flex flex-col rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 sm:p-5 ${className}`}>
      {/* Series Legend & Target Indicator */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3 text-xs">
        <div className="flex flex-wrap items-center gap-4">
          {series.map((s, idx) => {
            const color = s.color || (idx === 0 ? 'var(--color-accent)' : '#3B82F6')
            return (
              <div key={s.id || idx} className="flex items-center gap-1.5 text-[var(--color-text-secondary)] font-medium">
                <span
                  className="w-2.5 h-2.5 rounded-full inline-block"
                  style={{ backgroundColor: color }}
                />
                <span>{s.name}</span>
              </div>
            )
          })}
          {targetLine && (
            <div className="flex items-center gap-1.5 text-[var(--color-text-muted)] font-medium">
              <span
                className="w-3.5 h-0.5 border-t-2 border-dashed inline-block"
                style={{ borderColor: targetLine.color || 'var(--color-text-muted)' }}
              />
              <span>{targetLine.label} ({yAxisFormatter(targetLine.value)})</span>
            </div>
          )}
        </div>

        {/* Live Hover Info Pill */}
        {activeDate && (
          <div className="text-[11px] font-medium text-[var(--color-text-muted)] animate-in fade-in duration-150">
            {tooltipDateFormatter(activeDate)}
          </div>
        )}
      </div>

      {/* SVG Chart Canvas */}
      <div className="relative w-full overflow-hidden select-none">
        <svg
          viewBox={`0 0 ${viewBoxWidth} ${viewBoxHeight}`}
          className="w-full h-auto overflow-visible"
          style={{ maxHeight: height }}
          onMouseLeave={() => setHoveredIndex(null)}
        >
          <defs>
            {seriesPaths.map((sp, idx) => (
              <linearGradient
                key={idx}
                id={`grad-${chartId}-${idx}`}
                x1="0"
                y1="0"
                x2="0"
                y2="1"
              >
                <stop offset="0%" stopColor={sp.color} stopOpacity="0.22" />
                <stop offset="100%" stopColor={sp.color} stopOpacity="0.0" />
              </linearGradient>
            ))}
          </defs>

          {/* Horizontal Gridlines & Y-Axis Labels */}
          {yTicks.map((val, idx) => {
            const yPos = getY(val)
            return (
              <g key={idx}>
                <line
                  x1={padLeft}
                  y1={yPos}
                  x2={viewBoxWidth - padRight}
                  y2={yPos}
                  stroke="var(--color-border-subtle)"
                  strokeWidth="1"
                  strokeDasharray={idx === 0 ? undefined : '3 3'}
                />
                <text
                  x={padLeft - 8}
                  y={yPos + 3.5}
                  textAnchor="end"
                  className="text-[10px] fill-[var(--color-text-muted)] font-mono"
                >
                  {yAxisFormatter(val)}
                </text>
              </g>
            )
          })}

          {/* Optional Reference Target Line */}
          {targetY !== null && targetLine && (
            <g>
              <line
                x1={padLeft}
                y1={targetY}
                x2={viewBoxWidth - padRight}
                y2={targetY}
                stroke={targetLine.color || 'var(--color-text-muted)'}
                strokeWidth="1.5"
                strokeDasharray={targetLine.isDashed !== false ? '4 4' : undefined}
                strokeOpacity="0.75"
              />
              <text
                x={viewBoxWidth - padRight + 4}
                y={targetY + 3.5}
                textAnchor="start"
                className="text-[9px] font-semibold fill-[var(--color-text-muted)] tracking-wider"
              >
                TARGET
              </text>
            </g>
          )}

          {/* Series Areas and Lines */}
          {seriesPaths.map((sp, idx) => (
            <g key={idx}>
              {sp.areaPath && (
                <path
                  d={sp.areaPath}
                  fill={`url(#grad-${chartId}-${idx})`}
                  className="transition-all duration-300"
                />
              )}
              {sp.linePath && (
                <path
                  d={sp.linePath}
                  fill="none"
                  stroke={sp.color}
                  strokeWidth={sp.series.isDashed ? '1.75' : '2.5'}
                  strokeDasharray={sp.series.isDashed ? '4 4' : undefined}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="transition-all duration-200"
                />
              )}
              {/* Discrete Data Point Markers */}
              {sp.series.showPoints !== false &&
                sp.points.map((pt, pIdx) => {
                  const isHovered = hoveredIndex === pt.dateIndex
                  return (
                    <circle
                      key={pIdx}
                      cx={pt.x}
                      cy={pt.y}
                      r={isHovered ? 5.5 : 3.5}
                      fill="var(--color-surface)"
                      stroke={sp.color}
                      strokeWidth={isHovered ? 2.5 : 1.75}
                      className="transition-transform duration-150 cursor-pointer"
                    />
                  )
                })}
            </g>
          ))}

          {/* Active Hover Vertical Guide Line */}
          {activeX !== null && (
            <line
              x1={activeX}
              y1={padTop}
              x2={activeX}
              y2={padTop + plotHeight}
              stroke="var(--color-text-muted)"
              strokeWidth="1"
              strokeDasharray="2 2"
              strokeOpacity="0.6"
            />
          )}

          {/* X-Axis Labels */}
          {xLabelIndices.map((dIdx) => {
            const dateStr = sortedDates[dIdx]
            if (!dateStr) return null
            const xPos = getX(dIdx)
            return (
              <text
                key={dIdx}
                x={xPos}
                y={padTop + plotHeight + 18}
                textAnchor="middle"
                className="text-[10px] fill-[var(--color-text-muted)] font-mono"
              >
                {tooltipDateFormatter(dateStr)}
              </text>
            )
          })}

          {/* Transparent Hover Hitbox Columns */}
          {sortedDates.map((_, idx) => {
            const colWidth = plotWidth / sortedDates.length
            const xPos = getX(idx) - colWidth / 2
            return (
              <rect
                key={idx}
                x={Math.max(padLeft, xPos)}
                y={padTop}
                width={Math.max(12, colWidth)}
                height={plotHeight}
                fill="transparent"
                className="cursor-crosshair"
                onMouseEnter={() => setHoveredIndex(idx)}
                tabIndex={0}
                aria-label={`Data for ${sortedDates[idx]}`}
                onFocus={() => setHoveredIndex(idx)}
              />
            )
          })}
        </svg>

        {/* Floating Tooltip Box */}
        {hoveredIndex !== null && activeX !== null && activeValues.length > 0 && (
          <div
            className="absolute top-2 pointer-events-none transition-all duration-100 bg-[var(--color-surface)]/95 backdrop-blur-md border border-[var(--color-border)] shadow-lg rounded-lg p-2.5 z-20 text-xs min-w-[130px]"
            style={{
              left: Math.min(
                viewBoxWidth - 140,
                Math.max(10, (activeX / viewBoxWidth) * 100)
              ) + '%',
              transform: 'translateX(-50%)',
            }}
          >
            <div className="font-semibold text-[var(--color-text-primary)] border-b border-[var(--color-border-subtle)] pb-1 mb-1.5 text-[11px]">
              {tooltipDateFormatter(activeDate || '')}
            </div>
            <div className="space-y-1">
              {activeValues.map((v, i) => (
                <div key={i} className="flex items-center justify-between gap-3 text-[11px]">
                  <div className="flex items-center gap-1.5 truncate">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: v.color }} />
                    <span className="text-[var(--color-text-secondary)] truncate">{v.seriesName}</span>
                  </div>
                  <span className="font-bold text-[var(--color-text-primary)] font-mono shrink-0">
                    {yAxisFormatter(v.val as number)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
