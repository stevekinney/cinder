/// <reference lib="dom" />
import { afterEach, describe, expect, mock, test } from 'bun:test';
import { createRawSnippet } from 'svelte';

import { setupHappyDom } from '../../test/happy-dom.ts';

setupHappyDom();

const { cleanup, fireEvent, render, screen } = await import('@testing-library/svelte');
const { default: Toolbar } = await import('./index.ts');
const { default: ToolbarSpacer } = await import('./toolbar-spacer.svelte');
const { default: ToolbarCompositionFixture } =
  await import('../../test/fixtures/toolbar-composition-fixture.svelte');

afterEach(() => cleanup());

function rawSnippet(markup: string) {
  return createRawSnippet(() => ({
    render: () => `<div data-testid="snippet-root">${markup}</div>`,
    setup: () => {},
  }));
}

async function flushEffects(): Promise<void> {
  await new Promise<void>((resolve) => setTimeout(resolve, 0));
}

describe('Toolbar', () => {
  test('renders role toolbar and required accessible name', async () => {
    render(Toolbar, {
      props: {
        'aria-label': 'Preview controls',
        children: rawSnippet('<button type="button">One</button>'),
      },
    });
    await flushEffects();

    expect(screen.getByRole('toolbar', { name: 'Preview controls' })).toBeTruthy();
  });

  test('merges custom class and prevents role override', async () => {
    const { container } = render(Toolbar, {
      props: {
        'aria-label': 'Controls',
        class: 'extra',
        role: 'group',
        children: rawSnippet('<button type="button">One</button>'),
      } as never,
    });
    await flushEffects();

    const toolbar = container.querySelector('.cinder-toolbar');
    expect(toolbar?.getAttribute('role')).toBe('toolbar');
    expect(toolbar?.classList.contains('extra')).toBe(true);
  });

  test('warns when the accessible name source is empty', () => {
    const warnSpy = mock(() => {});
    const original = console.warn;
    console.warn = warnSpy;

    try {
      render(Toolbar, {
        props: {
          'aria-label': '   ',
          children: rawSnippet('<button type="button">One</button>'),
        },
      });
      expect(warnSpy).toHaveBeenCalledTimes(1);
    } finally {
      console.warn = original;
    }
  });

  test('warns when aria-labelledby points at unresolved text', () => {
    const warnSpy = mock(() => {});
    const original = console.warn;
    console.warn = warnSpy;

    try {
      render(Toolbar, {
        props: {
          'aria-labelledby': 'missing-label',
          children: rawSnippet('<button type="button">One</button>'),
        },
      });
      expect(warnSpy).toHaveBeenCalledTimes(1);
    } finally {
      console.warn = original;
    }
  });

  test('initial roving tabindex assigns 0 to the first enabled item', async () => {
    render(Toolbar, {
      props: {
        'aria-label': 'Controls',
        children: rawSnippet(`
          <button type="button">One</button>
          <button type="button" disabled>Two</button>
          <button type="button">Three</button>
        `),
      },
    });
    await flushEffects();

    const buttons = screen.getAllByRole('button');
    expect(buttons[0]!.tabIndex).toBe(0);
    expect(buttons[1]!.tabIndex).toBe(-1);
    expect(buttons[2]!.tabIndex).toBe(-1);
  });

  test('ArrowRight roves focus horizontally and skips disabled items', async () => {
    render(Toolbar, {
      props: {
        'aria-label': 'Controls',
        children: rawSnippet(`
          <button type="button">One</button>
          <button type="button" disabled>Two</button>
          <button type="button">Three</button>
        `),
      },
    });

    const [one, , three] = screen.getAllByRole('button');
    one?.focus();
    await fireEvent.keyDown(one!, { key: 'ArrowRight' });
    await flushEffects();

    expect(document.activeElement).toBe(three!);
    expect(three!.tabIndex).toBe(0);
  });

  test('Home and End move between toolbar items', async () => {
    render(Toolbar, {
      props: {
        'aria-label': 'Controls',
        children: rawSnippet(`
          <button type="button">One</button>
          <button type="button">Two</button>
          <button type="button">Three</button>
        `),
      },
    });

    const buttons = screen.getAllByRole('button');
    buttons[1]?.focus();
    await fireEvent.keyDown(buttons[1]!, { key: 'End' });
    await flushEffects();
    expect(document.activeElement).toBe(buttons[2]!);
    await fireEvent.keyDown(buttons[2]!, { key: 'Home' });
    await flushEffects();
    expect(document.activeElement).toBe(buttons[0]!);
  });

  test('editable inputs keep ArrowRight until the caret reaches the boundary', async () => {
    render(Toolbar, {
      props: {
        'aria-label': 'Controls',
        children: rawSnippet(`
          <button type="button">One</button>
          <input aria-label="Search" value="abc" />
          <button type="button">Three</button>
        `),
      },
    });

    const input = screen.getByRole<HTMLInputElement>('textbox', { name: 'Search' });
    input.focus();
    input.setSelectionRange(1, 1);
    await fireEvent.keyDown(input, { key: 'ArrowRight' });
    await flushEffects();
    expect(document.activeElement).toBe(input);

    input.setSelectionRange(3, 3);
    await fireEvent.keyDown(input, { key: 'ArrowRight' });
    await flushEffects();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Three' }));
  });

  test('arrowing into an editable input places the caret at the entry boundary', async () => {
    render(Toolbar, {
      props: {
        'aria-label': 'Controls',
        children: rawSnippet(`
          <button type="button">One</button>
          <input aria-label="Search" value="abc" />
          <button type="button">Three</button>
        `),
      },
    });

    const one = screen.getByRole('button', { name: 'One' });
    const input = screen.getByRole<HTMLInputElement>('textbox', { name: 'Search' });
    const three = screen.getByRole('button', { name: 'Three' });

    one.focus();
    await fireEvent.keyDown(one, { key: 'ArrowRight' });
    await flushEffects();
    expect(document.activeElement).toBe(input);
    expect(input.selectionStart).toBe(0);

    await fireEvent.keyDown(input, { key: 'ArrowRight' });
    await flushEffects();
    expect(document.activeElement).toBe(input);

    three.focus();
    await fireEvent.keyDown(three, { key: 'ArrowLeft' });
    await flushEffects();
    expect(document.activeElement).toBe(input);
    expect(input.selectionStart).toBe(input.value.length);

    await fireEvent.keyDown(input, { key: 'ArrowLeft' });
    await flushEffects();
    expect(document.activeElement).toBe(input);
  });

  test('Escape moves focus out of an editable field', async () => {
    render(Toolbar, {
      props: {
        'aria-label': 'Controls',
        children: rawSnippet(`
          <button type="button">One</button>
          <input aria-label="Search" value="abc" />
          <button type="button">Three</button>
        `),
      },
    });

    const input = screen.getByRole<HTMLInputElement>('textbox', { name: 'Search' });
    input.focus();
    await fireEvent.keyDown(input, { key: 'Escape' });
    await flushEffects();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Three' }));
  });

  test('hidden inputs and hidden descendants are excluded from the managed set', async () => {
    render(Toolbar, {
      props: {
        'aria-label': 'Controls',
        children: rawSnippet(`
          <button type="button">One</button>
          <input type="hidden" value="x" />
          <button type="button" style="display: none">Two</button>
          <button type="button">Three</button>
        `),
      },
    });
    await flushEffects();

    const buttons = screen.getAllByRole('button');
    expect(buttons).toHaveLength(2);
  });

  test('managed custom tabindex items stay in the set and restore after unmount', async () => {
    const { unmount } = render(Toolbar, {
      props: {
        'aria-label': 'Controls',
        children: rawSnippet(`
          <div tabindex="3" data-testid="custom-item">Custom</div>
          <button type="button">Three</button>
        `),
      },
    });
    await flushEffects();

    const customItem = screen.getByTestId('custom-item');
    expect(customItem.tabIndex).toBe(0);
    unmount();
    expect(customItem.getAttribute('tabindex')).toBe('3');
  });

  test('consumer keydown cancellation blocks toolbar roving', async () => {
    const onkeydown = (event: KeyboardEvent) => event.preventDefault();
    render(Toolbar, {
      props: {
        'aria-label': 'Controls',
        onkeydown,
        children: rawSnippet(`
          <button type="button">One</button>
          <button type="button">Two</button>
        `),
      },
    });

    const buttons = screen.getAllByRole('button');
    buttons[0]?.focus();
    await fireEvent.keyDown(buttons[0]!, { key: 'ArrowRight' });
    await flushEffects();
    expect(document.activeElement).toBe(buttons[0]!);
  });

  test('vertical orientation uses Up and Down arrows', async () => {
    render(Toolbar, {
      props: {
        'aria-label': 'Controls',
        orientation: 'vertical',
        children: rawSnippet(`
          <button type="button">One</button>
          <button type="button">Two</button>
        `),
      },
    });

    const buttons = screen.getAllByRole('button');
    buttons[0]?.focus();
    await fireEvent.keyDown(buttons[0]!, { key: 'ArrowDown' });
    await flushEffects();
    expect(document.activeElement).toBe(buttons[1]!);
  });

  test('Toolbar.Spacer warns on invalid flex and falls back to one', async () => {
    const warnSpy = mock(() => {});
    const original = console.warn;
    console.warn = warnSpy;

    try {
      const { container } = render(ToolbarSpacer, {
        props: {
          flex: 0,
        },
      });
      await flushEffects();
      const spacer = container.querySelector('.cinder-toolbar__spacer');
      expect(spacer?.getAttribute('style')).toContain('flex-grow: 1');
    } finally {
      console.warn = original;
    }

    expect(warnSpy).toHaveBeenCalledTimes(1);
  });

  test('real segmented control and number input composition roves between concrete controls', async () => {
    render(ToolbarCompositionFixture);
    await flushEffects();

    const viewportSegment = screen.getByRole('radio', { name: 'Mobile' });
    viewportSegment.focus();
    await fireEvent.keyDown(viewportSegment, { key: 'ArrowRight' });
    await flushEffects();

    expect(document.activeElement).toBe(screen.getByRole('textbox', { name: 'Custom width' }));
  });
});
