import React, { useState } from 'react';
import './styles.css';
import { LambdaObject, Variable, Application, Lambda, norm_ord_reduce, all_variables } from './lambda_ir';
import { Parser } from './parser';
import { random_lambda, random_variable } from './random_lambda';
import { LambdaLexerError, LambdaSyntaxError } from './lexer';
import { PAREN_COLORS, renderStringWithColoredParens } from './coloredParens';
import { difference } from './SetOperations';

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
  let param: Variable;
  let body: LambdaObject;
  let argument: LambdaObject;
  let lambda: Lambda;
  let redex: Application;
  let has_renaming: boolean;
  let variables = ["w", "x", "y", "z"]
  do {
    argument = random_lambda(variables, 4);
    body = random_lambda(variables, 4);
    param = random_variable(variables);
    lambda = new Lambda(param, body);
    redex = new Application(lambda, argument);
    let reduced = norm_ord_reduce(redex.copy()) as LambdaObject;
    has_renaming = difference(all_variables(reduced), new Set(variables)).size > 0;
  } while (!body.get_free_vars().has(param.get_symbol()) && !has_renaming && String(redex).length < 20);
  return redex;
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

export const BetaReductionLesson: React.FC<{
  onBack: () => void;
  onSubmit?: () => void;
  onAnsweredCorrect?: () => void;
  onCorrectWithoutShowAnswer?: () => void;
}> = ({ onBack, onSubmit, onAnsweredCorrect, onCorrectWithoutShowAnswer }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [userAnswer, setUserAnswer] = useState('');
  const [responses, setResponses] = useState<Response[]>([]);
  const [showResult, setShowResult] = useState(false);
  const [inputError, setInputError] = useState<string | null>(null);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [submitResult, setSubmitResult] = useState<SubmitResult | null>(null);
  const [showCorrectAnswerForCurrent, setShowCorrectAnswerForCurrent] = useState(false);
  const [hadShownAnswerForCurrentQuestion, setHadShownAnswerForCurrentQuestion] = useState(false);

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

  // ---- Visual highlight for the next beta-redex: (λx.t) t' ----
  // Blue: λx, Green: t, Red: t'
  const LX_BG = 'rgba(30,136,229,0.18)';
  const T_BG = 'rgba(67,160,71,0.18)';
  const TPRIME_BG = 'rgba(229,57,53,0.18)';
  const LX_STYLE: React.CSSProperties = { backgroundColor: LX_BG, padding: '0 2px', borderRadius: '4px', display: 'inline-block', lineHeight: '1.2' };
  const T_STYLE: React.CSSProperties = { backgroundColor: T_BG, padding: '0 2px', borderRadius: '4px', display: 'inline-block', lineHeight: '1.2' };
  const TPRIME_STYLE: React.CSSProperties = { backgroundColor: TPRIME_BG, padding: '0 2px', borderRadius: '4px', display: 'inline-block', lineHeight: '1.2' };

  const renderExpressionWithMainRedexHighlights = (obj: LambdaObject) => {
    const redex = obj.norm_ord_redex();
    if (redex === null || !(redex instanceof Application)) {
      return renderStringWithColoredParens(String(obj), { keyPrefix: 'beta-hl-fallback' });
    }

    const lambdaNode = redex.get_left();
    if (!(lambdaNode instanceof Lambda)) {
      return renderStringWithColoredParens(String(obj), { keyPrefix: 'beta-hl-fallback' });
    }

    const paramNode = lambdaNode.get_parameter();
    const tNode = lambdaNode.get_body();
    const tPrimeNode = redex.get_right();

    let parenDepth = 0;
    const renderParen = (char: '(' | ')') => {
      if (char === '(') {
        const color = PAREN_COLORS[parenDepth % PAREN_COLORS.length];
        parenDepth += 1;
        return (
          <span key={`popen-${parenDepth}`} style={{ color }}>
            (
          </span>
        );
      }
      parenDepth -= 1;
      const color = PAREN_COLORS[parenDepth % PAREN_COLORS.length];
      return (
        <span key={`pclose-${parenDepth}`} style={{ color }}>
          )
        </span>
      );
    };

    // Render a subtree without applying the special redex wrappers (used inside wrappers).
    const renderBare = (node: LambdaObject): React.ReactNode => {
      if (node instanceof Variable) return <span>{node.get_symbol()}</span>;
      if (node instanceof Lambda) {
        return (
          <>
            <span>λ</span>
            {renderBare(node.get_parameter())}
            <span>.</span>
            {renderBare(node.get_body())}
          </>
        );
      }
      if (node instanceof Application) {
        const leftNeedsParens = node.get_left() instanceof Lambda;
        const rightNeedsParens =
          node.get_right() instanceof Application ||
          (node.get_right() instanceof Lambda &&
            node.get_parent() instanceof Application &&
            (node.get_parent() as Application).get_left() === node);

        return (
          <>
            {leftNeedsParens ? renderParen('(') : null}
            {renderBare(node.get_left())}
            {leftNeedsParens ? renderParen(')') : null}
            <span> </span>
            {rightNeedsParens ? renderParen('(') : null}
            {renderBare(node.get_right())}
            {rightNeedsParens ? renderParen(')') : null}
          </>
        );
      }
      return null;
    };

    const renderNode = (node: LambdaObject): React.ReactNode => {
      if (node === tNode) {
        return <span style={T_STYLE}>{renderBare(node)}</span>;
      }
      if (node === tPrimeNode) {
        return <span style={TPRIME_STYLE}>{renderBare(node)}</span>;
      }
      if (node === lambdaNode) {
        return (
          <>
            <span style={LX_STYLE}>λ</span>
            <span style={LX_STYLE}>{paramNode.get_symbol()}</span>
            <span>.</span>
            {renderNode(tNode)}
          </>
        );
      }

      if (node instanceof Variable) return <span>{node.get_symbol()}</span>;
      if (node instanceof Lambda) {
        return (
          <>
            <span>λ</span>
            {renderNode(node.get_parameter())}
            <span>.</span>
            {renderNode(node.get_body())}
          </>
        );
      }
      if (node instanceof Application) {
        const leftNeedsParens = node.get_left() instanceof Lambda;
        const rightNeedsParens =
          node.get_right() instanceof Application ||
          (node.get_right() instanceof Lambda &&
            node.get_parent() instanceof Application &&
            (node.get_parent() as Application).get_left() === node);

        return (
          <>
            {leftNeedsParens ? renderParen('(') : null}
            {renderNode(node.get_left())}
            {leftNeedsParens ? renderParen(')') : null}
            <span> </span>
            {rightNeedsParens ? renderParen('(') : null}
            {renderNode(node.get_right())}
            {rightNeedsParens ? renderParen(')') : null}
          </>
        );
      }
      return null;
    };

    return renderNode(obj);
  };

  const handleSubmit = () => {
    onSubmit?.();
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
    if (isCorrect) onAnsweredCorrect?.();
    if (isCorrect && !hadShownAnswerForCurrentQuestion) onCorrectWithoutShowAnswer?.();
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
    setHadShownAnswerForCurrentQuestion(false);

    const question = new_question();
    let answer = question.copy();
    let redex = answer.norm_ord_redex();
    if (redex === answer) {
      answer = redex.reduce();
    } else if (redex !== null) {
      redex.reduce();
    }
    questions.push({
        question,
        questionStr: String(question),
        answer,
        answerStr: String(answer),
    });

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
      <h1>Beta Reduction</h1>
      <p style={{ marginBottom: '20px', color: '#333', whiteSpace: 'pre-line' }}>
        Reduce each expression using beta reduction. Enter the result in the text box and submit.
      </p>
      <p style={{ marginBottom: '16px', fontSize: '13px', color: '#666' }}>
        <em>
          Note: Information about your answers is collected.
        </em>
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
              {renderExpressionWithMainRedexHighlights(questions[currentIndex].question)}
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
                  <button onClick={() => { setShowCorrectAnswerForCurrent(true); setHadShownAnswerForCurrentQuestion(true); }}>Show correct answer</button>
                )}
                <button onClick={handleNext}>Next question</button>
              </>
            )}
          </div>
        </div>
      ) : (
        <div className="question-block">
          <p style={{ marginBottom: '12px' }}>Finished resolving</p>
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


