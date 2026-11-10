import React, { useState, useEffect } from 'react'
import { X, Calendar, Ruler, Loader2, AlertCircle, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { useUnit } from '@/hooks/useUnit'
import { useMetrics } from '../context/MetricsContext'
import {
  MEASUREMENT_SITES,
  type BodyMeasurement,
  type AddMeasurementPayload,
  type UpdateMeasurementPayload,
  type MeasurementSiteKey,
} from '../types'

interface MeasurementLogModalProps {
  isOpen: boolean
  onClose: () => void
  editingRecord?: BodyMeasurement | null
}

export const MeasurementLogModal: React.FC<MeasurementLogModalProps> = ({
  isOpen,
  onClose,
  editingRecord,
}) => {
  const { circumferenceUnit, cmToCircumferenceDisplay, circumferenceDisplayToCm } = useUnit()
  const { addMeasurement, updateMeasurement, latestMeasurement } = useMetrics()

  // Initial values helper
  const getInitialSiteValues = (record?: BodyMeasurement | null) => {
    const vals: Record<MeasurementSiteKey, string> = {
      waist: '',
      chest: '',
      shoulders: '',
      neck: '',
      hips: '',
      bicep_left: '',
      bicep_right: '',
      forearm_left: '',
      forearm_right: '',
      thigh_left: '',
      thigh_right: '',
      calf_left: '',
      calf_right: '',
    }

    if (record) {
      MEASUREMENT_SITES.forEach((site) => {
        const cmVal = record[site.field] as number | null
        if (cmVal !== null && cmVal !== undefined) {
          vals[site.key] = cmToCircumferenceDisplay(cmVal).toString()
        }
      })
    }

    return vals
  }

  // Form State
  const [measuredDate, setMeasuredDate] = useState(() => {
    return editingRecord?.measuredDate || new Date().toISOString().split('T')[0]
  })
  const [siteInputs, setSiteInputs] = useState<Record<MeasurementSiteKey, string>>(() =>
    getInitialSiteValues(editingRecord)
  )
  const [notes, setNotes] = useState(() => editingRecord?.notes || '')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  // Sync state if editingRecord or isOpen changes
  const syncKey = `${isOpen ? 'open' : 'closed'}_${editingRecord?.id || 'new'}_${editingRecord?.measuredDate || ''}_${circumferenceUnit}`
  const [prevSyncKey, setPrevSyncKey] = useState(syncKey)

  if (syncKey !== prevSyncKey) {
    setPrevSyncKey(syncKey)
    setMeasuredDate(editingRecord?.measuredDate || new Date().toISOString().split('T')[0])
    setSiteInputs(getInitialSiteValues(editingRecord))
    setNotes(editingRecord?.notes || '')
    setFormError(null)
  }

  // ESC key to close modal
  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen) return null

  const handleInputChange = (key: MeasurementSiteKey, val: string) => {
    setSiteInputs((prev) => ({ ...prev, [key]: val }))
    if (formError) setFormError(null)
  }

  // Copy values from latest recorded measurement session
  const handleCopyFromLatest = () => {
    if (!latestMeasurement) return
    const copied: Record<MeasurementSiteKey, string> = { ...siteInputs }
    MEASUREMENT_SITES.forEach((site) => {
      const cmVal = latestMeasurement[site.field] as number | null
      if (cmVal !== null && cmVal !== undefined) {
        copied[site.key] = cmToCircumferenceDisplay(cmVal).toString()
      }
    })
    setSiteInputs(copied)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setFormError(null)

    try {
      if (!measuredDate) {
        throw new Error('Please select a measurement date.')
      }

      // Parse and validate numeric values into cm
      const payloadCm: Record<string, number | null> = {}
      let hasAtLeastOneMeasurement = false

      for (const site of MEASUREMENT_SITES) {
        const raw = siteInputs[site.key]?.trim()
        if (!raw) {
          payloadCm[site.field] = null
          continue
        }

        const num = parseFloat(raw)
        if (isNaN(num) || num <= 0) {
          throw new Error(`Please enter a valid positive number for ${site.label}.`)
        }

        // Convert from display unit to centimeters
        const cm = circumferenceDisplayToCm(num)

        if (cm < site.minCm || cm > site.maxCm) {
          const minDisp = cmToCircumferenceDisplay(site.minCm)
          const maxDisp = cmToCircumferenceDisplay(site.maxCm)
          throw new Error(
            `${site.label} must be between ${minDisp} and ${maxDisp} ${circumferenceUnit}.`
          )
        }

        payloadCm[site.field] = cm
        hasAtLeastOneMeasurement = true
      }

      if (!hasAtLeastOneMeasurement) {
        throw new Error('Please enter at least one body measurement value.')
      }

      if (editingRecord) {
        const updatePayload: UpdateMeasurementPayload = {
          id: editingRecord.id,
          measuredDate,
          notes: notes.trim() || null,
          ...payloadCm,
        }

        const { error } = await updateMeasurement(updatePayload)
        if (error) throw error
      } else {
        const addPayload: AddMeasurementPayload = {
          measuredDate,
          notes: notes.trim() || null,
          ...payloadCm,
        }

        const { error } = await addMeasurement(addPayload)
        if (error) throw error
      }

      onClose()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to save measurement.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      const hasEnteredValues = Object.values(siteInputs).some((v) => v !== '')
      if (!hasEnteredValues) onClose()
    }
  }

  // Groups for clean layout
  const torsoSites = MEASUREMENT_SITES.filter((s) => s.category === 'torso')
  const armsSites = MEASUREMENT_SITES.filter((s) => s.category === 'arms')
  const legsSites = MEASUREMENT_SITES.filter((s) => s.category === 'legs')

  return (
    <div
      onClick={handleBackdropClick}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="measurement-log-modal-title"
        className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-2xl space-y-5 p-6 animate-in zoom-in-95 duration-150"
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-[var(--color-border-subtle)]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[var(--color-accent-subtle)] text-[var(--color-accent)] flex items-center justify-center">
              <Ruler className="w-4 h-4" />
            </div>
            <div>
              <h3 id="measurement-log-modal-title" className="text-base font-bold text-[var(--color-text-primary)]">
                {editingRecord ? 'Edit Body Measurements' : 'Log Body Circumferences'}
              </h3>
              <p className="text-xs text-[var(--color-text-muted)]">
                Displaying in {circumferenceUnit === 'cm' ? 'Centimetres (cm)' : 'Inches (in)'}
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

        {/* Validation Error Banner */}
        {formError && (
          <div className="p-3.5 rounded-lg border border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{formError}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Top Bar: Date & Quick Prefill Button */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl bg-[var(--color-surface-subtle)] border border-[var(--color-border)]">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-[var(--color-accent)]" />
              <label className="text-xs font-semibold text-[var(--color-text-primary)]">
                Date:
              </label>
              <input
                type="date"
                value={measuredDate}
                onChange={(e) => setMeasuredDate(e.target.value)}
                max={new Date().toISOString().split('T')[0]}
                required
                className="px-2.5 py-1 text-xs rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-primary)]"
              />
            </div>

            {!editingRecord && latestMeasurement && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleCopyFromLatest}
                className="text-xs self-start sm:self-auto"
              >
                <Sparkles className="w-3 h-3 mr-1 text-[var(--color-accent)]" /> Fill from Last Session
              </Button>
            )}
          </div>

          {/* Section 1: Torso */}
          <div className="space-y-2">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
              Torso & Trunk
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {torsoSites.map((site) => (
                <div key={site.key} className="space-y-1">
                  <label className="text-xs font-medium text-[var(--color-text-secondary)] flex justify-between">
                    <span>{site.label}</span>
                    <span className="text-[10px] text-[var(--color-text-muted)]">
                      {circumferenceUnit}
                    </span>
                  </label>
                  <Input
                    type="number"
                    step="0.1"
                    placeholder="—"
                    value={siteInputs[site.key]}
                    onChange={(e) => handleInputChange(site.key, e.target.value)}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Section 2: Arms & Forearms */}
          <div className="space-y-2 pt-2 border-t border-[var(--color-border-subtle)]">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
              Arms & Forearms
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {armsSites.map((site) => (
                <div key={site.key} className="space-y-1">
                  <label className="text-xs font-medium text-[var(--color-text-secondary)] flex justify-between">
                    <span>{site.label}</span>
                    <span className="text-[10px] text-[var(--color-text-muted)]">
                      {circumferenceUnit}
                    </span>
                  </label>
                  <Input
                    type="number"
                    step="0.1"
                    placeholder="—"
                    value={siteInputs[site.key]}
                    onChange={(e) => handleInputChange(site.key, e.target.value)}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Section 3: Legs & Calves */}
          <div className="space-y-2 pt-2 border-t border-[var(--color-border-subtle)]">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
              Thighs & Calves
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {legsSites.map((site) => (
                <div key={site.key} className="space-y-1">
                  <label className="text-xs font-medium text-[var(--color-text-secondary)] flex justify-between">
                    <span>{site.label}</span>
                    <span className="text-[10px] text-[var(--color-text-muted)]">
                      {circumferenceUnit}
                    </span>
                  </label>
                  <Input
                    type="number"
                    step="0.1"
                    placeholder="—"
                    value={siteInputs[site.key]}
                    onChange={(e) => handleInputChange(site.key, e.target.value)}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-1 pt-2 border-t border-[var(--color-border-subtle)]">
            <label className="text-xs font-medium text-[var(--color-text-secondary)]">
              Session Notes (optional)
            </label>
            <input
              type="text"
              placeholder="e.g. Measured in morning before breakfast; leg day pump yesterday"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)]"
            />
          </div>

          {/* Submit Actions */}
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
              disabled={isSubmitting}
              className="text-xs px-5"
            >
              {isSubmitting ? (
                <span className="flex items-center gap-1.5">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving...
                </span>
              ) : editingRecord ? (
                'Update Measurements'
              ) : (
                'Save Measurements'
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

