/// <reference lib="dom" />
/**
 * Full server-render-and-hydrate regression coverage for the public Chat tree.
 *
 * These tests rule out the `createConversation` timestamp theory floated in
 * issue #756 (a differing `createdAt`/`updatedAt` between SSR and hydration):
 * Chat never renders conversation timestamps, so a differing clock cannot
 * produce a mismatch.
 *
 * They do NOT reproduce #756's packaged-consumer `hydration_mismatch`. One
 * earlier occurrence came from differing Lucide icon artwork and is guarded by
 * Cinder's exact `lucide-svelte` dependency. The recurring case was caused by
 * conditional export order: SvelteKit SSR selected Cinder's precompiled `node`
 * tree while the browser compiled its `svelte` source tree. Those independently
 * compiled trees emitted incompatible hydration markers at a nested Chat/Cinder
 * snippet boundary even though the visible icon markup matched.
 *
 * This harness compiles server and client from the SAME workspace source, so it
 * structurally cannot exercise either packaged-artifact divergence. The durable
 * regression is the packed-tarball, real-SvelteKit-dev-server, real-browser
 * `/chat-layout` assertion in `components/cinder/scripts/validate-consumers.ts`.
 */
import { afterAll, describe, expect, test } from 'bun:test';

import { prepareSvelteServerSource, renderThenHydrate, setupHappyDom } from '@lostgradient/testing';
import { createConversation } from './builders.ts';
import type { ConversationHistory } from './conversation-model.ts';

setupHappyDom();

class TestResizeObserver {
  constructor(callback: ResizeObserverCallback) {
    void callback;
  }

  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

class TestIntersectionObserver {
  readonly root: Element | null = null;
  readonly rootMargin = '';
  readonly scrollMargin = '';
  readonly thresholds: readonly number[] = [];

  constructor(callback: IntersectionObserverCallback, options?: IntersectionObserverInit) {
    void callback;
    void options;
  }

  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
  takeRecords(): IntersectionObserverEntry[] {
    return [];
  }
}

const originalResizeObserver = globalThis.ResizeObserver;
const originalIntersectionObserver = globalThis.IntersectionObserver;
globalThis.ResizeObserver = TestResizeObserver;
globalThis.IntersectionObserver = TestIntersectionObserver;

afterAll(() => {
  globalThis.ResizeObserver = originalResizeObserver;
  globalThis.IntersectionObserver = originalIntersectionObserver;
});

const { default: Chat } = await import('./chat.svelte');
const sourcePath = new URL('./chat.svelte', import.meta.url).pathname;

// Compile the server graph before the timed hydration assertions. The root
// Conversationalist package intentionally exposes the complete library API,
// so this first compilation can be slower than an individual Bun test timeout
// when the whole Chat suite is running. The hydration assertions should measure
// render and hydrate behavior, not one-time compiler work.
await prepareSvelteServerSource(sourcePath);

const emptyConversation: ConversationHistory = {
  schemaVersion: 4,
  id: 'empty-hydration-conversation',
  status: 'active',
  metadata: {},
  ids: [],
  messages: {},
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

describe('Chat hydration', () => {
  // Uses the DEFAULT `now` environment hook rather than an injected clock, so
  // the shape issue #756 described (`createConversation({ id })` with nothing
  // else) is at least represented here.
  //
  // Neither test reproduces the reporter's actual divergence, and it is worth
  // being explicit about why: `renderThenHydrate` hands the SAME props object
  // to both the server render and the hydrate, so `createConversation` runs
  // once. The reporter's app runs it twice — once server-side, once during
  // client component init — and only two separate calls can disagree.
  //
  // What this test does hold is the property that makes that divergence
  // harmless: no conversation timestamp reaches the markup, so SSR output
  // cannot vary with the clock. That is asserted rather than assumed, because
  // anything that started rendering one would make the reporter's theory
  // correct. (The packaged-consumer causes turned out to be elsewhere.)
  test('hydrates a default-environment createConversation without a mismatch warning', async () => {
    const conversation = createConversation({ id: 'real-clock-conversation' });
    const result = await renderThenHydrate(Chat, sourcePath, {
      id: 'real-clock-chat',
      conversation,
    });

    try {
      expect(
        result.warnings.filter((warning) => warning.toLowerCase().includes('hydration')),
      ).toEqual([]);
      // The load-bearing assertions: SSR output cannot vary with the clock.
      // Both directions are kept deliberately — the exact-value checks say
      // THIS conversation's timestamps stay out of the markup, and the pattern
      // check catches any other ISO-8601 timestamp a future change might start
      // rendering, which is the case that would actually reintroduce the bug.
      expect(result.ssrHtml).not.toContain(conversation.createdAt);
      expect(result.ssrHtml).not.toContain(conversation.updatedAt);
      expect(result.ssrHtml).not.toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    } finally {
      await result.cleanup();
    }
  });

  test('hydrates a fixed-clock createConversation snapshot without a mismatch warning', async () => {
    const conversation = createConversation(
      {
        id: 'default-environment-conversation',
      },
      {
        now: () => '2026-01-01T00:00:00.000Z',
      },
    );
    const result = await renderThenHydrate(Chat, sourcePath, {
      id: 'default-environment-chat',
      conversation,
    });

    try {
      expect(
        result.warnings.filter((warning) => warning.toLowerCase().includes('hydration')),
      ).toEqual([]);
      expect(result.container.querySelector('.chat-empty')?.textContent).toContain(
        'No messages yet',
      );
    } finally {
      await result.cleanup();
    }
  });

  test('hydrates an empty conversation without changing the server-rendered surface', async () => {
    const result = await renderThenHydrate(Chat, sourcePath, {
      id: 'stable-empty-chat',
      conversation: emptyConversation,
      virtualized: true,
    });

    try {
      const hydrationWarnings = result.warnings.filter((warning) =>
        warning.toLowerCase().includes('hydration'),
      );
      expect(hydrationWarnings).toEqual([]);

      expect(result.ssrHtml).toContain('No messages yet');
      expect(result.container.querySelector('.chat-empty')?.textContent).toContain(
        'No messages yet',
      );
      expect(result.container.querySelector('#stable-empty-chat-input-editor')).not.toBeNull();
      expect(result.container.querySelector('#stable-empty-chat-status')?.textContent).toContain(
        '0 messages in conversation',
      );

      const timeline = result.container.querySelector('#stable-empty-chat-timeline');
      expect(timeline?.getAttribute('data-cinder-virtualized')).toBeNull();
      expect(result.container.querySelector('[aria-live="assertive"]')).not.toBeNull();
      expect(result.container.querySelectorAll('[aria-live="polite"]').length).toBeGreaterThan(0);
    } finally {
      await result.cleanup();
    }
  });
});
