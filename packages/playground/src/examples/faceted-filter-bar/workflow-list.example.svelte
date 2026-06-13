<script lang="ts" module>
  export const title = 'Workflow list filters';
  export const description =
    'Status, failure category, queue, and workflow type facets for a dense operational workflow list view.';
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
        { value: 'scheduled', label: 'Scheduled' },
        { value: 'completed', label: 'Completed' },
      ],
    },
    {
      type: 'select',
      key: 'failure_category',
      label: 'Failure category',
      placeholder: 'All categories',
      options: [
        { value: 'timeout', label: 'Timeout' },
        { value: 'network', label: 'Network error' },
        { value: 'resource', label: 'Resource exhausted' },
        { value: 'logic', label: 'Logic error' },
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
        { value: 'scheduled', label: 'Scheduled' },
      ],
    },
    {
      type: 'select',
      key: 'workflow_type',
      label: 'Workflow type',
      placeholder: 'All types',
      options: [
        { value: 'data_pipeline', label: 'Data pipeline' },
        { value: 'notification', label: 'Notification' },
        { value: 'sync', label: 'Sync' },
        { value: 'report', label: 'Report' },
      ],
    },
  ];

  let appliedFilters = $state<AppliedFilter[]>([
    { key: 'status', value: 'failed', label: 'Status' },
  ]);
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
  aria-label="Workflow list filters"
  {facets}
  {appliedFilters}
  {searchQuery}
  searchPlaceholder="Search by workflow name or ID…"
  onsearchchange={(q) => (searchQuery = q)}
  onfacetchange={handleFacetChange}
  onfilterremove={handleFilterRemove}
  onclearall={handleClearAll}
/>
