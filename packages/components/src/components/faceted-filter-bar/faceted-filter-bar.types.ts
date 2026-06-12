import type { Snippet } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';

/** A single option available within a select-type facet. */
export type FacetOption = {
  /** The value submitted when this option is selected. */
  value: string;
  /** The human-readable label shown in the option list. */
  label: string;
  /** When true, the option is visible but not selectable. */
  disabled?: boolean;
};

/**
 * A facet configured with a fixed list of options rendered as a native select.
 * Use for status, category, queue, or any enumerable filter dimension.
 */
export type SelectFacet = {
  /** Discriminant that determines how the facet is rendered. */
  type: 'select';
  /** Unique key used to identify this facet in the applied-filter map. */
  key: string;
  /** Accessible label for the facet control. */
  label: string;
  /** Placeholder text shown when no value is selected. */
  placeholder?: string;
  /** Options available for selection. */
  options: readonly FacetOption[];
  /** Whether the facet control is disabled. */
  disabled?: boolean;
};

/**
 * A facet rendered by a consumer-supplied snippet. Use for date-range pickers,
 * comboboxes, or any control that cannot be expressed as a select list.
 */
export type CustomFacet = {
  /** Discriminant that determines how the facet is rendered. */
  type: 'custom';
  /** Unique key used to identify this facet in the applied-filter map. */
  key: string;
  /** Accessible label for the facet (used in the applied-filter chip). */
  label: string;
  /** Consumer-supplied snippet that renders the full facet control. */
  control: Snippet<[{ value: string; onchange: (value: string) => void }]>;
};

/** Union of all supported facet definition types. */
export type FacetDefinition = SelectFacet | CustomFacet;

/** An applied filter entry: a facet key paired with its current value and display label. */
export type AppliedFilter = {
  /** The facet key this filter belongs to. */
  key: string;
  /** The current value of the filter. */
  value: string;
  /** The human-readable label used in the removable chip. */
  label: string;
};

/**
 * Props for the FacetedFilterBar component.
 *
 * A composed filtering toolbar that combines a leading search field, consumer-defined
 * facet controls, applied-filter chips, and a clear-all action into one accessible unit.
 */
export type FacetedFilterBarProps = Omit<HTMLAttributes<HTMLDivElement>, 'class' | 'children'> & {
  /** Accessible label for the filter toolbar region. Required for screen readers. */
  'aria-label'?: string;
  /** Current text search query. When provided, the search field is controlled. */
  searchQuery?: string;
  /** Placeholder text shown in the leading search field. */
  searchPlaceholder?: string;
  /** Accessible label for the search input. Defaults to 'Search'. */
  searchAriaLabel?: string;
  /**
   * Facet definitions rendered as filter controls after the search field.
   * Each entry is either a select-type facet or a custom snippet-driven facet.
   */
  facets?: readonly FacetDefinition[];
  /**
   * Applied filters displayed as removable chips below the controls row.
   * Controlled by the consumer; each entry is a key/value/label triple.
   */
  appliedFilters?: readonly AppliedFilter[];
  /** When true, all filter controls and chips are disabled. */
  disabled?: boolean;
  /** Additional CSS classes applied to the root element. */
  class?: string;
  /** Fires when the search query changes. */
  onsearchchange?: (query: string) => void;
  /** Fires when a facet value changes, with the facet key and new value. */
  onfacetchange?: (key: string, value: string) => void;
  /** Fires when a specific applied filter chip is removed. */
  onfilterremove?: (key: string) => void;
  /** Fires when the clear-all button is clicked. */
  onclearall?: () => void;
};
