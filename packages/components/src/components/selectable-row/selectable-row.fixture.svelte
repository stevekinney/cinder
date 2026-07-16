<script lang="ts">
  import SelectableRow from './selectable-row.svelte';

  let { onPrimary, onRename, onOpenExternal } = $props<{
    onPrimary: () => void;
    onRename: () => void;
    onOpenExternal: (event: MouseEvent) => void;
  }>();
</script>

<SelectableRow onclick={onPrimary} selected>
  {#snippet leading()}<span aria-hidden="true">●</span>{/snippet}
  {#snippet title()}A deliberately long session title that must wrap within the row{/snippet}
  {#snippet description()}Session description{/snippet}
  {#snippet meta()}Running · Updated now{/snippet}
  {#snippet trailingActions()}
    <button type="button" onclick={onRename}>Rename</button>
    <a href="https://example.com/session" onclick={onOpenExternal}>Open externally</a>
  {/snippet}
</SelectableRow>
