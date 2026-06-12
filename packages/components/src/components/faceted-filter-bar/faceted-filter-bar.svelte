<script lang="ts" module>
  /**
   * @cinder
   * @category form
   * @status beta
   * @purpose Composed filtering toolbar with search, select facets, applied-filter chips, and clear-all for dense operational list views.
   * @tag form
   * @tag filter
   * @useWhen Filtering a list or table by multiple dimensions such as status, category, and queue simultaneously.
   * @useWhen Showing applied filters as removable chips so users can see and undo active constraints.
   * @avoidWhen A single search field or one select is sufficient — compose SearchField or Select directly.
   * @avoidWhen Filtering navigates to a new page — the bar owns no routing or persistence.
   * @related search-field, chip, select, toolbar
   */
  export type {
    AppliedFilter,
    CustomFacet,
    FacetDefinition,
    FacetedFilterBarProps,
    FacetOption,
    SelectFacet,
  } from './faceted-filter-bar.types.ts';
</script>

<script lang="ts">
  import VisuallyHiddenLiveRegion from '../_visually-hidden-live-region.svelte';
  import SearchField from '../search-field/search-field.svelte';
  import Chip from '../chip/chip.svelte';
  import Button from '../button/button.svelte';
  import { classNames } from '../../utilities/class-names.ts';

  import type { FacetedFilterBarProps, SelectFacet } from './faceted-filter-bar.types.ts';

  const generatedId = $props.id();

  let {
    'aria-label': ariaLabel = 'Filters',
    searchQuery,
    searchPlaceholder = 'Search…',
    searchAriaLabel = 'Search',
    facets = [],
    appliedFilters = [],
    disabled = false,
    class: className,
    onsearchchange,
    onfacetchange,
    onfilterremove,
    onclearall,
    ...rest
  }: FacetedFilterBarProps = $props();

  const searchId = $derived(`${generatedId}-search`);

  // Internal uncontrolled search value when searchQuery is not provided.
  let internalSearchQuery = $state('');
  const isSearchControlled = $derived(searchQuery !== undefined);
  const currentSearchQuery = $derived(
    isSearchControlled ? (searchQuery ?? '') : internalSearchQuery,
  );

  // Facet controls are fully controlled by `appliedFilters`: the value a facet
  // shows is whatever applied filter owns its key, or empty. There is no
  // separate internal source of truth — that would let a select keep showing a
  // value the parent has cleared (URL-state reset, clear-all, saved filters).
  // A facet change is reported via `onfacetchange`; the consumer commits it
  // back through `appliedFilters`.
  function resolveFacetValue(key: string): string {
    return appliedFilters.find((filter) => filter.key === key)?.value ?? '';
  }

  const hasAppliedFilters = $derived(appliedFilters.length > 0 || currentSearchQuery.length > 0);
  const totalActiveCount = $derived(appliedFilters.length);

  // Live region summary message — always in DOM, content changes when filters change.
  const summaryMessage = $derived.by(() => {
    if (totalActiveCount === 0) return '';
    const parts = appliedFilters.map((filter) => `${filter.label}: ${filter.value}`);
    return `${totalActiveCount} active filter${totalActiveCount === 1 ? '' : 's'}: ${parts.join(', ')}`;
  });

  function handleSearchInput(value: string): void {
    if (!isSearchControlled) {
      internalSearchQuery = value;
    }
    onsearchchange?.(value);
  }

  function handleFilterRemove(key: string): void {
    onfilterremove?.(key);
  }

  function handleClearAll(): void {
    if (!isSearchControlled) {
      internalSearchQuery = '';
    }
    onclearall?.();
  }

  function getFacetCurrentValue(key: string): string {
    return resolveFacetValue(key);
  }
</script>

<div
  {...rest}
  class={classNames('cinder-faceted-filter-bar', className)}
  role="search"
  aria-label={ariaLabel}
  data-disabled={disabled ? '' : undefined}
>
  <!-- Controls row: search field + facet selects -->
  <div class="cinder-faceted-filter-bar__controls">
    <SearchField
      id={searchId}
      class="cinder-faceted-filter-bar__search"
      value={currentSearchQuery}
      placeholder={searchPlaceholder}
      aria-label={searchAriaLabel}
      {disabled}
      oninput={handleSearchInput}
    />

    {#each facets as facet (facet.key)}
      {#if facet.type === 'select'}
        {@const selectFacet = facet as SelectFacet}
        <div class="cinder-faceted-filter-bar__facet">
          <label
            class="cinder-faceted-filter-bar__facet-label cinder-sr-only"
            for={`${generatedId}-facet-${selectFacet.key}`}
          >
            {selectFacet.label}
          </label>
          <select
            id={`${generatedId}-facet-${selectFacet.key}`}
            class="cinder-faceted-filter-bar__select"
            value={resolveFacetValue(selectFacet.key)}
            disabled={disabled || selectFacet.disabled}
            aria-label={selectFacet.label}
            onchange={(event) => {
              const target = event.currentTarget as HTMLSelectElement;
              onfacetchange?.(selectFacet.key, target.value);
            }}
          >
            <option value="">{selectFacet.placeholder ?? selectFacet.label}</option>
            {#each selectFacet.options as option (option.value)}
              <option value={option.value} disabled={option.disabled}>{option.label}</option>
            {/each}
          </select>
          <span class="cinder-faceted-filter-bar__select-chevron" aria-hidden="true"></span>
        </div>
      {:else if facet.type === 'custom'}
        <div class="cinder-faceted-filter-bar__facet">
          {@render facet.control({
            value: getFacetCurrentValue(facet.key),
            onchange: (value: string) => {
              onfacetchange?.(facet.key, value);
            },
          })}
        </div>
      {/if}
    {/each}
  </div>

  <!-- Applied filters row: chips + clear all -->
  {#if hasAppliedFilters}
    <div class="cinder-faceted-filter-bar__chips" aria-label="Applied filters">
      {#each appliedFilters as filter (filter.key)}
        <Chip
          mode="removable"
          label={`${filter.label}: ${filter.value}`}
          removeAriaLabel={`Remove filter: ${filter.label}: ${filter.value}`}
          {disabled}
          onremove={() => handleFilterRemove(filter.key)}
        />
      {/each}

      <Button
        variant="ghost"
        size="sm"
        class="cinder-faceted-filter-bar__clear-all"
        {disabled}
        onclick={handleClearAll}
      >
        Clear all
      </Button>
    </div>
  {/if}

  <!-- Always-in-DOM live region for accessible filter count summary.
       Visibility toggled by content, never by {#if}, so the region is
       registered with ATs before text is injected. -->
  <VisuallyHiddenLiveRegion message={summaryMessage} priority="polite" />
</div>
