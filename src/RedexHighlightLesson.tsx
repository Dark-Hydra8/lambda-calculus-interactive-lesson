import React, { useState, useMemo, useRef, useEffect } from 'react';
import './styles.css';
import { LambdaObject, Application } from './lambda_ir';
import { random_lambda } from './random_lambda';
import { Parser } from './parser';
import { addSpacesAroundParens } from './displayParens';
import { getParenPairMap, renderSegmentWithColoredParens, renderStringWithColoredParens, PAREN_COLORS } from './coloredParens';
import { EASY, getDifficultyLevel, MEDIUM, type DifficultyLevel } from './api/lessonProgress';

type Question = {
  question: LambdaObject;
  questionStr: string;
  correctRedexes: Application[];
};

type SelectionRange = {
  start: number;
  end: number;
};

let questions: Question[] = [];

// Helper functions to convert between positions with and without spaces
function positionWithoutSpaces(text: string, posWithSpaces: number): number {
  // Count non-space characters up to posWithSpaces
  let count = 0;
  for (let i = 0; i < posWithSpaces && i < text.length; i++) {
    if (text[i] !== ' ') {
      count++;
    }
  }
  return count;
}

function positionWithSpaces(text: string, posWithoutSpaces: number): number {
  // Find the position in text (with spaces) that corresponds to posWithoutSpaces non-space characters
  // posWithoutSpaces is 0-indexed (0 = first non-space char, 1 = second non-space char, etc.)
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
  return pos; // Return end of string if not found
}

export function new_question(level: DifficultyLevel): LambdaObject {
  const depth = level === EASY ? 3 : 4;
  let lambda: LambdaObject;
  let target = level === EASY ? 1 : 2;
  let length = level === EASY ? 20 : level == MEDIUM ? 30 : 40;
  do {
    lambda = random_lambda(["w", "x", "y", "z"], depth);
  } while (
    !(
      lambda.redexes().length === target
      || lambda.redexes().length === target + 1
    )
    || String(lambda).length >= length
  );
  return lambda;
}

type ConfirmedRedex = {
  range: SelectionRange;
};

