/// <reference lib="dom" />
import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test';
import { createRawSnippet, tick } from 'svelte';

import { setupHappyDom } from '../../test/happy-dom.ts';

setupHappyDom();

// ---------------------------------------------------------------------------
// Floating-ui mocks — installed before importing the component.
// ---------------------------------------------------------------------------

type Resolver = (value: unknown) => void;
let computePositionResult = {
  x: 10,
  y: 20,
  placement: 'bottom-start',
  middlewareData: {} as { arrow?: { x?: number; y?: number } },
};
let deferComputePosition = false;
let deferredResolvers: Resolver[] = [];

const computePositionSpy = mock(async () => {
  if (deferComputePosition) {
    return new Promise((resolve) => {
      deferredResolvers.push(resolve as Resolver);
    });
  }
  return computePositionResult;
});

const autoUpdateTeardown = mock(() => {});
const autoUpdateSpy = mock((_anchor: HTMLElement, _panel: HTMLElement, update: () => void) => {
  update();
  return autoUpdateTeardown;
});
const arrowSpy = mock((opts: unknown) => ({ name: 'arrow', options: opts, fn: () => ({}) }));
const flipSpy = mock(() => ({ name: 'flip', fn: () => ({}) }));
const shiftSpy = mock((opts: unknown) => ({ name: 'shift', options: opts, fn: () => ({}) }));
const offsetSpy = mock((v: unknown) => ({ name: 'offset', options: v, fn: () => ({}) }));

mock.module('@floating-ui/dom', () => ({
  computePosition: computePositionSpy,
  autoUpdate: autoUpdateSpy,
  arrow: arrowSpy,
  flip: flipSpy,
  shift: shiftSpy,
  offset: offsetSpy,
}));

const { render, fireEvent, waitFor, cleanup } = await import('@testing-library/svelte');
const { default: Popover } = await import('./popover.svelte');
const { default: BindableFixture } =
  await import('../../test/fixtures/popover-bindable-fixture.svelte');
const { _resetEscapeStack } = await import('../../_internal/overlay.ts');

const triggerSnippet = createRawSnippet(() => ({
  render: () => `<button type="button">Open</button>`,
  setup: () => {},
}));

function textSnippet(text: string) {
  return createRawSnippet(() => ({
    render: () => `<span>${text}</span>`,
    setup: () => {},
  }));
}

function focusableSnippet() {
  return createRawSnippet(() => ({
    render: () => `<button type="button">Focusable inside</button>`,
    setup: () => {},
  }));
}

function queryPopoverPanel(): HTMLDivElement | null {
  return document.body.querySelector<HTMLDivElement>('.cinder-popover');
}

// Per-test DOM cleanup for nodes we attach directly to document.body.
let scratchNodes: HTMLElement[] = [];
function attachScratch(node: HTMLElement): void {
  scratchNodes.push(node);
  document.body.appendChild(node);
}

beforeEach(() => {
  deferComputePosition = false;
  deferredResolvers = [];
  computePositionResult = {
    x: 10,
    y: 20,
    placement: 'bottom-start',
    middlewareData: {},
  };
});

afterEach(() => {
  cleanup();
  for (const node of scratchNodes) {
    if (node.isConnected) node.remove();
  }
  scratchNodes = [];
  computePositionSpy.mockClear();
  autoUpdateSpy.mockClear();
  autoUpdateTeardown.mockClear();
  arrowSpy.mockClear();
  flipSpy.mockClear();
  shiftSpy.mockClear();
  offsetSpy.mockClear();
  _resetEscapeStack();
});

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

