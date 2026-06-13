<script lang="ts" module>
  export const title = 'Basic faceted filter bar';
  export const description =
    'Search field with status and queue facets, applied-filter chips, and a clear-all action.';
</script>

<script lang="ts">
  import { FacetedFilterBar } from '@lostgradient/cinder/faceted-filter-bar';
  import type { AppliedFilter, FacetDefinition } from '@lostgradient/cinder/faceted-filter-bar';

  const facets: FacetDefinition[] = [
    {
      type: 'select',
      key: 'status',
      label: 'Status',
      placeholder: 'All statuses',
      options: [
        { value: 'running', label: 'Running' },
        { value: 'failed', label: 'Failed' },
        { value: 'paused', label: 'Paused' },
        { value: 'completed', label: 'Completed' },
      ],
    },
    {
      type: 'select',
      key: 'queue',
      label: 'Queue',
      placeholder: 'All queues',
      options: [
        { value: 'default', label: 'Default' },
        { value: 'priority', label: 'Priority' },
        { value: 'background', label: 'Background' },
      ],
    },
  ];

  let appliedFilters = $state<AppliedFilter[]>([]);
  let searchQuery = $state('');

  function handleFacetChange(key: string, value: string) {
    const facet = facets.find((f) => f.key === key);
    if (!value) {
      appliedFilters = appliedFilters.filter((f) => f.key !== key);
      return;
    }
    appliedFilters = [
      ...appliedFilters.filter((f) => f.key !== key),
      { key, value, label: facet?.label ?? key },
    ];
  }

  function handleFilterRemove(key: string) {
    appliedFilters = appliedFilters.filter((f) => f.key !== key);
  }

  function handleClearAll() {
    appliedFilters = [];
    searchQuery = '';
  }
</script>

<FacetedFilterBar
  aria-label="Workflow filters"
  {facets}
  {appliedFilters}
  {searchQuery}
  searchPlaceholder="Search workflows…"
  onsearchchange={(q) => (searchQuery = q)}
  onfacetchange={handleFacetChange}
  onfilterremove={handleFilterRemove}
  onclearall={handleClearAll}
/>
