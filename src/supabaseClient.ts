import { createClient, SupabaseClient } from '@supabase/supabase-js';

/**
 * Supabase client for auth and database. Null when env vars are not set.
 * Load REACT_APP_SUPABASE_URL and REACT_APP_SUPABASE_ANON_KEY from .env (project root).
 * Restart the dev server after changing .env. For production, set the same vars in your host (e.g. Vercel).
 */
const supabaseUrl = process.env.REACT_APP_SUPABASE_URL ?? '';
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY ?? '';
export const supabase: SupabaseClient | null =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey)
    : null;

export const isSupabaseConfigured = (): boolean => supabase !== null;
