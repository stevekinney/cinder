/**
 * Shared copy-confirmation state machine.
 *
 * Encapsulates the same copy/confirmation/timeout pattern that CopyButton owns,
 * for use in contexts where CopyButton itself cannot be used directly — for
 * example, when each item in a dropdown menu needs its own per-item confirmation
 * indicator (ConversationExportActions, ReviewEditor ExportActions).
 *
 * The returned object is reactive. Read `copied` and `copiedKey` inside a
 * template expression or `$derived` to track state. Call `trigger(key, text)`
 * to copy text and set the confirmation for `key`. Call `reset()` to clear early.
 *
 * Timer cleanup is automatic: call `destroy()` (or use the returned cleanup
 * function from `$effect`) when the containing component unmounts.
 *
 * @example
 * ```ts
 * const copyState = createCopyState();
 * $effect(() => copyState.destroy);
 *
 * // In a handler:
 * await copyState.trigger('json', JSON.stringify(data));
 *
 * // In template:
 * {#if copyState.copiedKey === 'json'}...{/if}
 * ```
 */

import { onDestroy } from 'svelte';
import { copyToClipboard } from '../../utilities/clipboard.ts';

export interface CopyState<TKey extends string = string> {
  /** The key of the item currently in the confirmed state, or null if none. */
  readonly copiedKey: TKey | null;
  /**
   * Copy `text` to the clipboard and set the confirmed state for `key`.
   * Returns true if the copy succeeded.
   */
  trigger(key: TKey, text: string): Promise<boolean>;
  /** Cancel any pending reset timer and clear the confirmed state immediately. */
  reset(): void;
  /**
   * Cancel any pending timer. Call from `onDestroy` or an `$effect` cleanup to
   * prevent the reset callback from firing against a destroyed component.
   */
  destroy(): void;
}

/**
 * Create a reactive per-item copy confirmation state machine.
 *
 * @param confirmDuration - Duration in ms to show the confirmed state. Default 2000.
 */
export function createCopyState<TKey extends string = string>(
  confirmDuration: number = 2000,
): CopyState<TKey> {
  let copiedKey = $state<TKey | null>(null);
  let resetTimer: ReturnType<typeof setTimeout> | undefined;

  function clearTimer(): void {
    if (resetTimer !== undefined) {
      clearTimeout(resetTimer);
      resetTimer = undefined;
    }
  }

  function reset(): void {
    clearTimer();
    copiedKey = null;
  }

  async function trigger(key: TKey, text: string): Promise<boolean> {
    const succeeded = await copyToClipboard(text);
    if (!succeeded) return false;
    clearTimer();
    copiedKey = key;
    resetTimer = setTimeout(() => {
      copiedKey = null;
    }, confirmDuration);
    return true;
  }

  onDestroy(clearTimer);

  return {
    get copiedKey() {
      return copiedKey;
    },
    trigger,
    reset,
    destroy: clearTimer,
  };
}
