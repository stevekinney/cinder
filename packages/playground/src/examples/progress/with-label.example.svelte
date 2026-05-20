<script lang="ts" module>
  export const title = 'Progress with label';
  export const description = 'Custom label text is exposed via aria-valuetext for screen readers.';
</script>

<script lang="ts">
  import { Progress } from 'cinder/progress';
</script>

<div style="display: flex; flex-direction: column; gap: 0.4rem;">
  <span>Uploading photo (3 of 5)</span>
  <Progress value={60} label="Uploading photo, 60 percent complete" />
</div>
