import React from 'react'
import {
  Scale,
  Ruler,
  TrendingUp,
  TrendingDown,
  Minus,
  Calendar,
  Plus,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { useUnit } from '@/hooks/useUnit'
import { useGoals } from '@/features/goals'
import { useMetrics } from '../context/MetricsContext'

export const MeasurementSummaryCards: React.FC = () => {
  const { circumferenceUnit, formatWeight, formatCircumference } = useUnit()
  const { goals } = useGoals()
  const {
    latestMeasurement,
    previousMeasurement,
    deltas,
    measurements,
    setIsLogModalOpen,
  } = useMetrics()

  const currentWeight = goals.currentWeightKg

  // Find key deltas
  const waistDelta = deltas.find((d) => d.key === 'waist')
  const chestDelta = deltas.find((d) => d.key === 'chest')
  const shouldersDelta = deltas.find((d) => d.key === 'shoulders')
  const bicepRightDelta = deltas.find((d) => d.key === 'bicep_right')
  const thighRightDelta = deltas.find((d) => d.key === 'thigh_right')

  const renderDeltaBadge = (delta: typeof waistDelta) => {
    if (!delta || delta.diffCm === null || delta.previousCm === null) {
      return (
        <span className="text-[11px] text-[var(--color-text-muted)] flex items-center gap-0.5">
          <Minus className="w-3 h-3" /> No prior
        </span>
      )
    }

    const isPositive = delta.diffCm > 0
    const isZero = delta.diffCm === 0

    if (isZero) {
      return (
        <span className="text-[11px] text-[var(--color-text-muted)] flex items-center gap-0.5 font-medium">
          <Minus className="w-3 h-3" /> 0.0 {circumferenceUnit}
        </span>
      )
    }

    return (
      <span
        className={`text-[11px] flex items-center gap-0.5 font-medium ${
          isPositive ? 'text-amber-500' : 'text-blue-500'
        }`}
      >
        {isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
        <span>
          {isPositive ? '+' : ''}
          {formatCircumference(delta.diffCm)}
        </span>
        {delta.pctChange !== null && (
          <span className="text-[10px] opacity-75">
            ({isPositive ? '+' : ''}
            {delta.pctChange}%)
          </span>
        )}
      </span>
    )
  }

  return (
    <div className="space-y-4">
      {/* Overview Stat Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Active Bodyweight (from GoalContext) */}
        <Card className="hover:border-[var(--color-border-hover)] transition-all">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
                Bodyweight
              </span>
              <div className="p-2 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400">
                <Scale className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-2xl font-bold text-[var(--color-text-primary)]">
                {currentWeight ? formatWeight(currentWeight) : '—'}
              </span>
            </div>
            <div className="mt-2 text-xs text-[var(--color-text-secondary)] flex items-center justify-between">
              <span>Goal: {goals.goalWeightKg ? formatWeight(goals.goalWeightKg) : 'Not set'}</span>
              <Badge variant="outline" className="text-[10px]">
                Goal Engine
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Card 2: Waist Circumference */}
        <Card className="hover:border-[var(--color-border-hover)] transition-all">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
                Waist
              </span>
              <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                <Ruler className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-2xl font-bold text-[var(--color-text-primary)]">
                {latestMeasurement?.waistCm ? formatCircumference(latestMeasurement.waistCm) : '—'}
              </span>
            </div>
            <div className="mt-2 text-xs text-[var(--color-text-secondary)] flex items-center justify-between">
              <span>vs Previous:</span>
              {renderDeltaBadge(waistDelta)}
            </div>
          </CardContent>
        </Card>

        {/* Card 3: Chest Circumference */}
        <Card className="hover:border-[var(--color-border-hover)] transition-all">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
                Chest
              </span>
              <div className="p-2 rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400">
                <Ruler className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-2xl font-bold text-[var(--color-text-primary)]">
                {latestMeasurement?.chestCm ? formatCircumference(latestMeasurement.chestCm) : '—'}
              </span>
            </div>
            <div className="mt-2 text-xs text-[var(--color-text-secondary)] flex items-center justify-between">
              <span>vs Previous:</span>
              {renderDeltaBadge(chestDelta)}
            </div>
          </CardContent>
        </Card>

        {/* Card 4: Right Bicep Circumference */}
        <Card className="hover:border-[var(--color-border-hover)] transition-all">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
                Right Arm
              </span>
              <div className="p-2 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
                <Ruler className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-2xl font-bold text-[var(--color-text-primary)]">
                {latestMeasurement?.bicepRightCm
                  ? formatCircumference(latestMeasurement.bicepRightCm)
                  : '—'}
              </span>
            </div>
            <div className="mt-2 text-xs text-[var(--color-text-secondary)] flex items-center justify-between">
              <span>vs Previous:</span>
              {renderDeltaBadge(bicepRightDelta)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Latest Session Callout & Quick Log */}
      {latestMeasurement ? (
        <div className="p-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-subtle)] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-[var(--color-accent)] shrink-0" />
            <span className="text-[var(--color-text-secondary)]">
              Latest recorded measurement session:{' '}
              <strong className="text-[var(--color-text-primary)]">
                {latestMeasurement.measuredDate}
              </strong>{' '}
              {previousMeasurement && (
                <span className="text-[var(--color-text-muted)]">
                  (previous: {previousMeasurement.measuredDate})
                </span>
              )}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-[11px] text-[var(--color-text-muted)]">
              Total sessions: {measurements.length}
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsLogModalOpen(true)}
              className="text-xs"
            >
              <Plus className="w-3.5 h-3.5 mr-1" /> Log New Session
            </Button>
          </div>
        </div>
      ) : (
        <div className="p-6 rounded-2xl border border-dashed border-[var(--color-border)] bg-[var(--color-surface-subtle)] text-center space-y-3">
          <div className="w-10 h-10 rounded-full bg-[var(--color-accent-subtle)] text-[var(--color-accent)] flex items-center justify-center mx-auto">
            <Ruler className="w-5 h-5" />
          </div>
          <div className="space-y-1">
            <h4 className="text-sm font-semibold text-[var(--color-text-primary)]">
              No Body Measurements Logged Yet
            </h4>
            <p className="text-xs text-[var(--color-text-secondary)] max-w-sm mx-auto">
              Track your circumference changes across waist, chest, shoulders, arms, and legs to
              measure body composition improvements.
            </p>
          </div>
          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={() => setIsLogModalOpen(true)}
            className="text-xs"
          >
            <Plus className="w-3.5 h-3.5 mr-1.5" /> Log First Measurement
          </Button>
        </div>
      )}

      {/* Additional Sites Quick Row (Shoulders & Thighs) */}
      {latestMeasurement && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
          <div className="p-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]">
            <span className="text-[10px] uppercase font-semibold text-[var(--color-text-muted)] block">
              Shoulders
            </span>
            <span className="text-sm font-bold text-[var(--color-text-primary)] mt-0.5 block">
              {latestMeasurement.shouldersCm ? formatCircumference(latestMeasurement.shouldersCm) : '—'}
            </span>
            <div className="mt-1">{renderDeltaBadge(shouldersDelta)}</div>
          </div>

          <div className="p-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]">
            <span className="text-[10px] uppercase font-semibold text-[var(--color-text-muted)] block">
              Hips
            </span>
            <span className="text-sm font-bold text-[var(--color-text-primary)] mt-0.5 block">
              {latestMeasurement.hipsCm ? formatCircumference(latestMeasurement.hipsCm) : '—'}
            </span>
            <div className="mt-1">
              {renderDeltaBadge(deltas.find((d) => d.key === 'hips'))}
            </div>
          </div>

          <div className="p-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]">
            <span className="text-[10px] uppercase font-semibold text-[var(--color-text-muted)] block">
              Right Thigh
            </span>
            <span className="text-sm font-bold text-[var(--color-text-primary)] mt-0.5 block">
              {latestMeasurement.thighRightCm ? formatCircumference(latestMeasurement.thighRightCm) : '—'}
            </span>
            <div className="mt-1">{renderDeltaBadge(thighRightDelta)}</div>
          </div>

          <div className="p-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]">
            <span className="text-[10px] uppercase font-semibold text-[var(--color-text-muted)] block">
              Right Calf
            </span>
            <span className="text-sm font-bold text-[var(--color-text-primary)] mt-0.5 block">
              {latestMeasurement.calfRightCm ? formatCircumference(latestMeasurement.calfRightCm) : '—'}
            </span>
            <div className="mt-1">
              {renderDeltaBadge(deltas.find((d) => d.key === 'calf_right'))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
