import React, { useState } from 'react'
import { Sparkles, Scale, Dumbbell, Flame, Activity } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { BodyProgressModule } from './components/BodyProgressModule'
import { StrengthAnalyticsModule } from './components/StrengthAnalyticsModule'
import { NutritionAnalyticsModule } from './components/NutritionAnalyticsModule'
import { ConsistencyAnalyticsModule } from './components/ConsistencyAnalyticsModule'

type AnalyticsTab = 'consistency' | 'strength' | 'body' | 'nutrition'

export const AnalyticsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<AnalyticsTab>('consistency')

  return (
    <div className="p-4 sm:p-6 md:p-10 max-w-7xl mx-auto w-full space-y-6 sm:space-y-8 animate-in fade-in duration-200">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Badge variant="accent">Analytics Hub</Badge>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-[var(--color-text-primary)]">
            Performance & Health Analytics
          </h1>
          <p className="text-sm text-[var(--color-text-secondary)] mt-0.5">
            Deep-dive intelligence on body composition, strength progression, nutrition adherence, and habit consistency.
          </p>
        </div>

        {/* Modular Feature Tabs */}
        <div className="flex items-center gap-1.5 p-1 bg-[var(--color-surface-hover)] rounded-xl border border-[var(--color-border)] overflow-x-auto scrollbar-none max-w-full">
          <button
            onClick={() => setActiveTab('consistency')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
              activeTab === 'consistency'
                ? 'bg-[var(--color-surface)] text-[var(--color-text-primary)] shadow-xs'
                : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'
            }`}
          >
            <Activity className="w-3.5 h-3.5 text-[var(--color-accent)]" />
            <span>Consistency & Matrix</span>
          </button>

          <button
            onClick={() => setActiveTab('strength')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
              activeTab === 'strength'
                ? 'bg-[var(--color-surface)] text-[var(--color-text-primary)] shadow-xs'
                : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'
            }`}
          >
            <Dumbbell className="w-3.5 h-3.5 text-[var(--color-accent)]" />
            <span>Strength & Workouts</span>
          </button>

          <button
            onClick={() => setActiveTab('body')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
              activeTab === 'body'
                ? 'bg-[var(--color-surface)] text-[var(--color-text-primary)] shadow-xs'
                : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'
            }`}
          >
            <Scale className="w-3.5 h-3.5 text-[var(--color-accent)]" />
            <span>Body Composition</span>
          </button>

          <button
            onClick={() => setActiveTab('nutrition')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
              activeTab === 'nutrition'
                ? 'bg-[var(--color-surface)] text-[var(--color-text-primary)] shadow-xs'
                : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'
            }`}
          >
            <Flame className="w-3.5 h-3.5 text-amber-500" />
            <span>Nutrition & Targets</span>
          </button>
        </div>
      </div>

      {/* Active Analytics Module */}
      {activeTab === 'consistency' && <ConsistencyAnalyticsModule />}
      {activeTab === 'strength' && <StrengthAnalyticsModule />}
      {activeTab === 'body' && <BodyProgressModule />}
      {activeTab === 'nutrition' && <NutritionAnalyticsModule />}

      {/* Roadmap Note for Upcoming Analytics Modules */}
      <div className="p-4 rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-surface-subtle)] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-[var(--color-text-muted)]">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-[var(--color-accent)] shrink-0" />
          <span>
            <strong>Analytics Engine:</strong> Dual-Pillar Consistency Matrix active. Cross-Domain Correlation intelligence in development.
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1 text-[var(--color-text-secondary)] font-medium">
            <Activity className="w-3.5 h-3.5 text-[var(--color-accent)]" /> Consistency Grid Active
          </span>
        </div>
      </div>
    </div>
  )
}
