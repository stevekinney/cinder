<script lang="ts">
  import CommandPalette from './command-palette.svelte';
  let { open }: { open: boolean } = $props();
</script>

<CommandPalette {open}>
  {#snippet items()}
    <span></span>
  {/snippet}
</CommandPalette>
