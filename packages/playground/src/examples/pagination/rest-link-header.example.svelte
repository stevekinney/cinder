<script lang="ts" module>
  export const title = 'REST Link-header pagination';
  export const description =
    'Drive previous and next buttons from parsed REST Link headers without a total page count.';
</script>

<script lang="ts">
  import { Pagination } from '@lostgradient/cinder/pagination';

  let currentPage = $state(1);

  const linkHeaders: Record<number, string> = {
    1: '<https://api.example.test/issues?page=2>; rel="next"',
    2: '<https://api.example.test/issues?page=1>; rel="prev", <https://api.example.test/issues?page=3>; rel="next"',
    3: '<https://api.example.test/issues?page=2>; rel="prev"',
  };

  const links = $derived(parseLinkHeader(linkHeaders[currentPage] ?? ''));

  function parseLinkHeader(header: string): Record<string, string> {
    return Object.fromEntries(
      header
        .split(',')
        .map((entry) => entry.match(/<([^>]+)>;\s*rel="([^"]+)"/))
        .filter((match): match is RegExpMatchArray => match !== null)
        .map((match) => [match[2], match[1]]),
    );
  }
</script>

<Pagination
  bind:currentPage
  hasPreviousPage={links['prev'] !== undefined}
  hasNextPage={links['next'] !== undefined}
/>
<p style="margin-top: 0.5rem; color: var(--cinder-text-muted);">
  Page {currentPage}
</p>
