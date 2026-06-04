<script lang="ts" module>
  export const title = 'Inline spinner';
  export const description = 'Spinner used inline alongside text.';
</script>

<script lang="ts">
  import { Spinner } from '@lostgradient/cinder/spinner';
</script>

<div class="example-preview-row" style="align-items: center; gap: 0.5rem;">
  <Spinner size="sm" />
  <span>Saving changes…</span>
</div>
