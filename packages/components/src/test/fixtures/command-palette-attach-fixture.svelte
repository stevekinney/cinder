<script lang="ts" module>
  export type CommandPaletteAttachFixtureProps = {
    /** Ordered list of item values to render. Re-key on change to remount items. */
    values?: string[];
    /** When false, the middle item is unmounted via {#if}. */
    showMiddle?: boolean;
    onSelected?: (value: string) => void;
  };
</script>

<script lang="ts">
  import CommandItem from '../../components/command-item/command-item.svelte';
  import CommandPalette from '../../components/command-palette/command-palette.svelte';

  let {
    values = ['alpha', 'beta', 'gamma'],
    showMiddle = true,
    onSelected,
  }: CommandPaletteAttachFixtureProps = $props();

  let open = $state(true);
  let query = $state('');
</script>

<CommandPalette bind:open bind:query label="Attach fixture palette">
  {#snippet items()}
    {#each values as value, index (value)}
      {#if index === 1}
        {#if showMiddle}
          <CommandItem
            {value}
            onselect={() => {
              onSelected?.(value);
            }}
          >
            {value}
          </CommandItem>
        {/if}
      {:else}
        <CommandItem
          {value}
          onselect={() => {
            onSelected?.(value);
          }}
        >
          {value}
        </CommandItem>
      {/if}
    {/each}
  {/snippet}
</CommandPalette>
