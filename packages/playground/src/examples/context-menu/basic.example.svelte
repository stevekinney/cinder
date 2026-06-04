<script lang="ts" module>
  export const title = 'Basic context menu';
  export const description =
    'A right-click menu positioned at the pointer using dropdown menu parts.';
</script>

<script lang="ts">
  import { Button } from '@lostgradient/cinder/button';
  import { ContextMenu } from '@lostgradient/cinder';
</script>

<ContextMenu>
  <ContextMenu.Trigger>
    <Button variant="ghost">Right-click this region</Button>
  </ContextMenu.Trigger>

  <ContextMenu.Menu>
    <ContextMenu.Item onclick={() => {}}>Cut</ContextMenu.Item>
    <ContextMenu.Item onclick={() => {}}>Copy</ContextMenu.Item>
    <ContextMenu.Separator />
    <ContextMenu.Item variant="danger" onclick={() => {}}>Delete</ContextMenu.Item>
  </ContextMenu.Menu>
</ContextMenu>
