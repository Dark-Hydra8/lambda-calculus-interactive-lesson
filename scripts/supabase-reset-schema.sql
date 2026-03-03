-- Reset Supabase schema: drop app tables/functions and recreate from scratch.
-- Run this in Supabase Dashboard → SQL Editor. Does not touch auth.users.

-- 1. Drop RPC functions (depend on lesson_progress)
drop function if exists public.increment_correct_without_show_answer(uuid, text);
drop function if exists public.increment_correct_without_show_answer(text);
drop function if exists public.increment_lesson_completed(uuid, text);
drop function if exists public.increment_lesson_completed(text);

-- 2. Drop trigger that creates profile on signup (depends on profiles)
drop trigger if exists on_auth_user_created on auth.users;

-- 3. Drop tables (lesson_progress first; profiles has no FK from lesson_progress)
drop table if exists public.lesson_progress;
drop table if exists public.profiles;

-- 4. Profiles: store ASURite ID (username) per user
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  asurite_id text not null unique,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.profiles enable row level security;

create policy "Users can read own profile"
  on public.profiles for select using (auth.uid() = id);

create policy "Users can insert own profile"
  on public.profiles for insert with check (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update using (auth.uid() = id);

-- Trigger: create profile when a new auth user is created (avoids RLS on client insert).
-- Fallback for asurite_id uses user id so it is always unique (avoids "Database error saving new user" when email local part would duplicate).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  asurite text;
begin
  asurite := coalesce(nullif(trim(NEW.raw_user_meta_data->>'asurite_id'), ''), NEW.id::text);
  insert into public.profiles (id, asurite_id)
  values (NEW.id, asurite);
  return NEW;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 5. Lesson progress: correct answers (without "Show answer") and times completed per user per lesson
create table public.lesson_progress (
  user_id uuid references auth.users(id) on delete cascade not null,
  lesson_id text not null,
  correct_without_show_answer integer not null default 0,
  times_completed integer not null default 0,
  updated_at timestamptz default now(),
  primary key (user_id, lesson_id)
);

alter table public.lesson_progress enable row level security;

create policy "Users can read own progress"
  on public.lesson_progress for select using (auth.uid() = user_id);

create policy "Users can insert own progress"
  on public.lesson_progress for insert with check (auth.uid() = user_id);

create policy "Users can update own progress"
  on public.lesson_progress for update using (auth.uid() = user_id);

-- 6. RPC: atomically increment correct_without_show_answer for the current user (auth.uid() only; ignores client-supplied user id)
create or replace function public.increment_correct_without_show_answer(p_lesson_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    return;
  end if;
  insert into lesson_progress (user_id, lesson_id, correct_without_show_answer)
  values (v_user_id, p_lesson_id, 1)
  on conflict (user_id, lesson_id)
  do update set
    correct_without_show_answer = lesson_progress.correct_without_show_answer + 1,
    updated_at = now();
end;
$$;

-- 7. RPC: atomically increment times_completed for the current user (auth.uid() only)
create or replace function public.increment_lesson_completed(p_lesson_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    return;
  end if;
  insert into lesson_progress (user_id, lesson_id, correct_without_show_answer, times_completed)
  values (v_user_id, p_lesson_id, 0, 1)
  on conflict (user_id, lesson_id)
  do update set
    times_completed = lesson_progress.times_completed + 1,
    updated_at = now();
end;
$$;
