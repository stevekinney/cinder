<script lang="ts" module>
  export const title = 'Basic page header';
  export const description =
    'Page-level heading with named title, description, breadcrumb, and action regions.';
</script>

<script lang="ts">
  import { Button } from '@lostgradient/cinder/button';
  import { PageHeader } from '@lostgradient/cinder/page-header';
</script>

<div>
  <PageHeader title="Approvals" description="3 pending · 12 resolved" />
</div>

<div style="margin-top: var(--cinder-space-4);">
  <PageHeader>
    {#snippet breadcrumbs()}
      <nav aria-label="Breadcrumb"><a href="/">Home</a> / Schedules</nav>
    {/snippet}
    {#snippet title()}Schedules{/snippet}
    {#snippet description()}Create and manage recurring automation schedules.{/snippet}
    {#snippet actions()}
      <Button variant="primary" size="sm" label="+ New schedule" />
    {/snippet}
  </PageHeader>
</div>
