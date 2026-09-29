import { installFetchImplementation } from '../../lib/live-source/fetch-test-support.ts';

/**
 * Test-only `globalThis.fetch` stub for component tests exercising
 * `storage-client.ts` calls through a mounted `.svelte` component (rather
 * than calling the client functions directly, as `storage-client.test.ts`'s
 * `ScriptedFetch` does). Never imported by production code.
 */
export interface StubbedFetchCall {
  readonly url: string;
  readonly method: string;
}

export function stubStorageFetch(
  handler: (call: StubbedFetchCall) => Response | Promise<Response>,
): { calls: StubbedFetchCall[]; restore: () => void } {
  const calls: StubbedFetchCall[] = [];

  const restore = installFetchImplementation(async (input, init) => {
    const call: StubbedFetchCall = {
      url: typeof input === 'string' ? input : input instanceof URL ? input.href : input.url,
      method: init?.method ?? 'GET',
    };
    calls.push(call);
    return handler(call);
  });

  return {
    calls,
    restore,
  };
}
