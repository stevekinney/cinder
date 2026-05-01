<script lang="ts" module>
  export const title = 'Indeterminate progress';
  export const description =
    'When value is omitted the bar loops; reduced-motion users see a static surface.';
</script>

<script lang="ts">
  import { Progress } from '../../../../components/src/index.ts';
</script>

<div style="display: flex; flex-direction: column; gap: 0.75rem;">
  <Progress />
  <Progress variant="ring" size="lg" />
</div>
