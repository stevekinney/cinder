<script lang="ts" module>
  export type { JsonViewerProps } from './json-viewer.types.ts';
</script>

<script lang="ts">
  import type { JsonViewerProps } from './json-viewer.types.ts';
  import JsonViewerNode from '../_json-viewer-node.svelte';
  import { cn } from '../../../utilities/class-names.ts';

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
