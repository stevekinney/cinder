<script lang="ts" module>
  export const title = 'Flush body (padding="none")';
  export const description =
    'Pass padding="none" to remove the body padding for full-bleed content such as an image or a data table.';
</script>

<script lang="ts">
  import { Card } from '@lostgradient/cinder/card';
</script>

<Card title="Full-bleed image card" padding="none">
  <div
    style="min-block-size: 8rem; background: var(--cinder-surface-inset); border-top: 1px solid var(--cinder-border-muted); display: flex; align-items: center; justify-content: center; color: var(--cinder-text-subtle); font-size: var(--cinder-text-sm);"
  >
    full-bleed content area
  </div>
</Card>
