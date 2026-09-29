<script lang="ts" module>
  import type { Attachment } from 'svelte/attachments';
  import type { ChatAdapter } from '../adapter/chat-adapter.ts';

  import type { ChatAttachment } from '../input/chat-attachment.ts';

  // `ChatProps` is owned by `../chat.types.ts` (the analyzer + schema generator
  // read that symbol). The implementation extends it only with private callbacks
  // used by the public wrapper's binding bridge.
  import type { ChatAnnounceLevel, ChatProps } from '../chat.types.ts';

  // The public wrapper uses callbacks instead of component bindings so SSR can
  // render this subtree once while still forwarding bindable state changes.
  type ChatImplementationProps = ChatProps & {
    onatbottombindingchange?: (value: boolean) => void;
    onunreadcountbindingchange?: (value: number) => void;
    onNewMessageIndicatorVisibleBindingChange?: (value: boolean) => void;
  };

  export type { ChatAnnounceLevel, ChatProps };
  export type {
    ChatScrollStateChangeEvent,
    ChatStopGeneratingEvent,
    ChatSubmitEvent,
    ChatUnreadIndicatorChangeEvent,
  } from './chat-events.ts';
</script>

<script lang="ts">
  import { flushSync, tick } from 'svelte';
  import { isStreamingMessage } from '../builders.ts';
  import { classNames } from '../../../utilities/class-names.ts';
  import { overflowFadeEdges } from '../../../utilities/overflow-fade-edges.ts';
  import {
    getMessageText,
    resolveMessageArtifactValue,
    resolveMessageReasoning,
    resolveMessageTranscriptEntries,
    resolveMessageSteps,
    resolveMessageSuggestions,
  } from '../utilities/index.ts';
  import { ChatMessage, ChatDateSeparator } from '../message/index.ts';
  import { ChatInput } from '../input/index.ts';
  import { DEFAULT_SCROLL_CONFIGURATION } from './scroll-utilities.ts';
  import { useChatScrollState } from './use-chat-scroll-state.svelte.ts';
  import { useChatUnreadState } from './use-chat-unread-state.svelte.ts';
  import { useChatKeyboardNav } from './use-chat-keyboard-nav.svelte.ts';
  import { useChatSearch } from './use-chat-search.svelte.ts';
  import { useIntersection } from '../../../utilities/use-intersection.svelte.ts';
  import ChatJumpControls from './chat-jump-controls.svelte';
  import ChatHistoryTrigger from './chat-history-trigger.svelte';
  import ChatStatusAnnouncer from './chat-status-announcer.svelte';
  import ChatSearchBar from './chat-search-bar.svelte';
  import {
    chatRenderRowKey,
    findRenderRowIndexByMessageId,
    type ChatRenderRow,
  } from './use-chat-message-groups.svelte.ts';
  import { ChatVirtualizer } from './use-chat-virtualizer.svelte.ts';
  import { useChatDisclosureState } from './use-chat-disclosure-state.svelte.ts';
  import type { VirtualItem } from '../../../_internal/virtual-item.ts';
  import { useChatTypingIndicator } from './use-chat-typing-indicator.svelte.ts';
  import { useChatReadReceipts } from './use-chat-read-receipts.svelte.ts';
  import ChatParticipantTyping from './chat-participant-typing.svelte';
  import ChatReadReceipt from '../message/chat-read-receipt.svelte';
  import ToolCallTimeline from '../message/tool-call-timeline.svelte';
  import { preloadMarkdownPipeline } from '../message/markdown-pipeline.ts';
  import { ConfirmDialog } from '@lostgradient/cinder';
  import { useChatStreamingState } from './use-chat-streaming-state.svelte.ts';
  import { useChatCommandActions } from './use-chat-command-actions.svelte.ts';
  import { useChatHistoryLifecycle } from './use-chat-history-lifecycle.svelte.ts';
  import { useChatHistoryRestoration } from './use-chat-history-restoration.svelte.ts';
  import { useChatAutoScroll } from './use-chat-auto-scroll.svelte.ts';
  import { useChatAnnouncements } from './use-chat-announcements.svelte.ts';
  import { useChatAdapterSubscription } from './use-chat-adapter-subscription.svelte.ts';
  import { useChatTranscript } from './use-chat-transcript.svelte.ts';
  import ChatArtifactLayout from '../artifact/chat-artifact-layout.svelte';
  import ArtifactViewer from '../artifact/artifact-viewer.svelte';
  import type { ResolvedChatArtifact } from '../artifact/artifact-viewer.types.ts';

  const noopAttachment: Attachment<HTMLElement> = () => {};
  type ChatMessageRenderRow = Extract<ChatRenderRow, { type: 'message' }>;

  let {
    id,
    conversation,
    atBottom = $bindable(true),
    unreadCount = $bindable(0),
    newMessageIndicatorVisible = $bindable(false),
    onatbottombindingchange,
    onunreadcountbindingchange,
    onNewMessageIndicatorVisibleBindingChange,
    class: className,
    surfaceMode = 'default',
    scrollFadeVisible = false,
    density = 'comfortable',
    variant = 'bubble',
    bottomThreshold = DEFAULT_SCROLL_CONFIGURATION.bottomThreshold,
    jumpThreshold = DEFAULT_SCROLL_CONFIGURATION.jumpThreshold,
    streaming = false,
    streamingStatus,
    capabilities,
    virtualized = false,
    virtualizationEstimatedRowHeight = 88,
    virtualizationOverscan = 3,
    virtualizationInitialHeight = 640,
    moreHistoryAvailable = true,
    loadEarlierLabel = 'Load earlier messages',
    loadingEarlierLabel = 'Loading earlier messages',
    header,
    empty,
    emptyPrompts,
    messageActions,
    messageStatus,
    row,
    messagePart,
    markdownNode,
    onRollback,
    viewportAttachment,
    typingParticipants,
    readReceipts,
    adapter,
    onAdapterError,
    onPushMessage,
    onTypingChange,
    onReadReceipt,
    onSubmit,
    onRetry,
    onEdit,
    onArtifactOpen,
    onApprovalResolve,
    messageReasoning,
    messageSteps,
    messageSuggestions,
    onSuggestionSelect,
    style,
    onLoadHistory,
    onStopGenerating,
    onJumpToLatest,
    onScrollStateChange,
    onUnreadIndicatorChange,
    onExpandedChange,
    onAttachmentAdd,
    onAttachmentRemove,
    onAttachmentFailure,
    onComposerInput,
    oncomposerkeydown,
    oncomposerselectionchange,
    oncomposerblur,
    composerRole,
    composerAriaExpanded,
    composerAriaControls,
    composerAriaActiveDescendant,
    composerAriaAutocomplete,
    ...rest
  }: ChatImplementationProps = $props();

  function updateAtBottomBinding(value: boolean): void {
    atBottom = value;
    onatbottombindingchange?.(value);
  }

  function updateUnreadCountBinding(value: number): void {
    unreadCount = value;
    onunreadcountbindingchange?.(value);
  }

  function updateNewMessageIndicatorVisibleBinding(value: boolean): void {
    newMessageIndicatorVisible = value;
    onNewMessageIndicatorVisibleBindingChange?.(value);
  }

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
        getValue: () => string;
        getEditorElement: () => HTMLTextAreaElement | null;
        insertAtRange: (range: { start: number; end: number }, text: string) => void;
      }
    | undefined;
  let searchBarRef = $state<{ focusInput: () => void } | undefined>(undefined);
  let historyTriggerRef = $state<{ focus: (options?: FocusOptions) => void } | undefined>(
    undefined,
  );

  // Container-level drag-and-drop state for full-window drop zone
  let isContainerDragOver = $state(false);

  // C3 — tool approval state. Keyed by tool call id. Both sets are UI-only and
  // are never written back to the transcript. A pending tool-approval part has
  // its call id in neither set (approved === undefined). Once the consumer or
  // adapter resolves the approval, the id moves into one of the sets and the
  // part re-derives to show the resolved state.

  // Per-message disclosure state (reasoning blocks + tool-call cards). UI-only;
  // never written to the transcript. Both are collapsed by default; toggling
  // triggers a virtualizer remeasure so the row's height tracks the expanded
  // content. Kept as separate instances so a message carrying both a reasoning
  // block and a tool-call card discloses each independently.
  function remeasureRow(messageId: string): void {
    if (!isVirtualized || !viewport) return;
    // Find the message row DOM node via the stable id and re-measure it so
    // the virtualizer updates the row's height after the disclosure transitions.
    const rowNode = viewport.querySelector<HTMLElement>(`#message-${CSS.escape(messageId)}`);
    if (rowNode) {
      chatVirtualizer.measureElementNode(rowNode);
    }
  }
  const reasoningState = useChatDisclosureState({ onRemeasureRow: remeasureRow });
  const toolCallState = useChatDisclosureState({ onRemeasureRow: remeasureRow });
  const stepsState = useChatDisclosureState({
    onRemeasureRow: remeasureRow,
    defaultExpanded: true,
  });

  // Content-driven streams do not call beginStreaming, so warm the renderer
  // when streaming starts or when Chat mounts during an already-active stream.
  // Idle mounts remain lazy.
  let previousStreaming = $state(false);
  let streamingInitialized = $state(false);
  $effect(() => {
    if (streaming && (!streamingInitialized || !previousStreaming)) {
      void preloadMarkdownPipeline();
    }
    previousStreaming = streaming;
    streamingInitialized = true;
  });

  // Reset UI-only approval/disclosure/typing/receipt state on conversation change
  // so stale approved/denied sets, expanded reasoning/tool-call disclosures,
  // adapter-derived typing state, and accumulated read receipts from the previous conversation
  // are cleared (their message ids can collide). The void reference to
  // `conversationId` at the start of the effect body is the Svelte 5 pattern for
  // declaring a reactive dependency on a derived without reading its value.
  $effect(() => {
    void conversationId;
    reasoningState.reset();
    toolCallState.reset();
    stepsState.reset();
    typingIndicatorState.reset();
    readReceiptsState.reset();
    announcements.clearAnnouncements();
  });

  // ==========================================================================
  // Initialize Helpers
  // ==========================================================================

  const scrollState = useChatScrollState({
    getBottomThreshold: () => bottomThreshold,
    getJumpThreshold: () => jumpThreshold,
    onScrollStateChange: handleScrollStateChange,
    onReachBottom: () => {
      // The sentinel fires when the user reaches the bottom via
      // IntersectionObserver, which does not emit onScrollStateChange.
      // Update the bindable prop here so it stays in sync with the sentinel path.
      updateAtBottomBinding(true);
      // The viewport really is at the bottom — release the prepend latch.
      autoScroll.resetPrependSuppression();
      if (unreadState.unreadCount > 0 || unreadState.newMessageIndicatorVisible) {
        unreadState.markAllAsRead();
      }
    },
  });

  const commandActions = useChatCommandActions({
    getAdapter: () => adapter,
    getMessages: () => messages,
    getOnAdapterError: () => onAdapterError,
    getOnSubmit: () => onSubmit,
    getOnRetry: () => onRetry,
    getOnEdit: () => onEdit,
    getOnApprovalResolve: () => onApprovalResolve,
    getOnStop: () => onStopGenerating,
    invalidateHistory: () => getHistoryRestoration().invalidate(),
    afterSubmit: (editing) => {
      if (!editing) {
        scrollState.setAtBottom(true);
        updateAtBottomBinding(true);
      }
      void tick().then(() => {
        if (editing) {
          scrollState.recomputeFromViewport(viewport);
          return undefined;
        }
        if (isVirtualized) {
          chatVirtualizer.scrollToOffset(chatVirtualizer.scrollSize, { behavior: 'instant' });
        } else {
          viewport?.scrollTo({ top: viewport.scrollHeight, behavior: 'instant' });
        }
        return undefined;
      });
    },
    getConversationIdentity: () => conversationId,
  });

  const streamingState = useChatStreamingState({
    getIsVirtualized: () => isVirtualized,
    getViewport: () => viewport,
    getEditing: () => commandActions.isEditing,
    getScrollState: () => scrollState,
    getVirtualizer: () => chatVirtualizer,
  });

  // Cancel any in-flight forced-layout/user-scroll-guard timers on unmount —
  // without this, a scroll animation still settling when the component tears
  // down could fire its cleanup against a gone-away viewport.
  $effect(() => () => {
    historyLifecycle.dispose();
    getHistoryRestoration().dispose();
    scrollState.destroy();
  });

  const unreadState = useChatUnreadState({
    onUnreadIndicatorChange: (event) => {
      // Update the bindable props at the mutation site rather than via a $effect.
      updateUnreadCountBinding(event.unreadCount);
      updateNewMessageIndicatorVisibleBinding(event.newMessageIndicatorVisible);
      onUnreadIndicatorChange?.(event);
    },
  });

  const keyboardNav = useChatKeyboardNav({
    onJumpToLatest: handleJumpToLatest,
    onJumpToStart: () => {
      if (isVirtualized) {
        // Leaving the bottom deliberately — but only if the viewport can
        // actually move (see the matching comment in scrollToTop() below for
        // why a transcript that fits entirely within the viewport must NOT
        // have atBottom flipped). Set synchronously rather than waiting for
        // the real scroll listener's rAF-deferred recompute, and update the
        // bindable prop too (matching the submit auto-scroll path).
        const canLeaveBottom = chatVirtualizer.scrollSize > (viewport?.clientHeight ?? 0);
        if (canLeaveBottom) {
          scrollState.setAtBottom(false);
          updateAtBottomBinding(false);
        }
        // Same destination as scrollToTop(): see that branch for why a
        // stale scrollend must not settle this guard mid-animation (#1236).
        scrollState.withUserScrollGuard(
          viewport,
          () => {
            chatVirtualizer.scrollToOffset(0, { behavior: scrollState.getScrollBehavior() });
          },
          undefined,
          () => 0,
        );
      }
    },
    getScrollBehavior: scrollState.getScrollBehavior,
    getHistoryTrigger: () => (showHistoryTrigger ? historyTriggerRef : null),
    onVirtualMessageNavigation: (direction) => navigateVirtualMessage(direction),
    getIsVirtualized: () => isVirtualized,
  });

  let rollbackMessageId = $state<string | null>(null);
  let rollbackConversationIdentity: string | undefined;

  // The conversation id as a stable VALUE dependency. The subscribe effect keys
  // on this (not on `conversation.id` read inline) so a consumer passing a fresh
  // `conversation` snapshot on every transcript update—but with the same id—does
  // not tear down and reopen the real-time subscription each render.
  const conversationId = $derived(conversation.id);
  const transcript = useChatTranscript({
    getConversation: () => conversation,
    getRollbackMessageId: () => rollbackMessageId,
    getStreaming: () => streaming,
    getStreamingMessageId: () => streamingState.messageId,
    getStreamingContent: () => streamingState.content,
    getMessageReasoning: () => messageReasoning,
    getFirstUnreadId: () => unreadState.firstUnreadId,
    getUngroupAllToolCalls: () =>
      Boolean(
        row ||
        messagePart ||
        messageActions ||
        messageStatus ||
        messageReasoning ||
        messageSteps ||
        onExpandedChange ||
        searchState.isOpen ||
        rollbackMessageId,
      ),
  });
  const messages = $derived(transcript.messages);
  const lastMessageId = $derived(transcript.lastMessageId);
  const rollbackBoundaryIndex = $derived(transcript.rollbackBoundaryIndex);
  const messageIndexById = $derived(transcript.messageIndexById);
  const activeTurnMessageIds = $derived(transcript.activeTurnMessageIds);
  const progressState = $derived(transcript.progressState);
  const toolCallPairsByCallId = $derived(transcript.toolCallPairsByCallId);
  const toolResultMessagesByResult = $derived(transcript.toolResultMessagesByResult);
  const renderRows = $derived(transcript.renderRows);
  let selectedArtifactId = $state<string | undefined>(undefined);
  const resolvedArtifactsById = $derived.by(() => {
    const artifacts = new Map<string, ResolvedChatArtifact>();
    for (const message of messages) {
      const artifact = resolveMessageArtifactValue(message);
      if (artifact) artifacts.set(artifact.id, artifact);
    }
    return artifacts;
  });
  const selectedArtifact = $derived(
    selectedArtifactId === undefined ? undefined : resolvedArtifactsById.get(selectedArtifactId),
  );

  // Expand capabilities object with per-feature defaults.
  const allowAttachments = $derived(capabilities?.attachments ?? true);
  const allowSearch = $derived(capabilities?.search ?? true);
  const allowCopy = $derived(capabilities?.copy ?? true);
  const allowEditing = $derived(capabilities?.editing ?? true);
  const allowRetry = $derived(capabilities?.retry ?? true);

  $effect(() => {
    if (rollbackConversationIdentity !== conversationId) {
      rollbackMessageId = null;
      rollbackConversationIdentity = conversationId;
      return;
    }
    if (rollbackMessageId && rollbackBoundaryIndex < 0) rollbackMessageId = null;
  });

  $effect(() => {
    void conversationId;
    selectedArtifactId = undefined;
  });

  $effect(() => {
    if (onArtifactOpen || (selectedArtifactId !== undefined && selectedArtifact === undefined)) {
      selectedArtifactId = undefined;
    }
  });

  function resolveArtifactForMessage(
    message: import('../conversation-model.ts').Message,
    pairedResultMessage: import('../conversation-model.ts').Message | undefined,
  ): ResolvedChatArtifact | undefined {
    return (
      resolveMessageArtifactValue(message) ??
      (pairedResultMessage ? resolveMessageArtifactValue(pairedResultMessage) : undefined)
    );
  }

  function artifactForToolCallMessage(
    message: import('../conversation-model.ts').Message,
  ): ResolvedChatArtifact | undefined {
    if (!message.toolCall?.id) return undefined;
    const pairs = toolCallPairsByCallId.get(message.toolCall.id) ?? [];
    const pair = pairs.find((candidate) => candidate.call === message.toolCall) ?? pairs[0];
    const pairedResultMessage = pair?.result
      ? toolResultMessagesByResult.get(pair.result)
      : undefined;
    return resolveArtifactForMessage(message, pairedResultMessage);
  }

  function artifactsForToolCallMessages(
    toolCallMessages: readonly import('../conversation-model.ts').Message[],
  ): ResolvedChatArtifact[] {
    return toolCallMessages
      .map((message) => artifactForToolCallMessage(message))
      .filter((artifact): artifact is ResolvedChatArtifact => artifact !== undefined);
  }

  function openArtifact(artifact: ResolvedChatArtifact): void {
    if (onArtifactOpen) {
      onArtifactOpen(artifact);
      return;
    }
    selectedArtifactId = artifact.id;
  }

  function confirmRollback(): void {
    if (!rollbackMessageId) return;
    onRollback?.(rollbackMessageId);
    rollbackMessageId = null;
  }
  let hasMounted = $state(false);
  $effect(() => {
    hasMounted = true;
  });

  const isVirtualized = $derived(virtualized && hasMounted && messages.length > 0);
  const timelineResetIdentity = $derived(
    `${conversationId}:${isVirtualized ? 'virtualized' : 'full'}`,
  );
  const staticRowsResetIdentity = $derived(messages[0]?.id ?? '');

  function describeToolCallSafely(
    call: import('../conversation-model.ts').ToolCall,
    result: import('../conversation-model.ts').ToolResult | undefined,
  ) {
    try {
      return adapter?.describeToolCall?.(call, result);
    } catch {
      return undefined;
    }
  }

  let previousHistoryConversationId: string | undefined;
  let previousHistoryAdapter: ChatAdapter | undefined;

  function handleScrollStateChange(event: {
    atBottom: boolean;
    scrollTop: number;
    scrollHeight: number;
  }): void {
    getHistoryRestoration().clearAnchorAfterScroll(event.scrollTop);
    reclaimFocusIfRowDetached();
    autoScroll.resetPrependSuppression();
    updateAtBottomBinding(event.atBottom);
    onScrollStateChange?.(event);
  }

  function virtualSpacerOffsetTop(): number {
    if (!viewport) return 0;
    const spacer = viewport.querySelector<HTMLElement>('.chat-virtual-spacer');
    if (!spacer) return 0;
    const offsetTop = spacer.offsetTop;
    const spacerRect = spacer.getBoundingClientRect();
    const viewportRect = viewport.getBoundingClientRect();
    const hasLayoutBox =
      spacerRect.top !== 0 ||
      spacerRect.bottom !== 0 ||
      viewportRect.top !== 0 ||
      viewportRect.bottom !== 0;
    if (!hasLayoutBox) return Math.max(0, offsetTop);
    const rectOffset = spacerRect.top - viewportRect.top + viewport.scrollTop;
    return Math.max(0, Number.isFinite(rectOffset) ? rectOffset : offsetTop);
  }

  const chatVirtualizer = new ChatVirtualizer({
    getScrollElement: () => viewport,
    getCount: () => (isVirtualized ? renderRows.length : 0),
    getItemKey: (index) => chatRenderRowKey(renderRows[index] ?? { type: 'typing' }),
    getEstimatedSize: () => virtualizationEstimatedRowHeight,
    getOverscan: () => virtualizationOverscan,
    getInitialHeight: () => virtualizationInitialHeight,
    getScrollPaddingStart: () => virtualSpacerOffsetTop(),
  });

  let historyRestoration = $state<ReturnType<typeof useChatHistoryRestoration>>();
  const getHistoryRestoration = (): ReturnType<typeof useChatHistoryRestoration> => {
    const value = historyRestoration;
    if (value === undefined) throw new Error('History restoration is not initialized');
    return value;
  };
  const historyLifecycle = useChatHistoryLifecycle({
    getConversationId: () => conversationId,
    getMessages: () => messages,
    getAdapter: () => adapter,
    getOnLoadHistory: () => onLoadHistory,
    getShowHistoryTrigger: () => showHistoryTrigger,
    getIsVirtualized: () => isVirtualized,
    getViewport: () => viewport,
    getScrollOffset: () => chatVirtualizer.scrollOffset,
    getScrollSize: () => chatVirtualizer.scrollSize,
    getFirstVisibleMessage: () => firstVisibleRenderedMessage(),
    getRenderedMessage: (messageId) => renderedMessageById(messageId),
    finishUserScrollGuard: () => scrollState.finishUserScrollGuard(),
    resetUserScrolling: () => getHistoryRestoration().resetUserScrolling(),
    restorePendingHistoryScroll: (pending) =>
      getHistoryRestoration().restorePendingHistoryScroll(pending),
    correctAnchorAfterSettle: (requestId) => getHistoryRestoration().correctAfterSettle(requestId),
    onAdapterError: (event) => onAdapterError?.(event),
    flushSync,
    tick,
  });
  historyRestoration = useChatHistoryRestoration({
    getConversationId: () => conversationId,
    getMessages: () => messages,
    getIsVirtualized: () => isVirtualized,
    getViewport: () => viewport,
    getVirtualizer: () => chatVirtualizer,
    getLifecycle: () => historyLifecycle,
    getRenderedMessage: (messageId) => renderedMessageById(messageId),
    getHistoryTrigger: () => historyTriggerRef ?? null,
    getShowHistoryTrigger: () => showHistoryTrigger,
    canRestoreTriggerFocus: canRestoreDeferredHistoryTriggerFocus,
    tick,
  });

  const virtualRows = $derived.by(() => {
    if (!isVirtualized) return [];

    const renderedIndexes = new Set<number>();
    const rows: { row: ChatRenderRow; virtualItem: VirtualItem }[] = [];
    for (const virtualItem of chatVirtualizer.virtualItems) {
      const renderRow = renderRows[virtualItem.index];
      if (!renderRow) continue;
      renderedIndexes.add(virtualItem.index);
      rows.push({
        row: renderRow,
        virtualItem: getHistoryRestoration().pinHistoryAnchorVirtualItem(renderRow, virtualItem),
      });
    }

    if (streamingState.messageId) {
      const streamingIndex = findRenderRowIndexByMessageId(renderRows, streamingState.messageId);
      if (streamingIndex >= 0 && !renderedIndexes.has(streamingIndex)) {
        const virtualItem = chatVirtualizer.getVirtualItem(streamingIndex);
        if (!virtualItem) return rows;
        rows.push({
          row: renderRows[streamingIndex]!,
          virtualItem,
        });
      }
    }

    const historyAnchorMessageId = getHistoryRestoration().historyAnchorMessageId;
    if (historyAnchorMessageId) {
      const historyAnchorIndex = findRenderRowIndexByMessageId(renderRows, historyAnchorMessageId);
      if (historyAnchorIndex >= 0 && !renderedIndexes.has(historyAnchorIndex)) {
        const virtualItem = chatVirtualizer.getVirtualItem(historyAnchorIndex);
        if (!virtualItem) return rows;
        const historyAnchorRow = renderRows[historyAnchorIndex];
        if (historyAnchorRow) {
          rows.push({
            row: historyAnchorRow,
            virtualItem: getHistoryRestoration().pinHistoryAnchorVirtualItem(
              historyAnchorRow,
              virtualItem,
            ),
          });
        }
      }
    }

    rows.sort((a, b) => a.virtualItem.index - b.virtualItem.index);
    return rows;
  });

  const searchState = useChatSearch({
    getMessages: () => messages,
  });

  // ==========================================================================
  // C6 — Per-participant typing indicators + read receipts (out-of-band state)
  // ==========================================================================

  const typingIndicatorState = useChatTypingIndicator({
    getTypingParticipants: () => typingParticipants,
  });

  const readReceiptsState = useChatReadReceipts({
    getReadReceipts: () => readReceipts,
  });

  // ==========================================================================
  // Derived Values
  // ==========================================================================

  const viewportAttach = $derived(viewportAttachment ?? noopAttachment);
  const effectiveHasMoreHistory = $derived(historyLifecycle.adapterHasMore ?? moreHistoryAvailable);
  const hasHistoryLoader = $derived(
    onLoadHistory !== undefined || adapter?.loadOlderMessages !== undefined,
  );
  const showHistoryTrigger = $derived(hasHistoryLoader && effectiveHasMoreHistory);
  const isRestoringNonVirtualHistory = $derived(
    getHistoryRestoration().isRestoringNonVirtualHistory,
  );

  $effect.pre(() => {
    if (!viewport || !historyLifecycle.pending || !isVirtualized) return;
    const pending = historyLifecycle.pending;
    void messages.length;
    void messages[0]?.id;
    void getHistoryRestoration().restorePendingHistoryScroll(pending);
  });

  $effect(() => {
    if (!viewport || !historyLifecycle.pending || isVirtualized) return;
    const pending = historyLifecycle.pending;
    void messages.length;
    void messages[0]?.id;
    const restored = getHistoryRestoration().restoreHistoryScroll(pending);
    if (restored) void getHistoryRestoration().stabilize(pending);
  });

  $effect(() => {
    chatVirtualizer.setScrollElement(isVirtualized ? viewport : null);
  });

  $effect(() => {
    for (const renderRow of renderRows) {
      chatRenderRowKey(renderRow);
    }
    chatVirtualizer.syncOptions();
  });

  $effect(() => {
    const currentConversationId = conversationId;
    const currentAdapter = adapter;
    if (previousHistoryConversationId === undefined) {
      previousHistoryConversationId = currentConversationId;
      previousHistoryAdapter = currentAdapter;
      return;
    }

    if (
      currentConversationId !== previousHistoryConversationId ||
      currentAdapter !== previousHistoryAdapter
    ) {
      historyLifecycle.invalidate();
      getHistoryRestoration().invalidate();
      historyLifecycle.setAdapterHasMore(undefined);
      historyLifecycle.setDeferredAdapterHasMore(null);
      // Or the latch leaks across conversation switches.
      autoScroll.resetPrependSuppression();
    }
    previousHistoryConversationId = currentConversationId;
    previousHistoryAdapter = currentAdapter;
  });

  $effect(() => {
    const deferredFocus = getHistoryRestoration().deferredTriggerFocus;
    if (deferredFocus === undefined || historyLifecycle.isLoading) return;

    getHistoryRestoration().clearDeferredTriggerFocus();
    void tick().then(() => {
      if (
        conversationId === deferredFocus.conversationId &&
        historyLifecycle.isRequestActive(deferredFocus.pending.requestId) &&
        canRestoreDeferredHistoryTriggerFocus()
      ) {
        getHistoryRestoration().focusAfterRestore(deferredFocus.pending, true);
      }
      return undefined;
    });
  });

  function canRestoreDeferredHistoryTriggerFocus(): boolean {
    const activeElement = document.activeElement;
    return (
      activeElement === null ||
      activeElement === document.body ||
      activeElement === document.documentElement ||
      (activeElement instanceof HTMLElement &&
        activeElement.closest('[data-cinder-history-trigger]') !== null)
    );
  }

  // A retry/edit affordance shows when EITHER a callback OR the adapter can
  // handle it — so an adapter-only consumer (no `onRetry`/`onEdit`) still gets
  // working buttons, and a callback-only consumer is unchanged.
  const canRetry = $derived(onRetry !== undefined || adapter?.retryMessage !== undefined);
  const canEdit = $derived(onEdit !== undefined || adapter?.editMessage !== undefined);

  // Stable bottom-sentinel attachment. Wrapping useIntersection in $derived (matching
  // load-more) means the IntersectionObserver is only torn down + recreated when
  // `viewport` or `bottomThreshold` actually change — NOT on every chat re-render
  // (which is frequent during streaming and would otherwise make bottom detection flicker).
  const sentinelAttach = $derived(
    isVirtualized
      ? noopAttachment
      : useIntersection(scrollState.handleSentinelEntry, {
          root: viewport,
          rootMargin: `0px 0px ${bottomThreshold}px 0px`,
        }),
  );

  // Accessibility IDs
  const timelineId = $derived(`${id}-timeline`);
  const inputId = $derived(`${id}-input`);
  const statusId = $derived(`${id}-status`);

  const announcements = useChatAnnouncements({
    getMessages: () => messages,
    getRenderRows: () => renderRows,
    getConversationId: () => conversationId,
    getApprovalStates: () => commandActions.approvalStates,
    getHistoryAnnouncement: () => historyLifecycle.announcement,
    getUnreadAnnouncement: () => unreadState.announcerMessage,
  });
  const assertiveAnnouncement = $derived(announcements.assertiveAnnouncement);
  const politeAnnouncement = $derived(announcements.politeAnnouncement);

  const autoScroll = useChatAutoScroll({
    getViewport: () => viewport,
    getMessages: () => messages,
    getIsVirtualized: () => isVirtualized,
    getBottomThreshold: () => bottomThreshold,
    getVirtualizationInitialHeight: () => virtualizationInitialHeight,
    getScrollState: () => scrollState,
    getVirtualizer: () => chatVirtualizer,
    getHistoryLifecycle: () => historyLifecycle,
    getHistoryRestoration: () => getHistoryRestoration(),
    getIsEditing: () => commandActions.isEditing,
  });

  // ==========================================================================
  // Process Messages for Unread Detection
  // ==========================================================================

  $effect(() => {
    // Pass a getter function for scrollState.atBottom to avoid creating a scroll dependency.
    // The effect should only re-run when messages change, not on every scroll.
    unreadState.processMessages(messages, conversation.id, () => scrollState.atBottom);
  });

  // ==========================================================================
  // Streaming rAF Cleanup
  // ==========================================================================

  // Cancel any pending animation frame when the component unmounts during active streaming.
  // Without this, the rAF callback fires after destruction and mutates orphaned $state.
  $effect(() => {
    return () => {
      streamingState.endStreaming();
      announcements.clearAnnouncements();
    };
  });

  // ==========================================================================
  // Adapter real-time subscription is keyed only by adapter identity and the
  // conversation id. Its owner preserves stale-event fencing, live callback
  // reads, and cleanup order while keeping streaming, typing, and receipt state
  // in their existing domains.
  useChatAdapterSubscription({
    getAdapter: () => adapter,
    getConversationId: () => conversationId,
    getOnMessage: () => onPushMessage,
    getOnTypingChange: () => onTypingChange,
    getOnReadReceipt: () => onReadReceipt,
    getStreamingActions: () => streamingState,
    getTypingActions: () => typingIndicatorState,
    getReceiptActions: () => readReceiptsState,
  });

  // ==========================================================================
  // Create Scroll Attachment
  // ==========================================================================

  const scrollAttachment = scrollState.createScrollAttachment();
  // Independent of the scroll/history-anchor attachments above — this owns
  // no chat scroll behavior, it only reads position to drive the shared
  // cinder scroll-fade recipe's fallback attributes. Only active when
  // scrollFadeVisible is set AND surfaceMode is 'default' (see chat.types.ts
  // for why 'transparent' mode stays inert). $derived so its identity is
  // stable across unrelated re-renders (Svelte tears down and re-runs an
  // attachment whenever its reference changes).
  const timelineScrollFadeAttachment = $derived(
    scrollFadeVisible && surfaceMode === 'default' ? overflowFadeEdges() : noopAttachment,
  );
  // ==========================================================================
  // Actions
  // ==========================================================================

  export function announce(message: string, level: ChatAnnounceLevel = 'polite'): void {
    announcements.announce(message, level);
  }

  function handleJumpToLatest(): void {
    getHistoryRestoration().invalidate();
    if (isVirtualized) {
      // Supersede any stale guard from an earlier top-scroll (scrollToTop()/
      // Home) that hasn't expired yet. This jump's own target (the bottom)
      // already matches what the auto-stick-to-bottom effect wants, so it
      // needs no guard of its own — but leaving the OLDER guard active would
      // keep suppressing that effect's correction for up to its remaining
      // duration, even though the user's intent has already moved on.
      scrollState.clearUserScrollGuard();
      chatVirtualizer.scrollToIndex(Math.max(0, renderRows.length - 1), {
        align: 'end',
        behavior: scrollState.getScrollBehavior(),
      });
      // Reached the bottom — sync both the internal helper and the bindable
      // prop synchronously (matching the submit auto-scroll path) rather than
      // waiting for the real scroll listener's rAF-deferred recompute.
      scrollState.setAtBottom(true);
      updateAtBottomBinding(true);
      unreadState.markAllAsRead();
      onJumpToLatest?.();
      // Park focus on the timeline, NOT on the bottom row. A virtualized row is
      // a recycled window slot: the virtualizer's next window pass (a
      // post-mount remeasurement that shifts the offsets, or any subsequent
      // scroll) unmounts it, and removing the focused node hands focus back to
      // <body>. Since the keydown handler is bound on the container, focus
      // landing outside it silently kills EVERY shortcut — End, Home,
      // PageUp/PageDown, arrow navigation, Ctrl+F. The timeline is
      // `tabindex="0"`, lives above the recycled rows, and never unmounts while
      // the chat is alive, so shortcuts survive the pass.
      //
      // (The old row lookup was doubly wrong: every `.chat-message-wrapper` is
      // the only child of its `.chat-virtual-row`, so `:last-of-type` matches
      // all of them and `querySelector` returned the row at the TOP of the
      // window — the first row a downward pass recycles away.)
      void tick().then(() => {
        viewport?.focus({ preventScroll: true });
        return undefined;
      });
      return;
    }

    scrollState.jumpToLatest(viewport, () => {
      unreadState.markAllAsRead();
      onJumpToLatest?.();
    });
  }

  /**
   * Backstop for focus orphaned by a row leaving the DOM.
   *
   * Any row inside the timeline can be unmounted while it holds focus — a
   * virtualizer window pass recycling it, a message removed from the
   * transcript, a keyed re-render. The browser then drops focus to `<body>`,
   * and because the keydown handler is bound on the container, every keyboard
   * shortcut dies with it. Pull focus back onto the timeline, which outlives
   * every row.
   *
   * The blur is NOT the trigger. When the focused element is *removed*, browsers
   * move focus to `<body>` without reliably dispatching `focusout` from the
   * detached node, so a design that waits for that event misses precisely the
   * case it exists for. Instead this records which row holds focus and re-checks
   * its connectivity from the two places a row can leave: a scroll-state
   * recompute (`handleScrollStateChange`, which is what recycling runs through)
   * and a change to the rendered set (the effect below, which covers removals
   * that never scroll — a message deleted from the conversation while the user
   * reads further up, a keyed re-render). A `MutationObserver` over the timeline
   * would catch both, and did originally, but `subtree: true` on a list that
   * mutates every scroll frame costs far more than this check is worth.
   *
   * `focusin`/`focusout` are still used, but only to track *which* row to watch,
   * never to decide that a reclaim is due. The guards keep this off the ordinary
   * paths: a click-away onto inert page chrome leaves the blurred node
   * CONNECTED, so it never reclaims, and window/tab blur is filtered by
   * `document.hasFocus` — reclaiming there would steal focus back from whatever
   * the user switched to.
   */
  let focusedRow: Node | null = null;

  function handleTimelineFocusIn(event: FocusEvent): void {
    const target = event.target;
    focusedRow = target instanceof Node && target !== viewport ? target : null;
  }

  function handleTimelineFocusOut(event: FocusEvent): void {
    // Focus moved somewhere real; stop tracking. A null `relatedTarget` is
    // ambiguous — it also covers the detach — so keep tracking in that case and
    // let `reclaimFocusIfRowDetached` decide.
    if (event.relatedTarget !== null) focusedRow = null;
  }

  // A deliberate click onto inert page chrome also reports `relatedTarget: null`
  // and leaves the row connected, so the handler above keeps tracking it. That is
  // correct at the time, but the tracking must not outlive the user's departure:
  // if that row is recycled by a later scroll, the reclaim would see `<body>`
  // focused and haul focus back into a chat the user had already left. A pointer
  // landing outside the container is the unambiguous signal that they left.
  $effect(() => {
    if (!containerRef) return;
    function clearTrackingOnOutsidePointer(event: PointerEvent): void {
      const target = event.target;
      if (target instanceof Node && containerRef?.contains(target)) return;
      focusedRow = null;
    }
    document.addEventListener('pointerdown', clearTrackingOnOutsidePointer, { capture: true });
    return () => {
      document.removeEventListener('pointerdown', clearTrackingOnOutsidePointer, {
        capture: true,
      });
    };
  });

  // Rows can leave the DOM without any scroll: a message removed from the
  // conversation, a keyed re-render. Reading both rendered sets reruns this on
  // any add or remove, and an effect body runs after Svelte has applied the DOM
  // change, so `isConnected` is already accurate here.
  //
  // Not covered by a unit test, and the reason is worth recording: under
  // happy-dom a keyed `{#each}` whose body starts with a conditional stops
  // reconciling after its first render, so a row never leaves and this never
  // fires there. That is a harness artifact, not a Chat one — the same
  // component tracks adds and removes correctly in Chrome, verified against a
  // standalone repro. Testing this path wants a real browser.
  $effect(() => {
    void messages;
    void renderRows;
    reclaimFocusIfRowDetached();
  });

  function reclaimFocusIfRowDetached(): void {
    const timeline = viewport;
    if (!timeline || !focusedRow || focusedRow.isConnected) return;

    focusedRow = null;
    if (!timeline.isConnected) return;
    // Do not fight a window/tab blur, or a focus move that actually landed.
    if (typeof document.hasFocus === 'function' && !document.hasFocus()) return;
    const active = document.activeElement;
    if (active !== null && active !== document.body) return;

    timeline.focus({ preventScroll: true });
  }

  // ==========================================================================
  // Command actions
  // ==========================================================================

  const handleSubmit = commandActions.handleSubmit;
  const handleRetry = commandActions.handleRetry;
  const handleEdit = commandActions.handleEdit;
  const handleApprovalResolve = commandActions.resolveToolApproval;
  const handleStopGenerating = commandActions.handleStopGenerating;
  const handleEditingChange = commandActions.handleEditingChange;
  const canResolveToolApproval = $derived(commandActions.canResolveToolApproval);

  async function handleLoadHistory(): Promise<void> {
    await historyLifecycle.loadHistory();
  }

  function handleSuggestionSelect(label: string): void {
    onSuggestionSelect?.(label);
    inputRef?.focus();
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
    if (
      event.key === 'Home' ||
      event.key === 'End' ||
      event.key === 'PageUp' ||
      event.key === 'PageDown' ||
      event.key === 'ArrowUp' ||
      event.key === 'ArrowDown'
    ) {
      getHistoryRestoration().handleUserInput();
    }

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

  function messageIdFromElement(element: HTMLElement): string | null {
    if (!element.id.startsWith('message-')) return null;
    return element.id.slice('message-'.length);
  }

  function isRenderedNavigationRow(element: HTMLElement): boolean {
    if (!element.matches('.chat-navigation-row')) return false;
    const owningMessage = element.closest('.chat-message');
    return owningMessage === null || owningMessage === element;
  }

  function renderedNavigationRows(): HTMLElement[] {
    if (!viewport) return [];
    return Array.from(viewport.querySelectorAll<HTMLElement>('.chat-navigation-row')).filter(
      isRenderedNavigationRow,
    );
  }

  function renderedMessageById(messageId: string): HTMLElement | null {
    return viewport?.querySelector<HTMLElement>(`#message-${CSS.escape(messageId)}`) ?? null;
  }

  function firstVisibleRenderedMessage(): { messageId: string; viewportOffset: number } | null {
    if (!viewport) return null;

    const viewportRect = viewport.getBoundingClientRect();
    for (const message of renderedNavigationRows()) {
      const messageId = messageIdFromElement(message);
      if (!messageId) continue;

      const rect = message.getBoundingClientRect();
      if (rect.bottom <= viewportRect.top || rect.top >= viewportRect.bottom) continue;

      return {
        messageId,
        viewportOffset: rect.top - viewportRect.top,
      };
    }

    return null;
  }

  async function focusVirtualMessage(messageId: string): Promise<void> {
    const existing = renderedMessageById(messageId);
    if (existing) {
      existing.focus();
      existing.scrollIntoView({ behavior: scrollState.getScrollBehavior(), block: 'nearest' });
      return;
    }

    const targetIndex = findRenderRowIndexByMessageId(renderRows, messageId);
    if (targetIndex < 0) return;

    chatVirtualizer.scrollToIndex(targetIndex, {
      align: 'auto',
      behavior: scrollState.getScrollBehavior(),
    });
    await tick();
    const target = renderedMessageById(messageId);
    target?.focus();
    target?.scrollIntoView({ behavior: scrollState.getScrollBehavior(), block: 'nearest' });
  }

  function navigateVirtualMessage(direction: 'next' | 'previous'): boolean {
    if (!isVirtualized || !viewport) return false;
    const activeElement =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if (!activeElement || !isRenderedNavigationRow(activeElement)) return false;

    const currentMessageId = messageIdFromElement(activeElement);
    if (!currentMessageId) return false;

    const currentIndex = findRenderRowIndexByMessageId(renderRows, currentMessageId);
    if (currentIndex < 0) return false;

    const step = direction === 'next' ? 1 : -1;
    for (
      let targetIndex = currentIndex + step;
      targetIndex >= 0 && targetIndex < renderRows.length;
      targetIndex += step
    ) {
      const targetRow = renderRows[targetIndex];
      if (targetRow?.type !== 'message' && targetRow?.type !== 'tool-call-group') continue;
      const targetMessageId =
        targetRow.type === 'message' ? targetRow.message.id : targetRow.messages[0]?.id;
      if (!targetMessageId) continue;
      void focusVirtualMessage(targetMessageId);
      return true;
    }

    return true;
  }

  // Scroll to the currently matched message when the current match changes
  $effect(() => {
    const match = searchState.currentMatch;
    if (!match || !viewport) return;

    void scrollCurrentSearchMatch(match.message.id);
  });

  async function scrollCurrentSearchMatch(messageId: string): Promise<void> {
    if (!viewport) return;

    getHistoryRestoration().cancelStabilization();
    // Search navigation owns the viewport from here — a late loader
    // resolution must not re-anchor it back to the history anchor (#1237).
    // Deliberately NOT folded into getHistoryRestoration().cancelStabilization():
    // that helper also runs from the maybe-scroll input heuristic, where
    // dropping the snapshot on a single tap or zero-delta wheel would lose the
    // post-settle correction entirely.
    getHistoryRestoration().clearRestoredPending();
    if (isVirtualized) {
      const targetIndex = findRenderRowIndexByMessageId(renderRows, messageId);
      if (targetIndex >= 0) {
        chatVirtualizer.scrollToIndex(targetIndex, { align: 'center', behavior: 'auto' });
        await tick();
      }
    }

    const messageElement = viewport.querySelector<HTMLElement>(`#message-${CSS.escape(messageId)}`);
    if (messageElement) {
      messageElement.scrollIntoView({ behavior: 'auto', block: 'nearest' });
    }
  }

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
    getHistoryRestoration().invalidate();
    // Reaching the bottom — sync both the internal helper and the bindable
    // prop synchronously (matching the submit auto-scroll path) rather than
    // waiting for the real scroll listener's rAF-deferred recompute.
    scrollState.setAtBottom(true);
    updateAtBottomBinding(true);
    // Use the scroll-state guard for both transcript modes. It forces real row
    // geometry before capturing the smooth-scroll target and owns settlement
    // after the compositor finishes the animation.
    scrollState.scrollToBottom(viewport);
  }

  export function scrollToTop(): void {
    getHistoryRestoration().invalidate();
    if (isVirtualized) {
      // Leaving the bottom deliberately — but only if the viewport can
      // actually move. A transcript short enough to fit entirely within the
      // viewport is always "at the bottom" by definition: scrollToOffset(0)
      // is a no-op there, so flipping atBottom would desync it from the real
      // (unchanged) position, and a message appended right after would be
      // wrongly marked unread. Set synchronously rather than waiting for the
      // real scroll listener's rAF-deferred recompute (matching the pattern
      // in the submit auto-scroll path, which sets both scrollState and the
      // bindable together).
      const canLeaveBottom = chatVirtualizer.scrollSize > (viewport?.clientHeight ?? 0);
      if (canLeaveBottom) {
        scrollState.setAtBottom(false);
        updateAtBottomBinding(false);
      }
      // Guard against the auto-stick-to-bottom $effect.pre (Scroll Anchoring
      // section, above) fighting this animation: it re-fires on every
      // virtualizer remeasurement, and without this guard it would keep
      // snapping the viewport back toward the bottom mid-scroll since
      // `isUserScrolling` was never set for this branch. The destination
      // keeps the guard armed through stale scroll/scrollend events left in
      // flight by an instant bottom correction issued just before this call —
      // without it, such a scrollend settles the guard milliseconds into the
      // animation and the next remeasurement re-pins the viewport to the
      // bottom (#1236) — and lets finishUserScrollGuard complete this scroll
      // instantly at the top before a history-prepend capture (#1237).
      scrollState.withUserScrollGuard(
        viewport,
        () => {
          chatVirtualizer.scrollToOffset(0, { behavior: scrollState.getScrollBehavior() });
        },
        undefined,
        () => 0,
      );
    } else {
      // Same canLeaveBottom reasoning as the virtualized branch above.
      const canLeaveBottom = !!viewport && viewport.scrollHeight > viewport.clientHeight;
      if (canLeaveBottom) {
        scrollState.setAtBottom(false);
        updateAtBottomBinding(false);
      }
      scrollState.scrollToTop(viewport);
    }
  }

  /** Scroll a message-aware target, including grouped and virtualized rows. */
  export function scrollToMessage(messageId: string): void {
    getHistoryRestoration().invalidate();
    const targetIndex = findRenderRowIndexByMessageId(renderRows, messageId);
    const isEarlierMessage = targetIndex >= 0 && targetIndex < renderRows.length - 1;
    const navigate = (action: () => void): void => {
      if (isEarlierMessage && viewport) {
        const canLeaveBottom = viewport.scrollHeight > viewport.clientHeight;
        if (canLeaveBottom) {
          scrollState.setAtBottom(false);
          updateAtBottomBinding(false);
        }
        scrollState.withUserScrollGuard(viewport, action);
        return;
      }
      action();
    };
    const rendered = renderedMessageById(messageId);
    if (rendered) {
      navigate(() => {
        rendered.scrollIntoView({ behavior: scrollState.getScrollBehavior(), block: 'center' });
      });
      return;
    }
    // Grouped tool-call rows expose the first call's id as their DOM anchor.
    // Resolve later calls to that same rendered group in the non-virtual path.
    if (targetIndex >= 0 && !isVirtualized) {
      const targetRow = renderRows[targetIndex];
      if (targetRow?.type === 'tool-call-group') {
        const groupAnchor = renderedMessageById(targetRow.messages[0]?.id ?? '');
        if (groupAnchor) {
          navigate(() => {
            groupAnchor.scrollIntoView({
              behavior: scrollState.getScrollBehavior(),
              block: 'center',
            });
          });
        }
      }
      return;
    }
    if (targetIndex >= 0 && isVirtualized) {
      navigate(() => {
        chatVirtualizer.scrollToIndex(targetIndex, {
          align: 'center',
          behavior: scrollState.getScrollBehavior(),
        });
      });
    }
  }

  /**
   * Programmatically retry a failed message — the same guarded dispatch as the
   * UI Retry button. A call for a message id whose retry is still in flight is
   * ignored, so the adapter's `retryMessage` command (or the `onRetry`
   * callback) never double-fires for the same id regardless of entry point.
   */
  export function retryMessage(messageId: string): void {
    commandActions.retryMessage(messageId);
  }

  export function focusInput(): void {
    inputRef?.focus();
  }

  /** Clear the composer's current content. */
  export function clearInput(): void {
    inputRef?.clear();
  }

  /** Read the composer's current plain-text value. */
  export function getComposerValue(): string {
    return inputRef?.getValue() ?? '';
  }

  /** Read the composer textarea element. Returns null until mounted. */
  export function getEditorElement(): HTMLTextAreaElement | null {
    return inputRef?.getEditorElement() ?? null;
  }

  /** Replace a composer range and place focus after the inserted text. */
  export function insertAtRange(range: { start: number; end: number }, text: string): void {
    inputRef?.insertAtRange(range, text);
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
    streamingState.beginStreaming(messageId);
  }

  /**
   * Append a token to the streaming content buffer. The owner batches rendering
   * and scroll work once per animation frame.
   */
  export function pushToken(token: string): void {
    streamingState.pushToken(token);
  }

  /**
   * End streaming for the current message.
   * The message's final content should already be committed to the Conversation.
   * Cancels any pending rAF flush so the stale buffer is not written after endStreaming.
   */
  export function endStreaming(): void {
    streamingState.endStreaming();
  }

  function virtualizedSpacerStyle(): string {
    return `height: ${chatVirtualizer.totalSize}px; position: relative; width: 100%;`;
  }

  function virtualizedRowStyle(virtualItem: VirtualItem): string {
    return `position: absolute; inset-inline: 0; top: 0; transform: translateY(${virtualItem.start}px);`;
  }

  function virtualRowAttachment(renderRow: ChatRenderRow): Attachment<HTMLElement> {
    return (node) => {
      const detachMeasurement = chatVirtualizer.measureElement(node);
      if (renderRow.type === 'message' && renderRow.message.id === streamingState.messageId) {
        streamingState.setStreamingRowElement(node);
      }

      return () => {
        detachMeasurement?.();
        streamingState.clearStreamingRowElement(node);
      };
    };
  }
