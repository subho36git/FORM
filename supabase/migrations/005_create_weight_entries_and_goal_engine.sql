-- ==============================================================================
-- FORM Application — Phase 4: Dynamic Goal Engine & Weight Entries Migration
-- Migration: 005_create_weight_entries_and_goal_engine.sql
-- Description: 
--   1. Adds target_completion_date, macro_preference (NOT NULL), and manual_overrides
--      to public.profiles with strict check constraints.
--   2. Creates public.weight_entries table (25.0–350.0 kg validation) with Row Level Security
--      and an is_baseline flag to distinguish migrated baseline snapshots from confirmed weigh-ins.
--   3. Backfills existing profile weights into weight_entries as initial onboarding baselines.
--   4. Creates a hardened, serialized synchronization trigger on weight_entries:
--        • Locks the target profile row with SELECT ... FOR UPDATE to serialize concurrent transactions.
--        • Disallows changing user_id on updates to prevent cross-athlete data ownership corruption.
--        • Synchronizes INSERT, UPDATE (weight_kg, measured_at), and DELETE operations atomically.
-- ==============================================================================

-- 1. Extend public.profiles with Goal Engine columns and constraints
alter table public.profiles
  add column if not exists target_completion_date date,
  add column if not exists macro_preference text default 'balanced',
  add column if not exists manual_overrides jsonb default '{}'::jsonb not null;

-- Ensure macro_preference has no nulls, set default, enforce NOT NULL
update public.profiles
  set macro_preference = 'balanced'
  where macro_preference is null;

alter table public.profiles
  alter column macro_preference set default 'balanced',
  alter column macro_preference set not null;

-- Add check constraint for macro_preference values
alter table public.profiles
  drop constraint if exists check_macro_preference;

alter table public.profiles
  add constraint check_macro_preference
  check (macro_preference in ('balanced', 'high_protein', 'low_carb', 'custom'));

-- Add check constraint ensuring manual_overrides is a valid JSON object
alter table public.profiles
  drop constraint if exists check_manual_overrides_is_object;

alter table public.profiles
  add constraint check_manual_overrides_is_object
  check (jsonb_typeof(manual_overrides) = 'object');

comment on column public.profiles.target_completion_date is 
  'Athlete-chosen target date (YYYY-MM-DD) for goal weight achievement. Never overwritten by automatic calculations.';
comment on column public.profiles.macro_preference is 
  'Saved macro distribution style: balanced, high_protein, low_carb, or custom (NOT NULL).';
comment on column public.profiles.manual_overrides is 
  'JSON object recording which fields the athlete manually locked (e.g. {"calories": true, "protein": true}).';

-- 2. Create the public.weight_entries table
create table if not exists public.weight_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  weight_kg numeric not null check (weight_kg >= 25.0 and weight_kg <= 350.0),
  measured_at timestamptz not null default now(),
  is_baseline boolean not null default false,
  created_at timestamptz not null default now()
);

comment on table public.weight_entries is 
  'Historical bodyweight measurements for progress tracking and trend-based calorie calibration.';
comment on column public.weight_entries.weight_kg is 
  'Bodyweight in kilograms at time of measurement (strictly enforced 25.0 - 350.0 kg).';
comment on column public.weight_entries.measured_at is 
  'Timestamp when the weigh-in measurement was taken (supports backdated logs).';
comment on column public.weight_entries.is_baseline is 
  'True if entry was generated from initial onboarding profile data rather than a user-confirmed scale weigh-in.';

-- 3. Create index for fast chronological time-series retrieval per athlete
create index if not exists idx_weight_entries_user_measured_at 
  on public.weight_entries (user_id, measured_at desc, created_at desc);

-- 4. Defense-in-depth: Revoke all from PUBLIC and anon, grant CRUD to authenticated
REVOKE ALL ON TABLE public.weight_entries FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.weight_entries TO authenticated;

-- 5. Enable Row Level Security (RLS)
alter table public.weight_entries enable row level security;

-- Policy A: Athletes can view their own weigh-ins only
drop policy if exists "Users can view own weight entries" on public.weight_entries;
create policy "Users can view own weight entries"
  on public.weight_entries
  for select
  to authenticated
  using (auth.uid() = user_id);

-- Policy B: Athletes can insert their own weigh-ins only
drop policy if exists "Users can insert own weight entries" on public.weight_entries;
create policy "Users can insert own weight entries"
  on public.weight_entries
  for insert
  to authenticated
  with check (auth.uid() = user_id);

-- Policy C: Athletes can update their own weigh-ins only
drop policy if exists "Users can update own weight entries" on public.weight_entries;
create policy "Users can update own weight entries"
  on public.weight_entries
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Policy D: Athletes can delete their own weigh-ins only
drop policy if exists "Users can delete own weight entries" on public.weight_entries;
create policy "Users can delete own weight entries"
  on public.weight_entries
  for delete
  to authenticated
  using (auth.uid() = user_id);

-- 6. Backfill existing profile weights into weight_entries
-- Strategy: Uses the athlete's account creation timestamp (created_at) as the initial onboarding
-- baseline timestamp and marks is_baseline = true so the UI can distinguish it from confirmed weigh-ins.
insert into public.weight_entries (user_id, weight_kg, measured_at, is_baseline, created_at)
select 
  id as user_id, 
  current_weight_kg as weight_kg, 
  coalesce(created_at, now()) as measured_at, 
  true as is_baseline,
  now() as created_at
from public.profiles
where current_weight_kg is not null
  and current_weight_kg >= 25.0 
  and current_weight_kg <= 350.0
  and not exists (
    select 1 from public.weight_entries w where w.user_id = profiles.id
  );

-- 7. Database-side synchronization function & trigger
-- Concurrency & Security Hardening:
--   • Explicitly disallows updating user_id to prevent cross-tenant ownership alteration.
--   • Locks the athlete's public.profiles row using SELECT ... FOR UPDATE to serialize concurrent transactions.
--   • Queries the latest entry by (measured_at desc, created_at desc) and updates profiles.current_weight_kg atomically.
create or replace function public.sync_profile_current_weight()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_user_id uuid;
  latest_weight numeric;
begin
  -- Disallow transferring existing weight records between athletes
  if tg_op = 'UPDATE' and old.user_id <> new.user_id then
    raise exception 'Transferring weight entries between athletes is not permitted.';
  end if;

  if tg_op = 'DELETE' then
    target_user_id := old.user_id;
  else
    target_user_id := new.user_id;
  end if;

  -- 1. Explicitly lock the athlete's profile row to serialize concurrent weigh-in transactions
  perform 1 
  from public.profiles 
  where id = target_user_id 
  for update;

  -- 2. Query the latest weigh-in for this user ordered chronologically
  select weight_kg into latest_weight
  from public.weight_entries
  where user_id = target_user_id
  order by measured_at desc, created_at desc
  limit 1;

  -- 3. Atomically update profiles.current_weight_kg (or null if all entries deleted)
  update public.profiles
  set 
    current_weight_kg = latest_weight,
    updated_at = now()
  where id = target_user_id;

  return null;
end;
$$;

REVOKE EXECUTE ON FUNCTION public.sync_profile_current_weight() FROM PUBLIC, anon, authenticated;

-- Bind trigger on weight_entries for INSERT, UPDATE, and DELETE
drop trigger if exists on_weight_entry_sync on public.weight_entries;
create trigger on_weight_entry_sync
  after insert or update or delete on public.weight_entries
  for each row
  execute function public.sync_profile_current_weight();
