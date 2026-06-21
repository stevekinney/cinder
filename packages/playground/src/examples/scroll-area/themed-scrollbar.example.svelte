<script lang="ts" module>
  export const title = 'Themed scrollbar tokens';
  export const description =
    'Overrides --cinder-scrollbar-thumb and --cinder-scrollbar-thumb-hover on a wrapping surface so the native scrollbar picks up brand colors without replacing it.';
</script>

<script lang="ts">
  import { ScrollArea } from '@lostgradient/cinder/scroll-area';
</script>

<div
  style="--cinder-scrollbar-thumb: oklch(62% 0.18 264 / 0.7); --cinder-scrollbar-thumb-hover: oklch(62% 0.18 264 / 0.95);"
>
  <ScrollArea label="Release notes" maxHeight="14rem">
    <h3>0.42.0</h3>
    <p>Adds scroll-area, themed via design tokens.</p>
    <h3>0.41.0</h3>
    <p>Combobox gains rich option rows with description and avatar.</p>
    <h3>0.40.0</h3>
    <p>Form-field contract lands on input, textarea, and select.</p>
    <h3>0.39.0</h3>
    <p>Changesets adopted; provenance-enabled publishing wired up.</p>
    <h3>0.38.0</h3>
    <p>Package exports unified under cinder/* with Shiki adapter.</p>
  </ScrollArea>
</div>
