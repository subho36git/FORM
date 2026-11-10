/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react'
import { useAuth } from '@/features/auth'
import { useGoals } from '@/features/goals'
import { metricsService } from '../services/metricsService'
import {
  MEASUREMENT_SITES,
  type BodyMeasurement,
  type AddMeasurementPayload,
  type UpdateMeasurementPayload,
  type ProgressPhoto,
  type UploadPhotoPayload,
  type PhotoPose,
  type MeasurementSiteDelta,
  type SessionComparisonResult,
} from '../types'

interface MetricsContextType {
  // Measurements State
  measurements: BodyMeasurement[]
  isLoadingMeasurements: boolean
  measurementsError: string | null
  refreshMeasurements: () => Promise<void>
  addMeasurement: (payload: AddMeasurementPayload) => Promise<{ error: Error | null }>
  updateMeasurement: (payload: UpdateMeasurementPayload) => Promise<{ error: Error | null }>
  deleteMeasurement: (id: string) => Promise<{ error: Error | null }>

  // Photos State
  photos: ProgressPhoto[]
  isLoadingPhotos: boolean
  photosError: string | null
  refreshPhotos: () => Promise<void>
  uploadPhoto: (payload: UploadPhotoPayload) => Promise<{ error: Error | null }>
  deletePhoto: (photoId: string, storagePath: string) => Promise<{ error: Error | null }>

  // Computed & Derived Metrics
  latestMeasurement: BodyMeasurement | null
  previousMeasurement: BodyMeasurement | null
  deltas: MeasurementSiteDelta[]
  compareSessions: (dateA: string, dateB: string) => SessionComparisonResult | null

  // UI Modal State
  isLogModalOpen: boolean
  setIsLogModalOpen: (open: boolean) => void
  editingMeasurement: BodyMeasurement | null
  setEditingMeasurement: (m: BodyMeasurement | null) => void

  isUploadModalOpen: boolean
  setIsUploadModalOpen: (open: boolean) => void
  isComparePhotosModalOpen: boolean
  setIsComparePhotosModalOpen: (open: boolean) => void
  comparePhotoPair: [ProgressPhoto | null, ProgressPhoto | null]
  setComparePhotoPair: (pair: [ProgressPhoto | null, ProgressPhoto | null]) => void

  selectedPoseFilter: PhotoPose | 'all'
  setSelectedPoseFilter: (pose: PhotoPose | 'all') => void
}

const MetricsContext = createContext<MetricsContextType | undefined>(undefined)

