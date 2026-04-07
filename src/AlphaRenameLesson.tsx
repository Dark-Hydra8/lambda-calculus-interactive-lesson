import React, { useState, useMemo } from 'react';
import './styles.css';
import { LambdaObject, Variable, Application, Lambda, norm_ord_reduce, all_variables } from './lambda_ir';
import { getParenPairMap, PAREN_COLORS, renderStringWithColoredParens } from './coloredParens';
import { random_with_unique_lambdas, random_variable } from './random_lambda';
import { difference } from './SetOperations';
import { Parser } from './parser';
import { EASY, getDifficultyLevel, MEDIUM, HARD, type DifficultyLevel } from './api/lessonProgress';

type Question = {
  question: LambdaObject;
  questionStr: string;
  redex: Application;
};

type VariableOccurrence = {
  id: string; // Unique ID for this occurrence
  variable: Variable;
  symbol: string;
  isInRedex: boolean;
  isBound: boolean; // Whether this is a bound variable (lambda parameter)
  isBoundBy: Variable | null; // Which lambda parameter binds this variable
};

function buildParamVarToParamId(occurrences: VariableOccurrence[]): Map<Variable, string> {
  const map = new Map<Variable, string>();
  for (const occ of occurrences) {
    if (occ.id.startsWith('param-') || occ.id.endsWith('.param')) {
      map.set(occ.variable as Variable, occ.id);
    }
  }
  return map;
}

/** Checkbox group: parameter occurrence id, or all uses bound by the same λ share the param's id. */
function binderKeyForOccurrence(occ: VariableOccurrence, paramVarToParamId: Map<Variable, string>): string {
  if (occ.id.startsWith('param-') || occ.id.endsWith('.param')) return occ.id;
  if (occ.isBoundBy) return paramVarToParamId.get(occ.isBoundBy) ?? occ.id;
  return occ.id;
}

let questions: Question[] = [];

function redexNotRoot(lambda_object: LambdaObject): boolean {
  const redex = lambda_object.norm_ord_redex();
  return redex !== null && redex !== lambda_object;
}

function redexHasParameter(lambda_object: LambdaObject): boolean {
  const redex = lambda_object.norm_ord_redex() as Application;
  if (redex === null || !(redex.get_left() instanceof Lambda)) return false;
  const lambda = redex.get_left() as Lambda;
  return lambda.get_body().get_free_vars().has(lambda.get_parameter().get_symbol());
}

/** True if after reduction the expression has variable names not in base_vars (i.e. renaming occurred). */
function hasRenaming(lambda_object: LambdaObject, base_vars: Set<string>): boolean {
  const reduced = norm_ord_reduce(lambda_object.copy()) as LambdaObject | null;
  if (reduced === null) return false;
  const all_vars = all_variables(reduced);
  // console.log("all_vars: ", all_vars, "base_vars: ", base_vars, "difference: ", difference(all_vars, base_vars));
  return difference(all_vars, base_vars).size > 0;
}

function max_redex_parameter_lambda_depth(redex: Application) : number {
  let lambda = redex.get_left() as Lambda;
  let max = -1;
  let parameter = lambda.get_parameter().get_symbol();
  for (let variable of lambda.get_body().get_free_vars_list()) {
    if (variable.get_symbol() === parameter) {
      max = Math.max(max, variable.lambda_depth());
    }
  }
  return max;
}

function parameter_count(redex: Application): number {
  let count = 0;
  let lambda = redex.get_left() as Lambda;
  let parameter = lambda.get_parameter().get_symbol();
  for (let variable of lambda.get_body().get_free_vars_list()) {
    if (variable.get_symbol() === parameter) {
      count++;
    }
  }
  return count;
}

