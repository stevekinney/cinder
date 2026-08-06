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
const { _resetEscapeStack, pushEscapeHandler } = await import('../../_internal/overlay.ts');

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
  // Re-register the module mock before each test. The @floating-ui/dom import
  // inside anchored-overlay is a lazy dynamic import that runs inside a Svelte
  // $effect — it resolves at effect runtime, not at module-eval time. If another
  // test file calls mock.restore() between tests (e.g. dev-warn.test.ts), it
  // wipes this process-global mock registration and the real floating-ui runs
  // instead of these spies, causing non-deterministic failures in the same
  // process. Re-asserting here ensures the spy is always active when the effect
  // fires, regardless of what other files do.
  mock.module('@floating-ui/dom', () => ({
    arrow: arrowSpy,
    autoUpdate: autoUpdateSpy,
    computePosition: computePositionSpy,
    flip: flipSpy,
    shift: shiftSpy,
    offset: offsetSpy,
  }));

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
  _resetEscapeStack();
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

  test('a hidden tooltip stays inline and leaves nothing in document.body', () => {
    // The portal is gated on visibility. Before this, every Tooltip portaled on
    // mount and stayed there for its whole lifetime — one detached
    // `[role="tooltip"]` per instance sitting in `document.body`, including
    // during SSR, against OVERLAY-POLICY.md's "SSR markup is empty".
    //
    // Hidden means INLINE, not unmounted: the portal's disabled path restores
    // the node to its original position, so the `aria-describedby` target keeps
    // resolving while the tooltip is not showing.
    const { container } = render(Tooltip, {
      props: {
        text: 'Tooltip content',
        children: triggerSnippet,
      },
    });
    const tooltip = container.querySelector('[role="tooltip"]');
    expect(tooltip).not.toBeNull();
    expect(tooltip?.getAttribute('aria-hidden')).toBe('true');
    expect(tooltip?.parentElement).not.toBe(document.body);
    expect([...document.body.children].some((child) => child.matches('[role="tooltip"]'))).toBe(
      false,
    );
  });

  test('a shown tooltip portals to document.body', async () => {
    const { container } = render(Tooltip, {
      props: {
        text: 'Tooltip content',
        children: triggerSnippet,
      },
    });
    const wrapper = container.querySelector('.cinder-tooltip-wrapper') as HTMLElement;

    await triggerDelayedTooltipShow(wrapper);
    await waitFor(() => {
      expect(queryTooltip()?.parentElement).toBe(document.body);
    });
  });

  test('triggerRef renders only the panel, with no wrapper around a trigger', () => {
    // Anchored-by-reference mode exists so a Tooltip can be used where the
    // surrounding markup constrains its children — AvatarGroup wraps each avatar
    // in a `role="listitem"`, and a wrapping Tooltip put its panel inside one.
    const trigger = document.createElement('button');
    trigger.type = 'button';
    document.body.append(trigger);

    const { container } = render(Tooltip, {
      props: { text: 'Tooltip content', triggerRef: trigger },
    });

    expect(container.querySelector('.cinder-tooltip-wrapper')).toBeNull();
    const tooltip = container.querySelector('[role="tooltip"]');
    expect(tooltip).not.toBeNull();
    expect(tooltip?.textContent).toContain('Tooltip content');

    trigger.remove();
  });

  test('triggerRef mode applies the class prop to the panel', () => {
    // In detached mode the panel IS the component root, so `class` belongs on
    // it — the wrapping form puts it on the wrapper instead. Without this the
    // prop was silently dropped for every detached Tooltip.
    const trigger = document.createElement('button');
    trigger.type = 'button';
    document.body.append(trigger);

    const { container } = render(Tooltip, {
      props: { text: 'Tooltip content', triggerRef: trigger, class: 'custom-tooltip' },
    });

    const tooltip = container.querySelector('[role="tooltip"]');
    expect(tooltip?.classList.contains('cinder-tooltip')).toBe(true);
    expect(tooltip?.classList.contains('custom-tooltip')).toBe(true);

    trigger.remove();
  });

  test('triggerRef wires aria-describedby to the external trigger', () => {
    const trigger = document.createElement('button');
    trigger.type = 'button';
    document.body.append(trigger);

    const { container } = render(Tooltip, {
      props: { text: 'Tooltip content', triggerRef: trigger },
    });

    const tooltip = container.querySelector('[role="tooltip"]');
    expect(tooltip).not.toBeNull();
    expect(trigger.getAttribute('aria-describedby')).toBe(tooltip?.getAttribute('id') ?? null);

    trigger.remove();
  });

  test('triggerRef shows the tooltip from the external trigger and hides again', async () => {
    const trigger = document.createElement('button');
    trigger.type = 'button';
    document.body.append(trigger);

    const { container } = render(Tooltip, {
      props: { text: 'Tooltip content', triggerRef: trigger },
    });
    // Resting appearance, not just the transition: hidden before any interaction,
    // and living in the consumer's tree rather than `document.body`.
    expect(container.querySelector('[role="tooltip"]')?.getAttribute('aria-hidden')).toBe('true');

    // The show delay is the same 100ms as the wrapping mode, so drive it the
    // same way — the listeners are what is new here, not the timing.
    await triggerDelayedTooltipShow(trigger);
    await waitFor(() => {
      expect(queryTooltip()?.parentElement).toBe(document.body);
    });

    await fireEvent.mouseLeave(trigger);
    await tick();
    expect(container.querySelector('[role="tooltip"]')?.getAttribute('aria-hidden')).toBe('true');

    trigger.remove();
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

  test('the described element is EXPOSED when shown, in both anchoring modes', async () => {
    // `aria-describedby` pointing at a node is not the same as that description
    // being announced: while hidden the panel is `aria-hidden="true"`, so AT
    // ignores it. This pins the announcement contract itself — the referenced
    // element becomes exposed on show — for the wrapping form and the detached
    // form alike, which is what the portal gate and `triggerRef` both touch.
    const { container, unmount } = render(Tooltip, {
      props: { text: 'Wrapped description', children: triggerSnippet },
    });
    const wrapper = container.querySelector('.cinder-tooltip-wrapper') as HTMLElement;
    const trigger = container.querySelector<HTMLElement>('button');
    const describedById = trigger?.getAttribute('aria-describedby');
    expect(describedById).toBeTruthy();

    // Resting: referenced, but hidden from AT.
    expect(document.getElementById(describedById ?? '')?.getAttribute('aria-hidden')).toBe('true');

    await triggerDelayedTooltipShow(wrapper);
    await waitFor(() => {
      expect(document.getElementById(describedById ?? '')?.getAttribute('aria-hidden')).toBe(
        'false',
      );
    });
    unmount();
    await tick();

    // Same contract via triggerRef.
    const external = document.createElement('button');
    external.type = 'button';
    document.body.append(external);
    const detached = render(Tooltip, {
      props: { text: 'Detached description', triggerRef: external },
    });
    const detachedId = external.getAttribute('aria-describedby');
    expect(detachedId).toBeTruthy();
    expect(document.getElementById(detachedId ?? '')?.getAttribute('aria-hidden')).toBe('true');

    await triggerDelayedTooltipShow(external);
    await waitFor(() => {
      expect(document.getElementById(detachedId ?? '')?.getAttribute('aria-hidden')).toBe('false');
    });

    detached.unmount();
    external.remove();
    await tick();
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

  test('Escape uses the shared LIFO stack before an enclosing overlay handler', async () => {
    const parentEscape = mock(() => {});
    const releaseParentEscape = pushEscapeHandler(parentEscape);
    try {
      const { container } = render(Tooltip, {
        props: {
          text: 'Tooltip content',
          children: triggerSnippet,
        },
      });
      const wrapper = container.querySelector('.cinder-tooltip-wrapper') as HTMLElement;
      await triggerDelayedTooltipShow(wrapper);
      await waitFor(() => expect(queryTooltip()?.getAttribute('aria-hidden')).toBe('false'));

      const firstEscape = new KeyboardEvent('keydown', {
        key: 'Escape',
        bubbles: true,
        cancelable: true,
      });
      window.dispatchEvent(firstEscape);
      await tick();

      expect(firstEscape.defaultPrevented).toBe(true);
      expect(parentEscape).not.toHaveBeenCalled();
      expect(queryTooltip()?.getAttribute('aria-hidden')).toBe('true');

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

  test('pending tooltip does not take over the shared Escape stack or open after Escape', async () => {
    const trackedSetTimeout = globalThis.setTimeout;
    const trackedClearTimeout = globalThis.clearTimeout;
    const trackedSetInterval = globalThis.setInterval;
    const trackedClearInterval = globalThis.clearInterval;
    const parentEscape = mock((event: KeyboardEvent) => {
      event.preventDefault();
    });
    const releaseParentEscape = pushEscapeHandler(parentEscape);
    const { container, unmount } = render(Tooltip, {
      props: {
        text: 'Pending tooltip',
        children: triggerSnippet,
      },
    });
    const wrapper = container.querySelector('.cinder-tooltip-wrapper') as HTMLElement;

    try {
      jest.useFakeTimers();
      await fireEvent.mouseEnter(wrapper);
      await fireEvent.keyDown(document, { key: 'Escape' });
      jest.advanceTimersByTime(100);
      await tick();

      expect(parentEscape).toHaveBeenCalledTimes(1);
      expect(queryTooltip()?.getAttribute('aria-hidden')).toBe('true');
    } finally {
      jest.useRealTimers();
      globalThis.setTimeout = trackedSetTimeout;
      globalThis.clearTimeout = trackedClearTimeout;
      globalThis.setInterval = trackedSetInterval;
      globalThis.clearInterval = trackedClearInterval;
      unmount();
      releaseParentEscape();
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

  test('copies inherited dir and theme to the portaled tooltip', async () => {
    // Attribute inheritance is a property of the PORTALED node, so the tooltip
    // has to be shown before it can be asserted — the portal is gated on
    // visibility now.
    const { container } = render(Tooltip, {
      props: {
        text: 'Tooltip content',
        children: createRawSnippet(() => ({
          render: () =>
            '<div dir="rtl" data-theme="dark" data-cinder-theme="dark"><button type="button">Hover me</button></div>',
          setup: () => {},
        })),
      },
    });
    const wrapper = container.querySelector('.cinder-tooltip-wrapper') as HTMLElement;

    await triggerDelayedTooltipShow(wrapper);
    await waitFor(() => {
      const tooltip = queryTooltip();
      expect(tooltip?.getAttribute('dir')).toBe('rtl');
      expect(tooltip?.getAttribute('data-theme')).toBe('dark');
      expect(tooltip?.getAttribute('data-cinder-theme')).toBe('dark');
    });
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
