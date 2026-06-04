<script lang="ts" module>
  /**
   * Internal shared visually-hidden ARIA live region.
   *
   * The single canonical way for a Cinder component to announce a transient
   * status string to screen readers. It renders a visually-hidden `role="status"`
   * (polite) or `role="alert"` (assertive) region — both `aria-atomic="true"` so
   * the full message is read on every change — and owns the blank-then-set timing
   * that makes a *repeated* identical message re-announce.
   *
   * Not a public component (no `@cinder` block, not in the manifest): it is an
   * implementation detail consumed by components that need announcements
   * (autocomplete, load-more, copy-button, …). See `_internal/PLATFORM-POLICY.md`
   * § Live regions.
   *
   * Usage — feed it a reactive `message` and an optional `priority`; it handles the
   * announce timing. The **consumer owns the lifecycle**: keep the message in
   * `$state`, pass it as a prop, and set it back to `''` when the status is no
   * longer relevant (copy-button clears it when the confirmation window ends;
   * autocomplete clears it when loading finishes). The region does NOT auto-clear a
   * still-active message — clearing a sustained "Loading…" out from under the
   * consumer would drop a status that is still true.
   *
   * The blank-then-set dance: a screen reader only announces a live region when its
   * text content *changes*. Setting the same string twice (e.g. "Copied" after a
   * previous "Copied") is a no-op to the AT. So on every `message` change we blank
   * the region, then set the new text on the next task (`setTimeout(0)`),
   * guaranteeing a content change the AT will pick up. `setTimeout(0)` rather than
   * `queueMicrotask` because some ATs batch accessibility-tree updates and would see
   * a microtask blank+set as a single no-op. A version counter discards a stale
   * deferred-set when a newer message supersedes it.
   */
  export type LiveRegionPriority = 'polite' | 'assertive';
</script>

<script lang="ts">
  import { classNames } from '../utilities/class-names.ts';

  let {
    message = '',
    priority = 'polite',
    class: className,
  }: {
    message?: string;
    priority?: LiveRegionPriority;
    class?: string;
  } = $props();

  // The text actually rendered into the region. Decoupled from the `message` prop
  // so we can blank-then-set to force re-announcement of a repeated message.
  let rendered = $state('');
  let setTimeoutId: ReturnType<typeof setTimeout> | null = null;
  // Bumped per message change; the deferred-set callback captures it and bails if superseded.
  let version = 0;
  let isDestroyed = false;

  $effect(() => {
    return () => {
      isDestroyed = true;
      if (setTimeoutId) {
        clearTimeout(setTimeoutId);
        setTimeoutId = null;
      }
    };
  });

  // React to `message` changes: blank the region, then set the new text on the next
  // task so a repeated identical string still triggers an announcement. The message
  // then PERSISTS until the consumer changes it (no auto-clear of an active status).
  $effect(() => {
    const next = message;
    const current = ++version;

    if (setTimeoutId) {
      clearTimeout(setTimeoutId);
      setTimeoutId = null;
    }

    // Blank first so the upcoming set is always a DOM content change. ATs only
    // announce when the text content changes; setting the same string twice is a
    // no-op. setTimeout(0) (not queueMicrotask) so the blank commit reaches the AT
    // before the replacement — some ATs batch a-tree updates and would otherwise see
    // blank+set as a single no-op.
    rendered = '';

    if (next === '') return;

    setTimeoutId = setTimeout(() => {
      if (isDestroyed || version !== current) return;
      rendered = next;
      setTimeoutId = null;
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
