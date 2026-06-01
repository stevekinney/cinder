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
  import { untrack } from 'svelte';
  import CommandItem from '../../components/command-item/command-item.svelte';
  import CommandPalette from '../../components/command-palette/command-palette.svelte';

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

  let open = $state(untrack(() => initialOpen));
  let query = $state(untrack(() => initialQuery));
  let triggerRef: HTMLButtonElement | null = $state(null);

  // Filter using the value the `items` snippet receives (`{ query }`), exactly
  // like the basic/grouped playground examples do. This is the pattern the bug
  // was about — the examples previously ignored the snippet parameter — so the
  // regression tests must exercise the snippet argument, not an outer binding.
  function matching(snippetQuery: string): CommandPaletteFixtureItem[] {
    if (!filterItems) return items;
    const needle = snippetQuery.toLowerCase();
    return items.filter((item) => item.label.toLowerCase().includes(needle));
  }
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
  {#snippet items({ query: snippetQuery })}
    {#each matching(snippetQuery) as item (item.value)}
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
