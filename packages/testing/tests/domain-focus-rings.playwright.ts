/// <reference lib="dom" />
/**
 * Browser proof for dense domain focus rings.
 *
 * The source-level focus-ring tests pin the CSS recipes. This spec proves the
 * rendered behavior inside a real Chat surface with keyboard Tab navigation:
 * focus must come from the keyboard so Chromium applies :focus-visible.
 */
import { resolve } from 'node:path';

import { expect, test, type Browser, type Locator, type Page } from '@playwright/test';

import {
  findFixture,
  loadFixtureFile,
} from '../../components/scripts/lib/visual-fixtures/loader.ts';
import { boxShadowLayerCount, waitForFocusStyleFrame } from '../src/helpers/focus-ring.ts';
import { PLAYGROUND_URL } from '../src/helpers/playground-url.ts';
import { THEME_STORAGE_KEY } from '../src/helpers/theme.ts';

const HARNESS = '[data-testid="chat-private-harness"]';
const privateFixtureFile = await loadFixtureFile(
  resolve(import.meta.dirname, '../../chat/src/lib/components/chat/chat-fixtures.ts'),
);

if (
  privateFixtureFile === null ||
  findFixture(privateFixtureFile, 'private-harness') === undefined
) {
  throw new Error('Chat private harness fixture is missing.');
}

const PRIVATE_HARNESS_FIXTURE_HASH = privateFixtureFile.contentHash;

type ChatHarnessPage = {
  page: Page;
  harness: Locator;
  dispose: () => Promise<void>;
};

async function openChatHarness(
  browser: Browser,
  options: { forcedColors?: 'active' } = {},
): Promise<ChatHarnessPage> {
  const context = await browser.newContext({
    baseURL: PLAYGROUND_URL,
    colorScheme: 'dark',
    reducedMotion: 'reduce',
    viewport: { width: 1280, height: 900 },
    ...(options.forcedColors !== undefined ? { forcedColors: options.forcedColors } : {}),
  });
  await context.addInitScript(
    ([key, value]) => {
      try {
        localStorage.setItem(key, value);
      } catch {
        /* ignore */
      }
    },
    [THEME_STORAGE_KEY, 'dark'] as const,
  );

  const page = await context.newPage();
  await page.goto(
    `/page/chat?snapshot=1&fixture=private-harness&fixtureContentHash=${PRIVATE_HARNESS_FIXTURE_HASH}`,
    { waitUntil: 'load' },
  );
  await page.waitForSelector('#app > *', { state: 'visible', timeout: 20_000 });

  const harness = page.locator(HARNESS);
  await harness.waitFor({ state: 'visible', timeout: 20_000 });

  return { page, harness, dispose: () => context.close() };
}

async function blurToBody(page: Page): Promise<void> {
  await page.evaluate(() => {
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    document.body.focus();
  });
}

async function activeElementSummary(page: Page): Promise<string> {
  return page.evaluate(() => {
    const element = document.activeElement;
    if (!element) return '<none>';
    const id = element.id ? `#${element.id}` : '';
    const classes =
      element instanceof HTMLElement && element.className
        ? `.${String(element.className).trim().replace(/\s+/g, '.')}`
        : '';
    return `${element.tagName.toLowerCase()}${id}${classes}`;
  });
}

async function tabUntilFocused(
  page: Page,
  target: Locator,
  label: string,
  maxPresses = 80,
  direction: 'forward' | 'backward' = 'forward',
): Promise<void> {
  for (let attempt = 0; attempt < maxPresses; attempt += 1) {
    await page.keyboard.press(direction === 'forward' ? 'Tab' : 'Shift+Tab');
    const landed = await target.evaluate((element) => element === document.activeElement);
    if (landed) return;
  }

  throw new Error(
    `Tab walk did not reach ${label}; active element is ${await activeElementSummary(page)}`,
  );
}

