<script lang="ts" module>
  export const title = 'Basic inline confirmation';
  export const description = 'Confirm a destructive action without leaving the current flow.';
</script>

<script lang="ts">
  import { InlineConfirm } from '@lostgradient/cinder/inline-confirm';
</script>

<InlineConfirm prompt="Remove this workspace?" confirmLabel="Remove workspace" open destructive />
