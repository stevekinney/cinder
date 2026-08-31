# GuidanceRegion

`GuidanceRegion` provides a context-scoped claim registry. Claims are filtered by version windows and can be dismissed or reset through a consumer-owned storage adapter.

## Usage

```svelte
<script lang="ts">
  import { Button } from '@lostgradient/cinder/button';
  import {
    GuidanceRegion,
    type GuidanceClaim,
    useGuidance,
  } from '@lostgradient/cinder/guidance-region';

  const claims = [
    { id: 'welcome', anchor: 'workspace-start', content: 'Start by exploring the workspace.' },
  ] satisfies GuidanceClaim[];
  let anchor: HTMLElement;
</script>

<GuidanceRegion {claims} version="1.0.0" anchorResolver={() => anchor}>
  {#snippet children()}
    {@const guidance = useGuidance()}
    <span bind:this={anchor}>
      <Button onclick={() => guidance.claim('welcome')}>Show welcome guidance</Button>
    </span>
  {/snippet}
</GuidanceRegion>
```
