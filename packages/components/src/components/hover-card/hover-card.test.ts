/// <reference lib="dom" />
import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test';
import { createRawSnippet } from 'svelte';

import { setupHappyDom } from '../../test/happy-dom.ts';

setupHappyDom();

let computePositionResult = {
  x: 18,
  y: 28,
  placement: 'bottom-start',
  middlewareData: {} as { arrow?: { x?: number; y?: number } },
};

const computePositionSpy = mock(async () => computePositionResult);
const autoUpdateTeardown = mock(() => {});
const autoUpdateSpy = mock((_anchor: HTMLElement, _card: HTMLElement, update: () => void) => {
  update();
  return autoUpdateTeardown;
});
const arrowSpy = mock((options: unknown) => ({ name: 'arrow', options, fn: () => ({}) }));
const flipSpy = mock(() => ({ name: 'flip', fn: () => ({}) }));
const shiftSpy = mock((options: unknown) => ({ name: 'shift', options, fn: () => ({}) }));
const offsetSpy = mock((options: unknown) => ({ name: 'offset', options, fn: () => ({}) }));

mock.module('@floating-ui/dom', () => ({
  arrow: arrowSpy,
  autoUpdate: autoUpdateSpy,
  computePosition: computePositionSpy,
  flip: flipSpy,
  offset: offsetSpy,
  shift: shiftSpy,
}));

const { cleanup, fireEvent, render, waitFor } = await import('@testing-library/svelte');
const { default: HoverCard } = await import('./hover-card.svelte');

const triggerSnippet = createRawSnippet(() => ({
  render: () => `<button type="button">Inspect</button>`,
  setup: () => {},
}));

function textSnippet(text: string) {
  return createRawSnippet(() => ({
    render: () => `<span>${text}</span>`,
    setup: () => {},
  }));
}

function queryHoverCard(): HTMLElement | null {
  return document.body.querySelector<HTMLElement>('.cinder-hover-card');
}

beforeEach(() => {
  computePositionResult = {
    x: 18,
    y: 28,
    placement: 'bottom-start',
    middlewareData: {},
  };
  computePositionSpy.mockClear();
  autoUpdateSpy.mockClear();
  autoUpdateTeardown.mockClear();
  arrowSpy.mockClear();
  flipSpy.mockClear();
  shiftSpy.mockClear();
  offsetSpy.mockClear();
});

afterEach(() => {
  cleanup();
});

