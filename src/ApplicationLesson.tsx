import React, { useState, useMemo, useRef } from 'react';
import './styles.css';
import { LambdaObject, Variable, Application, Lambda } from './lambda_ir';
import { random_lambda } from './random_lambda';
import { addSpacesAroundParens } from './displayParens';
import { getParenPairMap, renderSegmentWithColoredParens, PAREN_COLORS } from './coloredParens';

type Question = {
  question: LambdaObject;
  questionStr: string;
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

// Count application nodes (for filtering questions)
function countApplications(obj: LambdaObject): number {
  if (obj instanceof Variable) return 0;
  if (obj instanceof Lambda) return countApplications(obj.get_body());
  if (obj instanceof Application) {
    // Only count applications whose left element is not an application
    const leftIsApplication = obj.get_left() instanceof Application;
    const countThis = leftIsApplication ? 0 : 1;
    return countThis + countApplications(obj.get_left()) + countApplications(obj.get_right());
  }
  return 0;
}

// Build application ranges: each Application node gets one range (start to end, positions without spaces)
function buildApplicationRanges(
  obj: LambdaObject,
  startPos: number,
  applicationRanges: ApplicationRange[],
  _fullString: string
): number {
  if (obj instanceof Variable) {
    return startPos + obj.get_symbol().length;
  }
  if (obj instanceof Lambda) {
    let pos = startPos;
    pos += 1;
    pos += obj.get_parameter().get_symbol().length;
    pos += 1;
    return buildApplicationRanges(obj.get_body(), pos, applicationRanges, _fullString);
  }
  if (obj instanceof Application) {
    const leftNeedsParens = obj.get_left() instanceof Lambda;
    const rightNeedsParens =
      obj.get_right() instanceof Application ||
      (obj.get_right() instanceof Lambda &&
        obj.get_parent() instanceof Application &&
        (obj.get_parent() as Application).get_left() === obj);
    const appStart = startPos;
    let pos = startPos;
    if (leftNeedsParens) {
      pos += 1;
      pos = buildApplicationRanges(obj.get_left(), pos, applicationRanges, _fullString);
      pos += 1;
    } else {
      pos = buildApplicationRanges(obj.get_left(), pos, applicationRanges, _fullString);
    }
    if (rightNeedsParens) {
      pos += 1;
      pos = buildApplicationRanges(obj.get_right(), pos, applicationRanges, _fullString);
      pos += 1;
    } else {
      pos = buildApplicationRanges(obj.get_right(), pos, applicationRanges, _fullString);
    }
    // Only include applications whose left element is not an application
    if (!(obj.get_left() instanceof Application)) {
      applicationRanges.push({ application: obj, start: appStart, end: pos });
    }
    return pos;
  }
  return startPos;
}

function new_question(): LambdaObject {
  let lambda: LambdaObject;
  do {
    lambda = random_lambda(['w', 'x', 'y', 'z'], 3);
  } while (
    lambda.toString().replace(/\s/g, '').length < 5 ||
    countApplications(lambda) < 1 ||
    countApplications(lambda) >= 8
  );
  return lambda;
}

function findApplicationsInRange(
  selection: SelectionRange,
  applicationRanges: ApplicationRange[]
): ApplicationRange[] {
  const result: ApplicationRange[] = [];
  for (const range of applicationRanges) {
    if (selection.start < range.end && selection.end > range.start) {
      result.push(range);
    }
  }
  return result;
}

type ConfirmedSelection = {
  range: SelectionRange;
};

export const ApplicationLesson: React.FC<{ onBack: () => void; onCorrectWithoutShowAnswer?: () => void }> = ({ onBack, onCorrectWithoutShowAnswer }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [currentSelection, setCurrentSelection] = useState<SelectionRange | null>(null);
  const [confirmedSelections, setConfirmedSelections] = useState<ConfirmedSelection[]>([]);
  const [showAnswers, setShowAnswers] = useState(false);
  const [hadShownAnswerForCurrentQuestion, setHadShownAnswerForCurrentQuestion] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [responses, setResponses] = useState<Array<{
    question: LambdaObject;
    questionStr: string;
    selectedRanges: SelectionRange[];
    correctApplications: ApplicationRange[];
    isCorrect: boolean;
  }>>([]);
  const instructions =
    'What is an application?\n\n' +
    'In lambda calculus, an application is when one expression is applied to another, written as M N (M applied to N). So "x y" is one application (x applied to y), and "(λx.x) y" is one application (the function λx.x applied to y).\n\n' +
    'An expression can contain multiple applications. For example, "x y z" has two applications: first "x y" (x applied to y), then that result applied to z, so the applications are "x y" and "x y z".\n\n' +
    'Your task: Identify and highlight every application in the expression below. Select each range of text that forms one application, then confirm your selection. Submit when all applications have been highlighted.';
  const textRef = useRef<HTMLDivElement>(null);
  const isProcessingRef = useRef(false);

  if (questions.length === 0) {
    const question = new_question();
    questions.push({ question, questionStr: String(question) });
  }

  const currentQuestion = questions[currentIndex];

  const applicationRanges = useMemo(() => {
    const ranges: ApplicationRange[] = [];
    buildApplicationRanges(currentQuestion.question, 0, ranges, currentQuestion.questionStr);
    ranges.sort((a, b) => a.start - b.start);
    return ranges;
  }, [currentQuestion.question, currentQuestion.questionStr]);

  const { displayStr, originalToDisplay, displayToOriginal } = useMemo(
    () => addSpacesAroundParens(currentQuestion.questionStr),
    [currentQuestion.questionStr]
  );

  const parenPairMap = useMemo(() => getParenPairMap(displayStr), [displayStr]);

  const rangeToApplicationRangeMap = useMemo(() => {
    const map = new Map<string, ApplicationRange>();
    for (const ar of applicationRanges) {
      map.set(`${ar.start}-${ar.end}`, ar);
    }
    return map;
  }, [applicationRanges]);

  const handleTextSelection = () => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;
    const range = selection.getRangeAt(0);
    if (!textRef.current || !textRef.current.contains(range.commonAncestorContainer)) return;
    const textContent = textRef.current.textContent || '';
    const selectedText = range.toString();
    if (selectedText.length === 0) return;
    const startContainer = range.startContainer;
    const endContainer = range.endContainer;
    let startPos = 0;
    let endPos = 0;
    if (startContainer === endContainer && startContainer.nodeType === Node.TEXT_NODE) {
      const textNode = startContainer as Text;
      const walker = document.createTreeWalker(textRef.current, NodeFilter.SHOW_TEXT, null);
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
    // textContent is displayStr (with extra spaces); map display positions back to original string
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
    setTimeout(() => handleTextSelection(), 10);
  };

  const handleConfirmSelection = () => {
    if (!currentSelection || isProcessingRef.current) return;
    isProcessingRef.current = true;
    setConfirmedSelections(prev => {
      const alreadyExists = prev.some(
        c => c.range.start === currentSelection.start && c.range.end === currentSelection.end
      );
      if (alreadyExists) return prev;
      return [...prev, { range: { ...currentSelection } }];
    });
    setCurrentSelection(null);
    isProcessingRef.current = false;
  };

  const handleClearCurrentSelection = () => {
    setCurrentSelection(null);
  };

  const handleRemoveConfirmed = (index: number) => {
    setConfirmedSelections(prev => prev.filter((_, i) => i !== index));
  };

  const handleClearAll = () => {
    setConfirmedSelections([]);
    setCurrentSelection(null);
  };

  const handleReset = () => {
    setShowAnswers(false);
    setIsSubmitted(false);
  };

  const handleSubmit = () => {
    const correctRanges = applicationRanges.map(ar => ({ start: ar.start, end: ar.end }));
    const selectedRanges = confirmedSelections.map(c => c.range);
    const selectedRangeKeys = new Set(selectedRanges.map(r => `${r.start}-${r.end}`));
    const correctRangeKeys = new Set(correctRanges.map(r => `${r.start}-${r.end}`));
    const allCorrectSelected = correctRanges.every(r => selectedRangeKeys.has(`${r.start}-${r.end}`));
    const noIncorrectSelected = selectedRanges.every(r => correctRangeKeys.has(`${r.start}-${r.end}`));
    const isCorrect =
      allCorrectSelected && noIncorrectSelected && selectedRanges.length === correctRanges.length;

    if (isCorrect && !hadShownAnswerForCurrentQuestion) onCorrectWithoutShowAnswer?.();
    setIsSubmitted(true);
  };

  const handleNext = () => {
    setHadShownAnswerForCurrentQuestion(false);
    if (isSubmitted && isCorrect !== null) {
      setResponses(prev => [
        ...prev,
        {
          question: currentQuestion.question,
          questionStr: currentQuestion.questionStr,
          selectedRanges: confirmedSelections.map(c => c.range),
          correctApplications: applicationRanges,
          isCorrect,
        },
      ]);
    }
    if (currentIndex + 1 < questions.length) {
      setCurrentIndex(currentIndex + 1);
      setConfirmedSelections([]);
      setCurrentSelection(null);
      setShowAnswers(false);
      setIsSubmitted(false);
    } else {
      const newQuestion = new_question();
      questions.push({ question: newQuestion, questionStr: String(newQuestion) });
      setCurrentIndex(currentIndex + 1);
      setConfirmedSelections([]);
      setCurrentSelection(null);
      setShowAnswers(false);
      setIsSubmitted(false);
    }
  };

  const handleShowAnswer = () => {
    setShowAnswers(true);
    setHadShownAnswerForCurrentQuestion(true);
  };

  const renderExpressionWithHighlights = () => {
    const text = displayStr;
    const origStr = currentQuestion.questionStr;
    const highlights: Array<{ type: 'current'; start: number; end: number }> = [];
    if (currentSelection) {
      const startWithSpaces = positionWithSpaces(origStr, currentSelection.start);
      const endWithSpaces = positionWithSpaces(origStr, currentSelection.end);
      highlights.push({
        type: 'current',
        start: originalToDisplay[startWithSpaces] ?? 0,
        end: originalToDisplay[endWithSpaces] ?? text.length,
      });
    }
    const charHighlights: Array<Array<{ type: 'current' }>> = [];
    for (let i = 0; i < text.length; i++) {
      charHighlights[i] = highlights.filter(h => i >= h.start && i < h.end);
    }
    const elements: React.ReactNode[] = [];
    let currentGroup: { highlights: Array<{ type: 'current' }>; start: number; end: number } | null = null;
    const highlightsEqual = (a: Array<{ type: 'current' }>, b: Array<{ type: 'current' }>) => a.length === b.length;

    for (let i = 0; i <= text.length; i++) {
      const highlightsAtPos = i < text.length ? charHighlights[i] : [];
      const highlightsMatch = currentGroup && i < text.length && highlightsEqual(currentGroup.highlights, highlightsAtPos);
      if (highlightsMatch && currentGroup) {
        currentGroup.end = i + 1;
      } else {
        if (currentGroup) {
          const groupText = text.substring(currentGroup.start, currentGroup.end);
          const coloredContent = renderSegmentWithColoredParens(groupText, currentGroup.start, {
            pairMap: parenPairMap,
            colors: PAREN_COLORS,
            keyPrefix: `main-${currentGroup.start}`,
          });
          if (currentGroup.highlights.length === 0) {
            elements.push(<span key={`text-${currentGroup.start}`}>{coloredContent}</span>);
          } else {
            const hasCurrent = currentGroup.highlights.some(h => h.type === 'current');
            elements.push(
              <span
                key={`highlight-${currentGroup.start}`}
                className={`text-selection ${hasCurrent ? 'current-selection' : ''}`}
                style={
                  hasCurrent
                    ? {
                        padding: '2px 0',
                        outlineWidth: '2px',
                        outlineStyle: 'solid',
                        outlineColor: '#007bff',
                        display: 'inline-block',
                      }
                    : undefined
                }
              >
                {coloredContent}
              </span>
            );
          }
        }
        if (i < text.length) {
          currentGroup = { highlights: highlightsAtPos, start: i, end: i + 1 };
        } else {
          currentGroup = null;
        }
      }
    }
    return elements.length === 0 ? text : elements;
  };

  const renderConfirmedSelections = () => {
    if (confirmedSelections.length === 0) return null;
    const text = displayStr;
    const origStr = currentQuestion.questionStr;
    return (
      <div>
        {confirmedSelections.map((confirmed, index) => {
          const { range } = confirmed;
          const rangeKey = `${range.start}-${range.end}`;
          const appRange = rangeToApplicationRangeMap.get(rangeKey);
          let className = 'text-selection confirmed-redex';
          if (showAnswers) {
            className += appRange !== undefined ? ' correct-redex' : ' incorrect-selection';
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
            keyPrefix: `conf-${index}-b`,
          });
          const highlightNodes = renderSegmentWithColoredParens(highlightedText, startDisp, {
            pairMap: parenPairMap,
            colors: PAREN_COLORS,
            keyPrefix: `conf-${index}-h`,
          });
          const afterNodes = renderSegmentWithColoredParens(afterText, endDisp, {
            pairMap: parenPairMap,
            colors: PAREN_COLORS,
            keyPrefix: `conf-${index}-a`,
          });
          return (
            <div key={`confirmed-${index}`} style={{ marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <span style={{ flex: '1 1 auto', minWidth: 0 }}>
                <span>{beforeNodes}</span>
                <span className={className} style={{ cursor: 'default', display: 'inline' }}>
                  {highlightNodes}
                </span>
                <span>{afterNodes}</span>
              </span>
              {!isSubmitted && (
                <button
                  type="button"
                  onClick={() => handleRemoveConfirmed(index)}
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

  const renderCorrectAnswers = () => {
    if (!showAnswers) return null;
    const text = displayStr;
    const origStr = currentQuestion.questionStr;
    if (applicationRanges.length === 0) return null;
    return (
      <div>
        {applicationRanges.map((ar, index) => {
          const startWithSpaces = positionWithSpaces(origStr, ar.start);
          const endWithSpaces = positionWithSpaces(origStr, ar.end);
          const startDisp = originalToDisplay[startWithSpaces] ?? 0;
          const endDisp = originalToDisplay[endWithSpaces] ?? text.length;
          const beforeText = text.substring(0, startDisp);
          const highlightedText = text.substring(startDisp, endDisp);
          const afterText = text.substring(endDisp);
          const beforeNodes = renderSegmentWithColoredParens(beforeText, 0, {
            pairMap: parenPairMap,
            colors: PAREN_COLORS,
            keyPrefix: `correct-${index}-b`,
          });
          const highlightNodes = renderSegmentWithColoredParens(highlightedText, startDisp, {
            pairMap: parenPairMap,
            colors: PAREN_COLORS,
            keyPrefix: `correct-${index}-h`,
          });
          const afterNodes = renderSegmentWithColoredParens(afterText, endDisp, {
            pairMap: parenPairMap,
            colors: PAREN_COLORS,
            keyPrefix: `correct-${index}-a`,
          });
          return (
            <div key={`correct-${index}`} style={{ marginBottom: '8px' }}>
              <span>{beforeNodes}</span>
              <span
                className="text-selection correct-redex"
                style={{
                  cursor: 'default',
                  display: 'inline',
                  backgroundColor: 'rgba(0, 255, 30, 0.12)',
                  borderRadius: '3px',
                  outline: '2px solid rgb(2, 144, 35)',
                }}
              >
                {highlightNodes}
              </span>
              <span>{afterNodes}</span>
            </div>
          );
        })}
      </div>
    );
  };

  const isCorrect = useMemo(() => {
    if (!isSubmitted) return null;
    const correctRanges = applicationRanges.map(ar => ({ start: ar.start, end: ar.end }));
    const selectedRanges = confirmedSelections.map(c => c.range);
    const selectedRangeKeys = new Set(selectedRanges.map(r => `${r.start}-${r.end}`));
    const correctRangeKeys = new Set(correctRanges.map(r => `${r.start}-${r.end}`));
    const allCorrectSelected = correctRanges.every(r => selectedRangeKeys.has(`${r.start}-${r.end}`));
    const noIncorrectSelected = selectedRanges.every(r => correctRangeKeys.has(`${r.start}-${r.end}`));
    return allCorrectSelected && noIncorrectSelected && selectedRanges.length === correctRanges.length;
  }, [isSubmitted, confirmedSelections, applicationRanges]);

  const renderPreviousQuestion = (
    response: (typeof responses)[0],
    index: number,
    showBrackets: boolean
  ) => {
    const origStr = response.questionStr;
    const { displayStr: text, originalToDisplay: respO2D } = addSpacesAroundParens(origStr);
    const respParenMap = getParenPairMap(text);
    const colors = ['#28a745', '#007bff', '#ffc107', '#dc3545', '#6f42c1', '#20c997', '#fd7e14', '#e83e8c'];
    let renderedChars: React.ReactNode[] = [];
    if (showBrackets) {
      const sortedApps = [...response.correctApplications].sort((a, b) => {
        if (a.start !== b.start) return a.start - b.start;
        return b.end - a.end;
      });
      const bracketMap = new Map<
        number,
        Array<{ color: string; type: 'start' | 'end'; bodyIndex: number }>
      >();
      sortedApps.forEach((ar, bodyIndex) => {
        // ar.start / ar.end are measured in non-space characters on the
        // original question string. Map them directly into the display string,
        // which may have extra spaces around parentheses, by counting
        // non-space characters in the display string itself.
        const startDisp = positionWithSpaces(text, ar.start);
        const endDisp = positionWithSpaces(text, ar.end - 1);
        const color = colors[bodyIndex % colors.length];
        if (!bracketMap.has(startDisp)) bracketMap.set(startDisp, []);
        bracketMap.get(startDisp)!.push({ color, type: 'start', bodyIndex });
        if (!bracketMap.has(endDisp)) bracketMap.set(endDisp, []);
        bracketMap.get(endDisp)!.push({ color, type: 'end', bodyIndex });
      });
      const bracketStack: Array<{ color: string }> = [];
      for (let i = 0; i < text.length; i++) {
        const bracketInfos = bracketMap.get(i);
        const char = text[i];
        if (bracketInfos && bracketInfos.length > 0) {
          const openingBrackets = bracketInfos.filter(b => b.type === 'start');
          const closingBrackets = bracketInfos.filter(b => b.type === 'end');
          for (let idx = 0; idx < openingBrackets.length; idx++) {
            const info = openingBrackets[idx];
            bracketStack.push({ color: info.color });
            renderedChars.push(
              <span key={`bracket-start-${i}-${idx}`} style={{ color: info.color, fontWeight: 'bold', fontSize: '1.2em' }}>
                [
              </span>
            );
          }
          const parenColor = (respParenMap.get(i) ?? -1) >= 0 ? PAREN_COLORS[respParenMap.get(i)! % PAREN_COLORS.length] : undefined;
          renderedChars.push(
            parenColor ? (
              <span key={`char-${i}`} style={{ color: parenColor, fontWeight: 'bold' }}>{char}</span>
            ) : (
              char
            )
          );
          const closingBracketsSorted = [...closingBrackets].sort((a, b) => b.bodyIndex - a.bodyIndex);
          for (let idx = 0; idx < closingBracketsSorted.length; idx++) {
            const info = closingBracketsSorted[idx];
            const matchingBracket = bracketStack.pop();
            const colorToUse = matchingBracket ? matchingBracket.color : info.color;
            renderedChars.push(
              <span key={`bracket-end-${i}-${idx}`} style={{ color: colorToUse, fontWeight: 'bold', fontSize: '1.2em' }}>
                ]
              </span>
            );
          }
        } else {
          const parenColor = (respParenMap.get(i) ?? -1) >= 0 ? PAREN_COLORS[respParenMap.get(i)! % PAREN_COLORS.length] : undefined;
          renderedChars.push(
            parenColor ? (
              <span key={`char-${i}`} style={{ color: parenColor, fontWeight: 'bold' }}>{char}</span>
            ) : (
              char
            )
          );
        }
      }
    } else {
      renderedChars = renderSegmentWithColoredParens(text, 0, {
        pairMap: respParenMap,
        colors: PAREN_COLORS,
        keyPrefix: `prev-${index}`,
      });
    }
    const appCount = response.correctApplications.length;
    return (
      <div
        key={`previous-${index}`}
        className="response"
        style={{ marginBottom: '20px', padding: '15px', backgroundColor: '#f9f9f9', border: '1px solid #ddd', borderRadius: '8px' }}
      >
        <p style={{ marginBottom: '10px' }}><strong>Expression:</strong></p>
        <div
          style={{
            fontFamily: 'monospace',
            fontSize: '18px',
            lineHeight: '1.8',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            marginBottom: '10px',
          }}
        >
          {renderedChars}
        </div>
        <p style={{ margin: 0 }}>
          {response.isCorrect ? (
            <span className="correct" style={{ fontSize: '16px', fontWeight: 'bold' }}>
              ✓ Correct! You identified all {appCount} application{appCount !== 1 ? 's' : ''}.
            </span>
          ) : (
            <span className="incorrect">
              ✗ Incorrect. You selected {response.selectedRanges.length} application{response.selectedRanges.length !== 1 ? 's' : ''}, but there {appCount === 1 ? 'is' : 'are'} {appCount} correct application{appCount !== 1 ? 's' : ''}. Remember to click the "Confirm Selection" button after highlighting each application.
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
      <h1>Identify Applications</h1>
      <p style={{ marginBottom: '20px', color: '#000', whiteSpace: 'pre-line' }}>{instructions}</p>
      <p style={{ marginBottom: '16px', fontSize: '13px', color: '#666' }}>
        <em>
          Note: This lesson records how many questions you answer correctly (excluding ones where you click &quot;Show answer&quot;) for progress tracking.
        </em>
      </p>

      {responses.map((res, idx) => {
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
            userSelect: isSubmitted ? 'none' : 'text',
            cursor: isSubmitted ? 'default' : 'text',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
          }}
          onMouseUp={isSubmitted ? undefined : handleMouseUp}
        >
          {renderExpressionWithHighlights()}
        </div>

        {confirmedSelections.length > 0 && (
          <div
            style={{
              marginBottom: '20px',
              padding: '20px',
              backgroundColor: '#f0f0f0',
              border: '2px solid #dcdcdc',
              borderRadius: '8px',
              fontSize: '18px',
              fontFamily: 'monospace',
              lineHeight: '1.8',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
            }}
          >
            <div style={{ marginBottom: '10px', fontSize: '14px', color: '#666', fontWeight: 'bold' }}>
              Confirmed Applications:
            </div>
            {renderConfirmedSelections()}
          </div>
        )}

        {showAnswers && (
          <div
            style={{
              marginBottom: '20px',
              padding: '20px',
              backgroundColor: '#f0f0f0',
              border: '2px solid #dcdcdc',
              borderRadius: '8px',
              fontSize: '18px',
              fontFamily: 'monospace',
              lineHeight: '1.8',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
            }}
          >
            <div style={{ marginBottom: '10px', fontSize: '14px', color: '#666', fontWeight: 'bold' }}>
              Correct Answers:
            </div>
            {renderCorrectAnswers()}
          </div>
        )}

        <div style={{ marginBottom: '10px' }}>
          <p>
            <strong>Confirmed applications:</strong> {confirmedSelections.length}
            {applicationRanges.length > 0 && (
              <span> | <strong>Total applications:</strong> {applicationRanges.length}</span>
            )}
          </p>
          {isSubmitted && isCorrect !== null && (
            <p style={{ marginBottom: '12px' }}>
              {isCorrect ? (
                <span className="correct">✓ Correct. All applications identified.</span>
              ) : (
                <span className="incorrect">✗ Some applications are incorrect. Try again or show answer.</span>
              )}
            </p>
          )}
          <div style={{ display: 'flex', gap: '10px', marginTop: '10px', flexWrap: 'wrap' }}>
            <button
              onClick={handleConfirmSelection}
              disabled={!currentSelection || isSubmitted}
              style={{ fontSize: '14px', padding: '6px 12px' }}
            >
              Confirm Selection
            </button>
            <button
              onClick={handleClearCurrentSelection}
              disabled={!currentSelection || isSubmitted}
              style={{ fontSize: '14px', padding: '6px 12px' }}
            >
              Reset Current Highlight
            </button>
            {(confirmedSelections.length > 0 || currentSelection) && (
              <button onClick={handleClearAll} disabled={isSubmitted} style={{ fontSize: '14px', padding: '6px 12px' }}>
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
              {!isCorrect && !showAnswers && (
                <button onClick={handleShowAnswer}>Show Correct Answer</button>
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
