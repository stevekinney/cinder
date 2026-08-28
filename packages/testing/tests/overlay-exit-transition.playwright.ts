import { expect, test } from '@playwright/test';

/**
 * CIN-376: every anchored overlay migrated onto the shared exit-transition
 * lifecycle (`AnchoredOverlayExitState` / `waitForSpeedDialExit`, see
 * `_internal/OVERLAY-POLICY.md` § "Transition lifecycle") must render
 * `data-cinder-closing` for the duration of its real exit transition, then
 * actually unmount/hide once it finishes — not snap away instantly.
 *
 * Navigates to the plain documentation page (`/page/<slug>`, no `?snapshot=1`
 * and no `?view=playground`) and scopes every locator to the "Overview"
 * section's live preview (`packages/playground/src/component-page.svelte`),
 * which mounts the component's real, first/"basic" example as a single,
 * fully-hydrated, interactive instance — `?snapshot=1` forces every
 * transition duration to `0s !important`
 * (`packages/playground/src/snapshot-mode.ts`), and `?view=playground` can
 * bare-mount a component with synthesized (sometimes empty) props instead of
 * its real example. See git history on this file for the by-surface analysis
 * that ruled both out.
 *
 * Ground-truth corrections from CI artifacts (run 32797694277, job
 * 97652452204 — downloaded via `gh run download` and read from the
 * per-test `error-context.md` page snapshots, not re-theorized):
 *
 * - Tooltip: the documentation page's "Examples" section mounts the SAME
 *   "basic" example a second time (`#example-mount-basic`, labelled "Basic
 *   tooltip preview"), alongside the Overview preview (labelled "Overview
 *   preview") — both render the identical tooltip text, so a `.filter({
 *   hasText })` locator resolved to 2 elements (a strict-mode violation).
 *   Region-scoping doesn't fix this either: once open, the tooltip panel is
 *   portaled to `document.body` via `tooltipPortalAttachment`, so it is no
 *   longer a DOM descendant of either region's container at all — there is
 *   no `aria-owns` (or any other) wiring tying the portaled panel back to
 *   the region it logically belongs to. The only reliable id is the one
 *   read off the hovered trigger's own `aria-describedby` attribute
 *   (`tooltip.svelte` sets it to the panel's `id`), located page-globally
 *   with `page.locator(`#${describedBy}`)` — see the Tooltip test below.
 * - NavigationBar: the mobile panel toggle's accessible name changes from
 *   "Open menu" to "Close menu" once expanded (see
 *   navigation-bar.examples.json's `aria-label={mobileMenuOpen ? 'Close
 *   menu' : 'Open menu'}`). A Playwright locator is live and re-queries on
 *   every action, so capturing it once with `getByRole('button', { name:
 *   'Open menu' })` and calling `.click()` on it TWICE — the second time to
 *   close — re-searches for a now-nonexistent "Open menu" button and hangs
 *   forever. The CI page snapshot showed the panel already open
 *   (`button "Close menu" [expanded]`) at the moment of the timeout,
 *   confirming the first click had already succeeded and the SECOND one was
 *   what hung — not a width/collapse problem (the prior theory in this
 *   file's history). Captured via a label-independent class selector
 *   instead.
 */

test('Popover renders data-cinder-closing during its exit transition, then unmounts', async ({
  page,
}) => {
  await page.goto('/page/popover', { waitUntil: 'load' });
  const overview = page.getByRole('region', { name: 'Overview preview' });
  const overviewMount = page.locator('#overview-mount-basic');
  await expect(overviewMount).toHaveAttribute('data-example-preview-ready', '');

  const trigger = overview.getByRole('button', { name: 'Account settings' }).first();
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
  await page.goto('/page/tooltip', { waitUntil: 'load' });
  const overview = page.getByRole('region', { name: 'Overview preview' });
  await expect(page.locator('#overview-mount-basic')).toHaveAttribute(
    'data-example-preview-ready',
    '',
  );

  const trigger = overview.getByRole('button', { name: 'Hover me' }).first();
  await trigger.hover();
  await expect(trigger).toHaveAttribute('aria-describedby', /\S/);

  // Resolved via the trigger's OWN `aria-describedby` (tooltip.svelte wires
  // it to the panel's `id`), not text/region scoping: the "Examples" section
  // further down the same page mounts this identical "basic" example a
  // second time, with its own tooltip carrying the same text — region- or
  // text-based scoping isn't reliably disambiguating (CI run 32799420793
  // still resolved to the WRONG, permanently-closed tooltip this way). An
  // id derived straight from the hovered trigger can't be ambiguous.
  const tooltipId = await trigger.evaluate((element) => {
    const describedByIds = element.getAttribute('aria-describedby')?.split(/\s+/) ?? [];
    return (
      describedByIds.find(
        (id) => document.getElementById(id)?.getAttribute('role') === 'tooltip',
      ) ?? null
    );
  });
  if (!tooltipId) throw new Error('Tooltip trigger does not describe a tooltip.');
  const tip = page.locator(`[id="${tooltipId}"][role="tooltip"]`).first();
  await expect(tip).toHaveAttribute('data-cinder-position-ready', 'true');

  // Move away to trigger the hide/close path.
  await page.mouse.move(0, 0);

  await expect(tip).toHaveAttribute('data-cinder-closing', '');
  await expect(tip).toBeHidden();
});

