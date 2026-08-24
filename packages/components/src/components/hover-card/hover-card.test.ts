/// <reference lib="dom" />
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test';
import { parse, type Declaration } from 'postcss';
import { createRawSnippet } from 'svelte';

import { setupHappyDom } from '../../test/happy-dom.ts';
import { expectNoLeakedTimers, trackTimers } from '../../test/lifecycle.ts';

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

const { cleanup, fireEvent, render, screen, waitFor } = await import('@testing-library/svelte');
const { default: HoverCard } = await import('./hover-card.svelte');
const { _resetEscapeStack, pushEscapeHandler } = await import('../../_internal/overlay.ts');

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
  _resetEscapeStack();
});

describe('HoverCard', () => {
  test('unmounting while an open timer is pending leaves no leaked timer', async () => {
    const timers = trackTimers();
    try {
      const { container, unmount } = render(HoverCard, {
        props: {
          description: 'Preview',
          openDelay: 10_000, // far in the future so the timer is still pending at unmount
          trigger: triggerSnippet,
          children: textSnippet('Preview'),
        },
      });
      const wrapper = container.querySelector('.cinder-hover-card__trigger') as HTMLElement;
      await fireEvent.mouseEnter(wrapper); // schedules openTimer via scheduleOpen

      unmount(); // onDestroy(clearTimers) must clear it
      expectNoLeakedTimers(timers.active());
    } finally {
      timers.release();
    }
  });

  test('focus opens a portaled hover card and wires ARIA from the trigger wrapper', async () => {
    const { container } = render(HoverCard, {
      props: {
        description: 'Shows repository metadata',
        openDelay: 0,
        trigger: triggerSnippet,
        children: textSnippet('@lostgradient/cinder/cinder'),
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
    const describedBy = wrapper.getAttribute('aria-describedby') ?? '';
    expect(describedBy).toContain(card?.id ?? '');
    // The description id is derived from the same $props.id() base as the card
    // id: cardId = `${base}-card`, descriptionId = `${base}-description`. Assert
    // the structural contract — suffix /-description$/ — rather than a literal
    // prefix that $props.id() no longer produces.
    const descriptionIdInDescribedBy = describedBy
      .split(' ')
      .find((token) => token !== card?.id && token.length > 0);
    expect(descriptionIdInDescribedBy).toMatch(/-description$/);
  });

  test('arrowVisible enables Floating UI arrow middleware and positions the arrow', async () => {
    computePositionResult = {
      x: 40,
      y: 52,
      placement: 'top',
      middlewareData: { arrow: { x: 12 } },
    };

    const { container } = render(HoverCard, {
      props: {
        open: true,
        arrowVisible: true,
        trigger: triggerSnippet,
        children: textSnippet('Preview'),
      },
    });

    await waitFor(() => {
      const arrow = queryHoverCard()?.querySelector<HTMLElement>('.cinder-hover-card__arrow');
      expect(arrow).not.toBeNull();
      // Only the Floating UI-computed cross-axis offset is inline. The
      // static-side offset (here `bottom`, for a `top` placement) must come
      // from HoverCard's own per-placement CSS, not a hardcoded inline
      // override — an inline value would beat that CSS on specificity
      // regardless of what it said. See anchored-overlay.test.ts for the
      // shared-mechanism assertion and hover-card.css for the per-placement
      // rules this depends on.
      const style = arrow?.getAttribute('style') ?? '';
      expect(style).toContain('left: 12px');
      expect(style).not.toContain('bottom:');
      expect(style).not.toContain('top:');
    });
    expect(arrowSpy).toHaveBeenCalled();
    expect(container.querySelector('.cinder-hover-card')).toBeNull();
  });

  test('per-placement CSS owns the diamond arrow static-side offset and rotation', () => {
    const cssPath = fileURLToPath(new URL('./hover-card.css', import.meta.url));
    const root = parse(readFileSync(cssPath, 'utf8'));
    const rulesByPlacement = new Map<string, Declaration[]>();
    root.walkRules((rule) => {
      const match = /\[data-cinder-placement\^='(\w+)'\]\s+\.cinder-hover-card__arrow/.exec(
        rule.selector,
      );
      if (!match) return;
      const declarations = rule.nodes.filter((node): node is Declaration => node.type === 'decl');
      rulesByPlacement.set(match[1]!, declarations);
    });

    const expected: Record<string, { property: string; rotate: string }> = {
      bottom: { property: 'top', rotate: '45deg' },
      top: { property: 'bottom', rotate: '225deg' },
      right: { property: 'left', rotate: '315deg' },
      left: { property: 'right', rotate: '135deg' },
    };

    for (const [placement, { property, rotate }] of Object.entries(expected)) {
      const declarations = rulesByPlacement.get(placement);
      expect(declarations, `missing rule for placement "${placement}"`).toBeDefined();
      const propertyDeclaration = declarations!.find((decl) => decl.prop === property);
      const rotateDeclaration = declarations!.find((decl) => decl.prop === 'rotate');
      expect(propertyDeclaration?.value).toBe('-0.3125rem');
      expect(rotateDeclaration?.value).toBe(rotate);
    }
  });

  test('Escape dismisses the open card and exposes tooltip role + aria-describedby wiring', async () => {
    const { container } = render(HoverCard, {
      props: {
        open: true,
        trigger: triggerSnippet,
        children: textSnippet('Preview'),
      },
    });
    const wrapper = container.querySelector('.cinder-hover-card__trigger') as HTMLElement;

    // The portaled card carries the read-only tooltip role and is referenced by the
    // trigger via aria-describedby — never aria-label or aria-expanded (no focusable content).
    // Query by role (the accessibility contract) rather than a CSS selector.
    const card = await screen.findByRole('tooltip');
    expect(card.getAttribute('aria-label')).toBeNull();
    // aria-describedby may be a space-separated id list (card id + a description
    // id when `description` is set), so assert containment, not strict equality.
    expect(wrapper.getAttribute('aria-describedby')).toContain(card.id);
    expect(wrapper.getAttribute('aria-expanded')).toBeNull();

    // A document-level Escape keydown dismisses the card while it is open.
    await fireEvent.keyDown(document, { key: 'Escape' });

    await waitFor(() => expect(queryHoverCard()).toBeNull());
  });

  test('Escape uses the shared LIFO stack before an enclosing overlay handler', async () => {
    const parentEscape = mock(() => {});
    const releaseParentEscape = pushEscapeHandler(parentEscape);
    try {
      render(HoverCard, {
        props: {
          open: true,
          trigger: triggerSnippet,
          children: textSnippet('Preview'),
        },
      });

      await screen.findByRole('tooltip');
      const firstEscape = new KeyboardEvent('keydown', {
        key: 'Escape',
        bubbles: true,
        cancelable: true,
      });
      window.dispatchEvent(firstEscape);
      await waitFor(() => expect(queryHoverCard()).toBeNull());

      expect(firstEscape.defaultPrevented).toBe(true);
      expect(parentEscape).not.toHaveBeenCalled();

      const secondEscape = new KeyboardEvent('keydown', {
        key: 'Escape',
        bubbles: true,
        cancelable: true,
      });
      window.dispatchEvent(secondEscape);
      expect(parentEscape).toHaveBeenCalledTimes(1);
    } finally {
      releaseParentEscape();
    }
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
    const onOpenChange = mock((_open: boolean) => {});
    const { container, rerender } = render(HoverCard, {
      props: {
        open: true,
        openDelay: 0,
        onOpenChange,
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
      onOpenChange,
      trigger: triggerSnippet,
      children: textSnippet('Preview'),
    });
    await waitFor(() => expect(queryHoverCard()).toBeNull());

    onOpenChange.mockClear();
    await fireEvent.mouseEnter(wrapper);
    await Bun.sleep(5);

    expect(onOpenChange).not.toHaveBeenCalledWith(true);
    expect(queryHoverCard()).toBeNull();
  });

  test('controlled external close suppresses focus reopen while the pointer never left the trigger', async () => {
    const onOpenChange = mock((_open: boolean) => {});
    const { container, rerender } = render(HoverCard, {
      props: {
        open: true,
        openDelay: 0,
        onOpenChange,
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
      onOpenChange,
      trigger: triggerSnippet,
      children: textSnippet('Preview'),
    });
    await waitFor(() => expect(queryHoverCard()).toBeNull());

    onOpenChange.mockClear();
    await fireEvent.focusIn(wrapper);
    await Bun.sleep(5);

    expect(onOpenChange).not.toHaveBeenCalledWith(true);
    expect(queryHoverCard()).toBeNull();
  });

  test('focus reopens the hover card after the pointer leaves following a controlled close', async () => {
    const onOpenChange = mock((_open: boolean) => {});
    const { container, rerender } = render(HoverCard, {
      props: {
        open: true,
        openDelay: 0,
        onOpenChange,
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
      onOpenChange,
      trigger: triggerSnippet,
      children: textSnippet('Preview'),
    });
    await waitFor(() => expect(queryHoverCard()).toBeNull());

    // Tabbing away clears the suppress flag so keyboard users are never trapped.
    await fireEvent.focusOut(wrapper, { relatedTarget: document.body });
    onOpenChange.mockClear();
    await fireEvent.focusIn(wrapper);
    await Bun.sleep(5);

    expect(queryHoverCard()).not.toBeNull();
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

  test('keeps the card mounted with data-cinder-closing until its exit transition finishes', async () => {
    // Stub a real (non-zero) transition duration for `.cinder-hover-card` so
    // `waitForTransitionCompletion` takes its transitionend-listening path
    // instead of resolving on the next microtask — this is the only way to
    // observe the intermediate "closing but still mounted" DOM state.
    const originalGetComputedStyle = window.getComputedStyle.bind(window);
    window.getComputedStyle = ((target: Element) => {
      if (target instanceof HTMLElement && target.classList.contains('cinder-hover-card')) {
        return {
          transitionProperty: 'opacity, transform',
          transitionDuration: '80ms, 80ms',
          transitionDelay: '0ms, 0ms',
        } as CSSStyleDeclaration;
      }
      return originalGetComputedStyle(target);
    }) as typeof window.getComputedStyle;

    try {
      const { rerender } = render(HoverCard, {
        props: { open: true, trigger: triggerSnippet, children: textSnippet('Preview') },
      });
      await waitFor(() => expect(queryHoverCard()).not.toBeNull());

      await rerender({ open: false, trigger: triggerSnippet, children: textSnippet('Preview') });

      // Regression guard: the card previously unmounted in the exact same
      // tick `open` flipped false, so no CSS transition could ever play. It
      // must now survive, carrying `data-cinder-closing`, until the
      // transition genuinely completes.
      const closingCard = queryHoverCard();
      expect(closingCard).not.toBeNull();
      expect(closingCard?.hasAttribute('data-cinder-closing')).toBe(true);
      // Regression guard: `isClosing || undefined` serializes Svelte's boolean
      // `true` as the literal string `data-cinder-closing="true"`, not the
      // empty-string idiom `modal.svelte`/`drawer.svelte` use (and that
      // `[data-cinder-closing]` attribute selectors are written against).
      expect(closingCard?.getAttribute('data-cinder-closing')).toBe('');
      // The card must still be positioned (not jumped to an unpositioned
      // fallback spot) while it fades out. Positioning re-resolves through an
      // async Floating UI call, so poll rather than asserting synchronously.
      await waitFor(() => {
        expect(queryHoverCard()?.getAttribute('style')).toContain('left: 18px');
      });

      for (const propertyName of ['opacity', 'transform']) {
        const event = new Event('transitionend');
        Object.defineProperty(event, 'propertyName', { value: propertyName });
        closingCard?.dispatchEvent(event);
      }

      await waitFor(() => expect(queryHoverCard()).toBeNull());
    } finally {
      window.getComputedStyle = originalGetComputedStyle;
    }
  });
});

/**
 * Parse `.cinder-hover-card` panel rules and find the `padding` declaration.
 * Returns `undefined` when no `padding` declaration is present.
 */
function findHoverCardPaddingDeclaration(): Declaration | undefined {
  const cssSource = readFileSync(
    fileURLToPath(new URL('./hover-card.css', import.meta.url)),
    'utf8',
  );
  const root = parse(cssSource);
  let paddingDeclaration: Declaration | undefined;

  root.walkRules((rule) => {
    if (!rule.selectors.includes('.cinder-hover-card')) return;
    rule.walkDecls('padding', (decl) => {
      paddingDeclaration = decl;
    });
  });

  return paddingDeclaration;
}

describe('HoverCard CSS — spacing token regression', () => {
  test('panel padding uses a valid --cinder-space-N token, not the undefined --cinder-space-md', () => {
    // Regression guard for the bug where `padding: var(--cinder-space-md)` was
    // used but `--cinder-space-md` does not exist in the Cinder token scale
    // (the scale is numeric: --cinder-space-0..--cinder-space-32). This test
    // fails if the padding value ever references the undefined alias again,
    // or drifts to any other non-numeric token name.
    const declaration = findHoverCardPaddingDeclaration();

    expect(declaration).toBeDefined();
    expect(declaration!.value).not.toContain('--cinder-space-md');
    expect(declaration!.value).toMatch(/^var\(--cinder-space-[\d][\d-]*\)$/);
  });

  test('panel padding resolves specifically to --cinder-space-4 (1rem card-like inset)', () => {
    // Pin the chosen token value so any future change to the padding token
    // requires a conscious acknowledgment that the card inset changed.
    const declaration = findHoverCardPaddingDeclaration();

    expect(declaration).toBeDefined();
    expect(declaration!.value).toBe('var(--cinder-space-4)');
  });

  test('arrow edges use the full-strength border token', () => {
    const cssSource = readFileSync(
      fileURLToPath(new URL('./hover-card.css', import.meta.url)),
      'utf8',
    );
    const arrowBlock = /\.cinder-hover-card__arrow\s*\{([\s\S]*?)\}/.exec(cssSource)?.[1];
    expect(arrowBlock).toContain('border-inline-start: 1px solid var(--cinder-border);');
    expect(arrowBlock).toContain('border-block-start: 1px solid var(--cinder-border);');
  });
});
