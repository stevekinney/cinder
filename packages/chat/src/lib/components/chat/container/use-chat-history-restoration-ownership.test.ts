import { describe, expect, test } from 'bun:test';
import type { Message } from '../conversation-model.ts';
import type { PendingHistoryScroll } from './use-chat-history-lifecycle.svelte.ts';
import { useChatHistoryRestoration } from './use-chat-history-restoration.svelte.ts';

// COR-196 — "late restoration not moving scrollTop/focus/live-region": this
// module (`restorePendingHistoryScroll`) is the one place that actually
// mutates scroll position, the live-region announcement, and focus once a
// history load resolves. Neither the lifecycle-owner tests nor the input-
// ownership tests exercise `restorePendingHistoryScroll` itself — they stub
// it out entirely — so this file exists to prove that when a request's
// ownership has moved on (a new conversation/adapter took over) by the time
// the deferred layout-frame wait resolves, restoration observes that and
// does not touch any of the three surfaces, rather than trusting the
// scheduling alone.

function message(id: string, position: number): Message {
  return {
    id,
    role: 'user',
    content: id,
    position,
    createdAt: '2026-06-01T12:00:00.000Z',
    metadata: {},
    hidden: false,
  };
}

function pending(overrides: Partial<PendingHistoryScroll> = {}): PendingHistoryScroll {
  return {
    focusHistoryTriggerAfterRestore: true,
    requestId: 1,
    previousFirstMessageId: 'current',
    previousFirstTranscriptMessageId: 'current',
    previousFirstMessageViewportOffset: 0,
    previousCount: 1,
    previousScrollTop: 100,
    previousScrollHeight: 400,
    previousTotalSize: 400,
    ...overrides,
  };
}

function createFixture(options: {
  snapshot: PendingHistoryScroll;
  messages?: Message[];
  isRequestActiveDuringWait: () => boolean;
}) {
  const viewport = document.createElement('div');
  Object.defineProperty(viewport, 'scrollHeight', { configurable: true, value: 400 });
  Object.defineProperty(viewport, 'scrollTop', { configurable: true, writable: true, value: 100 });
  let scrollToCalls = 0;
  viewport.scrollTo = () => {
    scrollToCalls += 1;
  };

  let scrollToOffsetCalls = 0;
  let announcementCalls = 0;
  const trigger = { focus: () => {} };
  let triggerFocusCalls = 0;
  trigger.focus = () => {
    triggerFocusCalls += 1;
  };

  const state = { pending: options.snapshot as PendingHistoryScroll | null, announcement: '' };
  const lifecycle = {
    get pending() {
      return state.pending;
    },
    get announcement() {
      return state.announcement;
    },
    // The gate under test: ownership has moved on by the time the deferred
    // wait resolves, exactly like a conversation/adapter switch racing a
    // still-in-flight restoration.
    isRequestActive: () => options.isRequestActiveDuringWait(),
    setPending: (value: PendingHistoryScroll | null) => {
      state.pending = value;
    },
    setAnnouncement: (value: string) => {
      announcementCalls += 1;
      state.announcement = value;
    },
    finishDeferredAdapterHistoryLoading: () => {},
    captureHistoryScroll: () => {},
    historyTranscriptChanged: () => true,
  };

  const restoration = useChatHistoryRestoration({
    getConversationId: () => 'conversation',
    getMessages: () => options.messages ?? [message('older', 0), message('current', 1)],
    getIsVirtualized: () => false,
    getViewport: () => viewport,
    getVirtualizer: () => ({
      scrollOffset: 100,
      scrollPaddingStart: 0,
      scrollSize: 400,
      scrollToOffset: () => {
        scrollToOffsetCalls += 1;
      },
    }),
    getLifecycle: () => lifecycle,
    getRenderedMessage: () => null,
    getHistoryTrigger: () => trigger,
    getShowHistoryTrigger: () => true,
    canRestoreTriggerFocus: () => true,
    tick: async () => {},
  });

  return {
    restoration,
    viewport,
    get scrollToCalls() {
      return scrollToCalls;
    },
    get scrollToOffsetCalls() {
      return scrollToOffsetCalls;
    },
    get announcementCalls() {
      return announcementCalls;
    },
    get triggerFocusCalls() {
      return triggerFocusCalls;
    },
    get announcement() {
      return state.announcement;
    },
  };
}

describe('chat history restoration — late-arriving restoration ownership (COR-196)', () => {
  test('does not move scrollTop, announce, or focus once ownership has moved on', async () => {
    const snapshot = pending();
    const fixture = createFixture({ snapshot, isRequestActiveDuringWait: () => false });

    const restored = await fixture.restoration.restorePendingHistoryScroll(snapshot);

    expect(restored).toBe(false);
    expect(fixture.scrollToCalls).toBe(0);
    expect(fixture.scrollToOffsetCalls).toBe(0);
    expect(fixture.announcementCalls).toBe(0);
    expect(fixture.announcement).toBe('');
    expect(fixture.triggerFocusCalls).toBe(0);
    expect(fixture.viewport.scrollTop).toBe(100);
  });

  test('control: the same restoration actually moves scrollTop and announces when still the active request', async () => {
    const snapshot = pending();
    const fixture = createFixture({ snapshot, isRequestActiveDuringWait: () => true });

    const restored = await fixture.restoration.restorePendingHistoryScroll(snapshot);

    expect(restored).toBe(true);
    expect(fixture.scrollToCalls).toBeGreaterThan(0);
    expect(fixture.announcementCalls).toBeGreaterThan(0);
    expect(fixture.announcement).not.toBe('');
  });
});
