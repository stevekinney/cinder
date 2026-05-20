<script lang="ts" module>
  export const title = 'Basic diff statistics';
  export const description = 'Line-change counts with semantic colors.';
</script>

<script lang="ts">
  import { DiffStatistics } from 'cinder/diff-statistics';
</script>

<div style="display: grid; gap: 0.75rem;">
  <DiffStatistics added={12} removed={4} modified={3} />
  <DiffStatistics added={12} removed={0} modified={0} variant="compact" hideZero />
</div>
