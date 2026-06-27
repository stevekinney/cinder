/**
 * Change tracker with lazy dirty flag and debounced verification (DEP-47).
 *
 * Uses three-tier detection:
 * 1. Fast: Identical string check (O(1) for same reference, O(n) for comparison)
 * 2. Lightweight: Length + hash check (O(n), no parsing)
 * 3. Semantic: Full normalization (debounced, only when hash differs)
 *
 * This avoids per-keystroke normalize() calls which are expensive for large documents.
 */

import {
  contentEquals,
  contentEqualsWithFrontMatter,
} from '@lostgradient/cinder/markdown/pipeline';

import type { ChangeTracker, ChangeTrackerOptions } from './change-tracker.types.ts';

/**
 * Fast non-cryptographic hash for change detection.
 * Uses djb2 algorithm - fast and good distribution.
 */
function simpleHash(str: string): number {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) ^ str.charCodeAt(i);
  }
  return hash >>> 0;
}

/**
 * Create a change tracker for comparing baseline vs current content.
 *
 * @example
 * ```svelte
 * <script>
 *   import { createChangeTracker } from '../../utilities/change-tracker.svelte.ts';
 *
 *   const tracker = createChangeTracker({ debounceMs: 300 });
 *
 *   $effect(() => tracker.setBaseline(original));
 *   $effect(() => tracker.setCurrent(value));
 *
 *   const hasChanges = $derived(tracker.hasChanges);
 * </script>
 * ```
 */
export function createChangeTracker(options: ChangeTrackerOptions = {}): ChangeTracker {
  const { debounceMs = 300, includeFrontMatter = false } = options;

  // Internal state
  let baseline = $state('');
  let current = $state('');
  let baselineHash = $state<number>(0);
  let currentHash = $state<number>(0);
  let isPending = $state(false);
  let semanticResult = $state<boolean | null>(null);
  let verifyTimeout: ReturnType<typeof setTimeout> | null = null;

  // Fast dirty check (synchronous, cheap)
  const isDirtyFast = $derived.by(() => {
    // Identical reference or content
    if (baseline === current) return false;
    // Length mismatch is definitely dirty
    if (baseline.length !== current.length) return true;
    // Hash mismatch is likely dirty (verify async)
    return currentHash !== baselineHash;
  });

  // Combined result: fast check OR pending verification result
  const hasChanges = $derived.by(() => {
    // Fast path: identical content
    if (!isDirtyFast) return false;
    // Use verified result if available
    if (semanticResult !== null) return semanticResult;
    // Assume dirty until verified (optimistic indicator)
    return true;
  });

  /**
   * Perform semantic verification using full normalization.
   */
  function doSemanticVerification(): void {
    const equals = includeFrontMatter
      ? contentEqualsWithFrontMatter(baseline, current)
      : contentEquals(baseline, current);
    semanticResult = !equals;
    isPending = false;
  }

  /**
   * Schedule debounced semantic verification.
   *
   * @param base - Baseline content to compare against
   * @param curr - Current content to compare
   * @param baseHash - Pre-computed hash of baseline
   * @param currHash - Pre-computed hash of current
   */
  function scheduleVerification(
    base: string,
    curr: string,
    baseHash: number,
    currHash: number,
  ): void {
    // Clear pending verification
    if (verifyTimeout) {
      clearTimeout(verifyTimeout);
      verifyTimeout = null;
    }

    // Reset semantic result when content changes
    semanticResult = null;

    // Skip if fast check says clean (identical strings)
    if (base === curr) {
      isPending = false;
      return;
    }

    // Skip verification if hash matches (likely no semantic change)
    if (baseHash === currHash && base.length === curr.length) {
      // Hash collision possible but rare - verify anyway after short delay
      isPending = true;
      verifyTimeout = setTimeout(doSemanticVerification, debounceMs);
      return;
    }

    // Schedule semantic verification
    isPending = true;
    verifyTimeout = setTimeout(doSemanticVerification, debounceMs);
  }

  // Watch for content changes and schedule verification.
  // Dependencies are explicit via function arguments - Svelte tracks all four values
  // because they're read to be passed as arguments.
  $effect(() => {
    scheduleVerification(baseline, current, baselineHash, currentHash);

    return () => {
      if (verifyTimeout) {
        clearTimeout(verifyTimeout);
        verifyTimeout = null;
      }
    };
  });

  return {
    get hasChanges() {
      return hasChanges;
    },
    get isPending() {
      return isPending;
    },
    setBaseline(value: string) {
      baseline = value;
      baselineHash = simpleHash(value);
      semanticResult = null;
    },
    setCurrent(value: string) {
      current = value;
      currentHash = simpleHash(value);
      // Reset semantic result immediately to prevent stale values from being used
      // before the $effect runs. Without this, hasChanges could briefly return
      // the previous verification result when content changes.
      semanticResult = null;
    },
    verifyNow(): boolean {
      if (verifyTimeout) {
        clearTimeout(verifyTimeout);
        verifyTimeout = null;
      }
      if (baseline === current) {
        isPending = false;
        semanticResult = false;
        return false;
      }
      doSemanticVerification();
      return semanticResult ?? false;
    },
    destroy() {
      if (verifyTimeout) {
        clearTimeout(verifyTimeout);
        verifyTimeout = null;
      }
    },
  };
}
