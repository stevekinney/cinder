/// <reference lib="dom" />
/**
 * Tests for the `createEventSource` attachment factory.
 *
 * Setup mirrors `packages/components/src/components/tabs/tabs.test.ts`:
 * happy-dom is installed onto `globalThis` before `@testing-library/svelte`
 * loads, so component mount has a working DOM.
 *
 * A fake `EventSource` class on `globalThis` records open/close counts and
 * the most recent URL, letting us assert the factory's open/close lifecycle
 * across URL changes and component teardown.
 */
import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { Window } from 'happy-dom';

type Global = typeof globalThis & Record<string, unknown>;

// Install happy-dom globals BEFORE dynamic-importing @testing-library/svelte.
// testing-library reads `globalThis.document` at module init.
const happyWindow = new Window();
const target = globalThis as Global;
for (const key of Object.getOwnPropertyNames(happyWindow)) {
  if (key in target) continue;
  const descriptor = Object.getOwnPropertyDescriptor(happyWindow, key);
  if (!descriptor) continue;
  Object.defineProperty(target, key, descriptor);
}
Object.defineProperty(target, 'window', { value: happyWindow, configurable: true });

// Track all open fake event sources so we can assert "exactly one live" in
// the reactivity test.
const liveSources = new Set<FakeEventSource>();

class FakeEventSource {
  static openCount = 0;
  static closeCount = 0;
  static lastUrl: string | null = null;

  static reset(): void {
    FakeEventSource.openCount = 0;
    FakeEventSource.closeCount = 0;
    FakeEventSource.lastUrl = null;
    liveSources.clear();
  }

  url: string;
  closed = false;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  listeners = new Map<string, EventListener>();

  constructor(url: string) {
    this.url = url;
    FakeEventSource.openCount += 1;
    FakeEventSource.lastUrl = url;
    liveSources.add(this);
  }

  addEventListener(name: string, handler: EventListener): void {
    this.listeners.set(name, handler);
  }

  close(): void {
    if (this.closed) return;
    this.closed = true;
    FakeEventSource.closeCount += 1;
    liveSources.delete(this);
  }
}

Object.defineProperty(target, 'EventSource', {
  configurable: true,
  writable: true,
  value: FakeEventSource,
});

const { render } = await import('@testing-library/svelte');
const { default: Fixture } = await import('./event-source-fixture.svelte');
const { default: Driver } = await import('./event-source-driver.svelte');
const { tick } = await import('svelte');

beforeEach(() => {
  FakeEventSource.reset();
});

afterEach(() => {
  FakeEventSource.reset();
});

describe('createEventSource factory', () => {
  test('opens an EventSource on attach when URL is non-null', async () => {
    const { unmount } = render(Fixture, { url: '/events' });
    await tick();
    expect(FakeEventSource.openCount).toBe(1);
    expect(FakeEventSource.lastUrl).toBe('/events');
    expect(FakeEventSource.closeCount).toBe(0);
    unmount();
  });

  test('does not open when URL is null initially', async () => {
    const { unmount } = render(Fixture, { url: null });
    await tick();
    expect(FakeEventSource.openCount).toBe(0);
    unmount();
  });

  test('wires onmessage and onerror handlers', async () => {
    let messages = 0;
    let errors = 0;
    const { unmount } = render(Fixture, {
      url: '/events',
      handlers: {
        onmessage: () => {
          messages += 1;
        },
        onerror: () => {
          errors += 1;
        },
      },
    });
    await tick();
    const [source] = [...liveSources];
    expect(source).toBeDefined();
    source?.onmessage?.(new MessageEvent('message'));
    source?.onerror?.(new Event('error'));
    expect(messages).toBe(1);
    expect(errors).toBe(1);
    unmount();
  });

  test('registers named event listeners passed via `events`', async () => {
    let reloads = 0;
    const { unmount } = render(Fixture, {
      url: '/events',
      handlers: {
        events: {
          reload: () => {
            reloads += 1;
          },
        },
      },
    });
    await tick();
    const [source] = [...liveSources];
    const handler = source?.listeners.get('reload');
    expect(handler).toBeDefined();
    handler?.(new MessageEvent('reload'));
    expect(reloads).toBe(1);
    unmount();
  });

  test('closes on unmount', async () => {
    const { unmount } = render(Fixture, { url: '/events' });
    await tick();
    expect(FakeEventSource.openCount).toBe(1);
    unmount();
    await tick();
    expect(FakeEventSource.closeCount).toBe(1);
    expect(liveSources.size).toBe(0);
  });
});

describe('createEventSource reactivity', () => {
  test('closes previous and opens new on URL change, leaving exactly one live source', async () => {
    const { component, unmount } = render(Driver, { initial: '/events/a' });
    await tick();
    expect(FakeEventSource.openCount).toBe(1);
    expect(FakeEventSource.lastUrl).toBe('/events/a');

    component.setUrl('/events/b');
    await tick();

    expect(FakeEventSource.openCount).toBe(2);
    expect(FakeEventSource.closeCount).toBe(1);
    expect(FakeEventSource.lastUrl).toBe('/events/b');
    expect(liveSources.size).toBe(1);
    expect([...liveSources][0]?.url).toBe('/events/b');

    unmount();
    await tick();
    expect(FakeEventSource.closeCount).toBe(2);
    expect(liveSources.size).toBe(0);
  });

  test('null URL initially, then setting URL opens exactly one source', async () => {
    const { component, unmount } = render(Driver, { initial: null });
    await tick();
    expect(FakeEventSource.openCount).toBe(0);

    component.setUrl('/events');
    await tick();

    expect(FakeEventSource.openCount).toBe(1);
    expect(liveSources.size).toBe(1);
    unmount();
  });

  test('setting URL back to null closes the source', async () => {
    const { component, unmount } = render(Driver, { initial: '/events' });
    await tick();
    expect(FakeEventSource.openCount).toBe(1);

    component.setUrl(null);
    await tick();

    expect(FakeEventSource.closeCount).toBe(1);
    expect(liveSources.size).toBe(0);
    unmount();
  });
});
