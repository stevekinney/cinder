<script lang="ts" module>
  export const title = 'Disabled state';
  export const description =
    'All controls are disabled when disabled=true — selects, chips, and the clear-all button.';
</script>

<script lang="ts">
  import { FacetedFilterBar } from '@lostgradient/cinder/faceted-filter-bar';
  import type { FacetDefinition } from '@lostgradient/cinder/faceted-filter-bar';

  const facets: FacetDefinition[] = [
    {
      type: 'select',
      key: 'status',
      label: 'Status',
      placeholder: 'All statuses',
      options: [
        { value: 'running', label: 'Running' },
        { value: 'failed', label: 'Failed' },
      ],
    },
  ];
</script>

<FacetedFilterBar
  aria-label="Disabled filter bar"
  {facets}
  appliedFilters={[{ key: 'status', value: 'failed', label: 'Status' }]}
  disabled
/>
