<script lang="ts" module>
  /**
   * LiveRegion component for screen reader announcements (DEP-47).
   *
   * This component provides accessible announcements for the ReviewEditor.
   * It uses an ARIA live region to communicate state changes to screen readers.
   *
   * Verbosity level: Standard (actions + navigation)
   * - Comment CRUD operations
   * - Thread state changes (resolved/reopened)
   * - Suggestion accept/reject
   * - Focus region changes
   * - Popover open/close
   */

  export type AnnouncementPriority = 'polite' | 'assertive';

  export type LiveRegionProps = {
    /** Optional CSS class */
    class?: string;
  };
</script>

<script lang="ts">
  import { classNames } from '../../utilities/class-names.ts';

  let { class: className }: LiveRegionProps = $props();

  // Current message to announce
  let message = $state('');
  let priority = $state<AnnouncementPriority>('polite');
  let clearTimeoutId: ReturnType<typeof setTimeout> | null = null;

  /**
   * Version counter for invalidating stale async callbacks.
   *
   * Each announce() call increments this counter. Microtasks and timeouts
   * capture the version at schedule time and check it before updating state.
   * This prevents orphaned callbacks from clearing messages prematurely when
   * announce() is called multiple times in rapid succession.
   */
  let announceVersion = 0;

  /**
   * Track component destruction to prevent state updates after unmount.
   *
   * All async operations (queueMicrotask, setTimeout) check this flag before
   * updating state. The $effect cleanup also clears pending timeouts as a
   * belt-and-suspenders approach.
   */
  let isDestroyed = false;

  // Cleanup on component destruction: clear pending timeout and set flag
  $effect(() => {
    return () => {
      isDestroyed = true;
      if (clearTimeoutId) {
        clearTimeout(clearTimeoutId);
        clearTimeoutId = null;
      }
    };
  });

  /**
   * Announce a message to screen readers.
   *
   * @param text - The message to announce
   * @param announcePriority - 'polite' (default) waits for current speech to finish,
   *                          'assertive' interrupts immediately
   */
  export function announce(text: string, announcePriority: AnnouncementPriority = 'polite'): void {
    // Prevent announcements after component destruction
    if (isDestroyed) return;

    // Increment version to invalidate any pending microtasks/timeouts from previous calls
    const version = ++announceVersion;

    // Clear any pending timeout
    if (clearTimeoutId) {
      clearTimeout(clearTimeoutId);
      clearTimeoutId = null;
    }

    // Force re-announcement by clearing first (needed for repeated messages)
    message = '';
    priority = announcePriority;

    // Use microtask to ensure DOM updates between clear and set
    queueMicrotask(() => {
      // Guard against destruction or superseded calls during microtask
      if (isDestroyed || announceVersion !== version) return;

      message = text;

      // Clear after announcement (1s is enough for most screen readers)
      clearTimeoutId = setTimeout(() => {
        // Guard against destruction or superseded calls during timeout
        if (isDestroyed || announceVersion !== version) return;

        message = '';
        clearTimeoutId = null;
      }, 1000);
    });
  }
</script>

<!--
  Using two regions: one for polite, one for assertive.
  This ensures the correct aria-live value is always used.
  The visually hidden class ensures screen readers can access it.
-->
{#if priority === 'polite'}
  <div role="status" aria-live="polite" aria-atomic="true" class={classNames('sr-only', className)}>
    {message}
  </div>
{:else}
  <div
    role="alert"
    aria-live="assertive"
    aria-atomic="true"
    class={classNames('sr-only', className)}
  >
    {message}
  </div>
{/if}
