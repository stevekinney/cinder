<!--
  Test-only fixture isolating the example-mount `$effect` from
  `component-page.svelte`.

  It reproduces that effect's exact structure — render an
  `example-mount-<scenario>` container per scenario via a keyed `{#each}`, then
  synchronously mount the registered scenario component into each container and
  unmount it on cleanup. Reading `revision` inside the effect lets the driver
  force rapid re-runs, which is the scenario the original `queueMicrotask`
  deferral mishandled (cleanup raced still-pending mounts into a stale
  collection). Mounting the full `component-page.svelte` is impractical here: it
  depends on `window.location.pathname`, the server-injected
  `__CINDER_EXAMPLES__`/`__CINDER_SCENARIOS__` globals, and several
  deep-imported cinder components — none of which the race depends on.
-->
<script lang="ts">
  import { mount, unmount } from 'svelte';

  type Props = {
    /** Scenario ids; one mount container is rendered per id. */
    scenarios: string[];
    /**
     * Registry of scenario id -> component, mirroring
     * `window.__CINDER_SCENARIOS__`. Values are checked for callability before
     * mount, exactly like the real effect.
     */
    registry: Record<string, unknown>;
    /**
     * Bumping this forces the mount-effect to re-run (it is read inside the
     * effect body), simulating reactive re-runs of the real component.
     */
    revision?: number;
  };

  let { scenarios, registry, revision = 0 }: Props = $props();

  // Mirrors component-page.svelte's example-mount effect verbatim: synchronous
  // mount into the same `localApps` the cleanup closes over, no microtask.
  $effect(() => {
    // Read `revision` so the effect re-runs when the driver bumps it.
    void revision;

    const localApps: ReturnType<typeof mount>[] = [];

    for (const scenario of scenarios) {
      const container = document.getElementById(`example-mount-${scenario}`);
      if (!container) continue;

      const Component = registry[scenario];
      if (typeof Component !== 'function') {
        console.error(`[cinder playground] no registered component for scenario "${scenario}"`);
        continue;
      }

      try {
        const app = mount(Component as Parameters<typeof mount>[0], { target: container });
        localApps.push(app);
      } catch (error) {
        console.error(`[cinder playground] failed to mount example "${scenario}":`, error);
      }
    }

    return () => {
      for (const app of localApps) {
        try {
          unmount(app);
        } catch {
          // Suppress — best-effort cleanup only.
        }
      }
    };
  });
</script>

<div class="example-list">
  {#each scenarios as scenario (scenario)}
    <div class="example-preview" id="example-mount-{scenario}"></div>
  {/each}
</div>
