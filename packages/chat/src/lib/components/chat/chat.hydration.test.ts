/// <reference lib="dom" />
/**
 * Full server-render-and-hydrate regression coverage for the public Chat tree.
 *
 * These tests rule out the `createConversation` timestamp theory floated in
 * issue #756 (a differing `createdAt`/`updatedAt` between SSR and hydration):
 * Chat never renders conversation timestamps, so a differing clock cannot
 * produce a mismatch.
 *
 * They do NOT reproduce #756's actual `hydration_mismatch`. The real cause is
 * a `@lostgradient/cinder` build/packaging bug: `lucide-svelte` was a loosely
 * ranged peer dependency, so Cinder's prebuilt SSR bundle (built once, at
 * Cinder's own `lucide-svelte` version) could render different icon SVG
 * markup than a consuming app's client bundle (compiled fresh, at whatever
 * `lucide-svelte` version that app's package manager resolved) whenever
 * Lucide's icon artwork changed between those two versions. This harness
 * compiles both the server and client side from the SAME workspace source
 * against the SAME single `lucide-svelte` install, so it structurally cannot
 * exercise a cross-version divergence — see the packed-tarball,
 * real-SvelteKit-dev-server, real-browser regression in
 * `packages/components/scripts/validate-consumers.ts`
 * (`sveltekit-consumer`'s `/chat-layout` route, which now pins a
 * `lucide-svelte` version in that fixture deliberately newer than Cinder's
 * own, to keep exercising the skew) and the fix itself in
 * `packages/components/package.json` (`lucide-svelte` moved from
 * `peerDependencies` to a pinned, exact-version `dependencies` entry).
 */
import { afterAll, describe, expect, test } from 'bun:test';

import { setupHappyDom } from '../../test/happy-dom.ts';
import { renderThenHydrate } from '../../test/hydrate.ts';
import { createConversation } from './builders.ts';
import type { ConversationHistory } from './conversation-model.ts';

setupHappyDom();

class TestResizeObserver {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

class TestIntersectionObserver {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
  takeRecords(): IntersectionObserverEntry[] {
    return [];
  }
}

const originalResizeObserver = globalThis.ResizeObserver;
const originalIntersectionObserver = globalThis.IntersectionObserver;
globalThis.ResizeObserver = TestResizeObserver as unknown as typeof ResizeObserver;
globalThis.IntersectionObserver =
  TestIntersectionObserver as unknown as typeof IntersectionObserver;

afterAll(() => {
  globalThis.ResizeObserver = originalResizeObserver;
  globalThis.IntersectionObserver = originalIntersectionObserver;
});

const { default: Chat } = await import('./chat.svelte');
const sourcePath = new URL('./chat.svelte', import.meta.url).pathname;

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
  // Uses the DEFAULT `now` environment hook — no injected clock. The sibling
  // test below pins `now`, which quietly sidesteps the scenario issue #756
  // reported (`createConversation({ id })` with nothing else). Chat's
  // conversation timestamps are never rendered, so a differing `createdAt`
  // cannot produce a mismatch — but that is a property worth holding, not
  // assuming, since anything that started rendering them would regress SSR.
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
      result.cleanup();
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
      result.cleanup();
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
      result.cleanup();
    }
  });
});
