<script lang="ts" module>
  export const title = 'Cursor pagination';
  export const description =
    'Use page-local cursor metadata when an API exposes previous and next cursors instead of totals.';
</script>

<script lang="ts">
  import { Pagination } from '@lostgradient/cinder/pagination';

  type CursorPage = {
    page: number;
    previousCursor?: string;
    nextCursor?: string;
  };

  let currentPage = $state(1);

  const pages: [CursorPage, ...CursorPage[]] = [
    { page: 1, nextCursor: 'cursor-page-2' },
    { page: 2, previousCursor: 'cursor-page-1', nextCursor: 'cursor-page-3' },
    { page: 3, previousCursor: 'cursor-page-2' },
  ];

  const current = $derived(pages.find((page) => page.page === currentPage) ?? pages[0]);
</script>

<Pagination
  bind:currentPage
  hasPreviousPage={current.previousCursor !== undefined}
  hasNextPage={current.nextCursor !== undefined}
/>
<p style="margin-top: 0.5rem; color: var(--cinder-text-muted);">
  Page {current.page}
</p>
