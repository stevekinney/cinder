/// <reference lib="dom" />
import { describe, expect, mock, test } from 'bun:test';
import { tick } from 'svelte';

import { stripCinderComponentsLayer } from '../../test/css.ts';
import { setupHappyDom } from '../../test/happy-dom.ts';
import type { TableScrollContainerProps } from './table.types.ts';

setupHappyDom();

const { render, fireEvent } = await import('@testing-library/svelte');
const { default: Wrapper } = await import('../../test/fixtures/table-fixture.svelte');

// Strip the @layer wrapper: happy-dom does not apply layer-nested rules to
// getComputedStyle or expose them as top-level CSSStyleRules.
const tableCss = stripCinderComponentsLayer(
  await Bun.file(new URL('./table.css', import.meta.url)).text(),
);

const columns = [
  { key: 'name', label: 'Name', sortable: true },
  { key: 'age', label: 'Age', sortable: true },
  { key: 'role', label: 'Role' },
];
const rows = [
  { id: '1', cells: ['Alice', '30', 'Engineer'] },
  { id: '2', cells: ['Bob', '25', 'Designer'] },
];

function unsafeScrollContainerProps(props: Record<string, unknown>): TableScrollContainerProps {
  return props as unknown as TableScrollContainerProps;
}

describe('Table semantics', () => {
  test('renders semantic <table>, <thead>, <tbody> elements', () => {
    const { container } = render(Wrapper, { columns, rows });
    expect(container.querySelector('table')).not.toBeNull();
    expect(container.querySelector('thead')).not.toBeNull();
    expect(container.querySelector('tbody')).not.toBeNull();
  });

  test('renders a <caption> when the caption prop is supplied', () => {
    const { container } = render(Wrapper, { columns, rows, caption: 'Team' });
    const caption = container.querySelector('caption');
    expect(caption).not.toBeNull();
    expect(caption?.textContent?.trim()).toBe('Team');
  });

  test('omits whitespace-only captions before rendering or measuring', () => {
    const { container } = render(Wrapper, {
      columns,
      rows,
      caption: '   ',
      stickyHeader: true,
    });
    const table = container.querySelector('table');
    expect(table?.querySelector('caption')).toBeNull();
    expect(table?.style.getPropertyValue('--cinder-table-caption-height')).toBe('');
  });

  test('renders one row per data row plus a header row', () => {
    const { container } = render(Wrapper, { columns, rows });
    const headerRows = container.querySelectorAll('thead tr');
    const bodyRows = container.querySelectorAll('tbody tr');
    expect(headerRows.length).toBe(1);
    expect(bodyRows.length).toBe(2);
  });

  test('scrollable=false renders the table without a scroll wrapper', () => {
    const { container } = render(Wrapper, { columns, rows });
    expect(container.querySelector('.cinder-table-scroll')).toBeNull();
  });

  test('scrollable=true wraps the composed table in the public scroll container', () => {
    const { container } = render(Wrapper, { columns, rows, scrollable: true });
    const wrapper = container.querySelector('.cinder-table-scroll');
    const table = container.querySelector('table');
    expect(wrapper).not.toBeNull();
    expect(wrapper?.tagName).toBe('DIV');
    expect(wrapper?.querySelector('table')).toBe(table);
    expect(table?.parentElement).toBe(wrapper as HTMLElement);
    expect(table?.querySelector('thead')).not.toBeNull();
    expect(table?.querySelector('tbody')).not.toBeNull();
  });

  test('scrollable=true makes the generated scroll wrapper a named focusable region by default', () => {
    const { container } = render(Wrapper, {
      columns,
      rows,
      scrollable: true,
      caption: 'Contributors',
    });
    const wrapper = container.querySelector('.cinder-table-scroll') as HTMLElement;
    expect(wrapper?.getAttribute('role')).toBe('region');
    expect(wrapper?.getAttribute('aria-label')).toBe('Contributors table scroll area');
    expect(wrapper?.getAttribute('tabindex')).toBe('0');
    expect(wrapper.tabIndex).toBe(0);
  });

  test('scrollable=true without a caption keeps the wrapper focusable without a duplicate region name', () => {
    const { container } = render(Wrapper, { columns, rows, scrollable: true });
    const wrapper = container.querySelector('.cinder-table-scroll') as HTMLElement;
    expect(wrapper?.hasAttribute('role')).toBe(false);
    expect(wrapper?.hasAttribute('aria-label')).toBe(false);
    expect(wrapper?.hasAttribute('aria-labelledby')).toBe(false);
    expect(wrapper?.getAttribute('tabindex')).toBe('0');
    expect(wrapper.tabIndex).toBe(0);
  });

  test('scrollContainerProps forwards attributes to the generated scroll wrapper', () => {
    const { container } = render(Wrapper, {
      columns,
      rows,
      scrollable: true,
      scrollContainerProps: {
        'aria-label': 'Scrollable contributors',
        class: 'custom-table-scroll',
        role: 'group',
        tabindex: -1,
      },
    });
    const wrapper = container.querySelector('.cinder-table-scroll') as HTMLElement;
    expect(wrapper?.getAttribute('aria-label')).toBe('Scrollable contributors');
    expect(wrapper?.getAttribute('role')).toBe('group');
    expect(wrapper?.classList.contains('cinder-table-scroll')).toBe(true);
    expect(wrapper?.classList.contains('custom-table-scroll')).toBe(true);
    expect(wrapper?.getAttribute('tabindex')).toBe('-1');
    expect(wrapper.tabIndex).toBe(-1);
  });

  test('scrollContainerProps normalizes empty ARIA names before falling back to the caption', () => {
    const { container } = render(Wrapper, {
      columns,
      rows,
      scrollable: true,
      caption: '  Quarterly revenue  ',
      scrollContainerProps: {
        'aria-label': '   ',
        'aria-labelledby': '',
      },
    });
    const wrapper = container.querySelector('.cinder-table-scroll');
    expect(wrapper?.getAttribute('aria-label')).toBe('Quarterly revenue table scroll area');
    expect(wrapper?.hasAttribute('aria-labelledby')).toBe(false);
  });

  test('scrollContainerProps normalizes empty roles before using the default named-region role', () => {
    const { container } = render(Wrapper, {
      columns,
      rows,
      scrollable: true,
      caption: 'Contributors',
      scrollContainerProps: {
        role: '  ',
      },
    });
    const wrapper = container.querySelector('.cinder-table-scroll');
    expect(wrapper?.getAttribute('role')).toBe('region');
  });

  test('scrollContainerProps normalizes invalid tabindex values before using the default', () => {
    const { container, rerender } = render(Wrapper, {
      columns,
      rows,
      scrollable: true,
      scrollContainerProps: unsafeScrollContainerProps({
        tabindex: '  ',
      }),
    });
    const wrapper = () => container.querySelector('.cinder-table-scroll') as HTMLElement;
    expect(wrapper().getAttribute('tabindex')).toBe('0');
    expect(wrapper().tabIndex).toBe(0);

    rerender({
      columns,
      rows,
      scrollable: true,
      scrollContainerProps: unsafeScrollContainerProps({
        tabindex: 'later',
      }),
    });
    expect(wrapper().getAttribute('tabindex')).toBe('0');
    expect(wrapper().tabIndex).toBe(0);

    rerender({
      columns,
      rows,
      scrollable: true,
      scrollContainerProps: unsafeScrollContainerProps({
        tabindex: ' -1 ',
      }),
    });
    expect(wrapper().getAttribute('tabindex')).toBe('-1');
    expect(wrapper().tabIndex).toBe(-1);
  });

  test('scrollContainerProps honors non-empty aria-labelledby over the default label', () => {
    const { container } = render(Wrapper, {
      columns,
      rows,
      scrollable: true,
      caption: 'Contributors',
      scrollContainerProps: {
        'aria-labelledby': 'table-scroll-label',
      },
    });
    const wrapper = container.querySelector('.cinder-table-scroll');
    expect(wrapper?.getAttribute('aria-labelledby')).toBe('table-scroll-label');
    expect(wrapper?.hasAttribute('aria-label')).toBe(false);
  });

  test('scrollable=true keeps Table props on the table element', () => {
    const { container } = render(Wrapper, {
      columns,
      rows,
      scrollable: true,
      caption: 'Scrollable team',
      stickyHeader: true,
    });
    const table = container.querySelector('table');
    expect(table?.getAttribute('data-cinder-sticky-header')).toBe('true');
    expect(table?.querySelector('caption')?.textContent?.trim()).toBe('Scrollable team');
  });

  test('stickyHeader with scrollable lets callers configure the generated sticky scroll container', () => {
    const { container } = render(Wrapper, {
      columns,
      rows,
      scrollable: true,
      stickyHeader: true,
      scrollContainerProps: {
        'aria-label': 'Scrollable sticky table',
        style: 'max-block-size: 20rem; overflow-y: auto;',
      },
    });
    const wrapper = container.querySelector('.cinder-table-scroll') as HTMLElement;
    const table = container.querySelector('table');
    expect(wrapper.getAttribute('aria-label')).toBe('Scrollable sticky table');
    expect(wrapper.getAttribute('style')).toContain('max-block-size: 20rem');
    expect(wrapper.getAttribute('style')).toContain('overflow-y: auto');
    expect(table?.getAttribute('data-cinder-sticky-header')).toBe('true');
    expect(table?.parentElement).toBe(wrapper);
  });

  test('scrollContainerProps are ignored when scrollable=false', () => {
    const { container } = render(Wrapper, {
      columns,
      rows,
      scrollContainerProps: {
        'aria-label': 'Unused scroll wrapper',
      },
    });
    expect(container.querySelector('.cinder-table-scroll')).toBeNull();
    expect(container.querySelector('table')?.getAttribute('aria-label')).toBeNull();
  });

  test('non-sortable header cells render plain text without an inner button', () => {
    const { container } = render(Wrapper, { columns, rows });
    const cells = Array.from(container.querySelectorAll('thead th'));
    const roleCell = cells[2];
    expect(roleCell?.querySelector('button')).toBeNull();
    expect(roleCell?.getAttribute('aria-sort')).toBeNull();
  });
});

