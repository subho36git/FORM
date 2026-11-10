import React, { useState, useEffect } from 'react'
import {
  X,
  Calendar,
  Scale,
  Sparkles,
  ImageIcon,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { useUnit } from '@/hooks/useUnit'
import { useGoals } from '@/features/goals'
import { useMetrics } from '../context/MetricsContext'
import type { ProgressPhoto } from '../types'

interface PhotoCompareModalProps {
  isOpen: boolean
  onClose: () => void
  initialPhotoA?: ProgressPhoto | null
  initialPhotoB?: ProgressPhoto | null
}

export const PhotoCompareModal: React.FC<PhotoCompareModalProps> = ({
  isOpen,
  onClose,
  initialPhotoA,
  initialPhotoB,
}) => {
  const { formatWeight } = useUnit()
  const { weightEntries } = useGoals()
  const { photos } = useMetrics()

  const [selectedPhotoIdA, setSelectedPhotoIdA] = useState<string>(() => {
    return initialPhotoA?.id || (photos.length > 0 ? photos[0].id : '')
  })

  const [selectedPhotoIdB, setSelectedPhotoIdB] = useState<string>(() => {
    if (initialPhotoB?.id) return initialPhotoB.id
    if (photos.length > 1) return photos[1].id
    return photos.length > 0 ? photos[0].id : ''
  })

  // Sync if initial props change
  const syncKey = `${isOpen ? 'open' : 'closed'}_${initialPhotoA?.id || ''}_${initialPhotoB?.id || ''}`
  const [prevSyncKey, setPrevSyncKey] = useState(syncKey)
  if (syncKey !== prevSyncKey) {
    setPrevSyncKey(syncKey)
    if (initialPhotoA?.id) setSelectedPhotoIdA(initialPhotoA.id)
    if (initialPhotoB?.id) setSelectedPhotoIdB(initialPhotoB.id)
  }

  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen) return null

  const photoA = photos.find((p) => p.id === selectedPhotoIdA) || null
  const photoB = photos.find((p) => p.id === selectedPhotoIdB) || null

  // Weigh-in lookup helper
  const getWeightForDate = (dateStr?: string): number | null => {
    if (!dateStr || !weightEntries || weightEntries.length === 0) return null
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

  const weightA = getWeightForDate(photoA?.capturedDate)
  const weightB = getWeightForDate(photoB?.capturedDate)
  const weightDiff =
    weightA !== null && weightB !== null ? Math.round((weightA - weightB) * 10) / 10 : null

  const daysBetween =
    photoA && photoB
      ? Math.round(
          Math.abs(
            new Date(photoA.capturedDate).getTime() - new Date(photoB.capturedDate).getTime()
          ) /
            (1000 * 60 * 60 * 24)
        )
      : 0

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="photo-compare-modal-title"
        className="w-full max-w-5xl max-h-[92vh] overflow-y-auto rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-2xl space-y-4 p-6 animate-in zoom-in-95 duration-150"
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-[var(--color-border-subtle)]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[var(--color-accent-subtle)] text-[var(--color-accent)] flex items-center justify-center">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 id="photo-compare-modal-title" className="text-base font-bold text-[var(--color-text-primary)]">
                Side-by-Side Physique Comparison
              </h3>
              <p className="text-xs text-[var(--color-text-muted)]">
                Compare transformation progress across dates and poses.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="w-11 h-11 flex items-center justify-center rounded-xl text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-hover)] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Comparison Header Meta Bar */}
        <div className="p-3.5 rounded-xl bg-[var(--color-surface-subtle)] border border-[var(--color-border)] flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <Badge variant="outline">
              <Calendar className="w-3 h-3 mr-1" />
              {daysBetween} days elapsed
            </Badge>

            {weightDiff !== null && (
              <Badge variant={weightDiff < 0 ? 'accent' : 'outline'} className="font-mono">
                <Scale className="w-3 h-3 mr-1" />
                Weight Change: {weightDiff > 0 ? '+' : ''}
                {formatWeight(weightDiff)}
              </Badge>
            )}
          </div>

          <div className="text-[11px] text-[var(--color-text-muted)]">
            Viewing authenticated private signed photos
          </div>
        </div>

        {/* Side-by-Side Two Columns */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Column A */}
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
                Photo A (Recent)
              </label>
              <select
                value={selectedPhotoIdA}
                onChange={(e) => setSelectedPhotoIdA(e.target.value)}
                className="px-3 py-1.5 text-xs rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-primary)] hover:border-[var(--color-text-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)] focus:border-[var(--color-accent)] font-medium cursor-pointer transition-all"
              >
                {photos.map((p) => (
                  <option key={`opt-a-${p.id}`} value={p.id}>
                    {p.capturedDate} • {p.pose.toUpperCase()}
                  </option>
                ))}
              </select>
            </div>

            {/* Photo A Preview Box */}
            <div className="relative w-full h-[400px] rounded-lg overflow-hidden bg-black/10 flex items-center justify-center border border-[var(--color-border)]">
              {photoA?.signedUrl ? (
                <img
                  src={photoA.signedUrl}
                  alt={`Photo A ${photoA.capturedDate}`}
                  className="w-full h-full object-contain"
                />
              ) : (
                <div className="text-xs text-[var(--color-text-muted)] flex flex-col items-center gap-2">
                  <ImageIcon className="w-8 h-8 text-[var(--color-text-muted)]" />
                  <span>Photo unavailable</span>
                </div>
              )}

              {photoA && (
                <div className="absolute top-2 left-2 flex items-center gap-1.5">
                  <Badge variant="accent" className="capitalize text-[10px]">
                    {photoA.pose}
                  </Badge>
                  <Badge variant="outline" className="text-[10px] bg-black/60 text-white border-none">
                    {photoA.capturedDate}
                  </Badge>
                </div>
              )}
            </div>

            {/* Photo A Details */}
            {photoA && (
              <div className="p-3 rounded-lg bg-[var(--color-surface-hover)]/40 border border-[var(--color-border-subtle)] text-xs space-y-1">
                <div className="flex items-center justify-between font-mono">
                  <span className="text-[var(--color-text-secondary)]">Weigh-in:</span>
                  <span className="font-bold text-[var(--color-text-primary)]">
                    {weightA !== null ? formatWeight(weightA) : 'Not recorded'}
                  </span>
                </div>
                {photoA.notes && (
                  <p className="text-[11px] text-[var(--color-text-secondary)] italic pt-0.5">
                    &quot;{photoA.notes}&quot;
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Column B */}
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
                Photo B (Baseline)
              </label>
              <select
                value={selectedPhotoIdB}
                onChange={(e) => setSelectedPhotoIdB(e.target.value)}
                className="px-3 py-1.5 text-xs rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-primary)] hover:border-[var(--color-text-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)] focus:border-[var(--color-accent)] font-medium cursor-pointer transition-all"
              >
                {photos.map((p) => (
                  <option key={`opt-b-${p.id}`} value={p.id}>
                    {p.capturedDate} • {p.pose.toUpperCase()}
                  </option>
                ))}
              </select>
            </div>

            {/* Photo B Preview Box */}
            <div className="relative w-full h-[400px] rounded-lg overflow-hidden bg-black/10 flex items-center justify-center border border-[var(--color-border)]">
              {photoB?.signedUrl ? (
                <img
                  src={photoB.signedUrl}
                  alt={`Photo B ${photoB.capturedDate}`}
                  className="w-full h-full object-contain"
                />
              ) : (
                <div className="text-xs text-[var(--color-text-muted)] flex flex-col items-center gap-2">
                  <ImageIcon className="w-8 h-8 text-[var(--color-text-muted)]" />
                  <span>Photo unavailable</span>
                </div>
              )}

              {photoB && (
                <div className="absolute top-2 left-2 flex items-center gap-1.5">
                  <Badge variant="accent" className="capitalize text-[10px]">
                    {photoB.pose}
                  </Badge>
                  <Badge variant="outline" className="text-[10px] bg-black/60 text-white border-none">
                    {photoB.capturedDate}
                  </Badge>
                </div>
              )}
            </div>

            {/* Photo B Details */}
            {photoB && (
              <div className="p-3 rounded-lg bg-[var(--color-surface-hover)]/40 border border-[var(--color-border-subtle)] text-xs space-y-1">
                <div className="flex items-center justify-between font-mono">
                  <span className="text-[var(--color-text-secondary)]">Weigh-in:</span>
                  <span className="font-bold text-[var(--color-text-primary)]">
                    {weightB !== null ? formatWeight(weightB) : 'Not recorded'}
                  </span>
                </div>
                {photoB.notes && (
                  <p className="text-[11px] text-[var(--color-text-secondary)] italic pt-0.5">
                    &quot;{photoB.notes}&quot;
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Close Button */}
        <div className="flex justify-end pt-2">
          <Button type="button" variant="outline" size="sm" onClick={onClose} className="text-xs">
            Close Comparison
          </Button>
        </div>
      </div>
    </div>
  )
}
