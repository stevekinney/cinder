/// <reference lib="dom" />
import { afterEach, beforeEach, describe, expect, jest, mock, test } from 'bun:test';
import { createRawSnippet, tick } from 'svelte';

import { setupHappyDom } from '../../test/happy-dom.ts';
import { expectNoLeakedTimers, trackTimers } from '../../test/lifecycle.ts';

setupHappyDom();

type Resolver = (value: unknown) => void;

let computePositionResult = {
  x: 16,
  y: 24,
  placement: 'top',
};
let computePositionShouldReject = false;
let deferComputePosition = false;
let deferredResolvers: Resolver[] = [];

const computePositionSpy = mock(async () => {
  if (computePositionShouldReject) {
    throw new Error('computePosition failed');
  }
  if (deferComputePosition) {
    return new Promise((resolve) => {
      deferredResolvers.push(resolve as Resolver);
    });
  }
  return computePositionResult;
});

const autoUpdateTeardown = mock(() => {});
const autoUpdateSpy = mock((_anchor: HTMLElement, _tooltip: HTMLElement, update: () => void) => {
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
  shift: shiftSpy,
  offset: offsetSpy,
}));

const { cleanup, fireEvent, render, waitFor } = await import('@testing-library/svelte');
const { default: Tooltip } = await import('./tooltip.svelte');

function textSnippet(text: string) {
  return createRawSnippet(() => ({
    render: () => `<span>${text}</span>`,
    setup: () => {},
  }));
}

const triggerSnippet = createRawSnippet(() => ({
  render: () => `<button type="button">Hover me</button>`,
  setup: () => {},
}));

const multiDescriptionTriggerSnippet = createRawSnippet(() => ({
  render: () => `<button type="button" aria-describedby="alpha beta">Hover me</button>`,
  setup: () => {},
}));

const disabledTabindexTriggerSnippet = createRawSnippet(() => ({
  render: () =>
    [
      '<span>',
      '<button type="button" tabindex="0" disabled>Disabled focus target</button>',
      '<span>Plain wrapper fallback</span>',
      '</span>',
    ].join(''),
  setup: () => {},
}));

function queryTooltip(): HTMLElement | null {
  return document.body.querySelector('[role="tooltip"]');
}

async function triggerDelayedTooltipShow(wrapper: HTMLElement): Promise<void> {
  const trackedSetTimeout = globalThis.setTimeout;
  const trackedClearTimeout = globalThis.clearTimeout;
  const trackedSetInterval = globalThis.setInterval;
  const trackedClearInterval = globalThis.clearInterval;
  jest.useFakeTimers();
  try {
    await fireEvent.mouseEnter(wrapper);
    jest.advanceTimersByTime(100);
    await tick();
  } finally {
    jest.useRealTimers();
    globalThis.setTimeout = trackedSetTimeout;
    globalThis.clearTimeout = trackedClearTimeout;
    globalThis.setInterval = trackedSetInterval;
    globalThis.clearInterval = trackedClearInterval;
    expect(globalThis.setTimeout).toBe(trackedSetTimeout);
    expect(globalThis.clearTimeout).toBe(trackedClearTimeout);
    expect(globalThis.setInterval).toBe(trackedSetInterval);
    expect(globalThis.clearInterval).toBe(trackedClearInterval);
  }
}

// Tooltip schedules show/hide via setTimeout; track timers per test so a
// component that forgets to clear its pending timer on unmount is caught here.
let timers: ReturnType<typeof trackTimers>;

beforeEach(() => {
  computePositionResult = {
    x: 16,
    y: 24,
    placement: 'top',
  };
  computePositionShouldReject = false;
  deferComputePosition = false;
  deferredResolvers = [];
  timers = trackTimers();
});

afterEach(() => {
  cleanup();
  const leaked = timers.active();
  timers.release();
  computePositionSpy.mockClear();
  autoUpdateSpy.mockClear();
  autoUpdateTeardown.mockClear();
  arrowSpy.mockClear();
  flipSpy.mockClear();
  shiftSpy.mockClear();
  offsetSpy.mockClear();
  expectNoLeakedTimers(leaked);
});

