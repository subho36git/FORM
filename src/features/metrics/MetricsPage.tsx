import React, { useState } from 'react'
import {
  Camera,
  TrendingUp,
  History,
  Plus,
  Layers,
  ArrowRightLeft,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { cn } from '@/lib/utils'
import { MetricsProvider, useMetrics } from './context/MetricsContext'
import { MeasurementSummaryCards } from './components/MeasurementSummaryCards'
import { MeasurementHistoryTable } from './components/MeasurementHistoryTable'
import { MeasurementTrendCharts } from './components/MeasurementTrendCharts'
import { MeasurementComparisonView } from './components/MeasurementComparisonView'
import { PhotoGalleryTab } from './components/PhotoGalleryTab'
import { MeasurementLogModal } from './components/MeasurementLogModal'
import { PhotoUploadModal } from './components/PhotoUploadModal'
import { PhotoCompareModal } from './components/PhotoCompareModal'
import type { BodyMeasurement, ProgressPhoto } from './types'

type MetricsTab = 'overview' | 'trends' | 'comparison' | 'photos' | 'history'

const MetricsPageContent: React.FC = () => {
  const [activeTab, setActiveTab] = useState<MetricsTab>('overview')

  const {
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

    measurements,
    photos,
  } = useMetrics()

  const handleEditMeasurement = (measurement: BodyMeasurement) => {
    setEditingMeasurement(measurement)
    setIsLogModalOpen(true)
  }

  const handleOpenPhotoCompare = (photoA?: ProgressPhoto, photoB?: ProgressPhoto) => {
    setComparePhotoPair([photoA || null, photoB || null])
    setIsComparePhotosModalOpen(true)
  }

  return (
    <div className="p-4 sm:p-6 md:p-10 max-w-7xl mx-auto w-full space-y-6 sm:space-y-8 animate-in fade-in duration-200">
      {/* Top Welcome Header & Quick Action Buttons */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Badge variant="accent">Body Progression</Badge>
            <span className="text-xs text-[var(--color-text-muted)]">
              {measurements.length} sessions • {photos.length} photos
            </span>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-[var(--color-text-primary)]">
            Body Metrics & Progress Photos
          </h1>
          <p className="text-sm text-[var(--color-text-secondary)] mt-0.5">
            Log body circumferences, review progression trends, and track visual transformation securely.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            type="button"
            variant="outline"
            size="md"
            icon={<Camera className="w-4 h-4" />}
            onClick={() => setIsUploadModalOpen(true)}
          >
            Upload Photo
          </Button>

          <Button
            type="button"
            variant="primary"
            size="md"
            icon={<Plus className="w-4 h-4" />}
            onClick={() => {
              setEditingMeasurement(null)
              setIsLogModalOpen(true)
            }}
          >
            Log Measurement
          </Button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-1.5 p-1 bg-[var(--color-surface-hover)] rounded-xl border border-[var(--color-border)] overflow-x-auto scrollbar-none max-w-full">
        <button
          type="button"
          onClick={() => setActiveTab('overview')}
          className={cn(
            'flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer',
            activeTab === 'overview'
              ? 'bg-[var(--color-surface)] text-[var(--color-text-primary)] shadow-xs'
              : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'
          )}
        >
          <Layers className="w-3.5 h-3.5 text-[var(--color-accent)]" />
          <span>Overview</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('trends')}
          className={cn(
            'flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer',
            activeTab === 'trends'
              ? 'bg-[var(--color-surface)] text-[var(--color-text-primary)] shadow-xs'
              : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'
          )}
        >
          <TrendingUp className="w-3.5 h-3.5 text-[var(--color-accent)]" />
          <span>Progression Trends</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('comparison')}
          className={cn(
            'flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer',
            activeTab === 'comparison'
              ? 'bg-[var(--color-surface)] text-[var(--color-text-primary)] shadow-xs'
              : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'
          )}
        >
          <ArrowRightLeft className="w-3.5 h-3.5 text-amber-500" />
          <span>Session Compare</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('photos')}
          className={cn(
            'flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer',
            activeTab === 'photos'
              ? 'bg-[var(--color-surface)] text-[var(--color-text-primary)] shadow-xs'
              : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'
          )}
        >
          <Camera className="w-3.5 h-3.5 text-[var(--color-lavender)]" />
          <span>Progress Photos ({photos.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('history')}
          className={cn(
            'flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer',
            activeTab === 'history'
              ? 'bg-[var(--color-surface)] text-[var(--color-text-primary)] shadow-xs'
              : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'
          )}
        >
          <History className="w-3.5 h-3.5 text-[var(--color-text-muted)]" />
          <span>Measurement History</span>
        </button>
      </div>

      {/* Tab 1: Overview */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          <MeasurementSummaryCards />
          {measurements.length > 0 && <MeasurementTrendCharts />}
          <MeasurementHistoryTable onEdit={handleEditMeasurement} />
        </div>
      )}

      {/* Tab 2: Trends */}
      {activeTab === 'trends' && (
        <div className="space-y-6">
          <MeasurementTrendCharts />
        </div>
      )}

      {/* Tab 3: Session Compare */}
      {activeTab === 'comparison' && (
        <div className="space-y-6">
          <MeasurementComparisonView />
        </div>
      )}

      {/* Tab 4: Photos */}
      {activeTab === 'photos' && (
        <div className="space-y-6">
          <PhotoGalleryTab
            onOpenUpload={() => setIsUploadModalOpen(true)}
            onOpenCompare={handleOpenPhotoCompare}
          />
        </div>
      )}

      {/* Tab 5: History */}
      {activeTab === 'history' && (
        <div className="space-y-6">
          <MeasurementHistoryTable onEdit={handleEditMeasurement} />
        </div>
      )}

      {/* Modals */}
      <MeasurementLogModal
        isOpen={isLogModalOpen}
        onClose={() => {
          setIsLogModalOpen(false)
          setEditingMeasurement(null)
        }}
        editingRecord={editingMeasurement}
      />

      <PhotoUploadModal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
      />

      <PhotoCompareModal
        isOpen={isComparePhotosModalOpen}
        onClose={() => {
          setIsComparePhotosModalOpen(false)
          setComparePhotoPair([null, null])
        }}
        initialPhotoA={comparePhotoPair[0]}
        initialPhotoB={comparePhotoPair[1]}
      />
    </div>
  )
}

export const MetricsPage: React.FC = () => {
  return (
    <MetricsProvider>
      <MetricsPageContent />
    </MetricsProvider>
  )
}
