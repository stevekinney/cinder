/**
 * CIN-377: image-lightbox migrated from a hand-rolled dialog shell onto
 * Modal (chrome="none"). This is the nested-overlay regression the migration
 * exists to fix: a Modal-class lightbox opened from inside a Drawer must
 * respect the shared LIFO escape stack (`_internal/overlay.ts` §
 * `pushEscapeHandler` — see `OVERLAY-POLICY.md` § "Escape priority") — Escape
 * dismisses only the top-most overlay — and the counted body-scroll lock
 * (`lockBodyScroll()`) must leave scroll correctly locked/unlocked in BOTH
 * dismissal orders: lightbox-then-drawer and drawer-then-lightbox.
 *
 * Harness: chat has no Playwright wiring of its own. The mount surface is
 * the same one `chat-harness.playwright.ts` already uses — the playground's
 * `/page/chat` docs route, which mounts a private (non-published) Chat
 * fixture via `?fixture=<name>&fixtureContentHash=<hash>`. This fixture
 * (`chat-private-lightbox-nested-overlay.fixture.svelte`) is a minimal
 * harness built for exactly this test: a Drawer containing a button that
 * opens the (real, composed-with-Modal) ImageLightbox on top of it. No
 * Modal-in-Modal case is required — only the Drawer-nesting scenario.
 */
import { resolve } from 'node:path';

import { expect, test, type Browser, type Locator, type Page } from '@playwright/test';

import {
  findFixture,
  loadFixtureFile,
} from '../../components/scripts/lib/visual-fixtures/loader.ts';
import { runAxe } from '../src/helpers/axe.ts';
import { PLAYGROUND_URL } from '../src/helpers/playground-url.ts';

const HARNESS = '[data-testid="lightbox-nested-overlay-harness"]';

const privateFixtureFile = await loadFixtureFile(
  resolve(import.meta.dirname, '../../chat/src/lib/components/chat/chat-fixtures.ts'),
);

if (privateFixtureFile === null) {
  throw new Error('Chat private fixture file is missing.');
}

const nestedOverlayFixture = findFixture(privateFixtureFile, 'private-lightbox-nested-overlay');

if (nestedOverlayFixture === undefined) {
  throw new Error('Chat private-lightbox-nested-overlay fixture is missing.');
}

const FIXTURE_HASH = privateFixtureFile.contentHash;

async function openHarness(
  browser: Browser,
): Promise<{ page: Page; harness: Locator; dispose: () => Promise<void> }> {
  const context = await browser.newContext({
    baseURL: PLAYGROUND_URL,
    colorScheme: 'dark',
    reducedMotion: 'reduce',
    viewport: { width: 1280, height: 900 },
  });
  const page = await context.newPage();
  await page.goto(
    `/page/chat?snapshot=1&fixture=private-lightbox-nested-overlay&fixtureContentHash=${FIXTURE_HASH}`,
    { waitUntil: 'load' },
  );
  await page.waitForSelector('#app > *', { state: 'visible', timeout: 20_000 });
  const harness = page.locator(HARNESS);
  await harness.waitFor({ state: 'visible', timeout: 20_000 });
  return { page, harness, dispose: () => context.close() };
}

/** Opens the drawer, then the lightbox on top of it. Returns their locators. */
async function openDrawerThenLightbox(
  harness: Locator,
): Promise<{ drawer: Locator; lightbox: Locator }> {
  await harness.getByRole('button', { name: 'Open drawer' }).click();
  const drawer = harness.page().locator('.cinder-drawer__panel');
  await expect(drawer).toBeVisible();

  await harness.locator('[data-testid="open-lightbox"]').click();
  const lightbox = harness.page().locator('dialog.lightbox-modal[open]');
  await expect(lightbox).toBeVisible();

  return { drawer, lightbox };
}

