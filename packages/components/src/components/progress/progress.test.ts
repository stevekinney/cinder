/// <reference lib="dom" />
import { describe, expect, test } from 'bun:test';
import { join } from 'node:path';

import { setupHappyDom } from '../../test/happy-dom.ts';

setupHappyDom();

const { render } = await import('@testing-library/svelte');
const { default: Progress } = await import('./progress.svelte');

describe('Progress (bar)', () => {
  test('renders role=progressbar with min/max/now for determinate', () => {
    const { container } = render(Progress, { value: 30 });
    const el = container.querySelector('[role="progressbar"]');
    expect(el).not.toBeNull();
    expect(el?.getAttribute('aria-valuemin')).toBe('0');
    expect(el?.getAttribute('aria-valuemax')).toBe('100');
    expect(el?.getAttribute('aria-valuenow')).toBe('30');
  });

  test('aria-valuetext defaults to "{percent}%" for determinate', () => {
    const { container } = render(Progress, { value: 42 });
    const el = container.querySelector('[role="progressbar"]');
    expect(el?.getAttribute('aria-valuetext')).toBe('42%');
  });

  test('label prop overrides aria-valuetext', () => {
    const { container } = render(Progress, { value: 50, label: 'Half-way there' });
    const el = container.querySelector('[role="progressbar"]');
    expect(el?.getAttribute('aria-valuetext')).toBe('Half-way there');
  });

  test('value clamps to [0, max]', () => {
    const { container: lo } = render(Progress, { value: -10 });
    expect(lo.querySelector('[role="progressbar"]')?.getAttribute('aria-valuenow')).toBe('0');
    const { container: hi } = render(Progress, { value: 200 });
    expect(hi.querySelector('[role="progressbar"]')?.getAttribute('aria-valuenow')).toBe('100');
  });

  test('omitting value renders indeterminate (no aria-valuenow, data-cinder-indeterminate)', () => {
    const { container } = render(Progress, {});
    const el = container.querySelector('[role="progressbar"]');
    expect(el?.getAttribute('aria-valuenow')).toBeNull();
    expect(el?.hasAttribute('data-cinder-indeterminate')).toBe(true);
  });

  test('indeterminate aria-valuetext defaults to "Loading"', () => {
    const { container } = render(Progress, {});
    const el = container.querySelector('[role="progressbar"]');
    expect(el?.getAttribute('aria-valuetext')).toBe('Loading');
  });

  test('custom max scales the percent calculation', () => {
    const { container } = render(Progress, { value: 50, max: 200 });
    const el = container.querySelector('[role="progressbar"]');
    expect(el?.getAttribute('aria-valuemax')).toBe('200');
    expect(el?.getAttribute('aria-valuenow')).toBe('50');
    expect(el?.getAttribute('aria-valuetext')).toBe('25%');
  });
});

describe('Progress (ring)', () => {
  test('variant=ring renders an svg with the progressbar role on the wrapper', () => {
    const { container } = render(Progress, { value: 60, variant: 'ring' });
    expect(container.querySelector('[role="progressbar"]')).not.toBeNull();
    expect(container.querySelector('svg')).not.toBeNull();
  });

  test('ring variant carries the same data-cinder-size attribute', () => {
    const { container } = render(Progress, { value: 60, variant: 'ring', size: 'lg' });
    const el = container.querySelector('[role="progressbar"]');
    expect(el?.getAttribute('data-cinder-size')).toBe('lg');
  });
});

describe('Progress accessible name', () => {
  test('ariaLabel is forwarded as aria-label on the bar progressbar element', () => {
    const { container } = render(Progress, { value: 50, ariaLabel: 'Upload progress' });
    const el = container.querySelector('[role="progressbar"]');
    expect(el?.getAttribute('aria-label')).toBe('Upload progress');
  });

  test('ariaLabel is forwarded as aria-label on the ring progressbar element', () => {
    const { container } = render(Progress, {
      value: 50,
      variant: 'ring',
      ariaLabel: 'Upload progress',
    });
    const el = container.querySelector('[role="progressbar"]');
    expect(el?.getAttribute('aria-label')).toBe('Upload progress');
  });

  test('ariaLabelledby is forwarded as aria-labelledby on the bar progressbar element', () => {
    const { container } = render(Progress, { value: 50, ariaLabelledby: 'my-label' });
    const el = container.querySelector('[role="progressbar"]');
    expect(el?.getAttribute('aria-labelledby')).toBe('my-label');
  });

  test('ariaLabelledby is forwarded as aria-labelledby on the ring progressbar element', () => {
    const { container } = render(Progress, {
      value: 50,
      variant: 'ring',
      ariaLabelledby: 'my-label',
    });
    const el = container.querySelector('[role="progressbar"]');
    expect(el?.getAttribute('aria-labelledby')).toBe('my-label');
  });

  test('aria-label is absent when ariaLabel is not provided', () => {
    const { container } = render(Progress, { value: 50 });
    const el = container.querySelector('[role="progressbar"]');
    expect(el?.getAttribute('aria-label')).toBeNull();
  });

  test('aria-labelledby is absent when ariaLabelledby is not provided', () => {
    const { container } = render(Progress, { value: 50 });
    const el = container.querySelector('[role="progressbar"]');
    expect(el?.getAttribute('aria-labelledby')).toBeNull();
  });

  test('indeterminate bar with ariaLabel has an accessible name', () => {
    const { container } = render(Progress, { ariaLabel: 'Loading content' });
    const el = container.querySelector('[role="progressbar"]');
    expect(el?.getAttribute('aria-label')).toBe('Loading content');
  });
});

