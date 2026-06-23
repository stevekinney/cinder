<script lang="ts" module>
  export const title = 'Retry after a failed request';
  export const description =
    'Rejected requests switch the button into retry mode so the user can recover explicitly.';
</script>

<script lang="ts">
  import { LoadMore } from '@lostgradient/cinder/load-more';

  let items = $state(['Alpha', 'Bravo', 'Charlie']);
  let loading = $state(false);
  let hasMore = $state(true);
  let attempts = $state(0);

  async function fetchNext() {
    loading = true;
    await new Promise((resolve) => setTimeout(resolve, 300));
    attempts += 1;
    loading = false;
    if (attempts === 1) {
      throw new Error('Temporary network failure');
    }
    items = [...items, 'Delta', 'Echo'];
    hasMore = false;
  }
</script>

<ul aria-busy={loading}>
  {#each items as item}
    <li>{item}</li>
  {/each}
</ul>

<LoadMore onloadmore={fetchNext} bind:loading bind:hasMore retryLabel="Try again" />
