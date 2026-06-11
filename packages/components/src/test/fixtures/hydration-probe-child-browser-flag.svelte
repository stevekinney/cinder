<!--
  PROBE FIXTURE (#17): a parent that UNCONDITIONALLY renders a child component
  (with its own $effect) AND gates a client-only affordance on the `BROWSER`
  build flag — the buggy pattern, but with the child-effect wrinkle the task is
  named for. The child renders identically under both build conditions; only the
  BROWSER-gated span diverges, so checkBuildFlagHydrationSafety must still flag
  this component as unsafe (the child must not mask the divergence).
-->
<script lang="ts">
  import { BROWSER } from 'esm-env';

  import HydrationProbeChild from './hydration-probe-child.svelte';
</script>

<div data-testid="probe-root">
  <HydrationProbeChild />
  {#if BROWSER}
    <span data-testid="client-only">visible only in the browser</span>
  {/if}
</div>
