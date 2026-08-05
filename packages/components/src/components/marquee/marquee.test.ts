/// <reference lib="dom" />
import { afterEach, describe, expect, mock, test } from 'bun:test';
import { join } from 'node:path';

import { setupHappyDom } from '../../test/happy-dom.ts';

// setupHappyDom() MUST run before any `@testing-library/svelte` import. testing-library
// reads `globalThis.document` / `window` at module-init (top-level, not inside test bodies),
// so we register happy-dom's globals first and then dynamic-import testing-library below.
setupHappyDom();

const { cleanup, render } = await import('@testing-library/svelte');
const { default: Marquee } = await import('./marquee.svelte');
const marqueeCssPath = join(import.meta.dir, './marquee.css');
// createRawSnippet must be imported dynamically so Bun's svelte plugin (which patches
// the svelte package to resolve to the client build) applies before this import resolves.
// A top-level static import of 'svelte' resolves to svelte/index-server.js in Bun's
// non-browser environment, making `mount()` throw "not available on the server".
const { createRawSnippet } = await import('svelte');

afterEach(() => {
  cleanup();
});

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

  test('renders a keyboard-accessible pause control inside the viewport', async () => {
    const { container, getByRole } = render(Marquee, {
      children: textSnippet('content'),
    });

    const element = container.querySelector('.cinder-marquee');
    const control = getByRole('button', { name: 'Pause marquee animation' });

    expect(container.querySelector('.cinder-marquee__viewport')?.contains(control)).toBe(true);
    expect(control.getAttribute('aria-pressed')).toBe('false');
    expect(element?.getAttribute('data-cinder-manual-paused')).toBe('false');

    control.click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(getByRole('button', { name: 'Resume marquee animation' })).toBe(control);
    expect(control.getAttribute('aria-pressed')).toBe('true');
    expect(element?.getAttribute('data-cinder-manual-paused')).toBe('true');
    expect(element?.getAttribute('data-cinder-manual-resumed')).toBe('false');

    control.click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(getByRole('button', { name: 'Pause marquee animation' })).toBe(control);
    expect(control.getAttribute('aria-pressed')).toBe('false');
    expect(element?.getAttribute('data-cinder-manual-paused')).toBe('false');
    expect(element?.getAttribute('data-cinder-manual-resumed')).toBe('true');
  });

  test('manual resume overrides focus pause while the control remains focused', async () => {
    const css = await Bun.file(marqueeCssPath).text();

    expect(css).toMatch(
      /\.cinder-marquee\[data-cinder-pause-focus='true'\]:not\(\s*\[data-cinder-manual-resumed='true'\]\s*\):focus-within\s+\.cinder-marquee__track/,
    );
  });

  test('manual resume overrides hover pause while the pointer remains over the marquee', async () => {
    const css = await Bun.file(marqueeCssPath).text();

    expect(css).toMatch(
      /\.cinder-marquee\[data-cinder-pause-hover='true'\]:not\(\s*\[data-cinder-manual-resumed='true'\]\s*\):hover\s+\.cinder-marquee__track/,
    );
  });

  test('manual resume override stays active when focus moves from the control to the viewport', async () => {
    const { container, getByRole } = render(Marquee, {
      props: { children: textSnippet('content') },
    });
    const element = container.querySelector<HTMLElement>('.cinder-marquee');
    const viewport = container.querySelector<HTMLDivElement>('.cinder-marquee__viewport');
    const control = getByRole('button', { name: 'Pause marquee animation' });

    control.click();
    control.click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(element?.getAttribute('data-cinder-manual-resumed')).toBe('true');

    element?.dispatchEvent(new FocusEvent('focusout', { bubbles: true, relatedTarget: viewport }));
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(element?.getAttribute('data-cinder-manual-resumed')).toBe('true');
  });

  test('manual resume override clears after focus leaves the marquee', async () => {
    const { container, getByRole } = render(Marquee, {
      props: { children: textSnippet('content') },
    });
    const element = container.querySelector<HTMLElement>('.cinder-marquee');
    const outsideButton = document.createElement('button');
    document.body.append(outsideButton);
    const control = getByRole('button', { name: 'Pause marquee animation' });

    try {
      control.click();
      control.click();
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(element?.getAttribute('data-cinder-manual-resumed')).toBe('true');

      element?.dispatchEvent(
        new FocusEvent('focusout', { bubbles: true, relatedTarget: outsideButton }),
      );
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(element?.getAttribute('data-cinder-manual-resumed')).toBe('false');
    } finally {
      outsideButton.remove();
    }
  });

  test('manual resume override clears after pointer leaves the marquee', async () => {
    const { container, getByRole } = render(Marquee, {
      props: { children: textSnippet('content') },
    });
    const element = container.querySelector<HTMLElement>('.cinder-marquee');
    const control = getByRole('button', { name: 'Pause marquee animation' });

    control.click();
    control.click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(element?.getAttribute('data-cinder-manual-resumed')).toBe('true');

    element?.dispatchEvent(new PointerEvent('pointerleave', { bubbles: false }));
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(element?.getAttribute('data-cinder-manual-resumed')).toBe('false');
  });

  test('manual resume override stays active when pointer leaves while control is focused', async () => {
    const { container, getByRole } = render(Marquee, {
      props: { children: textSnippet('content') },
    });
    const element = container.querySelector<HTMLElement>('.cinder-marquee');
    const control = getByRole('button', { name: 'Pause marquee animation' });

    control.click();
    control.click();
    control.focus();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(document.activeElement).toBe(control);
    expect(element?.getAttribute('data-cinder-manual-resumed')).toBe('true');

    element?.dispatchEvent(new PointerEvent('pointerleave', { bubbles: false }));
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(element?.getAttribute('data-cinder-manual-resumed')).toBe('true');
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

  test('treats an explicit null aria-labelledby the same as omitting it', () => {
    const { container } = render(Marquee, {
      props: {
        'aria-labelledby': null,
        children: textSnippet('content'),
      } as never,
    });
    const element = container.querySelector('.cinder-marquee');
    expect(element?.hasAttribute('aria-labelledby')).toBe(false);
    expect(element?.hasAttribute('role')).toBe(false);
  });

  test('reduced-motion CSS disables animation, restores overflow access, and hides duplicate', async () => {
    const css = await Bun.file(marqueeCssPath).text();
    expect(css).toContain('overflow: clip');

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

  test('coalesces a burst of mutations into one clone-and-rewrite pass per frame (#1186 row 5)', async () => {
    const originalRequestAnimationFrame = globalThis.requestAnimationFrame;
    const originalCancelAnimationFrame = globalThis.cancelAnimationFrame;
    const frameCallbacks = new Map<number, FrameRequestCallback>();
    let nextFrameId = 1;
    globalThis.requestAnimationFrame = (callback: FrameRequestCallback) => {
      const id = nextFrameId;
      nextFrameId += 1;
      frameCallbacks.set(id, callback);
      return id;
    };
    globalThis.cancelAnimationFrame = (id: number) => {
      frameCallbacks.delete(id);
    };
    function flushOneFrame() {
      const callbacks = Array.from(frameCallbacks.values());
      frameCallbacks.clear();
      for (const callback of callbacks) callback(performance.now());
    }

    try {
      const { container } = render(Marquee, { children: textSnippet('content') });
      // Let the effect's own eager, unbatched initial sync settle first.
      await new Promise((resolve) => setTimeout(resolve, 0));

      const primaryItem = container.querySelector<HTMLElement>(
        '.cinder-marquee__item:not([aria-hidden="true"])',
      );
      const primarySpan = primaryItem?.querySelector('span');
      if (!primaryItem || !primarySpan) throw new Error('Missing primary marquee track item.');

      const cloneNodeSpy = mock(primaryItem.cloneNode.bind(primaryItem));
      primaryItem.cloneNode = cloneNodeSpy;

      // Five separate, microtask-spaced mutations — each fires its own
      // MutationObserver callback (unlike synchronous mutations, which the
      // observer would batch into a single callback on its own regardless
      // of this fix), so this exercises the rAF-level coalescing rather
      // than native MutationObserver record batching.
      for (let index = 0; index < 5; index += 1) {
        primarySpan.className = `mutation-${index}`;
        // eslint-disable-next-line no-await-in-loop
        await new Promise((resolve) => setTimeout(resolve, 0));
      }

      // No clone-and-rewrite pass until a frame is flushed, no matter how
      // many mutation-driven observer callbacks fired.
      expect(cloneNodeSpy).toHaveBeenCalledTimes(0);

      flushOneFrame();
      expect(cloneNodeSpy).toHaveBeenCalledTimes(1);

      // The duplicate track picked up the final mutation's class, proving
      // the coalesced sync still ran (liveness), not just fewer clones.
      const duplicateTrack = container.querySelector('.cinder-marquee__item[aria-hidden="true"]');
      expect(duplicateTrack?.querySelector('span')?.className).toBe('mutation-4');
    } finally {
      globalThis.requestAnimationFrame = originalRequestAnimationFrame;
      globalThis.cancelAnimationFrame = originalCancelAnimationFrame;
    }
  });
});
