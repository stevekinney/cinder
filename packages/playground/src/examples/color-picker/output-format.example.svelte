<script lang="ts" module>
  export const title = 'Output format';
  export const description =
    'The format prop controls the emitted string syntax (hex, rgb, hsl, hwb, or oklch) for the bindable value.';
</script>

<script lang="ts">
  import { ColorPicker } from '@lostgradient/cinder/color-picker';
  import type { ColorPickerFormat } from '@lostgradient/cinder/color-picker';

  const formats: ColorPickerFormat[] = ['hex', 'rgb', 'hsl', 'hwb', 'oklch'];
  let selectedFormat = $state<ColorPickerFormat>('oklch');
  let current = $state('');
</script>

<div style="display: flex; flex-direction: column; gap: 0.75rem; max-width: 20rem;">
  <label for="picker-format" style="font-size: 0.875rem; font-weight: 500;"> Output format </label>
  <select id="picker-format" bind:value={selectedFormat}>
    {#each formats as formatOption (formatOption)}
      <option value={formatOption}>{formatOption}</option>
    {/each}
  </select>

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
