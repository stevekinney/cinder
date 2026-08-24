import { expect, test } from '@playwright/test';

/**
 * CIN-376: runs only under the `chromium-reduced-motion` Playwright project
 * (see `playwright.config.ts`), which sets `reducedMotion: 'reduce'` at the
 * browser-context level. Every anchored overlay migrated onto
 * `AnchoredOverlayExitState` (or, for Speed Dial, `waitForSpeedDialExit`)
 * must still unmount/hide immediately under reduced motion — the shared
 * `waitForTransitionCompletion` primitive resolves via `queueMicrotask`
 * rather than waiting on a `transitionend` that reduced-motion's
 * zero-duration tokens would never fire. See `_internal/OVERLAY-POLICY.md` §
 * "Transition lifecycle".
 *
 * Navigates with `?view=playground` (the documentation page's live-preview
 * tab — see `packages/playground/src/component-page-live-preview.ts`), NOT
 * `?snapshot=1`: `packages/playground/src/snapshot-mode.ts` forces every
 * descendant's `transition-duration`/`transition-delay` to `0s !important`
 * regardless of the browser context's `reducedMotion` preference, so a
 * `?snapshot=1` page takes the immediate-completion path unconditionally —
 * these tests would still pass even if reduced-motion detection were
 * entirely broken. `?view=playground` preserves real, live transitions, so
 * this project's `reducedMotion: 'reduce'` context setting is the only thing
 * collapsing them to instant, and the reduced-motion detection under test
 * (`useReducedMotion()` feeding `getReducedMotion()`) is what's actually
 * exercised. The companion `overlay-exit-transition.playwright.ts` (default
 * `chromium` project, `reducedMotion: 'no-preference'`) is the other half of
 * the pair — same pages, opposite motion preference, genuinely different
 * code paths in both directions now.
 *
 * Uses plain `page.goto` (not the `componentPage` fixture) since the
 * fixture's own `themeContextOptions` would otherwise force `reduce`
 * regardless of the project, and always navigates with `?snapshot=1` — here
 * the project setting IS the thing under test, and snapshot mode is exactly
 * what defeats it.
 */

test('Popover unmounts immediately under reduced motion', async ({ page }) => {
  await page.goto('/page/popover?view=playground', { waitUntil: 'load' });

  const trigger = page.getByRole('button', { name: 'Account settings' }).first();
  await trigger.click();

  const panel = page.locator('.cinder-popover').first();
  await expect(panel).toHaveAttribute('data-cinder-position-ready', 'true');

  await trigger.click();

  await expect(panel).toHaveCount(0);
});

test('Tooltip hides immediately under reduced motion', async ({ page }) => {
  await page.goto('/page/tooltip?view=playground', { waitUntil: 'load' });

  const trigger = page.getByRole('button', { name: 'Hover me' }).first();
  await trigger.hover();

  const tip = page.locator('.cinder-tooltip').first();
  await expect(tip).toHaveAttribute('data-cinder-position-ready', 'true');

  await page.mouse.move(0, 0);

  await expect(tip).toBeHidden();
});

test('HoverCard unmounts immediately under reduced motion', async ({ page }) => {
  await page.goto('/page/hover-card?view=playground', { waitUntil: 'load' });

  const trigger = page.getByRole('button', { name: 'Ada Lovelace' }).first();
  await trigger.hover();

  const card = page.locator('.cinder-hover-card').first();
  await expect(card).toHaveAttribute('data-cinder-position-ready', 'true');

  await page.mouse.move(0, 0);

  await expect(card).toHaveCount(0);
});

test('NavigationBar mobile panel hides immediately under reduced motion', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/page/navigation-bar?view=playground', { waitUntil: 'load' });

  const toggle = page.getByRole('button', { name: 'Open menu' }).first();
  await toggle.click();

  const panel = page
    .locator('.cinder-navigation-bar__items[data-cinder-mobile-panel][data-open="true"]')
    .first();
  await expect(panel).toBeVisible();

  await toggle.click();

  await expect(panel).toBeHidden();
});

test('SpeedDial actions become inert immediately under reduced motion', async ({ page }) => {
  await page.goto('/page/speed-dial?view=playground', { waitUntil: 'load' });

  const toggle = page.getByRole('button', { name: 'Quick actions' }).first();
  await toggle.click();

  const actions = page
    .locator('body > .cinder-speed-dial__portal-scope > .cinder-speed-dial__actions')
    .first();
  await expect(actions).toHaveAttribute('data-cinder-open', '');

  await toggle.click();

  await expect(actions).not.toHaveAttribute('data-cinder-open', '');
  // Reduced motion collapses the per-action stagger to zero, so
  // `waitForSpeedDialExit`'s fanned-out `waitForTransitionCompletion` calls
  // resolve on the next microtask and the shared floating-surface chrome
  // (see `speed-dial.css`) resets without waiting for a real transition.
  await expect(actions).toHaveCSS('pointer-events', 'none');
});
