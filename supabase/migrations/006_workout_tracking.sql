-- ==============================================================================
-- FORM Application — Phase 5: Workout Tracking & Routines Migration
-- Migration: 006_workout_tracking.sql
-- Architecture & Ordering:
--   PHASE 1: Transaction Initialization
--   PHASE 2: Create All Five Core Tables (strict dependency order)
--            1. public.exercises
--            2. public.routines
--            3. public.routine_exercises
--            4. public.workout_sessions
--            5. public.workout_sets
--   PHASE 3: Create Performance Indexes
--   PHASE 4: Configure Table Permissions & Enable Row Level Security (RLS)
--   PHASE 5: Configure Hardened Cross-Table RLS Policies
--   PHASE 6: Configure Ownership Immutability Functions & Triggers (SET search_path = '')
--   PHASE 7: Seed Built-In Standard Exercise Catalog (Idempotent)
--   PHASE 8: Transaction Commit
-- ==============================================================================

BEGIN;

-- ==============================================================================
-- PHASE 2: Create All Five Core Tables in Strict Dependency Order
-- ==============================================================================

-- 1. Exercises Table (global movements and athlete custom movements)
CREATE TABLE IF NOT EXISTS public.exercises (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE, -- NULL indicates global built-in catalog
  name text NOT NULL,
  muscle_group text NOT NULL CHECK (muscle_group IN (
    'chest', 'back', 'shoulders', 'legs', 'arms', 'core', 'full_body', 'other'
  )),
  equipment text NOT NULL CHECK (equipment IN (
    'barbell', 'dumbbell', 'machine', 'cable', 'bodyweight', 'kettlebell', 'other'
  )),
  instructions text,
  is_custom boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.exercises IS 
  'Exercise catalog containing global standard movements and athlete-created custom exercises.';
COMMENT ON COLUMN public.exercises.user_id IS 
  'Athlete who created the custom exercise. NULL for standard built-in movements available to all.';
COMMENT ON COLUMN public.exercises.muscle_group IS 
  'Primary muscle group targeted (strictly: chest, back, shoulders, legs, arms, core, full_body, other).';
COMMENT ON COLUMN public.exercises.equipment IS 
  'Required equipment (strictly: barbell, dumbbell, machine, cable, bodyweight, kettlebell, other).';

-- 2. Routines Table (athlete workout routine templates)
CREATE TABLE IF NOT EXISTS public.routines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(trim(name)) > 0),
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.routines IS 
  'Athlete workout routine templates containing planned exercises and volume targets.';

