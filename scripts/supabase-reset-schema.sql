-- Reset Supabase schema: drop app tables/functions and recreate from scratch.
-- Run this in Supabase Dashboard → SQL Editor.
--
-- Cookie-based identity for lesson progress (no Supabase Auth accounts):
--   - user_id: 8 hex digits (leading zeros preserved), sequential allocation
--   - auth_token: 64-char base64 random token (acts like a password)
-- Only calls that provide the matching token can update progress for that id.

-- 1. Drop RPC functions
drop function if exists public.allocate_user_identity();
drop function if exists public.validate_identity(text, text);
drop function if exists public.increment_correct_without_show_answer(text, text, text);
drop function if exists public.increment_submissions(text, text, text);
drop function if exists public.increment_answered_correct(text, text, text);
drop function if exists public.increment_lesson_completed(text, text, text);
drop function if exists public.get_lesson_progress(text, text);

-- 2. Drop tables
drop table if exists public.lesson_progress;
drop table if exists public.profiles;

-- 3. Drop and recreate sequence for sequential user_id allocation
drop sequence if exists public.user_id_seq;
-- b43b3910 hex == 3023780112 decimal
create sequence public.user_id_seq as bigint start with 3023780112 increment by 1;

-- Needed for gen_random_bytes()
create extension if not exists pgcrypto;

-- 4. Profiles: store user_id -> auth_token mapping
create table public.profiles (
  user_id text primary key,
  auth_token text not null unique,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.profiles enable row level security;
-- No policies: direct reads/writes from the client are denied.

-- 5. Lesson progress
create table public.lesson_progress (
  user_id text not null references public.profiles(user_id) on delete cascade,
  lesson_id text not null,
  correct_without_show_answer integer not null default 0,
  submissions integer not null default 0,
  answered_correct integer not null default 0,
  updated_at timestamptz default now(),
  primary key (user_id, lesson_id)
);

alter table public.lesson_progress enable row level security;
-- No policies: direct reads/writes from the client are denied.

-- 6. Allocate a new identity (called when cookies are missing)
create or replace function public.allocate_user_identity()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id text;
  v_auth_token text;
begin
  v_user_id := lpad(lower(to_hex(nextval('public.user_id_seq'))), 8, '0');

  -- 48 bytes -> 64 base64 characters (no padding) for a fixed-length token.
  begin
    -- Prefer pgcrypto's CSPRNG when available.
    execute 'select encode(gen_random_bytes(48), ''base64'')' into v_auth_token;
  exception
    when undefined_function then
      -- Fallback when pgcrypto isn't available in the DB:
      -- Use built-in `md5()` (32 hex chars = 16 bytes) three times, concatenate
      -- to 48 bytes, then base64 encode to produce exactly 64 chars.
      v_auth_token := encode(
        decode(md5(random()::text), 'hex')
        || decode(md5(random()::text), 'hex')
        || decode(md5(random()::text), 'hex'),
        'base64'
      );
  end;

  insert into public.profiles (user_id, auth_token)
  values (v_user_id, v_auth_token);

  return jsonb_build_object('user_id', v_user_id, 'auth_token', v_auth_token);
end;
$$;

-- 7. Validate token for a given user_id
create or replace function public.validate_identity(p_user_id text, p_auth_token text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_token text;
begin
  if p_user_id is null or p_auth_token is null then
    raise exception 'Missing identity';
  end if;

  select auth_token into v_token
  from public.profiles
  where user_id = p_user_id;

  if v_token is null or v_token != p_auth_token then
    raise exception 'Unauthorized';
  end if;
end;
$$;

-- 8. Atomically increment correct_without_show_answer
create or replace function public.increment_correct_without_show_answer(
  p_user_id text,
  p_auth_token text,
  p_lesson_id text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.validate_identity(p_user_id, p_auth_token);

  insert into public.lesson_progress (user_id, lesson_id, correct_without_show_answer)
  values (p_user_id, p_lesson_id, 1)
  on conflict (user_id, lesson_id)
  do update set
    correct_without_show_answer = lesson_progress.correct_without_show_answer + 1,
    updated_at = now();
end;
$$;

-- 9. Atomically increment submissions (count of Submit button clicks)
create or replace function public.increment_submissions(
  p_user_id text,
  p_auth_token text,
  p_lesson_id text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.validate_identity(p_user_id, p_auth_token);

  insert into public.lesson_progress (user_id, lesson_id, correct_without_show_answer, submissions, answered_correct)
  values (p_user_id, p_lesson_id, 0, 1, 0)
  on conflict (user_id, lesson_id)
  do update set
    submissions = lesson_progress.submissions + 1,
    updated_at = now();
end;
$$;

-- 10. Atomically increment answered_correct (count of correct Submit clicks, regardless of "Show answer")
create or replace function public.increment_answered_correct(
  p_user_id text,
  p_auth_token text,
  p_lesson_id text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.validate_identity(p_user_id, p_auth_token);

  insert into public.lesson_progress (user_id, lesson_id, correct_without_show_answer, submissions, answered_correct)
  values (p_user_id, p_lesson_id, 0, 0, 1)
  on conflict (user_id, lesson_id)
  do update set
    answered_correct = lesson_progress.answered_correct + 1,
    updated_at = now();
end;
$$;

-- 11. Fetch progress for a given identity
create or replace function public.get_lesson_progress(
  p_user_id text,
  p_auth_token text
)
returns table (
  lesson_id text,
  correct_without_show_answer integer,
  submissions integer,
  answered_correct integer
)
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.validate_identity(p_user_id, p_auth_token);

  return query
  select lp.lesson_id, lp.correct_without_show_answer, lp.submissions, lp.answered_correct
  from public.lesson_progress lp
  where lp.user_id = p_user_id;
end;
$$;

-- Allow anon to call the required RPCs (token validation happens inside the RPCs).
grant execute on function public.allocate_user_identity() to anon;
grant execute on function public.validate_identity(text, text) to anon;
grant execute on function public.increment_correct_without_show_answer(text, text, text) to anon;
grant execute on function public.increment_submissions(text, text, text) to anon;
grant execute on function public.increment_answered_correct(text, text, text) to anon;
grant execute on function public.get_lesson_progress(text, text) to anon;
