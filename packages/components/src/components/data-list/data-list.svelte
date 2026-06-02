<script lang="ts" module>
  /**
   * @cinder
   * @category data-display
   * @status stable
   * @purpose Semantic list container for homogeneous record rows, with a styled empty state and an optional list-level density.
   * @tag list
   * @tag iterator
   * @useWhen Rendering a vertical list of like records where each row shares the same layout.
   * @useWhen Pairing with StackedListItem rows for leading/title/description/meta/trailing content.
   * @useWhen Showing a dedicated empty state when the collection has no items.
   * @avoidWhen Presenting key-value metadata for a single entity — use description-list instead.
   * @avoidWhen Rendering tabular data with rows and columns — use table instead.
   * @related stacked-list-item, description-list, table
   */
  export type { DataListProps } from './data-list.types.ts';
</script>

<script lang="ts" generics="T">
  import { setDataListContext } from '../../_internal/data-list-context.ts';
  import { classNames } from '../../utilities/class-names.ts';
  import type { DataListProps } from './data-list.types.ts';

  let {
    items,
    key,
    density,
    class: className,
    children,
    empty,
    ...rest
  }: DataListProps<T> = $props();

  // Publish the list-level density so StackedListItem rows can inherit it. The
  // getter keeps the read reactive; `density` stays `undefined` when the
  // consumer set none, in which case each row falls back to its own default.
  setDataListContext({
    get density() {
      return density;
    },
  });
</script>

<!--
  role="list" is explicit: a `<ul>` with `list-style: none` loses its list
  semantics in Safari/VoiceOver, so the role is restated. Each child rendered by
  `children(entry)` must be an `<li>` (StackedListItem is the recommended row);
  the empty state is itself wrapped in an `<li>` so the list stays valid HTML.
-->
<ul {...rest} class={classNames('cinder-data-list', className)} role="list">
  {#if items.length > 0}
    {#if key}
      {#each items as entry (key(entry))}
        {@render children(entry)}
      {/each}
    {:else}
      {#each items as entry}
        {@render children(entry)}
      {/each}
    {/if}
  {:else if empty}
    <li class="cinder-data-list-empty">
      {@render empty()}
    </li>
  {/if}
</ul>
