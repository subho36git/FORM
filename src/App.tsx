import React, { Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { ThemeProvider } from '@/context/ThemeContext'
import { UnitProvider } from '@/context/UnitContext'
import { AuthProvider, ProtectedRoute } from '@/features/auth'
import { GoalProvider } from '@/features/goals/context/GoalContext'
import { WorkoutProvider } from '@/features/workouts/context/WorkoutContext'
import { AppShell } from '@/components/layout/AppShell'

// Lazy-loaded routes directly targeting page modules to ensure full chunk isolation
const LoginPage = React.lazy(() => import('@/features/auth/AuthPage').then((m) => ({ default: m.LoginPage })))
const SignUpPage = React.lazy(() => import('@/features/auth/AuthPage').then((m) => ({ default: m.SignUpPage })))
const ForgotPasswordPage = React.lazy(() => import('@/features/auth/AuthPage').then((m) => ({ default: m.ForgotPasswordPage })))
const UpdatePasswordPage = React.lazy(() => import('@/features/auth/AuthPage').then((m) => ({ default: m.UpdatePasswordPage })))
const OnboardingPage = React.lazy(() => import('@/features/onboarding/OnboardingPage').then((m) => ({ default: m.OnboardingPage })))
const DashboardPage = React.lazy(() => import('@/features/dashboard/DashboardPage').then((m) => ({ default: m.DashboardPage })))
const GoalsPage = React.lazy(() => import('@/features/goals/GoalsPage').then((m) => ({ default: m.GoalsPage })))
const WorkoutsPage = React.lazy(() => import('@/features/workouts/WorkoutsPage').then((m) => ({ default: m.WorkoutsPage })))
const NutritionPage = React.lazy(() => import('@/features/nutrition/NutritionPage').then((m) => ({ default: m.NutritionPage })))
const MetricsPage = React.lazy(() => import('@/features/metrics/MetricsPage').then((m) => ({ default: m.MetricsPage })))
const AnalyticsPage = React.lazy(() => import('@/features/analytics/AnalyticsPage').then((m) => ({ default: m.AnalyticsPage })))
const SettingsPage = React.lazy(() => import('@/features/settings/SettingsPage').then((m) => ({ default: m.SettingsPage })))

const RouteLoadingFallback: React.FC = () => (
  <div className="min-h-[50vh] flex items-center justify-center p-6">
    <Loader2 className="w-6 h-6 animate-spin text-[var(--color-accent)]" />
  </div>
)

export const App: React.FC = () => {
  return (
    <ThemeProvider>
      <UnitProvider>
        <AuthProvider>
          <GoalProvider>
            <WorkoutProvider>
            {/* 
              BrowserRouter uses import.meta.env.BASE_URL so that if deployed to a GitHub Pages 
              subdirectory (e.g. username.github.io/FORM/), routes resolve seamlessly.
            */}
            <BrowserRouter basename={import.meta.env.BASE_URL}>
              <Suspense fallback={<RouteLoadingFallback />}>
                <Routes>
                  {/* Public Authentication Routes */}
                  <Route path="/login" element={<LoginPage key="login" />} />
                  <Route path="/signup" element={<SignUpPage key="signup" />} />
                  <Route path="/forgot-password" element={<ForgotPasswordPage key="forgot-password" />} />
                  <Route path="/update-password" element={<UpdatePasswordPage key="update-password" />} />

                  {/* Onboarding Wizard (Protected, redirects to / if onboarding is already completed) */}
                  <Route
                    path="/onboarding"
                    element={
                      <ProtectedRoute requireOnboarding={false} redirectIfCompleted={true}>
                        <OnboardingPage />
                      </ProtectedRoute>
                    }
                  />

                  {/* Protected Application Routes (Require completed onboarding) */}
                  <Route element={<ProtectedRoute requireOnboarding={true} />}>
                    <Route element={<AppShell />}>
                      <Route path="/" element={<DashboardPage />} />
                      <Route path="/goals" element={<GoalsPage />} />
                      <Route path="/workouts" element={<WorkoutsPage />} />
                      <Route path="/nutrition" element={<NutritionPage />} />
                      <Route path="/metrics" element={<MetricsPage />} />
                      <Route path="/analytics" element={<AnalyticsPage />} />
                      <Route path="/settings" element={<SettingsPage />} />
                    </Route>
                  </Route>

                  {/* Catch-all redirect to root */}
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </Suspense>
            </BrowserRouter>
        </WorkoutProvider>
      </GoalProvider>
    </AuthProvider>
  </UnitProvider>
</ThemeProvider>
)
}

export default App