describe('Tooltip', () => {
  test('renders children (trigger) content', () => {
    const { container } = render(Tooltip, {
      props: {
        text: 'Tooltip content',
        children: textSnippet('Trigger'),
      },
    });
    expect(container.textContent).toContain('Trigger');
  });

  test('tooltip element is portaled to document.body and hidden initially', () => {
    const { container } = render(Tooltip, {
      props: {
        text: 'Tooltip content',
        children: triggerSnippet,
      },
    });
    const tooltip = queryTooltip();
    expect(tooltip).not.toBeNull();
    expect(container.querySelector('[role="tooltip"]')).toBeNull();
    expect(tooltip?.getAttribute('aria-hidden')).toBe('true');
    expect(tooltip?.parentElement).toBe(document.body);
  });

  test('focusable trigger inside wrapper has aria-describedby that matches the tooltip id', () => {
    const { container } = render(Tooltip, {
      props: {
        text: 'Tooltip content',
        children: triggerSnippet,
      },
    });
    const trigger = container.querySelector<HTMLElement>('button');
    const tooltip = queryTooltip();
    expect(trigger?.getAttribute('aria-describedby')).toBe(tooltip?.getAttribute('id'));
  });

  test('describe=false keeps tooltip text visual without wiring aria-describedby', () => {
    const { container } = render(Tooltip, {
      props: {
        text: 'Visual-only tooltip',
        describe: false,
        children: triggerSnippet,
      },
    });

    const trigger = container.querySelector<HTMLElement>('button');
    const tooltip = queryTooltip();
    expect(trigger?.hasAttribute('aria-describedby')).toBe(false);
    expect(tooltip?.textContent?.trim()).toBe('Visual-only tooltip');
  });

  test('pre-existing aria-describedby ids are merged and restored on cleanup', () => {
    const { container, unmount } = render(Tooltip, {
      props: {
        text: 'Tooltip content',
        children: multiDescriptionTriggerSnippet,
      },
    });
    const trigger = container.querySelector<HTMLElement>('button');
    const tooltipId = queryTooltip()?.getAttribute('id');

    expect(trigger?.getAttribute('aria-describedby')).toBe(`alpha beta ${tooltipId}`);

    unmount();

    expect(trigger?.getAttribute('aria-describedby')).toBe('alpha beta');
  });

  test('tooltip becomes visible on focusin and receives fixed-position coordinates', async () => {
    computePositionResult = {
      x: 48,
      y: 72,
      placement: 'bottom',
    };
    const { container } = render(Tooltip, {
      props: {
        text: 'Tooltip content',
        children: triggerSnippet,
      },
    });
    const wrapper = container.querySelector('.cinder-tooltip-wrapper') as HTMLElement;
    await fireEvent.focusIn(wrapper);

    await waitFor(() => {
      const tooltip = queryTooltip();
      expect(tooltip?.getAttribute('aria-hidden')).toBe('false');
      expect(tooltip?.getAttribute('data-cinder-position-ready')).toBe('true');
      expect(tooltip?.getAttribute('data-cinder-placement')).toBe('bottom');
      expect(tooltip?.getAttribute('style')).toContain('left: 48px');
      expect(tooltip?.getAttribute('style')).toContain('top: 72px');
    });

    const options = computePositionSpy.mock.calls[0]?.at(2) as { strategy?: string } | undefined;
    expect(options?.strategy).toBe('fixed');
  });

  test('autoUpdate receives the resolved anchor and tooltip element', async () => {
    const { container } = render(Tooltip, {
      props: {
        text: 'Tooltip content',
        children: triggerSnippet,
      },
    });
    const wrapper = container.querySelector('.cinder-tooltip-wrapper') as HTMLElement;
    const trigger = container.querySelector('button') as HTMLElement;
    await fireEvent.mouseEnter(wrapper);

    await waitFor(() => {
      expect(autoUpdateSpy).toHaveBeenCalled();
    });

    const [anchor, tooltip] = autoUpdateSpy.mock.calls[0] ?? [];
    expect(anchor).toBe(trigger);
    const portaledTooltip = queryTooltip();
    expect(portaledTooltip).not.toBeNull();
    expect(tooltip).toBe(portaledTooltip as HTMLElement);
  });

  test('disabled tabindex child is ignored and wrapper becomes the anchor fallback', async () => {
    const { container } = render(Tooltip, {
      props: {
        text: 'Tooltip content',
        children: disabledTabindexTriggerSnippet,
      },
    });
    const wrapper = container.querySelector('.cinder-tooltip-wrapper') as HTMLElement;
    await fireEvent.mouseEnter(wrapper);

    await waitFor(() => {
      expect(autoUpdateSpy).toHaveBeenCalled();
    });

    const [anchor] = autoUpdateSpy.mock.calls[0] ?? [];
    expect(anchor).toBe(wrapper);
  });

  test('tooltip becomes hidden on focusout and tears down autoUpdate', async () => {
    const { container } = render(Tooltip, {
      props: {
        text: 'Tooltip content',
        children: triggerSnippet,
      },
    });
    const wrapper = container.querySelector('.cinder-tooltip-wrapper') as HTMLElement;

    await fireEvent.focusIn(wrapper);
    await waitFor(() => {
      expect(queryTooltip()?.getAttribute('aria-hidden')).toBe('false');
    });

    await fireEvent.focusOut(wrapper);
    await waitFor(() => {
      expect(queryTooltip()?.getAttribute('aria-hidden')).toBe('true');
    });
    expect(autoUpdateTeardown).toHaveBeenCalled();
  });

  test('data-cinder-placement reflects the placement prop when hidden', () => {
    render(Tooltip, {
      props: {
        text: 'Tooltip content',
        placement: 'bottom',
        children: triggerSnippet,
      },
    });
    expect(queryTooltip()?.getAttribute('data-cinder-placement')).toBe('bottom');
  });

  test('defaults to placement "top" when placement prop is omitted', () => {
    render(Tooltip, {
      props: {
        text: 'Tooltip content',
        children: triggerSnippet,
      },
    });
    expect(queryTooltip()?.getAttribute('data-cinder-placement')).toBe('top');
  });

  test('tooltip text content is rendered', () => {
    render(Tooltip, {
      props: {
        text: 'This is the tooltip text',
        children: triggerSnippet,
      },
    });
    expect(queryTooltip()?.textContent?.trim()).toBe('This is the tooltip text');
  });

  test('shows tooltip on mouseenter and hides on mouseleave', async () => {
    const { container } = render(Tooltip, {
      props: {
        text: 'Hover tooltip',
        children: triggerSnippet,
      },
    });
    const wrapper = container.querySelector('.cinder-tooltip-wrapper') as HTMLElement;

    await fireEvent.mouseEnter(wrapper);
    await waitFor(() => {
      expect(queryTooltip()?.getAttribute('aria-hidden')).toBe('false');
    });

    await fireEvent.mouseLeave(wrapper);
    await waitFor(() => {
      expect(queryTooltip()?.getAttribute('aria-hidden')).toBe('true');
    });
  });

  test('Escape hides a visible tooltip (WAI-ARIA APG dismiss requirement)', async () => {
    const { container } = render(Tooltip, {
      props: {
        text: 'Dismissible tooltip',
        children: triggerSnippet,
      },
    });
    const wrapper = container.querySelector('.cinder-tooltip-wrapper') as HTMLElement;

    await fireEvent.focusIn(wrapper);
    await waitFor(() => {
      expect(queryTooltip()?.getAttribute('aria-hidden')).toBe('false');
    });

    await fireEvent.keyDown(wrapper, { key: 'Escape' });
    await waitFor(() => {
      expect(queryTooltip()?.getAttribute('aria-hidden')).toBe('true');
    });
  });

  test('Escape on document hides a tooltip opened by hover', async () => {
    const { container } = render(Tooltip, {
      props: {
        text: 'Dismissible hover tooltip',
        children: triggerSnippet,
      },
    });
    const wrapper = container.querySelector('.cinder-tooltip-wrapper') as HTMLElement;

    await fireEvent.mouseEnter(wrapper);
    await waitFor(() => {
      expect(queryTooltip()?.getAttribute('aria-hidden')).toBe('false');
    });

    await fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => {
      expect(queryTooltip()?.getAttribute('aria-hidden')).toBe('true');
    });
  });

  test('Escape cancels a pending tooltip before the show delay completes', async () => {
    const originalSetTimeout = globalThis.setTimeout;
    const originalClearTimeout = globalThis.clearTimeout;
    const pendingTimers = new Map<number, () => void>();
    let nextTimerId = 0;

    globalThis.setTimeout = ((handler: TimerHandler) => {
      nextTimerId += 1;
      pendingTimers.set(nextTimerId, () => {
        if (typeof handler === 'function') handler();
      });
      return nextTimerId;
    }) as typeof setTimeout;
    globalThis.clearTimeout = ((id: number | undefined) => {
      if (typeof id === 'number') pendingTimers.delete(id);
    }) as typeof clearTimeout;

    try {
      const { container } = render(Tooltip, {
        props: {
          text: 'Pending tooltip',
          children: triggerSnippet,
        },
      });
      const wrapper = container.querySelector('.cinder-tooltip-wrapper') as HTMLElement;

      await fireEvent.mouseEnter(wrapper);
      await fireEvent.keyDown(document, { key: 'Escape' });
      for (const runTimer of pendingTimers.values()) {
        runTimer();
      }

      expect(queryTooltip()?.getAttribute('aria-hidden')).toBe('true');
    } finally {
      globalThis.setTimeout = originalSetTimeout;
      globalThis.clearTimeout = originalClearTimeout;
    }
  });

  test('Escape on a hidden tooltip is a no-op', async () => {
    const { container } = render(Tooltip, {
      props: {
        text: 'Already hidden',
        children: triggerSnippet,
      },
    });
    const wrapper = container.querySelector('.cinder-tooltip-wrapper') as HTMLElement;

    expect(queryTooltip()?.getAttribute('aria-hidden')).toBe('true');
    await fireEvent.keyDown(wrapper, { key: 'Escape' });
    expect(queryTooltip()?.getAttribute('aria-hidden')).toBe('true');
  });

  test('copies inherited dir and theme to the portaled tooltip', () => {
    render(Tooltip, {
      props: {
        text: 'Tooltip content',
        children: createRawSnippet(() => ({
          render: () =>
            '<div dir="rtl" data-cinder-theme="dark"><button type="button">Hover me</button></div>',
          setup: () => {},
        })),
      },
    });

    const tooltip = queryTooltip();
    expect(tooltip?.getAttribute('dir')).toBe('rtl');
    expect(tooltip?.getAttribute('data-cinder-theme')).toBe('dark');
  });

  test('computePosition failure keeps tooltip hidden until the next successful show', async () => {
    computePositionShouldReject = true;
    const { container } = render(Tooltip, {
      props: {
        text: 'Tooltip content',
        children: triggerSnippet,
      },
    });
    const wrapper = container.querySelector('.cinder-tooltip-wrapper') as HTMLElement;

    await fireEvent.mouseEnter(wrapper);
    await waitFor(() => {
      expect(queryTooltip()?.getAttribute('data-cinder-position-ready')).toBe('false');
      expect(queryTooltip()?.getAttribute('aria-hidden')).toBe('true');
    });

    await fireEvent.mouseLeave(wrapper);
    await waitFor(() => {
      expect(queryTooltip()?.getAttribute('aria-hidden')).toBe('true');
    });

    computePositionShouldReject = false;
    computePositionResult = { x: 101, y: 202, placement: 'right' };

    await fireEvent.mouseEnter(wrapper);
    await waitFor(() => {
      expect(queryTooltip()?.getAttribute('data-cinder-position-ready')).toBe('true');
      expect(queryTooltip()?.getAttribute('aria-hidden')).toBe('false');
      expect(queryTooltip()?.getAttribute('data-cinder-placement')).toBe('right');
      expect(queryTooltip()?.getAttribute('style')).toContain('left: 101px');
      expect(queryTooltip()?.getAttribute('style')).toContain('top: 202px');
    });
  });

  test('stale deferred compute results do not overwrite a newer visible tooltip position', async () => {
    deferComputePosition = true;
    const { container } = render(Tooltip, {
      props: {
        text: 'Tooltip content',
        children: triggerSnippet,
      },
    });
    const wrapper = container.querySelector('.cinder-tooltip-wrapper') as HTMLElement;

    await triggerDelayedTooltipShow(wrapper);
    await waitFor(() => {
      expect(computePositionSpy).toHaveBeenCalled();
    });

    await fireEvent.mouseLeave(wrapper);
    await waitFor(() => {
      expect(queryTooltip()?.getAttribute('aria-hidden')).toBe('true');
    });

    deferComputePosition = false;
    computePositionResult = { x: 303, y: 404, placement: 'left' };
    await triggerDelayedTooltipShow(wrapper);

    const staleResolvers = [...deferredResolvers];
    deferredResolvers = [];
    for (const resolve of staleResolvers) {
      resolve({ x: 5, y: 6, placement: 'bottom' });
    }

    await waitFor(() => {
      expect(queryTooltip()?.getAttribute('data-cinder-position-ready')).toBe('true');
      expect(queryTooltip()?.getAttribute('style')).toContain('left: 303px');
      expect(queryTooltip()?.getAttribute('style')).toContain('top: 404px');
      expect(queryTooltip()?.getAttribute('data-cinder-placement')).toBe('left');
    });
  });
});
