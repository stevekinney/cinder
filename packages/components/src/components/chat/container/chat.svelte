<script lang="ts" module>
  import type { Attachment } from 'svelte/attachments';
  import type { ChatAdapter, ChatCommand, ChatPushHandlers } from '../adapter/chat-adapter.ts';
  import type { Message, MessageInput } from '../conversation-model.ts';
  import type { ChatAttachment } from '../input/chat-attachment.ts';

  // `ChatProps` is owned by `../chat.types.ts` (the analyzer + schema generator
  // read that symbol). The implementation imports it from there rather than
  // redeclaring it, so the public type and the `$props()` shape can never drift.
  import type { ChatProps } from '../chat.types.ts';

  export type { ChatProps };
  export type {
    ChatScrollStateChangeEvent,
    ChatStopGeneratingEvent,
    ChatSubmitEvent,
    ChatUnreadIndicatorChangeEvent,
  } from './chat-events.ts';
</script>

<script lang="ts">
  import { tick, untrack } from 'svelte';
  import { classNames } from '../../../utilities/class-names.ts';
  import { getMessages } from '../utilities';
  import { ChatMessage, ChatDateSeparator } from '../message';
  import { ChatInput } from '../input';
  import { DEFAULT_SCROLL_CONFIGURATION } from './scroll-utilities';
  import { useChatScrollState } from './use-chat-scroll-state.svelte';
  import { useChatUnreadState } from './use-chat-unread-state.svelte';
  import { useChatKeyboardNav } from './use-chat-keyboard-nav.svelte';
  import { useChatMessageGroups } from './use-chat-message-groups.svelte';
  import { useChatSearch } from './use-chat-search.svelte';
  import { useIntersection } from '../../../utilities/use-intersection.svelte.ts';
  import ChatJumpControls from './chat-jump-controls.svelte';
  import ChatStatusAnnouncer from './chat-status-announcer.svelte';
  import ChatSearchBar from './chat-search-bar.svelte';

  const noopAttachment: Attachment<HTMLElement> = () => {};

  let {
    id,
    conversation,
    isAtBottom = $bindable(true),
    unreadCount = $bindable(0),
    hasNewMessageIndicator = $bindable(false),
    class: className,
    surfaceMode = 'default',
    bottomThreshold = DEFAULT_SCROLL_CONFIGURATION.bottomThreshold,
    jumpThreshold = DEFAULT_SCROLL_CONFIGURATION.jumpThreshold,
    isStreaming = false,
    streamingStatus,
    allowAttachments = true,
    allowSearch = true,
    allowCopy = true,
    allowEditing = true,
    allowRetry = true,
    header,
    empty,
    emptyPrompts,
    messageActions,
    messageStatus,
    row,
    messagePart,
    viewportAttachment,
    adapter,
    onadaptererror,
    onpushmessage,
    ontypingchange,
    onreadreceipt,
    onsubmit,
    onretry,
    onedit,
    onstopgenerating,
    onjumptolatest,
    onscrollstatechange,
    onunreadindicatorchange,
    onexpandedchange,
    onattachmentadd,
    onattachmentremove,
    onattachmentfailure,
    ...rest
  }: ChatProps = $props();

  // ==========================================================================
  // Refs and Internal State
  // ==========================================================================

  let viewport = $state<HTMLElement | null>(null);
  let containerRef = $state<HTMLElement | null>(null);
  let inputRef:
    | {
        focus: () => void;
        clear: () => void;
        addFiles: (files: File[]) => void;
        getAttachments: () => ChatAttachment[];
      }
    | undefined;
  let searchBarRef = $state<{ focusInput: () => void } | undefined>(undefined);

  // Container-level drag-and-drop state for full-window drop zone
  let isContainerDragOver = $state(false);

  // Streaming state: separate from the Conversation to avoid re-rendering the message list
  let streamingContent = $state('');
  let streamingMessageId = $state<string | null>(null);

  // Token buffer: accumulate tokens as an array; joined and flushed once per animation frame
  // to avoid O(n²) string work from calling join() on every push.
  let tokenBuffer: string[] = [];
  // rAF handle for batching token flushes and scroll throttling during streaming
  let streamingScrollRaf: number | undefined;

  // ==========================================================================
  // Initialize Helpers
  // ==========================================================================

  const scrollState = useChatScrollState({
    getBottomThreshold: () => bottomThreshold,
    getJumpThreshold: () => jumpThreshold,
    onScrollStateChange: (event) => onscrollstatechange?.(event),
    onReachBottom: () => {
      if (unreadState.unreadCount > 0 || unreadState.hasNewMessageIndicator) {
        unreadState.markAllAsRead();
      }
    },
  });

  const unreadState = useChatUnreadState({
    onUnreadIndicatorChange: (event) => onunreadindicatorchange?.(event),
  });

  const keyboardNav = useChatKeyboardNav({
    onJumpToLatest: handleJumpToLatest,
    getScrollBehavior: scrollState.getScrollBehavior,
  });

  const messages = $derived(getMessages(conversation));

  // The conversation id as a stable VALUE dependency. The subscribe effect keys
  // on this (not on `conversation.id` read inline) so a consumer passing a fresh
  // `conversation` snapshot on every transcript update — but with the same id —
  // does not tear down and reopen the real-time subscription each render.
  const conversationId = $derived(conversation.id);

  const messageGroups = useChatMessageGroups({
    getMessages: () => messages,
  });

  const searchState = useChatSearch({
    getMessages: () => messages,
  });

  // ==========================================================================
  // Derived Values
  // ==========================================================================

  const viewportAttach = $derived(viewportAttachment ?? noopAttachment);

  // A retry/edit affordance shows when EITHER a callback OR the adapter can
  // handle it — so an adapter-only consumer (no `onretry`/`onedit`) still gets
  // working buttons, and a callback-only consumer is unchanged.
  const canRetry = $derived(onretry !== undefined || adapter?.retryMessage !== undefined);
  const canEdit = $derived(onedit !== undefined || adapter?.editMessage !== undefined);

  // Stable bottom-sentinel attachment. Wrapping useIntersection in $derived (matching
  // load-more) means the IntersectionObserver is only torn down + recreated when
  // `viewport` or `bottomThreshold` actually change — NOT on every chat re-render
  // (which is frequent during streaming and would otherwise make bottom detection flicker).
  const sentinelAttach = $derived(
    useIntersection(scrollState.handleSentinelEntry, {
      root: viewport,
      rootMargin: `0px 0px ${bottomThreshold}px 0px`,
    }),
  );

  // Accessibility IDs
  const timelineId = $derived(`${id}-timeline`);
  const inputId = $derived(`${id}-input`);
  const statusId = $derived(`${id}-status`);

  // ==========================================================================
  // Sync Bindable Props with Helper State
  // ==========================================================================

  // Sync isAtBottom from scrollState to bindable prop
  $effect(() => {
    isAtBottom = scrollState.isAtBottom;
  });

  // Sync unreadCount from unreadState to bindable prop
  $effect(() => {
    unreadCount = unreadState.unreadCount;
  });

  // Sync hasNewMessageIndicator from unreadState to bindable prop
  $effect(() => {
    hasNewMessageIndicator = unreadState.hasNewMessageIndicator;
  });

  // ==========================================================================
  // Scroll Anchoring via $effect.pre
  // ==========================================================================

  /**
   * $effect.pre runs BEFORE DOM updates.
   * We capture scroll state here and schedule scroll-to-bottom after DOM updates.
   *
   * Key pattern: Read `messages.length` synchronously to register dependency,
   * then use `tick()` to wait for DOM updates before scrolling.
   */
  $effect.pre(() => {
    if (!viewport) return;

    // Register dependency on message count
    const currentCount = messages.length;

    // Read isAtBottom without making it a dependency (prevents loops)
    const atBottom = untrack(() => scrollState.isAtBottom);

    // Skip if user initiated a smooth scroll (e.g., via jump button)
    if (scrollState.isUserScrolling) return;

    if (atBottom && currentCount > 0) {
      // Schedule scroll after DOM updates
      tick().then(() => {
        viewport?.scrollTo({ top: viewport.scrollHeight, behavior: 'instant' });
      });
    }
  });

  // ==========================================================================
  // Process Messages for Unread Detection
  // ==========================================================================

  $effect(() => {
    // Pass a getter function for isAtBottom to avoid creating a scroll dependency.
    // The effect should only re-run when messages change, not on every scroll.
    unreadState.processMessages(messages, conversation.id, () => scrollState.isAtBottom);
  });

  // ==========================================================================
  // Streaming rAF Cleanup
  // ==========================================================================

  // Cancel any pending animation frame when the component unmounts during active streaming.
  // Without this, the rAF callback fires after destruction and mutates orphaned $state.
  $effect(() => {
    return () => {
      if (streamingScrollRaf !== undefined) {
        cancelAnimationFrame(streamingScrollRaf);
        streamingScrollRaf = undefined;
      }
    };
  });

  // ==========================================================================
  // Adapter Real-Time Subscription
  // ==========================================================================

  // When an adapter exposes `subscribe`, open a real-time subscription keyed on
  // the conversation id and tear it down on cleanup. `$effect` never runs on the
  // server, so no browser guard is needed. Streaming pushes drive Chat's own
  // imperative buffer (so a push-driven stream is self-contained); transcript /
  // peripheral pushes forward to the consumer (Chat never mutates `conversation`).
  //
  // The effect re-subscribes ONLY when the adapter reference or the
  // `conversationId` VALUE changes — keying on the derived id value (not on
  // `conversation.id` read inline) means a new `conversation` snapshot bearing
  // the same id does not churn the subscription. The forwarding callbacks are
  // read through `untrack` at invocation time so a consumer passing inline arrow
  // functions (whose identity churns every render) does not tear down and reopen
  // the transport on every render — each handler still calls the LATEST callback,
  // it just isn't a dependency of the subscription effect.
  $effect(() => {
    const resolvedAdapter = adapter;
    if (!resolvedAdapter?.subscribe) return;

    const currentConversationId = conversationId;
    const handlers: ChatPushHandlers = {
      onMessage: (message) => untrack(() => onpushmessage)?.(message),
      onTypingChange: (isTyping) => untrack(() => ontypingchange)?.(isTyping),
      onReadReceipt: (event) => untrack(() => onreadreceipt)?.(event),
      onStreamBegin: (messageId) => beginStreaming(messageId),
      onTokenPush: (token) => pushToken(token),
      onStreamEnd: () => endStreaming(),
    };

    const unsubscribe = resolvedAdapter.subscribe(currentConversationId, handlers);

    // Teardown: close the transport (guarding a contract-violating non-function
    // return so a bad adapter can't crash Svelte's cleanup) AND clear the
    // imperative streaming buffer. Without the `endStreaming()`, a resubscribe or
    // conversation switch mid-stream (no `onStreamEnd` fired) would leave
    // `streamingMessageId`/`streamingContent` driving a row — and a same-id
    // message in the new transcript would pick up the stale stream.
    return () => {
      if (typeof unsubscribe === 'function') unsubscribe();
      endStreaming();
    };
  });

  // ==========================================================================
  // Create Scroll Attachment
  // ==========================================================================

  const scrollAttachment = scrollState.createScrollAttachment();

  // ==========================================================================
  // Actions
  // ==========================================================================

  function handleJumpToLatest(): void {
    scrollState.jumpToLatest(viewport, () => {
      unreadState.markAllAsRead();
      onjumptolatest?.();
    });
  }

  // ==========================================================================
  // Command Dispatch (callbacks + optional adapter, one path)
  // ==========================================================================

  // One internal path for every user command so callback-driven and
  // adapter-driven usage behave identically. The adapter method takes
  // precedence when present (a transport owner); otherwise the callback fires.
  //
  // "Present" is decided by `runAdapterMethod` returning a value (not by the
  // method's own return value): the call site returns `undefined` ONLY when the
  // adapter lacks that optional method, and otherwise returns the method's
  // result wrapped in `Promise.resolve(...)`. This means a synchronously-
  // returning adapter method (one that resolves to `undefined` rather than a
  // promise) is still treated as "handled" — the callback does NOT also fire, so
  // there's no double-dispatch even for a type-violating sync method.
  //
  // The whole adapter path is wrapped so BOTH a rejected promise AND a
  // synchronous throw from the adapter route to `onadaptererror` rather than
  // escaping. `onadaptererror` is scoped to ADAPTER failures only — the fallback
  // callback path is the consumer's own code, so a throw there propagates
  // synchronously rather than being converted into a rejected dispatcher promise.
  function dispatchCommand(
    command: ChatCommand,
    runAdapterMethod: (adapter: ChatAdapter) => Promise<void> | undefined,
    callback: (() => void) | undefined,
  ): Promise<void> | void {
    if (adapter) {
      try {
        const run = runAdapterMethod(adapter);
        // `undefined` means the adapter has no such method → fall through to the
        // callback. Any other return (a promise, including one wrapping a sync
        // `undefined` result) means the adapter handled it — never fire the callback.
        if (run !== undefined) {
          return run.catch((error: unknown) => {
            onadaptererror?.({ command, error });
          });
        }
      } catch (error) {
        onadaptererror?.({ command, error });
        return;
      }
    }
    callback?.();
  }

  function handleSubmit(message: MessageInput, attachments: ChatAttachment[]): void {
    // Fire-and-forget the command (the dispatcher owns awaiting + error routing);
    // scroll immediately so the round-trip latency never delays the auto-scroll.
    // `Promise.resolve(...)` normalizes a sync-returning method to a promise so
    // the dispatcher always treats a present method as "handled" (sendMessage is
    // required, so it's always present here).
    void dispatchCommand(
      'sendMessage',
      (resolvedAdapter) => Promise.resolve(resolvedAdapter.sendMessage(message, attachments)),
      () => onsubmit?.({ message, attachments }),
    );

    // Auto-scroll after sending
    scrollState.setIsAtBottom(true);
    tick().then(() => {
      viewport?.scrollTo({ top: viewport.scrollHeight, behavior: 'instant' });
    });
  }

  function handleRetry(messageId: string): void {
    void dispatchCommand(
      'retryMessage',
      // Return `undefined` ONLY when the optional method is absent; otherwise
      // wrap its result so a present-but-sync method still counts as handled.
      (resolvedAdapter) =>
        resolvedAdapter.retryMessage
          ? Promise.resolve(resolvedAdapter.retryMessage(messageId))
          : undefined,
      () => onretry?.(messageId),
    );
  }

  function handleEdit(event: { messageId: string; content: string }): void {
    void dispatchCommand(
      'editMessage',
      (resolvedAdapter) =>
        resolvedAdapter.editMessage
          ? Promise.resolve(resolvedAdapter.editMessage(event))
          : undefined,
      () => onedit?.(event),
    );
  }

  function handleStopGenerating(): void {
    // Find the streaming message (last assistant message)
    // Using backwards loop instead of findLast() for broader browser compatibility
    let streamingMessage: Message | undefined;
    for (let i = messages.length - 1; i >= 0; i--) {
      const message = messages[i];
      if (message?.role === 'assistant') {
        streamingMessage = message;
        break;
      }
    }
    if (streamingMessage) {
      // Local name avoids shadowing the module-level `streamingMessageId` $state.
      const targetMessageId = streamingMessage.id;
      void dispatchCommand(
        'stopGenerating',
        (resolvedAdapter) =>
          resolvedAdapter.stopGenerating
            ? Promise.resolve(resolvedAdapter.stopGenerating(targetMessageId))
            : undefined,
        () => onstopgenerating?.({ messageId: targetMessageId }),
      );
    }
  }

  function handlePromptClick(prompt: string): void {
    // Filter to only ready attachments — pending ones have not yet resolved their
    // textContent, so forwarding them would produce an inconsistent payload compared
    // to the regular send-button flow which also filters on 'ready'.
    const currentAttachments = (inputRef?.getAttachments() ?? []).filter(
      (a) => a.status === 'ready',
    );
    handleSubmit({ role: 'user', content: prompt }, currentAttachments);
    inputRef?.clear();
  }

  function handleKeyDown(event: KeyboardEvent): void {
    // Intercept Ctrl+F / Cmd+F to open in-app search instead of browser search.
    // If the search bar is already open, refocus its input rather than being a no-op.
    if (allowSearch && (event.ctrlKey || event.metaKey) && event.key === 'f') {
      event.preventDefault();
      if (searchState.isOpen) {
        searchBarRef?.focusInput();
      } else {
        searchState.open();
      }
      return;
    }

    // Let the chat keyboard nav helper handle all other shortcuts.
    // The keyboard nav only handles Home/End/PageUp/PageDown/Arrow keys, so
    // Enter and Escape pass through without conflict when the search bar is open.
    // The search bar's own onkeydown handles Enter/Escape directly on its input.
    keyboardNav.handleKeyDown(event, viewport);
  }

  // Scroll to the currently matched message when the current match changes
  $effect(() => {
    const match = searchState.currentMatch;
    if (!match || !viewport) return;

    const messageElement = viewport.querySelector<HTMLElement>(
      `#message-${CSS.escape(match.message.id)}`,
    );
    if (messageElement) {
      messageElement.scrollIntoView({ behavior: 'auto', block: 'nearest' });
    }
  });

  // ==========================================================================
  // Container-Level Drag and Drop
  // ==========================================================================

  function handleContainerDrop(event: DragEvent): void {
    // Only intercept file drops — text/URL drops should not have their
    // default behavior suppressed, matching the dragover guard above.
    if (!event.dataTransfer?.types.includes('Files')) return;
    isContainerDragOver = false;

    if (!allowAttachments) return;
    event.preventDefault();

    const files = event.dataTransfer.files;
    if (files.length > 0) {
      inputRef?.addFiles(Array.from(files));
    }
  }

  function handleContainerDragOver(event: DragEvent): void {
    // Only intercept file drags — text/URL drags should not show the file drop overlay
    // or have their default behavior suppressed.
    if (!event.dataTransfer?.types.includes('Files')) return;
    if (!allowAttachments) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
    isContainerDragOver = true;
  }

  function handleContainerDragLeave(event: DragEvent): void {
    // Only clear if leaving the container entirely (not entering a child)
    const container = event.currentTarget as HTMLElement;
    if (!container.contains(event.relatedTarget as Node)) {
      isContainerDragOver = false;
    }
  }

  // Capture-phase drop listener: resets the overlay even when a child (e.g. ChatInput)
  // calls stopPropagation() on the drop event, which prevents the bubbling ondrop handler
  // on this container from ever firing.
  $effect(() => {
    if (!containerRef) return;
    function resetDragOver(event: DragEvent): void {
      if (event.dataTransfer?.types.includes('Files')) {
        isContainerDragOver = false;
      }
    }
    containerRef.addEventListener('drop', resetDragOver, { capture: true });
    return () => {
      containerRef?.removeEventListener('drop', resetDragOver, { capture: true });
    };
  });

  // ==========================================================================
  // Imperative API
  // ==========================================================================

  export function scrollToBottom(): void {
    scrollState.scrollToBottom(viewport);
  }

  export function scrollToTop(): void {
    scrollState.scrollToTop(viewport);
  }

  export function focusInput(): void {
    inputRef?.focus();
  }

  /**
   * Begin streaming content for a specific message.
   * The message should already exist in the conversation.
   * Replaces the typing indicator dots with actual content.
   * Cancels any pending rAF from a prior pushToken call so a stale flush does
   * not overwrite the fresh stream if beginStreaming is called without a
   * preceding endStreaming.
   */
  export function beginStreaming(messageId: string): void {
    if (streamingScrollRaf !== undefined) {
      cancelAnimationFrame(streamingScrollRaf);
      streamingScrollRaf = undefined;
    }
    streamingMessageId = messageId;
    streamingContent = '';
    tokenBuffer = [];
  }

  /**
   * Append a token to the streaming content buffer.
   * Tokens are accumulated in an array and flushed (joined once) per animation frame,
   * avoiding O(n²) work from calling join() on every individual token push.
   * Scroll updates are batched in the same frame to avoid excessive layout work.
   */
  export function pushToken(token: string): void {
    tokenBuffer.push(token);

    // Batch the join + scroll update to once per animation frame.
    // Without this, join() is O(n) per push → O(n²) total across the stream.
    if (streamingScrollRaf === undefined) {
      streamingScrollRaf = requestAnimationFrame(() => {
        streamingScrollRaf = undefined;
        // Flush: join the entire buffer once per frame
        streamingContent = tokenBuffer.join('');
        // Auto-scroll if at bottom
        if (scrollState.isAtBottom && viewport) {
          viewport.scrollTo({ top: viewport.scrollHeight, behavior: 'instant' });
        }
      });
    }
  }

  /**
   * End streaming for the current message.
   * The message's final content should already be committed to the Conversation.
   * Cancels any pending rAF flush so the stale buffer is not written after endStreaming.
   */
  export function endStreaming(): void {
    if (streamingScrollRaf !== undefined) {
      cancelAnimationFrame(streamingScrollRaf);
      streamingScrollRaf = undefined;
    }
    streamingMessageId = null;
    streamingContent = '';
    tokenBuffer = [];
  }
