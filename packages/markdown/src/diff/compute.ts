/**
 * Core diff computation using diff-match-patch.
 *
 * This module provides word-level diffing with semantic cleanup.
 * The algorithm:
 * 1. Tokenizes input into words (preserving whitespace boundaries)
 * 2. Runs diff-match-patch on the tokens
 * 3. Applies semantic cleanup to merge small edits
 * 4. Merges consecutive DELETE+INSERT into REPLACEMENT
 */

import DiffMatchPatch from 'diff-match-patch';
import type { Change, ChangeGroup, DiffResult, DiffStats, TextRange } from './types.js';

const dmp = new DiffMatchPatch();

// diff-match-patch operation constants
const DIFF_DELETE = -1;
const DIFF_INSERT = 1;
const DIFF_EQUAL = 0;

function decodeTokens(chars: string, tokenArray: string[]): string {
  return chars
    .split('')
    .map((character) => tokenArray[character.charCodeAt(0)] ?? '')
    .join('');
}

interface TokenizedText {
  chars1: string;
  chars2: string;
  tokenArray: string[];
}

/**
 * Compute word-level diff between two strings.
 * Pure function, no side effects.
 *
 * @param original - The baseline text
 * @param current - The current/modified text
 * @returns Complete diff result with changes, groups, and stats
 */
export function computeDiff(original: string, current: string): DiffResult {
  const startTime = performance.now();

  // Fast path: identical strings
  if (original === current) {
    return createEmptyResult(original, current, startTime);
  }

  // 1. Tokenize to words (preserves whitespace boundaries)
  const tokenizedText = wordsToChars(original, current);
  const decode = tokenizedText
    ? (chars: string) => decodeTokens(chars, tokenizedText.tokenArray)
    : (text: string) => text;

  if (!tokenizedText) {
    console.warn(
      `Diff token limit (${MAX_TOKENS}) exceeded. Falling back to character-level diff for this document.`,
    );
  }

  // 2. Diff the word tokens, or the original text if tokenization overflowed
  const diffs = tokenizedText
    ? dmp.diff_main(tokenizedText.chars1, tokenizedText.chars2)
    : dmp.diff_main(original, current);

  // 3. Semantic cleanup (merge small edits)
  dmp.diff_cleanupSemantic(diffs);

  // 4. Convert back to text and build Change objects
  const changes = diffsToChanges(diffs, decode);

  // 5. Group by block (initial grouping - will be enriched with positions later)
  const groups = groupChangesByBlock(changes);

  // 6. Compute stats
  const stats = computeStats(changes);

  return {
    changes,
    groups,
    stats,
    meta: {
      computeTimeMs: performance.now() - startTime,
      originalSize: original.length,
      currentSize: current.length,
      usedWorker: false,
    },
  };
}

/**
 * Convert words to single characters for diff-match-patch.
 * Similar to diff_linesToChars but operates on word boundaries.
 *
 * This approach lets diff-match-patch work at word granularity
 * while still using its optimized string diffing algorithms.
 */
// Keep generated token code units below the UTF-16 surrogate range.
const MAX_TOKENS = 40_000;

function wordsToChars(text1: string, text2: string): TokenizedText | null {
  const tokenArray: string[] = ['']; // Index 0 unused (char code 0 is problematic)
  const tokenHash = new Map<string, number>();

  function encode(text: string): string | null {
    // Split on word boundaries, keeping whitespace as separate tokens
    const tokens = text.match(/\S+|\s+/g) || [];
    let encoded = '';

    for (const token of tokens) {
      let index = tokenHash.get(token);
      if (index === undefined) {
        index = tokenArray.length;
        if (index >= MAX_TOKENS) return null;

        tokenArray.push(token);
        tokenHash.set(token, index);
      }

      encoded += String.fromCharCode(index);
    }

    return encoded;
  }

  const chars1 = encode(text1);
  if (chars1 === null) return null;

  const chars2 = encode(text2);
  if (chars2 === null) return null;

  return {
    chars1,
    chars2,
    tokenArray,
  };
}

/**
 * Convert diff-match-patch output to Change objects.
 * Merges consecutive DELETE+INSERT into REPLACEMENT.
 */
