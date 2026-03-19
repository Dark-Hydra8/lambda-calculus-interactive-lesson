import { supabase, isSupabaseConfigured } from '../supabaseClient';
import type { LessonId } from '../supabase/types';
import { clearIdentityCookies } from '../auth/useUserIdentity';

/**
 * Record one correct answer (without using "Show answer") for the current user.
 * Uses a cookie-based identity (user id + auth token) to ensure only the
 * correct token can update lesson progress for that id.
 * No-op if Supabase is not configured.
 */
export async function recordCorrectAnswerWithoutShowAnswer(
  lessonId: LessonId,
  userId: string,
  authToken: string
): Promise<{ error: Error | null }> {
  if (!isSupabaseConfigured() || !supabase) {
    return { error: null };
  }
  try {
    const { error } = await supabase.rpc('increment_correct_without_show_answer', {
      p_user_id: userId,
      p_auth_token: authToken,
      p_lesson_id: lessonId,
    });
    if (error) {
      if (error.message && error.message.toLowerCase().includes('unauthorized')) {
        // Identity token no longer matches the server-side profile (e.g. after schema/RPC changes).
        // Clear local cookies so we allocate a fresh user_id/auth_token on next load.
        clearIdentityCookies();
        if (typeof window !== 'undefined') {
          window.location.reload();
        }
      }
      console.error('[Progress] Failed to sync correct answer:', {
        lessonId,
        userId,
        // avoid logging token
        message: error.message,
      });
      return { error };
    }
    console.log('[Progress] Synced correct answer for lesson:', lessonId);
    return { error: null };
  } catch (e) {
    const err = e instanceof Error ? e : new Error(String(e));
    console.error('[Progress] Unexpected exception while syncing progress:', {
      lessonId,
      userId,
      message: err.message,
    });
    return { error: err };
  }
}

async function clearCookiesAndReloadOnUnauthorized(
  error: Error,
): Promise<boolean> {
  const msg = (error.message ?? '').toLowerCase();
  if (msg.includes('unauthorized')) {
    clearIdentityCookies();
    if (typeof window !== 'undefined') window.location.reload();
    return true;
  }
  return false;
}

/**
 * Record that the user clicked "Submit" for the current question.
 */
export async function recordSubmission(
  lessonId: LessonId,
  userId: string,
  authToken: string
): Promise<{ error: Error | null }> {
  if (!isSupabaseConfigured() || !supabase) return { error: null };
  try {
    const { error } = await supabase.rpc('increment_submissions', {
      p_user_id: userId,
      p_auth_token: authToken,
      p_lesson_id: lessonId,
    });
    if (error) {
      if (await clearCookiesAndReloadOnUnauthorized(error)) return { error };
      return { error };
    }
    return { error: null };
  } catch (e) {
    const err = e instanceof Error ? e : new Error(String(e));
    if (await clearCookiesAndReloadOnUnauthorized(err)) return { error: err };
    return { error: err };
  }
}

/**
 * Record that the user submitted a correct answer (regardless of whether
 * "Show answer" was clicked).
 */
export async function recordAnsweredCorrect(
  lessonId: LessonId,
  userId: string,
  authToken: string
): Promise<{ error: Error | null }> {
  if (!isSupabaseConfigured() || !supabase) return { error: null };
  try {
    const { error } = await supabase.rpc('increment_answered_correct', {
      p_user_id: userId,
      p_auth_token: authToken,
      p_lesson_id: lessonId,
    });
    if (error) {
      if (await clearCookiesAndReloadOnUnauthorized(error)) return { error };
      return { error };
    }
    return { error: null };
  } catch (e) {
    const err = e instanceof Error ? e : new Error(String(e));
    if (await clearCookiesAndReloadOnUnauthorized(err)) return { error: err };
    return { error: err };
  }
}

/**
 * Fetch progress counts for the given cookie identity.
 */
export async function getLessonProgress(
  userId: string,
  authToken: string
): Promise<{
  data:
    | Array<{
        lesson_id: string;
        correct_without_show_answer: number;
        submissions: number;
        answered_correct: number;
      }>
    | null;
  error: Error | null;
}> {
  if (!isSupabaseConfigured() || !supabase) {
    return { data: null, error: null };
  }
  const { data, error } = await supabase.rpc('get_lesson_progress', {
    p_user_id: userId,
    p_auth_token: authToken,
  });
  if (error) {
    return { data: null, error };
  }
  return { data: data ?? [], error: null };
}
