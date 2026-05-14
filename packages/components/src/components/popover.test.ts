/// <reference lib="dom" />
import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test';
import { createRawSnippet, tick } from 'svelte';

import { setupHappyDom } from '../test/happy-dom.ts';

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

const { render, fireEvent, waitFor } = await import('@testing-library/svelte');
const { default: Popover } = await import('./popover.svelte');
const { default: BindableFixture } =
  await import('../test/fixtures/popover-bindable-fixture.svelte');
const { _resetEscapeStack } = await import('../_internal/overlay.ts');

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
// Tests
// ---------------------------------------------------------------------------

describe('Popover — rendering', () => {
  test('renders no panel when open=false', () => {
    const { container } = render(Popover, {
      props: { open: false, trigger: triggerSnippet, children: textSnippet('content') },
    });
    expect(container.querySelector('.cinder-popover')).toBeNull();
  });

  test('renders panel with role and aria-label when open=true', async () => {
    const { container } = render(Popover, {
      props: { open: true, trigger: triggerSnippet, children: textSnippet('content') },
    });
    await waitFor(() => {
      expect(container.querySelector('.cinder-popover')).not.toBeNull();
    });
    const panel = container.querySelector('.cinder-popover')!;
    expect(panel.getAttribute('role')).toBe('dialog');
    expect(panel.getAttribute('aria-label')).toBe('Popover');
  });

  test('label prop sets aria-label', async () => {
    const { container } = render(Popover, {
      props: {
        open: true,
        label: 'Settings menu',
        trigger: triggerSnippet,
        children: textSnippet('content'),
      },
    });
    await waitFor(() => {
      expect(container.querySelector('.cinder-popover')).not.toBeNull();
    });
    const panel = container.querySelector('.cinder-popover')!;
    expect(panel.getAttribute('aria-label')).toBe('Settings menu');
    expect(panel.hasAttribute('aria-labelledby')).toBe(false);
  });

  test('ariaLabelledby wins over label', async () => {
    const { container } = render(Popover, {
      props: {
        open: true,
        label: 'fallback',
        ariaLabelledby: 'external-id',
        trigger: triggerSnippet,
        children: textSnippet('content'),
      },
    });
    await waitFor(() => {
      expect(container.querySelector('.cinder-popover')).not.toBeNull();
    });
    const panel = container.querySelector('.cinder-popover')!;
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
    const { container } = render(Popover, {
      props: {
        open: true,
        placement: 'bottom-start',
        trigger: triggerSnippet,
        children: textSnippet('content'),
      },
    });
    await waitFor(() => {
      const panel = container.querySelector('.cinder-popover');
      expect(panel?.getAttribute('data-cinder-placement')).toBe('right-start');
    });
  });

  test('positionReady flips true after first computePosition resolves', async () => {
    const { container } = render(Popover, {
      props: { open: true, trigger: triggerSnippet, children: textSnippet('content') },
    });
    await waitFor(() => {
      const panel = container.querySelector('.cinder-popover');
      expect(panel?.getAttribute('data-cinder-position-ready')).toBe('true');
    });
  });
});

