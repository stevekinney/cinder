<script lang="ts" module>
  export const title = 'Basic copy button';
  export const description =
    'Click to copy. The button enters a confirmation state for a brief moment.';
</script>

<script lang="ts">
  import { CopyButton } from '../../../../components/src/index.ts';
</script>

<div class="example-preview-row" style="align-items: center;">
  <code style="padding: 0.25rem 0.5rem; background: #f4f4f4; border-radius: 4px;"
    >npx cinder install</code
  >
  <CopyButton value="npx cinder install" label="Copy install command" />
</div>
