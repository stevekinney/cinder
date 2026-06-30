<script lang="ts" module>
  export const title = 'Basic page header';
  export const description =
    'Page-level heading with optional metadata and right-aligned actions using the default snippet.';
</script>

<script lang="ts">
  import { Button } from '@lostgradient/cinder/button';
  import { PageHeader } from '@lostgradient/cinder/page-header';
</script>

<div>
  <PageHeader title="Approvals" meta="3 pending · 12 resolved" />
</div>

<div style="margin-top: var(--cinder-space-4);">
  <PageHeader title="Schedules" meta="No schedules">
    <Button variant="primary" size="sm" label="+ New schedule" />
  </PageHeader>
</div>
