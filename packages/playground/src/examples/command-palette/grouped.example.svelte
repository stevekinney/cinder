<script lang="ts" module>
  export const title = 'Grouped command palette';
  export const description = 'Command items grouped with named listbox sections.';
</script>

<script lang="ts">
  import { Button } from 'cinder/button';
  import { CommandItem } from 'cinder/command-item';
  import { CommandPalette } from 'cinder/command-palette';

  let open = $state(false);
  let triggerRef: HTMLElement | null = $state(null);
  let lastSelected = $state('');

  const recentItems = [
    { id: 'roadmap', label: 'Roadmap' },
    { id: 'release-notes', label: 'Release notes' },
  ];

  const actions = [
    { id: 'new-project', label: 'New project', description: 'Create a workspace project.' },
    { id: 'invite-teammate', label: 'Invite teammate', description: 'Add a collaborator.' },
    { id: 'open-settings', label: 'Open settings', description: 'Manage preferences.' },
  ];

  function select(label: string) {
    lastSelected = label;
    open = false;
  }

  function matchesQuery(label: string, query: string): boolean {
    return label.toLowerCase().includes(query.toLowerCase());
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
    <p style="margin: 0; color: var(--cinder-text-muted); font-size: var(--cinder-text-sm);">
      Selected: <strong>{lastSelected}</strong>
    </p>
  {/if}
</div>

<CommandPalette bind:open label="Grouped command palette" {triggerRef}>
  {#snippet items({ query })}
    {@const filteredRecentItems = recentItems.filter((item) => matchesQuery(item.label, query))}
    {@const filteredActions = actions.filter((action) => matchesQuery(action.label, query))}

    {#if filteredRecentItems.length > 0}
      <li role="presentation" class="cinder-command-group">
        <span class="cinder-command-group__label">Recent files</span>
        <ul role="group" aria-label="Recent files">
          {#each filteredRecentItems as item (item.id)}
            <CommandItem value={item.id} onselect={() => select(item.label)}>
              {item.label}
            </CommandItem>
          {/each}
        </ul>
      </li>
    {/if}

    {#if filteredActions.length > 0}
      <li role="presentation" class="cinder-command-group">
        <span class="cinder-command-group__label">Actions</span>
        <ul role="group" aria-label="Actions">
          {#each filteredActions as action (action.id)}
            <CommandItem
              value={action.id}
              description={action.description}
              onselect={() => select(action.label)}
            >
              {action.label}
            </CommandItem>
          {/each}
        </ul>
      </li>
    {/if}
  {/snippet}

  {#snippet empty()}
    No commands found.
  {/snippet}
</CommandPalette>