describe('HoverCard', () => {
  test('focus opens a portaled hover card and wires ARIA from the trigger wrapper', async () => {
    const { container } = render(HoverCard, {
      props: {
        description: 'Shows repository metadata',
        openDelay: 0,
        trigger: triggerSnippet,
        children: textSnippet('cinder/cinder'),
      },
    });
    const wrapper = container.querySelector('.cinder-hover-card__trigger') as HTMLElement;

    await fireEvent.focusIn(wrapper);

    await waitFor(() => {
      const card = queryHoverCard();
      expect(card).not.toBeNull();
      expect(card?.parentElement).toBe(document.body);
      expect(card?.getAttribute('role')).toBe('tooltip');
      expect(card?.hasAttribute('aria-label')).toBe(false);
      expect(card?.getAttribute('data-cinder-position-ready')).toBe('true');
      expect(card?.getAttribute('style')).toContain('left: 18px');
      expect(card?.getAttribute('style')).toContain('top: 28px');
    });
    expect(wrapper.hasAttribute('aria-expanded')).toBe(false);
    expect(wrapper.hasAttribute('aria-controls')).toBe(false);
    const card = queryHoverCard();
    expect(card).not.toBeNull();
    expect(wrapper.getAttribute('aria-describedby')).toContain(card?.id ?? '');
    expect(wrapper.getAttribute('aria-describedby')).toContain('cinder-hover-card-description');
  });

  test('showArrow enables Floating UI arrow middleware and positions the arrow', async () => {
    computePositionResult = {
      x: 40,
      y: 52,
      placement: 'top',
      middlewareData: { arrow: { x: 12 } },
    };

    const { container } = render(HoverCard, {
      props: {
        open: true,
        showArrow: true,
        trigger: triggerSnippet,
        children: textSnippet('Preview'),
      },
    });

    await waitFor(() => {
      const arrow = queryHoverCard()?.querySelector<HTMLElement>('.cinder-hover-card__arrow');
      expect(arrow).not.toBeNull();
      expect(arrow?.getAttribute('style')).toContain('left: 12px');
      expect(arrow?.getAttribute('style')).toContain('bottom: -4px');
    });
    expect(arrowSpy).toHaveBeenCalled();
    expect(container.querySelector('.cinder-hover-card')).toBeNull();
  });

  test('Escape closes an open hover card', async () => {
    render(HoverCard, {
      props: {
        open: true,
        trigger: triggerSnippet,
        children: textSnippet('Preview'),
      },
    });

    await waitFor(() => expect(queryHoverCard()).not.toBeNull());
    await fireEvent.keyDown(document, { key: 'Escape' });

    await waitFor(() => expect(queryHoverCard()).toBeNull());
  });

  test('hover open waits for the configured delay', async () => {
    const { container } = render(HoverCard, {
      props: {
        openDelay: 20,
        trigger: triggerSnippet,
        children: textSnippet('Preview'),
      },
    });
    const wrapper = container.querySelector('.cinder-hover-card__trigger') as HTMLElement;

    await fireEvent.mouseEnter(wrapper);
    expect(queryHoverCard()).toBeNull();

    await Bun.sleep(25);
    await waitFor(() => expect(queryHoverCard()).not.toBeNull());
  });

  test('hover close waits for the configured delay', async () => {
    const { container } = render(HoverCard, {
      props: {
        openDelay: 0,
        closeDelay: 20,
        trigger: triggerSnippet,
        children: textSnippet('Preview'),
      },
    });
    const wrapper = container.querySelector('.cinder-hover-card__trigger') as HTMLElement;

    await fireEvent.mouseEnter(wrapper);
    await waitFor(() => expect(queryHoverCard()).not.toBeNull());
    await fireEvent.mouseLeave(wrapper);
    expect(queryHoverCard()).not.toBeNull();

    await Bun.sleep(25);
    await waitFor(() => expect(queryHoverCard()).toBeNull());
  });

  test('controlled external close clears hover interest before another trigger enter', async () => {
    const onopenchange = mock((_open: boolean) => {});
    const { container, rerender } = render(HoverCard, {
      props: {
        open: true,
        openDelay: 0,
        onopenchange,
        trigger: triggerSnippet,
        children: textSnippet('Preview'),
      },
    });
    const wrapper = container.querySelector('.cinder-hover-card__trigger') as HTMLElement;

    await waitFor(() => expect(queryHoverCard()).not.toBeNull());
    await fireEvent.mouseEnter(wrapper);
    await rerender({
      open: false,
      openDelay: 0,
      onopenchange,
      trigger: triggerSnippet,
      children: textSnippet('Preview'),
    });
    await waitFor(() => expect(queryHoverCard()).toBeNull());

    onopenchange.mockClear();
    await fireEvent.mouseEnter(wrapper);
    await Bun.sleep(5);

    expect(onopenchange).not.toHaveBeenCalledWith(true);
    expect(queryHoverCard()).toBeNull();
  });

  test('hover card stays open when the pointer moves from trigger to card before close delay', async () => {
    const { container } = render(HoverCard, {
      props: {
        openDelay: 0,
        closeDelay: 30,
        trigger: triggerSnippet,
        children: textSnippet('Preview'),
      },
    });
    const wrapper = container.querySelector('.cinder-hover-card__trigger') as HTMLElement;

    await fireEvent.mouseEnter(wrapper);
    await waitFor(() => expect(queryHoverCard()).not.toBeNull());
    await fireEvent.mouseLeave(wrapper);
    await fireEvent.mouseEnter(queryHoverCard() as HTMLElement);
    await Bun.sleep(35);

    expect(queryHoverCard()).not.toBeNull();
  });
});
