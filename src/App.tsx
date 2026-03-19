import React, { useState, useCallback } from 'react';
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
} from './api/lessonProgress';
import type { LessonId } from './supabase/types';
import { useUserIdentity, type UserIdentity } from './auth/useUserIdentity';

type Lesson = 'menu' | 'normal-order' | 'redex-highlight' | 'alpha-rename' | 'application' | 'variable-binding';

const AppContent: React.FC<{ identity: UserIdentity | null; identityLoading: boolean }> = ({
  identity,
  identityLoading,
}) => {
  const [currentLesson, setCurrentLesson] = useState<Lesson>('menu');

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
    },
    [identity, identityLoading]
  );

  const withLayout = (content: React.ReactNode) => (
    <>
      <InfoMenu />
      {content}
    </>
  );

  if (currentLesson === 'normal-order') {
    return withLayout(
      <BetaReductionLesson
        onBack={() => setCurrentLesson('menu')}
        onSubmit={() => recordSubmit('normal-order')}
        onAnsweredCorrect={() => recordAnswered('normal-order')}
        onCorrectWithoutShowAnswer={() => recordCorrect('normal-order')}
      />
    );
  }

  if (currentLesson === 'redex-highlight') {
    return withLayout(
      <RedexHighlightLesson
        onBack={() => setCurrentLesson('menu')}
        onSubmit={() => recordSubmit('redex-highlight')}
        onAnsweredCorrect={() => recordAnswered('redex-highlight')}
        onCorrectWithoutShowAnswer={() => recordCorrect('redex-highlight')}
      />
    );
  }

  if (currentLesson === 'alpha-rename') {
    return withLayout(
      <AlphaRenameLesson
        onBack={() => setCurrentLesson('menu')}
        onSubmit={() => recordSubmit('alpha-rename')}
        onAnsweredCorrect={() => recordAnswered('alpha-rename')}
        onCorrectWithoutShowAnswer={() => recordCorrect('alpha-rename')}
      />
    );
  }

  if (currentLesson === 'application') {
    return withLayout(
      <ApplicationLesson
        onBack={() => setCurrentLesson('menu')}
        onSubmit={() => recordSubmit('application')}
        onAnsweredCorrect={() => recordAnswered('application')}
        onCorrectWithoutShowAnswer={() => recordCorrect('application')}
      />
    );
  }

  if (currentLesson === 'variable-binding') {
    return withLayout(
      <VariableBindingLesson
        onBack={() => setCurrentLesson('menu')}
        onSubmit={() => recordSubmit('variable-binding')}
        onAnsweredCorrect={() => recordAnswered('variable-binding')}
        onCorrectWithoutShowAnswer={() => recordCorrect('variable-binding')}
      />
    );
  }

  return withLayout(
    <div className="container">
      <h1>Lambda Calculus Interactive Lessons</h1>
      <p style={{ marginBottom: '10px', fontSize: '14px', color: '#666' }}>
        User id: <strong>{identity?.userId ?? '—'}</strong>
      </p>
      <p style={{ marginBottom: '30px', color: '#666' }}>
        Choose a lesson to begin learning lambda calculus:
      </p>

      <div className="lesson-menu">
        <div className="lesson-card" onClick={() => setCurrentLesson('application')}>
          <h2>Identfy Useful Applications</h2>
          <p>Identify and highlight every application (M applied to N, written M N) in lambda calculus expressions.</p>
        </div>
        <div className="lesson-card" onClick={() => setCurrentLesson('redex-highlight')}>
          <h2>Redex Highlighting</h2>
          <p>Identify and highlight all redexes (applications where the left side is a lambda abstraction) in lambda calculus expressions.</p>
        </div>
        <div className="lesson-card" onClick={() => setCurrentLesson('variable-binding')}>
          <h2>Variable Binding</h2>
          <p>For each variable in a lambda expression, identify which lambda abstraction it is bound to (or mark it as a free variable).</p>
        </div>
        <div className="lesson-card" onClick={() => setCurrentLesson('alpha-rename')}>
          <h2>Alpha Renaming</h2>
          <p>Learn alpha renaming by selecting which variables in a redex should be renamed to avoid variable capture.</p>
        </div>
        <div className="lesson-card" onClick={() => setCurrentLesson('normal-order')}>
          <h2>Beta Reduction</h2>
          <p>Practice beta reduction. Enter the reduced form of each expression step by step.</p>
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
