<script lang="ts" module>
  export const title = 'Pagination with total count';
  export const description = 'totalCount prop shows formatted record count.';
</script>

<script lang="ts">
  import { Pagination } from 'cinder/pagination';
  let currentPage = $state(3);
</script>

<Pagination bind:currentPage totalPages={20} totalCount={384} />
