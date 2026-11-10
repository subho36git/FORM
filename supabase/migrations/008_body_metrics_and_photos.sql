-- ==============================================================================
-- FORM Application — Phase 8.2: Body Metrics & Progress Photos Migration
-- Migration: 008_body_metrics_and_photos.sql
-- Description:
--   1. Creates public.body_measurements table for dated circumference records
--      (waist, chest, shoulders, biceps, forearms, neck, hips, thighs, calves).
--   2. Creates public.progress_photos table for tracking pose photos (front, side, back)
--      linked to secure storage paths.
--   3. Configures private Supabase Storage bucket 'progress-photos' with 10MB limit
--      and strict user-folder isolation policies (auth.uid() = (storage.foldername(name))[1]).
--   4. Configures RLS policies granting athletes full CRUD over their own records only.
-- ==============================================================================

-- 1. Create public.body_measurements table
create table if not exists public.body_measurements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  measured_date date not null,
  waist_cm numeric check (waist_cm is null or (waist_cm > 10 and waist_cm < 300)),
  chest_cm numeric check (chest_cm is null or (chest_cm > 10 and chest_cm < 300)),
  shoulders_cm numeric check (shoulders_cm is null or (shoulders_cm > 10 and shoulders_cm < 300)),
  bicep_left_cm numeric check (bicep_left_cm is null or (bicep_left_cm > 5 and bicep_left_cm < 150)),
  bicep_right_cm numeric check (bicep_right_cm is null or (bicep_right_cm > 5 and bicep_right_cm < 150)),
  forearm_left_cm numeric check (forearm_left_cm is null or (forearm_left_cm > 5 and forearm_left_cm < 150)),
  forearm_right_cm numeric check (forearm_right_cm is null or (forearm_right_cm > 5 and forearm_right_cm < 150)),
  neck_cm numeric check (neck_cm is null or (neck_cm > 10 and neck_cm < 150)),
  hips_cm numeric check (hips_cm is null or (hips_cm > 10 and hips_cm < 300)),
  thigh_left_cm numeric check (thigh_left_cm is null or (thigh_left_cm > 10 and thigh_left_cm < 200)),
  thigh_right_cm numeric check (thigh_right_cm is null or (thigh_right_cm > 10 and thigh_right_cm < 200)),
  calf_left_cm numeric check (calf_left_cm is null or (calf_left_cm > 5 and calf_left_cm < 150)),
  calf_right_cm numeric check (calf_right_cm is null or (calf_right_cm > 5 and calf_right_cm < 150)),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.body_measurements is
  'Dated body circumference measurements (stored strictly in centimetres) for physique development tracking.';

-- Index for chronological retrieval per user
create index if not exists idx_body_measurements_user_date
  on public.body_measurements (user_id, measured_date desc, created_at desc);

-- Defense-in-depth: Revoke all from PUBLIC and anon, grant CRUD to authenticated
revoke all on table public.body_measurements from public, anon;
grant select, insert, update, delete on table public.body_measurements to authenticated;

-- Enable Row Level Security (RLS)
alter table public.body_measurements enable row level security;

-- Policies for public.body_measurements
drop policy if exists "Users can view own body measurements" on public.body_measurements;
create policy "Users can view own body measurements"
  on public.body_measurements
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own body measurements" on public.body_measurements;
create policy "Users can insert own body measurements"
  on public.body_measurements
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own body measurements" on public.body_measurements;
create policy "Users can update own body measurements"
  on public.body_measurements
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete own body measurements" on public.body_measurements;
create policy "Users can delete own body measurements"
  on public.body_measurements
  for delete
  to authenticated
  using (auth.uid() = user_id);


-- 2. Create public.progress_photos table
create table if not exists public.progress_photos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  captured_date date not null,
  pose text not null check (pose in ('front', 'side', 'back')),
  storage_path text not null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.progress_photos is
  'Metadata and secure storage paths for athlete progress photos categorized by pose.';

-- Index for chronological retrieval per user
create index if not exists idx_progress_photos_user_date
  on public.progress_photos (user_id, captured_date desc, created_at desc);

-- Defense-in-depth: Revoke all from PUBLIC and anon, grant CRUD to authenticated
revoke all on table public.progress_photos from public, anon;
grant select, insert, update, delete on table public.progress_photos to authenticated;

-- Enable Row Level Security (RLS)
alter table public.progress_photos enable row level security;

-- Policies for public.progress_photos
drop policy if exists "Users can view own progress photos metadata" on public.progress_photos;
create policy "Users can view own progress photos metadata"
  on public.progress_photos
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own progress photos metadata" on public.progress_photos;
create policy "Users can insert own progress photos metadata"
  on public.progress_photos
  for insert
  to authenticated
  with check (
    auth.uid() = user_id and
    storage_path like auth.uid()::text || '/%' and
    length(storage_path) > 0
  );

drop policy if exists "Users can update own progress photos metadata" on public.progress_photos;
create policy "Users can update own progress photos metadata"
  on public.progress_photos
  for update
  to authenticated
  using (
    auth.uid() = user_id and
    storage_path like auth.uid()::text || '/%' and
    length(storage_path) > 0
  )
  with check (
    auth.uid() = user_id and
    storage_path like auth.uid()::text || '/%' and
    length(storage_path) > 0
  );

drop policy if exists "Users can delete own progress photos metadata" on public.progress_photos;
create policy "Users can delete own progress photos metadata"
  on public.progress_photos
  for delete
  to authenticated
  using (auth.uid() = user_id);


-- 3. Storage Bucket & Policies for private 'progress-photos'
-- Insert or configure private bucket
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'progress-photos',
  'progress-photos',
  false,
  10485760, -- 10MB limit
  array['image/jpeg', 'image/png', 'image/webp']::text[]
)
on conflict (id) do update set
  public = false,
  file_size_limit = 10485760,
  allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp']::text[];

-- Storage Object RLS Policies
-- Athletes can only read files within their own folder (folder name equals user_id)
drop policy if exists "Athletes can view own progress photos" on storage.objects;
create policy "Athletes can view own progress photos"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'progress-photos' and
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- Athletes can only upload files into their own folder (folder name equals user_id)
drop policy if exists "Athletes can upload own progress photos" on storage.objects;
create policy "Athletes can upload own progress photos"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'progress-photos' and
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- Athletes can update files in their own folder
drop policy if exists "Athletes can update own progress photos" on storage.objects;
create policy "Athletes can update own progress photos"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'progress-photos' and
    (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'progress-photos' and
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- Athletes can delete files in their own folder
drop policy if exists "Athletes can delete own progress photos" on storage.objects;
create policy "Athletes can delete own progress photos"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'progress-photos' and
    (storage.foldername(name))[1] = auth.uid()::text
  );