describe('Popover — rendering', () => {
  test('renders no panel when open=false', () => {
    render(Popover, {
      props: { open: false, trigger: triggerSnippet, children: textSnippet('content') },
    });
    expect(queryPopoverPanel()).toBeNull();
  });

  test('renders panel with role and aria-label when open=true', async () => {
    render(Popover, {
      props: { open: true, trigger: triggerSnippet, children: textSnippet('content') },
    });
    await waitFor(() => {
      expect(queryPopoverPanel()).not.toBeNull();
    });
    const panel = queryPopoverPanel()!;
    expect(panel.getAttribute('role')).toBe('dialog');
    expect(panel.getAttribute('aria-label')).toBe('Popover');
  });

  test('label prop sets aria-label', async () => {
    render(Popover, {
      props: {
        open: true,
        label: 'Settings menu',
        trigger: triggerSnippet,
        children: textSnippet('content'),
      },
    });
    await waitFor(() => {
      expect(queryPopoverPanel()).not.toBeNull();
    });
    const panel = queryPopoverPanel()!;
    expect(panel.getAttribute('aria-label')).toBe('Settings menu');
    expect(panel.hasAttribute('aria-labelledby')).toBe(false);
  });

  test('ariaLabelledby wins over label', async () => {
    render(Popover, {
      props: {
        open: true,
        label: 'fallback',
        ariaLabelledby: 'external-id',
        trigger: triggerSnippet,
        children: textSnippet('content'),
      },
    });
    await waitFor(() => {
      expect(queryPopoverPanel()).not.toBeNull();
    });
    const panel = queryPopoverPanel()!;
    expect(panel.getAttribute('aria-labelledby')).toBe('external-id');
    expect(panel.hasAttribute('aria-label')).toBe(false);
  });

  test('data-cinder-placement reflects floating-ui result, even outside public union', async () => {
    computePositionResult = {
      x: 5,
      y: 5,
      placement: 'right-start',
      middlewareData: {},
    };
    render(Popover, {
      props: {
        open: true,
        placement: 'bottom-start',
        trigger: triggerSnippet,
        children: textSnippet('content'),
      },
    });
    await waitFor(() => {
      const panel = queryPopoverPanel();
      expect(panel?.getAttribute('data-cinder-placement')).toBe('right-start');
    });
  });

  test('positionReady flips true after first computePosition resolves', async () => {
    render(Popover, {
      props: { open: true, trigger: triggerSnippet, children: textSnippet('content') },
    });
    await waitFor(() => {
      const panel = queryPopoverPanel();
      expect(panel?.getAttribute('data-cinder-position-ready')).toBe('true');
    });
  });

  test('aria-hidden is set while positionReady=false and removed after', async () => {
    deferComputePosition = true;
    const triggerBtn = document.createElement('button');
    triggerBtn.type = 'button';
    attachScratch(triggerBtn);

    render(Popover, {
      props: { open: true, triggerRef: triggerBtn, children: textSnippet('plain') },
    });
    await waitFor(() => {
      expect(queryPopoverPanel()).not.toBeNull();
    });
    const panel = queryPopoverPanel()!;
    expect(panel.getAttribute('aria-hidden')).toBe('true');
    expect(panel.getAttribute('data-cinder-position-ready')).toBe('false');

    // Release the deferred computePosition.
    deferComputePosition = false;
    for (const resolve of deferredResolvers) resolve(computePositionResult);
    deferredResolvers = [];

    await waitFor(() => {
      expect(panel.getAttribute('data-cinder-position-ready')).toBe('true');
      expect(panel.hasAttribute('aria-hidden')).toBe(false);
    });
  });

  test('panel inline style reflects computePosition x/y', async () => {
    computePositionResult = { x: 33, y: 44, placement: 'bottom-start', middlewareData: {} };
    render(Popover, {
      props: { open: true, trigger: triggerSnippet, children: textSnippet('content') },
    });
    await waitFor(() => {
      const panel = queryPopoverPanel();
      expect(panel?.getAttribute('data-cinder-position-ready')).toBe('true');
    });
    const panel = queryPopoverPanel()!;
    const style = panel.getAttribute('style') ?? '';
    expect(style).toContain('left: 33px');
    expect(style).toContain('top: 44px');
  });
});

// ---------------------------------------------------------------------------
// Portal and arrow
// ---------------------------------------------------------------------------

