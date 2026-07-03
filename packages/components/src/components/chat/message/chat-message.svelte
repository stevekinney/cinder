<script lang="ts" module>
  import type { Snippet } from 'svelte';
  import type { HTMLAttributes } from 'svelte/elements';
  import type { Message, ToolCallPair } from '../conversation-model.ts';
  import type { MessagePartOverride } from './chat-message-parts.ts';
  import type { StepInfo } from '../utilities/types.ts';

  /**
   * Role labels for display purposes.
   * Maps message roles to human-readable labels.
   */
  export const ROLE_LABELS: Record<Message['role'], string> = {
    user: 'You',
    assistant: 'Assistant',
    system: 'System',
    developer: 'Developer',
    'tool-call': 'Tool Call',
    'tool-result': 'Tool Result',
    snapshot: 'Snapshot',
  };

  export type ChatMessageProps = Omit<HTMLAttributes<HTMLElement>, 'class'> & {
    /** The message to render */
    message: Message;
    /** Paired tool calls (from pairToolCallsWithResults) - used for tool-call messages */
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
    /**
     * Per-part render override. Forwarded to the parts renderer; lets a consumer
     * replace the rendering of an individual body part while delegating the rest
     * to the built-ins (inversion of control — see the renderer).
     */
    messagePart?: MessagePartOverride | undefined;
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
    /** The set of approved tool call IDs for deriving approval state. */
    approvedToolCallIds?: ReadonlySet<string> | undefined;
    /** The set of denied tool call IDs for deriving denial state. */
    deniedToolCallIds?: ReadonlySet<string> | undefined;
    /** Called when the user approves an action-required tool call. */
    onapprove?: ((toolCallId: string) => void) | undefined;
    /** Called when the user denies an action-required tool call. */
    ondeny?: ((toolCallId: string) => void) | undefined;
    /**
     * Reasoning text to surface as a collapsible block before the body.
     * When present and non-empty, a `reasoning` part is prepended to the derived parts.
     */
    reasoning?: string | undefined;
    /**
     * Step list to surface as a stepper before the body.
     * Each entry maps to one `step` part in the derived parts.
     */
    steps?: ReadonlyArray<StepInfo> | undefined;
    /** Whether the reasoning disclosure is expanded. Owned by the container's reasoning state. */
    reasoningExpanded?: boolean | undefined;
    /** Called when the reasoning disclosure toggle is activated. */
    onreasoning?: (() => void) | undefined;
    /**
     * Whether the tool-call card disclosure is expanded. Collapsed by default —
     * kept separate from `expanded` (which drives markdown "Show more/less"),
     * since a tool-call message never carries a markdown body. Bindable, like
     * `expanded`: the `Chat` container drives it from its own per-message
     * disclosure state (one-way, via `ontoolcalltoggle`), but a standalone
     * `ChatMessage` used outside `Chat` still gets working, self-contained
     * disclosure with no wiring required.
     */
    toolCallExpanded?: boolean | undefined;
    /** Called when the tool-call card disclosure toggle is activated. */
    ontoolcalltoggle?: (() => void) | undefined;
    /**
     * Suggestion labels to surface as clickable chips after the body.
     * Each entry maps to one `suggestion` part in the derived parts.
     */
    suggestions?: ReadonlyArray<string> | undefined;
    /** Called when the user selects a suggestion chip. */
    onsuggestionselect?: ((label: string) => void) | undefined;
  };
</script>

