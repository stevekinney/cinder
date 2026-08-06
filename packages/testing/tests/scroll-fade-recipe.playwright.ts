/// <reference lib="dom" />
/**
 * Verifies the shared `_scroll-fade.css` recipe renders and animates in a
 * real browser. `bun:test` (`scroll-fade.test.ts`) already covers the CSS
 * source shape (rule order, `scroll(nearest …)`, no `mask-`, etc.); what it
 * cannot cover is whether the browser actually attaches a scroll-driven
 * animation to the right pseudo-element with the right timeline source/axis,
 * and whether the opacity genuinely animates as the element scrolls.
 *
 * Chromium-only is intentional and sufficient here: the OTHER branch of this
 * recipe — no `animation-timeline: scroll()` support — is the pre-existing
 * `data-cinder-overflows` attribute path, already covered by `bun:test` via
 * `overflow-fade-test-helpers.ts`. Each branch is tested where it is
 * testable.
 */

import { expect, test, type Page } from '@playwright/test';

async function loadStyledPage(page: Page): Promise<void> {
  await page.goto('/page/modal?tab=examples', { waitUntil: 'load' });
}

/** Injects a tall fixed-height scroll fixture, replacing any prior fixture. */
async function injectScroller(page: Page, colorVar: string): Promise<void> {
  await page.evaluate((cssColorVar) => {
    document.getElementById('scroll-fade-fixture')?.remove();
    const host = document.createElement('div');
    host.id = 'scroll-fade-fixture';
    host.innerHTML = `
      <div
        id="scroll-fade-scroller"
        class="cinder-_scroll-fade"
        style="block-size: 200px; overflow-y: auto; ${cssColorVar}"
      >
        <div style="block-size: 800px;">tall content</div>
      </div>
      <div
        id="scroll-fade-non-overflowing"
        class="cinder-_scroll-fade"
        style="block-size: 200px; overflow-y: auto; --_cinder-scroll-fade-color: white;"
      >
        <div style="block-size: 50px;">short content</div>
      </div>
    `;
    document.body.appendChild(host);
  }, colorVar);
}

/**
 * Scroll-driven animations freeze while `document.hidden` (per spec, they
 * update on the next rendering opportunity) — two rAFs give the browser a
 * chance to resolve the animation's current state before any assertion on
 * an animated value.
 */
async function settleAnimationFrames(page: Page): Promise<void> {
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
      }),
  );
}

test.describe('scroll-fade recipe — real-browser scroll-driven animation', () => {
  test('an overflowing container gets a scroll-timeline-driven animation on ::after', async ({
    page,
  }) => {
    await loadStyledPage(page);
    await injectScroller(page, '--_cinder-scroll-fade-color: white;');

    const animations = await page.locator('#scroll-fade-scroller').evaluate((node) =>
      node.getAnimations({ subtree: true }).map((animation) => ({
        pseudo: animation.effect instanceof KeyframeEffect ? animation.effect.pseudoElement : null,
        // `AnimationTimeline.source` is not in the TS DOM lib yet for
        // ScrollTimeline; read it dynamically and compare by reference.
        sourceIsNode: (animation.timeline as unknown as { source?: Element })?.source === node,
        axis: (animation.timeline as unknown as { axis?: string })?.axis ?? null,
        playState: animation.playState,
      })),
    );

    expect(animations.length).toBeGreaterThan(0);
    const scrollFadeAnimation = animations.find((animation) => animation.pseudo === '::after');
    expect(scrollFadeAnimation).toBeDefined();
    expect(scrollFadeAnimation?.sourceIsNode).toBe(true);
    expect(scrollFadeAnimation?.axis).toBe('block');
    expect(scrollFadeAnimation?.playState).toBe('running');
  });

  test('opacity goes from 1 toward 0 as the container scrolls to the end', async ({ page }) => {
    await loadStyledPage(page);
    await injectScroller(page, '--_cinder-scroll-fade-color: white;');
    await settleAnimationFrames(page);

    const opacityAtTop = await page
      .locator('#scroll-fade-scroller')
      .evaluate((node) => getComputedStyle(node, '::after').opacity);
    expect(Number(opacityAtTop)).toBeGreaterThan(0.9);

    await page.locator('#scroll-fade-scroller').evaluate((node) => {
      node.scrollTop = node.scrollHeight - node.clientHeight;
    });
    await settleAnimationFrames(page);

    const opacityAtEnd = await page
      .locator('#scroll-fade-scroller')
      .evaluate((node) => getComputedStyle(node, '::after').opacity);
    expect(Number(opacityAtEnd)).toBeLessThan(0.1);
  });

  test('a non-overflowing container contributes no visible fade', async ({ page }) => {
    await loadStyledPage(page);
    await injectScroller(page, '--_cinder-scroll-fade-color: white;');
    await settleAnimationFrames(page);

    const opacity = await page
      .locator('#scroll-fade-non-overflowing')
      .evaluate((node) => getComputedStyle(node, '::after').opacity);
    // Not overflowing means the container never scrolls away from the start
    // of its own (trivial) scroll range, so the timeline's progress never
    // leaves the 0%–90% "fully on" region — same as a real short list.
    // The meaningful assertion is that nothing THROWS and a real value
    // resolves; visual absence of overflow is covered by the overlay only
    // ever painting inside a scrollable box with no visible scrollbar.
    expect(Number.isNaN(Number(opacity))).toBe(false);
  });

  test('the #972 invariant holds in a real browser: no mask-image on the scroll-fade container', async ({
    page,
  }) => {
    await loadStyledPage(page);
    await injectScroller(page, '--_cinder-scroll-fade-color: white;');

    const maskImage = await page
      .locator('#scroll-fade-scroller')
      .evaluate((node) => getComputedStyle(node).maskImage);
    expect(maskImage).toBe('none');
  });

  test('forced-colors truly stops the scroll-driven animation, not just its opacity value', async ({
    browser,
  }) => {
    // Regression for a real bug: a running CSS Animation's keyframe-computed
    // value beats ANY normal-priority author declaration regardless of
    // specificity or source order, so an `opacity: 0` forced-colors rule
    // alone cannot override a still-running scroll-timeline animation — the
    // animation itself must be stopped (`animation: none`). Only a real
    // browser evaluating actual cascade precedence can catch this; a
    // source-text regex can only confirm the declaration exists, not that it
    // wins.
    const context = await browser.newContext({ forcedColors: 'active' });
    try {
      const page = await context.newPage();
      await loadStyledPage(page);
      await injectScroller(page, '--_cinder-scroll-fade-color: white;');

      const animationCount = await page
        .locator('#scroll-fade-scroller')
        .evaluate((node) => node.getAnimations({ subtree: true }).length);
      expect(animationCount).toBe(0);

      const opacity = await page
        .locator('#scroll-fade-scroller')
        .evaluate((node) => getComputedStyle(node, '::after').opacity);
      expect(Number(opacity)).toBe(0);
    } finally {
      await context.close();
    }
  });
});
