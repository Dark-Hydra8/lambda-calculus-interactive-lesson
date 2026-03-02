import React, { useState, useCallback, useEffect } from 'react';
import './styles.css';
import { NormalOrderLesson } from './NormalOrderLesson';
import { RedexHighlightLesson } from './RedexHighlightLesson';
import { AlphaRenameLesson } from './AlphaRenameLesson';
import { ApplicationLesson } from './ApplicationLesson';
import { VariableBindingLesson } from './VariableBindingLesson';
import { AuthProvider, useAuth } from './auth/AuthContext';
import { LoginPage } from './auth/LoginPage';
import { SettingsMenu } from './auth/SettingsMenu';
import { SetNewPasswordPage } from './auth/SetNewPasswordPage';
import { isSupabaseConfigured } from './supabaseClient';
import { recordCorrectAnswerWithoutShowAnswer } from './api/lessonProgress';
import type { LessonId } from './supabase/types';

type Lesson = 'menu' | 'normal-order' | 'redex-highlight' | 'alpha-rename' | 'application' | 'variable-binding';

const AppContent: React.FC = () => {
  const auth = useAuth();
  const [currentLesson, setCurrentLesson] = useState<Lesson>('menu');

  const recordCorrect = useCallback(
    (lessonId: LessonId) => {
      if (auth?.user) {
        recordCorrectAnswerWithoutShowAnswer(lessonId);
      }
    },
    [auth?.user]
  );

  const withLayout = (content: React.ReactNode) => (
    <>
      <SettingsMenu />
      {content}
    </>
  );

  if (currentLesson === 'normal-order') {
    return withLayout(<NormalOrderLesson onBack={() => setCurrentLesson('menu')} onCorrectWithoutShowAnswer={() => recordCorrect('normal-order')} />);
  }

  if (currentLesson === 'redex-highlight') {
    return withLayout(<RedexHighlightLesson onBack={() => setCurrentLesson('menu')} onCorrectWithoutShowAnswer={() => recordCorrect('redex-highlight')} />);
  }

  if (currentLesson === 'alpha-rename') {
    return withLayout(<AlphaRenameLesson onBack={() => setCurrentLesson('menu')} onCorrectWithoutShowAnswer={() => recordCorrect('alpha-rename')} />);
  }

  if (currentLesson === 'application') {
    return withLayout(<ApplicationLesson onBack={() => setCurrentLesson('menu')} onCorrectWithoutShowAnswer={() => recordCorrect('application')} />);
  }

  if (currentLesson === 'variable-binding') {
    return withLayout(<VariableBindingLesson onBack={() => setCurrentLesson('menu')} onCorrectWithoutShowAnswer={() => recordCorrect('variable-binding')} />);
  }

  return withLayout(
    <div className="container">
      <h1>Lambda Calculus Interactive Lessons</h1>
      {auth?.profile?.asurite_id && (
        <p style={{ marginBottom: '10px', fontSize: '14px', color: '#666' }}>
          Signed in as <strong>{auth.profile.asurite_id}</strong>
        </p>
      )}
      <p style={{ marginBottom: '30px', color: '#666' }}>
        Choose a lesson to begin learning lambda calculus:
      </p>

      <div className="lesson-menu">
        <div className="lesson-card" onClick={() => setCurrentLesson('application')}>
          <h2>Identify Applications</h2>
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
          <h2>Normal Order Reduction</h2>
          <p>Practice reducing lambda expressions using normal order evaluation. Enter the reduced form of each expression step by step.</p>
        </div>
      </div>
    </div>
  );
};

const App: React.FC = () => {
  const auth = useAuth();
  const [showSetPassword, setShowSetPassword] = useState(false);

  useEffect(() => {
    const hash = typeof window !== 'undefined' ? window.location.hash : '';
    const params = new URLSearchParams(hash.slice(1));
    setShowSetPassword(params.get('type') === 'recovery');
  }, []);

  if (!isSupabaseConfigured()) {
    return (
      <div className="container">
        <h1>Lambda Calculus Interactive Lessons</h1>
        <p style={{ marginTop: '20px', color: '#666', maxWidth: '480px' }}>
          Sign in is required to take lessons. Configure Supabase to enable authentication (see VERCEL_SUPABASE_SETUP.md).
        </p>
      </div>
    );
  }

  if (showSetPassword) {
    return <SetNewPasswordPage onDone={() => setShowSetPassword(false)} />;
  }

  if (auth?.loading) {
    return (
      <div className="container">
        <p>Loading...</p>
      </div>
    );
  }

  if (!auth?.user) {
    return <LoginPage />;
  }

  return <AppContent />;
};

const AppWithAuth: React.FC = () => (
  <AuthProvider>
    <App />
  </AuthProvider>
);

export default AppWithAuth;
