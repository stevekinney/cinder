<script lang="ts" module>
  export const title = 'Spinner sizes';
  export const description = 'Small, medium, and large loading spinners in both treatments.';
</script>

<script lang="ts">
  import { Spinner } from '@lostgradient/cinder/spinner';
</script>

<div class="example-preview-row" style="align-items: center;">
  <Spinner size="sm" label="Loading small" />
  <Spinner size="md" label="Loading medium" />
  <Spinner size="lg" label="Loading large" />
  <Spinner size="sm" variant="arc" label="Loading small arc" />
  <Spinner size="md" variant="arc" label="Loading medium arc" />
  <Spinner size="lg" variant="arc" label="Loading large arc" />
</div>
