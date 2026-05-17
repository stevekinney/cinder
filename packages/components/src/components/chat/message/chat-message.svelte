<script lang="ts" module>
  import type { Snippet } from 'svelte';
  import type { HTMLAttributes } from 'svelte/elements';
  import type { Message, ToolCallPair } from 'conversationalist';

  /**
   * Role labels for display purposes.
   * Maps message roles to human-readable labels.
   */
  export const ROLE_LABELS: Record<Message['role'], string> = {
    user: 'You',
    assistant: 'Assistant',
    system: 'System',
    developer: 'Developer',
    'tool-use': 'Tool Call',
    'tool-result': 'Tool Result',
    snapshot: 'Snapshot',
  };

  export type ChatMessageProps = Omit<HTMLAttributes<HTMLElement>, 'class'> & {
    /** The message to render (from conversationalist) */
    message: Message;
    /** Paired tool calls (from pairToolCallsWithResults) - used for tool-use messages */
    toolCallPairs?: ToolCallPair[];
    /** Whether long content is expanded */
    expanded?: boolean;
    /** Additional CSS class */
    class?: string;
    /** Whether this message is the active in-conversation search match */
    searchMatch?: boolean;
    /** Actions region snippet (copy, edit, retry buttons) */
    actions?: Snippet;
    /** Status indicator snippet (sending, delivered, error) */
    status?: Snippet;
    /** Show built-in copy button alongside custom actions (default: true) */
    showDefaultActions?: boolean;
    /** Whether this message is currently streaming */
    streaming?: boolean;
    /** Override content for streaming (partial token buffer) */
    overrideContent?: string | undefined;
    /** Called when expanded state changes */
    onexpandedchange?: ((expanded: boolean) => void) | undefined;
    /** Called when retry is requested on a failed message */
    onretry?: ((messageId: string) => void) | undefined;
    /** Called when user edits a message (fires with new content). Only applies to user messages. */
    onedit?: ((event: { messageId: string; content: string }) => void) | undefined;
  };
</script>

