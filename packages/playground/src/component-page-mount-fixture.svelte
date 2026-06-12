<!--
  Test-only fixture isolating the example-mount ATTACHMENT from
  `component-page.svelte`.

  It mirrors that attachment's exact structure — one `example-mount-<scenario>`
  container per scenario via a keyed `{#each}`, each carrying
  `{@attach mountScenario(scenario)}`. The attachment mounts the registered
  scenario component when the node is created and unmounts it when the node is
  removed, so mount/unmount parity rides on element lifecycle (no timing race).
  Reading `revision` lets the driver force the `{#each}` to re-key, exercising
  rapid attach/detach churn.

  Mounting the full `component-page.svelte` is impractical here: it depends on
  `window.location.pathname`, the server-injected
  `__CINDER_EXAMPLES__`/`__CINDER_SCENARIOS__` globals, and several deep-imported
  cinder components — none of which the mount lifecycle depends on.
-->
<script lang="ts">
  import { mount, unmount } from 'svelte';

  type Props = {
    /** Scenario ids; one mount container is rendered per id. */
    scenarios: string[];
    /**
     * Registry of scenario id -> component, mirroring
     * `window.__CINDER_SCENARIOS__`. Values are checked for callability before
     * mount, exactly like the real attachment.
     */
    registry: Record<string, unknown>;
    /**
     * Bumping this re-keys the `{#each}`, detaching and re-attaching every
     * container — the churn the lifecycle must survive without orphaning trees.
     */
    revision?: number;
  };

  let { scenarios, registry, revision = 0 }: Props = $props();

  // Mirrors component-page.svelte's `mountScenario` attachment: mount on attach,
  // unmount on detach, with the same registry lookup and error handling.
  function mountScenario(scenario: string): (element: HTMLElement) => () => void {
    return (element: HTMLElement) => {
      const Component = registry[scenario];
      if (typeof Component !== 'function') {
        console.error(`[cinder playground] no registered component for scenario "${scenario}"`);
        return () => {};
      }
      let app: ReturnType<typeof mount> | undefined;
      try {
        app = mount(Component as Parameters<typeof mount>[0], { target: element });
      } catch (error) {
        console.error(`[cinder playground] failed to mount example "${scenario}":`, error);
      }
      return () => {
        if (app === undefined) return;
        try {
          unmount(app);
        } catch {
          // Best-effort cleanup only.
        }
      };
    };
  }
</script>

<div class="example-list">
  {#each scenarios as scenario (`${scenario}-${revision}`)}
    <div
      class="example-preview"
      id="example-mount-{scenario}"
      {@attach mountScenario(scenario)}
    ></div>
  {/each}
</div>
