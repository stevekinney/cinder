<script lang="ts" module>
  export const title = 'Basic pagination';
  export const description = 'Navigate through pages with previous/next and numbered buttons.';
</script>

<script lang="ts">
  import { Pagination } from '../../../../src/index.ts';

  let currentPage = $state(1);
</script>

<Pagination bind:currentPage totalPages={10} />
<p style="margin-top: 0.5rem; color: var(--cinder-text-muted);">Page {currentPage} of 10</p>