describe('Table sort behavior', () => {
  test('sortable header cells render a button inside the th', () => {
    const { container } = render(Wrapper, { columns, rows });
    const cells = Array.from(container.querySelectorAll('thead th'));
    expect(cells[0]?.querySelector('button')).not.toBeNull();
    expect(cells[1]?.querySelector('button')).not.toBeNull();
  });

  test('sortable header cells render a double-chevron SVG indicator', () => {
    const { container } = render(Wrapper, { columns, rows });
    const indicator = container.querySelector('.cinder-table__sort-indicator');
    const chevrons = indicator?.querySelectorAll('svg polyline');
    expect(indicator?.querySelector('svg')).not.toBeNull();
    expect(chevrons?.length).toBe(2);
  });

  test('sortable header cells default to aria-sort="none"', () => {
    const { container } = render(Wrapper, { columns, rows });
    const cells = Array.from(container.querySelectorAll('thead th'));
    expect(cells[0]?.getAttribute('aria-sort')).toBe('none');
    expect(cells[1]?.getAttribute('aria-sort')).toBe('none');
  });

  test('aria-sort reflects the bound sort state', () => {
    const { container } = render(Wrapper, {
      columns,
      rows,
      sort: { column: 'name', direction: 'ascending' },
    });
    const cells = Array.from(container.querySelectorAll('thead th'));
    expect(cells[0]?.getAttribute('aria-sort')).toBe('ascending');
    expect(cells[1]?.getAttribute('aria-sort')).toBe('none');
  });

  test('clicking a sortable header sets sort to ascending for that column', async () => {
    const { container } = render(Wrapper, { columns, rows });
    const button = container.querySelector('thead th button') as HTMLButtonElement;
    expect(button).not.toBeNull();
    await fireEvent.click(button);
    const cells = Array.from(container.querySelectorAll('thead th'));
    expect(cells[0]?.getAttribute('aria-sort')).toBe('ascending');
  });

  test('clicking the same header again toggles to descending', async () => {
    const { container } = render(Wrapper, {
      columns,
      rows,
      sort: { column: 'name', direction: 'ascending' },
    });
    const button = container.querySelector('thead th button') as HTMLButtonElement;
    await fireEvent.click(button);
    const cells = Array.from(container.querySelectorAll('thead th'));
    expect(cells[0]?.getAttribute('aria-sort')).toBe('descending');
  });

  test('clicking a different sortable header switches column with ascending', async () => {
    const { container } = render(Wrapper, {
      columns,
      rows,
      sort: { column: 'name', direction: 'descending' },
    });
    const buttons = Array.from(container.querySelectorAll('thead th button'));
    await fireEvent.click(buttons[1] as HTMLButtonElement);
    const cells = Array.from(container.querySelectorAll('thead th'));
    expect(cells[0]?.getAttribute('aria-sort')).toBe('none');
    expect(cells[1]?.getAttribute('aria-sort')).toBe('ascending');
  });
});