function diffsToChanges(diffs: [number, string][], decode: (text: string) => string): Change[] {
  const changes: Change[] = [];
  let originalOffset = 0;
  let currentOffset = 0;
  let changeId = 0;

  for (let i = 0; i < diffs.length; i++) {
    const diff = diffs[i];
    if (diff === undefined) continue;

    const [op, chars] = diff;
    // Decode char codes back to original tokens
    const text = decode(chars);

    if (op === DIFF_EQUAL) {
      // EQUAL - advance both pointers
      originalOffset += text.length;
      currentOffset += text.length;
    } else if (op === DIFF_DELETE) {
      // DELETE - check if next is INSERT (replacement)
      const next = diffs[i + 1];
      if (next && next[0] === DIFF_INSERT) {
        // Merge into replacement
        const insertText = decode(next[1]);

        changes.push(
          createChange(changeId++, 'replacement', text, insertText, originalOffset, currentOffset),
        );

        originalOffset += text.length;
        currentOffset += insertText.length;
        i++; // Skip the INSERT we just consumed
      } else {
        // Pure deletion
        changes.push(createChange(changeId++, 'deletion', text, '', originalOffset, null));
        originalOffset += text.length;
      }
    } else if (op === DIFF_INSERT) {
      // INSERT (not part of a replacement - those are handled above)
      changes.push(createChange(changeId++, 'insertion', '', text, null, currentOffset));
      currentOffset += text.length;
    }
  }

  return changes;
}

/**
 * Helper to create a Change object with consistent structure.
 */
function createChange(
  id: number,
  type: 'insertion' | 'deletion' | 'replacement',
  originalText: string,
  currentText: string,
  originalStart: number | null,
  currentStart: number | null,
): Change {
  const originalRange: TextRange | null =
    originalStart !== null
      ? { start: originalStart, end: originalStart + originalText.length }
      : null;

  const currentRange: TextRange | null =
    currentStart !== null ? { start: currentStart, end: currentStart + currentText.length } : null;

  return {
    id: `change-${id}`,
    type,
    originalText,
    currentText,
    originalRange,
    currentRange,
    sourcePosition: null, // Filled by position mapping
    blockIndex: 0, // Filled by position mapping
    blockType: 'unknown', // Filled by position mapping
  };
}

/**
 * Group changes by block index.
 */
export function groupChangesByBlock(changes: Change[]): ChangeGroup[] {
  const groups = new Map<number, Change[]>();

  for (const change of changes) {
    const existing = groups.get(change.blockIndex) ?? [];
    existing.push(change);
    groups.set(change.blockIndex, existing);
  }

  return Array.from(groups.entries())
    .toSorted(([a], [b]) => a - b)
    .map(([blockIndex, blockChanges]) => ({
      blockIndex,
      blockType: blockChanges[0]?.blockType ?? 'unknown',
      changes: blockChanges,
    }));
}

/**
 * Compute statistics from changes.
 */
export function computeStats(changes: Change[]): DiffStats {
  let insertions = 0;
  let deletions = 0;
  let replacements = 0;
  let wordsAdded = 0;
  let wordsRemoved = 0;

  for (const change of changes) {
    switch (change.type) {
      case 'insertion':
        insertions++;
        wordsAdded += countWords(change.currentText);
        break;
      case 'deletion':
        deletions++;
        wordsRemoved += countWords(change.originalText);
        break;
      case 'replacement':
        replacements++;
        wordsAdded += countWords(change.currentText);
        wordsRemoved += countWords(change.originalText);
        break;
    }
  }

  return { insertions, deletions, replacements, wordsAdded, wordsRemoved };
}

/**
 * Count words in text (non-whitespace sequences).
 */
function countWords(text: string): number {
  const words = text.match(/\S+/g);
  return words?.length ?? 0;
}

/**
 * Create an empty diff result for identical inputs.
 */
function createEmptyResult(original: string, current: string, startTime: number): DiffResult {
  return {
    changes: [],
    groups: [],
    stats: {
      insertions: 0,
      deletions: 0,
      replacements: 0,
      wordsAdded: 0,
      wordsRemoved: 0,
    },
    meta: {
      computeTimeMs: performance.now() - startTime,
      originalSize: original.length,
      currentSize: current.length,
      usedWorker: false,
    },
  };
}
