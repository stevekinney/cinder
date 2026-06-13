/// <reference lib="dom" />
import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test';

import { setupHappyDom } from '../../test/happy-dom.ts';

// setupHappyDom() MUST run before any `@testing-library/svelte` import. testing-library
// reads `globalThis.document` / `window` at module-init (top-level, not inside test bodies),
// so we register happy-dom's globals first and then dynamic-import testing-library below.
setupHappyDom();

const { cleanup, fireEvent, render } = await import('@testing-library/svelte');
const { default: FacetedFilterBar } = await import('./faceted-filter-bar.svelte');

beforeEach(() => document.body.replaceChildren());
afterEach(() => cleanup());

const STATUS_FACET = {
  type: 'select' as const,
  key: 'status',
  label: 'Status',
  placeholder: 'All statuses',
  options: [
    { value: 'running', label: 'Running' },
    { value: 'failed', label: 'Failed' },
    { value: 'paused', label: 'Paused' },
  ],
};

const QUEUE_FACET = {
  type: 'select' as const,
  key: 'queue',
  label: 'Queue',
  placeholder: 'All queues',
  options: [
    { value: 'default', label: 'Default' },
    { value: 'priority', label: 'Priority' },
  ],
};

describe('FacetedFilterBar structure', () => {
  test('renders root element with cinder-faceted-filter-bar class', () => {
    const { container } = render(FacetedFilterBar, {});
    const root = container.querySelector('.cinder-faceted-filter-bar');
    expect(root).not.toBeNull();
  });

  test('applies role="search" for accessible landmark', () => {
    const { container } = render(FacetedFilterBar, {});
    const root = container.querySelector('.cinder-faceted-filter-bar');
    expect(root?.getAttribute('role')).toBe('search');
  });

  test('applies aria-label from prop', () => {
    const { container } = render(FacetedFilterBar, { 'aria-label': 'Workflow filters' } as any);
    const root = container.querySelector('.cinder-faceted-filter-bar');
    expect(root?.getAttribute('aria-label')).toBe('Workflow filters');
  });

  test('root landmark role cannot be overridden by rest attributes', () => {
    const { container } = render(FacetedFilterBar, {
      role: 'presentation',
      'aria-label': 'Workflow filters',
    } as never);
    const root = container.querySelector('.cinder-faceted-filter-bar');
    expect(root?.getAttribute('role')).toBe('search');
    expect(root?.getAttribute('aria-label')).toBe('Workflow filters');
  });

  test('merges a custom class alongside cinder-faceted-filter-bar', () => {
    const { container } = render(FacetedFilterBar, { class: 'custom-class' });
    const root = container.querySelector('.cinder-faceted-filter-bar');
    expect(root?.classList.contains('cinder-faceted-filter-bar')).toBe(true);
    expect(root?.classList.contains('custom-class')).toBe(true);
  });

  test('renders the search field', () => {
    const { container } = render(FacetedFilterBar, {});
    const searchField = container.querySelector('.cinder-search-field');
    expect(searchField).not.toBeNull();
  });

  test('renders select facets from facets prop', () => {
    const { container } = render(FacetedFilterBar, {
      facets: [STATUS_FACET, QUEUE_FACET],
    });
    const selects = container.querySelectorAll('.cinder-faceted-filter-bar__select');
    expect(selects).toHaveLength(2);
  });

  test('renders facet options including placeholder', () => {
    const { container } = render(FacetedFilterBar, { facets: [STATUS_FACET] });
    const options = container.querySelectorAll('.cinder-faceted-filter-bar__select option');
    // placeholder + 3 options
    expect(options).toHaveLength(4);
    expect(options[0]?.textContent).toBe('All statuses');
  });

  test('renders applied-filter chips when appliedFilters is provided', () => {
    const { container } = render(FacetedFilterBar, {
      appliedFilters: [
        { key: 'status', value: 'failed', label: 'Status' },
        { key: 'queue', value: 'default', label: 'Queue' },
      ],
    });
    const chips = container.querySelectorAll('.cinder-chip');
    expect(chips).toHaveLength(2);
  });

  test('select facet reflects the value from appliedFilters (controlled sync)', () => {
    // Regression: the select used to read only internal state, so a chip from
    // appliedFilters would show while the matching select stayed on the
    // placeholder. The select must mirror the controlled applied value.
    const { container } = render(FacetedFilterBar, {
      facets: [STATUS_FACET, QUEUE_FACET],
      appliedFilters: [{ key: 'status', value: 'failed', label: 'Status' }],
    });
    const statusSelect = container.querySelector<HTMLSelectElement>(
      '[aria-label="Status"].cinder-faceted-filter-bar__select',
    );
    const queueSelect = container.querySelector<HTMLSelectElement>(
      '[aria-label="Queue"].cinder-faceted-filter-bar__select',
    );
    expect(statusSelect?.value).toBe('failed');
    // A facet with no applied filter falls back to the empty placeholder.
    expect(queueSelect?.value).toBe('');
  });

  test('a user-changed select resets when the parent clears appliedFilters', async () => {
    // Regression for the stale-local-state path: the user changes the select
    // (which used to write an internal map), then the parent clears
    // appliedFilters externally. The select must follow the controlled state
    // back to the placeholder, not keep showing the value it last held locally.
    const { container, rerender } = render(FacetedFilterBar, {
      facets: [STATUS_FACET],
      appliedFilters: [],
    });
    let statusSelect = container.querySelector<HTMLSelectElement>(
      '[aria-label="Status"].cinder-faceted-filter-bar__select',
    )!;
    // User picks a value — in a real app this commits to appliedFilters via the
    // onfacetchange callback; here we drive both the local change and the
    // resulting controlled prop to model that round-trip.
    statusSelect.value = 'failed';
    await fireEvent.change(statusSelect);
    await rerender({
      facets: [STATUS_FACET],
      appliedFilters: [{ key: 'status', value: 'failed', label: 'Status' }],
    });
    statusSelect = container.querySelector<HTMLSelectElement>(
      '[aria-label="Status"].cinder-faceted-filter-bar__select',
    )!;
    expect(statusSelect.value).toBe('failed');
    // Parent clears all filters. The select must reset even though it was the
    // control the user last interacted with.
    await rerender({ facets: [STATUS_FACET], appliedFilters: [] });
    statusSelect = container.querySelector<HTMLSelectElement>(
      '[aria-label="Status"].cinder-faceted-filter-bar__select',
    )!;
    expect(statusSelect.value).toBe('');
  });

  test('hides chips row when no applied filters', () => {
    const { container } = render(FacetedFilterBar, { appliedFilters: [] });
    const chipsRow = container.querySelector('.cinder-faceted-filter-bar__chips');
    expect(chipsRow).toBeNull();
  });

  test('renders clear-all button when there are applied filters', () => {
    const { container } = render(FacetedFilterBar, {
      appliedFilters: [{ key: 'status', value: 'failed', label: 'Status' }],
    });
    const clearAll = container.querySelector('.cinder-faceted-filter-bar__clear-all');
    expect(clearAll).not.toBeNull();
    expect(clearAll?.textContent?.trim()).toBe('Clear all');
  });

  test('renders clear-all button when only searchQuery is non-empty (no chips)', () => {
    const { container } = render(FacetedFilterBar, {
      searchQuery: 'my workflow',
      appliedFilters: [],
    });
    const clearAll = container.querySelector('.cinder-faceted-filter-bar__clear-all');
    expect(clearAll).not.toBeNull();
  });
});

