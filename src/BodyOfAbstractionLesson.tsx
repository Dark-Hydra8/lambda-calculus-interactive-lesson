import React, { useState, useMemo, useRef } from 'react';
import './styles.css';
import { LambdaObject, Variable, Application, Lambda } from './lambda_ir';
import { random_lambda } from './random_lambda';

type Question = {
  question: LambdaObject;
  questionStr: string;
  correctBodies: Lambda[];
};

type SelectionRange = {
  start: number;
  end: number;
};

type BodyRange = {
  lambda: Lambda | null; // null for parenthesized content
  body: LambdaObject;
  start: number;
  end: number;
};

let questions: Question[] = [];

// Helper functions to convert between positions with and without spaces
function positionWithoutSpaces(text: string, posWithSpaces: number): number {
  let count = 0;
  for (let i = 0; i < posWithSpaces && i < text.length; i++) {
    if (text[i] !== ' ') {
      count++;
    }
  }
  return count;
}

function positionWithSpaces(text: string, posWithoutSpaces: number): number {
  let count = 0;
  let pos = 0;
  while (pos < text.length && count <= posWithoutSpaces) {
    if (text[pos] !== ' ') {
      if (count === posWithoutSpaces) {
        return pos;
      }
      count++;
    }
    pos++;
  }
  return pos;
}

// Count bodies of abstraction in an expression (without building full ranges)
function countBodiesOfAbstraction(obj: LambdaObject, startPos: number): { count: number, endPos: number } {
  if (obj instanceof Variable) {
    return { count: 0, endPos: startPos + obj.get_symbol().length };
  } else if (obj instanceof Lambda) {
    let pos = startPos;
    pos += 1; // λ
    pos += obj.get_parameter().get_symbol().length;
    pos += 1; // .
    
    // Count the body after the dot (right child of lambda)
    const bodyResult = countBodiesOfAbstraction(obj.get_body(), pos);
    pos = bodyResult.endPos;
    
    // Count this body (right child of lambda)
    let count = 1 + bodyResult.count;
    
    return { count, endPos: pos };
  } else if (obj instanceof Application) {
    const leftNeedsParens = obj.get_left() instanceof Lambda;
    const rightNeedsParens = obj.get_right() instanceof Application || 
                            (obj.get_right() instanceof Lambda && 
                             obj.get_parent() instanceof Application && 
                             (obj.get_parent() as Application).get_left() === obj);
    
    let pos = startPos;
    let count = 0;
    
    if (leftNeedsParens) {
      pos += 1; // (
      const leftResult = countBodiesOfAbstraction(obj.get_left(), pos);
      pos = leftResult.endPos;
      
      // Count content inside parentheses
      count += 1 + leftResult.count;
      
      pos += 1; // )
    } else {
      const leftResult = countBodiesOfAbstraction(obj.get_left(), pos);
      pos = leftResult.endPos;
      count += leftResult.count;
    }
    
    // Skip space - don't increment pos
    if (rightNeedsParens) {
      pos += 1; // (
      const rightResult = countBodiesOfAbstraction(obj.get_right(), pos);
      pos = rightResult.endPos;
      
      // Count content inside parentheses
      count += 1 + rightResult.count;
      
      pos += 1; // )
    } else {
      const rightResult = countBodiesOfAbstraction(obj.get_right(), pos);
      pos = rightResult.endPos;
      count += rightResult.count;
    }
    
    return { count, endPos: pos };
  }
  return { count: 0, endPos: startPos };
}

function new_question(): LambdaObject {
  let lambda: LambdaObject;
  let totalBodies = 0;
  do {
    lambda = random_lambda(["w", "x", "y", "z"], 3);
    // Count bodies of abstraction (including the entire expression)
    const result = countBodiesOfAbstraction(lambda, 0);
    totalBodies = result.count + 1; // +1 for the entire expression
  } while (lambda.toString().replace(/\s/g, '').length < 5 || totalBodies >= 8);
  return lambda;
}

