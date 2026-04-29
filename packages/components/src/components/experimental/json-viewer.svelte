<script lang="ts" module>
  /**
   * EXPERIMENTAL — JSON Viewer API may change between minor versions.
   *
   * Collapsible tree visualization of a JSON value. Hard caps from
   * COMPONENT-COVERAGE-PLAN.md:
   *
   * - Synchronous render only — no virtualization, no chunking.
   * - Payloads larger than `maxBytes` (default 1MB serialized) render a
   *   fallback with copy/download actions instead of attempting the tree.
   * - Maximum nested depth `maxDepth` (default 50). Deeper nodes render
   *   "…" with a hint to inspect via a different tool.
   *
   * Consumers needing more (search, filter, virtualization, schema-aware
   * rendering) should compose their own viewer.
   */
  export type JsonViewerProps = {
    /** The value to render. Any JSON-serializable structure. */
    value: unknown;
    /** Initial collapse depth. Nodes deeper than this start collapsed. Default 1. */
    initialDepth?: number;
    /** Hard depth cap. Nodes deeper than this never render their children. Default 50. */
    maxDepth?: number;
    /** Hard byte cap on the serialized payload. Default 1_048_576 (1 MB). */
    maxBytes?: number;
    /** Additional class names merged with `.cinder-json-viewer`. */
    class?: string;
  };
</script>

<script lang="ts">
  import JsonViewerNode from './_json-viewer-node.svelte';
  import { cn } from '../../utilities/class-names.ts';

  let {
    value,
    initialDepth = 1,
    maxDepth = 50,
    maxBytes = 1_048_576,
    class: className,
  }: JsonViewerProps = $props();

  // Compute serialized size up front so we can short-circuit oversized
  // payloads before walking the tree.
  const serializedSize = $derived.by(() => {
    try {
      return new Blob([JSON.stringify(value)]).size;
    } catch {
      return Number.POSITIVE_INFINITY;
    }
  });

  const tooLarge = $derived(serializedSize > maxBytes);
</script>

<div class={cn('cinder-json-viewer', className)}>
  {#if tooLarge}
    <div class="cinder-json-viewer__fallback" role="status">
      <p>
        Payload too large to render (~{Math.round(serializedSize / 1024)} KB; cap is {Math.round(
          maxBytes / 1024,
        )} KB).
      </p>
      <p>Use the consumer's download or copy action to inspect the raw JSON.</p>
    </div>
  {:else}
    <JsonViewerNode {value} depth={0} {initialDepth} {maxDepth} />
  {/if}
</div>
