/// <reference lib="dom" />
/**
 * CIN-34: proof that the GENERATED token CSS is what actually paints.
 *
 * Every other guard in the token pipeline compares one generated artifact to
 * another — the corpus to the registry, the registry to `tokens-base.css`, the
 * resolved contexts to the corpus. All of them would still pass if the
 * stylesheet never reached the browser, or reached it and lost to something
 * else. These three tests close that gap by reading computed style off a real
 * page: a reduced-motion token zeroing a real component's transition, a token
 * override staying scoped to the component it was set on, and theme reach
 * extending past color to a dimension token.
 *
 * All three use the PLAIN documentation page, never `?snapshot=1`.
 * `snapshot-mode.ts` freezes motion with `transition-duration: 0s !important`
 * so screenshots are stable, which makes a snapshot page structurally unable to
 * show that a duration token changed anything. `overlay-reduced-motion-exit`
 * avoids `?snapshot=1` for the same reason.
 *
 * Reduced motion is emulated per-test with `page.emulateMedia` rather than by
 * the `chromium-reduced-motion` project in `playwright.config.ts`, which is
 * `testMatch`-scoped to one other file and sets the preference for a whole
 * context. This test has to observe BOTH states to show the token changed
 * anything, and a context-level preference cannot be flipped mid-test.
 */

import { expect, test } from '@playwright/test';

type Page = import('@playwright/test').Page;
type Locator = import('@playwright/test').Locator;

/**
 * Navigate to a documentation page and wait for it to finish hydrating.
 *
 * `toBeVisible()` is not enough before reading computed style. The page is
 * server-rendered and then hydrated, and hydration REPLACES nodes: a locator
 * resolved before it can be re-resolved afterwards onto a detached element,
 * whose `getComputedStyle` reports every property as the empty string. That
 * produced two failures that reproduced only in CI — a `NaN` duration and an
 * empty border colour — while passing locally, where hydration won the race.
 *
 * `page-bundle.ts` stamps `data-playground-controls-hydrated` on `#app` when it
 * is done, which `playground-documentation.playwright.ts` already waits on.
 */
async function gotoDocumentationPage(page: Page, path: string): Promise<void> {
  await page.goto(path, { waitUntil: 'load' });
  await expect(page.locator('#app')).toHaveAttribute('data-playground-controls-hydrated', '');
}

