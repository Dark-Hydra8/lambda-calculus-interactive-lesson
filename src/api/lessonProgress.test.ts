import { recordCorrectAnswerWithoutShowAnswer, getLessonProgress } from './lessonProgress';

jest.mock('../supabaseClient', () => ({
  supabase: null,
  isSupabaseConfigured: () => false,
}));

describe('lessonProgress (Supabase not configured)', () => {
  it('recordCorrectAnswerWithoutShowAnswer returns no error when Supabase is not configured', async () => {
    const result = await recordCorrectAnswerWithoutShowAnswer('application');
    expect(result.error).toBeNull();
  });

  it('getLessonProgress returns null data when Supabase is not configured', async () => {
    const { data, error } = await getLessonProgress('user-123');
    expect(data).toBeNull();
    expect(error).toBeNull();
  });
});
