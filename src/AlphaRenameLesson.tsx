import React, { useState, useMemo } from 'react';
import './styles.css';
import { LambdaObject, Variable, Application, Lambda, norm_ord_reduce, all_variables, max_redex_height } from './lambda_ir';
import { random_lambda } from './random_lambda';
import { sets_eq, difference } from './SetOperations';

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

let questions: Question[] = [];

// Generate a lambda expression with exactly one redex
function new_question(): LambdaObject {
  let is_accepted: Function;
  let base_vars: Set<string> = new Set(["x", "y", "z"]);
  switch (Math.floor(Math.random())) {
	  case 0: // Two  nested relexes with no renaming
      is_accepted = (lambda_object: LambdaObject) => {
        let reduced = norm_ord_reduce(lambda_object.copy()) as LambdaObject;
        let all_vars = all_variables(reduced);
        
        return lambda_object.redexes().length === 2
          && difference(all_vars, base_vars).size === 0
          && max_redex_height(lambda_object) === 2;
      };
      break;
		case 1: // Two  nested relexes with renaming
      is_accepted = (lambda_object: LambdaObject) => {
        let reduced = norm_ord_reduce(lambda_object.copy()) as LambdaObject;
        let all_vars = all_variables(reduced);

        return lambda_object.redexes().length === 2
          && difference(all_vars, base_vars).size > 0
          && max_redex_height(lambda_object) === 2;
      };
      break;
    case 3: // Multiple nested relexes with no renaming
      is_accepted = (lambda_object: LambdaObject) => {
        let reduced = norm_ord_reduce(lambda_object.copy()) as LambdaObject;
        let all_vars = all_variables(reduced);

        return lambda_object.redexes().length === 2
        && difference(all_vars, base_vars).size === 0
        && max_redex_height(lambda_object) === 2;
      };
      break;
    case 4: // Multiple nested relexes with renaming
      is_accepted = (lambda_object: LambdaObject) => {
        let reduced = norm_ord_reduce(lambda_object.copy()) as LambdaObject;
        let all_vars = all_variables(reduced);

        return lambda_object.redexes().length === 2
        && difference(all_vars, base_vars).size === 0
        && max_redex_height(lambda_object) === 2;
      };
      break;
    default:
      throw new Error("branch unreachable");

  }
  let lambda: LambdaObject;
  do {
    lambda = random_lambda([...base_vars], 5);
  } while (!is_accepted(lambda));
  return lambda;
}

