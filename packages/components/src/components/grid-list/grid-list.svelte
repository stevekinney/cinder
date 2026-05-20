<script lang="ts" module>
  export type { GridListProps } from './grid-list.types.ts';
</script>

<script lang="ts">
  import type { GridListProps } from './grid-list.types.ts';
  import { classNames } from '../../utilities/class-names.ts';

  let { columns, class: className, children, ...rest }: GridListProps = $props();

  const minWidth = $derived(columns && columns.length > 0 ? columns : undefined);
</script>

<ul
  {...rest}
  role="list"
  class={classNames('cinder-grid-list', className)}
  style:--cinder-grid-list-min-width={minWidth}
>
  {@render children()}
</ul>
