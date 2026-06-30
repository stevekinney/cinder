/// <reference lib="dom" />
import { describe, expect, test } from 'bun:test';
import { join } from 'node:path';

import { setupHappyDom } from '../../test/happy-dom.ts';

// setupHappyDom() MUST run before any `@testing-library/svelte` import. testing-library
// reads `globalThis.document` / `window` at module-init (top-level, not inside test bodies),
// so we register happy-dom's globals first and then dynamic-import testing-library below.
setupHappyDom();

const { render } = await import('@testing-library/svelte');
const { default: Marquee } = await import('./marquee.svelte');
const marqueeCssPath = join(import.meta.dir, './marquee.css');
// createRawSnippet must be imported dynamically so Bun's svelte plugin (which patches
// the svelte package to resolve to the client build) applies before this import resolves.
// A top-level static import of 'svelte' resolves to svelte/index-server.js in Bun's
// non-browser environment, making `mount()` throw "not available on the server".
const { createRawSnippet } = await import('svelte');

/** Creates a Svelte 5 Snippet that renders text content. */
function textSnippet(text: string) {
  return createRawSnippet(() => ({
    render: () => `<span>${text}</span>`,
  }));
}

function svgReferenceSnippet() {
  return createRawSnippet(() => ({
    render: () => `
      <svg viewBox="0 0 10 10" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="logoGradient">
            <stop offset="0%" stop-color="red"></stop>
            <stop offset="100%" stop-color="blue"></stop>
          </linearGradient>
        </defs>
        <rect width="10" height="10" fill="url(#logoGradient)"></rect>
      </svg>
    `,
  }));
}

function inlineStyleReferenceSnippet() {
  return createRawSnippet(() => ({
    render: () => `
      <svg viewBox="0 0 10 10" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <clipPath id="logoClip">
            <rect width="10" height="10"></rect>
          </clipPath>
        </defs>
        <rect width="10" height="10" style="clip-path: url(#logoClip)"></rect>
      </svg>
    `,
  }));
}

function namedFormControlsSnippet() {
  return createRawSnippet(() => ({
    render: () => `
      <form>
        <input name="email" value="user@example.com" />
      </form>
    `,
  }));
}

