<!--
  Test-only probe standing in for a real example scenario component.

  It mirrors what a bundled scenario does — render some markup into the
  per-scenario container — while recording its own mount/unmount lifecycle on a
  shared module-level ledger. The mount-effect under test (see
  `component-page-mount-fixture.svelte`) mounts these into independent Svelte
  trees, so the ledger lets a test assert mount/unmount count parity and detect
  orphaned trees across rapid effect re-runs.
-->
<script lang="ts" module>
  /** A mount/unmount tally keyed by scenario id, shared across probe instances. */
  export type ProbeLedger = {
    mounts: number;
    unmounts: number;
    /** Live count = mounts - unmounts; must return to 0 after teardown. */
    live: number;
  };

  const ledgers = new Map<string, ProbeLedger>();

  /** Read (creating if absent) the ledger for a scenario id. */
  export function ledgerFor(scenario: string): ProbeLedger {
    let ledger = ledgers.get(scenario);
    if (!ledger) {
      ledger = { mounts: 0, unmounts: 0, live: 0 };
      ledgers.set(scenario, ledger);
    }
    return ledger;
  }

  /** Sum of `live` counts across every scenario — non-zero means orphaned trees. */
  export function totalLive(): number {
    let total = 0;
    for (const ledger of ledgers.values()) total += ledger.live;
    return total;
  }

  /** Reset every ledger; call between tests. */
  export function resetLedgers(): void {
    ledgers.clear();
  }
</script>

<script lang="ts">
  import { onMount } from 'svelte';

  // The mount-effect under test mounts registry components with `{ target }`
  // only — no props — so the probe self-identifies from the
  // `example-mount-<scenario>` container it is mounted into, keeping the
  // fixture's mount call byte-for-byte faithful to component-page.svelte.
  let host = $state<HTMLDivElement | null>(null);

  onMount(() => {
    if (host === null) return;
    const scenario = host.parentElement?.id.replace(/^example-mount-/, '') ?? '';
    const ledger = ledgerFor(scenario);
    ledger.mounts += 1;
    ledger.live += 1;
    return () => {
      ledger.unmounts += 1;
      ledger.live -= 1;
    };
  });
</script>

<div class="scenario-probe" bind:this={host}>probe</div>
