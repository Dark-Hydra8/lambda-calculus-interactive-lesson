import React from 'react';

/**
 * Build a map from character index to parenthesis depth (0, 1, 2, ...).
 * Only ( and ) are counted; [ and ] are ignored so bracket and paren colors stay independent.
 * Matching ( and ) get the same depth. Deeper nesting gets higher depth.
 */
export function getParenPairMap(str: string): Map<number, number> {
  const map = new Map<number, number>();
  let depth = 0;
  for (let i = 0; i < str.length; i++) {
    if (str[i] === '(') {
      map.set(i, depth);
      depth += 1;
    } else if (str[i] === ')') {
      depth -= 1;
      map.set(i, depth);
    }
  }
  return map;
}

/**
 * Build a map from character index to bracket depth (0, 1, 2, ...).
 * Only [ and ] are counted; ( and ) are ignored so bracket and paren colors stay independent.
 * Matching [ and ] get the same depth.
 */
export function getBracketPairMap(str: string): Map<number, number> {
  const map = new Map<number, number>();
  let depth = 0;
  for (let i = 0; i < str.length; i++) {
    if (str[i] === '[') {
      map.set(i, depth);
      depth += 1;
    } else if (str[i] === ']') {
      depth -= 1;
      map.set(i, depth);
    }
  }
  return map;
}

/** Rainbow colors (ROYGBIV) for parenthesis depth; cycles when depth exceeds length. */
export const PAREN_COLORS = [
  '#FF9800', // orange
  '#3949AB', // indigo
  '#8E24AA', // violet
  '#E53935', // red
  '#FDD835', // yellow
  '#1E88E5', // blue
  '#43A047', // green
];

/** Separate palette for square brackets so bracket and paren highlighting are independent. */
export const BRACKET_COLORS = [
  '#1E88E5', // blue
  '#43A047', // green
  '#E53935', // red
  '#8E24AA', // violet
  '#FF9800', // orange
  '#3949AB', // indigo
  '#FDD835', // yellow
];

type ColoredParensOptions = {
  pairMap: Map<number, number>;
  colors?: string[];
  keyPrefix?: string;
};

/**
 * Render a segment of text (possibly the whole string) with matching parentheses
 * colored. pairMap must have been built from the full string; segmentStart is the
 * index of segmentStr within that full string.
 */
export function renderSegmentWithColoredParens(
  segmentStr: string,
  segmentStart: number,
  options: ColoredParensOptions
): React.ReactNode[] {
  const { pairMap, colors = PAREN_COLORS, keyPrefix = 'cp' } = options;
  const out: React.ReactNode[] = [];
  let i = 0;
  while (i < segmentStr.length) {
    const globalIndex = segmentStart + i;
    const pairId = pairMap.get(globalIndex);
    if (pairId !== undefined) {
      const color = colors[pairId % colors.length];
      out.push(
        <span key={`${keyPrefix}-${globalIndex}`} style={{ color, fontWeight: 'bold' }}>
          {segmentStr[i]}
        </span>
      );
      i += 1;
    } else {
      let j = i;
      while (j < segmentStr.length && pairMap.get(segmentStart + j) === undefined) {
        j += 1;
      }
      out.push(
        <React.Fragment key={`${keyPrefix}-text-${segmentStart}-${i}`}>
          {segmentStr.slice(i, j)}
        </React.Fragment>
      );
      i = j;
    }
  }
  return out;
}

/**
 * Render a full string with matching parentheses colored. Use when the entire
 * string is rendered at once.
 */
export function renderStringWithColoredParens(
  str: string,
  options?: { colors?: string[]; keyPrefix?: string }
): React.ReactNode[] {
  const pairMap = getParenPairMap(str);
  return renderSegmentWithColoredParens(str, 0, {
    pairMap,
    colors: options?.colors,
    keyPrefix: options?.keyPrefix ?? 'cp',
  });
}

export type PairMaps = {
  parenPairMap: Map<number, number>;
  bracketPairMap?: Map<number, number>;
};

/**
 * Get both paren and bracket pair maps so brackets and parentheses can be
 * colored independently (matching () share one palette, matching [] share another).
 */
export function getParenAndBracketMaps(str: string): PairMaps {
  return {
    parenPairMap: getParenPairMap(str),
    bracketPairMap: getBracketPairMap(str),
  };
}

/**
 * Render a segment with both parentheses and brackets colored independently.
 * Use when the string contains both ( ) and [ ].
 */
export function renderSegmentWithColoredParensAndBrackets(
  segmentStr: string,
  segmentStart: number,
  options: ColoredParensOptions & {
    bracketPairMap?: Map<number, number>;
    bracketColors?: string[];
  }
): React.ReactNode[] {
  const {
    pairMap,
    bracketPairMap,
    colors = PAREN_COLORS,
    bracketColors = BRACKET_COLORS,
    keyPrefix = 'cp',
  } = options;
  const out: React.ReactNode[] = [];
  let i = 0;
  while (i < segmentStr.length) {
    const globalIndex = segmentStart + i;
    const char = segmentStr[i];
    if (char === '(' || char === ')') {
      const pairId = pairMap.get(globalIndex);
      if (pairId !== undefined) {
        const color = colors[pairId % colors.length];
        out.push(
          <span key={`${keyPrefix}-p-${globalIndex}`} style={{ color, fontWeight: 'bold' }}>
            {char}
          </span>
        );
      } else {
        out.push(<React.Fragment key={`${keyPrefix}-p-${globalIndex}`}>{char}</React.Fragment>);
      }
      i += 1;
    } else if ((char === '[' || char === ']') && bracketPairMap) {
      const pairId = bracketPairMap.get(globalIndex);
      if (pairId !== undefined) {
        const color = bracketColors[pairId % bracketColors.length];
        out.push(
          <span key={`${keyPrefix}-b-${globalIndex}`} style={{ color, fontWeight: 'bold' }}>
            {char}
          </span>
        );
      } else {
        out.push(<React.Fragment key={`${keyPrefix}-b-${globalIndex}`}>{char}</React.Fragment>);
      }
      i += 1;
    } else {
      let j = i;
      while (
        j < segmentStr.length &&
        segmentStr[j] !== '(' &&
        segmentStr[j] !== ')' &&
        (!bracketPairMap || (segmentStr[j] !== '[' && segmentStr[j] !== ']'))
      ) {
        j += 1;
      }
      out.push(
        <React.Fragment key={`${keyPrefix}-text-${segmentStart}-${i}`}>
          {segmentStr.slice(i, j)}
        </React.Fragment>
      );
      i = j;
    }
  }
  return out;
}
