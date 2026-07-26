/// <reference lib="dom" />
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test } from 'bun:test';

import { setupHappyDom } from '../../test/happy-dom.ts';

setupHappyDom();

const { cleanup, render, waitFor } = await import('@testing-library/svelte');
const { default: EventTimeline } = await import('./event-timeline.svelte');
const { setEventTimelineModalPredicate: __setEventTimelineModalPredicate } =
  await import('./event-timeline-modal.ts');
const { fireEvent } = await import('@testing-library/svelte');
const { tick } = await import('svelte');

const EVENT_TIMELINE_CSS = readFileSync(join(import.meta.dir, 'event-timeline.css'), 'utf8');
const EVENT_TIMELINE_SOURCE = readFileSync(join(import.meta.dir, 'event-timeline.svelte'), 'utf8');
const EVENT_TIMELINE_MODAL_SOURCE = readFileSync(
  join(import.meta.dir, 'event-timeline-modal.ts'),
  'utf8',
);

class TestResizeObserver implements ResizeObserver {
  static instances: TestResizeObserver[] = [];
  readonly callback: ResizeObserverCallback;
  observed: Element | undefined;

  constructor(callback: ResizeObserverCallback) {
    this.callback = callback;
    TestResizeObserver.instances.push(this);
  }

  observe(target: Element): void {
    this.observed = target;
  }

  unobserve(): void {}

  disconnect(): void {}

  trigger(width: number): void {
    this.callback(
      [
        {
          borderBoxSize: [{ inlineSize: width }],
          contentRect: { width },
          target: this.observed,
        } as unknown as ResizeObserverEntry,
      ],
      this as unknown as ResizeObserver,
    );
  }
}

const originalResizeObserver = globalThis.ResizeObserver;

beforeAll(() => {
  Object.defineProperty(globalThis, 'ResizeObserver', {
    configurable: true,
    value: TestResizeObserver,
    writable: true,
  });
});

beforeEach(() => {
  TestResizeObserver.instances = [];
});

afterEach(() => {
  cleanup();
});

afterAll(() => {
  Object.defineProperty(globalThis, 'ResizeObserver', {
    configurable: true,
    value: originalResizeObserver,
    writable: true,
  });
});

