import { readFileSync } from 'node:fs';

import { expect, test } from '@playwright/test';

const footerCss = readFileSync(
  new URL('../../components/src/components/footer/footer.css', import.meta.url),
  'utf8',
);

const containerWidths = [20, 40, 43, 48, 64, 90] as const;

test.describe('Footer responsive layout', () => {
  for (const width of containerWidths) {
    test(`${width}rem container keeps sparse link groups compact`, async ({ page }) => {
      await page.setContent(`
        <style>
          :root {
            --cinder-space-2: 0.5rem;
            --cinder-space-4: 1rem;
            --cinder-space-6: 1.5rem;
            --cinder-border-muted: #d1d5db;
            --cinder-surface: #ffffff;
            --cinder-text: #111827;
            --cinder-text-muted: #4b5563;
            --cinder-text-sm: 0.875rem;
            --cinder-text-lg: 1.125rem;
            --cinder-font-semibold: 600;
            --cinder-font-sans: sans-serif;
            --cinder-ring-width: 0.1875rem;
            --cinder-ring-color: #2563eb;
            --cinder-radius-sm: 0.25rem;
          }

          body {
            margin: 0;
          }

          ${footerCss}

          .cinder-footer {
            box-sizing: content-box;
            inline-size: ${width}rem;
          }
        </style>

        <footer class="cinder-footer" aria-label="Footer">
          <div class="cinder-footer__main">
            <section class="cinder-footer__brand">
              <h2 class="cinder-footer__brand-title">Acme</h2>
              <p class="cinder-footer__brand-description">Design tools for modern teams.</p>
            </section>
            <div class="cinder-footer__groups">
              <nav aria-label="Product">
                <h3 class="cinder-footer__group-title">Product</h3>
                <ul class="cinder-footer__list">
                  <li><a class="cinder-footer__link" href="/features">Features</a></li>
                  <li><a class="cinder-footer__link" href="/pricing">Pricing</a></li>
                </ul>
              </nav>
              <nav aria-label="Company">
                <h3 class="cinder-footer__group-title">Company</h3>
                <ul class="cinder-footer__list">
                  <li><a class="cinder-footer__link" href="/about">About</a></li>
                  <li><a class="cinder-footer__link" href="/careers">Careers</a></li>
                </ul>
              </nav>
            </div>
          </div>
          <div class="cinder-footer__legal">
            <span>© 2026 Acme</span>
            <ul class="cinder-footer__legal-links">
              <li><a class="cinder-footer__link" href="/privacy">Privacy</a></li>
              <li><a class="cinder-footer__link" href="/terms">Terms</a></li>
            </ul>
          </div>
        </footer>
      `);

      const brand = page.locator('.cinder-footer__brand');
      const groups = page.locator('.cinder-footer__groups');
      const product = page.getByRole('navigation', { name: 'Product' });
      const company = page.getByRole('navigation', { name: 'Company' });

      const [brandBox, groupsBox, productBox, companyBox, spacing] = await Promise.all([
        brand.boundingBox(),
        groups.boundingBox(),
        product.boundingBox(),
        company.boundingBox(),
        page.locator('.cinder-footer').evaluate((footer) => {
          const main = footer.querySelector<HTMLElement>('.cinder-footer__main');
          const groups = footer.querySelector<HTMLElement>('.cinder-footer__groups');
          const list = footer.querySelector<HTMLElement>('.cinder-footer__list');
          const legal = footer.querySelector<HTMLElement>('.cinder-footer__legal');

          if (main === null || groups === null || list === null || legal === null) {
            throw new Error('Footer fixture is missing a layout region.');
          }

          return {
            outer: getComputedStyle(footer).rowGap,
            main: getComputedStyle(main).gap,
            groups: getComputedStyle(groups).gap,
            list: getComputedStyle(list).gap,
            legal: getComputedStyle(legal).gap,
            legalPadding: getComputedStyle(legal).paddingTop,
          };
        }),
      ]);

      expect(brandBox).not.toBeNull();
      expect(groupsBox).not.toBeNull();
      expect(productBox).not.toBeNull();
      expect(companyBox).not.toBeNull();
      expect(spacing).toEqual({
        outer: '24px',
        main: '24px',
        groups: '16px',
        list: '8px',
        legal: '16px',
        legalPadding: '16px',
      });

      if (width < 48) {
        expect(groupsBox?.x).toBeCloseTo(brandBox?.x ?? 0, 0);
        expect(groupsBox?.y ?? 0).toBeGreaterThan((brandBox?.y ?? 0) + (brandBox?.height ?? 0));
      } else {
        expect(groupsBox?.x ?? 0).toBeGreaterThan((brandBox?.x ?? 0) + (brandBox?.width ?? 0));
        expect(groupsBox?.y).toBeCloseTo(brandBox?.y ?? 0, 0);
      }

      if (width === 20) {
        expect(companyBox?.y ?? 0).toBeGreaterThan(
          (productBox?.y ?? 0) + (productBox?.height ?? 0),
        );
      } else {
        expect(companyBox?.y).toBeCloseTo(productBox?.y ?? 0, 0);
        expect(productBox?.width ?? 0).toBeLessThanOrEqual(192);
        expect(companyBox?.width ?? 0).toBeLessThanOrEqual(192);
        expect((companyBox?.x ?? 0) - (productBox?.x ?? 0)).toBeLessThanOrEqual(208);
      }

      if (width === 48) {
        await groups.evaluate((element) => element.remove());
        await expect(brand).toHaveCSS('grid-column', '1 / -1');
      }

      if (width === 43) {
        await groups.evaluate((element) => {
          element.insertAdjacentHTML(
            'beforeend',
            `
              <nav aria-label="Support"><h3>Support</h3></nav>
            `,
          );
        });

        const navigationRows = await groups
          .getByRole('navigation')
          .evaluateAll((elements) => elements.map((element) => element.getBoundingClientRect().y));
        expect(navigationRows).toHaveLength(3);
        expect(new Set(navigationRows).size).toBe(1);
      }
    });
  }

  test('long group link labels wrap inside capped navigation columns', async ({ page }) => {
    await page.setContent(`
      <style>
        :root {
          --cinder-space-2: 0.5rem;
          --cinder-space-4: 1rem;
          --cinder-space-6: 1.5rem;
          --cinder-border-muted: #d1d5db;
          --cinder-surface: #ffffff;
          --cinder-text: #111827;
          --cinder-text-muted: #4b5563;
          --cinder-text-sm: 0.875rem;
          --cinder-text-lg: 1.125rem;
          --cinder-font-semibold: 600;
          --cinder-font-sans: sans-serif;
          --cinder-ring-width: 0.1875rem;
          --cinder-ring-color: #2563eb;
          --cinder-radius-sm: 0.25rem;
        }

        body {
          margin: 0;
        }

        ${footerCss}

        .cinder-footer {
          box-sizing: content-box;
          inline-size: 64rem;
        }
      </style>

      <footer class="cinder-footer" aria-label="Footer">
        <div class="cinder-footer__main">
          <section class="cinder-footer__brand">
            <h2 class="cinder-footer__brand-title">Acme</h2>
          </section>
          <div class="cinder-footer__groups">
            <nav aria-label="Product">
              <h3 class="cinder-footer__group-title">AcmeInternationalizationResources</h3>
              <ul class="cinder-footer__list">
                <li>
                  <a class="cinder-footer__link" href="/international">
                    AcmeInternationalizationDocumentation
                  </a>
                </li>
              </ul>
            </nav>
            <nav aria-label="Company">
              <h3 class="cinder-footer__group-title">Company</h3>
            </nav>
          </div>
        </div>
      </footer>
    `);

    const product = page.getByRole('navigation', { name: 'Product' });
    const longLink = product.getByRole('link');
    const longGroupTitle = product.getByRole('heading');
    const [productBox, longLinkBox, longGroupTitleBox] = await Promise.all([
      product.boundingBox(),
      longLink.boundingBox(),
      longGroupTitle.boundingBox(),
    ]);

    expect(productBox).not.toBeNull();
    expect(longLinkBox).not.toBeNull();
    expect(longGroupTitleBox).not.toBeNull();
    expect((longLinkBox?.x ?? 0) + (longLinkBox?.width ?? 0)).toBeLessThanOrEqual(
      (productBox?.x ?? 0) + (productBox?.width ?? 0),
    );
    expect((longGroupTitleBox?.x ?? 0) + (longGroupTitleBox?.width ?? 0)).toBeLessThanOrEqual(
      (productBox?.x ?? 0) + (productBox?.width ?? 0),
    );
    expect(await longGroupTitle.evaluate((title) => title.scrollWidth <= title.clientWidth)).toBe(
      true,
    );

    await page.locator('.cinder-footer').evaluate((footer) => {
      footer.style.inlineSize = '40rem';
    });
    const brand = page.locator('.cinder-footer__brand');
    const brandTitle = page.locator('.cinder-footer__brand-title');
    await brandTitle.evaluate((title) => {
      title.textContent = 'AcmeInternationalizationDocumentation';
    });
    const [brandBox, brandTitleBox] = await Promise.all([
      brand.boundingBox(),
      brandTitle.boundingBox(),
    ]);
    expect(brandBox).not.toBeNull();
    expect(brandTitleBox).not.toBeNull();
    expect((brandTitleBox?.x ?? 0) + (brandTitleBox?.width ?? 0)).toBeLessThanOrEqual(
      (brandBox?.x ?? 0) + (brandBox?.width ?? 0),
    );
  });
});
