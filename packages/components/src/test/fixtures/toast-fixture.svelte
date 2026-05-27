<script lang="ts" module>
  import type { ToastApi } from '../../_internal/toast-context.ts';

  /**
   * Test-only fixture that mounts a `<ToastRegion />` and exposes its API
   * via a callback so tests can drive `show` / `dismiss` imperatively.
   *
   * Uses the new `children` snippet on ToastRegion to mount a probe inside
   * the region — useToast() can only read context from a real child
   * component, not from a snippet defined in this file's scope (snippets
   * capture lexical scope, not render scope).
   */
  export type ToastFixtureProps = {
    onReady?: (api: ToastApi) => void;
    maxStack?: number;
    defaultDuration?: number;
    position?: import('../../_internal/toast-context.ts').ToastPosition;
  };
</script>

<script lang="ts">
  import ToastRegion from '../../components/toast-region/toast-region.svelte';
  import ToastProbe from './toast-probe.svelte';

  let {
    onReady,
    maxStack = 5,
    defaultDuration = 5000,
    position = 'bottom-right',
  }: ToastFixtureProps = $props();
</script>

<ToastRegion {maxStack} {defaultDuration} {position}>
  {#if onReady !== undefined}
    <ToastProbe {onReady} />
  {/if}
</ToastRegion>
