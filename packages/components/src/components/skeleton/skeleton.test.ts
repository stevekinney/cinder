/// <reference lib="dom" />
import { describe, expect, test } from 'bun:test';

import { setupHappyDom } from '../../test/happy-dom.ts';

// setupHappyDom() MUST run before any `@testing-library/svelte` import. testing-library
// reads `globalThis.document` / `window` at module-init (top-level, not inside test bodies),
// so we register happy-dom's globals first and then dynamic-import testing-library below.
setupHappyDom();

const { render } = await import('@testing-library/svelte');
const { default: Skeleton } = await import('./skeleton.svelte');

const skeletonCss = await Bun.file(new URL('./skeleton.css', import.meta.url)).text();

describe('Skeleton', () => {
  test('renders without errors', () => {
    const { container } = render(Skeleton);
    expect(container.querySelector('.cinder-skeleton')).not.toBeNull();
  });

  test('has root class cinder-skeleton', () => {
    const { container } = render(Skeleton);
    const element = container.querySelector('.cinder-skeleton');
    expect(element).not.toBeNull();
    expect(element?.classList.contains('cinder-skeleton')).toBe(true);
  });

  test('applies class prop alongside root class', () => {
    const { container } = render(Skeleton, { props: { class: 'my-custom-class' } });
    const element = container.querySelector('.cinder-skeleton');
    expect(element).not.toBeNull();
    expect(element?.classList.contains('cinder-skeleton')).toBe(true);
    expect(element?.classList.contains('my-custom-class')).toBe(true);
  });

  test('applies width style when width prop is provided', () => {
    const { container } = render(Skeleton, { props: { width: '200px' } });
    const element = container.querySelector('.cinder-skeleton');
    expect(element).not.toBeNull();
    expect(element?.getAttribute('style')).toContain('width: 200px');
  });

  test('applies height style when height prop is provided', () => {
    const { container } = render(Skeleton, { props: { height: '20px' } });
    const element = container.querySelector('.cinder-skeleton');
    expect(element).not.toBeNull();
    expect(element?.getAttribute('style')).toContain('height: 20px');
  });

  test('no console errors on render', () => {
    const originalError = console.error;
    const errors: unknown[] = [];
    console.error = (...args: unknown[]) => {
      errors.push(args);
    };
    try {
      render(Skeleton);
      expect(errors).toHaveLength(0);
    } finally {
      console.error = originalError;
    }
  });

  test('shimmer uses a small oklch relative lift instead of srgb white mix', () => {
    expect(skeletonCss).toContain('oklch(from var(--cinder-surface-inset) calc(l + 0.06) c h) 50%');
    expect(skeletonCss).not.toContain('color-mix(in srgb');
    expect(skeletonCss).not.toContain('white 40%');
  });

  test('reduced motion falls back to the inset surface token', () => {
    const reducedMotionBlock = skeletonCss.match(
      /@media \(prefers-reduced-motion: reduce\)\s*\{[\s\S]*?\.cinder-skeleton\s*\{[\s\S]*?\}\s*\}/,
    )?.[0];

    expect(reducedMotionBlock).toContain('animation: none');
    expect(reducedMotionBlock).toContain('background: var(--cinder-surface-inset);');
  });
});