test.describe('nested overlay — image lightbox inside a Drawer', () => {
  test('Escape dismisses only the lightbox, leaving the Drawer open', async ({ browser }) => {
    const { page, harness, dispose } = await openHarness(browser);
    try {
      const { drawer, lightbox } = await openDrawerThenLightbox(harness);

      await page.keyboard.press('Escape');
      await expect(lightbox).toBeHidden();
      // The Drawer, being the lower overlay on the shared escape stack, must
      // still be open — this is the regression the shared LIFO stack exists
      // to prevent (a hand-rolled Escape handler bypasses it entirely).
      await expect(drawer).toBeVisible();

      // A second Escape now dismisses the Drawer, the new top of the stack.
      await page.keyboard.press('Escape');
      await expect(drawer).toBeHidden();
    } finally {
      await dispose();
    }
  });

  test('scroll stays locked after the lightbox closes while the Drawer is still open (lightbox-then-drawer order)', async ({
    browser,
  }) => {
    const { page, harness, dispose } = await openHarness(browser);
    try {
      const { drawer, lightbox } = await openDrawerThenLightbox(harness);
      await expect(page.locator('body')).toHaveCSS('overflow', 'hidden');

      // Close the lightbox first (Escape — the top of the stack).
      await page.keyboard.press('Escape');
      await expect(lightbox).toBeHidden();
      await expect(drawer).toBeVisible();
      // The counted lock has one remaining holder (the Drawer): scroll must
      // still be locked. A regression here would mean the lightbox's lock
      // release ignored the shared counter and unlocked scroll prematurely.
      await expect(page.locator('body')).toHaveCSS('overflow', 'hidden');

      // Now close the Drawer too — the counter reaches zero and scroll
      // restores.
      await page.keyboard.press('Escape');
      await expect(drawer).toBeHidden();
      await expect(page.locator('body')).not.toHaveCSS('overflow', 'hidden');
    } finally {
      await dispose();
    }
  });

  test("scroll stays locked after the Drawer's own close path while the lightbox is still open (drawer-then-lightbox order)", async ({
    browser,
  }) => {
    const { page, harness, dispose } = await openHarness(browser);
    try {
      const { drawer, lightbox } = await openDrawerThenLightbox(harness);
      await expect(page.locator('body')).toHaveCSS('overflow', 'hidden');

      // Drive the Drawer's own close button rather than Escape, to also
      // cover a non-Escape dismissal path while the lightbox sits above it
      // on the escape stack. The lightbox's <dialog> is a real top-layer
      // native modal covering the full viewport, so the Drawer's close
      // button is genuinely un-clickable by a real pointer while it's open
      // (Playwright's actionability check would hang waiting for it to
      // become hit-testable, which it never will). `dispatchEvent` invokes
      // the button's own click handler directly, bypassing hit-testing —
      // the same pattern `chat-harness.playwright.ts` uses to drive a
      // control that sits behind/under something else in the DOM.
      await harness.page().locator('.cinder-drawer__close').dispatchEvent('click');
      await expect(drawer).toBeHidden();
      // The lightbox (still open, still holding the lock) keeps scroll
      // locked — the Drawer releasing its hold must not zero the counter.
      await expect(lightbox).toBeVisible();
      await expect(page.locator('body')).toHaveCSS('overflow', 'hidden');

      // Close the lightbox: the counter reaches zero and scroll restores.
      // This IS a real, reachable click — the lightbox is the top-layer
      // dialog, so its own controls are genuinely clickable.
      await lightbox.getByRole('button', { name: 'Close image viewer' }).click();
      await expect(lightbox).toBeHidden();
      await expect(page.locator('body')).not.toHaveCSS('overflow', 'hidden');
    } finally {
      await dispose();
    }
  });

  test('the lightbox exposes role="dialog"/aria-modal from Modal\'s own markup, not a hand-rolled one', async ({
    browser,
  }) => {
    const { harness, dispose } = await openHarness(browser);
    try {
      const { lightbox } = await openDrawerThenLightbox(harness);
      await expect(lightbox).toHaveAttribute('role', 'dialog');
      await expect(lightbox).toHaveAttribute('aria-modal', 'true');
      await expect(lightbox).toHaveAttribute('aria-label', 'Image viewer');
    } finally {
      await dispose();
    }
  });

  test('has no critical/serious axe violations with the lightbox open over the Drawer', async ({
    browser,
  }) => {
    const { page, harness, dispose } = await openHarness(browser);
    try {
      await openDrawerThenLightbox(harness);
      const buckets = await runAxe(
        page,
        {
          slug: 'chat',
          theme: 'dark',
          viewport: 'desktop',
          fixture: 'private-lightbox-nested-overlay',
        },
        { include: HARNESS },
      );
      expect(buckets.critical, JSON.stringify(buckets.critical, null, 2)).toHaveLength(0);
      expect(buckets.serious, JSON.stringify(buckets.serious, null, 2)).toHaveLength(0);
    } finally {
      await dispose();
    }
  });
});

test.describe('nested overlay — image lightbox preserves its current image through the exit transition (CIN-377 review)', () => {
  // Deliberately its own context, NOT `openHarness`: that helper passes
  // `?snapshot=1` (which zeroes CSS animation durations for screenshot
  // determinism) and forces `reducedMotion: 'reduce'` — both would collapse
  // Modal's exit transition to zero length, making `data-cinder-closing`
  // unobservable mid-flight. This test needs the OPPOSITE: a real,
  // non-collapsed transition, so it can catch the actual regression (the
  // displayed image snapping back to the initial one mid-fade instead of
  // holding the last-navigated image for the whole exit window). Same
  // pattern as `overlay-exit-transition.playwright.ts`.
  test('navigating then closing keeps the navigated image visible while data-cinder-closing is set', async ({
    browser,
  }) => {
    const context = await browser.newContext({
      baseURL: PLAYGROUND_URL,
      colorScheme: 'dark',
      reducedMotion: 'no-preference',
      viewport: { width: 1280, height: 900 },
    });
    try {
      const page = await context.newPage();
      await page.goto(
        `/page/chat?fixture=private-lightbox-nested-overlay&fixtureContentHash=${FIXTURE_HASH}`,
        { waitUntil: 'load' },
      );
      await page.waitForSelector('#app > *', { state: 'visible', timeout: 20_000 });
      const harness = page.locator(HARNESS);
      await harness.waitFor({ state: 'visible', timeout: 20_000 });

      await harness.getByRole('button', { name: 'Open drawer' }).click();
      await harness.locator('[data-testid="open-lightbox"]').click();
      const lightbox = harness.page().locator('dialog.lightbox-modal[open]');
      await expect(lightbox).toBeVisible();

      // Navigate from the first image to the second.
      await expect(lightbox.locator('img')).toHaveAttribute('alt', 'First image');
      await lightbox.getByRole('button', { name: 'Next image' }).click();
      await expect(lightbox.locator('img')).toHaveAttribute('alt', 'Second image');

      // Close, then immediately assert while the exit transition is still
      // playing: the panel carries `data-cinder-closing` for the whole exit
      // window (see OVERLAY-POLICY.md § "Transition lifecycle"), and the
      // image must still be the one the user navigated to — NOT reset to
      // the initial image mid-fade.
      await lightbox.getByRole('button', { name: 'Close image viewer' }).click();
      const panel = harness.page().locator('.cinder-modal__panel[data-cinder-closing]');
      await expect(panel).toBeVisible();
      await expect(panel.locator('img')).toHaveAttribute('alt', 'Second image');

      // And once the exit transition finishes, the panel is gone.
      await expect(lightbox).toBeHidden();
    } finally {
      await context.close();
    }
  });
});
