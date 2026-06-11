<!--
  PROBE FIXTURE (#17): a client-only affordance gated on esm-env's `BROWSER`
  build flag — the buggy pattern from the original ShareCard native-share bug.

  `BROWSER` is a compile-time constant: false in the server build, true in the
  client build. So the affordance is ABSENT from the server-condition SSR render
  and PRESENT in the browser-condition SSR render. checkBuildFlagHydrationSafety
  compares those two renders and flags the divergence (buildFlagInvariant: false).
-->
<script lang="ts">
  import { BROWSER } from 'esm-env';
</script>

<div data-testid="probe-root">
  {#if BROWSER}
    <span data-testid="client-only">visible only in the browser</span>
  {/if}
</div>