// Generate a lambda expression with exactly one redex
export function new_question(level: DifficultyLevel): Application {
  // Depth 9 (7 + HARD) often thrashes in the acceptance loop; cap HARD at 8 like MEDIUM for reliable latency.
  const caseMax = level === EASY ? 3 : 6;
  const maxLength = level === EASY ? 20 : level === MEDIUM ? 35 : 50;
  let is_accepted: (lambda_object: Application) => boolean;
  const base_vars = new Set(['v', 'w', 'x', 'y', 'z']);
  switch (Math.floor(caseMax * Math.random())) {
    case 0: // Short argument with no renaming
      is_accepted = (lambda_object: Application) => {
        const length = String(lambda_object).length;
        const argument_length = String(lambda_object.get_right()).length;
        const renaming = hasRenaming(lambda_object, base_vars);
        const param_count = parameter_count(lambda_object);
        const depth = max_redex_parameter_lambda_depth(lambda_object);
        const reduced_length = String(norm_ord_reduce(lambda_object.copy())).length;
        const accepted = length < maxLength && param_count > 0 && argument_length < 10 && !renaming && depth >= 3 && reduced_length < 45;
        return accepted;
      };
      break;
    case 1:
    case 2: // Short argument with renaming (1 and 2 fall through to same handler)
      is_accepted = (lambda_object: Application) => {
        const length = String(lambda_object).length;
        const argument_length = String(lambda_object.get_right()).length;
        const renaming = hasRenaming(lambda_object, base_vars);
        const param_count = parameter_count(lambda_object);
        const depth = max_redex_parameter_lambda_depth(lambda_object);
        const reduced_length = String(norm_ord_reduce(lambda_object.copy())).length;
        const accepted = length < maxLength && param_count > 0 && argument_length < 10 && renaming && depth >= 3 && reduced_length < 45;
        return accepted;
      };
      break;
    case 3: // Long argument with no renaming
      is_accepted = (lambda_object: Application) => {
        const length = String(lambda_object).length;
        const argument_length = String(lambda_object.get_right()).length;
        const renaming = hasRenaming(lambda_object, base_vars);
        const param_count = parameter_count(lambda_object);
        const depth = max_redex_parameter_lambda_depth(lambda_object);
        const reduced_length = String(norm_ord_reduce(lambda_object.copy())).length;
        const accepted = length < maxLength && param_count > 0 && argument_length >= 10 && !renaming && depth >= 3 && reduced_length < 45;
        return accepted;
      };
      break;
    case 4:
    case 5: // Long argument with renaming (4 and 5 fall through to same handler)
      is_accepted = (lambda_object: Application) => {
        const length = String(lambda_object).length;
        const argument_length = String(lambda_object.get_right()).length;
        const renaming = hasRenaming(lambda_object, base_vars);
        const param_count = parameter_count(lambda_object);
        const depth = max_redex_parameter_lambda_depth(lambda_object);
        const reduced_length = String(norm_ord_reduce(lambda_object.copy())).length;
        const accepted = length < maxLength && param_count > 0 && argument_length >= 10 && renaming && depth >= 3 && reduced_length < 45;
        return accepted;
      };
      break;
    default:
      throw new Error("branch unreachable");
  }
  let lambda: Application;
  // let i = 0;
  do {
    lambda = new Application(
      new Lambda(
        random_variable([...base_vars]),
        random_with_unique_lambdas([...base_vars], 7)
      ),
      random_with_unique_lambdas([...base_vars], 7)
    );
  } while (!is_accepted(lambda));
  return lambda;
}

