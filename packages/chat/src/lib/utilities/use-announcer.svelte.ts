/**
 * Screen reader announcement utility hook (DEP-83).
 *
 * Provides a consistent pattern for announcing messages to screen readers
 * via ARIA live regions. Handles:
 * - Debouncing to prevent announcement spam
 * - Auto-clearing to prevent re-announcement on re-render
 * - Cleanup on component destroy
 *
 * @example
 * ```svelte
 * <script>
 *   import { useAnnouncer } from '../utilities/use-announcer.svelte.ts';
 *
 *   const announcer = useAnnouncer();
 *
 *   function handleSave() {
 *     save();
 *     announcer.announce('Document saved');
 *   }
 * </script>
 *
 * <div aria-live="polite" aria-atomic="true" class="sr-only">
 *   {announcer.message}
 * </div>
 * ```
 */

/**
 * Create a screen reader announcer for use with ARIA live regions.
 *
 * The hook manages timing to ensure reliable screen reader announcements:
 * 1. Clears the message first (forces re-announcement even for same text)
 * 2. Sets the new message after a frame (ensures DOM change is detected)
 * 3. Auto-clears after clearDelay (prevents re-reading on re-render)
 *
 * @param options - Configuration for timing behavior
 * @returns An object with reactive `message` and `announce()` method
 *
 * @example Basic usage
 * ```svelte
 * <script>
 *   import { useAnnouncer } from '../utilities/use-announcer.svelte.ts';
 *
 *   const announcer = useAnnouncer();
 *
 *   function handleAction() {
 *     announcer.announce('Action completed');
 *   }
 * </script>
 *
 * <button onclick={handleAction}>Do Action</button>
 *
 * <div aria-live="polite" aria-atomic="true" class="sr-only">
 *   {announcer.message}
 * </div>
 * ```
 *
 * @example With debouncing (for frequent updates)
 * ```svelte
 * <script>
 *   import { useAnnouncer } from '../utilities/use-announcer.svelte.ts';
 *
 *   const announcer = useAnnouncer({ debounceMs: 300 });
 *
 *   // Multiple rapid calls will only announce once after 300ms
 *   function handleNewMessage() {
 *     announcer.announce('New message received');
 *   }
 * </script>
 * ```
 */
export function useAnnouncer(
  options?: import('./use-announcer.types.ts').AnnouncerOptions,
): import('./use-announcer.types.ts').Announcer {
  const { clearDelay = 1000, debounceMs = 0 } = options ?? {};

  let message = $state('');
  let debounceTimeout: ReturnType<typeof setTimeout> | null = null;
  let setMessageTimeout: ReturnType<typeof setTimeout> | null = null;
  let autoClearTimeout: ReturnType<typeof setTimeout> | null = null;

  /**
   * Set the message and schedule auto-clear.
   * Uses setTimeout(0) to ensure the DOM change is detected
   * by screen readers (clearing then setting triggers re-announcement).
   */
  function setMessage(text: string): void {
    // Cancel any pending set or clear
    if (setMessageTimeout) {
      globalThis.clearTimeout(setMessageTimeout);
      setMessageTimeout = null;
    }
    if (autoClearTimeout) {
      globalThis.clearTimeout(autoClearTimeout);
      autoClearTimeout = null;
    }

    // Clear first to force re-announcement (even for same text)
    message = '';

    // Set new message after a tick (allows DOM to reflect the cleared state)
    setMessageTimeout = globalThis.setTimeout(() => {
      setMessageTimeout = null;
      message = text;

      // Schedule auto-clear
      autoClearTimeout = globalThis.setTimeout(() => {
        message = '';
        autoClearTimeout = null;
      }, clearDelay);
    }, 0);
  }

  /**
   * Announce a message to screen readers.
   *
   * If debounceMs > 0, waits for that duration of inactivity before
   * announcing. This is useful when announcements may fire rapidly.
   */
  function announce(text: string): void {
    if (debounceMs > 0) {
      // Clear pending debounce
      if (debounceTimeout) {
        globalThis.clearTimeout(debounceTimeout);
      }

      debounceTimeout = globalThis.setTimeout(() => {
        debounceTimeout = null;
        setMessage(text);
      }, debounceMs);
    } else {
      setMessage(text);
    }
  }

  /**
   * Clear any pending announcement and reset the message.
   */
  function clear(): void {
    if (debounceTimeout) {
      globalThis.clearTimeout(debounceTimeout);
      debounceTimeout = null;
    }
    if (setMessageTimeout) {
      globalThis.clearTimeout(setMessageTimeout);
      setMessageTimeout = null;
    }
    if (autoClearTimeout) {
      globalThis.clearTimeout(autoClearTimeout);
      autoClearTimeout = null;
    }
    message = '';
  }

  // Cleanup on component destroy
  $effect(() => {
    return () => {
      if (debounceTimeout) {
        globalThis.clearTimeout(debounceTimeout);
        debounceTimeout = null;
      }
      if (setMessageTimeout) {
        globalThis.clearTimeout(setMessageTimeout);
        setMessageTimeout = null;
      }
      if (autoClearTimeout) {
        globalThis.clearTimeout(autoClearTimeout);
        autoClearTimeout = null;
      }
    };
  });

  /**
   * Cleanup all pending timeouts.
   * Note: This is also called automatically via $effect cleanup on component destroy.
   * Expose explicitly for cases where consumers need to clean up before unmount.
   */
  function destroy(): void {
    clear();
  }

  return {
    get message() {
      return message;
    },
    announce,
    clear,
    destroy,
  };
}
