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
    /** Called when popover should close */
    onclose?: () => void;
    /** Called when link should be inserted */
    oninsert?: (url: string, text?: string) => void;
    /** Called when link should be removed */
    onremove?: () => void;
  };
</script>

<script lang="ts">
  import { tick } from 'svelte';
  import type { Placement, VirtualElement } from '@floating-ui/dom';
  import { createAnchoredOverlay } from '../../../_internal/anchored-overlay.svelte.ts';
  import { classNames } from '../../../utilities/class-names.ts';
  import { createFocusTrap } from '../../focus-trap/index.ts';
  import { createClickOutside } from '../../../utilities/attachments.ts';
  import Button from '../../button/button.svelte';
  import Input from '../../input/input.svelte';
  import Link from 'lucide-svelte/icons/link';
  import Unlink from 'lucide-svelte/icons/unlink';
  import X from 'lucide-svelte/icons/x';

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
  let url = $state(initialUrl);
  let text = $state(initialText);
  let initialFocusApplied = false;

  $effect(() => {
    if (initialFocusApplied) return;
    if (!popoverElement) return;
    if (anchorElement && !anchoredOverlay.positionReady) return;
    tick().then(() => {
      if (initialFocusApplied) return;
      document.getElementById(`${id}-url`)?.focus();
      initialFocusApplied = true;
    });
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
      new URL(url);
      return undefined;
    } catch {
      // Try with https:// prefix for convenience
      try {
        new URL(`https://${url}`);
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

<div
  bind:this={popoverElement}
  {id}
  role="dialog"
  aria-modal="true"
  aria-labelledby={`${id}-title`}
  tabindex="-1"
  class={classNames('link-popover', className)}
  style={anchorElement ? anchoredOverlay.positionStyle : undefined}
  data-position-ready={anchorElement ? anchoredOverlay.positionReady : undefined}
  inert={anchorElement && !anchoredOverlay.positionReady ? true : undefined}
  {@attach createFocusTrap({ active: () => !anchorElement || anchoredOverlay.positionReady })}
  {@attach createClickOutside({ handler: () => onclose?.() })}
  onkeydown={handleKeyDown}
>
  <header class="link-popover-header">
    <h2 id={`${id}-title`} class="link-popover-title">
      <Link class="cinder-icon-sm" />
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
  .link-popover {
    position: fixed;
    /* Positioned by Floating UI when anchorElement is provided (inline style).
     * Visibility is hidden until the first position compute completes so that
     * focus is never visibly misplaced. */
    visibility: hidden;
    z-index: var(--cinder-z-dropdown);
    display: flex;
    flex-direction: column;
    width: 320px;
    max-width: calc(100vw - 2rem);
    background: var(--cinder-surface);
    border: 1px solid var(--cinder-border);
    border-radius: var(--cinder-radius-lg);
    box-shadow: var(--cinder-shadow-lg);
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

  .link-popover-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--cinder-space-2);
    padding: var(--cinder-space-3) var(--cinder-space-4);
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
    color: var(--cinder-text);
  }

  .link-popover-close {
    display: flex;
    align-items: center;
    justify-content: center;
    width: var(--cinder-touch-target-min, 44px);
    height: var(--cinder-touch-target-min, 44px);
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

  @media (hover: hover) {
    .link-popover-close:hover {
      color: var(--cinder-text);
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

  .link-popover-content {
    display: flex;
    flex-direction: column;
    gap: var(--cinder-space-4);
    padding: var(--cinder-space-4);
  }

  .link-popover-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--cinder-space-2);
    padding: var(--cinder-space-3) var(--cinder-space-4);
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