// Find all variable occurrences in the expression with unique IDs (redex may be null for reduced expr)
function findVariableOccurrences(
  obj: LambdaObject,
  redex: Application | null,
  occurrences: VariableOccurrence[],
  boundVars: Variable[] = [],
  path: string = '',
  occurrenceCounter: { count: number } = { count: 0 }
): void {
  if (obj instanceof Variable) {
    const isInRedex = isInRedexSubtree(obj, redex);
    const isBound = boundVars.some(v => v.get_symbol() === obj.get_symbol());
    // Choose the nearest binder (shadowing-aware).
    // `boundVars` is built by pushing lambda parameters as we descend,
    // so the last matching symbol binds the occurrence.
    const isBoundBy = [...boundVars].reverse().find(v => v.get_symbol() === obj.get_symbol()) || null;
    
    // Use a unique ID that includes the path and a counter to ensure uniqueness
    const uniqueId = path || `var-${occurrenceCounter.count++}`;
    
    occurrences.push({
      id: uniqueId,
      variable: obj,
      symbol: obj.get_symbol(),
      isInRedex,
      isBound,
      isBoundBy
    });
  } else if (obj instanceof Lambda) {
    const parameter = obj.get_parameter();
    const newBoundVars = [...boundVars, parameter];
    const paramPath = path ? `${path}.param` : `param-${occurrenceCounter.count++}`;
    
    // Add the parameter as an occurrence
    const isInRedex = isInRedexSubtree(parameter, redex);
    occurrences.push({
      id: paramPath,
      variable: parameter,
      symbol: parameter.get_symbol(),
      isInRedex,
      isBound: false, // Parameters are not bound by themselves
      isBoundBy: null
    });
    
    // Recursively find occurrences in the body
    const bodyPath = path ? `${path}.body` : `body-${occurrenceCounter.count++}`;
    findVariableOccurrences(
      obj.get_body(),
      redex,
      occurrences,
      newBoundVars,
      bodyPath,
      occurrenceCounter
    );
  } else if (obj instanceof Application) {
    const leftPath = path ? `${path}.left` : `left-${occurrenceCounter.count++}`;
    const rightPath = path ? `${path}.right` : `right-${occurrenceCounter.count++}`;
    
    findVariableOccurrences(obj.get_left(), redex, occurrences, boundVars, leftPath, occurrenceCounter);
    findVariableOccurrences(obj.get_right(), redex, occurrences, boundVars, rightPath, occurrenceCounter);
  }
}

// Check if a variable is within the redex subtree (returns false if redex is null)
function isInRedexSubtree(obj: LambdaObject, redex: Application | null): boolean {
  if (redex === null) return false;
  // Check if obj is part of the redex by traversing up the tree
  let current: LambdaObject | null = obj;
  while (current !== null) {
    if (current === redex) {
      return true;
    }
    const parent: LambdaObject | null = current.get_parent();
    if (parent === redex) {
      return true;
    }
    current = parent;
  }

  // Also check if obj is a descendant of redex
  const checkDescendant = (node: LambdaObject): boolean => {
    if (node === obj) {
      return true;
    }
    if (node instanceof Application) {
      return checkDescendant(node.get_left()) || checkDescendant(node.get_right());
    }
    if (node instanceof Lambda) {
      return checkDescendant(node.get_parameter()) || checkDescendant(node.get_body());
    }
    return false;
  };

  return checkDescendant(redex.get_left()) || checkDescendant(redex.get_right());
}

type ResponseRecord = {
  questionStr: string;
  isCorrect: boolean;
};

