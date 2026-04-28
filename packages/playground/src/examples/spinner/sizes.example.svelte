<script lang="ts" module>
  export const title = 'Spinner sizes';
  export const description = 'Small, medium, and large loading spinners.';
</script>

<script lang="ts">
  import { Spinner } from '../../../../components/src/index.ts';
</script>

<div style="display: flex; align-items: center; gap: 1.5rem;">
  <Spinner size="sm" label="Loading small" />
  <Spinner size="md" label="Loading medium" />
  <Spinner size="lg" label="Loading large" />
</div>
