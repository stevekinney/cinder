<script lang="ts" module>
  export const title = 'Determinate progress';
  export const description = 'A progress bar with a known value out of 100.';
</script>

<script lang="ts">
  import { Progress } from '@lostgradient/cinder/progress';
</script>

<div style="display: flex; flex-direction: column; gap: 0.5rem;">
  <Progress value={50} ariaLabel="File upload: 50% complete" />
  <Progress value={75} ariaLabel="File upload: 75% complete" />
  <Progress value={100} ariaLabel="File upload: 100% complete" />
</div>