// Find all variable occurrences in the expression with unique IDs
function findVariableOccurrences(
  obj: LambdaObject,
  redex: Application,
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

// Check if a variable is within the redex subtree
function isInRedexSubtree(obj: LambdaObject, redex: Application): boolean {
  // Check if obj is part of the redex by traversing up the tree
  let current: LambdaObject | null = obj;
  while (current !== null) {
    if (current === redex) {
      return true;
    }
    const parent = current.get_parent();
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

export const AlphaRenameLesson: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedOccurrences, setSelectedOccurrences] = useState<Set<string>>(new Set());
  const [showResult, setShowResult] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [showAnswer, setShowAnswer] = useState(false);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);

  // Initialize questions
  if (questions.length === 0) {
    const question = new_question();
    const redexes = question.redexes();
    if (redexes.length !== 1) {
      throw new Error('Expected exactly one redex');
    }
    questions.push({
      question,
      questionStr: String(question),
      redex: redexes[0]
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

  // Determine which variables should be renamed (would cause variable capture)
  const variablesToRename = useMemo(() => {
    const toRename = new Set<string>();
    
    if (redex.get_left() instanceof Lambda) {
      const lambda = redex.get_left() as Lambda;
      const parameter = lambda.get_parameter();
      const body = lambda.get_body();
      const argument = redex.get_right();
      
      // Get free variables in the argument
      const freeVarsInArgument = argument.get_free_vars();
      
      // Check if the parameter appears in the argument (needs renaming)
      if (freeVarsInArgument.has(parameter.get_symbol())) {
        // Find the parameter occurrence in the redex
        const paramOcc = redexOccurrences.find(occ => 
          occ.variable === parameter && !occ.isBound
        );
        if (paramOcc) {
          toRename.add(paramOcc.id);
        }
      }
      
      // Check for bound variables in the body that match free variables in argument
      redexOccurrences.forEach(occ => {
        if (occ.isBound && occ.isBoundBy && freeVarsInArgument.has(occ.symbol)) {
          // This bound variable would be captured
          toRename.add(occ.id);
        }
      });
    }
    
    return toRename;
  }, [redex, redexOccurrences]);

  const handleSubmit = () => {
    setIsSubmitted(true);
    
    // Check if the selected variables match the ones that should be renamed
    const selectedSet = new Set(selectedOccurrences);
    const correctSet = variablesToRename;
    
    // Check if sets are equal
    const correct = selectedSet.size === correctSet.size &&
      Array.from(selectedSet).every(id => correctSet.has(id)) &&
      Array.from(correctSet).every(id => selectedSet.has(id));
    
    setIsCorrect(correct);
  };

  const handleNext = () => {
    // Generate new question
    const newQuestion = new_question();
    const newRedexes = newQuestion.redexes();
    if (newRedexes.length !== 1) {
      throw new Error('Expected exactly one redex');
    }
    questions.push({
      question: newQuestion,
      questionStr: String(newQuestion),
      redex: newRedexes[0]
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

  // Render the expression with checkboxes below variables
  const renderExpression = () => {
    const elements: React.ReactNode[] = [];
    let occurrenceIndex = 0;
    
    // Recursive function to render the expression
    const renderRecursive = (obj: LambdaObject, path: string = '', isInRedexContext: boolean = false): void => {
      const isInRedex = obj === redex || isInRedexContext || isInRedexSubtree(obj, redex);
      
      if (obj instanceof Variable) {
        // Find the occurrence for this variable at this path
        const occurrence = variableOccurrences.find(occ => occ.id === path);
        if (occurrence) {
          const isSelected = selectedOccurrences.has(occurrence.id);
          const varIsInRedex = occurrence.isInRedex;
          
          elements.push(
            <span
              key={`var-${occurrence.id}`}
              style={{
                position: 'relative',
                display: 'inline-block',
                margin: '0 1px',
                verticalAlign: 'baseline',
                lineHeight: '1.2',
                ...(varIsInRedex ? {
                  backgroundColor: 'rgba(40, 167, 69, 0.1)',
                  padding: '2px 4px',
                  paddingBottom: '20px', // Extra space for checkbox
                  borderRadius: '3px'
                } : {
                  paddingBottom: '18px' // Space for checkbox below
                })
              }}
            >
              <span
                style={{
                  fontWeight: 'normal',
                  display: 'inline-block',
                  verticalAlign: 'baseline'
                }}
              >
                {occurrence.symbol}
              </span>
              <label
                style={{
                  position: 'absolute',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  bottom: '0',
                  fontSize: '12px',
                  cursor: isSubmitted ? 'not-allowed' : 'pointer',
                  whiteSpace: 'nowrap',
                  lineHeight: '1'
                }}
              >
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => handleToggleOccurrence(occurrence.id)}
                  disabled={isSubmitted}
                  style={{
                    cursor: isSubmitted ? 'not-allowed' : 'pointer',
                    margin: 0,
                    verticalAlign: 'middle',
                    width: '10px',
                    height: '10px'
                  }}
                />
              </label>
            </span>
          );
        } else {
          // Fallback if occurrence not found
          elements.push(
            <span 
              key={`fallback-${occurrenceIndex++}`}
              style={{
                verticalAlign: 'baseline',
                ...(isInRedex ? {
                  backgroundColor: 'rgba(40, 167, 69, 0.1)',
                  padding: '2px 4px',
                  borderRadius: '3px'
                } : {})
              }}
            >
              {obj.get_symbol()}
            </span>
          );
        }
      } else if (obj instanceof Lambda) {
        const parameter = obj.get_parameter();
        const paramPath = path ? `${path}.param` : `param-${occurrenceIndex++}`;
        const bodyPath = path ? `${path}.body` : `body-${occurrenceIndex++}`;
        
        const lambdaInRedex = isInRedex || obj === redex.get_left();
        
        elements.push(
          <span 
            key={`lambda-${path}`}
            style={{
              verticalAlign: 'baseline',
              ...(lambdaInRedex ? {
                backgroundColor: 'rgba(40, 167, 69, 0.1)',
                padding: '2px',
                borderRadius: '3px'
              } : {})
            }}
          >
            λ
          </span>
        );
        renderRecursive(parameter, paramPath, lambdaInRedex);
        elements.push(
          <span 
            key={`dot-${path}`}
            style={{
              verticalAlign: 'baseline',
              ...(lambdaInRedex ? {
                backgroundColor: 'rgba(40, 167, 69, 0.1)',
                padding: '2px',
                borderRadius: '3px'
              } : {})
            }}
          >
            .
          </span>
        );
        renderRecursive(obj.get_body(), bodyPath, lambdaInRedex);
      } else if (obj instanceof Application) {
        const leftNeedsParens = obj.get_left() instanceof Lambda;
        const rightNeedsParens = obj.get_right() instanceof Application || 
                                (obj.get_right() instanceof Lambda && 
                                 obj.get_parent() instanceof Application && 
                                 (obj.get_parent() as Application).get_left() === obj);
        
        const leftPath = path ? `${path}.left` : `left-${occurrenceIndex++}`;
        const rightPath = path ? `${path}.right` : `right-${occurrenceIndex++}`;
        
        const appInRedex = obj === redex || isInRedex;
        
        if (leftNeedsParens) {
          elements.push(
            <span 
              key={`lparen-left-${path}`}
              style={{
                verticalAlign: 'baseline',
                ...(appInRedex ? {
                  backgroundColor: 'rgba(40, 167, 69, 0.1)',
                  padding: '2px',
                  borderRadius: '3px'
                } : {})
              }}
            >
              (
            </span>
          );
        }
        renderRecursive(obj.get_left(), leftPath, appInRedex);
        if (leftNeedsParens) {
          elements.push(
            <span 
              key={`rparen-left-${path}`}
              style={{
                verticalAlign: 'baseline',
                ...(appInRedex ? {
                  backgroundColor: 'rgba(40, 167, 69, 0.1)',
                  padding: '2px',
                  borderRadius: '3px'
                } : {})
              }}
            >
              )
            </span>
          );
        }
        elements.push(
          <span 
            key={`space-${path}`}
            style={{
              verticalAlign: 'baseline',
              ...(appInRedex ? {
                backgroundColor: 'rgba(40, 167, 69, 0.1)',
                padding: '2px',
                borderRadius: '3px'
              } : {})
            }}
          >
            {' '}
          </span>
        );
        if (rightNeedsParens) {
          elements.push(
            <span 
              key={`lparen-right-${path}`}
              style={{
                verticalAlign: 'baseline',
                ...(appInRedex ? {
                  backgroundColor: 'rgba(40, 167, 69, 0.1)',
                  padding: '2px',
                  borderRadius: '3px'
                } : {})
              }}
            >
              (
            </span>
          );
        }
        renderRecursive(obj.get_right(), rightPath, appInRedex);
        if (rightNeedsParens) {
          elements.push(
            <span 
              key={`rparen-right-${path}`}
              style={{
                verticalAlign: 'baseline',
                ...(appInRedex ? {
                  backgroundColor: 'rgba(40, 167, 69, 0.1)',
                  padding: '2px',
                  borderRadius: '3px'
                } : {})
              }}
            >
              )
            </span>
          );
        }
      }
    };
    
    renderRecursive(currentQuestion.question);
    return elements;
  };

  return (
    <div className="container">
      <div style={{ marginBottom: '20px' }}>
        <button onClick={onBack} style={{ marginBottom: '10px' }}>← Back to Menu</button>
      </div>
      <h1>Alpha Renaming</h1>
      <p style={{ marginBottom: '20px', color: '#666' }}>
        Select which variables in the redex should be renamed to avoid variable capture.
        Variables in different positions with the same name are handled separately.
      </p>

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
              {redexOccurrences.length > 0 && (
                <span> | <strong>Variables in redex:</strong> {redexOccurrences.length}</span>
              )}
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
            {showAnswer && (
              <div style={{ marginTop: '10px', padding: '10px', backgroundColor: '#f0f0f0', borderRadius: '5px' }}>
                <p><strong>Variables that should be renamed:</strong></p>
                <ul style={{ margin: '5px 0', paddingLeft: '20px' }}>
                  {Array.from(variablesToRename).map(id => {
                    const occ = variableOccurrences.find(o => o.id === id);
                    return occ ? (
                      <li key={id}>
                        <strong>{occ.symbol}</strong> (bound by {occ.isBoundBy?.get_symbol() || 'lambda parameter'})
                      </li>
                    ) : null;
                  })}
                  {variablesToRename.size === 0 && (
                    <li>No variables need to be renamed - there is no variable capture risk.</li>
                  )}
                </ul>
              </div>
            )}
          </div>

          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <button onClick={handleSubmit} disabled={isSubmitted}>
              Submit
            </button>
            {isSubmitted && (
              <>
                {!showAnswer && (
                  <button onClick={() => setShowAnswer(true)}>
                    Show Answer
                  </button>
                )}
                <button onClick={handleReset}>Try Again</button>
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
