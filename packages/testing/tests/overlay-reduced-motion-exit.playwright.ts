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
 * Popover/Tooltip/HoverCard/NavigationBar navigate to the plain
 * documentation page (no `?snapshot=1`, no `?view=playground`) and scope
 * locators the same way `overlay-exit-transition.playwright.ts` does — see
 * that file's header comment for the CI-artifact-grounded reasoning (the
 * Tooltip "Examples" section double-mount, and the NavigationBar toggle's
 * changing accessible name).
 *
 * Non-polling assertion (review thread on this file): `expect(locator).X()`
 * is a WEB-FIRST assertion that retries for several seconds — if reduced-
 * motion detection regressed and the ordinary ~120ms transition ran
 * instead, a polling assertion would still pass once that transition
 * finished, never actually proving "immediate". Each test instead runs a
 * single `page.evaluate` that awaits exactly one microtask (matching
 * `queueMicrotask(finish)`'s own resolution timing) and then reads the DOM
 * directly — a plain boolean assertion on the result, not a locator, so
 * there is no retry window for a slow transition to sneak through.
 *
 * Speed Dial's assertion checks for the element's absence, not
 * `not.toHaveAttribute(...)`: the retained actions surface fully unmounts
 * (portal disabled) once `waitForSpeedDialExit` completes, so by the time
 * any assertion runs the element may already be gone — `not.toHaveAttribute`
 * requires the element to exist and therefore errors instead of passing in
 * that case.
 */

test('Popover unmounts immediately under reduced motion', async ({ page }) => {
  await page.goto('/page/popover', { waitUntil: 'load' });
  const overview = page.getByRole('region', { name: 'Overview preview' });
  await expect(page.locator('#overview-mount-basic')).toHaveAttribute(
    'data-overview-preview-rendered',
    '',
  );

  const trigger = overview.getByRole('button', { name: 'Account settings' }).first();
  await trigger.click();

  const panel = page.locator('.cinder-popover').first();
  await expect(panel).toHaveAttribute('data-cinder-position-ready', 'true');

  await trigger.click();

  const stillPresent = await page.evaluate(async () => {
    await Promise.resolve();
    return document.querySelector('.cinder-popover') !== null;
  });
  expect(stillPresent).toBe(false);
});

test('Tooltip hides immediately under reduced motion', async ({ page }) => {
  await page.goto('/page/tooltip', { waitUntil: 'load' });
  const overview = page.getByRole('region', { name: 'Overview preview' });
  await expect(page.locator('#overview-mount-basic')).toHaveAttribute(
    'data-overview-preview-rendered',
    '',
  );

  const trigger = overview.getByRole('button', { name: 'Hover me' }).first();
  await trigger.hover();

  const tip = overview.getByText('This is a helpful explanation.');
  await expect(tip).toHaveAttribute('data-cinder-position-ready', 'true');

  await page.mouse.move(0, 0);

  const stillVisible = await page.evaluate(async () => {
    await Promise.resolve();
    const el = document.querySelector('.cinder-tooltip');
    if (!el) return false;
    return window.getComputedStyle(el).visibility !== 'hidden';
  });
  expect(stillVisible).toBe(false);
});

test('HoverCard unmounts immediately under reduced motion', async ({ page }) => {
  await page.goto('/page/hover-card', { waitUntil: 'load' });
  const overview = page.getByRole('region', { name: 'Overview preview' });
  await expect(page.locator('#overview-mount-basic')).toHaveAttribute(
    'data-overview-preview-rendered',
    '',
  );

  const trigger = overview.getByRole('button', { name: 'Ada Lovelace' }).first();
  await trigger.hover();

  const card = page.locator('.cinder-hover-card').first();
  await expect(card).toHaveAttribute('data-cinder-position-ready', 'true');

  await page.mouse.move(0, 0);

  const stillPresent = await page.evaluate(async () => {
    await Promise.resolve();
    return document.querySelector('.cinder-hover-card') !== null;
  });
  expect(stillPresent).toBe(false);
});

test('NavigationBar mobile panel hides immediately under reduced motion', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/page/navigation-bar', { waitUntil: 'load' });
  const overview = page.getByRole('region', { name: 'Overview preview' });
  await expect(page.locator('#overview-mount-basic')).toHaveAttribute(
    'data-overview-preview-rendered',
    '',
  );

  const toggle = overview.locator('.cinder-navigation-bar__menu-toggle button').first();
  await toggle.click();

  const panel = page
    .locator('.cinder-navigation-bar__items[data-cinder-mobile-panel][data-open="true"]')
    .first();
  await expect(panel).toBeVisible();

  await toggle.click();

  const stillVisible = await page.evaluate(async () => {
    await Promise.resolve();
    const el = document.querySelector('.cinder-navigation-bar__items[data-cinder-mobile-panel]');
    if (!el) return false;
    return window.getComputedStyle(el).visibility !== 'hidden';
  });
  expect(stillVisible).toBe(false);
});

test('SpeedDial actions become inert immediately under reduced motion', async ({ page }) => {
  await page.goto('/page/speed-dial?snapshot=1', { waitUntil: 'load' });
  const example = page.locator('#example-mount-basic');
  const toggle = example.getByRole('button', { name: 'Quick actions' }).first();
  await toggle.click();

  const actions = page
    .locator('body > .cinder-speed-dial__portal-scope > .cinder-speed-dial__actions')
    .first();
  await expect(actions).toHaveAttribute('data-cinder-open', '');

  await toggle.click();

  // The retained actions surface fully unmounts (portal disabled) once
  // `waitForSpeedDialExit` completes under reduced motion — assert its
  // eventual absence, not a "not this attribute" check that requires the
  // element to still exist.
  const stillPresent = await page.evaluate(async () => {
    await Promise.resolve();
    return (
      document.querySelector(
        'body > .cinder-speed-dial__portal-scope > .cinder-speed-dial__actions',
      ) !== null
    );
  });
  expect(stillPresent).toBe(false);
});
