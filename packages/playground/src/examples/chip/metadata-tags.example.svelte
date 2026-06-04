<script lang="ts" module>
  export const title = 'Metadata tags';
  export const description = 'Display-mode chips used as issue labels and free-form metadata tags.';
</script>

<script lang="ts">
  import { Chip } from '@lostgradient/cinder/chip';
</script>

<div class="example-preview-row">
  <Chip label="frontend" variant="info" />
  <Chip label="accessibility" variant="success" />
  <Chip label="needs triage" variant="warning" />
  <Chip label="customer-reported" variant="accent" />
</div>