describe('Table sticky header', () => {
  test('stickyHeader=true sets the data attribute on the table', () => {
    const { container } = render(Wrapper, { columns, rows, stickyHeader: true });
    expect(container.querySelector('table')?.hasAttribute('data-cinder-sticky-header')).toBe(true);
  });

  test('stickyHeader=false omits the data attribute', () => {
    const { container } = render(Wrapper, { columns, rows });
    expect(container.querySelector('table')?.hasAttribute('data-cinder-sticky-header')).toBe(false);
  });

  test('stickyHeader=true with caption renders a native <caption> inside the table (not a hoisted div)', () => {
    const { container } = render(Wrapper, { columns, rows, stickyHeader: true, caption: 'Sticky' });
    // A real <caption> is the accessible name source; the sticky case must NOT
    // downgrade to an external aria-labelledby'd div (lost table-caption semantics).
    const caption = container.querySelector('caption');
    expect(caption).not.toBeNull();
    expect(caption?.textContent?.trim()).toBe('Sticky');
    // The caption lives in the table subtree.
    expect(caption?.closest('table')).not.toBeNull();
    // No hoisted div, no external label.
    expect(container.querySelector('.cinder-table__caption--hoisted')).toBeNull();
    expect(container.querySelector('table')?.hasAttribute('aria-labelledby')).toBe(false);
  });

  test('stickyHeader=false with caption renders the same native <caption> (one code path)', () => {
    const { container } = render(Wrapper, {
      columns,
      rows,
      stickyHeader: false,
      caption: 'Native',
    });
    expect(container.querySelector('caption')?.textContent?.trim()).toBe('Native');
    expect(container.querySelector('.cinder-table__caption--hoisted')).toBeNull();
    expect(container.querySelector('table')?.hasAttribute('aria-labelledby')).toBe(false);
  });

  test('stickyHeader=true without caption renders no caption at all', () => {
    const { container } = render(Wrapper, { columns, rows, stickyHeader: true });
    expect(container.querySelector('.cinder-table__caption--hoisted')).toBeNull();
    expect(container.querySelector('caption')).toBeNull();
  });
});

