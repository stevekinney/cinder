<script lang="ts" module>
  export const title = 'Output format';
  export const description =
    'The format prop controls the emitted string syntax (hex, rgb, hsl, hwb, or oklch) for the bindable value.';
</script>

<script lang="ts">
  import { ColorPicker } from '@lostgradient/cinder/color-picker';
  import type { ColorPickerFormat } from '@lostgradient/cinder/color-picker';
  import { Select } from '@lostgradient/cinder/select';

  const formatOptions: { value: ColorPickerFormat; label: string }[] = [
    { value: 'hex', label: 'hex' },
    { value: 'rgb', label: 'rgb' },
    { value: 'hsl', label: 'hsl' },
    { value: 'hwb', label: 'hwb' },
    { value: 'oklch', label: 'oklch' },
  ];
  let selectedFormat = $state<ColorPickerFormat>('oklch');
  let current = $state('');
</script>

<div style="display: flex; flex-direction: column; gap: 0.75rem; max-width: 20rem;">
  <Select
    id="picker-format"
    bind:value={selectedFormat}
    options={formatOptions}
    label="Output format"
  />

  <ColorPicker
    value="#22c55e"
    label="Accent color"
    format={selectedFormat}
    onValueChange={(color) => {
      current = color;
    }}
  />
  {#if current}
    <p style="font-size: 0.75rem; color: var(--cinder-text-muted);">Current: {current}</p>
  {/if}
</div>
