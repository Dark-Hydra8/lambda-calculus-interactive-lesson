import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL ?? '';
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY ?? '';

/**
 * Supabase client for auth and database. Null when env vars are not set.
 * Set REACT_APP_SUPABASE_URL and REACT_APP_SUPABASE_ANON_KEY in .env (local) or Vercel env vars.
 */
export const supabase: SupabaseClient | null =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey)
    : null;

export const isSupabaseConfigured = (): boolean => supabase !== null;