// A wrapped, multi-line caption is taller than `1lh`, so the prior hard-coded
// sticky offset (`calc(space-3 + space-2 + 1lh)`) would let the pinned header
// overlap the caption's lower lines. The fix measures the caption's real
// border-box height with a ResizeObserver and feeds it to the sticky `top` via
// the `--cinder-table-caption-height` custom property. happy-dom has no layout
// engine, so the visual non-overlap is a Playwright concern — here we verify the
// measurement WIRING (observer entry → custom property), which is the part that
// regresses in JS. The hard-coded-to-variable swap in the CSS is asserted below.
describe('Table sticky-header caption measurement', () => {
  /** Captures the ResizeObserver callback the table registers so the test can
   *  drive it with a synthetic entry carrying a known border-box height. */
  class CapturingResizeObserver implements ResizeObserver {
    static lastCallback: ResizeObserverCallback | null = null;
    static lastObserver: CapturingResizeObserver | null = null;
    readonly observed: Element[] = [];
    constructor(callback: ResizeObserverCallback) {
      CapturingResizeObserver.lastCallback = callback;
      CapturingResizeObserver.lastObserver = this;
    }
    observe(target: Element): void {
      this.observed.push(target);
    }
    unobserve(): void {}
    disconnect(): void {}
  }

  async function withResizeObserver(run: () => void | Promise<void>): Promise<void> {
    const original = globalThis.ResizeObserver;
    CapturingResizeObserver.lastCallback = null;
    CapturingResizeObserver.lastObserver = null;
    globalThis.ResizeObserver = CapturingResizeObserver as unknown as typeof ResizeObserver;
    try {
      await run();
    } finally {
      globalThis.ResizeObserver = original;
    }
  }

  test('writes the measured caption border-box height into --cinder-table-caption-height', async () => {
    await withResizeObserver(async () => {
      const { container } = render(Wrapper, {
        columns,
        rows,
        stickyHeader: true,
        caption: 'A caption long enough to wrap onto several lines in a narrow table',
      });
      // Let the attachment's $effect run so the observer is constructed and the
      // <caption> is observed.
      await tick();
      const table = container.querySelector('table') as HTMLTableElement;
      const caption = container.querySelector('caption') as HTMLTableCaptionElement;

      // The attachment observed the real <caption> element.
      expect(CapturingResizeObserver.lastObserver?.observed).toContain(caption);
      // Before any measurement the custom property reads 0px (the CSS fallback).
      expect(table.style.getPropertyValue('--cinder-table-caption-height')).toBe('0px');

      // Drive the observer with a synthetic two-line caption height.
      const entry = {
        target: caption,
        borderBoxSize: [{ blockSize: 60, inlineSize: 200 }],
        contentRect: { height: 60 },
      } as unknown as ResizeObserverEntry;
      CapturingResizeObserver.lastCallback?.([entry], CapturingResizeObserver.lastObserver!);
      // The callback updates the captionHeight $state; flush so the style: binding
      // writes the new custom-property value to the DOM.
      await tick();

      expect(table.style.getPropertyValue('--cinder-table-caption-height')).toBe('60px');
    });
  });

  test('falls back to contentRect.height when borderBoxSize is unavailable', async () => {
    await withResizeObserver(async () => {
      const { container } = render(Wrapper, {
        columns,
        rows,
        stickyHeader: true,
        caption: 'Wraps',
      });
      await tick();
      const table = container.querySelector('table') as HTMLTableElement;
      const caption = container.querySelector('caption') as HTMLTableCaptionElement;

      const entry = {
        target: caption,
        borderBoxSize: [],
        contentRect: { height: 42 },
      } as unknown as ResizeObserverEntry;
      CapturingResizeObserver.lastCallback?.([entry], CapturingResizeObserver.lastObserver!);
      await tick();

      expect(table.style.getPropertyValue('--cinder-table-caption-height')).toBe('42px');
    });
  });

  test('a caption-less table does not emit the custom property', async () => {
    await withResizeObserver(async () => {
      const { container } = render(Wrapper, { columns, rows, stickyHeader: true });
      await tick();
      const table = container.querySelector('table') as HTMLTableElement;
      // No caption → the `caption ? ... : undefined` guard omits the property.
      expect(table.style.getPropertyValue('--cinder-table-caption-height')).toBe('');
    });
  });

  test('a non-sticky captioned table does not observe the caption (no wasted observer)', async () => {
    // captionHeight is only consumed by the sticky-header offset, so the
    // observer is gated on `stickyHeader`. A common non-sticky captioned table
    // must not run a ResizeObserver.
    await withResizeObserver(async () => {
      render(Wrapper, { columns, rows, stickyHeader: false, caption: 'Plain caption' });
      await tick();
      // The `enabled: () => stickyHeader` gate skips observation entirely.
      expect(CapturingResizeObserver.lastObserver?.observed ?? []).toHaveLength(0);
    });
  });
});