test('HoverCard renders data-cinder-closing during its exit transition, then unmounts, and a reopen mid-close survives (CIN-376 defect fix)', async ({
  page,
}) => {
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
  await expect(card).toHaveAttribute('data-cinder-closing', '');

  // The reopen-mid-close defect itself (below) is NOT exercised with this
  // basic example: its default `openDelay` (300ms) is longer than the exit
  // transition itself (`--cinder-duration-fast`, 120ms). Waiting for
  // `data-cinder-closing` to appear (confirming the real `closeDelay`,
  // 150ms, has already elapsed and the exit has genuinely started) and THEN
  // re-hovering would only schedule a reopen for 300ms later — well after
  // the 120ms exit has already finished on its own, so any assertions here
  // would pass even with a completely broken generation guard, since
  // they'd just be observing a brand-new, independently-opened card (fresh
  // review evidence). Use the "instant-reopen" example instead
  // (`openDelay={0}`, DEFAULT `closeDelay` — 150ms — left untouched rather
  // than raised, per review: a fixture shouldn't override a delay just to
  // buy a test more margin) for that check: once the exit is confirmed in
  // flight (closing starts at ~150ms, ending at ~270ms), a reopen with
  // `openDelay={0}` resolves in ~0ms, landing comfortably inside that
  // window instead of racing it.
  // The "Examples" section mounts each scenario lazily, only once its
  // container intersects the viewport (`mountScenarioWhenVisible` in
  // component-page.svelte) — the container div itself always exists in the
  // DOM immediately, but its content (and therefore the trigger button)
  // does not render until that happens. `scrollIntoViewIfNeeded` on the
  // trigger directly hangs forever in that state: the button doesn't exist
  // yet for Playwright to even locate, so there's nothing to scroll to.
  // Scrolling the CONTAINER into view first (it needs no lazy content to
  // already exist) triggers the intersection observer and the mount, after
  // which the trigger can be located and interacted with normally. Fresh
  // CI evidence (run 32815679334): adding more examples ahead of this one
  // in round 16-18 pushed it further down the page, past what was
  // previously already in the initial viewport.
  const instantReopenExample = page.locator('#example-mount-instant-reopen');
  await instantReopenExample.scrollIntoViewIfNeeded();
  const instantReopenTrigger = instantReopenExample.getByRole('button', { name: 'CIN-99' }).first();
  await instantReopenTrigger.hover();

  const instantReopenCard = page.locator('.cinder-hover-card').filter({ hasText: 'CIN-99' });
  await expect(instantReopenCard).toHaveAttribute('data-cinder-position-ready', 'true');

  // Arm the transient-state wait before moving the pointer. The closing
  // attribute exists only for the real 120ms exit transition, so beginning
  // a polling assertion after the pointer action can miss the state entirely
  // under runner contention and observe only the already-unmounted card.
  const closingCard = page
    .locator('.cinder-hover-card[data-cinder-closing]')
    .filter({ hasText: 'CIN-99' });
  const closingStarted = closingCard.waitFor({ state: 'attached', timeout: 5_000 });
  await page.mouse.move(0, 0);
  await closingStarted;

  await instantReopenTrigger.hover();

  await expect(instantReopenCard).toHaveCount(1);
  await expect(instantReopenCard).toBeVisible();
  await expect(instantReopenCard).not.toHaveAttribute('data-cinder-closing', '');
});

test('NavigationBar mobile panel plays its exit transition instead of snapping via visibility (CIN-376 fix)', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/page/navigation-bar', { waitUntil: 'load' });
  const overview = page.getByRole('region', { name: 'Overview preview' });
  await expect(page.locator('#overview-mount-basic')).toHaveAttribute(
    'data-overview-preview-rendered',
    '',
  );

  // NOT `getByRole('button', { name: 'Open menu' })`: the toggle's
  // accessible name flips to "Close menu" once expanded, and a Playwright
  // locator re-queries live on every action — capturing it by that name and
  // clicking it twice hangs forever on the second click, waiting for a
  // button that no longer exists. This class-based locator stays valid
  // through both states.
  const toggle = overview.locator('.cinder-navigation-bar__menu-toggle button').first();
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
