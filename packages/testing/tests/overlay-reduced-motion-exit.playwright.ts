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
 * Popover/Tooltip/HoverCard navigate to the plain documentation page (no
 * `?snapshot=1`, no `?view=playground`) and scope locators to
 * `#overview-mount-basic` — see the companion
 * `overlay-exit-transition.playwright.ts` for the full reasoning
 * (`?snapshot=1`/`?view=playground` each defeat this project's purpose or a
 * specific component's real content in different ways). Tooltip is further
 * filtered on its example text: the documentation page's own "Copy"
 * code-block buttons are wired through this same Tooltip component, and
 * `.first()` previously asserted against that unrelated tooltip instead (CI
 * run 32795764067, job 97646670185).
 *
 * NavigationBar and Speed Dial instead use `?snapshot=1` +
 * `#example-mount-basic` (the dedicated, isolated, full-width single-example
 * testing surface used elsewhere in this suite): the Overview preview flows
 * inside the documentation page's own responsive layout, which never
 * collapsed to NavigationBar's mobile breakpoint even at a 390px viewport
 * (CI's `click: Test timeout` on the hidden toggle), and Speed Dial's
 * actions never appeared there either. Snapshot mode's forced `0s`
 * transition duration is harmless for both HERE — this project already
 * expects immediate completion under reduced motion, so there's nothing
 * these two tests lose by additionally being isolated from the
 * documentation page's own layout and chrome.
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

  const tip = page.locator('.cinder-tooltip', { hasText: 'This is a helpful explanation.' });
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
  await page.goto('/page/navigation-bar?snapshot=1', { waitUntil: 'load' });
  const example = page.locator('#example-mount-basic');
  const toggle = example.getByRole('button', { name: 'Open menu' }).first();
  await toggle.click();

  const panel = page
    .locator('.cinder-navigation-bar__items[data-cinder-mobile-panel][data-open="true"]')
    .first();
  await expect(panel).toBeVisible();

  await toggle.click();

  await expect(panel).toBeHidden();
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

  await expect(actions).not.toHaveAttribute('data-cinder-open', '');
  // Reduced motion collapses the per-action stagger to zero, so
  // `waitForSpeedDialExit`'s fanned-out `waitForTransitionCompletion` calls
  // resolve on the next microtask and the shared floating-surface chrome
  // (see `speed-dial.css`) resets without waiting for a real transition.
  await expect(actions).toHaveCSS('pointer-events', 'none');
});
