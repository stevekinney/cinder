<script lang="ts" module>
  export const title = 'Chip variants';
  export const description = 'All six semantic variant styles in display mode.';
</script>

<script lang="ts">
  import { Chip } from '../../../../components/src/index.ts';
</script>

<div class="example-preview-row">
  <Chip label="Neutral" variant="neutral" />
  <Chip label="Success" variant="success" />
  <Chip label="Warning" variant="warning" />
  <Chip label="Danger" variant="danger" />
  <Chip label="Info" variant="info" />
  <Chip label="Accent" variant="accent" />
</div>
