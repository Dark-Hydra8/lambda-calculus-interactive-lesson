import React, { useState } from 'react';
import './styles.css';
import { NormalOrderLesson } from './NormalOrderLesson';
import { RedexHighlightLesson } from './RedexHighlightLesson';
import { AlphaRenameLesson } from './AlphaRenameLesson';
import { ApplicationLesson } from './ApplicationLesson';
import { VariableBindingLesson } from './VariableBindingLesson';

type Lesson = 'menu' | 'normal-order' | 'redex-highlight' | 'alpha-rename' | 'application' | 'variable-binding';

const App: React.FC = () => {
  const [currentLesson, setCurrentLesson] = useState<Lesson>('menu');

  if (currentLesson === 'normal-order') {
    return <NormalOrderLesson onBack={() => setCurrentLesson('menu')} />;
  }

  if (currentLesson === 'redex-highlight') {
    return <RedexHighlightLesson onBack={() => setCurrentLesson('menu')} />;
  }

  if (currentLesson === 'alpha-rename') {
    return <AlphaRenameLesson onBack={() => setCurrentLesson('menu')} />;
  }

  if (currentLesson === 'application') {
    return <ApplicationLesson onBack={() => setCurrentLesson('menu')} />;
  }

  if (currentLesson === 'variable-binding') {
    return <VariableBindingLesson onBack={() => setCurrentLesson('menu')} />;
  }

  return (
    <div className="container">
      <h1>Lambda Calculus Interactive Lessons</h1>
      <p style={{ marginBottom: '30px', color: '#666' }}>
        Choose a lesson to begin learning lambda calculus:
      </p>
      
      <div className="lesson-menu">
        <div className="lesson-card" onClick={() => setCurrentLesson('normal-order')}>
          <h2>Normal Order Reduction</h2>
          <p>Practice reducing lambda expressions using normal order evaluation. Enter the reduced form of each expression step by step.</p>
        </div>
        <div className="lesson-card" onClick={() => setCurrentLesson('redex-highlight')}>
          <h2>Redex Highlighting</h2>
          <p>Identify and highlight all redexes (applications where the left side is a lambda abstraction) in lambda calculus expressions.</p>
        </div>
        <div className="lesson-card" onClick={() => setCurrentLesson('alpha-rename')}>
          <h2>Alpha Renaming</h2>
          <p>Learn alpha renaming by selecting which variables in a redex should be renamed to avoid variable capture.</p>
        </div>
        <div className="lesson-card" onClick={() => setCurrentLesson('application')}>
          <h2>Identify Applications</h2>
          <p>Identify and highlight every application (M applied to N, written M N) in lambda calculus expressions.</p>
        </div>
        <div className="lesson-card" onClick={() => setCurrentLesson('variable-binding')}>
          <h2>Variable Binding</h2>
          <p>For each variable in a lambda expression, identify which lambda abstraction it is bound to (or mark it as a free variable).</p>
        </div>
      </div>
    </div>
  );
};

export default App;
