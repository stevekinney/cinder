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

  test('omits the brand section when no brand or description is provided', () => {
    const { container } = render(Footer, {});
    expect(container.querySelector('.cinder-footer__brand')).toBeNull();
  });

  test('omits the groups section when groups is empty', () => {
    const { container } = render(Footer, { groups: [] });
    expect(container.querySelector('.cinder-footer__groups')).toBeNull();
  });

  test('omits the legal row when there is no copyright and no legal links', () => {
    const { container } = render(Footer, { legalLinks: [] });
    expect(container.querySelector('.cinder-footer__legal')).toBeNull();
  });

  test('renders one nav per group and links each anchor to its source href', () => {
    const groups = [
      {
        id: 'product',
        title: 'Product',
        links: [
          { id: 'docs', label: 'Docs', href: '/docs' },
          { id: 'pricing', label: 'Pricing', href: '/pricing' },
        ],
      },
      {
        id: 'company',
        title: 'Company',
        links: [
          { id: 'about', label: 'About', href: '/about' },
          { id: 'careers', label: 'Careers', href: '/careers' },
        ],
      },
    ];
    const { container } = render(Footer, { groups });

    const navs = container.querySelectorAll('nav');
    expect(navs.length).toBe(2);

    for (const group of groups) {
      for (const link of group.links) {
        const anchor = Array.from(container.querySelectorAll('a.cinder-footer__link')).find(
          (element) => element.textContent === link.label,
        );
        expect(anchor?.getAttribute('href')).toBe(link.href);
      }
    }
  });
});
