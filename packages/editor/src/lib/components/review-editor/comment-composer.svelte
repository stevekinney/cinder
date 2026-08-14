<script lang="ts" module>
  import type { Snippet } from 'svelte';
  import type { HTMLTextareaAttributes } from 'svelte/elements';

  export type CommentComposerProps = Omit<
    HTMLTextareaAttributes,
    'class' | 'value' | 'onkeydown' | 'onsubmit'
  > & {
    /** Unique ID for accessibility (required) */
    id: string;
    /** Current value (two-way bindable) */
    value?: string;
    /** Placeholder text */
    placeholder?: string;
    /** Whether the composer is disabled */
    disabled?: boolean;
    /** Whether a submission is in progress */
    loading?: boolean;
    /** Error message to display */
    error?: string;
    /** Minimum number of rows (default: 3) */
    minRows?: number;
    /** Maximum number of rows before scrolling (optional) */
    maxRows?: number;
    /** Whether to auto-expand as content grows (default: true) */
    autoExpand?: boolean;
    /** Additional CSS class */
    class?: string;
    /** Called when the comment is submitted */
    onsubmit?: (body: string) => void;
    /** Called when the user cancels (Escape key) */
    oncancel?: () => void;
    /** Optional actions snippet (e.g., for cancel button) */
    actions?: Snippet;
  };
</script>

<script lang="ts">
  /**
   * CommentComposer is a markdown textarea for creating comments in the ReviewEditor.
   *
   * Features:
   * - Keyboard shortcuts: Cmd/Ctrl+Enter to submit, Escape to cancel
   * - Auto-expand to fit content
   * - Blocks whitespace-only submit
   * - Loading and error states
   * - Accessible with proper ARIA attributes
   *
   * @example
   * ```svelte
   * <CommentComposer
   *   id="comment-1"
   *   bind:value={comment}
   *   onsubmit={(body) => createComment(body)}
   *   oncancel={() => closeComposer()}
   * />
   * ```
   */

  import { classNames } from '../../utilities/class-names.ts';
  import Button from '@lostgradient/cinder/button';

  let {
    id,
    value = $bindable(''),
    placeholder = 'Write a comment...',
    disabled = false,
    loading = false,
    error,
    minRows = 3,
    maxRows,
    autoExpand = true,
    class: className,
    onsubmit,
    oncancel,
    actions,
    ...rest
  }: CommentComposerProps = $props();

  let textareaElement = $state<HTMLTextAreaElement | null>(null);

  /**
   * Detect if user is on macOS for keyboard shortcut hints.
   */
  const isMac = $derived.by(() => {
    if (typeof navigator === 'undefined') return false;
    if ('userAgentData' in navigator && navigator.userAgentData) {
      return (navigator.userAgentData as { platform?: string }).platform === 'macOS';
    }
    return /Mac|iPhone|iPad|iPod/.test(navigator.userAgent);
  });

  const errorId = $derived(`${id}-error`);
  const canSubmit = $derived(value.trim().length > 0 && !disabled && !loading);

  /**
   * Calculate dynamic row count based on content.
   */
  const dynamicRows = $derived.by(() => {
    if (!autoExpand) return minRows;

    // Count newlines in content
    const lineCount = (value.match(/\n/g) || []).length + 1;

    // Clamp between minRows and maxRows
    let rows = Math.max(minRows, lineCount);
    if (maxRows !== undefined) {
      rows = Math.min(rows, maxRows);
    }
    return rows;
  });

  function handleSubmit(event: Event) {
    event.preventDefault();
    if (!canSubmit) return;

    onsubmit?.(value.trim());

    // Clear the value after submit
    value = '';

    // Keep focus on textarea after submit
    textareaElement?.focus();
  }

  function handleKeyDown(event: KeyboardEvent) {
    // Cmd/Ctrl + Enter to submit
    if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      if (canSubmit) {
        onsubmit?.(value.trim());
        value = '';
        textareaElement?.focus();
      }
      return;
    }

    // Escape to cancel
    if (event.key === 'Escape' && oncancel) {
      event.preventDefault();
      oncancel();
    }
  }

  /** Focus the textarea */
  export function focus() {
    textareaElement?.focus();
  }

  /** Select all text in the textarea */
  export function selectAll() {
    textareaElement?.select();
  }

  /** Clear the input */
  export function clear() {
    value = '';
    textareaElement?.focus();
  }
</script>

