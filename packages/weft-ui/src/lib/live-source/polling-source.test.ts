import { waitFor } from '@testing-library/svelte';
import { afterEach, describe, expect, test } from 'bun:test';

import { Window } from 'happy-dom';

import { PollingSource } from './polling-source.svelte.ts';

/**
 * happy-dom's `document.hidden`/`visibilityState` are getter-only with no
 * built-in way to simulate tab visibility — override the getter (it's
 * `configurable: true`) and dispatch the real event, the standard technique
 * for this. Must construct the event via `window.Event` (the same happy-dom
 * window instance backing the global `document`), not the bare global
 * `Event` — they are different class references under this repo's test
 * setup (`tests/setup.ts`'s "skip if already present" global copy), so
 * `document.dispatchEvent(new Event(...))` fails happy-dom's internal
 * `instanceof Event` check with a confusing `TypeError` (verified
 * empirically, not documented anywhere).
 */
function setDocumentHidden(hidden: boolean): void {
  Object.defineProperty(document, 'hidden', {
    configurable: true,
    get: () => hidden,
  });
  if (!(window instanceof Window)) {
    throw new Error('expected the test window to be backed by happy-dom');
  }
  const event = document.createEvent('Event');
  event.initEvent('visibilitychange');
  document.dispatchEvent(event);
}

afterEach(() => {
  setDocumentHidden(false);
});

describe('PollingSource', () => {
  test('fetches immediately on the first subscribe and delivers to the subscriber', async () => {
    let calls = 0;
    const source = new PollingSource<number>(
      () => {
        calls += 1;
        return Promise.resolve(calls);
      },
      { intervalMs: 50_000 },
    );

    const received: number[] = [];
    source.subscribe((frame) => received.push(frame));

    await waitFor(() => {
      expect(received).toEqual([1]);
    });
    expect(source.status).toBe('polling');
    source.close();
  });

  test('whenConnected resolves once the first fetch succeeds', async () => {
    const source = new PollingSource<string>(() => Promise.resolve('ok'), { intervalMs: 50_000 });
    source.subscribe(() => {});
    await source.whenConnected();
    expect(source.status).toBe('polling');
    source.close();
  });

  test('delivers to every subscriber', async () => {
    const source = new PollingSource<string>(() => Promise.resolve('frame'), {
      intervalMs: 50_000,
    });
    const a: string[] = [];
    const b: string[] = [];
    source.subscribe((frame) => a.push(frame));
    source.subscribe((frame) => b.push(frame));

    await waitFor(() => {
      expect(a).toEqual(['frame']);
      expect(b).toEqual(['frame']);
    });
    source.close();
  });

  test('polls again after intervalMs elapses', async () => {
    let calls = 0;
    const source = new PollingSource<number>(
      () => {
        calls += 1;
        return Promise.resolve(calls);
      },
      { intervalMs: 5 },
    );
    const received: number[] = [];
    source.subscribe((frame) => received.push(frame));

    await waitFor(() => {
      expect(received.length).toBeGreaterThanOrEqual(3);
    });
    // Strictly increasing — each poll is a fresh call, not a repeat.
    expect(received).toEqual(received.toSorted((a, b) => a - b));
    source.close();
  });

  test('closes after 5 consecutive failures', async () => {
    const source = new PollingSource<never>(() => Promise.reject(new Error('boom')), {
      intervalMs: 1,
    });
    source.subscribe(() => {});

    await waitFor(() => {
      expect(source.status).toBe('closed');
    });
  });

  test('a single success resets the failure counter (does not close after failures interleaved with successes)', async () => {
    let call = 0;
    const source = new PollingSource<string>(
      () => {
        call += 1;
        // Fail 4 times, succeed once, fail 4 more — never 5 in a row.
        return call % 5 === 0 ? Promise.resolve('ok') : Promise.reject(new Error('flaky'));
      },
      { intervalMs: 1 },
    );
    const received: string[] = [];
    source.subscribe((frame) => received.push(frame));

    await waitFor(() => {
      expect(call).toBeGreaterThanOrEqual(12);
    });
    expect(source.status).not.toBe('closed');
    source.close();
  });

  test('suspends polling while document.hidden and resumes on visibilitychange', async () => {
    let calls = 0;
    const source = new PollingSource<number>(
      () => {
        calls += 1;
        return Promise.resolve(calls);
      },
      { intervalMs: 5 },
    );
    const received: number[] = [];
    source.subscribe((frame) => received.push(frame));

    await waitFor(() => {
      expect(received.length).toBeGreaterThanOrEqual(1);
    });

    setDocumentHidden(true);
    // A tick already in flight when `hidden` flips is allowed to land — only
    // the NEXT scheduling decision checks visibility — so settle briefly
    // before taking the "paused" baseline, then prove no further growth.
    await new Promise((resolve) => setTimeout(resolve, 15));
    const countWhileHidden = calls;
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(calls).toBe(countWhileHidden);

    setDocumentHidden(false);
    await waitFor(() => {
      expect(calls).toBeGreaterThan(countWhileHidden);
    });
    source.close();
  });

  test('close() stops polling and settles whenConnected', async () => {
    let calls = 0;
    const source = new PollingSource<number>(
      () => {
        calls += 1;
        return Promise.resolve(calls);
      },
      { intervalMs: 5 },
    );
    source.subscribe(() => {});
    await source.whenConnected();

    source.close();
    expect(source.status).toBe('closed');
    const countAtClose = calls;
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(calls).toBe(countAtClose);
  });

  test('close() is idempotent', () => {
    const source = new PollingSource<string>(() => Promise.resolve('x'), { intervalMs: 50_000 });
    source.close();
    expect(() => source.close()).not.toThrow();
    expect(source.status).toBe('closed');
  });
});
