<script module lang="ts">
  /**
   * Offset pagination + page-size selector (plan §4: "offset-based, page
   * size 50 default (25/50/100 offered; never expose the 1000 API max for
   * browsing)"). `Pagination` (Cinder) is page-number based
   * (`currentPage`/`totalPages`, 1-indexed) — this converts to/from the
   * `offset`/`limit` pair `WorkflowListQuery` actually carries.
   *
   * `DEFAULT_PAGE_SIZE` lives in a `<script module>` block (a real module
   * export) rather than the instance script — a plain `export const` inside
   * a `.svelte` file's instance script becomes a component PROP, not an
   * importable value.
   */
  export const DEFAULT_PAGE_SIZE = 50;

  const PAGE_SIZE_OPTIONS = [25, 50, 100] as const;
</script>

<script lang="ts">
  import { Pagination, Select } from '@lostgradient/cinder';

  interface WorkflowListPaginationProps {
    offset: number;
    limit: number;
    total: number;
    onOffsetChange: (offset: number) => void;
    onLimitChange: (limit: number) => void;
  }

  let { offset, limit, total, onOffsetChange, onLimitChange }: WorkflowListPaginationProps =
    $props();

  const currentPage = $derived(Math.floor(offset / limit) + 1);
  const totalPages = $derived(Math.max(1, Math.ceil(total / limit)));

  function onCurrentPageChange(page: number): void {
    onOffsetChange((page - 1) * limit);
  }

  function onLimitSelectChange(event: Event): void {
    const nextLimit = Number((event.currentTarget as HTMLSelectElement).value);
    // Changing page size resets to the first page — the current offset is
    // meaningless against a different page size (plan §4 says nothing about
    // preserving scroll position across a size change, and silently landing
    // on a now-mismatched offset would show a confusing partial page).
    onLimitChange(nextLimit);
    onOffsetChange(0);
  }
</script>

<div class="weft-workflow-pagination">
  <Pagination
    bind:currentPage={() => currentPage, onCurrentPageChange}
    {totalPages}
    totalCount={total}
  />
  <Select
    id="weft-workflow-page-size"
    aria-label="Rows per page"
    value={String(limit)}
    options={PAGE_SIZE_OPTIONS.map((size) => ({ value: String(size), label: `${size} / page` }))}
    onchange={onLimitSelectChange}
  />
</div>
