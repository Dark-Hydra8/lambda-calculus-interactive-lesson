/**
 * Lesson identifiers used for progress tracking. Must match lesson keys in App.
 */
export type LessonId =
  | 'application'
  | 'redex-highlight'
  | 'variable-binding'
  | 'alpha-rename'
  | 'normal-order';

export const LESSON_IDS: LessonId[] = [
  'application',
  'redex-highlight',
  'variable-binding',
  'alpha-rename',
  'normal-order',
];

export type LessonProgressRow = {
  user_id: string;
  lesson_id: LessonId;
  correct_without_show_answer: number;
  submissions: number;
  answered_correct: number;
  updated_at?: string;
};

export type ProfileRow = {
  id: string;
  asurite_id: string;
  created_at?: string;
  updated_at?: string;
};