describe('Table density', () => {
  test('density defaults to "comfortable" and sets data-cinder-density', () => {
    const { container } = render(Wrapper, { columns, rows });
    const table = container.querySelector('table');
    expect(table?.getAttribute('data-cinder-density')).toBe('comfortable');
  });

  test('density="condensed" sets data-cinder-density="condensed"', () => {
    const { container } = render(Wrapper, { columns, rows, density: 'condensed' });
    expect(container.querySelector('table')?.getAttribute('data-cinder-density')).toBe('condensed');
  });

  test('density="spacious" sets data-cinder-density="spacious"', () => {
    const { container } = render(Wrapper, { columns, rows, density: 'spacious' });
    expect(container.querySelector('table')?.getAttribute('data-cinder-density')).toBe('spacious');
  });
});

describe('Table selection — structure', () => {
  test('selectable=true adds data-cinder-selectable to the table element', () => {
    const { container } = render(Wrapper, { columns, rows, selectable: true });
    expect(container.querySelector('table')?.hasAttribute('data-cinder-selectable')).toBe(true);
  });

  test('selectable=false omits data-cinder-selectable', () => {
    const { container } = render(Wrapper, { columns, rows });
    expect(container.querySelector('table')?.hasAttribute('data-cinder-selectable')).toBe(false);
  });

  test('header row has a leading <th> with the select-all checkbox', () => {
    const { container } = render(Wrapper, { columns, rows, selectable: true });
    const headerCells = Array.from(container.querySelectorAll('thead tr th'));
    // First cell is the selection <th>; it contains a checkbox
    expect(headerCells[0]?.querySelector('input[type="checkbox"]')).not.toBeNull();
  });

  test('each body row has a leading <td> containing a checkbox', () => {
    const { container } = render(Wrapper, { columns, rows, selectable: true });
    const bodyRows = Array.from(container.querySelectorAll('tbody tr'));
    for (const row of bodyRows) {
      const firstCell = row.querySelector('td');
      expect(firstCell?.querySelector('input[type="checkbox"]')).not.toBeNull();
    }
  });

  test('column count is equal across header and body rows when selectable', () => {
    const { container } = render(Wrapper, { columns, rows, selectable: true });
    const headerCellCount = container.querySelectorAll('thead tr th').length;
    const bodyRows = Array.from(container.querySelectorAll('tbody tr'));
    for (const row of bodyRows) {
      const cellCount = row.querySelectorAll('th, td').length;
      expect(cellCount).toBe(headerCellCount);
    }
  });

  test('selectable header requires controlled select-all state', () => {
    expect(() =>
      render(Wrapper, {
        columns,
        rows,
        selectable: true,
        includeHeaderSelectionState: false,
      }),
    ).toThrow(/`allSelected`, `someSelected`, and `onselectall` are required/);
  });

  test('selectable header requires a select-all handler', () => {
    expect(() =>
      render(Wrapper, {
        columns,
        rows,
        selectable: true,
        includeHeaderSelectionHandler: false,
      }),
    ).toThrow(/`allSelected`, `someSelected`, and `onselectall` are required/);
  });

  test('selectable header throws when multiple header rows would duplicate select-all controls', () => {
    expect(() =>
      render(Wrapper, {
        columns,
        rows,
        selectable: true,
        renderSecondHeaderRow: true,
      }),
    ).toThrow(/supports exactly one TableRow inside TableHeader/);
  });
});

