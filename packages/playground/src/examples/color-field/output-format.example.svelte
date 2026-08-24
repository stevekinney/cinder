<script lang="ts" module>
  export const title = 'Output format';
  export const description =
    'The format prop controls the emitted string syntax (hex, rgb, hsl, hwb, or oklch) independently of the accepted input formats.';
</script>

<script lang="ts">
  import { ColorField } from '@lostgradient/cinder/color-field';
  import type { ColorFieldOutputFormat } from '@lostgradient/cinder/color-field';

  const formats: ColorFieldOutputFormat[] = ['hex', 'rgb', 'hsl', 'hwb', 'oklch'];
  let selectedFormat = $state<ColorFieldOutputFormat>('oklch');
  let committed = $state('');
</script>

<div style="display: flex; flex-direction: column; gap: 0.5rem; max-width: 24rem;">
  <label for="color-field-output-format-select" style="font-size: 0.875rem; font-weight: 500;">
    Output format
  </label>
  <select id="color-field-output-format-select" bind:value={selectedFormat}>
    {#each formats as formatOption (formatOption)}
      <option value={formatOption}>{formatOption}</option>
    {/each}
  </select>

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
