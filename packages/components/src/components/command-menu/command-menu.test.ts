/// <reference lib="dom" />
import { afterEach, beforeEach, describe, expect, mock, spyOn, test } from 'bun:test';
import { parse } from 'postcss';
import selectorParser from 'postcss-selector-parser';

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

function commandMenuRootDeclarationPropertiesFromCss(css: string) {
  const declarationProperties: string[] = [];

  parse(css).walkRules((rule) => {
    let targetsCommandMenuRoot = false;
    selectorParser((selectors) => {
      selectors.each((selector) => {
        const lastCombinatorIndex = selector.nodes.findLastIndex(
          (node) => node.type === 'combinator',
        );
        targetsCommandMenuRoot ||= selector.nodes
          .slice(lastCombinatorIndex + 1)
          .some((node) => node.type === 'class' && node.value === 'cinder-command-menu');
      });
    }).processSync(rule.selector);

    if (!targetsCommandMenuRoot) return;
    rule.each((node) => {
      if (node.type === 'decl') declarationProperties.push(node.prop.toLowerCase());
    });
  });

  expect(declarationProperties.length).toBeGreaterThan(0);

  return declarationProperties;
}

async function commandMenuRootDeclarationProperties() {
  const css = await Bun.file(new URL('./command-menu.css', import.meta.url)).text();

  return commandMenuRootDeclarationPropertiesFromCss(css);
}

async function settleCommandMenu() {
  await Promise.resolve();
  await tick();
}

function queryGhost() {
  return document.body.querySelector<HTMLElement>('.cinder-command-menu__ghost');
}

