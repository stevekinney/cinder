<script lang="ts">
  import CommandItem from '../../components/command-item/command-item.svelte';
  import CommandPalette from '../../components/command-palette.svelte';

  let open = $state(true);
</script>

<CommandPalette bind:open label="Rich command palette">
  {#snippet items()}
    <CommandItem
      value="text"
      description="Add freeform text with formatting options."
      onselect={() => {}}
    >
      Text
    </CommandItem>
  {/snippet}
</CommandPalette>
