<script lang="ts" module>
  export const title = 'Icon-only / inline row';
  export const description =
    'In a toolbar or table row where the meaning is already clear from context, hideLabel removes the visible text while keeping it as the accessible name.';
</script>

<script lang="ts">
  import { Toggle } from 'cinder/toggle';

  let wordWrap = $state(true);
  let minimap = $state(false);
</script>

<div
  role="toolbar"
  aria-label="Editor options"
  style="display: flex; align-items: center; gap: 1rem;"
>
  <Toggle id="opt-wrap" bind:checked={wordWrap} label="Word wrap" hideLabel />
  <Toggle id="opt-minimap" bind:checked={minimap} label="Minimap" hideLabel />
</div>