describe('Popover — portal and arrow', () => {
  test('moves the panel to document.body when open', async () => {
    const { container } = render(Popover, {
      props: { open: true, trigger: triggerSnippet, children: textSnippet('content') },
    });

    await waitFor(() => {
      expect(queryPopoverPanel()).not.toBeNull();
    });

    const panel = queryPopoverPanel()!;
    expect(document.body.contains(panel)).toBe(true);
    expect(panel.parentElement).toBe(document.body);
    expect(container.contains(panel)).toBe(false);
  });

  test('renders an arrow inside a placed panel when showArrow=true', async () => {
    computePositionResult = {
      x: 10,
      y: 20,
      placement: 'bottom-start',
      middlewareData: { arrow: { x: 24 } },
    };

    render(Popover, {
      props: {
        open: true,
        showArrow: true,
        trigger: triggerSnippet,
        children: textSnippet('content'),
      },
    });

    await waitFor(() => {
      const panel = queryPopoverPanel();
      expect(panel?.getAttribute('data-cinder-placement')).toBe('bottom-start');
      expect(panel?.querySelector('.cinder-popover__arrow')).not.toBeNull();
    });

    const arrow = queryPopoverPanel()!.querySelector<HTMLSpanElement>('.cinder-popover__arrow')!;
    expect(arrow.getAttribute('aria-hidden')).toBe('true');
    // happy-dom doesn't run a layout engine, so we can't assert the resolved
    // left/top offsets Floating-UI computes. The arrow element rendering with
    // aria-hidden and the panel having data-cinder-placement is what we can
    // verify here; real positioning is covered by visual checks.
  });
});

// ---------------------------------------------------------------------------
// Trigger ARIA
// ---------------------------------------------------------------------------

describe('Popover — trigger ARIA', () => {
  test('trigger gets aria-expanded, aria-controls, aria-haspopup when open', async () => {
    const { container } = render(Popover, {
      props: { open: true, trigger: triggerSnippet, children: textSnippet('content') },
    });
    await waitFor(() => {
      expect(queryPopoverPanel()).not.toBeNull();
    });
    const button = container.querySelector('button')!;
    expect(button.getAttribute('aria-expanded')).toBe('true');
    expect(button.getAttribute('aria-haspopup')).toBe('dialog');
    expect(button.getAttribute('aria-controls')).toMatch(/^cinder-popover-/);
  });

  test('aria-controls is absent when open=false', () => {
    const { container } = render(Popover, {
      props: { open: false, trigger: triggerSnippet, children: textSnippet('content') },
    });
    const button = container.querySelector('button')!;
    expect(button.getAttribute('aria-expanded')).toBe('false');
    expect(button.hasAttribute('aria-controls')).toBe(false);
  });

  test('role="group" omits aria-haspopup', () => {
    const { container } = render(Popover, {
      props: {
        open: false,
        role: 'group',
        trigger: triggerSnippet,
        children: textSnippet('content'),
      },
    });
    const button = container.querySelector('button')!;
    expect(button.hasAttribute('aria-haspopup')).toBe(false);
  });

  test('role="listbox" maps aria-haspopup to "listbox"', () => {
    const { container } = render(Popover, {
      props: {
        open: false,
        role: 'listbox',
        trigger: triggerSnippet,
        children: textSnippet('content'),
      },
    });
    const button = container.querySelector('button')!;
    expect(button.getAttribute('aria-haspopup')).toBe('listbox');
  });
});

// ---------------------------------------------------------------------------
// Focus management
// ---------------------------------------------------------------------------

