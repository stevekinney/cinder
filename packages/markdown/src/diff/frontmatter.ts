/**
 * Front matter diff computation.
 *
 * DEP-61: Front matter (YAML) parsing and editing support
 *
 * This module extends the diff engine to handle front matter changes
 * separately from body changes, displaying them in a dedicated group.
 *
 * @module
 */

import { parseFrontMatter } from '../pipeline/index.js';
import { computeDiff, computeStats, groupChangesByBlock } from './compute.js';
import type { Change, ChangeGroup, DiffResult } from './types.js';

/**
 * Special block index for front matter changes.
 * Uses -1 to ensure it always appears before body blocks (which start at 0).
 */
export const FRONTMATTER_BLOCK_INDEX = -1;

/**
 * Block type identifier for front matter changes.
 */
export const FRONTMATTER_BLOCK_TYPE = 'frontmatter';

function stripSingleLeadingLineBreak(value: string): string {
  if (value.startsWith('\r\n')) {
    return value.slice(2);
  }
  if (value.startsWith('\n') || value.startsWith('\r')) {
    return value.slice(1);
  }
  return value;
}

function normalizeParsedBodyForDiff(body: string, hasFrontMatter: boolean): string {
  return hasFrontMatter ? stripSingleLeadingLineBreak(body) : body;
}

/**
 * Extended diff result that includes front matter changes.
 */
export interface DiffWithFrontMatterResult extends DiffResult {
  /** Whether front matter changed */
  hasFrontMatterChanges: boolean;
  /** Front matter changes group (if any) */
  frontMatterGroup: ChangeGroup | null;
  /** Body-only groups (excludes front matter) */
  bodyGroups: ChangeGroup[];
}

/**
 * Compute word-level diff with front matter awareness.
 *
 * Separates front matter from body content and computes diffs for each.
 * Front matter changes are placed in a dedicated group with blockIndex -1.
 *
 * @param original - The baseline text (may include front matter)
 * @param current - The current/modified text (may include front matter)
 * @returns Extended diff result with front matter changes in a separate group
 *
 * @example
 * ```ts
 * const result = computeDiffWithFrontMatter(
 *   '---\ntitle: Old\n---\n\n# Content',
 *   '---\ntitle: New\n---\n\n# Content'
 * );
 *
 * console.log(result.hasFrontMatterChanges); // true
 * console.log(result.frontMatterGroup);      // ChangeGroup with title change
 * console.log(result.bodyGroups);            // [] (body unchanged)
 * ```
 */
export function computeDiffWithFrontMatter(
  original: string,
  current: string,
): DiffWithFrontMatterResult {
  const startTime = performance.now();

  // Parse front matter from both documents
  const originalParsed = parseFrontMatter(original);
  const currentParsed = parseFrontMatter(current);

  // Compute front matter diff if either document has front matter
  let frontMatterChanges: Change[] = [];
  let frontMatterGroup: ChangeGroup | null = null;

  const hasFrontMatter = originalParsed.hasFrontMatter || currentParsed.hasFrontMatter;

  if (hasFrontMatter) {
    // Get raw YAML strings for diffing (with delimiters for context)
    const originalFrontMatterText = originalParsed.hasFrontMatter
      ? `---\n${originalParsed.raw || ''}\n---`
      : '';
    const currentFrontMatterText = currentParsed.hasFrontMatter
      ? `---\n${currentParsed.raw || ''}\n---`
      : '';

    // Diff the front matter sections
    if (originalFrontMatterText !== currentFrontMatterText) {
      const fmDiff = computeDiff(originalFrontMatterText, currentFrontMatterText);

      // Tag all front matter changes with special block info
      frontMatterChanges = fmDiff.changes.map((change) => ({
        ...change,
        id: `fm-${change.id}`, // Prefix to avoid ID collisions
        blockIndex: FRONTMATTER_BLOCK_INDEX,
        blockType: FRONTMATTER_BLOCK_TYPE,
      }));

      if (frontMatterChanges.length > 0) {
        frontMatterGroup = {
          blockIndex: FRONTMATTER_BLOCK_INDEX,
          blockType: FRONTMATTER_BLOCK_TYPE,
          changes: frontMatterChanges,
        };
      }
    }
  }

  const originalBodyForDiff = normalizeParsedBodyForDiff(
    originalParsed.body,
    originalParsed.hasFrontMatter,
  );
  const currentBodyForDiff = normalizeParsedBodyForDiff(
    currentParsed.body,
    currentParsed.hasFrontMatter,
  );

  // Compute body diff
  const bodyDiff = computeDiff(originalBodyForDiff, currentBodyForDiff);

  // Combine all changes
  const allChanges = [...frontMatterChanges, ...bodyDiff.changes];

  // Build groups: front matter first, then body groups
  const bodyGroups = groupChangesByBlock(bodyDiff.changes);
  const allGroups = frontMatterGroup ? [frontMatterGroup, ...bodyGroups] : bodyGroups;

  // Compute combined stats
  const stats = computeStats(allChanges);

  return {
    changes: allChanges,
    groups: allGroups,
    stats,
    meta: {
      computeTimeMs: performance.now() - startTime,
      originalSize: original.length,
      currentSize: current.length,
      usedWorker: false,
    },
    hasFrontMatterChanges: frontMatterChanges.length > 0,
    frontMatterGroup,
    bodyGroups,
  };
}

/**
 * Check if a change is a front matter change.
 */
export function isFrontMatterChange(change: Change): boolean {
  return change.blockType === FRONTMATTER_BLOCK_TYPE;
}

/**
 * Extract front matter changes from a list of changes.
 */
export function getFrontMatterChanges(changes: Change[]): Change[] {
  return changes.filter(isFrontMatterChange);
}

/**
 * Extract body changes (excluding front matter) from a list of changes.
 */
export function getBodyChanges(changes: Change[]): Change[] {
  return changes.filter((change) => !isFrontMatterChange(change));
}