<script lang="ts">
  import { classNames } from '../../../utilities/class-names.ts';
  import { deriveMessageParts, getMessageText } from '../utilities/utilities.js';
  import Pencil from 'lucide-svelte/icons/pencil';
  import RotateCcw from 'lucide-svelte/icons/rotate-ccw';
  import CopyButton from '../../copy-button/copy-button.svelte';
  import ChatMessagePartsRenderer from './chat-message-parts-renderer.svelte';

  let {
    message,
    toolCallPairs = [],
    expanded = $bindable(true),
    class: className,
    searchMatch = false,
    actions,
    status,
    messagePart,
    showDefaultActions = true,
    streaming = false,
    overrideContent,
    onexpandedchange,
    onretry,
    onedit,
    approvedToolCallIds,
    deniedToolCallIds,
    onapprove,
    ondeny,
    reasoning,
    steps,
    suggestions,
    reasoningExpanded = false,
    onreasoning,
    toolCallExpanded = $bindable(false),
    ontoolcalltoggle,
    onsuggestionselect,
    tabindex,
    ...rest
  }: ChatMessageProps = $props();

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

  // Derived values for content processing. `textContent` drives message chrome
  // (copy, edit, the Show more/less control) — the rendered body itself flows
  // through deriveMessageParts + the parts renderer below.
  const textContent = $derived(getMessageText(message));
  const roleLabel = $derived(ROLE_LABELS[message.role] ?? message.role);

  // Role detection — kept for wrapper-level layout + a11y (data-tool-pair,
  // aria-label). The body branches that used to live here are now derived parts.
  const isToolCall = $derived(message.role === 'tool-call');

  // Find matching tool pair for tool-call messages. Resolved here (the container
  // hands down the pairs for this message) and threaded into deriveMessageParts
  // so the bridge stays pure; also gates the data-tool-pair wrapper styling.
  const toolPair = $derived.by(() => {
    if (!isToolCall || !message.toolCall) return null;
    return toolCallPairs.find((pair) => pair.call.id === message.toolCall?.id) ?? null;
  });

  // The cinder-owned render parts for this message. The streaming override and
  // expanded state are resolved into the parts here so the renderer + part
  // components stay dumb (no override/streaming plumbing leaks into them).
  // C3: approval id sets are threaded in so tool-approval parts derive their
  // `approved` state without mutating the transcript.
  const messageParts = $derived(
    deriveMessageParts(message, {
      toolCallPair: toolPair ?? undefined,
      overrideContent,
      streaming,
      expanded,
      approvedToolCallIds,
      deniedToolCallIds,
      // C4: reasoning and steps are UI-only overlays derived from metadata or
      // explicit per-message props; never written back to the transcript.
      reasoning,
      steps,
      // C5: suggestions are UI-only overlays; never written back to the transcript.
      suggestions,
    }),
  );

  // Whether this message has a markdown body part — gates the Show more/less
  // control (a tool-call/tool-result message has no markdown body to truncate).
  const hasMarkdownBody = $derived(messageParts.some((part) => part.type === 'markdown'));

  // Split the parts so the rendered DOM matches the historical structure: body
  // parts (text/markdown/tool) live inside `.chat-message-body`, image parts
  // render as a sibling AFTER it — exactly where MessageAttachments used to sit,
  // so the flex layout and spacing are unchanged.
  const bodyParts = $derived(messageParts.filter((part) => part.type !== 'image'));
  const imageParts = $derived(messageParts.filter((part) => part.type === 'image'));

  // Content truncation threshold (characters)
  const TRUNCATE_THRESHOLD = 500;

  // Accessibility IDs
  const messageId = $derived(`message-${message.id}`);
  const roleId = $derived(`${messageId}-role`);

  function toggleExpanded() {
    expanded = !expanded;
    onexpandedchange?.(expanded);
  }

  // Local fallback so a standalone <ChatMessage> (used outside <Chat>, with no
  // ontoolcalltoggle wired up) still has a working disclosure — mirrors
  // toggleExpanded above. When Chat DOES own this message's disclosure, it
  // passes toolCallExpanded down one-way (not bind:) and reads/writes its own
  // state via ontoolcalltoggle; this local flip is then a harmless echo that
  // gets overwritten by the container's next render. onexpandedchange also
  // fires here (not just ontoolcalltoggle) to preserve the pre-split contract,
  // where a single expanded/onexpandedchange pair covered every disclosure on
  // the message, including tool-call cards.
  function toggleToolCallExpanded() {
    toolCallExpanded = !toolCallExpanded;
    ontoolcalltoggle?.();
    onexpandedchange?.(toolCallExpanded);
  }
</script>

<div
  class={classNames('chat-message-wrapper', className)}
  data-role={message.role}
  data-hidden={message.hidden || undefined}
  data-failed={isFailed || undefined}
  data-search-match={searchMatch || undefined}
  data-tool-pair={isToolCall && toolPair ? '' : undefined}
  {...rest}
