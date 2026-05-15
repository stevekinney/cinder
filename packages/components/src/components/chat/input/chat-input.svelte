<script lang="ts" module>
  import type { Snippet } from 'svelte';
  import type { HTMLFormAttributes } from 'svelte/elements';
  import type { MessageInput } from 'conversationalist';
  import type { ChatAttachment } from './chat-attachment.ts';
  import type { AttachmentKind } from './attachment-kind.js';

  export type { ChatAttachment } from './chat-attachment.ts';

  export type ChatInputProps = Omit<HTMLFormAttributes, 'onsubmit' | 'class'> & {
    /** Unique ID for accessibility (required) */
    id: string;
    /** Current markdown content (two-way bindable) */
    value?: string;
    /** Placeholder text */
    placeholder?: string;
    /** Whether the input is disabled */
    disabled?: boolean;
    /** Whether a submission is in progress */
    sending?: boolean;
    /** Error message to display */
    error?: string | undefined;
    /** Additional CSS class */
    class?: string;

    // Form action support
    /** Form action URL (enables form action mode) */
    action?: string;
    /** Name for the hidden input field (default: 'content') */
    name?: string;

    // Submission behavior
    /** Whether to clear input after submit (default: true). Set to false for error recovery. */
    clearOnSubmit?: boolean;

    // Attachment configuration
    /** Enable file attachments (default: true) */
    allowAttachments?: boolean;
    /** Maximum file size in bytes (default: 10MB) */
    maxFileSize?: number;
    /** Accepted MIME types (default: ['image/*']) */
    acceptedTypes?: string[];

    // Events
    /** Called when the message is submitted */
    onsubmit?: (message: MessageInput, attachments: ChatAttachment[]) => void;
    /** Called when stop is requested (transforms send button into stop button when sending=true) */
    onstop?: (() => void) | undefined;
    /** Called when an attachment is added */
    onattachmentadd?: ((attachment: ChatAttachment) => void) | undefined;
    /** Called when an attachment is removed */
    onattachmentremove?: ((attachment: ChatAttachment) => void) | undefined;
    /** Called when an attachment fails validation */
    onattachmentfailure?: ((file: File, error: string) => void) | undefined;

    // Snippets for extensibility
    /** Custom actions area (e.g., additional buttons) */
    actions?: Snippet;
  };
</script>

