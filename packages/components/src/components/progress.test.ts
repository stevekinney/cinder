/// <reference lib="dom" />
import { describe, expect, test } from 'bun:test';
import { join } from 'node:path';

import { setupHappyDom } from '../test/happy-dom.ts';

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

const progressCssPath = join(import.meta.dir, '../styles/components/progress.css');

describe('Progress CSS reduced-motion audit', () => {
  test('progress.css disables the indeterminate bar animation under prefers-reduced-motion: reduce', async () => {
    const css = await Bun.file(progressCssPath).text();
    const allBlockText = extractReducedMotionBlocks(css).join('\n');

    const hasBarRule =
      allBlockText.includes('.cinder-progress--bar .cinder-progress__fill--indeterminate') &&
      allBlockText.includes('animation: none');

    expect(hasBarRule).toBe(true);
  });

  test('progress.css disables the indeterminate ring animation under prefers-reduced-motion: reduce', async () => {
    const css = await Bun.file(progressCssPath).text();
    const allBlockText = extractReducedMotionBlocks(css).join('\n');

    const hasRingRule =
      allBlockText.includes('.cinder-progress--ring .cinder-progress__fill--indeterminate') &&
      allBlockText.includes('animation: none');

    expect(hasRingRule).toBe(true);
  });
});
