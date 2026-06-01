<script lang="ts" module>
  export const title = 'Basic copy button';
  export const description =
    'Click to copy. The button enters a confirmation state for a brief moment.';
</script>

<script lang="ts">
  import { CopyButton } from 'cinder/copy-button';
</script>

<div class="example-preview-row" style="align-items: center;">
  <code
    style="padding: 0.25rem 0.5rem; background-color: var(--cinder-surface-inset); color: var(--cinder-text); border-radius: 4px;"
    >npx cinder install</code
  >
  <CopyButton value="npx cinder install" label="Copy install command" />
</div>