<script lang="ts">
  import { classNames } from '../../../utilities/class-names.ts';
  import { copyToClipboard } from '../../../utilities/clipboard.ts';
  import { stringify } from '../../../utilities/stringify.ts';
  import { getMessageText, getMessageParts } from '../utilities/utilities.js';
  import { Copy, Check, RotateCcw, Pencil } from '../../icons/index.ts';
  import MessageContent from './message-content.svelte';
  import MessageAttachments from './message-attachments.svelte';
  import ToolCallGroup from './tool-call-group.svelte';
  import ToolPayloadCode from './tool-payload-code.svelte';

  let {
    message,
    toolCallPairs = [],
    expanded = $bindable(true),
    class: className,
    searchMatch = false,
    actions,
    status,
    showDefaultActions = true,
    streaming = false,
    overrideContent,
    onexpandedchange,
    onretry,
    onedit,
    tabindex,
    ...rest
  }: ChatMessageProps = $props();

  // Copy button state
  let copyState = $state<'idle' | 'copied'>('idle');
  let copyTimeout: ReturnType<typeof setTimeout> | undefined;

  async function handleCopy() {
    if (!textContent) return;
    const copied = await copyToClipboard(textContent);
    if (copied) {
      copyState = 'copied';
      clearTimeout(copyTimeout);
      copyTimeout = setTimeout(() => {
        copyState = 'idle';
      }, 2000);
    }
  }

  $effect(() => {
    return () => {
      clearTimeout(copyTimeout);
    };
  });

  // Edit state
  let isEditing = $state(false);
  let editContent = $state('');
  const canEdit = $derived(message.role === 'user' && onedit !== undefined && !streaming);

  function startEditing() {
    editContent = textContent;
    isEditing = true;
  }

  function cancelEditing() {
    isEditing = false;
    editContent = '';
  }

  function saveEdit() {
    const trimmedContent = editContent.trim();
    if (trimmedContent && trimmedContent !== textContent) {
      onedit?.({ messageId: message.id, content: trimmedContent });
    }
    isEditing = false;
    editContent = '';
  }

  function handleEditKeyDown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      event.preventDefault();
      cancelEditing();
    }
    if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      saveEdit();
    }
  }

  // Detect failed delivery status from transient metadata
  const deliveryStatus = $derived(
    (message.metadata as Record<string, unknown>)?.['_deliveryStatus'] as string | undefined,
  );
  const isFailed = $derived(deliveryStatus === 'failed');

  // Derived values for content processing
  const parts = $derived(getMessageParts(message));
  const textContent = $derived(getMessageText(message));
  const roleLabel = $derived(ROLE_LABELS[message.role] ?? message.role);

  // Filter image parts from content
  const imageParts = $derived(parts.filter((part) => part.type === 'image'));
  const hasImages = $derived(imageParts.length > 0);

  // Role detection
  const isToolUse = $derived(message.role === 'tool-use');
  const isToolResult = $derived(message.role === 'tool-result');

  // Find matching tool pair for tool-use messages
  const toolPair = $derived.by(() => {
    if (!isToolUse || !message.toolCall) return null;
    return toolCallPairs.find((pair) => pair.call.id === message.toolCall?.id) ?? null;
  });

  // Safe stringify for tool result content (handles circular refs, etc.)
  // For error outcomes, prefer toolResult.error over content.
  // Return strings as-is to preserve formatting.
  const formattedToolResult = $derived.by(() => {
    if (!isToolResult || !message.toolResult) return null;
    const { outcome, content, error } = message.toolResult;

    // For errors, always prefer the error message when available.
    // This matches tool-call-group.svelte behavior and ensures users see
    // the actual error, not request metadata that may be in content.
    if (outcome === 'error' && error) {
      return error;
    }

    return stringify(content);
  });

  // Check if this is an error result for styling
  const isToolResultError = $derived(isToolResult && message.toolResult?.outcome === 'error');

  // Content truncation threshold (characters)
  const TRUNCATE_THRESHOLD = 500;

  // Accessibility IDs
  const messageId = $derived(`message-${message.id}`);
  const roleId = $derived(`${messageId}-role`);

  function toggleExpanded() {
    expanded = !expanded;
    onexpandedchange?.(expanded);
  }
</script>

<div
  class={classNames('chat-message-wrapper', className)}
  data-role={message.role}
  data-hidden={message.hidden || undefined}
  data-failed={isFailed || undefined}
  data-search-match={searchMatch || undefined}
  data-tool-pair={isToolUse && toolPair ? '' : undefined}
  {...rest}
