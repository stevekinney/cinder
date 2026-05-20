<script lang="ts" module>
  export type { DataListProps } from './data-list.types.ts';
</script>

<script lang="ts" generics="T">
  import { cn } from '../../utilities/class-names.ts';
  import type { DataListProps } from './data-list.types.ts';

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
