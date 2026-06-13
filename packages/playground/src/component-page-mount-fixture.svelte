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

  It also mirrors the real snapshot block's zero-example branch: when `scenarios`
  is empty, render a single visible `.snapshot-empty-heading` instead of an empty
  container. The visual-regression harness waits for `#app > *` to be VISIBLE
  (non-zero box) before running axe, so a component with no `*.example.svelte`
  files must still paint a non-empty child or the wait times out.
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
    /**
     * Mirrors the real block's `humanizeId(componentName)` so the empty-examples
     * branch has a heading to render. Only read when `scenarios` is empty.
     */
    emptyHeading?: string | undefined;
  };

  let { scenarios, registry, revision = 0, emptyHeading = 'Component' }: Props = $props();

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
  {#if scenarios.length === 0}
    <h1 class="snapshot-empty-heading">{emptyHeading}</h1>
  {:else}
    {#each scenarios as scenario (`${scenario}-${revision}`)}
      <div
        class="example-preview"
        id="example-mount-{scenario}"
        {@attach mountScenario(scenario)}
      ></div>
    {/each}
  {/if}
</div>