describe('FacetedFilterBar behavior', () => {
  test('calls onsearchchange when search input changes', async () => {
    const onsearchchange = mock((_query: string) => {});
    const { container } = render(FacetedFilterBar, { onsearchchange });
    const input = container.querySelector<HTMLInputElement>('.cinder-search-field__input');
    expect(input).not.toBeNull();
    await fireEvent.input(input!, { target: { value: 'my workflow' } });
    expect(onsearchchange).toHaveBeenCalledWith('my workflow');
  });

  test('calls onfacetchange when a select facet changes', async () => {
    const onfacetchange = mock((_key: string, _value: string) => {});
    const { container } = render(FacetedFilterBar, {
      facets: [STATUS_FACET],
      onfacetchange,
    });
    const select = container.querySelector<HTMLSelectElement>('.cinder-faceted-filter-bar__select');
    expect(select).not.toBeNull();
    await fireEvent.change(select!, { target: { value: 'failed' } });
    expect(onfacetchange).toHaveBeenCalledWith('status', 'failed');
  });

  test('calls onfilterremove with the chip key when a chip remove button is clicked', async () => {
    const onfilterremove = mock((_key: string) => {});
    const { container } = render(FacetedFilterBar, {
      appliedFilters: [{ key: 'status', value: 'failed', label: 'Status' }],
      onfilterremove,
    });
    const removeButton = container.querySelector<HTMLButtonElement>('.cinder-chip__remove');
    expect(removeButton).not.toBeNull();
    await fireEvent.click(removeButton!);
    expect(onfilterremove).toHaveBeenCalledWith('status');
  });

  test('calls onclearall when clear-all button is clicked', async () => {
    const onclearall = mock(() => {});
    const { container } = render(FacetedFilterBar, {
      appliedFilters: [{ key: 'status', value: 'failed', label: 'Status' }],
      onclearall,
    });
    const clearAll = container.querySelector<HTMLButtonElement>(
      '.cinder-faceted-filter-bar__clear-all',
    );
    expect(clearAll).not.toBeNull();
    await fireEvent.click(clearAll!);
    expect(onclearall).toHaveBeenCalled();
  });

  test('disabled prop disables all select facets', () => {
    const { container } = render(FacetedFilterBar, {
      facets: [STATUS_FACET, QUEUE_FACET],
      disabled: true,
    });
    const selects = container.querySelectorAll<HTMLSelectElement>(
      '.cinder-faceted-filter-bar__select',
    );
    expect(selects).toHaveLength(2);
    for (const select of selects) {
      expect(select.disabled).toBe(true);
    }
  });

  test('disabled prop disables the clear-all button', () => {
    const { container } = render(FacetedFilterBar, {
      appliedFilters: [{ key: 'status', value: 'failed', label: 'Status' }],
      disabled: true,
    });
    const clearAll = container.querySelector<HTMLButtonElement>(
      '.cinder-faceted-filter-bar__clear-all',
    );
    expect(clearAll?.disabled).toBe(true);
  });

  test('sets data-disabled on root when disabled', () => {
    const { container } = render(FacetedFilterBar, { disabled: true });
    const root = container.querySelector('.cinder-faceted-filter-bar');
    expect(root?.hasAttribute('data-disabled')).toBe(true);
  });

  test('searchPlaceholder prop is forwarded to the search input', () => {
    const { container } = render(FacetedFilterBar, { searchPlaceholder: 'Filter workflows…' });
    const input = container.querySelector<HTMLInputElement>('.cinder-search-field__input');
    expect(input?.getAttribute('placeholder')).toBe('Filter workflows…');
  });
});

