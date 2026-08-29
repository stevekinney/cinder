<script lang="ts" module>
  export const title = 'Basic guidance region';
  export const description = 'Provide contextual guidance claims to an application surface.';
</script>

<script lang="ts">
  import { GuidanceRegion } from '@lostgradient/cinder/guidance-region';
  const claims = [{ id: 'welcome', content: 'Start by exploring the workspace.' }];
</script>

<GuidanceRegion {claims} version="1.0.0">
  {#snippet children()}
    <p>Workspace content</p>
  {/snippet}
</GuidanceRegion>
