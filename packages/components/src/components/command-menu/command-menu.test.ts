/// <reference lib="dom" />
import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test';

import { setupHappyDom } from '../../test/happy-dom.ts';

setupHappyDom();

const computePositionSpy = mock(async () => ({
  x: 12,
  y: 34,
  placement: 'bottom-start',
  middlewareData: {},
}));
const autoUpdateTeardown = mock(() => {});
const autoUpdateSpy = mock((_anchor: unknown, _panel: HTMLElement, update: () => void) => {
  update();
  return autoUpdateTeardown;
});
const flipSpy = mock(() => ({ name: 'flip', fn: () => ({}) }));
const shiftSpy = mock((options: unknown) => ({ name: 'shift', options, fn: () => ({}) }));
const offsetSpy = mock((options: unknown) => ({ name: 'offset', options, fn: () => ({}) }));

mock.module('@floating-ui/dom', () => ({
  arrow: () => ({ name: 'arrow', fn: () => ({}) }),
  computePosition: computePositionSpy,
  autoUpdate: autoUpdateSpy,
  flip: flipSpy,
  shift: shiftSpy,
  offset: offsetSpy,
}));

const { cleanup, fireEvent, render, waitFor } = await import('@testing-library/svelte');
const { tick } = await import('svelte');
const { default: CommandMenuHostFixture } =
  await import('../../test/fixtures/command-menu-host-fixture.svelte');
const { default: CommandMenuFixture } =
  await import('../../test/fixtures/command-menu-fixture.svelte');

function queryMenu() {
  return document.body.querySelector<HTMLElement>('.cinder-command-menu');
}

function queryListbox() {
  return document.body.querySelector<HTMLUListElement>('[role="listbox"]');
}

async function settleCommandMenu() {
  await Promise.resolve();
  await tick();
}

beforeEach(() => {
  computePositionSpy.mockClear();
  autoUpdateSpy.mockClear();
  autoUpdateTeardown.mockClear();
  offsetSpy.mockClear();
});

afterEach(() => {
  cleanup();
  document.body.innerHTML = '';
});