describe('Popover — focus management', () => {
  test('initial focus moves to first focusable inside panel after positionReady', async () => {
    render(Popover, {
      props: { open: true, trigger: triggerSnippet, children: focusableSnippet() },
    });
    await waitFor(() => {
      const inside = queryPopoverPanel()?.querySelector('button') ?? null;
      expect(inside).not.toBeNull();
      expect(document.activeElement).toBe(inside);
    });
  });

  test('initial focus falls back to panel root when no focusable child', async () => {
    render(Popover, {
      props: { open: true, trigger: triggerSnippet, children: textSnippet('plain') },
    });
    await waitFor(() => {
      expect(queryPopoverPanel()).not.toBeNull();
    });
    const panel = queryPopoverPanel()!;
    expect(panel.getAttribute('tabindex')).toBe('-1');
    await waitFor(() => {
      expect(document.activeElement).toBe(panel);
    });
  });

  test('focus does not move while positionReady=false (computePosition pending)', async () => {
    deferComputePosition = true;
    const triggerBtn = document.createElement('button');
    triggerBtn.type = 'button';
    triggerBtn.textContent = 'trigger';
    attachScratch(triggerBtn);
    triggerBtn.focus();
    expect(document.activeElement).toBe(triggerBtn);

    render(Popover, {
      props: {
        open: true,
        triggerRef: triggerBtn,
        children: focusableSnippet(),
      },
    });

    await tick();
    await tick();
    // Panel may render but focus stays on trigger while positionReady is false.
    expect(document.activeElement).toBe(triggerBtn);
  });

  test('focus returns to trigger on close via Escape', async () => {
    const { container } = render(BindableFixture, { props: { initialOpen: true } });
    await waitFor(() => {
      expect(queryPopoverPanel()).not.toBeNull();
    });
    const triggerButton = container.querySelector('button')!;

    window.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

    await waitFor(() => {
      expect(container.querySelector('[data-testid="open-state"]')?.textContent).toBe('closed');
    });
    expect(document.activeElement).toBe(triggerButton);
  });

  test('focus restores to capturedFocus when triggerRef is unmounted before close', async () => {
    const previouslyFocused = document.createElement('button');
    previouslyFocused.id = 'popover-prev-focus';
    attachScratch(previouslyFocused);
    previouslyFocused.focus();

    const triggerEl = document.createElement('button');
    triggerEl.id = 'popover-transient-trigger';
    attachScratch(triggerEl);

    let openValue = true;
    render(Popover, {
      props: {
        get open() {
          return openValue;
        },
        set open(value: boolean) {
          openValue = value;
        },
        triggerRef: triggerEl,
        children: textSnippet('content'),
      },
    });

    await waitFor(() => {
      expect(queryPopoverPanel()).not.toBeNull();
    });

    // Drop the trigger before close.
    triggerEl.remove();

    window.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await waitFor(() => {
      expect(openValue).toBe(false);
    });
    expect(document.activeElement).toBe(previouslyFocused);
  });

  test('no focus is forced when all candidates are disconnected', async () => {
    const triggerEl = document.createElement('button');
    attachScratch(triggerEl);

    let openValue = true;
    render(Popover, {
      props: {
        get open() {
          return openValue;
        },
        set open(value: boolean) {
          openValue = value;
        },
        triggerRef: triggerEl,
        children: textSnippet('content'),
      },
    });

    await waitFor(() => {
      expect(queryPopoverPanel()).not.toBeNull();
    });

    triggerEl.remove();
    // Ensure no element is focused before the close — captured focus was null
    // (focus on body) at open time, and the trigger is now gone.
    (document.activeElement as HTMLElement | null)?.blur?.();

    window.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await waitFor(() => {
      expect(openValue).toBe(false);
    });
    // No fallback to document.body — focus left where the close landed.
    expect(document.activeElement).not.toBe(triggerEl);
  });
});

// ---------------------------------------------------------------------------
// Outside mousedown
// ---------------------------------------------------------------------------

describe('Popover — outside mousedown', () => {
  test('mousedown outside panel and anchor closes', async () => {
    const { container } = render(BindableFixture, { props: { initialOpen: true } });
    await waitFor(() => {
      expect(queryPopoverPanel()).not.toBeNull();
    });

    const outside = document.createElement('div');
    attachScratch(outside);
    await fireEvent.mouseDown(outside);

    await waitFor(() => {
      expect(container.querySelector('[data-testid="open-state"]')?.textContent).toBe('closed');
    });
  });

  test('mousedown on anchor does not close', async () => {
    const { container } = render(BindableFixture, { props: { initialOpen: true } });
    await waitFor(() => {
      expect(queryPopoverPanel()).not.toBeNull();
    });
    const triggerButton = container.querySelector('button')!;
    await fireEvent.mouseDown(triggerButton);
    expect(container.querySelector('[data-testid="open-state"]')?.textContent).toBe('open');
  });

  test('mousedown inside panel does not close', async () => {
    const { container } = render(BindableFixture, { props: { initialOpen: true } });
    await waitFor(() => {
      expect(queryPopoverPanel()).not.toBeNull();
    });
    const panel = queryPopoverPanel()!;
    await fireEvent.mouseDown(panel);
    expect(container.querySelector('[data-testid="open-state"]')?.textContent).toBe('open');
  });
});

