import React, { useState } from 'react'

export interface HeatmapDayData {
  date: string // YYYY-MM-DD (local calendar)
  workoutCompleted?: boolean
  nutritionLogged?: boolean
  weightLogged?: boolean
  score?: number // 0: None, 1: Weigh-in, 2: Workout OR Nutrition, 3: Workout AND Nutrition
  workoutName?: string
  calories?: number
  weightKg?: number
  isUnavailable?: boolean
}

export type ActivityHeatmapFilter = 'all' | 'workouts' | 'nutrition' | 'weight'

export interface ActivityHeatmapProps {
  data: HeatmapDayData[]
  weeks?: 12 | 52
  endDate?: string // YYYY-MM-DD, defaults to today
  title?: string
  className?: string
  activityFilter?: ActivityHeatmapFilter
  onFilterChange?: (filter: ActivityHeatmapFilter) => void
  onWeeksChange?: (weeks: 12 | 52) => void
  showControls?: boolean
  isDateUnavailable?: (dateStr: string) => boolean
}

function parseYmd(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d)
}

function formatYmd(d: Date): string {
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function formatDisplayDate(dateStr: string): string {
  const d = parseYmd(dateStr)
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(d)
}

export const ActivityHeatmap: React.FC<ActivityHeatmapProps> = ({
  data,
  weeks: controlledWeeks,
  endDate,
  title = 'Activity & Consistency Grid',
  className = '',
  activityFilter: controlledFilter,
  onFilterChange,
  onWeeksChange,
  showControls = true,
  isDateUnavailable,
}) => {
  // Controlled vs uncontrolled weeks state
  const [internalWeeks, setInternalWeeks] = useState<12 | 52>(controlledWeeks || 12)
  const currentWeeks = controlledWeeks !== undefined ? controlledWeeks : internalWeeks

  const handleWeeksToggle = (newWeeks: 12 | 52) => {
    setInternalWeeks(newWeeks)
    onWeeksChange?.(newWeeks)
  }

  // Controlled vs uncontrolled filter state
  const [internalFilter, setInternalFilter] = useState<ActivityHeatmapFilter>(controlledFilter || 'all')
  const currentFilter = controlledFilter !== undefined ? controlledFilter : internalFilter

  const handleFilterToggle = (newFilter: ActivityHeatmapFilter) => {
    setInternalFilter(newFilter)
    onFilterChange?.(newFilter)
  }

  const [hoveredDay, setHoveredDay] = useState<{
    day: HeatmapDayData
    x: number
    y: number
  } | null>(null)

  // 1. Resolve end date (defaults to today local)
  const resolvedEnd = endDate ? parseYmd(endDate) : new Date()

  // 2. Map existing data by date for O(1) lookup
  const dataMap = new Map<string, HeatmapDayData>()
  for (const item of data || []) {
    if (item.date) {
      dataMap.set(item.date, item)
    }
  }

  // 3. Calculate grid bounds: Monday of (currentWeeks - 1) weeks ago to Sunday of current week
  // Day of week: 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  const endDayOfWeek = resolvedEnd.getDay()
  const daysToSunday = endDayOfWeek === 0 ? 0 : 7 - endDayOfWeek
  const gridEnd = new Date(resolvedEnd)
  gridEnd.setDate(gridEnd.getDate() + daysToSunday)

  const totalDays = currentWeeks * 7
  const gridStart = new Date(gridEnd)
  gridStart.setDate(gridStart.getDate() - totalDays + 1)

  // 4. Generate matrix of cells [weekIndex][dayOfWeekIndex]
  // dayOfWeekIndex: 0 = Mon, 1 = Tue, ..., 6 = Sun
  const gridWeeks: Array<{
    weekIndex: number
    days: Array<{
      dateStr: string
      dayOfWeek: number
      monthLabel?: string
      data: HeatmapDayData
    }>
  }> = []

  const currentCursor = new Date(gridStart)
  let lastSeenMonth = -1

  for (let w = 0; w < currentWeeks; w++) {
    const weekDays: (typeof gridWeeks)[0]['days'] = []
    for (let d = 0; d < 7; d++) {
      const dateStr = formatYmd(currentCursor)
      const existing = dataMap.get(dateStr)

      const isUnavailable =
        existing?.isUnavailable ??
        (isDateUnavailable ? isDateUnavailable(dateStr) : false)

      const dayData: HeatmapDayData = existing
        ? { ...existing, isUnavailable }
        : {
            date: dateStr,
            workoutCompleted: false,
            nutritionLogged: false,
            weightLogged: false,
            score: 0,
            isUnavailable,
          }

      // Check for month label on first row of week
      let monthLabel: string | undefined
      const currentMonth = currentCursor.getMonth()
      if (d === 0 && currentMonth !== lastSeenMonth) {
        lastSeenMonth = currentMonth
        monthLabel = currentCursor.toLocaleString('en-US', { month: 'short' })
      }

      // Day of week 0 = Mon, 6 = Sun
      const dayOfWeekNormalized = (currentCursor.getDay() + 6) % 7

      weekDays.push({
        dateStr,
        dayOfWeek: dayOfWeekNormalized,
        monthLabel,
        data: dayData,
      })

      currentCursor.setDate(currentCursor.getDate() + 1)
    }

    gridWeeks.push({
      weekIndex: w,
      days: weekDays,
    })
  }

  // Summary stats across active window
  const allWindowDays = gridWeeks.flatMap((w) => w.days.map((d) => d.data))
  const activeDaysCount = allWindowDays.filter(
    (d) => !d.isUnavailable && ((d.score ?? 0) > 0 || d.workoutCompleted || d.nutritionLogged || d.weightLogged)
  ).length
  const totalWorkouts = allWindowDays.filter((d) => d.workoutCompleted).length
  const totalNutrition = allWindowDays.filter((d) => d.nutritionLogged).length
  const totalWeight = allWindowDays.filter((d) => d.weightLogged).length

  // Dimensions
  const cellSize = 13
  const cellGap = 3
  const leftPadding = 32
  const topPadding = 20
  const rightPadding = 16
  const bottomPadding = 12

  const svgWidth = leftPadding + currentWeeks * (cellSize + cellGap) + rightPadding
  const svgHeight = topPadding + 7 * (cellSize + cellGap) + bottomPadding

  // Helper for cell color fill
  const getCellFill = (item: HeatmapDayData): string => {
    if (item.isUnavailable) {
      return 'url(#heatmap-unavailable-hatch)'
    }

    if (currentFilter === 'workouts') {
      return item.workoutCompleted ? 'var(--color-accent)' : 'var(--color-surface-hover)'
    }

    if (currentFilter === 'nutrition') {
      return item.nutritionLogged ? 'var(--color-accent-secondary)' : 'var(--color-surface-hover)'
    }

    if (currentFilter === 'weight') {
      return item.weightLogged ? 'var(--color-lavender)' : 'var(--color-surface-hover)'
    }

    // Default 'all': 0 to 3 scale
    let score = item.score ?? 0
    if (score === 0) {
      if (item.workoutCompleted && item.nutritionLogged) score = 3
      else if (item.workoutCompleted || item.nutritionLogged) score = 2
      else if (item.weightLogged) score = 1
    }

    switch (score) {
      case 3:
        return 'var(--color-accent)' // Full dual consistency (Primary Blue)
      case 2:
        return 'var(--color-accent-secondary)' // Workout OR Nutrition (Cyan Blue)
      case 1:
        return 'var(--color-periwinkle)' // Weigh-in only (Periwinkle)
      default:
        return 'var(--color-surface-hover)' // Inactive
    }
  }

  return (
    <div
      className={`flex flex-col rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 sm:p-5 ${className}`}
    >
      {/* Top Header & Summary Controls */}
      <div className="flex flex-col gap-3 mb-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h4 className="text-sm font-bold text-[var(--color-text-primary)] flex items-center gap-2">
              <span>{title}</span>
              <span className="text-[11px] font-normal text-[var(--color-text-muted)]">
                ({currentWeeks} weeks)
              </span>
            </h4>
            <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">
              Consistency tracking across workouts, nutrition, and weigh-ins.
            </p>
          </div>

          {/* Quick Metrics Pills */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <div className="px-2.5 py-1 rounded-md bg-[var(--color-surface-hover)] border border-[var(--color-border)] flex items-center gap-1.5 text-[var(--color-text-secondary)]">
              <span className="w-2 h-2 rounded-full bg-[var(--color-accent)]" />
              <span className="font-semibold text-[var(--color-text-primary)] font-mono">{activeDaysCount}</span>
              <span>active days</span>
            </div>
            <div className="px-2.5 py-1 rounded-md bg-[var(--color-surface-hover)] border border-[var(--color-border)] flex items-center gap-1.5 text-[var(--color-text-secondary)]">
              <span className="flex items-center gap-1">
                🏋️ <span className="font-semibold text-[var(--color-text-primary)] font-mono">{totalWorkouts}</span>
              </span>
              <span className="text-[var(--color-border)] mx-0.5">|</span>
              <span className="flex items-center gap-1">
                🥗 <span className="font-semibold text-[var(--color-text-primary)] font-mono">{totalNutrition}</span>
              </span>
              <span className="text-[var(--color-border)] mx-0.5">|</span>
              <span className="flex items-center gap-1">
                ⚖️ <span className="font-semibold text-[var(--color-text-primary)] font-mono">{totalWeight}</span>
              </span>
            </div>
          </div>
        </div>

        {/* Interactive Controls Bar: Weeks Toggle + Domain Filter Buttons */}
        {showControls && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-2 border-t border-[var(--color-border-subtle)]">
            {/* Activity Domain Filters */}
            <div className="flex items-center gap-1 p-0.5 bg-[var(--color-surface-hover)] rounded-lg border border-[var(--color-border)] self-start">
              <button
                type="button"
                onClick={() => handleFilterToggle('all')}
                className={`px-2.5 py-1 text-[11px] font-semibold rounded-md transition-all cursor-pointer ${
                  currentFilter === 'all'
                    ? 'bg-[var(--color-surface)] text-[var(--color-text-primary)] shadow-xs'
                    : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'
                }`}
              >
                All Activity
              </button>
              <button
                type="button"
                onClick={() => handleFilterToggle('workouts')}
                className={`px-2.5 py-1 text-[11px] font-semibold rounded-md transition-all cursor-pointer flex items-center gap-1 ${
                  currentFilter === 'workouts'
                    ? 'bg-[var(--color-surface)] text-[var(--color-accent)] shadow-xs'
                    : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'
                }`}
              >
                <span>🏋️ Workouts</span>
              </button>
              <button
                type="button"
                onClick={() => handleFilterToggle('nutrition')}
                className={`px-2.5 py-1 text-[11px] font-semibold rounded-md transition-all cursor-pointer flex items-center gap-1 ${
                  currentFilter === 'nutrition'
                    ? 'bg-[var(--color-surface)] text-[var(--color-accent-secondary)] shadow-xs'
                    : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'
                }`}
              >
                <span>🥗 Nutrition</span>
              </button>
              <button
                type="button"
                onClick={() => handleFilterToggle('weight')}
                className={`px-2.5 py-1 text-[11px] font-semibold rounded-md transition-all cursor-pointer flex items-center gap-1 ${
                  currentFilter === 'weight'
                    ? 'bg-[var(--color-surface)] text-[var(--color-lavender)] shadow-xs'
                    : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'
                }`}
              >
                <span>⚖️ Weigh-ins</span>
              </button>
            </div>

            {/* Weeks Range Selector */}
            <div className="flex items-center gap-1 p-0.5 bg-[var(--color-surface-hover)] rounded-lg border border-[var(--color-border)] self-start sm:self-auto">
              <button
                type="button"
                onClick={() => handleWeeksToggle(12)}
                className={`px-2.5 py-1 text-[11px] font-semibold rounded-md transition-all cursor-pointer ${
                  currentWeeks === 12
                    ? 'bg-[var(--color-surface)] text-[var(--color-text-primary)] shadow-xs'
                    : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'
                }`}
              >
                12 Weeks
              </button>
              <button
                type="button"
                onClick={() => handleWeeksToggle(52)}
                className={`px-2.5 py-1 text-[11px] font-semibold rounded-md transition-all cursor-pointer ${
                  currentWeeks === 52
                    ? 'bg-[var(--color-surface)] text-[var(--color-text-primary)] shadow-xs'
                    : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'
                }`}
              >
                52 Weeks
              </button>
            </div>
          </div>
        )}
      </div>

      {/* SVG Grid Container (Horizontally Scrollable for 52-week view on small screens) */}
      <div className="relative w-full overflow-x-auto pb-2 select-none">
        <svg
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          className="min-w-[320px] max-w-full h-auto overflow-visible"
          style={{ width: currentWeeks === 12 ? '100%' : 'auto', minWidth: currentWeeks === 52 ? '780px' : 'auto' }}
          onMouseLeave={() => setHoveredDay(null)}
        >
          {/* SVG Pattern Definitions for Missing/Unavailable Data */}
          <defs>
            <pattern
              id="heatmap-unavailable-hatch"
              width="6"
              height="6"
              patternUnits="userSpaceOnUse"
              patternTransform="rotate(45)"
            >
              <rect width="6" height="6" fill="var(--color-surface-hover)" />
              <line x1="0" y1="0" x2="0" y2="6" stroke="var(--color-border)" strokeWidth="1.5" opacity="0.7" />
            </pattern>
          </defs>

          {/* Day of Week Labels (Mon, Wed, Fri) */}
          <text
            x={leftPadding - 8}
            y={topPadding + 0 * (cellSize + cellGap) + cellSize - 2}
            textAnchor="end"
            className="text-[9px] fill-[var(--color-text-muted)] font-mono"
          >
            Mon
          </text>
          <text
            x={leftPadding - 8}
            y={topPadding + 2 * (cellSize + cellGap) + cellSize - 2}
            textAnchor="end"
            className="text-[9px] fill-[var(--color-text-muted)] font-mono"
          >
            Wed
          </text>
          <text
            x={leftPadding - 8}
            y={topPadding + 4 * (cellSize + cellGap) + cellSize - 2}
            textAnchor="end"
            className="text-[9px] fill-[var(--color-text-muted)] font-mono"
          >
            Fri
          </text>

          {/* Month Header Labels */}
          {gridWeeks.map((week, wIdx) => {
            const firstDay = week.days[0]
            if (!firstDay.monthLabel) return null
            const x = leftPadding + wIdx * (cellSize + cellGap)
            return (
              <text
                key={wIdx}
                x={x}
                y={topPadding - 6}
                textAnchor="start"
                className="text-[9px] font-semibold fill-[var(--color-text-secondary)] font-mono"
              >
                {firstDay.monthLabel}
              </text>
            )
          })}

          {/* Grid Cells */}
          {gridWeeks.map((week, wIdx) => {
            const colX = leftPadding + wIdx * (cellSize + cellGap)
            return (
              <g key={wIdx}>
                {week.days.map((dayItem, dIdx) => {
                  const rowY = topPadding + dayItem.dayOfWeek * (cellSize + cellGap)
                  const fill = getCellFill(dayItem.data)
                  const isHovered = hoveredDay?.day.date === dayItem.dateStr

                  return (
                    <rect
                      key={dIdx}
                      x={colX}
                      y={rowY}
                      width={cellSize}
                      height={cellSize}
                      rx={2.5}
                      fill={fill}
                      stroke={
                        isHovered
                          ? 'var(--color-text-primary)'
                          : dayItem.data.isUnavailable
                            ? 'var(--color-border)'
                            : 'var(--color-border-subtle)'
                      }
                      strokeWidth={isHovered ? 1.5 : 0.75}
                      strokeDasharray={dayItem.data.isUnavailable ? '2,2' : undefined}
                      className="transition-transform duration-100 cursor-pointer"
                      tabIndex={0}
                      role="gridcell"
                      aria-label={`${dayItem.dateStr}: ${
                        dayItem.data.isUnavailable ? 'data unavailable' : `score ${dayItem.data.score || 0}`
                      }`}
                      onMouseEnter={() =>
                        setHoveredDay({
                          day: dayItem.data,
                          x: colX + cellSize / 2,
                          y: rowY,
                        })
                      }
                      onFocus={() =>
                        setHoveredDay({
                          day: dayItem.data,
                          x: colX + cellSize / 2,
                          y: rowY,
                        })
                      }
                    />
                  )
                })}
              </g>
            )
          })}
        </svg>

        {/* Floating Tooltip Box */}
        {hoveredDay && (
          <div
            className="absolute pointer-events-none transition-all duration-75 bg-[var(--color-surface)]/95 backdrop-blur-md border border-[var(--color-border)] shadow-xl rounded-lg p-2.5 z-30 text-xs min-w-[170px] animate-in fade-in"
            style={{
              left: `${Math.min(svgWidth - 90, Math.max(90, hoveredDay.x))}px`,
              top: `${Math.max(0, hoveredDay.y - 45)}px`,
              transform: 'translate(-50%, -100%)',
            }}
          >
            <div className="font-semibold text-[var(--color-text-primary)] border-b border-[var(--color-border-subtle)] pb-1 mb-1.5 text-[11px] flex items-center justify-between gap-2">
              <span>{formatDisplayDate(hoveredDay.day.date)}</span>
              {hoveredDay.day.isUnavailable && (
                <span className="text-[10px] font-normal px-1.5 py-0.2 rounded bg-[var(--color-surface-hover)] border border-[var(--color-border)] text-[var(--color-text-muted)]">
                  Unavailable
                </span>
              )}
            </div>

            <div className="space-y-1 text-[11px]">
              {hoveredDay.day.isUnavailable ? (
                <div className="text-[var(--color-text-muted)] italic">
                  Data unavailable (Prior to tracking registration)
                </div>
              ) : (
                <>
                  {hoveredDay.day.workoutCompleted ? (
                    <div className="flex items-center gap-1.5 text-[var(--color-accent)] font-medium">
                      <span>🏋️</span>
                      <span className="truncate">{hoveredDay.day.workoutName || 'Workout completed'}</span>
                    </div>
                  ) : null}

                  {hoveredDay.day.nutritionLogged ? (
                    <div className="flex items-center gap-1.5 text-[var(--color-accent-secondary-text)] font-medium">
                      <span>🥗</span>
                      <span>
                        {hoveredDay.day.calories
                          ? `${hoveredDay.day.calories.toLocaleString()} kcal logged`
                          : 'Nutrition logged'}
                      </span>
                    </div>
                  ) : null}

                  {hoveredDay.day.weightLogged ? (
                    <div className="flex items-center gap-1.5 text-[var(--color-lavender-text)] font-medium">
                      <span>⚖️</span>
                      <span>{hoveredDay.day.weightKg ? `${hoveredDay.day.weightKg} kg weigh-in` : 'Weigh-in recorded'}</span>
                    </div>
                  ) : null}

                  {!hoveredDay.day.workoutCompleted &&
                    !hoveredDay.day.nutritionLogged &&
                    !hoveredDay.day.weightLogged && (
                      <div className="text-[var(--color-text-muted)] italic">
                        No activity recorded
                      </div>
                    )}
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Footer Legend: Adaptive based on current filter */}
      <div className="mt-2 pt-3 border-t border-[var(--color-border-subtle)] flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="text-[11px] text-[var(--color-text-muted)]">
          {currentFilter === 'all' && 'Tracks completed workouts, nutrition logs, and weigh-in records across calendar days.'}
          {currentFilter === 'workouts' && 'Completed workout sessions logged.'}
          {currentFilter === 'nutrition' && 'Actual food intake logged (unlogged days excluded from zero-calorie calculations).'}
          {currentFilter === 'weight' && 'Verified body weigh-ins recorded.'}
        </div>

        <div className="flex items-center gap-3 text-[11px] text-[var(--color-text-muted)]">
          {/* Missing / Unavailable indicator */}
          <div className="flex items-center gap-1">
            <span
              className="w-3 h-3 rounded-sm border border-dashed border-[var(--color-border)] inline-block opacity-75"
              style={{
                background:
                  'repeating-linear-gradient(45deg, var(--color-surface-hover), var(--color-surface-hover) 2px, var(--color-border) 2px, var(--color-border) 3px)',
              }}
              title="Data unavailable"
            />
            <span>Unavailable</span>
          </div>

          <div className="h-3 w-px bg-[var(--color-border)]" />

          {currentFilter === 'all' ? (
            <div className="flex items-center gap-1.5">
              <span>Less</span>
              <div className="flex items-center gap-1">
                <span
                  className="w-3 h-3 rounded-sm border border-[var(--color-border-subtle)] inline-block"
                  style={{ backgroundColor: 'var(--color-surface-hover)' }}
                  title="No activity"
                />
                <span
                  className="w-3 h-3 rounded-sm border border-[var(--color-border-subtle)] inline-block"
                  style={{ backgroundColor: 'var(--color-periwinkle)' }}
                  title="Weigh-in only"
                />
                <span
                  className="w-3 h-3 rounded-sm border border-[var(--color-border-subtle)] inline-block"
                  style={{ backgroundColor: 'var(--color-accent-secondary)' }}
                  title="Workout or Nutrition"
                />
                <span
                  className="w-3 h-3 rounded-sm border border-[var(--color-border-subtle)] inline-block"
                  style={{ backgroundColor: 'var(--color-accent)' }}
                  title="Workout and Nutrition"
                />
              </div>
              <span>More</span>
            </div>
          ) : currentFilter === 'workouts' ? (
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1">
                <span
                  className="w-3 h-3 rounded-sm border border-[var(--color-border-subtle)] inline-block"
                  style={{ backgroundColor: 'var(--color-surface-hover)' }}
                />
                <span>Rest</span>
              </div>
              <div className="flex items-center gap-1">
                <span
                  className="w-3 h-3 rounded-sm border border-[var(--color-border-subtle)] inline-block"
                  style={{ backgroundColor: 'var(--color-accent)' }}
                />
                <span>Workout</span>
              </div>
            </div>
          ) : currentFilter === 'nutrition' ? (
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1">
                <span
                  className="w-3 h-3 rounded-sm border border-[var(--color-border-subtle)] inline-block"
                  style={{ backgroundColor: 'var(--color-surface-hover)' }}
                />
                <span>Unlogged</span>
              </div>
              <div className="flex items-center gap-1">
                <span
                  className="w-3 h-3 rounded-sm border border-[var(--color-border-subtle)] inline-block"
                  style={{ backgroundColor: 'var(--color-accent-secondary)' }}
                />
                <span>Logged</span>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1">
                <span
                  className="w-3 h-3 rounded-sm border border-[var(--color-border-subtle)] inline-block"
                  style={{ backgroundColor: 'var(--color-surface-hover)' }}
                />
                <span>No weigh-in</span>
              </div>
              <div className="flex items-center gap-1">
                <span
                  className="w-3 h-3 rounded-sm border border-[var(--color-border-subtle)] inline-block"
                  style={{ backgroundColor: 'var(--color-lavender)' }}
                />
                <span>Weighed</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
