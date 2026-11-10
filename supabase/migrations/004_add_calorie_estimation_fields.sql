-- ==============================================================================
-- FORM Application — Phase 3: Calorie Estimation Fields Migration
-- Migration: 004_add_calorie_estimation_fields.sql
-- Description: Adds nullable age and biological sex columns to public.profiles
--              to support Mifflin-St Jeor metabolic rate calculations.
-- ==============================================================================

-- 1. Add nullable columns if they don't already exist
alter table public.profiles
  add column if not exists age_years integer,
  add column if not exists sex_for_calorie_formula text;

-- 2. Add CHECK constraint allowing only 'male' or 'female' when non-null
alter table public.profiles
  drop constraint if exists check_sex_for_calorie_formula;

alter table public.profiles
  add constraint check_sex_for_calorie_formula
  check (sex_for_calorie_formula is null or sex_for_calorie_formula in ('male', 'female'));

-- 3. Document column purposes
comment on column public.profiles.age_years is 'Athlete age in years for BMR calculation.';
comment on column public.profiles.sex_for_calorie_formula is 'Sex parameter for Mifflin-St Jeor BMR formula (male or female).';
