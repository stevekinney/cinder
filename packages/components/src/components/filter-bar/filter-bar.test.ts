/// <reference lib="dom" />
import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test';
import { createRawSnippet, tick } from 'svelte';

import { setupHappyDom } from '../../test/happy-dom.ts';

// setupHappyDom() MUST run before any `@testing-library/svelte` import. testing-library
// reads `globalThis.document` / `window` at module-init (top-level, not inside test bodies),
// so we register happy-dom's globals first and then dynamic-import testing-library below.
setupHappyDom();

const { cleanup, fireEvent, render } = await import('@testing-library/svelte');
const { default: FilterBar } = await import('./filter-bar.svelte');

/**
 * Slice one rule body out of a stylesheet, failing loudly when the selector is gone.
 *
 * Nested `indexOf` calls without this guard silently produce `-1` boundaries when a
 * selector is renamed, so the slice comes back as garbage and the assertion fails with
 * an unrelated-looking message instead of "that selector no longer exists".
 */
function ruleBody(css: string, selector: string): string {
  const opening = `${selector} {`;
  const start = css.indexOf(opening);
  if (start === -1) {
    throw new Error(`Expected filter-bar.css to contain a rule for \`${selector}\``);
  }
  const end = css.indexOf('}', start);
  if (end === -1) {
    throw new Error(`Unterminated rule for \`${selector}\` in filter-bar.css`);
  }
  return css.slice(start, end);
}

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

