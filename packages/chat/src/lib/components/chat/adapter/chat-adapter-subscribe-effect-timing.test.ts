/**
 * Regression coverage for issue #775: `ChatAdapter.subscribe` runs inside
 * Chat's own mount `$effect`, so a SYNCHRONOUS `$state` write inside
 * `subscribe` can re-enter Svelte's effect flush and throw
 * `effect_update_depth_exceeded` once another reactive update (e.g. composer
 * input) is in flight alongside the mount-time call. Reproduced manually
 * against this exact fixture as part of triaging the issue (mount alone does
 * NOT throw; typing into the composer afterward does) — that crash isn't
 * something a test can safely trigger here, since it's thrown from deep
 * inside Svelte's own effect flush rather than from a call site a test can
 * wrap in try/catch, and letting it propagate uncaught would take down the
 * whole test process.
 *
 * This is now documented on `ChatAdapter.subscribe`'s JSDoc, along with the
 * recommended workaround: defer the write with `queueMicrotask`/`tick()`.
 * This test pins that the documented workaround actually avoids the throw
 * under the same conditions (mount, then composer input), so the docs can't
 * silently drift from reality.
 */

/// <reference lib="dom" />
import { afterEach, expect, test } from 'bun:test';
import { flushSync, mount } from 'svelte';

import { setupHappyDom } from '../../../test/happy-dom.ts';
import type { ConversationHistory } from '../conversation-model.ts';

setupHappyDom();

class TestResizeObserver {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}
globalThis.ResizeObserver = TestResizeObserver as unknown as typeof ResizeObserver;
class TestIntersectionObserver {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
  takeRecords(): IntersectionObserverEntry[] {
    return [];
  }
}
globalThis.IntersectionObserver =
  TestIntersectionObserver as unknown as typeof IntersectionObserver;

const { default: SyncWriteFixture } = await import('./chat-adapter-sync-write-fixture.svelte');

afterEach(() => {
  document.body.replaceChildren();
});

function conversation(id: string): ConversationHistory {
  const now = '2026-06-02T00:00:00.000Z';
  return {
    schemaVersion: 4,
    id,
    status: 'active',
    metadata: {},
    ids: [],
    messages: {},
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Types into Chat's composer, matching the reporter's repro: the throw only
 * fires once another reactive update is in flight alongside the mount-time
 * `subscribe` call.
 */
function typeIntoComposer(container: HTMLElement): void {
  const textarea = container.querySelector<HTMLTextAreaElement>('.chat-input-editor');
  if (!textarea) throw new Error('composer textarea not found');
  textarea.value = 'hello';
  textarea.dispatchEvent(new Event('input', { bubbles: true }));
}

test('deferring the subscribe write with queueMicrotask (the documented workaround) does not throw', async () => {
  const container = document.createElement('div');
  document.body.append(container);
  const instance = mount(SyncWriteFixture, {
    target: container,
    props: { conversation: conversation('deferred-conv'), deferWrite: true } as never,
  }) as unknown as { getEventLog: () => string[] };
  flushSync();

  typeIntoComposer(container);
  flushSync();

  // Flush the queued microtask so the deferred write lands.
  await Promise.resolve();
  flushSync();

  expect(instance.getEventLog()).toEqual(['subscribed to "deferred-conv"']);
});
