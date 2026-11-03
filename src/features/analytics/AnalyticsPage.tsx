import React from 'react'
import { TrendingUp, Sparkles } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'

export const AnalyticsPage: React.FC = () => {
  return (
    <div className="p-6 md:p-10 max-w-7xl mx-auto w-full space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Badge variant="accent">Phase 8 Roadmap</Badge>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-[var(--color-text-primary)]">
            Performance & Health Analytics
          </h1>
          <p className="text-sm text-[var(--color-text-secondary)] mt-0.5">
            Deep-dive charts on strength progression, body composition, and caloric adherence.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Analytics Engine Preview</CardTitle>
          <CardDescription>
            Scheduled for implementation in Phase 8 of the development roadmap.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-10 text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center mx-auto">
            <TrendingUp className="w-6 h-6" />
          </div>
          <div className="max-w-md mx-auto space-y-2">
            <h4 className="text-base font-semibold text-[var(--color-text-primary)]">
              Interactive Recharts Visualizations
            </h4>
            <p className="text-xs text-[var(--color-text-secondary)]">
              Will feature strength progression curves (estimated 1RM over time for bench, squat, deadlift), weight moving averages, and macro consistency breakdown over 7, 30, and 90-day periods.
            </p>
          </div>
          <div className="flex justify-center gap-2 pt-2">
            <Badge variant="outline" className="flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-[var(--color-accent)]" /> Coming in Phase 8
            </Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
