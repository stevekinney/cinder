import {
  parsePlaceholderTokens,
  unescapePlaceholderBody,
  type PlaceholderCandidate,
  type PlaceholderToken,
} from '@lostgradient/markdown';
import type { Mark } from 'prosemirror-model';
import type { EditorState } from 'prosemirror-state';

import { findRunBeforeCaret } from './template-placeholder-runs.js';

/** Rows visible at once; further matches stay reachable by scrolling. */
export const MAXIMUM_VISIBLE_SUGGESTIONS = 8;
const VALID_QUERY_PATTERN = /^[a-zA-Z0-9_.]*$/;
const PATH_CHARACTERS = /^[a-zA-Z0-9_.]*/;
const PATH_CHARACTER = /^[a-zA-Z0-9_.]$/;

/** The in-progress token around a collapsed caret. */
export interface DetectedTokenQuery {
  /** Text typed between the opening delimiter and the caret, without leading whitespace. */
  query: string;
  /** Document position of the opening `{{`. */
  tokenFrom: number;
  /** Document position where the in-progress token ends. */
  tokenTo: number;
  /** Document position of the caret. */
  cursorPos: number;
  /** Marks shared by the token's run; an accepted replacement keeps them. */
  marks: readonly Mark[];
}

/** Where the in-progress token sits in a piece of text, as offsets into that text. */
export interface LocatedTokenQuery {
  /** Text typed between the opening delimiter and the caret, without surrounding whitespace. */
  query: string;
  /** Offset of the opening `{{`. */
  from: number;
  /** Offset where the in-progress token ends. */
  to: number;
}

/** How to read a token body. */
export interface TokenQueryOptions {
  /**
   * Whether the text is Markdown source, where a backslash before ASCII
   * punctuation is an escape (`{{user\_name}}` names `user_name`). Rich-editor
   * text holds literal characters, so it leaves this off.
   */
  readonly markdownEscapes?: boolean;
}

function trimHorizontalWhitespace(text: string): string {
  return text.replace(/^[ \t]+|[ \t]+$/g, '');
}

function readBody(text: string, options: TokenQueryOptions): string {
  return options.markdownEscapes ? unescapePlaceholderBody(text) : text;
}

/** The length of the run of path characters at the start of `text`. */
function pathCharactersLength(text: string, options: TokenQueryOptions): number {
  if (!options.markdownEscapes) return PATH_CHARACTERS.exec(text)?.[0].length ?? 0;
  let index = 0;
  while (index < text.length) {
    const character = text[index]!;
    if (PATH_CHARACTER.test(character)) {
      index += 1;
      continue;
    }
    // An escaped path character (`\_`, `\.`) is part of the path.
    const escaped = unescapePlaceholderBody(text.slice(index, index + 2));
    if (character === '\\' && escaped.length === 1 && PATH_CHARACTER.test(escaped)) {
      index += 2;
      continue;
    }
    break;
  }
  return index;
}

/**
 * Locate the placeholder token being typed at `caret` among `tokens`, the
 * tokens scanned from `text`.
 *
 * The caret must sit after the opening delimiter and before any closing one.
 * The token ends at its closing delimiter when everything between the caret
 * and that delimiter is path characters (ignoring spaces and tabs).
 * Otherwise, and for an unclosed token, it ends after the path characters
 * that follow the caret, so prose after it is never replaced.
 */
export function locateTokenQuery(
  text: string,
  caret: number,
  tokens: readonly PlaceholderToken[],
  options: TokenQueryOptions = {},
): LocatedTokenQuery | null {
  const token = tokens.find((candidate) => {
    const bodyStart = candidate.startOffset + 2;
    const bodyEnd =
      candidate.kind === 'placeholder' ? candidate.endOffset - 2 : candidate.endOffset;
    return bodyStart <= caret && caret <= bodyEnd;
  });
  if (!token) return null;

  const query = readBody(text.slice(token.startOffset + 2, caret), options).trim();
  if (!VALID_QUERY_PATTERN.test(query)) return null;

  const closedPathBody =
    token.kind === 'placeholder' &&
    VALID_QUERY_PATTERN.test(
      trimHorizontalWhitespace(readBody(text.slice(caret, token.endOffset - 2), options)),
    );
  const to = closedPathBody
    ? token.endOffset
    : caret + pathCharactersLength(text.slice(caret), options);
  return { query, from: token.startOffset, to };
}

/**
 * Find the placeholder token being typed at the caret.
 *
 * The token must lie in one eligible same-mark run (see
 * `template-placeholder-runs.ts`) and the selection must be collapsed; the
 * range follows {@link locateTokenQuery}.
 */
export function detectTokenQuery(state: EditorState): DetectedTokenQuery | null {
  const found = findRunBeforeCaret(state);
  if (!found) return null;
  const { run, offset } = found;
  const located = locateTokenQuery(run.text, offset, parsePlaceholderTokens(run.text));
  if (!located) return null;
  return {
    query: located.query,
    tokenFrom: run.from + located.from,
    tokenTo: run.from + located.to,
    cursorPos: state.selection.from,
    marks: run.marks,
  };
}

function compareCodeUnits(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

/**
 * Every candidate whose path starts with `query`, ignoring case, sorted by
 * canonical path in code-unit order. Insertion and resolution stay
 * case-sensitive; only the filter ignores case.
 */
export function filterAndSortCandidates(
  candidates: readonly PlaceholderCandidate[],
  query: string,
): PlaceholderCandidate[] {
  const lowerQuery = query.toLowerCase();
  return candidates
    .filter((candidate) => candidate.path.toLowerCase().startsWith(lowerQuery))
    .toSorted((a, b) => compareCodeUnits(a.path, b.path));
}

export function mergeCandidates(
  staticCandidates: readonly PlaceholderCandidate[],
  asyncCandidates: readonly PlaceholderCandidate[],
): PlaceholderCandidate[] {
  const seen = new Set(staticCandidates.map((candidate) => candidate.path));
  const merged = [...staticCandidates];
  for (const candidate of asyncCandidates) {
    if (seen.has(candidate.path)) continue;
    seen.add(candidate.path);
    merged.push(candidate);
  }
  return merged;
}
