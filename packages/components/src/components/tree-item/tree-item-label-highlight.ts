export type LabelSegment = {
  text: string;
  highlighted: boolean;
  start: number;
};

/**
 * Splits `value` into highlight segments around the first case-insensitive
 * match of `query`. An empty `query` (no active filter) or no match returns
 * the whole label as a single, non-highlighted segment.
 */
export function splitLabelForHighlight(value: string, query: string): LabelSegment[] {
  if (query.length === 0) return [{ text: value, highlighted: false, start: 0 }];

  const matchIndex = value.toLowerCase().indexOf(query.toLowerCase());
  if (matchIndex === -1) return [{ text: value, highlighted: false, start: 0 }];

  const matchEnd = matchIndex + query.length;
  const segments: LabelSegment[] = [];
  if (matchIndex > 0) {
    segments.push({ text: value.slice(0, matchIndex), highlighted: false, start: 0 });
  }
  segments.push({
    text: value.slice(matchIndex, matchEnd),
    highlighted: true,
    start: matchIndex,
  });
  if (matchEnd < value.length) {
    segments.push({ text: value.slice(matchEnd), highlighted: false, start: matchEnd });
  }
  return segments;
}
