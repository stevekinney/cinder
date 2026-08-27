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
  const overviewMount = page.locator('#overview-mount-basic');
  await expect(overviewMount).toHaveAttribute('data-example-preview-ready', '');

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
  await expect(trigger).toHaveAttribute('aria-describedby', /\S/);

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
  await expect(page.locator('#overview-mount-basic')).toHaveAttribute(
    'data-overview-preview-rendered',
    '',
  );

  // Uses the "controlled" example
  // (packages/playground/src/examples/hover-card/controlled.example.svelte,
  // `bind:open` driven by external Show/Hide buttons), NOT hover/pointer
  // events on any timed example: EVERY hover-driven path — even
  // `closeDelay={0}` (tried in an earlier round) — still routes through
  // `scheduleClose()`'s `setTimeout(..., 0)`, which is a REAL later task,
  // not a synchronous call. `Math.max(0, closeDelay)` does not remove the
  // timer, only its duration — so a Playwright evaluation task can still run
  // BEFORE that task fires and observe the card as still connected even
  // when reduced-motion teardown is entirely correct (fresh review
  // evidence). Clicking "Hide" flips the bound `open` prop directly, with no
  // timer indirection at all, so the exit begins synchronously within the
  // same task as the click.
  // The "Examples" section mounts each scenario lazily, only once its
  // container intersects the viewport (`mountScenarioWhenVisible` in
  // component-page.svelte) — the container div always exists in the DOM
  // immediately, but its content (and therefore the Show/Hide buttons) does
  // not render until that happens. Calling `scrollIntoViewIfNeeded`
  // directly on `showButton` hangs forever in that state: the button
  // doesn't exist yet for Playwright to even locate. Scrolling the
  // CONTAINER into view first triggers the intersection observer and the
  // mount; only then can the buttons be located. Fresh CI evidence (run
  // 32815679334): adding more examples ahead of this one in round 16-18
  // pushed it further down the page, past the initial viewport.
  const controlledExample = page.locator('#example-mount-controlled');
  await controlledExample.scrollIntoViewIfNeeded();
  const showButton = controlledExample.getByRole('button', { name: 'Show' });
  const hideButton = controlledExample.getByRole('button', { name: 'Hide' });
  await showButton.click();

  // NOT a region-scoped `#example-mount-controlled .cinder-hover-card`
  // descendant selector: the card is portaled to `document.body` the
  // instant it opens (same as every other anchored overlay in this file),
  // so it is never actually a DOM descendant of the example's container —
  // that selector can never match once the card is showing. Locate it
  // page-globally, scoped by this fixture's own content text instead
  // (fresh CI evidence, run 32815679334: this exact mismatch caused a
  // 5s "element(s) not found" timeout locally after fixing the earlier
  // scroll hang).
  const card = page.locator('.cinder-hover-card').filter({ hasText: 'CIN-14' });
  await expect(card).toHaveAttribute('data-cinder-position-ready', 'true');

  // Capture an `ElementHandle` BEFORE closing, not just the `Locator` — same
  // reason as the Popover test above: `Locator#evaluate` re-resolves at call
  // time, so it can't observe a node that has already been unmounted.
  const cardHandle = await card.elementHandle();
  if (!cardHandle) throw new Error('HoverCard element handle not found.');

  await hideButton.click();

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

  // Capture an `ElementHandle` BEFORE the second click, not just the
  // `Locator`: the very click we're about to make flips `data-open` to
  // `"false"` on this same element, which is part of `panel`'s OWN
  // selector — so calling `panel.evaluate(...)` afterward would re-resolve
  // that selector, find no match (since `[data-open="true"]` no longer
  // matches anything), and time out instead of inspecting the panel that
  // was actually toggled. `ElementHandle#evaluate` operates on the specific
  // captured node regardless of which attributes on it change afterward.
  const panelHandle = await panel.elementHandle();
  if (!panelHandle) throw new Error('NavigationBar mobile panel element handle not found.');

  await toggle.click();

  const stillVisible = await panelHandle.evaluate(async (el) => {
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
