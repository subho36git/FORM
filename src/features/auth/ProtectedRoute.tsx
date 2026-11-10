import React from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from './useAuth'
import { Flame, Loader2 } from 'lucide-react'

export interface ProtectedRouteProps {
  children?: React.ReactNode
  /**
   * If true (default), requires onboarding_completed to be true.
   * If incomplete, redirects the athlete to /onboarding.
   */
  requireOnboarding?: boolean
  /**
   * If true, redirects athletes who have already completed onboarding back to the dashboard (/).
   * Useful for guarding the /onboarding route itself.
   */
  redirectIfCompleted?: boolean
}

/**
 * Route guard that requires active authentication and checks onboarding completion status.
 */
export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  requireOnboarding = true,
  redirectIfCompleted = false,
}) => {
  const { isAuthenticated, isLoading, profile } = useAuth()
  const location = useLocation()

  // 1. Show branded loading splash while authentication state initializes
  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[var(--color-bg)] text-[var(--color-text-primary)] p-6">
        <div className="flex flex-col items-center gap-4 animate-in fade-in duration-300">
          <div className="w-12 h-12 rounded-2xl bg-[var(--color-accent)] flex items-center justify-center text-white shadow-lg shadow-[var(--color-accent)]/20 animate-pulse">
            <Flame className="w-6 h-6 fill-current" />
          </div>
          <div className="flex items-center gap-2.5 text-sm font-medium text-[var(--color-text-secondary)]">
            <Loader2 className="w-4 h-4 animate-spin text-[var(--color-accent)]" />
            <span>Verifying athlete credentials...</span>
          </div>
        </div>
      </div>
    )
  }

  // 2. Unauthenticated athletes are redirected to /login
  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  // 3. For the /onboarding route: redirect athletes who already completed onboarding to /
  if (redirectIfCompleted && profile?.onboarding_completed) {
    return <Navigate to="/" replace />
  }

  // 4. For standard protected routes: redirect athletes with incomplete onboarding to /onboarding
  if (requireOnboarding && (!profile || !profile.onboarding_completed)) {
    return <Navigate to="/onboarding" replace />
  }

  return children ? <>{children}</> : <Outlet />
}
