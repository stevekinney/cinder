<script lang="ts" module>
  /**
   * Internal shared visually-hidden ARIA live region.
   *
   * The single canonical way for a Cinder component to announce a transient
   * status string to screen readers. It renders a visually-hidden `role="status"`
   * (polite) or `role="alert"` (assertive) region — both `aria-atomic="true"` so
   * the full message is read on every change — and owns the clear-then-set timing
   * that makes a *repeated* identical message re-announce.
   *
   * Not a public component (no `@cinder` block, not in the manifest): it is an
   * implementation detail consumed by components that need announcements
   * (toast-region, autocomplete, load-more, copy-button, charts, …). See
   * `_internal/PLATFORM-POLICY.md` § Live regions.
   *
   * Usage — feed it a reactive `message` and an optional `priority`; it handles
   * the announce timing. The consumer keeps the message in `$state` and passes it
   * as a prop: `<VisuallyHiddenLiveRegion message={status} />` (default polite) or
   * `priority="assertive"` for interrupting announcements.
   *
   * The clear-then-set dance: a screen reader only announces a live region when
   * its text content *changes*. Setting the same string twice (e.g. "Copied" after
   * a previous "Copied") is a no-op to the AT. So on every `message` change we
   * blank the region, then set the new text on the next microtask, guaranteeing a
   * content change the AT will pick up. A version counter discards stale timers
   * when messages arrive faster than the clear delay.
   */
  export type LiveRegionPriority = 'polite' | 'assertive';
</script>

<script lang="ts">
  import { classNames } from '../utilities/class-names.ts';

  let {
    message = '',
    priority = 'polite',
    /** ms the message stays in the region before auto-clearing (long enough for AT to read it). */
    clearDelay = 1000,
    class: className,
  }: {
    message?: string;
    priority?: LiveRegionPriority;
    clearDelay?: number;
    class?: string;
  } = $props();

  // The text actually rendered into the region. Decoupled from the `message`
  // prop so we can blank-then-set to force re-announcement of repeats.
  let rendered = $state('');
  let clearTimeoutId: ReturnType<typeof setTimeout> | null = null;
  // Bumped per message change; async callbacks capture it and bail if superseded.
  let version = 0;
  let isDestroyed = false;

  $effect(() => {
    return () => {
      isDestroyed = true;
      if (clearTimeoutId) {
        clearTimeout(clearTimeoutId);
        clearTimeoutId = null;
      }
    };
  });

  // React to `message` changes: blank the region, then set the new text on the
  // next microtask so a repeated identical string still triggers an announcement.
  $effect(() => {
    const next = message;
    const current = ++version;

    if (clearTimeoutId) {
      clearTimeout(clearTimeoutId);
      clearTimeoutId = null;
    }

    // Blank first so the upcoming set is always a DOM content change. ATs only
    // announce a live region when its text content changes, so setting the same
    // string twice would be a no-op. A `queueMicrotask` delay is sometimes too
    // tight — some ATs batch accessibility-tree updates and can see the blank + set
    // as a single no-op. `setTimeout(0)` ensures the blank commit reaches the AT
    // before the replacement text, giving reliable re-announcement.
    rendered = '';

    if (next === '') return;

    clearTimeoutId = setTimeout(() => {
      if (isDestroyed || version !== current) return;
      rendered = next;
      clearTimeoutId = setTimeout(() => {
        if (isDestroyed || version !== current) return;
        rendered = '';
        clearTimeoutId = null;
      }, clearDelay);
    }, 0);
  });
</script>

<!-- Single element with computed role/aria-live to avoid duplicated markup. Note:
     changing `priority` after mount is generally unreliable (ATs cache live-region
     type at registration), but `priority` is expected to be a static configuration
     prop, not reactive data. -->
<div
  role={priority === 'assertive' ? 'alert' : 'status'}
  aria-live={priority === 'assertive' ? 'assertive' : 'polite'}
  aria-atomic="true"
  class={classNames('cinder-sr-only', className)}
>
  {rendered}
</div>
