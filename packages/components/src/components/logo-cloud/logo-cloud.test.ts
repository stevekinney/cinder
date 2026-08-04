/// <reference lib="dom" />
import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';

import { setupHappyDom } from '../../test/happy-dom.ts';

// setupHappyDom() MUST run before any `@testing-library/svelte` import. testing-library
// reads `globalThis.document` / `window` at module-init (top-level, not inside test bodies),
// so we register happy-dom's globals first and then dynamic-import testing-library below.
setupHappyDom();

const { render } = await import('@testing-library/svelte');
const { default: LogoCloud } = await import('./logo-cloud.svelte');
const { createRawSnippet } = await import('svelte');
const runtimePatchSnippet = createRawSnippet(() => ({
  render: () => '<span></span>',
  setup: () => {},
}));
void runtimePatchSnippet;

const logos = [
  { name: 'Acme', src: '/acme.svg', href: '/customers/acme' },
  { name: 'Orbit', src: '/orbit.svg' },
];

const acceptedColumns = [3, 4, 5, 6] as const;

describe('LogoCloud', () => {
  test('composes the shared Grid and its stylesheet', () => {
    const stylesheet = readFileSync(new URL('./logo-cloud.css', import.meta.url), 'utf8');
    const component = readFileSync(new URL('./logo-cloud.svelte', import.meta.url), 'utf8');
    expect(stylesheet).toContain("@import '../grid/grid.css';");
    expect(component).toContain('<Grid');
    expect(component).toContain('as="ul"');
    expect(component).toContain('gap="var(--cinder-space-5)"');
    expect(component).not.toContain('columns={2}');
  });

  test('renders every accepted columns prop through the shared Grid', () => {
    for (const columns of acceptedColumns) {
      const props = { logos, columns };
      const { container, unmount } = render(LogoCloud, { props });
      const root = container.querySelector('.cinder-logo-cloud');
      expect(root?.getAttribute('data-cinder-columns')).toBe(String(columns));
      expect(root?.querySelector('ul.cinder-logo-cloud__list.cinder-grid')).not.toBeNull();
      unmount();
    }
    const { container, unmount } = render(LogoCloud, { props: { logos } });
    const root = container.querySelector('.cinder-logo-cloud');
    expect(root?.getAttribute('data-cinder-columns')).toBe('5');
    expect(root?.querySelector('ul.cinder-logo-cloud__list.cinder-grid')).not.toBeNull();
    unmount();
  });

  test('renders logo images and optional links', () => {
    const { container } = render(LogoCloud, {
      props: {
        title: 'Trusted by teams',
        logos,
      },
    });

    const element = container.querySelector('.cinder-logo-cloud');
    expect(element).not.toBeNull();
    expect(container.querySelectorAll('.cinder-logo-cloud__image')).toHaveLength(2);
    expect(container.querySelector('.cinder-logo-cloud__link')?.getAttribute('href')).toBe(
      '/customers/acme',
    );
  });

  test('applies layout attributes and grayscale data flag', () => {
    const { container } = render(LogoCloud, {
      props: {
        logos,
        columns: 6,
        grayscale: true,
      },
    });
    const root = container.querySelector('.cinder-logo-cloud');
    expect(root?.getAttribute('data-cinder-columns')).toBe('6');
    expect(root?.querySelector('.cinder-logo-cloud__list')?.classList.contains('cinder-grid')).toBe(
      true,
    );
    expect(root?.hasAttribute('data-cinder-grayscale')).toBe(true);
  });

  test('merges custom class alongside base class', () => {
    const { container } = render(LogoCloud, {
      props: {
        logos,
        class: 'my-custom-class',
      },
    });
    const element = container.querySelector('.cinder-logo-cloud');
    expect(element?.classList.contains('cinder-logo-cloud')).toBe(true);
    expect(element?.classList.contains('my-custom-class')).toBe(true);
  });
});
