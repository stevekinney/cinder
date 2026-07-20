<script lang="ts" module>
  import type { Attachment } from 'svelte/attachments';
  import type { ChatAdapter, ChatCommand, ChatPushHandlers } from '../adapter/chat-adapter.ts';
  import type { Message, MessageInput } from '../conversation-model.ts';
  import type { ChatAttachment } from '../input/chat-attachment.ts';

  // `ChatProps` is owned by `../chat.types.ts` (the analyzer + schema generator
  // read that symbol). The implementation imports it from there rather than
  // redeclaring it, so the public type and the `$props()` shape can never drift.
  import type { ChatAnnounceLevel, ChatProps } from '../chat.types.ts';

  export type { ChatAnnounceLevel, ChatProps };
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
  import {
    getMessages,
    pairToolCallsWithResults,
    resolveMessageReasoning,
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

  const noopAttachment: Attachment<HTMLElement> = () => {};
  const CONSUMER_ANNOUNCEMENT_CLEAR_DELAY_MS = 1000;
  type ChatMessageRenderRow = Extract<ChatRenderRow, { type: 'message' }>;
  type PendingHistoryScroll = {
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
    class: className,
    surfaceMode = 'default',
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
    onsuggestionselect,
    onloadhistory,
    onstopgenerating,
    onjumptolatest,
    onscrollstatechange,
    onunreadindicatorchange,
    onexpandedchange,
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
        getValue: () => string;
        getEditorElement: () => HTMLTextAreaElement | null;
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

  // Reset UI-only approval/disclosure/typing/receipt state on conversation change
  // so stale approved/denied sets, expanded reasoning/tool-call disclosures,
  // adapter-derived typing state, and accumulated read receipts from the previous conversation
  // are cleared (their message ids can collide). The void reference to
  // `conversationId` at the start of the effect body is the Svelte 5 pattern for
  // declaring a reactive dependency on a derived without reading its value.
  $effect(() => {
    conversationId;
    approvedToolCallIds = new Set();
    deniedToolCallIds = new Set();
    reasoningState.reset();
    toolCallState.reset();
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
  let deferredAdapterHasMoreHistory: boolean | null = null;
  let historyAnchorMessageId = $state<string | null>(null);
  let historyAnchorViewportOffset = $state<number | null>(null);
  let historyAnchorRestoredScrollTop: number | null = null;
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
      atBottom = true;
      if (unreadState.unreadCount > 0 || unreadState.newMessageIndicatorVisible) {
        unreadState.markAllAsRead();
      }
    },
  });

  const unreadState = useChatUnreadState({
    onUnreadIndicatorChange: (event) => {
      // Update the bindable props at the mutation site rather than via a $effect.
      unreadCount = event.unreadCount;
      newMessageIndicatorVisible = event.newMessageIndicatorVisible;
      onunreadindicatorchange?.(event);
    },
  });

  const keyboardNav = useChatKeyboardNav({
    onJumpToLatest: handleJumpToLatest,
    onJumpToStart: () => {
      if (isVirtualized) {
        scrollState.withUserScrollGuard(() => {
          chatVirtualizer.scrollToOffset(0, { behavior: scrollState.getScrollBehavior() });
        });
      }
    },
    getScrollBehavior: scrollState.getScrollBehavior,
    getHistoryTrigger: () => (showHistoryTrigger ? historyTriggerRef : null),
    onVirtualMessageNavigation: (direction) => navigateVirtualMessage(direction),
  });

  const messages = $derived(getMessages(conversation));
  // C5 — suggested replies are a per-TURN affordance shown only beneath the last
  // message, not on every historical message that still carries the metadata.
  const lastMessageId = $derived(messages.at(-1)?.id);
  let previousAutoScrollMessageCount = $state(untrack(() => messages.length));

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
  const renderRows = $derived.by(() => {
    const pairedToolResultIds = findPairedToolResultIds(messages);
    const messagesWithDates = buildMessagesWithDateSeparators(messages, pairedToolResultIds);
    return buildChatRenderRows(messagesWithDates, {
      firstUnreadId: unreadState.firstUnreadId,
      showTypingIndicator,
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
    onloadhistory !== undefined || adapter?.loadOlderMessages !== undefined,
  );
  const showHistoryTrigger = $derived(hasHistoryLoader && effectiveHasMoreHistory);

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
      adapterHasMoreHistory = undefined;
      pendingHistoryScroll = null;
      deferredAdapterHasMoreHistory = null;
      clearHistoryAnchor();
    }
    previousHistoryConversationId = currentConversationId;
    previousHistoryAdapter = currentAdapter;
  });

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
    const isTranscriptAppend = currentCount > previousAutoScrollMessageCount;
    previousAutoScrollMessageCount = currentCount;
    // Keep the scroll extent as a dependency so virtual row measurement can
    // trigger one final bottom correction after the appended row is measured.
    const currentScrollExtent = isVirtualized ? chatVirtualizer.scrollSize : viewport.scrollHeight;
    void currentScrollExtent;

    // Read atBottom without making it a dependency (prevents loops)
    const atBottom = untrack(() => scrollState.atBottom);

    // Skip if user initiated a smooth scroll (e.g., via jump button)
    if (scrollState.isUserScrolling) return undefined;

    // Explicit history anchoring owns scroll restoration while a prepend is pending
    // and until the user scrolls away from the restored anchor.
    const hasActiveHistoryAnchor = untrack(
      () => pendingHistoryScroll !== null || historyAnchorMessageId !== null,
    );
    if (hasActiveHistoryAnchor) return undefined;

    if (atBottom && currentCount > 0) {
      let cancelled = false;
      const waitForBottomTarget = isTranscriptAppend ? waitForLayoutFrame() : tick();
      void waitForBottomTarget.then(() => {
        if (cancelled || !viewport || pendingHistoryScroll || historyAnchorMessageId !== null) {
          return;
        }
        if (isVirtualized) {
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

  $effect.pre(() => {
    if (!viewport || !pendingHistoryScroll) return;

    const pending = pendingHistoryScroll;
    messages.length;
    messages[0]?.id;
    void restorePendingHistoryScrollAfterLayout(pending);
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
    return restoreHistoryScroll(pending);
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
      const newTotalSize = viewport.scrollHeight;
      const delta = newTotalSize - pending.previousScrollHeight;
      viewport.scrollTo({
        top: pending.previousScrollTop + delta,
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
    void tick().then(() => {
      focusAfterHistoryRestore(pending);
    });
    return true;
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

    // Update the bindable prop at the mutation site rather than via a $effect.
    atBottom = event.atBottom;

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

  function focusAfterHistoryRestore(pending: PendingHistoryScroll): void {
    if (!viewport) return;

    if (showHistoryTrigger && historyTriggerRef) {
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
    const handlers: ChatPushHandlers = {
      onMessage: (message) => untrack(() => onpushmessage)?.(message),
      onTypingChange: (isTyping) => {
        // Drive the C6 per-participant typing indicator via the adapter path.
        typingIndicatorState.handleAdapterTypingChange(isTyping);
        untrack(() => ontypingchange)?.(isTyping);
      },
      onReadReceipt: (event) => {
        // Accumulate the receipt into C6 read receipt state.
        readReceiptsState.handleAdapterReadReceipt(event);
        untrack(() => onreadreceipt)?.(event);
      },
      onStreamBegin: (messageId) => beginStreaming(messageId),
      onTokenPush: (token) => pushToken(token),
      onStreamEnd: () => endStreaming(),
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
  const historyAnchorScrollAttachment = $derived<Attachment<HTMLElement>>(
    historyAnchorMessageId === null || historyAnchorRestoredScrollTop === null
      ? noopAttachment
      : (node) => {
          const handleScroll = () => clearHistoryAnchorAfterScroll(node.scrollTop);
          node.addEventListener('scroll', handleScroll, { passive: true });

          return () => node.removeEventListener('scroll', handleScroll);
        },
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
    if (isVirtualized) {
      chatVirtualizer.scrollToIndex(Math.max(0, renderRows.length - 1), {
        align: 'end',
        behavior: scrollState.getScrollBehavior(),
      });
      unreadState.markAllAsRead();
      onjumptolatest?.();
      tick().then(() => {
        const lastMessage = viewport?.querySelector<HTMLElement>(
          `.chat-message-wrapper:last-of-type .chat-message`,
        );
        lastMessage?.focus();
      });
      return;
    }

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

    // Auto-scroll after sending.
    // Also update the bindable prop so the parent binding reflects the new
    // atBottom=true state immediately — scrollState.setAtBottom() only
    // updates the internal helper state; the bindable must be written explicitly
    // (matching the pattern in handleScrollStateChange and onReachBottom).
    scrollState.setAtBottom(true);
    atBottom = true;
    tick().then(() => {
      if (isVirtualized) {
        chatVirtualizer.scrollToOffset(chatVirtualizer.scrollSize, { behavior: 'instant' });
      } else {
        viewport?.scrollTo({ top: viewport.scrollHeight, behavior: 'instant' });
      }
    });
  }

  function captureHistoryScroll(): void {
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
    pendingHistoryScroll = {
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

  async function handleLoadHistory(): Promise<void> {
    if (isLoadingHistory || !showHistoryTrigger) return;

    isLoadingHistory = true;
    captureHistoryScroll();
    const pending = pendingHistoryScroll;
    if (pending === null) {
      isLoadingHistory = false;
      return;
    }

    if (adapter?.loadOlderMessages) {
      let nextHasMoreHistory: boolean | undefined;
      try {
        const result = await adapter.loadOlderMessages(conversationId);
        nextHasMoreHistory = result.hasMore;
      } catch (error) {
        pendingHistoryScroll = null;
        isLoadingHistory = false;
        onadaptererror?.({ command: 'loadOlderMessages', error });
        return;
      }

      const transcriptChanged = historyTranscriptChanged(pending);
      if (isVirtualized && !transcriptChanged) {
        deferredAdapterHasMoreHistory = nextHasMoreHistory ?? null;
        await tick();
        if (historyTranscriptChanged(pending)) {
          await settlePendingHistoryScroll(pending);
        } else if (pendingHistoryScroll === pending) {
          pendingHistoryScroll = null;
          finishDeferredAdapterHistoryLoading();
        } else {
          finishDeferredAdapterHistoryLoading();
        }
        return;
      }

      if (isVirtualized || transcriptChanged) {
        await settlePendingHistoryScroll(pending);
      } else {
        pendingHistoryScroll = null;
      }
      adapterHasMoreHistory = nextHasMoreHistory;
      isLoadingHistory = false;
      return;
    }

    try {
      await onloadhistory?.();
      await settlePendingHistoryScroll(pending);
    } catch (error) {
      pendingHistoryScroll = null;
      throw error;
    } finally {
      isLoadingHistory = false;
    }
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

  // C5 — suggestion selection handler. Calls the consumer callback then
  // moves focus to the composer so keyboard users are not left stranded on a
  // chip button that gets removed from the DOM when the suggestion set clears.
  function handleSuggestionSelect(label: string): void {
    onsuggestionselect?.(label);
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
    for (const message of viewport.querySelectorAll<HTMLElement>('.chat-message')) {
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
    if (!activeElement?.classList.contains('chat-message')) return false;

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
      if (targetRow?.type !== 'message') continue;

      void focusVirtualMessage(targetRow.message.id);
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
    if (isVirtualized) {
      chatVirtualizer.scrollToOffset(chatVirtualizer.scrollSize, {
        behavior: scrollState.getScrollBehavior(),
      });
    } else {
      scrollState.scrollToBottom(viewport);
    }
  }

  export function scrollToTop(): void {
    if (isVirtualized) {
      // Guard against the auto-stick-to-bottom $effect.pre (Scroll Anchoring
      // section, above) fighting this animation: it re-fires on every
      // virtualizer remeasurement, and without this guard it would keep
      // snapping the viewport back toward the bottom mid-scroll since
      // `isUserScrolling` was never set for this branch.
      scrollState.withUserScrollGuard(() => {
        chatVirtualizer.scrollToOffset(0, { behavior: scrollState.getScrollBehavior() });
      });
    } else {
      scrollState.scrollToTop(viewport);
    }
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
        if (streamingRowElement) {
          tick().then(() => {
            if (streamingRowElement) {
              chatVirtualizer.measureElementNode(streamingRowElement);
            }
          });
        }
        // Auto-scroll if at bottom
        if (scrollState.atBottom && viewport) {
          if (isVirtualized) {
            chatVirtualizer.scrollToOffset(chatVirtualizer.scrollSize, { behavior: 'instant' });
          } else {
            viewport.scrollTo({ top: viewport.scrollHeight, behavior: 'instant' });
          }
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
        onretry={allowRetry && canRetry ? handleRetry : undefined}
        onedit={allowEditing && canEdit ? handleEdit : undefined}
        showDefaultActions={allowCopy}
        {onexpandedchange}
        streaming={isStreamingMessage}
        overrideContent={isStreamingMessage ? streamingContent : undefined}
        searchMatch={isCurrentSearchMatch}
        tabindex={-1}
        approvedToolCallIds={approvedToolCallIds.size > 0 ? approvedToolCallIds : undefined}
        deniedToolCallIds={deniedToolCallIds.size > 0 ? deniedToolCallIds : undefined}
        onapprove={canApprove ? handleApprove : undefined}
        ondeny={canDeny ? handleDeny : undefined}
        reasoning={derivedReasoning}
        steps={derivedSteps}
        suggestions={derivedSuggestions}
        reasoningExpanded={reasoningState.isExpanded(message.id)}
        onreasoning={() => reasoningState.toggle(message.id)}
        toolCallExpanded={toolCallState.isExpanded(message.id)}
        ontoolcalltoggle={() => toolCallState.toggle(message.id)}
        onsuggestionselect={handleSuggestionSelect}
      >
        {#snippet actions()}
          {#if messageActions}
            {@render messageActions(message)}
          {/if}
        {/snippet}
        {#snippet status()}
          {#if messageStatus}
            {@render messageStatus(message)}
          {:else if receipt}
            <ChatReadReceipt {receipt} />
          {/if}
        {/snippet}
      </ChatMessage>
    {/snippet}

    {#if row}
      {@render row(message, renderDefaultRow)}
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
    {:else}
      {@render renderMessageRow(renderRow)}
    {/if}
  {/snippet}

  {#key timelineResetIdentity}
    <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
    <div
      bind:this={viewport}
      id={timelineId}
      class="chat-timeline"
      role="log"
      aria-label="Messages"
      aria-describedby={statusId}
      aria-live={isVirtualized ? 'off' : 'polite'}
      aria-relevant={isVirtualized ? undefined : 'additions'}
      data-cinder-virtualized={isVirtualized ? '' : undefined}
      tabindex="0"
      {@attach scrollAttachment}
      {@attach historyAnchorScrollAttachment}
      {@attach viewportAttach}
    >
      {#if showHistoryTrigger}
        <ChatHistoryTrigger
          bind:this={historyTriggerRef}
          loading={isLoadingHistory}
          label={loadEarlierLabel}
          loadingLabel={loadingEarlierLabel}
          onload={() => void handleLoadHistory()}
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
    padding: var(--cinder-chat-timeline-padding);
    display: flex;
    flex-direction: column;
    gap: var(--cinder-chat-message-gap);
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
   * for --cinder-text. The `:global()` reach is required because bubble CSS
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
