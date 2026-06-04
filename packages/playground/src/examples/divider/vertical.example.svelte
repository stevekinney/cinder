<script lang="ts" module>
  export const title = 'Vertical divider';
  export const description = 'Vertical separator between toolbar groups in a flex row.';
</script>

<script lang="ts">
  import { Divider } from '@lostgradient/cinder/divider';
</script>

<div
  style="display: inline-flex; align-items: center; gap: 8px; padding: 8px 12px; border: 1px solid var(--cinder-border-muted); border-radius: var(--cinder-radius-md);"
>
  <span>Bold</span>
  <span>Italic</span>
  <Divider orientation="vertical" />
  <span>Insert link</span>
  <span>Insert image</span>
  <Divider orientation="vertical" />
  <span>Preview</span>
</div>
