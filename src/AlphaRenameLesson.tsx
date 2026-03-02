import React, { useState, useMemo } from 'react';
import './styles.css';
import { LambdaObject, Variable, Application, Lambda, LambdaTree, norm_ord_reduce, all_variables } from './lambda_ir';
import { getParenPairMap, PAREN_COLORS, renderStringWithColoredParens } from './coloredParens';
import { random_with_unique_lambdas, random_variable } from './random_lambda';
import { sets_eq, difference } from './SetOperations';
import { Parser } from './parser';

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

/** Strip trailing primes for display (x' -> x, x'' -> x) */
function stripPrimes(s: string): string {
  return s.replace(/'+/g, '');
}

/** Build display string for a reduced expression with variable names shown without primes. */
function reducedToDisplayString(obj: LambdaObject): string {
  if (obj instanceof Variable) return stripPrimes(obj.get_symbol());
  if (obj instanceof Lambda) {
    const param = stripPrimes(obj.get_parameter().get_symbol());
    const body = reducedToDisplayString(obj.get_body());
    return 'λ' + param + '.' + body;
  }
  if (obj instanceof Application) {
    const left = obj.get_left();
    const right = obj.get_right();
    const lStr = left instanceof Lambda ? '(' + reducedToDisplayString(left) + ')' : reducedToDisplayString(left);
    const rStr = right instanceof Lambda || right instanceof Application
      ? '(' + reducedToDisplayString(right) + ')'
      : reducedToDisplayString(right);
    return lStr + ' ' + rStr;
  }
  return '';
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
function new_question(): Application {
  let is_accepted: (lambda_object: Application) => boolean;
  const base_vars = new Set(['v', 'w', 'x', 'y', 'z']);
  switch (Math.floor(6 / 6 * Math.random()) + 4) {
    case 0: // Short argument with no renaming
      is_accepted = (lambda_object: Application) => {
        const length = String(lambda_object).length;
        const argument_length = String(lambda_object.get_right()).length;
        const renaming = hasRenaming(lambda_object, base_vars);
        const param_count = parameter_count(lambda_object);
        const depth = max_redex_parameter_lambda_depth(lambda_object);
        const reduced_length = String(norm_ord_reduce(lambda_object.copy())).length;
        const accepted = length < 45 && param_count > 0 && argument_length < 10 && !renaming && depth >= 3 && reduced_length < 45;
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
        const accepted = length < 45 && param_count > 0 && argument_length < 10 && renaming && depth >= 3 && reduced_length < 45;
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
        const accepted = length < 45 && param_count > 0 && argument_length >= 10 && !renaming && depth >= 3 && reduced_length < 45;
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
        const accepted = length < 45 && param_count > 0 && argument_length >= 10 && renaming && depth >= 3 && reduced_length < 45;
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
    /* 
    console.log("i", i);
    if (i++ >= 100_000) {
      lambda = new Parser("(L x. x) x").parse_input()[0] as Application;
      break;
    }
     */
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
    const isBoundBy = boundVars.find(v => v.get_symbol() === obj.get_symbol()) || null;
    
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

// Check if a variable occurrence is in the redex
function isOccurrenceInRedex(occurrence: VariableOccurrence, redex: Application): boolean {
  return isInRedexSubtree(occurrence.variable, redex);
}

type ResponseRecord = {
  questionStr: string;
  reducedDisplayStr: string;
  isCorrect: boolean;
};

export const AlphaRenameLesson: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedOccurrences, setSelectedOccurrences] = useState<Set<string>>(new Set());
  const [showResult, setShowResult] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [showAnswer, setShowAnswer] = useState(false);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [responses, setResponses] = useState<ResponseRecord[]>([]);

  // Initialize questions
  if (questions.length === 0) {
    const question = new_question();
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
  }, [currentIndex]);

  // Get occurrences that are in the redex
  const redexOccurrences = useMemo(() => {
    return variableOccurrences.filter(occ => occ.isInRedex);
  }, [variableOccurrences]);

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

  // Reduced expression and the subtree that is the result of the reduction (for highlighting)
  const reducedExpression = useMemo(() => {
    const copy = currentQuestion.question.copy();
    return norm_ord_reduce(copy) ?? copy;
  }, [currentQuestion.question]);

  // Variable occurrences in the reduced expression (for checkboxes)
  const reducedVariableOccurrences = useMemo(() => {
    const occurrences: VariableOccurrence[] = [];
    findVariableOccurrences(reducedExpression, null, occurrences);
    return occurrences;
  }, [reducedExpression]);

  // In the reduced expression, variables that were renamed have ' in their symbol
  const reducedVariablesToRename = useMemo(
    () => new Set(reducedVariableOccurrences.filter(occ => /'/.test(occ.symbol)).map(occ => occ.id)),
    [reducedVariableOccurrences]
  );

  // Determine which variables should be renamed in original (kept for redexOccurrences / display logic)
  const variablesToRename = useMemo(() => {
    const toRename = new Set<string>();

    if (redex.get_left() instanceof Lambda) {
      const lambda = redex.get_left() as Lambda;
      const parameter = lambda.get_parameter();
      const body = lambda.get_body();
      const argument = redex.get_right();

      const freeVarsInArgument = argument.get_free_vars();

      if (freeVarsInArgument.has(parameter.get_symbol())) {
        const paramOcc = redexOccurrences.find(occ =>
          occ.variable === parameter && !occ.isBound
        );
        if (paramOcc) {
          toRename.add(paramOcc.id);
        }
      }

      redexOccurrences.forEach(occ => {
        if (occ.isBound && occ.isBoundBy && freeVarsInArgument.has(occ.symbol)) {
          toRename.add(occ.id);
        }
      });
    }

    return toRename;
  }, [redex, redexOccurrences]);

  const handleSubmit = () => {
    setIsSubmitted(true);

    const selectedSet = new Set(selectedOccurrences);
    const correctSet = reducedVariablesToRename;

    const correct = selectedSet.size === correctSet.size &&
      Array.from(selectedSet).every(id => correctSet.has(id)) &&
      Array.from(correctSet).every(id => selectedSet.has(id));

    setIsCorrect(correct);
  };

  const handleNext = () => {
    if (isSubmitted && isCorrect !== null) {
      const copy = currentQuestion.question.copy();
      const reduced = norm_ord_reduce(copy) ?? copy;
      const reducedDisplayStr = String(reduced);
      setResponses(prev => [...prev, { questionStr: currentQuestion.questionStr, reducedDisplayStr, isCorrect }]);
    }
    const newQuestion = new_question();
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
  const reducedParenPairMap = useMemo(() => getParenPairMap(String(reducedExpression)), [reducedExpression]);

  const renderOriginalExpression = () => {
    const elements: React.ReactNode[] = [];
    let occurrenceIndex = 0;
    const idx = { current: 0 };
    const renderRecursive = (obj: LambdaObject, path: string = ''): void => {
      if (obj instanceof Variable) {
        const occurrence = variableOccurrences.find(occ => occ.id === path);
        elements.push(
          <span key={`orig-var-${path}`} style={{ verticalAlign: 'baseline' }}>
            {occurrence ? occurrence.symbol : obj.get_symbol()}
          </span>
        );
        idx.current += obj.get_symbol().length;
      } else if (obj instanceof Lambda) {
        const paramPath = path ? `${path}.param` : `param-${occurrenceIndex++}`;
        const bodyPath = path ? `${path}.body` : `body-${occurrenceIndex++}`;
        idx.current += 1;
        elements.push(<span key={`orig-lam-${path}`} style={{ verticalAlign: 'baseline' }}>λ</span>);
        renderRecursive(obj.get_parameter(), paramPath);
        idx.current += 1;
        elements.push(<span key={`orig-dot-${path}`} style={{ verticalAlign: 'baseline' }}>.</span>);
        renderRecursive(obj.get_body(), bodyPath);
      } else if (obj instanceof Application) {
        const leftNeedsParens = obj.get_left() instanceof Lambda;
        const rightNeedsParens = obj.get_right() instanceof Application || (obj.get_right() instanceof Lambda && obj.get_parent() instanceof Application && (obj.get_parent() as Application).get_left() === obj);
        const leftPath = path ? `${path}.left` : `left-${occurrenceIndex++}`;
        const rightPath = path ? `${path}.right` : `right-${occurrenceIndex++}`;
        const pushParen = (key: string, char: string) => {
          const pos = idx.current++;
          const pairId = parenPairMap.get(pos);
          const color = pairId !== undefined ? PAREN_COLORS[pairId % PAREN_COLORS.length] : undefined;
          elements.push(<span key={key} style={{ verticalAlign: 'baseline', ...(color ? { color, fontWeight: 'bold' as const } : {}) }}>{char}</span>);
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

  const renderReducedExpression = () => {
    const elements: React.ReactNode[] = [];
    let occurrenceIndex = 0;
    let varCounter = 0;
    const idx = { current: 0 };
    const renderRecursive = (obj: LambdaObject, path: string = ''): void => {
      if (obj instanceof Variable) {
        const lookupId = path || `var-${varCounter++}`;
        const occurrence = reducedVariableOccurrences.find(occ => occ.id === lookupId);
        if (occurrence) {
          const showAsChecked = showAnswer ? reducedVariablesToRename.has(occurrence.id) : selectedOccurrences.has(occurrence.id);
          const displaySymbol = stripPrimes(occurrence.symbol);
          elements.push(
            <span key={`red-var-${occurrence.id}`} style={{ position: 'relative', display: 'inline-block', margin: '0 1px', verticalAlign: 'baseline', lineHeight: '1.2', paddingBottom: '20px' }}>
              <span style={{ fontWeight: 'normal', display: 'inline-block', verticalAlign: 'baseline' }}>{displaySymbol}</span>
              <label style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)', bottom: '0', fontSize: '12px', cursor: isSubmitted ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap', lineHeight: '1' }}>
                <input type="checkbox" checked={showAsChecked} onChange={() => handleToggleOccurrence(occurrence.id)} disabled={isSubmitted} style={{ cursor: isSubmitted ? 'not-allowed' : 'pointer', margin: 0, verticalAlign: 'middle', width: '10px', height: '10px' }} />
              </label>
            </span>
          );
        } else {
          elements.push(<span key={`red-fb-${path}`}>{stripPrimes(obj.get_symbol())}</span>);
        }
        idx.current += obj.get_symbol().length;
      } else if (obj instanceof Lambda) {
        const paramPath = path ? `${path}.param` : `param-${occurrenceIndex++}`;
        const bodyPath = path ? `${path}.body` : `body-${occurrenceIndex++}`;
        idx.current += 1;
        elements.push(<span key={`red-lam-${path}`} style={{ verticalAlign: 'baseline' }}>λ</span>);
        renderRecursive(obj.get_parameter(), paramPath);
        idx.current += 1;
        elements.push(<span key={`red-dot-${path}`} style={{ verticalAlign: 'baseline' }}>.</span>);
        renderRecursive(obj.get_body(), bodyPath);
      } else if (obj instanceof Application) {
        const leftNeedsParens = obj.get_left() instanceof Lambda;
        const rightNeedsParens = obj.get_right() instanceof Application || (obj.get_right() instanceof Lambda && obj.get_parent() instanceof Application && (obj.get_parent() as Application).get_left() === obj);
        const leftPath = path ? `${path}.left` : `left-${occurrenceIndex++}`;
        const rightPath = path ? `${path}.right` : `right-${occurrenceIndex++}`;
        const pushParen = (key: string, char: string) => {
          const pos = idx.current++;
          const pairId = reducedParenPairMap.get(pos);
          const color = pairId !== undefined ? PAREN_COLORS[pairId % PAREN_COLORS.length] : undefined;
          elements.push(<span key={key} style={{ verticalAlign: 'baseline', ...(color ? { color, fontWeight: 'bold' as const } : {}) }}>{char}</span>);
        };
        if (leftNeedsParens) pushParen(`red-lp-${path}`, '(');
        renderRecursive(obj.get_left(), leftPath);
        if (leftNeedsParens) pushParen(`red-rp-${path}`, ')');
        idx.current += 1;
        elements.push(<span key={`red-sp-${path}`}> </span>);
        if (rightNeedsParens) pushParen(`red-lp2-${path}`, '(');
        renderRecursive(obj.get_right(), rightPath);
        if (rightNeedsParens) pushParen(`red-rp2-${path}`, ')');
      }
    };
    renderRecursive(reducedExpression, '');
    return elements;
  };

  const renderExpression = () => (
    <>
      {renderOriginalExpression()}
      <span style={{ display: 'block', marginTop: '4px' }}>{renderReducedExpression()}</span>
    </>
  );

  return (
    <div className="container">
      <div style={{ marginBottom: '20px' }}>
        <button onClick={onBack} style={{ marginBottom: '10px' }}>← Back to Menu</button>
      </div>
      <h1>Alpha Renaming</h1>
      <p style={{ marginBottom: '20px', color: '#666' }}>
        The first line is the original expression (green = redex). The second line is after reducing that redex; check the variables in the reduced expression that were renamed (e.g. x became x') to avoid variable capture.
        Variables in different positions with the same name are handled separately.
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
          <p style={{ marginBottom: '6px' }}><strong>Reduced:</strong></p>
          <div style={{ fontFamily: 'monospace', fontSize: '16px', lineHeight: '1.6', whiteSpace: 'pre-wrap', wordBreak: 'break-word', marginBottom: '8px' }}>
            {renderStringWithColoredParens(res.reducedDisplayStr, { keyPrefix: `alpha-prev-red-${idx}` })}
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
              <strong>Selected variables:</strong> {selectedOccurrences.size}
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
                  <button onClick={() => setShowAnswer(true)}>
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
          <p>You've completed all questions. Great job!</p>
        </div>
      )}
    </div>
  );
};
