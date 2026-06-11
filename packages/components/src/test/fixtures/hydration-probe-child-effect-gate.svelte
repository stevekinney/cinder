<!--
  PROBE FIXTURE (#17): the SAFE counterpart of hydration-probe-child-browser-flag
  — an unconditionally-rendered child with its own $effect, plus a client-only
  affordance gated on a `hydrated` $effect (the correct pattern) instead of the
  BROWSER build flag. The SSR render is identical under both build conditions, so
  checkBuildFlagHydrationSafety must report this component as safe even though it
  renders a child component with effects.
-->
<script lang="ts">
  import HydrationProbeChild from './hydration-probe-child.svelte';

  let hydrated = $state(false);
  $effect(() => {
    hydrated = true;
  });
</script>

<div data-testid="probe-root">
  <HydrationProbeChild />
  {#if hydrated}
    <span data-testid="client-only">visible only after hydration</span>
  {/if}
</div>