async function focusPaint(target: Locator): Promise<{
  boxShadow: string;
  forcedColorsActive: boolean;
  matchesFocusVisible: boolean;
  outlineColor: string;
  outlineColorAlpha: number;
  outlineStyle: string;
  outlineWidth: string;
}> {
  await waitForFocusStyleFrame(target);
  return target.evaluate((element) => {
    function colorAlpha(color: string): number {
      const canvas = document.createElement('canvas');
      canvas.width = 1;
      canvas.height = 1;
      const context = canvas.getContext('2d');
      if (!context) return 0;
      context.clearRect(0, 0, 1, 1);
      context.fillStyle = color;
      context.fillRect(0, 0, 1, 1);
      return context.getImageData(0, 0, 1, 1).data[3] ?? 0;
    }

    const styles = getComputedStyle(element as HTMLElement);
    return {
      boxShadow: styles.boxShadow,
      forcedColorsActive: window.matchMedia('(forced-colors: active)').matches,
      matchesFocusVisible: element.matches(':focus-visible'),
      outlineColor: styles.outlineColor,
      outlineColorAlpha: colorAlpha(styles.outlineColor),
      outlineStyle: styles.outlineStyle,
      outlineWidth: styles.outlineWidth,
    };
  });
}

type FocusPaint = Awaited<ReturnType<typeof focusPaint>>;

/**
 * Wait for the element's own focus-ring recipe to actually be in effect,
 * rather than trusting that a single post-focus animation frame (see
 * `waitForFocusStyleFrame`) is always enough.
 *
 * CIN-516: on CI this test intermittently caught `.chat-timeline` with a
 * fully opaque `currentColor` outline (not the recipe's `transparent`) one
 * frame after a genuine keyboard Tab landed on it — `outline-style`/`-width`
 * were already correct, only the color hadn't settled. Cinder's chat
 * component ships its scoped CSS as a package stylesheet that Svelte 5
 * injects through a deferred (non-render) `effect()`, not synchronously with
 * mount, so there is a real — if normally sub-millisecond — window where an
 * element can be focused and `:focus-visible`-matching before its own
 * component styles have been applied. A single rAF does not bound that
 * window; polling for the recipe's actual signature (transparent outline)
 * does, without touching the harness or raising any timeout.
 *
 * The poll is bounded well under Playwright's 5s default `expect` timeout:
 * the settle window this guards against is normally a handful of
 * milliseconds (an effect flush), not seconds, so a genuinely broken recipe
 * should still fail fast rather than silently eating a multi-second wait
 * before surfacing.
 */
const FOCUS_RING_SETTLE_TIMEOUT_MS = 500;
const FOCUS_RING_SETTLE_POLL_INTERVALS_MS = [10, 25, 50, 100];

async function waitForSettledFocusPaint(target: Locator, label: string): Promise<FocusPaint> {
  let paint: FocusPaint = await focusPaint(target);
  try {
    await expect
      .poll(
        async () => {
          paint = await focusPaint(target);
          return paint.outlineColorAlpha;
        },
        { timeout: FOCUS_RING_SETTLE_TIMEOUT_MS, intervals: FOCUS_RING_SETTLE_POLL_INTERVALS_MS },
      )
      .toBe(0);
  } catch (error) {
    throw new Error(
      `${label} focus-ring recipe never settled to a transparent outline ` +
        `(outlineColor=${paint.outlineColor}, boxShadow=${paint.boxShadow}, ` +
        `matchesFocusVisible=${paint.matchesFocusVisible})`,
      { cause: error },
    );
  }
  return paint;
}

async function assertSharedOuterRing(target: Locator, label: string): Promise<void> {
  const paint = await waitForSettledFocusPaint(target, label);

  expect(paint.matchesFocusVisible, `${label} should match :focus-visible`).toBe(true);
  expect(paint.outlineStyle, `${label} should reserve an outline channel`).toBe('solid');
  expect(parseFloat(paint.outlineWidth), `${label} outline width`).toBeGreaterThan(0);
  expect(paint.boxShadow, `${label} should paint a focus shadow`).not.toBe('none');
  expect(
    boxShadowLayerCount(paint.boxShadow),
    `${label} should use the shared two-stop ring`,
  ).toBeGreaterThanOrEqual(2);
  expect(paint.boxShadow, `${label} should not use an inset ring`).not.toContain('inset');
}

