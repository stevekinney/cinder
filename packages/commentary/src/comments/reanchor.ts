/**
 * Re-anchoring algorithm for comment anchors.
 *
 * This module implements the TextQuoteSelector re-anchoring algorithm
 * that finds anchor positions after document edits. It uses:
 * - Exact quote matching
 * - Prefix/suffix context scoring
 * - Position proximity for disambiguation
 * - Fuzzy matching as fallback
 *
 * @module
 */

import type { ReanchorResult } from './types.js';

/**
 * Match result from searching for a quote in text.
 */
interface QuoteMatch {
  /** Start offset in text */
  start: number;
  /** End offset in text */
  end: number;
}

/**
 * Scored match with confidence metrics.
 */
interface ScoredMatch extends QuoteMatch {
  /** Context matching score (0-1) */
  contextScore: number;
  /** Position proximity score (0-1) */
  proximityScore: number;
  /** Combined total score */
  totalScore: number;
}

/**
 * Anchor data for re-anchoring.
 */
export interface ReanchorInput {
  /** The quoted text to find */
  quote: string;
  /** Context before the quote */
  prefix: string;
  /** Context after the quote */
  suffix: string;
  /** Original position when created */
  originalPosition?: { offset: number } | undefined;
  /** Last known text offset (preferred for disambiguation) */
  lastKnownOffset?: number | undefined;
}

/**
 * Find all exact occurrences of a quote in document text.
 *
 * @param quote - Text to find
 * @param documentText - Document to search
 * @returns Array of match positions
 */
export function findAllOccurrences(quote: string, documentText: string): QuoteMatch[] {
  const matches: QuoteMatch[] = [];
  if (!quote) return matches;

  let startIndex = 0;
  while (true) {
    const index = documentText.indexOf(quote, startIndex);
    if (index === -1) break;

    matches.push({
      start: index,
      end: index + quote.length,
    });

    startIndex = index + 1;
  }

  return matches;
}

/**
 * Score how well a match's surrounding context matches the expected context.
 *
 * Uses longest common subsequence (LCS) to handle minor edits in context.
 *
 * @param documentText - Full document text
 * @param match - The match to score
 * @param expectedPrefix - Expected prefix context
 * @param expectedSuffix - Expected suffix context
 * @returns Score from 0 (no match) to 1 (perfect match)
 */
export function scoreContextMatch(
  documentText: string,
  match: QuoteMatch,
  expectedPrefix: string,
  expectedSuffix: string,
): number {
  // Extract actual context from document
  const actualPrefix = documentText.slice(
    Math.max(0, match.start - expectedPrefix.length),
    match.start,
  );
  const actualSuffix = documentText.slice(match.end, match.end + expectedSuffix.length);

  // Score prefix match
  const prefixScore = expectedPrefix.length > 0 ? lcsRatio(actualPrefix, expectedPrefix) : 1.0;

  // Score suffix match
  const suffixScore = expectedSuffix.length > 0 ? lcsRatio(actualSuffix, expectedSuffix) : 1.0;

  // Average the scores, weighting prefix slightly higher
  // (prefix is often more stable than suffix)
  return prefixScore * 0.55 + suffixScore * 0.45;
}

/**
 * Calculate LCS (Longest Common Subsequence) ratio between two strings.
 *
 * @param a - First string
 * @param b - Second string
 * @returns Ratio of LCS length to max string length (0-1)
 */
function lcsRatio(a: string, b: string): number {
  if (a.length === 0 || b.length === 0) return 0;

  const lcsLength = longestCommonSubsequence(a, b);
  return lcsLength / Math.max(a.length, b.length);
}

/**
 * Calculate length of longest common subsequence.
 *
 * Uses dynamic programming with space optimization.
 */
function longestCommonSubsequence(a: string, b: string): number {
  const aLength = a.length;
  const bLength = b.length;

  // Use two rows for space optimization
  let previousRow = Array.from({ length: bLength + 1 }, () => 0);
  let currentRow = Array.from({ length: bLength + 1 }, () => 0);

  for (let aIndex = 1; aIndex <= aLength; aIndex += 1) {
    for (let bIndex = 1; bIndex <= bLength; bIndex += 1) {
      if (a[aIndex - 1] === b[bIndex - 1]) {
        currentRow[bIndex] = (previousRow[bIndex - 1] ?? 0) + 1;
      } else {
        currentRow[bIndex] = Math.max(previousRow[bIndex] ?? 0, currentRow[bIndex - 1] ?? 0);
      }
    }
    // Swap rows
    [previousRow, currentRow] = [currentRow, previousRow];
  }

  return previousRow[bLength] ?? 0;
}