// Find all lambda abstractions in the expression
function findAllLambdas(obj: LambdaObject, lambdas: Lambda[] = []): Lambda[] {
  if (obj instanceof Lambda) {
    lambdas.push(obj);
    findAllLambdas(obj.get_body(), lambdas);
  } else if (obj instanceof Application) {
    findAllLambdas(obj.get_left(), lambdas);
    findAllLambdas(obj.get_right(), lambdas);
  }
  return lambdas;
}

// Build a mapping of character positions to Lambda body objects
// Traverses the tree and tracks character positions WITHOUT counting spaces
function buildBodyRanges(
  obj: LambdaObject,
  startPos: number,
  bodyRanges: BodyRange[],
  fullString: string
): number {
  if (obj instanceof Variable) {
    return startPos + obj.get_symbol().length;
  } else if (obj instanceof Lambda) {
    let pos = startPos;
    pos += 1; // λ
    pos += obj.get_parameter().get_symbol().length;
    pos += 1; // .
    
    // Record the body range (starts after the dot) - this is the right child of the lambda
    const bodyStart = pos;
    pos = buildBodyRanges(obj.get_body(), pos, bodyRanges, fullString);
    const bodyEnd = pos;
    
    // Record the body after the dot (right child of lambda expression)
    bodyRanges.push({
      lambda: obj,
      body: obj.get_body(),
      start: bodyStart,
      end: bodyEnd,
    });
    
    return pos;
  } else if (obj instanceof Application) {
    const leftNeedsParens = obj.get_left() instanceof Lambda;
    const rightNeedsParens = obj.get_right() instanceof Application || 
                            (obj.get_right() instanceof Lambda && 
                             obj.get_parent() instanceof Application && 
                             (obj.get_parent() as Application).get_left() === obj);
    
    let pos = startPos;
    if (leftNeedsParens) {
      pos += 1; // (
      const parenContentStart = pos;
      pos = buildBodyRanges(obj.get_left(), pos, bodyRanges, fullString);
      const parenContentEnd = pos;
      
      // Record the content inside parentheses as a body
      bodyRanges.push({
        lambda: null,
        body: obj.get_left(),
        start: parenContentStart,
        end: parenContentEnd,
      });
      
      pos += 1; // )
    } else {
      pos = buildBodyRanges(obj.get_left(), pos, bodyRanges, fullString);
    }
    
    // Skip space - don't increment pos
    if (rightNeedsParens) {
      pos += 1; // (
      const parenContentStart = pos;
      pos = buildBodyRanges(obj.get_right(), pos, bodyRanges, fullString);
      const parenContentEnd = pos;
      
      // Record the content inside parentheses as a body
      bodyRanges.push({
        lambda: null,
        body: obj.get_right(),
        start: parenContentStart,
        end: parenContentEnd,
      });
      
      pos += 1; // )
    } else {
      pos = buildBodyRanges(obj.get_right(), pos, bodyRanges, fullString);
    }
    
    return pos;
  }
  return startPos;
}

// Find all body ranges that overlap with the selection range
function findBodiesInRange(
  selection: SelectionRange,
  bodyRanges: BodyRange[]
): BodyRange[] {
  const result: BodyRange[] = [];
  for (const range of bodyRanges) {
    // Check if selection overlaps with body range
    if (selection.start < range.end && selection.end > range.start) {
      result.push(range);
    }
  }
  return result;
}

type ConfirmedBody = {
  range: SelectionRange;
};

