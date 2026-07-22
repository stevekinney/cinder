/**
 * DiffController with size-based gating (DEP-47).
 *
 * Manages diff computation strategy based on document size:
 * - <20KB: Real-time diff computation
 * - 20-100KB: Debounced (500ms) with warning badge
 * - >100KB: Manual trigger only, shows stale diff with "Outdated" badge
 *
 * This protects UI responsiveness for large documents while maintaining
 * full functionality for typical document sizes.
 */

import type { LineDiff } from '@lostgradient/cinder/markdown/diff/line-diff';
import { computeLineDiff } from '@lostgradient/cinder/markdown/diff/line-diff';
import { formatBytes } from '../../utilities/format-bytes.ts';

export type DiffTier = 'realtime' | 'debounced' | 'manual';

export interface DiffControllerOptions {
  /** Threshold for debounced mode (bytes). Default: 20000 (20KB) */
  debouncedThreshold?: number;
  /** Threshold for manual mode (bytes). Default: 100000 (100KB) */
  manualThreshold?: number;
  /** Debounce delay for medium documents (ms). Default: 500 */
  debounceMs?: number;
}

export interface DiffState {
  /** Current size tier */
  tier: DiffTier;
  /** Computed diffs (may be stale if tier is 'manual') */
  diffs: LineDiff[];
  /** Whether diff computation is in progress */
  isComputing: boolean;
  /** Time taken for last computation (ms) */
  lastComputeTime: number | null;
  /** Max document size (bytes) */
  documentSize: number;
  /** Warning message for user (null if no warning) */
  warning: string | null;
  /** Whether the current diffs are stale (for manual tier) */
  isStale: boolean;
}

export interface DiffController {
  /** Current diff state */
  readonly state: DiffState;
  /** Original/baseline content */
  original: string;
  /** Current/modified content */
  current: string;
  /** Set original/baseline content */
  setOriginal(value: string): void;
  /** Set current/modified content */
  setCurrent(value: string): void;
  /** Trigger manual diff computation (for >100KB tier) */
  triggerCompute(): void;
  /** Cleanup resources */
  destroy(): void;
}

const DEFAULT_OPTIONS: Required<DiffControllerOptions> = {
  debouncedThreshold: 20_000, // 20KB
  manualThreshold: 100_000, // 100KB
  debounceMs: 500,
};

/**
 * Create a diff controller with size-based gating.
 *
 * @example
 * ```svelte
 * <script>
 *   import { createDiffController } from './diff-controller.svelte';
 *
 *   const controller = createDiffController();
 *
 *   $effect(() => controller.setOriginal(normalizedOriginal));
 *   $effect(() => controller.setCurrent(normalizedCurrent));
 *
 *   const { state } = controller;
 * </script>
 *
 * {#if state.warning}
 *   <div class="warning">{state.warning}</div>
 * {/if}
 * ```
 */