>
  <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
  <article
    id={messageId}
    class="chat-message"
    aria-labelledby={isToolCall && toolPair ? undefined : roleId}
    aria-label={isToolCall && toolPair ? `Tool call: ${toolPair.call.name}` : undefined}
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
      {#if isEditing}
        <!-- Edit mode replaces the body parts with a textarea, but attachments
             stay visible (they were never inside the editable body). -->
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
        <!-- Replaces the historical role-branch body: every body render shape
             (tool call, tool result, markdown text) flows through the cinder-
             owned parts spine. The renderer keeps stable DOM identity across
             streaming updates via per-part keys, so the markdown body never
             remounts as its text grows. Image parts render below, as a sibling
             of this body div, matching the historical structure. -->
        <ChatMessagePartsRenderer
          parts={bodyParts}
          {messagePart}
          expanded={toolCallExpanded}
          ontoggle={toggleToolCallExpanded}
          {onapprove}
          {ondeny}
          {reasoningExpanded}
          {onreasoning}
          {onsuggestionselect}
        />

        {#if hasMarkdownBody && textContent.length > TRUNCATE_THRESHOLD}
          <button type="button" class="chat-message-expand" onclick={toggleExpanded}>
            {expanded ? 'Show less' : 'Show more'}
          </button>
        {/if}
      {/if}
    </div>

    {#if imageParts.length > 0}
      <!-- Images render through the grouped default path (the attachment grid
           lays out by total count); they do not flow through `messagePart`. -->
      <ChatMessagePartsRenderer parts={imageParts} />
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
          <CopyButton
            value={textContent}
            label="Copy message"
            copiedLabel="Copied!"
            iconOnly
            confirmDuration={2000}
            class="chat-message-action-button chat-message-copy"
          />
        {/if}
        {#if canEdit}
          <button
            type="button"
            class="chat-message-action-button chat-message-edit-button"
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

  /* Escape hatch for a deliberate programmatic scroll-to-bottom
     (use-chat-scroll-state.svelte.ts): while `.chat-timeline` carries
     `data-cinder-force-visible`, every row lays out at its real height up
     front instead of the 180px estimate above. Without this, off-screen rows
     resize as they cross into view DURING an animated scrollTo(), which
     shifts content under a fixed pixel target and reads as a jerk right as
     the scroll finishes. */
  :global(.chat-timeline[data-cinder-force-visible]) .chat-message {
    content-visibility: visible;
  }

  /* Focus visible style for keyboard navigation */
  .chat-message:focus {
    outline: none;
  }

  .chat-message:focus-visible {
    outline: var(--cinder-ring-width) solid transparent;
    box-shadow: var(--_cinder-focus-ring-shadow);
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
    /* Anchor for absolutely-positioned user-message header (see below). */
    position: relative;
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
    background: var(--cinder-color-info-bg);
    color: var(--cinder-color-info-fg);
    text-align: center;
  }

  .chat-message-wrapper[data-role='developer'] {
    margin-inline-end: auto;
  }

  .chat-message-wrapper[data-role='developer'] .chat-message {
    background: var(--cinder-color-warning-bg);
    color: var(--cinder-color-warning-fg);
  }

  .chat-message-wrapper[data-role='tool-call'],
  .chat-message-wrapper[data-role='tool-result'] {
    margin-inline-end: auto;
    min-width: min(18rem, 100%);
    max-width: min(100%, 48rem);
  }

  .chat-message-wrapper[data-role='tool-call'] .chat-message,
  .chat-message-wrapper[data-role='tool-result'] .chat-message {
    background: var(--cinder-surface-inset);
    font-family: var(--cinder-font-mono);
    font-size: var(--cinder-text-sm);
  }

  /* When a tool-call has a paired result, ToolCallGroup is the canonical card.
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

  /* Take the header OUT of the bubble's flex flow for user messages so the
     bubble's row gap is not allocated for an empty header row, which would
     create visible empty space above the message text. `position: absolute`
     removes it from the flex axis entirely (flex `gap` applies only to
     in-flow children) while keeping it in the accessibility tree with its
     implicit role intact — `display: contents` would strip that role.
     The role label is already visually hidden via .chat-message-role below;
     do NOT clip the whole header, or any `status` snippet a consumer passes
     (e.g. "sending…", "failed") would also disappear. Anchor the header to
     the bubble's top-right so status content stays visible without
     displacing the message text. */
  .chat-message-wrapper[data-role='user'] .chat-message-header {
    position: absolute;
    inset-block-start: 0;
    inset-inline-end: 0;
    padding: 0;
    margin: 0;
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
  /* Flex column so stacked body parts (e.g. a tool-call card followed by a
     tool-approval prompt, or a step list + reasoning block + final markdown
     answer) get visible breathing room between them via `gap`. Without this,
     parts are plain block children with zero margin and sit flush against
     each other. */
  .chat-message-body {
    display: flex;
    flex-direction: column;
    gap: var(--cinder-space-3);
    font-size: var(--cinder-text-base);
    line-height: 1.6;
  }

  /* Tool-result body styling moved to tool-result-part.svelte alongside its
     markup (the parts spine now owns that body shape). */

  .chat-message-expand {
    /* .chat-message-body is a flex column now (for inter-part gap); without
       this, the default flex align-items:stretch would balloon this button to
       the container's full width instead of shrinking to its label. */
    align-self: flex-start;
    display: inline-flex;
    align-items: center;
    gap: var(--cinder-space-0-5);
    padding: var(--cinder-space-0-5) var(--cinder-space-1);
    min-height: var(--cinder-touch-target-min);
    font-size: var(--cinder-text-xs);
    font-weight: var(--cinder-font-medium);
    color: var(--cinder-accent-text);
    background: transparent;
    border: none;
    cursor: pointer;
  }

  .chat-message-expand:hover {
    text-decoration: underline;
  }

  .chat-message-expand:focus-visible {
    outline: var(--cinder-ring-width) solid transparent;
    box-shadow: var(--_cinder-focus-ring-shadow);
  }

  /* Failed message styling */
  .chat-message-wrapper[data-failed] .chat-message {
    border: 1px solid var(--cinder-color-danger-border);
    background: var(--cinder-color-danger-bg);
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
    border: 1px solid var(--cinder-color-danger-border);
    border-radius: var(--cinder-radius-sm);
    cursor: pointer;
    transition:
      background var(--cinder-duration-fast) var(--cinder-ease-standard),
      border-color var(--cinder-duration-fast) var(--cinder-ease-standard);
  }

  @media (hover: hover) {
    .chat-message-retry:hover {
      background: var(--cinder-color-danger-bg);
      border-color: var(--cinder-danger);
    }
  }

  .chat-message-retry:focus-visible {
    outline: var(--cinder-ring-width) solid transparent;
    box-shadow: var(--_cinder-focus-ring-shadow);
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
   * The footer is anchored to the wrapper's bottom edge AND to the bubble's
   * outer edge horizontally; the action button inside aligns its own bottom
   * with the wrapper bottom so it sits flush with the bubble bottom.
   * padding (not margin) creates a hover bridge so the pointer never leaves a
   * hovered surface while crossing from bubble to icon. */
  .chat-message-wrapper[data-role='user'] .chat-message-footer {
    top: auto;
    bottom: 0;
    left: auto;
    right: 100%;
    margin-top: 0;
    display: flex;
    align-items: flex-end;
    /* Padding stays physical to match the physical `right: 100%` placement
       above; the whole block is the LTR-only fast path called out in the
       comment at the top of this section. */
    /* stylelint-disable-next-line csstools/use-logical */
    padding-right: var(--cinder-space-1);
  }

  /* Assistant bubbles are left-aligned; copy icon sits to their RIGHT. */
  .chat-message-wrapper[data-role='assistant'] .chat-message-footer {
    top: auto;
    bottom: 0;
    left: 100%;
    right: auto;
    margin-top: 0;
    display: flex;
    align-items: flex-end;
    /* stylelint-disable-next-line csstools/use-logical */
    padding-left: var(--cinder-space-1);
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
    .chat-message-wrapper[data-role='tool-call'] .chat-message-footer,
    .chat-message-wrapper[data-role='tool-result'] .chat-message-footer,
    .chat-message-wrapper[data-role='snapshot'] .chat-message-footer {
      top: 100%;
      inset-inline-start: 0;
      inset-inline-end: auto;
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

  /* Shared base for the built-in copy and edit action buttons — small
   * icon-only affordances. The icon size comes from the `icon-xs` class on the
   * SVG (defined in styles/utilities.css). A transparent border reserves layout
   * space so the touch-context border swap below does not shift the icon.
   *
   * These rules use :global() because the copy button is rendered by the
   * CopyButton child component — Svelte's scoped hash would not reach an
   * element whose <button> lives in a different component's template. The edit
   * button is still a native button in this template and matches via class
   * name either way. */
  :global(.chat-message-action-button) {
    display: grid;
    place-items: center;
    box-sizing: border-box;
    min-width: var(--cinder-touch-target-min);
    min-height: var(--cinder-touch-target-min);
    padding: 0;
    background: transparent;
    border: 1px solid transparent;
    border-radius: var(--cinder-radius-sm);
    color: var(--cinder-text-muted);
    cursor: pointer;
    transition:
      color var(--cinder-duration-fast) var(--cinder-ease-standard),
      border-color var(--cinder-duration-fast) var(--cinder-ease-standard),
      background var(--cinder-duration-fast) var(--cinder-ease-standard);
  }

  @media (hover: hover) {
    :global(.chat-message-action-button:hover) {
      color: var(--cinder-text);
      background: var(--cinder-surface-hover);
    }
  }

  :global(.chat-message-action-button:focus-visible) {
    outline: var(--cinder-ring-width) solid transparent;
    box-shadow: var(--_cinder-focus-ring-shadow);
  }

  /* Touch devices: without hover discoverability, bare icons read as
   * decoration. Give the action buttons a resting surface + border so they look
   * tappable. Placed after the base rule so it wins at equal specificity; the
   * transparent base border reserves the space, so this only swaps color — no
   * layout shift. */
  @media (hover: none) or (pointer: coarse) {
    :global(.chat-message-action-button) {
      background: var(--cinder-surface-raised);
      border-color: var(--cinder-border);
    }
  }

  /* Copy success state overrides the shared color.
   * CopyButton uses `data-cinder-copied` when the copy succeeds.
   * Keep `.chat-message-copy-success` as a selector alias so existing
   * external callers that target it continue to work. */
  :global(.chat-message-copy[data-cinder-copied]) {
    color: var(--cinder-success);
  }

  /* CopyButton renders icon-sm (16px) icons by default. Override to icon-xs
   * (14px) to match the sibling edit/retry action buttons in the chat footer. */
  :global(.chat-message-copy svg) {
    width: 0.875rem;
    height: 0.875rem;
  }

  @media (hover: hover) {
    :global(.chat-message-copy[data-cinder-copied]:hover) {
      color: var(--cinder-color-success-fg);
      background: var(--cinder-color-success-bg);
    }
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
    outline: var(--cinder-ring-width) solid transparent;
    outline-offset: var(--cinder-ring-offset);
    box-shadow: var(--_cinder-focus-ring-shadow);
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

  @media (hover: hover) {
    .chat-message-edit-save:hover {
      background: color-mix(in oklch, var(--cinder-accent), black 15%);
    }
  }

  .chat-message-edit-save:focus-visible {
    outline: var(--cinder-ring-width) solid transparent;
    box-shadow: var(--_cinder-focus-ring-shadow);
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

  @media (hover: hover) {
    .chat-message-edit-cancel:hover {
      color: var(--cinder-text);
      background: var(--cinder-surface-hover);
    }
  }

  .chat-message-edit-cancel:focus-visible {
    outline: var(--cinder-ring-width) solid transparent;
    box-shadow: var(--_cinder-focus-ring-shadow);
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

  /* Forced-colors: box-shadow rings are suppressed in Windows High Contrast Mode,
     so repaint the reserved transparent outline channel with a system color.
     Text-entry focus uses Highlight; pressable regions use ButtonText.
     Placed after the base rules per the focus-ring policy's cascade note. */
  @media (forced-colors: active) {
    .chat-message-edit-textarea:focus {
      outline: var(--cinder-ring-width) solid Highlight;
      outline-offset: 1px;
    }

    .chat-message:focus-visible,
    .chat-message-expand:focus-visible,
    .chat-message-retry:focus-visible,
    :global(.chat-message-action-button:focus-visible),
    .chat-message-edit-save:focus-visible,
    .chat-message-edit-cancel:focus-visible {
      outline: var(--cinder-ring-width) solid ButtonText;
      outline-offset: 3px;
    }
  }
</style>
