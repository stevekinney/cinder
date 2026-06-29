<script lang="ts" module>
  export const title = 'Explicit items';
  export const description =
    'Uses a controlled nested items array for custom table-of-contents ordering.';
</script>

<script lang="ts">
  import { TableOfContents } from '@lostgradient/cinder/table-of-contents';

  let { mountIdPrefix }: { mountIdPrefix?: string } = $props();
  const uid = $props.id();
  let apiOverviewId = $derived(`${mountIdPrefix ?? uid}-api-overview`);
  let apiAuthId = $derived(`${mountIdPrefix ?? uid}-api-auth`);
  let apiPaginationId = $derived(`${mountIdPrefix ?? uid}-api-pagination`);
  let apiErrorsId = $derived(`${mountIdPrefix ?? uid}-api-errors`);

  const items = [
    {
      id: apiOverviewId,
      label: 'API Overview',
      children: [
        { id: apiAuthId, label: 'Authentication' },
        { id: apiPaginationId, label: 'Pagination' },
      ],
    },
    {
      id: apiErrorsId,
      label: 'Error handling',
    },
  ];
</script>

<div style="display: grid; grid-template-columns: 16rem 1fr; gap: 1.5rem; align-items: start;">
  <aside style="position: sticky; top: 1rem;">
    <TableOfContents {items} />
  </aside>

  <article style="display: flex; flex-direction: column; gap: 2rem;">
    <section>
      <h2 id={apiOverviewId}>API Overview</h2>
      <p style="margin: 0.5rem 0 0;">Endpoints and request/response shape at a glance.</p>
      <h3 id={apiAuthId}>Authentication</h3>
      <p style="margin: 0.5rem 0 0;">How to pass and rotate API credentials.</p>
      <h3 id={apiPaginationId}>Pagination</h3>
      <p style="margin: 0.5rem 0 0;">Cursor and offset pagination tradeoffs.</p>
    </section>
    <section>
      <h2 id={apiErrorsId}>Error handling</h2>
      <p style="margin: 0.5rem 0 0;">How to interpret structured API error payloads.</p>
    </section>
  </article>
</div>
