import { expect, test } from '@playwright/test';

/**
 * CIN-376: every anchored overlay migrated onto the shared exit-transition
 * lifecycle (`AnchoredOverlayExitState` / `waitForSpeedDialExit`, see
 * `_internal/OVERLAY-POLICY.md` § "Transition lifecycle") must render
 * `data-cinder-closing` for the duration of its real exit transition, then
 * actually unmount/hide once it finishes — not snap away instantly.
 *
 * Navigates with `?view=playground` (the documentation page's live-preview
 * tab), NOT `?snapshot=1` (used by the `componentPage` fixture, and by an
 * earlier revision of this file): `packages/playground/src/snapshot-mode.ts`
 * forces every descendant's `transition-duration`/`transition-delay` to
 * `0s !important`, so a `?snapshot=1` page takes the immediate-completion
 * path regardless of the browser context's `reducedMotion` setting — these
 * tests would pass even if the exit-transition lifecycle itself were broken,
 * since nothing would ever be observably "still closing". `?view=playground`
 * preserves real, live transitions, and this project's default
 * `reducedMotion: 'no-preference'` context is what actually lets
 * `data-cinder-closing` be observed mid-flight rather than resolving on the
 * next microtask. The companion `chromium-reduced-motion` project
 * (`overlay-reduced-motion-exit.playwright.ts`) covers the opposite case:
 * immediate unmount when motion IS reduced — same pages, opposite
 * `reducedMotion` context setting, genuinely different code paths in both
 * directions now.
 */

test('Popover renders data-cinder-closing during its exit transition, then unmounts', async ({
  page,
}) => {
  await page.goto('/page/popover?view=playground', { waitUntil: 'load' });

  const trigger = page.getByRole('button', { name: 'Account settings' }).first();
  await trigger.click();

  const panel = page.locator('.cinder-popover').first();
  await expect(panel).toHaveAttribute('data-cinder-position-ready', 'true');

  await trigger.click();

  await expect(panel).toHaveAttribute('data-cinder-closing', '');
  await expect(panel).toHaveCount(0);
});

test('Tooltip renders data-cinder-closing during its exit transition, then hides', async ({
  page,
}) => {
  await page.goto('/page/tooltip?view=playground', { waitUntil: 'load' });

  const trigger = page.getByRole('button', { name: 'Hover me' }).first();
  await trigger.hover();

  const tip = page.locator('.cinder-tooltip').first();
  await expect(tip).toHaveAttribute('data-cinder-position-ready', 'true');

  // Move away to trigger the hide/close path.
  await page.mouse.move(0, 0);

  await expect(tip).toHaveAttribute('data-cinder-closing', '');
  await expect(tip).toBeHidden();
});

test('HoverCard renders data-cinder-closing during its exit transition, then unmounts, and a reopen mid-close survives (CIN-376 defect fix)', async ({
  page,
}) => {
  await page.goto('/page/hover-card?view=playground', { waitUntil: 'load' });

  const trigger = page.getByRole('button', { name: 'Ada Lovelace' }).first();
  await trigger.hover();

  const card = page.locator('.cinder-hover-card').first();
  await expect(card).toHaveAttribute('data-cinder-position-ready', 'true');

  await page.mouse.move(0, 0);
  await expect(card).toHaveAttribute('data-cinder-closing', '');

  // Reopen while the exit transition is still in flight. Before CIN-376,
  // HoverCard's hand-rolled version of this pattern force-finished the
  // pending close AFTER re-arming `renderCard = true`, so the stale
  // completion callback immediately unmounted the freshly reopened card.
  // The shared `AnchoredOverlayExitState` generation-guards this.
  await trigger.hover();

  await expect(card).toHaveCount(1);
  await expect(card).toBeVisible();
  await expect(card).not.toHaveAttribute('data-cinder-closing', '');
});

test('NavigationBar mobile panel plays its exit transition instead of snapping via visibility (CIN-376 fix)', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/page/navigation-bar?view=playground', { waitUntil: 'load' });

  const toggle = page.getByRole('button', { name: 'Open menu' }).first();
  await toggle.click();

  const panel = page
    .locator('.cinder-navigation-bar__items[data-cinder-mobile-panel][data-open="true"]')
    .first();
  await expect(panel).toBeVisible();

  await toggle.click();

  // Previously this panel used an unconditional `visibility: hidden` on
  // `[data-open='false']`, hiding it (and its exit transition) the instant
  // the toggle closed. It now stays visible/focusable through the
  // transition, keyed off `data-cinder-closing`.
  const closingPanel = page.locator(
    '.cinder-navigation-bar__items[data-cinder-mobile-panel][data-cinder-closing]',
  );
  await expect(closingPanel).toHaveCount(1);
});
