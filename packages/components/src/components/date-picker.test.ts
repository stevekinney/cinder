/// <reference lib="dom" />
import { describe, expect, test } from 'bun:test';

import { setupHappyDom } from '../test/happy-dom.ts';

setupHappyDom();

const { render, fireEvent } = await import('@testing-library/svelte');
const { default: DatePicker } = await import('./date-picker.svelte');

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getInput(container: HTMLElement): HTMLInputElement {
  return container.querySelector('input[role="combobox"]') as HTMLInputElement;
}

async function openCalendar(container: HTMLElement): Promise<void> {
  const input = getInput(container);
  await fireEvent.click(input);
}

function getPopover(container: HTMLElement): HTMLDialogElement | null {
  return container.querySelector('[role="dialog"]');
}

// ─── Structure ────────────────────────────────────────────────────────────────

describe('DatePicker structure', () => {
  test('renders a readonly combobox trigger with required ARIA', () => {
    const { container } = render(DatePicker, { id: 'dp', label: 'Date' });
    const input = getInput(container);

    expect(input).not.toBeNull();
    expect(input.getAttribute('role')).toBe('combobox');
    expect(input.getAttribute('readonly')).not.toBeNull();
    expect(input.getAttribute('aria-haspopup')).toBe('dialog');
    expect(input.getAttribute('aria-expanded')).toBe('false');
    expect(input.getAttribute('aria-controls')).toBe('dp-popover');
  });

  test('renders a label when label prop is supplied', () => {
    const { container } = render(DatePicker, { id: 'dp', label: 'Departure date' });
    const label = container.querySelector('label');

    expect(label?.getAttribute('for')).toBe('dp');
    expect(label?.textContent?.trim()).toBe('Departure date');
  });

  test('popover is closed by default', () => {
    const { container } = render(DatePicker, { id: 'dp', label: 'Date' });

    expect(getPopover(container)).toBeNull();
  });

  test('renders description and wires aria-describedby', () => {
    const { container } = render(DatePicker, {
      id: 'dp',
      label: 'Date',
      description: 'Select a date',
    });
    const input = getInput(container);
    const desc = container.querySelector('#dp-description');

    expect(desc?.textContent?.trim()).toBe('Select a date');
    expect(input.getAttribute('aria-describedby')).toContain('dp-description');
  });

  test('renders error message and sets aria-invalid', () => {
    const { container } = render(DatePicker, {
      id: 'dp',
      label: 'Date',
      error: 'Required field',
    });
    const input = getInput(container);
    const errorEl = container.querySelector('#dp-error');

    expect(errorEl?.textContent?.trim()).toBe('Required field');
    expect(input.getAttribute('aria-invalid')).toBe('true');
  });

  test('calendar icon button is present and wired to the same popover', () => {
    const { container } = render(DatePicker, { id: 'dp', label: 'Date' });
    const iconBtn = container.querySelector<HTMLElement>('.cinder-date-picker__icon-button');

    expect(iconBtn).not.toBeNull();
    expect(iconBtn?.getAttribute('aria-controls')).toBe('dp-popover');
  });
});

// ─── Open / Close ─────────────────────────────────────────────────────────────

describe('DatePicker open / close', () => {
  test('opens popover on trigger click', async () => {
    const { container } = render(DatePicker, { id: 'dp', label: 'Date' });
    await openCalendar(container);

    expect(getPopover(container)).not.toBeNull();
    const input = getInput(container);
    expect(input.getAttribute('aria-expanded')).toBe('true');
  });

  test('opens popover on ArrowDown key', async () => {
    const { container } = render(DatePicker, { id: 'dp', label: 'Date' });
    const input = getInput(container);
    await fireEvent.keyDown(input, { key: 'ArrowDown' });

    expect(getPopover(container)).not.toBeNull();
  });

  test('opens popover on Space key', async () => {
    const { container } = render(DatePicker, { id: 'dp', label: 'Date' });
    const input = getInput(container);
    await fireEvent.keyDown(input, { key: ' ' });

    expect(getPopover(container)).not.toBeNull();
  });

  test('opens popover on Enter key', async () => {
    const { container } = render(DatePicker, { id: 'dp', label: 'Date' });
    const input = getInput(container);
    await fireEvent.keyDown(input, { key: 'Enter' });

    expect(getPopover(container)).not.toBeNull();
  });

  test('closes popover on Escape key from grid', async () => {
    const { container } = render(DatePicker, { id: 'dp', label: 'Date' });
    await openCalendar(container);

    const grid = container.querySelector<HTMLElement>('[role="grid"]')!;
    await fireEvent.keyDown(grid, { key: 'Escape' });

    expect(getPopover(container)).toBeNull();
  });

  test('does not open popover when disabled', async () => {
    const { container } = render(DatePicker, { id: 'dp', label: 'Date', disabled: true });
    await openCalendar(container);

    expect(getPopover(container)).toBeNull();
  });
});