-- 3. Routine Exercises Junction Table (prescribed parameters per movement)
CREATE TABLE IF NOT EXISTS public.routine_exercises (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  routine_id uuid NOT NULL REFERENCES public.routines(id) ON DELETE CASCADE,
  exercise_id uuid NOT NULL REFERENCES public.exercises(id) ON DELETE CASCADE,
  order_index integer NOT NULL DEFAULT 0,
  target_sets integer NOT NULL DEFAULT 3 CHECK (target_sets > 0 AND target_sets <= 30),
  target_reps text NOT NULL DEFAULT '8-12',
  rest_seconds integer NOT NULL DEFAULT 90 CHECK (rest_seconds >= 0 AND rest_seconds <= 600),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.routine_exercises IS 
  'Ordered junction connecting exercises to a routine with prescription parameters.';

-- 4. Workout Sessions Table (chronological log of active and completed workouts)
CREATE TABLE IF NOT EXISTS public.workout_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  routine_id uuid REFERENCES public.routines(id) ON DELETE SET NULL,
  name text NOT NULL CHECK (char_length(trim(name)) > 0),
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  duration_seconds integer DEFAULT 0 CHECK (duration_seconds >= 0),
  total_volume_kg numeric DEFAULT 0 CHECK (total_volume_kg >= 0),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.workout_sessions IS 
  'Chronological log of completed or active workout sessions with summary aggregates.';

-- 5. Workout Sets Table (individual working sets with load, reps, and completion)
CREATE TABLE IF NOT EXISTS public.workout_sets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.workout_sessions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  exercise_id uuid NOT NULL REFERENCES public.exercises(id) ON DELETE RESTRICT,
  set_number integer NOT NULL CHECK (set_number > 0),
  weight_kg numeric NOT NULL DEFAULT 0 CHECK (weight_kg >= 0 AND weight_kg <= 1000),
  reps integer NOT NULL DEFAULT 0 CHECK (reps >= 0 AND reps <= 500),
  is_completed boolean NOT NULL DEFAULT true,
  set_type text NOT NULL DEFAULT 'normal' CHECK (set_type IN ('normal', 'warmup', 'dropset', 'failure')),
  rpe numeric CHECK (rpe IS NULL OR (rpe >= 1.0 AND rpe <= 10.0)),
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.workout_sets IS 
  'Individual logged sets containing load (kg), repetitions, and completion state.';


-- ==============================================================================
-- PHASE 3: Create Performance Indexes (Now that all tables exist)
-- ==============================================================================

CREATE INDEX IF NOT EXISTS idx_exercises_user_muscle 
  ON public.exercises (user_id, muscle_group, name);

CREATE INDEX IF NOT EXISTS idx_exercises_name_search 
  ON public.exercises (name);

CREATE INDEX IF NOT EXISTS idx_routines_user_updated 
  ON public.routines (user_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_routine_exercises_routine_order 
  ON public.routine_exercises (routine_id, order_index ASC);

CREATE INDEX IF NOT EXISTS idx_routine_exercises_exercise 
  ON public.routine_exercises (exercise_id);

CREATE INDEX IF NOT EXISTS idx_workout_sessions_user_completed 
  ON public.workout_sessions (user_id, completed_at DESC NULLS LAST, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_workout_sessions_routine 
  ON public.workout_sessions (routine_id);

CREATE INDEX IF NOT EXISTS idx_workout_sets_session 
  ON public.workout_sets (session_id, exercise_id, set_number ASC);

CREATE INDEX IF NOT EXISTS idx_workout_sets_user_exercise 
  ON public.workout_sets (user_id, exercise_id, created_at DESC);


-- ==============================================================================
-- PHASE 4: Permissions & Row Level Security Configuration
-- ==============================================================================

REVOKE ALL ON TABLE 
  public.exercises, 
  public.routines, 
  public.routine_exercises, 
  public.workout_sessions, 
  public.workout_sets 
FROM PUBLIC, anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE 
  public.exercises, 
  public.routines, 
  public.routine_exercises, 
  public.workout_sessions, 
  public.workout_sets 
TO authenticated;

ALTER TABLE public.exercises ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.routines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.routine_exercises ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workout_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workout_sets ENABLE ROW LEVEL SECURITY;


-- ==============================================================================
-- PHASE 5: Hardened Cross-Table RLS Policies
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- A. public.exercises policies
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Authenticated users can view global and own exercises" ON public.exercises;
CREATE POLICY "Authenticated users can view global and own exercises"
  ON public.exercises FOR SELECT TO authenticated
  USING (user_id IS NULL OR user_id = auth.uid());

DROP POLICY IF EXISTS "Users can insert own custom exercises" ON public.exercises;
CREATE POLICY "Users can insert own custom exercises"
  ON public.exercises FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND is_custom = true);

DROP POLICY IF EXISTS "Users can update own custom exercises" ON public.exercises;
CREATE POLICY "Users can update own custom exercises"
  ON public.exercises FOR UPDATE TO authenticated
  USING (auth.uid() = user_id AND is_custom = true)
  WITH CHECK (auth.uid() = user_id AND is_custom = true);

DROP POLICY IF EXISTS "Users can delete own custom exercises" ON public.exercises;
CREATE POLICY "Users can delete own custom exercises"
  ON public.exercises FOR DELETE TO authenticated
  USING (auth.uid() = user_id AND is_custom = true);

-- ------------------------------------------------------------------------------
-- B. public.routines policies
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view own routines" ON public.routines;
CREATE POLICY "Users can view own routines"
  ON public.routines FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own routines" ON public.routines;
CREATE POLICY "Users can insert own routines"
  ON public.routines FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own routines" ON public.routines;
CREATE POLICY "Users can update own routines"
  ON public.routines FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own routines" ON public.routines;
CREATE POLICY "Users can delete own routines"
  ON public.routines FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- ------------------------------------------------------------------------------
-- C. public.routine_exercises policies (Cross-validated against routines & exercises)
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view own routine exercises" ON public.routine_exercises;
CREATE POLICY "Users can view own routine exercises"
  ON public.routine_exercises FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.routines r
      WHERE r.id = routine_exercises.routine_id AND r.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can insert own routine exercises" ON public.routine_exercises;
CREATE POLICY "Users can insert own routine exercises"
  ON public.routine_exercises FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.routines r
      WHERE r.id = routine_exercises.routine_id AND r.user_id = auth.uid()
    )
    AND EXISTS (
      SELECT 1 FROM public.exercises e
      WHERE e.id = routine_exercises.exercise_id AND (e.user_id IS NULL OR e.user_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can update own routine exercises" ON public.routine_exercises;
CREATE POLICY "Users can update own routine exercises"
  ON public.routine_exercises FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.routines r
      WHERE r.id = routine_exercises.routine_id AND r.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.routines r
      WHERE r.id = routine_exercises.routine_id AND r.user_id = auth.uid()
    )
    AND EXISTS (
      SELECT 1 FROM public.exercises e
      WHERE e.id = routine_exercises.exercise_id AND (e.user_id IS NULL OR e.user_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can delete own routine exercises" ON public.routine_exercises;
CREATE POLICY "Users can delete own routine exercises"
  ON public.routine_exercises FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.routines r
      WHERE r.id = routine_exercises.routine_id AND r.user_id = auth.uid()
    )
  );

-- ------------------------------------------------------------------------------
-- D. public.workout_sessions policies (Cross-validated against routines)
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view own workout sessions" ON public.workout_sessions;
CREATE POLICY "Users can view own workout sessions"
  ON public.workout_sessions FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own workout sessions" ON public.workout_sessions;
CREATE POLICY "Users can insert own workout sessions"
  ON public.workout_sessions FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND (
      routine_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.routines r
        WHERE r.id = workout_sessions.routine_id AND r.user_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "Users can update own workout sessions" ON public.workout_sessions;
CREATE POLICY "Users can update own workout sessions"
  ON public.workout_sessions FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    AND (
      routine_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.routines r
        WHERE r.id = workout_sessions.routine_id AND r.user_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "Users can delete own workout sessions" ON public.workout_sessions;
CREATE POLICY "Users can delete own workout sessions"
  ON public.workout_sessions FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- ------------------------------------------------------------------------------
-- E. public.workout_sets policies (Cross-validated against sessions & exercises)
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view own workout sets" ON public.workout_sets;
CREATE POLICY "Users can view own workout sets"
  ON public.workout_sets FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own workout sets" ON public.workout_sets;
CREATE POLICY "Users can insert own workout sets"
  ON public.workout_sets FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.workout_sessions s
      WHERE s.id = workout_sets.session_id AND s.user_id = auth.uid()
    )
    AND EXISTS (
      SELECT 1 FROM public.exercises e
      WHERE e.id = workout_sets.exercise_id AND (e.user_id IS NULL OR e.user_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can update own workout sets" ON public.workout_sets;
CREATE POLICY "Users can update own workout sets"
  ON public.workout_sets FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.workout_sessions s
      WHERE s.id = workout_sets.session_id AND s.user_id = auth.uid()
    )
    AND EXISTS (
      SELECT 1 FROM public.exercises e
      WHERE e.id = workout_sets.exercise_id AND (e.user_id IS NULL OR e.user_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can delete own workout sets" ON public.workout_sets;
CREATE POLICY "Users can delete own workout sets"
  ON public.workout_sets FOR DELETE TO authenticated
  USING (auth.uid() = user_id);


-- ==============================================================================
-- PHASE 6: Ownership Immutability Functions & Triggers (SET search_path = '')
-- ==============================================================================

-- 1. Exercise Immutability Trigger Function
CREATE OR REPLACE FUNCTION public.protect_exercise_immutability()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF OLD.user_id IS NULL OR OLD.is_custom = false THEN
      RAISE EXCEPTION 'Modifying system standard exercises is strictly prohibited.';
    END IF;
    IF NEW.user_id IS DISTINCT FROM OLD.user_id THEN
      RAISE EXCEPTION 'Modifying exercise user_id ownership is strictly prohibited.';
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.user_id IS NULL OR OLD.is_custom = false THEN
      RAISE EXCEPTION 'Deleting system standard exercises is strictly prohibited.';
    END IF;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_exercise_immutability ON public.exercises;
CREATE TRIGGER trg_protect_exercise_immutability
  BEFORE UPDATE OR DELETE ON public.exercises
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_exercise_immutability();

-- 2. Routine Ownership Immutability Trigger Function
CREATE OR REPLACE FUNCTION public.protect_routine_ownership()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.user_id IS DISTINCT FROM OLD.user_id THEN
    RAISE EXCEPTION 'Modifying routine user_id ownership is strictly prohibited.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_routine_ownership ON public.routines;
CREATE TRIGGER trg_protect_routine_ownership
  BEFORE UPDATE ON public.routines
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_routine_ownership();

-- 3. Routine Exercise Immutability Trigger Function
CREATE OR REPLACE FUNCTION public.protect_routine_exercise_ownership()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.routine_id IS DISTINCT FROM OLD.routine_id THEN
    RAISE EXCEPTION 'Moving a routine_exercise to a different routine_id is strictly prohibited.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_routine_exercise_ownership ON public.routine_exercises;
CREATE TRIGGER trg_protect_routine_exercise_ownership
  BEFORE UPDATE ON public.routine_exercises
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_routine_exercise_ownership();

-- 4. Workout Session Ownership Immutability Trigger Function
CREATE OR REPLACE FUNCTION public.protect_workout_session_ownership()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.user_id IS DISTINCT FROM OLD.user_id THEN
    RAISE EXCEPTION 'Modifying workout_sessions user_id ownership is strictly prohibited.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_workout_session_ownership ON public.workout_sessions;
CREATE TRIGGER trg_protect_workout_session_ownership
  BEFORE UPDATE ON public.workout_sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_workout_session_ownership();

-- 5. Workout Set Ownership & Session Immutability Trigger Function
CREATE OR REPLACE FUNCTION public.protect_workout_set_ownership()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.user_id IS DISTINCT FROM OLD.user_id THEN
    RAISE EXCEPTION 'Modifying workout_sets user_id ownership is strictly prohibited.';
  END IF;
  IF NEW.session_id IS DISTINCT FROM OLD.session_id THEN
    RAISE EXCEPTION 'Moving a workout_set to a different session_id is strictly prohibited.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_workout_set_ownership ON public.workout_sets;
CREATE TRIGGER trg_protect_workout_set_ownership
  BEFORE UPDATE ON public.workout_sets
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_workout_set_ownership();


-- ==============================================================================
-- PHASE 7: Seed Built-In Standard Exercise Catalog (Idempotent)
-- ==============================================================================

INSERT INTO public.exercises (name, muscle_group, equipment, instructions, is_custom, user_id)
SELECT * FROM (VALUES
  -- Chest
  ('Barbell Bench Press', 'chest', 'barbell', 'Lie flat on the bench, grip the bar slightly wider than shoulder-width, lower to mid-chest, and press explosively while maintaining upper back tightness.', false, NULL::uuid),
  ('Incline Dumbbell Press', 'chest', 'dumbbell', 'Set the bench to a 30-degree incline. Press dumbbells up and slightly inward over the upper chest with controlled descent.', false, NULL::uuid),
  ('Dips (Chest Focus)', 'chest', 'bodyweight', 'Lean torso forward roughly 30 degrees, flare elbows slightly, lower until upper arms are parallel to the ground, and push back up.', false, NULL::uuid),
  ('Cable Chest Fly', 'chest', 'cable', 'Set cables at chest height. Bring hands together in an arc motion with elbows slightly bent, squeezing the pectoral muscles at peak contraction.', false, NULL::uuid),
  ('Push-ups', 'chest', 'bodyweight', 'Keep core tight, elbows at a 45-degree angle, lower until chest touches the floor, and press up to full lockout.', false, NULL::uuid),

  -- Back
  ('Barbell Deadlift', 'back', 'barbell', 'Stand with feet hip-width apart. Hinge at hips, grip the bar just outside knees, brace core, and drive through the floor to stand tall.', false, NULL::uuid),
  ('Barbell Bent-Over Row', 'back', 'barbell', 'Hinge forward at 45 degrees with flat spine. Pull the barbell toward your lower ribcage, squeezing the lats and rhomboids.', false, NULL::uuid),
  ('Pull-ups', 'back', 'bodyweight', 'Overhand grip slightly wider than shoulder-width. Drive elbows down toward your hips until your chin clears the bar.', false, NULL::uuid),
  ('Lat Pulldown', 'back', 'cable', 'Grip the wide bar, lean back slightly, pull the bar down to collarbone level while driving elbows downward.', false, NULL::uuid),
  ('Seated Cable Row', 'back', 'cable', 'Maintain neutral spine, pull handle toward your abdomen, retracting shoulder blades without leaning excessively backward.', false, NULL::uuid),

  -- Shoulders
  ('Overhead Press (OHP)', 'shoulders', 'barbell', 'Stand tall with bar racked at clavicle height. Press the bar vertically overhead while squeezing glutes and core.', false, NULL::uuid),
  ('Dumbbell Lateral Raise', 'shoulders', 'dumbbell', 'Slight forward lean, raise dumbbells out to the sides in the scapular plane up to shoulder level with controlled eccentric.', false, NULL::uuid),
  ('Seated Dumbbell Shoulder Press', 'shoulders', 'dumbbell', 'Press dumbbells overhead from ear level, locking out smoothly without slamming the weights together.', false, NULL::uuid),
  ('Face Pulls', 'shoulders', 'cable', 'Attach rope at eye level. Pull rope toward your face while externally rotating your shoulders, bringing knuckles back.', false, NULL::uuid),

  -- Legs
  ('Barbell Back Squat', 'legs', 'barbell', 'Rest bar on upper traps. Break at hips and knees simultaneously, descend to parallel or deeper, then drive through mid-foot to return.', false, NULL::uuid),
  ('Romanian Deadlift (RDL)', 'legs', 'barbell', 'Keep slight bend in knees, push hips backward until you feel a deep stretch in the hamstrings, then engage glutes to stand.', false, NULL::uuid),
  ('Leg Press', 'legs', 'machine', 'Place feet shoulder-width on platform. Lower sled until knees reach 90 degrees, then press through heels without locking knees abruptly.', false, NULL::uuid),
  ('Bulgarian Split Squat', 'legs', 'dumbbell', 'Place rear foot elevated on a bench. Lower hips until front thigh is parallel to the ground, driving through front heel to rise.', false, NULL::uuid),
  ('Lying Leg Curl', 'legs', 'machine', 'Lie face down with pad above ankles. Curl weight toward glutes, pausing momentarily at peak contraction.', false, NULL::uuid),
  ('Leg Extension', 'legs', 'machine', 'Sit back against pad. Extend legs forward to contract the quadriceps, lowering with smooth control.', false, NULL::uuid),
  ('Standing Calf Raise', 'legs', 'machine', 'Balls of feet on step with heels hanging off. Lower heels for a full calf stretch, then rise onto toes with a solid contraction.', false, NULL::uuid),

  -- Arms
  ('Barbell Bicep Curl', 'arms', 'barbell', 'Grip bar shoulder-width with underhand grip. Keep elbows pinned to sides, curl weight up, and lower under control.', false, NULL::uuid),
  ('Incline Dumbbell Curl', 'arms', 'dumbbell', 'Sit on a 45-60 degree incline. Let arms hang back for maximum stretch on the long head of the bicep before curling.', false, NULL::uuid),
  ('Hammer Curl', 'arms', 'dumbbell', 'Hold dumbbells with neutral palms-facing-in grip. Curl up to target the brachialis and brachioradialis.', false, NULL::uuid),
  ('Tricep Rope Pushdown', 'arms', 'cable', 'Keep upper arms perpendicular to the floor. Push rope down, flaring ends outward at bottom lockout for maximum tricep activation.', false, NULL::uuid),
  ('Skull Crushers', 'arms', 'barbell', 'Lie on flat bench. Lower EZ-curl bar toward forehead by bending at elbows, then extend back to starting position.', false, null::uuid),

  -- Core & Full Body
  ('Hanging Leg Raise', 'core', 'bodyweight', 'Hang from bar with active shoulders. Raise legs or knees smoothly toward chest using abdominal control without swinging.', false, NULL::uuid),
  ('Cable Woodchoppers', 'core', 'cable', 'Rotate torso diagonally across your body engaging the obliques, pivoting on back foot with controlled return.', false, NULL::uuid),
  ('Ab Wheel Rollout', 'core', 'bodyweight', 'Kneel with wheel in front. Roll forward extending hips and core as far as possible without sagging lower back, then pull back.', false, NULL::uuid),
  ('Plank', 'core', 'bodyweight', 'Rest on forearms and toes, maintaining a straight line from heels to head while bracing core and squeezing glutes.', false, NULL::uuid)
) AS v(name, muscle_group, equipment, instructions, is_custom, user_id)
WHERE NOT EXISTS (
  SELECT 1 FROM public.exercises e 
  WHERE e.name = v.name AND e.user_id IS NULL
);

-- ==============================================================================
-- PHASE 8: Transaction Commit
-- ==============================================================================

COMMIT;
