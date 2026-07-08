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
const offsetSpy = mock((options: unknown) => ({ name: 'offset', options, fn: () => ({}) }));

mock.module('@floating-ui/dom', () => ({
  arrow: () => ({ name: 'arrow', fn: () => ({}) }),
  computePosition: computePositionSpy,
  autoUpdate: autoUpdateSpy,
  flip: () => ({ name: 'flip', fn: () => ({}) }),
  shift: () => ({ name: 'shift', fn: () => ({}) }),
  offset: offsetSpy,
}));

const { cleanup, fireEvent, render, waitFor } = await import('@testing-library/svelte');
const { tick } = await import('svelte');
const { default: ChatComposerPopoverFixture } =
  await import('./chat-composer-popover.test-fixture.svelte');
type TestComposerCommand = {
  value: string;
  label: string;
  description?: string;
  keywords?: string[];
  disabled?: boolean;
};
type ChatComposerPopoverSelection<TItem extends TestComposerCommand> =
  import('./chat-composer-popover.types.ts').ChatComposerPopoverSelection<TItem>;

function getComposer(): HTMLTextAreaElement {
  return document.querySelector<HTMLTextAreaElement>('#test-chat-input-editor')!;
}

function queryListbox(): HTMLElement | null {
  return document.body.querySelector('[role="listbox"]');
}

