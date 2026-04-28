<script lang="ts" module>
  export type PaginationProps = {
    /** Current page number (1-indexed). Bindable. */
    currentPage: number;
    /** Total number of pages. */
    totalPages: number;
    /** Optional total record count; formatted with formatNumber when provided. */
    totalCount?: number;
    /** Custom class merged with `.cinder-pagination`. */
    class?: string;
  };
</script>

<script lang="ts">
  import { classNames } from '../utilities/class-names.ts';
  import { formatNumber } from '../utilities/format-number.ts';

  let {
    currentPage = $bindable(1),
    totalPages,
    totalCount,
    class: customClassName,
  }: PaginationProps = $props();

  const mergedClassName = $derived(classNames('cinder-pagination', customClassName));

  const canGoPrevious = $derived(currentPage > 1);
  const canGoNext = $derived(currentPage < totalPages);

  /**
   * Build the list of page items to render.
   *
   * Strategy: always show pages 1, totalPages, and the current page window
   * (currentPage ± 1). Fill gaps with ellipses. For small page counts
   * (≤ 7) render every page without ellipses to keep the control legible.
   */
  type PageItem = number | 'ellipsis-start' | 'ellipsis-end';

  const pageItems = $derived.by((): PageItem[] => {
    if (totalPages <= 1) return [];

    // For small ranges, show every page.
    if (totalPages <= 7) {
      const pages: PageItem[] = [];
      for (let index = 1; index <= totalPages; index++) pages.push(index);
      return pages;
    }

    const items = new Set<number>();
    // Always include boundary pages.
    items.add(1);
    items.add(totalPages);
    // Include a window around the current page.
    for (
      let index = Math.max(1, currentPage - 1);
      index <= Math.min(totalPages, currentPage + 1);
      index++
    ) {
      items.add(index);
    }

    const sorted = Array.from(items).sort((left, right) => left - right);

    const result: PageItem[] = [];
    for (let index = 0; index < sorted.length; index++) {
      const current = sorted[index] as number;
      const previous = sorted[index - 1] as number | undefined;

      if (index > 0 && previous !== undefined) {
        const gap = current - previous;
        if (gap === 2) {
          // A gap of exactly 2 means there is a single page between them — render it directly
          // rather than inserting an ellipsis that would hide just one number.
          result.push(previous + 1);
        } else if (gap > 2) {
          result.push(index === 1 ? 'ellipsis-start' : 'ellipsis-end');
        }
      }

      result.push(current);
    }

    return result;
  });

  function goToPage(page: number): void {
    if (page < 1 || page > totalPages || page === currentPage) return;
    currentPage = page;
  }
</script>

<nav class={mergedClassName} aria-label="Pagination">
  {#if totalCount !== undefined}
    <p class="cinder-pagination__count" aria-live="polite">
      {formatNumber(totalCount)} results
    </p>
  {/if}

  <div class="cinder-pagination__controls">
    <!-- Previous -->
    <button
      type="button"
      class="cinder-pagination__step"
      aria-label="Go to previous page"
      disabled={!canGoPrevious}
      onclick={() => goToPage(currentPage - 1)}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
        focusable="false"
      >
        <polyline points="15 18 9 12 15 6" />
      </svg>
    </button>

    <!-- Page number buttons -->
    <ul class="cinder-pagination__pages">
      {#each pageItems as item (typeof item === 'string' ? item : `page-${item}`)}
        {#if typeof item === 'string'}
          <li class="cinder-pagination__ellipsis-item" aria-hidden="true">
            <span class="cinder-pagination__ellipsis">&hellip;</span>
          </li>
        {:else}
          <li>
            <button
              type="button"
              class="cinder-pagination__page"
              aria-label={item === currentPage
                ? `Page ${item}, current page`
                : `Go to page ${item}`}
              aria-current={item === currentPage ? 'page' : undefined}
              data-cinder-current={item === currentPage ? '' : undefined}
              onclick={() => goToPage(item)}
            >
              {item}
            </button>
          </li>
        {/if}
      {/each}
    </ul>

    <!-- Next -->
    <button
      type="button"
      class="cinder-pagination__step"
      aria-label="Go to next page"
      disabled={!canGoNext}
      onclick={() => goToPage(currentPage + 1)}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
        focusable="false"
      >
        <polyline points="9 18 15 12 9 6" />
      </svg>
    </button>
  </div>
</nav>