describe('Popover — trigger ARIA', () => {
  test('trigger gets aria-expanded, aria-controls, aria-haspopup when open', async () => {
    const { container } = render(Popover, {
      props: { open: true, trigger: triggerSnippet, children: textSnippet('content') },
    });
    await waitFor(() => {
      expect(container.querySelector('.cinder-popover')).not.toBeNull();
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

describe('Popover — focus management', () => {
  test('initial focus moves to first focusable inside panel after positionReady', async () => {
    const { container } = render(Popover, {
      props: { open: true, trigger: triggerSnippet, children: focusableSnippet() },
    });
    await waitFor(() => {
      const inside = container.querySelector('.cinder-popover button');
      expect(inside).not.toBeNull();
      expect(document.activeElement).toBe(inside);
    });
  });

  test('initial focus falls back to panel root when no focusable child', async () => {
    const { container } = render(Popover, {
      props: { open: true, trigger: triggerSnippet, children: textSnippet('plain') },
    });
    await waitFor(() => {
      expect(container.querySelector('.cinder-popover')).not.toBeNull();
    });
    const panel = container.querySelector('.cinder-popover')!;
    // Panel root carries tabindex=-1 so it can receive programmatic focus.
    expect(panel.getAttribute('tabindex')).toBe('-1');
    // Focus moves off the body onto the panel (or onto its tree if the engine
    // delegates). happy-dom's `focus()` is best-effort, so assert the looser
    // contract: focus is not on the body once positioning is ready.
    await waitFor(() => {
      const active = document.activeElement;
      expect(active === panel || panel.contains(active)).toBe(true);
    });
  });

  test('focus does not move while positionReady=false (computePosition pending)', async () => {
    deferComputePosition = true;
    const trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.textContent = 'trigger';
    document.body.appendChild(trigger);
    trigger.focus();
    expect(document.activeElement).toBe(trigger);

    render(Popover, {
      props: {
        open: true,
        triggerRef: trigger,
        children: focusableSnippet(),
      },
    });

    await tick();
    await tick();
    // panel may render but focus stays on trigger because positionReady is still false
    expect(document.activeElement).toBe(trigger);
    document.body.removeChild(trigger);
  });
});

describe('Popover — outside mousedown', () => {
  test('mousedown outside panel and anchor closes', async () => {
    const { container } = render(BindableFixture, { props: { initialOpen: true } });
    await waitFor(() => {
      expect(container.querySelector('.cinder-popover')).not.toBeNull();
    });

    const outside = document.createElement('div');
    document.body.appendChild(outside);
    await fireEvent.mouseDown(outside);

    await waitFor(() => {
      expect(container.querySelector('[data-testid="open-state"]')?.textContent).toBe('closed');
    });
    document.body.removeChild(outside);
  });

  test('mousedown on anchor does not close', async () => {
    const { container } = render(BindableFixture, { props: { initialOpen: true } });
    await waitFor(() => {
      expect(container.querySelector('.cinder-popover')).not.toBeNull();
    });
    const triggerButton = container.querySelector('button')!;
    await fireEvent.mouseDown(triggerButton);
    expect(container.querySelector('[data-testid="open-state"]')?.textContent).toBe('open');
  });

  test('mousedown inside panel does not close', async () => {
    const { container } = render(BindableFixture, { props: { initialOpen: true } });
    await waitFor(() => {
      expect(container.querySelector('.cinder-popover')).not.toBeNull();
    });
    const panel = container.querySelector('.cinder-popover')!;
    await fireEvent.mouseDown(panel);
    expect(container.querySelector('[data-testid="open-state"]')?.textContent).toBe('open');
  });
});

describe('Popover — Escape', () => {
  test('Escape closes the popover via bindable open', async () => {
    const { container } = render(BindableFixture, { props: { initialOpen: true } });
    await waitFor(() => {
      expect(container.querySelector('.cinder-popover')).not.toBeNull();
    });

    const event = new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true });
    window.dispatchEvent(event);

    await waitFor(() => {
      expect(container.querySelector('[data-testid="open-state"]')?.textContent).toBe('closed');
    });
  });
});

describe('Popover — floating-ui wiring', () => {
  test('autoUpdate invoked with anchor + panel', async () => {
    const { container } = render(Popover, {
      props: { open: true, trigger: triggerSnippet, children: textSnippet('content') },
    });
    await waitFor(() => {
      expect(container.querySelector('.cinder-popover')).not.toBeNull();
    });
    expect(autoUpdateSpy).toHaveBeenCalled();
    const call = autoUpdateSpy.mock.calls[0]!;
    expect(call[0]).toBeInstanceOf(HTMLElement);
    expect(call[1]).toBeInstanceOf(HTMLElement);
  });

  test('arrow middleware called only when showArrow=true', async () => {
    arrowSpy.mockClear();
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
    const { container, rerender } = render(Popover, {
      props: { open: true, trigger: triggerSnippet, children: textSnippet('content') },
    });
    await waitFor(() => {
      expect(container.querySelector('.cinder-popover')).not.toBeNull();
    });
    autoUpdateTeardown.mockClear();
    await rerender({ open: false, trigger: triggerSnippet, children: textSnippet('content') });
    expect(autoUpdateTeardown).toHaveBeenCalled();
  });
});

describe('Popover — no-anchor degradation', () => {
  test('open=true with no trigger and no triggerRef does not render panel', async () => {
    const { container } = render(Popover, {
      props: { open: true, children: textSnippet('content') },
    });
    await tick();
    await tick();
    expect(container.querySelector('.cinder-popover')).toBeNull();
  });
});
