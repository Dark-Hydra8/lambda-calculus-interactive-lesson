import React, { useState } from 'react';
import './styles.css';
import { NormalOrderLesson } from './NormalOrderLesson';
import { RedexHighlightLesson } from './RedexHighlightLesson';
import { AlphaRenameLesson } from './AlphaRenameLesson';

type Lesson = 'menu' | 'normal-order' | 'redex-highlight' | 'alpha-rename';

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
      </div>
    </div>
  );
};

export default App;
