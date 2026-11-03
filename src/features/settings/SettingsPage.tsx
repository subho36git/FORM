import React from 'react'
import { Settings as SettingsIcon, Sun, Moon, Monitor, Check } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { useTheme, type Theme } from '@/hooks/useTheme'
import { cn } from '@/lib/utils'

export const SettingsPage: React.FC = () => {
  const { theme, setTheme } = useTheme()

  const themeOptions: { value: Theme; title: string; desc: string; icon: React.ReactNode }[] = [
    {
      value: 'light',
      title: 'Light Mode',
      desc: 'Crisp porcelain surfaces with high-contrast slate typography.',
      icon: <Sun className="w-5 h-5 text-amber-500" />,
    },
    {
      value: 'dark',
      title: 'Dark Mode',
      desc: 'Deep obsidian slate surfaces designed for low eye-strain.',
      icon: <Moon className="w-5 h-5 text-blue-400" />,
    },
    {
      value: 'system',
      title: 'System Automatic',
      desc: 'Syncs automatically with your operating system preference.',
      icon: <Monitor className="w-5 h-5 text-slate-400" />,
    },
  ]

  return (
    <div className="p-6 md:p-10 max-w-4xl mx-auto w-full space-y-8">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Badge variant="accent">Configuration</Badge>
        </div>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-[var(--color-text-primary)]">
          Application Settings
        </h1>
        <p className="text-sm text-[var(--color-text-secondary)] mt-0.5">
          Manage your interface appearance, measurement units, and account preferences.
        </p>
      </div>

      {/* Theme Selection Card */}
      <Card>
        <CardHeader>
          <CardTitle>Interface Appearance</CardTitle>
          <CardDescription>
            Choose your preferred theme. Your choice is saved locally and applied instantly.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-5 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {themeOptions.map((opt) => {
              const isSelected = theme === opt.value
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setTheme(opt.value)}
                  className={cn(
                    'p-4 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between h-32',
                    isSelected
                      ? 'border-[var(--color-accent)] bg-[var(--color-accent-subtle)] ring-1 ring-[var(--color-accent)]'
                      : 'border-[var(--color-border)] bg-[var(--color-surface)] hover:bg-[var(--color-surface-hover)]'
                  )}
                >
                  <div className="flex items-center justify-between w-full">
                    {opt.icon}
                    {isSelected && (
                      <div className="w-5 h-5 rounded-full bg-[var(--color-accent)] text-white flex items-center justify-center">
                        <Check className="w-3 h-3 stroke-[3]" />
                      </div>
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-[var(--color-text-primary)]">
                      {opt.title}
                    </p>
                    <p className="text-[11px] text-[var(--color-text-secondary)] mt-0.5 leading-snug">
                      {opt.desc}
                    </p>
                  </div>
                </button>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Profile & Target Settings Stub (Phase 2) */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Fitness & Nutrition Targets</CardTitle>
              <CardDescription>
                Calorie targets, macro ratios, and unit system (Metric vs. Imperial).
              </CardDescription>
            </div>
            <Badge variant="outline">Coming in Phase 2</Badge>
          </div>
        </CardHeader>
        <CardContent className="p-5">
          <div className="flex items-center gap-3 p-4 rounded-lg bg-[var(--color-surface-subtle)] border border-[var(--color-border)]">
            <SettingsIcon className="w-5 h-5 text-[var(--color-text-muted)] shrink-0" />
            <div className="text-xs text-[var(--color-text-secondary)]">
              In Phase 2, we will integrate Supabase Authentication and a profile setup wizard to customize daily calorie goals, protein/carb/fat grams, and metric/imperial preferences.
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
