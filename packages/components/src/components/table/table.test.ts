/// <reference lib="dom" />
import { describe, expect, mock, test } from 'bun:test';

import { stripCinderComponentsLayer } from '../../test/css.ts';
import { setupHappyDom } from '../../test/happy-dom.ts';

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

  test('renders one row per data row plus a header row', () => {
    const { container } = render(Wrapper, { columns, rows });
    const headerRows = container.querySelectorAll('thead tr');
    const bodyRows = container.querySelectorAll('tbody tr');
    expect(headerRows.length).toBe(1);
    expect(bodyRows.length).toBe(2);
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

  test('stickyHeader=true with caption renders a hoisted div caption above the table (not a <caption> element)', () => {
    const { container } = render(Wrapper, { columns, rows, stickyHeader: true, caption: 'Hoisted' });
    // The hoisted div must exist and contain the caption text
    const hoisted = container.querySelector('.cinder-table__caption--hoisted');
    expect(hoisted).not.toBeNull();
    expect(hoisted?.textContent?.trim()).toBe('Hoisted');
    // No native <caption> element should be present in the sticky-header case
    expect(container.querySelector('caption')).toBeNull();
  });

  test('stickyHeader=true with caption: hoisted div appears before the <table> in the DOM', () => {
    const { container } = render(Wrapper, { columns, rows, stickyHeader: true, caption: 'Hoisted' });
    const hoisted = container.querySelector('.cinder-table__caption--hoisted');
    const table = container.querySelector('table');
    expect(hoisted).not.toBeNull();
    expect(table).not.toBeNull();
    // compareDocumentPosition returns a bitmask; DOCUMENT_POSITION_FOLLOWING (4) means
    // table comes after hoisted, i.e. hoisted is before table.
    expect(hoisted!.compareDocumentPosition(table!)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });

  test('stickyHeader=true with caption: table has aria-labelledby pointing at the hoisted div id', () => {
    const { container } = render(Wrapper, { columns, rows, stickyHeader: true, caption: 'Hoisted' });
    const hoisted = container.querySelector('.cinder-table__caption--hoisted');
    const table = container.querySelector('table');
    const hoistedId = hoisted?.getAttribute('id');
    expect(hoistedId).not.toBeNull();
    expect(table?.getAttribute('aria-labelledby')).toBe(hoistedId);
  });

  test('stickyHeader=false with caption renders native <caption> element and no hoisted div', () => {
    const { container } = render(Wrapper, { columns, rows, stickyHeader: false, caption: 'Native' });
    expect(container.querySelector('caption')?.textContent?.trim()).toBe('Native');
    expect(container.querySelector('.cinder-table__caption--hoisted')).toBeNull();
    expect(container.querySelector('table')?.hasAttribute('aria-labelledby')).toBe(false);
  });

  test('stickyHeader=true without caption renders neither hoisted div nor <caption>', () => {
    const { container } = render(Wrapper, { columns, rows, stickyHeader: true });
    expect(container.querySelector('.cinder-table__caption--hoisted')).toBeNull();
    expect(container.querySelector('caption')).toBeNull();
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
    ).toThrow(/`allSelected`, `someSelected`, and `onSelectAll` are required/);
  });

  test('selectable header requires a select-all handler', () => {
    expect(() =>
      render(Wrapper, {
        columns,
        rows,
        selectable: true,
        includeHeaderSelectionHandler: false,
      }),
    ).toThrow(/`allSelected`, `someSelected`, and `onSelectAll` are required/);
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
    // The .cinder-table-root wrapper uses display:contents so the table appears
    // as a direct layout child of .cinder-table-scroll; the CSS uses a descendant
    // combinator to account for the transparent wrapper div in the DOM.
    const tableRule = injectTableCssAndFind('.cinder-table-scroll .cinder-table');
    expect(wrapperRule?.style.overflowX).toBe('auto');
    expect(tableRule?.style.minInlineSize).toBe('max-content');
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