export const RedexHighlightLesson: React.FC<{
  userId: string;
  authToken: string;
  onBack: () => void;
  onSubmit?: () => void;
  onAnsweredCorrect?: () => void;
  onCorrectWithoutShowAnswer?: () => void;
}> = ({ userId, authToken, onBack, onSubmit, onAnsweredCorrect, onCorrectWithoutShowAnswer }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [currentSelection, setCurrentSelection] = useState<SelectionRange | null>(null);
  const [confirmedRedexes, setConfirmedRedexes] = useState<ConfirmedRedex[]>([]);
  const [showResult, setShowResult] = useState(false);
  const [showAnswers, setShowAnswers] = useState(false);
  const [hadShownAnswerForCurrentQuestion, setHadShownAnswerForCurrentQuestion] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [responses, setResponses] = useState<Array<{
    question: LambdaObject;
    questionStr: string;
    selectedRedexes: SelectionRange[];
    correctRedexes: Application[];
    isCorrect: boolean;
  }>>([]);
  const textRef = useRef<HTMLDivElement>(null);
  const isProcessingRef = useRef(false);

  useEffect(() => {
    if (isSubmitted) {
      window.getSelection()?.removeAllRanges();
    }
  }, [isSubmitted]);

  // Initialize questions
  if (questions.length === 0) {
    const question = new_question(getDifficultyLevel(userId, authToken, 'redex-highlight'));
    const correctRedexes = question.redexes();
    questions.push({
      question,
      questionStr: String(question),
      correctRedexes,
    });
  }

  const currentQuestion = questions[currentIndex];

  // Map each redex Application to its span in the no-space question string (object identity)
  const redexToRangeMap = useMemo(() => {
    const map = new Map<Application, SelectionRange>();
    const pairs = currentQuestion.question.object_ranges();
    for (const redex of currentQuestion.correctRedexes) {
      const found = pairs.find(([, obj]) => obj === redex);
      if (found) {
        map.set(redex, { start: found[0].start, end: found[0].end });
      }
    }
    return map;
  }, [currentIndex]);

  // Build reverse mapping from range to redex Application for display
  const rangeToRedexMap = useMemo(() => {
    const map = new Map<string, Application>();
    redexToRangeMap.forEach((range, redex) => {
      const rangeKey = `${range.start}-${range.end}`;
      map.set(rangeKey, redex);
    });
    return map;
  }, [redexToRangeMap]);

  const correctRedexesSet = useMemo(() => {
    return new Set(currentQuestion.correctRedexes);
  }, [currentIndex]);

  const { displayStr, originalToDisplay, displayToOriginal } = useMemo(
    () => addSpacesAroundParens(currentQuestion.questionStr),
    [currentQuestion.questionStr]
  );

  const parenPairMap = useMemo(() => getParenPairMap(displayStr), [displayStr]);

  const isCorrect = useMemo(() => {
    if (!isSubmitted) return null;
    const correctRanges = Array.from(redexToRangeMap.values());
    const selectedRanges = confirmedRedexes.map(cr => cr.range);
    const selectedRangeKeys = new Set(selectedRanges.map(r => `${r.start}-${r.end}`));
    const correctRangeKeys = new Set(correctRanges.map(r => `${r.start}-${r.end}`));
    const allCorrectSelected = correctRanges.every(range =>
      selectedRangeKeys.has(`${range.start}-${range.end}`)
    );
    const noIncorrectSelected = selectedRanges.every(range =>
      correctRangeKeys.has(`${range.start}-${range.end}`)
    );
    return allCorrectSelected && noIncorrectSelected && selectedRanges.length === correctRanges.length;
  }, [isSubmitted, confirmedRedexes, redexToRangeMap]);

  const handleTextSelection = () => {
    if (isSubmitted) return;
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;
    
    const range = selection.getRangeAt(0);
    if (!textRef.current || !textRef.current.contains(range.commonAncestorContainer)) {
      return;
    }

    // Get the text content and find the selection positions
    const textContent = textRef.current.textContent || '';
    const selectedText = range.toString();
    
    if (selectedText.length === 0) return;

    // Find the start and end positions in the text
    const startContainer = range.startContainer;
    const endContainer = range.endContainer;
    
    // Calculate positions by walking through the DOM
    let startPos = 0;
    let endPos = 0;
    
    if (startContainer === endContainer && startContainer.nodeType === Node.TEXT_NODE) {
      // Simple case: selection is within a single text node
      const textNode = startContainer as Text;
      const walker = document.createTreeWalker(
        textRef.current,
        NodeFilter.SHOW_TEXT,
        null
      );
      
      let node;
      let pos = 0;
      while (node = walker.nextNode()) {
        if (node === textNode) {
          startPos = pos + range.startOffset;
          endPos = pos + range.endOffset;
          break;
        }
        pos += node.textContent?.length || 0;
      }
    } else {
      // More complex: selection spans multiple nodes
      // Use a simpler approach: find the text in the full content
      const fullText = textRef.current.textContent || '';
      const selectionText = range.toString();
      const rangeBeforeStart = range.cloneRange();
      rangeBeforeStart.selectNodeContents(textRef.current);
      rangeBeforeStart.setEnd(range.startContainer, range.startOffset);
      startPos = rangeBeforeStart.toString().length;
      endPos = startPos + selectionText.length;
    }

    // textContent is displayStr; map display positions back to original string
    const startOrig = displayToOriginal[Math.min(startPos, displayToOriginal.length - 1)] ?? 0;
    const endOrig = displayToOriginal[Math.min(endPos, displayToOriginal.length - 1)] ?? currentQuestion.questionStr.length;
    const startPosWithoutSpaces = positionWithoutSpaces(currentQuestion.questionStr, startOrig);
    const endPosWithoutSpaces = positionWithoutSpaces(currentQuestion.questionStr, endOrig);

    if (startPosWithoutSpaces < endPosWithoutSpaces) {
      setCurrentSelection({ start: startPosWithoutSpaces, end: endPosWithoutSpaces });
    }

    selection.removeAllRanges();
  };

  const handleMouseUp = () => {
    // Small delay to ensure selection is complete
    setTimeout(() => {
      handleTextSelection();
    }, 10);
  };

  const handleConfirmSelection = () => {
    if (isSubmitted || !currentSelection || isProcessingRef.current) return;
    
    isProcessingRef.current = true;
    
    // Find which correct redex range matches the current selection
    // Check if the selection range matches any correct redex range

    // console.log('currentSelection', currentSelection);
    
    if (currentSelection) {
      // Selection matches a correct redex range - add it
      setConfirmedRedexes(prev => {
        const rangeKey = `${currentSelection.start}-${currentSelection.end}`;
        // Check if this range is already confirmed
        const alreadyExists = prev.some(cr => 
          cr.range.start === currentSelection.start && cr.range.end === currentSelection.end
        );
        
        if (alreadyExists) {
          // console.log(`Skipping duplicate: redex range at ${matchingRange.start}-${matchingRange.end}`);
          return prev;
        }
        
        return [...prev, { range: { ...currentSelection } }];
      });
    }
    
    // Clear current selection
    setCurrentSelection(null);
    isProcessingRef.current = false;
  };


  const handleClearCurrentSelection = () => {
    if (isSubmitted) return;
    setCurrentSelection(null);
  };

  const handleRemoveConfirmed = (rangeKey: string) => {
    if (isSubmitted) return;
    setConfirmedRedexes(prev =>
      prev.filter(cr => `${cr.range.start}-${cr.range.end}` !== rangeKey)
    );
  };

  const handleClearAll = () => {
    if (isSubmitted) return;
    setConfirmedRedexes([]);
    setCurrentSelection(null);
  };

  const handleSubmit = () => {
    onSubmit?.();
    // Get all correct redex ranges
    const correctRanges = Array.from(redexToRangeMap.values());
    const selectedRanges = confirmedRedexes.map(cr => cr.range);
    
    // Create sets for comparison using range keys
    const selectedRangeKeys = new Set(selectedRanges.map(r => `${r.start}-${r.end}`));
    const correctRangeKeys = new Set(correctRanges.map(r => `${r.start}-${r.end}`));
    
    // Check if all correct redex ranges are selected
    const allCorrectSelected = correctRanges.every(range => 
      selectedRangeKeys.has(`${range.start}-${range.end}`)
    );
    
    // Check if no incorrect ranges are selected (all selected ranges are correct)
    const noIncorrectSelected = selectedRanges.every(range =>
      correctRangeKeys.has(`${range.start}-${range.end}`)
    );
    
    const isCorrect = allCorrectSelected && noIncorrectSelected && selectedRanges.length === correctRanges.length;

    if (isCorrect) onAnsweredCorrect?.();
    if (isCorrect && !hadShownAnswerForCurrentQuestion) onCorrectWithoutShowAnswer?.();
    setCurrentSelection(null);
    setIsSubmitted(true);
  };

  const handleNext = () => {
    setHadShownAnswerForCurrentQuestion(false);
    if (isSubmitted) {
      const correctRanges = Array.from(redexToRangeMap.values());
      const selectedRanges = confirmedRedexes.map(cr => cr.range);
      const selectedRangeKeys = new Set(selectedRanges.map(r => `${r.start}-${r.end}`));
      const correctRangeKeys = new Set(correctRanges.map(r => `${r.start}-${r.end}`));
      const allCorrectSelected = correctRanges.every(range =>
        selectedRangeKeys.has(`${range.start}-${range.end}`)
      );
      const noIncorrectSelected = selectedRanges.every(range =>
        correctRangeKeys.has(`${range.start}-${range.end}`)
      );
      const isCorrect = allCorrectSelected && noIncorrectSelected && selectedRanges.length === correctRanges.length;
      setResponses(prev => [
        ...prev,
        {
          question: currentQuestion.question,
          questionStr: currentQuestion.questionStr,
          selectedRedexes: selectedRanges,
          correctRedexes: currentQuestion.correctRedexes,
          isCorrect,
        },
      ]);
    }
    if (currentIndex + 1 < questions.length) {
      setCurrentIndex(currentIndex + 1);
      setConfirmedRedexes([]);
      setCurrentSelection(null);
      setShowAnswers(false);
      setIsSubmitted(false);
    } else {
      // Generate new question
      const newQuestion = new_question(getDifficultyLevel(userId, authToken, 'redex-highlight'));
      const newCorrectRedexes = newQuestion.redexes();
      questions.push({
        question: newQuestion,
        questionStr: String(newQuestion),
        correctRedexes: newCorrectRedexes,
      });
      setCurrentIndex(currentIndex + 1);
      setConfirmedRedexes([]);
      setCurrentSelection(null);
      setShowAnswers(false);
      setIsSubmitted(false);
    }
  };

  const handleReset = () => {
    setShowAnswers(false);
    setIsSubmitted(false);
  };

  const handleShowAnswer = () => {
    setShowAnswers(true);
    setHadShownAnswerForCurrentQuestion(true);
  };

  // Render the expression with highlights (excluding confirmed redexes, handles overlaps)
  const renderExpressionWithHighlights = () => {
    const text = displayStr;
    const origStr = currentQuestion.questionStr;

    const highlights: Array<{ type: 'current' | 'missed'; start: number; end: number; redex?: Application }> = [];

    if (currentSelection) {
      const startWithSpaces = positionWithSpaces(origStr, currentSelection.start);
      const endWithSpaces = positionWithSpaces(origStr, currentSelection.end);
      highlights.push({
        type: 'current',
        start: originalToDisplay[startWithSpaces] ?? 0,
        end: originalToDisplay[endWithSpaces] ?? text.length,
      });
    }

    const bracketMap = new Map<number, Array<{ color: string; type: 'start' | 'end' }>>();
    const redexColors = ['#28a745', '#007bff', '#ffc107', '#dc3545', '#6f42c1', '#20c997', '#fd7e14', '#e83e8c'];

    if (showAnswers) {
      currentQuestion.correctRedexes.forEach((redex, index) => {
        const range = redexToRangeMap.get(redex);
        if (range) {
          // range.start / range.end are measured in non-space characters on the
          // original question string. Map them directly into the display string,
          // which may have extra spaces around parentheses, by counting
          // non-space characters in displayStr itself.
          const startDisp = positionWithSpaces(text, range.start);
          const endDisp = positionWithSpaces(text, range.end - 1);
          const color = redexColors[index % redexColors.length];
          if (!bracketMap.has(startDisp)) bracketMap.set(startDisp, []);
          bracketMap.get(startDisp)!.push({ color, type: 'start' });
          if (!bracketMap.has(endDisp)) bracketMap.set(endDisp, []);
          bracketMap.get(endDisp)!.push({ color, type: 'end' });
        }
      });
    }
    
    // Create an array to track which highlights cover each character position (with spaces)
    const charHighlights: Array<Array<{ type: 'current' | 'missed', redex?: Application }>> = [];
    for (let i = 0; i < text.length; i++) {
      charHighlights[i] = highlights.filter(h => i >= h.start && i < h.end);
    }
    
    // Build elements by grouping consecutive characters with the same highlight set
    const elements: React.ReactNode[] = [];
    let currentGroup: { highlights: Array<{ type: 'current' | 'missed', redex?: Application }>, start: number, end: number } | null = null;
    
    // Helper to compare highlight sets
    // For correct answer highlights, allow overlaps - compare by redex identity
    const highlightsEqual = (a: Array<{ type: 'current' | 'missed', redex?: Application }>, b: Array<{ type: 'current' | 'missed', redex?: Application }>): boolean => {
      if (a.length !== b.length) return false;
      // For missed redexes (correct answers), compare by redex identity to allow overlaps
      // For current selections, compare by type
      const aRedexes = new Set(a.filter(h => h.type === 'missed' && h.redex).map(h => h.redex));
      const bRedexes = new Set(b.filter(h => h.type === 'missed' && h.redex).map(h => h.redex));
      const aCurrent = a.some(h => h.type === 'current');
      const bCurrent = b.some(h => h.type === 'current');
      
      // Check if redex sets match (allowing overlaps)
      const redexesMatch = aRedexes.size === bRedexes.size && 
        Array.from(aRedexes).every(redex => bRedexes.has(redex));
      const currentMatch = aCurrent === bCurrent;
      
      return redexesMatch && currentMatch;
    };
    
    for (let i = 0; i <= text.length; i++) {
      const highlightsAtPos = i < text.length ? charHighlights[i] : [];
      
      // Check if this position has the same highlights as the current group
      const highlightsMatch = currentGroup && i < text.length && highlightsEqual(currentGroup.highlights, highlightsAtPos);
      
      if (highlightsMatch && currentGroup) {
        // Extend current group (only if we're still within text bounds)
        currentGroup.end = i + 1;
      } else {
        // Finish current group and start new one
        if (currentGroup) {
          const groupText = text.substring(currentGroup.start, currentGroup.end);
          
          // Helper function to render text with colored brackets
          const renderTextWithBrackets = (startIdx: number, endIdx: number) => {
            const renderedChars: React.ReactNode[] = [];
            for (let j = startIdx; j < endIdx; j++) {
              const bracketInfos = bracketMap.get(j);
              const char = text[j];
              
              if (bracketInfos && bracketInfos.length > 0) {
                // Render all opening brackets first (bracket color independent of parens)
                bracketInfos.forEach((bracketInfo, idx) => {
                  if (bracketInfo.type === 'start') {
                    renderedChars.push(
                      <span key={`bracket-start-${j}-${idx}`} style={{ color: bracketInfo.color, fontWeight: 'bold', fontSize: '1.2em' }}>
                        [
                      </span>
                    );
                  }
                });
                // Render the character; still color ( ) by paren map so matching pairs match
                if (char === '(' || char === ')') {
                  const parenColor = (parenPairMap.get(j) ?? -1) >= 0 ? PAREN_COLORS[parenPairMap.get(j)! % PAREN_COLORS.length] : undefined;
                  renderedChars.push(
                    parenColor ? (
                      <span key={`paren-${j}`} style={{ color: parenColor, fontWeight: 'bold' }}>{char}</span>
                    ) : (
                      <React.Fragment key={`char-${j}`}>{char}</React.Fragment>
                    )
                  );
                } else {
                  renderedChars.push(<React.Fragment key={`char-${j}`}>{char}</React.Fragment>);
                }
                // Render all closing brackets after
                bracketInfos.forEach((bracketInfo, idx) => {
                  if (bracketInfo.type === 'end') {
                    renderedChars.push(
                      <span key={`bracket-end-${j}-${idx}`} style={{ color: bracketInfo.color, fontWeight: 'bold', fontSize: '1.2em' }}>
                        ]
                      </span>
                    );
                  }
                });
              } else {
                const parenColor = (parenPairMap.get(j) ?? -1) >= 0 ? PAREN_COLORS[parenPairMap.get(j)! % PAREN_COLORS.length] : undefined;
                renderedChars.push(
                  parenColor ? (
                    <span key={`paren-${j}`} style={{ color: parenColor, fontWeight: 'bold' }}>{char}</span>
                  ) : (
                    char
                  )
                );
              }
            }
            return renderedChars;
          };

          if (currentGroup.highlights.length === 0) {
            // No highlights - render with colored brackets if needed
            const renderedChars = renderTextWithBrackets(currentGroup.start, currentGroup.end);
            elements.push(
              <span key={`text-${currentGroup.start}`}>
                {renderedChars}
              </span>
            );
          } else {
            // Has highlights - determine styling
            let className = 'text-selection';
            const hasCurrent = currentGroup.highlights.some(h => h.type === 'current');
            
            if (hasCurrent) {
              className += ' current-selection';
            }
            // When showing answers, use colored brackets instead of highlights
            
            // Apply styling for current selection only
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
            
            // Render text with brackets if showing answers
            const coloredGroupText = renderSegmentWithColoredParens(groupText, currentGroup.start, {
              pairMap: parenPairMap,
              colors: PAREN_COLORS,
              keyPrefix: `rg-${currentGroup.start}`,
            });
            const renderedText = showAnswers
              ? renderTextWithBrackets(currentGroup.start, currentGroup.end)
              : coloredGroupText;
            
            elements.push(
              <span
                key={`highlight-${currentGroup.start}`}
                className={className}
                style={highlightStyle}
              >
                {renderedText}
              </span>
            );
          }
        }
        
        // Start new group (only if we haven't reached the end)
        if (i < text.length) {
          currentGroup = {
            highlights: highlightsAtPos,
            start: i,
            end: i + 1
          };
        } else {
          // At the end - make sure currentGroup is null so we don't try to process it again
          currentGroup = null;
        }
      }
    }
    
    // Ensure we return elements if we created any, otherwise return the full text
    if (elements.length === 0) {
      return text;
    }
    
    return elements;
  };

  // Render confirmed redexes - each on a separate line showing the full string with highlighted portion
  const renderConfirmedRedexes = () => {
    if (confirmedRedexes.length === 0) return null;

    const text = displayStr;
    const origStr = currentQuestion.questionStr;
    
    // Remove duplicates - each range should only appear once
    const rangeMap = new Map<string, ConfirmedRedex>();
    
    confirmedRedexes.forEach(cr => {
      const rangeKey = `${cr.range.start}-${cr.range.end}`;
      if (!rangeMap.has(rangeKey)) {
        rangeMap.set(rangeKey, cr);
      }
    });
    
    const deduplicated = Array.from(rangeMap.values());
    
    // Render each redex on its own line, showing the full string with the highlighted portion marked
    return (
      <div>
        {deduplicated.map((confirmedRedex, index) => {
          const { range } = confirmedRedex;
          
          // Look up the redex from the range for display purposes
          const rangeKey = `${range.start}-${range.end}`;
          const redex = rangeToRedexMap.get(rangeKey);
          
          // Determine styling - check if this range is a correct redex range
          let className = 'text-selection confirmed-redex';
          const isCorrect = redex !== undefined && correctRedexesSet.has(redex);
          
          if (showAnswers) {
            // When showing answers, distinguish correct from incorrect
            if (isCorrect) {
              className += ' correct-redex';
            } else {
              className += ' incorrect-selection';
            }
          }
          
          const startWithSpaces = positionWithSpaces(origStr, range.start);
          const endWithSpaces = positionWithSpaces(origStr, range.end);
          const startDisp = originalToDisplay[startWithSpaces] ?? 0;
          const endDisp = originalToDisplay[endWithSpaces] ?? text.length;
          const beforeText = text.substring(0, startDisp);
          const highlightedText = text.substring(startDisp, endDisp);
          const afterText = text.substring(endDisp);
          const beforeNodes = renderSegmentWithColoredParens(beforeText, 0, {
            pairMap: parenPairMap,
            colors: PAREN_COLORS,
            keyPrefix: `redex-conf-${index}-b`,
          });
          const highlightNodes = renderSegmentWithColoredParens(highlightedText, startDisp, {
            pairMap: parenPairMap,
            colors: PAREN_COLORS,
            keyPrefix: `redex-conf-${index}-h`,
          });
          const afterNodes = renderSegmentWithColoredParens(afterText, endDisp, {
            pairMap: parenPairMap,
            colors: PAREN_COLORS,
            keyPrefix: `redex-conf-${index}-a`,
          });
          return (
            <div
              key={`confirmed-redex-${index}`}
              style={{ marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}
            >
              <span style={{ flex: '1 1 auto', minWidth: 0 }}>
                <span>{beforeNodes}</span>
                <span
                  className={className}
                  style={{ cursor: 'default', display: 'inline' }}
                >
                  {highlightNodes}
                </span>
                <span>{afterNodes}</span>
              </span>
              {!isSubmitted && (
                <button
                  type="button"
                  onClick={() => handleRemoveConfirmed(rangeKey)}
                  style={{ fontSize: '12px', padding: '4px 8px', flexShrink: 0 }}
                >
                  Remove
                </button>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="container">
      <div style={{ marginBottom: '20px' }}>
        <button onClick={onBack} style={{ marginBottom: '10px' }}>← Back to Menu</button>
      </div>
      <h1>Identify the Redexes</h1>
      <div style={{ marginBottom: '20px', color: '#333', fontFamily: 'inherit', fontSize: '16px' }}>
        <ul style={{ margin: '0 0 0 20px', padding: 0 }}>
          <li>
            A <strong>β-redex</strong> is an application whose left side is a lambda abstraction:
            <strong> (λx.t) t'</strong>.
          </li>
          <li>
            When you simplify <strong>(λx.t) t'</strong>, you replace <code>x</code> inside the expression <code>t</code> with <code>t'</code>.
            (Only the <code>x</code> that are bond to that λ are replaced.)
          </li>
          <li>
            Redexes can be nested. For example, in <code>(λx. x) ((λy. y) z)</code> there are two redexes:
            <code>(λy. y) z</code> (inside) and <code>(λx. x) ((λy. y) z)</code> (outside).
          </li>
          <li>
            In each question, highlight text that covers a redex exactly, then click <strong>Confirm Selection</strong>.
          </li>
          <li>
            When you have confirmed <strong>every</strong> redex in the expression, press <strong>Submit</strong>.
          </li>
        </ul>
      </div>
      <p style={{ marginBottom: '16px', fontSize: '13px', color: '#666' }}>
        <em>
          Note: Information about your answers is collected.
        </em>
      </p>

      {responses.map((res, idx) => (
        <div key={idx} className="response">
          <p><strong>Expression:</strong> {renderStringWithColoredParens(addSpacesAroundParens(res.questionStr).displayStr, { keyPrefix: `res-${idx}` })}</p>
          <p>
            {res.isCorrect ? (
              <span className="correct">
                Correct! You found all {res.correctRedexes.length} redex{res.correctRedexes.length !== 1 ? 'es' : ''}.
              </span>
            ) : (
              <span className="incorrect">
                Incorrect. You selected {res.selectedRedexes.length} redex{res.selectedRedexes.length !== 1 ? 'es' : ''}.
              </span>
            )}
          </p>
        </div>
      ))}

      {!showResult ? (
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
              userSelect: isSubmitted ? 'none' : 'text',
              cursor: isSubmitted ? 'default' : 'text',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word'
            }}
            onMouseUp={isSubmitted ? undefined : handleMouseUp}
          >
            {renderExpressionWithHighlights()}
          </div>
          
          {confirmedRedexes.length > 0 && (
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
                Confirmed Redexes:
              </div>
              {renderConfirmedRedexes()}
            </div>
          )}
          
          <div style={{ marginBottom: '10px' }}>
            <p>
              <strong>Confirmed redexes:</strong> {confirmedRedexes.length}
            </p>
            {isSubmitted && isCorrect !== null && (
              <p style={{ marginBottom: '12px' }}>
                {isCorrect ? (
                  <span className="correct">✓ Correct. All redexes found.</span>
                ) : (
                  <span className="incorrect">✗ Some redexes are incorrect. Try again or show answer.</span>
                )}
              </p>
            )}
            <div style={{ display: 'flex', gap: '10px', marginTop: '10px', flexWrap: 'wrap' }}>
              <button
                onClick={handleConfirmSelection}
                disabled={isSubmitted || !currentSelection}
                style={{ fontSize: '14px', padding: '6px 12px' }}
              >
                Confirm Selection
              </button>
              <button
                onClick={handleClearCurrentSelection}
                disabled={isSubmitted || !currentSelection}
                style={{ fontSize: '14px', padding: '6px 12px' }}
              >
                Reset Current Highlight
              </button>
              {(confirmedRedexes.length > 0 || currentSelection) && !isSubmitted && (
                <button
                  onClick={handleClearAll}
                  style={{ fontSize: '14px', padding: '6px 12px' }}
                >
                  Clear All Highlights
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
                {!isCorrect && !showAnswers && (
                  <button onClick={handleShowAnswer}>
                    Show Correct Answer
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
