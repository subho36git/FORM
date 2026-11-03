import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { ThemeProvider } from '@/context/ThemeContext'
import { AppShell } from '@/components/layout/AppShell'
import { DashboardPage } from '@/features/dashboard/DashboardPage'
import { WorkoutsPage } from '@/features/workouts/WorkoutsPage'
import { NutritionPage } from '@/features/nutrition/NutritionPage'
import { MetricsPage } from '@/features/metrics/MetricsPage'
import { AnalyticsPage } from '@/features/analytics/AnalyticsPage'
import { SettingsPage } from '@/features/settings/SettingsPage'

export const App: React.FC = () => {
  return (
    <ThemeProvider>
      {/* 
        BrowserRouter uses import.meta.env.BASE_URL so that if deployed to a GitHub Pages 
        subdirectory (e.g. username.github.io/FORM/), routes resolve seamlessly.
      */}
      <BrowserRouter basename={import.meta.env.BASE_URL}>
        <Routes>
          <Route element={<AppShell />}>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/workouts" element={<WorkoutsPage />} />
            <Route path="/nutrition" element={<NutritionPage />} />
            <Route path="/metrics" element={<MetricsPage />} />
            <Route path="/analytics" element={<AnalyticsPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            {/* Catch-all redirect to Dashboard */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  )
}

export default App
