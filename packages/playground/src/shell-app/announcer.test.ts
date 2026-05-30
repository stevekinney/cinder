/// <reference lib="dom" />
/**
 * Tests for the shared `Announcer` reactive class.
 *
 * The class uses `$state`, so it must be exercised inside a Svelte component
 * context — we follow the same happy-dom-before-testing-library setup as
 * `event-source.test.ts`. A tiny fixture exposes the singleton's `announce`
 * and `message` to the test.
 *
 * The behavior under test is the empty-then-set coalescing trick: `announce`
 * clears `message` synchronously, then writes the new text after a 50 ms gap.
 * We drive time with `setSystemTime` + Bun's fake-timer-free `setTimeout` by
 * awaiting real delays kept short enough to stay fast.
 */
import { afterEach, beforeEach, describe, expect, test } from 'bun:test';

// Use the shared, idempotent happy-dom setup (same as every other DOM test in
// this package, via bunfig's preload) BEFORE dynamic-importing testing-library.
// A hand-rolled `new Window()` here would clobber the globals an earlier file in
// the same process already installed and skip the Web Animations / removeChild
// shims, which Svelte 5 transitions depend on.
import { setupHappyDom } from '../../../components/src/test/happy-dom.ts';

setupHappyDom();

/** The happy-dom window installed on globalThis, narrowed to expose `setURL`. */
const happyWindow = window as unknown as { happyDOM: { setURL(url: string): void } };

const { render, cleanup } = await import('@testing-library/svelte');
const { default: Fixture } = await import('./announcer-fixture.svelte');
const { default: NavFixture } = await import('./announcer-nav-fixture.svelte');
const { default: PopStateFixture } = await import('./announcer-popstate-fixture.svelte');
const { tick } = await import('svelte');
const { Announcer } = await import('./announcer.svelte.ts');

/** A minimal store stub that records calls the popstate handler makes. */
function makePopStateStore(): {
  currentComponent: string;
  syncFromUrl(): void;
  syncFromUrlCalls: number;
} {
  return {
    currentComponent: '',
    syncFromUrlCalls: 0,
    syncFromUrl(): void {
      this.syncFromUrlCalls += 1;
    },
  };
}

/** Wait `ms` real milliseconds, then flush Svelte's pending DOM updates. */
async function advance(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
  await tick();
}

beforeEach(() => {
  document.title = '';
  cleanup();
});

afterEach(() => {
  cleanup();
});

describe('Announcer', () => {
  test('message starts empty', () => {
    const announcer = new Announcer();
    expect(announcer.message).toBe('');
  });

  test('clears the message synchronously, then sets it after the 50 ms gap', async () => {
    const announcer = new Announcer();
    render(Fixture, { announcer });
    await tick();

    announcer.announce('Viewing button');
    // Synchronous empty: the DOM mutates to '' first so an identical repeat
    // still produces a mutation later.
    expect(announcer.message).toBe('');

    // Before the gap elapses, the message is still empty.
    await advance(20);
    expect(announcer.message).toBe('');

    // After the gap, the message lands.
    await advance(40);
    expect(announcer.message).toBe('Viewing button');
  });

  test('an identical repeat still empties then re-sets (forces a DOM mutation)', async () => {
    const announcer = new Announcer();
    render(Fixture, { announcer });
    await tick();

    announcer.announce('Viewing card');
    await advance(60);
    expect(announcer.message).toBe('Viewing card');

    // Announcing the same string again must clear to '' first...
    announcer.announce('Viewing card');
    expect(announcer.message).toBe('');

    // ...then restore it, guaranteeing assistive tech reads the repeat.
    await advance(60);
    expect(announcer.message).toBe('Viewing card');
  });

  test('a newer announcement cancels a pending one (coalesces to the latest)', async () => {
    const announcer = new Announcer();
    render(Fixture, { announcer });
    await tick();

    announcer.announce('first');
    await advance(20); // still pending
    announcer.announce('second');

    await advance(60);
    expect(announcer.message).toBe('second');
  });

  test('cancel() drops a pending announcement', async () => {
    const announcer = new Announcer();
    render(Fixture, { announcer });
    await tick();

    announcer.announce('should not land');
    announcer.cancel();

    await advance(60);
    expect(announcer.message).toBe('');
  });

  test('the live region reflects the message text', async () => {
    const announcer = new Announcer();
    const { container } = render(Fixture, { announcer });
    await tick();

    const region = container.querySelector('[aria-live="polite"]');
    expect(region).not.toBeNull();
    expect(region?.getAttribute('aria-atomic')).toBe('true');

    announcer.announce('Viewing accordion');
    await advance(60);
    expect(region?.textContent).toBe('Viewing accordion');
  });
});

describe('announceNavigation', () => {
  test('sets document.title to "cinder playground — <component>"', async () => {
    const announcer = new Announcer();
    const { component } = render(NavFixture, { announcer });
    await tick();

    await component['navigate']('button');
    expect(document.title).toBe('cinder playground — button');
  });

  test('queues a "Viewing <component>" announcement in the live region', async () => {
    const announcer = new Announcer();
    const { container, component } = render(NavFixture, { announcer });
    await tick();

    await component['navigate']('card');
    // announceNavigation awaits a tick but not the 50 ms coalescing gap.
    await advance(70);

    const region = container.querySelector('[aria-live="polite"]');
    expect(region?.textContent).toBe('Viewing card');
  });

  test('moves focus to the main region', async () => {
    const announcer = new Announcer();
    const { component } = render(NavFixture, { announcer });
    await tick();

    await component['navigate']('avatar');
    expect(document.activeElement).toBe(component['getMain']());
  });
});

describe('popstate navigation (browser back/forward)', () => {
  test('applies title + announcement + focus for a resolvable component', async () => {
    happyWindow.happyDOM.setURL('http://localhost/c/button');
    const announcer = new Announcer();
    const store = makePopStateStore();
    const { container, component } = render(PopStateFixture, { announcer, store });
    await tick();

    await component['popState']();

    expect(store.currentComponent).toBe('button');
    expect(document.title).toBe('cinder playground — button');
    expect(document.activeElement).toBe(component['getMain']());

    await advance(70);
    const region = container.querySelector('[aria-live="polite"]');
    expect(region?.textContent).toBe('Viewing button');
  });

  test('syncs the toolbar from the URL before announcing', async () => {
    happyWindow.happyDOM.setURL('http://localhost/c/card');
    const announcer = new Announcer();
    const store = makePopStateStore();
    const { component } = render(PopStateFixture, { announcer, store });
    await tick();

    await component['popState']();
    // The handler re-syncs the toolbar exactly once before focus lands.
    expect(store.syncFromUrlCalls).toBe(1);
  });

  test('does not announce or change title when the path is not a component route', async () => {
    happyWindow.happyDOM.setURL('http://localhost/not-a-component-route');
    const announcer = new Announcer();
    const store = makePopStateStore();
    store.currentComponent = 'button';
    const { container, component } = render(PopStateFixture, { announcer, store });
    await tick();

    await component['popState']();

    // Unresolved path: store untouched, but the toolbar still re-syncs.
    expect(store.currentComponent).toBe('button');
    expect(store.syncFromUrlCalls).toBe(1);
    expect(document.title).toBe('');

    await advance(70);
    const region = container.querySelector('[aria-live="polite"]');
    expect(region?.textContent).toBe('');
  });
});
