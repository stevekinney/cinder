import { describe, expect, test } from 'bun:test';

import { createRetryingLoaderCache } from './retrying-loader-cache.ts';

describe('createRetryingLoaderCache', () => {
  test('returns the same in-flight promise for concurrent callers', async () => {
    let invocations = 0;
    const load = createRetryingLoaderCache(async () => {
      invocations += 1;
      return 'value';
    });
    const [a, b, c] = await Promise.all([load(), load(), load()]);
    expect(a).toBe('value');
    expect(b).toBe('value');
    expect(c).toBe('value');
    expect(invocations).toBe(1);
  });

  test('caches resolved value across sequential calls', async () => {
    let invocations = 0;
    const load = createRetryingLoaderCache(async () => {
      invocations += 1;
      return invocations;
    });
    expect(await load()).toBe(1);
    expect(await load()).toBe(1);
    expect(await load()).toBe(1);
    expect(invocations).toBe(1);
  });

  test('evicts the cached rejection so the next call retries the loader', async () => {
    // Bugbot regression case: a one-shot loader failure must not lock
    // every subsequent call into replaying the same rejection. Both the
    // Shiki adapter (wrapping `import('shiki')`) and CodeBlock's default
    // highlighter seam (wrapping the dynamic adapter import) rely on this;
    // without eviction a transient chunk-load failure would force the
    // plaintext fallback for the lifetime of the cache.
    let invocations = 0;
    const load = createRetryingLoaderCache(async () => {
      invocations += 1;
      if (invocations === 1) {
        throw new Error('simulated load failure');
      }
      return 'recovered';
    });

    // First call rejects.
    let firstError: unknown;
    try {
      await load();
    } catch (error) {
      firstError = error;
    }
    expect(firstError).toBeInstanceOf(Error);
    expect((firstError as Error).message).toBe('simulated load failure');

    // Second call retries the loader because the rejected promise was
    // evicted from the cache.
    expect(await load()).toBe('recovered');
    expect(invocations).toBe(2);

    // Third call hits the cached resolved value (no retry).
    expect(await load()).toBe('recovered');
    expect(invocations).toBe(2);
  });

  test('rejection eviction does not lose concurrent callers that already started awaiting', async () => {
    // Concurrent callers share the same pending promise. When that
    // promise rejects, each caller observes the same rejection through
    // their own await — eviction only affects future calls.
    let invocations = 0;
    const load = createRetryingLoaderCache(async () => {
      invocations += 1;
      throw new Error('boom');
    });
    const results = await Promise.allSettled([load(), load(), load()]);
    for (const result of results) {
      expect(result.status).toBe('rejected');
      expect((result as PromiseRejectedResult).reason).toBeInstanceOf(Error);
    }
    // All three calls shared the same in-flight loader invocation.
    expect(invocations).toBe(1);
  });
});
