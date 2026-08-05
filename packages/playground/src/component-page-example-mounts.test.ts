/// <reference lib="dom" />
/**
 * Unit tests for `component-page-example-mounts.ts`.
 *
 * `mountScenario` is exercised against a real Svelte-mountable probe
 * (`component-page-example-mounts-probe.svelte`) rather than a fixture that
 * reimplements the attachment's own logic, so a passing test proves the
 * production mount/unmount path, not a copy of it.
 */

import { afterEach, describe, expect, it } from 'bun:test';
import { flushSync } from 'svelte';

import { setupHappyDom } from '../../components/src/test/happy-dom.ts';
import {
  copyErrorToClipboard,
  createExampleMountHelpers,
  disclosureFor,
  fetchExampleSource,
  scrollOverflowSentinel,
} from './component-page-example-mounts.ts';
import type { MountErrorDetail, SourceErrorDetail } from './example-error.ts';

setupHappyDom();

const {
  default: Probe,
  mountCount,
  unmountCount,
  resetProbe,
} = (await import('./component-page-example-mounts-probe.svelte')) as unknown as {
  default: unknown;
  mountCount: () => number;
  unmountCount: () => number;
  resetProbe: () => void;
};

type CinderWindow = typeof globalThis & { __CINDER_SCENARIOS__?: Record<string, unknown> };

afterEach(() => {
  resetProbe();
  delete (window as CinderWindow).__CINDER_SCENARIOS__;
  document.body.innerHTML = '';
});

describe('createExampleMountHelpers().mountScenario', () => {
  it('mounts a registered scenario and records nothing in mountErrors on success', () => {
    (window as CinderWindow).__CINDER_SCENARIOS__ = { basic: Probe };
    const mountErrors: Record<string, MountErrorDetail | undefined> = {};
    const { mountScenario } = createExampleMountHelpers({ mountErrors });

    const element = document.createElement('div');
    element.id = 'example-mount-basic';
    document.body.appendChild(element);

    const cleanup = mountScenario('basic')(element);
    flushSync();

    expect(mountCount()).toBe(1);
    expect(mountErrors['example-mount-basic']).toBeUndefined();
    expect(element.querySelector('.example-mounts-probe')).not.toBeNull();

    cleanup();
  });

  it("records a MountErrorDetail under the mounted element's id when the registered scenario throws", () => {
    const Throwing = function ThrowingComponent() {
      throw new Error('boom');
    };
    (window as CinderWindow).__CINDER_SCENARIOS__ = { broken: Throwing };
    const mountErrors: Record<string, MountErrorDetail | undefined> = {};
    const { mountScenario } = createExampleMountHelpers({ mountErrors });

    const element = document.createElement('div');
    element.id = 'example-mount-broken';
    document.body.appendChild(element);

    mountScenario('broken')(element);

    expect(mountErrors['example-mount-broken']?.message).toContain('boom');
  });

  it('calls unmount exactly once and does not throw when no app was mounted', () => {
    (window as CinderWindow).__CINDER_SCENARIOS__ = {};
    const mountErrors: Record<string, MountErrorDetail | undefined> = {};
    const { mountScenario } = createExampleMountHelpers({ mountErrors });

    const element = document.createElement('div');
    element.id = 'example-mount-missing';
    document.body.appendChild(element);

    const cleanup = mountScenario('missing')(element);

    expect(() => cleanup()).not.toThrow();
    expect(unmountCount()).toBe(0);
  });

  it('unmounts a successfully mounted app exactly once', () => {
    (window as CinderWindow).__CINDER_SCENARIOS__ = { basic: Probe };
    const mountErrors: Record<string, MountErrorDetail | undefined> = {};
    const { mountScenario } = createExampleMountHelpers({ mountErrors });

    const element = document.createElement('div');
    element.id = 'example-mount-basic';
    document.body.appendChild(element);

    const cleanup = mountScenario('basic')(element);
    flushSync();
    cleanup();

    expect(unmountCount()).toBe(1);
  });
});

