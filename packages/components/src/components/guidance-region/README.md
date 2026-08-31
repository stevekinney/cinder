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
</script>

<GuidanceRegion
  {claims}
  version="1.0.0"
  anchorResolver={() => document.getElementById('workspace-start')}
>
  {#snippet children()}
    {@const guidance = useGuidance()}
    <Button id="workspace-start" onclick={() => guidance.claim('welcome')}>
      Show welcome guidance
    </Button>
  {/snippet}
</GuidanceRegion>
```