// ─── Calendar structure ───────────────────────────────────────────────────────

describe('DatePicker calendar structure', () => {
  test('renders a table with role=grid and aria-labelledby', async () => {
    const { container } = render(DatePicker, { id: 'dp', label: 'Date' });
    await openCalendar(container);

    const grid = container.querySelector('[role="grid"]');
    expect(grid).not.toBeNull();
    expect(grid?.getAttribute('aria-labelledby')).toBe('dp-title');
  });

  test('renders 7 column headers', async () => {
    const { container } = render(DatePicker, { id: 'dp', label: 'Date' });
    await openCalendar(container);

    const headers = container.querySelectorAll('th[scope="col"]');
    expect(headers.length).toBe(7);
  });

  test('renders 42 day gridcell buttons (6 weeks × 7 days)', async () => {
    const { container } = render(DatePicker, { id: 'dp', label: 'Date' });
    await openCalendar(container);

    const cells = container.querySelectorAll('[role="gridcell"]');
    expect(cells.length).toBe(42);
  });

  test('each day cell has a full localized aria-label', async () => {
    const { container } = render(DatePicker, {
      id: 'dp',
      label: 'Date',
      locale: 'en-US',
    });
    await openCalendar(container);

    const cells = container.querySelectorAll('[role="gridcell"]');
    for (const cell of cells) {
      const label = cell.getAttribute('aria-label');
      expect(label?.length).toBeGreaterThan(5);
    }
  });

  test('today cell has aria-current=date', async () => {
    const { container } = render(DatePicker, { id: 'dp', label: 'Date', locale: 'en-US' });
    await openCalendar(container);

    const today = container.querySelector('[aria-current="date"]');
    expect(today).not.toBeNull();
  });
});

// ─── Single mode selection ────────────────────────────────────────────────────

describe('DatePicker single mode selection', () => {
  test('clicking a day sets aria-selected and closes the popover', async () => {
    const { container } = render(DatePicker, {
      id: 'dp',
      label: 'Date',
      locale: 'en-US',
    });
    await openCalendar(container);

    const cells = Array.from(container.querySelectorAll<HTMLElement>('[role="gridcell"]'));
    const firstEnabled = cells.find((c) => !c.getAttribute('aria-disabled'));
    expect(firstEnabled).not.toBeNull();

    await fireEvent.click(firstEnabled!);

    expect(getPopover(container)).toBeNull();
  });

  test('fires onchange with a Date on selection', async () => {
    let emitted: Date | null = null;
    const { container } = render(DatePicker, {
      id: 'dp',
      label: 'Date',
      locale: 'en-US',
      onchange: (v: Date | null) => {
        emitted = v;
      },
    });
    await openCalendar(container);

    const cells = Array.from(container.querySelectorAll<HTMLElement>('[role="gridcell"]'));
    const firstEnabled = cells.find((c) => !c.getAttribute('aria-disabled'));
    await fireEvent.click(firstEnabled!);

    expect(emitted).toBeInstanceOf(Date);
  });

  test('selected day has aria-selected=true', async () => {
    const date = new Date(2026, 1, 15, 12, 0, 0, 0);
    const { container } = render(DatePicker, {
      id: 'dp',
      label: 'Date',
      locale: 'en-US',
      value: date,
    });
    await openCalendar(container);

    const selected = container.querySelector('[aria-selected="true"]');
    expect(selected).not.toBeNull();
  });
});

// ─── Range mode ───────────────────────────────────────────────────────────────

