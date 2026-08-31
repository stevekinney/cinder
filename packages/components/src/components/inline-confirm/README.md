# InlineConfirm

`InlineConfirm` keeps a confirmation in document flow for reversible actions. It uses a labelled `role="group"`, focuses Cancel on open, and restores focus to the trigger when dismissed.

## Usage

```svelte
<script lang="ts">
  import { Button } from '@lostgradient/cinder/button';
  import { InlineConfirm } from '@lostgradient/cinder/inline-confirm';

  let open = $state(false);

  function removeWorkspace() {
    open = false;
  }
</script>

<Button variant="danger" onclick={() => (open = true)}>Remove workspace</Button>
<InlineConfirm
  prompt="Remove this workspace?"
  confirmLabel="Remove workspace"
  bind:open
  destructive
  onConfirm={removeWorkspace}
/>
```