describe('CommandMenu', () => {
  test('renders a portaled listbox while open', async () => {
    render(CommandMenuFixture);
    await waitFor(() => expect(queryMenu()).not.toBeNull());
    const listbox = queryListbox()!;
    expect(listbox.getAttribute('role')).toBe('listbox');
    expect(listbox.getAttribute('aria-label')).toBe('Commands');
  });

  test('positions against a virtual caret element', async () => {
    render(CommandMenuFixture);
    await waitFor(() => expect(computePositionSpy).toHaveBeenCalled());
    const firstCall = computePositionSpy.mock.calls[0] as
      | [unknown, HTMLElement, { placement: string; strategy: string }]
      | undefined;
    expect(firstCall).toBeDefined();
    const [reference, panel, options] = firstCall!;
    expect(typeof (reference as { getBoundingClientRect?: unknown }).getBoundingClientRect).toBe(
      'function',
    );
    const menu = queryMenu();
    expect(menu).not.toBeNull();
    expect(panel).toBe(menu!);
    expect(options).toMatchObject({ placement: 'bottom-start', strategy: 'fixed' });
    expect(offsetSpy).toHaveBeenCalledWith(6);
  });

  test('repositions when the caret index changes', async () => {
    const { getByTestId } = render(CommandMenuFixture);
    await waitFor(() => expect(autoUpdateSpy).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(computePositionSpy).toHaveBeenCalled());

    await fireEvent.click(getByTestId('advance-caret'));

    await waitFor(() => expect(autoUpdateTeardown).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(autoUpdateSpy).toHaveBeenCalledTimes(2));
    expect(computePositionSpy.mock.calls.length).toBeGreaterThan(1);
  });

  test('captures the current anchor for lazy virtual element reads', async () => {
    const { getByTestId } = render(CommandMenuFixture);
    await waitFor(() => expect(autoUpdateSpy).toHaveBeenCalledTimes(1));
    const firstCall = autoUpdateSpy.mock.calls[0] as
      | [{ getBoundingClientRect: () => DOMRect }, HTMLElement, () => void]
      | undefined;
    expect(firstCall).toBeDefined();
    const [reference] = firstCall!;

    await fireEvent.click(getByTestId('clear-anchor'));
    await settleCommandMenu();

    expect(() => reference.getBoundingClientRect()).not.toThrow();
  });

  test('keyboard navigation skips disabled items and selects through the menu callback', async () => {
    const selected: Array<{ value: string; query: string }> = [];
    render(CommandMenuFixture, {
      onSelected: (value: string, query: string) => selected.push({ value, query }),
    });
    await waitFor(() => expect(queryMenu()).not.toBeNull());
    const anchor = document.querySelector('[data-testid="anchor"]') as HTMLTextAreaElement;

    await fireEvent.keyDown(anchor, { key: 'End' });
    await settleCommandMenu();
    expect(queryMenu()?.querySelector('[aria-selected="true"]')?.textContent).toContain('Beta');

    await fireEvent.keyDown(anchor, { key: 'Enter' });
    expect(selected).toEqual([{ value: 'beta', query: '' }]);
    expect(anchor.value).toBe('/a');
  });

  test('click activation fires the per-item onselect and the menu-level callback', async () => {
    // Regression: command-menu previously dropped the per-item `onselect`
    // callback on activation, firing only the menu-level prop. command-palette's
    // shared-context contract fires both (the per-item callback first), so
    // command-menu now matches it.
    const itemSelect = mock(() => {});
    const selected: string[] = [];
    render(CommandMenuFixture, {
      items: [{ value: 'alpha', label: 'Alpha', onselect: itemSelect }],
      onSelected: (value: string) => selected.push(value),
    });
    await waitFor(() => expect(queryMenu()).not.toBeNull());

    const option = document.body.querySelector('[role="option"]') as HTMLElement;
    await fireEvent.pointerDown(option);
    await fireEvent.click(option);

    expect(selected).toEqual(['alpha']);
    expect(itemSelect).toHaveBeenCalledTimes(1);
  });

  test('Escape dismisses the menu', async () => {
    let dismissCount = 0;
    const { getByTestId } = render(CommandMenuFixture, {
      onDismissed: () => {
        dismissCount += 1;
      },
    });
    await waitFor(() => expect(queryMenu()).not.toBeNull());
    const anchor = getByTestId('anchor') as HTMLTextAreaElement;

    await fireEvent.keyDown(anchor, { key: 'Escape' });
    expect(dismissCount).toBe(1);
  });

  test('outside pointerdown dismisses the menu', async () => {
    let dismissCount = 0;
    const { getByTestId } = render(CommandMenuFixture, {
      onDismissed: () => {
        dismissCount += 1;
      },
    });
    await waitFor(() => expect(queryMenu()).not.toBeNull());

    await fireEvent.pointerDown(getByTestId('outside'));
    expect(dismissCount).toBe(1);
    await waitFor(() => expect(queryMenu()).toBeNull());
  });

  test('modified host-field navigation keys are not intercepted', async () => {
    render(CommandMenuFixture);
    await waitFor(() => expect(queryMenu()).not.toBeNull());
    const anchor = document.querySelector('[data-testid="anchor"]') as HTMLTextAreaElement;

    await fireEvent.keyDown(anchor, { key: 'End', ctrlKey: true });
    await settleCommandMenu();
    expect(queryMenu()?.querySelector('[aria-selected="true"]')?.textContent).toContain('Alpha');
  });

  test('Shift+Enter still activates the active command', async () => {
    const selected: string[] = [];
    render(CommandMenuFixture, {
      onSelected: (value: string) => selected.push(value),
    });
    await waitFor(() => expect(queryMenu()).not.toBeNull());
    const anchor = document.querySelector('[data-testid="anchor"]') as HTMLTextAreaElement;

    await fireEvent.keyDown(anchor, { key: 'End' });
    await settleCommandMenu();
    await fireEvent.keyDown(anchor, { key: 'Enter', shiftKey: true });

    expect(selected).toEqual(['beta']);
  });

  test('empty state is a sibling of the listbox, not a listbox item', async () => {
    const { getByTestId } = render(CommandMenuFixture);
    await waitFor(() => expect(queryMenu()).not.toBeNull());

    await fireEvent.click(getByTestId('empty-query'));
    await settleCommandMenu();

    expect(queryListbox()?.querySelector('[role="status"]')).toBeNull();
    const emptyState = Array.from(queryMenu()?.children ?? []).find(
      (child) => child.getAttribute('role') === 'status',
    );
    expect(emptyState?.textContent).toContain('No commands');
  });

  test.each([{ fieldKind: 'textarea' as const }, { fieldKind: 'input' as const }])(
    'host-owned $fieldKind contract wires ARIA, keyboard selection, and dismissal',
    async ({ fieldKind }) => {
      const selected: Array<{ value: string; query: string }> = [];
      const dismissed = mock(() => {});
      const { getByTestId } = render(CommandMenuHostFixture, {
        fieldKind,
        onSelected: (value: string, query: string) => selected.push({ value, query }),
        onDismissed: dismissed,
      });
      const host = getByTestId('host') as HTMLInputElement | HTMLTextAreaElement;

      await fireEvent.input(host, { target: { value: '/a' } });
      host.setSelectionRange(2, 2);
      await fireEvent.keyUp(host, { key: 'a' });
      await waitFor(() => expect(queryMenu()).not.toBeNull());
      await waitFor(() => expect(host.getAttribute('aria-controls')).toBe(queryListbox()!.id));
      expect(host.getAttribute('aria-activedescendant')).toBeTruthy();

      await fireEvent.keyDown(host, { key: 'ArrowDown' });
      await settleCommandMenu();
      const activeAfterArrow = host.getAttribute('aria-activedescendant');
      expect(activeAfterArrow).toBeTruthy();

      await fireEvent.keyDown(host, { key: 'Enter' });
      expect(selected).toEqual([{ value: 'beta', query: 'a' }]);
      await waitFor(() => expect(queryMenu()).toBeNull());
      expect(host.getAttribute('aria-controls')).toBeNull();
      expect(host.getAttribute('aria-activedescendant')).toBeNull();

      await fireEvent.input(host, { target: { value: '/b' } });
      host.setSelectionRange(2, 2);
      await fireEvent.keyUp(host, { key: 'b' });
      await waitFor(() => expect(queryMenu()).not.toBeNull());

      await fireEvent.keyDown(host, { key: 'Escape' });
      expect(dismissed).toHaveBeenCalledTimes(1);
      await waitFor(() => expect(queryMenu()).toBeNull());
      expect(host.getAttribute('aria-controls')).toBeNull();
      expect(host.getAttribute('aria-activedescendant')).toBeNull();
    },
  );

  test('outside pointerdown in host fixture dismisses through document capture', async () => {
    const dismissed = mock(() => {});
    const { getByTestId } = render(CommandMenuHostFixture, { onDismissed: dismissed });
    const host = getByTestId('host') as HTMLTextAreaElement;

    await fireEvent.input(host, { target: { value: '/a' } });
    host.setSelectionRange(2, 2);
    await fireEvent.keyUp(host, { key: 'a' });
    await waitFor(() => expect(queryMenu()).not.toBeNull());

    await fireEvent.pointerDown(getByTestId('outside'));
    expect(dismissed).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(queryMenu()).toBeNull());
  });

  test('state changes clear active id when the menu closes or empties', async () => {
    const states: Array<string | null> = [];
    const { getByTestId } = render(CommandMenuFixture, {
      onStateChanged: (activeItemId: string | null) => states.push(activeItemId),
    });
    await waitFor(() => expect(queryMenu()).not.toBeNull());

    await fireEvent.click(getByTestId('empty-query'));
    await settleCommandMenu();
    expect(states.at(-1)).toBeNull();

    await fireEvent.click(getByTestId('close'));
    await settleCommandMenu();
    expect(states.at(-1)).toBeNull();
  });
});