async function assertInsetRing(target: Locator, label: string): Promise<void> {
  const paint = await waitForSettledFocusPaint(target, label);

  expect(paint.matchesFocusVisible, `${label} should match :focus-visible`).toBe(true);
  expect(paint.outlineStyle, `${label} should reserve an outline channel`).toBe('solid');
  expect(parseFloat(paint.outlineWidth), `${label} outline width`).toBeGreaterThan(0);
  expect(paint.boxShadow, `${label} should paint an inset focus shadow`).toContain('inset');
}

async function seedDenseChatSurface(harness: Locator): Promise<void> {
  await harness.locator('[data-testid="seed-thread"]').click();
  await expect(harness.locator('[data-role="assistant"]').first()).toBeVisible({ timeout: 5_000 });

  const timeline = harness.locator('.chat-timeline');
  await timeline.evaluate((element) => {
    element.scrollTop = 0;
    element.dispatchEvent(new Event('scroll', { bubbles: true }));
  });
  await expect.poll(async () => timeline.evaluate((element) => element.scrollTop)).toBe(0);
  await expect(harness.locator('.chat-jump-button')).toBeVisible({ timeout: 5_000 });

  const composer = harness.locator('textarea.chat-input-editor').first();
  await composer.fill('Keyboard focus ring check');
  await expect(harness.locator('.chat-input-send')).toBeEnabled();
}

test.describe('domain focus rings -- chat harness', () => {
  test('keyboard tabs through dense chat targets with visible recipe-backed rings', async ({
    browser,
  }) => {
    const { page, harness, dispose } = await openChatHarness(browser);
    try {
      await seedDenseChatSurface(harness);

      const timeline = harness.locator('.chat-timeline');
      const messageCopy = harness.locator('.chat-message-action-button.chat-message-copy').first();
      const jumpToLatest = harness.locator('.chat-jump-button');
      const sendButton = harness.locator('.chat-input-send');
      const composer = harness.locator('textarea.chat-input-editor').first();

      await expect(timeline).toBeVisible();
      await expect(messageCopy).toBeAttached();
      await expect(jumpToLatest).toBeVisible();
      await expect(composer).toBeVisible();
      await expect(sendButton).toBeEnabled();

      await blurToBody(page);

      await tabUntilFocused(page, timeline, 'chat timeline', 120);
      await expect(timeline).toBeFocused();
      await assertInsetRing(timeline, 'chat timeline');

      await tabUntilFocused(page, messageCopy, 'message copy action', 8);
      await expect(messageCopy).toBeFocused();
      await assertSharedOuterRing(messageCopy, 'message copy action');

      await composer.click();
      await tabUntilFocused(page, jumpToLatest, 'jump to latest', 8, 'backward');
      await expect(jumpToLatest).toBeFocused();
      await assertSharedOuterRing(jumpToLatest, 'jump to latest');

      await composer.click();
      await tabUntilFocused(page, sendButton, 'send button', 8);
      await expect(sendButton).toBeFocused();
      await assertSharedOuterRing(sendButton, 'send button');
    } finally {
      await dispose();
    }
  });

  test('forced-colors fallback repaints the send button outline', async ({ browser }) => {
    const { page, harness, dispose } = await openChatHarness(browser, { forcedColors: 'active' });
    try {
      await seedDenseChatSurface(harness);
      await expect
        .poll(() => page.evaluate(() => window.matchMedia('(forced-colors: active)').matches))
        .toBe(true);

      const sendButton = harness.locator('.chat-input-send');
      await blurToBody(page);
      await tabUntilFocused(page, sendButton, 'send button', 160);
      await expect(sendButton).toBeFocused();

      const paint = await focusPaint(sendButton);
      expect(paint.matchesFocusVisible).toBe(true);
      expect(paint.outlineStyle).toBe('solid');
      expect(parseFloat(paint.outlineWidth)).toBeGreaterThan(0);
      expect(paint.outlineColorAlpha).toBeGreaterThan(0);
    } finally {
      await dispose();
    }
  });
});