</script>

<div
  bind:this={containerRef}
  {id}
  class={classNames('chat-container', className)}
  data-surface-mode={surfaceMode}
  role="region"
  aria-label="Chat conversation"
  onkeydown={handleKeyDown}
  ondrop={handleContainerDrop}
  ondragover={handleContainerDragOver}
  ondragleave={handleContainerDragLeave}
  {...rest}
>
  {#if isContainerDragOver && allowAttachments}
    <div class="chat-drop-overlay" aria-hidden="true">
      <span class="chat-drop-label">Drop files here</span>
    </div>
  {/if}
  {#if header}
    <div class="chat-header">
      {@render header()}
    </div>
  {/if}

  {#if allowSearch && searchState.isOpen}
    <ChatSearchBar
      bind:this={searchBarRef}
      instanceId={id}
      query={searchState.query}
      matchCount={searchState.matchCount}
      currentMatchIndex={searchState.currentMatchIndex}
      onquerychange={searchState.setQuery}
      onnext={searchState.nextMatch}
      onprevious={searchState.previousMatch}
      onclose={searchState.close}
    />
  {/if}

  <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
  <div
    bind:this={viewport}
    id={timelineId}
    class="chat-timeline"
    role="log"
    aria-label="Messages"
    aria-describedby={statusId}
    aria-live="polite"
    aria-relevant="additions"
    tabindex="0"
    {@attach scrollAttachment}
    {@attach viewportAttach}
  >
    {#if messages.length === 0}
      {#if empty}
        {@render empty()}
      {:else}
        <div class="chat-empty" role="status">
          <p>No messages yet</p>
          {#if emptyPrompts && emptyPrompts.length > 0}
            <div class="chat-empty-prompts" role="group" aria-label="Suggested prompts">
              {#each emptyPrompts as prompt, index (index)}
                <button
                  type="button"
                  class="chat-empty-prompt"
                  onclick={() => handlePromptClick(prompt)}
                >
                  {prompt}
                </button>
              {/each}
            </div>
          {/if}
        </div>
      {/if}
    {:else}
      {#each messageGroups.messagesWithDates as item, index (item.type === 'date' ? `date-${item.date.toISOString()}` : `msg-${item.message.id}`)}
        {#if item.type === 'date'}
          <ChatDateSeparator date={item.date} />
        {:else}
          {@const message = item.message}
          {@const isFirstUnread = message.id === unreadState.firstUnreadId}
          {@const pairs = message.toolCall?.id
            ? (messageGroups.toolCallPairsByCallId.get(message.toolCall.id) ?? [])
            : []}

          {#if isFirstUnread && index > 0}
            <div class="chat-unread-divider" role="separator" aria-label="New messages below">
              <span class="chat-unread-divider-line" aria-hidden="true"></span>
              <span class="chat-unread-divider-label">New</span>
              <span class="chat-unread-divider-line" aria-hidden="true"></span>
            </div>
          {/if}

          {@const isStreamingMessage = streamingMessageId === message.id}
          {@const isCurrentSearchMatch =
            searchState.isOpen &&
            searchState.currentMatch !== null &&
            searchState.currentMatch.message.id === message.id}

          <!-- The built-in row. Wrapped in a snippet so the optional `row`
               override can render it (inversion of control) or replace it. The
               per-part `messagePart` override flows through into the message's
               parts renderer. -->
          {#snippet renderDefaultRow()}
            <ChatMessage
              {message}
              toolCallPairs={pairs}
              {messagePart}
              onretry={allowRetry && canRetry ? handleRetry : undefined}
              onedit={allowEditing && canEdit ? handleEdit : undefined}
              showDefaultActions={allowCopy}
              {onexpandedchange}
              streaming={isStreamingMessage}
              overrideContent={isStreamingMessage ? streamingContent : undefined}
              searchMatch={isCurrentSearchMatch}
              tabindex={-1}
            >
              {#snippet actions()}
                {#if messageActions}
                  {@render messageActions(message)}
                {/if}
              {/snippet}
              {#snippet status()}
                {#if messageStatus}
                  {@render messageStatus(message)}
                {/if}
              {/snippet}
            </ChatMessage>
          {/snippet}

          {#if row}
            {@render row(message, renderDefaultRow)}
          {:else}
            {@render renderDefaultRow()}
          {/if}
        {/if}
      {/each}

      <!-- Typing indicator when streaming but no content yet, or status label -->
      {#if isStreaming && !streamingMessageId}
        <div
          class="chat-typing-indicator"
          role="status"
          aria-label={streamingStatus ?? 'Assistant is typing'}
        >
          {#if streamingStatus}
            <span class="chat-typing-status">{streamingStatus}</span>
          {:else}
            <span class="chat-typing-dot" aria-hidden="true"></span>
            <span class="chat-typing-dot" aria-hidden="true"></span>
            <span class="chat-typing-dot" aria-hidden="true"></span>
          {/if}
        </div>
      {/if}

      <!-- Bottom sentinel for IntersectionObserver -->
      <div class="chat-bottom-sentinel" aria-hidden="true" {@attach sentinelAttach}></div>
    {/if}
  </div>

  <!-- Input Area with Jump Buttons -->
  <div class="chat-input-wrapper">
    <ChatJumpControls
      showJumpButton={scrollState.showJumpButton}
      hasNewMessageIndicator={unreadState.hasNewMessageIndicator}
      unreadCount={unreadState.unreadCount}
      displayUnreadCount={unreadState.displayUnreadCount}
      hasLargeCount={unreadState.hasLargeCount}
      onjumptolatest={handleJumpToLatest}
    />

    <!-- Input Area -->
    <div class="chat-input-area">
      <ChatInput
        id={inputId}
        bind:this={inputRef}
        onsubmit={(message, attachments) => handleSubmit(message, attachments)}
        disabled={isStreaming}
        sending={isStreaming}
        {allowAttachments}
        onstop={isStreaming ? handleStopGenerating : undefined}
        {onattachmentadd}
        {onattachmentremove}
        {onattachmentfailure}
      />
    </div>
  </div>

  <ChatStatusAnnouncer
    {statusId}
    messageCount={messages.length}
    announcerMessage={unreadState.announcerMessage}
  />
</div>

<style>
  .chat-container {
    container-type: inline-size;
    display: flex;
    flex-direction: column;
    height: 100%;
    position: relative;
    background: var(--cinder-surface);
  }

  .chat-container[data-surface-mode='transparent'] {
    background: transparent;
  }

  /* Full-window drop zone overlay */
  .chat-drop-overlay {
    position: absolute;
    inset: 0;
    z-index: 100;
    display: flex;
    align-items: center;
    justify-content: center;
    background: color-mix(in oklch, var(--cinder-accent), transparent 90%);
    border: 2px dashed var(--cinder-accent);
    border-radius: var(--cinder-radius-md);
    pointer-events: none;
  }

  .chat-drop-label {
    font-size: var(--cinder-text-lg);
    font-weight: var(--cinder-font-medium);
    color: var(--cinder-accent-text);
    background: var(--cinder-surface);
    padding: var(--cinder-space-2) var(--cinder-space-4);
    border-radius: var(--cinder-radius-md);
  }

  .chat-header {
    flex-shrink: 0;
    border-bottom: 1px solid var(--cinder-border);
  }

  /* Timeline / Message Area */
  .chat-timeline {
    flex: 1;
    overflow-y: auto;
    overflow-anchor: auto;
    padding: var(--cinder-space-4);
    display: flex;
    flex-direction: column;
    gap: var(--cinder-space-3);
  }

  /* Inset surface separates assistant bubbles (--cinder-surface) from the
   * page-level background. Only applied in default surfaceMode; embedded
   * contexts using surfaceMode="transparent" inherit their host's background. */
  .chat-container[data-surface-mode='default'] .chat-timeline {
    background: var(--cinder-surface-inset);
  }

  /* The timeline is a scrollable region; an outset ring is clipped by its own
     overflow, so paint an INSET ring (Strategy B-inset). */
  .chat-timeline:focus-visible {
    outline: var(--cinder-ring-width) solid transparent;
    box-shadow: inset 0 0 0 var(--cinder-ring-width)
      var(--_cinder-chat-timeline-ring, var(--cinder-ring-color));
  }

  @media (forced-colors: active) {
    .chat-timeline:focus-visible {
      outline: var(--cinder-ring-width) solid ButtonText;
      outline-offset: calc(var(--cinder-ring-width) * -1);
    }
  }

  /* Prevent non-last messages from being scroll anchors */
  .chat-timeline > :not(:last-child) {
    overflow-anchor: none;
  }

  /* Empty State */
  .chat-empty {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: var(--cinder-space-4);
    text-align: center;
    color: var(--cinder-text-muted);
  }

  .chat-empty-prompts {
    display: flex;
    flex-wrap: wrap;
    gap: var(--cinder-space-2);
    justify-content: center;
    max-width: 36rem;
    padding: 0 var(--cinder-space-4);
  }

  .chat-empty-prompt {
    padding: var(--cinder-space-2) var(--cinder-space-3);
    font-size: var(--cinder-text-sm);
    color: var(--cinder-text);
    background: var(--cinder-surface-raised);
    border: 1px solid var(--cinder-border);
    border-radius: var(--cinder-radius-lg);
    cursor: pointer;
    transition:
      background var(--cinder-duration-fast) var(--cinder-ease-standard),
      border-color var(--cinder-duration-fast) var(--cinder-ease-standard);
  }

  @media (hover: hover) {
    .chat-empty-prompt:hover {
      background: var(--cinder-surface-hover);
      border-color: var(--cinder-accent);
    }
  }

  .chat-empty-prompt:focus-visible {
    outline: var(--cinder-ring-width) solid transparent;
    box-shadow: var(--_cinder-focus-ring-shadow);
  }

  @media (forced-colors: active) {
    .chat-empty-prompt:focus-visible {
      outline: var(--cinder-ring-width) solid ButtonText;
      outline-offset: 3px;
    }
  }

  /* Unread Divider */
  .chat-unread-divider {
    display: flex;
    align-items: center;
    gap: var(--cinder-space-3);
    padding: var(--cinder-space-2) 0;
  }

  .chat-unread-divider-line {
    flex: 1;
    height: 1px;
    background: var(--cinder-accent);
  }

  .chat-unread-divider-label {
    display: inline-flex;
    align-items: center;
    padding: var(--cinder-space-0-5) var(--cinder-space-2);
    font-size: var(--cinder-text-xs);
    font-weight: var(--cinder-font-medium);
    color: var(--cinder-accent-text);
    background: color-mix(in oklch, var(--cinder-accent), transparent 92%);
    border-radius: var(--cinder-radius-full);
  }

  /* Bottom Sentinel (invisible) */
  .chat-bottom-sentinel {
    height: 1px;
    flex-shrink: 0;
  }

  /* Typing Indicator */
  .chat-typing-indicator {
    display: flex;
    align-items: center;
    gap: var(--cinder-space-1);
    padding: var(--cinder-space-3) var(--cinder-space-4);
    max-width: max-content;
    background: var(--cinder-surface-raised);
    border-radius: var(--cinder-radius-lg);
    animation: typing-indicator-enter var(--cinder-duration) var(--cinder-ease-decelerate);
  }

  @keyframes typing-indicator-enter {
    from {
      opacity: 0;
      transform: translateY(0.5rem);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .chat-typing-status {
    font-size: var(--cinder-text-sm);
    color: var(--cinder-text-muted);
    font-style: italic;
  }

  .chat-typing-dot {
    width: 0.5rem;
    height: 0.5rem;
    background: var(--cinder-text-muted);
    border-radius: var(--cinder-radius-full);
    animation: typing-bounce 1.4s ease-in-out infinite;
  }

  .chat-typing-dot:nth-child(1) {
    animation-delay: 0s;
  }

  .chat-typing-dot:nth-child(2) {
    animation-delay: 0.2s;
  }

  .chat-typing-dot:nth-child(3) {
    animation-delay: 0.4s;
  }

  @keyframes typing-bounce {
    0%,
    60%,
    100% {
      opacity: 0.4;
      transform: translateY(0);
    }
    30% {
      opacity: 1;
      transform: translateY(-0.25rem);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .chat-typing-dot {
      animation: typing-pulse 1.4s ease-in-out infinite;
    }

    @keyframes typing-pulse {
      0%,
      100% {
        opacity: 0.4;
      }
      50% {
        opacity: 1;
      }
    }

    /* Disable entrance animations for reduced motion */
    .chat-typing-indicator {
      animation: none;
    }
  }

  /* Input Wrapper - positions jump buttons relative to input */
  .chat-input-wrapper {
    position: relative;
    flex-shrink: 0;
  }

  /* Input Area */
  .chat-input-area {
    flex-shrink: 0;
    padding: var(--cinder-space-4);
    border-top: 1px solid var(--cinder-border);
    background: var(--cinder-surface);
  }

  .chat-container[data-surface-mode='transparent'] .chat-input-area {
    background: transparent;
  }

  /* Responsive adjustments */
  @container (max-width: 480px) {
    .chat-timeline {
      padding: var(--cinder-space-3);
      gap: var(--cinder-space-2);
    }

    .chat-input-area {
      padding: var(--cinder-space-3);
    }
  }
</style>
