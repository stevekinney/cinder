import { expect, test } from '@playwright/test';

/**
 * CIN-376: every anchored overlay migrated onto the shared exit-transition
 * lifecycle (`AnchoredOverlayExitState` / `waitForSpeedDialExit`, see
 * `_internal/OVERLAY-POLICY.md` § "Transition lifecycle") must render
 * `data-cinder-closing` for the duration of its real exit transition, then
 * actually unmount/hide once it finishes — not snap away instantly.
 *
 * Navigates to the plain documentation page (`/page/<slug>`, no `?snapshot=1`
 * and no `?view=playground`) and scopes every locator to
 * `#overview-mount-basic` — the "Overview" section's live preview
 * (`packages/playground/src/component-page.svelte`), which mounts the
 * component's real, first/"basic" example (`overviewExample =
 * explicitlyFeatured[0] ?? examples[0]`) as a single, fully-hydrated,
 * interactive instance:
 *
 * - `?snapshot=1` (used by an earlier revision of this file, and by the
 *   `componentPage` fixture) is explicitly what SUPPRESSES this preview
 *   (`overviewExample` is `undefined` in snapshot mode) — it also forces
 *   every descendant's transition duration/delay to `0s !important`
 *   (`packages/playground/src/snapshot-mode.ts`), which would make these
 *   tests pass even if the exit-transition lifecycle itself were broken.
 * - `?view=playground` (the documentation page's separate "Playground" tab,
 *   used by an earlier revision of this file) mounts the component BARE with
 *   SYNTHESIZED props instead of the real example markup whenever the
 *   component's own manifest allows it (`canBareMount`) — which silently
 *   produces a real interactive instance for some components (Popover,
 *   HoverCard: their `trigger` snippet prop isn't named `children`, so it's
 *   an unsatisfiable REQUIRED prop and the mount falls back to the real
 *   example) but NOT for Tooltip, whose `children` is OPTIONAL: an
 *   unsatisfiable optional snippet prop doesn't block the bare mount, so it
 *   mounts with no children at all — an empty, zero-size
 *   `.cinder-tooltip-wrapper` with nothing to hover, which is exactly what
 *   produced CI's `hover: Test timeout of 90000ms exceeded` failure.
 *   NavigationBar's snippet props (`items`, etc.) ARE all required, so it
 *   DOES fall back to the real example under `?view=playground` — but the
 *   Playground tab's preview stage defaults to a wide fixed width
 *   independent of the outer browser viewport, so its collapsed-mobile
 *   breakpoint never engaged, producing CI's `click: Test timeout` on the
 *   hidden (`display: none` below the breakpoint) menu toggle.
 *
 * The Overview preview sidesteps both problems: it's always the real example
 * (never bare-mount-synthesized), and it isn't gated behind a fixed stage
 * width — it flows with the actual page/viewport width like ordinary content.
 *
 * Two further, CI-confirmed corrections (run 32795764067, job 97646670185):
 *
 * - Tooltip: `page.locator('.cinder-tooltip').first()` collided with the
 *   documentation page's OWN chrome — every code block on the page has a
 *   "Copy" button wired through this same Tooltip component, whose panel
 *   ("Copy import") sorts earlier in the DOM than the Overview example's.
 *   `.first()` silently asserted against that unrelated, permanently-closed
 *   tooltip instead. Filtered on the actual example text instead of position.
 * - NavigationBar: the Overview section's live preview flows inside the
 *   documentation page's own responsive layout (sidebar nav, content
 *   column), which doesn't collapse to the same width as the outer browser
 *   viewport — CI's `click: Test timeout` on `getByRole('button', {name:
 *   'Open menu'})` confirms the toggle never became visible even at a
 *   390px viewport. Switched to `?snapshot=1` + `#example-mount-basic` (the
 *   dedicated, isolated, full-width single-example testing surface used
 *   elsewhere in this suite, e.g. `floating-surface-containment.playwright.ts`)
 *   instead, which is unaffected by the documentation page's own layout.
 *   Trade-off: snapshot mode forces every transition duration to `0s`
 *   (`packages/playground/src/snapshot-mode.ts`), so this specific test can
 *   no longer prove the exit plays over a REAL, non-zero duration the way
 *   the other three in this file do — it still proves the panel stays
 *   mounted/portaled/visible through `data-cinder-closing` before
 *   unmounting, which is the part snapshot mode doesn't defeat.
 */

test('Popover renders data-cinder-closing during its exit transition, then unmounts', async ({
  page,
}) => {
  await page.goto('/page/popover', { waitUntil: 'load' });
  const overview = page.locator('#overview-mount-basic');
  await expect(overview).toHaveAttribute('data-overview-preview-rendered', '');

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
  const overview = page.locator('#overview-mount-basic');
  await expect(overview).toHaveAttribute('data-overview-preview-rendered', '');

  const trigger = overview.getByRole('button', { name: 'Hover me' }).first();
  await trigger.hover();

  // Filtered on the example's actual text, not `.first()`: the documentation
  // page's own "Copy" code-block buttons are wired through this same
  // Tooltip component, and their (permanently-closed) panel sorts earlier
  // in the DOM.
  const tip = page.locator('.cinder-tooltip', { hasText: 'This is a helpful explanation.' });
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
  const overview = page.locator('#overview-mount-basic');
  await expect(overview).toHaveAttribute('data-overview-preview-rendered', '');

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
  await page.goto('/page/navigation-bar?snapshot=1', { waitUntil: 'load' });
  const example = page.locator('#example-mount-basic');
  const toggle = example.getByRole('button', { name: 'Open menu' }).first();
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
