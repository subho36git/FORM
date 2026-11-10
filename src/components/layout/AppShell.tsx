import React, { useState } from 'react'
import { NavLink, Link, Outlet, useLocation } from 'react-router-dom'
import {
  LayoutDashboard,
  Target,
  Dumbbell,
  Utensils,
  TrendingUp,
  Activity,
  Settings,
  Flame,
  LogOut,
  MoreHorizontal,
  X,
  ChevronRight,
} from 'lucide-react'
import { ThemeToggle } from '@/components/ui/ThemeToggle'
import { useAuth } from '@/features/auth'
import { cn } from '@/lib/utils'

interface NavItem {
  to: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  badge?: string
}

const navItems: NavItem[] = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/goals', label: 'Goals', icon: Target },
  { to: '/workouts', label: 'Workouts', icon: Dumbbell },
  { to: '/nutrition', label: 'Nutrition', icon: Utensils },
  { to: '/analytics', label: 'Analytics', icon: TrendingUp },
  { to: '/metrics', label: 'Body Metrics', icon: Activity },
  { to: '/settings', label: 'Settings', icon: Settings },
]

// Primary 4 items shown directly in mobile bottom bar
const mobilePrimaryItems = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/workouts', label: 'Workouts', icon: Dumbbell },
  { to: '/nutrition', label: 'Nutrition', icon: Utensils },
  { to: '/analytics', label: 'Analytics', icon: TrendingUp },
]

// Items accessed via the "More" bottom sheet on mobile
const mobileMoreItems = [
  {
    to: '/goals',
    label: 'Goals & Targets',
    description: 'Dynamic caloric targets and macro splits',
    icon: Target,
  },
  {
    to: '/metrics',
    label: 'Body Metrics & Photos',
    description: 'Circumference logs and progress photo gallery',
    icon: Activity,
  },
  {
    to: '/settings',
    label: 'Settings',
    description: 'Themes, metric/imperial units, and profile',
    icon: Settings,
  },
]

