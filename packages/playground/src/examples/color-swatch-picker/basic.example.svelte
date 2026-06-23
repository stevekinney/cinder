<script lang="ts" module>
  export const title = 'Basic color swatch picker';
  export const description = 'Keyboard-navigable preset palette constrained to brand colors.';
</script>

<script lang="ts">
  import { ColorSwatchPicker } from '@lostgradient/cinder/color-swatch-picker';

  const palette = [
    { color: '#ef4444', name: 'Red' },
    { color: '#f97316', name: 'Orange' },
    { color: '#eab308', name: 'Yellow' },
    { color: '#22c55e', name: 'Green' },
    { color: '#3b82f6', name: 'Blue' },
    { color: '#8b5cf6', name: 'Violet' },
  ];

  let selected = $state('#3b82f6');
</script>

<ColorSwatchPicker
  colors={palette}
  value={selected}
  label="Accent color"
  onchange={(color) => (selected = color)}
/>
<p style="margin-top: 0.5rem; color: var(--cinder-text-muted);">Selected: {selected}</p>
