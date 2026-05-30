<!--
  Test-only driver wrapping `component-page-mount-fixture.svelte`.

  Holds the reactive `revision` in a component context (where `$state` is
  defined) and exposes an imperative `bump()` handle so a test can force the
  mount-effect to re-run rapidly without an intervening flush — the precise
  shape that surfaced the original queueMicrotask/cleanup race.
-->
<script lang="ts" module>
  export type MountDriverProps = {
    scenarios: string[];
    registry: Record<string, unknown>;
  };

  export type MountDriverHandle = {
    bump(): void;
  };
</script>

<script lang="ts">
  import Fixture from './component-page-mount-fixture.svelte';

  let { scenarios, registry }: MountDriverProps = $props();

  let revision = $state(0);

  /** Force the fixture's mount-effect to re-run. */
  export function bump(): void {
    revision += 1;
  }
</script>

<Fixture {scenarios} {registry} {revision} />
