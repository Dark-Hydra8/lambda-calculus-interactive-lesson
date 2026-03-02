# Scripts

## supabase-reset-schema.sql

Clears the app’s Supabase tables and functions, then recreates the full schema (profiles, lesson_progress, RLS policies, and RPCs). Does **not** modify `auth.users`.

**How to run**

1. Open your project in [Supabase Dashboard](https://app.supabase.com).
2. Go to **SQL Editor**.
3. Paste the contents of `supabase-reset-schema.sql` and click **Run**.

All data in `profiles` and `lesson_progress` will be removed.