<form class={classNames('comment-composer', className)} onsubmit={handleSubmit}>
  <label for={id} class="sr-only">Comment</label>

  <div class="comment-composer-textarea-container">
    <textarea
      bind:this={textareaElement}
      {id}
      class="comment-composer-textarea"
      data-has-error={!!error}
      {placeholder}
      disabled={disabled || loading}
      bind:value
      onkeydown={handleKeyDown}
      rows={dynamicRows}
      aria-invalid={error ? 'true' : undefined}
      aria-describedby={error ? errorId : undefined}
      aria-busy={loading ? 'true' : undefined}
      {...rest}
    ></textarea>

    <div class="comment-composer-inline-submit">
      <!--
        `onmousedown` preventDefault keeps this button clickable in WebKit, and
        it is load-bearing rather than defensive.

        The button is revealed by `:focus-within` on the container below, which
        also flips it from `pointer-events: none` to `auto`. WebKit does not
        focus a `<button>` on mousedown — so mid-gesture the textarea blurs,
        `:focus-within` drops, `pointer-events` goes back to `none` BEFORE
        mouseup, and the mouseup hit-tests to the textarea instead. Per spec the
        `click` then retargets to the nearest common ancestor, the wrapper
        `<div>`, so the button never sees a click and the form never submits.
        The only working path left was the undiscoverable Cmd+Enter.

        Suppressing mousedown's default focus change means the textarea keeps
        focus through the whole gesture, so `:focus-within` never drops. Chromium
        and Firefox were unaffected either way — they focus the button on
        mousedown, which keeps `:focus-within` true via the container.

        Not fixed by keeping `pointer-events: auto` while `opacity: 0`: that
        leaves an invisible click target sitting over the textarea.
      -->
      <Button
        type="submit"
        variant="primary"
        size="xs"
        disabled={!canSubmit}
        {loading}
        onmousedown={(event: MouseEvent) => event.preventDefault()}
      >
        {loading ? 'Sending...' : 'Comment'}
      </Button>
    </div>
  </div>

  {#if error}
    <p id={errorId} class="comment-composer-error" role="alert">
      {error}
    </p>
  {/if}

  <div class="comment-composer-footer">
    <span class="comment-composer-hint">
      <kbd>{isMac ? '⌘' : 'Ctrl'}</kbd><kbd>↵</kbd> to submit
    </span>

    <div class="comment-composer-actions">
      {#if actions}
        {@render actions()}
      {:else if oncancel}
        <Button variant="ghost" size="xs" onclick={oncancel} disabled={loading}>Cancel</Button>
      {/if}
    </div>
  </div>
</form>

<style>
  .comment-composer {
    display: flex;
    flex-direction: column;
    gap: var(--cinder-space-2);
  }

  .comment-composer-textarea-container {
    position: relative;
  }

  .comment-composer-inline-submit {
    position: absolute;
    right: var(--cinder-space-2);
    bottom: var(--cinder-space-2);
    opacity: 0;
    pointer-events: none;
    transition: opacity var(--cinder-duration-fast) var(--cinder-ease-standard);
  }

  .comment-composer-textarea-container:focus-within .comment-composer-inline-submit {
    opacity: 1;
    pointer-events: auto;
  }

  .comment-composer-textarea {
    width: 100%;
    min-height: 4.5rem;
    padding: var(--cinder-space-2);
    /* Extra bottom padding to accommodate inline submit button */
    padding-bottom: calc(var(--cinder-space-2) + 1.5rem + var(--cinder-space-2));
    font-family: inherit;
    font-size: var(--cinder-text-sm);
    line-height: var(--cinder-leading-normal);
    color: var(--cinder-text);
    background: var(--cinder-surface-raised);
    border: 1px solid var(--cinder-border);
    border-radius: var(--cinder-radius-md);
    resize: vertical;
    transition: border-color var(--cinder-duration-fast) var(--cinder-ease-standard);
  }

  .comment-composer-textarea::placeholder {
    color: var(--cinder-text-subtle);
  }

  .comment-composer-textarea:focus {
    border-color: var(--cinder-accent);
    outline: var(--cinder-ring-width) solid transparent;
    outline-offset: var(--cinder-ring-offset);
    box-shadow: var(--_cinder-focus-ring-shadow);
  }

  .comment-composer-textarea:disabled {
    cursor: not-allowed;
    opacity: 0.5;
    background: var(--cinder-surface-inset);
  }

  .comment-composer-textarea[data-has-error='true'] {
    border-color: var(--cinder-danger);
  }

  @media (forced-colors: active) {
    .comment-composer-textarea:focus {
      outline: var(--cinder-ring-width) solid Highlight;
      outline-offset: 1px;
    }
  }

  .comment-composer-error {
    margin: 0;
    font-size: var(--cinder-text-xs);
    color: var(--cinder-danger);
  }

  .comment-composer-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--cinder-space-2);
  }

  .comment-composer-hint {
    display: flex;
    align-items: center;
    gap: var(--cinder-space-0-5);
    font-size: var(--cinder-text-xs);
    color: var(--cinder-text-subtle);
  }

  .comment-composer-hint kbd {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 1.25rem;
    height: 1.25rem;
    padding: 0 var(--cinder-space-1);
    font-family: inherit;
    font-size: var(--cinder-text-xs);
    background: var(--cinder-surface-raised);
    border: 1px solid var(--cinder-border);
    border-radius: var(--cinder-radius-sm);
  }

  .comment-composer-actions {
    display: flex;
    align-items: center;
    gap: var(--cinder-space-2);
  }

  /* Screen reader only utility */
  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }
</style>
