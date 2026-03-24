import React, { useMemo, useState } from 'react';
import './styles.css';
import { LambdaObject, Variable, Application, Lambda, norm_ord_reduce, all_variables } from './lambda_ir';
import { random_lambda, random_variable } from './random_lambda';
import { PAREN_COLORS, renderStringWithColoredParens } from './coloredParens';
import { difference } from './SetOperations';
import { EASY, getDifficultyLevel, MEDIUM, type DifficultyLevel } from './api/lessonProgress';

type Question = {
  question: LambdaObject;
  questionStr: string;
  answer: LambdaObject;
  answerStr: string;
};

type Response = {
  lambdaExpr: LambdaObject;
  lambdaExprStr: string;
  selectedXOccurrences: string[];
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

export function new_question(level: DifficultyLevel): LambdaObject {
  const maxLength = level === EASY ? 17 : level === MEDIUM ? 22 : 27;
  const minLength = level === EASY ? 7 : level === MEDIUM ? 12 : 17;
  let param: Variable;
  let body: LambdaObject;
  let argument: LambdaObject;
  let lambda: Lambda;
  let redex: Application;
  let has_renaming: boolean;
  let variables = ["w", "x", "y", "z"];
  let expected_param_count = Math.floor(3 * Math.random());
  let param_count: number;
  do {
    argument = random_lambda(variables, 4);
    body = random_lambda(variables, 4);
    param = random_variable(variables);
    lambda = new Lambda(param, body);
    redex = new Application(lambda, argument);
    let reduced = norm_ord_reduce(redex.copy()) as LambdaObject;
    has_renaming = difference(all_variables(reduced), new Set(variables)).size > 0;
    param_count = body.get_free_vars_list().filter(v => v.get_symbol() === param.get_symbol()).length;
  } while (
    param_count !== expected_param_count
    || has_renaming
    || (String(body).length < minLength || String(body).length > maxLength)
    || (String(argument).length < 3 || String(argument).length > 10)
  );
  return redex;
}

let questions: Question[] = [];

type SubmitResult = {
  isCorrect: boolean;
  selectedXOccurrences: string[];
};

export const BetaReductionLesson: React.FC<{
  userId: string;
  authToken: string;
  onBack: () => void;
  onSubmit?: () => void;
  onAnsweredCorrect?: () => void;
  onCorrectWithoutShowAnswer?: () => void;
}> = ({ userId, authToken, onBack, onSubmit, onAnsweredCorrect, onCorrectWithoutShowAnswer }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [responses, setResponses] = useState<Response[]>([]);
  const [showResult, setShowResult] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [submitResult, setSubmitResult] = useState<SubmitResult | null>(null);
  const [showCorrectAnswerForCurrent, setShowCorrectAnswerForCurrent] = useState(false);
  const [hadShownAnswerForCurrentQuestion, setHadShownAnswerForCurrentQuestion] = useState(false);
  const [selectedXOccurrences, setSelectedXOccurrences] = useState<Set<string>>(() => new Set());

  if (questions.length === 0) {
    let question = new_question(getDifficultyLevel(userId, authToken, 'normal-order'));
    let answer = question.copy();
    let redex = answer.norm_ord_redex();
    if (redex === answer) {
      answer = redex.reduce();
    } else if (redex !== null) {
      redex.reduce();
    } else {
      throw new Error("initial statement has no redex");
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

  const betaStep = useMemo(() => {
    const current = questions[currentIndex];
    if (!current) return null;
    const redex = current.question.norm_ord_redex();
    if (!redex || !(redex instanceof Application)) return null;
    if (!(redex.get_left() instanceof Lambda)) return null;

    const lambdaNode = redex.get_left() as Lambda;
    const paramNode = lambdaNode.get_parameter();
    const tNode = lambdaNode.get_body();
    const tPrimeNode = redex.get_right();

    const targetIds: string[] = [];
    const collectTargets = (
      node: LambdaObject,
      path: string,
      boundVars: Variable[]
    ): void => {
      if (node instanceof Variable) {
        const nearestBinder =
          [...boundVars].reverse().find(v => v.get_symbol() === node.get_symbol()) || null;
        if (nearestBinder === paramNode) {
          targetIds.push(path);
        }
        return;
      }

      if (node instanceof Lambda) {
        // Do not treat the binder parameter itself as a “variable occurrence” to replace.
        const innerParam = node.get_parameter();
        collectTargets(node.get_body(), `${path}.body`, [...boundVars, innerParam]);
        return;
      }

      if (node instanceof Application) {
        collectTargets(node.get_left(), `${path}.left`, boundVars);
        collectTargets(node.get_right(), `${path}.right`, boundVars);
        return;
      }
    };

    collectTargets(tNode, 't', [paramNode]);

    return {
      redex,
      lambdaNode,
      paramNode,
      tNode,
      tPrimeNode,
      targetIds,
    };
  }, [currentIndex]);

  const targetIdsSet = useMemo(() => new Set(betaStep?.targetIds ?? []), [betaStep]);
  const functionBodyIndentCh = useMemo(() => {
    if (!betaStep) return 0;
    // Align with the start of t in (λx.t) by accounting for "(λ", parameter, and ".".
    return betaStep.paramNode.get_symbol().length + 3;
  }, [betaStep]);

  const handleDropOnXOccurrence = (occId: string) => {
    if (isSubmitted) return;
    setSelectedXOccurrences(prev => {
      const next = new Set(prev);
      next.add(occId);
      return next;
    });
  };

  const toggleXOccurrence = (occId: string) => {
    if (isSubmitted) return;
    setSelectedXOccurrences(prev => {
      const next = new Set(prev);
      if (next.has(occId)) next.delete(occId);
      else next.add(occId);
      return next;
    });
  };

  const renderTWithDropTargets = (
    selectedSet: Set<string> = selectedXOccurrences,
    interactive: boolean = true
  ) => {
    if (!betaStep) return null;

    const { tNode } = betaStep;

    let parenDepth = 0;
    let parenKey = 0;
    const renderParen = (char: '(' | ')') => {
      if (char === '(') {
        const color = PAREN_COLORS[parenDepth % PAREN_COLORS.length];
        parenDepth += 1;
        parenKey += 1;
        return (
          <span key={`beta-paren-${parenKey}`} style={{ color, fontWeight: 'bold' }}>
            (
          </span>
        );
      }
      parenDepth -= 1;
      const color = PAREN_COLORS[parenDepth % PAREN_COLORS.length];
      parenKey += 1;
      return (
        <span key={`beta-paren-${parenKey}`} style={{ color, fontWeight: 'bold' }}>
          )
        </span>
      );
    };

    const renderNode = (
      node: LambdaObject,
      path: string,
      boundVars: Variable[],
      appSide: 'left' | 'right' | null
    ): React.ReactNode => {
      if (node instanceof Variable) {
        // Every variable occurrence in t is a candidate drop target.
        // Lambda parameters are excluded because we never recurse into parameter nodes.
        const isTarget = true;
        const selected = selectedSet.has(path);

        if (!isTarget) {
          return <span key={`beta-var-${path}`}>{node.get_symbol()}</span>;
        }

        const targetStyle: React.CSSProperties = selected
          ? { backgroundColor: 'rgba(30,136,229,0.18)', borderRadius: 4, padding: '0 2px', display: 'inline-block' }
          : {
              border: '1px dashed rgba(30,136,229,0.4)',
              borderRadius: 4,
              padding: '0 2px',
              display: 'inline-block',
              cursor: interactive ? 'copy' : 'default',
            };

        const replacementNeedsParens =
          appSide === 'right'
            ? betaStep.tPrimeNode instanceof Application || betaStep.tPrimeNode instanceof Lambda
            : appSide === 'left'
              ? betaStep.tPrimeNode instanceof Lambda
              : false;

        const replacementInner = renderStringWithColoredParens(
          String(betaStep.tPrimeNode),
          { keyPrefix: `beta-inline-repl-${path}` }
        );
        const replacementText = replacementNeedsParens ? (
          <>
            <span style={{ color: '#000' }}>(</span>
            {replacementInner}
            <span style={{ color: '#000' }}>)</span>
          </>
        ) : replacementInner;

        return (
          <span
            key={`beta-var-${path}`}
            style={targetStyle}
            onDragOver={(e) => {
              if (isSubmitted || !interactive) return;
              e.preventDefault();
            }}
            onDrop={(e) => {
              if (!interactive) return;
              e.preventDefault();
              handleDropOnXOccurrence(path);
            }}
            onClick={() => {
              if (!interactive) return;
              toggleXOccurrence(path);
            }}
            title={selected ? "Marked: will substitute t' here" : "Drop t' here"}
          >
            {selected ? replacementText : node.get_symbol()}
          </span>
        );
      }

      if (node instanceof Lambda) {
        const innerParam = node.get_parameter();
        return (
          <span key={`beta-lam-${path}`}>
            <span>λ</span>
            {/* Binder parameter itself is not a substitution target */}
            <span>{innerParam.get_symbol()}</span>
            <span>.</span>
            {renderNode(node.get_body(), `${path}.body`, [...boundVars, innerParam], null)}
          </span>
        );
      }

      if (node instanceof Application) {
        const leftNeedsParens = node.get_left() instanceof Lambda;
        const rightNeedsParens =
          node.get_right() instanceof Application ||
          (node.get_right() instanceof Lambda &&
            node.get_parent() instanceof Application &&
            (node.get_parent() as Application).get_left() === node);

        const left = renderNode(node.get_left(), `${path}.left`, boundVars, 'left');
        const right = renderNode(node.get_right(), `${path}.right`, boundVars, 'right');

        return (
          <span key={`beta-app-${path}`}>
            {leftNeedsParens ? renderParen('(') : null}
            {left}
            {leftNeedsParens ? renderParen(')') : null}
            <span> </span>
            {rightNeedsParens ? renderParen('(') : null}
            {right}
            {rightNeedsParens ? renderParen(')') : null}
          </span>
        );
      }

      return null;
    };

    return renderNode(tNode, 't', [], null);
  };

  const handleSubmit = () => {
    onSubmit?.();
    if (!betaStep) return;

    const isCorrect =
      selectedXOccurrences.size === targetIdsSet.size &&
      Array.from(selectedXOccurrences).every(id => targetIdsSet.has(id));

    if (isCorrect) onAnsweredCorrect?.();
    if (isCorrect && !hadShownAnswerForCurrentQuestion) onCorrectWithoutShowAnswer?.();

    setSubmitResult({
      isCorrect,
      selectedXOccurrences: Array.from(selectedXOccurrences),
    });
    setIsSubmitted(true);
  };

  const handleReset = () => {
    setIsSubmitted(false);
    setSubmitResult(null);
    setShowCorrectAnswerForCurrent(false);
  };

  const handleResetReplacements = () => {
    if (isSubmitted) return;
    setSelectedXOccurrences(new Set());
  };

  const handleNext = () => {
    if (submitResult === null) return;
    const current = questions[currentIndex];
    const newResponse: Response = {
      lambdaExpr: current.question,
      lambdaExprStr: current.questionStr,
      selectedXOccurrences: submitResult.selectedXOccurrences,
      correctAnswer: current.answer,
      correctAnswerStr: current.answerStr,
      isCorrect: submitResult.isCorrect,
    };
    setResponses([...responses, newResponse]);
    setSubmitResult(null);
    setIsSubmitted(false);
    setShowCorrectAnswerForCurrent(false);
    setHadShownAnswerForCurrentQuestion(false);
    setSelectedXOccurrences(new Set());

    const question = new_question(getDifficultyLevel(userId, authToken, 'normal-order'));
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
      <div style={{ marginBottom: '20px', color: '#333' }}>
        <p style={{ marginBottom: '8px' }}><strong>How this connects to lambda calculus:</strong></p>
        <ul style={{ margin: '0 0 0 20px', padding: 0 }}>
          <li>
            Beta reduction means: <strong>apply <code>λx.t</code> to <code>u</code> by replacing each <code>x</code> in <code>t</code> with <code>u</code>.</strong>{' '}
            This means: wherever x appears in t if x is bound to that lambda function, replace that x with u.
          </li>
          <li>
            If an <code>x</code> is controlled by a different <code>λ</code>, it is <strong>not</strong> replaced in this step.
          </li>
          <li>
            In the question, the current β-redex is highlighted:
            <span style={{ fontFamily: 'monospace' }}>λx</span> (blue), <span style={{ fontFamily: 'monospace' }}>t</span> (green), and <span style={{ fontFamily: 'monospace' }}>u</span> (red/oranged token).
          </li>
          <li>
            Your task is to select every variable occurrence in <code>t</code> that represents a “where <code>x</code> should be replaced by <code>u</code>”.
            Click and drag the red argument box at the bottom to the variables that need to be replaced in the function body.
          </li>
          <li>
            Submit when you have replaced all variables to reduce this one redex.
            (After that, the lesson proceeds to the next redex in normal order.)
          </li>
        </ul>
      </div>
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
            <p style={{ marginBottom: '8px', fontSize: '14px', color: '#666' }}><strong>Reduce this function:</strong></p>
            <div style={{ marginBottom: '12px' }}>
              {renderExpressionWithMainRedexHighlights(questions[currentIndex].question)}
            </div>

            <div style={{ marginBottom: '12px' }}>
              <p style={{ marginBottom: '4px', fontSize: '14px', color: '#666' }}><strong>Function body (drag the argument onto a variable to replace it):</strong></p>
              <div
                style={{
                  padding: '10px 12px',
                  background: '#fff',
                  border: '1px solid #eee',
                  borderRadius: '8px',
                  wordBreak: 'break-word',
                }}
              >
                <div style={{ marginLeft: `${functionBodyIndentCh}ch` }}>
                  {renderTWithDropTargets()}
                </div>
              </div>
            </div>

            {betaStep && (
              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
                <div>
                  <p style={{ marginBottom: '4px', fontSize: '14px', color: '#666' }}><strong>Argument:</strong></p>
                  <div
                    draggable={!isSubmitted}
                    onDragStart={(e) => {
                      e.dataTransfer.setData('text/plain', 'beta-tprime');
                    }}
                    style={{
                      padding: '8px 12px',
                      border: '2px solid rgba(229,57,53,0.25)',
                      background: 'rgba(229,57,53,0.08)',
                      borderRadius: '8px',
                      cursor: isSubmitted ? 'not-allowed' : 'grab',
                      maxWidth: '360px',
                      overflowWrap: 'anywhere',
                    }}
                  >
                    {renderStringWithColoredParens(String(betaStep.tPrimeNode), { keyPrefix: 'beta-tprime-token' })}
                  </div>
                </div>
              </div>
            )}
          </div>

          {isSubmitted && submitResult !== null && (
            <p style={{ marginBottom: '12px' }}>
              {submitResult.isCorrect ? (
                <span className="correct">✓ Correct.</span>
              ) : (
                <span className="incorrect">✗ Incorrect.</span>
              )}
            </p>
          )}

          {isSubmitted && submitResult !== null && !submitResult.isCorrect && showCorrectAnswerForCurrent && (
            <div style={{ marginBottom: '12px', fontSize: '18px', fontFamily: 'monospace', lineHeight: '2' }}>
              <p style={{ marginBottom: '4px', fontSize: '14px', color: '#666' }}>
                <strong>Correct substitutions in function body:</strong>
              </p>
              <div
                style={{
                  padding: '10px 12px',
                  background: '#fff',
                  border: '1px solid #eee',
                  borderRadius: '8px',
                  wordBreak: 'break-word',
                }}
              >
                <div style={{ marginLeft: `${functionBodyIndentCh}ch` }}>
                  {renderTWithDropTargets(targetIdsSet, false)}
                </div>
              </div>
            </div>
          )}
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <button onClick={handleSubmit} disabled={isSubmitted}>Submit</button>
            <button onClick={handleResetReplacements} disabled={isSubmitted || selectedXOccurrences.size === 0}>
              Reset Replacements
            </button>
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


