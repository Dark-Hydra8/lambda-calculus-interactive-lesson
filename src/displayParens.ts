/**
 * Add a space before and after each '(' and ')' when there isn't already a space
 * (or at start/end). Both parens are handled the same.
 * Does not add a second space when two parens are adjacent (e.g. ") (" stays ") (").
 */
export function addSpacesAroundParens(str: string): {
  displayStr: string;
  originalToDisplay: number[];
  displayToOriginal: number[];
} {
  let display = '';
  const originalToDisplay: number[] = [0];
  const displayToOriginal: number[] = [0];
  for (let i = 0; i < str.length; i++) {
    const c = str[i];
    if (c === '(' || c === ')') {
      // Space before: not at start, previous is not a space, and not another paren (avoid double space)
      if (i > 0 && str[i - 1] !== ' ') {
        display += ' ';
        displayToOriginal[display.length] = i;
      }
      display += c;
      originalToDisplay[i + 1] = display.length;
      displayToOriginal[display.length] = i + 1;
      // Space after: not at end, next is not a space, and not another paren (avoid double space)
      if (i < str.length - 1 && str[i + 1] !== ' ' && str[i + 1] !== '(' && str[i + 1] !== ')') {
        display += ' ';
        displayToOriginal[display.length] = i + 1;
      }
    } else {
      display += c;
      originalToDisplay[i + 1] = display.length;
      displayToOriginal[display.length] = i + 1;
    }
  }
  return { displayStr: display, originalToDisplay, displayToOriginal };
}
