import { expect, test } from '../src/fixtures/component-page.ts';
import { loadManifest, VIEWPORTS } from '../src/helpers/manifest.ts';

/**
 * CIN-376: every anchored overlay migrated onto the shared exit-transition
 * lifecycle (`AnchoredOverlayExitState` / `waitForSpeedDialExit`, see
 * `_internal/OVERLAY-POLICY.md` § "Transition lifecycle") must render
 * `data-cinder-closing` for the duration of its real exit transition, then
 * actually unmount/hide once it finishes — not snap away instantly.
 *
 * These tests force `reducedMotion: 'no-preference'` (the `componentPage`
 * fixture's `themeContextOptions` otherwise forces `reduce` for screenshot
 * determinism — see `src/helpers/theme.ts`) so the real, non-collapsed
 * transition plays out and `data-cinder-closing` is observable mid-flight.
 * The companion reduced-motion project (`overlay-reduced-motion-exit.playwright.ts`)
 * covers the opposite case: immediate unmount when motion IS reduced.
 */

const manifest = loadManifest();

function getDesktopViewport(): (typeof VIEWPORTS)[number] {
  const viewport = VIEWPORTS.find((candidate) => candidate.name === 'desktop');
  if (!viewport) throw new Error('Desktop viewport is required for exit-transition tests.');
  return viewport;
}

const desktopViewport = getDesktopViewport();

function manifestEntry(slug: string) {
  const entry = manifest.find((candidate) => candidate.slug === slug);
  if (!entry) throw new Error(`Missing manifest entry for ${slug}.`);
  return entry;
}

test('Popover renders data-cinder-closing during its exit transition, then unmounts', async ({
  componentPage,
}) => {
  const page = await componentPage.open({
    entry: manifestEntry('popover'),
    theme: 'light',
    viewport: desktopViewport,
    contextOptions: { reducedMotion: 'no-preference' },
  });

  const trigger = page.getByRole('button', { name: 'Account settings' }).first();
  await trigger.click();

  const panel = page.locator('.cinder-popover').first();
  await expect(panel).toHaveAttribute('data-cinder-position-ready', 'true');

  await trigger.click();

  await expect(panel).toHaveAttribute('data-cinder-closing', '');
  await expect(panel).toHaveCount(0);
});

test('Tooltip renders data-cinder-closing during its exit transition, then hides', async ({
  componentPage,
}) => {
  const page = await componentPage.open({
    entry: manifestEntry('tooltip'),
    theme: 'light',
    viewport: desktopViewport,
    contextOptions: { reducedMotion: 'no-preference' },
  });

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
  componentPage,
}) => {
  const page = await componentPage.open({
    entry: manifestEntry('hover-card'),
    theme: 'light',
    viewport: desktopViewport,
    contextOptions: { reducedMotion: 'no-preference' },
  });

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
  await page.goto('/page/navigation-bar?snapshot=1', { waitUntil: 'load' });

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
