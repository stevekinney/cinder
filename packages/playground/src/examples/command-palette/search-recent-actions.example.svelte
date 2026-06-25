<script lang="ts" module>
  export const title = 'Search, recent, and keyed actions';
  export const description =
    'Cmd+K opens the palette. Three sections: filtered search results, recent items, and keyed actions separated by visual group headers.';
</script>

<script lang="ts">
  import { CommandItem } from '@lostgradient/cinder/command-item';
  import { CommandPalette } from '@lostgradient/cinder/command-palette';
  // ── State ──────────────────────────────────────────────────────────────
  let open = $state(false);
  let query = $state('');
  let lastSelected = $state('');
  let triggerRef: HTMLElement | null = $state(null);

  // ── Data ──────────────────────────────────────────────────────────────
  const allPages = [
    { id: 'dashboard', label: 'Dashboard', description: 'View product and team metrics.' },
    { id: 'settings', label: 'Settings', description: 'Manage workspace preferences.' },
    { id: 'billing', label: 'Billing', description: 'Review invoices and payment methods.' },
    { id: 'team', label: 'Team members', description: 'Invite or remove collaborators.' },
    { id: 'api-keys', label: 'API keys', description: 'Create and rotate access tokens.' },
    { id: 'integrations', label: 'Integrations', description: 'Connect external services.' },
  ];

  const recentItems = [
    { id: 'recent-dashboard', label: 'Dashboard' },
    { id: 'recent-billing', label: 'Billing' },
  ];

  const actions = [
    {
      id: 'action-new-project',
      label: 'New project',
      description: 'Create a blank project for a new body of work.',
      icon: '+',
      kbd: '⌘N',
    },
    {
      id: 'action-invite',
      label: 'Invite teammate',
      description: 'Send an invitation to join this workspace.',
      icon: '@',
      kbd: '⌘I',
    },
    {
      id: 'action-sign-out',
      label: 'Sign out',
      description: 'End this browser session.',
      icon: '↪',
      kbd: '',
    },
  ];

  // ── Filtering ──────────────────────────────────────────────────────────
  const filteredPages = $derived(
    query ? allPages.filter((p) => p.label.toLowerCase().includes(query.toLowerCase())) : [],
  );

  const filteredActions = $derived(
    query ? actions.filter((a) => a.label.toLowerCase().includes(query.toLowerCase())) : actions,
  );

  function select(label: string) {
    lastSelected = label;
    open = false;
  }

  // ── Cmd+K / Ctrl+K listener ────────────────────────────────────────────
  function handleGlobalKeydown(event: KeyboardEvent) {
    if ((event.metaKey || event.ctrlKey) && event.key === 'k') {
      event.preventDefault();
      open = true;
    }
  }
</script>

<svelte:window onkeydown={handleGlobalKeydown} />

<div style="display: flex; flex-direction: column; gap: 1rem; align-items: flex-start;">
  <button
    bind:this={triggerRef}
    type="button"
    onclick={() => (open = true)}
    style="
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.5rem 0.75rem;
      border: 1px solid var(--cinder-border);
      border-radius: var(--cinder-radius-md);
      background: var(--cinder-surface);
      color: var(--cinder-text-muted);
      font-size: 0.875rem;
      cursor: pointer;
    "
  >
    Search…
    <kbd style="font-size: 0.75rem; opacity: 0.7;">⌘K</kbd>
  </button>

  {#if lastSelected}
    <p style="font-size: 0.875rem; color: var(--cinder-text-muted);">
      Selected: <strong>{lastSelected}</strong>
    </p>
  {/if}
</div>

<CommandPalette bind:open bind:query label="Command palette" {triggerRef}>
  {#snippet items({ query: paletteQuery })}
    {@const headerBase =
      'font-size: 0.6875rem; font-weight: 600; letter-spacing: 0.05em; text-transform: uppercase; color: var(--cinder-text-muted); pointer-events: none;'}
    {@const headerFirst = 'padding: 0.625rem 1.25rem 0.375rem;'}
    {@const headerWithDivider =
      'padding: 0.625rem 1.25rem 0.375rem 1.25rem; padding-block-start: 0.625rem; margin-block-start: 0.25rem; border-block-start: 1px solid var(--cinder-border);'}
    {@const showPages = filteredPages.length > 0}
    {@const showRecent = !paletteQuery}
    {@const showActions = filteredActions.length > 0}
    <!--
      Search results section — only shown while typing.
      `paletteQuery` comes from the snippet parameter and mirrors CommandPalette's query.
      using the snippet parameter keeps the pattern explicit for consumers.
    -->
    {#if showPages}
      <li role="none" style="{headerBase} {headerFirst}">Pages</li>
      {#each filteredPages as page (page.id)}
        <CommandItem
          value={page.id}
          description={page.description}
          accessibleLabel={page.label}
          onselect={() => select(page.label)}
        >
          {page.label}
        </CommandItem>
      {/each}
    {/if}

    <!--
      Recent section — shown only when query is empty.
      Uses `role="none"` for the group label (purely visual; children remain in the AT).
    -->
    {#if showRecent}
      <li role="none" style="{headerBase} {showPages ? headerWithDivider : headerFirst}">Recent</li>
      {#each recentItems as item (item.id)}
        <CommandItem
          value={item.id}
          accessibleLabel={item.label}
          onselect={() => select(item.label)}
        >
          {item.label}
        </CommandItem>
      {/each}
    {/if}

    <!--
      Actions section — always visible (filtered when typing).
    -->
    {#if showActions}
      <li
        role="none"
        style="{headerBase} {showPages || showRecent ? headerWithDivider : headerFirst}"
      >
        Actions
      </li>
      {#each filteredActions as action (action.id)}
        <CommandItem
          value={action.id}
          description={action.description}
          accessibleLabel={action.label}
          keyboardShortcut={action.kbd === '⌘N'
            ? 'Meta+N'
            : action.kbd === '⌘I'
              ? 'Meta+I'
              : undefined}
          onselect={() => select(action.label)}
        >
          {#snippet leading()}
            <span style="font-size: 0.875rem; font-weight: 700; line-height: 1;">{action.icon}</span
            >
          {/snippet}
          {action.label}
          {#snippet trailing()}
            {#if action.kbd}
              <kbd>{action.kbd}</kbd>
            {/if}
          {/snippet}
        </CommandItem>
      {/each}
    {/if}
  {/snippet}

  {#snippet empty()}
    No results for "<strong>{query}</strong>".
  {/snippet}

  {#snippet footer()}
    <span>
      <kbd>↑↓</kbd> navigate &nbsp; <kbd>↵</kbd> select &nbsp; <kbd>Esc</kbd> close
    </span>
  {/snippet}
</CommandPalette>
