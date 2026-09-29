<script lang="ts" module>
  export type LinkPopoverMode = 'insert' | 'edit';

  export type LinkPopoverProps = {
    /** Unique ID for accessibility */
    id: string;
    /** Current mode: insert new link or edit existing */
    mode: LinkPopoverMode;
    /** Initial URL value (for editing) */
    initialUrl?: string;
    /** Initial link text (for inserting with no selection) */
    initialText?: string;
    /** Whether we have selected text (hides text input) */
    hasSelection?: boolean;
    /** Additional CSS class */
    class?: string;
    /**
     * Anchor element for Floating UI positioning.
     * Pass an HTMLElement (toolbar button) or a VirtualElement (ProseMirror selection coords).
     * When null/undefined the popover falls back to its previous fixed-center positioning.
     */
    anchorElement?: HTMLElement | import('@floating-ui/dom').VirtualElement | null;
    /** Called when popover should close (Escape, Cancel, the Close button, a successful Insert/Update, or Remove) */
    onclose?: () => void;
    /** Called when link should be inserted */
    oninsert?: (url: string, text?: string) => void;
    /** Called when link should be removed */
    onremove?: () => void;
    /**
     * Called when the user dismisses the popover by interacting outside it.
     * Distinct from `onclose`: outside interaction targets some OTHER
     * control (a different toolbar button, a click into the document), and
     * that control's own focus must win. Falls back to `onclose` when not
     * provided, for standalone usage that treats every dismissal alike.
     */
    onOutsideDismiss?: () => void;
  };
</script>

<script lang="ts">
  import { tick, untrack } from 'svelte';
  import type { Placement, VirtualElement } from '@floating-ui/dom';
  import { createAnchoredOverlay } from '../../../_internal/anchored-overlay.svelte.ts';
  import { classNames } from '../../../utilities/class-names.ts';
  import { Button, Input, LinkIcon, Unlink, X } from '@lostgradient/cinder';
  import { createClickOutside } from '../../../utilities/attachments.ts';

  let {
    id,
    mode = 'insert',
    initialUrl = '',
    initialText = '',
    hasSelection = false,
    class: className,
    anchorElement = null,
    onclose,
    oninsert,
    onremove,
    onOutsideDismiss,
  }: LinkPopoverProps = $props();

  let popoverElement = $state<HTMLDivElement | null>(null);
  const anchoredOverlay = createAnchoredOverlay({
    open: () => Boolean(anchorElement),
    anchor: () => anchorElement as HTMLElement | VirtualElement | null,
    panel: () => popoverElement,
    placement: () => 'bottom-start' as Placement,
    offset: () => 8,
    widthMode: () => 'content',
  });

  // Form state. The popover is mounted fresh on every open (the parent gates it
  // behind `{#if linkPopoverOpen && mode === 'wysiwyg'}`), so initializing from
  // the incoming props here captures the correct values for this open session.
  // A prop-sync $effect would be redundant and would clobber the user's
  // in-progress edits if `initialUrl` / `initialText` recomputed mid-open.
  let url = $state(untrack(() => initialUrl));
  let text = $state(untrack(() => initialText));
  let initialFocusApplied = false;

  // `tick()` only guarantees the `data-position-ready` ATTRIBUTE has committed
  // to the DOM, not that a real browser has finished the separate style-recalc
  // pass that applies the `[data-position-ready='true']` CSS rule (below) —
  // measured on real Chromium as anywhere from under a frame up to ~100ms
  // after `tick()` resolves, most likely while `@floating-ui/dom`'s dynamic
  // import is still settling on its first use. `.focus()` on an element the
  // browser still computes `visibility: hidden` for silently no-ops, so this
  // polls actual computed visibility across animation frames (bounded, so a
  // popover that's somehow never made visible doesn't retry forever) instead
  // of guessing a fixed number of ticks/frames. Not reproducible in
  // happy-dom's simplified layout model, only in a real browser (COR-463).
  const MAX_INITIAL_FOCUS_FRAMES = 60;

  function focusUrlInputWhenVisible(framesRemaining: number): void {
    if (initialFocusApplied || !popoverElement) return;
    const isVisible = getComputedStyle(popoverElement).visibility !== 'hidden';
    if (!isVisible && framesRemaining > 0) {
      requestAnimationFrame(() => focusUrlInputWhenVisible(framesRemaining - 1));
      return;
    }
    document.getElementById(`${id}-url`)?.focus();
    initialFocusApplied = true;
  }

  $effect(() => {
    if (initialFocusApplied) return;
    if (!popoverElement) return;
    if (anchorElement && !anchoredOverlay.positionReady) return;
    void tick()
      .then(() => {
        focusUrlInputWhenVisible(MAX_INITIAL_FOCUS_FRAMES);
        return undefined;
      })
      .catch(() => undefined);
  });

  // Allowed URL protocols (safe for links)
  const ALLOWED_PROTOCOLS = [
    'http:',
    'https:',
    'mailto:',
    'tel:',
    'ftp:',
    'ftps:',
    'sms:',
  ] as const;

  // Dangerous URL schemes that could be used for XSS
  const DANGEROUS_SCHEMES = ['javascript:', 'data:', 'vbscript:'] as const;

  // Validation
  const urlError = $derived.by(() => {
    if (!url.trim()) return undefined;

    const trimmedUrl = url.trim().toLowerCase();

    // Block dangerous schemes (XSS prevention)
    for (const scheme of DANGEROUS_SCHEMES) {
      if (trimmedUrl.startsWith(scheme)) {
        return 'This URL scheme is not allowed';
      }
    }

    // Allow relative URLs and anchors
    if (trimmedUrl.startsWith('/') || trimmedUrl.startsWith('#')) {
      return undefined;
    }

    // Allow safe protocol schemes
    for (const protocol of ALLOWED_PROTOCOLS) {
      if (trimmedUrl.startsWith(protocol)) {
        return undefined;
      }
    }

    // Try to validate as absolute URL
    try {
      const parsedUrl = new URL(url);
      void parsedUrl;
      return undefined;
    } catch {
      // Try with https:// prefix for convenience
      try {
        const parsedUrl = new URL(`https://${url}`);
        void parsedUrl;
        return undefined;
      } catch {
        return 'Please enter a valid URL';
      }
    }
  });

  const canSubmit = $derived(url.trim() && !urlError && (hasSelection || text.trim()));

  function handleKeyDown(event: KeyboardEvent) {
    if (event.key === 'Escape' && !event.defaultPrevented) {
      event.preventDefault();
      onclose?.();
    }
    // Submit on Enter when form is valid
    // Skip if composing (IME input) to avoid interfering with autocomplete
    if (event.key === 'Enter' && canSubmit && !event.isComposing) {
      event.preventDefault();
      handleSubmit();
    }
  }

  function handleSubmit() {
    if (!canSubmit) return;

    // Normalize URL - add https:// if missing and not already a valid protocol
    let normalizedUrl = url.trim();
    const lowerUrl = normalizedUrl.toLowerCase();

    // Check if URL already has a protocol or is a relative/anchor URL
    const hasProtocol =
      lowerUrl.startsWith('/') ||
      lowerUrl.startsWith('#') ||
      ALLOWED_PROTOCOLS.some((protocol) => lowerUrl.startsWith(protocol));

    if (!hasProtocol) {
      normalizedUrl = `https://${normalizedUrl}`;
    }

    oninsert?.(normalizedUrl, hasSelection ? undefined : text.trim());
  }

  function handleRemove() {
    onremove?.();
  }
