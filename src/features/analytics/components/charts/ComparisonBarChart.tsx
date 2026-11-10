import React, { useState } from 'react'

export interface ComparisonBarItem {
  id?: string
  label: string
  actual: number
  target?: number | null
  subLabel?: string
  status?: 'normal' | 'success' | 'warning' | 'danger'
}

export interface ComparisonBarChartProps {
  data: ComparisonBarItem[]
  height?: number
  valueFormatter?: (val: number) => string
  targetFormatter?: (val: number) => string
  emptyMessage?: string
  barColor?: string
  targetColor?: string
  showTargetLineAcross?: boolean
  className?: string
}

export const ComparisonBarChart: React.FC<ComparisonBarChartProps> = ({
  data,
  height = 240,
  valueFormatter = (val) => val.toLocaleString(),
  targetFormatter = (val) => val.toLocaleString(),
  emptyMessage = 'No comparison data available.',
  barColor = 'var(--color-accent)',
  targetColor = 'var(--color-text-muted)',
  showTargetLineAcross = false,
  className = '',
}) => {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null)

  // Validate dataset
  if (!data || data.length === 0) {
    return (
      <div
        className={`flex flex-col items-center justify-center p-8 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] text-center ${className}`}
        style={{ height }}
      >
        <div className="w-10 h-10 rounded-full bg-[var(--color-surface-hover)] border border-[var(--color-border)] flex items-center justify-center mb-2.5 text-[var(--color-text-muted)]">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
        </div>
        <p className="text-sm font-medium text-[var(--color-text-secondary)]">{emptyMessage}</p>
        <p className="text-xs text-[var(--color-text-muted)] mt-0.5">Logs will populate this chart once recorded.</p>
      </div>
    )
  }

  // Determine global max for scaling
  let maxVal = 0
  for (const item of data) {
    if (item.actual > maxVal) maxVal = item.actual
    if (item.target && item.target > maxVal) maxVal = item.target
  }

  if (maxVal === 0) maxVal = 100 // fallback when all zero
  maxVal = Math.ceil(maxVal * 1.15) // 15% headroom

  // Dimensions
  const viewBoxWidth = 600
  const viewBoxHeight = height
  const padLeft = 44
  const padRight = 16
  const padTop = 24
  const padBottom = 32

  const plotWidth = viewBoxWidth - padLeft - padRight
  const plotHeight = viewBoxHeight - padTop - padBottom

  // Ticks for Y-axis (4 levels)
  const yTicks = [0, maxVal * 0.33, maxVal * 0.66, maxVal]
  const getY = (val: number) => {
    const ratio = Math.min(1, Math.max(0, val / maxVal))
    return padTop + plotHeight - ratio * plotHeight
  }

  // Bar layout math
  const n = data.length
  const step = plotWidth / n
  const barWidth = Math.min(32, Math.max(8, step * 0.55))

  // Global target (if uniform target across dataset)
  const uniformTarget = data.find((d) => d.target && d.target > 0)?.target

  return (
    <div className={`relative flex flex-col rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 sm:p-5 ${className}`}>
      {/* Legend & Summary Info */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3 text-xs">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5 text-[var(--color-text-secondary)] font-medium">
            <span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ backgroundColor: barColor }} />
            <span>Actual</span>
          </div>
          {uniformTarget && (
            <div className="flex items-center gap-1.5 text-[var(--color-text-muted)] font-medium">
              <span className="w-3.5 h-0.5 border-t-2 border-dashed inline-block" style={{ borderColor: targetColor }} />
              <span>Target ({targetFormatter(uniformTarget)})</span>
            </div>
          )}
        </div>
        {hoveredIdx !== null && data[hoveredIdx] && (
          <div className="text-[11px] font-medium text-[var(--color-text-muted)]">
            {data[hoveredIdx].label}
          </div>
        )}
      </div>

      {/* SVG Canvas */}
      <div className="relative w-full overflow-hidden select-none">
        <svg
          viewBox={`0 0 ${viewBoxWidth} ${viewBoxHeight}`}
          className="w-full h-auto overflow-visible"
          style={{ maxHeight: height }}
          onMouseLeave={() => setHoveredIdx(null)}
        >
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
                  {valueFormatter(val)}
                </text>
              </g>
            )
          })}

          {/* Optional Constant Horizontal Target Line */}
          {showTargetLineAcross && uniformTarget && (
            <g>
              <line
                x1={padLeft}
                y1={getY(uniformTarget)}
                x2={viewBoxWidth - padRight}
                y2={getY(uniformTarget)}
                stroke={targetColor}
                strokeWidth="1.5"
                strokeDasharray="4 4"
                strokeOpacity="0.75"
              />
            </g>
          )}

          {/* Bars & Markers */}
          {data.map((item, idx) => {
            const isHovered = hoveredIdx === idx
            const centerX = padLeft + idx * step + step / 2
            const barX = centerX - barWidth / 2
            const barY = getY(item.actual)
            const barH = padTop + plotHeight - barY

            // Color status overrides
            let fill = barColor
            if (item.status === 'warning') fill = 'var(--color-warning)'
            else if (item.status === 'danger') fill = 'var(--color-danger)'
            else if (item.status === 'success') fill = 'var(--color-accent)'

            // Item-specific target marker (if not showing target across or if individual)
            const itemTargetY = item.target ? getY(item.target) : null

            return (
              <g key={item.id || idx}>
                {/* Bar */}
                <rect
                  x={barX}
                  y={barY}
                  width={barWidth}
                  height={Math.max(2, barH)}
                  rx={3.5}
                  fill={fill}
                  opacity={hoveredIdx !== null && !isHovered ? 0.45 : isHovered ? 1 : 0.85}
                  className="transition-all duration-150 cursor-pointer"
                />

                {/* Individual Target Marker Line (if individual target exists) */}
                {itemTargetY !== null && !showTargetLineAcross && (
                  <line
                    x1={barX - 4}
                    y1={itemTargetY}
                    x2={barX + barWidth + 4}
                    y2={itemTargetY}
                    stroke={targetColor}
                    strokeWidth="2"
                    strokeLinecap="round"
                    className="opacity-90"
                  />
                )}

                {/* X-Axis Category Label */}
                <text
                  x={centerX}
                  y={padTop + plotHeight + 18}
                  textAnchor="middle"
                  className={`text-[10px] font-mono transition-colors duration-150 ${
                    isHovered ? 'fill-[var(--color-text-primary)] font-semibold' : 'fill-[var(--color-text-muted)]'
                  }`}
                >
                  {item.label}
                </text>

                {/* Transparent Interactive Hitbox */}
                <rect
                  x={padLeft + idx * step}
                  y={padTop}
                  width={step}
                  height={plotHeight}
                  fill="transparent"
                  className="cursor-pointer"
                  onMouseEnter={() => setHoveredIdx(idx)}
                  onFocus={() => setHoveredIdx(idx)}
                  tabIndex={0}
                  aria-label={`${item.label}: actual ${item.actual}${item.target ? `, target ${item.target}` : ''}`}
                />
              </g>
            )
          })}
        </svg>

        {/* Floating Tooltip Box */}
        {hoveredIdx !== null && data[hoveredIdx] && (
          <div
            className="absolute top-2 pointer-events-none transition-all duration-100 bg-[var(--color-surface)]/95 backdrop-blur-md border border-[var(--color-border)] shadow-lg rounded-lg p-2.5 z-20 text-xs min-w-[140px]"
            style={{
              left: Math.min(
                viewBoxWidth - 140,
                Math.max(
                  10,
                  ((padLeft + hoveredIdx * step + step / 2) / viewBoxWidth) * 100
                )
              ) + '%',
              transform: 'translateX(-50%)',
            }}
          >
            <div className="font-semibold text-[var(--color-text-primary)] border-b border-[var(--color-border-subtle)] pb-1 mb-1.5 text-[11px]">
              {data[hoveredIdx].label}
              {data[hoveredIdx].subLabel && (
                <span className="text-[10px] text-[var(--color-text-muted)] font-normal block">
                  {data[hoveredIdx].subLabel}
                </span>
              )}
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between gap-3 text-[11px]">
                <span className="text-[var(--color-text-secondary)]">Actual:</span>
                <span className="font-bold text-[var(--color-text-primary)] font-mono">
                  {valueFormatter(data[hoveredIdx].actual)}
                </span>
              </div>

              {data[hoveredIdx].target && (
                <>
                  <div className="flex items-center justify-between gap-3 text-[11px]">
                    <span className="text-[var(--color-text-muted)]">Target:</span>
                    <span className="font-semibold text-[var(--color-text-muted)] font-mono">
                      {targetFormatter(data[hoveredIdx].target!)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-3 text-[10px] pt-1 border-t border-[var(--color-border-subtle)]">
                    <span className="text-[var(--color-text-muted)]">Variance:</span>
                    <span
                      className={`font-semibold font-mono ${
                        data[hoveredIdx].actual >= data[hoveredIdx].target!
                          ? 'text-[var(--color-accent)]'
                          : 'text-[var(--color-warning)]'
                      }`}
                    >
                      {data[hoveredIdx].actual >= data[hoveredIdx].target! ? '+' : ''}
                      {valueFormatter(data[hoveredIdx].actual - data[hoveredIdx].target!)}
                    </span>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
