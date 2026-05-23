<script lang="ts" module>
  export const title = 'Basic infinite scroll';
  export const description =
    'The sentinel auto-loads near the end of the list, and the button remains available as the manual fallback.';
</script>

<script lang="ts">
  import { LoadMore } from 'cinder/load-more';

  let items = $state(Array.from({ length: 20 }, (_, index) => `Item ${index + 1}`));
  let loading = $state(false);
  let hasMore = $state(true);

  async function fetchNext() {
    loading = true;
    await new Promise((resolve) => setTimeout(resolve, 400));
    const start = items.length;
    items = [...items, ...Array.from({ length: 20 }, (_, index) => `Item ${start + index + 1}`)];
    loading = false;
    if (items.length >= 100) hasMore = false;
  }
</script>

<ul aria-busy={loading}>
  {#each items as item}
    <li>{item}</li>
  {/each}
</ul>

<LoadMore onLoadMore={fetchNext} bind:loading bind:hasMore />
