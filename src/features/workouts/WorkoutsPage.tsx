import React from 'react'
import { Dumbbell, Plus, Sparkles } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'

export const WorkoutsPage: React.FC = () => {
  return (
    <div className="p-6 md:p-10 max-w-7xl mx-auto w-full space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Badge variant="accent">Phase 4 Roadmap</Badge>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-[var(--color-text-primary)]">
            Workout Tracking & Routines
          </h1>
          <p className="text-sm text-[var(--color-text-secondary)] mt-0.5">
            Build custom routines, track progressive overload, and log active sets.
          </p>
        </div>
        <Button variant="primary" icon={<Plus className="w-4 h-4" />}>
          New Routine
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Workout Module Preview</CardTitle>
          <CardDescription>
            Scheduled for implementation in Phase 4 of the development roadmap.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-10 text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-[var(--color-accent-subtle)] text-[var(--color-accent-text)] flex items-center justify-center mx-auto">
            <Dumbbell className="w-6 h-6" />
          </div>
          <div className="max-w-md mx-auto space-y-2">
            <h4 className="text-base font-semibold text-[var(--color-text-primary)]">
              Exercise Library & Active Session Logger
            </h4>
            <p className="text-xs text-[var(--color-text-secondary)]">
              Will feature automatic 1-Rep Max calculations, previous set comparison for progressive overload, and an interactive rest timer.
            </p>
          </div>
          <div className="flex justify-center gap-2 pt-2">
            <Badge variant="outline" className="flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-[var(--color-accent)]" /> Coming in Phase 4
            </Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
