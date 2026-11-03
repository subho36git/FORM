import React from 'react'
import {
  Flame,
  Dumbbell,
  Scale,
  Plus,
  ArrowUpRight,
  ShieldCheck,
  CheckCircle2,
  Calendar,
} from 'lucide-react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'

export const DashboardPage: React.FC = () => {
  return (
    <div className="p-6 md:p-10 max-w-7xl mx-auto w-full space-y-8">
      {/* Top Welcome & Quick Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Badge variant="accent">Phase 1 Complete</Badge>
            <span className="text-xs text-[var(--color-text-muted)] flex items-center gap-1">
              <Calendar className="w-3 h-3" /> Today's Overview
            </span>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-[var(--color-text-primary)]">
            Welcome to FORM
          </h1>
          <p className="text-sm text-[var(--color-text-secondary)] mt-0.5">
            Your personal fitness and nutrition tracking environment.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button variant="secondary" size="md" icon={<Plus className="w-4 h-4" />}>
            Log Meal
          </Button>
          <Button variant="primary" size="md" icon={<Dumbbell className="w-4 h-4" />}>
            Start Workout
          </Button>
        </div>
      </div>

      {/* Metrics Summary Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1: Calories */}
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
                Daily Calories
              </span>
              <div className="p-2 rounded-lg bg-[var(--color-accent-subtle)] text-[var(--color-accent-text)]">
                <Flame className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-2xl font-bold text-[var(--color-text-primary)]">
                1,840
              </span>
              <span className="text-xs text-[var(--color-text-muted)]">/ 2,400 kcal</span>
            </div>
            <div className="mt-3 w-full bg-[var(--color-surface-hover)] h-1.5 rounded-full overflow-hidden">
              <div
                className="bg-[var(--color-accent)] h-full rounded-full transition-all"
                style={{ width: '76%' }}
              />
            </div>
            <div className="mt-2 flex justify-between text-[11px] text-[var(--color-text-secondary)]">
              <span>76% consumed</span>
              <span>560 kcal left</span>
            </div>
          </CardContent>
        </Card>

        {/* Metric 2: Protein */}
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
                Protein Intake
              </span>
              <div className="p-2 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400">
                <ShieldCheck className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-2xl font-bold text-[var(--color-text-primary)]">
                142
              </span>
              <span className="text-xs text-[var(--color-text-muted)]">/ 175 g</span>
            </div>
            <div className="mt-3 w-full bg-[var(--color-surface-hover)] h-1.5 rounded-full overflow-hidden">
              <div
                className="bg-blue-500 h-full rounded-full transition-all"
                style={{ width: '81%' }}
              />
            </div>
            <div className="mt-2 flex justify-between text-[11px] text-[var(--color-text-secondary)]">
              <span>81% of daily goal</span>
              <span>33 g remaining</span>
            </div>
          </CardContent>
        </Card>

        {/* Metric 3: Workout Streak */}
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
                Workout Consistency
              </span>
              <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                <Dumbbell className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-2xl font-bold text-[var(--color-text-primary)]">
                3
              </span>
              <span className="text-xs text-[var(--color-text-muted)]">/ 4 sessions</span>
            </div>
            <div className="mt-3 flex gap-1.5">
              {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((day, idx) => (
                <div
                  key={idx}
                  className={`flex-1 h-1.5 rounded-full ${
                    idx < 3 ? 'bg-[var(--color-accent)]' : 'bg-[var(--color-surface-hover)]'
                  }`}
                  title={`${day}: ${idx < 3 ? 'Completed' : 'Pending'}`}
                />
              ))}
            </div>
            <div className="mt-2 flex justify-between text-[11px] text-[var(--color-text-secondary)]">
              <span>On track this week</span>
              <span className="text-[var(--color-accent)] font-medium">75%</span>
            </div>
          </CardContent>
        </Card>

        {/* Metric 4: Bodyweight */}
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
                Current Weight
              </span>
              <div className="p-2 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
                <Scale className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-2xl font-bold text-[var(--color-text-primary)]">
                74.2
              </span>
              <span className="text-xs text-[var(--color-text-muted)]">kg</span>
            </div>
            <div className="mt-3 flex items-center gap-1.5 text-xs text-[var(--color-accent)] font-medium">
              <ArrowUpRight className="w-3.5 h-3.5" />
              <span>-0.3 kg 7-day average</span>
            </div>
            <div className="mt-2 text-[11px] text-[var(--color-text-secondary)]">
              Last weighed this morning
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Grid: Roadmap Status & Upcoming Schedule */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column (2 spans): System Readiness & Architecture */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Phase 1 Foundation Status</CardTitle>
                  <CardDescription>
                    All core architectural requirements for Phase 1 are initialized.
                  </CardDescription>
                </div>
                <Badge variant="accent">Ready</Badge>
              </div>
            </CardHeader>
            <CardContent className="p-5 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                <div className="flex items-start gap-2.5 p-3 rounded-lg bg-[var(--color-surface-subtle)] border border-[var(--color-border)]">
                  <CheckCircle2 className="w-4 h-4 text-[var(--color-accent)] shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-[var(--color-text-primary)]">
                      React 19 + TypeScript
                    </p>
                    <p className="text-xs text-[var(--color-text-secondary)]">
                      Strict mode enabled with modular component design.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-2.5 p-3 rounded-lg bg-[var(--color-surface-subtle)] border border-[var(--color-border)]">
                  <CheckCircle2 className="w-4 h-4 text-[var(--color-accent)] shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-[var(--color-text-primary)]">
                      Tailwind CSS v4 (Vite)
                    </p>
                    <p className="text-xs text-[var(--color-text-secondary)]">
                      Official Vite integration with custom CSS design tokens.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-2.5 p-3 rounded-lg bg-[var(--color-surface-subtle)] border border-[var(--color-border)]">
                  <CheckCircle2 className="w-4 h-4 text-[var(--color-accent)] shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-[var(--color-text-primary)]">
                      Adaptive Light/Dark Theme
                    </p>
                    <p className="text-xs text-[var(--color-text-secondary)]">
                      Persistent theme system with zero flash on reload.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-2.5 p-3 rounded-lg bg-[var(--color-surface-subtle)] border border-[var(--color-border)]">
                  <CheckCircle2 className="w-4 h-4 text-[var(--color-accent)] shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-[var(--color-text-primary)]">
                      Git & Version Control
                    </p>
                    <p className="text-xs text-[var(--color-text-secondary)]">
                      Main branch initialized with secure .gitignore exclusions.
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column (1 span): Upcoming Routine Preview */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Next Workout</CardTitle>
              <CardDescription>Scheduled for today</CardDescription>
            </CardHeader>
            <CardContent className="p-5 space-y-4">
              <div className="p-4 rounded-lg bg-[var(--color-surface-subtle)] border border-[var(--color-border)] space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-[var(--color-text-primary)]">
                    Upper Body A (Hypertrophy)
                  </span>
                  <Badge variant="outline">45 min</Badge>
                </div>
                <p className="text-xs text-[var(--color-text-secondary)]">
                  Barbell Bench Press, Incline Dumbbell Press, Lat Pulldown, Cable Lateral Raise.
                </p>
              </div>

              <Button variant="primary" className="w-full">
                Preview Routine
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
