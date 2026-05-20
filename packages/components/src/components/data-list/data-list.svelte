<script lang="ts" module>
  /**
   * @cinder
   * @category data-display
   * @status stable
   * @purpose Generic iterator that renders a typed collection through a consumer-supplied row snippet with empty-state fallback.
   * @tag list
   * @tag iterator
   * @useWhen Mapping a homogenous array of records to identical row markup defined by the caller.
   * @useWhen Showing a dedicated empty state when the collection has no items.
   * @avoidWhen Presenting key-value metadata for a single entity — use description-list instead.
   * @avoidWhen Rendering tabular data with rows and columns — use table instead.
   * @related description-list, table, stacked-list-item
   */
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
