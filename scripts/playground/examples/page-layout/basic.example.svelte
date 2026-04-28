<script lang="ts" module>
  export const title = 'Page layout';
  export const description = 'Title, optional actions slot, and page content.';
</script>

<script lang="ts">
  import { Button, PageLayout } from '../../../../src/index.ts';
</script>

<PageLayout title="Team members">
  {#snippet actions()}
    <Button variant="primary" size="sm" label="Invite member" />
  {/snippet}
  <p>Manage your team's access and roles here.</p>
</PageLayout>
