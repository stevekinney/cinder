<script lang="ts" module>
  export const title = 'Inline spinner';
  export const description = 'Spinner used inline alongside text.';
</script>

<script lang="ts">
  import { Spinner } from '../../../../components/src/index.ts';
</script>

<div style="display: flex; align-items: center; gap: 0.5rem;">
  <Spinner size="sm" />
  <span>Saving changes…</span>
</div>