<script lang="ts">
  /**
   * ChatInput is a ChatGPT/Claude-style chat composer.
   *
   * Features:
   * - Wraps MarkdownEditor in lightweight mode (no toolbar/mode toggle)
   * - Keyboard shortcuts: Enter to send, Shift+Enter for newline
   * - IME-aware: composition input (Japanese/Chinese/Korean) won't trigger send
   * - File attachments (images, code, documents) via paste, drag-drop, or file picker
   * - Blocks whitespace-only submit
   * - Works standalone or with SvelteKit form actions
   *
   * @example
   * ```svelte
   * <ChatInput
   *   id="chat"
   *   bind:value={message}
   *   onsubmit={(msg, attachments) => sendMessage(msg, attachments)}
   * />
   * ```
   */

  import { onDestroy } from 'svelte';
  import { classNames } from '../../../utilities/class-names.ts';
  import { useAnnouncer } from '../../../utilities/use-announcer.svelte.ts';
  import { ArrowUp, Paperclip, Square, X } from '../../icons/index.ts';
  import Button from '../../button.svelte';
  import MarkdownEditor from '../../markdown-editor.svelte';
  import { deriveAttachmentKind } from './attachment-kind.js';
  import ChatAttachmentPreview from './chat-attachment-preview.svelte';

  let {
    id,
    value = $bindable(''),
    placeholder = 'Type a message...',
    disabled = false,
    sending = false,
    error,
    class: className,
    action,
    name = 'content',
    clearOnSubmit = true,
    allowAttachments = true,
    maxFileSize = 10 * 1024 * 1024, // 10MB
    acceptedTypes = [
      'image/*',
      'text/*',
      'application/json',
      'application/pdf',
      'application/javascript',
      'application/typescript',
      'application/xml',
      'application/yaml',
      'application/x-yaml',
      // Keep in sync with CODE_MIME_TYPES in attachment-kind.ts
      'application/x-sh',
      'application/sql',
      'application/toml',
    ],
    onsubmit,
    onstop,
    onattachmentadd,
    onattachmentremove,
    onattachmentfailure,
    actions,
    ...rest
  }: ChatInputProps = $props();

  // Derived: show stop button when sending and onstop is provided
  const showStopButton = $derived(sending && onstop !== undefined);

  // Refs
  let formElement = $state<HTMLFormElement | null>(null);
  let editorRef: { focus: () => void; getMarkdown: () => string } | undefined;
  let fileInputRef = $state<HTMLInputElement | null>(null);

  // Internal state
  let attachments = $state<ChatAttachment[]>([]);
  let isDragOver = $state(false);
  let isComposing = $state(false);

  // Screen reader announcements
  const announcer = useAnnouncer();

  // Derived state
  const errorId = $derived(`${id}-error`);
  const hintId = $derived(`${id}-hint`);
  const isWhitespaceOnly = $derived(value.trim().length === 0);
  const hasPendingAttachments = $derived(
    attachments.some((a) => a.status === 'pending' || a.status === 'uploading'),
  );
  // Allow submit when text is present, even if some attachments errored.
  // Only block on pending/uploading attachments (they're not yet ready to send).
  const canSubmit = $derived(!isWhitespaceOnly && !disabled && !sending && !hasPendingAttachments);

  // Determine if we're in form action mode
  const isFormActionMode = $derived(!!action);

  // =========================================================================
  // Attachment Handling
  // =========================================================================

  function isValidType(file: File): boolean {
    return acceptedTypes.some((type) => {
      if (type.endsWith('/*')) {
        const category = type.slice(0, -2);
        return file.type.startsWith(category);
      }
      return file.type === type;
    });
  }

  const KIND_LABELS: Record<AttachmentKind, string> = {
    image: 'Image',
    code: 'Code file',
    document: 'Document',
  };

  function addAttachment(file: File): void {
    // Type validation
    if (!isValidType(file)) {
      onattachmentfailure?.(
        file,
        `Invalid file type: ${file.type}. Accepted types: ${acceptedTypes.join(', ')}.`,
      );
      return;
    }

    // Size validation
    if (file.size > maxFileSize) {
      const maxSizeMB = Math.round(maxFileSize / (1024 * 1024));
      onattachmentfailure?.(file, `File exceeds ${maxSizeMB}MB limit`);
      return;
    }

    const kind = deriveAttachmentKind(file.type);

    const attachment: ChatAttachment = {
      id: crypto.randomUUID(),
      file,
      previewUrl: URL.createObjectURL(file),
      kind,
      status: kind === 'code' ? 'pending' : 'ready',
    };

    attachments = [...attachments, attachment];
    onattachmentadd?.(attachment);
    announcer.announce(`${KIND_LABELS[kind]} attached: ${file.name}`);

    // Fire-and-forget text extraction for code files
    if (kind === 'code') {
      file.text().then(
        (text) => {
          attachments = attachments.map((a) =>
            a.id === attachment.id ? { ...a, textContent: text, status: 'ready' as const } : a,
          );
        },
        () => {
          attachments = attachments.map((a) =>
            a.id === attachment.id
              ? { ...a, status: 'error' as const, error: 'Failed to read file' }
              : a,
          );
        },
      );
    }
  }

  function removeAttachment(attachmentId: string): void {
    const attachment = attachments.find((a) => a.id === attachmentId);
    if (attachment) {
      URL.revokeObjectURL(attachment.previewUrl);
      attachments = attachments.filter((a) => a.id !== attachmentId);
      onattachmentremove?.(attachment);
      announcer.announce(`${KIND_LABELS[attachment.kind]} removed`);
    }
  }

  function handleFileSelect(event: Event): void {
    const input = event.target as HTMLInputElement;
    const files = input.files;
    if (files) {
      Array.from(files).forEach(addAttachment);
    }
    // Reset input for re-selection of same file
    input.value = '';
  }

  function handlePaste(event: ClipboardEvent): void {
    if (!allowAttachments) return;

    const items = event.clipboardData?.items;
    if (!items) return;

    // Collect all files from clipboard
    const files: File[] = [];
    for (const item of items) {
      if (item.kind === 'file') {
        const file = item.getAsFile();
        if (file) {
          files.push(file);
        }
      }
    }

    // If we have files, prevent default and let addAttachment handle all validation
    // (including calling onattachmentfailure for invalid types/sizes)
    if (files.length > 0) {
      event.preventDefault();
      files.forEach(addAttachment);
    }
  }

  function handleDrop(event: DragEvent): void {
    isDragOver = false;

    if (!allowAttachments) return;

    // Prevent default (browser opening/downloading the file) and stop propagation
    // only when attachments are enabled and we are actually handling the drop.
    // When attachments are disabled, the event bubbles and the browser's default
    // behavior is preserved.
    event.preventDefault();
    event.stopPropagation();

    const files = event.dataTransfer?.files;
    if (files) {
      // Let addAttachment handle all validation (type and size)
      Array.from(files).forEach(addAttachment);
    }
  }

  function handleDragOver(event: DragEvent): void {
    if (!allowAttachments) return;
    event.preventDefault();
    isDragOver = true;
  }

  function handleDragLeave(event: DragEvent): void {
    // Only set isDragOver to false if we're leaving the form entirely
    if (!formElement?.contains(event.relatedTarget as Node)) {
      isDragOver = false;
    }
  }

  // =========================================================================
  // Form Submission
  // =========================================================================

  function handleSubmit(event: SubmitEvent): void {
    if (!canSubmit) {
      event.preventDefault();
      return;
    }

    // Get the latest content directly from the editor to avoid debounce lag.
    // The bound `value` may be stale if the user typed and pressed Enter quickly.
    const latestContent = editorRef?.getMarkdown() ?? value;
    const trimmedContent = latestContent.trim();

    // Re-check for whitespace-only after getting latest content
    if (trimmedContent.length === 0) {
      event.preventDefault();
      return;
    }

    const message: MessageInput = {
      role: 'user',
      content: trimmedContent,
    };

    const readyAttachments = attachments.filter((a) => a.status === 'ready');

    // Call onsubmit callback
    onsubmit?.(message, readyAttachments);

    // In standalone mode, prevent default form submission
    if (!isFormActionMode) {
      event.preventDefault();

      if (clearOnSubmit) {
        // Clear state
        value = '';
        attachments.forEach((a) => URL.revokeObjectURL(a.previewUrl));
        attachments = [];
      }

      // Restore focus to editor
      editorRef?.focus();
      announcer.announce('Message sent');
    } else {
      // In form action mode, sync the bound value with trimmed content
      // so the hidden input sends the same content as the callback.
      // This fixes debounce lag and ensures consistent data.
      value = trimmedContent;
    }
  }

  // =========================================================================
  // Keyboard Handling
  // =========================================================================

  function handleKeyDown(event: KeyboardEvent): void {
    // Ignore keydown events during IME composition (e.g., Japanese/Chinese/Korean input).
    // During composition, Enter confirms the candidate, not sends the message.
    if (event.isComposing || isComposing) {
      return;
    }

    // Shift+Enter: Newline (let editor handle it)
    if (event.key === 'Enter' && event.shiftKey) {
      return;
    }

    // Enter (no modifiers): Submit
    if (event.key === 'Enter' && !event.metaKey && !event.ctrlKey && !event.altKey) {
      event.preventDefault();
      if (canSubmit) {
        formElement?.requestSubmit();
      }
    }
  }

  function handleCompositionStart(): void {
    isComposing = true;
  }

  function handleCompositionEnd(): void {
    isComposing = false;
  }

  // =========================================================================
  // Imperative API
  // =========================================================================

  export function focus(): void {
    editorRef?.focus();
  }

  export function clear(): void {
    value = '';
    attachments.forEach((a) => URL.revokeObjectURL(a.previewUrl));
    attachments = [];
  }

  export function getAttachments(): ChatAttachment[] {
    return [...attachments];
  }

  export function addFiles(files: File[]): void {
    if (!allowAttachments) return;
    files.forEach(addAttachment);
  }

  // =========================================================================
  // Cleanup
  // =========================================================================

  onDestroy(() => {
    attachments.forEach((a) => URL.revokeObjectURL(a.previewUrl));
  });