</script>

<!--
  Deliberately `role="dialog"` WITHOUT `aria-modal="true"` and without a focus
  trap. This is an anchored, non-modal toolbar panel — the same nonmodal
  pattern as ReviewEditor's ThreadPopover (cinder#1305) and Cinder's own
  Popover — not a blocking modal: the surrounding editor stays reachable, so
  nothing here makes it `inert` or otherwise unavailable. Tab and Shift+Tab
  follow normal document order and can leave the popup without closing it;
  Escape/Cancel/Close/outside-click remain the explicit ways to dismiss.
-->
<div
  bind:this={popoverElement}
  {id}
  role="dialog"
  aria-labelledby={`${id}-title`}
  tabindex="-1"
  class={classNames('cinder-_floating-surface', 'link-popover', className)}
  style={anchorElement ? anchoredOverlay.positionStyle : undefined}
  data-position-ready={anchorElement ? anchoredOverlay.positionReady : undefined}
  inert={anchorElement && !anchoredOverlay.positionReady ? true : undefined}
  {@attach createClickOutside({ handler: () => (onOutsideDismiss ?? onclose)?.() })}
  onkeydown={handleKeyDown}
>
  <header class="link-popover-header">
    <h2 id={`${id}-title`} class="link-popover-title">
      <LinkIcon class="cinder-icon-sm" />
      {mode === 'insert' ? 'Insert Link' : 'Edit Link'}
    </h2>
    <button type="button" class="link-popover-close" onclick={onclose} aria-label="Close">
      <X class="cinder-icon-sm" />
    </button>
  </header>

  <div class="link-popover-content">
    <Input
      id={`${id}-url`}
      label="URL"
      type="url"
      placeholder="https://example.com"
      bind:value={url}
      error={urlError ?? ''}
      required
    />

    {#if !hasSelection}
      <Input
        id={`${id}-text`}
        label="Link text"
        placeholder="Display text"
        bind:value={text}
        required
      />
    {/if}
  </div>

  <footer class="link-popover-footer">
    <div class="link-popover-actions">
      {#if mode === 'edit'}
        <Button variant="ghost" size="sm" onclick={handleRemove}>
          <Unlink class="cinder-icon-sm" />
          Remove
        </Button>
      {/if}
    </div>
    <div class="link-popover-primary-actions">
      <Button variant="secondary" size="sm" onclick={onclose}>Cancel</Button>
      <Button variant="primary" size="sm" onclick={handleSubmit} disabled={!canSubmit}>
        {mode === 'insert' ? 'Insert' : 'Update'}
      </Button>
    </div>
  </footer>
</div>

<style>
  /* Composes `cinder-_floating-surface` (see the class list on the root
   * element) for the shared border, medium radius, raised surface, elevation
   * shadow, and viewport-height cap — the same treatment Cinder's own Popover
   * and ChatNavigationRail's preview surface use. `.link-popover` below only
   * adds what that shared treatment does not already own: positioning,
   * width, and overriding the shared wrapper padding to 0 so the header,
   * content, and footer bands own their own padding once instead of stacking
   * on top of a wrapper inset. */
  .link-popover {
    position: fixed;
    /* Positioned by Floating UI when anchorElement is provided (inline style).
     * Visibility is hidden until the first position compute completes so that
     * focus is never visibly misplaced. */
    visibility: hidden;
    display: flex;
    flex-direction: column;
    width: 320px;
    max-width: calc(100vw - 2rem);
    padding: 0;
    overflow: hidden;
  }

  .link-popover[data-position-ready='true'] {
    visibility: visible;
  }

  /* When no anchor element is provided (standalone usage without Floating UI),
   * center horizontally via auto inline margins and inset from the top — no
   * hardcoded percentage offsets or transforms. */
  .link-popover:not([data-position-ready]) {
    inset-block-start: 20vh;
    inset-inline: 0;
    margin-inline: auto;
    visibility: visible;
  }

  /* Header/footer target at most 40px high on a fine pointer: 6px block
   * padding (--cinder-space-1-5) on either side of a 28px row (the sm Button
   * height and the close button below share that same 28px), 6+6+28=40. */
  .link-popover-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--cinder-space-2);
    box-sizing: border-box;
    padding: var(--cinder-space-1-5) var(--cinder-space-3);
    border-bottom: 1px solid var(--cinder-border);
    background: var(--cinder-surface-raised);
  }

  .link-popover-title {
    display: flex;
    align-items: center;
    gap: var(--cinder-space-2);
    margin: 0;
    font-size: var(--cinder-text-sm);
    font-weight: var(--cinder-font-semibold);
    color: var(--cinder-text-default);
  }

  /* 28px on a fine pointer (matches the sm Button height in the footer, and
   * keeps the header within its 40px budget); the existing pointer-aware
   * convention (see number-input's `.cinder-number-input__stepper`) bumps it
   * to the 44px WCAG 2.2 AA touch target on a coarse pointer instead of
   * enlarging every desktop icon. */
  .link-popover-close {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    flex-shrink: 0;
    color: var(--cinder-text-muted);
    background: transparent;
    border: none;
    border-radius: var(--cinder-radius-sm);
    cursor: pointer;
    transition:
      background-color var(--cinder-duration-fast) var(--cinder-ease-standard),
      color var(--cinder-duration-fast) var(--cinder-ease-standard);
  }

  @media (pointer: coarse) {
    .link-popover-close {
      width: var(--cinder-touch-target-min);
      height: var(--cinder-touch-target-min);
    }
  }

  @media (hover: hover) {
    .link-popover-close:hover {
      color: var(--cinder-text-default);
      background: var(--cinder-surface-hover);
    }
  }

  /* Close button sits in the popover corner; an outset ring would overhang the
     popover edge, so paint an INSET ring (Strategy B-inset). */
  .link-popover-close:focus-visible {
    outline: var(--cinder-ring-width) solid transparent;
    box-shadow: inset 0 0 0 var(--cinder-ring-width)
      var(--_cinder-link-popover-close-ring, var(--cinder-ring-color));
  }

  @media (forced-colors: active) {
    .link-popover-close:focus-visible {
      outline: var(--cinder-ring-width) solid ButtonText;
      outline-offset: calc(var(--cinder-ring-width) * -1);
    }
  }

  /* `background` is explicit here (rather than inherited from the root's now
   * `--cinder-surface-raised` floating-surface background) so the content
   * band keeps reading as the plain surface it always has, distinct from the
   * raised header/footer bands. */
  .link-popover-content {
    display: flex;
    flex-direction: column;
    gap: var(--cinder-space-3);
    padding: var(--cinder-space-3);
    background: var(--cinder-surface);
  }

  .link-popover-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--cinder-space-2);
    box-sizing: border-box;
    padding: var(--cinder-space-1-5) var(--cinder-space-3);
    border-top: 1px solid var(--cinder-border);
    background: var(--cinder-surface-raised);
  }

  .link-popover-actions {
    display: flex;
    gap: var(--cinder-space-2);
  }

  .link-popover-primary-actions {
    display: flex;
    gap: var(--cinder-space-2);
    margin-inline-start: auto;
  }
</style>
