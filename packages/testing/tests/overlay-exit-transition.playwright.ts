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
 *   Scoped to the Overview region specifically via `getByLabel('Overview
 *   preview')` (`.dx-stage__canvas`'s `aria-label`, which the panel is
 *   associated with through `aria-owns` even though it portals to
 *   `document.body`) instead of filtering by text alone.
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
  await expect(page.locator('#overview-mount-basic')).toHaveAttribute(
    'data-overview-preview-rendered',
    '',
  );

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
    'data-overview-preview-rendered',
    '',
  );

  const trigger = overview.getByRole('button', { name: 'Hover me' }).first();
  await trigger.hover();

  // Scoped to the Overview region (via its accessible label, since the panel
  // portals to `document.body` and isn't a DOM descendant): the
  // "Examples" section further down the same page mounts this identical
  // "basic" example a second time, and a plain text filter matches both.
  const tip = overview.getByText('This is a helpful explanation.');
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
