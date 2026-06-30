/// <reference lib="dom" />
import { afterEach, describe, expect, test } from 'bun:test';

import { setupHappyDom } from '../../test/happy-dom.ts';

setupHappyDom();

const { cleanup, render } = await import('@testing-library/svelte');
const { default: Footer } = await import('./footer.svelte');

afterEach(() => cleanup());

describe('Footer', () => {
  test('renders footer semantics and groups', () => {
    const { container } = render(Footer, {
      brand: 'Acme',
      description: 'Build better interfaces.',
      groups: [
        { id: 'product', title: 'Product', links: [{ id: 'docs', label: 'Docs', href: '/docs' }] },
      ],
      legalLinks: [{ id: 'privacy', label: 'Privacy', href: '/privacy' }],
      copyright: '© 2026 Acme',
    });

    const footer = container.querySelector('footer');
    expect(footer).not.toBeNull();
    expect(footer?.getAttribute('aria-label')).toBe('Footer');
    expect(container.textContent).toContain('Acme');
    expect(container.textContent).toContain('Product');
    expect(container.textContent).toContain('Privacy');
  });
});
