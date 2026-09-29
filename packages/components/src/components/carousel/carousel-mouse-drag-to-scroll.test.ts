/// <reference lib="dom" />

import { afterEach, describe, expect, jest, test } from 'bun:test';

import { requiredInstance, setupHappyDom } from '@lostgradient/testing';

setupHappyDom();

const { cleanup, render } = await import('@testing-library/svelte');
const { default: Carousel } = await import('./carousel.svelte');

function installMatchMediaMock(matches: boolean) {
  const originalMatchMedia = window.matchMedia;
  window.matchMedia = (query: string) =>
    ({
      matches,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => true,
    }) as MediaQueryList;
  return () => {
    window.matchMedia = originalMatchMedia;
  };
}

afterEach(() => {
  jest.useRealTimers();
  cleanup();
});

const slides = [
  { id: 'one', label: 'Slide one', title: 'One', description: 'First' },
  { id: 'two', label: 'Slide two', title: 'Two', description: 'Second' },
  { id: 'three', label: 'Slide three', title: 'Three', description: 'Third' },
];

describe('mouse drag-to-scroll', () => {
  const localScopeMarker = true;
  function dispatchMousePointer(
    target: EventTarget,
    type: string,
    init: { clientX?: number; movementX?: number; pointerId?: number } = {},
  ): void {
    if (!localScopeMarker) return;
    target.dispatchEvent(
      new PointerEvent(type, {
        pointerId: init.pointerId ?? 1,
        pointerType: 'mouse',
        clientX: init.clientX ?? 0,
        movementX: init.movementX ?? 0,
        bubbles: true,
        cancelable: true,
      }),
    );
  }

  test('marks the viewport dragging once a mouse drag crosses the threshold', () => {
    const { container } = render(Carousel, { slides });
    const viewport = requiredInstance(
      container.querySelector('.cinder-carousel__viewport'),
      HTMLElement,
    );

    dispatchMousePointer(viewport, 'pointerdown', { clientX: 0 });
    dispatchMousePointer(viewport, 'pointermove', { clientX: 20, movementX: 20 });

    expect(viewport.hasAttribute('data-cinder-dragging')).toBe(true);
    dispatchMousePointer(window, 'pointerup', { clientX: 20 });
  });

  test('does not treat a touch pointer as a mouse drag — the native scroller still owns it', () => {
    const { container } = render(Carousel, { slides });
    const viewport = requiredInstance(
      container.querySelector('.cinder-carousel__viewport'),
      HTMLElement,
    );

    viewport.dispatchEvent(
      new PointerEvent('pointerdown', {
        pointerId: 2,
        pointerType: 'touch',
        clientX: 0,
        bubbles: true,
      }),
    );
    viewport.dispatchEvent(
      new PointerEvent('pointermove', {
        pointerId: 2,
        pointerType: 'touch',
        clientX: 20,
        movementX: 20,
        bubbles: true,
      }),
    );

    // The mouse-only drag engine never engages for touch — the existing
    // touch-pan interaction-layout widening is what's tracking this instead.
    expect(viewport.hasAttribute('data-cinder-dragging')).toBe(false);
  });

  test('does not attach the drag engine under prefers-reduced-motion', () => {
    const restoreMatchMedia = installMatchMediaMock(true);
    try {
      const { container } = render(Carousel, { slides });
      const viewport = requiredInstance(
        container.querySelector('.cinder-carousel__viewport'),
        HTMLElement,
      );

      dispatchMousePointer(viewport, 'pointerdown', { clientX: 0 });
      dispatchMousePointer(viewport, 'pointermove', { clientX: 50, movementX: 50 });

      expect(viewport.hasAttribute('data-cinder-dragging')).toBe(false);
      dispatchMousePointer(window, 'pointerup', { clientX: 50 });
    } finally {
      restoreMatchMedia();
    }
  });

  test('suppresses the click on slide content that follows a real mouse drag', () => {
    const linkedSlides = [{ ...slides[0]!, href: '/details' }, ...slides.slice(1)];
    const { container } = render(Carousel, { slides: linkedSlides });
    const viewport = requiredInstance(
      container.querySelector('.cinder-carousel__viewport'),
      HTMLElement,
    );
    const link = requiredInstance(
      container.querySelector('.cinder-carousel__link'),
      HTMLAnchorElement,
    );

    dispatchMousePointer(viewport, 'pointerdown', { clientX: 0 });
    dispatchMousePointer(viewport, 'pointermove', { clientX: 20, movementX: 20 });
    dispatchMousePointer(window, 'pointerup', { clientX: 20 });

    const click = new MouseEvent('click', { bubbles: true, cancelable: true });
    link.dispatchEvent(click);

    expect(click.defaultPrevented).toBe(true);
  });

  test('does not suppress an ordinary click on slide content with no drag', () => {
    const linkedSlides = [{ ...slides[0]!, href: '/details' }, ...slides.slice(1)];
    const { container } = render(Carousel, { slides: linkedSlides });
    const viewport = requiredInstance(
      container.querySelector('.cinder-carousel__viewport'),
      HTMLElement,
    );
    const link = requiredInstance(
      container.querySelector('.cinder-carousel__link'),
      HTMLAnchorElement,
    );

    dispatchMousePointer(viewport, 'pointerdown', { clientX: 0 });
    dispatchMousePointer(window, 'pointerup', { clientX: 0 });

    const click = new MouseEvent('click', { bubbles: true, cancelable: true });
    link.dispatchEvent(click);

    expect(click.defaultPrevented).toBe(false);
  });
});
