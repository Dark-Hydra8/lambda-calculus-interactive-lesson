import {
  EASY,
  MEDIUM,
  HARD,
  type DifficultyLevel,
} from './api/lessonProgress';
import { new_question as newApplicationQuestion } from './ApplicationLesson';
import { new_question as newBetaReductionQuestion } from './BetaReductionLesson';
import { new_question as newRedexQuestion } from './RedexHighlightLesson';
import { new_question as newAlphaRenameQuestion } from './AlphaRenameLesson';
import { new_question as newVariableBindingQuestion } from './VariableBindingLesson';

/**
 * Opt-in only: these checks are slow and randomized. Run with
 * `npm run test:timing` or `RUN_LESSON_TIMING_TESTS=1 npm test`.
 */
const RUN_LESSON_TIMING_TESTS =
  process.env.RUN_LESSON_TIMING_TESTS === '1' ||
  process.env.RUN_LESSON_TIMING_TESTS === 'true';

const LEVEL_CASES: Array<{ level: DifficultyLevel; name: string }> = [
  { level: EASY, name: 'EASY' },
  { level: MEDIUM, name: 'MEDIUM' },
  { level: HARD, name: 'HARD' },
];

const MAX_MS = 1000;
/** Randomized generators can spike; require at least one sub-1s run within a few tries. */
const MAX_ATTEMPTS = 10;

function expectQuestionWithinBudget(generate: () => unknown): void {
  let lastMs = 0;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const t0 = performance.now();
    const q = generate();
    lastMs = performance.now() - t0;
    expect(q).toBeTruthy();
    if (lastMs < MAX_MS) {
      return;
    }
  }
  throw new Error(
    `Expected a run under ${MAX_MS}ms within ${MAX_ATTEMPTS} tries (last run ${lastMs.toFixed(0)}ms)`
  );
}

(RUN_LESSON_TIMING_TESTS ? describe : describe.skip)(
  'question generation finishes within 1s per difficulty',
  () => {
  describe('ApplicationLesson', () => {
    it.each(LEVEL_CASES)('new_question at $name', ({ level }) => {
      expectQuestionWithinBudget(() => newApplicationQuestion(level));
    });
  });

  describe('BetaReductionLesson', () => {
    it.each(LEVEL_CASES)('new_question at $name', ({ level }) => {
      expectQuestionWithinBudget(() => newBetaReductionQuestion(level));
    });
  });

  describe('RedexHighlightLesson', () => {
    it.each(LEVEL_CASES)('new_question at $name', ({ level }) => {
      expectQuestionWithinBudget(() => newRedexQuestion(level));
    });
  });

  describe('AlphaRenameLesson', () => {
    for (let i = 0; i < 15; i++) {
      it.each(LEVEL_CASES)('new_question at $name', ({ level }) => {
        expectQuestionWithinBudget(() => newAlphaRenameQuestion(level));
      });
    }
  });

  describe('VariableBindingLesson', () => {
    it.each(LEVEL_CASES)('new_question at $name', ({ level }) => {
      expectQuestionWithinBudget(() => newVariableBindingQuestion(level));
    });
  });
  }
);
