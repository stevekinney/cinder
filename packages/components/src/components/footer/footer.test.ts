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

  test('CIN-124: resting spacing forms a strictly increasing related-to-unrelated hierarchy', async () => {
    // Regression for CIN-124: proximity should communicate relationship.
    // Same-group links (most related) < sibling nav groups < brand-to-groups
    // (still related, inside .cinder-footer__main) < main-to-legal (the
    // least related pairing, and the only one reinforced by a rule/padding
    // boundary too). Each step must resolve to a distinct px value so no two
    // relationships of different closeness collapse onto the same gap --
    // that collision (both using --cinder-space-6) is exactly what made
    // CIN-124 still real. Asserted against the shipped CSS source (not
    // computed styles) because this test does not load a real CSS engine;
    // the resting layout math itself is covered by
    // packages/testing/tests/footer-layout.playwright.ts.
    const css = await Bun.file(new URL('./footer.css', import.meta.url)).text();

    const tokenPx: Record<string, number> = {
      '--cinder-space-2': 8,
      '--cinder-space-4': 16,
      '--cinder-space-6': 24,
      '--cinder-space-8': 32,
    };

    function gapTokenFor(selector: string): string {
      // Escape every regex metacharacter, matching the repo's cssRuleBody() helpers
      // (see chip.test.ts). Escaping only `.` and `#` would break the moment a selector
      // here grows a `:where(...)`, an attribute matcher, or a `+`/`~` combinator.
      const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const block = css.match(new RegExp(`${escapedSelector}\\s*\\{([^}]*)\\}`))?.[1];
      const token = block?.match(/gap:\s*var\((--cinder-space-\d+)\)/)?.[1];
      if (!token) {
        throw new Error(`Expected a --cinder-space-* gap token on ${selector}`);
      }
      return token;
    }

    const listToken = gapTokenFor('.cinder-footer__list');
    const groupsToken = gapTokenFor('.cinder-footer__groups');
    const mainToken = gapTokenFor('.cinder-footer__main');
    const footerToken = gapTokenFor('.cinder-footer');

    function pxFor(token: string, selector: string): number {
      const px = tokenPx[token];
      if (px === undefined) {
        throw new Error(`Unmapped spacing token ${token} on ${selector}`);
      }
      return px;
    }

    const listPx = pxFor(listToken, '.cinder-footer__list');
    const groupsPx = pxFor(groupsToken, '.cinder-footer__groups');
    const mainPx = pxFor(mainToken, '.cinder-footer__main');
    const footerPx = pxFor(footerToken, '.cinder-footer');

    expect(listPx).toBeLessThan(groupsPx);
    expect(groupsPx).toBeLessThan(mainPx);
    expect(mainPx).toBeLessThan(footerPx);

    // The main-to-legal gap must not reuse the same token as any
    // related-sibling gap inside .cinder-footer__main.
    expect(footerToken).not.toBe(mainToken);
    expect(footerToken).not.toBe(groupsToken);
    expect(footerToken).not.toBe(listToken);

    // The unrelated legal row keeps its own rule + padding boundary too.
    const legalBlock = css.match(/\.cinder-footer__legal\s*\{([^}]*)\}/)?.[1] ?? '';
    expect(legalBlock).toContain('border-top: 1px solid var(--cinder-border-muted)');
    expect(legalBlock).toContain('padding-top: var(--cinder-space-2)');
  });
});
