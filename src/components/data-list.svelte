<script lang="ts" module>
  import type { Snippet } from 'svelte';

  export type DataListProps<T> = {
    items: T[];
    class?: string;
    children: Snippet<[T]>;
    empty?: Snippet;
  };
</script>

<script lang="ts" generics="T">
  import { cn } from '../utilities/class-names.ts';

  let { items, class: className, children, empty }: DataListProps<T> = $props();
</script>

<div class={cn('cinder-data-list', className)}>
  {#if items.length > 0}
    {#each items as entry}
      {@render children(entry)}
    {/each}
  {:else if empty}
    {@render empty()}
  {/if}
</div>
