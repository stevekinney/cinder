<script lang="ts" module>
  import type { HTMLAttributes } from 'svelte/elements';
  import type { Snippet } from 'svelte';

  /** Number of columns in the stat grid, or 'auto' for responsive auto-fit. */
  export type StatGroupColumns = 1 | 2 | 3 | 4 | 'auto';

  /** Visual variant for the stat group container. */
  export type StatGroupVariant = 'default' | 'cards' | 'shared-borders';

  export type StatGroupProps = Omit<HTMLAttributes<HTMLDivElement>, 'class'> & {
    /**
     * Grid column count. `'auto'` uses auto-fit with minmax for responsive layout.
     * @default 'auto'
     */
    columns?: StatGroupColumns;
    /**
     * Visual variant; surfaced as `data-cinder-variant` for CSS styling.
     * - `'default'` — plain grid, no borders or backgrounds.
     * - `'cards'` — each stat gets a card-style border and shadow.
     * - `'shared-borders'` — single outer border with 1px gap dividers between stats.
     * @default 'default'
     */
    variant?: StatGroupVariant;
    /** Stat children, typically one or more `<Stat>` components. */
    children: Snippet;
    /** Additional class names merged with `.cinder-stat-group`. */
    class?: string;
  };
</script>

<script lang="ts">
  import { classNames } from '../utilities/class-names.ts';

  let {
    columns = 'auto',
    variant = 'default',
    children,
    class: customClassName,
    ...rest
  }: StatGroupProps = $props();
</script>

<div
  {...rest}
  class={classNames('cinder-stat-group', customClassName)}
  data-cinder-variant={variant}
  data-cinder-columns={String(columns)}
>
  {@render children()}
</div>
