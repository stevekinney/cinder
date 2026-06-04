<script lang="ts" module>
  export const title = 'Basic kbd';
  export const description = 'Single keys and key chords styled like physical keyboard keys.';
</script>

<script lang="ts">
  import { Kbd } from '@lostgradient/cinder/kbd';
</script>

<div class="example-preview-row" style="align-items: center;">
  <span style="display: inline-flex; gap: 0.25rem; align-items: center;">
    <Kbd label="Esc" />
  </span>

  <span style="display: inline-flex; gap: 0.25rem; align-items: center;">
    Press <Kbd label="⌘" /> + <Kbd label="K" /> to open the command palette
  </span>

  <span style="display: inline-flex; gap: 0.25rem; align-items: center;">
    <Kbd size="sm" label="Shift" /> + <Kbd size="sm" label="Tab" />
  </span>
</div>
