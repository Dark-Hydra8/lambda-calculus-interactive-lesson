# Vercel + Supabase setup

This project is configured to deploy the frontend on **Vercel** and use **Supabase** for the backend (auth and progress tracking). The app runs without Supabase if env vars are not set.

---

## 1. Supabase (backend)

### Create a project

1. Go to [supabase.com](https://supabase.com) and sign in.
2. **New project** → choose org, name (e.g. `lambda-lessons`), database password, region.
3. Wait for the project to be ready.

### Get URL and anon key

1. In the project: **Settings** (gear) → **API**.
2. Copy **Project URL** and **anon public** key (safe to use in the browser).

### Tables and RPC (run in SQL Editor)

Run the following in **Supabase → SQL Editor** to enable auth with ASURite IDs and lesson progress (correct answers without "Show answer"). Security: RLS limits all access to the current user (`auth.uid()`). The increment RPCs use only `auth.uid()` (no client-supplied user id), so users cannot modify other users’ data.

```sql
-- Profiles: store ASURite ID (username) per user
create table if not exists public.profiles (
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

-- Trigger: create profile when a new auth user is created (avoids RLS error on signup)
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  asurite text;
begin
  asurite := coalesce(NEW.raw_user_meta_data->>'asurite_id', split_part(NEW.email, '@', 1));
  insert into public.profiles (id, asurite_id)
  values (NEW.id, asurite);
  return NEW;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Lesson progress: correct answers (without "Show answer") and times completed per user per lesson
create table if not exists public.lesson_progress (
  user_id uuid references auth.users(id) on delete cascade not null,
  lesson_id text not null,
  correct_without_show_answer integer not null default 0,
  times_completed integer not null default 0,
  updated_at timestamptz default now(),
  primary key (user_id, lesson_id)
);

-- If table already exists without times_completed, add the column:
alter table public.lesson_progress add column if not exists times_completed integer not null default 0;

alter table public.lesson_progress enable row level security;

create policy "Users can read own progress"
  on public.lesson_progress for select using (auth.uid() = user_id);

create policy "Users can insert own progress"
  on public.lesson_progress for insert with check (auth.uid() = user_id);

create policy "Users can update own progress"
  on public.lesson_progress for update using (auth.uid() = user_id);

-- RPC: atomically increment correct_without_show_answer for the current user only (uses auth.uid(); client cannot supply user id)
create or replace function public.increment_correct_without_show_answer(p_lesson_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then return; end if;
  insert into lesson_progress (user_id, lesson_id, correct_without_show_answer)
  values (v_user_id, p_lesson_id, 1)
  on conflict (user_id, lesson_id)
  do update set
    correct_without_show_answer = lesson_progress.correct_without_show_answer + 1,
    updated_at = now();
end;
$$;

-- RPC: atomically increment times_completed for the current user only (uses auth.uid())
create or replace function public.increment_lesson_completed(p_lesson_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then return; end if;
  insert into lesson_progress (user_id, lesson_id, correct_without_show_answer, times_completed)
  values (v_user_id, p_lesson_id, 0, 1)
  on conflict (user_id, lesson_id)
  do update set
    times_completed = lesson_progress.times_completed + 1,
    updated_at = now();
end;
$$;
```

---

## 2. Local development

1. Copy env example and fill in your Supabase values:
   ```bash
   cp .env.example .env
   ```
2. Edit `.env`:
   ```
   REACT_APP_SUPABASE_URL=https://xxxx.supabase.co
   REACT_APP_SUPABASE_ANON_KEY=your-anon-key
   ```
3. Run the app: `npm start`. The app works without these vars; add them when you use Supabase.

---

## 3. Vercel (frontend)

### Deploy

1. Push your code to GitHub (can be a private repo).
2. Go to [vercel.com](https://vercel.com) → **Add New** → **Project** → import your repo.
3. Vercel will detect Create React App. Click **Deploy** (no need to change build settings).

### Add Supabase env vars on Vercel

1. Project → **Settings** → **Environment Variables**.
2. Add:
   - `REACT_APP_SUPABASE_URL` = your Supabase project URL
   - `REACT_APP_SUPABASE_ANON_KEY` = your Supabase anon key
3. **Redeploy** (Deployments → ⋮ on latest → Redeploy) so the build picks up the new variables.

After that, the site is served by Vercel and the app can use `supabase` from `src/supabaseClient.ts` for auth and database. Use `isSupabaseConfigured()` before calling Supabase if you want the app to work when env vars are missing.
