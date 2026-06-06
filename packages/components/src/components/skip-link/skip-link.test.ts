/// <reference lib="dom" />
import { afterEach, describe, expect, test } from 'bun:test';

import { setupHappyDom } from '../../test/happy-dom.ts';

// setupHappyDom() MUST run before any `@testing-library/svelte` import. testing-library
// reads `globalThis.document` / `window` at module-init (top-level, not inside test bodies),
// so we register happy-dom's globals first and then dynamic-import testing-library below.
setupHappyDom();

const { render, fireEvent, cleanup } = await import('@testing-library/svelte');
const { default: SkipLink } = await import('./skip-link.svelte');

// Unmount rendered trees between tests so they don't leak into the shared document.body.
afterEach(() => cleanup());
// createRawSnippet must be imported dynamically so Bun's svelte plugin (which patches
// the svelte package to resolve to the client build) applies before this import resolves.
const { createRawSnippet } = await import('svelte');

function textSnippet(text: string) {
  return createRawSnippet(() => ({
    render: () => `<span>${text}</span>`,
  }));
}

// All props must go under `props:` to avoid collisions with Svelte's own
// render options (`target`, `anchor`, etc.).
describe('SkipLink', () => {
  test('renders an anchor element', () => {
    const { container } = render(SkipLink, { props: { target: 'main' } });
    expect(container.querySelector('a')).not.toBeNull();
  });

  test('rendered anchor has href set to #target', () => {
    const { container } = render(SkipLink, { props: { target: 'main-content' } });
    const anchor = container.querySelector('a');
    expect(anchor?.getAttribute('href')).toBe('#main-content');
  });

  test('renders default label when no children provided', () => {
    const { container } = render(SkipLink, { props: { target: 'main' } });
    expect(container.querySelector('a')?.textContent).toContain('Skip to main content');
  });

  test('renders custom children when provided', () => {
    const { container } = render(SkipLink, {
      props: { target: 'main', children: textSnippet('Jump to content') },
    });
    expect(container.querySelector('a')?.textContent).toContain('Jump to content');
  });

  test('applies the visually-hidden sr-only classes', () => {
    const { container } = render(SkipLink, { props: { target: 'main' } });
    const anchor = container.querySelector('a');
    expect(anchor?.classList.contains('cinder-sr-only')).toBe(true);
    expect(anchor?.classList.contains('cinder-sr-only-focusable')).toBe(true);
  });

  test('merges a consumer-provided class onto the anchor', () => {
    const { container } = render(SkipLink, {
      props: { target: 'main', class: 'my-class' },
    });
    const anchor = container.querySelector('a');
    expect(anchor?.classList.contains('cinder-sr-only')).toBe(true);
    expect(anchor?.classList.contains('my-class')).toBe(true);
  });

  test('focuses target element when clicked and target exists', () => {
    // Set up a target element in the document body with a stub for scrollIntoView.
    const targetElement = document.createElement('main');
    targetElement.id = 'my-main';
    // happy-dom may not implement scrollIntoView; stub it so handleClick does not throw.
    targetElement.scrollIntoView = () => {};
    document.body.appendChild(targetElement);

    try {
      const { container } = render(SkipLink, { props: { target: 'my-main' } });
      const anchor = container.querySelector('a')!;

      fireEvent.click(anchor);

      expect(document.activeElement).toBe(targetElement);
      // tabindex should be set to -1 while the element has focus.
      expect(targetElement.getAttribute('tabindex')).toBe('-1');
    } finally {
      document.body.removeChild(targetElement);
    }
  });

  test('restores the original tabindex on blur when none was set', () => {
    const targetElement = document.createElement('main');
    targetElement.id = 'restore-test';
    targetElement.scrollIntoView = () => {};
    document.body.appendChild(targetElement);

    try {
      const { container } = render(SkipLink, { props: { target: 'restore-test' } });
      const anchor = container.querySelector('a')!;

      fireEvent.click(anchor);
      // tabindex is -1 while focused.
      expect(targetElement.getAttribute('tabindex')).toBe('-1');

      // Simulate blur — the once-listener should fire and restore the original state.
      fireEvent.blur(targetElement);
      // No original tabindex existed, so the attribute should be removed.
      expect(targetElement.hasAttribute('tabindex')).toBe(false);
    } finally {
      document.body.removeChild(targetElement);
    }
  });

  test('restores a pre-existing tabindex on blur', () => {
    const targetElement = document.createElement('div');
    targetElement.id = 'has-tabindex';
    targetElement.setAttribute('tabindex', '0');
    targetElement.scrollIntoView = () => {};
    document.body.appendChild(targetElement);

    try {
      const { container } = render(SkipLink, { props: { target: 'has-tabindex' } });
      const anchor = container.querySelector('a')!;

      fireEvent.click(anchor);
      expect(targetElement.getAttribute('tabindex')).toBe('-1');

      fireEvent.blur(targetElement);
      expect(targetElement.getAttribute('tabindex')).toBe('0');
    } finally {
      document.body.removeChild(targetElement);
    }
  });

  test('restores the genuine original tabindex when re-activated before blur', () => {
    // Regression: clicking twice without an intervening blur must not recapture
    // the temporary -1 as the "original" value, nor stack a second restore listener.
    const targetElement = document.createElement('div');
    targetElement.id = 'double-activate';
    targetElement.setAttribute('tabindex', '0');
    targetElement.scrollIntoView = () => {};
    document.body.appendChild(targetElement);

    try {
      const { container } = render(SkipLink, { props: { target: 'double-activate' } });
      const anchor = container.querySelector('a')!;

      fireEvent.click(anchor);
      expect(targetElement.getAttribute('tabindex')).toBe('-1');
      // Second activation before blur — must NOT capture -1 as the original.
      fireEvent.click(anchor);
      expect(targetElement.getAttribute('tabindex')).toBe('-1');

      fireEvent.blur(targetElement);
      // The genuine original ('0') is restored, not the temporary '-1'.
      expect(targetElement.getAttribute('tabindex')).toBe('0');
    } finally {
      document.body.removeChild(targetElement);
    }
  });

  test('lets the native anchor jump happen when the target element is missing', () => {
    const { container } = render(SkipLink, { props: { target: 'nonexistent-id' } });
    const anchor = container.querySelector('a')!;

    let defaultPrevented = false;
    anchor.addEventListener('click', (event) => {
      defaultPrevented = event.defaultPrevented;
    });

    fireEvent.click(anchor);
    // Default not prevented — native anchor navigation takes over.
    expect(defaultPrevented).toBe(false);
  });
});
