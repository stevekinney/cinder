<script lang="ts" module>
  export const title = 'Toggle group';
  export const description = 'Multiple independent toggle buttons.';
</script>

<script lang="ts">
  import { Toggle } from '../../../../src/index.ts';

  let bold = $state(false);
  let italic = $state(false);
  let underline = $state(false);
</script>

<div style="display: flex; gap: 0.5rem;">
  <Toggle id="bold" bind:pressed={bold} label="Bold" />
  <Toggle id="italic" bind:pressed={italic} label="Italic" />
  <Toggle id="underline" bind:pressed={underline} label="Underline" />
</div>
