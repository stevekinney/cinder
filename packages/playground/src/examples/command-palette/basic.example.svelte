<script lang="ts" module>
  export const title = 'Basic command palette';
  export const description = 'A minimal palette with three items opened by a button.';
</script>

<script lang="ts">
  import { Button, CommandItem, CommandPalette } from '../../../../components/src/index.ts';

  let open = $state(false);
  let triggerRef: HTMLElement | null = $state(null);
  let lastSelected = $state('');
</script>

<div style="display: flex; flex-direction: column; gap: 1rem; align-items: flex-start;">
  <Button
    label="Open palette"
    onclick={(event) => {
      triggerRef = event.currentTarget as HTMLElement;
      open = true;
    }}
  />

  {#if lastSelected}
    <p style="font-size: 0.875rem; color: var(--cinder-text-muted);">
      Selected: <strong>{lastSelected}</strong>
    </p>
  {/if}
</div>

<CommandPalette bind:open label="Basic palette" {triggerRef}>
  {#snippet items()}
    <CommandItem
      value="new-file"
      onselect={() => {
        lastSelected = 'New file';
        open = false;
      }}
    >
      New file
    </CommandItem>
    <CommandItem
      value="open-settings"
      onselect={() => {
        lastSelected = 'Open settings';
        open = false;
      }}
    >
      Open settings
    </CommandItem>
    <CommandItem
      value="sign-out"
      onselect={() => {
        lastSelected = 'Sign out';
        open = false;
      }}
    >
      Sign out
    </CommandItem>
  {/snippet}

  {#snippet empty()}
    No commands found.
  {/snippet}
</CommandPalette>
