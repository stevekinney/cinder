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
      // Tolerate the fallback form too -- `var(--cinder-space-4, 1rem)` names the same
      // token and expresses the same hierarchy, so matching only the bare form would
      // fail this test on a change that is not a regression.
      const token = block?.match(/gap:\s*var\(\s*(--cinder-space-\d+)\s*[,)]/)?.[1];
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

  test('a legal-only footer omits the main wrapper entirely', () => {
    // `copyright`/`legalLinks` without brand, description, or groups is a valid
    // combination. An unconditional `.cinder-footer__main` would still be a grid item
    // there, so the root's (now larger) main-to-legal gap would open blank space above
    // the legal row with no main region to separate it from -- the widened gap making
    // the empty wrapper more visible, not less.
    const { container } = render(Footer, {
      copyright: '© 2026 Example',
      legalLinks: [{ id: 'privacy', label: 'Privacy', href: '/privacy' }],
    });

    expect(container.querySelector('.cinder-footer__main')).toBeNull();
    expect(container.querySelector('.cinder-footer__legal')).not.toBeNull();
    expect(container.querySelector('.cinder-footer__legal')?.textContent).toContain('Privacy');
  });

  test('the main wrapper renders as soon as any of its three sources is present', () => {
    // The guard is a three-way OR; a regression that narrowed it to `brand` alone would
    // silently drop a groups-only or description-only footer's entire main region.
    // Rendered separately rather than over an array of prop objects: a mixed array
    // widens to a union that `exactOptionalPropertyTypes` rejects.
    const brandOnly = render(Footer, { brand: 'Example' });
    expect(brandOnly.container.querySelector('.cinder-footer__main')).not.toBeNull();
    brandOnly.unmount();

    const descriptionOnly = render(Footer, { description: 'A description' });
    expect(descriptionOnly.container.querySelector('.cinder-footer__main')).not.toBeNull();
    descriptionOnly.unmount();

    const groupsOnly = render(Footer, {
      groups: [
        {
          id: 'product',
          title: 'Product',
          links: [{ id: 'docs', label: 'Docs', href: '/docs' }],
        },
      ],
    });
    expect(groupsOnly.container.querySelector('.cinder-footer__main')).not.toBeNull();
    groupsOnly.unmount();
  });
});
