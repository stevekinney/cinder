/// <reference lib="dom" />
import { describe, expect, test } from 'bun:test';

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

describe('LogoCloud', () => {
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