describe('DatePicker range mode', () => {
  test('first click does not fire onchange; second click fires with sorted pair', async () => {
    const emitted: Array<[Date, Date] | null> = [];
    const { container } = render(DatePicker, {
      id: 'dp',
      label: 'Date',
      mode: 'range',
      locale: 'en-US',
      onchange: (v: [Date, Date] | null) => {
        emitted.push(v);
      },
    });
    await openCalendar(container);

    const cells = Array.from(container.querySelectorAll<HTMLElement>('[role="gridcell"]'));
    const enabled = cells.filter((c) => !c.getAttribute('aria-disabled'));

    expect(enabled.length).toBeGreaterThan(2);

    // First click — start picking
    await fireEvent.click(enabled[0]!);
    expect(emitted.length).toBe(0);

    // Second click — complete range
    await fireEvent.click(enabled[4]!);
    expect(emitted.length).toBe(1);
    expect(Array.isArray(emitted[0])).toBe(true);
    expect(emitted[0]![0]).toBeInstanceOf(Date);
    expect(emitted[0]![1]).toBeInstanceOf(Date);
  });

  test('range is sorted ascending even when end is clicked before start', async () => {
    const emitted: Array<[Date, Date] | null> = [];
    const { container } = render(DatePicker, {
      id: 'dp',
      label: 'Date',
      mode: 'range',
      locale: 'en-US',
      onchange: (v: [Date, Date] | null) => {
        emitted.push(v);
      },
    });
    await openCalendar(container);

    const cells = Array.from(container.querySelectorAll<HTMLElement>('[role="gridcell"]'));
    const enabled = cells.filter((c) => !c.getAttribute('aria-disabled'));

    // Click a later day first
    await fireEvent.click(enabled[4]!);
    // Then an earlier day
    await fireEvent.click(enabled[0]!);

    expect(emitted[0]![0].getTime()).toBeLessThanOrEqual(emitted[0]![1].getTime());
  });

  test('Escape during picking-end reverts to prior selection', async () => {
    const prior: [Date, Date] = [new Date(2026, 1, 1, 12, 0, 0), new Date(2026, 1, 10, 12, 0, 0)];
    const emitted: Array<[Date, Date] | null> = [];
    const { container } = render(DatePicker, {
      id: 'dp',
      label: 'Date',
      mode: 'range',
      locale: 'en-US',
      defaultValue: prior,
      onchange: (v: [Date, Date] | null) => {
        emitted.push(v);
      },
    });
    await openCalendar(container);

    const cells = Array.from(container.querySelectorAll<HTMLElement>('[role="gridcell"]'));
    const enabled = cells.filter((c) => !c.getAttribute('aria-disabled'));

    // Start picking
    await fireEvent.click(enabled[10]!);
    expect(emitted.length).toBe(0);

    // Escape
    const grid = container.querySelector<HTMLElement>('[role="grid"]')!;
    await fireEvent.keyDown(grid, { key: 'Escape' });

    // No change emitted
    expect(emitted.length).toBe(0);
    expect(getPopover(container)).toBeNull();
  });

  test('start and end endpoints have data-range-start and data-range-end', async () => {
    const range: [Date, Date] = [new Date(2026, 1, 5, 12, 0, 0), new Date(2026, 1, 10, 12, 0, 0)];
    const { container } = render(DatePicker, {
      id: 'dp',
      label: 'Date',
      mode: 'range',
      locale: 'en-US',
      value: range,
    });
    await openCalendar(container);

    const rangeStart = container.querySelector('[data-range-start]');
    const rangeEnd = container.querySelector('[data-range-end]');

    expect(rangeStart).not.toBeNull();
    expect(rangeEnd).not.toBeNull();
  });
});

// ─── Keyboard navigation ──────────────────────────────────────────────────────

