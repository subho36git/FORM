import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Sparkles,
  Sliders,
  Utensils,
  BookOpen,
  MessageSquare,
  ChevronLeft,
  ChevronRight,
  Calendar,
  Lock,
  Unlock,
  CheckCircle,
  Bookmark,
  AlertCircle,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { NutritionProvider, useNutrition } from './context/NutritionContext'
import { NutritionAssistantChat } from './components/NutritionAssistantChat'
import { DailyNutritionSummaryCard } from './components/DailyNutritionSummaryCard'
import { FoodDiaryCard } from './components/FoodDiaryCard'
import { AddFoodModal } from './components/AddFoodModal'
import { EditFoodModal } from './components/EditFoodModal'
import { SavedFoodsModal } from './components/SavedFoodsModal'
import { formatDisplayDate, getLocalDateString } from './types'

const NutritionPageContent: React.FC = () => {
  const {
    selectedDate,
    setSelectedDate,
    goToToday,
    goToPreviousDay,
    goToNextDay,
    isDayClosed,
    finalizeDay,
    reopenDay,
    isLoading,
    isSaving,
    error,
    clearError,
    activeEditItem,
    setActiveEditItem,
    isAddModalOpen,
    setIsAddModalOpen,
    selectedCategoryForAdd,
    isSavedManagerOpen,
    setIsSavedManagerOpen,
    savedManagerTab,
    openSavedManager,
  } = useNutrition()

  // Ensure page starts at top upon navigation
  React.useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
  }, [])

  // Mobile active tab: 'assistant' | 'diary'
  const [mobileTab, setMobileTab] = useState<'assistant' | 'diary'>('diary')

  const isToday = selectedDate === getLocalDateString()

  return (
    <div className="p-4 sm:p-6 md:p-10 max-w-7xl mx-auto w-full space-y-6 sm:space-y-8 animate-in fade-in duration-200">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Badge variant="accent" className="flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-[var(--color-accent-text)]" />
              AI Assistant Connected
            </Badge>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-[var(--color-text-primary)]">
            Nutrition Assistant
          </h1>
          <p className="text-sm text-[var(--color-text-secondary)] mt-0.5">
            AI-powered natural language meal logging and metabolic calibration with Gemini & Supabase.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Link to="/goals">
            <Button variant="outline" size="sm" icon={<Sliders className="w-3.5 h-3.5" />}>
              Adjust Targets
            </Button>
          </Link>
          <Button
            variant="primary"
            size="sm"
            icon={<Utensils className="w-3.5 h-3.5" />}
            onClick={() => setIsAddModalOpen(true)}
            disabled={isDayClosed}
            title={isDayClosed ? 'Day is finalized and read-only' : 'Log a food item'}
          >
            Log Food
          </Button>
        </div>
      </div>

      {/* Date Navigation & Day Status Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-xs">
        {/* Date Selector */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 !p-0"
            onClick={goToPreviousDay}
            title="Previous Day"
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>

          <div className="relative flex items-center gap-2 px-2 py-1 rounded-lg hover:bg-[var(--color-surface-hover)] transition-colors cursor-pointer group">
            <Calendar className="w-4 h-4 text-[var(--color-accent-text)]" />
            <span className="text-sm font-bold text-[var(--color-text-primary)]">
              {formatDisplayDate(selectedDate)}
            </span>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => e.target.value && setSelectedDate(e.target.value)}
              className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
              title="Click to pick date"
            />
          </div>

          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 !p-0"
            onClick={goToNextDay}
            title="Next Day"
          >
            <ChevronRight className="w-4 h-4" />
          </Button>

          {!isToday && (
            <Button
              variant="outline"
              size="sm"
              className="text-xs h-7 ml-1"
              onClick={goToToday}
            >
              Today
            </Button>
          )}
        </div>

        {/* Day Status & Finalization Actions */}
        <div className="flex items-center gap-2.5">
          {isDayClosed ? (
            <Badge variant="warning" className="flex items-center gap-1 text-xs py-1">
              <Lock className="w-3 h-3 text-amber-500" />
              Finalized (Read-Only)
            </Badge>
          ) : (
            <Badge
              variant="accent"
              className="flex items-center gap-1 text-xs py-1"
            >
              <CheckCircle className="w-3 h-3 text-[var(--color-accent)]" />
              Open Day
            </Badge>
          )}

          {isDayClosed ? (
            <Button
              variant="outline"
              size="sm"
              icon={<Unlock className="w-3.5 h-3.5" />}
              onClick={reopenDay}
              disabled={isSaving || isLoading}
            >
              Reopen Day
            </Button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              icon={<Lock className="w-3.5 h-3.5" />}
              onClick={finalizeDay}
              disabled={isSaving || isLoading}
              title="Finalize and lock this day's food log"
            >
              Finalize Day
            </Button>
          )}

          <Button
            variant="outline"
            size="sm"
            icon={<Bookmark className="w-3.5 h-3.5 text-[var(--color-accent)]" />}
            onClick={() => openSavedManager('foods')}
          >
            Saved Foods
          </Button>
        </div>
      </div>

      {/* Global Error Banner */}
      {error && (
        <div className="p-3.5 rounded-xl border border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-400 text-xs flex items-center justify-between animate-in fade-in">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={clearError}
            className="p-1 rounded text-red-500 hover:text-red-700 hover:bg-red-500/20 transition-colors cursor-pointer"
            title="Dismiss"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Mobile Tab Switcher (Visible on mobile screens < lg) */}
      <div className="flex lg:hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-1">
        <button
          type="button"
          onClick={() => setMobileTab('diary')}
          className={`flex-1 py-2 text-xs font-semibold rounded-lg flex items-center justify-center gap-2 transition-all cursor-pointer ${
            mobileTab === 'diary'
              ? 'bg-[var(--color-accent)] text-white shadow-xs'
              : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
          }`}
        >
          <BookOpen className="w-3.5 h-3.5" />
          <span>Diary & Targets</span>
        </button>
        <button
          type="button"
          onClick={() => setMobileTab('assistant')}
          className={`flex-1 py-2 text-xs font-semibold rounded-lg flex items-center justify-center gap-2 transition-all cursor-pointer ${
            mobileTab === 'assistant'
              ? 'bg-[var(--color-accent)] text-white shadow-xs'
              : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
          }`}
        >
          <MessageSquare className="w-3.5 h-3.5" />
          <span>AI Assistant</span>
        </button>
      </div>

      {/* Main Responsive Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Chat Assistant Placeholder (Visible on lg or when mobile tab is assistant) */}
        <div
          className={`lg:col-span-6 xl:col-span-6 ${
            mobileTab === 'assistant' ? 'block' : 'hidden lg:block'
          }`}
        >
          <NutritionAssistantChat />
        </div>

        {/* Right Column: Daily Summary & Food Diary (Always visible on lg; conditional on mobile) */}
        <div
          className={`lg:col-span-6 xl:col-span-6 space-y-6 ${
            mobileTab === 'diary' ? 'block' : 'hidden lg:block'
          }`}
        >
          <DailyNutritionSummaryCard />
          <FoodDiaryCard />
        </div>
      </div>

      {/* Manual Add Food Modal */}
      {isAddModalOpen && (
        <AddFoodModal
          key={`add-${selectedCategoryForAdd}-${selectedDate}`}
          isOpen={isAddModalOpen}
          onClose={() => setIsAddModalOpen(false)}
          defaultCategory={selectedCategoryForAdd}
        />
      )}

      {/* Edit Food Modal */}
      {activeEditItem && (
        <EditFoodModal
          key={`edit-${activeEditItem.id}`}
          isOpen={true}
          onClose={() => setActiveEditItem(null)}
          item={activeEditItem}
        />
      )}

      {/* Saved Foods & Recipes Manager Modal */}
      {isSavedManagerOpen && (
        <SavedFoodsModal
          key={`saved-manager-${savedManagerTab}`}
          isOpen={isSavedManagerOpen}
          onClose={() => setIsSavedManagerOpen(false)}
          initialTab={savedManagerTab}
        />
      )}
    </div>
  )
}

export const NutritionPage: React.FC = () => {
  return (
    <NutritionProvider>
      <NutritionPageContent />
    </NutritionProvider>
  )
}

export default NutritionPage
