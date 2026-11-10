import React, { useState, useEffect } from 'react'
import {
  Sun,
  Moon,
  Monitor,
  Check,
  Ruler,
  Scale,
  Flame,
  User,
  Shield,
  Key,
  LogOut,
  AlertCircle,
  CheckCircle2,
  Info,
  Sparkles,
  RefreshCw,
  Loader2,
  Sliders,
} from 'lucide-react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { useTheme, type Theme } from '@/hooks/useTheme'
import { useUnit } from '@/hooks/useUnit'
import { useAuth } from '@/features/auth'
import { useGoals } from '@/features/goals'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import {
  calculateNutritionTargets,
  type FitnessGoal,
  type ActivityLevel,
  type CalorieSex,
} from '@/utils/nutritionCalculations'
import type { MacroPreference, UnitSystem, UserProfile } from '@/types'

type SettingsTab = 'appearance' | 'profile' | 'targets' | 'account'

const FITNESS_GOALS: { value: FitnessGoal; title: string; desc: string }[] = [
  {
    value: 'fat_loss',
    title: 'Fat Loss',
    desc: 'Moderate caloric deficit designed for sustainable body fat reduction while preserving lean mass.',
  },
  {
    value: 'maintenance',
    title: 'Maintenance',
    desc: 'Energy balance protocol to maintain body weight and fuel consistent training performance.',
  },
  {
    value: 'muscle_gain',
    title: 'Muscle Gain',
    desc: 'Controlled caloric surplus to support muscular hypertrophy, strength, and tissue recovery.',
  },
]

const ACTIVITY_LEVELS: { value: ActivityLevel; title: string; multiplier: string; desc: string }[] = [
  {
    value: 'sedentary',
    title: 'Sedentary',
    multiplier: '1.20×',
    desc: 'Desk job, seated work, little to no structured exercise.',
  },
  {
    value: 'lightly_active',
    title: 'Lightly Active',
    multiplier: '1.375×',
    desc: 'Light daily activity or 1–3 moderate workouts per week.',
  },
  {
    value: 'moderately_active',
    title: 'Moderately Active',
    multiplier: '1.55×',
    desc: 'Moderate exercise or physical training 3–5 days per week.',
  },
  {
    value: 'very_active',
    title: 'Very Active',
    multiplier: '1.725×',
    desc: 'Hard daily physical training or athletic conditioning 6–7 days per week.',
  },
]

const MACRO_PRESETS: { value: MacroPreference; label: string; pRatio: number; cRatio: number; fRatio: number }[] = [
  { value: 'balanced', label: 'Balanced (30P / 45C / 25F)', pRatio: 0.3, cRatio: 0.45, fRatio: 0.25 },
  { value: 'high_protein', label: 'High Protein (35P / 40C / 25F)', pRatio: 0.35, cRatio: 0.4, fRatio: 0.25 },
  { value: 'low_carb', label: 'Low Carb (35P / 25C / 40F)', pRatio: 0.35, cRatio: 0.25, fRatio: 0.4 },
  { value: 'custom', label: 'Custom Ratios', pRatio: 0, cRatio: 0, fRatio: 0 },
]