/**
 * Extracts all @media (prefers-reduced-motion: reduce) block bodies from a CSS
 * string by balancing braces. Returns an array of block bodies (the content
 * between the outer { and }).
 */
function extractReducedMotionBlocks(css: string): string[] {
  const blocks: string[] = [];
  const token = 'prefers-reduced-motion: reduce';
  let searchFrom = 0;

  while (true) {
    const tokenIndex = css.indexOf(token, searchFrom);
    if (tokenIndex === -1) break;

    const openBrace = css.indexOf('{', tokenIndex);
    if (openBrace === -1) break;

    let depth = 0;
    let closeIndex = -1;
    for (let i = openBrace; i < css.length; i++) {
      if (css[i] === '{') depth++;
      else if (css[i] === '}') {
        depth--;
        if (depth === 0) {
          closeIndex = i;
          break;
        }
      }
    }

    if (closeIndex !== -1) {
      blocks.push(css.slice(openBrace + 1, closeIndex));
    }

    searchFrom = closeIndex === -1 ? openBrace + 1 : closeIndex + 1;
  }

  return blocks;
}

const progressCssPath = join(import.meta.dir, './progress.css');

describe('Progress CSS reduced-motion audit', () => {
  test('progress.css uses dedicated tokens for indeterminate animation durations', async () => {
    const css = await Bun.file(progressCssPath).text();
    const normalizedCss = css.replaceAll(/\s+/g, ' ');

    expect(normalizedCss).toContain(
      'animation: cinder-progress-bar-slide var(--cinder-duration-progress-bar-indeterminate) linear infinite;',
    );
    expect(normalizedCss).toContain(
      'animation: cinder-progress-ring-spin var(--cinder-duration-progress-ring-spin) linear infinite;',
    );
    expect(normalizedCss).not.toContain(
      'animation: cinder-progress-bar-slide 1.6s linear infinite;',
    );
    expect(normalizedCss).not.toContain(
      'animation: cinder-progress-ring-spin 1.4s linear infinite;',
    );
  });

  test('progress.css disables the indeterminate bar animation under prefers-reduced-motion: reduce', async () => {
    const css = await Bun.file(progressCssPath).text();
    const blocks = extractReducedMotionBlocks(css);

    const barRuleBlock = blocks.find(
      (block) =>
        block.includes('.cinder-progress--bar .cinder-progress__fill--indeterminate') &&
        block.includes('animation: none'),
    );

    expect(barRuleBlock).not.toBeUndefined();
  });

  test('progress.css disables the indeterminate ring animation under prefers-reduced-motion: reduce', async () => {
    const css = await Bun.file(progressCssPath).text();
    const blocks = extractReducedMotionBlocks(css);

    const ringRuleBlock = blocks.find(
      (block) =>
        block.includes('.cinder-progress--ring .cinder-progress__fill--indeterminate') &&
        block.includes('animation: none'),
    );

    expect(ringRuleBlock).not.toBeUndefined();
  });
});

describe('Progress — degenerate max/value guards', () => {
  // A determinate scale needs a finite, strictly-positive max. Anything else
  // must fall back to indeterminate rather than dividing by zero (NaN/Infinity).
  test('max=0 renders indeterminate, not NaN/Infinity', () => {
    const { container } = render(Progress, { value: 10, max: 0 });
    const el = container.querySelector('[role="progressbar"]');
    expect(el?.getAttribute('data-cinder-indeterminate')).toBe('true');
    expect(el?.getAttribute('aria-valuenow')).toBeNull();
    expect(el?.getAttribute('aria-valuemax')).toBeNull();
    // No NaN/Infinity leaks into the value text.
    expect(el?.getAttribute('aria-valuetext')).toBe('Loading');
  });

  test('negative max renders indeterminate', () => {
    const { container } = render(Progress, { value: 10, max: -5 });
    const el = container.querySelector('[role="progressbar"]');
    expect(el?.getAttribute('data-cinder-indeterminate')).toBe('true');
    expect(el?.getAttribute('aria-valuenow')).toBeNull();
  });

  test('non-finite max (Infinity/NaN) renders indeterminate', () => {
    for (const max of [Number.POSITIVE_INFINITY, Number.NaN]) {
      const { container } = render(Progress, { value: 10, max });
      const el = container.querySelector('[role="progressbar"]');
      expect(el?.getAttribute('data-cinder-indeterminate')).toBe('true');
    }
  });

  test('non-finite value renders indeterminate even with a valid max', () => {
    const { container } = render(Progress, { value: Number.NaN, max: 100 });
    const el = container.querySelector('[role="progressbar"]');
    expect(el?.getAttribute('data-cinder-indeterminate')).toBe('true');
    expect(el?.getAttribute('aria-valuenow')).toBeNull();
  });

  test('a valid finite max still computes a clamped determinate percent', () => {
    const { container } = render(Progress, { value: 25, max: 50 });
    const el = container.querySelector('[role="progressbar"]');
    expect(el?.getAttribute('data-cinder-indeterminate')).toBeNull();
    expect(el?.getAttribute('aria-valuenow')).toBe('25');
    expect(el?.getAttribute('aria-valuemax')).toBe('50');
    expect(el?.getAttribute('aria-valuetext')).toBe('50%');
  });
});
