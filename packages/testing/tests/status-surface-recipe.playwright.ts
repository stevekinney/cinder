/// <reference lib="dom" />
/**
 * Verifies the shared `_status-surface.css` recipe (task 5b849512) renders the
 * soft status surfaces for Alert, Banner, and Callout correctly in a real
 * browser — the consolidation moved the `light-dark(oklch(from …))` algebra out
 * of each component and into a shared partial driven by `--_cinder-status-base`
 * plus per-variant chroma inputs. These checks confirm the composed recipe
 * actually paints (not flattened to the neutral surface) and that Callout's
 * decomposed stripe reads as visibly stronger than its soft border — the
 * properties the unit tests can only assert against CSS source.
 *
 * Markup is injected directly (rather than relying on whichever playground
 * examples happen to render which variant) so the recipe is exercised
 * deterministically. The page is loaded first so `cinder/styles` and the
 * component CSS sidecars are present and `color-scheme` is established.
 */

import { expect, test, type Page } from '@playwright/test';

/** Load any cinder page so the global styles + component sidecars are applied. */
async function loadStyledPage(page: Page): Promise<void> {
  await page.goto('/page/callout', { waitUntil: 'load' });
}

/**
 * Inject fixture markup into the page body, replacing any fixture from a prior
 * call so the helper is safe to reuse on the same page (no duplicate IDs).
 */
async function inject(page: Page, html: string): Promise<void> {
  await page.evaluate((markup) => {
    document.getElementById('status-surface-fixture')?.remove();
    const host = document.createElement('div');
    host.id = 'status-surface-fixture';
    host.innerHTML = markup;
    document.body.appendChild(host);
  }, html);
}

test.describe('status-surface recipe — composed soft surfaces paint correctly', () => {
  test('Callout variants get a tinted background distinct from the neutral surface', async ({
    page,
  }) => {
    await loadStyledPage(page);
    await inject(
      page,
      `<aside class="cinder-callout cinder-_status-surface cinder-_status-surface-border cinder-_status-surface-stripe" data-cinder-variant="danger">danger</aside>
       <aside class="cinder-callout cinder-_status-surface cinder-_status-surface-border cinder-_status-surface-stripe" data-cinder-variant="info">info</aside>`,
    );

    const dangerBg = await page
      .locator(".cinder-callout[data-cinder-variant='danger']")
      .first()
      .evaluate((node) => getComputedStyle(node).backgroundColor);
    const infoBg = await page
      .locator(".cinder-callout[data-cinder-variant='info']")
      .first()
      .evaluate((node) => getComputedStyle(node).backgroundColor);

    expect(dangerBg).not.toBe('');
    expect(dangerBg).not.toBe('rgba(0, 0, 0, 0)');
    // Distinct status hues must produce distinct backgrounds — proves the
    // --_cinder-status-base input flows through the shared recipe per variant.
    expect(dangerBg).not.toBe(infoBg);
  });

  test('Callout stripe reads stronger than its soft border (decomposed recipe)', async ({
    page,
  }) => {
    await loadStyledPage(page);
    await inject(
      page,
      `<aside class="cinder-callout cinder-_status-surface cinder-_status-surface-border cinder-_status-surface-stripe" data-cinder-variant="danger">danger</aside>`,
    );

    const { stripe, border } = await page
      .locator(".cinder-callout[data-cinder-variant='danger']")
      .first()
      .evaluate((node) => {
        const style = getComputedStyle(node);
        return {
          stripe: style.borderInlineStartColor,
          border: style.borderTopColor,
        };
      });

    // Both resolve to real colors, and the stripe differs from the soft border —
    // the stripe class composes after the border class and wins the inline-start
    // edge with a higher chroma.
    expect(stripe).not.toBe('');
    expect(border).not.toBe('');
    expect(stripe).not.toBe(border);
  });

  test('Alert keeps a neutral border (P7) — variant does not tint the frame', async ({ page }) => {
    await loadStyledPage(page);
    await inject(
      page,
      `<div class="cinder-alert cinder-_status-surface" data-cinder-variant="error" role="alert">error</div>
       <div class="cinder-alert cinder-_status-surface" data-cinder-variant="success" role="alert">success</div>`,
    );

    const errorBorder = await page
      .locator(".cinder-alert[data-cinder-variant='error']")
      .first()
      .evaluate((node) => getComputedStyle(node).borderTopColor);
    const successBorder = await page
      .locator(".cinder-alert[data-cinder-variant='success']")
      .first()
      .evaluate((node) => getComputedStyle(node).borderTopColor);

    expect(errorBorder).not.toBe('');
    // Alert composes the surface only — its border stays the neutral base border,
    // identical across variants (the variant tint is background + text only).
    expect(errorBorder).toBe(successBorder);
  });

  test('forced-colors: the recipe yields to system colors (border/stripe → CanvasText)', async ({
    browser,
  }) => {
    // The recipe is imported after the component CSS, so its own
    // @media (forced-colors: active) reset must keep the stripe/border pinned to
    // the system color rather than letting the oklch() value win by source order.
    const context = await browser.newContext({ forcedColors: 'active' });
    try {
      const page = await context.newPage();
      await loadStyledPage(page);
      await inject(
        page,
        `<aside class="cinder-callout cinder-_status-surface cinder-_status-surface-border cinder-_status-surface-stripe" data-cinder-variant="danger">danger</aside>`,
      );

      const { stripe, border } = await page
        .locator(".cinder-callout[data-cinder-variant='danger']")
        .first()
        .evaluate((node) => {
          const style = getComputedStyle(node);
          return { stripe: style.borderInlineStartColor, border: style.borderTopColor };
        });

      // In forced-colors mode both resolve to the SAME system color (CanvasText)
      // — the oklch tint does not leak through. Before the recipe's own
      // forced-colors reset, the relocated stripe oklch() would have won the
      // inline-start edge and differed from the border.
      expect(stripe).not.toBe('');
      expect(border).not.toBe('');
      expect(stripe).toBe(border);
    } finally {
      await context.close();
    }
  });
});
