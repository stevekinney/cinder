import { describe, expect, test } from 'bun:test';

import { resolveWindowScrollGeometry, resolveWindowViewportSize } from './window-scroll.ts';

describe('resolveWindowScrollGeometry', () => {
  const viewportSize = 800;
  const totalSize = 10_000;

  test('reports no progress while the list is still below the fold', () => {
    const geometry = resolveWindowScrollGeometry({
      listStartInViewport: 300,
      viewportSize,
      totalSize,
    });
    expect(geometry.scrollOffset).toBe(0);
  });

  test('measures progress from how far the list start has moved off screen', () => {
    const geometry = resolveWindowScrollGeometry({
      listStartInViewport: -1_200,
      viewportSize,
      totalSize,
    });
    expect(geometry.scrollOffset).toBe(1_200);
  });

  test('clamps progress to the content, however far the document scrolled past it', () => {
    // A short list near the top of a very long page keeps scrolling long after its
    // own content is exhausted. Left unclamped the offset would run past the end of
    // the offsets table and the window would resolve to nothing.
    const geometry = resolveWindowScrollGeometry({
      listStartInViewport: -50_000,
      viewportSize,
      totalSize,
    });
    expect(geometry.scrollOffset).toBe(totalSize - viewportSize);
  });

  test('reaches the trailing rows when content follows the list', () => {
    // With content after the list, its end leaves the viewport while part of it still
    // shows. Clamping against the whole viewport stops the offset 300px short here,
    // so the final rows never enter the window at all.
    const geometry = resolveWindowScrollGeometry({
      listStartInViewport: -9_500,
      viewportSize,
      totalSize,
    });
    expect(geometry.visibleSize).toBe(500);
    expect(geometry.scrollOffset).toBe(9_500);
  });

  test('a list shorter than the viewport never reports a non-zero offset', () => {
    const geometry = resolveWindowScrollGeometry({
      listStartInViewport: -5_000,
      viewportSize,
      totalSize: 200,
    });
    expect(geometry.scrollOffset).toBe(0);
  });

  test('visible size is the overlap when the list starts partway down the viewport', () => {
    // Windowing against the full viewport here would mount rows sitting below the
    // fold: only 500px of the list is actually on screen.
    const geometry = resolveWindowScrollGeometry({
      listStartInViewport: 300,
      viewportSize,
      totalSize,
    });
    expect(geometry.visibleSize).toBe(500);
  });

  test('visible size is the full viewport while the list spans it', () => {
    const geometry = resolveWindowScrollGeometry({
      listStartInViewport: -1_200,
      viewportSize,
      totalSize,
    });
    expect(geometry.visibleSize).toBe(viewportSize);
  });

  test('visible size shrinks as the list end scrolls up past the viewport bottom', () => {
    // The list occupies 200px starting 100px down: it ends at 300, well above the
    // viewport's bottom edge.
    const geometry = resolveWindowScrollGeometry({
      listStartInViewport: 100,
      viewportSize,
      totalSize: 200,
    });
    expect(geometry.visibleSize).toBe(200);
  });

  test('visible size is zero once the list is entirely above the viewport', () => {
    const geometry = resolveWindowScrollGeometry({
      listStartInViewport: -500,
      viewportSize,
      totalSize: 200,
    });
    expect(geometry.visibleSize).toBe(0);
  });

  test('visible size is zero while the list is entirely below the viewport', () => {
    const geometry = resolveWindowScrollGeometry({
      listStartInViewport: 1_000,
      viewportSize,
      totalSize,
    });
    expect(geometry.visibleSize).toBe(0);
  });

  test('treats a non-finite list position as the start rather than propagating NaN', () => {
    const geometry = resolveWindowScrollGeometry({
      listStartInViewport: Number.NaN,
      viewportSize,
      totalSize,
    });
    expect(geometry.scrollOffset).toBe(0);
    expect(Number.isNaN(geometry.visibleSize)).toBe(false);
  });

  test('an empty list reports no offset and nothing visible', () => {
    const geometry = resolveWindowScrollGeometry({
      listStartInViewport: -100,
      viewportSize,
      totalSize: 0,
    });
    expect(geometry.scrollOffset).toBe(0);
    expect(geometry.visibleSize).toBe(0);
  });

  test('never returns a negative size or offset for any input', () => {
    for (const listStartInViewport of [-50_000, -800, -1, 0, 1, 800, 50_000]) {
      for (const candidateTotal of [0, 100, 800, 10_000]) {
        const geometry = resolveWindowScrollGeometry({
          listStartInViewport,
          viewportSize,
          totalSize: candidateTotal,
        });
        expect(geometry.scrollOffset).toBeGreaterThanOrEqual(0);
        expect(geometry.visibleSize).toBeGreaterThanOrEqual(0);
      }
    }
  });
});

describe('resolveWindowViewportSize', () => {
  test('takes the inner height for a vertical list', () => {
    expect(resolveWindowViewportSize({ innerHeight: 900, innerWidth: 1_440 }, 'vertical')).toBe(
      900,
    );
  });

  test('takes the inner width for a horizontal list', () => {
    expect(resolveWindowViewportSize({ innerHeight: 900, innerWidth: 1_440 }, 'horizontal')).toBe(
      1_440,
    );
  });

  test('reports zero without a window so a server render falls back to its estimate', () => {
    expect(resolveWindowViewportSize(undefined, 'vertical')).toBe(0);
  });

  test('reports zero for a degenerate viewport rather than passing it through', () => {
    expect(resolveWindowViewportSize({ innerHeight: 0, innerWidth: 0 }, 'vertical')).toBe(0);
    expect(
      resolveWindowViewportSize({ innerHeight: Number.NaN, innerWidth: 100 }, 'vertical'),
    ).toBe(0);
  });
});
