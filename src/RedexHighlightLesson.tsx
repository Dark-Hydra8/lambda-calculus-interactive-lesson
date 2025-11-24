import React, { useState, useMemo } from 'react';
import './styles.css';
import { LambdaObject, Variable, Application, Lambda } from './lambda_ir';
import { random_lambda } from './random_lambda';

type Question = {
  question: LambdaObject;
  questionStr: string;
  correctRedexes: Application[];
};

let questions: Question[] = [];

function new_question(): LambdaObject {
  let lambda: LambdaObject;
  do {
    lambda = random_lambda(["w", "x", "y", "z"], 4);
  } while (lambda.redexes().length === 0);
  return lambda;
}

// Component to render a lambda expression with clickable applications
const LambdaRenderer: React.FC<{
  obj: LambdaObject;
  selectedApplications: Set<Application>;
  onApplicationClick: (app: Application) => void;
  correctRedexes: Set<Application>;
  showAnswers: boolean;
}> = ({ obj, selectedApplications, onApplicationClick, correctRedexes, showAnswers }) => {
  if (obj instanceof Variable) {
    return <span className="lambda-variable">{obj.get_symbol()}</span>;
  } else if (obj instanceof Lambda) {
    const parameter = obj.get_parameter();
    const body = obj.get_body();
    return (
      <span className="lambda-abstraction">
        <span className="lambda-symbol">λ</span>
        <span className="lambda-variable">{parameter.get_symbol()}</span>
        <span className="lambda-dot">.</span>
        <LambdaRenderer
          obj={body}
          selectedApplications={selectedApplications}
          onApplicationClick={onApplicationClick}
          correctRedexes={correctRedexes}
          showAnswers={showAnswers}
        />
      </span>
    );
  } else if (obj instanceof Application) {
    const isSelected = selectedApplications.has(obj);
    const isCorrectRedex = correctRedexes.has(obj);
    const isRedex = obj.get_left() instanceof Lambda;
    
    let className = 'lambda-application';
    if (isSelected) {
      className += ' selected';
    }
    if (showAnswers && isCorrectRedex) {
      className += ' correct-redex';
    }
    if (showAnswers && isSelected && !isCorrectRedex) {
      className += ' incorrect-selection';
    }
    if (showAnswers && !isSelected && isCorrectRedex) {
      className += ' missed-redex';
    }

    const leftNeedsParens = obj.get_left() instanceof Lambda;
    const rightNeedsParens = obj.get_right() instanceof Application || 
                            (obj.get_right() instanceof Lambda && 
                             obj.get_parent() instanceof Application && 
                             (obj.get_parent() as Application).get_left() === obj);

    return (
      <span
        className={className}
        onClick={(e) => {
          e.stopPropagation();
          onApplicationClick(obj);
        }}
        title={isRedex ? "This is a redex (clickable)" : "Application (not a redex)"}
      >
        {leftNeedsParens ? '(' : ''}
        <LambdaRenderer
          obj={obj.get_left()}
          selectedApplications={selectedApplications}
          onApplicationClick={onApplicationClick}
          correctRedexes={correctRedexes}
          showAnswers={showAnswers}
        />
        {leftNeedsParens ? ')' : ''}
        {' '}
        {rightNeedsParens ? '(' : ''}
        <LambdaRenderer
          obj={obj.get_right()}
          selectedApplications={selectedApplications}
          onApplicationClick={onApplicationClick}
          correctRedexes={correctRedexes}
          showAnswers={showAnswers}
        />
        {rightNeedsParens ? ')' : ''}
      </span>
    );
  }
  return null;
};

