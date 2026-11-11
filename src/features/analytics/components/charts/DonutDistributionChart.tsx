import React, { useState } from 'react'

export interface DonutSegment {
  id: string
  label: string
  value: number
  color?: string
  subLabel?: string
}

export interface DonutDistributionChartProps {
  segments: DonutSegment[]
  size?: number
  innerRadiusRatio?: number // default 0.68
  valueFormatter?: (val: number) => string
  unitLabel?: string
  centerLabel?: string
  emptyMessage?: string
  className?: string
}

const DEFAULT_PALETTE = [
  'var(--chart-primary)', // Primary Blue (#5680E9)
  'var(--chart-secondary)', // Bright Cyan Blue (#5AB9EA)
  'var(--chart-tertiary)', // Lavender (#8860D0)
  'var(--chart-supporting)', // Sky Cyan (#84CEEB)
  'var(--color-periwinkle)', // Periwinkle (#C1C8E4)
  '#466ECC', // Deep Primary Blue
  '#6FC9F0', // Vibrant Sky Cyan
  '#9B78D8', // Light Lavender
]

export const DonutDistributionChart: React.FC<DonutDistributionChartProps> = ({
  segments,
  size = 220,
  innerRadiusRatio = 0.68,
  valueFormatter = (val) => val.toLocaleString(),
  unitLabel = '',
  centerLabel = 'Total',
  emptyMessage = 'No distribution data available.',
  className = '',
}) => {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null)

  // Filter valid non-negative segments
  const validSegments = (segments || []).filter((s) => s.value > 0)
  const totalValue = validSegments.reduce((sum, s) => sum + s.value, 0)

  // Empty state check
  if (!segments || segments.length === 0 || totalValue === 0) {
    return (
      <div className={`flex flex-col items-center justify-center p-8 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] text-center ${className}`}>
        <div className="w-12 h-12 rounded-full border-2 border-dashed border-[var(--color-border)] flex items-center justify-center mb-2.5 text-[var(--color-text-muted)]">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" />
          </svg>
        </div>
        <p className="text-sm font-medium text-[var(--color-text-secondary)]">{emptyMessage}</p>
        <p className="text-xs text-[var(--color-text-muted)] mt-0.5">Distribution will appear once logged.</p>
      </div>
    )
  }

  // Geometry
  const viewBoxSize = 220
  const center = viewBoxSize / 2
  const outerRadius = 88
  const innerRadius = outerRadius * innerRadiusRatio

  // Calculate arc slices
  const slices: Array<{
    segment: DonutSegment
    color: string
    percentage: number
    pathData: string
    fraction: number
  }> = []

  let currentAngle = -Math.PI / 2 // Start at 12 o'clock

  for (let idx = 0; idx < validSegments.length; idx++) {
    const segment = validSegments[idx]
    const fraction = segment.value / totalValue
    const angle = fraction * 2 * Math.PI
    const startAngle = currentAngle
    const endAngle = currentAngle + angle
    currentAngle = endAngle

    const color = segment.color || DEFAULT_PALETTE[idx % DEFAULT_PALETTE.length]
    const percentage = Math.round(fraction * 1000) / 10

    // Arc points
    const x1Outer = center + outerRadius * Math.cos(startAngle)
    const y1Outer = center + outerRadius * Math.sin(startAngle)
    const x2Outer = center + outerRadius * Math.cos(endAngle)
    const y2Outer = center + outerRadius * Math.sin(endAngle)

    const x1Inner = center + innerRadius * Math.cos(startAngle)
    const y1Inner = center + innerRadius * Math.sin(startAngle)
    const x2Inner = center + innerRadius * Math.cos(endAngle)
    const y2Inner = center + innerRadius * Math.sin(endAngle)

    const largeArcFlag = angle > Math.PI ? 1 : 0

    // Handle full circle edge case (fraction close to 1)
    let pathData: string
    if (fraction > 0.999) {
      // SVG arc cannot do 360 degree in one single arc; draw two 180-deg arcs
      const midAngle = startAngle + Math.PI
      const xMidOuter = center + outerRadius * Math.cos(midAngle)
      const yMidOuter = center + outerRadius * Math.sin(midAngle)
      const xMidInner = center + innerRadius * Math.cos(midAngle)
      const yMidInner = center + innerRadius * Math.sin(midAngle)

      pathData = [
        `M ${x1Outer} ${y1Outer}`,
        `A ${outerRadius} ${outerRadius} 0 0 1 ${xMidOuter} ${yMidOuter}`,
        `A ${outerRadius} ${outerRadius} 0 0 1 ${x1Outer} ${y1Outer}`,
        `L ${x1Inner} ${y1Inner}`,
        `A ${innerRadius} ${innerRadius} 0 0 0 ${xMidInner} ${yMidInner}`,
        `A ${innerRadius} ${innerRadius} 0 0 0 ${x1Inner} ${y1Inner}`,
        'Z',
      ].join(' ')
    } else {
      pathData = [
        `M ${x1Outer} ${y1Outer}`,
        `A ${outerRadius} ${outerRadius} 0 ${largeArcFlag} 1 ${x2Outer} ${y2Outer}`,
        `L ${x2Inner} ${y2Inner}`,
        `A ${innerRadius} ${innerRadius} 0 ${largeArcFlag} 0 ${x1Inner} ${y1Inner}`,
        'Z',
      ].join(' ')
    }

    slices.push({
      segment,
      color,
      percentage,
      pathData,
      fraction,
    })
  }

  // Center display values (hovered item or overall total)
  const activeSlice = hoveredIdx !== null ? slices[hoveredIdx] : null
  const activeValueDisplay = activeSlice
    ? valueFormatter(activeSlice.segment.value)
    : valueFormatter(totalValue)
  const activeLabelDisplay = activeSlice
    ? activeSlice.segment.label
    : centerLabel
  const activeSubDisplay = activeSlice
    ? `${activeSlice.percentage}%`
    : unitLabel

  return (
    <div className={`flex flex-col sm:flex-row items-center gap-6 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 ${className}`}>
      {/* Donut SVG Ring */}
      <div className="relative shrink-0 select-none flex items-center justify-center" style={{ width: size, height: size }}>
        <svg
          viewBox={`0 0 ${viewBoxSize} ${viewBoxSize}`}
          className="w-full h-full overflow-visible"
          onMouseLeave={() => setHoveredIdx(null)}
        >
          {/* Background muted track */}
          <circle
            cx={center}
            cy={center}
            r={(outerRadius + innerRadius) / 2}
            fill="none"
            stroke="var(--color-border-subtle)"
            strokeWidth={outerRadius - innerRadius}
          />

          {/* Slices */}
          {slices.map((slice, idx) => {
            const isHovered = hoveredIdx === idx
            return (
              <path
                key={slice.segment.id || idx}
                d={slice.pathData}
                fill={slice.color}
                opacity={hoveredIdx !== null && !isHovered ? 0.45 : isHovered ? 1 : 0.9}
                stroke="var(--color-surface)"
                strokeWidth={slices.length > 1 ? 2 : 0}
                className="transition-all duration-200 cursor-pointer focus:outline-none"
                onMouseEnter={() => setHoveredIdx(idx)}
                onFocus={() => setHoveredIdx(idx)}
                tabIndex={0}
                aria-label={`${slice.segment.label}: ${slice.segment.value} (${slice.percentage}%)`}
              />
            )
          })}
        </svg>

        {/* Center Cutout Text */}
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none p-4">
          <span className="text-[11px] font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider truncate max-w-[120px]">
            {activeLabelDisplay}
          </span>
          <span className="text-xl font-bold text-[var(--color-text-primary)] font-mono tracking-tight">
            {activeValueDisplay}
          </span>
          {activeSubDisplay && (
            <span className="text-[10px] font-medium text-[var(--color-accent)] mt-0.5">
              {activeSubDisplay}
            </span>
          )}
        </div>
      </div>

      {/* Legend & Breakdown List */}
      <div className="w-full flex-1 flex flex-col justify-center space-y-2">
        {slices.map((slice, idx) => {
          const isHovered = hoveredIdx === idx
          return (
            <div
              key={slice.segment.id || idx}
              className={`flex items-center justify-between p-1.5 rounded-lg transition-all duration-150 cursor-pointer ${
                isHovered
                  ? 'bg-[var(--color-surface-hover)] border border-[var(--color-border)]'
                  : 'hover:bg-[var(--color-surface-hover)]/60 border border-transparent'
              }`}
              onMouseEnter={() => setHoveredIdx(idx)}
              onMouseLeave={() => setHoveredIdx(null)}
            >
              <div className="flex items-center gap-2 truncate">
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: slice.color }}
                />
                <span className="text-xs font-medium text-[var(--color-text-primary)] truncate">
                  {slice.segment.label}
                </span>
                {slice.segment.subLabel && (
                  <span className="text-[10px] text-[var(--color-text-muted)] truncate hidden sm:inline">
                    ({slice.segment.subLabel})
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2 shrink-0 font-mono text-xs">
                <span className="font-semibold text-[var(--color-text-primary)]">
                  {valueFormatter(slice.segment.value)}
                </span>
                <span className="text-[11px] font-medium text-[var(--color-text-muted)] w-10 text-right">
                  {slice.percentage}%
                </span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
