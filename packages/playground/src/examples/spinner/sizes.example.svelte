<script lang="ts" module>
  export const title = 'Spinner sizes';
  export const description = 'Small, medium, and large loading spinners.';
</script>

<script lang="ts">
  import { Spinner } from 'cinder/spinner';
</script>

<div class="example-preview-row" style="align-items: center;">
  <Spinner size="sm" label="Loading small" />
  <Spinner size="md" label="Loading medium" />
  <Spinner size="lg" label="Loading large" />
</div>
