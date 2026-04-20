import React, { useState, useMemo } from 'react';
import './styles.css';
import { LambdaObject, Variable, Application, Lambda } from './lambda_ir';
import { random_lambda } from './random_lambda';
import { getParenPairMap, PAREN_COLORS } from './coloredParens';
import { EASY, getDifficultyLevel, MEDIUM, type DifficultyLevel } from './api/lessonProgress';

type VariableOccurrence = {
  id: string;
  variable: Variable;
  symbol: string;
  path: string;
  boundToLambda: Lambda | null; // null = free variable
};

function collectLambdasInOrder(obj: LambdaObject, out: Lambda[]): void {
  if (obj instanceof Variable) {
    return;
  }
  if (obj instanceof Lambda) {
    out.push(obj);
    collectLambdasInOrder(obj.get_parameter(), out);
    collectLambdasInOrder(obj.get_body(), out);
    return;
  }
  if (obj instanceof Application) {
    collectLambdasInOrder(obj.get_left(), out);
    collectLambdasInOrder(obj.get_right(), out);
  }
}

function findVariableOccurrencesWithBinding(
  obj: LambdaObject,
  boundStack: Array<{ param: Variable; lambda: Lambda }>,
  path: string,
  occurrences: VariableOccurrence[],
  occurrenceCounter: { count: number }
): void {
  if (obj instanceof Variable) {
    const id = path || `var-${occurrenceCounter.count++}`;
    const binding = boundStack.length > 0
      ? [...boundStack].reverse().find(b => b.param.get_symbol() === obj.get_symbol())
      : undefined;
    const boundToLambda = binding ? binding.lambda : null;

    occurrences.push({
      id,
      variable: obj,
      symbol: obj.get_symbol(),
      path,
      boundToLambda,
    });
    return;
  }
  if (obj instanceof Lambda) {
    const param = obj.get_parameter();
    const paramPath = path ? `${path}.param` : `param-${occurrenceCounter.count++}`;
    const bodyPath = path ? `${path}.body` : `body-${occurrenceCounter.count++}`;

    boundStack.push({ param, lambda: obj });
    findVariableOccurrencesWithBinding(param, boundStack, paramPath, occurrences, occurrenceCounter);
    findVariableOccurrencesWithBinding(obj.get_body(), boundStack, bodyPath, occurrences, occurrenceCounter);
    boundStack.pop();
    return;
  }
  if (obj instanceof Application) {
    const leftPath = path ? `${path}.left` : `left-${occurrenceCounter.count++}`;
    const rightPath = path ? `${path}.right` : `right-${occurrenceCounter.count++}`;
    findVariableOccurrencesWithBinding(obj.get_left(), boundStack, leftPath, occurrences, occurrenceCounter);
    findVariableOccurrencesWithBinding(obj.get_right(), boundStack, rightPath, occurrences, occurrenceCounter);
  }
}

export function new_question(level: DifficultyLevel): LambdaObject {
  let bound_var_count = level === EASY ? 2 : level === MEDIUM ? 3 : 4;
  let length = level === EASY ? 40 : level == MEDIUM ? 50 : 60;
  let lambda: LambdaObject;
  let bound_variables: number;
  let total_variables: number;
  do {
    lambda = random_lambda(['x', 'y', 'z'], 4);
    let variables = lambda.all_variables();
    variables = variables.filter((v) => !v.is_parameter());
    total_variables = variables.length;
    variables = variables.filter((v) => v.get_bound_lambda() !== null);
    bound_variables = variables.length;
  } while (
    bound_variables < bound_var_count
    || String(lambda).length >= length
    || total_variables > 7
    || bound_variables / total_variables < 0.25
    || bound_variables / total_variables > 0.95
  );
  // console.log(bound_variables, total_variables, bound_variables / total_variables);
  return lambda;
}

type ResponseRecord = {
  question: LambdaObject;
  questionStr: string;
  selections: Record<string, string>;
  isCorrect: boolean;
};

