/// <reference lib="dom" />
import { afterEach, describe, expect, mock, spyOn, test } from 'bun:test';
import { readFileSync } from 'node:fs';

import { setupHappyDom } from '../../test/happy-dom.ts';

setupHappyDom();

const { cleanup, fireEvent, render, screen, waitFor } = await import('@testing-library/svelte');
const { default: SpeedDialFixture } = await import('./speed-dial.fixture.svelte');
const { waitForSpeedDialExit } = await import('./speed-dial-exit.ts');
const { createQueuedFocusRestoration, getFocusTargetBeforeSpeedDial } =
  await import('./speed-dial-focus.ts');
const speedDialSource = readFileSync(new URL('./speed-dial.svelte', import.meta.url), 'utf8');
const speedDialStyles = readFileSync(new URL('./speed-dial.css', import.meta.url), 'utf8');

afterEach(() => {
  cleanup();
  document.body.replaceChildren();
});

async function flushQueuedFocus(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

function dispatchTransitionBoundary(
  target: EventTarget,
  type: 'transitioncancel' | 'transitionend',
  propertyName: string,
): void {
  dispatchTransitionBoundaryFrom(target, type, propertyName);
}

function createTransitionBoundaryEvent(
  type: 'transitioncancel' | 'transitionend',
  propertyName: string,
): Event {
  const event = new window.Event(type, { bubbles: true });
  Object.defineProperty(event, 'propertyName', { value: propertyName });
  return event;
}

function dispatchTransitionBoundaryFrom(
  eventTarget: EventTarget,
  type: 'transitioncancel' | 'transitionend',
  propertyName: string,
): void {
  eventTarget.dispatchEvent(createTransitionBoundaryEvent(type, propertyName));
}

function mockComputedTransitionStyle(
  matchElement: (element: Element) => boolean,
  transitionStyle: Pick<
    CSSStyleDeclaration,
    'transitionDelay' | 'transitionDuration' | 'transitionProperty'
  >,
) {
  const originalGetComputedStyle = window.getComputedStyle.bind(window);
  return spyOn(window, 'getComputedStyle').mockImplementation(
    (element: Element, pseudoElement?: string | null) => {
      const style = originalGetComputedStyle(element, pseudoElement);
      if (!matchElement(element)) return style;
      const mockedStyle = Object.create(style) as CSSStyleDeclaration;
      Object.defineProperties(mockedStyle, {
        transitionDelay: { configurable: true, value: transitionStyle.transitionDelay },
        transitionDuration: { configurable: true, value: transitionStyle.transitionDuration },
        transitionProperty: { configurable: true, value: transitionStyle.transitionProperty },
      });
      return mockedStyle;
    },
  );
}

describe('SpeedDial', () => {
  test('queued focus restoration runs a current scheduled callback', () => {
    const queuedCallbacks: VoidFunction[] = [];
    const restoration = createQueuedFocusRestoration((callback) => queuedCallbacks.push(callback));
    const restoreFocus = mock(() => {});

    restoration.schedule(restoreFocus);
    queuedCallbacks.shift()?.();

    expect(restoreFocus).toHaveBeenCalledTimes(1);
  });

  test('queued focus restoration ignores callbacks after invalidation', () => {
    const queuedCallbacks: VoidFunction[] = [];
    const restoration = createQueuedFocusRestoration((callback) => queuedCallbacks.push(callback));
    const restoreFocus = mock(() => {});

    restoration.schedule(restoreFocus);
    restoration.invalidate();
    queuedCallbacks.shift()?.();

    expect(restoreFocus).not.toHaveBeenCalled();
  });

  test('queued focus restoration blocks older close generations after later generations', () => {
    const queuedCallbacks: VoidFunction[] = [];
    const restoration = createQueuedFocusRestoration((callback) => queuedCallbacks.push(callback));
    const staleRestoreFocus = mock(() => {});
    const currentRestoreFocus = mock(() => {});

    restoration.schedule(staleRestoreFocus);
    restoration.invalidate();
    restoration.schedule(currentRestoreFocus);

    queuedCallbacks.shift()?.();
    queuedCallbacks.shift()?.();

    expect(staleRestoreFocus).not.toHaveBeenCalled();
    expect(currentRestoreFocus).toHaveBeenCalledTimes(1);
  });

  test('exit helper waits for every transitioned property before completing', async () => {
    const action = document.createElement('button');
    document.body.append(action);
    const complete = mock(() => {});
    const getComputedStyleSpy = mockComputedTransitionStyle((element) => element === action, {
      transitionDelay: '0ms, 0ms',
      transitionDuration: '150ms, 150ms',
      transitionProperty: 'opacity, transform',
    });

    try {
      const cancel = waitForSpeedDialExit(action, false, complete);

      dispatchTransitionBoundary(action, 'transitionend', 'opacity');
      expect(complete).not.toHaveBeenCalled();

      dispatchTransitionBoundary(action, 'transitionend', 'transform');
      expect(complete).toHaveBeenCalledTimes(1);

      cancel();
    } finally {
      getComputedStyleSpy.mockRestore();
    }
  });

  test('exit helper settles immediately when transition property is none', async () => {
    const action = document.createElement('button');
    document.body.append(action);
    const complete = mock(() => {});
    const getComputedStyleSpy = mockComputedTransitionStyle((element) => element === action, {
      transitionDelay: '100ms',
      transitionDuration: '150ms',
      transitionProperty: 'none',
    });

    try {
      const cancel = waitForSpeedDialExit(action, false, complete);

      await flushQueuedFocus();
      expect(complete).toHaveBeenCalledTimes(1);

      cancel();
    } finally {
      getComputedStyleSpy.mockRestore();
    }
  });

  test('exit helper counts every transitionProperty slot in the "all" fallback, not just max(durations, delays) (CIN-376)', async () => {
    // Five properties (`all, opacity, transform, width, color`), only three
    // durations/delays. The fifth slot (index 4) cyclically resolves to
    // `durations[4 % 2] + delays[4 % 3] = 100ms + 300ms = 400ms` — the real
    // longest boundary. Because `all` is present, `ignoreUnknownPropertyEvents`
    // means completion can ONLY come from the computed-longest-duration
    // fallback timer; a fallback that stopped at `max(durations.length,
    // delays.length)` (3 slots) would miss this fifth slot and schedule
    // completion ~100ms too early, removing the retained actions surface
    // before the color transition ends.
    const action = document.createElement('button');
    document.body.append(action);
    const complete = mock(() => {});
    const getComputedStyleSpy = mockComputedTransitionStyle((element) => element === action, {
      transitionDelay: '0ms, 300ms, 0ms',
      transitionDuration: '100ms, 0ms',
      transitionProperty: 'all, opacity, transform, width, color',
    });

    try {
      waitForSpeedDialExit(action, false, complete);

      await new Promise((resolve) => setTimeout(resolve, 360));
      expect(complete).not.toHaveBeenCalled();

      await new Promise((resolve) => setTimeout(resolve, 120));
      expect(complete).toHaveBeenCalledTimes(1);
    } finally {
      getComputedStyleSpy.mockRestore();
    }
  });

  test('exit helper ignores individual events for a consumer transition list containing "all" and waits for the computed longest duration (CIN-376)', async () => {
    // Regression guard: a consumer's own CSS on an action can legitimately
    // include `all` alongside a named property — e.g.
    // `transition: all 500ms, opacity 100ms`. `waitForTransitionCompletion`
    // represents `all` with a null (unenumerable) tracked-property set, and
    // by default finishes on the FIRST `transitionend` in that case (see
    // OVERLAY-POLICY.md § "Transition lifecycle" — the cost of using `all`
    // instead of naming properties, for CINDER'S OWN css). For Speed Dial
    // specifically, that default would let the 100ms `opacity` boundary
    // clear the retained actions surface while the `transform` covered by
    // `all` is still transitioning for the full 500ms. `speed-dial-exit.ts`
    // passes `ignoreUnknownPropertyEvents: true` to restore the old bespoke
    // waiter's exact behavior: ignore individual events entirely for this
    // case and rely solely on the computed-longest-duration fallback timer.
    const action = document.createElement('button');
    document.body.append(action);
    const complete = mock(() => {});
    const getComputedStyleSpy = mockComputedTransitionStyle((element) => element === action, {
      transitionDelay: '0ms, 0ms',
      transitionDuration: '500ms, 100ms',
      transitionProperty: 'all, opacity',
    });

    try {
      const cancel = waitForSpeedDialExit(action, false, complete);

      // The named 100ms `opacity` boundary firing alone must NOT complete
      // the exit — the `all` boundary's individual events are ignored, so
      // completion can only come from the fallback timer at the longest
      // (500ms) duration.
      dispatchTransitionBoundary(action, 'transitionend', 'opacity');
      expect(complete).not.toHaveBeenCalled();

      // A transitionend for a property `all` would have covered doesn't
      // complete it either — individual events are ignored entirely.
      dispatchTransitionBoundary(action, 'transitionend', 'transform');
      expect(complete).not.toHaveBeenCalled();

      await Bun.sleep(560);
      expect(complete).toHaveBeenCalledTimes(1);

      cancel();
    } finally {
      getComputedStyleSpy.mockRestore();
    }
  });

  test('exit helper ignores interrupted entrance transition cancellation', async () => {
    // Speed Dial's per-action waiter passes `ignoreCancel: true` to the
    // shared `waitForTransitionCompletion` (see speed-dial-exit.ts): an
    // action can still be mid-ENTER-transition (its own staggered delay not
    // yet elapsed) when the close begins, and the browser cancels that
    // in-flight enter transition the instant the style target changes.
    // Under the canonical (non-`ignoreCancel`) semantics that `transitioncancel`
    // would be mistaken for "this action's exit already finished" — resolving
    // prematurely, before the exit transition has even started. This matches
    // the old bespoke `waitForSpeedDialExit`, which never listened for
    // `transitioncancel` at all.
    const action = document.createElement('button');
    document.body.append(action);
    const complete = mock(() => {});
    const getComputedStyleSpy = mockComputedTransitionStyle((element) => element === action, {
      transitionDelay: '0ms, 0ms',
      transitionDuration: '150ms, 150ms',
      transitionProperty: 'opacity, transform',
    });

    try {
      const cancel = waitForSpeedDialExit(action, false, complete);

      dispatchTransitionBoundary(action, 'transitioncancel', 'opacity');
      dispatchTransitionBoundary(action, 'transitioncancel', 'transform');
      expect(complete).not.toHaveBeenCalled();

      dispatchTransitionBoundary(action, 'transitionend', 'opacity');
      expect(complete).not.toHaveBeenCalled();

      dispatchTransitionBoundary(action, 'transitionend', 'transform');
      expect(complete).toHaveBeenCalledTimes(1);

      cancel();
    } finally {
      getComputedStyleSpy.mockRestore();
    }
  });

  test('exit helper only tracks properties whose resolved duration+delay is positive', async () => {
    // The shared `transition-completion.ts` this now delegates to repeats a
    // shorter duration/delay list CYCLICALLY against a longer property list,
    // matching the CSS spec — with `transitionDuration: '150ms, 0ms'` the
    // third property (`width`, index 2) resolves to `durations[2 % 2] =
    // durations[0] = 150ms` (tracked), while the second property
    // (`transform`, index 1) resolves to `durations[1] = 0ms` (not tracked).
    // Tracked set is `{opacity, width}` — both must fire before completing.
    const action = document.createElement('button');
    document.body.append(action);
    const complete = mock(() => {});
    const getComputedStyleSpy = mockComputedTransitionStyle((element) => element === action, {
      transitionDelay: '0ms',
      transitionDuration: '150ms, 0ms',
      transitionProperty: 'opacity, transform, width',
    });

    try {
      const cancel = waitForSpeedDialExit(action, false, complete);

      dispatchTransitionBoundary(action, 'transitionend', 'opacity');
      expect(complete).not.toHaveBeenCalled();

      dispatchTransitionBoundary(action, 'transitionend', 'width');
      expect(complete).toHaveBeenCalledTimes(1);

      cancel();
    } finally {
      getComputedStyleSpy.mockRestore();
    }
  });

  test('exit helper repeats a shorter duration list cyclically against delays (CIN-376)', async () => {
    // The review's exact scenario: three properties, durations `100ms, 0ms`
    // (cyclic), delays `0ms, 0ms, 300ms` (one per property, no repeat
    // needed). The third property's real boundary is
    // `durations[2 % 2] + delays[2] = 100ms + 300ms = 400ms` — a "repeat the
    // last value" implementation would instead compute `durations.at(-1) +
    // delays[2] = 0ms + 300ms = 300ms`, whose `+50` fallback (350ms) would
    // remove the retained actions surface before the real 400ms transition
    // ends.
    const action = document.createElement('button');
    document.body.append(action);
    const complete = mock(() => {});
    const getComputedStyleSpy = mockComputedTransitionStyle((element) => element === action, {
      transitionDelay: '0ms, 0ms, 300ms',
      transitionDuration: '100ms, 0ms',
      transitionProperty: 'opacity, transform, width',
    });

    try {
      const cancel = waitForSpeedDialExit(action, false, complete);

      dispatchTransitionBoundary(action, 'transitionend', 'opacity');
      expect(complete).not.toHaveBeenCalled();

      dispatchTransitionBoundary(action, 'transitionend', 'width');
      expect(complete).toHaveBeenCalledTimes(1);

      cancel();
    } finally {
      getComputedStyleSpy.mockRestore();
    }
  });

  test('exit helper ignores events targeting an unrelated element', async () => {
    const action = document.createElement('button');
    const other = document.createElement('span');
    document.body.append(action, other);
    const complete = mock(() => {});
    const getComputedStyleSpy = mockComputedTransitionStyle((element) => element === action, {
      transitionDelay: '0ms, 0ms',
      transitionDuration: '150ms, 150ms',
      transitionProperty: 'opacity, transform',
    });

    try {
      const cancel = waitForSpeedDialExit(action, false, complete);

      dispatchTransitionBoundary(other, 'transitionend', 'opacity');
      dispatchTransitionBoundary(action, 'transitionend', 'transform');
      expect(complete).not.toHaveBeenCalled();

      dispatchTransitionBoundary(action, 'transitionend', 'opacity');
      expect(complete).toHaveBeenCalledTimes(1);

      cancel();
    } finally {
      getComputedStyleSpy.mockRestore();
    }
  });

  test('exit helper ignores stale transition callbacks after cleanup', async () => {
    const action = document.createElement('button');
    document.body.append(action);
    const complete = mock(() => {});
    const getComputedStyleSpy = mockComputedTransitionStyle((element) => element === action, {
      transitionDelay: '0ms, 0ms',
      transitionDuration: '150ms, 150ms',
      transitionProperty: 'opacity, transform',
    });

    try {
      const cancel = waitForSpeedDialExit(action, false, complete);
      cancel();

      dispatchTransitionBoundary(action, 'transitionend', 'opacity');
      dispatchTransitionBoundary(action, 'transitionend', 'transform');

      expect(complete).not.toHaveBeenCalled();
    } finally {
      getComputedStyleSpy.mockRestore();
    }
  });

  test('exit helper waits for every action before completing', async () => {
    const first = document.createElement('button');
    const second = document.createElement('button');
    document.body.append(first, second);
    const complete = mock(() => {});
    const getComputedStyleSpy = mockComputedTransitionStyle(
      (element) => element === first || element === second,
      {
        transitionDelay: '0ms',
        transitionDuration: '150ms',
        transitionProperty: 'opacity',
      },
    );

    try {
      const cancel = waitForSpeedDialExit([first, second], false, complete);
      dispatchTransitionBoundary(first, 'transitionend', 'opacity');
      expect(complete).not.toHaveBeenCalled();

      dispatchTransitionBoundary(second, 'transitionend', 'opacity');
      expect(complete).toHaveBeenCalledTimes(1);
      cancel();
    } finally {
      getComputedStyleSpy.mockRestore();
    }
  });

  test('renders group, trigger, and toolbar semantics', () => {
    const { container } = render(SpeedDialFixture);

    const group = screen.getByRole('group', { name: 'Quick actions' });
    const trigger = screen.getByRole('button', { name: 'Quick actions' });
    const toolbar = screen.getByRole('toolbar', { name: 'Actions', hidden: true });

    expect(group.classList.contains('cinder-speed-dial')).toBe(true);
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(trigger.hasAttribute('aria-haspopup')).toBe(false);
    expect(trigger.getAttribute('aria-controls')).toBe(toolbar.id);
    expect(toolbar.getAttribute('aria-orientation')).toBe('vertical');
    expect(container.querySelector('.cinder-speed-dial')?.hasAttribute('data-cinder-open')).toBe(
      false,
    );
  });

  test('closed toolbar keeps its exit surface mounted and inert', () => {
    const { container } = render(SpeedDialFixture);
    const toolbar = screen.getByRole('toolbar', { name: 'Actions', hidden: true });

    expect(container.querySelector('.cinder-speed-dial__actions')).toBe(toolbar);
    expect(toolbar.hasAttribute('data-cinder-open')).toBe(false);
    expect(toolbar.hasAttribute('inert')).toBe(true);
  });

  test('open and reduced-motion styles preserve the same closed resting reset', () => {
    const closedActionsRule = speedDialStyles.match(
      /\.cinder-speed-dial__actions:not\(\[data-cinder-open\]\)\s*\{([^}]*)\}/s,
    )?.[1];
    expect(closedActionsRule).toBeDefined();
    expect(closedActionsRule).toMatch(/background\s*:\s*transparent\s*;/);
    expect(closedActionsRule).toMatch(/border-color\s*:\s*transparent\s*;/);
    expect(closedActionsRule).toMatch(/box-shadow\s*:\s*none\s*;/);
    expect(closedActionsRule).toMatch(/overflow-y\s*:\s*hidden\s*;/);

    const openActionsRule = speedDialStyles.match(
      /\.cinder-speed-dial__actions\[data-cinder-open\]\s*\{([^}]*)\}/s,
    )?.[1];
    expect(openActionsRule).toBeDefined();
    expect(openActionsRule).toMatch(/pointer-events\s*:\s*auto\s*;/);
    expect(speedDialStyles).toMatch(
      /@media \(prefers-reduced-motion: reduce\)\s*\{[\s\S]*?\.cinder-speed-dial-action\s*\{[^}]*transition:\s*none;/s,
    );
    expect(speedDialStyles).toMatch(/\.cinder-speed-dial-action\s*\{[^}]*opacity:\s*0;/s);
    expect(speedDialStyles).toMatch(
      /\.cinder-speed-dial__actions:not\(\[data-cinder-open\]\)\s+\.cinder-speed-dial-action\s*\{[^}]*pointer-events:\s*none;/s,
    );
  });

  test('open and post-close settled states keep the surface mounted and unavailable when closed', async () => {
    render(SpeedDialFixture);
    const trigger = screen.getByRole('button', { name: 'Quick actions' });

    await fireEvent.click(trigger);
    await flushQueuedFocus();
    const toolbar = screen.getByRole('toolbar', { name: 'Actions' });
    expect(toolbar.hasAttribute('data-cinder-open')).toBe(true);
    expect(toolbar.hasAttribute('inert')).toBe(false);
    await waitFor(() => expect(toolbar.hasAttribute('aria-hidden')).toBe(false));

    await fireEvent.click(trigger);
    await flushQueuedFocus();
    expect(screen.getByRole('toolbar', { name: 'Actions', hidden: true })).toBe(toolbar);
    expect(toolbar.hasAttribute('data-cinder-open')).toBe(false);
    expect(toolbar.hasAttribute('inert')).toBe(true);
  });

  test('ordinary-motion close keeps fixed coordinates until the visible exit settles', async () => {
    const originalMatchMedia = window.matchMedia;
    window.matchMedia = mock(
      (media: string): MediaQueryList =>
        ({
          matches: false,
          media,
          onchange: null,
          addEventListener: () => {},
          removeEventListener: () => {},
          addListener: () => {},
          removeListener: () => {},
          dispatchEvent: () => true,
        }) as MediaQueryList,
    );

    try {
      render(SpeedDialFixture);
      const trigger = screen.getByRole('button', { name: 'Quick actions' });

      await fireEvent.click(trigger);
      await flushQueuedFocus();
      const toolbar = screen.getByRole('toolbar', { name: 'Actions' });

      await waitFor(() => {
        expect(toolbar.getAttribute('style')).toContain('position: fixed;');
        expect(toolbar.getAttribute('style')).toContain('left:');
        expect(toolbar.getAttribute('style')).toContain('top:');
      });
      const positionedStyle = toolbar.getAttribute('style');
      const exitingActions = Array.from(
        toolbar.querySelectorAll<HTMLElement>('.cinder-speed-dial-action'),
      );
      const getComputedStyleSpy = mockComputedTransitionStyle(
        (element) => element.classList.contains('cinder-speed-dial-action'),
        {
          transitionDelay: '0ms, 0ms',
          transitionDuration: '150ms, 150ms',
          transitionProperty: 'opacity, transform',
        },
      );

      try {
        await fireEvent.click(trigger);

        expect(toolbar.getAttribute('style')).toBe(positionedStyle);
        expect(toolbar.hasAttribute('inert')).toBe(true);
        expect(toolbar.hasAttribute('data-cinder-open')).toBe(false);
        expect(toolbar.getAttribute('aria-hidden')).toBe('true');

        dispatchTransitionBoundary(exitingActions[0]!, 'transitionend', 'opacity');
        await flushQueuedFocus();

        expect(toolbar.getAttribute('style')).toBe(positionedStyle);

        exitingActions.forEach((action) => {
          dispatchTransitionBoundary(action, 'transitionend', 'opacity');
          dispatchTransitionBoundary(action, 'transitionend', 'transform');
        });
        await flushQueuedFocus();
        expect(toolbar.getAttribute('style')).toBe('');
      } finally {
        getComputedStyleSpy.mockRestore();
      }
    } finally {
      window.matchMedia = originalMatchMedia;
    }
  });

  test('reduced-motion close settles inline immediately', async () => {
    const originalMatchMedia = window.matchMedia;
    window.matchMedia = mock(
      (media: string): MediaQueryList =>
        ({
          matches: media === '(prefers-reduced-motion: reduce)',
          media,
          onchange: null,
          addEventListener: () => {},
          removeEventListener: () => {},
          addListener: () => {},
          removeListener: () => {},
          dispatchEvent: () => true,
        }) as MediaQueryList,
    );

    try {
      render(SpeedDialFixture);
      const trigger = screen.getByRole('button', { name: 'Quick actions' });

      await fireEvent.click(trigger);
      await flushQueuedFocus();
      const toolbar = screen.getByRole('toolbar', { name: 'Actions' });
      expect(toolbar.getAttribute('style')).toContain('position: fixed;');

      await fireEvent.click(trigger);
      await flushQueuedFocus();

      expect(toolbar.hasAttribute('inert')).toBe(true);
      expect(toolbar.getAttribute('style')).toBe('');
    } finally {
      window.matchMedia = originalMatchMedia;
    }
  });

  test('reopening during an ordinary-motion exit keeps the positioned surface active', async () => {
    const originalMatchMedia = window.matchMedia;
    window.matchMedia = mock(
      (media: string): MediaQueryList =>
        ({
          matches: false,
          media,
          onchange: null,
          addEventListener: () => {},
          removeEventListener: () => {},
          addListener: () => {},
          removeListener: () => {},
          dispatchEvent: () => true,
        }) as MediaQueryList,
    );

    try {
      render(SpeedDialFixture);
      const trigger = screen.getByRole('button', { name: 'Quick actions' });

      await fireEvent.click(trigger);
      await flushQueuedFocus();
      const toolbar = screen.getByRole('toolbar', { name: 'Actions' });

      await waitFor(() => {
        expect(toolbar.getAttribute('style')).toContain('position: fixed;');
        expect(toolbar.getAttribute('style')).toContain('left:');
        expect(toolbar.getAttribute('style')).toContain('top:');
      });
      const positionedStyle = toolbar.getAttribute('style');
      const create = screen.getByRole('button', { name: 'Create' });
      const exitingAction = create.closest('.cinder-speed-dial-action')!;
      const getComputedStyleSpy = mockComputedTransitionStyle(
        (element) => element.classList.contains('cinder-speed-dial-action'),
        {
          transitionDelay: '0ms, 0ms',
          transitionDuration: '150ms, 150ms',
          transitionProperty: 'opacity, transform',
        },
      );

      try {
        await fireEvent.click(trigger);
        dispatchTransitionBoundary(exitingAction, 'transitionend', 'opacity');
        await flushQueuedFocus();
        expect(toolbar.getAttribute('style')).toBe(positionedStyle);

        await fireEvent.click(trigger);
        await flushQueuedFocus();

        dispatchTransitionBoundary(exitingAction, 'transitionend', 'transform');
        await flushQueuedFocus();

        expect(toolbar.hasAttribute('data-cinder-open')).toBe(true);
        expect(toolbar.hasAttribute('inert')).toBe(false);
        expect(toolbar.getAttribute('style')).toContain('position: fixed;');
      } finally {
        getComputedStyleSpy.mockRestore();
      }
    } finally {
      window.matchMedia = originalMatchMedia;
    }
  });

  test('empty aria-label falls back to the default accessible name', () => {
    render(SpeedDialFixture, { props: { ariaLabel: '   ' } });

    expect(screen.getByRole('group', { name: 'Quick actions' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Quick actions' })).toBeTruthy();
  });

  test('trigger click opens and closes through bind:open', async () => {
    const { container } = render(SpeedDialFixture);
    const trigger = screen.getByRole('button', { name: 'Quick actions' });

    await fireEvent.click(trigger);
    await flushQueuedFocus();
    const toolbar = screen.getByRole('toolbar', { name: 'Actions', hidden: true });
    expect(screen.getByTestId('open-state').textContent).toBe('open');
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Create' }));
    expect(container.querySelector('.cinder-speed-dial')?.contains(toolbar)).toBe(false);
    expect(toolbar.parentElement?.parentElement).toBe(document.body);

    await fireEvent.click(trigger);
    expect(screen.getByTestId('open-state').textContent).toBe('closed');
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
  });

  test('portaled actions preserve scoped tokens and color scheme', async () => {
    render(SpeedDialFixture);
    const trigger = screen.getByRole('button', { name: 'Quick actions' });
    trigger.style.setProperty('--cinder-surface-raised', 'hotpink');
    trigger.style.colorScheme = 'dark';

    await fireEvent.click(trigger);
    await flushQueuedFocus();
    const toolbar = screen.getByRole('toolbar', { name: 'Actions' });

    const portalScope = toolbar.parentElement!;
    await waitFor(() => {
      expect(portalScope.style.getPropertyValue('--cinder-surface-raised')).toBe('hotpink');
      expect(portalScope.style.colorScheme).toBe('dark');
    });
    expect(toolbar.style.getPropertyValue('--cinder-surface-raised')).toBe('');

    trigger.setAttribute('style', '--cinder-surface-raised: rebeccapurple; color-scheme: light;');

    await waitFor(() => {
      expect(portalScope.style.getPropertyValue('--cinder-surface-raised')).toBe('rebeccapurple');
      expect(portalScope.style.colorScheme).toBe('light');
    });
  });

  test('portaled actions resync copied tokens when media preferences change', async () => {
    const listeners = new Set<EventListener>();
    const originalMatchMedia = window.matchMedia;
    window.matchMedia = mock(
      (media: string): MediaQueryList =>
        ({
          matches: false,
          media,
          onchange: null,
          addEventListener: (_type: string, listener: EventListenerOrEventListenerObject) => {
            if (typeof listener === 'function') listeners.add(listener);
          },
          removeEventListener: (_type: string, listener: EventListenerOrEventListenerObject) => {
            if (typeof listener === 'function') listeners.delete(listener);
          },
          addListener: () => {},
          removeListener: () => {},
          dispatchEvent: () => true,
        }) as MediaQueryList,
    );

    try {
      render(SpeedDialFixture);
      const trigger = screen.getByRole('button', { name: 'Quick actions' });
      await fireEvent.click(trigger);
      await flushQueuedFocus();

      const computedStyleSpy = spyOn(globalThis, 'getComputedStyle');
      computedStyleSpy.mockClear();
      const focusedAction = screen.getByRole('button', { name: 'Create' });
      expect(document.activeElement).toBe(focusedAction);
      for (const listener of listeners) listener(new Event('change'));

      await waitFor(() => expect(computedStyleSpy).toHaveBeenCalledWith(trigger));
      expect(document.activeElement).toBe(focusedAction);
      computedStyleSpy.mockRestore();
    } finally {
      window.matchMedia = originalMatchMedia;
    }
  });

  test('portaled actions preserve the scoped language', async () => {
    const { container } = render(SpeedDialFixture);
    container.setAttribute('lang', 'fr');

    await fireEvent.click(screen.getByRole('button', { name: 'Quick actions' }));
    await flushQueuedFocus();

    const toolbar = screen.getByRole('toolbar', { name: 'Actions' });
    expect(toolbar.parentElement?.getAttribute('lang')).toBe('fr');
  });

  test('keeps portaled actions inside the nearest open native popover', async () => {
    const outerPopover = document.createElement('div');
    outerPopover.setAttribute('popover', 'manual');
    outerPopover.dataset['testOpenPopover'] = 'true';
    const innerPopover = document.createElement('div');
    innerPopover.setAttribute('popover', 'manual');
    innerPopover.dataset['testOpenPopover'] = 'true';
    outerPopover.append(innerPopover);
    document.body.append(outerPopover);
    const nativeMatches = HTMLElement.prototype.matches;
    const matchesSpy = spyOn(HTMLElement.prototype, 'matches').mockImplementation(function (
      this: HTMLElement,
      selector: string,
    ) {
      return selector === ':popover-open'
        ? this.dataset['testOpenPopover'] === 'true'
        : nativeMatches.call(this, selector);
    });

    try {
      render(SpeedDialFixture, { target: innerPopover });
      await fireEvent.click(screen.getByRole('button', { name: 'Quick actions' }));
      await flushQueuedFocus();

      const toolbar = screen.getByRole('toolbar', { name: 'Actions' });
      expect(toolbar.parentElement?.parentElement).toBe(innerPopover);
    } finally {
      matchesSpy.mockRestore();
    }
  });

  test('portaled action events bubble through the original component ancestry', async () => {
    const { container } = render(SpeedDialFixture);
    const bubbledEventTypes: string[] = [];
    const bubbledTargets: EventTarget[] = [];
    const recordEvent = (event: Event) => {
      bubbledEventTypes.push(event.type);
      if (event.target) bubbledTargets.push(event.target);
    };
    container.addEventListener('click', recordEvent);
    container.addEventListener('keydown', recordEvent);

    await fireEvent.click(screen.getByRole('button', { name: 'Quick actions' }));
    await flushQueuedFocus();
    bubbledEventTypes.length = 0;
    bubbledTargets.length = 0;

    const action = screen.getByRole('button', { name: 'Create' });
    await fireEvent.keyDown(action, { key: 'a' });
    await fireEvent.click(action);

    expect(bubbledEventTypes).toEqual(['keydown', 'click']);
    expect(bubbledTargets).toHaveLength(2);
    expect(bubbledTargets[0]).toBe(action);
    expect(bubbledTargets[1]).toBe(action);
  });

  test('an unavailable source ancestor closes and disables portaled actions', async () => {
    const outside = document.createElement('button');
    document.body.prepend(outside);
    const { container } = render(SpeedDialFixture);
    const trigger = screen.getByRole('button', { name: 'Quick actions' });
    await fireEvent.click(trigger);
    await flushQueuedFocus();

    const action = screen.getByRole('button', { name: 'Create' });
    action.focus();
    expect(document.activeElement).toBe(action);

    outside.focus();
    container.setAttribute('inert', '');

    await waitFor(() => {
      expect(screen.getByTestId('open-state').textContent).toBe('closed');
    });
    await flushQueuedFocus();

    const toolbar = screen.getByRole('toolbar', { hidden: true });
    expect(toolbar.hasAttribute('inert')).toBe(true);
    expect(container.contains(toolbar)).toBe(true);
    expect(document.activeElement).toBe(outside);
  });

  test('unavailable source close can reopen without stealing new action focus', async () => {
    const { container } = render(SpeedDialFixture);
    const trigger = screen.getByRole('button', { name: 'Quick actions' });
    await fireEvent.click(trigger);
    await flushQueuedFocus();

    const create = screen.getByRole('button', { name: 'Create' });
    create.focus();
    expect(document.activeElement).toBe(create);

    container.setAttribute('inert', '');
    await waitFor(() => {
      expect(screen.getByTestId('open-state').textContent).toBe('closed');
    });

    container.removeAttribute('inert');
    await fireEvent.click(trigger);
    await waitFor(() => {
      expect(screen.getByTestId('open-state').textContent).toBe('open');
    });
    await flushQueuedFocus();

    const share = screen.getByRole('button', { name: 'Share', hidden: true });
    share.focus();
    expect(document.activeElement).toBe(share);

    await flushQueuedFocus();
    expect(document.activeElement).toBe(share);
  });

  test('aria-hidden source close does not steal focus into the unavailable subtree', async () => {
    const outside = document.createElement('button');
    document.body.prepend(outside);
    const { container } = render(SpeedDialFixture);
    const trigger = screen.getByRole('button', { name: 'Quick actions' });

    await fireEvent.click(trigger);
    await flushQueuedFocus();
    outside.focus();
    container.setAttribute('aria-hidden', 'true');

    await waitFor(() => {
      expect(screen.getByTestId('open-state').textContent).toBe('closed');
    });
    await flushQueuedFocus();

    expect(document.activeElement).toBe(outside);
  });

  test('a disabled owning fieldset closes and disables portaled actions', async () => {
    const outside = document.createElement('button');
    document.body.prepend(outside);
    const fieldset = document.createElement('fieldset');
    document.body.append(fieldset);
    const { container } = render(SpeedDialFixture, { target: fieldset });
    const create = screen.getByRole('button', { name: 'Create' });

    await fireEvent.click(screen.getByRole('button', { name: 'Quick actions' }));
    await flushQueuedFocus();
    create.focus();
    expect(document.activeElement).toBe(create);

    outside.focus();
    fieldset.setAttribute('disabled', '');

    await waitFor(() => {
      expect(screen.getByTestId('open-state').textContent).toBe('closed');
    });
    const toolbar = screen.getByRole('toolbar', { hidden: true });
    expect(toolbar.hasAttribute('inert')).toBe(true);
    expect(container.contains(toolbar)).toBe(true);
    expect(document.activeElement).toBe(outside);
  });

  test('changing direction while open preserves the focused action', async () => {
    const view = render(SpeedDialFixture, { props: { direction: 'up' } });
    const trigger = screen.getByRole('button', { name: 'Quick actions' });

    await fireEvent.click(trigger);
    await flushQueuedFocus();
    const share = screen.getByRole('button', { name: 'Share' });
    const focusSpy = spyOn(HTMLElement.prototype, 'focus');
    share.focus();
    focusSpy.mockClear();

    try {
      await view.rerender({ direction: 'left', open: true });
      const toolbar = screen.getByRole('toolbar', { name: 'Actions' });
      expect(toolbar.getAttribute('data-cinder-direction')).toBe('up');
      expect(toolbar.hasAttribute('inert')).toBe(false);
      expect(toolbar.hasAttribute('aria-hidden')).toBe(false);
      expect(document.activeElement).toBe(share);

      await flushQueuedFocus();
      expect(focusSpy).not.toHaveBeenCalled();
      expect(document.activeElement).toBe(share);
    } finally {
      focusSpy.mockRestore();
    }
  });

  test('direction controls data attributes and toolbar orientation', () => {
    const { container } = render(SpeedDialFixture, { props: { direction: 'left' } });
    const root = container.querySelector('.cinder-speed-dial');
    const toolbar = screen.getByRole('toolbar', { name: 'Actions' });
    expect(root?.getAttribute('data-cinder-direction')).toBe('left');
    expect(toolbar.getAttribute('aria-orientation')).toBe('horizontal');
  });

  test('action activation calls the handler and closes the dial', async () => {
    const onAction = mock(() => {});
    render(SpeedDialFixture, { props: { onAction } });
    const trigger = screen.getByRole('button', { name: 'Quick actions' });

    await fireEvent.click(trigger);
    await flushQueuedFocus();
    await fireEvent.click(screen.getByRole('button', { name: 'Create' }));

    expect(onAction).toHaveBeenCalledWith('create');
    expect(screen.getByTestId('open-state').textContent).toBe('closed');
  });

  test('keyboard navigation skips disabled actions', async () => {
    render(SpeedDialFixture);
    const trigger = screen.getByRole('button', { name: 'Quick actions' });

    await fireEvent.click(trigger);
    await flushQueuedFocus();
    const create = screen.getByRole('button', { name: 'Create' });
    const share = screen.getByRole('button', { name: 'Share' });

    expect(document.activeElement).toBe(create);
    await fireEvent.keyDown(create, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(share);
  });

  test('up direction keyboard navigation follows the visual stack', async () => {
    render(SpeedDialFixture, { props: { archiveDisabled: false } });
    const trigger = screen.getByRole('button', { name: 'Quick actions' });

    await fireEvent.click(trigger);
    await flushQueuedFocus();
    const create = screen.getByRole('button', { name: 'Create' });
    const archive = screen.getByRole('button', { name: 'Archive' });

    expect(document.activeElement).toBe(create);
    await fireEvent.keyDown(create, { key: 'ArrowUp' });
    expect(document.activeElement).toBe(archive);

    await fireEvent.keyDown(archive, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(create);
  });

  test('left direction keyboard navigation follows the visual row', async () => {
    render(SpeedDialFixture, { props: { archiveDisabled: false, direction: 'left' } });
    const trigger = screen.getByRole('button', { name: 'Quick actions' });

    await fireEvent.click(trigger);
    await flushQueuedFocus();
    const create = screen.getByRole('button', { name: 'Create' });
    const archive = screen.getByRole('button', { name: 'Archive' });

    expect(document.activeElement).toBe(create);
    await fireEvent.keyDown(create, { key: 'ArrowLeft' });
    expect(document.activeElement).toBe(archive);

    await fireEvent.keyDown(archive, { key: 'ArrowRight' });
    expect(document.activeElement).toBe(create);
  });

  test('Tab from the final enabled portaled action moves to the trigger', async () => {
    render(SpeedDialFixture);
    const trigger = screen.getByRole('button', { name: 'Quick actions' });

    await fireEvent.click(trigger);
    await flushQueuedFocus();
    const share = screen.getByRole('button', { name: 'Share' });

    share.focus();
    await fireEvent.keyDown(share, { key: 'Tab' });
    expect(document.activeElement).toBe(trigger);
  });

  test('reverse Tab from the first portaled action returns before the SpeedDial', async () => {
    const precedingButton = document.createElement('button');
    precedingButton.setAttribute('tabindex', '0');
    precedingButton.textContent = 'Before SpeedDial';
    document.body.append(precedingButton);
    render(SpeedDialFixture);
    const trigger = screen.getByRole('button', { name: 'Quick actions' });

    await fireEvent.click(trigger);
    await flushQueuedFocus();
    const create = screen.getByRole('button', { name: 'Create' });

    create.focus();
    await fireEvent.keyDown(create, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(precedingButton);
  });

  test('reverse Tab returns to a native summary without an explicit tabindex', async () => {
    const details = document.createElement('details');
    const summary = document.createElement('summary');
    summary.textContent = 'Before SpeedDial';
    details.append(summary);
    document.body.append(details);
    render(SpeedDialFixture);
    const trigger = screen.getByRole('button', { name: 'Quick actions' });

    await fireEvent.click(trigger);
    await flushQueuedFocus();
    const create = screen.getByRole('button', { name: 'Create' });

    create.focus();
    await fireEvent.keyDown(create, { key: 'Tab', shiftKey: true });
    expect(summary.hasAttribute('tabindex')).toBe(false);
    expect(document.activeElement).toBe(summary);
  });

  test('reverse Tab finds a preceding sibling inside the same shadow root', async () => {
    // A document-only query cannot see into a shadow root, so a SpeedDial
    // rendered inside one previously fell straight through to the trigger
    // instead of a focusable sibling that shares its shadow root.
    const host = document.createElement('div');
    const shadow = host.attachShadow({ mode: 'open' });
    document.body.append(host);
    const precedingButton = document.createElement('button');
    precedingButton.textContent = 'Before SpeedDial';
    precedingButton.setAttribute('tabindex', '0');
    shadow.append(precedingButton);
    const mountPoint = document.createElement('div');
    shadow.append(mountPoint);

    render(SpeedDialFixture, { target: mountPoint });
    const trigger = shadow.querySelector<HTMLButtonElement>('[aria-label="Quick actions"]')!;

    await fireEvent.click(trigger);
    await flushQueuedFocus();
    const create = shadow.querySelector<HTMLButtonElement>('[aria-label="Create"]')!;

    create.focus();
    await fireEvent.keyDown(create, { key: 'Tab', shiftKey: true });
    // Focus lives inside an open shadow root, so the outer `document.
    // activeElement` only reports the shadow host — read the real focus
    // target via the shadow root's own `activeElement`.
    expect(shadow.activeElement).toBe(precedingButton);
  });

  test('reverse Tab from an untabbable first action still returns before the SpeedDial', async () => {
    // A consumer can forward `tabindex="-1"` to a SpeedDialAction to keep it
    // out of sequential Tab order while remaining reachable by arrow keys.
    // The Tab boundary must be the first SEQUENTIALLY TABBABLE action, not
    // the raw first enabled action, or reverse Tab from it escapes to
    // whatever the portal target happens to precede in the DOM instead of
    // back before the SpeedDial.
    const precedingButton = document.createElement('button');
    precedingButton.textContent = 'Before SpeedDial';
    precedingButton.setAttribute('tabindex', '0');
    document.body.append(precedingButton);
    render(SpeedDialFixture);
    const trigger = screen.getByRole('button', { name: 'Quick actions' });

    await fireEvent.click(trigger);
    await flushQueuedFocus();
    const create = screen.getByRole('button', { name: 'Create' });
    create.setAttribute('tabindex', '-1x');
    const share = screen.getByRole('button', { name: 'Share' });

    share.focus();
    await fireEvent.keyDown(share, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(precedingButton);
  });

  test('reverse Tab from an arrow-focused untabbable first action returns before the SpeedDial', async () => {
    const precedingButton = document.createElement('button');
    precedingButton.textContent = 'Before SpeedDial';
    precedingButton.setAttribute('tabindex', '0');
    document.body.append(precedingButton);
    render(SpeedDialFixture);
    const trigger = screen.getByRole('button', { name: 'Quick actions' });

    await fireEvent.click(trigger);
    await flushQueuedFocus();
    const create = screen.getByRole('button', { name: 'Create' });
    create.setAttribute('tabindex', '-1');
    create.focus();
    await fireEvent.keyDown(create, { key: 'Tab', shiftKey: true });

    expect(document.activeElement).toBe(precedingButton);
  });

  test('forward Tab from an arrow-focused untabbable last action moves to the trigger', async () => {
    render(SpeedDialFixture);
    const trigger = screen.getByRole('button', { name: 'Quick actions' });

    await fireEvent.click(trigger);
    await flushQueuedFocus();
    const share = screen.getByRole('button', { name: 'Share' });
    share.setAttribute('tabindex', '-1');
    share.focus();
    await fireEvent.keyDown(share, { key: 'Tab' });

    expect(document.activeElement).toBe(trigger);
  });

  test('reverse Tab from the open trigger moves to the last sequential action', async () => {
    render(SpeedDialFixture);
    const trigger = screen.getByRole('button', { name: 'Quick actions' });

    await fireEvent.click(trigger);
    await flushQueuedFocus();
    trigger.focus();
    await fireEvent.keyDown(trigger, { key: 'Tab', shiftKey: true });

    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Share' }));
  });

  test('reverse Tab from the open trigger uses retained positioning while placement recomputes', async () => {
    const { rerender } = render(SpeedDialFixture, { props: { direction: 'up' } });
    const trigger = screen.getByRole('button', { name: 'Quick actions' });

    await fireEvent.click(trigger);
    await flushQueuedFocus();
    const toolbar = screen.getByRole('toolbar', { name: 'Actions' });
    const share = screen.getByRole('button', { name: 'Share' });

    expect(toolbar.getAttribute('data-cinder-position-ready')).toBe('true');
    await rerender({ direction: 'left' });
    trigger.focus();
    const event = new KeyboardEvent('keydown', {
      key: 'Tab',
      shiftKey: true,
      bubbles: true,
      cancelable: true,
    });
    trigger.dispatchEvent(event);

    expect(document.activeElement).toBe(share);
    expect(event.defaultPrevented).toBe(true);
  });

  test('leaves reverse Tab native when every action is untabbable', async () => {
    const precedingButton = document.createElement('button');
    precedingButton.textContent = 'Before SpeedDial';
    precedingButton.setAttribute('tabindex', '0');
    document.body.append(precedingButton);
    render(SpeedDialFixture);
    const trigger = screen.getByRole('button', { name: 'Quick actions' });

    await fireEvent.click(trigger);
    await flushQueuedFocus();
    for (const action of screen.getAllByRole('button').filter((button) => button !== trigger)) {
      action.setAttribute('tabindex', '-1');
    }
    trigger.focus();
    const event = new KeyboardEvent('keydown', {
      key: 'Tab',
      shiftKey: true,
      bubbles: true,
      cancelable: true,
    });
    trigger.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(false);
    expect(document.activeElement).toBe(trigger);
  });

  test('leaves reverse Tab native while the portaled toolbar is inert', async () => {
    render(SpeedDialFixture, { props: { open: true } });
    const trigger = screen.getByRole('button', { name: 'Quick actions' });
    const toolbar = document.querySelector<HTMLElement>('[role="toolbar"]')!;
    trigger.focus();
    const event = new KeyboardEvent('keydown', {
      key: 'Tab',
      shiftKey: true,
      bubbles: true,
      cancelable: true,
    });
    trigger.dispatchEvent(event);

    expect(toolbar.hasAttribute('inert')).toBe(true);
    expect(event.defaultPrevented).toBe(false);
    expect(document.activeElement).toBe(trigger);
  });

  test('uses the toolbar DOM order after actions are reordered', async () => {
    render(SpeedDialFixture);
    const trigger = screen.getByRole('button', { name: 'Quick actions' });

    await fireEvent.click(trigger);
    await flushQueuedFocus();
    const toolbar = screen.getByRole('toolbar', { name: 'Actions' });
    const create = screen.getByRole('button', { name: 'Create' });
    toolbar.append(create.closest('.cinder-speed-dial-action')!);
    trigger.focus();
    await fireEvent.keyDown(trigger, { key: 'Tab', shiftKey: true });

    expect(document.activeElement).toBe(create);
  });

  test('evaluates rendered action candidates once per keydown', async () => {
    render(SpeedDialFixture);
    const trigger = screen.getByRole('button', { name: 'Quick actions' });

    await fireEvent.click(trigger);
    await flushQueuedFocus();
    const create = screen.getByRole('button', { name: 'Create' });
    const getComputedStyleSpy = spyOn(globalThis, 'getComputedStyle');
    getComputedStyleSpy.mockClear();
    await fireEvent.keyDown(create, { key: 'ArrowDown' });

    expect(getComputedStyleSpy).toHaveBeenCalledTimes(12);
    getComputedStyleSpy.mockRestore();
  });

  test('skips CSS-hidden controls when reversing from the first action', async () => {
    const hiddenButton = document.createElement('button');
    hiddenButton.style.display = 'none';
    document.body.append(hiddenButton);
    const precedingButton = document.createElement('button');
    document.body.append(precedingButton);
    render(SpeedDialFixture);
    const trigger = screen.getByRole('button', { name: 'Quick actions' });

    await fireEvent.click(trigger);
    await flushQueuedFocus();
    const create = screen.getByRole('button', { name: 'Create' });
    create.focus();
    await fireEvent.keyDown(create, { key: 'Tab', shiftKey: true });

    expect(document.activeElement).toBe(precedingButton);
  });

  test('keyboard order follows resolved placement and spacing uses CSS layout', () => {
    expect(speedDialSource).toMatch(
      /getKeyboardNavigationButtons[\s\S]*?resolvedDirection === 'up' \|\| resolvedDirection === 'left'/,
    );
    expect(speedDialSource).toContain("if (side === 'top') return 'up';");
    expect(speedDialSource).toContain("if (side === 'bottom') return 'down';");
    expect(speedDialSource).toContain('bind:this={spacingProbeElement}');
    expect(speedDialSource).toContain('class="cinder-speed-dial__spacing-probe"');
    expect(speedDialSource).toContain('spacingProbeElement?.getBoundingClientRect().width');
    expect(speedDialSource).toContain('pixels >= 0');
    expect(speedDialSource).toContain('cinder-_floating-surface cinder-speed-dial__actions');
    expect(speedDialSource).toContain('new ResizeObserver(() => spacingVersion++)');
    expect(speedDialSource).toContain(
      "classNames('cinder-speed-dial__portal-scope', 'cinder-speed-dial', customClassName)",
    );
  });

  test('unpositioned close settles the retained exit scope immediately', () => {
    expect(speedDialSource).toMatch(
      /if \(retainedPositionStyle\.length === 0\) \{\s+actionsScopeActive = false;\s+retainedDirection = null;\s+return;\s+\}/,
    );
  });

  test('Escape closes the dial and restores focus to the trigger', async () => {
    render(SpeedDialFixture);
    const trigger = screen.getByRole('button', { name: 'Quick actions' });

    await fireEvent.click(trigger);
    await flushQueuedFocus();
    const create = screen.getByRole('button', { name: 'Create' });
    await fireEvent.keyDown(create, { key: 'Escape' });
    await flushQueuedFocus();

    expect(screen.getByTestId('open-state').textContent).toBe('closed');
    expect(document.activeElement).toBe(trigger);
  });

  test('outside click dismisses an open dial and restores focus when an action is active', async () => {
    const { container } = render(SpeedDialFixture);
    const trigger = screen.getByRole('button', { name: 'Quick actions' });

    await fireEvent.click(trigger);
    await flushQueuedFocus();
    expect(screen.getByTestId('open-state').textContent).toBe('open');
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Create' }));

    await fireEvent.click(document.body);
    await flushQueuedFocus();
    expect(screen.getByTestId('open-state').textContent).toBe('closed');
    expect(container.querySelector('.cinder-speed-dial')?.hasAttribute('data-cinder-open')).toBe(
      false,
    );
    expect(document.activeElement).toBe(trigger);
  });

  test('hidden prop makes the root inert and the trigger unfocusable', () => {
    const { container } = render(SpeedDialFixture, { props: { hidden: true } });
    const group = container.querySelector('.cinder-speed-dial') as HTMLElement;
    const trigger = screen.getByRole('button', { name: 'Quick actions', hidden: true });

    expect(group.hasAttribute('hidden')).toBe(true);
    expect(group.getAttribute('aria-hidden')).toBe('true');
    expect(group.hasAttribute('inert')).toBe(true);
    expect(trigger.hasAttribute('disabled')).toBe(true);
    expect(trigger.getAttribute('tabindex')).toBe('-1');
  });

  test('namespace export exposes SpeedDial.Action while flat export remains importable', async () => {
    const [{ default: SpeedDial, SpeedDial: NamedSpeedDial }, { default: SpeedDialAction }] =
      await Promise.all([import('./index.ts'), import('../speed-dial-action/index.ts')]);

    expect(SpeedDial).toBe(NamedSpeedDial);
    expect(SpeedDial.Action).toBe(SpeedDialAction);
  });

  test('index import is SSR-safe', async () => {
    const module = await import('./index.ts');
    expect(typeof module.default).toBe('function');
    expect(typeof module.default.Action).toBe('function');
  });

  test('defines a runtime accessible label fallback for generated previews', async () => {
    const source = await Bun.file(new URL('./speed-dial.svelte', import.meta.url)).text();
    expect(source).toContain("const defaultAriaLabel = 'Quick actions'");
    expect(source).toContain("'aria-label': ariaLabel = defaultAriaLabel");
  });
});

describe('getFocusTargetBeforeSpeedDial', () => {
  test('threads the focused action tab tier into the preceding-candidate lookup', () => {
    // The SpeedDial root is a zero/default-tier DOM anchor. Without a
    // separate tier reference, a positive-tabindex first action would
    // incorrectly fall through to the last zero/default-tier preceding
    // candidate instead of the nearest lower-or-equal positive-tabindex one
    // native Shift+Tab actually visits next.
    const wrapper = document.createElement('div');
    const lower = document.createElement('button');
    lower.setAttribute('tabindex', '1');
    lower.textContent = 'Lower positive';
    const higher = document.createElement('button');
    higher.setAttribute('tabindex', '3');
    higher.textContent = 'Higher positive';
    const normal = document.createElement('button');
    normal.textContent = 'Normal';
    const rootElement = document.createElement('div');
    wrapper.append(lower, higher, normal, rootElement);
    document.body.append(wrapper);

    const focusedAction = document.createElement('button');
    focusedAction.setAttribute('tabindex', '2');

    const result = getFocusTargetBeforeSpeedDial({
      rootElement: rootElement as unknown as HTMLDivElement,
      actionsElement: null,
      focusedAction,
    });

    expect(result).toBe(lower);
  });

  test('falls back to the last preceding candidate when the focused action is not positive', () => {
    const wrapper = document.createElement('div');
    const lower = document.createElement('button');
    lower.setAttribute('tabindex', '1');
    const normal = document.createElement('button');
    const rootElement = document.createElement('div');
    wrapper.append(lower, normal, rootElement);
    document.body.append(wrapper);

    const result = getFocusTargetBeforeSpeedDial({
      rootElement: rootElement as unknown as HTMLDivElement,
      actionsElement: null,
      focusedAction: null,
    });

    expect(result).toBe(normal);
  });

  test('excludes an internal shadow-root descendant of the actions region from preceding candidates', () => {
    // `Element.contains()` only walks the light DOM, so a focusable control
    // inside the *open* shadow root of a custom element nested inside the
    // actions region previously read as "not contained" and got offered as
    // a preceding page control, even though it is still part of the
    // SpeedDial's own composed subtree. This exercises the `actionsElement`
    // half of the fix; the `rootElement` half is defensive -- no descendant
    // of `rootElement` can ever appear in a `direction: 'before'` search
    // anchored at `rootElement` itself, since the composed-tree walk always
    // visits a parent before its children (see the analogous
    // navigation-bar-focus.test.ts coverage for `findFocusTargetAfterNavigationItems`,
    // "excludes an internal shadow-root descendant that still belongs to
    // the navigation bar").
    const wrapper = document.createElement('div');
    const precedingButton = document.createElement('button');
    precedingButton.textContent = 'Before SpeedDial';
    const actionsElement = document.createElement('div');
    const internalHost = document.createElement('div');
    const internalShadow = internalHost.attachShadow({ mode: 'open' });
    const internalControl = document.createElement('button');
    internalControl.textContent = 'Internal shadow control';
    internalShadow.append(internalControl);
    actionsElement.append(internalHost);
    const rootElement = document.createElement('div');
    wrapper.append(precedingButton, actionsElement, rootElement);
    document.body.append(wrapper);

    const result = getFocusTargetBeforeSpeedDial({
      rootElement: rootElement as unknown as HTMLDivElement,
      actionsElement: actionsElement as unknown as HTMLDivElement,
    });

    expect(result).toBe(precedingButton);
  });
});