describe('Table selection — row checkbox behavior', () => {
  test('body row checkbox is unchecked when the row is not selected', () => {
    const { container } = render(Wrapper, {
      columns,
      rows,
      selectable: true,
      selectedIds: new Set<string>(),
    });
    const bodyRows = Array.from(container.querySelectorAll('tbody tr'));
    const checkbox = bodyRows[0]?.querySelector('input[type="checkbox"]') as HTMLInputElement;
    expect(checkbox?.checked).toBe(false);
  });

  test('body row checkbox is checked when the row is selected', () => {
    const { container } = render(Wrapper, {
      columns,
      rows,
      selectable: true,
      selectedIds: new Set(['1']),
    });
    const bodyRows = Array.from(container.querySelectorAll('tbody tr'));
    const checkbox = bodyRows[0]?.querySelector('input[type="checkbox"]') as HTMLInputElement;
    expect(checkbox?.checked).toBe(true);
  });

  test('clicking a body checkbox fires onSelectedIds with the row added', async () => {
    let received: Set<string> | undefined;
    const { container } = render(Wrapper, {
      columns,
      rows,
      selectable: true,
      selectedIds: new Set<string>(),
      onSelectedIds: (next: Set<string>) => {
        received = next;
      },
    });
    const bodyRows = Array.from(container.querySelectorAll('tbody tr'));
    const checkbox = bodyRows[0]?.querySelector('input[type="checkbox"]') as HTMLInputElement;
    await fireEvent.click(checkbox);
    expect(received?.has('1')).toBe(true);
  });

  test('clicking a checked body checkbox fires onSelectedIds with the row removed', async () => {
    let received: Set<string> | undefined;
    const { container } = render(Wrapper, {
      columns,
      rows,
      selectable: true,
      selectedIds: new Set(['1']),
      onSelectedIds: (next: Set<string>) => {
        received = next;
      },
    });
    const bodyRows = Array.from(container.querySelectorAll('tbody tr'));
    const checkbox = bodyRows[0]?.querySelector('input[type="checkbox"]') as HTMLInputElement;
    await fireEvent.click(checkbox);
    expect(received?.has('1')).toBe(false);
  });

  test('body rows do not carry aria-selected (plain table, not grid)', () => {
    const { container } = render(Wrapper, {
      columns,
      rows,
      selectable: true,
      selectedIds: new Set(['1']),
    });
    const bodyRows = Array.from(container.querySelectorAll('tbody tr'));
    // aria-selected is not valid on <tr> in a plain <table> (only in grid/treegrid)
    for (const row of bodyRows) {
      expect(row.hasAttribute('aria-selected')).toBe(false);
    }
  });
});

describe('Table selection — select-all checkbox', () => {
  test('select-all checkbox has the correct aria-label', () => {
    const { container } = render(Wrapper, { columns, rows, selectable: true });
    const selectAll = container.querySelector(
      'thead tr input[type="checkbox"]',
    ) as HTMLInputElement;
    expect(selectAll?.getAttribute('aria-label')).toBe('Select all rows');
  });

  test('select-all checkbox is unchecked when no rows are selected', () => {
    const { container } = render(Wrapper, {
      columns,
      rows,
      selectable: true,
      selectedIds: new Set<string>(),
    });
    const selectAll = container.querySelector(
      'thead tr input[type="checkbox"]',
    ) as HTMLInputElement;
    expect(selectAll?.checked).toBe(false);
  });

  test('select-all checkbox is checked when all rows are selected', () => {
    const { container } = render(Wrapper, {
      columns,
      rows,
      selectable: true,
      selectedIds: new Set(['1', '2']),
    });
    const selectAll = container.querySelector(
      'thead tr input[type="checkbox"]',
    ) as HTMLInputElement;
    expect(selectAll?.checked).toBe(true);
  });

  test('select-all checkbox is indeterminate when some rows are selected', () => {
    const { container } = render(Wrapper, {
      columns,
      rows,
      selectable: true,
      selectedIds: new Set(['1']),
    });
    const selectAll = container.querySelector(
      'thead tr input[type="checkbox"]',
    ) as HTMLInputElement;
    // indeterminate is a DOM property, not an attribute — checked via the property
    expect(selectAll?.indeterminate).toBe(true);
  });

  test('clicking select-all fires onSelectedIds with all rows', async () => {
    let received: Set<string> | undefined;
    const { container } = render(Wrapper, {
      columns,
      rows,
      selectable: true,
      selectedIds: new Set<string>(),
      onSelectedIds: (next: Set<string>) => {
        received = next;
      },
    });
    const selectAll = container.querySelector(
      'thead tr input[type="checkbox"]',
    ) as HTMLInputElement;
    await fireEvent.click(selectAll);
    expect(received?.has('1')).toBe(true);
    expect(received?.has('2')).toBe(true);
  });

  test('clicking select-all when all selected fires onSelectedIds with empty set', async () => {
    let received: Set<string> | undefined;
    const { container } = render(Wrapper, {
      columns,
      rows,
      selectable: true,
      selectedIds: new Set(['1', '2']),
      onSelectedIds: (next: Set<string>) => {
        received = next;
      },
    });
    const selectAll = container.querySelector(
      'thead tr input[type="checkbox"]',
    ) as HTMLInputElement;
    await fireEvent.click(selectAll);
    expect(received?.size).toBe(0);
  });
});

