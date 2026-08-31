# InlineConfirm

`InlineConfirm` keeps a confirmation in document flow for reversible actions. It uses a labelled `role="group"`, focuses Cancel on open, and restores focus to the trigger when dismissed.

## Usage

```svelte
<script lang="ts">
  import { InlineConfirm } from '@lostgradient/cinder/inline-confirm';
</script>

<InlineConfirm prompt="Remove this workspace?" confirmLabel="Remove workspace" open destructive />
```
