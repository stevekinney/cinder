<script lang="ts" module>
  /**
   * @cinder
   * @category layout
   * @status beta
   * @purpose Optional placement child for Grid that controls column and row spans or explicit track placement.
   * @tag layout
   * @tag grid
   * @useWhen A child in a grid needs to span tracks or start at a specific track.
   * @avoidWhen Every child can use default grid auto-placement - render plain children inside Grid instead. | grid
   * @related grid
   */
  export type { GridItemProps } from './grid-item.types.ts';
</script>

<script lang="ts">
  import { classNames } from '../../utilities/class-names.ts';
  import type { GridItemProps } from './grid-item.types.ts';

  let {
    span,
    columnStart,
    columnEnd,
    rowSpan,
    rowStart,
    rowEnd,
    as = 'div',
    class: customClassName,
    children,
    ...rest
  }: GridItemProps = $props();

  /**
   * Normalizes an explicit grid-line placement value (`columnStart`,
   * `columnEnd`, `rowStart`, `rowEnd`). A numeric grid line of `0` or a
   * non-integer isn't a valid CSS grid line, matching the `integer, not: {
   * const: 0 }` constraint these props carry in the generated schema — the
   * runtime should refuse the same inputs the schema does. An empty string
   * is likewise treated as "not provided" rather than passed through.
   */
  function normalizedLineValue(value: number | string | undefined): string | undefined {
    if (value === undefined) return undefined;
    if (typeof value === 'number') {
      return Number.isInteger(value) && value !== 0 ? String(value) : undefined;
    }
    return value !== '' ? value : undefined;
  }

  /**
   * Normalizes a track-span count (`span`, `rowSpan`). The generated schema
   * promises numeric values are `integer, minimum: 1` (strings pass through); the runtime should refuse the same
   * inputs — an empty string, `0`, or a non-integer would otherwise
   * stringify straight onto the element (e.g. `grid-column-end: span `,
   * `span 0`, or `span 1.5`), none of which are valid CSS.
   */
  function normalizedSpanValue(value: number | string | undefined): string | undefined {
    if (value === undefined) return undefined;
    if (typeof value === 'number') {
      return Number.isInteger(value) && value >= 1 ? String(value) : undefined;
    }
    return value !== '' ? value : undefined;
  }

  const columnSpan = $derived(normalizedSpanValue(span));
  const resolvedColumnStart = $derived(normalizedLineValue(columnStart));
  const resolvedColumnEnd = $derived(normalizedLineValue(columnEnd));
  const resolvedRowSpan = $derived(normalizedSpanValue(rowSpan));
  const resolvedRowStart = $derived(normalizedLineValue(rowStart));
  const resolvedRowEnd = $derived(normalizedLineValue(rowEnd));
  const shouldApplyColumnSpan = $derived(
    columnSpan !== undefined && resolvedColumnEnd === undefined,
  );
  const shouldApplyRowSpan = $derived(
    resolvedRowSpan !== undefined && resolvedRowEnd === undefined,
  );
  // Custom properties inherit through the DOM, so an outer Grid.Item's
  // --cinder-grid-item-row-end would otherwise leak into a nested Grid's
  // items that omit rowEnd (Svelte's style: directive simply skips setting
  // the property when the bound value is undefined, leaving inheritance to
  // take over). Always declaring the property locally — explicit `auto`
  // when rowEnd is unset — means this element's own value never falls
  // through to an ancestor's.
  const declaredRowEnd = $derived(resolvedRowEnd ?? 'auto');
</script>

<svelte:element
  this={as}
  {...rest}
  class={classNames('cinder-grid-item', customClassName)}
  data-cinder-column-span={shouldApplyColumnSpan ? 'true' : undefined}
  data-cinder-row-span={shouldApplyRowSpan ? 'true' : undefined}
  style:--cinder-grid-item-column-span={columnSpan}
  style:--cinder-grid-item-column-start={resolvedColumnStart}
  style:--cinder-grid-item-column-end={resolvedColumnEnd}
  style:--cinder-grid-item-row-span={resolvedRowSpan}
  style:--cinder-grid-item-row-start={resolvedRowStart}
  style:--cinder-grid-item-row-end={declaredRowEnd}
>
  {@render children?.()}
</svelte:element>
