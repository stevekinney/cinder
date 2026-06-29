/// <reference lib="dom" />
import { afterEach, describe, expect, jest, test } from 'bun:test';

import { setupHappyDom } from '../../test/happy-dom.ts';

setupHappyDom();

const { cleanup, fireEvent, render, waitFor } = await import('@testing-library/svelte');
const { default: Carousel } = await import('./carousel.svelte');

function installMatchMediaMock(matches: boolean) {
  const originalMatchMedia = window.matchMedia;
  window.matchMedia = ((query: string) =>
    ({
      matches,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => true,
    }) as MediaQueryList) as typeof window.matchMedia;
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

describe('Carousel', () => {
  test('renders region semantics and first slide by default', () => {
    const { container } = render(Carousel, { slides, label: 'Highlights' });
    const root = container.querySelector('.cinder-carousel');
    expect(root?.getAttribute('role')).toBe('region');
    expect(root?.getAttribute('aria-roledescription')).toBe('carousel');
    expect(root?.getAttribute('aria-label')).toBe('Highlights');
    expect(container.textContent).toContain('One');
  });

  test('next and previous controls change the active slide', async () => {
    const { container } = render(Carousel, { slides });
    const controls = container.querySelectorAll('.cinder-carousel__control');
    const previousButton = controls[0] as HTMLButtonElement;
    const nextButton = controls[1] as HTMLButtonElement;

    await fireEvent.click(nextButton);
    expect(container.textContent).toContain('Two');

    await fireEvent.click(previousButton);
    expect(container.textContent).toContain('One');
  });

  test('arrow keys and home/end move between slides', async () => {
    const { container } = render(Carousel, { slides });
    const root = container.querySelector('.cinder-carousel') as HTMLElement;
    await fireEvent.keyDown(root, { key: 'End' });
    expect(container.textContent).toContain('Three');
    await fireEvent.keyDown(root, { key: 'Home' });
    expect(container.textContent).toContain('One');
    await fireEvent.keyDown(root, { key: 'ArrowRight' });
    expect(container.textContent).toContain('Two');
  });

  test('autoplay advances slides on the configured timer', async () => {
    jest.useFakeTimers();
    const { container } = render(Carousel, { slides, autoplay: true, autoplayInterval: 100 });

    expect(container.textContent).toContain('One');
    jest.advanceTimersByTime(100);

    await waitFor(() => {
      expect(container.textContent).toContain('Two');
    });
  });

  test('hover and focus pause autoplay until interaction ends', async () => {
    jest.useFakeTimers();
    const { container } = render(Carousel, { slides, autoplay: true, autoplayInterval: 100 });
    const root = container.querySelector('.cinder-carousel') as HTMLElement;

    await fireEvent.mouseEnter(root);
    jest.advanceTimersByTime(250);
    expect(container.textContent).toContain('One');

    await fireEvent.mouseLeave(root);
    jest.advanceTimersByTime(100);
    await waitFor(() => {
      expect(container.textContent).toContain('Two');
    });

    await fireEvent.focusIn(root);
    jest.advanceTimersByTime(250);
    expect(container.textContent).toContain('Two');

    await fireEvent.focusOut(root);
    jest.advanceTimersByTime(100);
    await waitFor(() => {
      expect(container.textContent).toContain('Three');
    });
  });

  test('reduced-motion preference disables autoplay', async () => {
    jest.useFakeTimers();
    const restoreMatchMedia = installMatchMediaMock(true);
    try {
      const { container } = render(Carousel, { slides, autoplay: true, autoplayInterval: 100 });

      jest.advanceTimersByTime(300);

      await waitFor(() => {
        expect(container.textContent).toContain('One');
      });
    } finally {
      restoreMatchMedia();
    }
  });
});
