/// <reference lib="dom" />
import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test';

import { setupHappyDom } from '../../test/happy-dom.ts';

setupHappyDom();

const computePositionSpy = mock(
  async (_anchor: unknown, _panel: HTMLElement, options: { placement: string }) => ({
    x: 12,
    y: 34,
    placement: options.placement,
    middlewareData: {},
  }),
);
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
  // ChatComposerPopover renders CommandMenu, which opts into the shared anchored
  // overlay's `size` middleware (CIN-332): it locks its placement on open, so it
  // needs `size` to shrink rather than overflow when it stops fitting. This mock
  // stands in for the whole module, so every middleware factory the composed tree
  // reaches has to be present or the helper calls `undefined`.
  size: (options: unknown) => ({ name: 'size', options, fn: () => ({}) }),
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
  test('loads grouped async sources and enforces each source limit', async () => {
    let loadCount = 0;
    let resolveItems: ((items: TestComposerCommand[]) => void) | undefined;
    const pending = new Promise<TestComposerCommand[]>((resolve) => {
      resolveItems = resolve;
    });
    render(ChatComposerPopoverFixture, {
      commands: [],
      sources: [
        {
          id: 'files',
          label: 'Files',
          limit: 1,
          load: () => {
            loadCount += 1;
            return pending;
          },
        },
      ],
    });

    await typeComposer('@');
    await waitFor(() =>
      expect(document.body.querySelector('.cinder-command-menu__empty')?.textContent).toContain(
        'Loading suggestions',
      ),
    );
    resolveItems?.([
      { value: 'readme', label: 'README.md' },
      { value: 'package', label: 'package.json' },
    ]);
    await waitFor(() => expect(loadCount).toBe(1));
    await waitFor(() =>
      expect(queryListbox()?.getAttribute('aria-label')).toBe('Composer suggestions'),
    );
    await waitFor(() =>
      expect(document.body.querySelector('.chat-composer-popover__group-label')).not.toBeNull(),
    );

    expect(document.body.querySelector('.chat-composer-popover__group-label')?.textContent).toBe(
      'Files',
    );
    const options = document.body.querySelectorAll('[role="option"]');
    expect(options).toHaveLength(1);
    expect(options[0]?.textContent).toContain('README.md');
    expect(options[0]?.getAttribute('aria-label')).toContain('Files:');
    expect(document.body.textContent).not.toContain('package.json');
  });

  test('keeps healthy async source groups when another source rejects', async () => {
    render(ChatComposerPopoverFixture, {
      commands: [],
      sources: [
        {
          id: 'healthy',
          label: 'Healthy',
          load: async () => [{ value: 'readme', label: 'README.md' }],
        },
        {
          id: 'failed',
          label: 'Failed',
          load: async () => Promise.reject(new Error('offline')),
        },
      ],
    });

    await typeComposer('@');
    await waitFor(() => expect(document.body.textContent).toContain('README.md'));
    expect(document.body.textContent).not.toContain('Loading suggestions');
  });

  test('shows resolved source groups while another source is still pending', async () => {
    const neverSettles = new Promise<TestComposerCommand[]>(() => {});
    render(ChatComposerPopoverFixture, {
      commands: [],
      sources: [
        {
          id: 'healthy',
          label: 'Healthy',
          load: async () => [{ value: 'readme', label: 'README.md' }],
        },
        { id: 'pending', label: 'Pending', load: () => neverSettles },
      ],
    });

    await typeComposer('@');
    await waitFor(() => expect(document.body.textContent).toContain('README.md'));
    expect(document.body.textContent).not.toContain('Pending');
  });

  test('selects the correct occurrence when source items share a value', async () => {
    const selected: ChatComposerPopoverSelection<TestComposerCommand>[] = [];
    render(ChatComposerPopoverFixture, {
      commands: [],
      sources: [
        {
          id: 'people',
          label: 'People',
          load: async () => [
            { value: 'shared', label: 'First result' },
            { value: 'shared', label: 'Second result' },
          ],
        },
      ],
      onSelected: (selection: ChatComposerPopoverSelection<TestComposerCommand>) => {
        selected.push(selection);
      },
    });

    const composer = await typeComposer('@');
    await waitFor(() => expect(document.body.textContent).toContain('Second result'));
    await fireEvent.keyDown(composer, { key: 'ArrowDown' });
    await fireEvent.keyDown(composer, { key: 'Enter' });

    expect(selected[0]?.item.label).toBe('Second result');
    expect(selected[0]?.value).toBe('shared');
  });

  test('preserves the active static suggestion when an async source resolves', async () => {
    let resolveItems: ((items: TestComposerCommand[]) => void) | undefined;
    const pending = new Promise<TestComposerCommand[]>((resolve) => {
      resolveItems = resolve;
    });
    render(ChatComposerPopoverFixture, {
      sources: [{ id: 'files', label: 'Files', load: () => pending }],
    });

    const composer = await typeComposer('/');
    await fireEvent.keyDown(composer, { key: 'ArrowDown' });
    const activeBefore = composer.getAttribute('aria-activedescendant');
    expect(activeBefore).toBeTruthy();

    resolveItems?.([{ value: 'readme', label: 'README.md' }]);
    await waitFor(() => expect(document.body.textContent).toContain('README.md'));
    await waitFor(() => expect(composer.getAttribute('aria-activedescendant')).toBe(activeBefore));
  });

  test('preserves the active suggestion identity when labels are duplicated', async () => {
    let resolveItems: ((items: TestComposerCommand[]) => void) | undefined;
    const pending = new Promise<TestComposerCommand[]>((resolve) => {
      resolveItems = resolve;
    });
    const selected: ChatComposerPopoverSelection<TestComposerCommand>[] = [];
    render(ChatComposerPopoverFixture, {
      commands: [
        { value: 'first', label: 'Duplicate' },
        { value: 'second', label: 'Duplicate' },
      ],
      sources: [{ id: 'files', label: 'Files', load: () => pending }],
      onSelected: (selection: ChatComposerPopoverSelection<TestComposerCommand>) =>
        selected.push(selection),
    });

    const composer = await typeComposer('/');
    await fireEvent.keyDown(composer, { key: 'ArrowDown' });
    resolveItems?.([{ value: 'source', label: 'Source result' }]);
    await waitFor(() => expect(document.body.textContent).toContain('Source result'));
    await fireEvent.keyDown(composer, { key: 'Enter' });

    expect(selected[0]?.item.value).toBe('second');
  });

  test('passes combobox ARIA through to the ChatInput composer while open', async () => {
    render(ChatComposerPopoverFixture);
    const composer = await typeComposer('/h');

    await waitFor(() => expect(queryListbox()).not.toBeNull());
    const listbox = queryListbox()!;

    await waitFor(() => expect(computePositionSpy).toHaveBeenCalled());
    expect(computePositionSpy.mock.calls.at(-1)?.[2]).toMatchObject({
      placement: 'top-start',
    });

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

  test('Tab commits the active suggestion and keeps focus in the composer', async () => {
    const selected: ChatComposerPopoverSelection<TestComposerCommand>[] = [];
    render(ChatComposerPopoverFixture, {
      onSelected: (selection: ChatComposerPopoverSelection<TestComposerCommand>) => {
        selected.push(selection);
      },
    });
    const composer = await typeComposer('/');

    await waitFor(() => expect(queryListbox()).not.toBeNull());
    const tabEvent = new KeyboardEvent('keydown', {
      key: 'Tab',
      bubbles: true,
      cancelable: true,
    });
    composer.dispatchEvent(tabEvent);
    await tick();

    expect(tabEvent.defaultPrevented).toBe(true);
    expect(selected).toHaveLength(1);
    expect(selected[0]?.item.value).toBe('help');
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

  test('does not reopen when selection is committed through insertAtRange()', async () => {
    render(ChatComposerPopoverFixture, { replaceWithSelectedCommandImperatively: true });
    const composer = await typeComposer('/sto');

    await waitFor(() => expect(queryListbox()).not.toBeNull());
    await fireEvent.keyDown(composer, { key: 'Enter' });

    await waitFor(() => expect(queryListbox()).toBeNull());
    expect(composer.value).toBe('/stop');
    expect(composer.getAttribute('aria-expanded')).toBe('false');
  });

  test('resyncs external value changes after a throwing selection handler', async () => {
    const { getByTestId } = render(ChatComposerPopoverFixture, { throwOnSelected: true });
    await typeComposer('/h');

    await waitFor(() => expect(queryListbox()).not.toBeNull());

    await fireEvent.keyDown(getComposer(), { key: 'Enter' });
    await tick();

    await fireEvent.click(getByTestId('external-clear'));
    await tick();

    expect(queryListbox()).toBeNull();
    expect(getComposer().getAttribute('aria-expanded')).toBe('false');
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

  test('calls onDismiss when typing removes the active trigger token', async () => {
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

  test('calls onDismiss and clears state when outside pointer dismissal closes the child menu first', async () => {
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

  test('does not reopen from a pending caret sync after dismissal', async () => {
    const onDismissed = mock(() => {});
    render(ChatComposerPopoverFixture, { onDismissed });
    const composer = await typeComposer('hello /h');

    await waitFor(() => expect(queryListbox()).not.toBeNull());

    composer.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true, cancelable: true }),
    );
    composer.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }),
    );
    await new Promise((resolve) => setTimeout(resolve, 0));
    await tick();

    expect(queryListbox()).toBeNull();
    expect(onDismissed).toHaveBeenCalledTimes(1);
    expect(composer.getAttribute('aria-expanded')).toBe('false');
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

  test('uses the nearest configured trigger after an opening delimiter', async () => {
    render(ChatComposerPopoverFixture, {
      commands: [{ value: 'alice', label: 'Alice' }],
    });
    await typeComposer('/(@ali');

    await waitFor(() => expect(queryListbox()).not.toBeNull());
    expect(Array.from(document.body.querySelectorAll('[role="option"]'))[0]?.textContent).toContain(
      'Alice',
    );
  });
});