// Renders a previous question (read-only: expression with lambda numbers and selected bindings as text)
function PreviousQuestionItem({ response, index }: { response: ResponseRecord; index: number }) {
  const { lambdasInOrder, lambdaToNumber, variableOccurrences } = useMemo(() => {
    const lambdasInOrder: Lambda[] = [];
    collectLambdasInOrder(response.question, lambdasInOrder);
    const lambdaToNumber = new Map<Lambda, number>();
    lambdasInOrder.forEach((lam, i) => lambdaToNumber.set(lam, i + 1));
    const occurrences: VariableOccurrence[] = [];
    findVariableOccurrencesWithBinding(response.question, [], '', occurrences, { count: 0 });
    return { lambdasInOrder, lambdaToNumber, variableOccurrences: occurrences };
  }, [response.question]);
  const responseFeedback = useMemo(() => {
    const dropdownOccurrences = variableOccurrences.filter(
      occ => !occ.path.includes('.param') && !occ.path.startsWith('param-')
    );
    const correctAnswers: Record<string, string> = {};
    dropdownOccurrences.forEach(occ => {
      correctAnswers[occ.id] = occ.boundToLambda
        ? `λ${lambdaToNumber.get(occ.boundToLambda)!}`
        : 'free variable';
    });
    const wrongCount = dropdownOccurrences.filter(
      occ => (response.selections[occ.id] || '') !== correctAnswers[occ.id]
    ).length;
    return {
      wrongCount,
      totalCount: dropdownOccurrences.length,
    };
  }, [variableOccurrences, lambdaToNumber, response.selections]);

  const elements: React.ReactNode[] = [];
  let occurrenceIndex = 0;

  const renderRecursive = (obj: LambdaObject, path: string): void => {
    if (obj instanceof Variable) {
      const occurrence = variableOccurrences.find(occ => occ.path === path || occ.id === path);
      if (occurrence) {
        const isParameter = path.includes('.param') || path.startsWith('param-');
        if (isParameter) {
          elements.push(
            <span key={`var-${occurrence.id}`} style={{ verticalAlign: 'baseline' }}>
              {occurrence.symbol}
            </span>
          );
        } else {
          const selected = response.selections[occurrence.id] ?? '—';
          const displayLabel = selected === 'free variable' ? 'free' : selected;
          elements.push(
            <span
              key={`var-${occurrence.id}`}
              style={{ display: 'inline-block', margin: '0 2px', verticalAlign: 'baseline' }}
            >
              <span style={{ verticalAlign: 'baseline' }}>{occurrence.symbol}</span>
              <span style={{ fontSize: '10px', color: '#555', marginLeft: '2px' }}>({displayLabel})</span>
            </span>
          );
        }
      } else {
        elements.push(<span key={`var-fb-${occurrenceIndex++}`}>{obj.get_symbol()}</span>);
      }
      return;
    }
    if (obj instanceof Lambda) {
      const paramPath = path ? `${path}.param` : `param-${occurrenceIndex++}`;
      const bodyPath = path ? `${path}.body` : `body-${occurrenceIndex++}`;
      const num = lambdaToNumber.get(obj);
      elements.push(
        <span
          key={`lam-${path}`}
          style={{
            position: 'relative',
            display: 'inline-block',
            verticalAlign: 'baseline',
            paddingBottom: '20px',
          }}
        >
          <span style={{ verticalAlign: 'baseline' }}>λ</span>
          {num != null && (
            <span
              style={{
                position: 'absolute',
                left: '50%',
                transform: 'translateX(-50%)',
                bottom: 2,
                fontSize: '11px',
                fontWeight: 'bold',
              }}
            >
              {num}
            </span>
          )}
        </span>
      );
      renderRecursive(obj.get_parameter(), paramPath);
      elements.push(<span key={`dot-${path}`}>.</span>);
      renderRecursive(obj.get_body(), bodyPath);
      return;
    }
    if (obj instanceof Application) {
      const leftPath = path ? `${path}.left` : `left-${occurrenceIndex++}`;
      const rightPath = path ? `${path}.right` : `right-${occurrenceIndex++}`;
      const leftNeedsParens = obj.get_left() instanceof Lambda;
      const rightNeedsParens =
        obj.get_right() instanceof Application ||
        (obj.get_right() instanceof Lambda &&
          obj.get_parent() instanceof Application &&
          (obj.get_parent() as Application).get_left() === obj);
      if (leftNeedsParens) elements.push(<span key={`lp-${path}`}>(</span>);
      renderRecursive(obj.get_left(), leftPath);
      if (leftNeedsParens) elements.push(<span key={`rp-${path}`}>)</span>);
      elements.push(<span key={`sp-${path}`}> </span>);
      if (rightNeedsParens) elements.push(<span key={`lp2-${path}`}>(</span>);
      renderRecursive(obj.get_right(), rightPath);
      if (rightNeedsParens) elements.push(<span key={`rp2-${path}`}>)</span>);
    }
  };

  renderRecursive(response.question, '');
  return (
    <div
      key={`previous-${index}`}
      className="response"
      style={{
        marginBottom: '16px',
        padding: '12px 16px',
        backgroundColor: '#f5f5f5',
        border: '1px solid #ddd',
        borderRadius: '8px',
      }}
    >
      <div
        style={{
          fontSize: '16px',
          fontFamily: 'monospace',
          lineHeight: '2',
          marginBottom: '8px',
        }}
      >
        {elements}
      </div>
      <p style={{ margin: 0, fontSize: '14px' }}>
        {response.isCorrect ? (
          <span className="correct">✓ Correct</span>
        ) : (
          <span className="incorrect">
            ✗ Incorrect. {responseFeedback.wrongCount} binding
            {responseFeedback.wrongCount !== 1 ? 's were' : ' was'} wrong.
          </span>
        )}
      </p>
    </div>
  );
}

