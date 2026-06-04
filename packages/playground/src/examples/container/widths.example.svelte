<script lang="ts" module>
  export const title = 'Named width scale';
  export const description =
    'narrow, wide, and full bracket the default content width for different layouts.';
</script>

<script lang="ts">
  import { Container } from '@lostgradient/cinder/container';

  const widths = ['narrow', 'wide', 'full'] as const;
</script>

<div style="display: grid; gap: var(--cinder-space-4);">
  {#each widths as width (width)}
    <Container maxWidth={width}>
      <div
        style="padding: var(--cinder-space-4); border: 1px dashed var(--cinder-border-muted); border-radius: var(--cinder-radius-md); color: var(--cinder-text); font: var(--cinder-font-label-md);"
      >
        maxWidth="{width}"
      </div>
    </Container>
  {/each}
</div>
