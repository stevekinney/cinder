<!--
  Test-only probe standing in for the BARE component the Playground section
  mounts live (#405). Unlike `component-page-scenario-probe.svelte` — which is
  mounted with no props and self-identifies from its container — this probe is
  mounted WITH the synthesized prop values, so it records the exact props object
  it received on each mount onto a shared module-level ledger.

  The live-preview attachment under test re-mounts on every `playgroundValues`
  change, so the ledger lets a test assert that each control change produced a
  fresh mount carrying the new values, and that the props arrived as a plain
  object (a snapshot) rather than a reactive `$state` proxy.
-->
<script lang="ts" module>
  /** Every props object a live probe has been mounted with, in mount order. */
  const propLedger: Record<string, unknown>[] = [];

  /** Whether each recorded props object was a plain (non-proxy) object. */
  const plainObjectLedger: boolean[] = [];

  /** Count of probe teardowns observed (one per `onMount` cleanup). */
  let unmounts = 0;

  /** The props the most recent live mount received, or `undefined` if none. */
  export function lastProps(): Record<string, unknown> | undefined {
    return propLedger.at(-1);
  }

  /** How many times a live probe has been mounted since the last reset. */
  export function mountCount(): number {
    return propLedger.length;
  }

  /**
   * How many times a live probe has been torn down since the last reset. The
   * live-mount attachment remounts on every control change, so after N mounts
   * with the instance still on screen the count is N - 1 (each prior instance
   * was unmounted before the next mounted). This makes the "no overlapping
   * instances" invariant assertable, not merely inferred from a DOM count.
   */
  export function unmountCount(): number {
    return unmounts;
  }

  /** Whether the props of the most recent mount were a plain object, not a proxy. */
  export function lastPropsWerePlainObject(): boolean {
    return plainObjectLedger.at(-1) ?? false;
  }

  /** Reset the ledgers; call between tests. */
  export function resetLiveProbe(): void {
    propLedger.length = 0;
    plainObjectLedger.length = 0;
    unmounts = 0;
  }
</script>

<script lang="ts">
  import { onMount } from 'svelte';

  // The live mount passes a `$state.snapshot(playgroundValues)` — a plain object.
  // Capturing the props here and recording them on mount lets the test assert
  // which prop values reached the component on each re-mount.
  const props: Record<string, unknown> = $props();

  // Record once per mount. The live-mount attachment re-mounts on every control
  // change, so one ledger entry per mount = one entry per change. The returned
  // cleanup records the matching teardown, so a test can assert mounts and
  // unmounts stay balanced (N mounts → N - 1 unmounts while still on screen).
  onMount(() => {
    // `$state.snapshot` returns a structured-clone-style plain object; a reactive
    // proxy would carry Svelte's internal symbol keys. Reflect.ownKeys surfaces
    // symbol keys, so an all-string key set is a reliable "this is a plain object"
    // signal for the test.
    const receivedSymbolKeys = Reflect.ownKeys(props).filter((key) => typeof key === 'symbol');
    propLedger.push({ ...props });
    plainObjectLedger.push(receivedSymbolKeys.length === 0);
    return () => {
      unmounts += 1;
    };
  });
</script>

<div class="live-probe" data-label={String(props['label'] ?? '')}>
  {String(props['label'] ?? '')}
</div>
