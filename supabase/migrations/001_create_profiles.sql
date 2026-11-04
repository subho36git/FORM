-- ==============================================================================
-- FORM Application — Phase 2: User Profiles Migration (Hardened & Scoped)
-- Migration: 001_create_profiles.sql
-- Description: Creates the public.profiles table, configures explicit table-level
--              privileges (Defense-in-Depth), enables Row Level Security (RLS),
--              defines strict policies, and sets up a hardened signup trigger.
-- ==============================================================================

-- 1. Create the public.profiles table
-- Linked to auth.users via UUID. If a user deletes their account,
-- ON DELETE CASCADE ensures their profile is automatically removed.
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  height_cm numeric,
  current_weight_kg numeric,
  goal_weight_kg numeric,
  fitness_goal text,
  activity_level text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Add a table comment for clear database documentation
comment on table public.profiles is 'Stores personal and fitness profile details for authenticated FORM athletes.';

-- 2. Create helper trigger function to auto-update 'updated_at' on row changes
create or replace function public.handle_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at
  before update on public.profiles
  for each row
  execute function public.handle_updated_at();

-- 3. Explicitly configure table privileges (Defense-in-Depth)
-- Revoke all table-level privileges from anon and authenticated roles
revoke all on table public.profiles from anon, authenticated;

-- Grant strictly SELECT and UPDATE to authenticated users (no INSERT or DELETE granted)
grant select, update on table public.profiles to authenticated;

-- 4. Enable Row Level Security (RLS)
-- Crucial for multi-tenant privacy: by default, NO queries are permitted until policies are defined.
alter table public.profiles enable row level security;

-- 5. Define Row Level Security (RLS) Policies
-- Note: No INSERT policy is provided for client roles. Profiles can ONLY be created
-- by the internal auth.users database trigger, preventing clients from inserting rogue rows.

-- Drop any previous insert policy if it existed
drop policy if exists "Users can insert own profile" on public.profiles;

-- Policy A: Users can view their own profile only
drop policy if exists "Users can view own profile" on public.profiles;
create policy "Users can view own profile"
  on public.profiles
  for select
  to authenticated
  using (auth.uid() = id);

-- Policy B: Users can update their own profile only
drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile"
  on public.profiles
  for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- 6. Automatically create a profile when a new user signs up in auth.users
-- Security Hardening:
--   • SECURITY DEFINER: Runs with elevated database-owner permissions during signup.
--   • SET search_path = '': Eliminates search path hijacking vulnerabilities by ensuring
--     no user-controlled schema is searched.
--   • All database objects (e.g. public.profiles) are explicitly schema-qualified.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (
    id,
    display_name
  )
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data->>'display_name',
      new.raw_user_meta_data->>'full_name',
      split_part(new.email, '@', 1),
      'Athlete'
    )
  );
  return new;
end;
$$;

-- Safely recreate the trigger on auth.users
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();