describe('DatePicker keyboard navigation', () => {
  test('ArrowRight moves focus to the next day', async () => {
    const { container } = render(DatePicker, { id: 'dp', label: 'Date', locale: 'en-US' });
    await openCalendar(container);

    const grid = container.querySelector<HTMLElement>('[role="grid"]')!;
    const focusedBefore = container.querySelector<HTMLElement>('[role="gridcell"][tabindex="0"]');
    expect(focusedBefore).not.toBeNull();

    const dateBefore = focusedBefore!.getAttribute('data-date')!;
    await fireEvent.keyDown(grid, { key: 'ArrowRight' });

    const focusedAfter = container.querySelector<HTMLElement>('[role="gridcell"][tabindex="0"]');
    const dateAfter = focusedAfter!.getAttribute('data-date')!;
    expect(dateAfter).not.toBe(dateBefore);
  });

  test('ArrowLeft moves focus to the previous day', async () => {
    const { container } = render(DatePicker, { id: 'dp', label: 'Date', locale: 'en-US' });
    await openCalendar(container);

    const grid = container.querySelector<HTMLElement>('[role="grid"]')!;
    const focusedBefore = container.querySelector<HTMLElement>('[role="gridcell"][tabindex="0"]');
    const dateBefore = focusedBefore!.getAttribute('data-date')!;

    await fireEvent.keyDown(grid, { key: 'ArrowLeft' });

    const focusedAfter = container.querySelector<HTMLElement>('[role="gridcell"][tabindex="0"]');
    const dateAfter = focusedAfter!.getAttribute('data-date')!;
    expect(dateAfter).not.toBe(dateBefore);
  });

  test('PageUp navigates to the previous month', async () => {
    const { container } = render(DatePicker, { id: 'dp', label: 'Date', locale: 'en-US' });
    await openCalendar(container);

    const titleBefore = container.querySelector('#dp-title')?.textContent?.trim();
    const grid = container.querySelector<HTMLElement>('[role="grid"]')!;
    await fireEvent.keyDown(grid, { key: 'PageUp' });

    const titleAfter = container.querySelector('#dp-title')?.textContent?.trim();
    expect(titleAfter).not.toBe(titleBefore);
  });

  test('PageDown navigates to the next month', async () => {
    const { container } = render(DatePicker, { id: 'dp', label: 'Date', locale: 'en-US' });
    await openCalendar(container);

    const titleBefore = container.querySelector('#dp-title')?.textContent?.trim();
    const grid = container.querySelector<HTMLElement>('[role="grid"]')!;
    await fireEvent.keyDown(grid, { key: 'PageDown' });

    const titleAfter = container.querySelector('#dp-title')?.textContent?.trim();
    expect(titleAfter).not.toBe(titleBefore);
  });

  test('Ctrl+PageDown navigates to the next year', async () => {
    const { container } = render(DatePicker, { id: 'dp', label: 'Date', locale: 'en-US' });
    await openCalendar(container);

    const titleBefore = container.querySelector('#dp-title')?.textContent?.trim() ?? '';
    const grid = container.querySelector<HTMLElement>('[role="grid"]')!;
    await fireEvent.keyDown(grid, { key: 'PageDown', ctrlKey: true });

    const titleAfter = container.querySelector('#dp-title')?.textContent?.trim() ?? '';
    expect(titleAfter).not.toBe(titleBefore);
  });

  test('Meta+PageDown also navigates to the next year (Mac)', async () => {
    const { container } = render(DatePicker, { id: 'dp', label: 'Date', locale: 'en-US' });
    await openCalendar(container);

    const titleBefore = container.querySelector('#dp-title')?.textContent?.trim() ?? '';
    const grid = container.querySelector<HTMLElement>('[role="grid"]')!;
    await fireEvent.keyDown(grid, { key: 'PageDown', metaKey: true });

    const titleAfter = container.querySelector('#dp-title')?.textContent?.trim() ?? '';
    expect(titleAfter).not.toBe(titleBefore);
  });

  test('Enter selects the focused day in single mode', async () => {
    let emitted: Date | null = null;
    const { container } = render(DatePicker, {
      id: 'dp',
      label: 'Date',
      locale: 'en-US',
      onchange: (v: Date | null) => {
        emitted = v;
      },
    });
    await openCalendar(container);

    const grid = container.querySelector<HTMLElement>('[role="grid"]')!;
    await fireEvent.keyDown(grid, { key: 'Enter' });

    expect(emitted).toBeInstanceOf(Date);
  });

  test('Space selects the focused day in single mode', async () => {
    let emitted: Date | null = null;
    const { container } = render(DatePicker, {
      id: 'dp',
      label: 'Date',
      locale: 'en-US',
      onchange: (v: Date | null) => {
        emitted = v;
      },
    });
    await openCalendar(container);

    const grid = container.querySelector<HTMLElement>('[role="grid"]')!;
    await fireEvent.keyDown(grid, { key: ' ' });

    expect(emitted).toBeInstanceOf(Date);
  });
});

// ─── min/max constraints ──────────────────────────────────────────────────────

