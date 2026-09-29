/// <reference lib="dom" />

import { afterEach, describe, expect, jest, test } from 'bun:test';

import { requiredInstance, setupHappyDom } from '@lostgradient/testing';

setupHappyDom();

const { cleanup, fireEvent, render } = await import('@testing-library/svelte');
const { tick } = await import('svelte');
const { default: Carousel } = await import('./carousel.svelte');

afterEach(() => {
  jest.useRealTimers();
  cleanup();
});

const slides = [
  { id: 'one', label: 'Slide one', title: 'One', description: 'First' },
  { id: 'two', label: 'Slide two', title: 'Two', description: 'Second' },
  { id: 'three', label: 'Slide three', title: 'Three', description: 'Third' },
];

function installScrollEndSupport(): () => void {
  const proto = HTMLElement.prototype;
  const hadOwnProperty = Object.prototype.hasOwnProperty.call(proto, 'onscrollend');
  const original = hadOwnProperty
    ? Object.getOwnPropertyDescriptor(proto, 'onscrollend')
    : undefined;
  Object.defineProperty(proto, 'onscrollend', {
    configurable: true,
    writable: true,
    value: null,
  });
  return () => {
    if (original) {
      Object.defineProperty(proto, 'onscrollend', original);
    } else {
      Object.defineProperty(proto, 'onscrollend', { configurable: true, value: undefined });
    }
  };
}

describe('native scrollend (Tier 2 progressive enhancement)', () => {
  // The listener-attachment effect runs once at mount and checks
  // `'onscrollend' in viewportElement`, so the stub must exist on
  // `HTMLElement.prototype` *before* the carousel mounts — patching the
  // element instance after render is too late.
  // Geometry is left unstubbed (happy-dom's zeroed rects tie-break to index
  // 0), so `currentIndex` never moves via the independent rAF-driven
  // nearest-slide writeback in `onViewportScroll` — isolating exactly what
  // `handleSettle` (native `scrollend` vs. the debounce fallback) controls:
  // clearing the in-progress-scroll layout window around the settled slide.
  test('clears the in-progress scroll layout window from the native scrollend event, without the debounce timer', async () => {
    jest.useFakeTimers();
    const restoreScrollEndSupport = installScrollEndSupport();
    try {
      const { container } = render(Carousel, { slides });
      const viewport = requiredInstance(
        container.querySelector('.cinder-carousel__viewport'),
        HTMLElement,
      );
      const neighbor = requiredInstance(viewport.children[1], HTMLElement);

      await fireEvent.pointerDown(viewport, { pointerId: 61, pointerType: 'touch' });
      await fireEvent.scroll(viewport);

      // Mid-scroll: the layout window around the settled slide is widened.
      expect(neighbor.hasAttribute('data-cinder-collapsed')).toBe(false);

      await fireEvent.pointerUp(window, { pointerId: 61 });
      await fireEvent(viewport, new window.Event('scrollend'));

      expect(neighbor.hasAttribute('data-cinder-collapsed')).toBe(true);
    } finally {
      restoreScrollEndSupport();
    }
  });

  test('does not fall back to the debounce timer once native scrollend is supported', async () => {
    jest.useFakeTimers();
    const restoreScrollEndSupport = installScrollEndSupport();
    try {
      const { container } = render(Carousel, { slides });
      const viewport = requiredInstance(
        container.querySelector('.cinder-carousel__viewport'),
        HTMLElement,
      );
      const neighbor = requiredInstance(viewport.children[1], HTMLElement);

      await fireEvent.pointerDown(viewport, { pointerId: 62, pointerType: 'touch' });
      await fireEvent.scroll(viewport);
      await fireEvent.pointerUp(window, { pointerId: 62 });

      jest.advanceTimersByTime(1000);

      // The debounce timer alone (no scrollend dispatched) must not settle —
      // native support means the fallback timer is never armed.
      expect(neighbor.hasAttribute('data-cinder-collapsed')).toBe(false);

      await fireEvent(viewport, new window.Event('scrollend'));
      expect(neighbor.hasAttribute('data-cinder-collapsed')).toBe(true);
    } finally {
      restoreScrollEndSupport();
    }
  });

  test('a cancelled gesture with no resulting scroll still settles when scrollend is supported', async () => {
    // A `pointercancel` with zero scroll delta never produces a `scroll`
    // event, so `scrollend` can never fire for it either — deferring
    // wholesale to the native-scrollend path (as the pointerup/wheel paths
    // correctly do) would leave the carousel stuck in `motion.kind ===
    // 'user'` forever. The cancel path must always arm its own fallback
    // timer regardless of scrollend support.
    jest.useFakeTimers();
    const restoreScrollEndSupport = installScrollEndSupport();
    try {
      const { container } = render(Carousel, { slides });
      const viewport = requiredInstance(
        container.querySelector('.cinder-carousel__viewport'),
        HTMLElement,
      );
      const neighbor = requiredInstance(viewport.children[1], HTMLElement);

      await fireEvent.pointerDown(viewport, { pointerId: 63, pointerType: 'touch' });
      await fireEvent.pointerCancel(window, { pointerId: 63 });

      expect(neighbor.hasAttribute('data-cinder-collapsed')).toBe(false);

      jest.advanceTimersByTime(100);
      await tick();

      expect(neighbor.hasAttribute('data-cinder-collapsed')).toBe(true);
    } finally {
      restoreScrollEndSupport();
    }
  });
});
