<script lang="ts">
  /**
   * Route outlet (plan §13 T1.6): lazily mounts the matched route
   * component from `../routes.ts`, wrapped in `<FaultBoundary>` per route
   * (T1.5) with a `<Skeleton>` shown while the chunk loads. Keeps the
   * placeholder shell's dynamic-import behavior — this is the same
   * `definition.load()` contract every domain track's `index.svelte`
   * already satisfies.
   */
  import type { Component } from 'svelte';

  import { Skeleton, EmptyState } from '@lostgradient/cinder';

  import { router } from '../../lib/router.svelte.ts';
  import FaultBoundary from '../fault-boundary.svelte';

  let activeComponent = $state<Component | null>(null);
  let loading = $state(false);
  let notFound = $state(false);

  $effect(() => {
    const match = router.current;
    const definition = match.route;

    if (!definition) {
      activeComponent = null;
      loading = false;
      notFound = true;
      return;
    }

    notFound = false;
    loading = true;
    let cancelled = false;
    definition
      .load()
      .then((loadedModule) => {
        if (cancelled) return undefined;
        activeComponent = loadedModule.default;
        loading = false;
        return undefined;
      })
      .catch(() => {
        if (cancelled) return undefined;
        loading = false;
        return undefined;
      });

    return () => {
      cancelled = true;
    };
  });
</script>

<main class="weft-shell-outlet">
  <FaultBoundary>
    {#if notFound}
      <EmptyState
        title="Page not found"
        description="This path isn't one of the console's routes. Use the sidebar or Cmd+K to navigate."
      />
    {:else if loading || !activeComponent}
      <div class="weft-shell-outlet__skeleton" role="status" aria-busy="true" aria-label="Loading">
        <Skeleton height="1.5rem" width="40%" />
        <Skeleton height="10rem" />
        <Skeleton height="10rem" />
      </div>
    {:else}
      {#key router.pathname}
        {@const ActiveComponent = activeComponent}
        <ActiveComponent />
      {/key}
    {/if}
  </FaultBoundary>
</main>
