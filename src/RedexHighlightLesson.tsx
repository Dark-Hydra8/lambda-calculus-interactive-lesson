import React, { useState, useMemo, useRef, useEffect } from 'react';
import './styles.css';
import { LambdaObject, Variable, Application, Lambda } from './lambda_ir';
import { random_lambda } from './random_lambda';

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
// Traverses the tree and tracks character positions matching toString() behavior
function buildApplicationRanges(
  obj: LambdaObject,
  startPos: number,
  applicationRanges: ApplicationRange[]
): number {
  if (obj instanceof Variable) {
    return startPos + obj.get_symbol().length;
  } else if (obj instanceof Lambda) {
    let pos = startPos;
    pos += 1; // λ
    pos += obj.get_parameter().get_symbol().length;
    pos += 1; // .
    pos = buildApplicationRanges(obj.get_body(), pos, applicationRanges);
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
    pos = buildApplicationRanges(obj.get_left(), pos, applicationRanges);
    if (leftNeedsParens) pos += 1; // )
    pos += 1; // space
    if (rightNeedsParens) pos += 1; // (
    pos = buildApplicationRanges(obj.get_right(), pos, applicationRanges);
    if (rightNeedsParens) pos += 1; // )
    
    // Record the range for this application
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
  redex: Application;
  selectionRange: SelectionRange;
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
    selectedRedexes: Application[];
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
  
  // Build application ranges for the current question
  const applicationRanges = useMemo(() => {
    const ranges: ApplicationRange[] = [];
    buildApplicationRanges(currentQuestion.question, 0, ranges);
    // Sort by start position for easier processing
    ranges.sort((a, b) => a.start - b.start);
    return ranges;
  }, [currentIndex]);

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

    // Set the current selection if it's valid
    if (startPos < endPos && endPos <= textContent.length) {
      setCurrentSelection({ start: startPos, end: endPos });
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
    
    const apps = findApplicationsInRange(currentSelection, applicationRanges);
    // Deduplicate apps first (in case same Application appears multiple times)
    // Use a Map to ensure proper deduplication by object reference
    const appsMap = new Map<Application, Application>();
    apps.forEach(app => {
      if (!appsMap.has(app)) {
        appsMap.set(app, app);
      }
    });
    const uniqueApps = Array.from(appsMap.values());
    
    // Filter to only include redexes (applications where left is Lambda)
    const redexes = uniqueApps.filter(app => app.get_left() instanceof Lambda);
    
    // Deduplicate redexes using Map for reliable object reference comparison
    const redexesMap = new Map<Application, Application>();
    redexes.forEach(redex => {
      if (!redexesMap.has(redex)) {
        redexesMap.set(redex, redex);
      }
    });
    const uniqueRedexes = Array.from(redexesMap.values());
    
    if (uniqueRedexes.length > 0) {
      // Allow overlapping highlights - add all redexes with the exact selection range
      // But don't add the same redex with the same selection range twice
      setConfirmedRedexes(prev => {
        // Create a set to track what we're adding in this batch (deduplicate within batch)
        const batchSet = new Map<Application, ConfirmedRedex>();
        
        // First, deduplicate within the new batch
        // Create a fresh copy of the selection range to avoid reference issues
        const selectionRangeCopy = {
          start: currentSelection.start,
          end: currentSelection.end
        };
        
        uniqueRedexes.forEach(redex => {
          if (!batchSet.has(redex)) {
            batchSet.set(redex, {
              redex,
              selectionRange: selectionRangeCopy
            });
          }
        });
        
        const newConfirmedRedexes = Array.from(batchSet.values());

        // Create a Set of existing combinations for fast lookup
        // Use a string key combining redex object identity and selection range
        const existingKeys = new Set<string>();
        prev.forEach(existing => {
          // Create a unique key - we'll use the redex object reference
          // Since we can't stringify objects reliably, we'll use a combination approach
          // Store the index in prev array as a proxy for object identity
          const prevIndex = prev.indexOf(existing);
          const key = `${prevIndex}-${existing.selectionRange.start}-${existing.selectionRange.end}`;
          existingKeys.add(key);
        });
        
        // Filter out any that already exist in prev (same redex + same selection range)
        const filtered = newConfirmedRedexes.filter((newCr, newIndex) => {
          // Check if this exact combination exists
          const exists = prev.some((existing, existingIndex) => {
            // Check object identity first (fast)
            if (existing.redex !== newCr.redex) return false;
            // Then check selection range
            if (existing.selectionRange.start !== newCr.selectionRange.start) return false;
            if (existing.selectionRange.end !== newCr.selectionRange.end) return false;
            return true;
          });
          
          if (exists) {
            console.log(`Skipping duplicate: redex at ${newCr.selectionRange.start}-${newCr.selectionRange.end}`);
            return false;
          }
          return true;
        });
        
        console.log(`Adding ${filtered.length} new redexes (filtered from ${newConfirmedRedexes.length})`);
        
        const result = [...prev, ...filtered];
        
        // Final deduplication pass to ensure no duplicates slipped through
        // Deduplicate by selection range only (same start/end = duplicate, regardless of redex)
        const finalDeduplicated: ConfirmedRedex[] = [];
        const seenRanges = new Set<string>();
        
        result.forEach((cr, index) => {
          const rangeKey = `${cr.selectionRange.start}-${cr.selectionRange.end}`;
          if (!seenRanges.has(rangeKey)) {
            seenRanges.add(rangeKey);
            finalDeduplicated.push(cr);
          } else {
            console.log(`Final dedup: removing duplicate selection range at ${rangeKey} (index ${index})`);
          }
        });
        
        console.log(`Final count: ${finalDeduplicated.length} (was ${result.length})`);
        
        return finalDeduplicated;
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
    const selectedArray = confirmedRedexes.map(cr => cr.redex);
    const correctArray = currentQuestion.correctRedexes;
    
    // Check if all correct redexes are selected and no incorrect ones
    const selectedSet = new Set(selectedArray);
    const correctSet = new Set(correctArray);
    
    const allCorrectSelected = correctArray.every(redex => selectedSet.has(redex));
    const noIncorrectSelected = selectedArray.every(app => correctSet.has(app));
    const isCorrect = allCorrectSelected && noIncorrectSelected && selectedArray.length === correctArray.length;

    const response = {
      question: currentQuestion.question,
      questionStr: currentQuestion.questionStr,
      selectedRedexes: selectedArray,
      correctRedexes: correctArray,
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
      setShowResult(true);
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
    
    // Add current selection (if any)
    if (currentSelection) {
      highlights.push({
        type: 'current',
        start: currentSelection.start,
        end: currentSelection.end
      });
    }
    
    // Add missed redexes when showing answers
    if (showAnswers) {
      const confirmedSet = new Set(confirmedRedexes.map(cr => cr.redex));
      currentQuestion.correctRedexes.forEach(redex => {
        if (!confirmedSet.has(redex)) {
          const range = applicationRanges.find(r => r.application === redex);
          if (range) {
            highlights.push({
              type: 'missed',
              start: range.start,
              end: range.end,
              redex
            });
          }
        }
      });
    }
    
    // Create an array to track which highlights cover each character position
    const charHighlights: Array<Array<{ type: 'current' | 'missed', redex?: Application }>> = [];
    for (let i = 0; i < text.length; i++) {
      charHighlights[i] = highlights.filter(h => i >= h.start && i < h.end);
    }
    
    // Build elements by grouping consecutive characters with the same highlight set
    const elements: React.ReactNode[] = [];
    let currentGroup: { highlights: Array<{ type: 'current' | 'missed', redex?: Application }>, start: number, end: number } | null = null;
    
    // Helper to compare highlight sets
    const highlightsEqual = (a: Array<{ type: 'current' | 'missed', redex?: Application }>, b: Array<{ type: 'current' | 'missed', redex?: Application }>): boolean => {
      if (a.length !== b.length) return false;
      // For current selections, we don't need to compare redex, just type
      const aTypes = new Set(a.map(h => h.type));
      const bTypes = new Set(b.map(h => h.type));
      return aTypes.size === bTypes.size && Array.from(aTypes).every(type => bTypes.has(type));
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
          
          if (currentGroup.highlights.length === 0) {
            // No highlights - just plain text
            elements.push(
              <span key={`text-${currentGroup.start}`}>
                {groupText}
              </span>
            );
          } else {
            // Has highlights - determine styling
            let className = 'text-selection';
            const hasCurrent = currentGroup.highlights.some(h => h.type === 'current');
            const hasMissed = currentGroup.highlights.some(h => h.type === 'missed');
            
            if (hasCurrent && hasMissed) {
              // Overlapping current and missed
              className += ' current-selection overlapping-highlight';
            } else if (hasCurrent) {
              className += ' current-selection';
            } else if (hasMissed) {
              className += ' missed-redex';
            }
            
            elements.push(
              <span
                key={`highlight-${currentGroup.start}`}
                className={className}
              >
                {groupText}
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
    
    // Remove duplicates based on start/end indexes - only show unique selection ranges
    // If the same range appears with multiple redexes, prefer the correct one
    const rangeMap = new Map<string, ConfirmedRedex>();
    
    confirmedRedexes.forEach(cr => {
      const rangeKey = `${cr.selectionRange.start}-${cr.selectionRange.end}`;
      const existing = rangeMap.get(rangeKey);
      
      if (!existing) {
        // First time seeing this range
        rangeMap.set(rangeKey, cr);
      } else {
        // Range already exists - keep the correct redex if one is correct
        const existingIsCorrect = correctRedexesSet.has(existing.redex);
        const currentIsCorrect = correctRedexesSet.has(cr.redex);
        
        if (currentIsCorrect && !existingIsCorrect) {
          // Current is correct, existing is not - replace
          rangeMap.set(rangeKey, cr);
          console.log(`renderConfirmedRedexes: replacing incorrect with correct redex at ${rangeKey}`);
        } else if (!currentIsCorrect && existingIsCorrect) {
          // Existing is correct, current is not - keep existing
          console.log(`renderConfirmedRedexes: keeping correct redex, skipping incorrect at ${rangeKey}`);
        } else {
          // Both same type (both correct or both incorrect) - keep first one
          console.log(`renderConfirmedRedexes: duplicate selection range at ${rangeKey}, keeping first`);
        }
      }
    });
    
    const deduplicated = Array.from(rangeMap.values());
    console.log(`renderConfirmedRedexes: deduplicated from ${confirmedRedexes.length} to ${deduplicated.length}`);
    
    // Render each redex on its own line, showing the full string with the highlighted portion marked
    return (
      <div>
        {deduplicated.map((confirmedRedex, index) => {
          console.log(`confirmedRedexes: ${confirmedRedexes.map(i => `${i.redex} ${i.selectionRange.start}-${i.selectionRange.end}`).join(", ")}`);
          console.log(`rendering redex ${confirmedRedex.redex.toString()} at range ${confirmedRedex.selectionRange.start} to ${confirmedRedex.selectionRange.end} and index ${index}`);
          const { redex, selectionRange } = confirmedRedex;
          
          // Determine styling - show both correct and incorrect
          let className = 'text-selection confirmed-redex';
          const isCorrect = correctRedexesSet.has(redex);
          
          if (showAnswers) {
            // When showing answers, distinguish correct from incorrect
            if (isCorrect) {
              className += ' correct-redex';
              console.log(`Applying correct-redex class to redex at ${selectionRange.start}-${selectionRange.end}`);
            } else {
              className += ' incorrect-selection';
              console.log(`Applying incorrect-selection class to redex at ${selectionRange.start}-${selectionRange.end}`);
            }
          }
          
          // Build the full string with the highlighted portion
          const beforeText = text.substring(0, selectionRange.start);
          const highlightedText = text.substring(selectionRange.start, selectionRange.end);
          const afterText = text.substring(selectionRange.end);
          
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
                Incorrect. You selected {res.selectedRedexes.length} redex{res.selectedRedexes.length !== 1 ? 'es' : ''}, 
                but there {res.correctRedexes.length === 1 ? 'is' : 'are'} {res.correctRedexes.length} correct redex{res.correctRedexes.length !== 1 ? 'es' : ''}.
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
                Confirmed Redexes ({confirmedRedexes.length}):
              </div>
              {renderConfirmedRedexes()}
            </div>
          )}
          
          <div style={{ marginBottom: '10px' }}>
            <p>
              <strong>Confirmed redexes:</strong> {confirmedRedexes.length} | 
              <strong> Target:</strong> {currentQuestion.correctRedexes.length} redex{currentQuestion.correctRedexes.length !== 1 ? 'es' : ''}
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

          {showAnswers && (
            <div style={{ 
              marginBottom: '15px', 
              padding: '10px', 
              backgroundColor: '#fff3cd', 
              border: '1px solid #ffc107',
              borderRadius: '4px',
              fontSize: '14px'
            }}>
              <p style={{ margin: 0 }}>
                <strong>Legend:</strong>{' '}
                <span style={{ backgroundColor: '#d4edda', padding: '2px 6px', borderRadius: '3px' }}>Green</span> = Correct redex,{' '}
                <span style={{ backgroundColor: '#f8d7da', padding: '2px 6px', borderRadius: '3px' }}>Red</span> = Incorrect selection,{' '}
                <span style={{ backgroundColor: '#fff3cd', padding: '2px 6px', borderRadius: '3px' }}>Yellow</span> = Missed redex
              </p>
            </div>
          )}

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