test.describe('domain focus rings -- CIN-516 settle race regression', () => {
  /**
   * Deterministic reproduction of the CIN-516 CI flake, isolated from the
   * Chat harness (and its "dense surface" cost) so it always fails the same
   * way with no fix, on any machine, on every run.
   *
   * The CI failure's own signature — captured in the failing assertion and
   * the blob report step log for run 33600421893's `playwright-lane (4, 8)`
   * job — was: a genuine keyboard Tab lands on the target
   * (`toBeFocused` passes, `:focus-visible` matches, `outline-style`/`-width`
   * already correct) but `outline-color` reads back as an opaque
   * `currentColor` instead of the recipe's `transparent`. That is exactly
   * what an `outline: <width> solid` declaration (color omitted, so it
   * defaults to `currentColor`) followed later by a second stylesheet
   * supplying `outline-color: transparent` plus the inset box-shadow
   * produces — the shape of the cascade before Cinder's own scoped focus-ring
   * CSS (which Chat ships as a package stylesheet that Svelte 5 applies
   * through a deferred, non-render `effect()` rather than synchronously with
   * mount) has taken effect.
   *
   * This harness stands in for that window instead of trying to force the
   * real one, which does not reproduce under CDP CPU or network throttling
   * locally (tried up to 15x CPU and 300ms latency, 55 attempts, zero
   * repros) — the actual bottleneck is Svelte's internal effect-flush
   * scheduling under a CI worker, not raw compute or network speed.
   *
   * The "later" stylesheet is applied from the test driver via
   * `page.addStyleTag()`, not an in-page `setTimeout`. An earlier version
   * scheduled it with `setTimeout(..., 150)` inside the page; on CI that
   * consistently timed out the 500ms settle poll with the DOM still in its
   * exact pre-injection state (`outlineColor` reading back as the target's
   * own `color`, `boxShadow: 'none'`) on two independent shards with
   * byte-identical failure values — the in-page timer never fired inside
   * the window, not a slow settle. `addStyleTag()` removes that dependency
   * on real browser timer scheduling entirely. The trade-off: this no
   * longer exercises `waitForSettledFocusPaint`'s poll waiting through a
   * genuinely delayed mutation — that property is covered by the two
   * `chat harness` tests above, which race the real Svelte effect flush on
   * the real Chat component and passed on the same CI runners that hit this
   * failure (run 34501975815, shard `playwright-visual shard 7`). This test
   * instead proves, deterministically, that the pre-settle paint really is
   * the CIN-516 failure signature and that the production read function
   * still reports the settled recipe once it has landed.
   */
  test('a focus-visible outline that settles after a delay is not read mid-settle', async ({
    browser,
  }) => {
    const context = await browser.newContext({ reducedMotion: 'reduce' });
    const page = await context.newPage();
    try {
      await page.setContent(`
        <style>
          /* The pre-recipe state: an outline channel is already reserved
             (matching Cinder's real components before their own CSS lands)
             but no color is specified, so it defaults to currentColor. */
          #target:focus-visible { outline: 3px solid; }
        </style>
        <button id="target" style="margin: 40px; color: rgb(218, 230, 241);">Target</button>
      `);

      const target = page.locator('#target');
      await page.keyboard.press('Tab');
      await expect(target).toBeFocused();

      // Confirm this really does reproduce the CIN-516 signature before the
      // recipe lands: a fully opaque `currentColor` outline, no shadow yet.
      // Reading through `focusPaint` directly (not the settle poll) proves
      // the pre-fix single-rAF read would have reported this as final.
      const preSettle = await focusPaint(target);
      expect(
        preSettle.outlineColorAlpha,
        'pre-settle outline should still be opaque',
      ).toBeGreaterThan(0);
      expect(preSettle.boxShadow, 'pre-settle should have no shadow yet').toBe('none');

      // Stand-in for Cinder's component-owned focus-ring override landing
      // after the element is already focused: a later stylesheet supplies
      // the transparent outline and inset box-shadow the recipe expects.
      await page.addStyleTag({
        content:
          '#target:focus-visible { outline-color: transparent; box-shadow: inset 0 0 0 3px rgb(218, 230, 241); }',
      });

      // Passes once the recipe has actually landed; would still fail against
      // the pre-fix single-rAF `focusPaint` read taken before this point.
      await assertInsetRing(target, 'delayed-settle target');
    } finally {
      await context.close();
    }
  });
});
