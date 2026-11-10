/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react'
import { useAuth } from '@/features/auth'
import { useUnit } from '@/hooks/useUnit'
import type {
  Exercise,
  Routine,
  WorkoutSession,
  ActiveWorkoutSession,
  ActiveWorkoutSet,
  SetType,
  MuscleGroup,
  Equipment,
  ExerciseProgressMetric,
} from '@/types/workout'
import { workoutService } from '../services/workoutService'

export interface WorkoutContextType {
  exercises: Exercise[]
  routines: Routine[]
  sessions: WorkoutSession[]
  activeWorkout: ActiveWorkoutSession | null
  isLoading: boolean
  isLoggingActive: boolean
  refreshData: () => Promise<void>
  addCustomExercise: (payload: {
    name: string
    muscle_group: MuscleGroup
    equipment: Equipment
    instructions?: string | null
  }) => Promise<Exercise>
  deleteCustomExercise: (exerciseId: string) => Promise<boolean>
  saveRoutine: (
    routine: {
      id?: string
      name: string
      description?: string | null
      exercises: {
        exercise_id: string
        order_index: number
        target_sets: number
        target_reps: string
        rest_seconds: number
        notes?: string | null
      }[]
    }
  ) => Promise<Routine>
  deleteRoutine: (routineId: string) => Promise<boolean>
  startWorkout: (routine?: Routine | null, customName?: string) => void
  addExerciseToActiveWorkout: (exercise: Exercise) => void
  removeExerciseFromActiveWorkout: (activeExerciseId: string) => void
  addSetToExercise: (activeExerciseId: string) => void
  removeSetFromExercise: (activeExerciseId: string, setId: string) => void
  updateSet: (activeExerciseId: string, setId: string, updates: Partial<ActiveWorkoutSet>) => void
  toggleSetCompleted: (activeExerciseId: string, setId: string) => void
  finishActiveWorkout: () => Promise<WorkoutSession | null>
  discardActiveWorkout: () => void
  deleteSession: (sessionId: string) => Promise<boolean>
  getExerciseProgress: (exerciseId: string) => ExerciseProgressMetric | null
  // Rest timer
  restTimerRemaining: number
  isRestTimerActive: boolean
  startRestTimer: (seconds: number) => void
  pauseRestTimer: () => void
  resumeRestTimer: () => void
  stopRestTimer: () => void
  adjustRestTimer: (deltaSeconds: number) => void
}

const WorkoutContext = createContext<WorkoutContextType | undefined>(undefined)

const ACTIVE_WORKOUT_STORAGE_PREFIX = 'form_active_workout_'

