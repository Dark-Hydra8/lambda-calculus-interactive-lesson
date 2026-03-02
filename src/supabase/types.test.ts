import { LESSON_IDS } from './types';

describe('lesson types', () => {
  it('LESSON_IDS contains expected lesson identifiers', () => {
    expect(LESSON_IDS).toContain('application');
    expect(LESSON_IDS).toContain('redex-highlight');
    expect(LESSON_IDS).toContain('variable-binding');
    expect(LESSON_IDS).toContain('alpha-rename');
    expect(LESSON_IDS).toContain('normal-order');
    expect(LESSON_IDS).toHaveLength(5);
  });
});