describe('Table selection — selectionDisabled rows', () => {
  const rowsWithDisabled = [
    { id: '1', cells: ['Alice', '30', 'Engineer'] },
    { id: '2', cells: ['Bob', '25', 'Designer'], selectionDisabled: true as const },
  ];

  test('selectionDisabled row renders a leading <td> with a disabled checkbox', () => {
    const { container } = render(Wrapper, {
      columns,
      rows: rowsWithDisabled,
      selectable: true,
    });
    const bodyRows = Array.from(container.querySelectorAll('tbody tr'));
    // Row 1 (index 0): active checkbox
    expect(bodyRows[0]?.querySelector('td input[type="checkbox"]')).not.toBeNull();
    // Row 2 (index 1): disabled checkbox
    const disabledRow = bodyRows[1];
    const firstCell = disabledRow?.querySelector('td');
    const checkbox = firstCell?.querySelector('input[type="checkbox"]') as HTMLInputElement | null;
    expect(checkbox).not.toBeNull();
    expect(checkbox?.disabled).toBe(true);
  });

  test('selectionDisabled row checkbox carries an accessible name on the input', () => {
    const { container } = render(Wrapper, {
      columns,
      rows: rowsWithDisabled,
      selectable: true,
    });
    const bodyRows = Array.from(container.querySelectorAll('tbody tr'));
    const checkbox = bodyRows[1]?.querySelector('td input[type="checkbox"]');
    expect(checkbox?.getAttribute('aria-label')).toBe('Selection not allowed for this row');
  });

  test('selectionDisabled row has no aria-selected attribute', () => {
    const { container } = render(Wrapper, {
      columns,
      rows: rowsWithDisabled,
      selectable: true,
    });
    const bodyRows = Array.from(container.querySelectorAll('tbody tr'));
    expect(bodyRows[1]?.hasAttribute('aria-selected')).toBe(false);
  });

  test('selectionDisabled row checkbox has the disabled attribute', () => {
    const { container } = render(Wrapper, {
      columns,
      rows: rowsWithDisabled,
      selectable: true,
    });
    const bodyRows = Array.from(container.querySelectorAll('tbody tr'));
    const checkbox = bodyRows[1]?.querySelector('td input[type="checkbox"]');
    expect(checkbox?.hasAttribute('disabled')).toBe(true);
  });

  test('clicking the selectionDisabled checkbox does not fire onSelectedIds', async () => {
    const onSelectedIdsSpy = mock((_nextSelectedIds: Set<string>) => {});
    const { container } = render(Wrapper, {
      columns,
      rows: rowsWithDisabled,
      selectable: true,
      onSelectedIds: onSelectedIdsSpy,
    });
    const bodyRows = Array.from(container.querySelectorAll('tbody tr'));
    const checkbox = bodyRows[1]?.querySelector('td input[type="checkbox"]') as HTMLInputElement;
    await fireEvent.click(checkbox);
    expect(onSelectedIdsSpy).not.toHaveBeenCalled();
  });

  test('selectionDisabled rows are excluded from select-all calculation', () => {
    const { container } = render(Wrapper, {
      columns,
      rows: rowsWithDisabled,
      selectable: true,
      // Only the selectable row (id='1') is selected
      selectedIds: new Set(['1']),
    });
    // allSelected should be true (only id='1' is selectable and it's selected)
    const selectAll = container.querySelector(
      'thead tr input[type="checkbox"]',
    ) as HTMLInputElement;
    expect(selectAll?.checked).toBe(true);
    expect(selectAll?.indeterminate).toBe(false);
  });
});

describe('Table selection — non-selectable table', () => {
  test('non-selectable table renders without a leading selection column', () => {
    const { container } = render(Wrapper, { columns, rows, selectable: false });
    const headerCellCount = container.querySelectorAll('thead tr th').length;
    expect(headerCellCount).toBe(columns.length);
  });
});

