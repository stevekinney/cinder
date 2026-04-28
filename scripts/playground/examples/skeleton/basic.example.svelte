<script lang="ts" module>
  export const title = 'Skeleton placeholders';
  export const description = 'Animated loading placeholders for text and avatars.';
</script>

<script lang="ts">
  import { Skeleton } from '../../../../src/index.ts';
</script>

<div style="display: flex; flex-direction: column; gap: 0.75rem;">
  <Skeleton height="1rem" width="60%" />
  <Skeleton height="1rem" width="80%" />
  <Skeleton height="1rem" width="40%" />
  <div style="display: flex; align-items: center; gap: 1rem; margin-top: 0.5rem;">
    <Skeleton width="3rem" height="3rem" radius="50%" />
    <div style="flex: 1; display: flex; flex-direction: column; gap: 0.5rem;">
      <Skeleton height="0.875rem" width="50%" />
      <Skeleton height="0.875rem" width="30%" />
    </div>
  </div>
</div>
