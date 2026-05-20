<script lang="ts" module>
  export const title = 'Inset divider';
  export const description = 'Horizontal rule shortened by --cinder-space-2 on each side.';
</script>

<script lang="ts">
  import { Divider } from 'cinder/divider';
</script>

<div
  style="display: flex; flex-direction: column; gap: 12px; padding: 16px; border: 1px solid var(--cinder-border-muted); border-radius: var(--cinder-radius-md);"
>
  <span>Item one</span>
  <Divider inset />
  <span>Item two</span>
  <Divider inset />
  <span>Item three</span>
</div>
