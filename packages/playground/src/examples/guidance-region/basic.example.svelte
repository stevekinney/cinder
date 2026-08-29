<script lang="ts" module>
  export const title = 'Basic guidance region';
  export const description = 'Provide contextual guidance claims to an application surface.';
</script>

<script lang="ts">
  import { Button } from '@lostgradient/cinder/button';
  import { GuidanceRegion, type GuidanceClaim } from '@lostgradient/cinder/guidance-region';

  const claims = [
    { id: 'welcome', anchor: 'workspace-start', content: 'Start by exploring the workspace.' },
  ] satisfies GuidanceClaim[];
  let anchor: HTMLElement;
</script>

<GuidanceRegion {claims} version="1.0.0" anchorResolver={() => anchor}>
  {#snippet children()}
    <span bind:this={anchor}><Button>Explore workspace</Button></span>
  {/snippet}
</GuidanceRegion>
