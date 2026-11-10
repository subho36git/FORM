-- ==============================================================================
-- FORM Application — Phase 3: User Onboarding Migration
-- Migration: 002_add_onboarding_completed.sql
-- Description: Adds the 'onboarding_completed' flag to public.profiles with a
--              strict NOT NULL constraint and default of 'false' to track athlete
--              onboarding flow status.
-- ==============================================================================

-- 1. Add onboarding_completed column if it doesn't exist yet
alter table public.profiles
  add column if not exists onboarding_completed boolean default false;

-- 2. Ensure all existing profiles receive 'false' if null
update public.profiles
  set onboarding_completed = false
  where onboarding_completed is null;

-- 3. Enforce NOT NULL and default false constraint
alter table public.profiles
  alter column onboarding_completed set default false,
  alter column onboarding_completed set not null;

-- 4. Document column purpose
comment on column public.profiles.onboarding_completed is 'Indicates whether the athlete has completed the initial FORM onboarding wizard.';
