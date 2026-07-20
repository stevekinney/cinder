<script lang="ts" module>
  /**
   * @cinder
   * @category data-display
   * @status stable
   * @purpose Composite root that establishes table semantics, density, and sort context for nested header, body, row, and cell parts.
   * @tag table
   * @tag grid
   * @useWhen Comparing rows of structured records across consistent columns.
   * @useWhen Coordinating column sort state across header cells via the sort prop.
   * @avoidWhen Rendering a responsive card grid — use grid-list instead.
   * @avoidWhen Listing key-value attributes of one entity — use description-list instead.
   * @related table-header, table-body, table-row, table-cell, table-header-cell
   */
  export type {
    SortDirection,
    TableContext,
    TableDensity,
    TableHeaderSelectionContext,
    TableProps,
    TableSectionContext,
    TableSort,
  } from './table.types.ts';
</script>

<script lang="ts">
  import { setTableContext } from './table.context.ts';
  import type { TableProps } from './table.types.ts';

  import { classNames } from '../../utilities/class-names.ts';
  import { useResizeObserver } from '../../utilities/use-resize-observer.svelte.ts';

  let {
    sort = $bindable(),
    caption,
    stickyHeader = false,
    density = 'comfortable',
    selectable = false,
    scrollable = false,
    scrollContainerProps,
    class: className,
    children,
    ...rest
  }: TableProps = $props();

  const wrapperClassName = $derived(scrollContainerProps?.class);
  const wrapperAriaLabelledBy = $derived(
    normalizeOptionalAttribute(scrollContainerProps?.['aria-labelledby']),
  );
  const explicitWrapperAriaLabel = $derived(
    normalizeOptionalAttribute(scrollContainerProps?.['aria-label']),
  );
  const explicitWrapperRole = $derived(normalizeOptionalAttribute(scrollContainerProps?.role));
  const normalizedCaption = $derived(normalizeOptionalAttribute(caption));
  const wrapperAriaLabel = $derived(
    explicitWrapperAriaLabel ??
      (wrapperAriaLabelledBy
        ? undefined
        : normalizedCaption
          ? `${normalizedCaption} table scroll area`
          : undefined),
  );
  const wrapperRole = $derived(
    explicitWrapperRole ?? (wrapperAriaLabel || wrapperAriaLabelledBy ? 'region' : undefined),
  );
  const wrapperTabindex = $derived(normalizeOptionalTabindex(scrollContainerProps?.tabindex) ?? 0);

  function normalizeOptionalAttribute(value: unknown): string | undefined {
    return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
  }

  function normalizeOptionalTabindex(value: unknown): number | undefined {
    if (typeof value === 'number' && Number.isInteger(value)) return value;

    if (typeof value !== 'string') return undefined;

    const normalizedValue = value.trim();
    if (!/^-?\d+$/.test(normalizedValue)) return undefined;

    return Number(normalizedValue);
  }

  // A native <caption> (caption-side: top) renders above the table's border box
  // but inside the same scroll container, so a sticky <thead> pinned at top: 0
  // would overlap it. The caption's height is not knowable in pure CSS — `1lh`
  // would assume a single line and break when the caption wraps (narrow
  // container, long/localized text, large text settings). Measure the caption's
  // border-box block size and expose it as a custom property the sticky `top`
  // calc consumes, so the header always pins just below the real caption.
  let captionHeight = $state(0);

  // Only the sticky-header `top` calc consumes `captionHeight`, so a non-sticky
  // captioned table has no reason to run a ResizeObserver. Gate observation on
  // `stickyHeader` to avoid the work in the common case.
  const measureCaption = useResizeObserver(
    (entries) => {
      const entry = entries[0];
      if (!entry) return;
      captionHeight = entry.borderBoxSize?.[0]?.blockSize ?? entry.contentRect.height;
    },
    { box: 'border-box', enabled: () => stickyHeader },
  );

  function onsortchange(column: string): void {
    if (!sort || sort.column !== column) {
      sort = { column, direction: 'ascending' };
      return;
    }
    // Same column — toggle direction.
    sort = {
      column,
      direction: sort.direction === 'ascending' ? 'descending' : 'ascending',
    };
  }

  setTableContext({
    get sort() {
      return sort;
    },
    get selectionEnabled() {
      return selectable;
    },
    onsortchange,
  });
</script>

{#snippet table()}
  <table
    {...rest}
    class={classNames('cinder-table', className)}
    data-cinder-sticky-header={stickyHeader || undefined}
    data-cinder-density={density}
    data-cinder-selectable={selectable || undefined}
    style:--cinder-table-caption-height={normalizedCaption ? `${captionHeight}px` : undefined}
  >
    {#if normalizedCaption}
      <caption class="cinder-table__caption" {@attach measureCaption}>{normalizedCaption}</caption>
    {/if}
    {@render children()}
  </table>
{/snippet}

{#if scrollable}
  <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
  <div
    {...scrollContainerProps}
    class={classNames('cinder-table-scroll', wrapperClassName)}
    role={wrapperRole}
    aria-label={wrapperAriaLabel}
    aria-labelledby={wrapperAriaLabelledBy}
    tabindex={wrapperTabindex}
  >
    {@render table()}
  </div>
{:else}
  {@render table()}
{/if}
