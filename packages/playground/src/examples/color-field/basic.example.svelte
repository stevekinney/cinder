<script lang="ts" module>
  export const title = 'Basic color field';
  export const description =
    'An uncontrolled color field that accepts hex, rgb(), and hsl() strings and normalizes them to hex on commit.';
</script>

<script lang="ts">
  import { ColorField } from '@lostgradient/cinder/color-field';

  let committed = $state('');
</script>

<div style="display: flex; flex-direction: column; gap: 0.5rem; max-width: 20rem;">
  <label for="color-field-basic" style="font-size: 0.875rem; font-weight: 500;">
    Brand color
  </label>
  <ColorField
    id="color-field-basic"
    defaultValue="#3b82f6"
    onchange={(value) => {
      committed = value;
    }}
  />
  {#if committed}
    <p style="font-size: 0.75rem; color: var(--cinder-text-muted);">Committed: {committed}</p>
  {/if}
</div>