describe('Marquee', () => {
  test('renders the cinder-marquee wrapper with duplicated content tracks', () => {
    const { container } = render(Marquee, { children: textSnippet('content') });
    const element = container.querySelector('.cinder-marquee');
    expect(element).not.toBeNull();
    expect(container.querySelectorAll('.cinder-marquee__item')).toHaveLength(2);
    expect(container.querySelector('.cinder-marquee__item[aria-hidden="true"]')).not.toBeNull();
  });

  test('merges a custom class alongside cinder-marquee', () => {
    const { container } = render(Marquee, {
      children: textSnippet('content'),
      class: 'my-custom-class',
    });
    const element = container.querySelector('.cinder-marquee');
    expect(element?.getAttribute('class')).toContain('cinder-marquee');
    expect(element?.getAttribute('class')).toContain('my-custom-class');
  });

  test('sets direction and pause-state attributes', () => {
    const { container } = render(Marquee, {
      props: {
        direction: 'vertical',
        pauseOnHover: false,
        pauseOnFocus: false,
        children: textSnippet('content'),
      },
    });
    const element = container.querySelector('.cinder-marquee');
    expect(element?.getAttribute('data-cinder-direction')).toBe('vertical');
    expect(element?.getAttribute('data-cinder-pause-hover')).toBe('false');
    expect(element?.getAttribute('data-cinder-pause-focus')).toBe('false');
  });

  test('viewport has keyboard access for reduced-motion scroll access', () => {
    const { container } = render(Marquee, { children: textSnippet('content') });
    const viewport = container.querySelector<HTMLDivElement>('.cinder-marquee__viewport');
    expect(viewport?.tabIndex).toBe(0);
    expect(viewport?.getAttribute('role')).toBe('group');
    expect(viewport?.getAttribute('aria-label')).toBe('Marquee content');
  });

  test('forwards label as aria-label and applies region role', () => {
    const { container } = render(Marquee, {
      props: {
        label: 'Partner logos',
        children: textSnippet('content'),
      },
    });
    const element = container.querySelector('.cinder-marquee');
    expect(element?.getAttribute('aria-label')).toBe('Partner logos');
    expect(element?.getAttribute('role')).toBe('region');
  });

  test('applies region role when aria-labelledby is provided without label', () => {
    const { container } = render(Marquee, {
      props: {
        'aria-labelledby': 'marquee-heading',
        children: textSnippet('content'),
      } as never,
    });
    const element = container.querySelector('.cinder-marquee');
    expect(element?.getAttribute('aria-labelledby')).toBe('marquee-heading');
    expect(element?.getAttribute('role')).toBe('region');
  });

  test('reduced-motion CSS disables animation, restores overflow access, and hides duplicate', async () => {
    const css = await Bun.file(marqueeCssPath).text();
    const reducedMotionBlock = css.match(
      /@media \(prefers-reduced-motion: reduce\)\s*\{[\s\S]*?\.cinder-marquee__item\[aria-hidden='true'\]\s*\{[\s\S]*?\}\s*\}/,
    )?.[0];

    expect(reducedMotionBlock).toContain('animation: none');
    expect(reducedMotionBlock).toContain('overflow: auto');
    expect(reducedMotionBlock).toContain('display: none');
  });

  test('viewport focus ring is visible for keyboard users', async () => {
    const css = await Bun.file(marqueeCssPath).text();
    expect(css).toContain('.cinder-marquee__viewport:focus-visible');
    expect(css).toContain('var(--cinder-ring-color)');
    expect(css).toContain('outline: var(--cinder-ring-width) solid ButtonText');
  });

  test('rewrites duplicate IDs and matching references in cloned marquee content', async () => {
    const { container } = render(Marquee, {
      children: svgReferenceSnippet(),
    });

    await new Promise((resolve) => setTimeout(resolve, 0));

    const duplicateTrack = container.querySelector('.cinder-marquee__item[aria-hidden="true"]');
    const gradient = duplicateTrack?.querySelector('linearGradient');
    const duplicateGradientId = gradient?.getAttribute('id') ?? '';
    const duplicateRectFill = duplicateTrack?.querySelector('rect')?.getAttribute('fill');

    expect(duplicateGradientId).not.toBe('logoGradient');
    expect(duplicateGradientId).toContain('logoGradient--cinder-marquee-duplicate-');
    expect(duplicateRectFill).toBe(`url(#${duplicateGradientId})`);
  });

  test('rewrites inline style url references in cloned marquee content', async () => {
    const { container } = render(Marquee, {
      children: inlineStyleReferenceSnippet(),
    });

    await new Promise((resolve) => setTimeout(resolve, 0));

    const duplicateTrack = container.querySelector('.cinder-marquee__item[aria-hidden="true"]');
    const duplicateClipPathId = duplicateTrack?.querySelector('clipPath')?.getAttribute('id') ?? '';
    const duplicateRectStyle =
      duplicateTrack?.querySelector('rect[style]')?.getAttribute('style') ?? '';

    expect(duplicateClipPathId).toContain('logoClip--cinder-marquee-duplicate-');
    expect(duplicateRectStyle).toContain(`url(#${duplicateClipPathId})`);
  });

  test('removes names from cloned form controls to avoid duplicate form submissions', async () => {
    const { container } = render(Marquee, {
      children: namedFormControlsSnippet(),
    });

    await new Promise((resolve) => setTimeout(resolve, 0));

    const duplicateTrack = container.querySelector('.cinder-marquee__item[aria-hidden="true"]');
    const duplicateInput = duplicateTrack?.querySelector('input');

    expect(duplicateInput?.hasAttribute('name')).toBe(false);
    expect(duplicateInput?.hasAttribute('disabled')).toBe(false);
  });
});