export const AlphaRenameLesson: React.FC<{
  userId: string;
  authToken: string;
  onBack: () => void;
  onSubmit?: () => void;
  onAnsweredCorrect?: () => void;
  onCorrectWithoutShowAnswer?: () => void;
}> = ({ userId, authToken, onBack, onSubmit, onAnsweredCorrect, onCorrectWithoutShowAnswer }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedOccurrences, setSelectedOccurrences] = useState<Set<string>>(new Set());
  const [showResult, setShowResult] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [showAnswer, setShowAnswer] = useState(false);
  const [hadShownAnswerForCurrentQuestion, setHadShownAnswerForCurrentQuestion] = useState(false);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [responses, setResponses] = useState<ResponseRecord[]>([]);

  // Initialize questions
  if (questions.length === 0) {
    const question = new_question(getDifficultyLevel(userId, authToken, 'alpha-rename'));
    const redex = question.norm_ord_redex() as Application;
    questions.push({
      question,
      questionStr: String(question),
      redex: redex
    });
  }

  const currentQuestion = questions[currentIndex];
  const redex = currentQuestion.redex;

  // Find all variable occurrences
  const variableOccurrences = useMemo(() => {
    const occurrences: VariableOccurrence[] = [];
    findVariableOccurrences(currentQuestion.question, redex, occurrences);
    return occurrences;
  }, [currentIndex, currentQuestion.question, redex]);

  const paramVarToParamIdOrig = useMemo(
    () => buildParamVarToParamId(variableOccurrences),
    [variableOccurrences]
  );

  /** Same capture-avoiding renames beta reduction applies, without substituting the argument. */
  const captureAvoidingPreview = useMemo(() => {
    const copy = currentQuestion.question.copy();
    const rx = copy.norm_ord_redex() as Application | null;
    if (rx === null || !(rx.get_left() instanceof Lambda)) return copy;
    const lam = rx.get_left() as Lambda;
    lam.get_body().alpha_rename(lam.get_parameter(), rx.get_right().get_free_vars());
    return copy;
  }, [currentQuestion.question]);

  const correctBinderKeys = useMemo(() => {
    const occOrig: VariableOccurrence[] = [];
    const occPrev: VariableOccurrence[] = [];
    const previewRedex = captureAvoidingPreview.norm_ord_redex() as Application;
    findVariableOccurrences(currentQuestion.question, redex, occOrig);
    findVariableOccurrences(captureAvoidingPreview, previewRedex, occPrev);
    const keys = new Set<string>();
    if (occOrig.length !== occPrev.length) return keys;
    for (let i = 0; i < occOrig.length; i++) {
      if (occOrig[i].symbol !== occPrev[i].symbol) {
        keys.add(binderKeyForOccurrence(occOrig[i], paramVarToParamIdOrig));
      }
    }
    return keys;
  }, [currentQuestion.question, redex, captureAvoidingPreview, paramVarToParamIdOrig]);

  const handleToggleOccurrence = (occurrenceId: string) => {
    setSelectedOccurrences(prev => {
      const newSet = new Set(prev);
      if (newSet.has(occurrenceId)) {
        newSet.delete(occurrenceId);
      } else {
        newSet.add(occurrenceId);
      }
      return newSet;
    });
  };

  const handleSubmit = () => {
    onSubmit?.();
    setIsSubmitted(true);

    const selectedSet = new Set(selectedOccurrences);
    const correctSet = correctBinderKeys;

    const correct = selectedSet.size === correctSet.size &&
      Array.from(selectedSet).every(id => correctSet.has(id)) &&
      Array.from(correctSet).every(id => selectedSet.has(id));

    if (correct) onAnsweredCorrect?.();
    if (correct && !hadShownAnswerForCurrentQuestion) onCorrectWithoutShowAnswer?.();
    setIsCorrect(correct);
  };

  const handleNext = () => {
    setHadShownAnswerForCurrentQuestion(false);
    if (isSubmitted && isCorrect !== null) {
      setResponses(prev => [...prev, { questionStr: currentQuestion.questionStr, isCorrect }]);
    }
    const newQuestion = new_question(getDifficultyLevel(userId, authToken, 'alpha-rename'));
    const newRedex = newQuestion.norm_ord_redex() as Application;
    questions.push({
      question: newQuestion,
      questionStr: String(newQuestion),
      redex: newRedex
    });
    setCurrentIndex(currentIndex + 1);
    setSelectedOccurrences(new Set());
    setShowResult(false);
    setIsSubmitted(false);
    setShowAnswer(false);
    setIsCorrect(null);
  };

  const handleReset = () => {
    setSelectedOccurrences(new Set());
    setIsSubmitted(false);
    setShowAnswer(false);
    setIsCorrect(null);
  };

  const questionStr = currentQuestion.questionStr;
  const parenPairMap = useMemo(() => getParenPairMap(questionStr), [questionStr]);

  // --- Visual highlights for the main redex: (λx.t) t' ---
  // Blue: λx, Green: t, Red: t'
  const mainRedexLeftLambda = redex.get_left() instanceof Lambda ? (redex.get_left() as Lambda) : null;
  const mainRedexParam = mainRedexLeftLambda?.get_parameter() ?? null;
  const mainRedexBody = mainRedexLeftLambda?.get_body() ?? null;
  const mainRedexArg = redex.get_right();

  const highlightBox = (fg: string, bg: string): React.CSSProperties => ({
    backgroundColor: bg,
    borderRadius: '4px',
    padding: '0 2px',
    display: 'inline-block',
    lineHeight: '1.2',
  });

  const collectSubtreeNodes = (root: LambdaObject | null): Set<LambdaObject> => {
    const out = new Set<LambdaObject>();
    const visit = (node: LambdaObject | null) => {
      if (!node) return;
      out.add(node);
      if (node instanceof Lambda) {
        visit(node.get_parameter());
        visit(node.get_body());
      } else if (node instanceof Application) {
        visit(node.get_left());
        visit(node.get_right());
      }
    };
    visit(root);
    return out;
  };

  const tNodeSet = useMemo(() => collectSubtreeNodes(mainRedexBody), [mainRedexBody]);
  const tPrimeNodeSet = useMemo(() => collectSubtreeNodes(mainRedexArg), [mainRedexArg]);

  const LX_HL = highlightBox('#1E88E5', 'rgba(30,136,229,0.18)');
  const T_HL = highlightBox('#43A047', 'rgba(67,160,71,0.18)');
  const TPRIME_HL = highlightBox('#E53935', 'rgba(229,57,53,0.18)');

  const getOriginalHighlightStyle = (obj: LambdaObject): React.CSSProperties | undefined => {
    if (mainRedexParam && obj === mainRedexParam) return LX_HL;
    if (tNodeSet.has(obj)) return T_HL;
    if (tPrimeNodeSet.has(obj)) return TPRIME_HL;
    return undefined;
  };

  const renderOriginalExpression = () => {
    const elements: React.ReactNode[] = [];
    let occurrenceIndex = 0;
    const idx = { current: 0 };
    const renderRecursive = (obj: LambdaObject, path: string = ''): void => {
      if (obj instanceof Variable) {
        const occurrence = variableOccurrences.find(occ => occ.id === path);
        const hl = getOriginalHighlightStyle(obj);
        const boundByRedexLambdaParam = mainRedexParam !== null && occurrence?.isBoundBy === mainRedexParam;
        const boundBlue = boundByRedexLambdaParam ? LX_HL : undefined;
        const textStyle: React.CSSProperties = { verticalAlign: 'baseline', ...(hl ?? {}), ...(boundBlue ?? {}) };
        if (occurrence && occurrence.isInRedex) {
          const binderKey = binderKeyForOccurrence(occurrence, paramVarToParamIdOrig);
          const showAsChecked = showAnswer ? correctBinderKeys.has(binderKey) : selectedOccurrences.has(binderKey);
          elements.push(
            <span
              key={`orig-var-${path}`}
              style={{ position: 'relative', display: 'inline-block', margin: '0 1px', verticalAlign: 'baseline', lineHeight: '1.2', paddingBottom: '20px' }}
            >
              <span style={{ fontWeight: 'normal', display: 'inline-block', ...textStyle }}>{occurrence.symbol}</span>
              <label
                style={{
                  position: 'absolute',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  bottom: '0',
                  fontSize: '12px',
                  cursor: isSubmitted ? 'not-allowed' : 'pointer',
                  whiteSpace: 'nowrap',
                  lineHeight: '1',
                }}
              >
                <input
                  type="checkbox"
                  checked={showAsChecked}
                  onChange={() => handleToggleOccurrence(binderKey)}
                  disabled={isSubmitted}
                  style={{ cursor: isSubmitted ? 'not-allowed' : 'pointer', margin: 0, verticalAlign: 'middle', width: '10px', height: '10px' }}
                />
              </label>
            </span>
          );
        } else {
          elements.push(
            <span key={`orig-var-${path}`} style={textStyle}>
              {occurrence ? occurrence.symbol : obj.get_symbol()}
            </span>
          );
        }
        idx.current += obj.get_symbol().length;
      } else if (obj instanceof Lambda) {
        const paramPath = path ? `${path}.param` : `param-${occurrenceIndex++}`;
        const bodyPath = path ? `${path}.body` : `body-${occurrenceIndex++}`;
        idx.current += 1;
        const lamHl = obj === mainRedexLeftLambda ? LX_HL : getOriginalHighlightStyle(obj);
        elements.push(<span key={`orig-lam-${path}`} style={{ verticalAlign: 'baseline', ...(lamHl ?? {}) }}>λ</span>);
        renderRecursive(obj.get_parameter(), paramPath);
        idx.current += 1;
        // For the main redex lambda itself, keep '.' unhighlighted to separate λx from t.
        const dotHl = obj === mainRedexLeftLambda ? undefined : getOriginalHighlightStyle(obj);
        elements.push(<span key={`orig-dot-${path}`} style={{ verticalAlign: 'baseline', ...(dotHl ?? {}) }}>.</span>);
        renderRecursive(obj.get_body(), bodyPath);
      } else if (obj instanceof Application) {
        const leftNeedsParens = obj.get_left() instanceof Lambda;
        const rightNeedsParens = obj.get_right() instanceof Application || (obj.get_right() instanceof Lambda && obj.get_parent() instanceof Application && (obj.get_parent() as Application).get_left() === obj);
        const leftPath = path ? `${path}.left` : `left-${occurrenceIndex++}`;
        const rightPath = path ? `${path}.right` : `right-${occurrenceIndex++}`;
        const appHl = getOriginalHighlightStyle(obj);
        const pushParen = (key: string, char: string) => {
          const pos = idx.current++;
          const pairId = parenPairMap.get(pos);
          const color = pairId !== undefined ? PAREN_COLORS[pairId % PAREN_COLORS.length] : undefined;
          elements.push(
            <span
              key={key}
              style={{
                verticalAlign: 'baseline',
                ...(appHl ?? {}),
                ...(color ? { color, fontWeight: 'bold' as const } : {}),
              }}
            >
              {char}
            </span>
          );
        };
        if (leftNeedsParens) pushParen(`orig-lp-${path}`, '(');
        renderRecursive(obj.get_left(), leftPath);
        if (leftNeedsParens) pushParen(`orig-rp-${path}`, ')');
        idx.current += 1;
        elements.push(<span key={`orig-sp-${path}`} style={{ verticalAlign: 'baseline' }}> </span>);
        if (rightNeedsParens) pushParen(`orig-lp2-${path}`, '(');
        renderRecursive(obj.get_right(), rightPath);
        if (rightNeedsParens) pushParen(`orig-rp2-${path}`, ')');
      }
    };
    renderRecursive(currentQuestion.question, '');
    return elements;
  };

  const renderExpression = () => (
    <>
      {renderOriginalExpression()}
    </>
  );

  return (
    <div className="container">
      <div style={{ marginBottom: '20px' }}>
        <button onClick={onBack} style={{ marginBottom: '10px' }}>← Back to Menu</button>
      </div>
      <h1>Alpha Renaming</h1>
      <div style={{ marginBottom: '20px', color: '#333', fontFamily: 'inherit', fontSize: '16px' }}>
        <ul style={{ margin: '0 0 0 20px', padding: 0 }}>
          <li>
            <strong>Alpha renaming</strong> (α-renaming) changes the variable names inside a λ, but it does <strong>not</strong> change the meaning or structure of the expression. Each variable is still bound to the same lambda function.
          </li>
          <li>
            It is needed because when we substitute (beta reduction), a name clash can cause a variable occurrence to refer to a different lambda expression.
            When the argument uses a name that already exists inside the redex, we rename one of the λ’s first.
          </li>
          <li>
            <strong>What you practice here:</strong> choose the λ-parts inside the highlighted redex that must be renamed to avoid that kind of mistake.
          </li>
          <li>
            <strong>How to answer:</strong> Below there is a β-redex highlighted: function/parameter (blue), body (green), and argument (red). 
            Use the checkboxes inside that redex to select the variables and function parameters that needs renaming.
          </li>
          <li>
            <strong>Example idea:</strong> In <code>(λx. λy. x y) y</code>, the argument is <code>y</code>.
            If we substitute without renaming, that <code>y</code> ends up under the inner <code>λy</code> and means something else.
            So we rename the inner λ first: <code>λy</code> → <code>λy'</code>.
          </li>
        </ul>
      </div>
      <p style={{ marginBottom: '16px', fontSize: '13px', color: '#666' }}>
        <em>
          Note: Information about your answers is collected.
        </em>
      </p>

      {responses.map((res, idx) => (
        <div
          key={`prev-${idx}`}
          className="response"
          style={{ marginBottom: '16px', padding: '12px 16px', backgroundColor: '#f5f5f5', border: '1px solid #ddd', borderRadius: '8px' }}
        >
          <p style={{ marginBottom: '6px' }}><strong>Original:</strong></p>
          <div style={{ fontFamily: 'monospace', fontSize: '16px', lineHeight: '1.6', whiteSpace: 'pre-wrap', wordBreak: 'break-word', marginBottom: '12px' }}>
            {renderStringWithColoredParens(res.questionStr, { keyPrefix: `alpha-prev-orig-${idx}` })}
          </div>
          <p style={{ margin: 0 }}>
            {res.isCorrect ? (
              <span className="correct" style={{ fontWeight: 'bold' }}>✓ Correct!</span>
            ) : (
              <span className="incorrect">✗ Incorrect.</span>
            )}
          </p>
        </div>
      ))}

      {!showResult ? (
        <div className="question-block">
          <div 
            style={{ 
              marginBottom: '20px', 
              padding: '20px', 
              backgroundColor: '#f9f9f9', 
              border: '2px solid #dcdcdc',
              borderRadius: '8px',
              fontSize: '18px',
              fontFamily: 'monospace',
              lineHeight: '2',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word'
            }}
          >
            {renderExpression()}
          </div>
          
          <div style={{ marginBottom: '20px' }}>
            <p>
              <strong>Selected λ's to rename:</strong> {selectedOccurrences.size}
            </p>
            {isSubmitted && isCorrect !== null && (
              <p style={{ marginTop: '10px' }}>
                {isCorrect ? (
                  <span className="correct">
                    ✓ Correct! You selected the right variables to rename.
                  </span>
                ) : (
                  <span className="incorrect">
                    ✗ Incorrect. Some variables that need renaming were not selected, or some unnecessary variables were selected.
                  </span>
                )}
              </p>
            )}
          </div>

          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <button onClick={handleSubmit} disabled={isSubmitted}>
              Submit
            </button>
            {isSubmitted && (
              <>
                {!showAnswer && !isCorrect && (
                  <button onClick={() => { setShowAnswer(true); setHadShownAnswerForCurrentQuestion(true); }}>
                    Show Answer
                  </button>
                )}
                {!isCorrect && (
                  <button onClick={handleReset}>Try Again</button>
                )}
                <button onClick={handleNext}>Next Question</button>
              </>
            )}
          </div>
        </div>
      ) : (
        <div>
          <h2>Finished!</h2>
          <p>You've completed all questions. Good Job!</p>
        </div>
      )}
    </div>
  );
};
