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

Run the following in **Supabase → SQL Editor** to set up lesson progress using cookie-based identities (no Supabase Auth accounts).

Security model:
- The client stores `user_id` in a cookie and also stores an `auth_token` (acts like a password).
- The RPCs require `(p_user_id, p_auth_token)` and validate that the token matches the stored profile before updating progress.

You can use the repo script: `scripts/supabase-reset-schema.sql`.

```sql
-- See scripts/supabase-reset-schema.sql for the full schema + RPCs.
-- Key RPCs expected by the frontend:
--   - public.allocate_user_identity() -> jsonb { user_id, auth_token }
--   - public.increment_correct_without_show_answer(p_user_id text, p_auth_token text, p_lesson_id text)
--   - public.increment_submissions(p_user_id text, p_auth_token text, p_lesson_id text)
--   - public.increment_answered_correct(p_user_id text, p_auth_token text, p_lesson_id text)
--   - public.get_lesson_progress(p_user_id text, p_auth_token text) -> lesson_id + correct_without_show_answer + submissions + answered_correct
```

---

---

## 2. Resend (not needed)

This project no longer uses Supabase Auth email flows, so you do not need Resend or SMTP configuration for lesson progress.

## 3. Local development

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

## 4. Vercel (frontend)

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