export const RedexHighlightLesson: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedApplications, setSelectedApplications] = useState<Set<Application>>(new Set());
  const [showResult, setShowResult] = useState(false);
  const [showAnswers, setShowAnswers] = useState(false);
  const [responses, setResponses] = useState<Array<{
    question: LambdaObject;
    questionStr: string;
    selectedRedexes: Application[];
    correctRedexes: Application[];
    isCorrect: boolean;
  }>>([]);

  // Initialize questions
  if (questions.length === 0) {
    const question = new_question();
    const correctRedexes = question.redexes();
    questions.push({
      question,
      questionStr: String(question),
      correctRedexes,
    });
  }

  const currentQuestion = questions[currentIndex];
  const correctRedexesSet = useMemo(() => {
    return new Set(currentQuestion.correctRedexes);
  }, [currentIndex]);

  const handleApplicationClick = (app: Application) => {
    setSelectedApplications((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(app)) {
        newSet.delete(app);
      } else {
        newSet.add(app);
      }
      return newSet;
    });
  };

  const handleSubmit = () => {
    const selectedArray = Array.from(selectedApplications);
    const correctArray = currentQuestion.correctRedexes;
    
    // Check if all correct redexes are selected and no incorrect ones
    const selectedSet = new Set(selectedArray);
    const correctSet = new Set(correctArray);
    
    const allCorrectSelected = correctArray.every(redex => selectedSet.has(redex));
    const noIncorrectSelected = selectedArray.every(app => correctSet.has(app));
    const isCorrect = allCorrectSelected && noIncorrectSelected && selectedArray.length === correctArray.length;

    const response = {
      question: currentQuestion.question,
      questionStr: currentQuestion.questionStr,
      selectedRedexes: selectedArray,
      correctRedexes: correctArray,
      isCorrect,
    };

    setResponses([...responses, response]);

    if (isCorrect) {
      // Generate new question
      const newQuestion = new_question();
      const newCorrectRedexes = newQuestion.redexes();
      questions.push({
        question: newQuestion,
        questionStr: String(newQuestion),
        correctRedexes: newCorrectRedexes,
      });
      setCurrentIndex(currentIndex + 1);
      setSelectedApplications(new Set());
      setShowAnswers(false);
    } else {
      setShowAnswers(true);
    }
  };

  const handleNext = () => {
    if (currentIndex + 1 < questions.length) {
      setCurrentIndex(currentIndex + 1);
      setSelectedApplications(new Set());
      setShowAnswers(false);
    } else {
      setShowResult(true);
    }
  };

  const handleReset = () => {
    setSelectedApplications(new Set());
    setShowAnswers(false);
  };

  return (
    <div className="container">
      <div style={{ marginBottom: '20px' }}>
        <button onClick={onBack} style={{ marginBottom: '10px' }}>← Back to Menu</button>
      </div>
      <h1>Highlight the Redexes</h1>
      <p style={{ marginBottom: '20px', color: '#666' }}>
        Click on all redexes (applications where the left side is a lambda abstraction) in the expression below.
      </p>

      {responses.map((res, idx) => (
        <div key={idx} className="response">
          <p><strong>Expression:</strong> {res.questionStr}</p>
          <p>
            {res.isCorrect ? (
              <span className="correct">
                Correct! You found all {res.correctRedexes.length} redex{res.correctRedexes.length !== 1 ? 'es' : ''}.
              </span>
            ) : (
              <span className="incorrect">
                Incorrect. You selected {res.selectedRedexes.length} redex{res.selectedRedexes.length !== 1 ? 'es' : ''}, 
                but there {res.correctRedexes.length === 1 ? 'is' : 'are'} {res.correctRedexes.length} correct redex{res.correctRedexes.length !== 1 ? 'es' : ''}.
              </span>
            )}
          </p>
        </div>
      ))}

      {!showResult ? (
        <div className="question-block">
          <div style={{ 
            marginBottom: '20px', 
            padding: '20px', 
            backgroundColor: '#f9f9f9', 
            border: '2px solid #dcdcdc',
            borderRadius: '8px',
            fontSize: '18px',
            fontFamily: 'monospace',
            lineHeight: '1.8'
          }}>
            <LambdaRenderer
              obj={currentQuestion.question}
              selectedApplications={selectedApplications}
              onApplicationClick={handleApplicationClick}
              correctRedexes={correctRedexesSet}
              showAnswers={showAnswers}
            />
          </div>
          
          <div style={{ marginBottom: '10px' }}>
            <p>
              <strong>Selected:</strong> {selectedApplications.size} redex{selectedApplications.size !== 1 ? 'es' : ''}
              {showAnswers && (
                <span> | <strong>Correct:</strong> {currentQuestion.correctRedexes.length} redex{currentQuestion.correctRedexes.length !== 1 ? 'es' : ''}</span>
              )}
            </p>
          </div>

          {showAnswers && (
            <div style={{ 
              marginBottom: '15px', 
              padding: '10px', 
              backgroundColor: '#fff3cd', 
              border: '1px solid #ffc107',
              borderRadius: '4px',
              fontSize: '14px'
            }}>
              <p style={{ margin: 0 }}>
                <strong>Legend:</strong>{' '}
                <span style={{ backgroundColor: '#d4edda', padding: '2px 6px', borderRadius: '3px' }}>Green</span> = Correct redex,{' '}
                <span style={{ backgroundColor: '#f8d7da', padding: '2px 6px', borderRadius: '3px' }}>Red</span> = Incorrect selection,{' '}
                <span style={{ backgroundColor: '#fff3cd', padding: '2px 6px', borderRadius: '3px' }}>Yellow</span> = Missed redex
              </p>
            </div>
          )}

          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <button onClick={handleSubmit} disabled={showAnswers}>
              Submit
            </button>
            {showAnswers && (
              <>
                <button onClick={handleReset}>Try Again</button>
                <button onClick={handleNext}>Next Question</button>
              </>
            )}
          </div>
        </div>
      ) : (
        <div>
          <h2>Finished!</h2>
          <p>You've completed all questions. Great job identifying redexes!</p>
        </div>
      )}
    </div>
  );
};

