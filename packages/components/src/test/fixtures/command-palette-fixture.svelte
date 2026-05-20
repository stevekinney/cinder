<script lang="ts" module>
  export type CommandPaletteFixtureItem = {
    value: string;
    label: string;
    disabled?: boolean;
  };

  export type CommandPaletteFixtureProps = {
    initialOpen?: boolean;
    initialQuery?: string;
    items?: CommandPaletteFixtureItem[];
    filterItems?: boolean;
    onClosed?: () => void;
    onSelected?: (value: string) => void;
  };
</script>

<script lang="ts">
  import CommandItem from '../../components/command-item/command-item.svelte';
  import CommandPalette from '../../components/command-palette.svelte';

  let {
    initialOpen = true,
    initialQuery = '',
    items = [
      { value: 'alpha', label: 'Alpha' },
      { value: 'beta', label: 'Beta', disabled: true },
      { value: 'gamma', label: 'Gamma' },
    ],
    filterItems = false,
    onClosed,
    onSelected,
  }: CommandPaletteFixtureProps = $props();

  let open = $state(initialOpen);
  let query = $state(initialQuery);
  let triggerRef: HTMLButtonElement | null = $state(null);

  const visibleItems = $derived(
    filterItems
      ? items.filter((item) => item.label.toLowerCase().includes(query.toLowerCase()))
      : items,
  );
</script>

<button
  bind:this={triggerRef}
  type="button"
  data-testid="command-palette-trigger"
  onclick={() => {
    open = true;
  }}
>
  Open
</button>

<button
  type="button"
  data-testid="command-palette-external-close"
  onclick={() => {
    open = false;
  }}
>
  Close
</button>

<button
  type="button"
  data-testid="command-palette-query-z"
  onclick={() => {
    query = 'z';
  }}
>
  Query z
</button>

<button
  type="button"
  data-testid="command-palette-query-a"
  onclick={() => {
    query = 'a';
  }}
>
  Query a
</button>

<CommandPalette
  bind:open
  bind:query
  label="Fixture palette"
  {triggerRef}
  {...onClosed !== undefined ? { onclose: onClosed } : {}}
>
  {#snippet items()}
    {#each visibleItems as item (item.value)}
      <CommandItem
        value={item.value}
        {...item.disabled !== undefined ? { disabled: item.disabled } : {}}
        onselect={() => {
          onSelected?.(item.value);
        }}
      >
        {item.label}
      </CommandItem>
    {/each}
  {/snippet}

  {#snippet empty()}
    No results
  {/snippet}
</CommandPalette>
