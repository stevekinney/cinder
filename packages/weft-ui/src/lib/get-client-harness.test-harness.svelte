<script lang="ts">
  /**
   * Test-only harness for `client.test.ts`. `getContext()` itself requires an
   * active component-initialization lifecycle (a bare call from a `bun:test`
   * file throws Svelte's own lifecycle error before `getClient()`'s own
   * "no client in context" check ever runs — see `client.test.ts`'s
   * "outside any provideClient() ancestor" tests). This harness renders as a
   * real component with no `provideClient()` ancestor, so `getClient()` runs
   * inside a valid component context and its own throw is the one that
   * fires. `onClient` is unused when there is no ancestor (the throw happens
   * before it could run) — `provide-client-harness.test-harness.svelte`
   * reuses this same component as the child of a real `provideClient()`
   * ancestor to exercise the successful round trip instead.
   */
  import { untrack } from 'svelte';

  import type { HttpClient } from '@lostgradient/weft';

  import { getClient } from './client.ts';

  interface Props {
    onClient?: ((client: HttpClient) => void) | undefined;
  }

  let { onClient }: Props = $props();

  // `onClient` is read exactly once, here, at this harness's own
  // initialization — there is deliberately no reactive dependency on it past
  // this point, so `untrack()` makes that explicit instead of triggering
  // Svelte's "state referenced locally" warning (same convention
  // `src/app/shell/shell.svelte` uses).
  //
  // `onClient?.(getClient())` would short-circuit `getClient()` itself when
  // `onClient` is omitted — optional-chaining calls never evaluate their
  // arguments once the callee is nullish — which would silently skip the
  // "no ancestor" test's throw. Calling `getClient()` unconditionally first
  // keeps it on the call path regardless of whether a caller passed
  // `onClient`.
  const client = getClient();
  untrack(() => onClient)?.(client);
</script>
