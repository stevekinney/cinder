<!--
  Test-only probe standing in for a real example scenario component, used by
  `component-page-example-mounts.test.ts` to exercise the REAL
  `createExampleMountHelpers().mountScenario` against a real mount/unmount,
  rather than a fixture that reimplements the attachment's logic.
-->
<script lang="ts" module>
  let mounts = 0;
  let unmounts = 0;

  export function mountCount(): number {
    return mounts;
  }

  export function unmountCount(): number {
    return unmounts;
  }

  export function resetProbe(): void {
    mounts = 0;
    unmounts = 0;
  }
</script>

<script lang="ts">
  import { onMount } from 'svelte';

  type Props = { mountIdPrefix?: string };
  const { mountIdPrefix = '' }: Props = $props();

  onMount(() => {
    mounts += 1;
    return () => {
      unmounts += 1;
    };
  });
</script>

<div class="example-mounts-probe" data-mount-id-prefix={mountIdPrefix}>
  <button type="button">Probe action</button>
</div>
