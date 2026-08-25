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
 * Navigates to the plain documentation page (`/page/<slug>`, no
 * `?snapshot=1`, no `?view=playground`) and scopes locators to
 * `#overview-mount-basic` — see the companion
 * `overlay-exit-transition.playwright.ts` (default `chromium` project) for
 * the full reasoning: `?snapshot=1` forces every transition to `0s
 * !important` regardless of the actual `reducedMotion` context (which is
 * exactly what these tests need to be sensitive to), and `?view=playground`
 * either bare-mounts some components with no real content (Tooltip) or
 * behind a stage width that never engages the collapsed-mobile breakpoint
 * (NavigationBar) or a compound-children shape the generic prop synthesizer
 * can't produce (Speed Dial's actions). The Overview preview is always the
 * real example, hydrated and interactive, flowing with the actual page
 * width — same pages as the default-motion project, opposite `reducedMotion`
 * context, genuinely different code paths in both directions now.
 */

test('Popover unmounts immediately under reduced motion', async ({ page }) => {
  await page.goto('/page/popover', { waitUntil: 'load' });
  const overview = page.locator('#overview-mount-basic');
  await expect(overview).toHaveAttribute('data-overview-preview-rendered', '');

  const trigger = overview.getByRole('button', { name: 'Account settings' }).first();
  await trigger.click();

  const panel = page.locator('.cinder-popover').first();
  await expect(panel).toHaveAttribute('data-cinder-position-ready', 'true');

  await trigger.click();

  await expect(panel).toHaveCount(0);
});

test('Tooltip hides immediately under reduced motion', async ({ page }) => {
  await page.goto('/page/tooltip', { waitUntil: 'load' });
  const overview = page.locator('#overview-mount-basic');
  await expect(overview).toHaveAttribute('data-overview-preview-rendered', '');

  const trigger = overview.getByRole('button', { name: 'Hover me' }).first();
  await trigger.hover();

  const tip = page.locator('.cinder-tooltip').first();
  await expect(tip).toHaveAttribute('data-cinder-position-ready', 'true');

  await page.mouse.move(0, 0);

  await expect(tip).toBeHidden();
});

test('HoverCard unmounts immediately under reduced motion', async ({ page }) => {
  await page.goto('/page/hover-card', { waitUntil: 'load' });
  const overview = page.locator('#overview-mount-basic');
  await expect(overview).toHaveAttribute('data-overview-preview-rendered', '');

  const trigger = overview.getByRole('button', { name: 'Ada Lovelace' }).first();
  await trigger.hover();

  const card = page.locator('.cinder-hover-card').first();
  await expect(card).toHaveAttribute('data-cinder-position-ready', 'true');

  await page.mouse.move(0, 0);

  await expect(card).toHaveCount(0);
});

test('NavigationBar mobile panel hides immediately under reduced motion', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/page/navigation-bar', { waitUntil: 'load' });
  const overview = page.locator('#overview-mount-basic');
  await expect(overview).toHaveAttribute('data-overview-preview-rendered', '');

  const toggle = overview.getByRole('button', { name: 'Open menu' }).first();
  await toggle.click();

  const panel = page
    .locator('.cinder-navigation-bar__items[data-cinder-mobile-panel][data-open="true"]')
    .first();
  await expect(panel).toBeVisible();

  await toggle.click();

  await expect(panel).toBeHidden();
});

test('SpeedDial actions become inert immediately under reduced motion', async ({ page }) => {
  await page.goto('/page/speed-dial', { waitUntil: 'load' });
  const overview = page.locator('#overview-mount-basic');
  await expect(overview).toHaveAttribute('data-overview-preview-rendered', '');

  const toggle = overview.getByRole('button', { name: 'Quick actions' }).first();
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
