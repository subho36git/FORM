import React, { useState, useMemo, useEffect } from 'react'
import {
  Camera,
  Plus,
  Sparkles,
  Trash2,
  Calendar,
  Scale,
  Maximize2,
  AlertTriangle,
  Loader2,
  ImageIcon,
  X,
} from 'lucide-react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { useUnit } from '@/hooks/useUnit'
import { useGoals } from '@/features/goals'
import { useMetrics } from '../context/MetricsContext'
import type { PhotoPose, ProgressPhoto } from '../types'

interface PhotoGalleryTabProps {
  onOpenUpload: () => void
  onOpenCompare: (photoA?: ProgressPhoto, photoB?: ProgressPhoto) => void
}

export const PhotoGalleryTab: React.FC<PhotoGalleryTabProps> = ({
  onOpenUpload,
  onOpenCompare,
}) => {
  const { formatWeight } = useUnit()
  const { weightEntries } = useGoals()
  const {
    photos,
    isLoadingPhotos,
    deletePhoto,
    selectedPoseFilter,
    setSelectedPoseFilter,
  } = useMetrics()

  const [lightboxPhoto, setLightboxPhoto] = useState<ProgressPhoto | null>(null)
  const [deletingPhoto, setDeletingPhoto] = useState<ProgressPhoto | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [dateFilter, setDateFilter] = useState<string>('all')
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc')

  // Escape key handler for lightbox and delete confirmation
  useEffect(() => {
    if (!lightboxPhoto && !deletingPhoto) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (deletingPhoto) {
          setDeletingPhoto(null)
        } else if (lightboxPhoto) {
          setLightboxPhoto(null)
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [lightboxPhoto, deletingPhoto])

  // Extract unique capture dates
  const uniqueDates = useMemo(() => {
    const dates = Array.from(new Set(photos.map((p) => p.capturedDate)))
    return dates.sort((a, b) => b.localeCompare(a))
  }, [photos])

  // Filter photos by selected pose and date
  const filteredPhotos = useMemo(() => {
    let result = photos
    if (selectedPoseFilter !== 'all') {
      result = result.filter((p) => p.pose === selectedPoseFilter)
    }
    if (dateFilter !== 'all') {
      result = result.filter((p) => p.capturedDate === dateFilter)
    }
    return [...result].sort((a, b) => {
      const cmp = a.capturedDate.localeCompare(b.capturedDate)
      return sortOrder === 'desc' ? -cmp : cmp
    })
  }, [photos, selectedPoseFilter, dateFilter, sortOrder])

  // Find closest weigh-in for a photo date
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
    if (!deletingPhoto) return
    setIsDeleting(true)
    try {
      await deletePhoto(deletingPhoto.id, deletingPhoto.storagePath)
      setDeletingPhoto(null)
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Top Gallery Controls & Filter */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <Camera className="w-4 h-4 text-[var(--color-accent)]" />
                <CardTitle>Private Progress Gallery</CardTitle>
              </div>
              <CardDescription>
                Secure photos stored in encrypted private athlete storage. Visible only to you.
              </CardDescription>
            </div>

            <div className="flex items-center gap-2">
              {photos.length > 1 && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => onOpenCompare()}
                  className="text-xs"
                >
                  <Sparkles className="w-3.5 h-3.5 mr-1 text-[var(--color-accent)]" /> Compare
                </Button>
              )}
              <Button
                type="button"
                variant="primary"
                size="sm"
                onClick={onOpenUpload}
                className="text-xs"
              >
                <Plus className="w-3.5 h-3.5 mr-1" /> Upload Photo
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Filter Bar: Pose, Date & Sort Controls */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            {/* Pose Filter Buttons */}
            <div className="flex flex-wrap items-center gap-1.5 p-1 bg-[var(--color-surface-hover)] rounded-xl border border-[var(--color-border)] w-fit">
              {(['all', 'front', 'side', 'back'] as (PhotoPose | 'all')[]).map((p) => {
                const isSelected = selectedPoseFilter === p
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setSelectedPoseFilter(p)}
                    className={`px-3 py-1 rounded-lg font-semibold capitalize transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-[var(--color-surface)] text-[var(--color-text-primary)] shadow-xs'
                        : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'
                    }`}
                  >
                    {p === 'all' ? 'All Poses' : `${p} Pose`}
                  </button>
                )
              })}
            </div>

            {/* Date Filter & Sort Controls */}
            <div className="flex items-center gap-2">
              {uniqueDates.length > 0 && (
                <div className="flex items-center gap-1.5 p-1 bg-[var(--color-surface-hover)] rounded-xl border border-[var(--color-border)]">
                  <Calendar className="w-3.5 h-3.5 text-[var(--color-text-muted)] ml-1.5" />
                  <select
                    value={dateFilter}
                    onChange={(e) => setDateFilter(e.target.value)}
                    className="bg-transparent text-xs text-[var(--color-text-primary)] font-medium pr-2 py-0.5 outline-hidden cursor-pointer"
                  >
                    <option value="all">All Dates ({photos.length})</option>
                    {uniqueDates.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <button
                type="button"
                onClick={() => setSortOrder((prev) => (prev === 'desc' ? 'asc' : 'desc'))}
                className="px-2.5 py-1.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] hover:bg-[var(--color-surface-hover)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-all cursor-pointer text-xs font-medium"
                title={sortOrder === 'desc' ? 'Showing newest first' : 'Showing oldest first'}
              >
                {sortOrder === 'desc' ? 'Newest First' : 'Oldest First'}
              </button>
            </div>
          </div>

          {/* Loading State */}
          {isLoadingPhotos ? (
            <div className="p-12 text-center text-xs text-[var(--color-text-muted)] flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-[var(--color-accent)]" /> Loading
              secure photos...
            </div>
          ) : filteredPhotos.length === 0 ? (
            <div className="p-10 rounded-2xl border border-dashed border-[var(--color-border)] bg-[var(--color-surface-subtle)] text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-[var(--color-accent-subtle)] text-[var(--color-accent)] flex items-center justify-center mx-auto">
                <ImageIcon className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h4 className="text-sm font-semibold text-[var(--color-text-primary)]">
                  {selectedPoseFilter === 'all'
                    ? 'No Progress Photos Uploaded Yet'
                    : `No ${selectedPoseFilter} photos recorded`}
                </h4>
                <p className="text-xs text-[var(--color-text-secondary)] max-w-sm mx-auto">
                  Take consistent front, side, and back photos under similar lighting to document
                  your physique transformation.
                </p>
              </div>
              <Button
                type="button"
                variant="primary"
                size="sm"
                onClick={onOpenUpload}
                className="text-xs"
              >
                <Plus className="w-3.5 h-3.5 mr-1" /> Upload First Photo
              </Button>
            </div>
          ) : (
            /* Photos Grid */
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {filteredPhotos.map((photo) => {
                const weight = getWeightForDate(photo.capturedDate)
                return (
                  <div
                    key={photo.id}
                    className="group rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] overflow-hidden shadow-xs hover:border-[var(--color-border-hover)] transition-all flex flex-col"
                  >
                    {/* Image Box */}
                    <div className="relative w-full aspect-3/4 bg-black/10 overflow-hidden">
                      {photo.signedUrl ? (
                        <img
                          src={photo.signedUrl}
                          alt={`${photo.pose} progress ${photo.capturedDate}`}
                          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-102"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-xs text-[var(--color-text-muted)]">
                          Signed URL pending
                        </div>
                      )}

                      {/* Top Badges */}
                      <div className="absolute top-2 left-2 flex items-center gap-1.5">
                        <Badge variant="accent" className="capitalize text-[10px]">
                          {photo.pose}
                        </Badge>
                      </div>

                      {/* Hover Overlay Actions */}
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 p-4">
                        <button
                          type="button"
                          onClick={() => setLightboxPhoto(photo)}
                          className="p-2 rounded-full bg-[var(--color-surface)]/90 text-[var(--color-text-primary)] hover:bg-[var(--color-surface)] transition-all cursor-pointer shadow-md"
                          title="View Fullscreen"
                        >
                          <Maximize2 className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onOpenCompare(photo)}
                          className="p-2 rounded-full bg-[var(--color-surface)]/90 text-[var(--color-text-primary)] hover:bg-[var(--color-surface)] transition-all cursor-pointer shadow-md"
                          title="Compare with another photo"
                        >
                          <Sparkles className="w-4 h-4 text-amber-600" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeletingPhoto(photo)}
                          className="p-2 rounded-full bg-rose-600 text-white hover:bg-rose-700 transition-all cursor-pointer shadow-md"
                          title="Delete photo"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Metadata Footer */}
                    <div className="p-3 text-xs space-y-1.5 flex-1 flex flex-col justify-between">
                      <div className="flex items-center justify-between">
                        <span className="font-mono font-medium text-[var(--color-text-primary)] flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-[var(--color-text-muted)]" />
                          {photo.capturedDate}
                        </span>

                        {weight !== null && (
                          <span className="font-mono text-[11px] text-blue-500 font-semibold flex items-center gap-0.5">
                            <Scale className="w-3 h-3" />
                            {formatWeight(weight)}
                          </span>
                        )}
                      </div>

                      {photo.notes && (
                        <p className="text-[11px] text-[var(--color-text-secondary)] italic line-clamp-2">
                          &quot;{photo.notes}&quot;
                        </p>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Lightbox Modal */}
      {lightboxPhoto && (
        <div
          onClick={() => setLightboxPhoto(null)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-xs animate-in fade-in duration-150"
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Progress photo preview"
            onClick={(e) => e.stopPropagation()}
            className="relative max-w-4xl max-h-[90vh] rounded-2xl overflow-hidden bg-[var(--color-surface)] border border-[var(--color-border)] shadow-2xl flex flex-col animate-in zoom-in-95 duration-150"
          >
            <div className="p-4 border-b border-[var(--color-border)] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Badge variant="accent" className="capitalize text-xs">
                  {lightboxPhoto.pose} Pose
                </Badge>
                <span className="text-xs font-mono font-bold text-[var(--color-text-primary)]">
                  {lightboxPhoto.capturedDate}
                </span>
                {lightboxPhoto.notes && (
                  <span className="text-xs text-[var(--color-text-secondary)] italic">
                    • &quot;{lightboxPhoto.notes}&quot;
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={() => setLightboxPhoto(null)}
                className="w-11 h-11 flex items-center justify-center rounded-xl text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-hover)] transition-colors cursor-pointer"
                aria-label="Close photo preview"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-2 flex items-center justify-center bg-black/5 overflow-auto max-h-[75vh]">
              {lightboxPhoto.signedUrl && (
                <img
                  src={lightboxPhoto.signedUrl}
                  alt={lightboxPhoto.pose}
                  className="max-h-[72vh] w-auto object-contain rounded-lg shadow-lg"
                />
              )}
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingPhoto && (
        <div
          onClick={() => setDeletingPhoto(null)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150"
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-photo-title"
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-2xl space-y-4 animate-in zoom-in-95 duration-150"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h4 id="delete-photo-title" className="text-sm font-bold text-[var(--color-text-primary)]">
                  Delete Progress Photo?
                </h4>
                <p className="text-xs text-[var(--color-text-muted)]">
                  Permanently deletes file from private storage.
                </p>
              </div>
            </div>

            <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">
              Are you sure you want to delete this {deletingPhoto.pose} photo captured on{' '}
              {deletingPhoto.capturedDate}? This operation cannot be reversed.
            </p>

            <div className="flex items-center justify-end gap-2 pt-1">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setDeletingPhoto(null)}
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
    </div>
  )
}

