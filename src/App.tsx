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
  const [lessonProgressReady, setLessonProgressReady] = useState(() => !isSupabaseConfigured());

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
      if (!isSupabaseConfigured()) {
        setLessonProgressReady(true);
        return;
      }
      const { data, error } = await getLessonProgress(identity.userId, identity.authToken);
      if (cancelled) return;
      setLessonProgressReady(true);
      if (error || !data) return;

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
      Good Job!<br />If you are just completing the survey, you can move on to the next lesson. If you want to keep practicing, you can continue. <br />
      When you've finished all lessons, please take the exit survey.
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

  if (!identity) {
    return withLayout(
      <div className="container">
        <p>Loading identity...</p>
      </div>
    );
  }

  if (currentLesson === 'normal-order') {
    return withLayout(
      <>
        <BetaReductionLesson
          userId={identity.userId}
          authToken={identity.authToken}
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
          userId={identity.userId}
          authToken={identity.authToken}
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
          userId={identity.userId}
          authToken={identity.authToken}
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
          userId={identity.userId}
          authToken={identity.authToken}
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
          userId={identity.userId}
          authToken={identity.authToken}
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

  if (!lessonProgressReady && isSupabaseConfigured()) {
    return withLayout(
      <div className="container">
        <p>Loading progress...</p>
      </div>
    );
  }

  return withLayout(
    <div className="container">
      <h1>Lambda Calculus Interactive Lessons</h1>
      <p style={{ marginBottom: '10px', fontSize: '14px', color: '#666' }}>
        User id: <strong>{identity.userId}</strong>
      </p>
      <div style={{ marginTop: '-10px', marginBottom: '24px', display: 'flex', alignItems: 'flex-start', gap: '14px' }}>
        <p style={{ margin: 0, fontSize: '18px', color: '#000', lineHeight: 1.35 }}>
          If you finished taking the practice lessons below, please click here to take the exit survey.
        </p>
        <button
          onClick={() => {
            window.open(endingSurveyUrl, '_blank', 'noopener,noreferrer');
          }}
          aria-label="Post lessons survey"
          title="Post lessons survey"
          style={{
            width: '52px',
            height: '52px',
            borderRadius: '9999px',
            background: '#0D47A1',
            color: '#fff',
            border: 'none',
            fontSize: '22px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 0,
            cursor: 'pointer',
            flexShrink: 0,
          }}
        >
          📄
        </button>
      </div>

      <div style={{ marginBottom: '24px', color: '#000', fontSize: '16px', lineHeight: 1.5 }}>
        <ul style={{ margin: '0 0 12px 20px', padding: 0 }}>
          <li>Click on any of the boxes below to test and practice your knowledge of the given topic.</li>
          <li>
            This website keeps track of your progress. If you consistently answer questions correctly for a given topic,
            a green checkmark will be shown in the corresponding box to highlight your progress.
          </li>
          <li>Open the Info menu (the <code>?</code> button) and read the general guidance before you start.</li>
          <li>Pick a lesson using the cards below (each one practices a single skill).</li>
          <li>Use the Help/Info panel (the ? button) in the top right the lesson content whenever you are stuck.</li>
        </ul>
      </div>
      <p style={{ marginBottom: '14px', color: '#000' }}>Choose a lesson to practice one core skill at a time:</p>
      <p style={{ marginTop: '-6px', marginBottom: '22px', fontSize: '13px', color: '#000', textAlign: 'center' }}>
        ✅ means you're done with that lesson for the survey, but you can keep practicing anytime.
      </p>

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
