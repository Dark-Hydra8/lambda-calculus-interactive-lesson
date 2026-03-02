import React, { useState } from 'react';
import './styles.css';
import { LambdaObject, Variable, Application, Lambda } from './lambda_ir';
import { Parser } from './parser';
import { random_lambda } from './random_lambda';
import { LambdaLexerError, LambdaSyntaxError } from './lexer';
import { renderStringWithColoredParens } from './coloredParens';

type Question = {
  question: LambdaObject;
  questionStr: string;
  answer: LambdaObject;
  answerStr: string;
};

type Response = {
  lambdaExpr: LambdaObject;
  lambdaExprStr: string;
  userAnswer: LambdaObject;
  userAnswerStr: string;
  correctAnswer: LambdaObject;
  correctAnswerStr: string;
  isCorrect: boolean;
};

function has_variable(obj: LambdaObject, vari: Variable) : boolean {
  if (obj instanceof Variable) {
    return obj.get_symbol() === vari.get_symbol();
  } else if (obj instanceof Application) {
    return has_variable(obj.get_left(), vari) || has_variable(obj.get_right(), vari);
  } else if (obj instanceof Lambda) {
    return obj.get_parameter().get_symbol() !== vari.get_symbol() && has_variable(obj.get_body(), vari);
  }
  return false;
}

function count_redexes(obj: LambdaObject) : number {
  let redexes = 0;
  for (let redex of obj.redexes()) {
    console.log(`redex ${redex}`);
    let lambda = (redex as Application).get_left() as Lambda;
    console.log(`lambda ${lambda}`);
    if (has_variable(lambda.get_body(), lambda.get_parameter())) {
      redexes++;
    }
  }
  return redexes;
}

function new_question() : LambdaObject {
  let lambda: LambdaObject;
  let redexes = Math.floor(2 * Math.random()) + 1;
  let vari: Variable | null = null;
  let body: LambdaObject | null = null;
  do {
    lambda = random_lambda(["w", "x", "y", "z"], 4);
    let norm = lambda.norm_ord_redex();
    if (norm === null) {
	    continue;
    }
    let l = norm.get_left() as Lambda;
    vari = l.get_parameter();
    body = l.get_body();
  } while (lambda.redexes().length < redexes || !(body !== null && vari !== null && has_variable(body, vari)));
  return lambda;
}

let questions: Question[] = [];

type SubmitResult = {
  userAnswer: LambdaObject;
  userAnswerStr: string;
  correctAnswer: LambdaObject;
  correctAnswerStr: string;
  isCorrect: boolean;
  parseErrorMessage?: string;
};

