import React from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import {
  LayoutDashboard,
  Dumbbell,
  Utensils,
  TrendingUp,
  Activity,
  Settings,
  Flame,
} from 'lucide-react'
import { ThemeToggle } from '@/components/ui/ThemeToggle'
import { cn } from '@/lib/utils'

interface NavItem {
  to: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  badge?: string
}

const navItems: NavItem[] = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/workouts', label: 'Workouts', icon: Dumbbell },
  { to: '/nutrition', label: 'Nutrition', icon: Utensils },
  { to: '/analytics', label: 'Analytics', icon: TrendingUp },
  { to: '/metrics', label: 'Body Metrics', icon: Activity },
  { to: '/settings', label: 'Settings', icon: Settings },
]

export const AppShell: React.FC = () => {
  const location = useLocation()

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-[var(--color-bg)]">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-64 border-r border-[var(--color-border)] bg-[var(--color-surface)] shrink-0">
        {/* Brand Header */}
        <div className="flex items-center justify-between h-16 px-6 border-b border-[var(--color-border)]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[var(--color-accent)] flex items-center justify-center text-white font-bold text-sm shadow-xs">
              <Flame className="w-4 h-4 fill-current" />
            </div>
            <div>
              <span className="font-extrabold tracking-wider text-base text-[var(--color-text-primary)]">
                FORM
              </span>
              <span className="block text-[10px] uppercase tracking-widest text-[var(--color-text-muted)] font-semibold -mt-1">
                Precision
              </span>
            </div>
          </div>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 px-3 py-6 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon
            const isActive =
              item.to === '/'
                ? location.pathname === '/'
                : location.pathname.startsWith(item.to)

            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={cn(
                  'flex items-center justify-between px-3.5 py-2.5 rounded-lg text-sm font-medium transition-all group',
                  isActive
                    ? 'bg-[var(--color-surface-hover)] text-[var(--color-text-primary)] font-semibold'
                    : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-hover)]'
                )}
              >
                <div className="flex items-center gap-3">
                  <Icon
                    className={cn(
                      'w-4 h-4 transition-colors',
                      isActive
                        ? 'text-[var(--color-accent)]'
                        : 'text-[var(--color-text-muted)] group-hover:text-[var(--color-text-primary)]'
                    )}
                  />
                  <span>{item.label}</span>
                </div>
                {isActive && (
                  <div className="w-1.5 h-1.5 rounded-full bg-[var(--color-accent)]" />
                )}
              </NavLink>
            )
          })}
        </nav>

        {/* Sidebar Footer with Theme Toggle */}
        <div className="p-4 border-t border-[var(--color-border)] space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs text-[var(--color-text-muted)] font-medium">Appearance</span>
            <ThemeToggle />
          </div>
          <div className="flex items-center gap-3 pt-2 border-t border-[var(--color-border)]">
            <div className="w-8 h-8 rounded-full bg-[var(--color-surface-hover)] border border-[var(--color-border)] flex items-center justify-center text-xs font-bold text-[var(--color-text-primary)]">
              AT
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-[var(--color-text-primary)] truncate">
                Athlete Profile
              </p>
              <p className="text-[11px] text-[var(--color-text-muted)] truncate">
                Phase 1 Active
              </p>
            </div>
          </div>
        </div>
      </aside>

      {/* Mobile Top Header */}
      <header className="md:hidden flex items-center justify-between h-14 px-4 border-b border-[var(--color-border)] bg-[var(--color-surface)] sticky top-0 z-40">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-md bg-[var(--color-accent)] flex items-center justify-center text-white font-bold text-xs">
            <Flame className="w-3.5 h-3.5 fill-current" />
          </div>
          <span className="font-extrabold tracking-wider text-sm text-[var(--color-text-primary)]">
            FORM
          </span>
        </div>
        <ThemeToggle />
      </header>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto pb-20 md:pb-8">
        <Outlet />
      </main>

      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 h-16 border-t border-[var(--color-border)] bg-[var(--color-surface)]/95 backdrop-blur-xs flex items-center justify-around px-2 z-40">
        {navItems.map((item) => {
          const Icon = item.icon
          const isActive =
            item.to === '/'
              ? location.pathname === '/'
              : location.pathname.startsWith(item.to)

          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={cn(
                'flex flex-col items-center justify-center py-1 px-2 rounded-md transition-colors text-[10px] font-medium gap-1',
                isActive
                  ? 'text-[var(--color-accent)] font-semibold'
                  : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'
              )}
            >
              <Icon className="w-4 h-4" />
              <span>{item.label}</span>
            </NavLink>
          )
        })}
      </nav>
    </div>
  )
}