export const VariableBindingLesson: React.FC<{
  userId: string;
  authToken: string;
  onBack: () => void;
  onSubmit?: () => void;
  onAnsweredCorrect?: () => void;
  onCorrectWithoutShowAnswer?: () => void;
}> = ({ userId, authToken, onBack, onSubmit, onAnsweredCorrect, onCorrectWithoutShowAnswer }) => {
  const [question, setQuestion] = useState<LambdaObject>(() =>
    new_question(getDifficultyLevel(userId, authToken, 'variable-binding'))
  );
  const [selections, setSelections] = useState<Record<string, string>>({});
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [showAnswer, setShowAnswer] = useState(false);
  const [hadShownAnswerForCurrentQuestion, setHadShownAnswerForCurrentQuestion] = useState(false);
  const [responses, setResponses] = useState<ResponseRecord[]>([]);

  const { lambdasInOrder, lambdaToNumber, variableOccurrences } = useMemo(() => {
    const lambdasInOrder: Lambda[] = [];
    collectLambdasInOrder(question, lambdasInOrder);
    const lambdaToNumber = new Map<Lambda, number>();
    lambdasInOrder.forEach((lam, i) => lambdaToNumber.set(lam, i + 1));

    const occurrences: VariableOccurrence[] = [];
    findVariableOccurrencesWithBinding(question, [], '', occurrences, { count: 0 });

    return {
      lambdasInOrder,
      lambdaToNumber,
      variableOccurrences: occurrences,
    };
  }, [question]);

  const dropdownOptions = useMemo(() => {
    const opts = ['free variable'];
    lambdasInOrder.forEach((_, i) => opts.push(`λ${i + 1}`));
    return opts;
  }, [lambdasInOrder]);

  const handleSelect = (occurrenceId: string, value: string) => {
    setSelections(prev => ({ ...prev, [occurrenceId]: value }));
  };

  const correctAnswers = useMemo(() => {
    const ans: Record<string, string> = {};
    variableOccurrences.forEach(occ => {
      ans[occ.id] = occ.boundToLambda
        ? `λ${lambdaToNumber.get(occ.boundToLambda)!}`
        : 'free variable';
    });
    return ans;
  }, [variableOccurrences, lambdaToNumber]);

  // Only check occurrences that have a dropdown (exclude lambda parameters)
  const occurrencesWithDropdown = useMemo(
    () =>
      variableOccurrences.filter(
        occ => !occ.path.includes('.param') && !occ.path.startsWith('param-')
      ),
    [variableOccurrences]
  );

  const isCorrect = useMemo(() => {
    if (!isSubmitted) return null;
    return occurrencesWithDropdown.every(
      occ => (selections[occ.id] || '') === correctAnswers[occ.id]
    );
  }, [isSubmitted, selections, occurrencesWithDropdown, correctAnswers]);

  const bindingFeedbackCounts = useMemo(() => {
    if (!isSubmitted) return null;
    const wrongCount = occurrencesWithDropdown.filter(
      occ => (selections[occ.id] || '') !== correctAnswers[occ.id]
    ).length;
    return {
      wrongCount,
      totalCount: occurrencesWithDropdown.length,
    };
  }, [isSubmitted, occurrencesWithDropdown, selections, correctAnswers]);

  const handleSubmit = () => {
    onSubmit?.();
    const correct = occurrencesWithDropdown.every(
      occ => (selections[occ.id] || '') === correctAnswers[occ.id]
    );
    if (correct) onAnsweredCorrect?.();
    if (correct && !hadShownAnswerForCurrentQuestion) onCorrectWithoutShowAnswer?.();
    setIsSubmitted(true);
  };

  const handleReset = () => {
    setIsSubmitted(false);
    setShowAnswer(false);
  };

  const handleNext = () => {
    setHadShownAnswerForCurrentQuestion(false);
    const questionStr = question.toString();
    const correct = occurrencesWithDropdown.every(
      occ => (selections[occ.id] || '') === correctAnswers[occ.id]
    );
    setResponses(prev => [
      ...prev,
      {
        question,
        questionStr,
        selections: { ...selections },
        isCorrect: correct,
      },
    ]);
    setQuestion(new_question(getDifficultyLevel(userId, authToken, 'variable-binding')));
    setSelections({});
    setIsSubmitted(false);
    setShowAnswer(false);
  };

  const questionStr = question.toString();
  const parenPairMap = useMemo(() => getParenPairMap(questionStr), [questionStr]);

  const renderExpression = () => {
    const elements: React.ReactNode[] = [];
    let occurrenceIndex = 0;
    const idx = { current: 0 };

    const renderRecursive = (obj: LambdaObject, path: string): void => {
      if (obj instanceof Variable) {
        const occurrence = variableOccurrences.find(occ => occ.path === path || occ.id === path);
        if (occurrence) {
          const isParameter = path.includes('.param') || path.startsWith('param-');
          if (isParameter) {
            elements.push(
              <span key={`var-${occurrence.id}`} style={{ verticalAlign: 'baseline' }}>
                {occurrence.symbol}
              </span>
            );
          } else {
            // Render variable with dropdown
            const selected = selections[occurrence.id] ?? '';
            const correct = correctAnswers[occurrence.id];
            // When showing answer, use the correct value; otherwise use selected value
            const displayValue = showAnswer ? correct : selected;

            elements.push(
              <span
                key={`var-${occurrence.id}`}
                style={{
                  position: 'relative',
                  display: 'inline-block',
                  margin: '0 2px',
                  verticalAlign: 'baseline',
                  paddingBottom: '32px',
                }}
              >
                <span style={{ verticalAlign: 'baseline' }}>{occurrence.symbol}</span>
                <select
                  value={displayValue}
                  onChange={e => handleSelect(occurrence.id, e.target.value)}
                  disabled={isSubmitted || showAnswer}
                  style={{
                    position: 'absolute',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    bottom: 0,
                    fontSize: '9px',
                    width: '24px',
                    minWidth: '24px',
                    maxWidth: '24px',
                    padding: '1px 0',
                    overflow: 'hidden',
                    ...(displayValue ? {
                      appearance: 'none',
                      WebkitAppearance: 'none',
                      MozAppearance: 'none',
                    } as React.CSSProperties : {}),
                    ...(showAnswer && selected !== correct ? { border: '2px solid #dc3545', backgroundColor: '#fff5f5' } : {}),
                  }}
                  title={displayValue || '--'}
                >
                  <option value="">--</option>
                  {dropdownOptions.map(opt => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              </span>
            );
          }
        } else {
          elements.push(<span key={`var-fb-${occurrenceIndex++}`}>{obj.get_symbol()}</span>);
        }
        idx.current += obj.get_symbol().length;
        return;
      }

      if (obj instanceof Lambda) {
        const paramPath = path ? `${path}.param` : `param-${occurrenceIndex++}`;
        const bodyPath = path ? `${path}.body` : `body-${occurrenceIndex++}`;
        const num = lambdaToNumber.get(obj);

        idx.current += 1; // λ
        elements.push(
          <span
            key={`lam-${path}`} 
            style={{ 
              position: 'relative',
              display: 'inline-block',
              verticalAlign: 'baseline',
              paddingBottom: '20px',
            }}
          >
            <span style={{ verticalAlign: 'baseline' }}>λ</span>
            {num != null && (
              <span style={{ 
                position: 'absolute',
                left: '50%',
                transform: 'translateX(-50%)',
                bottom: 2,
                fontSize: '11px',
                fontWeight: 'bold'
              }}>
                {num}
              </span>
            )}
          </span>
        );
        renderRecursive(obj.get_parameter(), paramPath);
        idx.current += 1; // .
        elements.push(<span key={`dot-${path}`}>.</span>);
        renderRecursive(obj.get_body(), bodyPath);
        return;
      }

      if (obj instanceof Application) {
        const leftPath = path ? `${path}.left` : `left-${occurrenceIndex++}`;
        const rightPath = path ? `${path}.right` : `right-${occurrenceIndex++}`;
        const leftNeedsParens = obj.get_left() instanceof Lambda;
        const rightNeedsParens =
          obj.get_right() instanceof Application ||
          (obj.get_right() instanceof Lambda &&
            obj.get_parent() instanceof Application &&
            (obj.get_parent() as Application).get_left() === obj);
        if (leftNeedsParens) {
          const pos = idx.current++;
          const pairId = parenPairMap.get(pos);
          const color = pairId !== undefined ? PAREN_COLORS[pairId % PAREN_COLORS.length] : undefined;
          elements.push(
            <span key={`lp-${path}`} style={color ? { color, fontWeight: 'bold' } : undefined}>(</span>
          );
        }
        renderRecursive(obj.get_left(), leftPath);
        if (leftNeedsParens) {
          const pos = idx.current++;
          const pairId = parenPairMap.get(pos);
          const color = pairId !== undefined ? PAREN_COLORS[pairId % PAREN_COLORS.length] : undefined;
          elements.push(
            <span key={`rp-${path}`} style={color ? { color, fontWeight: 'bold' } : undefined}>)</span>
          );
        }
        idx.current += 1; // space
        elements.push(<span key={`sp-${path}`}> </span>);
        if (rightNeedsParens) {
          const pos = idx.current++;
          const pairId = parenPairMap.get(pos);
          const color = pairId !== undefined ? PAREN_COLORS[pairId % PAREN_COLORS.length] : undefined;
          elements.push(
            <span key={`lp2-${path}`} style={color ? { color, fontWeight: 'bold' } : undefined}>(</span>
          );
        }
        renderRecursive(obj.get_right(), rightPath);
        if (rightNeedsParens) {
          const pos = idx.current++;
          const pairId = parenPairMap.get(pos);
          const color = pairId !== undefined ? PAREN_COLORS[pairId % PAREN_COLORS.length] : undefined;
          elements.push(
            <span key={`rp2-${path}`} style={color ? { color, fontWeight: 'bold' } : undefined}>)</span>
          );
        }
      }
    };

    renderRecursive(question, '');
    return elements;
  };

  return (
    <div className="container">
      <div style={{ marginBottom: '20px' }}>
        <button onClick={onBack} style={{ marginBottom: '10px' }}>← Back to Menu</button>
      </div>
      <h1>Variable Binding</h1>
      <div style={{ marginBottom: '20px', color: '#333', fontFamily: 'inherit', fontSize: '16px' }}>
        <ul style={{ margin: '0 0 0 20px', padding: 0 }}>
          <li>
            Each λ-abstraction <strong>λx. M</strong> binds occurrences of <code>x</code> inside its body.
            Generally inside <code>M</code>, the <code>x</code>’s you see might belong to this λ.
          </li>
          <li>
            A variable occurrence is <strong>bound</strong> to the nearest (lowest level of nesting that still has this variable in its body) λ that uses the same name.
            If there is another λ with the same name inside, the inner one takes over for that inner part.
          </li>
          <li>
            If there is no such nearby λ, the occurrence is a <strong>free variable</strong>.
          </li>
          <li>
            In this lesson, every λ is labeled with a small index (λ₁, λ₂, …). For each variable and parameter, use the dropdown to choose which λ it belongs to, or select <strong>free variable</strong>.
          </li>
          <li>
            Parameters themselves are not “bound to something else”, so you only choose dropdown values on variable occurrences, not on the λ-parameters.
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
            <PreviousQuestionItem key={idx} response={res} index={idx} />
          ))}
        </div>
      )}

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
          {renderExpression()}
        </div>

        {isSubmitted && isCorrect !== null && (
          <p style={{ marginBottom: '12px' }}>
            {isCorrect ? (
              <span className="correct">✓ Correct. All bindings are correct.</span>
            ) : bindingFeedbackCounts ? (
              <span className="incorrect">
                ✗ Incorrect. {bindingFeedbackCounts.wrongCount} binding
                {bindingFeedbackCounts.wrongCount !== 1 ? 's are' : ' is'} wrong out of{' '}
                {bindingFeedbackCounts.totalCount}. Check the dropdowns and try again or show answer.
              </span>
            ) : null}
          </p>
        )}

        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button onClick={handleSubmit} disabled={isSubmitted}>
            Submit
          </button>
          {isSubmitted && (
            <>
              {!isCorrect && (
                <button onClick={() => { setShowAnswer(true); setHadShownAnswerForCurrentQuestion(true); }}>Show Answer</button>
              )}
              {!isCorrect && (
                <button onClick={handleReset}>Try Again</button>
              )}
              <button onClick={handleNext}>Next Question</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