export const NormalOrderLesson: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [userAnswer, setUserAnswer] = useState('');
  const [responses, setResponses] = useState<Response[]>([]);
  const [showResult, setShowResult] = useState(false);
  const [inputError, setInputError] = useState<string | null>(null);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [submitResult, setSubmitResult] = useState<SubmitResult | null>(null);
  const [showCorrectAnswerForCurrent, setShowCorrectAnswerForCurrent] = useState(false);

  if (questions.length === 0) {
    let question = new_question();
    let answer = question.copy();
    let redex = answer.norm_ord_redex();
    if (redex === answer) {
      answer = redex.reduce();
    } else if (redex !== null) {
      redex.reduce();
    } else {
      throw new Error("inital statement has no redex");
    }
    if (redex !== null) {
      questions.push({question, questionStr: String(question), answer, answerStr: String(answer)});
    } else {
      throw Error("No redex found");
    }
  }

  const handleSubmit = () => {
    const correctAnswer = questions[currentIndex].answer;
    const trimmed = userAnswer.trim();
    if (trimmed === '') {
      setInputError(null);
      setSubmitResult({
        userAnswer: new Variable('_'),
        userAnswerStr: '',
        correctAnswer,
        correctAnswerStr: String(correctAnswer),
        isCorrect: false,
      });
      setIsSubmitted(true);
      return;
    }
    let parsedAnswer: LambdaObject;
    try {
      parsedAnswer = (new Parser(userAnswer).parse_input() as LambdaObject[])[0];
    } catch (error) {
      if (error instanceof LambdaSyntaxError || error instanceof LambdaLexerError) {
        setInputError(null);
        setSubmitResult({
          userAnswer: new Variable('_'),
          userAnswerStr: '(parse error)',
          correctAnswer,
          correctAnswerStr: String(correctAnswer),
          isCorrect: false,
          parseErrorMessage: error.message,
        });
        setIsSubmitted(true);
        return;
      }
      throw error;
    }
    setInputError(null);
    const isCorrect = parsedAnswer.eq(correctAnswer, null);
    setSubmitResult({
      userAnswer: parsedAnswer,
      userAnswerStr: String(parsedAnswer),
      correctAnswer,
      correctAnswerStr: String(correctAnswer),
      isCorrect,
    });
    setIsSubmitted(true);
  };

  const handleReset = () => {
    setIsSubmitted(false);
    setSubmitResult(null);
    setShowCorrectAnswerForCurrent(false);
  };

  const handleNext = () => {
    if (submitResult === null) return;
    const current = questions[currentIndex];
    const newResponse: Response = {
      lambdaExpr: current.question,
      lambdaExprStr: current.questionStr,
      userAnswer: submitResult.userAnswer,
      userAnswerStr: submitResult.parseErrorMessage ?? submitResult.userAnswerStr,
      correctAnswer: submitResult.correctAnswer,
      correctAnswerStr: submitResult.correctAnswerStr,
      isCorrect: submitResult.isCorrect,
    };
    setResponses([...responses, newResponse]);
    setSubmitResult(null);
    setIsSubmitted(false);
    setUserAnswer('');
    setShowCorrectAnswerForCurrent(false);

    const question = new_question();
    let answer = question.copy();
    let redex = answer.norm_ord_redex();
    if (redex === answer) {
      answer = redex.reduce();
    } else if (redex !== null) {
      redex.reduce();
    }
    if (redex !== null) {
      questions.push({
        question,
        questionStr: String(question),
        answer,
        answerStr: String(answer),
      });
    }

    if (currentIndex + 1 < questions.length) {
      setCurrentIndex(currentIndex + 1);
    } else {
      setShowResult(true);
    }
  };

  return (
    <div className="container">
      <div style={{ marginBottom: '20px' }}>
        <button onClick={onBack} style={{ marginBottom: '10px' }}>← Back to Menu</button>
      </div>
      <h1>Normal Order Reduction</h1>
      <p style={{ marginBottom: '20px', color: '#333', whiteSpace: 'pre-line' }}>
        Reduce each expression using normal order evaluation. Enter the result in the text box and submit.
      </p>

      {responses.length > 0 && (
        <div style={{ marginBottom: '24px' }}>
          <h2 style={{ fontSize: '18px', marginBottom: '12px' }}>Previous questions</h2>
          {responses.map((res, idx) => (
            <div
              key={idx}
              className="response"
              style={{
                marginBottom: '16px',
                padding: '12px 16px',
                backgroundColor: '#f5f5f5',
                border: '1px solid #ddd',
                borderRadius: '8px',
              }}
            >
              <p style={{ marginBottom: '8px', fontSize: '14px', color: '#666' }}><strong>Question:</strong></p>
              <div
                style={{
                  fontSize: '18px',
                  fontFamily: 'monospace',
                  lineHeight: '2',
                  marginBottom: '8px',
                }}
              >
                {renderStringWithColoredParens(res.lambdaExprStr, { keyPrefix: `norm-prev-q-${idx}` })}
              </div>
              <p style={{ marginBottom: '8px', fontSize: '14px', color: '#666' }}><strong>Answer:</strong></p>
              <div
                style={{
                  fontSize: '18px',
                  fontFamily: 'monospace',
                  lineHeight: '2',
                  marginBottom: '8px',
                }}
              >
                {res.isCorrect && renderStringWithColoredParens(res.correctAnswerStr, { keyPrefix: `norm-prev-ans-${idx}` })}
                {!res.isCorrect && (
                  <>
                    {res.userAnswerStr === '' ? (
                      <em>No answer given</em>
                    ) : (
                      renderStringWithColoredParens(res.userAnswerStr, { keyPrefix: `norm-prev-user-${idx}` })
                    )}
                    <p style={{ marginTop: '8px', marginBottom: 0, fontSize: '14px', fontFamily: 'inherit' }}>Correct answer:</p>
                    {renderStringWithColoredParens(res.correctAnswerStr, { keyPrefix: `norm-prev-correct-${idx}` })}
                  </>
                )}
              </div>
              <p style={{ margin: 0, fontSize: '14px' }}>
                {res.isCorrect ? (
                  <span className="correct">✓ Correct</span>
                ) : (
                  <span className="incorrect">✗ Incorrect</span>
                )}
              </p>
            </div>
          ))}
        </div>
      )}

      {!showResult ? (
        <div className="question-block">
          <div
            style={{
              marginBottom: '24px',
              padding: '20px',
              backgroundColor: '#f9f9f9',
              border: '2px solid #ddd',
              borderRadius: '8px',
              fontSize: '18px',
              fontFamily: 'monospace',
              lineHeight: '2.2',
              minHeight: '60px',
            }}
          >
            <p style={{ marginBottom: '8px', fontSize: '14px', color: '#666' }}><strong>Reduce:</strong></p>
            <div style={{ marginBottom: '12px' }}>
              {renderStringWithColoredParens(questions[currentIndex].questionStr, { keyPrefix: 'norm' })}
            </div>
            <input
              type="text"
              value={userAnswer}
              onChange={(e) => setUserAnswer(e.target.value)}
              placeholder="Reduced expression"
              disabled={isSubmitted}
              style={{ width: '100%', padding: '8px 12px', fontSize: '16px', fontFamily: 'monospace', boxSizing: 'border-box' }}
            />
            {inputError && <p className="error-message" style={{ marginTop: '8px', marginBottom: 0 }}>{inputError}</p>}
          </div>
          {isSubmitted && submitResult !== null && (
            <p style={{ marginBottom: '12px' }}>
              {submitResult.isCorrect ? (
                <span className="correct">✓ Correct.</span>
              ) : submitResult.parseErrorMessage ? (
                <span className="incorrect">✗ {submitResult.parseErrorMessage}</span>
              ) : (
                <span className="incorrect">✗ Incorrect.</span>
              )}
            </p>
          )}
          {isSubmitted && submitResult !== null && !submitResult.isCorrect && showCorrectAnswerForCurrent && (
            <div style={{ marginBottom: '12px', fontSize: '18px', fontFamily: 'monospace', lineHeight: '2' }}>
              <p style={{ marginBottom: '4px', fontSize: '14px', color: '#666' }}><strong>Correct answer:</strong></p>
              {renderStringWithColoredParens(submitResult.correctAnswerStr, { keyPrefix: 'norm-current-correct' })}
            </div>
          )}
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <button onClick={handleSubmit} disabled={isSubmitted}>Submit</button>
            {isSubmitted && submitResult !== null && (
              <>
                {!submitResult.isCorrect && (
                  <button onClick={handleReset}>Try again</button>
                )}
                {!submitResult.isCorrect && (
                  <button onClick={() => setShowCorrectAnswerForCurrent(true)}>Show correct answer</button>
                )}
                <button onClick={handleNext}>Next question</button>
              </>
            )}
          </div>
        </div>
      ) : (
        <div className="question-block">
          <p style={{ marginBottom: '12px', fontWeight: 'bold' }}>Finished resolving</p>
          <div
            style={{
              padding: '20px',
              backgroundColor: '#f9f9f9',
              border: '2px solid #ddd',
              borderRadius: '8px',
              fontSize: '18px',
              fontFamily: 'monospace',
              lineHeight: '2.2',
            }}
          >
            {renderStringWithColoredParens(questions[currentIndex].answerStr, { keyPrefix: 'norm-ans' })}
          </div>
        </div>
      )}
    </div>
  );
};


