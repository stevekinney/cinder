<script lang="ts" module>
  import type { Attachment } from 'svelte/attachments';
  import type { ChatAdapter, ChatCommand, ChatPushHandlers } from '../adapter/chat-adapter.ts';
  import type { Message, MessageInput, ToolResult } from '../conversation-model.ts';
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
  import { flushSync, tick, untrack } from 'svelte';
  import { classNames } from '../../../utilities/class-names.ts';
  import { overflowFadeEdges } from '../../../utilities/overflow-fade-edges.ts';
  import {
    getMessages,
    pairToolCallsWithResults,
    resolveMessageArtifact,
    resolveMessageReasoning,
    resolveMessageTranscriptEntries,
    resolveMessageSteps,
    resolveMessageSuggestions,
  } from '../utilities/index.ts';
  import { ChatMessage, ChatDateSeparator } from '../message/index.ts';
  import { ChatInput } from '../input/index.ts';
  import {
    DEFAULT_SCROLL_CONFIGURATION,
    isAtBottom as checkIsAtBottom,
  } from './scroll-utilities.ts';
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
    buildChatRenderRows,
    buildMessagesWithDateSeparators,
    chatRenderRowKey,
    findPairedToolResultIds,
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
  import ConfirmDialog from '@lostgradient/cinder/confirm-dialog';

  const noopAttachment: Attachment<HTMLElement> = () => {};
  const CONSUMER_ANNOUNCEMENT_CLEAR_DELAY_MS = 1000;
  type ChatMessageRenderRow = Extract<ChatRenderRow, { type: 'message' }>;
  type PendingHistoryScroll = {
    focusHistoryTriggerAfterRestore: boolean;
    requestId: number;
    previousFirstMessageId: string | null;
    previousFirstTranscriptMessageId: string | null;
    previousFirstMessageViewportOffset: number;
    previousCount: number;
    previousScrollTop: number;
    previousScrollHeight: number;
    previousTotalSize: number;
  };

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
    onrollback,
    viewportAttachment,
    typingParticipants,
    readReceipts,
    adapter,
    onadaptererror,
    onpushmessage,
    ontypingchange,
    onreadreceipt,
    onsubmit,
    onretry,
    onedit,
    onapprove,
    ondeny,
    messageReasoning,
    messageSteps,
    messageSuggestions,
    onSuggestionSelect,
    onLoadHistory,
    onstopgenerating,
    onjumptolatest,
    onscrollstatechange,
    onunreadindicatorchange,
    onExpandedChange,
    onattachmentadd,
    onattachmentremove,
    onattachmentfailure,
    oncomposerinput,
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

  // Streaming state: separate from the Conversation to avoid re-rendering the message list
  let streamingContent = $state('');
  let streamingMessageId = $state<string | null>(null);
  let streamingRowElement = $state<HTMLElement | null>(null);

  // Token buffer: accumulate tokens as an array; joined and flushed once per animation frame
  // to avoid O(n²) string work from calling join() on every push.
  let tokenBuffer: string[] = [];
  // rAF handle for batching token flushes and scroll throttling during streaming
  let streamingScrollRaf: number | undefined;

  // C3 — tool approval state. Keyed by tool call id. Both sets are UI-only and
  // are never written back to the transcript. A pending tool-approval part has
  // its call id in neither set (approved === undefined). Once the consumer or
  // adapter resolves the approval, the id moves into one of the sets and the
  // part re-derives to show the resolved state.
  let approvedToolCallIds = $state(new Set<string>());
  let deniedToolCallIds = $state(new Set<string>());
  let editingMessageIds = $state(new Set<string>());
  let pendingRetryMessageTokens = $state(new Map<string, symbol>());

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
    conversationId;
    approvedToolCallIds = new Set();
    pendingRetryMessageTokens = new Map();
    deniedToolCallIds = new Set();
    editingMessageIds = new Set();
    reasoningState.reset();
    toolCallState.reset();
    stepsState.reset();
    typingIndicatorState.reset();
    readReceiptsState.reset();
    clearConsumerAnnouncements();
  });

  let isLoadingHistory = $state(false);
  let adapterHasMoreHistory = $state<boolean | undefined>(undefined);
  let historyAnnouncement = $state('');
  let consumerPoliteAnnouncement = $state('');
  let consumerAssertiveAnnouncement = $state('');
  let consumerPoliteAnnouncementTimeout: ReturnType<typeof setTimeout> | undefined;
  let consumerAssertiveAnnouncementTimeout: ReturnType<typeof setTimeout> | undefined;
  let pendingHistoryScroll: PendingHistoryScroll | null = $state(null);
  let isStabilizingNonVirtualHistoryAnchor = $state(false);
  let nonVirtualHistoryStabilizationGeneration = 0;
  let deferredNonVirtualHistoryStabilization: PendingHistoryScroll | null = null;
  let isHistoryRestorationUserScrolling = false;
  let historyLoadRequestId = 0;
  let historyRestorationScrollPending = false;
  let historyRestorationUserScrollObserved = false;
  let historyRestorationUserScrollResetRaf: number | undefined;
  let deferredHistoryTriggerFocus = $state<
    { conversationId: string; pending: PendingHistoryScroll } | undefined
  >();
  let pendingHistoryAnchorRecaptureRaf: number | undefined;
  let deferredAdapterHasMoreHistory: boolean | null = null;
  let historyAnchorMessageId = $state<string | null>(null);
  let historyAnchorViewportOffset = $state<number | null>(null);
  let historyAnchorRestoredScrollTop: number | null = null;
  // The pending snapshot the most recent NON-virtualized restore applied,
  // kept so the post-settle trigger-swap correction (#1237) can re-anchor
  // against the same baseline after `pendingHistoryScroll` has cleared.
  let nonVirtualRestoredHistoryPending: PendingHistoryScroll | null = null;
  let previousHistoryConversationId: string | undefined;
  let previousHistoryAdapter: ChatAdapter | undefined;

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
      autoStickSuppressedByPrepend = false;
      if (unreadState.unreadCount > 0 || unreadState.newMessageIndicatorVisible) {
        unreadState.markAllAsRead();
      }
    },
  });

  // Cancel any in-flight forced-layout/user-scroll-guard timers on unmount —
  // without this, a scroll animation still settling when the component tears
  // down could fire its cleanup against a gone-away viewport.
  $effect(() => () => scrollState.destroy());

  const unreadState = useChatUnreadState({
    onUnreadIndicatorChange: (event) => {
      // Update the bindable props at the mutation site rather than via a $effect.
      updateUnreadCountBinding(event.unreadCount);
      updateNewMessageIndicatorVisibleBinding(event.newMessageIndicatorVisible);
      onunreadindicatorchange?.(event);
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

  const messages = $derived(getMessages(conversation));
  // C5 — suggested replies are a per-TURN affordance shown only beneath the last
  // message, not on every historical message that still carries the metadata.
  const lastMessageId = $derived(messages.at(-1)?.id);
  let rollbackMessageId = $state<string | null>(null);
  let rollbackConversationIdentity: string | undefined;
  const rollbackBoundaryIndex = $derived(
    rollbackMessageId ? messages.findIndex((message) => message.id === rollbackMessageId) : -1,
  );
  const messageIndexById = $derived(
    new Map(messages.map((message, index) => [message.id, index] as const)),
  );
  $effect(() => {
    if (rollbackConversationIdentity !== conversationId) {
      rollbackMessageId = null;
      rollbackConversationIdentity = conversationId;
      return;
    }
    if (rollbackMessageId && rollbackBoundaryIndex < 0) rollbackMessageId = null;
  });

  function confirmRollback(): void {
    if (!rollbackMessageId) return;
    onrollback?.(rollbackMessageId);
    rollbackMessageId = null;
  }
  // Transcript shape from the auto-scroll effect's previous run, used to tell
  // a history PREPEND (first id changes, last id unchanged) from an APPEND
  // (#1237). Plain lets, NOT $state: they are only read/written inside that
  // effect, and a reactive write there would self-invalidate the effect — the
  // rerun would see "no growth", lose the prepend signal, and pin a stale
  // atBottom=true viewport to the bottom right after a prepend (#1237's
  // nondeterministic bottom-snap). Every tracker below carries that same
  // constraint: plain `let`, never `$state`.
  let previousAutoScrollMessageCount = untrack(() => messages.length);
  let previousAutoScrollFirstMessageId = untrack(() => messages[0]?.id);
  let previousAutoScrollLastMessageId = untrack(() => messages.at(-1)?.id);
  // The VIRTUALIZED scroll extent from that effect's previous run. Virtualized
  // `scrollSize` is derived from `renderRows.length`, which has ALREADY grown
  // by the time `$effect.pre` runs, while `viewport.scrollTop`/`clientHeight`
  // are still pre-mutation DOM reads — measuring one against the other mixes
  // time bases and reports "not at the bottom" for every prepend of more than
  // a row or two. This snapshot is the matching pre-mutation extent.
  let previousAutoScrollVirtualExtent: number | null = null;
  // Latches the prepend guard's DECISION so a rerun that carries no transcript
  // growth — virtual-row measurement bumps the virtualizer's measurement
  // version in the microtask flush right after a prepend, ahead of the rAF
  // that refreshes `atBottom` — cannot fall through the guard it is no longer
  // able to evaluate and pin a stale `atBottom: true` viewport to the bottom.
  let autoStickSuppressedByPrepend = false;

  // The conversation id as a stable VALUE dependency. The subscribe effect keys
  // on this (not on `conversation.id` read inline) so a consumer passing a fresh
  // `conversation` snapshot on every transcript update — but with the same id —
  // does not tear down and reopen the real-time subscription each render.
  const conversationId = $derived(conversation.id);

  const showTypingIndicator = $derived(streaming && !streamingMessageId);

  // Expand capabilities object with per-feature defaults.
  const allowAttachments = $derived(capabilities?.attachments ?? true);
  const allowSearch = $derived(capabilities?.search ?? true);
  const allowCopy = $derived(capabilities?.copy ?? true);
  const allowEditing = $derived(capabilities?.editing ?? true);
  const allowRetry = $derived(capabilities?.retry ?? true);
  const toolCallPairsByCallId = $derived.by(() => {
    const toolCallPairs = pairToolCallsWithResults(messages);
    const map = new Map<string, ReturnType<typeof pairToolCallsWithResults>>();
    for (const pair of toolCallPairs) {
      const existing = map.get(pair.call.id);
      if (existing) {
        existing.push(pair);
      } else {
        map.set(pair.call.id, [pair]);
      }
    }
    return map;
  });
  const toolResultMessagesByResult = $derived.by(() => {
    const map = new Map<ToolResult, Message>();
    for (const message of messages) {
      if (message.role === 'tool-result' && message.toolResult) {
        map.set(message.toolResult, message);
      }
    }
    return map;
  });
  const actionRequiredToolCallIds = $derived.by(() => {
    const ids = new Set<string>();
    for (const [callId, pairs] of toolCallPairsByCallId) {
      if (pairs.some((pair) => pair.result?.outcome === 'action_required')) ids.add(callId);
    }
    return ids;
  });
  const renderRows = $derived.by(() => {
    const pairedToolResultIds = findPairedToolResultIds(messages);
    const messagesWithDates = buildMessagesWithDateSeparators(messages, pairedToolResultIds);
    return buildChatRenderRows(messagesWithDates, {
      firstUnreadId: unreadState.firstUnreadId,
      showTypingIndicator,
      ungroupedToolCallIds:
        row ||
        messagePart ||
        messageActions ||
        messageStatus ||
        searchState.isOpen ||
        rollbackMessageId
          ? new Set(
              messages.flatMap((message) => (message.toolCall?.id ? [message.toolCall.id] : [])),
            )
          : actionRequiredToolCallIds,
    });
  });
  let hasMounted = $state(false);
  $effect(() => {
    hasMounted = true;
  });

  const isVirtualized = $derived(virtualized && hasMounted && messages.length > 0);
  const timelineResetIdentity = $derived(
    `${conversationId}:${isVirtualized ? 'virtualized' : 'full'}`,
  );
  const staticRowsResetIdentity = $derived(messages[0]?.id ?? '');

  const chatVirtualizer = new ChatVirtualizer({
    getScrollElement: () => viewport,
    getCount: () => (isVirtualized ? renderRows.length : 0),
    getItemKey: (index) => chatRenderRowKey(renderRows[index] ?? { type: 'typing' }),
    getEstimatedSize: () => virtualizationEstimatedRowHeight,
    getOverscan: () => virtualizationOverscan,
    getInitialHeight: () => virtualizationInitialHeight,
    getScrollPaddingStart: () => virtualSpacerOffsetTop(),
  });

  const virtualRows = $derived.by(() => {
    if (!isVirtualized) return [];

    const renderedIndexes = new Set<number>();
    const rows: { row: ChatRenderRow; virtualItem: VirtualItem }[] = [];
    for (const virtualItem of chatVirtualizer.virtualItems) {
      const row = renderRows[virtualItem.index];
      if (!row) continue;
      renderedIndexes.add(virtualItem.index);
      rows.push({ row, virtualItem: pinHistoryAnchorVirtualItem(row, virtualItem) });
    }

    if (streamingMessageId) {
      const streamingIndex = findRenderRowIndexByMessageId(renderRows, streamingMessageId);
      if (streamingIndex >= 0 && !renderedIndexes.has(streamingIndex)) {
        const virtualItem = chatVirtualizer.getVirtualItem(streamingIndex);
        if (!virtualItem) return rows;
        rows.push({
          row: renderRows[streamingIndex]!,
          virtualItem,
        });
      }
    }

    if (historyAnchorMessageId) {
      const historyAnchorIndex = findRenderRowIndexByMessageId(renderRows, historyAnchorMessageId);
      if (historyAnchorIndex >= 0 && !renderedIndexes.has(historyAnchorIndex)) {
        const virtualItem = chatVirtualizer.getVirtualItem(historyAnchorIndex);
        if (!virtualItem) return rows;
        const row = renderRows[historyAnchorIndex];
        if (row) {
          rows.push({
            row,
            virtualItem: pinHistoryAnchorVirtualItem(row, virtualItem),
          });
        }
      }
    }

    rows.sort((a, b) => a.virtualItem.index - b.virtualItem.index);
    return rows;
  });

  function pinHistoryAnchorVirtualItem(row: ChatRenderRow, virtualItem: VirtualItem): VirtualItem {
    if (
      historyAnchorViewportOffset === null ||
      row.type !== 'message' ||
      row.message.id !== historyAnchorMessageId
    ) {
      return virtualItem;
    }

    const scrollTop = viewport?.scrollTop ?? chatVirtualizer.scrollOffset;
    const start = Math.max(
      0,
      scrollTop - chatVirtualizer.scrollPaddingStart + historyAnchorViewportOffset,
    );
    return {
      ...virtualItem,
      start,
      end: start + virtualItem.size,
    };
  }

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
  const effectiveHasMoreHistory = $derived(adapterHasMoreHistory ?? moreHistoryAvailable);
  const hasHistoryLoader = $derived(
    onLoadHistory !== undefined || adapter?.loadOlderMessages !== undefined,
  );
  const showHistoryTrigger = $derived(hasHistoryLoader && effectiveHasMoreHistory);
  const isRestoringNonVirtualHistory = $derived(
    !isVirtualized && (pendingHistoryScroll !== null || isStabilizingNonVirtualHistoryAnchor),
  );

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
      cancelNonVirtualHistoryAnchorStabilization();
      resetHistoryRestorationUserScrolling();
      cancelPendingHistoryAnchorRecapture();
      adapterHasMoreHistory = undefined;
      pendingHistoryScroll = null;
      deferredAdapterHasMoreHistory = null;
      nonVirtualRestoredHistoryPending = null;
      // Or the latch leaks across conversation switches.
      autoStickSuppressedByPrepend = false;
      clearHistoryAnchor();
    }
    previousHistoryConversationId = currentConversationId;
    previousHistoryAdapter = currentAdapter;
  });

  $effect(() => {
    const deferredFocus = deferredHistoryTriggerFocus;
    if (deferredFocus === undefined || isLoadingHistory) return;

    deferredHistoryTriggerFocus = undefined;
    void tick().then(() => {
      if (
        conversationId === deferredFocus.conversationId &&
        canRestoreDeferredHistoryTriggerFocus()
      ) {
        focusAfterHistoryRestore(deferredFocus.pending, true);
      }
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
  // handle it — so an adapter-only consumer (no `onretry`/`onedit`) still gets
  // working buttons, and a callback-only consumer is unchanged.
  const canRetry = $derived(onretry !== undefined || adapter?.retryMessage !== undefined);
  const canEdit = $derived(onedit !== undefined || adapter?.editMessage !== undefined);

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

  // C3 — assertive announcement for action-required tool approvals. Derived from
  // the first pending tool-approval part in the current transcript. When a new
  // tool-approval part appears (outcome === 'action_required' + action present),
  // this updates and the assertive live region interrupts screen readers.
  const toolApprovalAssertiveMessage = $derived.by(() => {
    for (const message of messages) {
      if (
        message.role === 'tool-result' &&
        message.toolResult?.outcome === 'action_required' &&
        message.toolResult.action &&
        !approvedToolCallIds.has(message.toolResult.callId) &&
        !deniedToolCallIds.has(message.toolResult.callId)
      ) {
        const actionMessage =
          message.toolResult.action.message ??
          'This tool call requires your approval before it can continue.';
        return `Action required: ${actionMessage}`;
      }
    }
    return '';
  });
  let hasObservedToolStatuses = false;
  let observedToolStatusConversationId: string | undefined;
  let previousToolStatuses = new Map<string, { name: string; status: string }>();
  $effect(() => {
    const currentConversationId = conversationId;
    const currentToolStatuses = new Map<string, { name: string; status: string }>();
    for (const message of messages) {
      if (message.role === 'tool-call' && message.toolCall) {
        currentToolStatuses.set(message.toolCall.id, {
          name: message.toolCall.name,
          status: 'pending',
        });
      } else if (message.role === 'tool-result' && message.toolResult) {
        const previous = currentToolStatuses.get(message.toolResult.callId);
        currentToolStatuses.set(message.toolResult.callId, {
          name: previous?.name ?? 'Tool call',
          status: message.toolResult.outcome,
        });
      }
    }
    if (currentConversationId !== observedToolStatusConversationId) {
      hasObservedToolStatuses = false;
      observedToolStatusConversationId = currentConversationId;
    }
    if (hasObservedToolStatuses) {
      const statusAnnouncements: string[] = [];
      for (const [callId, current] of currentToolStatuses) {
        const previous = previousToolStatuses.get(callId);
        if (!previous || previous.status === current.status) continue;
        if (current.status === 'action_required') continue;
        const statusLabel =
          current.status === 'success'
            ? 'complete'
            : current.status === 'error'
              ? 'failed'
              : current.status;
        statusAnnouncements.push(`${current.name} ${statusLabel}`);
      }
      if (statusAnnouncements.length > 0) {
        setConsumerPoliteAnnouncement(statusAnnouncements.join('. '));
      }
    }
    previousToolStatuses = currentToolStatuses;
    hasObservedToolStatuses = true;
  });
  const assertiveAnnouncement = $derived(
    toolApprovalAssertiveMessage || consumerAssertiveAnnouncement,
  );
  const politeAnnouncement = $derived(
    consumerPoliteAnnouncement || historyAnnouncement || unreadState.announcerMessage,
  );

  $effect(() => {
    if (toolApprovalAssertiveMessage && consumerAssertiveAnnouncement) {
      clearConsumerAssertiveAnnouncement();
    }
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
    if (!viewport) return undefined;

    // Register dependency on message count
    const currentCount = messages.length;
    const isTranscriptGrowth = currentCount > previousAutoScrollMessageCount;
    previousAutoScrollMessageCount = currentCount;
    // A growth that changes the FIRST message while keeping the LAST one is a
    // history prepend, not an append: nothing new arrived at the bottom, so
    // there is nothing for stick-to-bottom to reveal (#1237).
    const currentFirstMessageId = messages[0]?.id;
    const currentLastMessageId = messages.at(-1)?.id;
    const isHistoryPrepend =
      isTranscriptGrowth &&
      currentFirstMessageId !== previousAutoScrollFirstMessageId &&
      currentLastMessageId === previousAutoScrollLastMessageId;
    previousAutoScrollFirstMessageId = currentFirstMessageId;
    previousAutoScrollLastMessageId = currentLastMessageId;
    const isTranscriptAppend = isTranscriptGrowth && !isHistoryPrepend;
    // Genuine growth at the bottom is the one thing that unambiguously makes
    // stick-to-bottom relevant again — release the prepend latch on it.
    if (isTranscriptAppend) autoStickSuppressedByPrepend = false;
    // Keep the scroll extent as a dependency so virtual row measurement can
    // trigger one final bottom correction after the appended row is measured.
    const currentScrollExtent = isVirtualized ? chatVirtualizer.scrollSize : viewport.scrollHeight;
    void currentScrollExtent;
    // Snapshot it for the NEXT run, advancing before any early return below
    // (exactly as the message trackers above do) so the value a prepend run
    // reads always describes the transcript as it was before that prepend.
    const previousVirtualExtent = previousAutoScrollVirtualExtent;
    previousAutoScrollVirtualExtent = isVirtualized ? currentScrollExtent : null;

    // Read atBottom without making it a dependency (prevents loops)
    const atBottom = untrack(() => scrollState.atBottom);

    // Skip if user initiated a smooth scroll (e.g., via jump button)
    // Note: a prepend that lands inside a guarded scroll bails here AFTER the
    // trackers advanced but BEFORE the guard below runs, so it latches
    // nothing. That is acceptable rather than silent — the guard's settlement
    // recomputes `atBottom` against real geometry when it finishes.
    if (scrollState.isUserScrolling) return undefined;

    // A history prepend must never engage stick-to-bottom off a stale
    // `atBottom` flag (#1237): the flag's recompute is rAF-deferred, so it can
    // still say "at bottom" moments after a programmatic scroll away. Verify
    // the flag against the viewport's PRE-MUTATION geometry and let the
    // prepend through only when it genuinely sits at the bottom (where the
    // correction keeps the latest message pinned).
    //
    // "Pre-mutation" needs care per branch. `scrollTop`/`clientHeight` are DOM
    // reads and this effect runs before the DOM update, so they always are.
    // The extent is not: non-virtualized `viewport.scrollHeight` is also a DOM
    // read and therefore still pre-prepend, but virtualized `scrollSize` is
    // computed from `renderRows`, a `$derived` that has already recomputed
    // with the prepended rows. Use the previous run's snapshot there.
    if (isHistoryPrepend) {
      const preMutationExtent =
        isVirtualized && previousVirtualExtent !== null
          ? previousVirtualExtent
          : currentScrollExtent;
      const genuinelyAtBottom = checkIsAtBottom(
        {
          scrollTop: viewport.scrollTop,
          scrollHeight: preMutationExtent,
          clientHeight: viewport.clientHeight,
        },
        bottomThreshold,
      );
      // Carry the decision, not just "this was a prepend": the reruns that
      // virtual-row measurement triggers no longer see any growth, so they
      // cannot re-derive it.
      autoStickSuppressedByPrepend = !genuinelyAtBottom;
      if (!genuinelyAtBottom) return undefined;
    }

    // Explicit history anchoring owns scroll restoration while a prepend is pending
    // and until the user scrolls away from the restored anchor.
    const hasActiveHistoryAnchor = untrack(
      () => pendingHistoryScroll !== null || historyAnchorMessageId !== null,
    );
    if (hasActiveHistoryAnchor) return undefined;

    // A rejected prepend stays rejected until something makes `atBottom`
    // trustworthy again (a real scroll recompute, the bottom sentinel, a
    // genuine append, or a conversation switch). Without this, the
    // measurement-driven rerun above falls straight through to the correction
    // below and snaps a stale-true viewport to the bottom (#1237).
    if (!isTranscriptGrowth && autoStickSuppressedByPrepend) return undefined;

    const activeEditNeedsScrollRecompute =
      isTranscriptAppend && untrack(() => editingMessageIds.size > 0);
    if ((atBottom || activeEditNeedsScrollRecompute) && currentCount > 0) {
      let cancelled = false;
      const waitForBottomTarget = isTranscriptAppend ? waitForLayoutFrame() : tick();
      void waitForBottomTarget.then(() => {
        if (cancelled || !viewport || pendingHistoryScroll || historyAnchorMessageId !== null) {
          return;
        }
        if (editingMessageIds.size > 0) {
          scrollState.recomputeFromViewport(viewport);
          return;
        }
        // Re-check the guard at execution time: a guarded scroll (e.g.
        // scrollToTop()) can be issued between this effect's synchronous run
        // and this deferred continuation. Correcting toward the bottom here
        // would cancel that scroll's animation mid-flight (#1236).
        if (scrollState.isUserScrolling) return;
        if (isVirtualized) {
          // A remeasurement can invalidate this effect without changing the
          // viewport's actual position. Avoid another instant correction when
          // the browser has already settled at the current bottom (#1243).
          const maximumOffset = Math.max(
            0,
            chatVirtualizer.scrollSize - (viewport.clientHeight || virtualizationInitialHeight),
          );
          if (Math.abs((viewport.scrollTop || 0) - maximumOffset) <= 1) return;
          chatVirtualizer.scrollToOffset(chatVirtualizer.scrollSize, { behavior: 'instant' });
        } else {
          viewport?.scrollTo({ top: viewport.scrollHeight, behavior: 'instant' });
        }
      });

      return () => {
        cancelled = true;
      };
    }

    return undefined;
  });

  // Virtualized path: restore after a layout frame so freshly-mounted virtual
  // rows can be measured first (the pinned anchor virtual item holds the
  // anchor's on-screen position in the interim).
  $effect.pre(() => {
    if (!viewport || !pendingHistoryScroll || !isVirtualized) return;

    const pending = pendingHistoryScroll;
    messages.length;
    messages[0]?.id;
    void restorePendingHistoryScrollAfterLayout(pending);
  });

  // Non-virtualized path: restore SYNCHRONOUSLY in the same flush that
  // committed the prepend. A plain $effect runs after the DOM mutation but
  // before the browser paints, so the anchor correction lands in the same
  // rendered frame as the prepend — deferring it by even one animation frame
  // (the pre-#1237-fix behavior) painted the un-compensated transcript first:
  // a visible flash of the prepended block pushing the anchored content down.
  $effect(() => {
    if (!viewport || !pendingHistoryScroll || isVirtualized) return;

    const pending = pendingHistoryScroll;
    messages.length;
    messages[0]?.id;
    const restored = restoreHistoryScroll(pending);
    if (restored) {
      void stabilizeNonVirtualHistoryAnchor(pending);
    }
  });

  async function waitForLayoutFrame(): Promise<void> {
    await tick();
    if (typeof requestAnimationFrame !== 'function') return;

    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => resolve());
    });
  }

  async function restorePendingHistoryScrollAfterLayout(
    pending: PendingHistoryScroll,
  ): Promise<boolean> {
    await waitForLayoutFrame();
    if (pendingHistoryScroll !== pending) return false;
    const restored = restoreHistoryScroll(pending);
    if (restored && !isVirtualized) {
      await stabilizeNonVirtualHistoryAnchor(pending);
    }
    return restored;
  }

  function restoreHistoryScroll(pending: PendingHistoryScroll): boolean {
    if (!viewport) return false;

    const currentFirstMessageId = messages[0]?.id ?? null;
    const currentCount = messages.length;
    if (
      currentCount <= pending.previousCount ||
      currentFirstMessageId === pending.previousFirstTranscriptMessageId
    ) {
      return false;
    }

    const prependedCount = currentCount - pending.previousCount;
    pendingHistoryScroll = null;
    finishDeferredAdapterHistoryLoading();
    if (isVirtualized) {
      setHistoryAnchor(pending);
    }

    if (isVirtualized) {
      const newTotalSize = chatVirtualizer.scrollSize;
      const delta = newTotalSize - pending.previousTotalSize;
      const targetScrollTop = pending.previousScrollTop + delta;
      chatVirtualizer.scrollToOffset(targetScrollTop, { behavior: 'instant' });
      historyAnchorRestoredScrollTop = viewport?.scrollTop ?? chatVirtualizer.scrollOffset;
    } else {
      clearHistoryAnchor();
      nonVirtualRestoredHistoryPending = pending;
      const anchorCorrection = nonVirtualHistoryAnchorCorrection(pending);
      const targetScrollTop =
        anchorCorrection === null
          ? pending.previousScrollTop + (viewport.scrollHeight - pending.previousScrollHeight)
          : viewport.scrollTop + anchorCorrection;
      historyRestorationScrollPending = true;
      viewport.scrollTo({
        top: targetScrollTop,
        behavior: 'instant',
      });
    }
    const announcement =
      prependedCount === 1
        ? '1 earlier message loaded.'
        : `${prependedCount} earlier messages loaded.`;
    historyAnnouncement = announcement;
    setTimeout(() => {
      if (historyAnnouncement === announcement) {
        historyAnnouncement = '';
      }
    }, 1000);
    if (pending.focusHistoryTriggerAfterRestore) {
      deferredHistoryTriggerFocus = { conversationId, pending };
    } else {
      void tick().then(() => {
        if (canRestoreDeferredHistoryTriggerFocus()) {
          focusAfterHistoryRestore(pending, false);
        }
      });
    }
    return true;
  }

  function nonVirtualHistoryAnchorCorrection(pending: PendingHistoryScroll): number | null {
    if (!viewport || pending.previousFirstMessageId === null) return null;

    const anchor = renderedMessageById(pending.previousFirstMessageId);
    if (!anchor) return null;

    const anchorRect = anchor.getBoundingClientRect();
    const viewportRect = viewport.getBoundingClientRect();
    const hasLayoutBox =
      anchorRect.top !== 0 ||
      anchorRect.bottom !== 0 ||
      viewportRect.top !== 0 ||
      viewportRect.bottom !== 0;
    if (!hasLayoutBox) return null;

    const currentOffset = anchorRect.top - viewportRect.top;
    return currentOffset - pending.previousFirstMessageViewportOffset;
  }

  async function stabilizeNonVirtualHistoryAnchor(pending: PendingHistoryScroll): Promise<void> {
    if (isHistoryRestorationUserScrolling && !historyRestorationUserScrollObserved) {
      deferredNonVirtualHistoryStabilization = pending;
      return;
    }
    deferredNonVirtualHistoryStabilization = null;
    const userScrolled = historyRestorationUserScrollObserved;
    resetHistoryRestorationUserScrolling();
    if (userScrolled) {
      // The user moved the viewport before the prepend rendered, so this
      // restoration no longer owns it. Drop the post-settle snapshot too —
      // the reset above just cleared the only flags the post-settle
      // correction could have used to notice (#1237).
      nonVirtualRestoredHistoryPending = null;
      return;
    }

    const generation = ++nonVirtualHistoryStabilizationGeneration;
    const stabilizationConversationId = conversationId;
    isStabilizingNonVirtualHistoryAnchor = true;
    try {
      for (let attempt = 0; attempt < 5; attempt += 1) {
        await waitForLayoutFrame();
        if (
          !viewport ||
          generation !== nonVirtualHistoryStabilizationGeneration ||
          conversationId !== stabilizationConversationId
        ) {
          return;
        }

        const correction = nonVirtualHistoryAnchorCorrection(pending);
        if (correction === null) return;
        if (Math.abs(correction) < 1) continue;
        viewport.scrollTo({
          top: viewport.scrollTop + correction,
          behavior: 'instant',
        });
      }
    } finally {
      if (generation === nonVirtualHistoryStabilizationGeneration) {
        isStabilizingNonVirtualHistoryAnchor = false;
      }
    }
  }

  /**
   * One final anchor correction AFTER the history trigger settles into its
   * post-load state (#1237). The restore itself measures while the trigger
   * row still shows its loading state (and, when the last page loads, while
   * the trigger is still mounted): `isLoadingHistory` / `adapterHasMoreHistory`
   * flip only after restoration settles, so the swap back to the idle label —
   * or the trigger unmounting entirely on `hasMore: false` — changes the
   * height of the content ABOVE the anchor after the stabilization frames
   * have already run, shifting the anchored message by exactly that height
   * delta. Wait for the swap to commit, re-measure, and absorb it.
   *
   * Ownership: the retained snapshot (`nonVirtualRestoredHistoryPending`) is
   * now DROPPED at every ownership transfer — jump-to-latest, submit,
   * `scrollToBottom()`, `scrollToTop()`, search navigation, and a user scroll
   * observed before the prepend rendered — so this function is a strict no-op
   * once another owner has the viewport. The scroll-flag guard below is a
   * backstop, not the primary defense: `invalidatePendingHistoryRestoration()`
   * zeroes both of those flags, so they read clean exactly when ownership just
   * moved. The scrollTop-delta check is a second backstop and is likewise
   * partial — `tick()` is a microtask, so it cannot see a scroll that finished
   * before the loader resolved, nor a still-animating smooth scroll.
   */
  async function correctNonVirtualAnchorAfterHistorySettle(requestId: number): Promise<void> {
    const restored = nonVirtualRestoredHistoryPending;
    if (!viewport || isVirtualized || restored === null || restored.requestId !== requestId) {
      return;
    }
    if (historyRestorationUserScrollObserved || isHistoryRestorationUserScrolling) return;
    const scrollTopAtFlip = viewport.scrollTop;
    // Let the isLoadingHistory / adapterHasMoreHistory flips commit to the DOM
    // (trigger label swap or unmount) before measuring.
    await tick();
    if (!viewport || nonVirtualRestoredHistoryPending !== restored) return;
    // A position change across the flip means the user (or the stabilization
    // loop) already moved the viewport; leave it alone.
    if (Math.abs(viewport.scrollTop - scrollTopAtFlip) > 1) return;
    const correction = nonVirtualHistoryAnchorCorrection(restored);
    if (correction === null || Math.abs(correction) < 1) return;
    viewport.scrollTo({ top: viewport.scrollTop + correction, behavior: 'instant' });
  }

  /**
   * The single exit from a history load: flip the loading flag back to idle and
   * absorb the trigger-row height change that flip causes (#1237).
   *
   * Both outcomes need it. A REJECTION swaps the trigger back from its loading
   * label exactly as a resolution does, and the bounded stabilization loop
   * started by the restore has long since exited by the time a failure arrives
   * a network round-trip later — so wiring the correction to the success paths
   * only left the error paths uncorrected. Pairing the flip with the correction
   * in one helper makes that asymmetry impossible to reintroduce.
   *
   * Safe to call unconditionally: the correction early-returns when the
   * transcript never changed (`captureHistoryScroll` nulls the snapshot), so a
   * load that failed before prepending anything is a strict no-op.
   */
  async function settleHistoryLoading(requestId: number): Promise<void> {
    isLoadingHistory = false;
    await correctNonVirtualAnchorAfterHistorySettle(requestId);
  }

  function cancelNonVirtualHistoryAnchorStabilization(): void {
    nonVirtualHistoryStabilizationGeneration += 1;
    isStabilizingNonVirtualHistoryAnchor = false;
    deferredNonVirtualHistoryStabilization = null;
    deferredHistoryTriggerFocus = undefined;
  }

  function cancelPendingHistoryAnchorRecapture(): void {
    if (pendingHistoryAnchorRecaptureRaf === undefined) return;
    cancelAnimationFrame(pendingHistoryAnchorRecaptureRaf);
    pendingHistoryAnchorRecaptureRaf = undefined;
  }

  /**
   * Another scroll owner is taking the viewport. Drop EVERY piece of retained
   * history-restoration state, including the post-settle anchor snapshot
   * (#1237): `resetHistoryRestorationUserScrolling()` zeroes both flags that
   * `correctNonVirtualAnchorAfterHistorySettle` reads as its "did the user
   * take over?" guard, so leaving the snapshot live here would let a late
   * loader resolution re-anchor a viewport this call just moved — with the
   * guard reading clean precisely because ownership moved.
   *
   * Callers are all unambiguous ownership transfers (jump-to-latest, submit,
   * `scrollToBottom()`, `scrollToTop()`); none of them run on the normal
   * restore path.
   */
  function invalidatePendingHistoryRestoration(): void {
    pendingHistoryScroll = null;
    nonVirtualRestoredHistoryPending = null;
    cancelPendingHistoryAnchorRecapture();
    resetHistoryRestorationUserScrolling();
  }

  function recapturePendingHistoryAnchor(pending: PendingHistoryScroll | null): void {
    if (pending === null || pendingHistoryScroll !== pending || historyTranscriptChanged(pending)) {
      return;
    }
    captureHistoryScroll(pending.requestId);
  }

  function schedulePendingHistoryAnchorRecapture(): void {
    const pending = pendingHistoryScroll;
    if (pending === null) return;
    cancelPendingHistoryAnchorRecapture();
    pendingHistoryAnchorRecaptureRaf = requestAnimationFrame(() => {
      pendingHistoryAnchorRecaptureRaf = undefined;
      recapturePendingHistoryAnchor(pending);
    });
  }

  function handleHistoryRestorationUserInput(): void {
    if (
      pendingHistoryScroll === null &&
      !isStabilizingNonVirtualHistoryAnchor &&
      deferredHistoryTriggerFocus === undefined
    ) {
      return;
    }
    isHistoryRestorationUserScrolling = true;
    historyRestorationUserScrollObserved = false;
    scheduleHistoryRestorationUserScrollReset();
    cancelNonVirtualHistoryAnchorStabilization();
    if (pendingHistoryScroll !== null) {
      pendingHistoryScroll.focusHistoryTriggerAfterRestore = false;
    }
  }

  function resetHistoryRestorationUserScrolling(): void {
    cancelHistoryRestorationUserScrollReset();
    deferredNonVirtualHistoryStabilization = null;
    historyRestorationScrollPending = false;
    isHistoryRestorationUserScrolling = false;
    historyRestorationUserScrollObserved = false;
  }

  function cancelHistoryRestorationUserScrollReset(): void {
    if (historyRestorationUserScrollResetRaf === undefined) return;
    cancelAnimationFrame(historyRestorationUserScrollResetRaf);
    historyRestorationUserScrollResetRaf = undefined;
  }

  function scheduleHistoryRestorationUserScrollReset(): void {
    cancelHistoryRestorationUserScrollReset();
    // A pointer or wheel gesture can precede the browser's scroll event by
    // multiple rendering frames. Keep the gesture active long enough to
    // observe that event, but expire a no-op gesture that produces no scroll.
    historyRestorationUserScrollResetRaf = requestAnimationFrame(() => {
      historyRestorationUserScrollResetRaf = requestAnimationFrame(() => {
        historyRestorationUserScrollResetRaf = requestAnimationFrame(() => {
          historyRestorationUserScrollResetRaf = undefined;
          isHistoryRestorationUserScrolling = false;
          const pending = deferredNonVirtualHistoryStabilization;
          deferredNonVirtualHistoryStabilization = null;
          if (pending !== null) {
            void stabilizeNonVirtualHistoryAnchor(pending);
          }
        });
      });
    });
  }

  function setHistoryAnchor(pending: PendingHistoryScroll): void {
    historyAnchorMessageId = pending.previousFirstMessageId;
    historyAnchorViewportOffset = pending.previousFirstMessageViewportOffset;
    historyAnchorRestoredScrollTop = null;
  }

  function clearHistoryAnchor(): void {
    historyAnchorMessageId = null;
    historyAnchorViewportOffset = null;
    historyAnchorRestoredScrollTop = null;
  }

  function clearHistoryAnchorAfterScroll(scrollTop: number): void {
    if (
      historyAnchorMessageId !== null &&
      historyAnchorRestoredScrollTop !== null &&
      Math.abs(scrollTop - historyAnchorRestoredScrollTop) > 2
    ) {
      clearHistoryAnchor();
    }
  }

  function handleScrollStateChange(event: {
    atBottom: boolean;
    scrollTop: number;
    scrollHeight: number;
  }): void {
    clearHistoryAnchorAfterScroll(event.scrollTop);

    // Scrolling is what recycles rows, so this is where a focused row can have
    // been unmounted out from under the user.
    reclaimFocusIfRowDetached();

    // `atBottom` was just recomputed from real geometry, so the prepend latch
    // has nothing left to protect. This is the LOAD-BEARING clear of the two:
    // it covers both the scroll listener's rAF recompute and
    // `recomputeAtBottomAtSettlement`, whereas `onReachBottom` only fires on
    // the sentinel's false→true transition — a latch stuck stale-true would
    // never reach it.
    autoStickSuppressedByPrepend = false;

    // Update the bindable prop at the mutation site rather than via a $effect.
    updateAtBottomBinding(event.atBottom);

    onscrollstatechange?.(event);
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

  function focusAfterHistoryRestore(
    pending: PendingHistoryScroll,
    focusHistoryTrigger: boolean,
  ): void {
    if (!viewport) return;

    if (focusHistoryTrigger && showHistoryTrigger && historyTriggerRef) {
      historyTriggerRef.focus({ preventScroll: true });
      return;
    }

    const anchor = pending.previousFirstMessageId
      ? viewport.querySelector<HTMLElement>(
          `#message-${CSS.escape(pending.previousFirstMessageId)}`,
        )
      : null;
    const target = anchor ?? viewport.querySelector<HTMLElement>('.chat-message');
    target?.focus({ preventScroll: true });
  }

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
      if (streamingScrollRaf !== undefined) {
        cancelAnimationFrame(streamingScrollRaf);
        streamingScrollRaf = undefined;
      }
      cancelPendingHistoryAnchorRecapture();
      resetHistoryRestorationUserScrolling();
      clearConsumerAnnouncements();
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
    let active = true;
    const handlers: ChatPushHandlers = {
      onMessage: (message) => {
        if (active) untrack(() => onpushmessage)?.(message);
      },
      onTypingChange: (isTyping) => {
        if (!active) return;
        // Drive the C6 per-participant typing indicator via the adapter path.
        typingIndicatorState.handleAdapterTypingChange(isTyping);
        untrack(() => ontypingchange)?.(isTyping);
      },
      onReadReceipt: (event) => {
        if (!active) return;
        // Accumulate the receipt into C6 read receipt state.
        readReceiptsState.handleAdapterReadReceipt(event);
        untrack(() => onreadreceipt)?.(event);
      },
      onStreamBegin: (messageId) => {
        if (active) beginStreaming(messageId);
      },
      onTokenPush: (token) => {
        if (active) pushToken(token);
      },
      onStreamEnd: () => {
        if (active) endStreaming();
      },
    };

    const unsubscribe = resolvedAdapter.subscribe(currentConversationId, handlers);

    // Teardown: close the transport (guarding a contract-violating non-function
    // return so a bad adapter can't crash Svelte's cleanup), clear the imperative
    // streaming buffer, AND clear the adapter-derived C6 typing/receipt state.
    // Without the `endStreaming()`, a resubscribe or conversation switch mid-stream
    // (no `onStreamEnd` fired) would leave `streamingMessageId`/`streamingContent`
    // driving a row. Without the typing/receipt resets, an adapter that changed or
    // was removed for the SAME conversation would leave a synthetic typing
    // participant, a pending live-region timer, and accumulated receipts alive
    // (the conversation-change effect above only fires on an id change).
    return () => {
      active = false;
      if (typeof unsubscribe === 'function') unsubscribe();
      endStreaming();
      typingIndicatorState.reset();
      readReceiptsState.reset();
    };
  });

  // ==========================================================================
  // Create Scroll Attachment
  // ==========================================================================

  const scrollAttachment = scrollState.createScrollAttachment();
  const historyAnchorScrollAttachment: Attachment<HTMLElement> = (node) => {
    const handleScroll = () => {
      clearHistoryAnchorAfterScroll(node.scrollTop);
      const isExpectedRestorationScroll = historyRestorationScrollPending;
      historyRestorationScrollPending = false;
      if (isHistoryRestorationUserScrolling && !isExpectedRestorationScroll) {
        historyRestorationUserScrollObserved = true;
        deferredNonVirtualHistoryStabilization = null;
        cancelHistoryRestorationUserScrollReset();
      }
      if (
        isHistoryRestorationUserScrolling &&
        historyRestorationUserScrollObserved &&
        pendingHistoryScroll === null
      ) {
        cancelNonVirtualHistoryAnchorStabilization();
      }
      schedulePendingHistoryAnchorRecapture();
    };
    const handleScrollEnd = () => {
      if (
        isHistoryRestorationUserScrolling &&
        historyRestorationUserScrollObserved &&
        pendingHistoryScroll === null
      ) {
        cancelNonVirtualHistoryAnchorStabilization();
      }
      isHistoryRestorationUserScrolling = false;
      cancelPendingHistoryAnchorRecapture();
      recapturePendingHistoryAnchor(pendingHistoryScroll);
    };
    node.addEventListener('scroll', handleScroll, { passive: true });
    node.addEventListener('scrollend', handleScrollEnd);

    return () => {
      node.removeEventListener('scroll', handleScroll);
      node.removeEventListener('scrollend', handleScrollEnd);
    };
  };
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
    const trimmedMessage = message.trim();
    if (!trimmedMessage) return;

    if (level === 'assertive') {
      if (toolApprovalAssertiveMessage) return;
      setConsumerAssertiveAnnouncement(trimmedMessage);
      return;
    }

    setConsumerPoliteAnnouncement(trimmedMessage);
  }

  function setConsumerPoliteAnnouncement(message: string): void {
    clearTimeout(consumerPoliteAnnouncementTimeout);
    consumerPoliteAnnouncement = message;
    consumerPoliteAnnouncementTimeout = setTimeout(() => {
      if (consumerPoliteAnnouncement === message) consumerPoliteAnnouncement = '';
      consumerPoliteAnnouncementTimeout = undefined;
    }, CONSUMER_ANNOUNCEMENT_CLEAR_DELAY_MS);
  }

  function setConsumerAssertiveAnnouncement(message: string): void {
    clearTimeout(consumerAssertiveAnnouncementTimeout);
    consumerAssertiveAnnouncement = message;
    consumerAssertiveAnnouncementTimeout = setTimeout(() => {
      if (consumerAssertiveAnnouncement === message) consumerAssertiveAnnouncement = '';
      consumerAssertiveAnnouncementTimeout = undefined;
    }, CONSUMER_ANNOUNCEMENT_CLEAR_DELAY_MS);
  }

  function clearConsumerPoliteAnnouncement(): void {
    clearTimeout(consumerPoliteAnnouncementTimeout);
    consumerPoliteAnnouncementTimeout = undefined;
    consumerPoliteAnnouncement = '';
  }

  function clearConsumerAssertiveAnnouncement(): void {
    clearTimeout(consumerAssertiveAnnouncementTimeout);
    consumerAssertiveAnnouncementTimeout = undefined;
    consumerAssertiveAnnouncement = '';
  }

  function clearConsumerAnnouncements(): void {
    clearConsumerPoliteAnnouncement();
    clearConsumerAssertiveAnnouncement();
  }

  function handleJumpToLatest(): void {
    cancelNonVirtualHistoryAnchorStabilization();
    invalidatePendingHistoryRestoration();
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
      onjumptolatest?.();
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
      });
      return;
    }

    scrollState.jumpToLatest(viewport, () => {
      unreadState.markAllAsRead();
      onjumptolatest?.();
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
    cancelNonVirtualHistoryAnchorStabilization();
    invalidatePendingHistoryRestoration();
    const autoScrollSuppressed = editingMessageIds.size > 0;
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

    // Auto-scroll after sending.
    // Also update the bindable prop so the parent binding reflects the new
    // atBottom=true state immediately — scrollState.setAtBottom() only
    // updates the internal helper state; the bindable must be written explicitly
    // (matching the pattern in handleScrollStateChange and onReachBottom).
    if (!autoScrollSuppressed) {
      scrollState.setAtBottom(true);
      updateAtBottomBinding(true);
    }
    tick().then(() => {
      if (autoScrollSuppressed) {
        scrollState.recomputeFromViewport(viewport);
        return;
      }
      if (isVirtualized) {
        chatVirtualizer.scrollToOffset(chatVirtualizer.scrollSize, { behavior: 'instant' });
      } else {
        viewport?.scrollTo({ top: viewport.scrollHeight, behavior: 'instant' });
      }
    });
  }

  function captureHistoryScroll(requestId: number): void {
    cancelNonVirtualHistoryAnchorStabilization();
    cancelPendingHistoryAnchorRecapture();
    const focusHistoryTriggerAfterRestore =
      pendingHistoryScroll?.focusHistoryTriggerAfterRestore ?? true;
    const previousFirstTranscriptMessageId = messages[0]?.id ?? null;
    const visibleAnchor = firstVisibleRenderedMessage();
    const previousFirstMessageId = visibleAnchor?.messageId ?? previousFirstTranscriptMessageId;
    const previousScrollTop = viewport?.scrollTop ?? chatVirtualizer.scrollOffset;
    const previousFirstMessageElement =
      previousFirstMessageId !== null ? renderedMessageById(previousFirstMessageId) : null;
    const previousFirstMessageViewportOffset =
      visibleAnchor?.viewportOffset ??
      (previousFirstMessageElement && viewport
        ? previousFirstMessageElement.getBoundingClientRect().top -
          viewport.getBoundingClientRect().top
        : 0);
    nonVirtualRestoredHistoryPending = null;
    pendingHistoryScroll = {
      focusHistoryTriggerAfterRestore,
      requestId,
      previousFirstMessageId,
      previousFirstTranscriptMessageId,
      previousFirstMessageViewportOffset,
      previousCount: messages.length,
      previousScrollTop,
      previousScrollHeight: viewport?.scrollHeight ?? 0,
      previousTotalSize: chatVirtualizer.scrollSize,
    };
  }

  async function settlePendingHistoryScroll(pending: PendingHistoryScroll): Promise<void> {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      if (pendingHistoryScroll !== pending) return;
      if (await restorePendingHistoryScrollAfterLayout(pending)) return;
    }

    if (pendingHistoryScroll === pending) {
      pendingHistoryScroll = null;
      finishDeferredAdapterHistoryLoading();
    }
  }

  function finishDeferredAdapterHistoryLoading(): void {
    if (deferredAdapterHasMoreHistory === null) return;

    adapterHasMoreHistory = deferredAdapterHasMoreHistory;
    deferredAdapterHasMoreHistory = null;
    isLoadingHistory = false;
  }

  function historyTranscriptChanged(pending: PendingHistoryScroll): boolean {
    return (
      messages.length > pending.previousCount ||
      messages[0]?.id !== pending.previousFirstTranscriptMessageId
    );
  }

  function pendingHistoryScrollForRequest(requestId: number): PendingHistoryScroll | null {
    return pendingHistoryScroll?.requestId === requestId ? pendingHistoryScroll : null;
  }

  async function handleLoadHistory(): Promise<void> {
    if (isLoadingHistory || !showHistoryTrigger) return;

    isLoadingHistory = true;
    resetHistoryRestorationUserScrolling();
    // #1237: a guarded programmatic scroll (scrollToTop / jump-to-latest) may
    // still be animating when the user asks for older history — most commonly
    // a scroll-to-top glide, since the top is where the load-earlier trigger
    // lives. Capturing mid-animation would snapshot a moving viewport, and
    // the still-running smooth-scroll animation (absolute target, e.g. 0)
    // would then race the instant restore corrections — whichever landed last
    // won, shifting the visible transcript by the prepended height or
    // overshooting #911-style. Finish the guarded scroll instantly at its
    // destination first, so the capture below snapshots a parked viewport and
    // the restore has nothing left to race.
    //
    // A glide can also outlive its guard: under main-thread jank the guard's
    // scroll-quiet backstop can settle while the compositor-driven smooth
    // scroll is still animating, leaving no active guard for
    // finishUserScrollGuard to finish — yet the animation still races the
    // capture below exactly as an unguarded one would (#1237's nondeterministic
    // mode). Pin the current position with an instant scroll in that case:
    // issuing any programmatic scroll aborts an in-flight smooth scroll, so
    // the capture is guaranteed a parked viewport either way.
    if (!scrollState.finishUserScrollGuard() && viewport) {
      viewport.scrollTo({ top: viewport.scrollTop, behavior: 'instant' });
    }
    const requestId = ++historyLoadRequestId;
    captureHistoryScroll(requestId);
    if (pendingHistoryScroll === null) {
      isLoadingHistory = false;
      return;
    }

    if (adapter?.loadOlderMessages) {
      let nextHasMoreHistory: boolean | undefined;
      try {
        const loading = adapter.loadOlderMessages(conversationId);
        // A consumer can prepend synchronously before returning its loader
        // promise. Flush that parent update and Chat's anchor-restoration
        // effect before yielding back to the browser; otherwise Chromium can
        // present the committed prepend once before the effect compensates it
        // (#1259). Flush again after the promise settles for async consumers
        // that prepend immediately before resolving.
        flushSync();
        const result = await loading;
        flushSync();
        nextHasMoreHistory = result.hasMore;
      } catch (error) {
        flushSync();
        pendingHistoryScroll = null;
        onadaptererror?.({ command: 'loadOlderMessages', error });
        await settleHistoryLoading(requestId);
        return;
      }

      let currentPending = pendingHistoryScrollForRequest(requestId);
      const transcriptChanged = currentPending !== null && historyTranscriptChanged(currentPending);
      if (isVirtualized && !transcriptChanged) {
        deferredAdapterHasMoreHistory = nextHasMoreHistory ?? null;
        await tick();
        currentPending = pendingHistoryScrollForRequest(requestId);
        if (currentPending !== null && historyTranscriptChanged(currentPending)) {
          await settlePendingHistoryScroll(currentPending);
        } else if (currentPending !== null) {
          pendingHistoryScroll = null;
          finishDeferredAdapterHistoryLoading();
        } else {
          finishDeferredAdapterHistoryLoading();
        }
        return;
      }

      currentPending = pendingHistoryScrollForRequest(requestId);
      if (currentPending !== null && (isVirtualized || historyTranscriptChanged(currentPending))) {
        await settlePendingHistoryScroll(currentPending);
      } else if (currentPending !== null) {
        pendingHistoryScroll = null;
      }
      adapterHasMoreHistory = nextHasMoreHistory;
      // The flips here swap the trigger back to idle (or unmount it on
      // hasMore: false) — a height change the settled restore has not seen
      // (#1237). Note the restore itself usually ran from the transcript
      // effect before this resumes, so this keys on the request id, not on
      // `pendingHistoryScroll` still being set.
      await settleHistoryLoading(requestId);
      return;
    }

    try {
      const loading = onLoadHistory?.();
      flushSync();
      await loading;
      flushSync();
      const currentPending = pendingHistoryScrollForRequest(requestId);
      if (currentPending !== null) {
        await settlePendingHistoryScroll(currentPending);
      }
    } catch (error) {
      flushSync();
      pendingHistoryScroll = null;
      throw error;
    } finally {
      await settleHistoryLoading(requestId);
    }
  }

  // #897/#1235 — retries are single-flighted PER MESSAGE ID at the dispatch
  // layer (mirroring how every command funnels through dispatchCommand), so the
  // guard covers EVERY entry point — the UI Retry button and the exported
  // programmatic `retryMessage()` — not just the click handler. A second retry
  // for an id whose retry is still in flight is ignored; the flight token
  // clears when the dispatch settles (resolve, reject, or sync throw), so a
  // later retry for the same id dispatches again.
  function dispatchRetryMessage(messageId: string): void {
    if (pendingRetryMessageTokens.has(messageId)) return;
    const flightToken = Symbol(messageId);
    pendingRetryMessageTokens = new Map(pendingRetryMessageTokens).set(messageId, flightToken);
    const clearPending = (): void => {
      if (pendingRetryMessageTokens.get(messageId) !== flightToken) return;
      const next = new Map(pendingRetryMessageTokens);
      next.delete(messageId);
      pendingRetryMessageTokens = next;
    };
    try {
      // `onretry` is typed as void-returning, but an async handler is
      // assignable to that type and returns a promise at runtime.
      // dispatchCommand deliberately discards the callback's return value, so
      // capture it here — the in-flight token must hold until an async
      // handler settles, not just until it is invoked, or two rapid retries
      // for the same id would run the handler twice.
      let callbackRun: Promise<void> | undefined;
      const run = dispatchCommand(
        'retryMessage',
        // Return `undefined` ONLY when the optional method is absent; otherwise
        // wrap its result so a present-but-sync method still counts as handled.
        (resolvedAdapter) =>
          resolvedAdapter.retryMessage
            ? Promise.resolve(resolvedAdapter.retryMessage(messageId))
            : undefined,
        () => {
          const result = onretry?.(messageId) as void | Promise<void>;
          if (result !== undefined) callbackRun = Promise.resolve(result);
        },
      );
      const flight = run ?? callbackRun;
      if (flight !== undefined) void flight.finally(clearPending);
      else clearPending();
    } catch (error) {
      clearPending();
      throw error;
    }
  }

  function handleRetry(messageId: string): void {
    dispatchRetryMessage(messageId);
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

  // C5 — suggestion selection handler. Calls the consumer callback then
  // moves focus to the composer so keyboard users are not left stranded on a
  // chip button that gets removed from the DOM when the suggestion set clears.
  function handleSuggestionSelect(label: string): void {
    onSuggestionSelect?.(label);
    inputRef?.focus();
  }

  // C3 — an approve/deny affordance only resolves when SOMETHING can handle it —
  // the adapter command OR the consumer callback. `canApprove`/`canDeny` gate
  // both the button-enabled state (passed to ToolApprovalPart) and the resolve
  // guard, so a consumer that wires neither path gets disabled buttons rather
  // than a click that commits UI-only state to nowhere (matches canRetry/canEdit).
  const canApprove = $derived(onapprove !== undefined || adapter?.approveToolCall !== undefined);
  const canDeny = $derived(ondeny !== undefined || adapter?.denyToolCall !== undefined);

  // C3 — tool approval handlers. The resolution is recorded optimistically in the
  // UI-only id sets for immediate feedback, then the adapter command (if present)
  // runs and, on SUCCESS, the consumer callback fires (adapter-first-then-callback
  // contract). Guard double-resolution: if the call id is already in either set,
  // skip so a second tap/Escape cannot flip a resolved state. If the ADAPTER
  // command REJECTS (or throws), the optimistic resolution is rolled back so the
  // prompt returns to pending instead of being stuck "approved"/"denied" on a
  // transport failure — the error routes to onadaptererror and the callback does
  // NOT fire. With no adapter method, the callback fires synchronously.
  function resolveToolApproval(
    toolCallId: string,
    command: 'approveToolCall' | 'denyToolCall',
    canHandle: boolean,
    commit: (id: string) => void,
    rollback: (id: string) => void,
    runAdapter: (adapter: ChatAdapter) => Promise<void> | undefined,
    callback: (() => void) | undefined,
  ): void {
    if (!canHandle) return;
    if (approvedToolCallIds.has(toolCallId) || deniedToolCallIds.has(toolCallId)) return;
    commit(toolCallId);

    if (adapter) {
      let run: Promise<void> | undefined;
      try {
        run = runAdapter(adapter);
      } catch (error) {
        rollback(toolCallId);
        onadaptererror?.({ command, error });
        return;
      }
      if (run !== undefined) {
        void run.then(
          () => callback?.(),
          (error: unknown) => {
            rollback(toolCallId);
            onadaptererror?.({ command, error });
          },
        );
        return;
      }
    }
    callback?.();
  }

  function handleApprove(toolCallId: string): void {
    resolveToolApproval(
      toolCallId,
      'approveToolCall',
      canApprove,
      (id) => (approvedToolCallIds = new Set([...approvedToolCallIds, id])),
      (id) => (approvedToolCallIds = removeFromSet(approvedToolCallIds, id)),
      (resolvedAdapter) =>
        resolvedAdapter.approveToolCall
          ? Promise.resolve(resolvedAdapter.approveToolCall(toolCallId))
          : undefined,
      () => onapprove?.(toolCallId),
    );
  }

  function handleDeny(toolCallId: string): void {
    resolveToolApproval(
      toolCallId,
      'denyToolCall',
      canDeny,
      (id) => (deniedToolCallIds = new Set([...deniedToolCallIds, id])),
      (id) => (deniedToolCallIds = removeFromSet(deniedToolCallIds, id)),
      (resolvedAdapter) =>
        resolvedAdapter.denyToolCall
          ? Promise.resolve(resolvedAdapter.denyToolCall(toolCallId))
          : undefined,
      () => ondeny?.(toolCallId),
    );
  }

  function removeFromSet(set: Set<string>, value: string): Set<string> {
    const next = new Set(set);
    next.delete(value);
    return next;
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
    if (
      event.key === 'Home' ||
      event.key === 'End' ||
      event.key === 'PageUp' ||
      event.key === 'PageDown' ||
      event.key === 'ArrowUp' ||
      event.key === 'ArrowDown'
    ) {
      handleHistoryRestorationUserInput();
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

  function renderedMessageById(messageId: string): HTMLElement | null {
    return viewport?.querySelector<HTMLElement>(`#message-${CSS.escape(messageId)}`) ?? null;
  }

  function firstVisibleRenderedMessage(): { messageId: string; viewportOffset: number } | null {
    if (!viewport) return null;

    const viewportRect = viewport.getBoundingClientRect();
    for (const message of viewport.querySelectorAll<HTMLElement>(
      '.chat-message, .chat-tool-call-timeline',
    )) {
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
    if (!activeElement?.matches('.chat-message, .chat-tool-call-timeline')) return false;

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

    cancelNonVirtualHistoryAnchorStabilization();
    // Search navigation owns the viewport from here — a late loader
    // resolution must not re-anchor it back to the history anchor (#1237).
    // Deliberately NOT folded into cancelNonVirtualHistoryAnchorStabilization():
    // that helper also runs from the maybe-scroll input heuristic, where
    // dropping the snapshot on a single tap or zero-delta wheel would lose the
    // post-settle correction entirely.
    nonVirtualRestoredHistoryPending = null;
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
    cancelNonVirtualHistoryAnchorStabilization();
    invalidatePendingHistoryRestoration();
    // Reaching the bottom — sync both the internal helper and the bindable
    // prop synchronously (matching the submit auto-scroll path) rather than
    // waiting for the real scroll listener's rAF-deferred recompute.
    scrollState.setAtBottom(true);
    updateAtBottomBinding(true);
    if (isVirtualized) {
      // Supersede any stale guard from an earlier top-scroll — see the same
      // comment in handleJumpToLatest's virtualized branch.
      scrollState.clearUserScrollGuard();
      chatVirtualizer.scrollToOffset(chatVirtualizer.scrollSize, {
        behavior: scrollState.getScrollBehavior(),
      });
    } else {
      scrollState.scrollToBottom(viewport);
    }
  }

  export function scrollToTop(): void {
    cancelNonVirtualHistoryAnchorStabilization();
    invalidatePendingHistoryRestoration();
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

  /**
   * Programmatically retry a failed message — the same guarded dispatch as the
   * UI Retry button. A call for a message id whose retry is still in flight is
   * ignored, so the adapter's `retryMessage` command (or the `onretry`
   * callback) never double-fires for the same id regardless of entry point.
   */
  export function retryMessage(messageId: string): void {
    dispatchRetryMessage(messageId);
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
    // Start loading before the first token arrives so the first streamed
    // message can format its initial markdown instead of showing raw text.
    void preloadMarkdownPipeline();
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
        const autoScrollSuppressed = editingMessageIds.size > 0;
        // Flush: join the entire buffer once per frame
        streamingContent = tokenBuffer.join('');
        void tick().then(async () => {
          if (streamingRowElement) {
            chatVirtualizer.measureElementNode(streamingRowElement);
            if (isVirtualized) await tick();
          }
          if (autoScrollSuppressed) {
            scrollState.recomputeFromViewport(viewport);
          }
        });
        // Auto-scroll if at bottom
        if (scrollState.atBottom && viewport && !autoScrollSuppressed) {
          if (isVirtualized) {
            chatVirtualizer.scrollToOffset(chatVirtualizer.scrollSize, { behavior: 'instant' });
          } else {
            viewport.scrollTo({ top: viewport.scrollHeight, behavior: 'instant' });
          }
        }
      });
    }
  }

  function handleEditingChange(messageId: string, editing: boolean): void {
    const next = new Set(editingMessageIds);
    if (editing) next.add(messageId);
    else next.delete(messageId);
    editingMessageIds = next;
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

  function virtualizedSpacerStyle(): string {
    return `height: ${chatVirtualizer.totalSize}px; position: relative; width: 100%;`;
  }

  function virtualizedRowStyle(virtualItem: VirtualItem): string {
    return `position: absolute; inset-inline: 0; top: 0; transform: translateY(${virtualItem.start}px);`;
  }

  function virtualRowAttachment(row: ChatRenderRow): Attachment<HTMLElement> {
    return (node) => {
      const detachMeasurement = chatVirtualizer.measureElement(node);
      if (row.type === 'message' && row.message.id === streamingMessageId) {
        streamingRowElement = node;
      }

      return () => {
        detachMeasurement?.();
        if (streamingRowElement === node) {
          streamingRowElement = null;
        }
      };
    };
  }
</script>

<div
  bind:this={containerRef}
  {id}
  class={classNames('cinder-chat', 'chat-container', className)}
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

  {#snippet renderMessageRow(messageRow: ChatMessageRenderRow)}
    {@const message = messageRow.message}
    {@const pairs = message.toolCall?.id
      ? (toolCallPairsByCallId.get(message.toolCall.id) ?? [])
      : []}
    {@const toolCallPair = pairs.find((pair) => pair.call === message.toolCall) ?? pairs[0]}
    {@const pairedResultMessage = toolCallPair?.result
      ? toolResultMessagesByResult.get(toolCallPair.result)
      : undefined}
    {@const rowContext = {
      message,
      toolCallPair,
      artifact:
        resolveMessageArtifact(message) ??
        (pairedResultMessage ? resolveMessageArtifact(pairedResultMessage) : undefined),
    }}
    {@const isStreamingMessage = streamingMessageId === message.id}
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
      <ChatMessage
        {message}
        toolCallPairs={pairs}
        {messagePart}
        {markdownNode}
        onretry={allowRetry && canRetry ? handleRetry : undefined}
        onedit={allowEditing && canEdit ? handleEdit : undefined}
        oneditingchange={(editing) => handleEditingChange(message.id, editing)}
        onrollback={onrollback ? (messageId) => (rollbackMessageId = messageId) : undefined}
        rollbackDiscarded={rollbackBoundaryIndex >= 0 &&
          (messageIndexById.get(message.id) ?? -1) >= rollbackBoundaryIndex}
        showDefaultActions={allowCopy}
        {onExpandedChange}
        streaming={isStreamingMessage}
        overrideContent={isStreamingMessage ? streamingContent : undefined}
        searchMatch={isCurrentSearchMatch}
        tabindex={-1}
        approvedToolCallIds={approvedToolCallIds.size > 0 ? approvedToolCallIds : undefined}
        deniedToolCallIds={deniedToolCallIds.size > 0 ? deniedToolCallIds : undefined}
        onapprove={canApprove ? handleApprove : undefined}
        ondeny={canDeny ? handleDeny : undefined}
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
          {:else if receipt}
            <ChatReadReceipt {receipt} />
          {/if}
        {/snippet}
      </ChatMessage>
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
      <ToolCallTimeline
        messageId={renderRow.messages[0]!.id}
        pairs={renderRow.messages.flatMap((message) => {
          if (!message.toolCall?.id) return [];
          const pairs = toolCallPairsByCallId.get(message.toolCall.id) ?? [];
          const pair = pairs.find((candidate) => candidate.call === message.toolCall) ?? pairs[0];
          return pair ? [pair] : [];
        })}
      />
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
      onwheel={handleHistoryRestorationUserInput}
      ontouchstart={handleHistoryRestorationUserInput}
      onpointerdown={handleHistoryRestorationUserInput}
      onfocusin={handleTimelineFocusIn}
      onfocusout={handleTimelineFocusOut}
      {@attach scrollAttachment}
      {@attach historyAnchorScrollAttachment}
      {@attach viewportAttach}
      {@attach timelineScrollFadeAttachment}
    >
      {#if showHistoryTrigger}
        <ChatHistoryTrigger
          bind:this={historyTriggerRef}
          loading={isLoadingHistory}
          label={loadEarlierLabel}
          loadingLabel={loadingEarlierLabel}
          onLoad={() => void handleLoadHistory()}
        />
      {/if}

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
      onjumptolatest={handleJumpToLatest}
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
        {oncomposerinput}
        {oncomposerkeydown}
        {oncomposerselectionchange}
        {oncomposerblur}
        {composerRole}
        {composerAriaExpanded}
        {composerAriaControls}
        {composerAriaActiveDescendant}
        {composerAriaAutocomplete}
        {onattachmentadd}
        {onattachmentremove}
        {onattachmentfailure}
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