describe('FilterBar structure', () => {
  test('renders root element with cinder-filter-bar class', () => {
    const { container } = render(FilterBar, {});
    const root = container.querySelector('.cinder-filter-bar');
    expect(root).not.toBeNull();
  });

  test('applies role="search" for accessible landmark', () => {
    const { container } = render(FilterBar, {});
    const root = container.querySelector('.cinder-filter-bar');
    expect(root?.getAttribute('role')).toBe('search');
  });

  test('applies aria-label from prop', () => {
    const { container } = render(FilterBar, { 'aria-label': 'Workflow filters' } as any);
    const root = container.querySelector('.cinder-filter-bar');
    expect(root?.getAttribute('aria-label')).toBe('Workflow filters');
  });

  test('root landmark role cannot be overridden by rest attributes', () => {
    const { container } = render(FilterBar, {
      role: 'presentation',
      'aria-label': 'Workflow filters',
    } as never);
    const root = container.querySelector('.cinder-filter-bar');
    expect(root?.getAttribute('role')).toBe('search');
    expect(root?.getAttribute('aria-label')).toBe('Workflow filters');
  });

  test('merges a custom class alongside cinder-filter-bar', () => {
    const { container } = render(FilterBar, { class: 'custom-class' });
    const root = container.querySelector('.cinder-filter-bar');
    expect(root?.classList.contains('cinder-filter-bar')).toBe(true);
    expect(root?.classList.contains('custom-class')).toBe(true);
  });

  test('renders the search field', () => {
    const { container } = render(FilterBar, {});
    const searchField = container.querySelector('.cinder-search-field');
    expect(searchField).not.toBeNull();
  });

  test('searchVisible=false omits the search field while preserving facet controls', () => {
    const { container } = render(FilterBar, {
      searchVisible: false,
      searchQuery: 'hidden query',
      facets: [STATUS_FACET],
    });
    expect(container.querySelector('.cinder-search-field')).toBeNull();
    expect(container.querySelector('[aria-label="Status"]')).not.toBeNull();
    expect(container.querySelector('.cinder-filter-bar__chips')).toBeNull();
  });

  test('renders select facets from facets prop', () => {
    const { container } = render(FilterBar, {
      facets: [STATUS_FACET, QUEUE_FACET],
    });
    const selects = container.querySelectorAll('.cinder-filter-bar__select');
    expect(selects).toHaveLength(2);
  });

  test('renders facet options including placeholder', () => {
    const { container } = render(FilterBar, { facets: [STATUS_FACET] });
    const options = container.querySelectorAll('.cinder-filter-bar__select option');
    // placeholder + 3 options
    expect(options).toHaveLength(4);
    expect(options[0]?.textContent).toBe('All statuses');
  });

  test('renders applied-filter chips when appliedFilters is provided', () => {
    const { container } = render(FilterBar, {
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
    const { container } = render(FilterBar, {
      facets: [STATUS_FACET, QUEUE_FACET],
      appliedFilters: [{ key: 'status', value: 'failed', label: 'Status' }],
    });
    const statusSelect = container.querySelector<HTMLSelectElement>(
      '[aria-label="Status"].cinder-filter-bar__select',
    );
    const queueSelect = container.querySelector<HTMLSelectElement>(
      '[aria-label="Queue"].cinder-filter-bar__select',
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
    const { container, rerender } = render(FilterBar, {
      facets: [STATUS_FACET],
      appliedFilters: [],
    });
    let statusSelect = container.querySelector<HTMLSelectElement>(
      '[aria-label="Status"].cinder-filter-bar__select',
    )!;
    // User picks a value — in a real app this commits to appliedFilters via the
    // onFacetChange callback; here we drive both the local change and the
    // resulting controlled prop to model that round-trip.
    statusSelect.value = 'failed';
    await fireEvent.change(statusSelect);
    await rerender({
      facets: [STATUS_FACET],
      appliedFilters: [{ key: 'status', value: 'failed', label: 'Status' }],
    });
    statusSelect = container.querySelector<HTMLSelectElement>(
      '[aria-label="Status"].cinder-filter-bar__select',
    )!;
    expect(statusSelect.value).toBe('failed');
    // Parent clears all filters. The select must reset even though it was the
    // control the user last interacted with.
    await rerender({ facets: [STATUS_FACET], appliedFilters: [] });
    statusSelect = container.querySelector<HTMLSelectElement>(
      '[aria-label="Status"].cinder-filter-bar__select',
    )!;
    expect(statusSelect.value).toBe('');
  });

  test('hides chips row when no applied filters', () => {
    const { container } = render(FilterBar, { appliedFilters: [] });
    const chipsRow = container.querySelector('.cinder-filter-bar__chips');
    expect(chipsRow).toBeNull();
  });

  test('renders clear-all button when there are applied filters', () => {
    const { container } = render(FilterBar, {
      appliedFilters: [{ key: 'status', value: 'failed', label: 'Status' }],
    });
    const clearAll = container.querySelector('.cinder-filter-bar__clear-all');
    expect(clearAll).not.toBeNull();
    expect(clearAll?.textContent?.trim()).toBe('Clear all');
  });

  test('renders clear-all button when only searchQuery is non-empty (no chips)', () => {
    const { container } = render(FilterBar, {
      searchQuery: 'my workflow',
      appliedFilters: [],
    });
    const clearAll = container.querySelector('.cinder-filter-bar__clear-all');
    expect(clearAll).not.toBeNull();
  });
});

describe('FilterBar behavior', () => {
  test('calls onSearchChange when search input changes', async () => {
    const onSearchChange = mock((_query: string) => {});
    const { container } = render(FilterBar, { onSearchChange });
    const input = container.querySelector<HTMLInputElement>('.cinder-search-field__input');
    expect(input).not.toBeNull();
    await fireEvent.input(input!, { target: { value: 'my workflow' } });
    expect(onSearchChange).toHaveBeenCalledWith('my workflow');
  });

  test('calls onFacetChange when a select facet changes', async () => {
    const onFacetChange = mock((_key: string, _value: string) => {});
    const { container } = render(FilterBar, {
      facets: [STATUS_FACET],
      onFacetChange,
    });
    const select = container.querySelector<HTMLSelectElement>('.cinder-filter-bar__select');
    expect(select).not.toBeNull();
    await fireEvent.change(select!, { target: { value: 'failed' } });
    expect(onFacetChange).toHaveBeenCalledWith('status', 'failed');
  });

  test('calls onFilterRemove with the chip key when a chip remove button is clicked', async () => {
    const onFilterRemove = mock((_key: string) => {});
    const { container } = render(FilterBar, {
      appliedFilters: [{ key: 'status', value: 'failed', label: 'Status' }],
      onFilterRemove,
    });
    const removeButton = container.querySelector<HTMLButtonElement>('.cinder-chip__remove');
    expect(removeButton).not.toBeNull();
    await fireEvent.click(removeButton!);
    expect(onFilterRemove).toHaveBeenCalledWith('status');
  });

  test('calls onClearAll when clear-all button is clicked', async () => {
    const onClearAll = mock(() => {});
    const { container } = render(FilterBar, {
      appliedFilters: [{ key: 'status', value: 'failed', label: 'Status' }],
      onClearAll,
    });
    const clearAll = container.querySelector<HTMLButtonElement>('.cinder-filter-bar__clear-all');
    expect(clearAll).not.toBeNull();
    await fireEvent.click(clearAll!);
    expect(onClearAll).toHaveBeenCalled();
  });

  test('disabled prop disables all select facets', () => {
    const { container } = render(FilterBar, {
      facets: [STATUS_FACET, QUEUE_FACET],
      disabled: true,
    });
    const selects = container.querySelectorAll<HTMLSelectElement>('.cinder-filter-bar__select');
    expect(selects).toHaveLength(2);
    for (const select of selects) {
      expect(select.disabled).toBe(true);
    }
  });

  test('disabled prop disables the clear-all button', () => {
    const { container } = render(FilterBar, {
      appliedFilters: [{ key: 'status', value: 'failed', label: 'Status' }],
      disabled: true,
    });
    const clearAll = container.querySelector<HTMLButtonElement>('.cinder-filter-bar__clear-all');
    expect(clearAll?.disabled).toBe(true);
  });

  test('sets data-disabled on root when disabled', () => {
    const { container } = render(FilterBar, { disabled: true });
    const root = container.querySelector('.cinder-filter-bar');
    expect(root?.hasAttribute('data-disabled')).toBe(true);
  });

  test('searchPlaceholder prop is forwarded to the search input', () => {
    const { container } = render(FilterBar, { searchPlaceholder: 'Filter workflows…' });
    const input = container.querySelector<HTMLInputElement>('.cinder-search-field__input');
    expect(input?.getAttribute('placeholder')).toBe('Filter workflows…');
  });
});

describe('FilterBar accessibility', () => {
  test('applied-filter chip has an accessible remove label including filter key and value', () => {
    const { container } = render(FilterBar, {
      appliedFilters: [{ key: 'status', value: 'failed', label: 'Status' }],
    });
    const removeButton = container.querySelector<HTMLButtonElement>('.cinder-chip__remove');
    const ariaLabel = removeButton?.getAttribute('aria-label') ?? '';
    expect(ariaLabel).toContain('Status');
    expect(ariaLabel).toContain('failed');
  });

  test('each select facet has an associated label (visually hidden or aria-label)', () => {
    const { container } = render(FilterBar, { facets: [STATUS_FACET] });
    const select = container.querySelector<HTMLSelectElement>('.cinder-filter-bar__select');
    // Either aria-label or a for/id pair must exist
    const hasAriaLabel = select?.hasAttribute('aria-label');
    const hasId = select?.hasAttribute('id');
    const labelFor = hasId ? container.querySelector(`label[for="${select!.id}"]`) : null;
    expect(hasAriaLabel || labelFor !== null).toBe(true);
  });

  test('always renders a live region for filter-count announcements', () => {
    const { container } = render(FilterBar, {});
    // The visually-hidden live region is always in the DOM. Scoped to
    // `[role="status"]` (not the broader `[aria-live]`) because the embedded
    // SearchField's Input also carries `aria-live="polite"` on its
    // always-mounted error node (CIN-315) and would otherwise collide.
    const liveRegion = container.querySelector('[role="status"]');
    expect(liveRegion).not.toBeNull();
  });

  test('live region summarizes applied filters', async () => {
    const { container } = render(FilterBar, {
      appliedFilters: [
        { key: 'status', value: 'failed', label: 'Status' },
        { key: 'queue', value: 'default', label: 'Queue' },
      ],
    });
    // No waitFor / timeout knob (repository policy rejects any widened wait
    // threshold): await the exact scheduling primitive the announcement
    // uses instead of polling for it. `_VisuallyHiddenLiveRegion`'s $effect
    // runs on the next `tick()`, and defers the actual text-set to the next
    // task via `setTimeout(0)` (see its own doc comment for why: a same-task
    // blank+set can be seen by some ATs as a single no-op). Awaiting `tick()`
    // then a real zero-delay `setTimeout` puts this assertion on the far
    // side of both of those without polling or a configurable deadline.
    await tick();
    await new Promise((resolve) => setTimeout(resolve, 0));
    // Scoped to `[role="status"]` (not the broader `[aria-live]`) because
    // the embedded SearchField's Input also carries `aria-live="polite"` on
    // its always-mounted error node (CIN-315) and would otherwise collide —
    // `[aria-live]` matched Input's empty error node first in DOM order.
    const liveRegion = container.querySelector('[role="status"]');
    expect(liveRegion?.textContent).toContain('2 active filters');
  });

  test('active controls row has accessible label for screen readers', () => {
    const { container } = render(FilterBar, {
      appliedFilters: [{ key: 'status', value: 'running', label: 'Status' }],
    });
    const chipsRow = container.querySelector('.cinder-filter-bar__chips');
    expect(chipsRow?.getAttribute('aria-label')).toBe('Active filter controls');
  });

  test('search field renders with type="search" for semantic meaning', () => {
    const { container } = render(FilterBar, {});
    const input = container.querySelector('input[type="search"]');
    expect(input).not.toBeNull();
  });
});

// Chip's root template branches on `mode` ({#if mode === 'toggle'} ... {:else if
// mode === 'removable'} ... {:else} ...), and a keyed `{#each}` of that component
// does not reliably reflect array-shrink removals under happy-dom (the same class
// of pre-existing keyed-each/happy-dom limitation already documented elsewhere in
// this repo for list length changes — see chat's keyed-each length-growth notes).
// `handleFilterRemove` queries the *live* DOM directly, so these tests reproduce
// what a real re-render would leave behind by removing the chip node directly,
// rather than relying on the broken reactive teardown.
describe('FilterBar chip-remove focus management', () => {
  test('removing an applied chip (not the last one) focuses the next remove button at the same index', async () => {
    let removedButton: HTMLButtonElement | null = null;
    const { container } = render(FilterBar, {
      appliedFilters: [
        { key: 'status', value: 'failed', label: 'Status' },
        { key: 'queue', value: 'default', label: 'Queue' },
        { key: 'priority', value: 'high', label: 'Priority' },
      ],
      onFilterRemove: () => {
        removedButton?.closest('.cinder-chip')?.remove();
      },
    });

    const removeButtons = container.querySelectorAll<HTMLButtonElement>('.cinder-chip__remove');
    expect(removeButtons).toHaveLength(3);
    removedButton = removeButtons[1]!; // 'queue', not the last chip

    await fireEvent.click(removedButton);

    const remainingButtons = container.querySelectorAll<HTMLButtonElement>('.cinder-chip__remove');
    expect(remainingButtons).toHaveLength(2);
    // 'priority' shifts from index 2 to index 1 — focus lands on the button
    // now occupying the removed chip's index.
    expect(document.activeElement).toBe(remainingButtons[1]!);
  });

  test('removing the last remaining chip falls back to the matching facet select', async () => {
    let removedButton: HTMLButtonElement | null = null;
    const { container } = render(FilterBar, {
      facets: [STATUS_FACET],
      appliedFilters: [{ key: 'status', value: 'failed', label: 'Status' }],
      onFilterRemove: () => {
        removedButton?.closest('.cinder-chip')?.remove();
      },
    });

    removedButton = container.querySelector<HTMLButtonElement>('.cinder-chip__remove')!;
    await fireEvent.click(removedButton);

    expect(container.querySelector('.cinder-chip__remove')).toBeNull();
    const statusSelect = container.querySelector<HTMLSelectElement>(
      '[aria-label="Status"].cinder-filter-bar__select',
    );
    expect(document.activeElement).toBe(statusSelect);
  });

  test('removing the last remaining chip falls back to the search input when no facet select matches', async () => {
    let removedButton: HTMLButtonElement | null = null;
    const { container } = render(FilterBar, {
      facets: [STATUS_FACET], // no facet with key "owner"
      appliedFilters: [{ key: 'owner', value: 'me', label: 'Owner' }],
      onFilterRemove: () => {
        removedButton?.closest('.cinder-chip')?.remove();
      },
    });

    removedButton = container.querySelector<HTMLButtonElement>('.cinder-chip__remove')!;
    await fireEvent.click(removedButton);

    expect(container.querySelector('.cinder-chip__remove')).toBeNull();
    const searchInput = container.querySelector<HTMLInputElement>('.cinder-search-field__input');
    expect(document.activeElement).toBe(searchInput);
  });
});

describe('FilterBar custom facets', () => {
  test('renders a custom facet via its control snippet and forwards onValueChange to onFacetChange', async () => {
    const onFacetChange = mock((_key: string, _value: string) => {});
    const controlSnippet = createRawSnippet<
      [{ value: string; onValueChange: (value: string) => void }]
    >((getProps) => ({
      render: () => `<button type="button" class="filter-bar-test-custom-control">Pick</button>`,
      setup(element: Element) {
        const handleClick = () => getProps().onValueChange('me');
        element.addEventListener('click', handleClick);
        return () => element.removeEventListener('click', handleClick);
      },
    }));

    const { container } = render(FilterBar, {
      facets: [{ type: 'custom', key: 'owner', label: 'Owner', control: controlSnippet }],
      onFacetChange,
    });

    const customControl = container.querySelector<HTMLButtonElement>(
      '.filter-bar-test-custom-control',
    );
    expect(customControl?.textContent).toBe('Pick');

    await fireEvent.click(customControl!);

    expect(onFacetChange).toHaveBeenCalledWith('owner', 'me');
  });

  test('passes the bar-level disabled state to the custom-facet snippet', () => {
    const controlSnippet = createRawSnippet<
      [{ value: string; onValueChange: (value: string) => void; disabled: boolean }]
    >((getProps) => ({
      render: () => `<button type="button" class="filter-bar-test-custom-control">Pick</button>`,
      setup(element: Element) {
        if (getProps().disabled) {
          element.setAttribute('disabled', '');
        }
      },
    }));

    const { container } = render(FilterBar, {
      facets: [{ type: 'custom', key: 'owner', label: 'Owner', control: controlSnippet }],
      disabled: true,
    });

    const customControl = container.querySelector<HTMLButtonElement>(
      '.filter-bar-test-custom-control',
    );
    expect(customControl?.hasAttribute('disabled')).toBe(true);
  });
});

describe('FilterBar CSS snapshot', () => {
  test('CSS file exists and contains required layer and selectors', async () => {
    const css = await Bun.file(new URL('./filter-bar.css', import.meta.url)).text();

    expect(css).toContain('@layer cinder.components');
    expect(css).toContain('.cinder-filter-bar');
    expect(css).toContain('.cinder-filter-bar__select:focus-visible');
    expect(css).toContain('min-block-size: var(--cinder-control-height-sm, 2rem);');
    expect(css).not.toMatch(/^\s*block-size: var\(--cinder-control-height-sm, 2rem\);/m);
    expect(css).toContain('outline: var(--cinder-ring-width) solid transparent');
    expect(css).toContain('@media (forced-colors: active)');
    expect(css).toContain('outline: var(--cinder-ring-width) solid ButtonText');
    expect(css).toContain('.cinder-filter-bar__select:focus-visible');
  });

  // CIN-335: the controls row used raw `flex-wrap: wrap`, so facets on a
  // wrapped row packed to their own content width instead of lining up
  // under the facets above them, and `.cinder-filter-bar__search`'s
  // `flex: 1 1 14rem` let flex-grow absorb every pixel of leftover row
  // space. happy-dom does not model `@container` at all (see grid.css's
  // own doc comment on this), so — like grid.test.ts's container-query
  // tests — these assert on the raw CSS source rather than computed
  // layout.
  test('controls row is driven by a container query, not raw flex-wrap', async () => {
    const css = await Bun.file(new URL('./filter-bar.css', import.meta.url)).text();

    expect(css).toContain('container-type: inline-size;');
    expect(css).toContain('container-name: cinder-filter-bar;');
    expect(css).toContain('@container cinder-filter-bar (min-width: 40rem)');

    const controlsRule = ruleBody(css, '.cinder-filter-bar__controls');
    expect(controlsRule).toContain('display: grid;');
    expect(controlsRule).not.toContain('flex-wrap');

    const containerRule = css.slice(css.indexOf('@container cinder-filter-bar (min-width: 40rem)'));
    expect(containerRule).toContain('grid-template-columns:');
    expect(containerRule).toContain('repeat(auto-fit, minmax(9rem, max-content))');
  });

  test('search field track has a bounded max width instead of flex-grow', async () => {
    const css = await Bun.file(new URL('./filter-bar.css', import.meta.url)).text();

    // The search field's own rule no longer declares a growing `flex`
    // shorthand — its width now comes from the grid track.
    const searchRule = ruleBody(css, '.cinder-filter-bar__search');
    expect(searchRule).not.toContain('flex:');
    expect(searchRule).not.toContain('flex-grow');

    // The search spans the row rather than occupying a track of its own, and is
    // capped rather than handed an unbounded `1fr`.
    expect(css).toContain('grid-column: 1 / -1;');
    expect(css).toContain('max-inline-size: 20rem;');
    expect(css).not.toMatch(/grid-template-columns:\s*minmax\([^)]*,\s*1fr\)/);
  });

  test('every facet sits in an identically sized track, including after a wrap', async () => {
    const css = await Bun.file(new URL('./filter-bar.css', import.meta.url)).text();

    // The search must NOT be a grid track. When it was, auto-placement wrapped the
    // next overflowing facet into column 1 — the wide search track — rendering that
    // one facet far wider than its siblings and reintroducing the ragged alignment
    // this issue removes, just at the wrap boundary instead of within a row.
    const containerRule = css.slice(css.indexOf('@container cinder-filter-bar (min-width: 40rem)'));
    expect(containerRule).toMatch(
      /grid-template-columns:\s*repeat\(auto-fit,\s*minmax\(9rem,\s*max-content\)\);/,
    );
    expect(containerRule).not.toContain('minmax(14rem, 20rem) repeat(');
  });

  test('the facet select fills its wrapper so the chevron stays attached', async () => {
    const css = await Bun.file(new URL('./filter-bar.css', import.meta.url)).text();

    // The chevron is absolutely positioned against `.cinder-filter-bar__facet`. In the
    // stacked single-column layout the wrapper stretches to the full row while a native
    // select stays content-sized, leaving the chevron floating in the gap beside it.
    const selectInFacetRule = ruleBody(css, '.cinder-filter-bar__facet .cinder-filter-bar__select');
    expect(selectInFacetRule).toContain('flex: 1 1 auto;');
  });
});
