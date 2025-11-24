import React, { useState } from 'react';
import './styles.css';
import { NormalOrderLesson } from './NormalOrderLesson';

type Lesson = 'menu' | 'normal-order';

const App: React.FC = () => {
  const [currentLesson, setCurrentLesson] = useState<Lesson>('menu');

  if (currentLesson === 'normal-order') {
    return <NormalOrderLesson onBack={() => setCurrentLesson('menu')} />;
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
      </div>
    </div>
  );
};

export default App;
