import React, { useState, useMemo, useRef, useEffect } from 'react';
import './styles.css';
import { LambdaObject, Variable, Application, Lambda } from './lambda_ir';
import { random_lambda } from './random_lambda';
import { Parser } from './parser';

type Question = {
  question: LambdaObject;
  questionStr: string;
  correctRedexes: Application[];
};

type SelectionRange = {
  start: number;
  end: number;
};

type ApplicationRange = {
  application: Application;
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

function new_question(): LambdaObject {
  let lambda: LambdaObject;
  let target;
  do {
    lambda = random_lambda(["w", "x", "y", "z"], 3);
    target = Math.floor(2 * Math.random()) + 1;
  } while (lambda.redexes().length <= target);
  return lambda;
}

// Build a mapping of character positions to Application objects
// Traverses the tree and tracks character positions WITHOUT counting spaces
function buildApplicationRanges(
  obj: LambdaObject,
  startPos: number,
  applicationRanges: ApplicationRange[],
  fullString: string
): number {
  if (obj instanceof Variable) {
    return startPos + obj.get_symbol().length;
  } else if (obj instanceof Lambda) {
    let pos = startPos;
    pos += 1; // λ
    pos += obj.get_parameter().get_symbol().length;
    pos += 1; // .
    pos = buildApplicationRanges(obj.get_body(), pos, applicationRanges, fullString);
    return pos;
  } else if (obj instanceof Application) {
    const appStart = startPos;
    
    const leftNeedsParens = obj.get_left() instanceof Lambda;
    const rightNeedsParens = obj.get_right() instanceof Application || 
                            (obj.get_right() instanceof Lambda && 
                             obj.get_parent() instanceof Application && 
                             (obj.get_parent() as Application).get_left() === obj);
    
    let pos = startPos;
    if (leftNeedsParens) pos += 1; // (
    pos = buildApplicationRanges(obj.get_left(), pos, applicationRanges, fullString);
    if (leftNeedsParens) pos += 1; // )
    // Skip space - don't increment pos
    if (rightNeedsParens) pos += 1; // (
    pos = buildApplicationRanges(obj.get_right(), pos, applicationRanges, fullString);
    if (rightNeedsParens) pos += 1; // )
    
    // Record the range for this application (positions without spaces)
    applicationRanges.push({
      application: obj,
      start: appStart,
      end: pos,
    });
    
    return pos;
  }
  return startPos;
}

// Find all Applications that overlap with the selection range
function findApplicationsInRange(
  selection: SelectionRange,
  applicationRanges: ApplicationRange[]
): Application[] {
  const result: Application[] = [];
  for (const range of applicationRanges) {
    // Check if selection overlaps with application range
    // Selection overlaps if: selection.start < range.end && selection.end > range.start
    if (selection.start < range.end && selection.end > range.start) {
      result.push(range.application);
    }
  }
  return result;
}

type ConfirmedRedex = {
  range: SelectionRange;
};

export const RedexHighlightLesson: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [currentSelection, setCurrentSelection] = useState<SelectionRange | null>(null);
  const [confirmedRedexes, setConfirmedRedexes] = useState<ConfirmedRedex[]>([]);
  const [showResult, setShowResult] = useState(false);
  const [showAnswers, setShowAnswers] = useState(false);
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
  
  // Build application ranges for the current question (positions without spaces)
  const applicationRanges = useMemo(() => {
    const ranges: ApplicationRange[] = [];
    const fullString = currentQuestion.questionStr;
    buildApplicationRanges(currentQuestion.question, 0, ranges, fullString);
    // Sort by start position for easier processing
    ranges.sort((a, b) => a.start - b.start);
    return ranges;
  }, [currentIndex]);

  // Build mapping from redex Application to its range using redex_ranges()
  const redexToRangeMap = useMemo(() => {
    const map = new Map<Application, SelectionRange>();
    const allRedexRanges = currentQuestion.question.redex_ranges();
    const allRedexes = currentQuestion.correctRedexes;
    const questionStrNoSpaces = currentQuestion.questionStr.replace(/\s/g, '');
    
    // Match each redex to its range by checking which range's substring matches the redex string
    // For nested redexes, we want the outermost range that exactly matches the redex
    for (const redex of allRedexes) {
      const redexStrNoSpaces = String(redex).replace(/\s/g, '');
      // Find the range that exactly matches this redex's string representation
      // Sort ranges by size (largest first) to prefer outermost ranges
      const sortedRanges = [...allRedexRanges].sort((a, b) => (b.end - b.start) - (a.end - a.start));
      for (const range of sortedRanges) {
        const rangeStr = questionStrNoSpaces.substring(range.start, range.end);
        if (rangeStr === redexStrNoSpaces) {
          map.set(redex, { start: range.start, end: range.end });
          break; // Found the matching range for this redex
        }
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

  // Get applications covered by current selection
  const currentSelectionApps = useMemo(() => {
    if (!currentSelection) return [];
    return findApplicationsInRange(currentSelection, applicationRanges);
  }, [currentSelection, applicationRanges]);

  const correctRedexesSet = useMemo(() => {
    return new Set(currentQuestion.correctRedexes);
  }, [currentIndex]);

  const handleTextSelection = () => {
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

    // Convert positions to exclude spaces
    const startPosWithoutSpaces = positionWithoutSpaces(textContent, startPos);
    const endPosWithoutSpaces = positionWithoutSpaces(textContent, endPos);
    
    // Set the current selection if it's valid (using positions without spaces)
    if (startPosWithoutSpaces < endPosWithoutSpaces) {
      setCurrentSelection({ start: startPosWithoutSpaces, end: endPosWithoutSpaces });
    }

    // Clear the browser selection
    selection.removeAllRanges();
  };

  const handleMouseUp = () => {
    // Small delay to ensure selection is complete
    setTimeout(() => {
      handleTextSelection();
    }, 10);
  };

  const handleConfirmSelection = () => {
    if (!currentSelection || isProcessingRef.current) return;
    
    isProcessingRef.current = true;
    
    // Find which correct redex range matches the current selection
    // Check if the selection range matches any correct redex range

    console.log('currentSelection', currentSelection);
    
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


  const handleClearAll = () => {
    setConfirmedRedexes([]);
    setCurrentSelection(null);
  };

  const handleSubmit = () => {
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

    const response = {
      question: currentQuestion.question,
      questionStr: currentQuestion.questionStr,
      selectedRedexes: selectedRanges,
      correctRedexes: currentQuestion.correctRedexes,
      isCorrect,
    };

    setResponses([...responses, response]);
    setIsSubmitted(true);

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
      setConfirmedRedexes([]);
      setCurrentSelection(null);
      setShowAnswers(false);
      setIsSubmitted(false);
    }
    // Don't automatically show answers - user must click button
  };

  const handleNext = () => {
    if (currentIndex + 1 < questions.length) {
      setCurrentIndex(currentIndex + 1);
      setConfirmedRedexes([]);
      setCurrentSelection(null);
      setShowAnswers(false);
      setIsSubmitted(false);
    } else {
      // Generate new question
      const newQuestion = new_question();
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
    setConfirmedRedexes([]);
    setCurrentSelection(null);
    setShowAnswers(false);
    setIsSubmitted(false);
  };

  const handleShowAnswer = () => {
    setShowAnswers(true);
  };

  // Render the expression with highlights (excluding confirmed redexes, handles overlaps)
  const renderExpressionWithHighlights = () => {
    const text = currentQuestion.questionStr;
    
    // Build arrays of highlight ranges
    const highlights: Array<{ type: 'current' | 'missed', start: number, end: number, redex?: Application }> = [];
    
    // Add current selection (if any) - convert positions to include spaces
    if (currentSelection) {
      const startWithSpaces = positionWithSpaces(text, currentSelection.start);
      const endWithSpaces = positionWithSpaces(text, currentSelection.end);
      highlights.push({
        type: 'current',
        start: startWithSpaces,
        end: endWithSpaces
      });
    }
    
    // Create bracket color map for showing correct redexes with colored brackets
    // Maps position to array of { color, type: 'start' | 'end' } to handle multiple brackets at same position
    const bracketMap = new Map<number, Array<{ color: string, type: 'start' | 'end' }>>();
    const redexColors = ['#28a745', '#007bff', '#ffc107', '#dc3545', '#6f42c1', '#20c997', '#fd7e14', '#e83e8c'];
    
    if (showAnswers) {
      // Assign a unique color to each redex and mark its start and end positions with brackets
      currentQuestion.correctRedexes.forEach((redex, index) => {
        const range = redexToRangeMap.get(redex);
        if (range) {
          const startWithSpaces = positionWithSpaces(text, range.start);
          // range.end is exclusive, so the last character is at range.end - 1
          const endWithSpaces = positionWithSpaces(text, range.end - 1);
          const color = redexColors[index % redexColors.length];
          
          // Mark start position with opening bracket
          if (!bracketMap.has(startWithSpaces)) {
            bracketMap.set(startWithSpaces, []);
          }
          bracketMap.get(startWithSpaces)!.push({ color, type: 'start' });
          
          // Mark end position (last character of redex) with closing bracket
          if (!bracketMap.has(endWithSpaces)) {
            bracketMap.set(endWithSpaces, []);
          }
          bracketMap.get(endWithSpaces)!.push({ color, type: 'end' });
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
                // Render all opening brackets first
                bracketInfos.forEach((bracketInfo, idx) => {
                  if (bracketInfo.type === 'start') {
                    renderedChars.push(
                      <span key={`bracket-start-${j}-${idx}`} style={{ color: bracketInfo.color, fontWeight: 'bold', fontSize: '1.2em' }}>
                        [
                      </span>
                    );
                  }
                });
                
                // Render the character
                renderedChars.push(char);
                
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
                renderedChars.push(char);
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
            const renderedText = showAnswers 
              ? renderTextWithBrackets(currentGroup.start, currentGroup.end)
              : groupText;
            
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
    
    const text = currentQuestion.questionStr;
    
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
          
          // Convert positions from "without spaces" to "with spaces" for rendering
          const startWithSpaces = positionWithSpaces(text, range.start);
          const endWithSpaces = positionWithSpaces(text, range.end);
          
          // Build the full string with the highlighted portion
          const beforeText = text.substring(0, startWithSpaces);
          const highlightedText = text.substring(startWithSpaces, endWithSpaces);
          const afterText = text.substring(endWithSpaces);
          
          return (
            <div
              key={`confirmed-redex-${index}`}
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

  return (
    <div className="container">
      <div style={{ marginBottom: '20px' }}>
        <button onClick={onBack} style={{ marginBottom: '10px' }}>← Back to Menu</button>
      </div>
      <h1>Highlight the Redexes</h1>
      <p style={{ marginBottom: '20px', color: '#666' }}>
        Select text in the expression below to highlight redexes one at a time. Each selection will identify the redex(es) it covers and add them to your confirmed highlights.
        You can see all your previous highlights for the current question.
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
              userSelect: 'text',
              cursor: 'text',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word'
            }}
            onMouseUp={handleMouseUp}
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

              {currentSelection && (
                <span> | <strong>Current selection:</strong> {currentSelectionApps.length} redex{currentSelectionApps.length !== 1 ? 'es' : ''} found</span>
              )}
            </p>
            <div style={{ display: 'flex', gap: '10px', marginTop: '10px', flexWrap: 'wrap' }}>
              {currentSelection && (
                <button 
                  onClick={handleConfirmSelection}
                  style={{ fontSize: '14px', padding: '6px 12px' }}
                >
                  Confirm Selection
                </button>
              )}
              {confirmedRedexes.length > 0 && (
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
      ) : (
        <div>
          <h2>Finished!</h2>
          <p>You've completed all questions. Great job identifying redexes!</p>
        </div>
      )}
    </div>
  );
};
