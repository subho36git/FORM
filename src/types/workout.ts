/**
 * Workout Tracking & Routine Type Definitions for FORM (Phase 5)
 */

export type MuscleGroup =
  | 'chest'
  | 'back'
  | 'shoulders'
  | 'legs'
  | 'arms'
  | 'core'
  | 'full_body'
  | 'other'

export type Equipment =
  | 'barbell'
  | 'dumbbell'
  | 'machine'
  | 'cable'
  | 'bodyweight'
  | 'kettlebell'
  | 'other'

export type SetType = 'normal' | 'warmup' | 'dropset' | 'failure'

export interface Exercise {
  id: string
  user_id: string | null
  name: string
  muscle_group: MuscleGroup
  equipment: Equipment
  instructions: string | null
  is_custom: boolean
  created_at?: string
}

export interface RoutineExercise {
  id: string
  routine_id: string
  exercise_id: string
  order_index: number
  target_sets: number
  target_reps: string
  rest_seconds: number
  notes: string | null
  exercise?: Exercise
}

export interface Routine {
  id: string
  user_id: string
  name: string
  description: string | null
  created_at: string
  updated_at: string
  exercises?: RoutineExercise[]
}

export interface WorkoutSet {
  id?: string
  session_id?: string
  user_id?: string
  exercise_id: string
  set_number: number
  weight_kg: number
  reps: number
  is_completed: boolean
  set_type: SetType
  rpe?: number | null
  created_at?: string
  exercise?: Exercise
}

export interface WorkoutSession {
  id: string
  user_id: string
  routine_id: string | null
  name: string
  started_at: string
  completed_at: string | null
  duration_seconds: number
  total_volume_kg: number
  notes: string | null
  created_at: string
  sets?: WorkoutSet[]
}

export interface ActiveWorkoutSet {
  id: string
  set_number: number
  weight_kg: number | string // string while user is actively editing
  reps: number | string // string while user is actively editing
  is_completed: boolean
  set_type: SetType
  rpe?: number | null
}

export interface ActiveWorkoutExercise {
  id: string // unique instance ID in active workout
  exercise: Exercise
  sets: ActiveWorkoutSet[]
  rest_seconds?: number
  notes?: string
}

export interface ActiveWorkoutSession {
  id: string
  routineId?: string | null
  name: string
  startedAt: string
  exercises: ActiveWorkoutExercise[]
  notes: string
  isRestTimerActive?: boolean
  restTimerSecondsRemaining?: number
  restTimerTotalSeconds?: number
}

export interface ExerciseProgressMetric {
  exerciseId: string
  exerciseName: string
  muscleGroup: MuscleGroup
  maxWeightKg: number
  estimated1RmKg: number
  maxVolumeSessionKg: number
  totalSetsLogged: number
  lastPerformedAt: string | null
  history: {
    sessionId: string
    sessionDate: string
    sessionName: string
    topSetWeightKg: number
    topSetReps: number
    estimated1RmKg: number
    totalVolumeKg: number
    sets: WorkoutSet[]
  }[]
}