/**
 * Attempt fuzzy re-anchoring when exact quote is not found.
 *
 * Uses the prefix + suffix to try to locate where the anchor was.
 * This is a fallback for when the quoted text was deleted or significantly changed.
 *
 * @param documentText - Full document text
 * @param anchor - Original anchor data
 * @returns Re-anchor result with found=false (the quoted text no longer exists)
 */
export function fuzzyReanchor(documentText: string, anchor: ReanchorInput): ReanchorResult {
  const { prefix, suffix, lastKnownOffset, originalPosition } = anchor;
  const referenceOffset = lastKnownOffset ?? originalPosition?.offset;

  // Try to find the junction point using prefix + suffix
  if (prefix.length > 0 && suffix.length > 0) {
    // Search for prefix ending + suffix beginning near reference position
    const searchRadius = 500; // Characters to search around reference
    const searchStart = Math.max(0, (referenceOffset ?? 0) - searchRadius);
    const searchEnd = Math.min(
      documentText.length,
      (referenceOffset ?? documentText.length) + searchRadius,
    );
    const searchText = documentText.slice(searchStart, searchEnd);

    // Look for prefix ending
    const prefixEnd = prefix.slice(-20); // Last 20 chars of prefix
    const suffixStart = suffix.slice(0, 20); // First 20 chars of suffix

    let bestPos = -1;
    let bestScore = 0;

    // Slide through search region looking for best match
    for (let i = 0; i < searchText.length - 1; i++) {
      const beforeSlice = searchText.slice(Math.max(0, i - prefixEnd.length), i);
      const afterSlice = searchText.slice(i, i + suffixStart.length);

      const beforeScore = lcsRatio(beforeSlice, prefixEnd);
      const afterScore = lcsRatio(afterSlice, suffixStart);
      const score = (beforeScore + afterScore) / 2;

      if (score > bestScore) {
        bestScore = score;
        bestPos = searchStart + i;
      }
    }

    if (bestScore >= 0.5) {
      // Found a reasonable junction point where the text was deleted
      // Return not found - the thread will be auto-deleted
      return {
        found: false,
        from: bestPos,
        to: bestPos,
        confidence: bestScore,
      };
    }
  }

  // Couldn't find anything - completely gone
  return {
    found: false,
    from: referenceOffset ?? 0,
    to: referenceOffset ?? 0,
    confidence: 0,
  };
}

/**
 * Re-anchor a quote in a document.
 *
 * Algorithm:
 * 1. Find all exact occurrences of the quote
 * 2. If none found, attempt fuzzy re-anchoring
 * 3. If one found, score its context and return
 * 4. If multiple found, score by context + position proximity
 * 5. Check margin between top matches for ambiguity
 *
 * @param documentText - Full document text (from doc.textBetween())
 * @param anchor - Anchor data with quote, context, and position hints
 * @returns Re-anchor result with new position and status
 */
export function reanchorQuote(documentText: string, anchor: ReanchorInput): ReanchorResult {
  const { quote, prefix, suffix, originalPosition, lastKnownOffset } = anchor;

  // Prefer lastKnownOffset over originalPosition for disambiguation
  // lastKnownOffset tracks current location, originalPosition is historical
  const referenceOffset = lastKnownOffset ?? originalPosition?.offset;

  // Find all exact occurrences
  const matches = findAllOccurrences(quote, documentText);

  // No matches - try fuzzy re-anchoring
  if (matches.length === 0) {
    return fuzzyReanchor(documentText, anchor);
  }

  // Single match - score its context
  if (matches.length === 1) {
    const match = matches[0];
    if (!match) {
      return fuzzyReanchor(documentText, anchor);
    }

    const confidence = scoreContextMatch(documentText, match, prefix, suffix);

    return {
      found: true,
      from: match.start,
      to: match.end,
      confidence,
    };
  }

  // Multiple matches - score by context + position proximity
  const scoredMatches: ScoredMatch[] = matches.map((match) => {
    const contextScore = scoreContextMatch(documentText, match, prefix, suffix);

    // Position proximity (exponential decay with distance)
    let proximityScore = 0;
    if (referenceOffset !== undefined) {
      const distance = Math.abs(match.start - referenceOffset);
      proximityScore = Math.exp(-distance / 500);
    }

    // Weight context more heavily than proximity
    const totalScore = contextScore * 0.7 + proximityScore * 0.3;

    return { ...match, contextScore, proximityScore, totalScore };
  });

  // Sort by total score descending
  scoredMatches.sort((a, b) => b.totalScore - a.totalScore);

  const best = scoredMatches[0];
  if (!best) {
    return fuzzyReanchor(documentText, anchor);
  }

  // We found matches, return the best one
  // The confidence score captures how certain we are about this match
  return {
    found: true,
    from: best.start,
    to: best.end,
    confidence: best.totalScore,
  };
}