describe('fetchExampleSource', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('writes the fetched text into state.fetchedSource on a 200 response', async () => {
    globalThis.fetch = (async () =>
      new Response('const x = 1;', { status: 200 })) as unknown as typeof fetch;
    const state = {
      fetchedSource: {} as Record<string, string | null>,
      loadingSource: {} as Record<string, boolean>,
      sourceErrors: {} as Record<string, SourceErrorDetail | undefined>,
    };

    const promise = fetchExampleSource('button', 'primary', state);
    expect(state.loadingSource['primary']).toBe(true);
    await promise;

    expect(state.fetchedSource['primary']).toBe('const x = 1;');
    expect(state.sourceErrors['primary']).toBeUndefined();
    expect(state.loadingSource['primary']).toBe(false);
  });

  it('writes a SourceErrorDetail on a non-OK response', async () => {
    globalThis.fetch = (async () =>
      new Response('nope', { status: 404, statusText: 'Not Found' })) as unknown as typeof fetch;
    const state = {
      fetchedSource: {} as Record<string, string | null>,
      loadingSource: {} as Record<string, boolean>,
      sourceErrors: {} as Record<string, SourceErrorDetail | undefined>,
    };

    await fetchExampleSource('button', 'missing', state);

    expect(state.fetchedSource['missing']).toBeNull();
    expect(state.sourceErrors['missing']).toEqual({
      url: '/example-src/button/missing',
      detail: '404 Not Found',
    });
    expect(state.loadingSource['missing']).toBe(false);
  });

  it('writes a SourceErrorDetail when fetch throws', async () => {
    globalThis.fetch = (async () => {
      throw new Error('network down');
    }) as unknown as typeof fetch;
    const state = {
      fetchedSource: {} as Record<string, string | null>,
      loadingSource: {} as Record<string, boolean>,
      sourceErrors: {} as Record<string, SourceErrorDetail | undefined>,
    };

    await fetchExampleSource('button', 'primary', state);

    expect(state.fetchedSource['primary']).toBeNull();
    expect(state.sourceErrors['primary']).toEqual({
      url: '/example-src/button/primary',
      detail: 'network down',
    });
    expect(state.loadingSource['primary']).toBe(false);
  });
});

describe('disclosureFor', () => {
  it('returns the matching entry', () => {
    const disclosures = [
      { scenario: 'basic', expandedIds: [] },
      { scenario: 'advanced', expandedIds: ['source-advanced'] },
    ];
    expect(disclosureFor(disclosures, 'advanced')).toBe(disclosures[1]);
  });

  it('returns undefined for no match', () => {
    expect(disclosureFor([{ scenario: 'basic', expandedIds: [] }], 'missing')).toBeUndefined();
  });
});

describe('copyErrorToClipboard', () => {
  const originalNavigator = globalThis.navigator;

  afterEach(() => {
    Object.defineProperty(globalThis, 'navigator', {
      configurable: true,
      value: originalNavigator,
      writable: true,
    });
  });

  it('calls navigator.clipboard.writeText with the formatted error', async () => {
    const calls: string[] = [];
    Object.defineProperty(globalThis, 'navigator', {
      configurable: true,
      value: { clipboard: { writeText: async (text: string) => void calls.push(text) } },
    });

    await copyErrorToClipboard({ message: 'boom', stack: 'at foo.ts:1:1' });

    expect(calls).toEqual(['boom\n\nat foo.ts:1:1']);
  });

  it('returns without throwing when navigator.clipboard is undefined', async () => {
    Object.defineProperty(globalThis, 'navigator', {
      configurable: true,
      value: {},
    });

    await expect(copyErrorToClipboard({ message: 'boom' })).resolves.toBeUndefined();
  });

  it('returns without throwing when writeText rejects', async () => {
    Object.defineProperty(globalThis, 'navigator', {
      configurable: true,
      value: {
        clipboard: {
          writeText: async () => {
            throw new Error('denied');
          },
        },
      },
    });

    await expect(copyErrorToClipboard({ message: 'boom' })).resolves.toBeUndefined();
  });
});

describe('scrollOverflowSentinel', () => {
  it('calls onOverflowChange(true) when scrollWidth exceeds clientWidth by more than 1px', () => {
    const element = document.createElement('div');
    Object.defineProperty(element, 'scrollWidth', { value: 200, configurable: true });
    Object.defineProperty(element, 'clientWidth', { value: 100, configurable: true });
    const calls: boolean[] = [];

    const cleanup = scrollOverflowSentinel(element, (overflows) => calls.push(overflows));

    expect(calls).toEqual([true]);
    cleanup();
  });

  it('calls onOverflowChange(false) when the element does not overflow', () => {
    const element = document.createElement('div');
    Object.defineProperty(element, 'scrollWidth', { value: 100, configurable: true });
    Object.defineProperty(element, 'clientWidth', { value: 100, configurable: true });
    const calls: boolean[] = [];

    const cleanup = scrollOverflowSentinel(element, (overflows) => calls.push(overflows));

    expect(calls).toEqual([false]);
    cleanup();
  });

  it('disconnects the ResizeObserver exactly once on cleanup', () => {
    const element = document.createElement('div');
    Object.defineProperty(element, 'scrollWidth', { value: 100, configurable: true });
    Object.defineProperty(element, 'clientWidth', { value: 100, configurable: true });

    let disconnectCalls = 0;
    const originalDisconnect = ResizeObserver.prototype.disconnect;
    ResizeObserver.prototype.disconnect = function (this: ResizeObserver) {
      disconnectCalls += 1;
      return originalDisconnect.call(this);
    };

    try {
      const cleanup = scrollOverflowSentinel(element, () => {});
      cleanup();
      expect(disconnectCalls).toBe(1);
    } finally {
      ResizeObserver.prototype.disconnect = originalDisconnect;
    }
  });
});
