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
    /** Called when popover should close */
    onclose?: () => void;
    /** Called when link should be inserted */
    oninsert?: (url: string, text?: string) => void;
    /** Called when link should be removed */
    onremove?: () => void;
  };
</script>

<script lang="ts">
  import { classNames } from '../../../utilities/class-names.ts';
  import {
    createFocusTrap,
    createFocusOnMount,
    createClickOutside,
  } from '../../../utilities/attachments.ts';
  import Button from '../../button.svelte';
  import Input from '../../input.svelte';
  import { Link, Unlink, X } from '../../icons/index.ts';

  let {
    id,
    mode = 'insert',
    initialUrl = '',
    initialText = '',
    hasSelection = false,
    class: className,
    onclose,
    oninsert,
    onremove,
  }: LinkPopoverProps = $props();

  // Form state (reset by $effect when popover opens)
  let url = $state('');
  let text = $state('');

  // Reset form state when initial values change (e.g., when opening for different link)
  $effect(() => {
    url = initialUrl;
    text = initialText;
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
  {id}
  role="dialog"
  aria-modal="true"
  aria-labelledby={`${id}-title`}
  tabindex="-1"
  class={classNames('link-popover', className)}
  {@attach createFocusTrap()}
  {@attach createFocusOnMount()}
  {@attach createClickOutside({ handler: () => onclose?.() })}
  onkeydown={handleKeyDown}
>
  <header class="link-popover-header">
    <h2 id={`${id}-title`} class="link-popover-title">
      <Link class="icon-sm" />
      {mode === 'insert' ? 'Insert Link' : 'Edit Link'}
    </h2>
    <button type="button" class="link-popover-close" onclick={onclose} aria-label="Close">
      <X class="icon-sm" />
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
          <Unlink class="icon-sm" />
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
    /* Center horizontally and position near top of viewport */
    left: 50%;
    top: 20%;
    transform: translateX(-50%);
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
    width: 1.5rem;
    height: 1.5rem;
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

  .link-popover-close:hover {
    color: var(--cinder-text);
    background: var(--cinder-surface-hover);
  }

  .link-popover-close:focus-visible {
    outline: 2px solid var(--cinder-accent);
    outline-offset: -2px;
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