export const AppShell: React.FC = () => {
  const location = useLocation()
  const { user, profile, signOut } = useAuth()
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  const displayName =
    profile?.display_name ||
    (user?.user_metadata?.display_name as string) ||
    (user?.email ? user.email.split('@')[0] : 'Athlete')
  const initials = (displayName.replace(/[^a-zA-Z0-9]/g, '').slice(0, 2) || 'AT').toUpperCase()
  const userEmail = user?.email || 'Authenticated Athlete'

  const handleSignOut = async () => {
    await signOut()
  }

  const isMoreActive = ['/goals', '/metrics', '/settings'].some((path) =>
    location.pathname.startsWith(path)
  )

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-[var(--color-bg)]">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-64 border-r border-[var(--color-border)] bg-[var(--color-surface)] shrink-0">
        {/* Brand Header */}
        <div className="flex items-center justify-between h-16 px-6 border-b border-[var(--color-border)]">
          <Link to="/" className="flex items-center gap-2.5 group">
            <div className="w-8 h-8 rounded-lg bg-[var(--color-accent)] flex items-center justify-center text-white font-bold text-sm shadow-xs group-hover:opacity-90 transition-opacity">
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
          </Link>
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

        {/* Sidebar Footer with Theme Toggle & Settings Link */}
        <div className="p-4 border-t border-[var(--color-border)] space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs text-[var(--color-text-muted)] font-medium">Appearance</span>
            <ThemeToggle />
          </div>
          <div className="flex items-center justify-between gap-3 pt-2 border-t border-[var(--color-border)]">
            <Link
              to="/settings"
              className="flex items-center gap-2.5 min-w-0 flex-1 hover:opacity-85 transition-opacity"
              title="Manage Profile & Settings"
            >
              <div className="w-8 h-8 rounded-full bg-[var(--color-surface-hover)] border border-[var(--color-border)] flex items-center justify-center text-xs font-bold text-[var(--color-accent)] shrink-0">
                {initials}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-[var(--color-text-primary)] truncate">
                  {displayName}
                </p>
                <p className="text-[11px] text-[var(--color-text-muted)] truncate">
                  {userEmail}
                </p>
              </div>
            </Link>
            <button
              type="button"
              onClick={handleSignOut}
              className="p-1.5 rounded-lg text-[var(--color-text-muted)] hover:text-red-500 hover:bg-red-500/10 transition-colors shrink-0 cursor-pointer"
              title="Sign Out"
              aria-label="Sign Out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile Top Header */}
      <header className="md:hidden flex items-center justify-between h-14 px-4 border-b border-[var(--color-border)] bg-[var(--color-surface)] sticky top-0 z-40">
        <Link to="/" className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-md bg-[var(--color-accent)] flex items-center justify-center text-white font-bold text-xs shadow-xs">
            <Flame className="w-3.5 h-3.5 fill-current" />
          </div>
          <span className="font-extrabold tracking-wider text-sm text-[var(--color-text-primary)]">
            FORM
          </span>
        </Link>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Link
            to="/settings"
            className="w-7 h-7 rounded-full bg-[var(--color-surface-hover)] border border-[var(--color-border)] flex items-center justify-center text-xs font-bold text-[var(--color-accent)]"
            title="Settings"
          >
            {initials}
          </Link>
          <button
            type="button"
            onClick={handleSignOut}
            className="p-1.5 rounded-lg text-[var(--color-text-muted)] hover:text-red-500 hover:bg-red-500/10 transition-colors"
            title="Sign Out"
            aria-label="Sign Out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      {/* pb-24 reserves room for the 56px mobile nav + iOS safe area (≤34px) */}
      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto pb-24 md:pb-8">
        <Outlet />
      </main>

      {/* ── Mobile Bottom Navigation ──────────────────────────────────────────
          Layout: flex items-stretch so each child fills the full bar height.
          Height: driven by content (icon + label + py-2.5 ≈ 56px), then
                  paddingBottom adds env(safe-area-inset-bottom) for iOS.
          Width:  flex-1 on each child distributes the full bar width evenly,
                  preventing label clipping on 375 px screens.
          Touch targets: each item is at minimum 56 px tall × (screen/5) wide,
                  satisfying the WCAG 44 px guideline.
      ──────────────────────────────────────────────────────────────────────── */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 border-t border-[var(--color-border)] bg-[var(--color-surface)]/95 backdrop-blur-xs flex items-stretch z-40"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
        aria-label="Primary navigation"
      >
        {mobilePrimaryItems.map((item) => {
          const Icon = item.icon
          const isActive =
            item.to === '/'
              ? location.pathname === '/'
              : location.pathname.startsWith(item.to)

          return (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={() => setIsMobileMenuOpen(false)}
              aria-current={isActive ? 'page' : undefined}
              className={cn(
                // flex-1 + min-w-0 → equal slots, no overflow
                'flex-1 min-w-0 flex flex-col items-center justify-center gap-0.5 py-2.5',
                'transition-colors duration-150',
                isActive
                  ? 'text-[var(--color-accent)]'
                  : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'
              )}
            >
              {/* 22 px icon — clearer affordance than the original 16 px */}
              <Icon className="w-[22px] h-[22px] shrink-0" />
              {/* leading-none + truncate stops labels from wrapping or clipping */}
              <span className="text-[10px] font-medium leading-none truncate max-w-full px-1">
                {item.label}
              </span>
            </NavLink>
          )
        })}

        {/* More tab — highlights whenever a "More" route is active */}
        <button
          type="button"
          onClick={() => setIsMobileMenuOpen((prev) => !prev)}
          aria-expanded={isMobileMenuOpen}
          aria-haspopup="dialog"
          aria-label="More navigation options"
          className={cn(
            'flex-1 min-w-0 flex flex-col items-center justify-center gap-0.5 py-2.5',
            'transition-colors duration-150 cursor-pointer',
            isMoreActive || isMobileMenuOpen
              ? 'text-[var(--color-accent)]'
              : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'
          )}
        >
          <MoreHorizontal className="w-[22px] h-[22px] shrink-0" />
          <span className="text-[10px] font-medium leading-none">More</span>
        </button>
      </nav>

      {/* ── Mobile "More" Bottom Sheet ────────────────────────────────────────
          Accessibility: backdrop and dialog are siblings so aria-hidden on the
          backdrop does not accidentally hide the dialog content from ATs.
      ──────────────────────────────────────────────────────────────────────── */}
      {isMobileMenuOpen && (
        <>
          {/* Backdrop — tap to dismiss */}
          <div
            className="md:hidden fixed inset-0 z-50 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150"
            onClick={() => setIsMobileMenuOpen(false)}
            aria-hidden="true"
          />

          {/* Sheet */}
          <div
            role="dialog"
            aria-modal="true"
            aria-label="More navigation"
            className="md:hidden fixed bottom-0 left-0 right-0 z-[51] bg-[var(--color-surface)] border-t border-[var(--color-border)] rounded-t-2xl shadow-2xl animate-in slide-in-from-bottom duration-200"
            style={{ paddingBottom: 'env(safe-area-inset-bottom, 16px)' }}
          >
            {/* Drag handle (visual affordance) */}
            <div className="flex justify-center pt-3 pb-1" aria-hidden="true">
              <div className="w-9 h-1 rounded-full bg-[var(--color-border-hover)]" />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-[var(--color-border-subtle)]">
              <div>
                <h3 className="text-sm font-bold text-[var(--color-text-primary)]">
                  More Features
                </h3>
                <p className="text-[11px] text-[var(--color-text-muted)]">
                  Additional tools &amp; configuration
                </p>
              </div>
              {/* 44 × 44 close button */}
              <button
                type="button"
                onClick={() => setIsMobileMenuOpen(false)}
                className="w-11 h-11 flex items-center justify-center rounded-xl text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-hover)] transition-colors cursor-pointer"
                aria-label="Close menu"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Nav rows — min-h-[60px] ensures an ample touch target on each row */}
            <div className="p-4 space-y-2">
              {mobileMoreItems.map((item) => {
                const Icon = item.icon
                const isActive = location.pathname.startsWith(item.to)
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    onClick={() => setIsMobileMenuOpen(false)}
                    aria-current={isActive ? 'page' : undefined}
                    className={cn(
                      'flex items-center justify-between px-4 py-3.5 rounded-xl border transition-all min-h-[60px]',
                      isActive
                        ? 'border-[var(--color-accent)] bg-[var(--color-accent-subtle)] text-[var(--color-text-primary)]'
                        : 'border-[var(--color-border)] bg-[var(--color-surface-subtle)] text-[var(--color-text-primary)] hover:bg-[var(--color-surface-hover)]'
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] flex items-center justify-center text-[var(--color-accent)] shrink-0">
                        <Icon className="w-4 h-4" />
                      </div>
                      <div>
                        <span className="text-xs font-semibold block">{item.label}</span>
                        <span className="text-[10px] text-[var(--color-text-muted)] block leading-tight mt-0.5">
                          {item.description}
                        </span>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-[var(--color-text-muted)] shrink-0" />
                  </Link>
                )
              })}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