export const MetricsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth()
  const { weightEntries } = useGoals()
  const userId = user?.id

  // Measurements state
  const [measurements, setMeasurements] = useState<BodyMeasurement[]>([])
  const [isLoadingMeasurements, setIsLoadingMeasurements] = useState(true)
  const [measurementsError, setMeasurementsError] = useState<string | null>(null)

  // Photos state
  const [photos, setPhotos] = useState<ProgressPhoto[]>([])
  const [isLoadingPhotos, setIsLoadingPhotos] = useState(true)
  const [photosError, setPhotosError] = useState<string | null>(null)

  // Modal controls
  const [isLogModalOpen, setIsLogModalOpen] = useState(false)
  const [editingMeasurement, setEditingMeasurement] = useState<BodyMeasurement | null>(null)
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false)
  const [isComparePhotosModalOpen, setIsComparePhotosModalOpen] = useState(false)
  const [comparePhotoPair, setComparePhotoPair] = useState<[ProgressPhoto | null, ProgressPhoto | null]>([null, null])
  const [selectedPoseFilter, setSelectedPoseFilter] = useState<PhotoPose | 'all'>('all')

  // Fetch measurements
  const refreshMeasurements = useCallback(async () => {
    if (!userId) {
      setMeasurements([])
      setIsLoadingMeasurements(false)
      return
    }

    setIsLoadingMeasurements(true)
    setMeasurementsError(null)

    try {
      const data = await metricsService.getBodyMeasurements(userId)
      setMeasurements(data)
    } catch (err) {
      console.error('[MetricsContext] refreshMeasurements error:', err)
      setMeasurementsError(err instanceof Error ? err.message : 'Failed to load measurements')
    } finally {
      setIsLoadingMeasurements(false)
    }
  }, [userId])

  // Fetch photos
  const refreshPhotos = useCallback(async () => {
    if (!userId) {
      setPhotos([])
      setIsLoadingPhotos(false)
      return
    }

    setIsLoadingPhotos(true)
    setPhotosError(null)

    try {
      const data = await metricsService.getProgressPhotos(userId)
      setPhotos(data)
    } catch (err) {
      console.error('[MetricsContext] refreshPhotos error:', err)
      setPhotosError(err instanceof Error ? err.message : 'Failed to load progress photos')
    } finally {
      setIsLoadingPhotos(false)
    }
  }, [userId])

  // Initial load when athlete signs in
  useEffect(() => {
    let isMounted = true

    const loadData = async () => {
      if (!userId) {
        setIsLoadingMeasurements(false)
        setIsLoadingPhotos(false)
        return
      }

      try {
        const [mList, pList] = await Promise.all([
          metricsService.getBodyMeasurements(userId),
          metricsService.getProgressPhotos(userId),
        ])
        if (!isMounted) return
        setMeasurements(mList)
        setPhotos(pList)
      } catch (err) {
        if (!isMounted) return
        console.error('[MetricsContext] Initial load error:', err)
      } finally {
        if (isMounted) {
          setIsLoadingMeasurements(false)
          setIsLoadingPhotos(false)
        }
      }
    }

    void loadData()

    return () => {
      isMounted = false
    }
  }, [userId])

  // Add Measurement
  const addMeasurement = useCallback(
    async (payload: AddMeasurementPayload): Promise<{ error: Error | null }> => {
      if (!userId) return { error: new Error('User is not authenticated') }
      try {
        const newRecord = await metricsService.addBodyMeasurement(userId, payload)
        setMeasurements((prev) => {
          const updated = [newRecord, ...prev]
          return updated.sort((a, b) => {
            if (b.measuredDate !== a.measuredDate) {
              return b.measuredDate.localeCompare(a.measuredDate)
            }
            return b.createdAt.localeCompare(a.createdAt)
          })
        })
        return { error: null }
      } catch (err) {
        return { error: err instanceof Error ? err : new Error('Failed to add measurement') }
      }
    },
    [userId]
  )

  // Update Measurement
  const updateMeasurement = useCallback(
    async (payload: UpdateMeasurementPayload): Promise<{ error: Error | null }> => {
      if (!userId) return { error: new Error('User is not authenticated') }
      try {
        const updatedRecord = await metricsService.updateBodyMeasurement(userId, payload)
        setMeasurements((prev) =>
          prev
            .map((m) => (m.id === updatedRecord.id ? updatedRecord : m))
            .sort((a, b) => {
              if (b.measuredDate !== a.measuredDate) {
                return b.measuredDate.localeCompare(a.measuredDate)
              }
              return b.createdAt.localeCompare(a.createdAt)
            })
        )
        return { error: null }
      } catch (err) {
        return { error: err instanceof Error ? err : new Error('Failed to update measurement') }
      }
    },
    [userId]
  )

  // Delete Measurement
  const deleteMeasurement = useCallback(
    async (id: string): Promise<{ error: Error | null }> => {
      if (!userId) return { error: new Error('User is not authenticated') }
      try {
        await metricsService.deleteBodyMeasurement(userId, id)
        setMeasurements((prev) => prev.filter((m) => m.id !== id))
        return { error: null }
      } catch (err) {
        return { error: err instanceof Error ? err : new Error('Failed to delete measurement') }
      }
    },
    [userId]
  )

  // Upload Photo
  const uploadPhoto = useCallback(
    async (payload: UploadPhotoPayload): Promise<{ error: Error | null }> => {
      if (!userId) return { error: new Error('User is not authenticated') }
      try {
        const newPhoto = await metricsService.uploadProgressPhoto(userId, payload)
        setPhotos((prev) => [newPhoto, ...prev])
        return { error: null }
      } catch (err) {
        return { error: err instanceof Error ? err : new Error('Failed to upload photo') }
      }
    },
    [userId]
  )

  // Delete Photo
  const deletePhoto = useCallback(
    async (photoId: string, storagePath: string): Promise<{ error: Error | null }> => {
      if (!userId) return { error: new Error('User is not authenticated') }
      try {
        await metricsService.deleteProgressPhoto(userId, photoId, storagePath)
        setPhotos((prev) => prev.filter((p) => p.id !== photoId))
        return { error: null }
      } catch (err) {
        return { error: err instanceof Error ? err : new Error('Failed to delete photo') }
      }
    },
    [userId]
  )

  // Computed: Latest and previous measurements
  const latestMeasurement = useMemo(() => {
    return measurements.length > 0 ? measurements[0] : null
  }, [measurements])

  const previousMeasurement = useMemo(() => {
    return measurements.length > 1 ? measurements[1] : null
  }, [measurements])

  // Computed: Deltas between latest and previous measurement session
  const deltas = useMemo<MeasurementSiteDelta[]>(() => {
    if (!latestMeasurement) return []

    return MEASUREMENT_SITES.map((site) => {
      const currentVal = latestMeasurement[site.field] as number | null
      const prevVal = previousMeasurement ? (previousMeasurement[site.field] as number | null) : null

      let diffCm: number | null = null
      let pctChange: number | null = null

      if (currentVal !== null && prevVal !== null) {
        diffCm = Math.round((currentVal - prevVal) * 10) / 10
        if (prevVal > 0) {
          pctChange = Math.round(((currentVal - prevVal) / prevVal) * 1000) / 10
        }
      }

      return {
        key: site.key,
        label: site.label,
        currentCm: currentVal,
        previousCm: prevVal,
        diffCm,
        pctChange,
      }
    })
  }, [latestMeasurement, previousMeasurement])

  // Helper: Find closest weigh-in for a given date string (YYYY-MM-DD)
  const getWeightForDate = useCallback(
    (targetDate: string): number | null => {
      if (!weightEntries || weightEntries.length === 0) return null

      // Check exact match
      const exact = weightEntries.find((w) => w.measured_at.startsWith(targetDate))
      if (exact) return exact.weight_kg

      // Otherwise find closest entry on or before date
      const targetTime = new Date(targetDate).getTime()
      let closest: { diff: number; weight: number } | null = null

      for (const entry of weightEntries) {
        const entryTime = new Date(entry.measured_at.split('T')[0]).getTime()
        const diff = Math.abs(entryTime - targetTime)
        // Within 7 days window
        if (diff <= 7 * 86400000) {
          if (!closest || diff < closest.diff) {
            closest = { diff, weight: entry.weight_kg }
          }
        }
      }

      return closest ? closest.weight : null
    },
    [weightEntries]
  )

  // Compare two arbitrary dated sessions
  const compareSessions = useCallback(
    (dateA: string, dateB: string): SessionComparisonResult | null => {
      const sessionA = measurements.find((m) => m.measuredDate === dateA)
      const sessionB = measurements.find((m) => m.measuredDate === dateB)

      if (!sessionA || !sessionB) return null

      const timeA = new Date(sessionA.measuredDate).getTime()
      const timeB = new Date(sessionB.measuredDate).getTime()
      const daysBetween = Math.round(Math.abs(timeA - timeB) / (1000 * 60 * 60 * 24))

      const sites = MEASUREMENT_SITES.map((site) => {
        const valACm = sessionA[site.field] as number | null
        const valBCm = sessionB[site.field] as number | null

        let diffCm: number | null = null
        let pctChange: number | null = null

        if (valACm !== null && valBCm !== null) {
          diffCm = Math.round((valACm - valBCm) * 10) / 10
          if (valBCm > 0) {
            pctChange = Math.round(((valACm - valBCm) / valBCm) * 1000) / 10
          }
        }

        return {
          key: site.key,
          label: site.label,
          valACm,
          valBCm,
          diffCm,
          pctChange,
        }
      })

      const weightKgA = getWeightForDate(sessionA.measuredDate)
      const weightKgB = getWeightForDate(sessionB.measuredDate)
      const weightDiffKg =
        weightKgA !== null && weightKgB !== null
          ? Math.round((weightKgA - weightKgB) * 10) / 10
          : null

      return {
        dateA: sessionA.measuredDate,
        dateB: sessionB.measuredDate,
        daysBetween,
        sites,
        weightKgA,
        weightKgB,
        weightDiffKg,
      }
    },
    [measurements, getWeightForDate]
  )

  const value = useMemo<MetricsContextType>(
    () => ({
      measurements,
      isLoadingMeasurements,
      measurementsError,
      refreshMeasurements,
      addMeasurement,
      updateMeasurement,
      deleteMeasurement,

      photos,
      isLoadingPhotos,
      photosError,
      refreshPhotos,
      uploadPhoto,
      deletePhoto,

      latestMeasurement,
      previousMeasurement,
      deltas,
      compareSessions,

      isLogModalOpen,
      setIsLogModalOpen,
      editingMeasurement,
      setEditingMeasurement,

      isUploadModalOpen,
      setIsUploadModalOpen,
      isComparePhotosModalOpen,
      setIsComparePhotosModalOpen,
      comparePhotoPair,
      setComparePhotoPair,

      selectedPoseFilter,
      setSelectedPoseFilter,
    }),
    [
      measurements,
      isLoadingMeasurements,
      measurementsError,
      refreshMeasurements,
      addMeasurement,
      updateMeasurement,
      deleteMeasurement,

      photos,
      isLoadingPhotos,
      photosError,
      refreshPhotos,
      uploadPhoto,
      deletePhoto,

      latestMeasurement,
      previousMeasurement,
      deltas,
      compareSessions,

      isLogModalOpen,
      editingMeasurement,
      isUploadModalOpen,
      isComparePhotosModalOpen,
      comparePhotoPair,
      selectedPoseFilter,
    ]
  )

  return <MetricsContext.Provider value={value}>{children}</MetricsContext.Provider>
}

export function useMetrics(): MetricsContextType {
  const context = useContext(MetricsContext)
  if (!context) {
    throw new Error('useMetrics must be used within a MetricsProvider')
  }
  return context
}