export const BodyOfAbstractionLesson: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [currentSelection, setCurrentSelection] = useState<SelectionRange | null>(null);
  const [confirmedBodies, setConfirmedBodies] = useState<ConfirmedBody[]>([]);
  const [showAnswers, setShowAnswers] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [responses, setResponses] = useState<Array<{
    question: LambdaObject;
    questionStr: string;
    selectedBodies: SelectionRange[];
    correctBodies: BodyRange[];
    isCorrect: boolean;
  }>>([]);
  const instructions = 'What is a body of abstraction?\n\n' +
    'A body of abstraction can be thought of like a list, only instead of being separated by commas, it is separated by spaces.\n\n' +
    'Individual elements of the list can be:\n' +
    '- A single variable.\n' +
    '- Another body of abstraction within parentheses.\n' +
    '- Inside a lambda function (λx.___) at the every end of the list. Everything up until the next \')\' is inside that lambda function\'s body of abstraction.\n\n' +
    'A bodies of abstraction shows up in the following places:\n' +
    '- As the entire expression.\n' +
    '- As the contents of any parentheses.\n' +
    '- As the body of a lambda function (Anything after the dot in λx.___).\n\n' +
    'Example: The expression "y λx.(x y) x" has three bodies of abstraction.\n' +
    ' - The entire expression: "y λx.(x y) x".\n' +
    ' - The body of the lambda function: "(x y) x".\n' +
    ' - The inside of the parentheses: "x y".\n\n' +
    'Your task is to hightlight every body of abstraction in the expression below. Hightlight a each body of abstraction in turn, confirm your selection, and click submit once all bodies of abstraction have been highlighted.';
  const textRef = useRef<HTMLDivElement>(null);
  const isProcessingRef = useRef(false);

  // Initialize questions
  if (questions.length === 0) {
    const question = new_question();
    const correctBodies = findAllLambdas(question);
    questions.push({
      question,
      questionStr: String(question),
      correctBodies,
    });
  }

  const currentQuestion = questions[currentIndex];
  
  // Build body ranges for the current question (positions without spaces)
  const bodyRanges = useMemo(() => {
    const ranges: BodyRange[] = [];
    const fullString = currentQuestion.questionStr;
    const endPos = buildBodyRanges(currentQuestion.question, 0, ranges, fullString);
    
    // Ensure the entire lambda expression is included as a body of abstraction
    const entireExpressionRange: BodyRange = {
      lambda: null,
      body: currentQuestion.question,
      start: 0,
      end: endPos,
    };
    
    // Check if the entire expression range already exists
    const entireRangeKey = `0-${endPos}`;
    const hasEntireExpression = ranges.some(r => `${r.start}-${r.end}` === entireRangeKey);
    
    if (!hasEntireExpression) {
      ranges.push(entireExpressionRange);
    }
    
    // Deduplicate ranges with the same start and end positions
    const rangeMap = new Map<string, BodyRange>();
    for (const range of ranges) {
      const rangeKey = `${range.start}-${range.end}`;
      if (!rangeMap.has(rangeKey)) {
        rangeMap.set(rangeKey, range);
      }
    }
    
    const deduplicated = Array.from(rangeMap.values());
    // Sort by start position for easier processing
    deduplicated.sort((a, b) => a.start - b.start);
    return deduplicated;
  }, [currentQuestion.question, currentQuestion.questionStr]);

  // Build mapping from range to body range for display
  const rangeToBodyRangeMap = useMemo(() => {
    const map = new Map<string, BodyRange>();
    for (const bodyRange of bodyRanges) {
      const rangeKey = `${bodyRange.start}-${bodyRange.end}`;
      map.set(rangeKey, bodyRange);
    }
    return map;
  }, [bodyRanges]);

  // Get bodies covered by current selection
  const currentSelectionBodies = useMemo(() => {
    if (!currentSelection) return [];
    return findBodiesInRange(currentSelection, bodyRanges);
  }, [currentSelection, bodyRanges]);

  const handleTextSelection = () => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;
    
    const range = selection.getRangeAt(0);
    if (!textRef.current || !textRef.current.contains(range.commonAncestorContainer)) {
      return;
    }

    const textContent = textRef.current.textContent || '';
    const selectedText = range.toString();
    
    if (selectedText.length === 0) return;

    const startContainer = range.startContainer;
    const endContainer = range.endContainer;
    
    let startPos = 0;
    let endPos = 0;
    
    if (startContainer === endContainer && startContainer.nodeType === Node.TEXT_NODE) {
      const textNode = startContainer as Text;
      const walker = document.createTreeWalker(
        textRef.current,
        NodeFilter.SHOW_TEXT,
        null
      );
      
      let node;
      let pos = 0;
      while ((node = walker.nextNode())) {
        if (node === textNode) {
          startPos = pos + range.startOffset;
          endPos = pos + range.endOffset;
          break;
        }
        pos += node.textContent?.length || 0;
      }
    } else {
      const selectionText = range.toString();
      const rangeBeforeStart = range.cloneRange();
      rangeBeforeStart.selectNodeContents(textRef.current);
      rangeBeforeStart.setEnd(range.startContainer, range.startOffset);
      startPos = rangeBeforeStart.toString().length;
      endPos = startPos + selectionText.length;
    }

    const startPosWithoutSpaces = positionWithoutSpaces(textContent, startPos);
    const endPosWithoutSpaces = positionWithoutSpaces(textContent, endPos);
    
    if (startPosWithoutSpaces < endPosWithoutSpaces) {
      setCurrentSelection({ start: startPosWithoutSpaces, end: endPosWithoutSpaces });
    }

    selection.removeAllRanges();
  };

  const handleMouseUp = () => {
    setTimeout(() => {
      handleTextSelection();
    }, 10);
  };

  const handleConfirmSelection = () => {
    if (!currentSelection || isProcessingRef.current) return;
    
    isProcessingRef.current = true;
    
    if (currentSelection) {
      setConfirmedBodies(prev => {
        // Allow overlapping ranges - only prevent exact duplicates
        const alreadyExists = prev.some(cb => 
          cb.range.start === currentSelection.start && cb.range.end === currentSelection.end
        );
        
        if (alreadyExists) {
          return prev;
        }
        
        // Add the selection even if it overlaps with existing ones
        return [...prev, { range: { ...currentSelection } }];
      });
    }
    
    setCurrentSelection(null);
    isProcessingRef.current = false;
  };

  const handleClearAll = () => {
    setConfirmedBodies([]);
    setCurrentSelection(null);
  };

  const handleReset = () => {
    // Reset state but keep the same question (don't change currentIndex)
    setConfirmedBodies([]);
    setCurrentSelection(null);
    setShowAnswers(false);
    setIsSubmitted(false);
  };

  const handleSubmit = () => {
    // All body ranges are correct answers (lambda bodies, entire lambdas, parenthesized content)
    const correctRanges = bodyRanges.map(br => ({ start: br.start, end: br.end }));
    const selectedRanges = confirmedBodies.map(cb => cb.range);
    
    const selectedRangeKeys = new Set(selectedRanges.map(r => `${r.start}-${r.end}`));
    const correctRangeKeys = new Set(correctRanges.map(r => `${r.start}-${r.end}`));
    
    const allCorrectSelected = correctRanges.every(range => 
      selectedRangeKeys.has(`${range.start}-${range.end}`)
    );
    
    const noIncorrectSelected = selectedRanges.every(range =>
      correctRangeKeys.has(`${range.start}-${range.end}`)
    );
    
    const isCorrect = allCorrectSelected && noIncorrectSelected && selectedRanges.length === correctRanges.length;

    // Save the response
    const response = {
      question: currentQuestion.question,
      questionStr: currentQuestion.questionStr,
      selectedBodies: selectedRanges,
      correctBodies: bodyRanges,
      isCorrect,
    };
    setResponses([...responses, response]);

    setIsSubmitted(true);

    if (isCorrect) {
      const newQuestion = new_question();
      const newCorrectBodies = findAllLambdas(newQuestion);
      questions.push({
        question: newQuestion,
        questionStr: String(newQuestion),
        correctBodies: newCorrectBodies,
      });
      setCurrentIndex(currentIndex + 1);
      setConfirmedBodies([]);
      setCurrentSelection(null);
      setShowAnswers(false);
      setIsSubmitted(false);
    }
  };

  const handleNext = () => {
    if (currentIndex + 1 < questions.length) {
      setCurrentIndex(currentIndex + 1);
      setConfirmedBodies([]);
      setCurrentSelection(null);
      setShowAnswers(false);
      setIsSubmitted(false);
    } else {
      const newQuestion = new_question();
      const newCorrectBodies = findAllLambdas(newQuestion);
      questions.push({
        question: newQuestion,
        questionStr: String(newQuestion),
        correctBodies: newCorrectBodies,
      });
      setCurrentIndex(currentIndex + 1);
      setConfirmedBodies([]);
      setCurrentSelection(null);
      setShowAnswers(false);
      setIsSubmitted(false);
    }
  };

  const handleShowAnswer = () => {
    setShowAnswers(true);
  };

  // Render the expression with highlights
  const renderExpressionWithHighlights = () => {
    const text = currentQuestion.questionStr;
    
    // Only show current selection in the main expression, not confirmed bodies
    const highlights: Array<{ type: 'current', start: number, end: number }> = [];
    
    if (currentSelection) {
      const startWithSpaces = positionWithSpaces(text, currentSelection.start);
      const endWithSpaces = positionWithSpaces(text, currentSelection.end);
      highlights.push({
        type: 'current',
        start: startWithSpaces,
        end: endWithSpaces
      });
    }
    
    // No longer showing brackets in main expression - answers are shown on separate lines
    
    const charHighlights: Array<Array<{ type: 'current' }>> = [];
    for (let i = 0; i < text.length; i++) {
      charHighlights[i] = highlights.filter(h => i >= h.start && i < h.end);
    }
    
    const elements: React.ReactNode[] = [];
    let currentGroup: { highlights: Array<{ type: 'current' }>, start: number, end: number } | null = null;
    
    // Simple comparison for current selection only
    const highlightsEqual = (a: Array<{ type: 'current' }>, b: Array<{ type: 'current' }>): boolean => {
      return a.length === b.length;
    };
    
    for (let i = 0; i <= text.length; i++) {
      const highlightsAtPos = i < text.length ? charHighlights[i] : [];
      const highlightsMatch = currentGroup && i < text.length && highlightsEqual(currentGroup.highlights, highlightsAtPos);
      
      if (highlightsMatch && currentGroup) {
        currentGroup.end = i + 1;
      } else {
        if (currentGroup) {
          const groupText = text.substring(currentGroup.start, currentGroup.end);
          
          if (currentGroup.highlights.length === 0) {
            // No highlights - just render the text
            elements.push(
              <span key={`text-${currentGroup.start}`}>
                {groupText}
              </span>
            );
          } else {
            // Only render current selection highlight in main expression
            let className = 'text-selection';
            const hasCurrent = currentGroup.highlights.some(h => h.type === 'current');
            
            if (hasCurrent) {
              className += ' current-selection';
            }
            
            let highlightStyle: React.CSSProperties | undefined = undefined;
            if (hasCurrent) {
              highlightStyle = {
                padding: '2px 0',
                outlineWidth: '2px',
                outlineStyle: 'solid',
                outlineColor: '#007bff',
                display: 'inline-block'
              };
            }
            
            elements.push(
              <span
                key={`highlight-${currentGroup.start}`}
                className={className}
                style={highlightStyle}
              >
                {groupText}
              </span>
            );
          }
        }
        
        if (i < text.length) {
          currentGroup = {
            highlights: highlightsAtPos,
            start: i,
            end: i + 1
          };
        } else {
          currentGroup = null;
        }
      }
    }
    
    if (elements.length === 0) {
      return text;
    }
    
    return elements;
  };

  const renderConfirmedBodies = () => {
    if (confirmedBodies.length === 0) return null;
    
    const text = currentQuestion.questionStr;
    
    // Don't deduplicate - allow overlapping ranges to be shown
    // Each confirmed body is displayed separately
    const deduplicated = confirmedBodies;
    
    return (
      <div>
        {deduplicated.map((confirmedBody, index) => {
          const { range } = confirmedBody;
          
          const rangeKey = `${range.start}-${range.end}`;
          const bodyRange = rangeToBodyRangeMap.get(rangeKey);
          
          let className = 'text-selection confirmed-redex';
          // Check if this range matches any correct body range
          const isCorrect = bodyRange !== undefined;
          
          if (showAnswers) {
            if (isCorrect) {
              className += ' correct-redex';
            } else {
              className += ' incorrect-selection';
            }
          }
          
          const startWithSpaces = positionWithSpaces(text, range.start);
          const endWithSpaces = positionWithSpaces(text, range.end);
          
          const beforeText = text.substring(0, startWithSpaces);
          const highlightedText = text.substring(startWithSpaces, endWithSpaces);
          const afterText = text.substring(endWithSpaces);
          
          return (
            <div
              key={`confirmed-body-${index}`}
              style={{ marginBottom: '8px' }}
            >
              <span>{beforeText}</span>
              <span
                className={className}
                style={{ cursor: 'default', display: 'inline' }}
              >
                {highlightedText}
              </span>
              <span>{afterText}</span>
            </div>
          );
        })}
      </div>
    );
  };

  const renderCorrectAnswers = () => {
    if (!showAnswers) return null;
    
    const text = currentQuestion.questionStr;
    const bodyColors = ['#28a745', '#007bff', '#ffc107', '#dc3545', '#6f42c1', '#20c997', '#fd7e14', '#e83e8c'];
    
    if (bodyRanges.length === 0) return null;
    
    return (
      <div>
        {bodyRanges.map((bodyRange, index) => {
          const startWithSpaces = positionWithSpaces(text, bodyRange.start);
          const endWithSpaces = positionWithSpaces(text, bodyRange.end);
          const color = bodyColors[index % bodyColors.length];
          
          const beforeText = text.substring(0, startWithSpaces);
          const highlightedText = text.substring(startWithSpaces, endWithSpaces);
          const afterText = text.substring(endWithSpaces);
          
          return (
            <div
              key={`correct-answer-${index}`}
              style={{ marginBottom: '8px' }}
            >
              <span>{beforeText}</span>
              <span
                className="text-selection confirmed-redex correct-redex"
                style={{ 
                  cursor: 'default', 
                  display: 'inline',
                  backgroundColor: `${color}33`, // Add transparency
                  border: `2px solid ${color}`
                }}
              >
                {highlightedText}
              </span>
              <span>{afterText}</span>
            </div>
          );
        })}
      </div>
    );
  };

  const isCorrect = useMemo(() => {
    if (!isSubmitted) return null;
    // All body ranges are correct answers
    const correctRanges = bodyRanges.map(br => ({ start: br.start, end: br.end }));
    const selectedRanges = confirmedBodies.map(cb => cb.range);
    
    const selectedRangeKeys = new Set(selectedRanges.map(r => `${r.start}-${r.end}`));
    const correctRangeKeys = new Set(correctRanges.map(r => `${r.start}-${r.end}`));
    
    const allCorrectSelected = correctRanges.every(range => 
      selectedRangeKeys.has(`${range.start}-${range.end}`)
    );
    
    const noIncorrectSelected = selectedRanges.every(range =>
      correctRangeKeys.has(`${range.start}-${range.end}`)
    );
    
    return allCorrectSelected && noIncorrectSelected && selectedRanges.length === correctRanges.length;
  }, [isSubmitted, confirmedBodies, bodyRanges]);

  // Render previous questions with colored brackets around bodies
  const renderPreviousQuestion = (response: typeof responses[0], index: number, showBrackets: boolean) => {
    const text = response.questionStr;
    const bodyColors = ['#28a745', '#007bff', '#ffc107', '#dc3545', '#6f42c1', '#20c997', '#fd7e14', '#e83e8c'];
    
    let renderedChars: React.ReactNode[] = [];
    
    if (showBrackets) {
      // Build bracket map for this question
      // Sort body ranges by start position (ascending), then by end position (descending)
      // This ensures outer ranges come before inner ranges, so colors match correctly
      const sortedBodies = [...response.correctBodies].sort((a, b) => {
        if (a.start !== b.start) {
          return a.start - b.start;
        }
        return b.end - a.end; // Descending by end for same start (outer before inner)
      });
      
      const bracketMap = new Map<number, Array<{ color: string, type: 'start' | 'end', bodyIndex: number }>>();
      
      sortedBodies.forEach((bodyRange, bodyIndex) => {
        const startWithSpaces = positionWithSpaces(text, bodyRange.start);
        const endWithSpaces = positionWithSpaces(text, bodyRange.end - 1);
        const color = bodyColors[bodyIndex % bodyColors.length];
        
        if (!bracketMap.has(startWithSpaces)) {
          bracketMap.set(startWithSpaces, []);
        }
        bracketMap.get(startWithSpaces)!.push({ color, type: 'start', bodyIndex });
        
        if (!bracketMap.has(endWithSpaces)) {
          bracketMap.set(endWithSpaces, []);
        }
        bracketMap.get(endWithSpaces)!.push({ color, type: 'end', bodyIndex });
      });
      
      // Render text with brackets
      // Use a stack to track opening brackets and ensure proper pairing
      const bracketStack: Array<{ color: string }> = [];
      
      for (let i = 0; i < text.length; i++) {
        const bracketInfos = bracketMap.get(i);
        const char = text[i];
        
        if (bracketInfos && bracketInfos.length > 0) {
          // Separate opening and closing brackets
          const openingBrackets = bracketInfos.filter(b => b.type === 'start');
          const closingBrackets = bracketInfos.filter(b => b.type === 'end');
          
          // Render all opening brackets first (in order) and push to stack
          for (let idx = 0; idx < openingBrackets.length; idx++) {
            const bracketInfo = openingBrackets[idx];
            bracketStack.push({ color: bracketInfo.color });
            renderedChars.push(
              <span key={`bracket-start-${i}-${idx}`} style={{ color: bracketInfo.color, fontWeight: 'bold', fontSize: '1.2em' }}>
                [
              </span>
            );
          }
          
          // Render the character
          renderedChars.push(char);
          
          // Render closing brackets in reverse order of bodyIndex to match opening brackets
          // When multiple brackets end at the same position, the last opened (highest bodyIndex) should close first (LIFO)
          // Sort closing brackets by bodyIndex descending, then reverse to get the correct order
          const closingBracketsSorted = [...closingBrackets].sort((a, b) => b.bodyIndex - a.bodyIndex);
          for (let idx = 0; idx < closingBracketsSorted.length; idx++) {
            const bracketInfo = closingBracketsSorted[idx];
            // Pop from the end of the stack (LIFO - last in, first out)
            // This ensures the most recently opened bracket matches the first closing bracket
            const matchingBracket = bracketStack.pop();
            const colorToUse = matchingBracket ? matchingBracket.color : bracketInfo.color;
            
            renderedChars.push(
              <span key={`bracket-end-${i}-${idx}`} style={{ color: colorToUse, fontWeight: 'bold', fontSize: '1.2em' }}>
                ]
              </span>
            );
          }
        } else {
          renderedChars.push(char);
        }
      }
    } else {
      // Just render the text without brackets
      renderedChars = text.split('').map((char, i) => char);
    }
    
    return (
      <div key={`previous-${index}`} className="response" style={{ marginBottom: '20px', padding: '15px', backgroundColor: '#f9f9f9', border: '1px solid #ddd', borderRadius: '8px' }}>
        <p style={{ marginBottom: '10px' }}><strong>Expression:</strong></p>
        <div style={{ 
          fontFamily: 'monospace', 
          fontSize: '18px', 
          lineHeight: '1.8',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
          marginBottom: '10px'
        }}>
          {renderedChars}
        </div>
        <p style={{ margin: 0 }}>
          {response.isCorrect ? (
            <span className="correct" style={{ fontSize: '16px', fontWeight: 'bold' }}>
              ✓ Correct! You identified all {response.correctBodies.length} bod{response.correctBodies.length !== 1 ? 'ies' : 'y'} of abstraction.
            </span>
          ) : (
            <span className="incorrect">
              ✗ Incorrect. You selected {response.selectedBodies.length} bod{response.selectedBodies.length !== 1 ? 'ies' : 'y'}, but there {response.correctBodies.length === 1 ? 'is' : 'are'} {response.correctBodies.length} correct {response.correctBodies.length === 1 ? 'body' : 'bodies'}.
            </span>
          )}
        </p>
      </div>
    );
  };

  return (
    <div className="container">
      <div style={{ marginBottom: '20px' }}>
        <button onClick={onBack} style={{ marginBottom: '10px' }}>← Back to Menu</button>
      </div>
      <h1>Identify Bodies of Abstraction</h1>
      
      <p style={{ marginBottom: '20px', color: '#000', whiteSpace: 'pre-line' }}>
        {instructions}
      </p>

      {/* Display previous questions */}
      {/* Only show brackets on questions that have been moved past (after "Next question" clicked) */}
      {responses.map((res, idx) => {
        // Show brackets only if this question has been moved past (idx < currentIndex)
        const showBrackets = idx < currentIndex;
        return renderPreviousQuestion(res, idx, showBrackets);
      })}

      <div className="question-block">
          <div 
            ref={textRef}
            style={{ 
              marginBottom: '20px', 
              padding: '20px', 
              backgroundColor: '#f9f9f9', 
              border: '2px solid #dcdcdc',
              borderRadius: '8px',
              fontSize: '18px',
              fontFamily: 'monospace',
              lineHeight: '1.8',
              userSelect: 'text',
              cursor: 'text',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word'
            }}
            onMouseUp={handleMouseUp}
          >
            {renderExpressionWithHighlights()}
          </div>
          
          {confirmedBodies.length > 0 && (
            <div style={{ 
              marginBottom: '20px', 
              padding: '20px', 
              backgroundColor: '#f0f0f0', 
              border: '2px solid #dcdcdc',
              borderRadius: '8px',
              fontSize: '18px',
              fontFamily: 'monospace',
              lineHeight: '1.8',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word'
            }}>
              <div style={{ marginBottom: '10px', fontSize: '14px', color: '#666', fontWeight: 'bold' }}>
                Confirmed Bodies:
              </div>
              {renderConfirmedBodies()}
            </div>
          )}
          
          {showAnswers && (
            <div style={{ 
              marginBottom: '20px', 
              padding: '20px', 
              backgroundColor: '#f0f7ff', 
              border: '2px solid #b3d9ff',
              borderRadius: '8px',
              fontSize: '18px',
              fontFamily: 'monospace',
              lineHeight: '1.8',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word'
            }}>
              <div style={{ marginBottom: '10px', fontSize: '14px', color: '#666', fontWeight: 'bold' }}>
                Correct Answers:
              </div>
              {renderCorrectAnswers()}
            </div>
          )}
          
          <div style={{ marginBottom: '10px' }}>
            <p>
              <strong>Confirmed bodies:</strong> {confirmedBodies.length}
              {bodyRanges.length > 0 && (
                <span> | <strong>Total bodies:</strong> {bodyRanges.length}</span>
              )}
              {currentSelection && (
                <span> | <strong>Current selection:</strong> {currentSelectionBodies.length} bod{currentSelectionBodies.length !== 1 ? 'ies' : 'y'} found</span>
              )}
            </p>
            {isSubmitted && isCorrect !== null && (
              <div style={{ marginTop: '15px', padding: '15px', borderRadius: '8px', backgroundColor: isCorrect ? '#d4edda' : '#f8d7da', border: `2px solid ${isCorrect ? '#28a745' : '#dc3545'}` }}>
                {isCorrect ? (
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#28a745', marginBottom: '8px' }}>
                      Correct!
                    </div>
                    <div className="correct" style={{ fontSize: '16px' }}>
                      You identified all {bodyRanges.length} bod{bodyRanges.length !== 1 ? 'ies' : 'y'} of abstraction.
                    </div>
                  </div>
                ) : (
                  <p className="incorrect" style={{ margin: 0 }}>
                    ✗ Incorrect. You selected {confirmedBodies.length} bod{confirmedBodies.length !== 1 ? 'ies' : 'y'}, but there {bodyRanges.length === 1 ? 'is' : 'are'} {bodyRanges.length} correct {bodyRanges.length === 1 ? 'body' : 'bodies'}.
                  </p>
                )}
              </div>
            )}
            <div style={{ display: 'flex', gap: '10px', marginTop: '10px', flexWrap: 'wrap' }}>
              {currentSelection && (
                <button 
                  onClick={handleConfirmSelection}
                  style={{ fontSize: '14px', padding: '6px 12px' }}
                >
                  Confirm Selection
                </button>
              )}
              {(confirmedBodies.length > 0 || currentSelection) && (
                <button 
                  onClick={handleClearAll}
                  style={{ fontSize: '14px', padding: '6px 12px' }}
                >
                  Reset Highlights
                </button>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <button onClick={handleSubmit} disabled={isSubmitted}>
              Submit
            </button>
            {isSubmitted && (
              <>
                {!showAnswers && (
                  <button onClick={handleShowAnswer}>
                    Show Correct Answer
                  </button>
                )}
                <button onClick={handleReset}>Try Again</button>
                <button onClick={handleNext}>Next Question</button>
              </>
            )}
          </div>
        </div>
    </div>
  );
};
