<script lang="ts" module>
  export const title = 'Determinate progress';
  export const description = 'A progress bar with a known value out of 100.';
</script>

<script lang="ts">
  import { Progress } from 'cinder/progress';
</script>

<div style="display: flex; flex-direction: column; gap: 0.5rem;">
  <Progress value={50} />
  <Progress value={75} />
  <Progress value={100} />
</div>
