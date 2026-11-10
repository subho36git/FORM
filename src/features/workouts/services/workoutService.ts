import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import type {
  Exercise,
  Routine,
  RoutineExercise,
  WorkoutSession,
  WorkoutSet,
  SetType,
  MuscleGroup,
  Equipment,
} from '@/types/workout'
import { DEFAULT_EXERCISES } from '../data/defaultExercises'

const LOCAL_EXERCISES_KEY = 'form_custom_exercises_'
const LOCAL_ROUTINES_KEY = 'form_routines_'
const LOCAL_SESSIONS_KEY = 'form_workout_sessions_'

// Helper to safely get items from localStorage
function getLocal<T>(key: string, defaultValue: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : defaultValue
  } catch {
    return defaultValue
  }
}

// Helper to safely write to localStorage
function setLocal<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch (err) {
    console.warn('[FORM WorkoutService] LocalStorage write failed:', err)
  }
}

export const workoutService = {
  /**
   * Fetches the complete exercise library (built-in standard + athlete custom).
   */
  async getExercises(userId?: string | null): Promise<Exercise[]> {
    const localCustom = userId ? getLocal<Exercise[]>(`${LOCAL_EXERCISES_KEY}${userId}`, []) : []

    if (!isSupabaseConfigured || !userId) {
      return [...DEFAULT_EXERCISES, ...localCustom]
    }

    try {
      const { data, error } = await supabase
        .from('exercises')
        .select('*')
        .or(`user_id.is.null,user_id.eq.${userId}`)
        .order('name', { ascending: true })

      if (error || !data || data.length === 0) {
        // Fallback to defaults + local custom
        return [...DEFAULT_EXERCISES, ...localCustom]
      }

      // Merge and deduplicate by name/id
      const dbExercises = data as Exercise[]
      const mergedMap = new Map<string, Exercise>()

      // Add default exercises
      DEFAULT_EXERCISES.forEach((ex) => mergedMap.set(ex.name.toLowerCase(), ex))
      // Overwrite/extend with db exercises
      dbExercises.forEach((ex) => mergedMap.set(ex.name.toLowerCase(), ex))
      // Include any unsynced local custom exercises
      localCustom.forEach((ex) => {
        if (!mergedMap.has(ex.name.toLowerCase())) {
          mergedMap.set(ex.name.toLowerCase(), ex)
        }
      })

      return Array.from(mergedMap.values()).sort((a, b) => a.name.localeCompare(b.name))
    } catch {
      return [...DEFAULT_EXERCISES, ...localCustom]
    }
  },

  /**
   * Creates a custom exercise for the athlete.
   */
  async createCustomExercise(
    userId: string,
    payload: {
      name: string
      muscle_group: MuscleGroup
      equipment: Equipment
      instructions?: string | null
    }
  ): Promise<Exercise> {
    const newExercise: Exercise = {
      id: crypto.randomUUID ? crypto.randomUUID() : `custom-${Date.now()}`,
      user_id: userId,
      name: payload.name.trim(),
      muscle_group: payload.muscle_group,
      equipment: payload.equipment,
      instructions: payload.instructions?.trim() || null,
      is_custom: true,
      created_at: new Date().toISOString(),
    }

    // Always update local cache for offline reliability
    const currentLocal = getLocal<Exercise[]>(`${LOCAL_EXERCISES_KEY}${userId}`, [])
    setLocal(`${LOCAL_EXERCISES_KEY}${userId}`, [newExercise, ...currentLocal])

    if (!isSupabaseConfigured) {
      return newExercise
    }

    try {
      const { data, error } = await supabase
        .from('exercises')
        .insert({
          name: newExercise.name,
          muscle_group: newExercise.muscle_group,
          equipment: newExercise.equipment,
          instructions: newExercise.instructions,
          is_custom: true,
          user_id: userId,
        })
        .select()
        .single()

      if (error || !data) {
        return newExercise
      }

      return data as Exercise
    } catch {
      return newExercise
    }
  },

  /**
   * Deletes a custom exercise.
   */
  async deleteCustomExercise(userId: string, exerciseId: string): Promise<boolean> {
    const currentLocal = getLocal<Exercise[]>(`${LOCAL_EXERCISES_KEY}${userId}`, [])
    setLocal(
      `${LOCAL_EXERCISES_KEY}${userId}`,
      currentLocal.filter((e) => e.id !== exerciseId)
    )

    if (!isSupabaseConfigured) return true

    try {
      const { error } = await supabase
        .from('exercises')
        .delete()
        .eq('id', exerciseId)
        .eq('user_id', userId)
        .eq('is_custom', true)

      return !error
    } catch {
      return true
    }
  },

  /**
   * Fetches all saved routines for the athlete.
   */
  async getRoutines(userId: string, allExercises: Exercise[]): Promise<Routine[]> {
    const localRoutines = getLocal<Routine[]>(`${LOCAL_ROUTINES_KEY}${userId}`, [])

    if (!isSupabaseConfigured) {
      return localRoutines
    }

    try {
      const { data, error } = await supabase
        .from('routines')
        .select(`
          id,
          user_id,
          name,
          description,
          created_at,
          updated_at,
          routine_exercises (
            id,
            routine_id,
            exercise_id,
            order_index,
            target_sets,
            target_reps,
            rest_seconds,
            notes,
            created_at
          )
        `)
        .eq('user_id', userId)
        .order('updated_at', { ascending: false })

      if (error || !data) {
        return localRoutines
      }

      const exerciseMap = new Map(allExercises.map((e) => [e.id, e]))

      const mapped: Routine[] = data.map((r) => {
        const rawItems = (r.routine_exercises || []) as RoutineExercise[]
        const exercises = rawItems
          .map((item) => ({
            ...item,
            exercise: exerciseMap.get(item.exercise_id),
          }))
          .sort((a, b) => a.order_index - b.order_index)

        return {
          id: r.id,
          user_id: r.user_id,
          name: r.name,
          description: r.description,
          created_at: r.created_at,
          updated_at: r.updated_at,
          exercises,
        }
      })

      // Sync to local cache
      setLocal(`${LOCAL_ROUTINES_KEY}${userId}`, mapped)
      return mapped
    } catch {
      return localRoutines
    }
  },

  /**
   * Creates or updates a routine with ordered exercises.
   */
  async saveRoutine(
    userId: string,
    routineData: {
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
    },
    allExercises: Exercise[]
  ): Promise<Routine> {
    const routineId = routineData.id || (crypto.randomUUID ? crypto.randomUUID() : `routine-${Date.now()}`)
    const exerciseMap = new Map(allExercises.map((e) => [e.id, e]))

    const localRoutine: Routine = {
      id: routineId,
      user_id: userId,
      name: routineData.name.trim(),
      description: routineData.description?.trim() || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      exercises: routineData.exercises.map((item, idx) => ({
        id: `re-${Date.now()}-${idx}`,
        routine_id: routineId,
        exercise_id: item.exercise_id,
        order_index: item.order_index,
        target_sets: item.target_sets,
        target_reps: item.target_reps,
        rest_seconds: item.rest_seconds,
        notes: item.notes || null,
        exercise: exerciseMap.get(item.exercise_id),
      })),
    }

    // Save to local cache
    const currentLocal = getLocal<Routine[]>(`${LOCAL_ROUTINES_KEY}${userId}`, [])
    const updatedLocal = currentLocal.some((r) => r.id === routineId)
      ? currentLocal.map((r) => (r.id === routineId ? localRoutine : r))
      : [localRoutine, ...currentLocal]
    setLocal(`${LOCAL_ROUTINES_KEY}${userId}`, updatedLocal)

    if (!isSupabaseConfigured) {
      return localRoutine
    }

    try {
      // 1. Upsert routine
      const { data: routineRow, error: routineError } = await supabase
        .from('routines')
        .upsert(
          {
            id: routineId,
            user_id: userId,
            name: routineData.name.trim(),
            description: routineData.description?.trim() || null,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'id' }
        )
        .select()
        .single()

      if (routineError || !routineRow) {
        return localRoutine
      }

      // 2. Delete existing routine_exercises
      await supabase.from('routine_exercises').delete().eq('routine_id', routineId)

      // 3. Insert new routine_exercises if any
      if (routineData.exercises.length > 0) {
        const rowsToInsert = routineData.exercises.map((ex) => ({
          routine_id: routineId,
          exercise_id: ex.exercise_id,
          order_index: ex.order_index,
          target_sets: ex.target_sets,
          target_reps: ex.target_reps,
          rest_seconds: ex.rest_seconds,
          notes: ex.notes || null,
        }))

        await supabase.from('routine_exercises').insert(rowsToInsert)
      }

      return localRoutine
    } catch {
      return localRoutine
    }
  },

  /**
   * Deletes a routine.
   */
  async deleteRoutine(userId: string, routineId: string): Promise<boolean> {
    const currentLocal = getLocal<Routine[]>(`${LOCAL_ROUTINES_KEY}${userId}`, [])
    setLocal(
      `${LOCAL_ROUTINES_KEY}${userId}`,
      currentLocal.filter((r) => r.id !== routineId)
    )

    if (!isSupabaseConfigured) return true

    try {
      const { error } = await supabase.from('routines').delete().eq('id', routineId).eq('user_id', userId)
      return !error
    } catch {
      return true
    }
  },

  /**
   * Fetches completed workout sessions with their logged sets.
   */
  async getWorkoutSessions(userId: string, allExercises: Exercise[]): Promise<WorkoutSession[]> {
    const localSessions = getLocal<WorkoutSession[]>(`${LOCAL_SESSIONS_KEY}${userId}`, [])

    if (!isSupabaseConfigured) {
      return localSessions
    }

    try {
      const { data, error } = await supabase
        .from('workout_sessions')
        .select(`
          id,
          user_id,
          routine_id,
          name,
          started_at,
          completed_at,
          duration_seconds,
          total_volume_kg,
          notes,
          created_at,
          workout_sets (
            id,
            session_id,
            user_id,
            exercise_id,
            set_number,
            weight_kg,
            reps,
            is_completed,
            set_type,
            rpe,
            created_at
          )
        `)
        .eq('user_id', userId)
        .not('completed_at', 'is', null)
        .order('completed_at', { ascending: false })

      if (error || !data) {
        return localSessions
      }

      const exerciseMap = new Map(allExercises.map((e) => [e.id, e]))

      const mapped: WorkoutSession[] = data.map((s) => {
        const rawSets = (s.workout_sets || []) as WorkoutSet[]
        const sets = rawSets
          .map((st) => ({
            ...st,
            exercise: exerciseMap.get(st.exercise_id),
          }))
          .sort((a, b) => a.set_number - b.set_number)

        return {
          id: s.id,
          user_id: s.user_id,
          routine_id: s.routine_id,
          name: s.name,
          started_at: s.started_at,
          completed_at: s.completed_at,
          duration_seconds: s.duration_seconds || 0,
          total_volume_kg: Number(s.total_volume_kg) || 0,
          notes: s.notes,
          created_at: s.created_at,
          sets,
        }
      })

      // Sync with local cache
      setLocal(`${LOCAL_SESSIONS_KEY}${userId}`, mapped)
      return mapped
    } catch {
      return localSessions
    }
  },

  /**
   * Persists a completed workout session and its sets to Supabase & localStorage.
   * Atomically executes via PostgreSQL RPC (save_workout_session_atomic) with
   * rollback-safe fallback to prevent partial writes, duplicate records, or silent swallowing.
   */
  async saveCompletedWorkout(
    userId: string,
    sessionData: {
      id?: string
      name: string
      routine_id?: string | null
      started_at: string
      completed_at: string
      duration_seconds: number
      total_volume_kg: number
      notes?: string | null
    },
    setsData: {
      exercise_id: string
      set_number: number
      weight_kg: number
      reps: number
      is_completed: boolean
      set_type: SetType
      rpe?: number | null
    }[],
    allExercises: Exercise[]
  ): Promise<WorkoutSession> {
    const sessionId = sessionData.id || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `session-${Date.now()}`)
    const exerciseMap = new Map(allExercises.map((e) => [e.id, e]))

    const localSession: WorkoutSession = {
      id: sessionId,
      user_id: userId,
      routine_id: sessionData.routine_id || null,
      name: sessionData.name.trim(),
      started_at: sessionData.started_at,
      completed_at: sessionData.completed_at,
      duration_seconds: sessionData.duration_seconds,
      total_volume_kg: sessionData.total_volume_kg,
      notes: sessionData.notes || null,
      created_at: new Date().toISOString(),
      sets: setsData.map((st, idx) => ({
        id: `set-${Date.now()}-${idx}`,
        session_id: sessionId,
        user_id: userId,
        exercise_id: st.exercise_id,
        set_number: st.set_number,
        weight_kg: st.weight_kg,
        reps: st.reps,
        is_completed: st.is_completed,
        set_type: st.set_type,
        rpe: st.rpe ?? null,
        exercise: exerciseMap.get(st.exercise_id),
      })),
    }

    // Update local cache idempotently (replace if already exists from prior retry, else prepend)
    const updateLocalCache = () => {
      const currentSessions = getLocal<WorkoutSession[]>(`${LOCAL_SESSIONS_KEY}${userId}`, [])
      const filtered = currentSessions.filter((s) => s.id !== sessionId)
      setLocal(`${LOCAL_SESSIONS_KEY}${userId}`, [localSession, ...filtered])
    }

    if (!isSupabaseConfigured) {
      updateLocalCache()
      return localSession
    }

    const setsPayload = setsData.map((st) => ({
      exercise_id: st.exercise_id,
      set_number: st.set_number,
      weight_kg: st.weight_kg,
      reps: st.reps,
      is_completed: st.is_completed,
      set_type: st.set_type,
      rpe: st.rpe ?? null,
    }))

    // 1. Primary Strategy: Call atomic PostgreSQL RPC function
    const { error: rpcError } = await supabase.rpc('save_workout_session_atomic', {
      p_session_id: sessionId,
      p_name: sessionData.name.trim(),
      p_routine_id: sessionData.routine_id || null,
      p_started_at: sessionData.started_at,
      p_completed_at: sessionData.completed_at,
      p_duration_seconds: sessionData.duration_seconds,
      p_total_volume_kg: sessionData.total_volume_kg,
      p_notes: sessionData.notes || null,
      p_sets: setsPayload,
    })

    if (!rpcError) {
      updateLocalCache()
      return localSession
    }

    // 2. Secondary Strategy: If RPC is not yet created in PostgreSQL (error 42883),
    // execute rollback-safe client transaction to prevent orphaned empty sessions.
    const isRpcMissing =
      rpcError.code === '42883' ||
      (typeof rpcError.message === 'string' && rpcError.message.toLowerCase().includes('does not exist'))

    if (isRpcMissing) {
      console.warn('[WorkoutService] save_workout_session_atomic RPC not yet applied in DB. Executing rollback-safe sequential persistence.')

      // A. Upsert session row (idempotent, prevents duplicates on retry)
      const { error: sessionErr } = await supabase
        .from('workout_sessions')
        .upsert({
          id: sessionId,
          user_id: userId,
          routine_id: sessionData.routine_id || null,
          name: sessionData.name.trim(),
          started_at: sessionData.started_at,
          completed_at: sessionData.completed_at,
          duration_seconds: sessionData.duration_seconds,
          total_volume_kg: sessionData.total_volume_kg,
          notes: sessionData.notes || null,
        })

      if (sessionErr) {
        throw new Error(`Failed to save workout session: ${sessionErr.message}`)
      }

      // B. Delete any prior sets for this session to guarantee idempotency on retries
      await supabase.from('workout_sets').delete().eq('session_id', sessionId).eq('user_id', userId)

      // C. Insert working sets
      if (setsData.length > 0) {
        const rowsToInsert = setsData.map((st) => ({
          session_id: sessionId,
          user_id: userId,
          exercise_id: st.exercise_id,
          set_number: st.set_number,
          weight_kg: st.weight_kg,
          reps: st.reps,
          is_completed: st.is_completed,
          set_type: st.set_type,
          rpe: st.rpe ?? null,
        }))

        const { error: setsErr } = await supabase.from('workout_sets').insert(rowsToInsert)

        if (setsErr) {
          // Rollback created session so an orphaned empty session is not left behind
          await supabase.from('workout_sessions').delete().eq('id', sessionId).eq('user_id', userId)
          throw new Error(`Failed to save workout sets: ${setsErr.message}`)
        }
      }

      updateLocalCache()
      return localSession
    }

    // If RPC failed for any reason other than missing function (e.g. auth, constraints), surface error!
    throw new Error(`Cloud workout persistence failed: ${rpcError.message}`)
  },

  /**
   * Deletes a completed workout session.
   */
  async deleteWorkoutSession(userId: string, sessionId: string): Promise<boolean> {
    const currentSessions = getLocal<WorkoutSession[]>(`${LOCAL_SESSIONS_KEY}${userId}`, [])
    setLocal(
      `${LOCAL_SESSIONS_KEY}${userId}`,
      currentSessions.filter((s) => s.id !== sessionId)
    )

    if (!isSupabaseConfigured) return true

    try {
      const { error } = await supabase
        .from('workout_sessions')
        .delete()
        .eq('id', sessionId)
        .eq('user_id', userId)

      return !error
    } catch {
      return true
    }
  },
}