</script>

<ChatArtifactLayout
  instanceId={`${id}-artifact`}
  open={!onArtifactOpen && selectedArtifact !== undefined}
  panelTitle={selectedArtifact?.title}
  onclose={() => (selectedArtifactId = undefined)}
  class={className}
  {style}
>
  <div
    bind:this={containerRef}
    {id}
    class={classNames('cinder-chat', 'chat-container')}
    data-surface-mode={surfaceMode}
    data-cinder-density={density}
    data-cinder-variant={variant}
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

    {#snippet renderTypingIndicator()}
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
    {/snippet}

    {#snippet renderArtifactAction(artifact: ResolvedChatArtifact)}
      <button
        type="button"
        class="chat-artifact-action"
        title={artifact.title}
        onclick={() => openArtifact(artifact)}
      >
        <span class="chat-artifact-action__label">Open artifact: {artifact.title}</span>
      </button>
    {/snippet}

    {#snippet renderMessageRow(messageRow: ChatMessageRenderRow)}
      {@const message = messageRow.message}
      {@const pairs = message.toolCall?.id
        ? (toolCallPairsByCallId.get(message.toolCall.id) ?? [])
        : []}
      {@const toolCallPair = pairs.find((pair) => pair.call === message.toolCall) ?? pairs[0]}
      {@const toolCallPresentation = message.toolCall
        ? describeToolCallSafely(message.toolCall, toolCallPair?.result)
        : undefined}
      {@const pairedResultMessage = toolCallPair?.result
        ? toolResultMessagesByResult.get(toolCallPair.result)
        : undefined}
      {@const artifact = resolveArtifactForMessage(message, pairedResultMessage)}
      {@const rowContext = {
        message,
        toolCallPair,
        artifact,
      }}
      {@const isImperativeStreamingMessage = streamingState.messageId === message.id}
      {@const isContentDrivenStreamingMessage =
        streaming &&
        streamingState.messageId === null &&
        message.id === lastMessageId &&
        message.role === 'assistant' &&
        isStreamingMessage(message) &&
        getMessageText(message).trim().length > 0}
      {@const isPresentingStreamingMessage =
        (isImperativeStreamingMessage && streamingState.content.trim().length > 0) ||
        isContentDrivenStreamingMessage}
      {@const streamingOverrideContent = isImperativeStreamingMessage
        ? streamingState.content
        : undefined}
      {@const isCurrentSearchMatch =
        searchState.isOpen &&
        searchState.currentMatch !== null &&
        searchState.currentMatch.message.id === message.id}
      <!-- C4/C5: resolve reasoning/steps/suggestions overlays. Each prefers an
         explicit per-message prop over `cinder:`-namespaced metadata, validates
         both paths identically, and guards consumer-callback throws — so a
         malformed callback can never break the chat render (see resolve* in
         chat/utilities). A plain transcript yields `undefined` for all three. -->
      {@const derivedReasoning = resolveMessageReasoning(message, messageReasoning)}
      {@const derivedEntries = resolveMessageTranscriptEntries(message)}
      {@const derivedSteps = resolveMessageSteps(message, messageSteps)}
      {@const derivedSuggestions =
        message.id === lastMessageId
          ? resolveMessageSuggestions(message, messageSuggestions)
          : undefined}

      <!-- The built-in row. Wrapped in a snippet so the optional `row`
         override can render it (inversion of control) or replace it. The
         per-part `messagePart` override flows through into the message's
         parts renderer. -->
      {#snippet renderDefaultRow()}
        {@const receipt =
          message.role === 'user' ? readReceiptsState.getReceipt(message.id) : undefined}
        {#snippet readReceiptMetadata()}
          {#if receipt}
            <ChatReadReceipt {receipt} />
          {/if}
        {/snippet}
        <ChatMessage
          {message}
          {...receipt ? { metadata: readReceiptMetadata } : {}}
          toolCallPairs={pairs}
          {messagePart}
          {markdownNode}
          onRetry={allowRetry && canRetry ? handleRetry : undefined}
          onEdit={allowEditing && canEdit ? handleEdit : undefined}
          oneditingchange={(editing) => handleEditingChange(message.id, editing)}
          onRollback={onRollback ? (messageId) => (rollbackMessageId = messageId) : undefined}
          rollbackDiscarded={rollbackBoundaryIndex >= 0 &&
            (messageIndexById.get(message.id) ?? -1) >= rollbackBoundaryIndex}
          showDefaultActions={allowCopy}
          {onExpandedChange}
          streaming={isPresentingStreamingMessage}
          overrideContent={isPresentingStreamingMessage ? streamingOverrideContent : undefined}
          searchMatch={isCurrentSearchMatch}
          tabindex={-1}
          approvalStates={commandActions.approvalStates.size > 0
            ? commandActions.approvalStates
            : undefined}
          approvalResolutionInFlightIds={commandActions.approvalResolutionInFlightIds.size > 0
            ? commandActions.approvalResolutionInFlightIds
            : undefined}
          {toolCallPresentation}
          onApprovalResolve={canResolveToolApproval ? handleApprovalResolve : undefined}
          reasoning={derivedReasoning}
          entries={derivedEntries}
          steps={derivedSteps}
          suggestions={derivedSuggestions}
          reasoningExpanded={reasoningState.isExpanded(message.id)}
          onreasoning={() => reasoningState.toggle(message.id)}
          stepsExpanded={stepsState.isExpanded(message.id)}
          onsteps={() => stepsState.toggle(message.id)}
          toolCallExpanded={toolCallState.isExpanded(message.id)}
          ontoolcalltoggle={() => toolCallState.toggle(message.id)}
          toolActivityActive={progressState === 'tool' && activeTurnMessageIds.has(message.id)}
          onSuggestionSelect={handleSuggestionSelect}
        >
          {#snippet actions()}
            {#if messageActions}
              {@render messageActions(rowContext)}
            {/if}
          {/snippet}
          {#snippet status()}
            {#if messageStatus}
              {@render messageStatus(rowContext)}
            {/if}
          {/snippet}
        </ChatMessage>
        {#if artifact}
          <div class="chat-artifact-actions" role="group" aria-label="Artifact actions">
            {@render renderArtifactAction(artifact)}
          </div>
        {/if}
      {/snippet}

      {#if row}
        {@render row(rowContext, renderDefaultRow)}
      {:else}
        {@render renderDefaultRow()}
      {/if}
    {/snippet}

    {#snippet renderChatRow(renderRow: ChatRenderRow)}
      {#if renderRow.type === 'date'}
        <ChatDateSeparator date={renderRow.date} />
      {:else if renderRow.type === 'unread-divider'}
        <div class="chat-unread-divider" role="separator" aria-label="New messages below">
          <span class="chat-unread-divider-line" aria-hidden="true"></span>
          <span class="chat-unread-divider-label">New</span>
          <span class="chat-unread-divider-line" aria-hidden="true"></span>
        </div>
      {:else if renderRow.type === 'typing'}
        {@render renderTypingIndicator()}
      {:else if renderRow.type === 'tool-call-group'}
        {@const artifacts = artifactsForToolCallMessages(renderRow.messages)}
        <ToolCallTimeline
          messageId={renderRow.messages[0]!.id}
          activityActive={progressState === 'tool' &&
            renderRow.messages.some((message) => activeTurnMessageIds.has(message.id))}
          describeToolCall={adapter?.describeToolCall
            ? (pair) => describeToolCallSafely(pair.call, pair.result)
            : undefined}
          pairs={renderRow.messages.flatMap((message) => {
            if (!message.toolCall?.id) return [];
            const pairs = toolCallPairsByCallId.get(message.toolCall.id) ?? [];
            const pair = pairs.find((candidate) => candidate.call === message.toolCall) ?? pairs[0];
            return pair ? [pair] : [];
          })}
        />
        {#if artifacts.length > 0}
          <div class="chat-artifact-actions" role="group" aria-label="Artifact actions">
            {#each artifacts as artifact (artifact.id)}
              {@render renderArtifactAction(artifact)}
            {/each}
          </div>
        {/if}
      {:else}
        {@render renderMessageRow(renderRow)}
      {/if}
    {/snippet}

    {#key timelineResetIdentity}
      <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
      <div
        bind:this={viewport}
        id={timelineId}
        class={classNames(
          'chat-timeline',
          scrollFadeVisible && 'cinder-_scroll-fade cinder-_scroll-fade-start',
        )}
        role="log"
        aria-label="Messages"
        aria-describedby={statusId}
        aria-live={isVirtualized ? 'off' : 'polite'}
        aria-relevant={isVirtualized ? undefined : 'additions'}
        data-cinder-virtualized={isVirtualized ? '' : undefined}
        data-cinder-history-restoring={isRestoringNonVirtualHistory ? '' : undefined}
        tabindex="0"
        onwheel={getHistoryRestoration().handleUserInput}
        ontouchstart={getHistoryRestoration().handleUserInput}
        onpointerdown={getHistoryRestoration().handleUserInput}
        onfocusin={handleTimelineFocusIn}
        onfocusout={handleTimelineFocusOut}
        {@attach scrollAttachment}
        {@attach getHistoryRestoration().historyAnchorScrollAttachment}
        {@attach viewportAttach}
        {@attach timelineScrollFadeAttachment}
      >
        {#if showHistoryTrigger}
          <ChatHistoryTrigger
            bind:this={historyTriggerRef}
            loading={historyLifecycle.isLoading}
            label={loadEarlierLabel}
            loadingLabel={loadingEarlierLabel}
            onLoad={() => void handleLoadHistory()}
          />
        {/if}

        {#if messages.length === 0 && typingIndicatorState.participantCount === 0}
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
        {:else if isVirtualized}
          <div class="chat-virtual-spacer" style={virtualizedSpacerStyle()}>
            {#each virtualRows as virtualRow (chatRenderRowKey(virtualRow.row))}
              <div
                class="chat-virtual-row"
                data-cinder-virtual-index={virtualRow.virtualItem.index}
                style={virtualizedRowStyle(virtualRow.virtualItem)}
                {@attach virtualRowAttachment(virtualRow.row)}
              >
                {@render renderChatRow(virtualRow.row)}
              </div>
            {/each}
          </div>
        {:else}
          {#key staticRowsResetIdentity}
            {#each renderRows as renderRow (chatRenderRowKey(renderRow))}
              {@render renderChatRow(renderRow)}
            {/each}
          {/key}
        {/if}

        <!-- Per-participant typing indicator: above the bottom sentinel.
           Always in DOM regardless of message count — the aria-live region must
           exist before the first update fires so screen readers receive the
           announcement even in an empty chat. The outer wrapper is always rendered;
           the inner indicator mounts/unmounts via {#if isActive} inside the
           component to replay the entrance animation on each typing start.
           Virtualized path: sits outside the virtual spacer so it does not affect
           row measurement. The sentinel remains the last element so
           IntersectionObserver fires correctly when the typing region gains height. -->
        <ChatParticipantTyping
          typingLabel={typingIndicatorState.typingLabel}
          participantCount={typingIndicatorState.participantCount}
        />

        <!-- Bottom sentinel for IntersectionObserver -->
        <div class="chat-bottom-sentinel" aria-hidden="true" {@attach sentinelAttach}></div>
      </div>
    {/key}

    <!-- Input Area with Jump Buttons -->
    <div class="chat-input-wrapper">
      <ChatJumpControls
        showJumpButton={scrollState.showJumpButton}
        hasNewMessageIndicator={unreadState.newMessageIndicatorVisible}
        unreadCount={unreadState.unreadCount}
        displayUnreadCount={unreadState.displayUnreadCount}
        hasLargeCount={unreadState.hasLargeCount}
        onJumpToLatest={handleJumpToLatest}
      />

      <!-- Input Area -->
      <div class="chat-input-area">
        <ChatInput
          id={inputId}
          bind:this={inputRef}
          onsubmit={(message, attachments) => handleSubmit(message, attachments)}
          disabled={streaming}
          sending={streaming}
          {allowAttachments}
          onstop={streaming ? handleStopGenerating : undefined}
          {onComposerInput}
          {oncomposerkeydown}
          {oncomposerselectionchange}
          {oncomposerblur}
          {composerRole}
          {composerAriaExpanded}
          {composerAriaControls}
          {composerAriaActiveDescendant}
          {composerAriaAutocomplete}
          {onAttachmentAdd}
          {onAttachmentRemove}
          {onAttachmentFailure}
        />
      </div>
    </div>

    <ChatStatusAnnouncer
      {statusId}
      messageCount={messages.length}
      announcerMessage={politeAnnouncement}
      assertiveMessage={assertiveAnnouncement}
    />

    <!-- Typing-participant live region: outside role="log" to avoid double announcement.
       (ChatStatusAnnouncer is similarly placed outside the log for the same reason.)
       Text is empty when nobody is typing, debounced for brief-burst suppression. -->
    <div class="cinder-sr-only" aria-live="polite" aria-atomic="true">
      {typingIndicatorState.announcedLabel}
    </div>
  </div>

  {#snippet panel()}
    {#if selectedArtifact}
      <ArtifactViewer
        type={selectedArtifact.type}
        content={selectedArtifact.content}
        title={selectedArtifact.title}
        {...selectedArtifact.language === undefined ? {} : { language: selectedArtifact.language }}
      />
    {/if}
  {/snippet}
</ChatArtifactLayout>

<ConfirmDialog
  open={rollbackMessageId !== null}
  title="Rollback conversation?"
  description="The dimmed transcript entries will be discarded before this message is retried."
  confirmLabel="Rollback conversation"
  destructive
  onConfirm={confirmRollback}
  onCancel={() => (rollbackMessageId = null)}
/>

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

  /* ==========================================================================
   * Density tokens — intermediate contract between container and its children.
   * ONLY the container reads `data-cinder-density`; children consume the
   * custom properties below. The defaults match the historical hard-coded
   * --cinder-space values (comfortable = no visual change from before).
   * ========================================================================== */

  .chat-container {
    --cinder-chat-message-gap: var(--cinder-space-3);
    --cinder-chat-message-padding-inline: var(--cinder-space-4);
    --cinder-chat-timeline-padding: var(--cinder-space-4);
    /* Narrow-viewport tokens: tighter padding/gap at ≤480px (comfortable density). */
    --cinder-chat-narrow-padding: var(--cinder-space-3);
    --cinder-chat-narrow-gap: var(--cinder-space-2);
  }

  .chat-container[data-cinder-density='compact'] {
    --cinder-chat-message-gap: var(--cinder-space-1-5);
    --cinder-chat-message-padding-inline: var(--cinder-space-2);
    --cinder-chat-timeline-padding: var(--cinder-space-2);
    /* Narrow-viewport tokens: proportionally tighter for compact density. */
    --cinder-chat-narrow-padding: var(--cinder-space-1-5);
    --cinder-chat-narrow-gap: var(--cinder-space-1);
  }

  /* Full-window drop zone overlay */
  .chat-drop-overlay {
    position: absolute;
    inset: 0;
    z-index: 100;
    display: flex;
    align-items: center;
    justify-content: center;
    background: color-mix(in oklch, var(--cinder-accent-solid), transparent 90%);
    border: 2px dashed var(--cinder-accent-solid);
    border-radius: var(--cinder-radius-md);
    pointer-events: none;
  }

  .chat-drop-label {
    font-size: var(--_cinder-chat-text-lg, var(--cinder-text-lg));
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
    padding: var(--cinder-chat-timeline-padding);
    display: flex;
    flex-direction: column;
    gap: var(--cinder-chat-message-gap);
  }

  /* The inner implementation is also rendered directly by package fixtures.
     Keep the clipped-scroll-region focus recipe at this rendering boundary so
     it is present before an asynchronously loaded public-wrapper stylesheet. */
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

  .chat-timeline[data-cinder-history-restoring] {
    /* Chat owns prepend restoration while this marker is present. Native
       anchoring would otherwise apply a second offset as measurements settle. */
    overflow-anchor: none;
  }

  .chat-timeline[data-cinder-virtualized] {
    display: block;
    overflow-anchor: none;
  }

  .chat-timeline[data-cinder-virtualized] > :global(.chat-history-trigger) {
    margin-block-end: var(--cinder-chat-message-gap);
  }

  .chat-virtual-spacer {
    flex-shrink: 0;
  }

  .chat-virtual-row {
    box-sizing: border-box;
    width: 100%;
    padding-block-end: var(--cinder-chat-message-gap);
  }

  /* Inset surface separates assistant bubbles (--cinder-surface) from the
   * page-level background. Only applied in default surfaceMode; embedded
   * contexts using surfaceMode="transparent" inherit their host's background. */
  .chat-container[data-surface-mode='default'] .chat-timeline {
    background: var(--cinder-surface-inset);
  }

  /* Scroll-fade color must match the background set immediately above — the
   * fade is an opaque overlay, never a mask (see @lostgradient/cinder's
   * _scroll-fade.css). Scoped to the same [data-surface-mode='default']
   * selector so surfaceMode="transparent" (no owned background above) never
   * gets a var with no correct value to resolve to; the JS attachment is
   * also gated off entirely in that mode (see timelineScrollFadeAttachment). */
  .chat-container[data-surface-mode='default'] .chat-timeline.cinder-_scroll-fade {
    --_cinder-scroll-fade-color: var(--cinder-surface-inset);
  }

  /* Prevent non-last messages from being scroll anchors */
  .chat-timeline > :not(:last-child) {
    overflow-anchor: none;
  }

  .chat-artifact-actions {
    display: flex;
    flex-wrap: wrap;
    gap: var(--cinder-space-1);
    max-inline-size: min(100%, var(--cinder-chat-message-max-width, 48rem));
  }

  .chat-artifact-action {
    display: inline-flex;
    align-items: center;
    max-inline-size: min(100%, 24rem);
    min-block-size: var(--cinder-touch-target-min);
    padding: 0 var(--cinder-space-2);
    color: var(--cinder-text-default);
    background: var(--cinder-surface-raised);
    border: 1px solid var(--cinder-border);
    border-radius: var(--cinder-radius-sm);
    cursor: pointer;
    font: inherit;
    font-size: var(--_cinder-chat-text-xs, var(--cinder-text-xs));
    text-align: start;
  }

  .chat-artifact-action__label {
    min-inline-size: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  @media (hover: hover) {
    .chat-artifact-action:hover {
      background: var(--cinder-surface-hover);
      border-color: var(--cinder-border);
    }
  }

  .chat-artifact-action:focus-visible {
    outline: var(--cinder-ring-width) solid transparent;
    box-shadow: inset 0 0 0 var(--cinder-ring-width)
      var(--_cinder-chat-artifact-action-ring, var(--cinder-ring-color));
  }

  @media (forced-colors: active) {
    .chat-artifact-action:focus-visible {
      outline: var(--cinder-ring-width) solid ButtonText;
      outline-offset: calc(var(--cinder-ring-width) * -1);
    }
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
    font-size: var(--_cinder-chat-text-sm, var(--cinder-text-sm));
    color: var(--cinder-text-default);
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
      border-color: var(--cinder-accent-solid);
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
    background: var(--cinder-accent-solid);
  }

  .chat-unread-divider-label {
    display: inline-flex;
    align-items: center;
    padding: var(--cinder-space-0-5) var(--cinder-space-2);
    font-size: var(--_cinder-chat-text-xs, var(--cinder-text-xs));
    font-weight: var(--cinder-font-medium);
    color: var(--cinder-accent-text);
    background: color-mix(in oklch, var(--cinder-accent-solid), transparent 92%);
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
    animation: typing-indicator-enter var(--cinder-duration-base) var(--cinder-ease-decelerate);
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
    font-size: var(--_cinder-chat-text-sm, var(--cinder-text-sm));
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
    padding: var(--cinder-chat-timeline-padding);
    border-top: 1px solid var(--cinder-border);
    background: var(--cinder-surface);
  }

  .chat-container[data-surface-mode='transparent'] .chat-input-area {
    background: transparent;
  }

  /* Responsive adjustments: tighten padding at narrow widths.
     Uses --cinder-chat-narrow-* tokens so each density gets an appropriate
     reduced value (comfortable → space-3/space-2; compact → space-1-5/space-1). */
  @container (max-width: 480px) {
    .chat-timeline {
      padding: var(--cinder-chat-narrow-padding);
      gap: var(--cinder-chat-narrow-gap);
    }

    .chat-input-area {
      padding: var(--cinder-chat-narrow-padding);
    }
  }

  /* ==========================================================================
   * Variant — flat: remove bubble backgrounds; role is communicated via
   * alignment and role label only. Text renders on --cinder-surface-inset
   * (the timeline background in default surfaceMode), which meets WCAG AA
   * for --cinder-text-default. The `:global()` reach is required because bubble CSS
   * lives in chat-message.svelte (a child component).
   * ========================================================================== */

  /* Strip user bubble background + distinctive border radius */
  .chat-container[data-cinder-variant='flat']
    :global(.chat-message-wrapper[data-role='user'] .chat-message) {
    background: transparent;
    border-radius: var(--cinder-radius-lg);
  }

  /* Strip assistant bubble background + border + shadow */
  .chat-container[data-cinder-variant='flat']
    :global(.chat-message-wrapper[data-role='assistant'] .chat-message) {
    background: transparent;
    border: none;
    box-shadow: none;
    border-radius: var(--cinder-radius-lg);
  }

  /* In flat mode, the user header must flow in-document (not absolutely
     positioned) so the role label appears above the message content.
     The label itself is un-clipped below so it reads as visible text. */
  .chat-container[data-cinder-variant='flat']
    :global(.chat-message-wrapper[data-role='user'] .chat-message-header) {
    position: static;
    inset: unset;
  }

  /* Un-hide the role label for user messages: in bubble mode alignment
     communicates role; in flat mode there is no colored background, so the
     label is the primary visible role signal. */
  .chat-container[data-cinder-variant='flat']
    :global(.chat-message-wrapper[data-role='user'] .chat-message-role) {
    position: static;
    width: auto;
    height: auto;
    padding: 0;
    margin: 0;
    overflow: visible;
    clip: auto;
    white-space: normal;
  }
</style>
