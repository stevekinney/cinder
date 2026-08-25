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
 * single `evaluate` that awaits exactly one microtask (matching
 * `queueMicrotask(finish)`'s own resolution timing) and then reads the DOM
 * directly — a plain boolean assertion on the result, not a locator, so
 * there is no retry window for a slow transition to sneak through. Popover
 * and HoverCard capture an `ElementHandle` (not just a `Locator`) BEFORE
 * closing and evaluate THAT afterward — a live `Locator#evaluate` re-resolves
 * its selector at call time and would wait for a new match instead of
 * reading the former node once it's gone, timing out precisely when
 * teardown succeeds. Tooltip and NavigationBar instead derive their locator
 * from the specific instance the test interacted with (the trigger's own
 * `aria-describedby`, the toggled panel) — no risk of resolving to a
 * different, already-hidden instance the documentation page also happens to
 * mount (e.g. the "Examples" section duplicate mounts, fresh review evidence
 * found this happening either way).
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

  // Capture an `ElementHandle` BEFORE closing, not just the `Locator`:
  // `Locator#evaluate` re-resolves its selector at call time, so once the
  // correctly-reduced-motion close has already unmounted the panel, calling
  // `panel.evaluate(...)` after the fact would wait (and time out) for a
  // NEW matching element to appear instead of reading the former node's
  // `isConnected` value — making the test fail precisely when teardown
  // succeeds. `ElementHandle#evaluate` operates on the specific captured
  // node regardless of whether it's still attached.
  const panelHandle = await panel.elementHandle();
  if (!panelHandle) throw new Error('Popover panel element handle not found.');

  await trigger.click();

  const stillPresent = await panelHandle.evaluate(async (el) => {
    await Promise.resolve();
    return el.isConnected;
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

  // Resolved via the trigger's OWN `aria-describedby`, not text/region
  // scoping — see `overlay-exit-transition.playwright.ts`'s companion test
  // for why (the "Examples" section mounts an identical second tooltip with
  // the same text, and CI run 32799420793 showed region+text scoping still
  // resolving to that wrong, permanently-closed instance).
  const describedBy = await trigger.getAttribute('aria-describedby');
  if (!describedBy) throw new Error('Tooltip trigger has no aria-describedby.');
  const tip = page.locator(`#${describedBy}`);
  await expect(tip).toHaveAttribute('data-cinder-position-ready', 'true');

  await page.mouse.move(0, 0);

  // Inspect the SAME element `tip` already resolved (via `describedBy`), not
  // a fresh global `.cinder-tooltip` query: the documentation page mounts a
  // second, permanently-hidden tooltip in its "Examples" section, and once
  // the tested Overview tooltip is portaled to the end of `body`, a global
  // query can resolve to that other instance instead — reporting "hidden"
  // regardless of whether the ACTIVE tooltip finished immediately.
  // `Locator#evaluate` passes the exact handle `tip` already identified.
  const stillVisible = await tip.evaluate(async (el) => {
    await Promise.resolve();
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

  // Capture an `ElementHandle` BEFORE closing, not just the `Locator` — same
  // reason as the Popover test above: `Locator#evaluate` re-resolves at call
  // time, so it can't observe a node that has already been unmounted.
  const cardHandle = await card.elementHandle();
  if (!cardHandle) throw new Error('HoverCard element handle not found.');

  await page.mouse.move(0, 0);

  // HoverCard debounces its close behind a REAL `closeDelay` (150ms by
  // default) `setTimeout` — a legitimate hover-intent guard, not part of the
  // exit-TRANSITION lifecycle under test — before `setOpen(false)` even
  // runs. Deliberately NOT polling for `data-cinder-closing` to appear first
  // (as this test previously did): under reduced motion,
  // `waitForTransitionCompletion` resolves via `queueMicrotask`, so the
  // closing state exists for at most a single microtask before the card
  // unmounts entirely — a web-first `toHaveAttribute` poll cannot reliably
  // observe a state that ephemeral and would normally time out even when
  // reduced motion is working correctly. Instead, wait past the real delay
  // with a fixed timeout (200ms — comfortably past the 150ms debounce, but
  // short enough that a regressed ~120ms non-reduced exit transition
  // wouldn't also complete within it: 150 + 120 = 270ms), then check the END
  // state without polling.
  await page.waitForTimeout(200);

  const stillPresent = await cardHandle.evaluate(async (el) => {
    await Promise.resolve();
    return el.isConnected;
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

  // Inspect the SAME `panel` handle already resolved above, not a fresh
  // global query: both the Overview and Examples sections mount the basic
  // NavigationBar, so opening the Overview instance portals its panel later
  // in `body` while another closed mobile panel (Examples', never opened)
  // remains earlier in document order — a global `document.querySelector`
  // can resolve to that already-hidden sibling and report "hidden"
  // regardless of whether the panel that was actually toggled finished
  // immediately. `Locator#evaluate` passes the exact handle `panel` already
  // identified.
  const stillVisible = await panel.evaluate(async (el) => {
    await Promise.resolve();
    return window.getComputedStyle(el).visibility !== 'hidden';
  });
  expect(stillVisible).toBe(false);
});

test('SpeedDial actions become inert immediately under reduced motion', async ({ page }) => {
  // NOT `?snapshot=1`: snapshot mode forces every transition duration/delay
  // to `0s !important`, which would make a genuinely broken
  // `useReducedMotion()` detection indistinguishable from correct behavior —
  // same reasoning as the other tests in this file. Uses the plain
  // documentation page's Overview preview instead, like Popover/Tooltip/
  // HoverCard/NavigationBar above.
  await page.goto('/page/speed-dial', { waitUntil: 'load' });
  const overview = page.getByRole('region', { name: 'Overview preview' });
  await expect(page.locator('#overview-mount-basic')).toHaveAttribute(
    'data-overview-preview-rendered',
    '',
  );
  const toggle = overview.getByRole('button', { name: 'Quick actions' }).first();
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
