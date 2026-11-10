import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Flame, LogOut } from 'lucide-react'
import { ThemeToggle } from '@/components/ui/ThemeToggle'
import { useAuth } from '@/features/auth'
import { StepIndicator } from './components/StepIndicator'
import { StepWelcome } from './components/StepWelcome'
import { StepBodyStats, type BodyStatsData } from './components/StepBodyStats'
import { StepGoal } from './components/StepGoal'
import { StepActivity } from './components/StepActivity'
import { StepTargets } from './components/StepTargets'
import {
  calculateNutritionTargets,
  type FitnessGoal,
  type ActivityLevel,
  type CalorieSex,
} from '@/utils/nutritionCalculations'

const STEP_LABELS = ['Welcome', 'Body Stats', 'Goal', 'Activity', 'Targets']

export const OnboardingPage: React.FC = () => {
  const { profile, user, updateProfile, signOut } = useAuth()
  const navigate = useNavigate()

  // Current wizard step (1 to 5)
  const [currentStep, setCurrentStep] = useState<number>(1)

  // Step 1: Display Name
  const [displayName, setDisplayName] = useState<string>(() => {
    return (
      profile?.display_name ||
      (user?.user_metadata?.display_name as string) ||
      (user?.email ? user.email.split('@')[0] : 'Athlete')
    )
  })
  const [step1Error, setStep1Error] = useState<string | undefined>(undefined)

  // Step 2: Body Stats
  const [bodyStats, setBodyStats] = useState<BodyStatsData>(() => ({
    age: profile?.age_years?.toString() || '26',
    sex: (profile?.sex_for_calorie_formula as CalorieSex) || 'male',
    height: profile?.height_cm?.toString() || '178',
    currentWeight: profile?.current_weight_kg?.toString() || '75',
    goalWeight: profile?.goal_weight_kg?.toString() || '72',
  }))
  const [step2Errors, setStep2Errors] = useState<Record<string, string>>({})

  // Step 3: Fitness Goal
  const [goal, setGoal] = useState<FitnessGoal>(() => {
    const existing = profile?.fitness_goal as FitnessGoal | undefined
    return existing === 'muscle_gain' || existing === 'fat_loss' || existing === 'maintenance'
      ? existing
      : 'fat_loss'
  })

  // Step 4: Activity Level
  const [activityLevel, setActivityLevel] = useState<ActivityLevel>(() => {
    const existing = profile?.activity_level as ActivityLevel | undefined
    return existing === 'sedentary' ||
      existing === 'lightly_active' ||
      existing === 'moderately_active' ||
      existing === 'very_active'
      ? existing
      : 'moderately_active'
  })

  // Step 5: Submission & Save state
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [isSuccess, setIsSuccess] = useState(false)

  // Handlers for Step 1
  const handleNextStep1 = () => {
    if (!displayName.trim()) {
      setStep1Error('Please enter your preferred athlete display name.')
      return
    }
    setStep1Error(undefined)
    setCurrentStep(2)
  }

  // Handlers for Step 2
  const handleBodyStatsChange = (field: keyof BodyStatsData, value: string | CalorieSex) => {
    setBodyStats((prev) => ({ ...prev, [field]: value }))
    if (step2Errors[field]) {
      setStep2Errors((prev) => {
        const next = { ...prev }
        delete next[field]
        return next
      })
    }
  }

  const handleNextStep2 = () => {
    const errors: Record<string, string> = {}
    const ageNum = parseInt(bodyStats.age, 10)
    const heightNum = parseFloat(bodyStats.height)
    const currentWeightNum = parseFloat(bodyStats.currentWeight)
    const goalWeightNum = parseFloat(bodyStats.goalWeight)

    if (isNaN(ageNum) || ageNum < 12 || ageNum > 120) {
      errors.age = 'Please enter a valid age between 12 and 120.'
    }
    if (isNaN(heightNum) || heightNum < 60 || heightNum > 260) {
      errors.height = 'Please enter a valid height between 60 and 260 cm.'
    }
    if (isNaN(currentWeightNum) || currentWeightNum < 25 || currentWeightNum > 350) {
      errors.currentWeight = 'Please enter a valid current weight between 25 and 350 kg.'
    }
    if (isNaN(goalWeightNum) || goalWeightNum < 25 || goalWeightNum > 350) {
      errors.goalWeight = 'Please enter a valid target weight between 25 and 350 kg.'
    }

    if (Object.keys(errors).length > 0) {
      setStep2Errors(errors)
      return
    }

    setStep2Errors({})
    setCurrentStep(3)
  }

  // Computed Nutrition Targets for Step 5
  const currentTargets = calculateNutritionTargets({
    weightKg: parseFloat(bodyStats.currentWeight) || 75,
    heightCm: parseFloat(bodyStats.height) || 178,
    ageYears: parseInt(bodyStats.age, 10) || 26,
    sex: bodyStats.sex,
    goal,
    activityLevel,
  })

  // Final Confirmation & Save Handler
  const handleConfirmAndSave = async () => {
    setIsSubmitting(true)
    setSubmitError(null)

    try {
      const payload = {
        display_name: displayName.trim(),
        age_years: parseInt(bodyStats.age, 10),
        sex_for_calorie_formula: bodyStats.sex,
        height_cm: parseFloat(bodyStats.height),
        current_weight_kg: parseFloat(bodyStats.currentWeight),
        goal_weight_kg: parseFloat(bodyStats.goalWeight),
        fitness_goal: goal,
        activity_level: activityLevel,
        daily_calorie_target: currentTargets.dailyCalorieTarget,
        protein_target_g: currentTargets.proteinG,
        carbs_target_g: currentTargets.carbsG,
        fat_target_g: currentTargets.fatG,
        onboarding_completed: true,
      }

      const { error } = await updateProfile(payload)

      if (error) {
        setSubmitError(error.message || 'Failed to save onboarding protocol. Please try again.')
        setIsSubmitting(false)
        return
      }

      // Success
      setIsSuccess(true)
      setTimeout(() => {
        navigate('/', { replace: true })
      }, 750)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'An unexpected error occurred while saving.'
      setSubmitError(msg)
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col justify-between bg-[var(--color-bg)] text-[var(--color-text-primary)] transition-colors">
      {/* Top Header */}
      <header className="w-full max-w-5xl mx-auto px-6 py-5 flex items-center justify-between border-b border-[var(--color-border)]">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-[var(--color-accent)] flex items-center justify-center text-white font-bold text-sm shadow-xs">
            <Flame className="w-4 h-4 fill-current" />
          </div>
          <div>
            <span className="font-extrabold tracking-wider text-base text-[var(--color-text-primary)] block">
              FORM
            </span>
            <span className="block text-[9px] uppercase tracking-widest text-[var(--color-text-muted)] font-semibold -mt-1">
              Precision Onboarding
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <ThemeToggle />
          <button
            type="button"
            onClick={() => signOut()}
            className="p-1.5 rounded-lg text-[var(--color-text-muted)] hover:text-red-500 hover:bg-red-500/10 transition-colors cursor-pointer"
            title="Sign Out"
            aria-label="Sign Out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Main Wizard Container */}
      <main className="w-full max-w-2xl mx-auto px-4 sm:px-6 py-8 flex-1 flex flex-col justify-center">
        <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl shadow-xl p-6 sm:p-8 space-y-8 backdrop-blur-md">
          {/* Step Progress Bar */}
          <StepIndicator
            currentStep={currentStep}
            totalSteps={5}
            stepLabels={STEP_LABELS}
            onStepClick={(step) => {
              if (step < currentStep) setCurrentStep(step)
            }}
          />

          {/* Step 1: Welcome & Display Name */}
          {currentStep === 1 && (
            <StepWelcome
              displayName={displayName}
              onChangeDisplayName={setDisplayName}
              onNext={handleNextStep1}
              error={step1Error}
            />
          )}

          {/* Step 2: Body Stats */}
          {currentStep === 2 && (
            <StepBodyStats
              data={bodyStats}
              onChange={handleBodyStatsChange}
              onNext={handleNextStep2}
              onBack={() => setCurrentStep(1)}
              errors={step2Errors}
            />
          )}

          {/* Step 3: Fitness Goal */}
          {currentStep === 3 && (
            <StepGoal
              goal={goal}
              onChangeGoal={setGoal}
              onNext={() => setCurrentStep(4)}
              onBack={() => setCurrentStep(2)}
            />
          )}

          {/* Step 4: Activity Level */}
          {currentStep === 4 && (
            <StepActivity
              activityLevel={activityLevel}
              onChangeActivityLevel={setActivityLevel}
              onNext={() => setCurrentStep(5)}
              onBack={() => setCurrentStep(3)}
            />
          )}

          {/* Step 5: Targets & Confirmation */}
          {currentStep === 5 && (
            <StepTargets
              targets={currentTargets}
              inputs={{
                displayName,
                age: bodyStats.age,
                sex: bodyStats.sex,
                height: bodyStats.height,
                currentWeight: bodyStats.currentWeight,
                goalWeight: bodyStats.goalWeight,
                goal,
                activityLevel,
              }}
              onEditStep={(step) => setCurrentStep(step)}
              onBack={() => setCurrentStep(4)}
              onConfirm={handleConfirmAndSave}
              isSubmitting={isSubmitting}
              error={submitError}
              isSuccess={isSuccess}
            />
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full py-4 text-center text-[11px] text-[var(--color-text-muted)]">
        &copy; {new Date().getFullYear()} FORM Precision Athletics. Evidence-based fitness protocol.
      </footer>
    </div>
  )
}