/** Types `value` into `host`, moves the caret to its end, and syncs the trigger — mirrors real typing. */
async function typeIntoHost(
  host: HTMLInputElement | HTMLTextAreaElement,
  value: string,
  lastKey = value.at(-1),
) {
  await fireEvent.input(host, { target: { value } });
  host.setSelectionRange(value.length, value.length);
  await fireEvent.keyUp(host, { key: lastKey });
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
  test('the CSS declaration guard inspects every root selector block', () => {
    const declarationProperties = commandMenuRootDeclarationPropertiesFromCss(`
      .cinder-command-menu { padding: 0; }
      .cinder-command-menu[data-cinder-position-ready='false'] { position: fixed; }
      .cinder-command-menu.cinder-_floating-surface { box-shadow: none; }
      .cinder-command-menu .cinder-command-menu__empty { color: red; }
    `);

    expect(declarationProperties).toContain('position');
    expect(declarationProperties).toContain('box-shadow');
    expect(declarationProperties).not.toContain('color');
  });

  test('composes shared floating-surface chrome instead of redeclaring it', async () => {
    const rootDeclarationProperties = await commandMenuRootDeclarationProperties();

    for (const property of [
      'position',
      'z-index',
      'box-sizing',
      'margin',
      'border',
      'border-radius',
      'background',
      'color',
      'box-shadow',
    ]) {
      expect(rootDeclarationProperties).not.toContain(property);
    }
  });

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

  test('updates listbox and option ids when the listboxId prop changes', async () => {
    const states: Array<{ activeItemId: string | null; listboxId: string }> = [];
    const { getByTestId } = render(CommandMenuFixture, {
      onStateChanged: (activeItemId: string | null, listboxId: string) => {
        states.push({ activeItemId, listboxId });
      },
    });
    await waitFor(() => expect(queryListbox()).not.toBeNull());
    expect(queryListbox()?.id).toBe('fixture-command-listbox');
    expect(queryListbox()?.querySelector('[role="option"]')?.id).toStartWith(
      'fixture-command-listbox-item-',
    );

    await fireEvent.click(getByTestId('change-listbox-id'));
    await waitFor(() => expect(queryListbox()?.id).toBe('changed-listbox'));

    expect(queryListbox()?.querySelector('[role="option"]')?.id).toStartWith(
      'changed-listbox-item-',
    );
    expect(states.at(-1)).toMatchObject({ listboxId: 'changed-listbox' });
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

  test('click activation fires the per-item onSelect and the menu-level callback', async () => {
    // Regression: command-menu previously dropped the per-item `onSelect`
    // callback on activation, firing only the menu-level prop. command-palette's
    // shared-context contract fires both (the per-item callback first), so
    // command-menu now matches it.
    const itemSelect = mock(() => {});
    const selected: string[] = [];
    render(CommandMenuFixture, {
      items: [{ value: 'alpha', label: 'Alpha', onSelect: itemSelect }],
      onSelected: (value: string) => selected.push(value),
    });
    await waitFor(() => expect(queryMenu()).not.toBeNull());

    const option = document.body.querySelector('[role="option"]') as HTMLElement;
    await fireEvent.pointerDown(option);
    await fireEvent.click(option);

    expect(selected).toEqual(['alpha']);
    expect(itemSelect).toHaveBeenCalledTimes(1);
  });

  test('pointerenter on a non-active item makes it the active item, matching arrow-key navigation', async () => {
    // Parity requirement: command-palette.a11y.md documents hover and
    // ArrowDown/ArrowUp as equivalent ways to move the active item.
    render(CommandMenuFixture);
    await waitFor(() => expect(queryMenu()).not.toBeNull());

    const options = Array.from(document.body.querySelectorAll<HTMLElement>('[role="option"]'));
    expect(options[0]?.textContent).toContain('Alpha');
    expect(options[0]?.getAttribute('aria-selected')).toBe('true');
    const betaOption = options[1]!;
    expect(betaOption.textContent).toContain('Beta');
    expect(betaOption.getAttribute('aria-selected')).toBe('false');

    await fireEvent.pointerEnter(betaOption);
    await settleCommandMenu();

    expect(betaOption.getAttribute('aria-selected')).toBe('true');
    expect(options[0]?.getAttribute('aria-selected')).toBe('false');
  });

  test('pointerdown on an item prevents its default so the host field does not lose focus', async () => {
    render(CommandMenuFixture);
    await waitFor(() => expect(queryMenu()).not.toBeNull());

    const option = document.body.querySelector('[role="option"]') as HTMLElement;
    const pointerDownResult = await fireEvent.pointerDown(option);

    // fireEvent resolves false when the event's default action was
    // prevented (see the disabled-feature Tab test below for the inverse).
    expect(pointerDownResult).toBe(false);
  });

  test('clicking a disabled item does not activate it', async () => {
    const itemSelect = mock(() => {});
    const selected: string[] = [];
    render(CommandMenuFixture, {
      items: [{ value: 'alpha', label: 'Alpha', disabled: true, onSelect: itemSelect }],
      onSelected: (value: string) => selected.push(value),
    });
    await waitFor(() => expect(queryMenu()).not.toBeNull());

    const option = document.body.querySelector('[role="option"]') as HTMLElement;
    expect(option.getAttribute('aria-disabled')).toBe('true');

    await fireEvent.click(option);

    expect(itemSelect).not.toHaveBeenCalled();
    expect(selected).toEqual([]);
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

  test('Escape keeps a reopened menu dismissed for unchanged trigger text', async () => {
    const { getByTestId } = render(CommandMenuFixture);
    await waitFor(() => expect(queryMenu()).not.toBeNull());
    const anchor = getByTestId('anchor') as HTMLTextAreaElement;

    await fireEvent.keyDown(anchor, { key: 'Escape' });
    await waitFor(() => expect(queryMenu()).toBeNull());

    await fireEvent.click(getByTestId('reopen'));
    await settleCommandMenu();
    expect(queryMenu()).toBeNull();
  });

  test('moving the DOM selection clears the Escape dismissal latch', async () => {
    const { getByTestId } = render(CommandMenuHostFixture);
    const host = getByTestId('host') as HTMLTextAreaElement;

    await fireEvent.input(host, { target: { value: '/a' } });
    host.setSelectionRange(2, 2);
    await fireEvent.keyUp(host, { key: 'a' });
    await waitFor(() => expect(queryMenu()).not.toBeNull());

    await fireEvent.keyDown(host, { key: 'Escape' });
    await waitFor(() => expect(queryMenu()).toBeNull());

    host.setSelectionRange(0, 0);
    await fireEvent.keyUp(host, { key: 'ArrowLeft' });
    expect(queryMenu()).toBeNull();

    host.setSelectionRange(2, 2);
    await fireEvent.keyUp(host, { key: 'ArrowRight' });
    await waitFor(() => expect(queryMenu()).not.toBeNull());
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

  test('listbox is described by the empty-state message and marked non-empty via CSS hook', async () => {
    // Regression for #776: the empty state renders outside the listbox (a
    // `listbox` may only contain `option`/`group` children), so we wire
    // `aria-describedby` from the listbox to the empty-state element instead,
    // and flag `data-cinder-empty` so CSS can keep the listbox a non-zero-size
    // box rather than collapsing when it has no `<li>` children.
    const { getByTestId } = render(CommandMenuFixture);
    await waitFor(() => expect(queryMenu()).not.toBeNull());

    const listboxBefore = queryListbox()!;
    expect(listboxBefore.hasAttribute('aria-describedby')).toBe(false);
    expect(listboxBefore.hasAttribute('data-cinder-empty')).toBe(false);

    await fireEvent.click(getByTestId('empty-query'));
    await settleCommandMenu();

    const listbox = queryListbox()!;
    const emptyState = Array.from(queryMenu()?.children ?? []).find(
      (child) => child.getAttribute('role') === 'status',
    ) as HTMLElement;

    expect(emptyState?.id).toBeTruthy();
    expect(listbox.getAttribute('aria-describedby')).toBe(emptyState.id);
    expect(listbox.getAttribute('data-cinder-empty')).toBe('true');
  });

  test('omits aria-describedby and the empty-state hook when no `empty` snippet is passed', async () => {
    // Regression guard for the showEmptyState = showEmpty && Boolean(empty)
    // gate: without an `empty` snippet there's nothing for aria-describedby
    // to point at, so a dangling reference would be invalid ARIA.
    const { getByTestId } = render(CommandMenuFixture, { omitEmpty: true });
    await waitFor(() => expect(queryMenu()).not.toBeNull());

    await fireEvent.click(getByTestId('empty-query'));
    await settleCommandMenu();

    const listbox = queryListbox()!;
    expect(listbox.hasAttribute('aria-describedby')).toBe(false);
    expect(listbox.hasAttribute('data-cinder-empty')).toBe(false);
    expect(queryMenu()?.querySelector('[role="status"]')).toBeNull();
  });

  test('Enter with no active command passes through to the host field', async () => {
    const { getByTestId } = render(CommandMenuFixture);
    await waitFor(() => expect(queryMenu()).not.toBeNull());

    await fireEvent.click(getByTestId('empty-query'));
    await settleCommandMenu();
    const anchor = document.querySelector('[data-testid="anchor"]') as HTMLTextAreaElement;
    const event = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });

    anchor.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(false);
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

describe('CommandMenu inline ghost-text completion (#970)', () => {
  test('renders the active item’s remainder as aria-hidden ghost text', async () => {
    const { getByTestId } = render(CommandMenuHostFixture, { ghostTextEnabled: true });
    const host = getByTestId('host') as HTMLTextAreaElement;

    await typeIntoHost(host, '/al');
    await waitFor(() => expect(queryMenu()).not.toBeNull());
    await settleCommandMenu();

    const ghost = queryGhost();
    expect(ghost).not.toBeNull();
    expect(ghost?.textContent).toBe('pha');
    expect(ghost?.getAttribute('aria-hidden')).toBe('true');
  });

  test('preserves the active value’s own casing rather than the typed casing', async () => {
    // See command-menu.a11y.md (b): the remainder must not silently
    // normalize what the user already typed.
    const { getByTestId } = render(CommandMenuHostFixture, { ghostTextEnabled: true });
    const host = getByTestId('host') as HTMLTextAreaElement;

    await typeIntoHost(host, '/AL');
    await waitFor(() => expect(queryMenu()).not.toBeNull());
    await settleCommandMenu();

    expect(queryGhost()?.textContent).toBe('pha');
  });

  test('updates ghost text as ArrowUp/ArrowDown move the active item', async () => {
    const { getByTestId } = render(CommandMenuHostFixture, { ghostTextEnabled: true });
    const host = getByTestId('host') as HTMLTextAreaElement;

    await typeIntoHost(host, '/');
    await waitFor(() => expect(queryMenu()).not.toBeNull());
    await settleCommandMenu();
    expect(queryGhost()?.textContent).toBe('alpha');

    await fireEvent.keyDown(host, { key: 'ArrowDown' });
    await settleCommandMenu();
    expect(queryGhost()?.textContent).toBe('beta');
  });

  test('hides ghost text when the caret is not at the field end', async () => {
    const { getByTestId } = render(CommandMenuHostFixture, { ghostTextEnabled: true });
    const host = getByTestId('host') as HTMLTextAreaElement;

    await typeIntoHost(host, '/al');
    await waitFor(() => expect(queryGhost()).not.toBeNull());

    host.setSelectionRange(1, 1);
    await fireEvent.keyUp(host, { key: 'ArrowLeft' });
    await settleCommandMenu();

    expect(queryGhost()).toBeNull();
  });

  test('hides ghost text for an RTL field', async () => {
    const { getByTestId } = render(CommandMenuHostFixture, { ghostTextEnabled: true });
    const host = getByTestId('host') as HTMLTextAreaElement;
    host.setAttribute('dir', 'rtl');

    await typeIntoHost(host, '/al');
    await waitFor(() => expect(queryMenu()).not.toBeNull());
    await settleCommandMenu();

    expect(queryGhost()).toBeNull();
  });

  test('hides ghost text when the filtered list is empty', async () => {
    const { getByTestId } = render(CommandMenuHostFixture, { ghostTextEnabled: true });
    const host = getByTestId('host') as HTMLTextAreaElement;

    await typeIntoHost(host, '/zz');
    await waitFor(() => expect(queryMenu()).not.toBeNull());
    await settleCommandMenu();

    expect(queryGhost()).toBeNull();
  });

  test('suppresses ghost text on the keystroke that shrinks the query, then re-arms', async () => {
    const { getByTestId } = render(CommandMenuHostFixture, { ghostTextEnabled: true });
    const host = getByTestId('host') as HTMLTextAreaElement;

    await typeIntoHost(host, '/al');
    await waitFor(() => expect(queryGhost()?.textContent).toBe('pha'));

    await typeIntoHost(host, '/a', 'Backspace');
    await settleCommandMenu();
    expect(queryGhost()).toBeNull();

    await typeIntoHost(host, '/al');
    await settleCommandMenu();
    expect(queryGhost()?.textContent).toBe('pha');
  });

  test('a paste that grows the query still shows ghost text', async () => {
    const { getByTestId } = render(CommandMenuHostFixture, { ghostTextEnabled: true });
    const host = getByTestId('host') as HTMLTextAreaElement;

    await typeIntoHost(host, '/');
    await waitFor(() => expect(queryMenu()).not.toBeNull());

    // A paste delivers the whole new value in one input event, unlike a
    // sequence of individual keystrokes.
    await typeIntoHost(host, '/al', 'v');
    await settleCommandMenu();

    expect(queryGhost()?.textContent).toBe('pha');
  });

  test('hides ghost text while IME composition is active, and re-shows after it ends', async () => {
    const { getByTestId } = render(CommandMenuHostFixture, { ghostTextEnabled: true });
    const host = getByTestId('host') as HTMLTextAreaElement;

    await typeIntoHost(host, '/al');
    await waitFor(() => expect(queryGhost()?.textContent).toBe('pha'));

    await fireEvent.compositionStart(host);
    await settleCommandMenu();
    expect(queryGhost()).toBeNull();

    await fireEvent.compositionEnd(host);
    await settleCommandMenu();
    expect(queryGhost()?.textContent).toBe('pha');
  });

  test('a composition left in flight when the menu closes does not permanently suppress ghost text', async () => {
    // Regression: closing the menu (outside pointerdown) while `compositionstart`
    // has fired but its matching `compositionend` never arrives — the IME was
    // cancelled, or the composition simply outlives the menu — must not latch
    // `composing` true forever. The next open has to show ghost text again.
    const { getByTestId } = render(CommandMenuHostFixture, { ghostTextEnabled: true });
    const host = getByTestId('host') as HTMLTextAreaElement;

    await typeIntoHost(host, '/al');
    await waitFor(() => expect(queryGhost()?.textContent).toBe('pha'));

    await fireEvent.compositionStart(host);
    await settleCommandMenu();
    expect(queryGhost()).toBeNull();

    await fireEvent.pointerDown(getByTestId('outside'));
    await waitFor(() => expect(queryMenu()).toBeNull());

    await typeIntoHost(host, '/al');
    await waitFor(() => expect(queryGhost()?.textContent).toBe('pha'));
  });

  test('ArrowRight at the field end accepts and fires onComplete, not onSelect', async () => {
    const completed: Array<{ value: string; query: string; remainder: string }> = [];
    const selected: Array<{ value: string; query: string }> = [];
    const { getByTestId } = render(CommandMenuHostFixture, {
      ghostTextEnabled: true,
      onCompleted: (detail: { value: string; query: string; remainder: string }) =>
        completed.push(detail),
      onSelected: (value: string, query: string) => selected.push({ value, query }),
    });
    const host = getByTestId('host') as HTMLTextAreaElement;

    await typeIntoHost(host, '/al');
    await waitFor(() => expect(queryGhost()?.textContent).toBe('pha'));

    const event = new KeyboardEvent('keydown', {
      key: 'ArrowRight',
      bubbles: true,
      cancelable: true,
    });
    host.dispatchEvent(event);
    await settleCommandMenu();

    expect(event.defaultPrevented).toBe(true);
    expect(completed).toEqual([{ value: 'alpha', query: 'al', remainder: 'pha' }]);
    expect(selected).toEqual([]);
    expect(host.value).toBe('/alpha');
    expect(queryMenu()).not.toBeNull(); // accepting completes text, it does not select/close
    expect(queryGhost()).toBeNull(); // query now equals the active value — nothing left to complete
  });

  test('Tab accepts, keeps focus on the anchor, and Shift+Tab is never intercepted', async () => {
    const { getByTestId } = render(CommandMenuHostFixture, { ghostTextEnabled: true });
    const host = getByTestId('host') as HTMLTextAreaElement;
    host.focus();

    // Regression guard (Copilot review on #1146): preventDefault alone
    // suppresses Tab's native focus traversal, but the event still bubbles
    // — an ancestor keydown listener (a FocusTrap, another overlay) could
    // otherwise act on the same Tab press and move focus anyway. A
    // document-level spy proves the accepted keydown never reaches it.
    const ancestorKeydown = mock(() => {});
    document.addEventListener('keydown', ancestorKeydown);

    await typeIntoHost(host, '/al');
    await waitFor(() => expect(queryGhost()?.textContent).toBe('pha'));

    const shiftTabEvent = new KeyboardEvent('keydown', {
      key: 'Tab',
      shiftKey: true,
      bubbles: true,
      cancelable: true,
    });
    host.dispatchEvent(shiftTabEvent);
    expect(shiftTabEvent.defaultPrevented).toBe(false);
    expect(ancestorKeydown).toHaveBeenCalledTimes(1);
    expect(queryGhost()?.textContent).toBe('pha');

    const tabEvent = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
    host.dispatchEvent(tabEvent);
    await settleCommandMenu();

    expect(tabEvent.defaultPrevented).toBe(true);
    expect(host.value).toBe('/alpha');
    expect(document.activeElement).toBe(host);
    // The accepted Tab never bubbled to the ancestor listener above.
    expect(ancestorKeydown).toHaveBeenCalledTimes(1);

    document.removeEventListener('keydown', ancestorKeydown);
  });

  test('Enter always activates the listbox selection, never ghost text', async () => {
    const selected: Array<{ value: string; query: string }> = [];
    const { getByTestId } = render(CommandMenuHostFixture, {
      ghostTextEnabled: true,
      onSelected: (value: string, query: string) => selected.push({ value, query }),
    });
    const host = getByTestId('host') as HTMLTextAreaElement;

    await typeIntoHost(host, '/al');
    await waitFor(() => expect(queryGhost()?.textContent).toBe('pha'));

    await fireEvent.keyDown(host, { key: 'Enter' });

    expect(selected).toEqual([{ value: 'alpha', query: 'al' }]);
    expect(host.value).toBe('[alpha]');
    await waitFor(() => expect(queryMenu()).toBeNull());
  });

  test('End moves the active item to the last option instead of accepting ghost text', async () => {
    // In-repo precedent wins over the issue's own suggestion — see
    // command-menu.a11y.md (b). Unmodified End is already claimed by the
    // shared list (command-menu.test.ts's pre-existing 'keyboard navigation'
    // coverage); ghost text must not steal it back.
    const completed: unknown[] = [];
    const { getByTestId } = render(CommandMenuHostFixture, {
      ghostTextEnabled: true,
      onCompleted: (detail: unknown) => completed.push(detail),
    });
    const host = getByTestId('host') as HTMLTextAreaElement;

    await typeIntoHost(host, '/');
    await waitFor(() => expect(queryGhost()?.textContent).toBe('alpha'));

    await fireEvent.keyDown(host, { key: 'End' });
    await settleCommandMenu();

    expect(completed).toEqual([]);
    expect(host.value).toBe('/');
    expect(queryMenu()?.querySelector('[aria-selected="true"]')?.textContent).toContain('Beta');
    expect(queryGhost()?.textContent).toBe('beta');
  });

  test('Escape dismisses ghost text first, then falls through to close the menu', async () => {
    const dismissed = mock(() => {});
    const { getByTestId } = render(CommandMenuHostFixture, {
      ghostTextEnabled: true,
      onDismissed: dismissed,
    });
    const host = getByTestId('host') as HTMLTextAreaElement;

    await typeIntoHost(host, '/al');
    await waitFor(() => expect(queryGhost()?.textContent).toBe('pha'));

    await fireEvent.keyDown(host, { key: 'Escape' });
    await settleCommandMenu();
    expect(queryGhost()).toBeNull();
    expect(queryMenu()).not.toBeNull();
    expect(dismissed).not.toHaveBeenCalled();

    await fireEvent.keyDown(host, { key: 'Escape' });
    await settleCommandMenu();
    expect(dismissed).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(queryMenu()).toBeNull());
  });

  test('disabled feature: without onComplete, no ghost text renders and Tab is untouched', async () => {
    const { getByTestId } = render(CommandMenuHostFixture, { ghostTextEnabled: false });
    const host = getByTestId('host') as HTMLTextAreaElement;

    await typeIntoHost(host, '/al');
    await waitFor(() => expect(queryMenu()).not.toBeNull());
    await settleCommandMenu();

    expect(queryGhost()).toBeNull();

    const tabResult = await fireEvent.keyDown(host, { key: 'Tab' });
    expect(tabResult).toBe(true); // fireEvent resolves true when preventDefault was never called
  });

  test('caretIndex omitted: ghost text still derives caret position from the live selection', async () => {
    const { getByTestId } = render(CommandMenuHostFixture, {
      ghostTextEnabled: true,
      explicitCaretIndex: false,
    });
    const host = getByTestId('host') as HTMLTextAreaElement;

    await typeIntoHost(host, '/al');
    await waitFor(() => expect(queryMenu()).not.toBeNull());
    await settleCommandMenu();

    expect(queryGhost()?.textContent).toBe('pha');
  });

  test('positions the ghost overlay from a measured caret rect once one is available', async () => {
    const { getByTestId } = render(CommandMenuHostFixture, { ghostTextEnabled: true });
    const host = getByTestId('host') as HTMLTextAreaElement;
    Object.defineProperty(host, 'getBoundingClientRect', {
      value: () => new DOMRect(20, 30, 200, 20),
      configurable: true,
    });

    await typeIntoHost(host, '/al');
    await waitFor(() => expect(queryGhost()).not.toBeNull());
    await settleCommandMenu();

    const ghost = queryGhost()!;
    expect(ghost.getAttribute('data-cinder-position-ready')).toBe('true');
    expect(ghost.style.position).toBe('fixed');
    expect(ghost.style.left).toBeTruthy();
    expect(ghost.style.top).toBeTruthy();
  });
});

describe('CommandMenu ghost overlay scroll coalescing (#1186 row 1)', () => {
  // happy-dom does not deliver capture-phase listeners registered on `window`
  // when an event is dispatched directly at `window` (verified: a bare
  // `window.addEventListener('scroll', fn, { capture: true })` +
  // `window.dispatchEvent(new Event('scroll'))` never invokes `fn`, even
  // outside this component, while the identical listener without `capture`
  // fires normally). `bumpSelectionGeneration` is the exact same closure for
  // all three of its trigger sources (anchor-local scroll, capture-phase
  // window scroll, window resize) — coalescing it via the anchor's own
  // `scroll` listener (non-capture, fires reliably under happy-dom) proves
  // the same rAF-batching logic the capture-phase window listener shares.
  test('coalesces synchronous scroll events into one caret re-measure per frame', async () => {
    // Install a manually-flushed animation frame queue before mounting, so
    // any frame the component schedules — including incidental ones during
    // mount/positioning — lands in a queue this test controls rather than
    // the real (async, ~16ms) scheduler.
    const originalRequestAnimationFrame = globalThis.requestAnimationFrame;
    const originalCancelAnimationFrame = globalThis.cancelAnimationFrame;
    const frameCallbacks = new Map<number, FrameRequestCallback>();
    let nextFrameId = 1;
    globalThis.requestAnimationFrame = (callback: FrameRequestCallback) => {
      const id = nextFrameId;
      nextFrameId += 1;
      frameCallbacks.set(id, callback);
      return id;
    };
    globalThis.cancelAnimationFrame = (id: number) => {
      frameCallbacks.delete(id);
    };
    async function flushOneFrame() {
      const callbacks = Array.from(frameCallbacks.values());
      frameCallbacks.clear();
      for (const callback of callbacks) callback(performance.now());
      await tick();
    }

    try {
      const { getByTestId } = render(CommandMenuHostFixture, { ghostTextEnabled: true });
      const host = getByTestId('host') as HTMLTextAreaElement;
      Object.defineProperty(host, 'getBoundingClientRect', {
        value: () => new DOMRect(20, 30, 200, 20),
        configurable: true,
      });

      await typeIntoHost(host, '/al');
      await waitFor(() => expect(queryGhost()).not.toBeNull());
      await settleCommandMenu();

      // Drain any frame(s) scheduled incidentally during mount/positioning
      // before starting the measured scroll-coalescing assertions below.
      await flushOneFrame();
      await flushOneFrame();

      const appendSpy = spyOn(document.body, 'append');

      await fireEvent.scroll(host);
      await fireEvent.scroll(host);
      await fireEvent.scroll(host);

      // No re-measure until a frame is flushed, no matter how many scroll
      // events fired synchronously.
      expect(appendSpy).toHaveBeenCalledTimes(0);

      await flushOneFrame();
      expect(appendSpy).toHaveBeenCalledTimes(1);

      await fireEvent.scroll(host);
      await flushOneFrame();
      expect(appendSpy).toHaveBeenCalledTimes(2);

      appendSpy.mockRestore();
    } finally {
      globalThis.requestAnimationFrame = originalRequestAnimationFrame;
      globalThis.cancelAnimationFrame = originalCancelAnimationFrame;
    }
  });
});
