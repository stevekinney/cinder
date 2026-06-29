<script lang="ts" module>
  export const title = 'Explicit items';
  export const description =
    'Uses a controlled nested items array for custom table-of-contents ordering.';
</script>

<script lang="ts">
  import { TableOfContents } from '@lostgradient/cinder/table-of-contents';

  const items = [
    {
      id: 'api-overview',
      label: 'API Overview',
      children: [
        { id: 'api-auth', label: 'Authentication' },
        { id: 'api-pagination', label: 'Pagination' },
      ],
    },
    {
      id: 'api-errors',
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
      <h2 id="api-overview">API Overview</h2>
      <p style="margin: 0.5rem 0 0;">Endpoints and request/response shape at a glance.</p>
      <h3 id="api-auth">Authentication</h3>
      <p style="margin: 0.5rem 0 0;">How to pass and rotate API credentials.</p>
      <h3 id="api-pagination">Pagination</h3>
      <p style="margin: 0.5rem 0 0;">Cursor and offset pagination tradeoffs.</p>
    </section>
    <section>
      <h2 id="api-errors">Error handling</h2>
      <p style="margin: 0.5rem 0 0;">How to interpret structured API error payloads.</p>
    </section>
  </article>
</div>