async function typeComposer(value: string): Promise<HTMLTextAreaElement> {
  const composer = getComposer();
  composer.value = value;
  composer.setSelectionRange(value.length, value.length);
  await fireEvent.input(composer);
  await tick();
  return composer;
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

describe('ChatComposerPopover', () => {
  test('passes combobox ARIA through to the ChatInput composer while open', async () => {
    render(ChatComposerPopoverFixture);
    const composer = await typeComposer('/h');

    await waitFor(() => expect(queryListbox()).not.toBeNull());
    const listbox = queryListbox()!;

    expect(composer.getAttribute('role')).toBe('combobox');
    expect(composer.getAttribute('aria-autocomplete')).toBe('list');
    expect(composer.getAttribute('aria-expanded')).toBe('true');
    expect(composer.getAttribute('aria-controls')).toBe(listbox.id);
    expect(composer.getAttribute('aria-activedescendant')).toBeTruthy();
    expect(listbox.getAttribute('aria-label')).toBe('Composer suggestions');
  });

  test('filters suggestions from the active slash token', async () => {
    render(ChatComposerPopoverFixture);
    await typeComposer('/tol');

    await waitFor(() => expect(queryListbox()).not.toBeNull());
    const options = Array.from(document.body.querySelectorAll('[role="option"]'));

    expect(options.map((option) => option.textContent?.trim())).toEqual(['Tools']);
  });

  test('supports keyboard navigation, Enter selection, and focus return', async () => {
    const selected: ChatComposerPopoverSelection<TestComposerCommand>[] = [];
    render(ChatComposerPopoverFixture, {
      onSelected: (selection: ChatComposerPopoverSelection<TestComposerCommand>) => {
        selected.push(selection);
      },
    });
    const composer = await typeComposer('/');

    await waitFor(() => expect(queryListbox()).not.toBeNull());
    await fireEvent.keyDown(composer, { key: 'ArrowDown' });
    await tick();
    await fireEvent.keyDown(composer, { key: 'Enter' });

    expect(selected).toHaveLength(1);
    expect(selected[0]?.item.value).toBe('new');
    expect(selected[0]?.query).toBe('');
    expect(selected[0]?.trigger).toBe('/');
    expect(selected[0]?.range).toEqual({ start: 0, end: 1 });
    await waitFor(() => expect(queryListbox()).toBeNull());
    expect(document.activeElement).toBe(composer);
  });

  test('does not reopen when selection replacement text still starts with a trigger', async () => {
    render(ChatComposerPopoverFixture, { replaceWithSelectedCommand: true });
    const composer = await typeComposer('/sto');

    await waitFor(() => expect(queryListbox()).not.toBeNull());
    await fireEvent.keyDown(composer, { key: 'Enter' });

    await waitFor(() => expect(queryListbox()).toBeNull());
    expect(composer.value).toBe('/stop');
    expect(composer.getAttribute('aria-expanded')).toBe('false');
  });

  test('Escape dismisses the popover and clears composer ARIA', async () => {
    render(ChatComposerPopoverFixture);
    const composer = await typeComposer('/h');

    await waitFor(() => expect(queryListbox()).not.toBeNull());
    await tick();
    composer.focus();
    expect(document.activeElement).toBe(composer);
    composer.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }),
    );
    await tick();

    await waitFor(() => expect(queryListbox()).toBeNull());
    expect(composer.getAttribute('aria-expanded')).toBe('false');
    expect(composer.getAttribute('aria-controls')).toBeNull();
    expect(composer.getAttribute('aria-activedescendant')).toBeNull();
    expect(document.activeElement).toBe(composer);
  });

  test('calls ondismiss when typing removes the active trigger token', async () => {
    const onDismissed = mock(() => {});
    render(ChatComposerPopoverFixture, { onDismissed });
    const composer = await typeComposer('/h');

    await waitFor(() => expect(queryListbox()).not.toBeNull());
    expect(onDismissed).toHaveBeenCalledTimes(0);

    await typeComposer('hello');

    await waitFor(() => expect(queryListbox()).toBeNull());
    expect(onDismissed).toHaveBeenCalledTimes(1);
    expect(composer.getAttribute('aria-expanded')).toBe('false');
    expect(composer.getAttribute('aria-controls')).toBeNull();
    expect(composer.getAttribute('aria-activedescendant')).toBeNull();
  });

  test('calls ondismiss and clears state when outside pointer dismissal closes the child menu first', async () => {
    const onDismissed = mock(() => {});
    const { getByTestId } = render(ChatComposerPopoverFixture, { onDismissed });
    const composer = await typeComposer('/h');
    const outside = getByTestId('outside');

    await waitFor(() => expect(queryListbox()).not.toBeNull());

    outside.focus();
    expect(document.activeElement).toBe(outside);

    await fireEvent.pointerDown(outside);

    await waitFor(() => expect(queryListbox()).toBeNull());
    expect(onDismissed).toHaveBeenCalledTimes(1);
    expect(composer.getAttribute('aria-expanded')).toBe('false');
    expect(composer.getAttribute('aria-controls')).toBeNull();
    expect(composer.getAttribute('aria-activedescendant')).toBeNull();
    expect(document.activeElement).toBe(outside);
  });

  test('dismisses when caret-only movement leaves the active trigger token', async () => {
    const onDismissed = mock(() => {});
    render(ChatComposerPopoverFixture, { onDismissed });
    const composer = await typeComposer('hello /h');

    await waitFor(() => expect(queryListbox()).not.toBeNull());

    const arrowLeft = new KeyboardEvent('keydown', {
      key: 'ArrowLeft',
      bubbles: true,
      cancelable: true,
    });
    composer.dispatchEvent(arrowLeft);
    composer.setSelectionRange(2, 2);

    await waitFor(() => expect(queryListbox()).toBeNull());
    expect(onDismissed).toHaveBeenCalledTimes(1);
    expect(composer.getAttribute('aria-expanded')).toBe('false');
    expect(composer.getAttribute('aria-controls')).toBeNull();
    expect(composer.getAttribute('aria-activedescendant')).toBeNull();
  });

  test('lets Enter submit when the filtered list has no active suggestion', async () => {
    const submittedMessages: unknown[] = [];
    render(ChatComposerPopoverFixture, {
      onSubmitted: (message: unknown) => submittedMessages.push(message),
    });
    const composer = await typeComposer('/zzzz');

    await waitFor(() => expect(queryListbox()).not.toBeNull());
    expect(composer.getAttribute('aria-activedescendant')).toBeNull();

    await fireEvent.keyDown(composer, { key: 'Enter' });

    await waitFor(() => expect(submittedMessages).toHaveLength(1));
    expect(submittedMessages[0]).toMatchObject({ content: '/zzzz' });
    await waitFor(() => expect(queryListbox()).toBeNull());
    expect(composer.getAttribute('aria-expanded')).toBe('false');
  });

  test('does not expose expanded combobox ARIA before the composer anchor is known', async () => {
    render(ChatComposerPopoverFixture, { initialValue: '/h' });
    const composer = getComposer();

    await tick();

    expect(composer.value).toBe('/h');
    expect(queryListbox()).toBeNull();
    expect(composer.getAttribute('aria-expanded')).toBe('false');
    expect(composer.getAttribute('aria-controls')).toBeNull();
  });

  test('dismisses when pointer caret movement leaves the active trigger token', async () => {
    const onDismissed = mock(() => {});
    render(ChatComposerPopoverFixture, { onDismissed });
    const composer = await typeComposer('hello /h');

    await waitFor(() => expect(queryListbox()).not.toBeNull());

    composer.setSelectionRange(2, 2);
    await fireEvent.pointerUp(composer);

    await waitFor(() => expect(queryListbox()).toBeNull());
    expect(onDismissed).toHaveBeenCalledTimes(1);
    expect(composer.getAttribute('aria-expanded')).toBe('false');
    expect(composer.getAttribute('aria-controls')).toBeNull();
    expect(composer.getAttribute('aria-activedescendant')).toBeNull();
  });

  test('dismisses without stealing focus when keyboard focus leaves the composer', async () => {
    const onDismissed = mock(() => {});
    const { getByTestId } = render(ChatComposerPopoverFixture, { onDismissed });
    const composer = await typeComposer('/h');
    const outside = getByTestId('outside');

    await waitFor(() => expect(queryListbox()).not.toBeNull());

    await fireEvent.blur(composer, { relatedTarget: outside });
    outside.focus();

    await waitFor(() => expect(queryListbox()).toBeNull());
    expect(onDismissed).toHaveBeenCalledTimes(1);
    expect(document.activeElement).toBe(outside);
    expect(composer.getAttribute('aria-expanded')).toBe('false');
  });

  test('lets modified navigation keys reach the composer', async () => {
    render(ChatComposerPopoverFixture);
    const composer = await typeComposer('/h');

    await waitFor(() => expect(queryListbox()).not.toBeNull());

    const shiftArrowUp = new KeyboardEvent('keydown', {
      key: 'ArrowUp',
      shiftKey: true,
      bubbles: true,
      cancelable: true,
    });
    composer.dispatchEvent(shiftArrowUp);
    expect(shiftArrowUp.defaultPrevented).toBe(false);

    const controlEnd = new KeyboardEvent('keydown', {
      key: 'End',
      ctrlKey: true,
      bubbles: true,
      cancelable: true,
    });
    composer.dispatchEvent(controlEnd);
    expect(controlEnd.defaultPrevented).toBe(false);
  });

  test('supports mention triggers with the same listbox primitive', async () => {
    render(ChatComposerPopoverFixture, {
      commands: [
        { value: 'steve', label: 'Steve Kinney' },
        { value: 'sarah', label: 'Sarah Connor' },
      ],
    });
    await typeComposer('@ste');

    await waitFor(() => expect(queryListbox()).not.toBeNull());
    const options = Array.from(document.body.querySelectorAll('[role="option"]'));
    expect(options.map((option) => option.textContent?.trim())).toEqual(['Steve Kinney']);
  });
});
