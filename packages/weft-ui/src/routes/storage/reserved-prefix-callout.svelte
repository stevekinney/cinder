<script lang="ts">
  /**
   * Per-key reserved-prefix warning (plan §9.6: "inline input warning").
   * Renders only when `key` currently matches a `WEFT_RESERVED_KEY_PREFIXES`
   * entry — the general awareness note lives in `kv-browser.svelte`'s
   * persistent banner instead (plan's other half: "warning banner").
   */
  import { Callout } from '@lostgradient/cinder';

  import { matchedReservedPrefix } from './reserved-prefix.ts';

  interface ReservedPrefixCalloutProps {
    key: string;
  }

  let { key }: ReservedPrefixCalloutProps = $props();

  const matched = $derived(matchedReservedPrefix(key));
</script>

{#if matched !== undefined}
  <Callout variant="warning" semantic="note">
    Key uses reserved prefix <code class="weft-storage-inline-code">{matched}</code> — Weft uses this
    prefix internally, and writes here may disrupt engine recovery.
  </Callout>
{/if}
