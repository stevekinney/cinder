/// <reference lib="dom" />
import { describe, expect, test } from 'bun:test';

import { setupHappyDom } from '../../test/happy-dom.ts';

// setupHappyDom() MUST run before any `@testing-library/svelte` import. testing-library
// reads `globalThis.document` / `window` at module-init (top-level, not inside test bodies),
// so we register happy-dom's globals first and then dynamic-import testing-library below.
setupHappyDom();

const { render } = await import('@testing-library/svelte');
const { default: Badge } = await import('./badge.svelte');
// createRawSnippet must be imported dynamically so Bun's svelte plugin (which patches
// the svelte package to resolve to the client build) applies before this import resolves.
// A top-level static import of 'svelte' resolves to svelte/index-server.js in Bun's
// non-browser environment, making `mount()` throw "not available on the server".
const { createRawSnippet } = await import('svelte');

const badgeCss = await Bun.file(new URL('./badge.css', import.meta.url)).text();

/** Creates a Svelte 5 Snippet that renders text content. */
function textSnippet(text: string) {
  return createRawSnippet(() => ({
    render: () => `<span>${text}</span>`,
  }));
}

function cssRule(selector: string): string {
  const escapedSelector = selector.replaceAll(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return badgeCss.match(new RegExp(`${escapedSelector}\\s*\\{[^}]*\\}`))?.[0] ?? '';
}

describe('Badge', () => {
  test('renders without errors', () => {
    const { container } = render(Badge, { children: textSnippet('label') });
    expect(container.querySelector('.cinder-badge')).not.toBeNull();
  });

  test('applies class prop alongside cinder-badge', () => {
    const { container } = render(Badge, {
      children: textSnippet('label'),
      class: 'my-custom-class',
    });
    const span = container.querySelector('.cinder-badge');
    expect(span?.getAttribute('class')).toContain('cinder-badge');
    expect(span?.getAttribute('class')).toContain('my-custom-class');
  });

  test.each(['neutral', 'success', 'warning', 'danger', 'info', 'accent'] as const)(
    'renders data-cinder-variant="%s"',
    (variant) => {
      const { container } = render(Badge, {
        children: textSnippet('label'),
        variant,
      });
      const span = container.querySelector('.cinder-badge');
      expect(span?.getAttribute('data-cinder-variant')).toBe(variant);
    },
  );

  test.each(['xs', 'sm', 'md'] as const)('renders data-cinder-size="%s"', (size) => {
    const { container } = render(Badge, {
      children: textSnippet('label'),
      size,
    });
    const span = container.querySelector('.cinder-badge');
    expect(span?.getAttribute('data-cinder-size')).toBe(size);
  });

  test('children snippet content is rendered', () => {
    const { container } = render(Badge, {
      children: textSnippet('hello badge'),
    });
    expect(container.querySelector('.cinder-badge')?.textContent).toContain('hello badge');
  });

  test('xs and sm sizes stay mechanically differentiated for count badges', () => {
    const xsRule = cssRule(".cinder-badge[data-cinder-size='xs']");
    const smRule = cssRule(".cinder-badge[data-cinder-size='sm']");

    expect(xsRule).toContain('font-size: 0.625rem');
    expect(xsRule).toContain('line-height: 0.875rem');
    expect(smRule).toContain('font-size: var(--cinder-text-2xs');
    expect(smRule).toContain('line-height: 1rem');
  });
});

describe('Badge — omitted children (runtime safety net)', () => {
  test('renders without throwing when children is omitted (JS consumer safety)', () => {
    // children: Snippet is required in TypeScript, but the optional-chain guard
    // ensures a JS consumer who omits it gets an empty badge rather than a crash.
    const { container } = render(Badge, { variant: 'info' } as never);
    expect(container.querySelector('.cinder-badge')).not.toBeNull();
  });
});