describe('CSS rule assertions — sort indicator and focus ring', () => {
  function findRule(sheet: CSSStyleSheet, selector: string): CSSStyleRule | undefined {
    try {
      for (const rule of Array.from(sheet.cssRules)) {
        if (rule instanceof CSSStyleRule && rule.selectorText === selector) {
          return rule;
        }
      }
    } catch {
      // cross-origin or inaccessible sheet
    }
    return undefined;
  }

  function findRuleContaining(
    sheet: CSSStyleSheet,
    ...selectorParts: string[]
  ): CSSStyleRule | undefined {
    try {
      for (const rule of Array.from(sheet.cssRules)) {
        if (
          rule instanceof CSSStyleRule &&
          selectorParts.every((selectorPart) => rule.selectorText.includes(selectorPart))
        ) {
          return rule;
        }
      }
    } catch {
      // cross-origin or inaccessible sheet
    }
    return undefined;
  }

  function injectTableCssAndFind(selector: string): CSSStyleRule | undefined {
    const style = document.createElement('style');
    style.textContent = tableCss;
    document.head.appendChild(style);
    let rule: CSSStyleRule | undefined;
    try {
      rule = findRule(style.sheet as CSSStyleSheet, selector);
    } finally {
      document.head.removeChild(style);
    }
    return rule;
  }

  function injectTableCssAndFindContaining(...selectorParts: string[]): CSSStyleRule | undefined {
    const style = document.createElement('style');
    style.textContent = tableCss;
    document.head.appendChild(style);
    let rule: CSSStyleRule | undefined;
    try {
      rule = findRuleContaining(style.sheet as CSSStyleSheet, ...selectorParts);
    } finally {
      document.head.removeChild(style);
    }
    return rule;
  }

  test('.cinder-table__sort-indicator declares neutral color: var(--cinder-text-subtle)', () => {
    const rule = injectTableCssAndFind('.cinder-table__sort-indicator');
    expect(rule?.style.color).toBe('var(--cinder-text-subtle)');
  });

  test('active sort indicator declarations use full-strength text color', () => {
    const rule = injectTableCssAndFindContaining(
      ".cinder-table__sort-indicator[data-cinder-direction='ascending']",
      ".cinder-table__sort-indicator[data-cinder-direction='descending']",
    );
    expect(rule?.style.color).toBe('var(--cinder-text)');
  });

  test('.cinder-table__sort-button declares position: relative', () => {
    const rule = injectTableCssAndFind('.cinder-table__sort-button');
    expect(rule?.style.position).toBe('relative');
  });

  test('scroll wrapper owns horizontal overflow without changing table semantics', () => {
    const wrapperRule = injectTableCssAndFind('.cinder-table-scroll');
    // The scroll wrapper owns horizontal overflow; the table inside it grows to
    // its intrinsic width via a descendant combinator on `.cinder-table-scroll`.
    const tableRule = injectTableCssAndFind('.cinder-table-scroll .cinder-table');
    expect(wrapperRule?.style.overflowX).toBe('auto');
    expect(tableRule?.style.minInlineSize).toBe('max-content');
  });

  test('scroll wrapper focus-visible state declares a visible focus ring', () => {
    const rule = injectTableCssAndFind('.cinder-table-scroll:focus-visible');
    expect(rule?.style.outlineColor).toBe('transparent');
    expect(rule?.style.outlineStyle).toBe('solid');
    expect(rule?.style.outlineWidth).toBe('var(--cinder-ring-width)');
    expect(rule?.style.boxShadow).toBe('var(--_cinder-focus-ring-shadow)');
  });

  test('scroll wrapper focus-visible forced-colors fallback uses system colors', () => {
    expect(tableCss).toContain('@media (forced-colors: active)');
    expect(tableCss).toContain('.cinder-table-scroll:focus-visible');
    expect(tableCss).toContain('outline: var(--cinder-ring-width) solid ButtonText');
    expect(tableCss).toContain('outline-offset: 3px');
    expect(tableCss).toContain('box-shadow: none');
  });

  test('sticky header offsets its top by the measured caption height only when a caption is present', () => {
    // The native <caption> renders above the table border box; the sticky thead
    // must pin below it (not over it). The offset is scoped with :has(caption) so
    // a caption-less sticky table keeps top: 0. The offset is the caption's
    // MEASURED border-box height (--cinder-table-caption-height, set by a
    // ResizeObserver in table.svelte), not a hard-coded `1lh` — so a wrapped,
    // multi-line caption no longer overlaps the pinned header.
    //
    // Assert against the raw source: happy-dom's CSSOM drops a `top` whose value
    // is a var() (it serializes to ""), so style.top is unreadable here even
    // though the declaration is valid in real browsers. The presence of the rule
    // confirms the :has(caption) selector parsed; the source check confirms the
    // measured-height variable is the value.
    const rule = injectTableCssAndFind(
      '.cinder-table[data-cinder-sticky-header]:has(caption) .cinder-table__header',
    );
    expect(rule).not.toBeNull();
    expect(tableCss).toContain(
      '.cinder-table[data-cinder-sticky-header]:has(caption) .cinder-table__header',
    );
    expect(tableCss).toContain('top: var(--cinder-table-caption-height, 0px)');
    // Guard against a regression to the line-height assumption: the sticky-offset
    // declaration must not resolve to a `1lh`-based calc. (The explanatory CSS
    // comment may still mention `1lh` in prose, so match the declaration, not a
    // bare substring.)
    expect(tableCss).not.toContain(
      'top: calc(var(--cinder-space-3) + var(--cinder-space-2) + 1lh)',
    );
  });

  test('right-aligned sortable headers justify the sort button content to the end', () => {
    const rule = injectTableCssAndFind(
      ".cinder-table__header-cell[data-cinder-align='right'] .cinder-table__sort-button",
    );
    expect(rule?.style.justifyContent).toBe('flex-end');
  });

  test('center-aligned sortable headers center the sort button content', () => {
    const rule = injectTableCssAndFind(
      ".cinder-table__header-cell[data-cinder-align='center'] .cinder-table__sort-button",
    );
    expect(rule?.style.justifyContent).toBe('center');
  });

  test('.cinder-table__sort-button:focus-visible declares z-index: 2', () => {
    const rule = injectTableCssAndFind('.cinder-table__sort-button:focus-visible');
    expect(rule?.style.zIndex).toBe('2');
  });
});
