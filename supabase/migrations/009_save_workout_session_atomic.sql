-- ==============================================================================
-- FORM Application — Phase 9: Atomic Workout Session Persistence RPC
-- Migration: 009_save_workout_session_atomic.sql
-- Description:
--   Creates a transactional RPC function `save_workout_session_atomic` that saves
--   both the workout session and all associated workout sets in a single atomic transaction.
--   Enforces authentication, multi-tenant ownership, and idempotency (prevents duplicates on retry).
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.save_workout_session_atomic(
  p_session_id uuid,
  p_name text,
  p_routine_id uuid,
  p_started_at timestamptz,
  p_completed_at timestamptz,
  p_duration_seconds integer,
  p_total_volume_kg numeric,
  p_notes text,
  p_sets jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid;
  v_set jsonb;
  v_exercise_id uuid;
  v_set_id uuid;
  v_set_number integer;
  v_weight_kg numeric;
  v_reps integer;
  v_is_completed boolean;
  v_set_type text;
  v_rpe numeric;
  v_result jsonb;
BEGIN
  -- 1. Authentication check
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- 2. Validate input parameters
  IF p_session_id IS NULL THEN
    RAISE EXCEPTION 'Session ID is required';
  END IF;

  IF trim(coalesce(p_name, '')) = '' THEN
    RAISE EXCEPTION 'Workout session name cannot be empty';
  END IF;

  -- Validate routine ownership if provided
  IF p_routine_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.routines
      WHERE id = p_routine_id AND user_id = v_user_id
    ) THEN
      RAISE EXCEPTION 'Referenced routine does not exist or does not belong to user';
    END IF;
  END IF;

  -- 3. Upsert workout_session (Idempotency protection for retries)
  INSERT INTO public.workout_sessions (
    id,
    user_id,
    routine_id,
    name,
    started_at,
    completed_at,
    duration_seconds,
    total_volume_kg,
    notes
  )
  VALUES (
    p_session_id,
    v_user_id,
    p_routine_id,
    trim(p_name),
    coalesce(p_started_at, now()),
    p_completed_at,
    greatest(0, coalesce(p_duration_seconds, 0)),
    greatest(0, coalesce(p_total_volume_kg, 0)),
    p_notes
  )
  ON CONFLICT (id) DO UPDATE SET
    routine_id = excluded.routine_id,
    name = excluded.name,
    started_at = excluded.started_at,
    completed_at = excluded.completed_at,
    duration_seconds = excluded.duration_seconds,
    total_volume_kg = excluded.total_volume_kg,
    notes = excluded.notes
  WHERE public.workout_sessions.user_id = v_user_id;

  -- If conflict occurred but user_id didn't match, raise exception
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Session exists but belongs to a different user';
  END IF;

  -- 4. Delete existing sets for this session to guarantee idempotency on retries
  DELETE FROM public.workout_sets
  WHERE session_id = p_session_id AND user_id = v_user_id;

  -- 5. Insert all sets from p_sets jsonb array
  IF p_sets IS NOT NULL AND jsonb_typeof(p_sets) = 'array' THEN
    FOR v_set IN SELECT * FROM jsonb_array_elements(p_sets) LOOP
      v_exercise_id := (v_set->>'exercise_id')::uuid;

      -- Validate exercise exists and is either global (user_id IS NULL) or owned by current user
      IF NOT EXISTS (
        SELECT 1 FROM public.exercises
        WHERE id = v_exercise_id AND (user_id IS NULL OR user_id = v_user_id)
      ) THEN
        RAISE EXCEPTION 'Exercise % does not exist or access denied', v_exercise_id;
      END IF;

      BEGIN
        v_set_id := (v_set->>'id')::uuid;
      EXCEPTION WHEN OTHERS THEN
        v_set_id := gen_random_uuid();
      END;

      v_set_number := greatest(1, coalesce((v_set->>'set_number')::integer, 1));
      v_weight_kg := greatest(0, coalesce((v_set->>'weight_kg')::numeric, 0));
      v_reps := greatest(0, coalesce((v_set->>'reps')::integer, 0));
      v_is_completed := coalesce((v_set->>'is_completed')::boolean, true);
      v_set_type := coalesce(v_set->>'set_type', 'normal');
      IF v_set_type NOT IN ('normal', 'warmup', 'dropset', 'failure') THEN
        v_set_type := 'normal';
      END IF;
      v_rpe := (v_set->>'rpe')::numeric;

      INSERT INTO public.workout_sets (
        id,
        session_id,
        user_id,
        exercise_id,
        set_number,
        weight_kg,
        reps,
        is_completed,
        set_type,
        rpe
      ) VALUES (
        coalesce(v_set_id, gen_random_uuid()),
        p_session_id,
        v_user_id,
        v_exercise_id,
        v_set_number,
        v_weight_kg,
        v_reps,
        v_is_completed,
        v_set_type,
        v_rpe
      );
    END LOOP;
  END IF;

  -- 6. Construct and return successful summary JSON
  SELECT jsonb_build_object(
    'id', s.id,
    'user_id', s.user_id,
    'routine_id', s.routine_id,
    'name', s.name,
    'started_at', s.started_at,
    'completed_at', s.completed_at,
    'duration_seconds', s.duration_seconds,
    'total_volume_kg', s.total_volume_kg,
    'notes', s.notes,
    'sets_count', (SELECT count(*) FROM public.workout_sets ws WHERE ws.session_id = s.id)
  ) INTO v_result
  FROM public.workout_sessions s
  WHERE s.id = p_session_id;

  RETURN v_result;
END;
$$;

-- Revoke execute from public/anon, grant strictly to authenticated
REVOKE EXECUTE ON FUNCTION public.save_workout_session_atomic FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_workout_session_atomic TO authenticated;