// ---------------------------------------------------------------------------
// Escape
// ---------------------------------------------------------------------------

describe('Popover — Escape', () => {
  test('Escape closes the popover via bindable open', async () => {
    const { container } = render(BindableFixture, { props: { initialOpen: true } });
    await waitFor(() => {
      expect(queryPopoverPanel()).not.toBeNull();
    });

    window.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

    await waitFor(() => {
      expect(container.querySelector('[data-testid="open-state"]')?.textContent).toBe('closed');
    });
  });
});

// ---------------------------------------------------------------------------
// floating-ui wiring
// ---------------------------------------------------------------------------

describe('Popover — floating-ui wiring', () => {
  test('autoUpdate invoked with anchor + panel, default offset forwarded', async () => {
    render(Popover, {
      props: { open: true, trigger: triggerSnippet, children: textSnippet('content') },
    });
    await waitFor(() => {
      expect(queryPopoverPanel()).not.toBeNull();
    });
    expect(autoUpdateSpy).toHaveBeenCalled();
    const call = autoUpdateSpy.mock.calls[0]!;
    expect(call[0]).toBeInstanceOf(HTMLElement);
    expect(call[1]).toBeInstanceOf(HTMLElement);
    expect(offsetSpy).toHaveBeenCalledWith(8);
  });

  test('custom offset forwarded to offset middleware', async () => {
    render(Popover, {
      props: {
        open: true,
        offset: 16,
        trigger: triggerSnippet,
        children: textSnippet('content'),
      },
    });
    await waitFor(() => {
      expect(queryPopoverPanel()).not.toBeNull();
    });
    expect(offsetSpy).toHaveBeenCalledWith(16);
  });

  test('arrow middleware is NOT called when showArrow=false', async () => {
    render(Popover, {
      props: {
        open: true,
        showArrow: false,
        trigger: triggerSnippet,
        children: textSnippet('content'),
      },
    });
    await tick();
    expect(arrowSpy).not.toHaveBeenCalled();
  });

  test('arrow middleware IS called when showArrow=true', async () => {
    render(Popover, {
      props: {
        open: true,
        showArrow: true,
        trigger: triggerSnippet,
        children: textSnippet('content'),
      },
    });
    await tick();
    expect(arrowSpy).toHaveBeenCalled();
  });

  test('autoUpdate teardown invoked on close', async () => {
    const { rerender } = render(Popover, {
      props: { open: true, trigger: triggerSnippet, children: textSnippet('content') },
    });
    await waitFor(() => {
      expect(queryPopoverPanel()).not.toBeNull();
    });
    autoUpdateTeardown.mockClear();
    await rerender({ open: false, trigger: triggerSnippet, children: textSnippet('content') });
    expect(autoUpdateTeardown).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// No-anchor degradation
// ---------------------------------------------------------------------------

describe('Popover — no-anchor degradation', () => {
  test('open=true with no trigger and no triggerRef does not render panel', async () => {
    render(Popover, {
      props: { open: true, children: textSnippet('content') },
    });
    await tick();
    await tick();
    expect(queryPopoverPanel()).toBeNull();
  });

  test('open=true with no anchor does not register Escape handler (no overlay-stack pollution)', async () => {
    // Render an anchorless popover. With the gate, the open lifecycle effect
    // bails before pushing onto the shared escape stack — so a sibling overlay
    // can still receive Escape.
    let siblingEscapes = 0;
    const overlay = await import('../../_internal/overlay.ts');
    const release = overlay.pushEscapeHandler(() => {
      siblingEscapes += 1;
    });

    render(Popover, {
      props: { open: true, children: textSnippet('content') },
    });
    await tick();
    await tick();

    window.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(siblingEscapes).toBe(1);
    release();
  });
});
