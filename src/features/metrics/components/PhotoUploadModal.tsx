import React, { useState, useRef, useEffect } from 'react'
import {
  X,
  Upload,
  Calendar,
  AlertCircle,
  Loader2,
  Camera,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { useMetrics } from '../context/MetricsContext'
import type { PhotoPose, UploadPhotoPayload } from '../types'

interface PhotoUploadModalProps {
  isOpen: boolean
  onClose: () => void
}

const POSE_OPTIONS: { value: PhotoPose; label: string; desc: string }[] = [
  { value: 'front', label: 'Front Pose', desc: 'Direct anterior anatomical or relaxed pose' },
  { value: 'side', label: 'Side Profile', desc: 'Sagittal view showing posture, chest & core' },
  { value: 'back', label: 'Back Pose', desc: 'Posterior view showing back, shoulders & glutes' },
]

export const PhotoUploadModal: React.FC<PhotoUploadModalProps> = ({ isOpen, onClose }) => {
  const { uploadPhoto } = useMetrics()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [capturedDate, setCapturedDate] = useState(() => new Date().toISOString().split('T')[0])
  const [pose, setPose] = useState<PhotoPose>('front')
  const [notes, setNotes] = useState('')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)

  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen) return null

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget && !selectedFile) {
      onClose()
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploadError(null)

    // Validate size (10MB)
    if (file.size > 10 * 1024 * 1024) {
      setUploadError('Image exceeds the 10MB limit. Please upload a compressed image.')
      return
    }

    // Validate MIME
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setUploadError('Unsupported format. Please select a JPEG, PNG, or WebP photo.')
      return
    }

    setSelectedFile(file)
    const objectUrl = URL.createObjectURL(file)
    setPreviewUrl(objectUrl)
  }

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    const file = e.dataTransfer.files?.[0]
    if (!file) return

    setUploadError(null)

    if (file.size > 10 * 1024 * 1024) {
      setUploadError('Image exceeds 10MB limit.')
      return
    }

    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setUploadError('Unsupported format. Please select JPEG, PNG, or WebP.')
      return
    }

    setSelectedFile(file)
    const objectUrl = URL.createObjectURL(file)
    setPreviewUrl(objectUrl)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedFile) {
      setUploadError('Please select or capture a photo to upload.')
      return
    }

    setIsSubmitting(true)
    setUploadError(null)

    try {
      const payload: UploadPhotoPayload = {
        capturedDate,
        pose,
        file: selectedFile,
        notes: notes.trim() || null,
      }

      const { error } = await uploadPhoto(payload)
      if (error) throw error

      // Clean up preview object URL
      if (previewUrl) URL.revokeObjectURL(previewUrl)
      setSelectedFile(null)
      setPreviewUrl(null)
      setNotes('')
      onClose()
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Failed to upload photo.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div
      onClick={handleBackdropClick}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="photo-upload-modal-title"
        className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-2xl space-y-4 p-6 animate-in zoom-in-95 duration-150"
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-[var(--color-border-subtle)]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[var(--color-accent-subtle)] text-[var(--color-accent)] flex items-center justify-center">
              <Camera className="w-4 h-4" />
            </div>
            <div>
              <h3 id="photo-upload-modal-title" className="text-base font-bold text-[var(--color-text-primary)]">
                Upload Progress Photo
              </h3>
              <p className="text-xs text-[var(--color-text-muted)]">
                Encrypted in private athlete cloud storage.
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

        {/* Error Alert */}
        {uploadError && (
          <div className="p-3.5 rounded-lg border border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{uploadError}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Pose Selector */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
              Photo Pose
            </label>
            <div className="grid grid-cols-3 gap-2">
              {POSE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setPose(opt.value)}
                  className={`p-2.5 rounded-lg border text-left text-xs transition-all cursor-pointer ${
                    pose === opt.value
                      ? 'border-[var(--color-accent)] bg-[var(--color-accent-subtle)] text-[var(--color-text-primary)] font-semibold'
                      : 'border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)]'
                  }`}
                >
                  <span className="block">{opt.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Date Picker */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
              Date Captured
            </label>
            <div className="flex items-center gap-2 p-2.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]">
              <Calendar className="w-4 h-4 text-[var(--color-accent)]" />
              <input
                type="date"
                value={capturedDate}
                onChange={(e) => setCapturedDate(e.target.value)}
                max={new Date().toISOString().split('T')[0]}
                required
                className="w-full text-xs bg-transparent text-[var(--color-text-primary)] outline-hidden"
              />
            </div>
          </div>

          {/* File Dropzone / Preview */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
              Image File
            </label>

            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
            />

            {previewUrl ? (
              <div className="relative rounded-xl border border-[var(--color-border)] overflow-hidden bg-black/10 group">
                <img
                  src={previewUrl}
                  alt="Upload Preview"
                  className="w-full h-56 object-contain bg-black/5"
                />
                <button
                  type="button"
                  onClick={() => {
                    setSelectedFile(null)
                    setPreviewUrl(null)
                  }}
                  className="absolute top-2 right-2 p-1.5 rounded-lg bg-black/60 text-white hover:bg-black/80 transition-colors cursor-pointer"
                  title="Remove image"
                >
                  <X className="w-4 h-4" />
                </button>
                <div className="absolute bottom-2 left-2 px-2.5 py-1 rounded bg-black/60 text-white text-[11px] font-mono">
                  {selectedFile?.name} ({(selectedFile ? selectedFile.size / 1024 / 1024 : 0).toFixed(1)} MB)
                </div>
              </div>
            ) : (
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className="h-44 rounded-xl border-2 border-dashed border-[var(--color-border)] hover:border-[var(--color-accent)] bg-[var(--color-surface-subtle)] hover:bg-[var(--color-surface-hover)] transition-all flex flex-col items-center justify-center gap-2 cursor-pointer p-4 text-center"
              >
                <div className="w-10 h-10 rounded-full bg-[var(--color-surface)] border border-[var(--color-border)] flex items-center justify-center text-[var(--color-accent)]">
                  <Upload className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-xs font-semibold text-[var(--color-text-primary)] block">
                    Click to select or drag photo here
                  </span>
                  <span className="text-[11px] text-[var(--color-text-muted)] block mt-0.5">
                    JPEG, PNG, or WebP up to 10MB
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
              Photo Notes (optional)
            </label>
            <input
              type="text"
              placeholder="e.g. Fasted morning check-in; end of week 4"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)]"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[var(--color-border-subtle)]">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              disabled={isSubmitting}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              disabled={isSubmitting || !selectedFile}
              className="text-xs px-5"
            >
              {isSubmitting ? (
                <span className="flex items-center gap-1.5">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> Uploading to Secure Storage...
                </span>
              ) : (
                'Upload Photo'
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