>
  <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
  <article
    id={messageId}
    class="chat-message"
    aria-labelledby={isToolUse && toolPair ? undefined : roleId}
    aria-label={isToolUse && toolPair ? `Tool call: ${toolPair.call.name}` : undefined}
    {tabindex}
  >
    <header class="chat-message-header">
      <span id={roleId} class="chat-message-role">{roleLabel}</span>
      {#if status}
        <div class="chat-message-status">
          {@render status()}
        </div>
      {/if}
    </header>

    <div class="chat-message-body">
      {#if isToolUse && toolPair}
        <ToolCallGroup pair={toolPair} {expanded} ontoggle={toggleExpanded} />
      {:else if isToolResult && formattedToolResult !== null}
        <div class="chat-message-tool-result" data-error={isToolResultError || undefined}>
          {#if isToolResultError}
            <div class="chat-message-tool-error" role="alert">
              {formattedToolResult}
            </div>
          {:else}
            <ToolPayloadCode code={formattedToolResult} />
          {/if}
        </div>
      {:else if isEditing}
        <div class="chat-message-edit">
          <!-- svelte-ignore a11y_autofocus -->
          <textarea
            class="chat-message-edit-textarea"
            bind:value={editContent}
            onkeydown={handleEditKeyDown}
            autofocus
            aria-label="Edit message content"
            rows={Math.min(Math.max(editContent.split('\n').length, 2), 10)}
          ></textarea>
          <div class="chat-message-edit-actions">
            <button type="button" class="chat-message-edit-save" onclick={saveEdit}>
              Save & Resend
            </button>
            <button type="button" class="chat-message-edit-cancel" onclick={cancelEditing}>
              Cancel
            </button>
          </div>
        </div>
      {:else}
        <MessageContent
          content={textContent}
          {expanded}
          {streaming}
          {overrideContent}
          threshold={TRUNCATE_THRESHOLD}
        />

        {#if textContent.length > TRUNCATE_THRESHOLD}
          <button type="button" class="chat-message-expand" onclick={toggleExpanded}>
            {expanded ? 'Show less' : 'Show more'}
          </button>
        {/if}
      {/if}
    </div>

    {#if hasImages}
      <MessageAttachments images={imageParts} />
    {/if}

    {#if isFailed && onretry}
      <div class="chat-message-failed-actions">
        <span class="chat-message-failed-label" role="alert">Failed to send</span>
        <button type="button" class="chat-message-retry" onclick={() => onretry(message.id)}>
          <RotateCcw class="icon-xs" />
          Retry
        </button>
      </div>
    {/if}
  </article>

  {#if actions || (showDefaultActions && textContent) || canEdit}
    <footer class="chat-message-footer" role="none">
      <div class="chat-message-actions" role="group" aria-label="Message actions">
        {#if actions}
          {@render actions()}
        {/if}
        {#if showDefaultActions && textContent}
          <button
            type="button"
            class="chat-message-copy"
            class:chat-message-copy-success={copyState === 'copied'}
            onclick={handleCopy}
            aria-label={copyState === 'copied' ? 'Copied!' : 'Copy message'}
          >
            {#if copyState === 'copied'}
              <Check class="icon-xs" />
            {:else}
              <Copy class="icon-xs" />
            {/if}
          </button>
        {/if}
        {#if canEdit}
          <button
            type="button"
            class="chat-message-edit-button"
            onclick={startEditing}
            aria-label="Edit message"
          >
            <Pencil class="icon-xs" />
          </button>
        {/if}
      </div>
    </footer>
  {/if}
</div>

<style>
  /* Wrapper — handles layout positioning, width constraints, and hover delegation.
   * position: relative anchors the absolutely-positioned action footer below. */
  .chat-message-wrapper {
    display: flex;
    flex-direction: column;
    position: relative;
    width: fit-content;
    /* Cap at 80% of container OR 48rem (768px) for readability on wide screens */
    max-width: min(80%, 48rem);
  }

  /* Bubble — visual container for the message content */
  .chat-message {
    display: flex;
    flex-direction: column;
    gap: var(--cinder-space-1);
    padding: var(--cinder-space-2) var(--cinder-space-3);
    border-radius: var(--cinder-radius-lg);
    background: var(--cinder-surface);

    /* Performance: Skip rendering for off-screen messages in long conversations.
     * content-visibility: auto tells browser to skip layout/paint for off-screen elements.
     * contain-intrinsic-size: auto <fallback> uses cached height after render, fallback before.
     *
     * Trade-off: Before messages are rendered, scrollHeight uses the fallback estimate.
     * This can affect isAtBottom calculations for variable-height content (images, code blocks).
     * The 180px fallback is conservative to minimize scroll metric inaccuracy.
     * Once scrolled into view, actual heights are cached and metrics become accurate. */
    content-visibility: auto;
    contain-intrinsic-size: auto 180px;
  }

  /* Focus visible style for keyboard navigation */
  .chat-message:focus {
    outline: none;
  }

  .chat-message:focus-visible {
    outline: 2px solid var(--cinder-ring-color);
    outline-offset: 2px;
  }

  /* Search match highlight — subtle accent-tinted ring */
  .chat-message-wrapper[data-search-match] .chat-message {
    outline: 2px solid color-mix(in oklch, var(--cinder-accent), transparent 40%);
    outline-offset: 2px;
    background: color-mix(in oklch, var(--cinder-accent), transparent 92%);
  }

  /* Role-based alignment (on wrapper) and visual styling (on bubble) */
  .chat-message-wrapper[data-role='user'] {
    margin-inline-start: auto;
  }

  .chat-message-wrapper[data-role='user'] .chat-message {
    /* Distinctive user bubble - subtle blue tint */
    background: var(
      --user-message-background,
      color-mix(in oklch, var(--cinder-accent), transparent 88%)
    );
    border-radius: var(--cinder-radius-lg) var(--cinder-radius-lg) var(--cinder-radius-sm)
      var(--cinder-radius-lg);
  }

  .chat-message-wrapper[data-role='assistant'] {
    margin-inline-end: auto;
  }

  .chat-message-wrapper[data-role='assistant'] .chat-message {
    background: var(--cinder-surface);
    border: 1px solid var(--cinder-border-muted);
    border-radius: var(--cinder-radius-lg) var(--cinder-radius-lg) var(--cinder-radius-lg)
      var(--cinder-radius-sm);
    box-shadow: var(--cinder-shadow-sm);
  }

  .chat-message-wrapper[data-role='system'] {
    margin-inline: auto;
    max-width: min(90%, 48rem);
  }

  .chat-message-wrapper[data-role='system'] .chat-message {
    background: color-mix(in oklch, var(--cinder-info), transparent 90%);
    text-align: center;
  }

  .chat-message-wrapper[data-role='developer'] {
    margin-inline-end: auto;
  }

  .chat-message-wrapper[data-role='developer'] .chat-message {
    background: color-mix(in oklch, var(--cinder-warning), transparent 90%);
  }

  .chat-message-wrapper[data-role='tool-use'],
  .chat-message-wrapper[data-role='tool-result'] {
    margin-inline-end: auto;
    min-width: min(18rem, 100%);
    max-width: min(100%, 48rem);
  }

  .chat-message-wrapper[data-role='tool-use'] .chat-message,
  .chat-message-wrapper[data-role='tool-result'] .chat-message {
    background: var(--cinder-surface-inset);
    font-family: var(--cinder-font-mono);
    font-size: var(--cinder-text-sm);
  }

  /* When a tool-use has a paired result, ToolCallGroup is the canonical card.
   * Strip the outer bubble shell (background, border, padding, role label, footer)
   * so the unified card is the only visible boundary. The wrapper expands
   * within the same readability cap as regular bubbles — chat bubbles hug
   * their content, but a tool-call card is structural data that benefits
   * from horizontal room without stretching across the entire timeline. */
  .chat-message-wrapper[data-tool-pair] {
    width: min(80%, 48rem);
  }

  .chat-message-wrapper[data-tool-pair] .chat-message {
    background: none;
    border: none;
    padding: 0;
    border-radius: 0;
    gap: 0;
    font-family: inherit;
    font-size: inherit;
  }

  .chat-message-wrapper[data-tool-pair] .chat-message-header {
    display: none;
  }

  .chat-message-wrapper[data-tool-pair] .chat-message-footer {
    display: none;
  }

  .chat-message-wrapper[data-role='snapshot'] {
    margin-inline: auto;
  }

  .chat-message-wrapper[data-role='snapshot'] .chat-message {
    background: var(--cinder-surface-inset);
    opacity: 0.7;
  }

  .chat-message-wrapper[data-hidden] .chat-message {
    /* Use visual styling that maintains WCAG AA contrast ratios */
    border: 1px dashed var(--cinder-border-muted);
    background: color-mix(in oklch, var(--cinder-surface), var(--cinder-border-muted) 10%);
  }

  .chat-message-wrapper[data-hidden] .chat-message::before {
    content: 'Hidden';
    display: inline-block;
    font-size: var(--cinder-text-xs);
    font-weight: var(--cinder-font-medium);
    color: var(--cinder-text-muted);
    padding: var(--cinder-space-0-5) var(--cinder-space-1);
    background: var(--cinder-surface);
    border: 1px solid var(--cinder-border-muted);
    border-radius: var(--cinder-radius-sm);
    margin-inline-end: var(--cinder-space-2);
  }

  /* Header */
  .chat-message-header {
    display: flex;
    align-items: center;
    gap: var(--cinder-space-2);
    flex-wrap: wrap;
  }

  .chat-message-role {
    font-size: var(--cinder-text-xs);
    font-weight: var(--cinder-font-semibold);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--cinder-text-muted);
  }

  /* Hide role label for user messages since alignment makes it clear */
  .chat-message-wrapper[data-role='user'] .chat-message-role {
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

  .chat-message-status {
    display: flex;
    align-items: center;
    gap: var(--cinder-space-1);
  }

  /* Body */
  .chat-message-body {
    font-size: var(--cinder-text-base);
    line-height: 1.6;
  }

  .chat-message-tool-result {
    inline-size: 100%;
  }

  .chat-message-tool-error {
    padding: var(--cinder-space-3);
    background: color-mix(in oklch, var(--cinder-danger), transparent 90%);
    border-radius: var(--cinder-radius-md);
    color: var(--cinder-danger);
    font-size: var(--cinder-text-sm);
  }

  .chat-message-expand {
    display: inline-flex;
    align-items: center;
    gap: var(--cinder-space-0-5);
    margin-top: var(--cinder-space-1);
    padding: var(--cinder-space-0-5) var(--cinder-space-1);
    min-height: var(--cinder-touch-target-min);
    font-size: var(--cinder-text-xs);
    font-weight: var(--cinder-font-medium);
    color: var(--cinder-accent);
    background: transparent;
    border: none;
    cursor: pointer;
  }

  .chat-message-expand:hover {
    text-decoration: underline;
  }

  .chat-message-expand:focus-visible {
    outline: 2px solid var(--cinder-ring-color);
    outline-offset: 2px;
  }

  /* Failed message styling */
  .chat-message-wrapper[data-failed] .chat-message {
    border: 1px solid color-mix(in oklch, var(--cinder-danger), transparent 50%);
    background: color-mix(in oklch, var(--cinder-danger), transparent 95%);
  }

  .chat-message-failed-actions {
    display: flex;
    align-items: center;
    gap: var(--cinder-space-2);
    margin-top: var(--cinder-space-1);
  }

  .chat-message-failed-label {
    font-size: var(--cinder-text-xs);
    color: var(--cinder-danger);
    font-weight: var(--cinder-font-medium);
  }

  .chat-message-retry {
    display: inline-flex;
    align-items: center;
    gap: var(--cinder-space-1);
    padding: var(--cinder-space-0-5) var(--cinder-space-2);
    min-height: var(--cinder-touch-target-min);
    font-size: var(--cinder-text-xs);
    font-weight: var(--cinder-font-medium);
    color: var(--cinder-danger);
    background: transparent;
    border: 1px solid color-mix(in oklch, var(--cinder-danger), transparent 60%);
    border-radius: var(--cinder-radius-sm);
    cursor: pointer;
    transition:
      background var(--cinder-duration-fast) var(--cinder-ease-standard),
      border-color var(--cinder-duration-fast) var(--cinder-ease-standard);
  }

  .chat-message-retry:hover {
    background: color-mix(in oklch, var(--cinder-danger), transparent 90%);
    border-color: var(--cinder-danger);
  }

  .chat-message-retry:focus-visible {
    outline: 2px solid var(--cinder-ring-color);
    outline-offset: 2px;
  }

  /* Footer — absolutely positioned outside the bubble's flow so revealing it on
   * hover/focus does not change the bubble's height. Default geometry: below the
   * bubble at the leading edge, which works for any role. The user/assistant
   * rules below override this to put the icon beside the bubble on the
   * center-facing edge. Roles like developer / system / unpaired tool-result
   * inherit this default and place the footer below the bubble.
   * LTR-only: the left/right physical properties below assume left-to-right layout.
   * RTL support is a follow-up that swaps to inset-inline-start/end. */
  .chat-message-footer {
    position: absolute;
    top: 100%;
    left: 0;
    width: max-content;
    margin-top: var(--cinder-space-1);
    opacity: 0;
    pointer-events: none;
    transition: opacity var(--cinder-duration-fast) var(--cinder-ease-standard);
  }

  /* User bubbles are right-aligned; copy icon sits to their LEFT (toward chat center).
   * padding (not margin) creates a hover bridge so the pointer never leaves a
   * hovered surface while crossing from bubble to icon. */
  .chat-message-wrapper[data-role='user'] .chat-message-footer {
    top: 50%;
    left: auto;
    right: 100%;
    margin-top: 0;
    /* Padding stays physical to match the physical `right: 100%` placement
       above; the whole block is the LTR-only fast path called out in the
       comment at the top of this section. */
    /* stylelint-disable-next-line csstools/use-logical */
    padding-right: var(--cinder-space-1);
    transform: translateY(-50%);
  }

  /* Assistant bubbles are left-aligned; copy icon sits to their RIGHT. */
  .chat-message-wrapper[data-role='assistant'] .chat-message-footer {
    top: 50%;
    left: 100%;
    right: auto;
    margin-top: 0;
    /* stylelint-disable-next-line csstools/use-logical */
    padding-left: var(--cinder-space-1);
    transform: translateY(-50%);
  }

  .chat-message-wrapper:hover .chat-message-footer,
  .chat-message-wrapper:focus-within .chat-message-footer {
    opacity: 1;
    pointer-events: auto;
  }

  .chat-message-actions {
    display: flex;
    gap: var(--cinder-space-1);
  }

  /* Narrow viewports: every role falls back to below-bubble where horizontal
   * space is tight. Each selector explicitly matches the same specificity as
   * the role-specific desktop rules above ([data-role='…'] = 0-1-1), so the
   * media query actually wins inside its breakpoint. */
  @media (max-width: 480px) {
    .chat-message-wrapper[data-role='user'] .chat-message-footer,
    .chat-message-wrapper[data-role='assistant'] .chat-message-footer,
    .chat-message-wrapper[data-role='system'] .chat-message-footer,
    .chat-message-wrapper[data-role='developer'] .chat-message-footer,
    .chat-message-wrapper[data-role='tool-use'] .chat-message-footer,
    .chat-message-wrapper[data-role='tool-result'] .chat-message-footer,
    .chat-message-wrapper[data-role='snapshot'] .chat-message-footer {
      top: 100%;
      left: 0;
      right: auto;
      transform: none;
      padding-inline: 0;
      margin-top: var(--cinder-space-1);
    }
  }

  /* Touch devices: always show actions */
  @media (hover: none) or (pointer: coarse) {
    .chat-message-footer {
      opacity: 1;
      pointer-events: auto;
    }
  }

  /* Copy button — small icon-only affordance. The icon size comes from the
   * `icon-xs` class on the SVG (defined in styles/utilities.css). */
  .chat-message-copy {
    display: grid;
    place-items: center;
    min-width: var(--cinder-touch-target-min);
    min-height: var(--cinder-touch-target-min);
    padding: 0;
    background: transparent;
    border: none;
    border-radius: var(--cinder-radius-sm);
    color: var(--cinder-text-muted);
    cursor: pointer;
    transition:
      color var(--cinder-duration-fast) var(--cinder-ease-standard),
      background var(--cinder-duration-fast) var(--cinder-ease-standard);
  }

  .chat-message-copy:hover {
    color: var(--cinder-text);
    background: var(--cinder-surface-hover);
  }

  .chat-message-copy:focus-visible {
    outline: 2px solid var(--cinder-ring-color);
    outline-offset: 2px;
  }

  .chat-message-copy-success {
    color: var(--cinder-success);
  }

  .chat-message-copy-success:hover {
    color: var(--cinder-success);
    background: color-mix(in oklch, var(--cinder-success), transparent 90%);
  }

  /* Edit button (icon action button, visually identical to copy button) */
  .chat-message-edit-button {
    display: grid;
    place-items: center;
    min-width: var(--cinder-touch-target-min);
    min-height: var(--cinder-touch-target-min);
    padding: 0;
    background: transparent;
    border: none;
    border-radius: var(--cinder-radius-sm);
    color: var(--cinder-text-muted);
    cursor: pointer;
    transition:
      color var(--cinder-duration-fast) var(--cinder-ease-standard),
      background var(--cinder-duration-fast) var(--cinder-ease-standard);
  }

  .chat-message-edit-button:hover {
    color: var(--cinder-text);
    background: var(--cinder-surface-hover);
  }

  .chat-message-edit-button:focus-visible {
    outline: 2px solid var(--cinder-ring-color);
    outline-offset: 2px;
  }

  /* Edit mode */
  .chat-message-edit {
    display: flex;
    flex-direction: column;
    gap: var(--cinder-space-2);
  }

  .chat-message-edit-textarea {
    width: 100%;
    padding: var(--cinder-space-2);
    font-family: inherit;
    font-size: var(--cinder-text-base);
    line-height: 1.6;
    color: var(--cinder-text);
    background: var(--cinder-surface);
    border: 1px solid var(--cinder-accent);
    border-radius: var(--cinder-radius-md);
    resize: vertical;
    outline: none;
  }

  .chat-message-edit-textarea:focus {
    box-shadow: 0 0 0 2px color-mix(in oklch, var(--cinder-accent), transparent 75%);
  }

  .chat-message-edit-actions {
    display: flex;
    gap: var(--cinder-space-2);
    align-items: center;
  }

  .chat-message-edit-save {
    padding: var(--cinder-space-1) var(--cinder-space-3);
    min-height: var(--cinder-touch-target-min);
    font-size: var(--cinder-text-xs);
    font-weight: var(--cinder-font-medium);
    color: var(--cinder-accent-contrast);
    background: var(--cinder-accent);
    border: none;
    border-radius: var(--cinder-radius-sm);
    cursor: pointer;
    transition: background var(--cinder-duration-fast) var(--cinder-ease-standard);
  }

  .chat-message-edit-save:hover {
    background: color-mix(in oklch, var(--cinder-accent), black 15%);
  }

  .chat-message-edit-save:focus-visible {
    outline: 2px solid var(--cinder-ring-color);
    outline-offset: 2px;
  }

  .chat-message-edit-cancel {
    padding: var(--cinder-space-1) var(--cinder-space-3);
    min-height: var(--cinder-touch-target-min);
    font-size: var(--cinder-text-xs);
    font-weight: var(--cinder-font-medium);
    color: var(--cinder-text-muted);
    background: transparent;
    border: 1px solid var(--cinder-border);
    border-radius: var(--cinder-radius-sm);
    cursor: pointer;
    transition:
      background var(--cinder-duration-fast) var(--cinder-ease-standard),
      color var(--cinder-duration-fast) var(--cinder-ease-standard);
  }

  .chat-message-edit-cancel:hover {
    color: var(--cinder-text);
    background: var(--cinder-surface-hover);
  }

  .chat-message-edit-cancel:focus-visible {
    outline: 2px solid var(--cinder-ring-color);
    outline-offset: 2px;
  }

  /* Responsive sizing for narrow viewports */
  @media (max-width: 480px) {
    .chat-message-wrapper {
      /* On narrow screens, allow messages to use more of the width */
      max-width: 95%;
    }

    .chat-message {
      padding: var(--cinder-space-2) var(--cinder-space-3);
    }
  }
</style>
