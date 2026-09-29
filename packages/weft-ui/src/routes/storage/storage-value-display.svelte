<script lang="ts">
  /**
   * Renders a raw storage value (plan §9.6: "Value display via
   * PayloadInspector — values are opaque bytes — handle non-JSON
   * gracefully"). Text values (valid UTF-8) go through `PayloadInspector`,
   * which further tells JSON from plain-string content on its own; anything
   * that fails UTF-8 decoding renders as an explicit binary fallback instead
   * of garbling through the inspector.
   */
  import { PayloadInspector } from '@lostgradient/cinder';

  import { formatBytes } from '../../lib/format/index.ts';
  import { previewStorageValue } from './value-preview.ts';

  interface StorageValueDisplayProps {
    value: Uint8Array;
    label?: string;
  }

  let { value, label = 'Value' }: StorageValueDisplayProps = $props();

  const preview = $derived(previewStorageValue(value));
</script>

{#if preview.kind === 'empty'}
  <p class="weft-storage-empty-value">Empty value (0 bytes).</p>
{:else if preview.kind === 'binary'}
  <p class="weft-storage-binary-value">
    Binary value · {formatBytes(preview.byteLength)} — not valid UTF-8, cannot be displayed as text.
  </p>
{:else}
  <PayloadInspector value={preview.text} {label} />
{/if}
