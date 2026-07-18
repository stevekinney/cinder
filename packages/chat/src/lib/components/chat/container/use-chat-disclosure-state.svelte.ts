/**
 * Runes helper for tracking which per-message disclosures are expanded.
 *
 * Owns a set of expanded message ids and provides a toggle function. Used for
 * any collapsed-by-default disclosure that is keyed by message id and lives in
 * a virtualized transcript — reasoning blocks and tool-call cards both use one
 * instance each. When a virtualizer remeasure callback is registered
 * (optional), toggling fires it so the virtualizer can remeasure the row after
 * the disclosure opens/closes.
 */

/** Options for the disclosure state helper. */
export type UseChatDisclosureStateOptions = {
  /**
   * Optional callback to trigger a virtualizer remeasure for a specific message
   * row after the disclosure state changes. If the virtualizer is not wired
   * (e.g. in non-virtualized mode), pass `undefined` or omit — the toggle
   * still works, no remeasure fires.
   */
  onRemeasureRow?: ((messageId: string) => void) | undefined;
};

/** Return type for the disclosure state helper. */
export type UseChatDisclosureStateReturn = {
  /** Whether the disclosure for the given message id is expanded. */
  isExpanded: (messageId: string) => boolean;
  /**
   * Toggle the expanded state for the given message id. Also fires the
   * remeasure callback when wired (virtualizer support).
   */
  toggle: (messageId: string) => void;
  /**
   * Reset all expanded state to empty. Called on conversation change so stale
   * expanded disclosures from the previous conversation are cleared.
   */
  reset: () => void;
};

/**
 * Creates reactive state for per-message disclosure expansion.
 *
 * The returned `isExpanded` and `toggle` are stable references — safe to pass
 * as props without triggering extra re-renders.
 *
 * @example
 * ```svelte
 * <script lang="ts">
 *   import { useChatDisclosureState } from './use-chat-disclosure-state.svelte.ts';
 *
 *   const reasoningState = useChatDisclosureState({});
 * </script>
 *
 * <!-- in template: -->
 * <ReasoningPart
 *   {part}
 *   expanded={reasoningState.isExpanded(message.id)}
 *   ontoggle={() => reasoningState.toggle(message.id)}
 * />
 * ```
 */
export function useChatDisclosureState(
  options: UseChatDisclosureStateOptions,
): UseChatDisclosureStateReturn {
  const { onRemeasureRow } = options;

  // Set of message ids whose disclosures are currently expanded.
  // Collapsed by default (disclosures start closed).
  let expandedIds = $state(new Set<string>());

  function isExpanded(messageId: string): boolean {
    return expandedIds.has(messageId);
  }

  function toggle(messageId: string): void {
    const next = new Set(expandedIds);
    if (next.has(messageId)) {
      next.delete(messageId);
    } else {
      next.add(messageId);
    }
    expandedIds = next;
    // Notify the virtualizer so it can remeasure the row after the DOM
    // transitions to its new open/closed height. No-op when not wired.
    onRemeasureRow?.(messageId);
  }

  function reset(): void {
    expandedIds = new Set();
  }

  return {
    isExpanded,
    toggle,
    reset,
  };
}
