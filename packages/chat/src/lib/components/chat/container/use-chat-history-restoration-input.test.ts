import { describe, expect, test } from 'bun:test';
import type { Message } from '../conversation-model.ts';
import type { PendingHistoryScroll } from './use-chat-history-lifecycle.svelte.ts';
import { useChatHistoryRestoration } from './use-chat-history-restoration.svelte.ts';

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
  lifecyclePending?: PendingHistoryScroll | null;
  requestActive?: boolean;
  messages?: Message[];
  tick?: () => Promise<void>;
}) {
  const viewport = document.createElement('div');
  Object.defineProperty(viewport, 'scrollHeight', { configurable: true, value: 400 });
  Object.defineProperty(viewport, 'scrollTop', { configurable: true, writable: true, value: 100 });
  const state = {
    pending: options.lifecyclePending ?? null,
    announcement: '',
  };
  const lifecycle = {
    get pending() {
      return state.pending;
    },
    get announcement() {
      return state.announcement;
    },
    isRequestActive: () => options.requestActive ?? true,
    setPending: (value: PendingHistoryScroll | null) => {
      state.pending = value;
    },
    setAnnouncement: (value: string) => {
      state.announcement = value;
    },
    finishDeferredAdapterHistoryLoading: () => {},
    captureHistoryScroll: () => {},
    historyTranscriptChanged: () => false,
  };
  const restoration = useChatHistoryRestoration({
    getConversationId: () => 'conversation',
    getMessages: () => options.messages ?? [message('current', 0)],
    getIsVirtualized: () => false,
    getViewport: () => viewport,
    getVirtualizer: () => ({
      scrollOffset: 100,
      scrollPaddingStart: 0,
      scrollSize: 400,
      scrollToOffset: () => {},
    }),
    getLifecycle: () => lifecycle,
    getRenderedMessage: () => null,
    getHistoryTrigger: () => null,
    getShowHistoryTrigger: () => false,
    canRestoreTriggerFocus: () => false,
    tick: options.tick ?? (async () => {}),
  });
  return { restoration, lifecycle, state };
}

describe('chat history restoration input ownership', () => {
  test('user input cancels active stabilization after pending clears', async () => {
    const tick = Promise.withResolvers<void>();
    const fixture = createFixture({ tick: () => tick.promise });
    const snapshot = pending();
    const stabilization = fixture.restoration.stabilize(snapshot);
    try {
      fixture.lifecycle.setPending(null);
      fixture.restoration.handleUserInput();

      expect(fixture.restoration.isRestoringNonVirtualHistory).toBe(false);
      tick.resolve();
      await stabilization;
    } finally {
      fixture.restoration.dispose();
    }
  });

  test('user input cancels deferred trigger focus after restoration', () => {
    const snapshot = pending({ previousFirstMessageId: 'current' });
    const fixture = createFixture({
      lifecyclePending: snapshot,
      messages: [message('older', 0), message('current', 1)],
    });
    try {
      expect(fixture.restoration.restoreHistoryScroll(snapshot)).toBe(true);
      expect(fixture.restoration.deferredTriggerFocus).toBeDefined();

      fixture.restoration.handleUserInput();

      expect(fixture.restoration.deferredTriggerFocus).toBeUndefined();
    } finally {
      fixture.restoration.dispose();
    }
  });

  test('stale pending requests do not lose trigger focus on user input', () => {
    const snapshot = pending();
    const fixture = createFixture({ lifecyclePending: snapshot, requestActive: false });
    try {
      fixture.restoration.handleUserInput();

      expect(snapshot.focusHistoryTriggerAfterRestore).toBe(true);
    } finally {
      fixture.restoration.dispose();
    }
  });
});
