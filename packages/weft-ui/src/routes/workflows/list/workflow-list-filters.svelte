<script lang="ts">
  /**
   * Workflow list filter bar (plan §9.2 T2.1, design `Weft UI.dc.html`
   * "Workflow list" filter row). `FilterBar` (Cinder) is the shell;
   * status is a multi-select toggle row above it (a `select` facet only
   * carries one value, but `ListFilter.status` accepts several — plan
   * §10.3-adjacent, matches the design's row of independently pressable
   * status pills) and "Search attributes" is a disclosure toggle for
   * `query-builder.svelte` below it (plan §10.3).
   *
   * `FilterBar`'s `custom` facet snippet gets no wrapping label from
   * the bar itself (verified against `filter-bar.svelte`: the
   * `custom` branch renders the snippet in a bare `<div>`, no `aria-label`)
   * — every custom control below supplies its own accessible name.
   *
   * Tags and status are NOT modeled as `FilterBar` "applied filter"
   * chips: `AppliedFilter` is one value per facet key, but both are
   * multi-valued and already self-represent their active state (`TagInput`
   * renders its own removable chips; the status row's pressed `Chip`s ARE
   * the active-state display) — routing them through the bar's single-chip
   * model would just duplicate that. `onClearAll` resets everything this
   * component owns, tags/status included, so "Clear all" still works.
   */
  import {
    Chip,
    FilterBar,
    Input,
    Select,
    TagInput,
    type AppliedFilter,
  } from '@lostgradient/cinder';
  import { SlidersHorizontal } from 'lucide-svelte';
  import type { WorkflowStatus } from '@lostgradient/weft';

  import type { WorkflowListQuery } from '../../../lib/filters.ts';
  import { workflowStatusBadge, WORKFLOW_STATUS_ORDER } from './workflow-status-badge.ts';
  import {
    CREATED_DATE_PRESET_LABEL,
    createdDatePresetToTimeRange,
    denormalizeWorkflowStatusFilter,
    normalizeWorkflowStatusFilter,
    timeRangeToCreatedDatePreset,
    toggleWorkflowStatus,
    type CreatedDatePreset,
  } from './workflow-list-filters.ts';

  interface WorkflowListFiltersProps {
    filter: WorkflowListQuery;
    onFilterChange: (next: WorkflowListQuery) => void;
    /** Opens the search-attribute query builder disclosure (plan §10.3). */
    queryBuilderOpen: boolean;
    onQueryBuilderOpenChange: (open: boolean) => void;
    /** How many attribute conditions are currently applied, shown on the disclosure toggle. */
    activeConditionCount: number;
  }

  let {
    filter,
    onFilterChange,
    queryBuilderOpen,
    onQueryBuilderOpenChange,
    activeConditionCount,
  }: WorkflowListFiltersProps = $props();

  const statuses = $derived(normalizeWorkflowStatusFilter(filter.status));
  const createdPreset = $derived(timeRangeToCreatedDatePreset(filter.createdAt));

  /**
   * Builds the next filter via a mutator over a draft copy, using `delete`
   * (never `key: undefined`) to clear a field — `WorkflowListQuery`'s
   * optional fields have no `| undefined` in their VALUE type
   * (`exactOptionalPropertyTypes`), so the key must be omitted entirely to
   * mean "no filter on this dimension," matching `src/lib/client.ts`'s own
   * documented convention for the same compiler setting.
   */
  function patch(mutate: (draft: WorkflowListQuery) => void): void {
    const draft: WorkflowListQuery = { ...filter };
    mutate(draft);
    onFilterChange(draft);
  }

  function toggleStatus(status: WorkflowStatus): void {
    const next = denormalizeWorkflowStatusFilter(toggleWorkflowStatus(statuses, status));
    patch((draft) => {
      if (next === undefined) delete draft.status;
      else draft.status = next;
    });
  }

  const createdOptions = (
    ['all', '24h', '7d', '30d'] as const satisfies readonly CreatedDatePreset[]
  ).map((value) => ({ value, label: CREATED_DATE_PRESET_LABEL[value] }));

  const appliedFilters = $derived(
    [
      filter.idPrefix ? { key: 'idPrefix', value: filter.idPrefix, label: 'ID prefix' } : null,
      filter.type ? { key: 'type', value: filter.type, label: 'Type' } : null,
      createdPreset !== 'all' ? { key: 'created', value: createdPreset, label: 'Created' } : null,
    ].filter((entry): entry is AppliedFilter => entry !== null),
  );

  function onSearchChange(value: string): void {
    patch((draft) => {
      if (value) draft.idPrefix = value;
      else delete draft.idPrefix;
    });
  }

  function onFacetChange(key: string, value: string): void {
    if (key === 'type') {
      patch((draft) => {
        if (value) draft.type = value;
        else delete draft.type;
      });
    } else if (key === 'created') {
      const range = createdDatePresetToTimeRange(value as CreatedDatePreset);
      patch((draft) => {
        if (range) draft.createdAt = range;
        else delete draft.createdAt;
      });
    }
  }

  function onTagsChange(tags: string[]): void {
    patch((draft) => {
      if (tags.length > 0) draft.tags = tags;
      else delete draft.tags;
    });
  }

  function onFilterRemove(key: string): void {
    patch((draft) => {
      if (key === 'idPrefix') delete draft.idPrefix;
      else if (key === 'type') delete draft.type;
      else if (key === 'created') delete draft.createdAt;
    });
  }

  function onClearAll(): void {
    const next: WorkflowListQuery = {};
    if (filter.limit !== undefined) next.limit = filter.limit;
    onFilterChange(next);
  }
