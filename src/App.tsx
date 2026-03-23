import React, { useState, useCallback, useEffect } from 'react';
import './styles.css';
import { BetaReductionLesson } from './BetaReductionLesson';
import { RedexHighlightLesson } from './RedexHighlightLesson';
import { AlphaRenameLesson } from './AlphaRenameLesson';
import { ApplicationLesson } from './ApplicationLesson';
import { VariableBindingLesson } from './VariableBindingLesson';
import { InfoMenu } from './InfoMenu';
import { isSupabaseConfigured } from './supabaseClient';
import {
  recordCorrectAnswerWithoutShowAnswer,
  recordSubmission,
  recordAnsweredCorrect,
  getLessonProgress,
} from './api/lessonProgress';
import type { LessonId } from './supabase/types';
import { useUserIdentity, type UserIdentity } from './auth/useUserIdentity';

type Lesson = 'menu' | 'normal-order' | 'redex-highlight' | 'alpha-rename' | 'application' | 'variable-binding';

const AppContent: React.FC<{ identity: UserIdentity | null; identityLoading: boolean }> = ({
  identity,
  identityLoading,
}) => {
  const [currentLesson, setCurrentLesson] = useState<Lesson>('menu');
  const [hasFinishedSurvey, setHasFinishedSurvey] = useState(false);
  const [answeredCorrectByLesson, setAnsweredCorrectByLesson] = useState<Partial<Record<LessonId, number>>>({});

  const surveyUrl = `https://docs.google.com/forms/d/e/1FAIpQLSeL7gId09NUjrUHAmzw_4Utz9gTNHHMMF-8NweXYCIbPiGbpw/viewform?usp=pp_url&entry.1056977610=${encodeURIComponent(
    identity?.userId ?? ''
  )}&entry.280057424=No`;
  const endingSurveyUrl = `https://docs.google.com/forms/d/e/1FAIpQLSeL7gId09NUjrUHAmzw_4Utz9gTNHHMMF-8NweXYCIbPiGbpw/viewform?usp=pp_url&entry.1056977610=${encodeURIComponent(
    identity?.userId ?? ''
  )}&entry.280057424=Yes`;

  const recordCorrect = useCallback(
    (lessonId: LessonId) => {
      if (!identity || identityLoading) return;
      recordCorrectAnswerWithoutShowAnswer(lessonId, identity.userId, identity.authToken);
    },
    [identity, identityLoading]
  );

  const recordSubmit = useCallback(
    (lessonId: LessonId) => {
      if (!identity || identityLoading) return;
      recordSubmission(lessonId, identity.userId, identity.authToken);
    },
    [identity, identityLoading]
  );

  const recordAnswered = useCallback(
    (lessonId: LessonId) => {
      if (!identity || identityLoading) return;
      recordAnsweredCorrect(lessonId, identity.userId, identity.authToken);
      setAnsweredCorrectByLesson(prev => ({
        ...prev,
        [lessonId]: (prev[lessonId] ?? 0) + 1,
      }));
    },
    [identity, identityLoading]
  );

  useEffect(() => {
    let cancelled = false;

    const loadProgress = async () => {
      if (!identity || identityLoading) return;
      const { data, error } = await getLessonProgress(identity.userId, identity.authToken);
      if (cancelled || error || !data) return;

      const next: Partial<Record<LessonId, number>> = {};
      for (const row of data) {
        const lessonId = row.lesson_id as LessonId;
        next[lessonId] = row.answered_correct ?? 0;
      }
      setAnsweredCorrectByLesson(next);
    };

    loadProgress();
    return () => {
      cancelled = true;
    };
  }, [identity, identityLoading]);

  const hasLessonCheck = (lessonId: LessonId): boolean => (answeredCorrectByLesson[lessonId] ?? 0) >= 4;
  const lessonCompletionMessage = (
    <>
      Congradulations! You have finished this task! <br />
      You can move onto the next one or keep going! <br />
      If you have finished all tasks, it would be greatly appreciated if you took the ending survey!
    </>
  );
  const completionMessage = (lessonId: LessonId) =>
    hasLessonCheck(lessonId) ? (
      <div className="container" style={{ marginTop: '12px' }}>
        <p className="correct">{lessonCompletionMessage}</p>
      </div>
    ) : null;
  const bottomBackToMenuButton = (
    <div className="container" style={{ marginTop: '12px', marginBottom: '20px' }}>
      <button onClick={() => setCurrentLesson('menu')}>← Back to Menu</button>
    </div>
  );

  const withLayout = (content: React.ReactNode) => (
    <>
      <InfoMenu />
      {content}
    </>
  );

  if (currentLesson === 'normal-order') {
    return withLayout(
      <>
        <BetaReductionLesson
          onBack={() => setCurrentLesson('menu')}
          onSubmit={() => recordSubmit('normal-order')}
          onAnsweredCorrect={() => recordAnswered('normal-order')}
          onCorrectWithoutShowAnswer={() => recordCorrect('normal-order')}
        />
        {completionMessage('normal-order')}
        {bottomBackToMenuButton}
      </>
    );
  }

  if (currentLesson === 'redex-highlight') {
    return withLayout(
      <>
        <RedexHighlightLesson
          onBack={() => setCurrentLesson('menu')}
          onSubmit={() => recordSubmit('redex-highlight')}
          onAnsweredCorrect={() => recordAnswered('redex-highlight')}
          onCorrectWithoutShowAnswer={() => recordCorrect('redex-highlight')}
        />
        {completionMessage('redex-highlight')}
        {bottomBackToMenuButton}
      </>
    );
  }

  if (currentLesson === 'alpha-rename') {
    return withLayout(
      <>
        <AlphaRenameLesson
          onBack={() => setCurrentLesson('menu')}
          onSubmit={() => recordSubmit('alpha-rename')}
          onAnsweredCorrect={() => recordAnswered('alpha-rename')}
          onCorrectWithoutShowAnswer={() => recordCorrect('alpha-rename')}
        />
        {completionMessage('alpha-rename')}
        {bottomBackToMenuButton}
      </>
    );
  }

  if (currentLesson === 'application') {
    return withLayout(
      <>
        <ApplicationLesson
          onBack={() => setCurrentLesson('menu')}
          onSubmit={() => recordSubmit('application')}
          onAnsweredCorrect={() => recordAnswered('application')}
          onCorrectWithoutShowAnswer={() => recordCorrect('application')}
        />
        {completionMessage('application')}
        {bottomBackToMenuButton}
      </>
    );
  }

  if (currentLesson === 'variable-binding') {
    return withLayout(
      <>
        <VariableBindingLesson
          onBack={() => setCurrentLesson('menu')}
          onSubmit={() => recordSubmit('variable-binding')}
          onAnsweredCorrect={() => recordAnswered('variable-binding')}
          onCorrectWithoutShowAnswer={() => recordCorrect('variable-binding')}
        />
        {completionMessage('variable-binding')}
        {bottomBackToMenuButton}
      </>
    );
  }

  if (!hasFinishedSurvey) {
    return withLayout(
      <div className="container">
        <h1>Lambda Calculus Interactive Lessons</h1>
        <p style={{ marginBottom: '18px', color: '#666' }}>
          Taking this survey would be greatly appreciated!
        </p>
        <div style={{ marginBottom: '24px' }}>
          <button
            onClick={() => {
              window.open(surveyUrl, '_blank', 'noopener,noreferrer');
            }}
          >
            Take starting survey
          </button>
        </div>
        <button onClick={() => setHasFinishedSurvey(true)}>Finished with survey</button>
      </div>
    );
  }

  return withLayout(
    <div className="container">
      <h1>Lambda Calculus Interactive Lessons</h1>
      <p style={{ marginBottom: '10px', fontSize: '14px', color: '#666' }}>
        User id: <strong>{identity?.userId ?? '—'}</strong>
      </p>
      <p style={{ marginBottom: '12px', color: '#444' }}>
        <strong>Start here:</strong> open the Info menu (the <code>?</code> button) before anything else.
      </p>
      <div style={{ marginBottom: '18px', color: '#555' }}>
        <p style={{ marginBottom: '8px' }}><strong>How to navigate this website:</strong></p>
        <ul style={{ margin: '0 0 0 20px', padding: 0 }}>
          <li>Before anything else, open the Info menu (the <code>?</code> button) and read the general guidance.</li>
          <li>Pick a lesson using the cards below (each one practices a single skill).</li>
          <li>Use the Help/Info panel (the ? button) in the top right the lesson content whenever you need a reminder.</li>
          <li>In a lesson, focus on the highlighted part on the page, choose what the lesson asks for, then click <code>Submit</code>.</li>
          <li>If you get stuck, click <code>Show Answer</code>, then continue with <code>Next Question</code>.</li>
          <li>Use <code>← Back to Menu</code> to switch lessons.</li>
        </ul>
      </div>
      <p style={{ marginBottom: '30px', color: '#666' }}>Choose a lesson to practice one core skill at a time:</p>
      <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'center' }}>
        <button
          onClick={() => {
            window.open(endingSurveyUrl, '_blank', 'noopener,noreferrer');
          }}
          style={{ fontSize: '18px', padding: '12px 24px' }}
        >
          Take ending survey
        </button>
      </div>

      <div className="lesson-menu">
        <div className="lesson-card" onClick={() => setCurrentLesson('application')}>
          <h2>Identify Useful Applications {hasLessonCheck('application') ? '✅' : ''}</h2>
          <p>
            Learn what an application “looks like” in λ-calculus: <code>M N</code>. In this lesson, you will highlight every useful application (where <code>M</code> is not itself an application).
          </p>
        </div>
        <div className="lesson-card" onClick={() => setCurrentLesson('redex-highlight')}>
          <h2>Redex Highlighting {hasLessonCheck('redex-highlight') ? '✅' : ''}</h2>
          <p>
            Learn β-redexes (the next thing you can simplify). A redex has the form <code>(λx.t) u</code>. You will highlight every redex in the expression.
          </p>
        </div>
        <div className="lesson-card" onClick={() => setCurrentLesson('variable-binding')}>
          <h2>Variable Binding {hasLessonCheck('variable-binding') ? '✅' : ''}</h2>
          <p>
            Learn “who owns each variable”: every <code>λx</code> controls the <code>x</code> occurrences in its body. You will select which <code>λ</code> owns each variable occurrence (or choose “free variable” if it is not owned).
          </p>
        </div>
        <div className="lesson-card" onClick={() => setCurrentLesson('normal-order')}>
          <h2>Beta Reduction {hasLessonCheck('normal-order') ? '✅' : ''}</h2>
          <p>
            Practice β-reduction by dragging the argument onto variables that should be replaced in the highlighted redex. Submit after you have marked all replacements for that step.
          </p>
        </div>
        <div className="lesson-card" onClick={() => setCurrentLesson('alpha-rename')}>
          <h2>Alpha Renaming {hasLessonCheck('alpha-rename') ? '✅' : ''}</h2>
          <p>
            Learn α-renaming (changing bound variable names without changing meaning). You will use checkboxes in the highlighted redex to pick which variable needs renaming before substitution.
          </p>
        </div>
      </div>
    </div>
  );
};

const App: React.FC = () => {
  const { identity, loading: identityLoading } = useUserIdentity();

  if (identityLoading) {
    return (
      <div className="container">
        <p>Loading...</p>
      </div>
    );
  }

  // The app can still be used without Supabase; progress sync just won't work.
  return (
    <>
      {!isSupabaseConfigured() && (
        <div className="container" style={{ marginBottom: '16px' }}>
          <p style={{ color: '#666' }}>Supabase not configured. Lesson progress will not sync.</p>
        </div>
      )}
      <AppContent identity={identity} identityLoading={identityLoading} />
    </>
  );
};

export default App;
