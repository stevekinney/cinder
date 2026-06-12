# FacetedFilterBar

Composed filtering toolbar with a leading search field, select-based or custom facet controls, removable applied-filter chips, and a clear-all action. Designed for dense operational list views such as workflow queues, failure triage dashboards, and schedule browsers.

## Overview

`FacetedFilterBar` composes `SearchField`, `Chip` (removable mode), and native select controls into one accessible filtering surface. It owns no routing, persistence, or data fetching — it emits change events and the consumer owns the filter state and data loading.

The bar supports two facet types:

- **`select`** — a fixed list of options rendered as a styled native select. Use for status, category, queue, or any enumerable dimension.
- **`custom`** — a consumer-supplied snippet that renders any control (combobox, date-range picker, etc.) and receives the current value plus a change callback.

Applied filters are displayed as removable chips. A visually-hidden live region announces the active filter count and each applied value to screen readers whenever the filter state changes.

## Usage

```svelte
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
      ],
    },
  ];

  let appliedFilters = $state<AppliedFilter[]>([]);
  let searchQuery = $state('');

  function handleFacetChange(key: string, value: string) {
    if (!value) {
      appliedFilters = appliedFilters.filter((f) => f.key !== key);
      return;
    }
    const facet = facets.find((f) => f.key === key);
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
  onsearchchange={(q) => (searchQuery = q)}
  onfacetchange={handleFacetChange}
  onfilterremove={handleFilterRemove}
  onclearall={handleClearAll}
/>
```

### Custom facet (snippet escape-hatch)

Use `type: 'custom'` with a `control` snippet for any facet that cannot be expressed as a select list, such as a date-range picker or combobox:

```svelte
<script lang="ts">
  import { FacetedFilterBar } from '@lostgradient/cinder/faceted-filter-bar';
  import type { FacetDefinition } from '@lostgradient/cinder/faceted-filter-bar';
</script>

{#snippet dateRangeControl({ value, onchange }: { value: string; onchange: (v: string) => void })}
  <!-- render your date-range control here; call onchange(value) on selection -->
{/snippet}

<FacetedFilterBar
  aria-label="Order filters"
  facets={[
    {
      type: 'custom',
      key: 'dateRange',
      label: 'Date range',
      control: dateRangeControl,
    },
  ]}
/>
```

## Props

| Prop                | Type                                   | Default     | Description                                                                           |
| ------------------- | -------------------------------------- | ----------- | ------------------------------------------------------------------------------------- |
| `aria-label`        | `string`                               | `'Filters'` | Accessible label for the filter toolbar region.                                       |
| `searchQuery`       | `string`                               | —           | Controlled search query. When provided, the search field is controlled by the parent. |
| `searchPlaceholder` | `string`                               | `'Search…'` | Placeholder text shown in the leading search field.                                   |
| `searchAriaLabel`   | `string`                               | `'Search'`  | Accessible label for the search input.                                                |
| `facets`            | `FacetDefinition[]`                    | `[]`        | Facet definitions rendered as filter controls after the search field.                 |
| `appliedFilters`    | `AppliedFilter[]`                      | `[]`        | Applied filters displayed as removable chips.                                         |
| `disabled`          | `boolean`                              | `false`     | When true, all filter controls and chips are disabled.                                |
| `class`             | `string`                               | —           | Additional CSS classes applied to the root element.                                   |
| `onsearchchange`    | `(query: string) => void`              | —           | Fires when the search query changes.                                                  |
| `onfacetchange`     | `(key: string, value: string) => void` | —           | Fires when a facet value changes.                                                     |
| `onfilterremove`    | `(key: string) => void`                | —           | Fires when a specific applied filter chip is removed.                                 |
| `onclearall`        | `() => void`                           | —           | Fires when the clear-all button is clicked.                                           |

### FacetDefinition

```ts
// Select facet — fixed options list
type SelectFacet = {
  type: 'select';
  key: string;
  label: string;
  placeholder?: string;
  options: { value: string; label: string; disabled?: boolean }[];
  disabled?: boolean;
};

// Custom facet — consumer-supplied snippet
type CustomFacet = {
  type: 'custom';
  key: string;
  label: string;
  control: Snippet<[{ value: string; onchange: (value: string) => void }]>;
};
```

### AppliedFilter

```ts
type AppliedFilter = {
  key: string; // matches a FacetDefinition key
  value: string; // the selected value
  label: string; // human-readable label shown in the chip
};
```

## Accessibility

`FacetedFilterBar` uses `role="search"` on the root element to expose the filtering surface as a landmark. Consumers should provide a meaningful `aria-label` prop (e.g. `"Workflow filters"`) so screen reader users can navigate to it by landmark.

Each select facet receives an `aria-label` attribute equal to its `label` prop, and an associated visually-hidden `label` element is rendered via the `cinder-sr-only` class for redundancy.

Applied-filter chip remove buttons are labeled `"Remove filter: {label}: {value}"` so screen reader users know exactly which filter they are removing.

A `role="status"` live region (polite) always stays in the DOM and announces the active filter count and each applied value whenever the `appliedFilters` prop changes. The region is never conditionally rendered with `{#if}` — this ensures assistive technologies register it before any content is injected.

See `faceted-filter-bar.a11y.md` for the full keyboard and pointer interaction model.