/** Read one resolved custom property off `:root`. */
async function rootToken(page: Page, property: string): Promise<string> {
  return page.evaluate(
    (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim(),
    property,
  );
}

/**
 * A CSS time value in seconds.
 *
 * The corpus authors durations in `ms`, but a registered custom property's
 * COMPUTED value is normalised — `0ms` is reported as `0s` — so comparing the
 * literal text would pin a serialization detail rather than the value.
 */
function timeToSeconds(value: string): number {
  const trimmed = value.trim();
  const amount = Number.parseFloat(trimmed);
  return trimmed.endsWith('ms') ? amount / 1000 : amount;
}

/** Longest `transition-duration` component, in seconds. */
async function longestTransitionSeconds(locator: Locator): Promise<number> {
  const raw = await locator.evaluate((element) => getComputedStyle(element).transitionDuration);
  const parts = raw.split(',').map((part) => Number.parseFloat(part.trim()));
  return Math.max(...parts);
}

test.describe('generated token CSS drives visible styles', () => {
  test('reduced motion zeroes both the duration token and a Button transition', async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await gotoDocumentationPage(page, '/page/button');

    const button = page.locator('.cinder-button').first();
    await expect(button).toBeVisible();

    /*
     * Precondition the rest of the test rests on: the component has to be
     * animating in the first place. A component that never had a transition
     * would satisfy the reduced-motion assertion trivially.
     */
    expect(timeToSeconds(await rootToken(page, '--cinder-duration-fast'))).toBeCloseTo(0.12, 5);
    await expect.poll(async () => longestTransitionSeconds(button)).toBeGreaterThan(0);

    await page.emulateMedia({ reducedMotion: 'reduce' });

    /*
     * Two independent mechanisms have to hold, and they are worth asserting
     * separately because either could regress alone:
     *
     *   - the generated token itself flips to `0ms`, from the
     *     `@media (prefers-reduced-motion: reduce)` block in `tokens-base.css`;
     *   - what the component actually paints collapses to effectively nothing.
     *
     * The painted value is compared numerically rather than against a literal:
     * `foundation.css` wins the cascade here with `0.01ms !important`, which the
     * browser reports as `1e-05s`. Asserting that exact string would pin a
     * serialization detail; asserting "under a millisecond" pins the behaviour.
     */
    await expect
      .poll(async () => timeToSeconds(await rootToken(page, '--cinder-duration-fast')))
      .toBe(0);
    await expect.poll(async () => longestTransitionSeconds(button)).toBeLessThan(0.001);
  });

  test('a token override scoped to one component does not leak to another', async ({ page }) => {
    await gotoDocumentationPage(page, '/page/card');
    await expect(page.locator('.cinder-accordion').first()).toBeVisible();

    /*
     * Both components are DISCOVERED by responding to `--cinder-border`, not
     * named up front.
     *
     * Naming them went wrong twice. The ticket's suggested pair used a token
     * CIN-33 had renamed away; the pair I chose to replace it (Card and
     * Accordion) merely painted the same colour — Card does not read this token
     * at all on this page, so overriding it moved nothing and the "the other one
     * did not move" assertion was passing for no reason. Requiring a measured
     * response is what stops this test from quietly proving nothing.
     *
     * It runs as one evaluate because the point is a single style
     * recalculation: `getComputedStyle` flushes synchronously, so the before and
     * after reads cannot straddle an unrelated repaint.
     */
    const OVERRIDE = 'rgb(255, 0, 255)';
    const result = await page.evaluate((override) => {
      /** The component class of an element, if it carries one. */
      const componentName = (element: Element): string | null =>
        Array.from(element.classList).find((name) => /^cinder-[a-z-]+$/.test(name)) ?? null;

      /** True when overriding the token actually moves this element's border. */
      const responds = (element: Element): boolean => {
        const styled = element as HTMLElement;
        const before = getComputedStyle(styled).borderTopColor;
        styled.style.setProperty('--cinder-border', override);
        const after = getComputedStyle(styled).borderTopColor;
        styled.style.removeProperty('--cinder-border');
        return after === override && before !== override;
      };

      const responders = Array.from(document.querySelectorAll('[class*="cinder-"]')).filter(
        (element) => componentName(element) !== null && responds(element),
      );

      const subject = responders[0];
      if (subject === undefined) return { found: false as const };

      /*
       * The other element must be a DIFFERENT component and outside the
       * subject's subtree — a descendant would inherit the override, which is
       * correct cascade behaviour rather than a leak.
       */
      const other = responders.find(
        (element) =>
          componentName(element) !== componentName(subject) &&
          !subject.contains(element) &&
          !element.contains(subject),
      );
      if (other === undefined) return { found: false as const };

      const subjectBefore = getComputedStyle(subject).borderTopColor;
      const otherBefore = getComputedStyle(other).borderTopColor;

      (subject as HTMLElement).style.setProperty('--cinder-border', override);
      const subjectAfter = getComputedStyle(subject).borderTopColor;
      const otherAfter = getComputedStyle(other).borderTopColor;
      (subject as HTMLElement).style.removeProperty('--cinder-border');

      return {
        found: true as const,
        subjectName: componentName(subject),
        otherName: componentName(other),
        subjectBefore,
        otherBefore,
        subjectAfter,
        otherAfter,
      };
    }, OVERRIDE);

    expect(
      result.found,
      'this page has no two unrelated components that both paint from --cinder-border',
    ).toBe(true);
    if (!result.found) return;

    /* Both genuinely read the same token, so a leak would be visible. */
    expect(
      result.subjectBefore,
      `${result.subjectName} and ${result.otherName} should start equal`,
    ).toBe(result.otherBefore);

    /* The override moved the component it was set on... */
    expect(result.subjectAfter, `${result.subjectName} should take the override`).toBe(OVERRIDE);

    /* ...and left the unrelated one alone. */
    expect(result.otherAfter, `${result.otherName} must not inherit the override`).toBe(
      result.otherBefore,
    );
  });

  test('theme reach extends past color to a dimension token', async ({ page }) => {
    await gotoDocumentationPage(page, '/page/card');

    const card = page.locator('.cinder-card').first();
    await expect(card).toBeVisible();

    const radiusOf = async (): Promise<string> =>
      card.evaluate((element) => getComputedStyle(element).borderTopLeftRadius);

    expect(await rootToken(page, '--cinder-radius-lg')).not.toBe('');

    const before = await radiusOf();
    expect(before).not.toBe('0px');

    /*
     * The existing playground-panel tests only ever override COLOR tokens,
     * because the colour panel is the only override UI and it carries colours
     * exclusively. Reach past colour therefore has to be exercised by setting
     * the custom property directly — the mechanism a consumer theming Cinder
     * uses anyway.
     */
    await page.evaluate(() => {
      document.documentElement.style.setProperty('--cinder-radius-lg', '2px');
    });

    await expect.poll(radiusOf).toBe('2px');
    expect(before).not.toBe('2px');
  });

  test('a scoped ancestor override reaches a consume-only component token', async ({ page }) => {
    await gotoDocumentationPage(page, '/page/action-row');

    // The documentation page also contains a condensed example that sets this
    // token directly on the row. That local declaration correctly outranks an
    // ancestor override, so select a consume-only row with no local claimant.
    const row = page
      .locator('.cinder-action-row:not([style*="--cinder-action-row-padding-block"])')
      .first();
    await expect(row).toBeVisible();
    const parent = row.locator('..');
    const paddingOf = async (): Promise<string> =>
      row.evaluate((element) => getComputedStyle(element).paddingTop);

    const before = await paddingOf();
    await parent.evaluate((element) => {
      (element as HTMLElement).style.setProperty('--cinder-action-row-padding-block', '1px');
    });

    await expect.poll(paddingOf).toBe('1px');
    expect(before).not.toBe('1px');
  });

  /**
   * Pins the CURRENT behaviour, which is a deliberate tradeoff rather than an oversight.
   *
   * Component aliases are declared on `:root`, so an alias resolves against `:root`'s
   * foundation value and a foundation override scoped to an ancestor does NOT reach it.
   * These aliases were briefly deferred out of `:root` so that it WOULD -- and this test
   * asserted exactly that -- but deferring them broke `validate:consumer`, which requires
   * every `public: true` token to be declared in the shipped CSS, and failed the 0.25.1
   * release. Restoring the declarations restores this limitation.
   *
   * Overriding the component property directly still works and is the supported path --
   * see the ActionRow test above. If the deferral is reintroduced (which needs the
   * registry to first express "public but not root-declared"), this test flips back.
   */
  test('a scoped foundation override does not reach a root-declared component alias', async ({
    page,
  }) => {
    await gotoDocumentationPage(page, '/page/accordion');

    const item = page
      .locator('.cinder-accordion-item:not([style*="--cinder-accordion-item-trigger-gap"])')
      .first();
    const trigger = item.locator('.cinder-accordion-item__trigger');
    await expect(trigger).toBeVisible();
    const gapOf = async (): Promise<string> =>
      trigger.evaluate((element) => getComputedStyle(element).columnGap);

    const before = await gapOf();
    await item.evaluate((element) => {
      (element as HTMLElement).style.setProperty('--cinder-space-4', '3px');
    });

    // The alias already resolved against :root's --cinder-space-4, so the scoped
    // override changes nothing here.
    await expect.poll(gapOf).toBe(before);
    expect(before).not.toBe('3px');

    // The component property itself remains overridable, which is the supported escape
    // hatch. Set on the PARENT, matching the ActionRow test above: `item` is located by
    // `:not([style*="--cinder-accordion-item-trigger-gap"])`, so writing that property
    // inline on the item makes it stop matching, and the lazy locator silently re-resolves
    // to a different accordion item still showing the default gap.
    await item.locator('..').evaluate((element) => {
      (element as HTMLElement).style.setProperty('--cinder-accordion-item-trigger-gap', '5px');
    });
    await expect.poll(gapOf).toBe('5px');
  });
});