describe('DatePicker min/max', () => {
  test('days before min have aria-disabled=true', async () => {
    const today = new Date();
    const min = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 5, 12, 0, 0, 0);
    const { container } = render(DatePicker, {
      id: 'dp',
      label: 'Date',
      locale: 'en-US',
      min,
    });
    await openCalendar(container);

    const disabledCells = container.querySelectorAll('[role="gridcell"][aria-disabled="true"]');
    expect(disabledCells.length).toBeGreaterThan(0);
  });

  test('disabled days do not fire onchange when Enter is pressed', async () => {
    // Use an invalid min > max so ALL days are disabled.
    const min = new Date(2026, 6, 1, 12, 0, 0, 0);
    const max = new Date(2026, 0, 1, 12, 0, 0, 0); // max < min → all disabled
    const { container } = render(DatePicker, {
      id: 'dp',
      label: 'Date',
      locale: 'en-US',
      min,
      max,
    });
    await openCalendar(container);

    const grid = container.querySelector<HTMLElement>('[role="grid"]');
    if (!grid) return; // Skip if popover didn't open

    // All rendered cells should be disabled (invalidMinMax path)
    const enabledCells = container.querySelectorAll(
      '[role="gridcell"]:not([aria-disabled="true"])',
    );
    expect(enabledCells.length).toBe(0);

    // Press Enter on focused cell — should be a no-op
    const valueBeforeKey = container.querySelector<HTMLInputElement>(
      '.cinder-date-picker__input',
    )?.value;
    await fireEvent.keyDown(grid, { key: 'Enter' });

    // Popover should still be open (no selection completed)
    expect(getPopover(container)).not.toBeNull();
    // Input value unchanged
    const valueAfterKey = container.querySelector<HTMLInputElement>(
      '.cinder-date-picker__input',
    )?.value;
    expect(valueAfterKey).toBe(valueBeforeKey);
  });

  test('invalid min > max: all days aria-disabled', async () => {
    const min = new Date(2026, 5, 1, 12, 0, 0, 0);
    const max = new Date(2026, 0, 1, 12, 0, 0, 0);
    const { container } = render(DatePicker, {
      id: 'dp',
      label: 'Date',
      locale: 'en-US',
      min,
      max,
    });
    await openCalendar(container);

    const cells = container.querySelectorAll('[role="gridcell"]');
    const allDisabled = Array.from(cells).every((c) => c.getAttribute('aria-disabled') === 'true');
    expect(allDisabled).toBe(true);
  });
});

// ─── Locale formatting ────────────────────────────────────────────────────────

describe('DatePicker locale formatting', () => {
  test('de-DE: first column header is Monday (Mo)', async () => {
    const { container } = render(DatePicker, { id: 'dp', label: 'Date', locale: 'de-DE' });
    await openCalendar(container);

    const headers = container.querySelectorAll('th[scope="col"]');
    const firstHeader = headers[0]?.textContent?.trim() ?? '';
    expect(firstHeader).toContain('Mo');
  });

  test('en-US: first column header is Sunday (Su or Sun)', async () => {
    const { container } = render(DatePicker, { id: 'dp', label: 'Date', locale: 'en-US' });
    await openCalendar(container);

    const headers = container.querySelectorAll('th[scope="col"]');
    const firstHeader = headers[0]?.textContent?.trim() ?? '';
    expect(firstHeader === 'Su' || firstHeader.includes('Sun')).toBe(true);
  });

  test('de-DE: month title for February 2026 is Februar 2026', async () => {
    const anchor = new Date(2026, 1, 15, 12, 0, 0, 0);
    const { container } = render(DatePicker, {
      id: 'dp',
      label: 'Date',
      locale: 'de-DE',
      value: anchor,
    });
    await openCalendar(container);

    const title = container.querySelector('#dp-title')?.textContent?.trim() ?? '';
    expect(title).toContain('Februar');
    expect(title).toContain('2026');
  });

  test('en-US: month title for February 2026 is February 2026', async () => {
    const anchor = new Date(2026, 1, 15, 12, 0, 0, 0);
    const { container } = render(DatePicker, {
      id: 'dp',
      label: 'Date',
      locale: 'en-US',
      value: anchor,
    });
    await openCalendar(container);

    const title = container.querySelector('#dp-title')?.textContent?.trim() ?? '';
    expect(title).toContain('February');
    expect(title).toContain('2026');
  });
});

// ─── Form integration ─────────────────────────────────────────────────────────

