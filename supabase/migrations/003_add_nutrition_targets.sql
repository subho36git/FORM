-- ==============================================================================
-- FORM Application — Phase 3: Nutrition Targets Migration
-- Migration: 003_add_nutrition_targets.sql
-- Description: Adds nullable nutrition target columns (daily calories, protein,
--              carbs, and fat grams) to public.profiles.
-- ==============================================================================

-- Add nullable nutrition target columns to public.profiles
alter table public.profiles
  add column if not exists daily_calorie_target integer,
  add column if not exists protein_target_g integer,
  add column if not exists carbs_target_g integer,
  add column if not exists fat_target_g integer;

-- Document column purposes
comment on column public.profiles.daily_calorie_target is 'Target daily calorie intake in kcal.';
comment on column public.profiles.protein_target_g is 'Target daily protein intake in grams.';
comment on column public.profiles.carbs_target_g is 'Target daily carbohydrate intake in grams.';
comment on column public.profiles.fat_target_g is 'Target daily fat intake in grams.';
