<script lang="ts" module>
  export const title = 'Description list rich definitions';
  export const description =
    'Definitions can render rich snippet content when plain text is not enough.';
</script>

<script lang="ts">
  import { DescriptionList } from '@lostgradient/cinder/description-list';
  import type { DescriptionListItem } from '@lostgradient/cinder/description-list';

  const items: DescriptionListItem[] = [
    { term: 'Run ID', definition: runIdDefinition },
    { term: 'Status', definition: statusDefinition },
  ];
</script>

{#snippet runIdDefinition()}
  <code>abc-123</code>
{/snippet}

{#snippet statusDefinition()}
  <span class="example-status">Active</span>
{/snippet}

<DescriptionList {items} />
