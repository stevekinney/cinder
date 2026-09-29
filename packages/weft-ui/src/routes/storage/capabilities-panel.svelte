<script lang="ts">
  /**
   * Capabilities panel (plan §9.6; design `Weft UI.dc.html` STORAGE
   * "stCaps"): `DescriptionList` with persistence badge + durable-recovery
   * checklist.
   *
   * **What's real vs. what's honestly unavailable.** Weft has no operation
   * exposing `Storage.capabilities()` over the wire at all (verified against
   * the full v0.11.0 operation catalog) — filed upstream:
   * https://github.com/stevekinney/weft/issues/727. Fabricating
   * persistence/consistency/durable-recovery-checklist values with no wire
   * signal would be placeholder content presented as fact, so this panel
   * shows only what a remote client can actually establish today:
   *   - **Batch operations**: always supported — `weft.storage.batch`
   *     applies its operations unconditionally, no capability gate exists
   *     on that route (`storageBatchOperation.invoke` in
   *     `src/server/operations/storage.ts`).
   *   - **Conditional batch**: from the `conditionalBatchSupported` probe
   *     result passed in by `index.svelte` (see `storage-client.ts`'s
   *     `probeConditionalBatchSupported` doc comment).
   * Persistence, read-after-write, scan consistency, atomic-batch, and the
   * durable-recovery checklist (`assertDurableStorageForRecovery`'s five
   * checks) all require that missing operation — the banner below says so
   * rather than guessing.
   */
  import { Badge, Callout, DescriptionList } from '@lostgradient/cinder';

  interface CapabilitiesPanelProps {
    conditionalBatchSupported: boolean | undefined;
  }

  let { conditionalBatchSupported }: CapabilitiesPanelProps = $props();
</script>

{#snippet conditionalBatchBadge()}
  {#if conditionalBatchSupported === undefined}
    <Badge variant="neutral">checking…</Badge>
  {:else if conditionalBatchSupported}
    <Badge variant="success">supported</Badge>
  {:else}
    <Badge variant="neutral">not supported</Badge>
  {/if}
{/snippet}

{#snippet batchBadge()}
  <Badge variant="success">supported</Badge>
{/snippet}

<div class="weft-storage-capabilities">
  <DescriptionList
    items={[
      { term: 'Batch operations', definition: batchBadge },
      { term: 'Conditional batch', definition: conditionalBatchBadge },
    ]}
  />
  <Callout variant="info" semantic="note">
    Persistence, consistency guarantees, and the durable-recovery checklist require a server-side
    capability-introspection operation that doesn't exist yet — filed as
    <a href="https://github.com/stevekinney/weft/issues/727" target="_blank" rel="noreferrer"
      >weft#727</a
    >. This panel shows only what the client can establish without it.
  </Callout>
</div>
