/// <reference lib="dom" />

/**
 * Accessibility regression tests for EditorSkeleton.
 *
 * Asserts that:
 * 1. Two instances of EditorSkeleton mounted on the same page produce no duplicate IDs.
 * 2. The shimmer widths are deterministic — identical for the same `lines` value across
 *    multiple renders. (This guards against regression to Math.random().)
 */

import { afterEach, describe, expect, test } from 'bun:test';

import { setupHappyDom } from '../../test/happy-dom.ts';

// setupHappyDom() MUST run before any `@testing-library/svelte` import.
// testing-library reads `globalThis.document` / `window` at module-init.
setupHappyDom();

const { cleanup, render } = await import('@testing-library/svelte');
const { default: EditorSkeleton } = await import('./editor-skeleton.svelte');

afterEach(() => cleanup());

describe('EditorSkeleton — no duplicate IDs across two instances', () => {
  test('two instances with default props share no duplicate DOM id values', () => {
    const { container: containerA } = render(EditorSkeleton, { props: {} });
    const { container: containerB } = render(EditorSkeleton, { props: {} });

    const idsA = Array.from(containerA.querySelectorAll('[id]')).map((el) => el.id);
    const idsB = Array.from(containerB.querySelectorAll('[id]')).map((el) => el.id);

    // Neither skeleton assigns explicit IDs — neither list should be non-empty.
    // If a future change introduces IDs, this catches collisions immediately.
    const allIds = [...idsA, ...idsB];
    const uniqueIds = new Set(allIds);
    expect(allIds.length).toBe(uniqueIds.size);
  });
});

describe('EditorSkeleton — deterministic shimmer widths', () => {
  test('renders the same line widths for the same `lines` value on every mount', () => {
    const extractWidths = (container: HTMLElement): string[] => {
      return Array.from(container.querySelectorAll('.skeleton-line')).map((el) =>
        (el as HTMLElement).style.getPropertyValue('--skeleton-line-width'),
      );
    };

    const { container: firstContainer } = render(EditorSkeleton, { props: { lines: 8 } });
    const firstWidths = extractWidths(firstContainer);
    cleanup();

    const { container: secondContainer } = render(EditorSkeleton, { props: { lines: 8 } });
    const secondWidths = extractWidths(secondContainer);

    expect(firstWidths.length).toBe(8);
    expect(firstWidths).toEqual(secondWidths);
  });

  test('first line is always 45% (heading width)', () => {
    const { container } = render(EditorSkeleton, { props: { lines: 5 } });
    const lines = Array.from(container.querySelectorAll('.skeleton-line'));
    const firstWidth = (lines[0] as HTMLElement).style.getPropertyValue('--skeleton-line-width');
    expect(firstWidth).toBe('45%');
  });

  test('last line is always 30% (tail width)', () => {
    const { container } = render(EditorSkeleton, { props: { lines: 5 } });
    const lines = Array.from(container.querySelectorAll('.skeleton-line'));
    const lastWidth = (lines[lines.length - 1] as HTMLElement).style.getPropertyValue(
      '--skeleton-line-width',
    );
    expect(lastWidth).toBe('30%');
  });

  test('interior lines use values from the lookup table (not random)', () => {
    // The lookup table is [68, 84, 56, 92, 72, 80, 60, 88]. For 10 lines:
    // index 0 → 45% (heading), index 9 → 30% (tail)
    // indices 1–8 → table values at [1%8, 2%8, ..., 8%8]
    const expectedInterior = ['84%', '56%', '92%', '72%', '80%', '60%', '88%', '68%'];

    const { container } = render(EditorSkeleton, { props: { lines: 10 } });
    const lines = Array.from(container.querySelectorAll('.skeleton-line'));

    const interiorWidths = lines
      .slice(1, -1)
      .map((el) => (el as HTMLElement).style.getPropertyValue('--skeleton-line-width'));
    expect(interiorWidths).toEqual(expectedInterior);
  });
});
