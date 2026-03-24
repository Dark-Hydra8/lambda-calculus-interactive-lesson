import { supabase, isSupabaseConfigured } from '../supabaseClient';
import type { LessonId } from '../supabase/types';
import { clearIdentityCookies } from '../auth/useUserIdentity';

type LessonProgressData = {
  lesson_id: string;
  correct_without_show_answer: number;
  submissions: number;
  answered_correct: number;
};

/** In-memory progress rows per user identity; avoids redundant get_lesson_progress RPCs. */
const submitted_count_cache = new Map<string, LessonProgressData[]>();

/** Dedupes concurrent fetches for the same identity (e.g. App prefetch + AppContent load). */
const progressFetchInflight = new Map<string, Promise<LessonProgressData[]>>();

function progressCacheKey(userId: string, authToken: string): string {
  return `${userId}\0${authToken}`;
}

function bumpCachedLesson(
  userId: string,
  authToken: string,
  lessonId: LessonId,
  field: keyof Pick<LessonProgressData, 'submissions' | 'answered_correct' | 'correct_without_show_answer'>
): void {
  const key = progressCacheKey(userId, authToken);
  const rows = submitted_count_cache.get(key);
  if (!rows) return;

  let found = false;
  const next = rows.map((r) => {
    if (r.lesson_id !== lessonId) return r;
    found = true;
    return { ...r, [field]: (r[field] ?? 0) + 1 };
  });

  if (!found) {
    next.push({
      lesson_id: lessonId,
      correct_without_show_answer: field === 'correct_without_show_answer' ? 1 : 0,
      submissions: field === 'submissions' ? 1 : 0,
      answered_correct: field === 'answered_correct' ? 1 : 0,
    });
  }

  submitted_count_cache.set(key, next);
}

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
    bumpCachedLesson(userId, authToken, lessonId, 'correct_without_show_answer');
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
    bumpCachedLesson(userId, authToken, lessonId, 'submissions');
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
    bumpCachedLesson(userId, authToken, lessonId, 'answered_correct');
    return { error: null };
  } catch (e) {
    const err = e instanceof Error ? e : new Error(String(e));
    if (await clearCookiesAndReloadOnUnauthorized(err)) return { error: err };
    return { error: err };
  }
}

/**
 * Warm `submitted_count_cache` from the server as soon as identity is known (e.g. on app load).
 * Safe to call alongside `getLessonProgress`; concurrent requests share one RPC.
 */
export async function prefetchLessonProgressCache(
  userId: string,
  authToken: string
): Promise<void> {
  await getLessonProgress(userId, authToken);
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
  const key = progressCacheKey(userId, authToken);
  const cached = submitted_count_cache.get(key);
  if (cached) {
    return { data: cached.map((r) => ({ ...r })), error: null };
  }

  let fetchPromise = progressFetchInflight.get(key);
  if (!fetchPromise) {
    fetchPromise = (async (): Promise<LessonProgressData[]> => {
      const { data, error } = await supabase.rpc('get_lesson_progress', {
        p_user_id: userId,
        p_auth_token: authToken,
      });
      if (error) {
        throw new Error(error.message);
      }
      const raw = (data ?? []) as LessonProgressData[];
      return raw.map((r) => ({ ...r }));
    })();
    progressFetchInflight.set(key, fetchPromise);
    fetchPromise.finally(() => {
      progressFetchInflight.delete(key);
    });
  }

  try {
    const rows = await fetchPromise;
    submitted_count_cache.set(key, rows);
    return { data: rows.map((r) => ({ ...r })), error: null };
  } catch (e) {
    const err = e instanceof Error ? e : new Error(String(e));
    return { data: null, error: err };
  }
}

export type DifficultyLevel = 0 | 1 | 2;
export const EASY: DifficultyLevel = 0;
export const MEDIUM: DifficultyLevel = 1;
export const HARD: DifficultyLevel = 2;

/**
 * Synchronous difficulty from `submitted_count_cache` only.
 * Call only after progress for this identity has been loaded (e.g. App gates lessons until
 * `prefetchLessonProgressCache` / `getLessonProgress` has populated the cache).
 */
export function getDifficultyLevel(
  userId: string,
  authToken: string,
  lesson_id: LessonId,
): DifficultyLevel {
  if (!isSupabaseConfigured()) {
    return EASY;
  }
  const key = progressCacheKey(userId, authToken);
  const rows = submitted_count_cache.get(key);
  if (!rows) {
    return EASY;
  }
  const progress = rows.find((r) => r.lesson_id === lesson_id);
  if (!progress || progress.submissions <= 1) {
    return EASY;
  } else if (progress.answered_correct <= 3) {
    return MEDIUM;
  } else {
    return HARD;
  }
}