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

### (Optional) Table for lesson progress

To store “user X completed lesson Y”, create a table in the SQL Editor:

```sql
-- Optional: run in Supabase → SQL Editor
create table if not exists public.lesson_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  lesson_id text not null,
  completed_at timestamptz default now(),
  unique(user_id, lesson_id)
);

alter table public.lesson_progress enable row level security;

create policy "Users can read own progress"
  on public.lesson_progress for select
  using (auth.uid() = user_id);

create policy "Users can insert own progress"
  on public.lesson_progress for insert
  with check (auth.uid() = user_id);
```

You can use `supabase.from('lesson_progress').upsert(...)` from the app once auth is wired.

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