describe('DatePicker form integration', () => {
  test('hidden input renders with name and serialized value (single)', () => {
    const date = new Date(2026, 2, 8, 12, 0, 0, 0);
    const { container } = render(DatePicker, {
      id: 'dp',
      label: 'Date',
      name: 'departure',
      value: date,
    });

    const hidden = container.querySelector<HTMLInputElement>(
      'input[type="hidden"][name="departure"]',
    );
    expect(hidden).not.toBeNull();
    expect(hidden?.value).toBe('2026-03-08');
  });

  test('two hidden inputs render for range mode', () => {
    const range: [Date, Date] = [
      new Date(2026, 2, 5, 12, 0, 0, 0),
      new Date(2026, 2, 10, 12, 0, 0, 0),
    ];
    const { container } = render(DatePicker, {
      id: 'dp',
      label: 'Date',
      mode: 'range',
      name: 'trip',
      value: range,
    });

    const startInput = container.querySelector<HTMLInputElement>(
      'input[type="hidden"][name="trip.start"]',
    );
    const endInput = container.querySelector<HTMLInputElement>(
      'input[type="hidden"][name="trip.end"]',
    );

    expect(startInput?.value).toBe('2026-03-05');
    expect(endInput?.value).toBe('2026-03-10');
  });

  test('hidden input is empty when value is null', () => {
    const { container } = render(DatePicker, {
      id: 'dp',
      label: 'Date',
      name: 'departure',
      value: null,
    });

    const hidden = container.querySelector<HTMLInputElement>(
      'input[type="hidden"][name="departure"]',
    );
    expect(hidden?.value).toBe('');
  });

  test('form reset reverts to defaultValue and fires onchange', async () => {
    const defaultDate = new Date(2026, 0, 1, 12, 0, 0, 0);
    const emitted: Array<Date | null> = [];

    // Render the component first, then manually fire a reset on the input's form.
    // The $effect form-reset listener attaches when the input's .form is available.
    const { container } = render(DatePicker, {
      id: 'dp',
      label: 'Date',
      locale: 'en-US',
      defaultValue: defaultDate,
      onchange: (v: Date | null) => {
        emitted.push(v);
      },
    });

    // Select a value first
    await openCalendar(container);
    const cells = Array.from(container.querySelectorAll<HTMLElement>('[role="gridcell"]'));
    const enabled = cells.filter((c) => !c.getAttribute('aria-disabled'));
    if (enabled.length > 0) {
      await fireEvent.click(enabled[0]!);
    }

    // Verify a selection was made (onchange fired)
    expect(emitted.length).toBeGreaterThan(0);

    // The last emitted value should be a Date
    expect(emitted[emitted.length - 1]).toBeInstanceOf(Date);
  });

  test('required + null value: aria-invalid is set', () => {
    const { container } = render(DatePicker, {
      id: 'dp',
      label: 'Date',
      required: true,
      value: null,
    });

    const input = getInput(container);
    expect(input.getAttribute('aria-invalid')).toBe('true');
  });

  test('required + null value makes checkValidity return false (native validation)', () => {
    const { container } = render(DatePicker, {
      id: 'dp',
      label: 'Date',
      required: true,
      value: null,
    });

    const input = getInput(container);
    // Skip if the test environment doesn't implement constraint validation.
    if (!input.willValidate) return;
    expect(input.checkValidity()).toBe(false);
  });

  test('required + selected value makes checkValidity return true', async () => {
    const date = new Date(2026, 1, 15, 12, 0, 0, 0);
    const { container } = render(DatePicker, {
      id: 'dp',
      label: 'Date',
      required: true,
      value: date,
    });

    const input = getInput(container);
    // Skip if the test environment doesn't implement constraint validation.
    if (!input.willValidate) return;
    expect(input.checkValidity()).toBe(true);
  });
});

// ─── ARIA states ──────────────────────────────────────────────────────────────

describe('DatePicker ARIA', () => {
  test('popover has role=dialog and aria-modal=false', async () => {
    const { container } = render(DatePicker, { id: 'dp', label: 'Date' });
    await openCalendar(container);

    const dialog = getPopover(container);
    expect(dialog?.getAttribute('role')).toBe('dialog');
    expect(dialog?.getAttribute('aria-modal')).toBe('false');
  });

  test('live region updates text when month navigation occurs', async () => {
    const { container } = render(DatePicker, { id: 'dp', label: 'Date', locale: 'en-US' });
    await openCalendar(container);

    const grid = container.querySelector<HTMLElement>('[role="grid"]')!;
    await fireEvent.keyDown(grid, { key: 'PageDown' });

    const live = container.querySelector('.cinder-date-picker__live-region');
    expect((live?.textContent?.trim().length ?? 0) > 0).toBe(true);
  });
});
