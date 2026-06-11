<!--
  PROBE FIXTURE (#17): a client-only affordance gated on a `hydrated` $effect —
  the CORRECT pattern (the ShareCard fix). `hydrated` starts false and $effect
  does not run during SSR, so the affordance is ABSENT from the SSR render under
  BOTH build conditions — server and browser. checkBuildFlagHydrationSafety sees
  identical output either way and reports it safe (buildFlagInvariant: true). At
  runtime the $effect flips `hydrated` true after hydration; that transition is
  outside what this static SSR-comparison harness checks.
-->
<script lang="ts">
  let hydrated = $state(false);
  $effect(() => {
    hydrated = true;
  });
</script>

<div data-testid="probe-root">
  {#if hydrated}
    <span data-testid="client-only">visible only after hydration</span>
  {/if}
</div>