describe('FacetedFilterBar accessibility', () => {
  test('applied-filter chip has an accessible remove label including filter key and value', () => {
    const { container } = render(FacetedFilterBar, {
      appliedFilters: [{ key: 'status', value: 'failed', label: 'Status' }],
    });
    const removeButton = container.querySelector<HTMLButtonElement>('.cinder-chip__remove');
    const ariaLabel = removeButton?.getAttribute('aria-label') ?? '';
    expect(ariaLabel).toContain('Status');
    expect(ariaLabel).toContain('failed');
  });

  test('each select facet has an associated label (visually hidden or aria-label)', () => {
    const { container } = render(FacetedFilterBar, { facets: [STATUS_FACET] });
    const select = container.querySelector<HTMLSelectElement>('.cinder-faceted-filter-bar__select');
    // Either aria-label or a for/id pair must exist
    const hasAriaLabel = select?.hasAttribute('aria-label');
    const hasId = select?.hasAttribute('id');
    const labelFor = hasId ? container.querySelector(`label[for="${select!.id}"]`) : null;
    expect(hasAriaLabel || labelFor !== null).toBe(true);
  });

  test('always renders a live region for filter-count announcements', () => {
    const { container } = render(FacetedFilterBar, {});
    // The visually-hidden live region is always in the DOM
    const liveRegion = container.querySelector('[aria-live]');
    expect(liveRegion).not.toBeNull();
  });

  test('live region summarizes applied filters', async () => {
    const { container } = render(FacetedFilterBar, {
      appliedFilters: [
        { key: 'status', value: 'failed', label: 'Status' },
        { key: 'queue', value: 'default', label: 'Queue' },
      ],
    });
    // The _VisuallyHiddenLiveRegion defers by setTimeout(0); give it a tick
    await new Promise((resolve) => setTimeout(resolve, 10));
    const liveRegion = container.querySelector('[aria-live]');
    expect(liveRegion?.textContent).toContain('2 active filters');
  });

  test('active controls row has accessible label for screen readers', () => {
    const { container } = render(FacetedFilterBar, {
      appliedFilters: [{ key: 'status', value: 'running', label: 'Status' }],
    });
    const chipsRow = container.querySelector('.cinder-faceted-filter-bar__chips');
    expect(chipsRow?.getAttribute('aria-label')).toBe('Active filter controls');
  });

  test('search field renders with type="search" for semantic meaning', () => {
    const { container } = render(FacetedFilterBar, {});
    const input = container.querySelector('input[type="search"]');
    expect(input).not.toBeNull();
  });
});

describe('FacetedFilterBar CSS snapshot', () => {
  test('CSS file exists and contains required layer and selectors', async () => {
    const css = await Bun.file(new URL('./faceted-filter-bar.css', import.meta.url)).text();

    expect(css).toContain('@layer cinder.components');
    expect(css).toContain('.cinder-faceted-filter-bar');
    expect(css).toContain('.cinder-faceted-filter-bar__select:focus-visible');
    expect(css).toContain('outline: var(--cinder-ring-width) solid transparent');
    expect(css).toContain('@media (forced-colors: active)');
    expect(css).toContain('outline: var(--cinder-ring-width) solid ButtonText');
    expect(css).toContain('.cinder-faceted-filter-bar__select:focus-visible');
  });
});
