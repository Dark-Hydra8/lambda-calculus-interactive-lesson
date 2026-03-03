import { supabase, isSupabaseConfigured } from '../supabaseClient';
import type { LessonId } from '../supabase/types';

/**
 * Record one correct answer (without using "Show answer") for the current user.
 * Uses the server session (auth.uid()); client cannot supply user id.
 * No-op if Supabase is not configured or user is not signed in.
 */
export async function recordCorrectAnswerWithoutShowAnswer(lessonId: LessonId): Promise<{ error: Error | null }> {
  if (!isSupabaseConfigured() || !supabase) {
    return { error: null };
  }
  const { error } = await supabase.rpc('increment_correct_without_show_answer', {
    p_lesson_id: lessonId,
  });
  if (error) {
    return { error };
  }
  console.log('[Progress] Synced correct answer for lesson:', lessonId);
  return { error: null };
}

/**
 * Fetch progress counts for the current user. RLS ensures only own rows are returned.
 * Returns null if not configured or not signed in.
 */
export async function getLessonProgress(
  userId: string
): Promise<{ data: Array<{ lesson_id: string; correct_without_show_answer: number }> | null; error: Error | null }> {
  if (!isSupabaseConfigured() || !supabase) {
    return { data: null, error: null };
  }
  const { data, error } = await supabase
    .from('lesson_progress')
    .select('lesson_id, correct_without_show_answer');
  if (error) {
    return { data: null, error };
  }
  return { data: data ?? [], error: null };
}