export const SettingsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<SettingsTab>('appearance')

  // Theme & Units
  const { theme, setTheme } = useTheme()
  const {
    unitSystem,
    setUnitSystem,
    weightUnit,
    formatWeight,
    formatHeight,
    kgToDisplay,
    displayToKg,
    cmToDisplay,
    displayToCm,
  } = useUnit()

  // Auth & Profile
  const { user, profile, updateProfile, refreshProfile, signOut } = useAuth()
  const { goals, refreshWeightEntries } = useGoals()

  // ============================================================================
  // PROFILE FORM STATE
  // ============================================================================
  const [displayName, setDisplayName] = useState(() => profile?.display_name || '')
  const [ageYears, setAgeYears] = useState(() => (profile?.age_years ? profile.age_years.toString() : '26'))
  const [sex, setSex] = useState<CalorieSex>(() => (profile?.sex_for_calorie_formula as CalorieSex) || 'male')
  const [heightValue, setHeightValue] = useState(() => {
    const rawHeight = Number(profile?.height_cm) || 178
    return Math.round(rawHeight).toString()
  })
  const [heightFeet, setHeightFeet] = useState(() => {
    const rawHeight = Number(profile?.height_cm) || 178
    return cmToDisplay(rawHeight).feet.toString()
  })
  const [heightInches, setHeightInches] = useState(() => {
    const rawHeight = Number(profile?.height_cm) || 178
    return cmToDisplay(rawHeight).inches.toString()
  })
  const [currentWeightValue, setCurrentWeightValue] = useState(() => {
    const rawWeight = Number(profile?.current_weight_kg) || 75
    return kgToDisplay(rawWeight).toString()
  })
  const [goalWeightValue, setGoalWeightValue] = useState(() => {
    const rawGoalWeight = Number(profile?.goal_weight_kg) || 70
    return kgToDisplay(rawGoalWeight).toString()
  })
  const [fitnessGoal, setFitnessGoal] = useState<FitnessGoal>(() => (profile?.fitness_goal as FitnessGoal) || 'fat_loss')
  const [activityLevel, setActivityLevel] = useState<ActivityLevel>(() => (profile?.activity_level as ActivityLevel) || 'moderately_active')

  const [profileSaving, setProfileSaving] = useState(false)
  const [profileSuccess, setProfileSuccess] = useState<string | null>(null)
  const [profileError, setProfileError] = useState<string | null>(null)

  // Track profile sync key during rendering
  const profileSyncKey = `${profile?.id || ''}_${profile?.updated_at || ''}_${unitSystem}_${profile?.current_weight_kg || ''}_${profile?.goal_weight_kg || ''}_${profile?.height_cm || ''}_${profile?.display_name || ''}_${profile?.fitness_goal || ''}_${profile?.activity_level || ''}`
  const [prevProfileSyncKey, setPrevProfileSyncKey] = useState(profileSyncKey)

  if (profile && profileSyncKey !== prevProfileSyncKey) {
    setPrevProfileSyncKey(profileSyncKey)
    setDisplayName(profile.display_name || '')
    setAgeYears(profile.age_years ? profile.age_years.toString() : '26')
    setSex((profile.sex_for_calorie_formula as CalorieSex) || 'male')

    const rawHeight = Number(profile.height_cm) || 178
    if (unitSystem === 'metric') {
      setHeightValue(Math.round(rawHeight).toString())
    } else {
      const { feet, inches } = cmToDisplay(rawHeight)
      setHeightFeet(feet.toString())
      setHeightInches(inches.toString())
    }

    const rawWeight = Number(profile.current_weight_kg) || 75
    const rawGoalWeight = Number(profile.goal_weight_kg) || 70
    setCurrentWeightValue(kgToDisplay(rawWeight).toString())
    setGoalWeightValue(kgToDisplay(rawGoalWeight).toString())

    setFitnessGoal((profile.fitness_goal as FitnessGoal) || 'fat_loss')
    setActivityLevel((profile.activity_level as ActivityLevel) || 'moderately_active')
  }

  // Handle saving Profile Form
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    setProfileSaving(true)
    setProfileError(null)
    setProfileSuccess(null)

    try {
      // Validate Display Name
      if (!displayName.trim()) {
        throw new Error('Please enter a display name.')
      }

      // Validate Age
      const ageNum = parseInt(ageYears, 10)
      if (isNaN(ageNum) || ageNum < 14 || ageNum > 100) {
        throw new Error('Please enter a valid age between 14 and 100 years.')
      }

      // Convert and Validate Height (stored strictly in cm)
      let heightCm = 0
      if (unitSystem === 'metric') {
        heightCm = parseFloat(heightValue)
      } else {
        const ft = parseInt(heightFeet, 10) || 0
        const inc = parseInt(heightInches, 10) || 0
        heightCm = displayToCm(ft, inc)
      }

      if (isNaN(heightCm) || heightCm < 100 || heightCm > 250) {
        throw new Error(
          unitSystem === 'metric'
            ? 'Please enter a valid height between 100 and 250 cm.'
            : 'Please enter a valid height (approx. 3 ft 3 in to 8 ft 2 in).'
        )
      }

      // Convert and Validate Current Weight & Goal Weight (stored strictly in kg)
      const currentWtNum = parseFloat(currentWeightValue)
      const goalWtNum = parseFloat(goalWeightValue)

      if (isNaN(currentWtNum) || currentWtNum <= 0 || isNaN(goalWtNum) || goalWtNum <= 0) {
        throw new Error('Please enter valid positive values for current and goal weight.')
      }

      const currentWeightKg = unitSystem === 'metric' ? currentWtNum : displayToKg(currentWtNum)
      const goalWeightKg = unitSystem === 'metric' ? goalWtNum : displayToKg(goalWtNum)

      if (currentWeightKg < 25 || currentWeightKg > 350 || goalWeightKg < 25 || goalWeightKg > 350) {
        throw new Error(
          unitSystem === 'metric'
            ? 'Weight must be between 25.0 and 350.0 kg.'
            : 'Weight must be between 55.0 and 770.0 lb.'
        )
      }

      const updates: Partial<UserProfile> = {
        display_name: displayName.trim(),
        age_years: ageNum,
        sex_for_calorie_formula: sex,
        height_cm: heightCm,
        current_weight_kg: currentWeightKg,
        goal_weight_kg: goalWeightKg,
        fitness_goal: fitnessGoal,
        activity_level: activityLevel,
      }

      const { error } = await updateProfile(updates)
      if (error) throw error

      await refreshProfile()
      await refreshWeightEntries()

      setProfileSuccess('Profile and body statistics updated successfully.')
    } catch (err: unknown) {
      setProfileError(err instanceof Error ? err.message : 'Failed to update profile.')
    } finally {
      setProfileSaving(false)
    }
  }

  // ============================================================================
  // NUTRITION & TARGETS FORM STATE
  // ============================================================================
  const [calorieInput, setCalorieInput] = useState(() =>
    Math.round(goals?.dailyCalories || profile?.daily_calorie_target || 2000).toString()
  )
  const [proteinInput, setProteinInput] = useState(() =>
    Math.round(goals?.proteinG || profile?.protein_target_g || 150).toString()
  )
  const [carbsInput, setCarbsInput] = useState(() =>
    Math.round(goals?.carbsG || profile?.carbs_target_g || 200).toString()
  )
  const [fatInput, setFatInput] = useState(() =>
    Math.round(goals?.fatG || profile?.fat_target_g || 60).toString()
  )
  const [macroPreset, setMacroPreset] = useState<MacroPreference>(
    () => (profile?.macro_preference as MacroPreference) || 'balanced'
  )
  const [manualOverrides, setManualOverrides] = useState<{
    calories?: boolean
    protein?: boolean
    carbs?: boolean
    fat?: boolean
  }>(() => profile?.manual_overrides || goals?.manualOverrides || {})

  const [targetsSaving, setTargetsSaving] = useState(false)
  const [targetsSuccess, setTargetsSuccess] = useState<string | null>(null)
  const [targetsError, setTargetsError] = useState<string | null>(null)

  // Track targets sync key during rendering
  const targetsSyncKey = `${profile?.id || ''}_${goals?.dailyCalories || profile?.daily_calorie_target || ''}_${goals?.proteinG || profile?.protein_target_g || ''}_${goals?.carbsG || profile?.carbs_target_g || ''}_${goals?.fatG || profile?.fat_target_g || ''}_${profile?.macro_preference || ''}`
  const [prevTargetsSyncKey, setPrevTargetsSyncKey] = useState(targetsSyncKey)

  if ((profile || goals) && targetsSyncKey !== prevTargetsSyncKey) {
    setPrevTargetsSyncKey(targetsSyncKey)
    const cals = goals.dailyCalories || profile?.daily_calorie_target || 2000
    const p = goals.proteinG || profile?.protein_target_g || 150
    const c = goals.carbsG || profile?.carbs_target_g || 200
    const f = goals.fatG || profile?.fat_target_g || 60

    setCalorieInput(Math.round(cals).toString())
    setProteinInput(Math.round(p).toString())
    setCarbsInput(Math.round(c).toString())
    setFatInput(Math.round(f).toString())

    setMacroPreset((profile?.macro_preference as MacroPreference) || 'balanced')
    setManualOverrides(profile?.manual_overrides || goals.manualOverrides || {})
  }

  // Macro calorie calculation preview
  const enteredCalories = parseInt(calorieInput, 10) || 0
  const enteredProtein = parseInt(proteinInput, 10) || 0
  const enteredCarbs = parseInt(carbsInput, 10) || 0
  const enteredFat = parseInt(fatInput, 10) || 0

  const calculatedMacroKcal = enteredProtein * 4 + enteredCarbs * 4 + enteredFat * 9
  const macroDelta = calculatedMacroKcal - enteredCalories

  const proteinPct = enteredCalories > 0 ? Math.round(((enteredProtein * 4) / enteredCalories) * 100) : 0
  const carbsPct = enteredCalories > 0 ? Math.round(((enteredCarbs * 4) / enteredCalories) * 100) : 0
  const fatPct = enteredCalories > 0 ? Math.round(((enteredFat * 9) / enteredCalories) * 100) : 0

  // Quick reset to auto-calculated targets based on profile stats
  const handleResetToAutoTargets = () => {
    const rawWeight = Number(profile?.current_weight_kg) || 75
    const rawHeight = Number(profile?.height_cm) || 178
    const rawAge = Number(profile?.age_years) || 26
    const rawSex = (profile?.sex_for_calorie_formula as CalorieSex) || 'male'
    const rawGoal = (profile?.fitness_goal as FitnessGoal) || 'fat_loss'
    const rawActivity = (profile?.activity_level as ActivityLevel) || 'moderately_active'

    const calculated = calculateNutritionTargets({
      weightKg: rawWeight,
      heightCm: rawHeight,
      ageYears: rawAge,
      sex: rawSex,
      goal: rawGoal,
      activityLevel: rawActivity,
    })

    setCalorieInput(calculated.dailyCalorieTarget.toString())
    setProteinInput(calculated.proteinG.toString())
    setCarbsInput(calculated.carbsG.toString())
    setFatInput(calculated.fatG.toString())
    setManualOverrides({
      calories: false,
      protein: false,
      carbs: false,
      fat: false,
    })
    setMacroPreset('balanced')
    setTargetsSuccess('Targets reset to calibrated automatic calculations based on your physical stats and goal.')
  }

  // Handle applying a macro preset split
  const handleApplyMacroPreset = (preset: MacroPreference) => {
    setMacroPreset(preset)
    if (preset === 'custom') return

    const conf = MACRO_PRESETS.find((p) => p.value === preset)
    if (!conf || enteredCalories <= 0) return

    const newP = Math.round((enteredCalories * conf.pRatio) / 4)
    const newC = Math.round((enteredCalories * conf.cRatio) / 4)
    const newF = Math.round((enteredCalories * conf.fRatio) / 9)

    setProteinInput(newP.toString())
    setCarbsInput(newC.toString())
    setFatInput(newF.toString())
  }

  // Save Nutrition Targets
  const handleSaveTargets = async (e: React.FormEvent) => {
    e.preventDefault()
    setTargetsSaving(true)
    setTargetsError(null)
    setTargetsSuccess(null)

    try {
      if (enteredCalories < 800 || enteredCalories > 10000) {
        throw new Error('Please enter a realistic daily calorie target between 800 and 10,000 kcal.')
      }
      if (enteredProtein < 20 || enteredProtein > 600) {
        throw new Error('Please enter a protein target between 20g and 600g.')
      }
      if (enteredCarbs < 0 || enteredCarbs > 1500) {
        throw new Error('Please enter a carbohydrate target between 0g and 1,500g.')
      }
      if (enteredFat < 10 || enteredFat > 400) {
        throw new Error('Please enter a fat target between 10g and 400g.')
      }

      const updates: Partial<UserProfile> = {
        daily_calorie_target: enteredCalories,
        protein_target_g: enteredProtein,
        carbs_target_g: enteredCarbs,
        fat_target_g: enteredFat,
        macro_preference: macroPreset,
        manual_overrides: {
          ...manualOverrides,
          calories: Boolean(manualOverrides.calories),
          protein: Boolean(manualOverrides.protein),
          carbs: Boolean(manualOverrides.carbs),
          fat: Boolean(manualOverrides.fat),
        },
      }

      const { error } = await updateProfile(updates)
      if (error) throw error

      await refreshProfile()
      setTargetsSuccess('Nutrition targets and macro distribution updated successfully.')
    } catch (err: unknown) {
      setTargetsError(err instanceof Error ? err.message : 'Failed to update nutrition targets.')
    } finally {
      setTargetsSaving(false)
    }
  }

  // ============================================================================
  // SECURITY & PASSWORD UPDATE STATE
  // ============================================================================
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordSaving, setPasswordSaving] = useState(false)
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null)
  const [passwordError, setPasswordError] = useState<string | null>(null)

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setPasswordSaving(true)
    setPasswordError(null)
    setPasswordSuccess(null)

    try {
      if (!newPassword || newPassword.length < 6) {
        throw new Error('New password must be at least 6 characters long.')
      }
      if (newPassword !== confirmPassword) {
        throw new Error('Passwords do not match. Please re-enter.')
      }

      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      })

      if (error) {
        throw error
      }

      setPasswordSuccess('Password updated successfully. Please use your new password on your next sign-in.')
      setNewPassword('')
      setConfirmPassword('')
    } catch (err: unknown) {
      setPasswordError(err instanceof Error ? err.message : 'Failed to update password.')
    } finally {
      setPasswordSaving(false)
    }
  }

  // ============================================================================
  // SIGN OUT & MODAL STATE
  // ============================================================================
  const [isSignOutModalOpen, setIsSignOutModalOpen] = useState(false)
  const [isSigningOut, setIsSigningOut] = useState(false)

  // ESC key to close sign-out modal
  useEffect(() => {
    if (!isSignOutModalOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsSignOutModalOpen(false)
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isSignOutModalOpen])

  const handleConfirmSignOut = async () => {
    setIsSigningOut(true)
    try {
      await signOut()
    } catch (err) {
      console.error('[Settings] Error signing out:', err)
    } finally {
      setIsSigningOut(false)
      setIsSignOutModalOpen(false)
    }
  }

  // Theme option list
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

  // Unit options list
  const unitOptions: { value: UnitSystem; title: string; desc: string; icon: React.ReactNode; specs: string }[] = [
    {
      value: 'metric',
      title: 'Metric System',
      desc: 'International athletic standard using kilograms, centimeters, and grams.',
      icon: <Scale className="w-5 h-5 text-[var(--color-accent)]" />,
      specs: 'Weight in kg • Height in cm • Intake in kcal & g',
    },
    {
      value: 'imperial',
      title: 'Imperial System',
      desc: 'Standard units using pounds, feet/inches, and fluid ounces.',
      icon: <Ruler className="w-5 h-5 text-purple-400" />,
      specs: 'Weight in lb • Height in ft/in • Intake in kcal & g',
    },
  ]

  return (
    <div className="p-4 sm:p-6 md:p-10 max-w-5xl mx-auto w-full space-y-6 sm:space-y-8 animate-in fade-in duration-200">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Badge variant="accent">Preferences & Profile</Badge>
            <span className="text-xs text-[var(--color-text-muted)] flex items-center gap-1">
              <Sliders className="w-3.5 h-3.5 text-blue-400" /> Application Control
            </span>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-[var(--color-text-primary)]">
            Application Settings
          </h1>
          <p className="text-sm text-[var(--color-text-secondary)] mt-0.5">
            Manage your interface appearance, measurement units, athlete profile, and nutrition targets.
          </p>
        </div>

        {/* Global Quick Action Logout */}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setIsSignOutModalOpen(true)}
          className="self-start sm:self-auto text-xs text-rose-600 dark:text-rose-400 border-rose-500/20 hover:bg-rose-500/10"
        >
          <LogOut className="w-3.5 h-3.5 mr-1.5" /> Sign Out
        </Button>
      </div>

      {/* Settings Navigation Tabs */}
      <div className="flex items-center gap-1.5 p-1 bg-[var(--color-surface-hover)] rounded-xl border border-[var(--color-border)] overflow-x-auto scrollbar-none max-w-full">
        <button
          type="button"
          onClick={() => setActiveTab('appearance')}
          className={cn(
            'flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer',
            activeTab === 'appearance'
              ? 'bg-[var(--color-surface)] text-[var(--color-text-primary)] shadow-xs'
              : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'
          )}
        >
          <Sparkles className="w-3.5 h-3.5 text-amber-500" />
          <span>Appearance & Units</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('profile')}
          className={cn(
            'flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer',
            activeTab === 'profile'
              ? 'bg-[var(--color-surface)] text-[var(--color-text-primary)] shadow-xs'
              : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'
          )}
        >
          <User className="w-3.5 h-3.5 text-blue-500" />
          <span>Athlete Profile</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('targets')}
          className={cn(
            'flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer',
            activeTab === 'targets'
              ? 'bg-[var(--color-surface)] text-[var(--color-text-primary)] shadow-xs'
              : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'
          )}
        >
          <Flame className="w-3.5 h-3.5 text-emerald-500" />
          <span>Nutrition & Targets</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('account')}
          className={cn(
            'flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer',
            activeTab === 'account'
              ? 'bg-[var(--color-surface)] text-[var(--color-text-primary)] shadow-xs'
              : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'
          )}
        >
          <Shield className="w-3.5 h-3.5 text-purple-500" />
          <span>Account & Security</span>
        </button>
      </div>

      {/* ======================================================================== */}
      {/* TAB 1: APPEARANCE & MEASUREMENT UNITS */}
      {/* ======================================================================== */}
      {activeTab === 'appearance' && (
        <div className="space-y-6">
          {/* Theme Card */}
          <Card>
            <CardHeader>
              <CardTitle>Interface Theme</CardTitle>
              <CardDescription>
                Choose your preferred visual presentation. Your selection is stored locally and applied instantly.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-5">
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

          {/* Unit System Card */}
          <Card>
            <CardHeader>
              <CardTitle>Measurement Units</CardTitle>
              <CardDescription>
                Configure your display units for body weight, height, and physical metrics. All data is preserved accurately in standard storage.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {unitOptions.map((opt) => {
                  const isSelected = unitSystem === opt.value
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setUnitSystem(opt.value)}
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
                        <p className="text-[11px] font-mono text-[var(--color-text-muted)] mt-0.5">
                          {opt.specs}
                        </p>
                      </div>
                    </button>
                  )
                })}
              </div>

              {/* Conversion Live Preview Box */}
              <div className="p-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-hover)]/30 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-[var(--color-text-primary)] flex items-center gap-1.5">
                    <Info className="w-3.5 h-3.5 text-blue-400" /> Conversion Integrity Standard
                  </span>
                  <Badge variant="outline">Active: {unitSystem === 'metric' ? 'Metric (kg, cm)' : 'Imperial (lb, ft/in)'}</Badge>
                </div>
                <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">
                  Underlying athlete records remain stored in standardized metric units (kg and cm) to guarantee chronological accuracy and eliminate floating drift. Switching units converts display presentations on the fly without silently modifying your database history.
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-xs font-mono">
                  <div className="p-2 rounded-md bg-[var(--color-surface)] border border-[var(--color-border)]">
                    <span className="text-[10px] text-[var(--color-text-muted)] block">Bodyweight</span>
                    <span className="font-bold text-[var(--color-text-primary)]">
                      {formatWeight(Number(profile?.current_weight_kg) || 75)}
                    </span>
                  </div>
                  <div className="p-2 rounded-md bg-[var(--color-surface)] border border-[var(--color-border)]">
                    <span className="text-[10px] text-[var(--color-text-muted)] block">Height</span>
                    <span className="font-bold text-[var(--color-text-primary)]">
                      {formatHeight(Number(profile?.height_cm) || 178)}
                    </span>
                  </div>
                  <div className="p-2 rounded-md bg-[var(--color-surface)] border border-[var(--color-border)]">
                    <span className="text-[10px] text-[var(--color-text-muted)] block">Energy Unit</span>
                    <span className="font-bold text-[var(--color-text-primary)]">kcal</span>
                  </div>
                  <div className="p-2 rounded-md bg-[var(--color-surface)] border border-[var(--color-border)]">
                    <span className="text-[10px] text-[var(--color-text-muted)] block">Macro Mass</span>
                    <span className="font-bold text-[var(--color-text-primary)]">grams (g)</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ======================================================================== */}
      {/* TAB 2: ATHLETE PROFILE */}
      {/* ======================================================================== */}
      {activeTab === 'profile' && (
        <form onSubmit={handleSaveProfile} className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Physical Profile & Training Baseline</CardTitle>
              <CardDescription>
                Personal parameters used for Mifflin-St Jeor metabolic rate calculations and energy requirements.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-5 space-y-5">
              {/* Feedback Alerts */}
              {profileSuccess && (
                <div className="p-3.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{profileSuccess}</span>
                </div>
              )}
              {profileError && (
                <div className="p-3.5 rounded-lg border border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{profileError}</span>
                </div>
              )}

              {/* Basic Details: Display Name & Email */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label="Athlete Display Name"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="e.g. Alex"
                  required
                />
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">
                    Account Email (Primary Auth)
                  </label>
                  <div className="p-2.5 rounded-lg bg-[var(--color-surface-hover)] border border-[var(--color-border)] text-xs text-[var(--color-text-muted)] flex items-center justify-between">
                    <span className="font-mono">{user?.email || 'No email attached'}</span>
                    <Badge variant="outline" className="text-[10px]">Verified Account</Badge>
                  </div>
                </div>
              </div>

              {/* Physical Stats: Age, Sex, Height, Weight */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                {/* Age */}
                <Input
                  label="Age (Years)"
                  type="number"
                  min="14"
                  max="100"
                  value={ageYears}
                  onChange={(e) => setAgeYears(e.target.value)}
                  placeholder="26"
                  required
                />

                {/* Biological Sex */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">
                    Biological Sex (BMR Formula)
                  </label>
                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      type="button"
                      onClick={() => setSex('male')}
                      className={cn(
                        'py-2 px-3 rounded-lg text-xs font-semibold border transition-all cursor-pointer',
                        sex === 'male'
                          ? 'bg-[var(--color-accent)] text-white border-[var(--color-accent)]'
                          : 'bg-[var(--color-surface)] text-[var(--color-text-muted)] border-[var(--color-border)] hover:bg-[var(--color-surface-hover)]'
                      )}
                    >
                      Male
                    </button>
                    <button
                      type="button"
                      onClick={() => setSex('female')}
                      className={cn(
                        'py-2 px-3 rounded-lg text-xs font-semibold border transition-all cursor-pointer',
                        sex === 'female'
                          ? 'bg-[var(--color-accent)] text-white border-[var(--color-accent)]'
                          : 'bg-[var(--color-surface)] text-[var(--color-text-muted)] border-[var(--color-border)] hover:bg-[var(--color-surface-hover)]'
                      )}
                    >
                      Female
                    </button>
                  </div>
                </div>

                {/* Height */}
                {unitSystem === 'metric' ? (
                  <Input
                    label="Height (cm)"
                    type="number"
                    min="100"
                    max="250"
                    value={heightValue}
                    onChange={(e) => setHeightValue(e.target.value)}
                    placeholder="178"
                    required
                  />
                ) : (
                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">
                      Height (ft & in)
                    </label>
                    <div className="grid grid-cols-2 gap-1.5">
                      <Input
                        type="number"
                        min="3"
                        max="8"
                        placeholder="5 ft"
                        value={heightFeet}
                        onChange={(e) => setHeightFeet(e.target.value)}
                        required
                      />
                      <Input
                        type="number"
                        min="0"
                        max="11"
                        placeholder="10 in"
                        value={heightInches}
                        onChange={(e) => setHeightInches(e.target.value)}
                        required
                      />
                    </div>
                  </div>
                )}

                {/* Current Weight */}
                <Input
                  label={`Current Weight (${weightUnit})`}
                  type="number"
                  step="0.1"
                  min="25"
                  max="770"
                  value={currentWeightValue}
                  onChange={(e) => setCurrentWeightValue(e.target.value)}
                  placeholder={unitSystem === 'metric' ? '75.0' : '165.0'}
                  required
                />
              </div>

              {/* Goal Weight */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label={`Goal Weight Target (${weightUnit})`}
                  type="number"
                  step="0.1"
                  min="25"
                  max="770"
                  value={goalWeightValue}
                  onChange={(e) => setGoalWeightValue(e.target.value)}
                  placeholder={unitSystem === 'metric' ? '70.0' : '155.0'}
                  helperText="Target body weight used for trajectory calculation."
                  required
                />

                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">
                    Target Trajectory Status
                  </label>
                  <div className="p-3 rounded-lg bg-[var(--color-surface-hover)] border border-[var(--color-border)] text-xs text-[var(--color-text-secondary)] flex items-center justify-between">
                    <span>
                      Delta: {parseFloat(goalWeightValue) && parseFloat(currentWeightValue)
                        ? `${(parseFloat(goalWeightValue) - parseFloat(currentWeightValue)).toFixed(1)} ${weightUnit}`
                        : '—'}
                    </span>
                    <span className="font-mono text-[var(--color-text-muted)] text-[11px]">
                      {fitnessGoal.replace('_', ' ').toUpperCase()}
                    </span>
                  </div>
                </div>
              </div>

              {/* Fitness Goal Selection */}
              <div className="space-y-2 pt-2 border-t border-[var(--color-border-subtle)]">
                <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">
                  Primary Fitness Goal
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {FITNESS_GOALS.map((g) => {
                    const isSelected = fitnessGoal === g.value
                    return (
                      <button
                        key={g.value}
                        type="button"
                        onClick={() => setFitnessGoal(g.value)}
                        className={cn(
                          'p-3.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between',
                          isSelected
                            ? 'border-[var(--color-accent)] bg-[var(--color-accent-subtle)] ring-1 ring-[var(--color-accent)]'
                            : 'border-[var(--color-border)] bg-[var(--color-surface)] hover:bg-[var(--color-surface-hover)]'
                        )}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-[var(--color-text-primary)]">
                            {g.title}
                          </span>
                          {isSelected && (
                            <div className="w-4 h-4 rounded-full bg-[var(--color-accent)] text-white flex items-center justify-center">
                              <Check className="w-2.5 h-2.5 stroke-[3]" />
                            </div>
                          )}
                        </div>
                        <p className="text-[11px] text-[var(--color-text-secondary)] mt-1.5 leading-snug">
                          {g.desc}
                        </p>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Activity Level Selection */}
              <div className="space-y-2 pt-2 border-t border-[var(--color-border-subtle)]">
                <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">
                  Weekly Physical Activity Level
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  {ACTIVITY_LEVELS.map((act) => {
                    const isSelected = activityLevel === act.value
                    return (
                      <button
                        key={act.value}
                        type="button"
                        onClick={() => setActivityLevel(act.value)}
                        className={cn(
                          'p-3.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between',
                          isSelected
                            ? 'border-[var(--color-accent)] bg-[var(--color-accent-subtle)] ring-1 ring-[var(--color-accent)]'
                            : 'border-[var(--color-border)] bg-[var(--color-surface)] hover:bg-[var(--color-surface-hover)]'
                        )}
                      >
                        <div>
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-[var(--color-text-primary)]">
                              {act.title}
                            </span>
                            <span className="text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded bg-[var(--color-surface-hover)] text-[var(--color-accent)]">
                              {act.multiplier}
                            </span>
                          </div>
                          <p className="text-[11px] text-[var(--color-text-secondary)] mt-1.5 leading-snug">
                            {act.desc}
                          </p>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Submit Button */}
              <div className="pt-3 flex justify-end">
                <Button type="submit" disabled={profileSaving} className="text-xs px-5">
                  {profileSaving ? (
                    <span className="flex items-center gap-1.5">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving...
                    </span>
                  ) : (
                    'Save Profile & Physical Stats'
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </form>
      )}

      {/* ======================================================================== */}
      {/* TAB 3: FITNESS & NUTRITION TARGETS */}
      {/* ======================================================================== */}
      {activeTab === 'targets' && (
        <form onSubmit={handleSaveTargets} className="space-y-6">
          <Card>
            <CardHeader className="pb-3 border-b border-[var(--color-border-subtle)]">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <CardTitle>Daily Nutrition Targets & Energy Balance</CardTitle>
                  <CardDescription>
                    Configure caloric targets and macronutrient distributions. Updated targets reflect across Dashboard, Goals, Nutrition, and Analytics immediately.
                  </CardDescription>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleResetToAutoTargets}
                  className="text-xs self-start sm:self-auto"
                >
                  <RefreshCw className="w-3 h-3 mr-1.5 text-[var(--color-accent)]" /> Reset to Calculated
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-5 space-y-6">
              {/* Feedback Alerts */}
              {targetsSuccess && (
                <div className="p-3.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{targetsSuccess}</span>
                </div>
              )}
              {targetsError && (
                <div className="p-3.5 rounded-lg border border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{targetsError}</span>
                </div>
              )}

              {/* Status Indicator Callout */}
              <div className="p-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-hover)]/30 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-[var(--color-text-primary)] flex items-center gap-1.5">
                    <Info className="w-3.5 h-3.5 text-[var(--color-accent)]" /> Active Target Configuration
                  </span>
                  <div className="flex items-center gap-2">
                    {manualOverrides.calories ? (
                      <Badge variant="outline" className="text-amber-600 dark:text-amber-400 border-amber-500/30 text-[10px]">
                        Manual Override Active
                      </Badge>
                    ) : (
                      <Badge variant="accent" className="text-[10px]">Auto-Calculated Target</Badge>
                    )}
                  </div>
                </div>
                <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">
                  Calculated targets adapt to your body weight, physical activity level, and target timeline. Manual overrides freeze your daily intake quotas so automatic goal engine recalibrations do not overwrite your custom numbers.
                </p>
              </div>

              {/* Macro Distribution Presets */}
              <div className="space-y-2">
                <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">
                  Macronutrient Ratio Preset
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                  {MACRO_PRESETS.map((p) => {
                    const isSelected = macroPreset === p.value
                    return (
                      <button
                        key={p.value}
                        type="button"
                        onClick={() => handleApplyMacroPreset(p.value)}
                        className={cn(
                          'p-3 rounded-lg border text-left text-xs font-medium transition-all cursor-pointer',
                          isSelected
                            ? 'border-[var(--color-accent)] bg-[var(--color-accent-subtle)] text-[var(--color-text-primary)] font-semibold'
                            : 'border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)]'
                        )}
                      >
                        <div className="flex items-center justify-between">
                          <span>{p.label.split(' (')[0]}</span>
                          {isSelected && <Check className="w-3.5 h-3.5 text-[var(--color-accent)]" />}
                        </div>
                        {p.value !== 'custom' && (
                          <span className="text-[10px] text-[var(--color-text-muted)] block mt-0.5">
                            {p.label.split(' (')[1]?.replace(')', '')}
                          </span>
                        )}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Targets Numerical Inputs */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                {/* 1. Daily Calories */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">
                      Daily Calories
                    </label>
                    <span className="text-[10px] text-[var(--color-text-muted)]">
                      {manualOverrides.calories ? 'Manual' : 'Calculated'}
                    </span>
                  </div>
                  <Input
                    type="number"
                    min="800"
                    max="10000"
                    value={calorieInput}
                    onChange={(e) => {
                      setCalorieInput(e.target.value)
                      setManualOverrides((prev) => ({ ...prev, calories: true }))
                    }}
                    placeholder="2000"
                    required
                  />
                  <div className="flex items-center justify-between text-[11px] text-[var(--color-text-muted)] pt-0.5">
                    <span>Target energy intake</span>
                    {manualOverrides.calories && (
                      <button
                        type="button"
                        onClick={() => setManualOverrides((prev) => ({ ...prev, calories: false }))}
                        className="text-[10px] text-[var(--color-accent)] hover:underline cursor-pointer"
                      >
                        Unlock to Auto
                      </button>
                    )}
                  </div>
                </div>

                {/* 2. Protein */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">
                      Protein Target
                    </label>
                    <span className="text-[10px] text-blue-500 font-mono font-semibold">
                      {enteredProtein * 4} kcal
                    </span>
                  </div>
                  <Input
                    type="number"
                    min="20"
                    max="600"
                    value={proteinInput}
                    onChange={(e) => {
                      setProteinInput(e.target.value)
                      setManualOverrides((prev) => ({ ...prev, protein: true }))
                    }}
                    placeholder="150"
                    required
                  />
                  <div className="flex items-center justify-between text-[11px] text-[var(--color-text-muted)] pt-0.5">
                    <span>{proteinPct}% of total calories</span>
                    <span className="font-mono text-[10px]">4 kcal/g</span>
                  </div>
                </div>

                {/* 3. Carbohydrates */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">
                      Carbohydrates
                    </label>
                    <span className="text-[10px] text-emerald-500 font-mono font-semibold">
                      {enteredCarbs * 4} kcal
                    </span>
                  </div>
                  <Input
                    type="number"
                    min="0"
                    max="1500"
                    value={carbsInput}
                    onChange={(e) => {
                      setCarbsInput(e.target.value)
                      setManualOverrides((prev) => ({ ...prev, carbs: true }))
                    }}
                    placeholder="200"
                    required
                  />
                  <div className="flex items-center justify-between text-[11px] text-[var(--color-text-muted)] pt-0.5">
                    <span>{carbsPct}% of total calories</span>
                    <span className="font-mono text-[10px]">4 kcal/g</span>
                  </div>
                </div>

                {/* 4. Fat */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">
                      Fat Target
                    </label>
                    <span className="text-[10px] text-purple-500 font-mono font-semibold">
                      {enteredFat * 9} kcal
                    </span>
                  </div>
                  <Input
                    type="number"
                    min="10"
                    max="400"
                    value={fatInput}
                    onChange={(e) => {
                      setFatInput(e.target.value)
                      setManualOverrides((prev) => ({ ...prev, fat: true }))
                    }}
                    placeholder="60"
                    required
                  />
                  <div className="flex items-center justify-between text-[11px] text-[var(--color-text-muted)] pt-0.5">
                    <span>{fatPct}% of total calories</span>
                    <span className="font-mono text-[10px]">9 kcal/g</span>
                  </div>
                </div>
              </div>

              {/* Visual Macro Bar & Energy Balance Check */}
              <div className="p-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                  <span className="font-semibold text-[var(--color-text-primary)]">
                    Macro Caloric Contribution Balance
                  </span>
                  <div className="flex items-center gap-2 font-mono text-[11px]">
                    <span className="text-[var(--color-text-muted)]">Sum of Macros:</span>
                    <span className={cn('font-bold', Math.abs(macroDelta) > 50 ? 'text-amber-500' : 'text-emerald-500')}>
                      {calculatedMacroKcal} kcal
                    </span>
                    <span className="text-[var(--color-text-muted)]">/ Target: {enteredCalories} kcal</span>
                  </div>
                </div>

                {/* Proportional Stack Bar */}
                <div className="w-full bg-[var(--color-surface-hover)] rounded-full h-3 flex overflow-hidden">
                  <div
                    style={{ width: `${Math.min(100, proteinPct)}%` }}
                    className="bg-blue-500 h-full transition-all duration-300"
                    title={`Protein: ${proteinPct}%`}
                  />
                  <div
                    style={{ width: `${Math.min(100, carbsPct)}%` }}
                    className="bg-emerald-500 h-full transition-all duration-300"
                    title={`Carbs: ${carbsPct}%`}
                  />
                  <div
                    style={{ width: `${Math.min(100, fatPct)}%` }}
                    className="bg-purple-500 h-full transition-all duration-300"
                    title={`Fat: ${fatPct}%`}
                  />
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1.5 text-blue-500 font-medium text-[11px]">
                      <span className="w-2 h-2 rounded-full bg-blue-500" /> Protein {proteinPct}%
                    </span>
                    <span className="flex items-center gap-1.5 text-emerald-500 font-medium text-[11px]">
                      <span className="w-2 h-2 rounded-full bg-emerald-500" /> Carbs {carbsPct}%
                    </span>
                    <span className="flex items-center gap-1.5 text-purple-500 font-medium text-[11px]">
                      <span className="w-2 h-2 rounded-full bg-purple-500" /> Fat {fatPct}%
                    </span>
                  </div>

                  {Math.abs(macroDelta) > 50 && (
                    <span className="text-[11px] text-amber-600 dark:text-amber-400">
                      Macros deviate by {Math.abs(macroDelta)} kcal from daily target.
                    </span>
                  )}
                </div>
              </div>

              {/* Submit Button */}
              <div className="pt-2 flex justify-end">
                <Button type="submit" disabled={targetsSaving} className="text-xs px-5">
                  {targetsSaving ? (
                    <span className="flex items-center gap-1.5">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving Targets...
                    </span>
                  ) : (
                    'Save Nutrition Targets'
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </form>
      )}

      {/* ======================================================================== */}
      {/* TAB 4: ACCOUNT & SECURITY */}
      {/* ======================================================================== */}
      {activeTab === 'account' && (
        <div className="space-y-6">
          {/* Account Overview Card */}
          <Card>
            <CardHeader>
              <CardTitle>Account Credentials & Identifier</CardTitle>
              <CardDescription>
                Your authenticated account profile with encrypted Supabase Auth credentials.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div className="p-3 rounded-lg bg-[var(--color-surface-hover)] border border-[var(--color-border)] space-y-1">
                  <span className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wider block">
                    Account Email
                  </span>
                  <span className="font-mono font-medium text-[var(--color-text-primary)]">
                    {user?.email || '—'}
                  </span>
                </div>

                <div className="p-3 rounded-lg bg-[var(--color-surface-hover)] border border-[var(--color-border)] space-y-1">
                  <span className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wider block">
                    Athlete User ID
                  </span>
                  <span className="font-mono text-[11px] text-[var(--color-text-secondary)] truncate block">
                    {user?.id || '—'}
                  </span>
                </div>

                <div className="p-3 rounded-lg bg-[var(--color-surface-hover)] border border-[var(--color-border)] space-y-1">
                  <span className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wider block">
                    Member Since
                  </span>
                  <span className="font-mono text-[var(--color-text-primary)]">
                    {user?.created_at ? new Date(user.created_at).toLocaleDateString() : '—'}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Change Password Card */}
          <form onSubmit={handleUpdatePassword}>
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Key className="w-4 h-4 text-[var(--color-accent)]" />
                  <CardTitle>Change Account Password</CardTitle>
                </div>
                <CardDescription>
                  Update your authentication password. New credentials will take effect immediately.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-5 space-y-4">
                {passwordSuccess && (
                  <div className="p-3.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span>{passwordSuccess}</span>
                  </div>
                )}
                {passwordError && (
                  <div className="p-3.5 rounded-lg border border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400 text-xs flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{passwordError}</span>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Input
                    label="New Password"
                    type="password"
                    showPasswordToggle
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="••••••••"
                    helperText="Minimum 6 characters."
                    required
                  />
                  <Input
                    label="Confirm New Password"
                    type="password"
                    showPasswordToggle
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    helperText="Re-type your new password to verify."
                    required
                  />
                </div>

                <div className="pt-2 flex justify-end">
                  <Button type="submit" disabled={passwordSaving} className="text-xs px-5">
                    {passwordSaving ? (
                      <span className="flex items-center gap-1.5">
                        <Loader2 className="w-3.5 h-3.5 animate-spin" /> Updating Password...
                      </span>
                    ) : (
                      'Update Password'
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </form>

          {/* Destructive Actions & Sign Out Card */}
          <Card className="border-rose-500/20 bg-rose-500/5">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-rose-600 dark:text-rose-400">Session Management</CardTitle>
                  <CardDescription>
                    End your active session on this device. Your historical progress is preserved securely in your account.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="text-xs text-[var(--color-text-secondary)]">
                Signing out clears active session tokens and returns you to the login screen.
              </div>
              <Button
                type="button"
                variant="danger"
                size="sm"
                onClick={() => setIsSignOutModalOpen(true)}
                className="shrink-0 text-xs"
              >
                <LogOut className="w-3.5 h-3.5 mr-1.5" /> Sign Out of FORM
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ======================================================================== */}
      {/* CONFIRMATION MODAL: DESTRUCTIVE SIGN OUT ACTION */}
      {/* ======================================================================== */}
      {isSignOutModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150"
          onClick={() => setIsSignOutModalOpen(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-2xl space-y-4 animate-in zoom-in-95 duration-150"
            role="dialog"
            aria-modal="true"
            aria-labelledby="signout-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
                <LogOut className="w-5 h-5" />
              </div>
              <div>
                <h3 id="signout-title" className="text-base font-bold text-[var(--color-text-primary)]">
                  Sign Out of FORM?
                </h3>
                <p className="text-xs text-[var(--color-text-muted)]">
                  Active session will be terminated.
                </p>
              </div>
            </div>

            <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">
              Are you sure you want to sign out on this browser? Your historical workouts, nutrition logs, and body weight entries are securely saved in your database profile.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsSignOutModalOpen(false)}
                disabled={isSigningOut}
                className="text-xs"
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="danger"
                size="sm"
                onClick={handleConfirmSignOut}
                disabled={isSigningOut}
                className="text-xs"
              >
                {isSigningOut ? 'Signing out...' : 'Confirm Sign Out'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