</script>

<div class="weft-workflow-filters">
  <div class="weft-workflow-filters__status-row" role="group" aria-label="Filter by status">
    {#each WORKFLOW_STATUS_ORDER as status (status)}
      {@const badge = workflowStatusBadge(status)}
      {@const pressed = statuses.includes(status)}
      <Chip
        mode="toggle"
        label={badge.label}
        variant={pressed ? badge.tone : 'neutral'}
        density="toolbar"
        {pressed}
        onPressedChange={() => toggleStatus(status)}
      />
    {/each}
  </div>

  <FilterBar
    aria-label="Workflow filters"
    searchQuery={filter.idPrefix ?? ''}
    searchPlaceholder="wf_… id prefix"
    searchAriaLabel="Filter by workflow id prefix"
    {onSearchChange}
    {appliedFilters}
    {onFacetChange}
    {onFilterRemove}
    {onClearAll}
    facets={[
      { type: 'custom', key: 'type', label: 'Type', control: typeControl },
      { type: 'custom', key: 'tags', label: 'Tags', control: tagsControl },
      { type: 'custom', key: 'created', label: 'Created', control: createdControl },
    ]}
  />

  <button
    type="button"
    class="weft-workflow-filters__query-builder-toggle"
    aria-expanded={queryBuilderOpen}
    onclick={() => onQueryBuilderOpenChange(!queryBuilderOpen)}
  >
    <SlidersHorizontal aria-hidden="true" size={13} />
    Search attributes
    {#if activeConditionCount > 0}<span class="weft-workflow-filters__condition-count"
        >{activeConditionCount}</span
      >{/if}
  </button>
</div>

{#snippet typeControl({ onValueChange }: { value: string; onValueChange: (value: string) => void })}
  <Input
    id="weft-workflow-filter-type"
    label="Workflow type"
    labelVisible={false}
    placeholder="Workflow type…"
    value={filter.type ?? ''}
    oninput={(event) => onValueChange((event.currentTarget as HTMLInputElement).value)}
  />
{/snippet}

{#snippet tagsControl()}
  <TagInput
    id="weft-workflow-filter-tags"
    aria-label="Filter by tags (matches all)"
    placeholder="add tag…"
    value={filter.tags ?? []}
    onValueChange={onTagsChange}
  />
{/snippet}

{#snippet createdControl({
  onValueChange,
}: {
  value: string;
  onValueChange: (value: string) => void;
})}
  <Select
    id="weft-workflow-filter-created"
    aria-label="Filter by created date"
    options={createdOptions}
    value={createdPreset}
    onchange={(event) => onValueChange((event.currentTarget as HTMLSelectElement).value)}
  />
{/snippet}
