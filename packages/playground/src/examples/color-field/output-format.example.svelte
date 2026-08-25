<script lang="ts" module>
  export const title = 'Output format';
  export const description =
    'The format prop controls the emitted string syntax (hex, rgb, hsl, hwb, or oklch). The selected output format is always implicitly accepted on input too, regardless of what the formats prop lists.';
</script>

<script lang="ts">
  import { ColorField } from '@lostgradient/cinder/color-field';
  import type { ColorFieldOutputFormat } from '@lostgradient/cinder/color-field';
  import { Select } from '@lostgradient/cinder/select';

  const formatOptions: { value: ColorFieldOutputFormat; label: string }[] = [
    { value: 'hex', label: 'hex' },
    { value: 'rgb', label: 'rgb' },
    { value: 'hsl', label: 'hsl' },
    { value: 'hwb', label: 'hwb' },
    { value: 'oklch', label: 'oklch' },
  ];
  let selectedFormat = $state<ColorFieldOutputFormat>('oklch');
  let committed = $state('');
</script>

<div style="display: flex; flex-direction: column; gap: 0.5rem; max-width: 24rem;">
  <Select
    id="color-field-output-format-select"
    bind:value={selectedFormat}
    options={formatOptions}
    label="Output format"
  />

  <label for="color-field-output-format" style="font-size: 0.875rem; font-weight: 500;">
    Brand color
  </label>
  <ColorField
    id="color-field-output-format"
    value="#3b82f6"
    format={selectedFormat}
    onValueChange={(value) => {
      committed = value;
    }}
  />
  {#if committed}
    <p style="font-size: 0.75rem; color: var(--cinder-text-muted);">Committed: {committed}</p>
  {/if}
</div>
