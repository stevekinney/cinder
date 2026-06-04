<script lang="ts" module>
  export const title = 'Basic empty state';
  export const description = 'Title, description, and an action button.';
</script>

<script lang="ts">
  import { Button } from '@lostgradient/cinder/button';
  import { EmptyState } from '@lostgradient/cinder/empty-state';
</script>

<EmptyState title="No results found" description="Try adjusting your filters or search query.">
  {#snippet action()}
    <Button variant="primary" label="Clear filters" />
  {/snippet}
</EmptyState>
