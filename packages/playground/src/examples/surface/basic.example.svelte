<script lang="ts" module>
  export const title = 'Basic surface';
  export const description = 'Tone variants for framed interface regions.';
</script>

<script lang="ts">
  import { Surface } from '@lostgradient/cinder/surface';
</script>

<div style="display: grid; gap: 0.75rem;">
  <Surface style="padding: 1rem;">
    <strong>Default</strong>
    <p style="margin: 0.35rem 0 0; color: var(--cinder-text-muted);">Standard content surface.</p>
  </Surface>

  <Surface tone="raised" style="padding: 1rem;">
    <strong>Raised</strong>
    <p style="margin: 0.35rem 0 0; color: var(--cinder-text-muted);">
      Elevated surface for overlays and panels.
    </p>
  </Surface>

  <Surface tone="inset" style="padding: 1rem;">
    <strong>Inset</strong>
    <p style="margin: 0.35rem 0 0; color: var(--cinder-text-muted);">
      Quiet container for nested content.
    </p>
  </Surface>
</div>