</script>

<form
  bind:this={formElement}
  class={classNames('chat-input', isDragOver && 'chat-input-dragover', className)}
  method="POST"
  {action}
  onsubmit={handleSubmit}
  onkeydown={handleKeyDown}
  onpaste={handlePaste}
  ondrop={handleDrop}
  ondragover={handleDragOver}
  ondragleave={handleDragLeave}
  oncompositionstart={handleCompositionStart}
  oncompositionend={handleCompositionEnd}
  aria-label="Chat message composer"
  aria-busy={sending || undefined}
  {...rest}
>
  <!-- Hidden input for form action mode -->
  {#if isFormActionMode}
    <input type="hidden" {name} {value} />
  {/if}

  <!-- Attachment previews -->
  {#if attachments.length > 0}
    <div class="chat-input-attachments" role="list" aria-label="Attached files">
      {#each attachments as attachment (attachment.id)}
        <div class="chat-input-attachment-wrapper" role="listitem">
          <ChatAttachmentPreview {attachment} />
          <button
            type="button"
            class="chat-input-attachment-remove"
            onclick={() => removeAttachment(attachment.id)}
            aria-label={`Remove ${attachment.file.name}`}
          >
            <X class="icon-xs" />
          </button>
        </div>
      {/each}
    </div>
  {/if}

  <!-- Editor area -->
  <div class="chat-input-editor-container">
    <MarkdownEditor
      id={`${id}-editor`}
      bind:value
      bind:this={editorRef}
      {placeholder}
      readonly={disabled || sending}
      showToolbar={false}
      showModeToggle={false}
      class="chat-input-editor"
    />
  </div>

  <!-- Footer with actions -->
  <div class="chat-input-footer">
    <div class="chat-input-footer-left">
      {#if allowAttachments}
        <input
          bind:this={fileInputRef}
          id={`${id}-file-picker`}
          type="file"
          accept={acceptedTypes.join(',')}
          multiple
          class="sr-only"
          onchange={handleFileSelect}
          aria-label="Attach files"
          tabindex={-1}
        />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onclick={() => fileInputRef?.click()}
          disabled={disabled || sending}
          aria-label="Attach file"
        >
          <Paperclip class="icon-sm" />
        </Button>
      {/if}

      <span id={hintId} class="chat-input-hint">
        <kbd>Enter</kbd> to send, <kbd>Shift</kbd>+<kbd>Enter</kbd> for newline
      </span>
    </div>

    <div class="chat-input-footer-right">
      {#if actions}
        {@render actions()}
      {/if}

      {#if showStopButton}
        <!-- Stop button: replaces send button during streaming when onstop is provided -->
        <button
          type="button"
          class="chat-input-send"
          data-stop
          onclick={onstop}
          aria-label="Stop generating"
        >
          <Square class="icon-sm" />
        </button>
      {:else}
        <!-- Send button: shows spinner when sending (without onstop), otherwise arrow -->
        <button
          type="submit"
          class="chat-input-send"
          disabled={!canSubmit}
          aria-label={sending ? 'Sending message' : 'Send message'}
          aria-describedby={hintId}
        >
          {#if sending}
            <svg
              class="chat-input-spinner"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <circle
                class="spinner-track"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                stroke-width="4"
              ></circle>
              <path
                class="spinner-head"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              ></path>
            </svg>
          {:else}
            <ArrowUp class="icon-sm" />
          {/if}
        </button>
      {/if}
    </div>
  </div>

  <!-- Error display -->
  {#if error}
    <p id={errorId} class="chat-input-error" role="alert">
      {error}
    </p>
  {/if}

  <!-- Screen reader announcements -->
  <div aria-live="polite" aria-atomic="true" class="sr-only">
    {announcer.message}
  </div>
</form>

<style>
  .chat-input {
    container-type: inline-size;
    display: flex;
    flex-direction: column;
    gap: var(--cinder-space-2);
    background: var(--cinder-surface);
    border: 1px solid var(--cinder-border);
    border-radius: var(--cinder-radius-lg);
    padding: var(--cinder-space-3);
    transition: border-color var(--cinder-duration-fast) var(--cinder-ease-standard);
  }

  .chat-input:focus-within {
    border-color: var(--cinder-accent);
  }

  .chat-input-dragover {
    border-style: dashed;
    border-color: var(--cinder-accent);
    background: color-mix(in oklch, var(--cinder-accent), transparent 95%);
  }

  /* Attachment previews */
  .chat-input-attachments {
    display: flex;
    flex-wrap: wrap;
    gap: var(--cinder-space-2);
  }

  /* Wrapper allows remove button to extend beyond image bounds without clipping */
  .chat-input-attachment-wrapper {
    position: relative;
    /* Add padding to accommodate the extended touch target */
    padding-top: var(--cinder-space-2);
    padding-inline-end: var(--cinder-space-2);
  }

  .chat-input-attachment-remove {
    position: absolute;
    /* Position so visual center aligns with top-right corner of image.
       Wrapper has 8px padding, button is 44px (22px to center).
       To center button at image corner: padding - (button_size / 2) = 8px - 22px = -14px */
    top: calc(var(--cinder-space-2) - var(--cinder-touch-target-min) / 2);
    right: calc(var(--cinder-space-2) - var(--cinder-touch-target-min) / 2);
    display: flex;
    align-items: center;
    justify-content: center;
    /* WCAG 2.2 AA compliant touch target with visual icon inside */
    width: var(--cinder-touch-target-min);
    height: var(--cinder-touch-target-min);
    padding: 0;
    /* Transparent background with centered visible circle */
    background: transparent;
    border: none;
    border-radius: var(--cinder-radius-full);
    cursor: pointer;
    color: white;
    opacity: 0;
    transition:
      opacity var(--cinder-duration-fast) var(--cinder-ease-standard),
      background var(--cinder-duration-fast) var(--cinder-ease-standard);
  }

  /* Visible circular background - smaller than touch target, centered */
  .chat-input-attachment-remove::before {
    content: '';
    position: absolute;
    top: 50%;
    left: 50%;
    width: 1.25rem;
    height: 1.25rem;
    background: oklch(0% 0 0 / 70%);
    border-radius: var(--cinder-radius-full);
    transform: translate(-50%, -50%);
    transition: background var(--cinder-duration-fast) var(--cinder-ease-standard);
    z-index: -1;
  }

  .chat-input-attachment-remove:hover::before {
    background: var(--cinder-danger);
  }

  .chat-input-attachment-wrapper:hover .chat-input-attachment-remove,
  .chat-input-attachment-wrapper:focus-within .chat-input-attachment-remove {
    opacity: 1;
  }

  .chat-input-attachment-remove:focus-visible {
    opacity: 1;
    outline: 2px solid var(--cinder-accent);
    outline-offset: -12px; /* Offset inward to align with visual button */
  }

  /* Touch devices: always show remove button */
  @media (hover: none) {
    .chat-input-attachment-remove {
      opacity: 1;
    }
  }

  /* Editor container */
  .chat-input-editor-container {
    --editor-min-height: 2.5rem;
  }

  .chat-input-editor-container :global(.markdown-editor-wrapper) {
    min-height: auto;
    gap: 0;
  }

  .chat-input-editor-container :global(.markdown-editor) {
    min-height: 2.5rem;
    max-height: 12rem;
    overflow-y: auto;
    border: none;
    padding: 0;
    background: transparent;
    border-radius: 0;
  }

  .chat-input-editor-container :global(.markdown-editor:focus-within) {
    border-color: transparent;
    box-shadow: none;
    outline: none;
  }

  /* Remove focus ring from the inner textarea - the container handles focus styling */
  .chat-input-editor-container :global(textarea.markdown-editor:focus) {
    border-color: transparent;
    outline: none;
    box-shadow: none;
  }

  /* Remove focus ring from ProseMirror when inside chat input */
  .chat-input-editor-container :global(.ProseMirror:focus) {
    outline: none;
  }

  .chat-input-editor-container :global(.ProseMirror) {
    padding: var(--cinder-space-1) 0;
    min-height: 2.5rem;
  }

  /* Footer */
  .chat-input-footer {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: var(--cinder-space-2);
  }

  .chat-input-footer-left,
  .chat-input-footer-right {
    display: flex;
    align-items: flex-end;
    gap: var(--cinder-space-2);
  }

  .chat-input-hint {
    font-size: var(--cinder-text-xs);
    color: var(--cinder-text-subtle);
  }

  .chat-input-hint kbd {
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

  /* Hide hint on narrow containers */
  @container (max-width: 320px) {
    .chat-input-hint {
      display: none;
    }
  }

  /* Send button - circular icon button
   * Uses --cinder-touch-target-min (44px) for WCAG 2.2 AA touch target compliance */
  .chat-input-send {
    display: flex;
    align-items: center;
    justify-content: center;
    width: var(--cinder-touch-target-min);
    height: var(--cinder-touch-target-min);
    padding: 0;
    border: none;
    border-radius: var(--cinder-radius-full);
    background: var(--cinder-accent);
    color: var(--cinder-accent-contrast);
    cursor: pointer;
    transition:
      background var(--cinder-duration-fast) var(--cinder-ease-standard),
      transform var(--cinder-duration-fast) var(--cinder-ease-standard);
  }

  .chat-input-send:hover:not(:disabled) {
    background: color-mix(in oklch, var(--cinder-accent), black 15%);
  }

  .chat-input-send:active:not(:disabled) {
    transform: scale(0.95);
  }

  .chat-input-send:disabled {
    background: var(--cinder-surface-inset);
    color: var(--cinder-text-disabled);
    cursor: not-allowed;
  }

  .chat-input-send:focus-visible {
    outline: 2px solid transparent;
    box-shadow:
      0 0 0 var(--cinder-ring-offset) var(--cinder-ring-offset-color),
      0 0 0 calc(var(--cinder-ring-offset) + var(--cinder-ring-width)) var(--cinder-accent);
  }

  /* Stop button variant - danger-tinted to signal urgency during streaming */
  .chat-input-send[data-stop] {
    background: color-mix(in oklch, var(--cinder-danger), transparent 85%);
    color: var(--cinder-danger);
    border: 1px solid color-mix(in oklch, var(--cinder-danger), transparent 60%);
  }

  .chat-input-send[data-stop]:hover {
    background: color-mix(in oklch, var(--cinder-danger), transparent 75%);
    border-color: var(--cinder-danger);
  }

  .chat-input-send[data-stop]:focus-visible {
    box-shadow:
      0 0 0 var(--cinder-ring-offset) var(--cinder-ring-offset-color),
      0 0 0 calc(var(--cinder-ring-offset) + var(--cinder-ring-width)) var(--cinder-danger);
  }

  /* Spinner */
  .chat-input-spinner {
    width: 1rem;
    height: 1rem;
    animation: spin 1s linear infinite;
  }

  .spinner-track {
    opacity: 0.25;
  }

  .spinner-head {
    opacity: 0.75;
  }

  /* Error */
  .chat-input-error {
    margin: 0;
    font-size: var(--cinder-text-xs);
    color: var(--cinder-danger);
  }

  /* Screen reader only */
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
