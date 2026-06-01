<script lang="ts" module>
  export const title = 'Basic command palette';
  export const description = 'A minimal palette with three items opened by a button.';
</script>

<script lang="ts">
  import { Button } from 'cinder/button';
  import { CommandItem } from 'cinder/command-item';
  import { CommandPalette } from 'cinder/command-palette';

  let open = $state(false);
  let triggerRef: HTMLElement | null = $state(null);
  let lastSelected = $state('');

  const commands = [
    { value: 'new-file', label: 'New file' },
    { value: 'open-settings', label: 'Open settings' },
    { value: 'sign-out', label: 'Sign out' },
  ];

  function select(label: string) {
    lastSelected = label;
    open = false;
  }
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
  {#snippet items({ query })}
    {@const filteredCommands = commands.filter((command) =>
      command.label.toLowerCase().includes(query.toLowerCase()),
    )}
    {#each filteredCommands as command (command.value)}
      <CommandItem value={command.value} onselect={() => select(command.label)}>
        {command.label}
      </CommandItem>
    {/each}
  {/snippet}

  {#snippet empty()}
    No commands found.
  {/snippet}
</CommandPalette>