export function createDiffController(options: DiffControllerOptions = {}): DiffController {
  const config = { ...DEFAULT_OPTIONS, ...options };

  // Internal state
  let original = $state('');
  let current = $state('');
  let diffs = $state<LineDiff[]>([]);
  let isComputing = $state(false);
  let lastComputeTime = $state<number | null>(null);
  let isStale = $state(false);

  // Tracks which version of inputs was computed for cancellation logic.
  // NOT reactive - this is internal bookkeeping only, and making it reactive
  // would create a cycle: effect reads computeVersion → writes computeVersion → effect re-runs.
  let computeVersion = 0;

  // Timeouts and async handles
  let computeTimeout: ReturnType<typeof setTimeout> | null = null;
  let idleCallbackHandle: number | null = null;
  let asyncComputeTimeout: ReturnType<typeof setTimeout> | null = null;

  // Derived values
  const documentSize = $derived(Math.max(original.length, current.length));

  const tier = $derived.by((): DiffTier => {
    if (documentSize >= config.manualThreshold) return 'manual';
    if (documentSize >= config.debouncedThreshold) return 'debounced';
    return 'realtime';
  });

  const warning = $derived.by((): string | null => {
    if (tier === 'manual') {
      return `Large document (${formatBytes(documentSize)}). Diff updates require manual trigger.`;
    }
    if (tier === 'debounced') {
      return `Medium document (${formatBytes(documentSize)}). Diff updates are debounced.`;
    }
    return null;
  });

  /**
   * Perform diff computation.
   * Uses requestIdleCallback for large docs to avoid blocking UI.
   *
   * @param orig - Original/baseline content to diff against
   * @param curr - Current/modified content to diff
   * @param size - Document size in bytes (for scheduling strategy)
   */
  function performCompute(orig: string, curr: string, size: number): void {
    const version = ++computeVersion;

    isComputing = true;

    const doCompute = () => {
      // Bail if inputs changed while waiting.
      // Check both version (to detect concurrent performCompute calls) and actual content
      // (to detect content changes that didn't trigger performCompute, e.g., in manual tier
      // where scheduleCompute only sets isStale without calling performCompute).
      if (computeVersion !== version || original !== orig || current !== curr) {
        // Only clear isComputing if we're still the current version.
        // If a newer computation has started (computeVersion !== version), it has already
        // set isComputing = true, and we shouldn't clear it.
        if (computeVersion === version) {
          isComputing = false;
        }
        return;
      }

      const start = performance.now();
      try {
        diffs = computeLineDiff(orig, curr);
        lastComputeTime = performance.now() - start;
        // Only clear stale if content still matches what we computed.
        // This prevents a race where content changes between compute start and end.
        if (original === orig && current === curr) {
          isStale = false;
        }
      } catch (error) {
        console.error('Diff computation failed:', error);
        diffs = [];
        lastComputeTime = null;
      } finally {
        isComputing = false;
      }
    };

    // Cancel any pending async computation before scheduling new one
    if (idleCallbackHandle !== null && typeof cancelIdleCallback !== 'undefined') {
      cancelIdleCallback(idleCallbackHandle);
      idleCallbackHandle = null;
    }
    if (asyncComputeTimeout !== null) {
      clearTimeout(asyncComputeTimeout);
      asyncComputeTimeout = null;
    }

    // Use requestIdleCallback for 50KB+ to avoid blocking main thread
    if (size > 50_000 && typeof requestIdleCallback !== 'undefined') {
      idleCallbackHandle = requestIdleCallback(doCompute, { timeout: 2000 });
    } else if (size > 50_000) {
      // Safari fallback - use setTimeout to yield to browser
      asyncComputeTimeout = setTimeout(doCompute, 10);
    } else {
      doCompute();
    }
  }

  /**
   * Schedule diff computation based on tier.
   *
   * @param orig - Original/baseline content
   * @param curr - Current/modified content
   */
  function scheduleCompute(orig: string, curr: string): void {
    // Clear any pending computation
    if (computeTimeout) {
      clearTimeout(computeTimeout);
      computeTimeout = null;
    }

    // Compute tier locally from passed arguments to avoid reading derived state
    const size = Math.max(orig.length, curr.length);
    const currentTier: DiffTier =
      size >= config.manualThreshold
        ? 'manual'
        : size >= config.debouncedThreshold
          ? 'debounced'
          : 'realtime';

    if (currentTier === 'manual') {
      // For manual tier, mark as stale to show "Outdated" badge.
      // This indicates computation is needed, whether or not we have existing diffs.
      // Users see the badge + "Compute Diff" button to understand action is required.
      isStale = true;
      return;
    }

    if (currentTier === 'debounced') {
      // Debounce for medium documents
      isStale = true; // Show as stale during debounce
      computeTimeout = setTimeout(() => {
        performCompute(orig, curr, size);
      }, config.debounceMs);
      return;
    }

    // Real-time for small documents
    performCompute(orig, curr, size);
  }

  // Watch for content changes and schedule diff computation.
  // Dependencies are explicit via function arguments - Svelte tracks `original` and `current`
  // because they're read to be passed as arguments.
  $effect(() => {
    scheduleCompute(original, current);

    return () => {
      if (computeTimeout) {
        clearTimeout(computeTimeout);
        computeTimeout = null;
      }
      if (idleCallbackHandle !== null && typeof cancelIdleCallback !== 'undefined') {
        cancelIdleCallback(idleCallbackHandle);
        idleCallbackHandle = null;
      }
      if (asyncComputeTimeout !== null) {
        clearTimeout(asyncComputeTimeout);
        asyncComputeTimeout = null;
      }
    };
  });

  return {
    get state(): DiffState {
      return {
        tier,
        diffs,
        isComputing,
        lastComputeTime,
        documentSize,
        warning,
        isStale,
      };
    },
    get original(): string {
      return original;
    },
    set original(value: string) {
      original = value;
    },
    get current(): string {
      return current;
    },
    set current(value: string) {
      current = value;
    },
    setOriginal(value: string) {
      original = value;
    },
    setCurrent(value: string) {
      current = value;
    },
    triggerCompute() {
      // Don't set isStale = false here - for large docs (>50KB), performCompute
      // schedules async work via requestIdleCallback/setTimeout. If content changes
      // before the callback runs, we'd incorrectly show the diff as up-to-date.
      // Instead, doCompute() sets isStale = false after verifying content matches.
      const size = Math.max(original.length, current.length);
      performCompute(original, current, size);
    },
    destroy() {
      if (computeTimeout) {
        clearTimeout(computeTimeout);
        computeTimeout = null;
      }
      if (idleCallbackHandle !== null && typeof cancelIdleCallback !== 'undefined') {
        cancelIdleCallback(idleCallbackHandle);
        idleCallbackHandle = null;
      }
      if (asyncComputeTimeout !== null) {
        clearTimeout(asyncComputeTimeout);
        asyncComputeTimeout = null;
      }
    },
  };
}