export const WorkoutProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth()
  const userId = user?.id || null
  const { unitSystem, displayToKg } = useUnit()

  const [exercises, setExercises] = useState<Exercise[]>([])
  const [routines, setRoutines] = useState<Routine[]>([])
  const [sessions, setSessions] = useState<WorkoutSession[]>([])
  const [activeWorkout, setActiveWorkout] = useState<ActiveWorkoutSession | null>(() => {
    if (!userId) return null
    try {
      const saved = localStorage.getItem(`${ACTIVE_WORKOUT_STORAGE_PREFIX}${userId}`)
      return saved ? (JSON.parse(saved) as ActiveWorkoutSession) : null
    } catch {
      return null
    }
  })
  const [isLoading, setIsLoading] = useState<boolean>(true)

  // Sync active workout when authenticated userId changes during render
  const [prevUserId, setPrevUserId] = useState(userId)
  if (userId !== prevUserId) {
    setPrevUserId(userId)
    let restored: ActiveWorkoutSession | null = null
    if (userId) {
      try {
        const saved = localStorage.getItem(`${ACTIVE_WORKOUT_STORAGE_PREFIX}${userId}`)
        restored = saved ? (JSON.parse(saved) as ActiveWorkoutSession) : null
      } catch {
        restored = null
      }
    }
    setActiveWorkout(restored)
  }

  // Floating / active rest timer state
  const [restTimerRemaining, setRestTimerRemaining] = useState<number>(0)
  const [isRestTimerActive, setIsRestTimerActive] = useState<boolean>(false)

  // Persist Active Workout on state changes
  useEffect(() => {
    if (!userId) return

    if (activeWorkout) {
      try {
        localStorage.setItem(`${ACTIVE_WORKOUT_STORAGE_PREFIX}${userId}`, JSON.stringify(activeWorkout))
      } catch (e) {
        console.warn('[FORM Workout] Could not persist active workout:', e)
      }
    } else {
      localStorage.removeItem(`${ACTIVE_WORKOUT_STORAGE_PREFIX}${userId}`)
    }
  }, [activeWorkout, userId])

  // Countdown timer tick for rest periods
  useEffect(() => {
    if (!isRestTimerActive || restTimerRemaining <= 0) return

    const interval = setInterval(() => {
      setRestTimerRemaining((prev) => {
        if (prev <= 1) {
          setIsRestTimerActive(false)
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(interval)
  }, [isRestTimerActive, restTimerRemaining])

  const startRestTimer = useCallback((seconds: number) => {
    if (seconds <= 0) return
    setRestTimerRemaining(seconds)
    setIsRestTimerActive(true)
  }, [])

  const pauseRestTimer = useCallback(() => {
    setIsRestTimerActive(false)
  }, [])

  const resumeRestTimer = useCallback(() => {
    if (restTimerRemaining > 0) {
      setIsRestTimerActive(true)
    }
  }, [restTimerRemaining])

  const stopRestTimer = useCallback(() => {
    setIsRestTimerActive(false)
    setRestTimerRemaining(0)
  }, [])

  const adjustRestTimer = useCallback((deltaSeconds: number) => {
    setRestTimerRemaining((prev) => Math.max(0, prev + deltaSeconds))
  }, [])

  // Manual data reload trigger
  const refreshData = useCallback(async () => {
    setIsLoading(true)
    try {
      const exList = await workoutService.getExercises(userId)
      setExercises(exList)

      if (userId) {
        const [rList, sList] = await Promise.all([
          workoutService.getRoutines(userId, exList),
          workoutService.getWorkoutSessions(userId, exList),
        ])
        setRoutines(rList)
        setSessions(sList)
      } else {
        setRoutines([])
        setSessions([])
      }
    } finally {
      setIsLoading(false)
    }
  }, [userId])

  // Initial async data load
  useEffect(() => {
    let isMounted = true
    const load = async () => {
      try {
        const exList = await workoutService.getExercises(userId)
        if (!isMounted) return
        setExercises(exList)

        if (userId) {
          const [rList, sList] = await Promise.all([
            workoutService.getRoutines(userId, exList),
            workoutService.getWorkoutSessions(userId, exList),
          ])
          if (!isMounted) return
          setRoutines(rList)
          setSessions(sList)
        } else {
          setRoutines([])
          setSessions([])
        }
      } catch (err) {
        console.warn('[FORM Workout] Error initializing workout data:', err)
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    load()
    return () => {
      isMounted = false
    }
  }, [userId])

  // 5. Custom Exercise Actions
  const addCustomExercise = useCallback(
    async (payload: {
      name: string
      muscle_group: MuscleGroup
      equipment: Equipment
      instructions?: string | null
    }): Promise<Exercise> => {
      if (!userId) throw new Error('Must be authenticated to create exercises.')
      const created = await workoutService.createCustomExercise(userId, payload)
      setExercises((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)))
      return created
    },
    [userId]
  )

  const deleteCustomExercise = useCallback(
    async (exerciseId: string): Promise<boolean> => {
      if (!userId) return false
      const success = await workoutService.deleteCustomExercise(userId, exerciseId)
      if (success) {
        setExercises((prev) => prev.filter((e) => e.id !== exerciseId))
      }
      return success
    },
    [userId]
  )

  // 6. Routine Actions
  const saveRoutine = useCallback(
    async (routineData: {
      id?: string
      name: string
      description?: string | null
      exercises: {
        exercise_id: string
        order_index: number
        target_sets: number
        target_reps: string
        rest_seconds: number
        notes?: string | null
      }[]
    }): Promise<Routine> => {
      if (!userId) throw new Error('Must be authenticated to save routines.')
      const saved = await workoutService.saveRoutine(userId, routineData, exercises)
      setRoutines((prev) => {
        const exists = prev.some((r) => r.id === saved.id)
        if (exists) {
          return prev.map((r) => (r.id === saved.id ? saved : r))
        }
        return [saved, ...prev]
      })
      return saved
    },
    [userId, exercises]
  )

  const deleteRoutine = useCallback(
    async (routineId: string): Promise<boolean> => {
      if (!userId) return false
      const success = await workoutService.deleteRoutine(userId, routineId)
      if (success) {
        setRoutines((prev) => prev.filter((r) => r.id !== routineId))
      }
      return success
    },
    [userId]
  )

  // 7. Live Workout Tracker Actions
  const startWorkout = useCallback(
    (routine?: Routine | null, customName?: string) => {
      const sessionId = crypto.randomUUID ? crypto.randomUUID() : `session-${Date.now()}`
      const workoutName = customName || (routine ? routine.name : 'Quick Workout')

      const initialExercises =
        routine?.exercises?.map((re, idx) => {
          const setsCount = re.target_sets || 3
          const defaultSets: ActiveWorkoutSet[] = Array.from({ length: setsCount }).map((_, sIdx) => ({
            id: `set-${Date.now()}-${idx}-${sIdx}`,
            set_number: sIdx + 1,
            weight_kg: '',
            reps: '',
            is_completed: false,
            set_type: 'normal' as SetType,
          }))

          return {
            id: `act-ex-${Date.now()}-${idx}`,
            exercise: re.exercise!,
            sets: defaultSets,
            rest_seconds: re.rest_seconds || 90,
            notes: re.notes || undefined,
          }
        }) || []

      const newActive: ActiveWorkoutSession = {
        id: sessionId,
        routineId: routine?.id || null,
        name: workoutName,
        startedAt: new Date().toISOString(),
        exercises: initialExercises,
        notes: '',
      }

      setActiveWorkout(newActive)
    },
    []
  )

  const addExerciseToActiveWorkout = useCallback((exercise: Exercise) => {
    setActiveWorkout((prev) => {
      if (!prev) return prev
      const newActiveExercise = {
        id: `act-ex-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        exercise,
        sets: [
          {
            id: `set-${Date.now()}-1`,
            set_number: 1,
            weight_kg: '',
            reps: '',
            is_completed: false,
            set_type: 'normal' as SetType,
          },
        ],
        rest_seconds: 90,
      }
      return {
        ...prev,
        exercises: [...prev.exercises, newActiveExercise],
      }
    })
  }, [])

  const removeExerciseFromActiveWorkout = useCallback((activeExerciseId: string) => {
    setActiveWorkout((prev) => {
      if (!prev) return prev
      return {
        ...prev,
        exercises: prev.exercises.filter((ex) => ex.id !== activeExerciseId),
      }
    })
  }, [])

  const addSetToExercise = useCallback((activeExerciseId: string) => {
    setActiveWorkout((prev) => {
      if (!prev) return prev
      const updatedExercises = prev.exercises.map((ex) => {
        if (ex.id !== activeExerciseId) return ex

        const nextNum = ex.sets.length + 1
        const lastSet = ex.sets[ex.sets.length - 1]
        const newSet: ActiveWorkoutSet = {
          id: `set-${Date.now()}-${nextNum}`,
          set_number: nextNum,
          weight_kg: lastSet ? lastSet.weight_kg : '',
          reps: lastSet ? lastSet.reps : '',
          is_completed: false,
          set_type: 'normal',
        }

        return {
          ...ex,
          sets: [...ex.sets, newSet],
        }
      })

      return {
        ...prev,
        exercises: updatedExercises,
      }
    })
  }, [])

  const removeSetFromExercise = useCallback((activeExerciseId: string, setId: string) => {
    setActiveWorkout((prev) => {
      if (!prev) return prev
      const updatedExercises = prev.exercises.map((ex) => {
        if (ex.id !== activeExerciseId) return ex

        const remaining = ex.sets.filter((s) => s.id !== setId)
        // Renumber sets
        const renumbered = remaining.map((s, idx) => ({
          ...s,
          set_number: idx + 1,
        }))

        return {
          ...ex,
          sets: renumbered,
        }
      })

      return {
        ...prev,
        exercises: updatedExercises,
      }
    })
  }, [])

  const updateSet = useCallback((activeExerciseId: string, setId: string, updates: Partial<ActiveWorkoutSet>) => {
    setActiveWorkout((prev) => {
      if (!prev) return prev
      const updatedExercises = prev.exercises.map((ex) => {
        if (ex.id !== activeExerciseId) return ex

        return {
          ...ex,
          sets: ex.sets.map((s) => (s.id === setId ? { ...s, ...updates } : s)),
        }
      })

      return {
        ...prev,
        exercises: updatedExercises,
      }
    })
  }, [])

  const toggleSetCompleted = useCallback(
    (activeExerciseId: string, setId: string) => {
      setActiveWorkout((prev) => {
        if (!prev) return prev

        let targetRest = 90
        let willBeCompleted = false

        const updatedExercises = prev.exercises.map((ex) => {
          if (ex.id !== activeExerciseId) return ex
          targetRest = ex.rest_seconds || 90

          return {
            ...ex,
            sets: ex.sets.map((s) => {
              if (s.id === setId) {
                willBeCompleted = !s.is_completed
                return { ...s, is_completed: willBeCompleted }
              }
              return s
            }),
          }
        })

        // If newly completed, trigger rest timer
        if (willBeCompleted && targetRest > 0) {
          startRestTimer(targetRest)
        }

        return {
          ...prev,
          exercises: updatedExercises,
        }
      })
    },
    [startRestTimer]
  )

  const finishActiveWorkout = useCallback(async (): Promise<WorkoutSession | null> => {
    if (!activeWorkout || !userId) return null

    const completedAt = new Date().toISOString()
    const startMs = new Date(activeWorkout.startedAt).getTime()
    const endMs = new Date(completedAt).getTime()
    const durationSeconds = Math.max(0, Math.round((endMs - startMs) / 1000))

    // Flatten completed sets
    const setsToSave: {
      exercise_id: string
      set_number: number
      weight_kg: number
      reps: number
      is_completed: boolean
      set_type: SetType
      rpe?: number | null
    }[] = []

    let totalVolumeKg = 0

    activeWorkout.exercises.forEach((activeEx) => {
      activeEx.sets.forEach((st) => {
        const rawWeight = typeof st.weight_kg === 'number' ? st.weight_kg : parseFloat(st.weight_kg) || 0
        const reps = typeof st.reps === 'number' ? st.reps : parseInt(st.reps, 10) || 0

        // In imperial mode, user logs sets in pounds. Convert back to canonical kg for database persistence.
        const weightKg = unitSystem === 'imperial' && rawWeight > 0 ? displayToKg(rawWeight) : rawWeight

        // Only count volume for completed sets with positive load & reps
        if (st.is_completed && weightKg > 0 && reps > 0) {
          totalVolumeKg += weightKg * reps
        }

        setsToSave.push({
          exercise_id: activeEx.exercise.id,
          set_number: st.set_number,
          weight_kg: weightKg,
          reps: reps,
          is_completed: st.is_completed,
          set_type: st.set_type,
          rpe: st.rpe ?? null,
        })
      })
    })

    const savedSession = await workoutService.saveCompletedWorkout(
      userId,
      {
        id: activeWorkout.id,
        name: activeWorkout.name,
        routine_id: activeWorkout.routineId || null,
        started_at: activeWorkout.startedAt,
        completed_at: completedAt,
        duration_seconds: durationSeconds,
        total_volume_kg: totalVolumeKg,
        notes: activeWorkout.notes || null,
      },
      setsToSave,
      exercises
    )

    // Clear active session
    setActiveWorkout(null)
    stopRestTimer()

    // Add to session history idempotently
    setSessions((prev) => [savedSession, ...prev.filter((s) => s.id !== savedSession.id)])
    return savedSession
  }, [activeWorkout, userId, exercises, stopRestTimer, unitSystem, displayToKg])

  const discardActiveWorkout = useCallback(() => {
    setActiveWorkout(null)
    stopRestTimer()
  }, [stopRestTimer])

  const deleteSession = useCallback(
    async (sessionId: string): Promise<boolean> => {
      if (!userId) return false
      const success = await workoutService.deleteWorkoutSession(userId, sessionId)
      if (success) {
        setSessions((prev) => prev.filter((s) => s.id !== sessionId))
      }
      return success
    },
    [userId]
  )

  // 8. Exercise Progress & PR Aggregations
  const getExerciseProgress = useCallback(
    (exerciseId: string): ExerciseProgressMetric | null => {
      const targetEx = exercises.find((e) => e.id === exerciseId)
      if (!targetEx) return null

      // Filter sessions containing sets for this exercise
      const sessionHistory: ExerciseProgressMetric['history'] = []
      let overallMaxWeight = 0
      let overallEstimated1Rm = 0
      let overallMaxSessionVolume = 0
      let totalSetsCount = 0
      let lastDate: string | null = null

      // Sort sessions chronologically (oldest to newest for progression graphs)
      const sortedSessions = [...sessions].sort(
        (a, b) => new Date(a.completed_at || a.started_at).getTime() - new Date(b.completed_at || b.started_at).getTime()
      )

      sortedSessions.forEach((sess) => {
        const matchingSets = (sess.sets || []).filter(
          (s) => s.exercise_id === exerciseId && s.is_completed && s.reps > 0
        )

        if (matchingSets.length === 0) return

        let sessionVolume = 0
        let topSetWeight = 0
        let topSetReps = 0
        let sessionEstimated1Rm = 0

        matchingSets.forEach((s) => {
          totalSetsCount++
          const w = s.weight_kg || 0
          const r = s.reps || 0
          const vol = w * r
          sessionVolume += vol

          // Calculate estimated 1RM using Epley formula: weight * (1 + reps / 30)
          const est1Rm = r > 1 ? w * (1 + r / 30) : w

          if (w > topSetWeight) {
            topSetWeight = w
            topSetReps = r
          }

          if (est1Rm > sessionEstimated1Rm) {
            sessionEstimated1Rm = est1Rm
          }

          if (w > overallMaxWeight) {
            overallMaxWeight = w
          }

          if (est1Rm > overallEstimated1Rm) {
            overallEstimated1Rm = est1Rm
          }
        })

        if (sessionVolume > overallMaxSessionVolume) {
          overallMaxSessionVolume = sessionVolume
        }

        const dateStr = sess.completed_at || sess.started_at
        lastDate = dateStr

        sessionHistory.push({
          sessionId: sess.id,
          sessionDate: dateStr,
          sessionName: sess.name,
          topSetWeightKg: topSetWeight,
          topSetReps: topSetReps,
          estimated1RmKg: Math.round(sessionEstimated1Rm * 10) / 10,
          totalVolumeKg: sessionVolume,
          sets: matchingSets,
        })
      })

      return {
        exerciseId,
        exerciseName: targetEx.name,
        muscleGroup: targetEx.muscle_group,
        maxWeightKg: overallMaxWeight,
        estimated1RmKg: Math.round(overallEstimated1Rm * 10) / 10,
        maxVolumeSessionKg: overallMaxSessionVolume,
        totalSetsLogged: totalSetsCount,
        lastPerformedAt: lastDate,
        history: sessionHistory,
      }
    },
    [exercises, sessions]
  )

  const value = useMemo(
    () => ({
      exercises,
      routines,
      sessions,
      activeWorkout,
      isLoading,
      isLoggingActive: Boolean(activeWorkout),
      refreshData,
      addCustomExercise,
      deleteCustomExercise,
      saveRoutine,
      deleteRoutine,
      startWorkout,
      addExerciseToActiveWorkout,
      removeExerciseFromActiveWorkout,
      addSetToExercise,
      removeSetFromExercise,
      updateSet,
      toggleSetCompleted,
      finishActiveWorkout,
      discardActiveWorkout,
      deleteSession,
      getExerciseProgress,
      restTimerRemaining,
      isRestTimerActive,
      startRestTimer,
      pauseRestTimer,
      resumeRestTimer,
      stopRestTimer,
      adjustRestTimer,
    }),
    [
      exercises,
      routines,
      sessions,
      activeWorkout,
      isLoading,
      refreshData,
      addCustomExercise,
      deleteCustomExercise,
      saveRoutine,
      deleteRoutine,
      startWorkout,
      addExerciseToActiveWorkout,
      removeExerciseFromActiveWorkout,
      addSetToExercise,
      removeSetFromExercise,
      updateSet,
      toggleSetCompleted,
      finishActiveWorkout,
      discardActiveWorkout,
      deleteSession,
      getExerciseProgress,
      restTimerRemaining,
      isRestTimerActive,
      startRestTimer,
      pauseRestTimer,
      resumeRestTimer,
      stopRestTimer,
      adjustRestTimer,
    ]
  )

  return <WorkoutContext.Provider value={value}>{children}</WorkoutContext.Provider>
}

export function useWorkout(): WorkoutContextType {
  const context = useContext(WorkoutContext)
  if (!context) {
    throw new Error('useWorkout must be used within a WorkoutProvider')
  }
  return context
}
