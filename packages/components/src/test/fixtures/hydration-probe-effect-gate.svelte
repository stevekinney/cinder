<!--
  PROBE FIXTURE (#17): a client-only affordance gated on a `hydrated` $effect —
  the CORRECT pattern (the ShareCard fix). `hydrated` starts false, so the
  affordance is absent in SSR HTML AND in the initial hydration render; the
  $effect then flips it true on the client, so the affordance appears after
  hydration's effects flush. This fixture exists only to measure that transition.
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
