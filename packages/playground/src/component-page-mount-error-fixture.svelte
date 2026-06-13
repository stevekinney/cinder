<!--
  Test-only fixture isolating the mount-ERROR keying from `component-page.svelte`.

  The real page can render the SAME featured scenario in two locations — the
  Overview live preview (`overview-mount-<scenario>`) and the Examples list
  (`example-mount-<scenario>`) — each through its own `{@attach}` mount. This
  fixture reproduces exactly that: two containers, same scenario, distinct id
  prefixes, both driven by a `mountScenario` attachment whose error tracking is
  keyed by the container's DOM `id` (mirroring the fix).

  It exists to lock the invariant Cursor Bugbot flagged: a mount failure in one
  location must NOT clobber or leak into the other's error slot. Keying the
  shared `mountErrors` record by bare scenario (the bug) would collapse both
  containers onto one key — whichever attachment ran last would win, hiding a
  real failure or painting an error over a preview that actually rendered.

  `failingScenarios` lets a test force a deterministic mount failure for chosen
  scenarios without needing a component that throws: the attachment records an
  error for those instead of mounting.
-->
<script lang="ts" module>
  /** Mount-error record keyed by container DOM id, exposed for assertions. */
  export type MountErrorRecord = Record<string, string | undefined>;
</script>

<script lang="ts">
  import { mount, unmount } from 'svelte';

  type Props = {
    /** Scenario rendered in BOTH the overview and example container. */
    scenario: string;
    /** Registry of scenario id -> component (mirrors `__CINDER_SCENARIOS__`). */
    registry: Record<string, unknown>;
    /**
     * Container id prefixes whose mount should be forced to fail, e.g.
     * `['overview-mount']` to fail only the overview instance. Matched against
     * the part of `element.id` before the scenario.
     */
    failingPrefixes?: string[];
    /**
     * Bindable mount-error record, keyed by container DOM id. The parent reads
     * this to assert per-location isolation.
     */
    mountErrors?: MountErrorRecord;
  };

  let { scenario, registry, failingPrefixes = [], mountErrors = $bindable({}) }: Props = $props();

  // Mirrors component-page.svelte's `mountScenario`: key the error record by the
  // container's own `id` so two containers (same scenario, different id) keep
  // independent error slots. The `failingPrefixes` hook stands in for a real
  // mount throwing, so the keying — not a flaky throwing component — is what the
  // test exercises.
  function mountScenario(scenario: string): (element: HTMLElement) => () => void {
    return (element: HTMLElement) => {
      const mountKey = element.id;
      const prefix = mountKey.slice(0, mountKey.length - scenario.length - 1);
      if (failingPrefixes.includes(prefix)) {
        mountErrors[mountKey] = `forced failure in ${prefix}`;
        return () => {};
      }
      const Component = registry[scenario];
      if (typeof Component !== 'function') return () => {};
      let app: ReturnType<typeof mount> | undefined;
      try {
        app = mount(Component as Parameters<typeof mount>[0], { target: element });
        mountErrors[mountKey] = undefined;
      } catch (error) {
        mountErrors[mountKey] = error instanceof Error ? error.message : String(error);
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

<div class="overview-stage">
  <div
    class="example-preview"
    id="overview-mount-{scenario}"
    {@attach mountScenario(scenario)}
  ></div>
</div>
<div class="example-stage">
  <div
    class="example-preview"
    id="example-mount-{scenario}"
    {@attach mountScenario(scenario)}
  ></div>
</div>
