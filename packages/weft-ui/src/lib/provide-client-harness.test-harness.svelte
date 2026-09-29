<script lang="ts">
  /**
   * Test-only harness for `client.test.ts`. Mirrors how `src/app/shell/
   * shell.svelte` actually uses these two functions: a parent calls
   * `provideClient()` during its own setup, and a child renders below it and
   * calls `getClient()`. Reuses `get-client-harness.test-harness.svelte` as
   * that child so the round trip is exercised through the same code both
   * "no ancestor" and "with an ancestor" tests share.
   */
  import { untrack } from 'svelte';

  import type { HttpClient } from '@lostgradient/weft';

  import { provideClient } from './client.ts';
  import GetClientHarness from './get-client-harness.test-harness.svelte';

  interface Props {
    client: HttpClient;
    onClient?: ((client: HttpClient) => void) | undefined;
  }

  let { client, onClient }: Props = $props();

  // `client` is read exactly once, here, at this harness's own
  // initialization — same `untrack()` convention `src/app/shell/shell.svelte`
  // uses for the same reason (no reactive dependency on the prop past this
  // point).
  provideClient(untrack(() => client));
</script>

<GetClientHarness {onClient} />