describe('EventTimeline', () => {
  const start = '2026-07-03T00:00:00.000Z';
  const end = '2026-07-04T00:00:00.000Z';

  test('renders events as a named list with proportional positions', () => {
    const { container } = render(EventTimeline, {
      start,
      end,
      now: '2026-07-03T12:00:00.000Z',
      label: 'Next fires',
      items: [
        { at: '2026-07-03T06:00:00.000Z', label: 'Morning', sublabel: '06:00', state: 'done' },
        { at: '2026-07-03T18:00:00.000Z', label: 'Evening', sublabel: '18:00' },
      ],
    });

    const el = container.querySelector('[role="list"]');
    expect(el?.getAttribute('aria-label')).toBe('Next fires');
    expect(el?.textContent).toContain('Morning');
    expect(el?.textContent).toContain('Evening');
    expect(
      [...(el?.children ?? [])].every((child) => child.getAttribute('role') === 'listitem'),
    ).toBe(true);

    const items = [...container.querySelectorAll('[role="listitem"]')];
    expect(items).toHaveLength(2);
    expect(items[0]?.getAttribute('style')).toContain('left: 25%');
    expect(items[0]?.getAttribute('data-cinder-state')).toBe('done');
    expect(items[0]?.getAttribute('aria-label')).toBe('Morning, 06:00, Done');
    expect(items[1]?.getAttribute('style')).toContain('left: 75%');
    expect(items[1]?.getAttribute('data-cinder-state')).toBe('upcoming');
    expect(container.querySelector('.cinder-event-timeline__now')?.getAttribute('style')).toContain(
      'left: 50%',
    );
  });

  test('assigns later lanes to overlapping labels', () => {
    const { container } = render(EventTimeline, {
      start,
      end,
      items: [
        { at: '2026-07-03T06:00:00.000Z', label: 'A' },
        { at: '2026-07-03T06:30:00.000Z', label: 'B' },
        { at: '2026-07-03T07:00:00.000Z', label: 'C', state: 'failed' },
      ],
    });

    const items = [...container.querySelectorAll('[role="listitem"]')];
    expect(items.map((item) => item.getAttribute('data-cinder-lane'))).toEqual(['0', '1', '2']);
    expect(items[2]?.getAttribute('data-cinder-state')).toBe('failed');
  });

  test('uses a narrow-screen-safe fallback before width measurement', () => {
    const { container } = render(EventTimeline, {
      start,
      end,
      items: [20, 32, 44, 56, 68].map((position, index) => ({
        at: new Date(Date.parse(start) + (position / 100) * (Date.parse(end) - Date.parse(start))),
        label: `Fallback ${index}`,
      })),
    });

    expect(container.querySelector('.cinder-event-timeline__cluster-trigger')).not.toBeNull();
  });

  test('uses the measured pixel width to determine label collisions', async () => {
    const { container } = render(EventTimeline, {
      start,
      end,
      items: [
        { at: '2026-07-03T06:00:00.000Z', label: 'A' },
        { at: '2026-07-03T10:48:00.000Z', label: 'B' },
      ],
    });

    await tick();
    const observer = TestResizeObserver.instances[0];
    observer?.trigger(400);
    await tick();
    expect(
      [...container.querySelectorAll('[role="listitem"]')].map((item) =>
        item.getAttribute('data-cinder-lane'),
      ),
    ).toEqual(['0', '1']);

    observer?.trigger(1200);
    await tick();
    expect(
      [...container.querySelectorAll('[role="listitem"]')].map((item) =>
        item.getAttribute('data-cinder-lane'),
      ),
    ).toEqual(['0', '0']);
  });

  test('accounts for transformed labels when reusing lanes across edge boundaries', async () => {
    const { container } = render(EventTimeline, {
      start,
      end,
      items: [
        { at: '2026-07-03T02:24:00.000Z', label: 'Edge event' },
        { at: '2026-07-03T05:16:48.000Z', label: 'Middle event' },
      ],
    });

    await tick();
    TestResizeObserver.instances[0]?.trigger(1200);
    await tick();
    expect(
      [...container.querySelectorAll('[role="listitem"]')].map((item) =>
        item.getAttribute('data-cinder-lane'),
      ),
    ).toEqual(['0', '1']);
  });

  test('moves near-edge labels to edge alignment before their offset can overflow', async () => {
    const { container } = render(EventTimeline, {
      start,
      end,
      items: [{ at: '2026-07-03T02:38:24.000Z', label: 'Near start' }],
    });

    await tick();
    TestResizeObserver.instances[0]?.trigger(1200);
    await tick();
    expect(container.querySelector('[role="listitem"]')?.getAttribute('data-cinder-edge')).toBe(
      'start',
    );
  });

  test('keeps centered labels centered when narrow timelines overlap edge zones', async () => {
    const { container } = render(EventTimeline, {
      start,
      end,
      items: [{ at: '2026-07-03T12:00:00.000Z', label: 'Centered event' }],
    });

    await tick();
    TestResizeObserver.instances[0]?.trigger(200);
    await tick();
    expect(container.querySelector('[role="listitem"]')?.getAttribute('data-cinder-edge')).toBe(
      'middle',
    );
    expect(EVENT_TIMELINE_CSS).toContain('[data-cinder-centered] .cinder-event-timeline__leader');
    expect(EVENT_TIMELINE_CSS).toContain(
      ':dir(rtl) .cinder-event-timeline__item[data-cinder-centered]',
    );
  });

  test('keeps centered fallback bounds out of parity-offset lanes', async () => {
    const { container } = render(EventTimeline, {
      start,
      end,
      items: [
        { at: '2026-07-03T09:36:00.000Z', label: 'Centered fallback with a long label' },
        { at: '2026-07-03T20:24:00.000Z', label: 'Edge label with a long label' },
      ],
    });

    await tick();
    TestResizeObserver.instances[0]?.trigger(280);
    await tick();
    const items = [...container.querySelectorAll('[role="listitem"]')];
    expect(items[0]?.getAttribute('data-cinder-centered')).toBe('');
    expect(items.map((item) => item.getAttribute('data-cinder-lane'))).toEqual(['0', '1']);
  });

  test('uses the occupied lane count while retaining the CSS minimum height', () => {
    const { container } = render(EventTimeline, {
      start,
      end,
      items: [{ at: '2026-07-03T12:00:00.000Z', label: 'Single event' }],
    });

    expect(container.querySelector('[role="list"]')?.getAttribute('style')).toContain(
      '--_cinder-event-timeline-lane-count: 1',
    );
    expect(EVENT_TIMELINE_CSS).toContain('block-size: max(');
  });

  test('reserves lanes for physical RTL bounds', async () => {
    const { container } = render(EventTimeline, {
      start,
      end,
      dir: 'rtl',
      items: [
        { at: '2026-07-03T19:12:00.000Z', label: 'RTL first' },
        { at: '2026-07-03T21:36:00.000Z', label: 'RTL second' },
      ],
    });

    await tick();
    TestResizeObserver.instances[0]?.trigger(1200);
    await tick();
    expect(
      [...container.querySelectorAll('[role="listitem"]')].map((item) =>
        item.getAttribute('data-cinder-lane'),
      ),
    ).toEqual(['0', '1']);
  });

  test('keeps adjacent dense parity lanes separated and raises open clusters', () => {
    expect(EVENT_TIMELINE_CSS).toContain('.cinder-event-timeline__cluster[data-cinder-open]');
    expect(EVENT_TIMELINE_CSS).toContain('z-index: 2;');
    expect(EVENT_TIMELINE_CSS).toContain('.cinder-event-timeline:dir(rtl)');
    expect(EVENT_TIMELINE_SOURCE).toContain('createPortalAttachment');
  });

  test('inspects containing-block ancestors and only observes direction ancestors', () => {
    expect(EVENT_TIMELINE_MODAL_SOURCE).toContain('current = current.parentElement');
    expect(EVENT_TIMELINE_MODAL_SOURCE).toContain("attributeFilter: ['class', 'dir', 'style']");
    expect(EVENT_TIMELINE_MODAL_SOURCE).not.toContain('subtree: true');
  });

  test('offsets colliding lanes and renders hidden leader lines', () => {
    const { container } = render(EventTimeline, {
      start,
      end,
      items: [
        { at: '2026-07-03T06:00:00.000Z', label: 'A' },
        { at: '2026-07-03T06:15:00.000Z', label: 'B' },
      ],
    });

    const items = [...container.querySelectorAll('[role="listitem"]')];
    expect(items[0]?.getAttribute('data-cinder-lane-parity')).toBe('even');
    expect(items[1]?.getAttribute('data-cinder-lane-parity')).toBe('odd');
    expect(container.querySelectorAll('.cinder-event-timeline__leader')).toHaveLength(2);
    expect(
      [...container.querySelectorAll('.cinder-event-timeline__leader')].every(
        (leader) => leader.getAttribute('aria-hidden') === 'true',
      ),
    ).toBe(true);
  });

  test('collapses excess lanes into an accessible cluster button', async () => {
    const { container } = render(EventTimeline, {
      start,
      end,
      items: [0, 1, 2, 3, 4].map((index) => ({
        at: `2026-07-03T06:0${index}:00.000Z`,
        label: `Event ${index + 1}`,
      })),
    });

    const cluster = container.querySelector<HTMLButtonElement>(
      '.cinder-event-timeline__cluster-trigger',
    );
    expect(cluster?.textContent).toBe('+1');
    expect(cluster?.getAttribute('aria-label')).toBe(
      '1 event between 2026-07-03T06:04:00.000Z and 2026-07-03T06:04:00.000Z',
    );
    expect(cluster?.tabIndex).toBe(0);
    expect(cluster?.getAttribute('aria-haspopup')).toBe('dialog');

    cluster?.focus();
    await fireEvent.click(cluster!);
    const dialog = document.querySelector('[role="dialog"]');
    expect(dialog).not.toBeNull();
    expect(cluster?.getAttribute('aria-controls')).toBe(dialog?.id);
    await waitFor(() => expect(document.activeElement).toBe(dialog));
    expect(dialog?.textContent).toContain('Upcoming');
    expect(dialog?.querySelector('time')?.getAttribute('datetime')).toBe(
      '2026-07-03T06:04:00.000Z',
    );
    await fireEvent.keyDown(window, { key: 'Escape' });
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(document.activeElement).toBe(cluster);
  });

  test('keeps cluster surfaces inside a Cinder popover panel', async () => {
    const popover = document.createElement('div');
    popover.className = 'cinder-popover';
    Object.defineProperty(popover, 'getBoundingClientRect', {
      configurable: true,
      value: () => ({ width: 320 }),
    });
    document.body.append(popover);
    try {
      const { container } = render(EventTimeline, {
        start,
        end,
        items: [0, 1, 2, 3, 4].map((index) => ({
          at: `2026-07-03T06:0${index}:00.000Z`,
          label: `Event ${index + 1}`,
        })),
      });
      popover.append(container.firstElementChild!);
      await fireEvent.click(popover.querySelector('.cinder-event-timeline__cluster-trigger')!);
      await waitFor(() =>
        expect(popover.querySelector('[role="dialog"]')?.parentElement).toBe(popover),
      );
      expect(popover.querySelector<HTMLElement>('[role="dialog"]')?.style.maxInlineSize).toContain(
        '304px',
      );
      TestResizeObserver.instances
        .filter((observer) => observer.observed === popover)
        .forEach((observer) => observer.trigger(200));
      await tick();
      expect(popover.querySelector<HTMLElement>('[role="dialog"]')?.style.maxInlineSize).toContain(
        '184px',
      );
    } finally {
      popover.remove();
    }
  });

  test('positions cluster surfaces inside transformed native dialogs', async () => {
    const dialog = document.createElement('dialog');
    const panel = document.createElement('div');
    panel.className = 'cinder-modal__panel';
    dialog.append(panel);
    dialog.open = true;
    document.body.append(dialog);
    __setEventTimelineModalPredicate((element) => element === dialog);
    const original = globalThis.getComputedStyle;
    globalThis.getComputedStyle = ((element: Element) => {
      const style = original(element);
      if (element !== dialog) return style;
      const transformedStyle = Object.create(style) as CSSStyleDeclaration;
      Object.defineProperty(transformedStyle, 'transform', { value: 'none' });
      Object.defineProperty(transformedStyle, 'scale', { value: '0.98' });
      return transformedStyle;
    }) as typeof getComputedStyle;
    try {
      const { container } = render(EventTimeline, {
        start,
        end,
        items: [0, 1, 2, 3, 4].map((index) => ({
          at: `2026-07-03T06:0${index}:00.000Z`,
          label: `Event ${index + 1}`,
        })),
      });
      panel.append(container.firstElementChild!);
      await fireEvent.click(panel.querySelector('.cinder-event-timeline__cluster-trigger')!);
      await waitFor(() => {
        const surface = panel.querySelector<HTMLElement>('[role="dialog"]');
        expect(surface).not.toBeNull();
        expect(surface?.parentElement).toBe(panel);
        expect(surface?.style.position).toBe('absolute');
      });
      await waitFor(() =>
        expect(document.activeElement).toBe(panel.querySelector('[role="dialog"]')),
      );
    } finally {
      __setEventTimelineModalPredicate((element) => element.matches(':modal'));
      globalThis.getComputedStyle = original;
      dialog.remove();
    }
  });

  test('keeps cluster surfaces inside a modal focus-trap panel', async () => {
    const dialog = document.createElement('dialog');
    const panel = document.createElement('div');
    panel.className = 'cinder-modal__panel';
    dialog.append(panel);
    dialog.open = true;
    document.body.append(dialog);
    __setEventTimelineModalPredicate((element) => element === dialog);
    try {
      const { container } = render(EventTimeline, {
        start,
        end,
        items: [0, 1, 2, 3, 4].map((index) => ({
          at: `2026-07-03T06:0${index}:00.000Z`,
          label: `Event ${index + 1}`,
        })),
      });
      panel.append(container.firstElementChild!);
      await fireEvent.click(panel.querySelector('.cinder-event-timeline__cluster-trigger')!);
      await waitFor(() =>
        expect(panel.querySelector('[role="dialog"]')?.parentElement).toBe(panel),
      );
    } finally {
      __setEventTimelineModalPredicate((element) => element.matches(':modal'));
      dialog.remove();
    }
  });

  test('keeps cluster surfaces inside the nearest open native popover owner', async () => {
    const originalCSS = globalThis.CSS;
    Object.defineProperty(globalThis, 'CSS', {
      configurable: true,
      value: { supports: () => true },
    });
    const modalPanel = document.createElement('div');
    modalPanel.className = 'cinder-modal__panel';
    const nativePopover = document.createElement('div');
    nativePopover.setAttribute('popover', 'auto');
    const originalMatches = nativePopover.matches.bind(nativePopover);
    Object.defineProperty(nativePopover, 'matches', {
      configurable: true,
      value: (selector: string) =>
        selector === ':popover-open' ? true : originalMatches(selector),
    });
    modalPanel.append(nativePopover);
    document.body.append(modalPanel);
    try {
      const { container } = render(EventTimeline, {
        start,
        end,
        items: [0, 1, 2, 3, 4].map((index) => ({
          at: `2026-07-03T06:0${index}:00.000Z`,
          label: `Event ${index + 1}`,
        })),
      });
      nativePopover.append(container.firstElementChild!);
      await fireEvent.click(
        nativePopover.querySelector('.cinder-event-timeline__cluster-trigger')!,
      );
      await waitFor(() =>
        expect(nativePopover.querySelector('[role="dialog"]')?.parentElement).toBe(nativePopover),
      );
    } finally {
      modalPanel.remove();
      Object.defineProperty(globalThis, 'CSS', { configurable: true, value: originalCSS });
    }
  });

  test('outside pointer dismissal does not refocus the cluster trigger', async () => {
    const { container } = render(EventTimeline, {
      start,
      end,
      items: [0, 1, 2, 3, 4].map((index) => ({
        at: `2026-07-03T06:0${index}:00.000Z`,
        label: `Event ${index + 1}`,
      })),
    });
    const cluster = container.querySelector<HTMLButtonElement>(
      '.cinder-event-timeline__cluster-trigger',
    );
    cluster?.focus();
    await fireEvent.click(cluster!);
    const outside = document.createElement('button');
    document.body.append(outside);
    outside.focus();
    await fireEvent.pointerDown(outside);
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(document.activeElement).toBe(outside);
  });

  test('does not steal focus after the user tabs away while positioning', async () => {
    const { container } = render(EventTimeline, {
      start,
      end,
      items: [0, 1, 2, 3, 4].map((index) => ({
        at: `2026-07-03T06:0${index}:00.000Z`,
        label: `Event ${index + 1}`,
      })),
    });
    const cluster = container.querySelector<HTMLButtonElement>(
      '.cinder-event-timeline__cluster-trigger',
    );
    const outside = document.createElement('button');
    document.body.append(outside);
    await fireEvent.click(cluster!);
    outside.focus();
    await tick();
    await tick();
    expect(document.activeElement).toBe(outside);
    outside.remove();
  });

  test('creates one cluster marker per separated dense region', async () => {
    const { container } = render(EventTimeline, {
      start,
      end,
      items: [
        ...[0, 1, 2, 3, 4].map((index) => ({
          at: `2026-07-03T06:0${index}:00.000Z`,
          label: `Morning ${index + 1}`,
        })),
        ...[0, 1, 2, 3, 4].map((index) => ({
          at: `2026-07-03T18:0${index}:00.000Z`,
          label: `Evening ${index + 1}`,
        })),
      ],
    });

    await tick();
    TestResizeObserver.instances[0]?.trigger(1200);
    await tick();
    expect(container.querySelectorAll('.cinder-event-timeline__cluster-trigger')).toHaveLength(2);
  });

  test('derives stable cluster identity from its items, not array order', () => {
    expect(EVENT_TIMELINE_SOURCE).not.toContain('cluster-${groupIndex}-');
    expect(EVENT_TIMELINE_SOURCE).toContain('cluster-${startTime}-${endTime}-');
  });

  test('allocates additional lanes for dense clusters without reusing the final lane', () => {
    const { container } = render(EventTimeline, {
      start,
      end,
      items: [
        { at: '2026-07-03T06:00:00.000Z', label: 'A' },
        { at: '2026-07-03T06:15:00.000Z', label: 'B' },
        { at: '2026-07-03T06:30:00.000Z', label: 'C' },
        { at: '2026-07-03T06:45:00.000Z', label: 'D' },
      ],
    });

    const items = [...container.querySelectorAll('[role="listitem"]')];
    expect(items.map((item) => item.getAttribute('data-cinder-lane'))).toEqual([
      '0',
      '1',
      '2',
      '3',
    ]);
    expect(
      container.querySelector('.cinder-event-timeline__items')?.getAttribute('style'),
    ).toContain('--_cinder-event-timeline-lane-count: 4');
  });

  test('clamps out-of-range events to the displayed range', () => {
    const { container } = render(EventTimeline, {
      start,
      end,
      ariaLabel: 'Release schedule',
      size: 'sm',
      items: [{ at: '2026-07-05T00:00:00.000Z', label: 'Late' }],
    });

    const el = container.querySelector('[role="list"]');
    const root = container.querySelector('.cinder-event-timeline');
    const item = container.querySelector('[role="listitem"]');
    expect(el?.getAttribute('aria-label')).toBe('Release schedule');
    expect(root?.getAttribute('data-cinder-size')).toBe('sm');
    expect(item?.getAttribute('style')).toContain('left: 100%');
  });

  test('normalizes empty accessible names and keeps list semantics authoritative', () => {
    const { container } = render(EventTimeline, {
      start,
      end,
      label: '   ',
      ariaLabel: '   ',
      role: 'presentation',
      'aria-label': 'Consumer label',
      items: [{ at: '2026-07-03T06:00:00.000Z', label: 'Morning', sublabel: '06:00' }],
    });

    const el = container.querySelector('[role="list"]');
    expect(el?.getAttribute('aria-label')).toBe('Event timeline');
    expect(container.querySelector('.cinder-event-timeline__label')).toBeNull();
  });

  test('renders trimmed visible labels consistently with the accessible name', () => {
    const { container } = render(EventTimeline, {
      start,
      end,
      label: '  Release window  ',
      items: [{ at: '2026-07-03T06:00:00.000Z', label: 'Morning' }],
    });

    const el = container.querySelector('[role="list"]');
    expect(el?.getAttribute('aria-label')).toBe('Release window');
    expect(container.querySelector('.cinder-event-timeline__label')?.textContent).toBe(
      'Release window',
    );
  });

  test('hides now markers outside the displayed range', () => {
    const { container } = render(EventTimeline, {
      start,
      end,
      now: '2026-07-05T00:00:00.000Z',
      items: [{ at: '2026-07-03T06:00:00.000Z', label: 'Morning' }],
    });

    expect(container.querySelector('.cinder-event-timeline__now')).toBeNull();
  });

  test('uses time for timestamp text and stable keys for repeated events', () => {
    const { container } = render(EventTimeline, {
      start,
      end,
      items: [
        { id: 'deploy', at: '2026-07-03T06:00:00.000Z', label: 'Deploy', sublabel: '06:00' },
        { id: 'deploy', at: '2026-07-03T06:00:00.000Z', label: 'Deploy', sublabel: '06:00' },
      ],
    });

    const labels = [...container.querySelectorAll('.cinder-event-timeline__item-label')];
    const timestamps = [...container.querySelectorAll('time.cinder-event-timeline__item-sublabel')];
    expect(labels).toHaveLength(2);
    expect(timestamps).toHaveLength(2);
    expect(timestamps[0]?.getAttribute('datetime')).toBe('2026-07-03T06:00:00.000Z');
  });

  test('exposes fallback time and state text to assistive technology', () => {
    const { container } = render(EventTimeline, {
      start,
      end,
      items: [{ at: '2026-07-03T06:00:00.000Z', label: 'Deploy', state: 'failed' }],
    });

    const item = container.querySelector('[role="listitem"]');
    expect(item?.getAttribute('aria-label')).toBe('Deploy, 2026-07-03T06:00:00.000Z, Failed');
    expect(container.querySelector('time.cinder-sr-only')?.getAttribute('datetime')).toBe(
      '2026-07-03T06:00:00.000Z',
    );
    expect(container.querySelector('.cinder-sr-only:last-child')?.textContent).toBe('Failed');
  });

  test('trims sublabels before rendering visual time text', () => {
    const { container } = render(EventTimeline, {
      start,
      end,
      items: [
        { at: '2026-07-03T06:00:00.000Z', label: 'Deploy', sublabel: '  06:00  ' },
        { at: '2026-07-03T07:00:00.000Z', label: 'Verify', sublabel: '   ' },
      ],
    });

    const visibleTimes = [
      ...container.querySelectorAll('time.cinder-event-timeline__item-sublabel'),
    ];
    expect(visibleTimes).toHaveLength(1);
    expect(visibleTimes[0]?.textContent).toBe('06:00');
    expect(container.querySelectorAll('time.cinder-sr-only')).toHaveLength(1);
    expect(container.querySelectorAll('[role="listitem"]')[1]?.getAttribute('aria-label')).toBe(
      'Verify, 2026-07-03T07:00:00.000Z, Upcoming',
    );
  });

  test('marks edge events so CSS can align them inward', () => {
    const { container } = render(EventTimeline, {
      start,
      end,
      items: [
        { at: start, label: 'Start' },
        { at: end, label: 'End' },
      ],
    });

    const items = [...container.querySelectorAll('[role="listitem"]')];
    expect(items[0]?.getAttribute('data-cinder-edge')).toBe('start');
    expect(items[1]?.getAttribute('data-cinder-edge')).toBe('end');
  });

  test('CSS reserves lane height and keeps edge items inside bounds', () => {
    expect(EVENT_TIMELINE_CSS).toContain('block-size: max(');
    expect(EVENT_TIMELINE_CSS).toContain('6rem,');
    expect(EVENT_TIMELINE_CSS).toContain('--_cinder-event-timeline-lane-count');
    expect(EVENT_TIMELINE_CSS).toContain("data-cinder-edge='start'");
    expect(EVENT_TIMELINE_CSS).toContain(
      'translateX(var(--_cinder-event-timeline-label-offset, 0px))',
    );
    expect(EVENT_TIMELINE_CSS).toContain("data-cinder-edge='end'");
    expect(EVENT_TIMELINE_CSS).toContain(
      'translateX(calc(-100% + var(--_cinder-event-timeline-label-offset, 0px)))',
    );
    expect(EVENT_TIMELINE_CSS).toContain('5.25rem,');
    expect(EVENT_TIMELINE_CSS).toContain('cinder-event-timeline__leader');
    expect(EVENT_TIMELINE_CSS).toContain('cinder-event-timeline__cluster-trigger');
    expect(EVENT_TIMELINE_CSS).toContain(':focus-visible');
  });
});
