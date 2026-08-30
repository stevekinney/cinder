/**
 * Comprehensive browser coverage for the Chat interactive harness example
 * (`playground/src/examples/chat/interactive-harness.example.svelte`).
 *
 * The harness mounts <Chat> alongside a control panel that drives every lever:
 * reply as the other side (instant / typing / streaming, imperative +
 * content-mutation), inject tool calls (all outcomes), toggle features, and an
 * event log that records every callback as
 * `<div data-testid="event-log-entry" data-event=… data-payload=…>`.
 *
 * Everything is scoped to `#example-mount-interactive-harness` so the other
 * chat examples on `/page/chat` never interfere. `?snapshot=1` zeroes CSS
 * animation durations (JS timers are untouched), which makes the deterministic
 * streaming cadence reliably observable.
 */
import { resolve } from 'node:path';

import { expect, test, type Browser, type Locator, type Page } from '@playwright/test';
import { PNG } from 'pngjs';

import {
  findFixture,
  loadFixtureFile,
} from '../../components/scripts/lib/visual-fixtures/loader.ts';
import { runAxe } from '../src/helpers/axe.ts';
import { PLAYGROUND_URL } from '../src/helpers/playground-url.ts';
import { THEME_STORAGE_KEY } from '../src/helpers/theme.ts';

const HARNESS = '[data-testid="chat-private-harness"]';
const privateFixtureFile = await loadFixtureFile(
  resolve(import.meta.dirname, '../../chat/src/lib/components/chat/chat-fixtures.ts'),
);

if (privateFixtureFile === null) {
  throw new Error('Chat private fixture file is missing.');
}

const privateHarnessFixture = findFixture(privateFixtureFile, 'private-harness');
const privateHistoryPrependStressFixture = findFixture(
  privateFixtureFile,
  'private-history-prepend-stress',
);

if (privateHarnessFixture === undefined || privateHistoryPrependStressFixture === undefined) {
  throw new Error('Chat private fixtures are missing.');
}

const PRIVATE_HARNESS_FIXTURE_HASH = privateFixtureFile.contentHash;
const PRIVATE_HISTORY_PREPEND_STRESS_FIXTURE_HASH = privateFixtureFile.contentHash;

/** Opens /page/chat and returns a Locator scoped to the harness mount. */
async function openHarness(
  browser: Browser,
  options?: { reducedMotion?: 'reduce' | 'no-preference' },
): Promise<{ page: Page; harness: Locator; dispose: () => Promise<void> }> {
  const context = await browser.newContext({
    baseURL: PLAYGROUND_URL,
    colorScheme: 'dark',
    reducedMotion: options?.reducedMotion ?? 'reduce',
    viewport: { width: 1280, height: 900 },
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

/**
 * Asserts the event log eventually contains an entry for the given callback.
 * Uses an auto-retrying `toBeAttached` so it tolerates the async microtask
 * between a click and Svelte flushing the log mutation (a bare `.count()`
 * after `.click()` can read 0 before the flush and fail spuriously).
 */
async function expectLoggedEvent(harness: Locator, event: string): Promise<void> {
  await expect(
    harness.locator(`[data-testid="event-log-entry"][data-event="${event}"]`).first(),
  ).toBeAttached();
}

/** Trimmed length of a locator's text content (0 when empty/absent). */
async function trimmedLength(locator: Locator): Promise<number> {
  const text = await locator.textContent();
  return text?.trim().length ?? 0;
}

test.describe('chat harness — mounts cleanly', () => {
  test('renders the control panel and the chat under test with a quiet event log', async ({
    browser,
  }) => {
    const { harness, dispose } = await openHarness(browser);
    try {
      await expect(harness.locator('[data-testid="harness-controls"]')).toBeVisible();
      await expect(harness.locator('#harness-chat')).toBeVisible();
      // The unread-indicator de-dupe keeps the mount burst out of the log: at
      // rest there is at most one entry.
      const entries = await harness.locator('[data-testid="event-log-entry"]').count();
      expect(entries).toBeLessThanOrEqual(1);
    } finally {
      await dispose();
    }
  });
});

test.describe('chat harness — submit and reply', () => {
  test('a composer submit appends a user message and an auto-reply lands', async ({ browser }) => {
    const { harness, dispose } = await openHarness(browser);
    try {
      const composer = harness.locator('textarea.chat-input-editor').first();
      await composer.fill('What is alpha?');
      await harness.locator('.chat-input-send').click();

      await expect(harness.locator('[data-role="user"]')).toContainText('What is alpha?');
      await expectLoggedEvent(harness, 'onsubmit');
      // Auto-reply (default on) eventually lands an assistant message.
      await expect(harness.locator('[data-role="assistant"]')).toBeVisible({ timeout: 5_000 });
    } finally {
      await dispose();
    }
  });
});

test.describe('chat harness — typing indicator', () => {
  test('typing reply shows the indicator, then clears and the message appears', async ({
    browser,
  }) => {
    const { harness, dispose } = await openHarness(browser);
    try {
      // The typing indicator renders only inside a NON-empty transcript (Chat
      // gates it behind the {:else} of `messages.length === 0`), so seed a
      // thread first. Default reply mode is "typing".
      await harness.locator('[data-testid="seed-thread"]').click();
      await expect(harness.locator('[data-role="assistant"]').first()).toBeVisible();

      await harness.locator('[data-testid="send-reply"]').click();
      // The indicator's enter animation animates opacity 0→1; under ?snapshot=1
      // (animation-duration: 0s, no fill-mode) it holds at opacity 0, so assert
      // it is ATTACHED (rendered in the DOM) rather than "visible" — being in
      // the DOM is what proves the typing state. Its accessible name carries the
      // streamingStatus.
      const indicator = harness.locator('.chat-typing-indicator');
      await expect(indicator).toBeAttached();
      await expect(indicator).toHaveAttribute('aria-label', 'Assistant is typing…');
      // Then it clears and a new assistant message lands.
      await expect(indicator).toHaveCount(0, { timeout: 5_000 });
    } finally {
      await dispose();
    }
  });
});

for (const mechanism of ['imperative', 'content-mutation'] as const) {
  test.describe(`chat harness — streaming (${mechanism})`, () => {
    test('streams an intermediate partial, then Stop preserves it', async ({ browser }) => {
      const { harness, dispose } = await openHarness(browser);
      try {
        // Switch to streaming, then pick the mechanism.
        await harness
          .locator('#harness-reply-mode')
          .getByText('Streaming', { exact: true })
          .click();
        const label = mechanism === 'imperative' ? 'Imperative' : 'Content';
        await harness
          .locator('#harness-stream-mechanism')
          .getByText(label, { exact: true })
          .click();

        await harness.locator('[data-testid="send-reply"]').click();

        // The composer shows the Stop affordance while streaming.
        const stop = harness.locator('.chat-input-send[data-stop]');
        await expect(stop).toBeVisible();

        // The assistant message text grows across the deterministic cadence:
        // observe an intermediate partial that is non-empty but not yet final.
        const assistant = harness.locator('[data-role="assistant"]').last();
        await expect.poll(() => trimmedLength(assistant), { timeout: 3_000 }).toBeGreaterThan(0);
        const partialLength = await trimmedLength(assistant);

        // Click Stop: it preserves the partial content and fires onstopgenerating.
        await stop.click();
        await expectLoggedEvent(harness, 'onstopgenerating');
        await expect(harness.locator('.chat-input-send[data-stop]')).toHaveCount(0);
        // Exactly one assistant message remains (no stray blank/duplicate).
        await expect(harness.locator('[data-role="assistant"]')).toHaveCount(1);
        const afterStopLength = await trimmedLength(assistant);
        expect(afterStopLength).toBeGreaterThanOrEqual(partialLength);
      } finally {
        await dispose();
      }
    });
  });
}

test.describe('chat harness — tool calls', () => {
  for (const { outcome, status } of [
    { outcome: 'success', status: 'success' },
    { outcome: 'error', status: 'error' },
    { outcome: 'action_required', status: 'action-required' },
  ] as const) {
    test(`injects a ${outcome} tool call rendering data-status="${status}"`, async ({
      browser,
    }) => {
      const { harness, dispose } = await openHarness(browser);
      try {
        await harness.locator('#harness-tool-outcome').selectOption(outcome);
        await harness.locator('[data-testid="inject-tool"]').click();

        const group = harness.locator(`.tool-call-group[data-status="${status}"]`);
        await expect(group).toBeVisible();
        await expect(harness.locator('.tool-call-name')).toContainText('exports_check');
        // Never the [object Object] bug for the error branch.
        await expect(harness.locator('#harness-chat')).not.toContainText('[object Object]');
      } finally {
        await dispose();
      }
    });
  }

  test('invalid JSON arguments disables Inject and shows an error hint', async ({ browser }) => {
    const { harness, dispose } = await openHarness(browser);
    try {
      const args = harness.locator('[data-testid="tool-arguments"]');
      await args.fill('{ not valid json');
      await expect(harness.locator('[data-testid="tool-arguments-error"]')).toBeVisible();
      await expect(harness.locator('[data-testid="inject-tool"]')).toBeDisabled();
    } finally {
      await dispose();
    }
  });
});

test.describe('chat harness — empty state and prompts', () => {
  test('clearing shows empty prompts; clicking one submits it', async ({ browser }) => {
    const { harness, dispose } = await openHarness(browser);
    try {
      await harness.locator('[data-testid="clear"]').click();
      const prompts = harness.locator('.chat-empty-prompt');
      await expect(prompts.first()).toBeVisible();
      await prompts.first().click();
      await expect(harness.locator('[data-role="user"]')).toBeVisible();
    } finally {
      await dispose();
    }
  });

  test('toggling emptyPrompts off removes the starter prompts from the empty state', async ({
    browser,
  }) => {
    const { harness, dispose } = await openHarness(browser);
    try {
      await harness.locator('[data-testid="clear"]').click();
      // Prompts on (default): the empty state shows starter prompt buttons.
      await expect(harness.locator('.chat-empty-prompt').first()).toBeVisible();
      // Toggle off: the empty state remains but the prompts are gone.
      await harness.locator('#t-prompts').click();
      await expect(harness.locator('.chat-empty')).toBeVisible();
      await expect(harness.locator('.chat-empty-prompt')).toHaveCount(0);
    } finally {
      await dispose();
    }
  });
});

test.describe('chat harness — feature toggles', () => {
  test('allowCopy toggles the per-message copy button', async ({ browser }) => {
    const { harness, dispose } = await openHarness(browser);
    try {
      await harness.locator('[data-testid="send-reply"]').click();
      await expect(harness.locator('.chat-message-copy').first()).toBeVisible({ timeout: 5_000 });
      await harness.locator('#t-copy').click();
      await expect(harness.locator('.chat-message-copy')).toHaveCount(0);
    } finally {
      await dispose();
    }
  });

  test('allowSearch gates the in-app search bar', async ({ browser }) => {
    const { page, harness, dispose } = await openHarness(browser);
    try {
      await harness.locator('[data-testid="seed-thread"]').click();
      // Search on (default): Ctrl/Cmd+F over the timeline opens the search bar.
      await harness.locator('.chat-timeline').click();
      await page.keyboard.press('ControlOrMeta+f');
      await expect(harness.locator('.chat-search-input')).toBeVisible();

      // Toggle search off, reload state by closing, and confirm the bar no
      // longer opens.
      await page.keyboard.press('Escape');
      await harness.locator('#t-search').click();
      await expect(harness.locator('#t-search')).toHaveAttribute('aria-checked', 'false');
      await harness.locator('.chat-timeline').click();
      await page.keyboard.press('ControlOrMeta+f');
      await expect(harness.locator('.chat-search-input')).toHaveCount(0);
    } finally {
      await dispose();
    }
  });

  test('surfaceMode toggle flips the container surface attribute', async ({ browser }) => {
    const { harness, dispose } = await openHarness(browser);
    try {
      const container = harness.locator('.chat-container');
      const before = await container.getAttribute('data-surface-mode');
      await harness.locator('#t-surface').click();
      await expect.poll(async () => container.getAttribute('data-surface-mode')).not.toBe(before);
    } finally {
      await dispose();
    }
  });
});

test.describe('chat harness — snippets', () => {
  test('header / messageActions / messageStatus snippets render', async ({ browser }) => {
    const { harness, dispose } = await openHarness(browser);
    try {
      await expect(harness.locator('[data-testid="harness-header"]')).toBeVisible();
      await harness.locator('[data-testid="send-reply"]').click();
      await expect(harness.locator('[data-testid="harness-message-action"]').first()).toBeVisible({
        timeout: 5_000,
      });
      await expect(harness.locator('[data-testid="harness-message-status"]').first()).toBeVisible();
    } finally {
      await dispose();
    }
  });
});

test.describe('chat harness — search', () => {
  test('searching a known repeated token reports the match count and navigates', async ({
    browser,
  }) => {
    const { page, harness, dispose } = await openHarness(browser);
    try {
      await harness.locator('[data-testid="seed-thread"]').click();
      // The seeded thread repeats "alpha". Open search and query it.
      await harness.locator('.chat-timeline').click();
      await page.keyboard.press('ControlOrMeta+f');
      const search = harness.locator('.chat-search-input');
      await expect(search).toBeVisible();
      await search.fill('alpha');
      await expect(harness.locator('.chat-search-match-count')).toContainText(/\d+/);
    } finally {
      await dispose();
    }
  });
});

test.describe('chat harness — copy, edit, retry', () => {
  test('messages expose a copy affordance', async ({ browser }) => {
    // The copied-state transition (data-cinder-copied) and its mechanics are
    // already covered against the default chat example in
    // editors-complex-residual.playwright.ts. Here we just confirm the harness's
    // messages carry the copy affordance (gated by allowCopy, which the feature-
    // toggle test exercises).
    const { harness, dispose } = await openHarness(browser);
    try {
      await harness.locator('[data-testid="seed-thread"]').click();
      await expect(harness.locator('[data-role="assistant"]').first()).toBeVisible();
      // The copy button lives in each message's actions group.
      await expect(harness.locator('.chat-message-copy').first()).toBeAttached();
      await expect(harness.getByRole('button', { name: /copy message/i }).first()).toBeAttached();
    } finally {
      await dispose();
    }
  });

  test('retry appears on a failed message and fires onretry', async ({ browser }) => {
    const { harness, dispose } = await openHarness(browser);
    try {
      await harness.locator('[data-testid="seed-failed"]').click();
      const retry = harness.locator('.chat-message-retry').first();
      await expect(retry).toBeVisible();
      await retry.click();
      await expectLoggedEvent(harness, 'onretry');
    } finally {
      await dispose();
    }
  });
});

test.describe('chat harness — scroll, unread, jump', () => {
  test('scrolling a long thread up reveals jump-to-latest and fires scroll state', async ({
    browser,
  }) => {
    const { harness, dispose } = await openHarness(browser);
    try {
      await harness.locator('[data-testid="seed-thread"]').click();
      const timeline = harness.locator('.chat-timeline');
      await expect(timeline).toBeVisible();
      await timeline.evaluate((element) => {
        element.scrollTop = 0;
      });
      await expect.poll(async () => timeline.evaluate((element) => element.scrollTop)).toBe(0);
      await expect(harness.locator('.chat-jump-button')).toBeVisible({ timeout: 5_000 });
      await expectLoggedEvent(harness, 'onscrollstatechange');
    } finally {
      await dispose();
    }
  });

  test('jump-to-latest scrolls back to the bottom and fires onjumptolatest', async ({
    browser,
  }) => {
    const { harness, dispose } = await openHarness(browser);
    try {
      await harness.locator('[data-testid="seed-thread"]').click();
      const timeline = harness.locator('.chat-timeline');
      await timeline.evaluate((element) => {
        element.scrollTop = 0;
      });
      const jump = harness.locator('.chat-jump-button');
      await expect(jump).toBeVisible({ timeout: 5_000 });
      await jump.click();
      await expectLoggedEvent(harness, 'onjumptolatest');
    } finally {
      await dispose();
    }
  });

  test('virtualized history loading preserves the visible scroll anchor', async ({ browser }) => {
    const { harness, dispose } = await openHarness(browser);
    try {
      await harness.locator('#t-virtualized').click();
      await harness.locator('#t-history').click();
      await harness.locator('[data-testid="seed-thread"]').click();

      const timeline = harness.locator('.chat-timeline');
      await harness.locator('[data-testid="scroll-top"]').click();
      const anchor = timeline
        .locator('.chat-message')
        .filter({ hasText: 'Tell me about alpha.' })
        .first();
      await expect(anchor).toBeVisible();
      await expect
        .poll(async () => {
          const [anchorBox, timelineBox] = await Promise.all([
            anchor.boundingBox(),
            timeline.boundingBox(),
          ]);
          return anchorBox !== null && timelineBox !== null;
        })
        .toBe(true);
      const before = await anchor.boundingBox();
      const beforeTimeline = await timeline.boundingBox();
      expect(before).not.toBeNull();
      expect(beforeTimeline).not.toBeNull();
      const beforeOffset = (before?.y ?? 0) - (beforeTimeline?.y ?? 0);

      await timeline.getByRole('button', { name: /load earlier messages/i }).click();
      await expectLoggedEvent(harness, 'onloadhistory');
      await expect(anchor).toBeVisible();
      await expect
        .poll(async () => {
          const after = await anchor.boundingBox();
          const afterTimeline = await timeline.boundingBox();
          return Math.abs((after?.y ?? 0) - (afterTimeline?.y ?? 0) - beforeOffset);
        })
        .toBeLessThan(48);
      await expect
        .poll(async () => timeline.evaluate((element) => element.scrollTop))
        .toBeGreaterThan(0);
    } finally {
      await dispose();
    }
  });

  // Regression test for #1237: ask for older history while a smooth
  // scroll-to-top glide is still in flight — the natural flow, since the top
  // of the transcript is where the load-earlier trigger lives. The capture
  // used to snapshot the still-moving viewport, and the glide's smooth-scroll
  // animation (absolute target 0, where browsers also suppress native scroll
  // anchoring) then raced Chat's instant restore corrections: whichever
  // landed last won, either stranding the viewport mid-transcript or letting
  // the glide finish at 0 so the transcript shifted by exactly the prepended
  // height. Fixed by finishing the guarded scroll instantly at its
  // destination before capturing, which makes the outcome deterministic: the
  // viewport parks at the old top and the prepend leaves that content
  // exactly where it was.
  test('history prepend keeps the anchored message stable when parked at the top', async ({
    browser,
  }) => {
    const { page, harness, dispose } = await openHarness(browser, {
      reducedMotion: 'no-preference',
    });
    try {
      await harness.locator('#t-history').click();
      await harness.locator('[data-testid="seed-thread"]').click();

      const timeline = harness.locator('.chat-timeline');
      const anchor = timeline
        .locator('.chat-message')
        .filter({ hasText: 'Tell me about alpha.' })
        .first();

      // Pre-pass: measure the anchor's viewport-relative offset with the
      // viewport genuinely parked at the top. This is the deterministic
      // oracle the racy pass below must land on.
      await harness.locator('[data-testid="scroll-top"]').click();
      await expect.poll(async () => timeline.evaluate((element) => element.scrollTop)).toBe(0);
      await page.waitForTimeout(150);
      const parked = await anchor.boundingBox();
      const parkedTimeline = await timeline.boundingBox();
      expect(parked).not.toBeNull();
      expect(parkedTimeline).not.toBeNull();
      const parkedOffset = (parked?.y ?? 0) - (parkedTimeline?.y ?? 0);

      // Back to the bottom, fully settled, so the next scroll-to-top is a
      // real multi-hundred-millisecond glide.
      await harness.locator('[data-testid="scroll-bottom"]').click();
      await expect
        .poll(async () =>
          timeline.evaluate((element) =>
            Math.abs(element.scrollHeight - element.clientHeight - element.scrollTop),
          ),
        )
        .toBeLessThan(2);
      await page.waitForTimeout(150);

      // Racy pass: start the glide and ask for older history mid-flight.
      // dispatchEvent rather than .click(): the trigger sits at the top of
      // the transcript and Playwright's click would wait for stability and
      // scroll on its own, destroying the mid-glide timing this regression
      // depends on.
      await harness.locator('[data-testid="scroll-top"]').click();
      await timeline.getByRole('button', { name: /load earlier messages/i }).dispatchEvent('click');
      await expectLoggedEvent(harness, 'onloadhistory');
      await expect(timeline.getByText('Earlier context 1.1')).toBeAttached();

      // Wait for restoration (and any leftover animation) to fully settle
      // before measuring. Settling first — rather than polling for a
      // momentarily-close position — matters because the failure mode is a
      // race: a transiently correct position could still be shifted by
      // whichever correction lands last.
      await expect(timeline).not.toHaveAttribute('data-cinder-history-restoring');
      await expect
        .poll(async () =>
          timeline.evaluate(
            (element) =>
              new Promise<boolean>((resolve) => {
                const startTop = element.scrollTop;
                let frames = 0;
                const wait = () => {
                  frames += 1;
                  if (element.scrollTop !== startTop) resolve(false);
                  else if (frames >= 8) resolve(true);
                  else requestAnimationFrame(wait);
                };
                requestAnimationFrame(wait);
              }),
          ),
        )
        .toBe(true);

      // The transcript parked at the old top: the content that was visible
      // there is exactly where it was, with the prepended block above it.
      const after = await anchor.boundingBox();
      const afterTimeline = await timeline.boundingBox();
      expect(after).not.toBeNull();
      expect(afterTimeline).not.toBeNull();
      expect(Math.abs((after?.y ?? 0) - (afterTimeline?.y ?? 0) - parkedOffset)).toBeLessThan(3);
      // Position is held by scroll compensation, not by the prepend failing.
      await expect
        .poll(async () => timeline.evaluate((element) => element.scrollTop))
        .toBeGreaterThan(0);
    } finally {
      await dispose();
    }
  });

  test('user input before a prepend retains the non-virtualized history anchor', async ({
    browser,
  }) => {
    const { harness, dispose } = await openHarness(browser);
    try {
      await harness.locator('#t-history').click();
      await harness.locator('#t-history-delay').click();
      await harness.locator('[data-testid="seed-thread"]').click();

      const timeline = harness.locator('.chat-timeline');
      await harness.locator('[data-testid="scroll-top"]').click();
      const anchor = timeline.getByText('Tell me about alpha.').first();
      await expect(anchor).toBeVisible();
      await timeline.getByRole('button', { name: /load earlier messages/i }).click();
      const resolveHistory = harness.locator('[data-testid="resolve-history"]');
      await expect(resolveHistory).toBeEnabled();
      await timeline.dispatchEvent('pointerdown');
      await timeline.evaluate(async (element) => {
        for (const scrollTop of [40, 80, 120]) {
          element.scrollTop = scrollTop;
          await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
        }
      });
      await expect
        .poll(async () => timeline.evaluate((element) => element.scrollTop))
        .toBeGreaterThan(0);
      const moved = await anchor.boundingBox();
      const movedTimeline = await timeline.boundingBox();
      expect(moved).not.toBeNull();
      expect(movedTimeline).not.toBeNull();
      const movedOffset = (moved?.y ?? 0) - (movedTimeline?.y ?? 0);

      await resolveHistory.dispatchEvent('click');
      await expectLoggedEvent(harness, 'onloadhistory');
      await expect
        .poll(async () => {
          const after = await anchor.boundingBox();
          const afterTimeline = await timeline.boundingBox();
          return Math.abs((after?.y ?? 0) - (afterTimeline?.y ?? 0) - movedOffset);
        })
        .toBeLessThan(2);
      await expect(timeline).not.toHaveAttribute('data-cinder-history-restoring');
      await expect
        .poll(async () => timeline.evaluate((element) => getComputedStyle(element).overflowAnchor))
        .toBe('auto');
      await expect(
        timeline.locator('.chat-message').filter({ hasText: 'Tell me about alpha.' }).first(),
      ).toBeFocused();
    } finally {
      await dispose();
    }
  });

  test('a delayed history load restores focus after its trigger is enabled', async ({
    browser,
  }) => {
    const { harness, dispose } = await openHarness(browser);
    try {
      await harness.locator('#t-history').click();
      await harness.locator('#t-history-delay').click();
      await harness.locator('[data-testid="seed-thread"]').click();

      const timeline = harness.locator('.chat-timeline');
      await harness.locator('[data-testid="scroll-top"]').click();
      const trigger = timeline.getByRole('button', { name: /load earlier messages/i });
      await trigger.click();
      const resolveHistory = harness.locator('[data-testid="resolve-history"]');
      await expect(resolveHistory).toBeEnabled();
      await resolveHistory.dispatchEvent('click');

      await expectLoggedEvent(harness, 'onloadhistory');
      await expect(trigger).toBeEnabled();
      await expect(trigger).toBeFocused();
    } finally {
      await dispose();
    }
  });

  test('a delayed history load does not steal focus from search', async ({ browser }) => {
    const { page, harness, dispose } = await openHarness(browser);
    try {
      await harness.locator('#t-history').click();
      await harness.locator('#t-history-delay').click();
      await harness.locator('[data-testid="seed-thread"]').click();

      const timeline = harness.locator('.chat-timeline');
      await harness.locator('[data-testid="scroll-top"]').click();
      const trigger = timeline.getByRole('button', { name: /load earlier messages/i });
      await trigger.click();
      const resolveHistory = harness.locator('[data-testid="resolve-history"]');
      await expect(resolveHistory).toBeEnabled();

      await timeline.click();
      await page.keyboard.press('ControlOrMeta+f');
      const searchInput = harness.locator('.chat-search-input');
      await expect(searchInput).toBeFocused();
      await resolveHistory.dispatchEvent('click');

      await expectLoggedEvent(harness, 'onloadhistory');
      await expect(trigger).toBeEnabled();
      await expect(searchInput).toBeFocused();
    } finally {
      await dispose();
    }
  });

  test('clearing cancels delayed history before a fresh load', async ({ browser }) => {
    const { page, harness, dispose } = await openHarness(browser);
    try {
      await harness.locator('#t-history').click();
      await harness.locator('#t-history-delay').click();
      await harness.locator('[data-testid="seed-thread"]').click();

      const timeline = harness.locator('.chat-timeline');
      await harness.locator('[data-testid="scroll-top"]').click();
      await timeline.getByRole('button', { name: /load earlier messages/i }).click();
      await expect(harness.locator('[data-testid="resolve-history"]')).toBeEnabled();

      await harness.locator('[data-testid="clear"]').click();
      await page.evaluate(
        () =>
          new Promise<void>((resolve) => {
            requestAnimationFrame(() => resolve());
          }),
      );
      await expect(timeline.getByText(/Earlier context/)).toHaveCount(0);
      await expect(
        harness.locator('[data-testid="event-log-entry"][data-event="onloadhistory"]'),
      ).toHaveCount(0);

      await harness.locator('[data-testid="seed-thread"]').click();
      await harness.locator('[data-testid="scroll-top"]').click();
      await timeline.getByRole('button', { name: /load earlier messages/i }).click();

      await expectLoggedEvent(harness, 'onloadhistory');
      await expect(timeline.getByText('Earlier context 1.1')).toBeVisible();
    } finally {
      await dispose();
    }
  });

  test('continued user scrolling wins over non-virtualized history stabilization', async ({
    browser,
  }) => {
    const { harness, dispose } = await openHarness(browser);
    try {
      await harness.locator('#t-history').click();
      await harness.locator('#t-history-delay').click();
      await harness.locator('[data-testid="seed-thread"]').click();

      const timeline = harness.locator('.chat-timeline');
      await harness.locator('[data-testid="scroll-top"]').click();
      await timeline.getByRole('button', { name: /load earlier messages/i }).click();
      await expect(harness.locator('[data-testid="resolve-history"]')).toBeEnabled();
      const previousScrollHeight = await timeline.evaluate((element) => element.scrollHeight);
      await harness.locator('[data-testid="resolve-history"]').click();
      await expectLoggedEvent(harness, 'onloadhistory');
      await expect
        .poll(async () => timeline.evaluate((element) => element.scrollHeight))
        .toBeGreaterThan(previousScrollHeight);
      await timeline.dispatchEvent('pointerdown');
      await timeline.evaluate((element) => {
        element.scrollTop = element.scrollHeight;
        element.dispatchEvent(new Event('scroll'));
      });

      await timeline.evaluate(
        () =>
          new Promise<void>((resolve) => {
            let frames = 0;
            const wait = () => {
              frames += 1;
              if (frames >= 8) resolve();
              else requestAnimationFrame(wait);
            };
            requestAnimationFrame(wait);
          }),
      );
      await expect
        .poll(async () =>
          timeline.evaluate((element) =>
            Math.abs(element.scrollHeight - element.clientHeight - element.scrollTop),
          ),
        )
        .toBeLessThan(2);
    } finally {
      await dispose();
    }
  });

  test('a no-op gesture expires before later history stabilization', async ({ browser }) => {
    const { harness, dispose } = await openHarness(browser);
    try {
      await harness.locator('#t-history').click();
      await harness.locator('#t-history-delay').click();
      await harness.locator('[data-testid="seed-thread"]').click();

      const timeline = harness.locator('.chat-timeline');
      await harness.locator('[data-testid="scroll-top"]').click();
      const anchor = timeline
        .locator('.chat-message')
        .filter({ hasText: 'Tell me about alpha.' })
        .first();
      await expect(anchor).toBeVisible();
      await expect
        .poll(async () => {
          const [anchorBox, timelineBox] = await Promise.all([
            anchor.boundingBox(),
            timeline.boundingBox(),
          ]);
          return anchorBox !== null && timelineBox !== null;
        })
        .toBe(true);
      const before = await anchor.boundingBox();
      const beforeTimeline = await timeline.boundingBox();
      expect(before).not.toBeNull();
      expect(beforeTimeline).not.toBeNull();
      const beforeOffset = (before?.y ?? 0) - (beforeTimeline?.y ?? 0);

      await timeline.getByRole('button', { name: /load earlier messages/i }).click();
      await expect(harness.locator('[data-testid="resolve-history"]')).toBeEnabled();
      await timeline.dispatchEvent('pointerdown');
      await timeline.evaluate(() => {
        document.querySelector<HTMLButtonElement>('[data-testid="resolve-history"]')?.click();
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            const firstMessage = document.querySelector<HTMLElement>('.chat-message-wrapper');
            if (firstMessage) firstMessage.style.minHeight = '12rem';
          });
        });
      });

      await expectLoggedEvent(harness, 'onloadhistory');
      await timeline.evaluate(
        () =>
          new Promise<void>((resolve) => {
            let frames = 0;
            const wait = () => {
              frames += 1;
              if (frames >= 8) resolve();
              else requestAnimationFrame(wait);
            };
            requestAnimationFrame(wait);
          }),
      );
      await expect
        .poll(async () => {
          const after = await anchor.boundingBox();
          const afterTimeline = await timeline.boundingBox();
          return Math.abs((after?.y ?? 0) - (afterTimeline?.y ?? 0) - beforeOffset);
        })
        .toBeLessThan(2);
    } finally {
      await dispose();
    }
  });

  test('jumping to latest invalidates a pending non-virtualized history anchor', async ({
    browser,
  }) => {
    const { harness, dispose } = await openHarness(browser);
    try {
      await harness.locator('#t-history').click();
      await harness.locator('#t-history-delay').click();
      await harness.locator('[data-testid="seed-thread"]').click();

      const timeline = harness.locator('.chat-timeline');
      await harness.locator('[data-testid="scroll-top"]').click();
      await timeline.getByRole('button', { name: /load earlier messages/i }).click();
      const resolveHistory = harness.locator('[data-testid="resolve-history"]');
      await expect(resolveHistory).toBeEnabled();
      await harness.locator('.chat-jump-button').click();
      await resolveHistory.dispatchEvent('click');

      await expectLoggedEvent(harness, 'onloadhistory');
      await expect
        .poll(async () =>
          timeline.evaluate((element) =>
            Math.abs(element.scrollHeight - element.clientHeight - element.scrollTop),
          ),
        )
        .toBeLessThan(2);
    } finally {
      await dispose();
    }
  });

  test('an arriving prepend wins over a queued anchor recapture', async ({ browser }) => {
    const { harness, dispose } = await openHarness(browser);
    try {
      await harness.locator('#t-history').click();
      await harness.locator('#t-history-delay').click();
      await harness.locator('[data-testid="seed-thread"]').click();

      const timeline = harness.locator('.chat-timeline');
      await harness.locator('[data-testid="scroll-top"]').click();
      await timeline.getByRole('button', { name: /load earlier messages/i }).click();
      await expect(harness.locator('[data-testid="resolve-history"]')).toBeEnabled();
      await timeline.evaluate((element) => {
        element.scrollTop = 120;
        element.dispatchEvent(new Event('scroll'));
        document.querySelector<HTMLButtonElement>('[data-testid="resolve-history"]')?.click();
      });

      await expectLoggedEvent(harness, 'onloadhistory');
      await expect(timeline).not.toHaveAttribute('data-cinder-history-restoring');
      await expect
        .poll(async () => timeline.evaluate((element) => getComputedStyle(element).overflowAnchor))
        .toBe('auto');
    } finally {
      await dispose();
    }
  });

  test('search navigation wins over non-virtualized history stabilization', async ({ browser }) => {
    const { page, harness, dispose } = await openHarness(browser);
    try {
      await harness.locator('#t-history').click();
      await harness.locator('#t-history-delay').click();
      await harness.locator('[data-testid="seed-thread"]').click();

      const timeline = harness.locator('.chat-timeline');
      await timeline.click();
      await page.keyboard.press('ControlOrMeta+f');
      await expect(harness.locator('.chat-search-input')).toBeVisible();
      await harness.locator('[data-testid="scroll-top"]').click();
      await timeline.getByRole('button', { name: /load earlier messages/i }).click();
      await expect(harness.locator('[data-testid="resolve-history"]')).toBeEnabled();

      await timeline.evaluate(() => {
        document.querySelector<HTMLButtonElement>('[data-testid="resolve-history"]')?.click();
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            const input = document.querySelector<HTMLInputElement>('.chat-search-input');
            if (!input) return;
            input.value = 'Detailed answer number 12';
            input.dispatchEvent(new Event('input', { bubbles: true }));
          });
        });
      });

      const target = timeline
        .locator('.chat-message-wrapper[data-search-match]')
        .filter({ hasText: 'Detailed answer number 12, with alpha context.' });
      await expectLoggedEvent(harness, 'onloadhistory');
      await expect(target).toBeAttached();
      await timeline.evaluate(
        () =>
          new Promise<void>((resolve) => {
            let frames = 0;
            const wait = () => {
              frames += 1;
              if (frames >= 8) resolve();
              else requestAnimationFrame(wait);
            };
            requestAnimationFrame(wait);
          }),
      );
      await expect(target).toBeInViewport();
    } finally {
      await dispose();
    }
  });

  test('non-virtualized history loading preserves the visible scroll anchor', async ({
    browser,
  }) => {
    const { harness, dispose } = await openHarness(browser);
    try {
      await harness.locator('#t-history').click();
      await harness.locator('[data-testid="seed-thread"]').click();

      const timeline = harness.locator('.chat-timeline');
      await harness.locator('[data-testid="scroll-top"]').click();
      await expect
        .poll(async () => timeline.evaluate((element) => getComputedStyle(element).overflowAnchor))
        .toBe('auto');
      const anchor = timeline.getByText('Tell me about alpha.').first();
      await expect(anchor).toBeVisible();
      const readAnchorOffset = () =>
        timeline.evaluate((timelineElement) => {
          const anchorElement = [...timelineElement.querySelectorAll<HTMLElement>('*')].find(
            (element) => element.textContent?.trim() === 'Tell me about alpha.',
          );
          if (anchorElement === undefined) throw new Error('Anchor message not found');
          return (
            anchorElement.getBoundingClientRect().y - timelineElement.getBoundingClientRect().y
          );
        });
      const beforeOffset = await readAnchorOffset();

      await timeline.getByRole('button', { name: /load earlier messages/i }).dispatchEvent('click');
      await expectLoggedEvent(harness, 'onloadhistory');
      await expect(anchor).toBeVisible();
      await expect
        .poll(async () => {
          return Math.abs((await readAnchorOffset()) - beforeOffset);
        })
        .toBeLessThan(2);
      await expect
        .poll(async () => timeline.evaluate((element) => element.scrollTop))
        .toBeGreaterThan(0);
      await expect
        .poll(async () => timeline.evaluate((element) => getComputedStyle(element).overflowAnchor))
        .toBe('auto');
    } finally {
      await dispose();
    }
  });
});

test.describe('chat harness — imperative scroll + focus controls', () => {
  test('scroll-to-top / scroll-to-bottom move the timeline; focus-input focuses the composer', async ({
    browser,
  }) => {
    const { harness, dispose } = await openHarness(browser);
    try {
      await harness.locator('[data-testid="seed-thread"]').click();
      const timeline = harness.locator('.chat-timeline');
      await harness.locator('[data-testid="scroll-top"]').click();
      await expect.poll(async () => timeline.evaluate((element) => element.scrollTop)).toBe(0);
      await harness.locator('[data-testid="scroll-bottom"]').click();
      await expect
        .poll(async () => timeline.evaluate((element) => element.scrollTop))
        .toBeGreaterThan(0);

      await harness.locator('[data-testid="focus-input"]').click();
      const focusedInsideComposer = await harness.evaluate((root) => {
        const active = (root.ownerDocument ?? document).activeElement;
        return (
          active !== null && root.querySelector('.chat-input-editor')?.contains(active) === true
        );
      });
      expect(focusedInsideComposer).toBe(true);
    } finally {
      await dispose();
    }
  });

  // Regression for cinder#1236: on a long VIRTUALIZED transcript pinned to
  // the bottom, scrollToTop() was a no-op (or a snap-back) with real smooth
  // scrolling. The auto-stick effect's instant bottom corrections leave stale
  // scroll/scrollend events in flight at the bottom; one of them settled the
  // user-scroll guard milliseconds into the animation, and the next
  // virtualizer remeasurement re-pinned the viewport to the bottom. This test
  // deliberately runs WITHOUT reducedMotion: 'reduce' (unlike openHarness):
  // the bug only reproduces when behavior: 'smooth' produces a real,
  // interruptible animation.
  test('scrollToTop and scrollToBottom navigate a long virtualized transcript with smooth scrolling', async ({
    browser,
  }) => {
    const context = await browser.newContext({
      baseURL: PLAYGROUND_URL,
      colorScheme: 'dark',
      // Explicit, not defaulted: this test is only meaningful when
      // behavior: 'smooth' produces a real, interruptible animation. A
      // config- or environment-level reduced-motion default would silently
      // downgrade it to an instant scroll and stop covering the regression.
      reducedMotion: 'no-preference',
      viewport: { width: 1280, height: 900 },
    });
    try {
      const page = await context.newPage();
      await page.goto(
        `/page/chat?fixture=private-harness&fixtureContentHash=${PRIVATE_HARNESS_FIXTURE_HASH}`,
        { waitUntil: 'load' },
      );
      await page.waitForSelector('#app > *', { state: 'visible', timeout: 20_000 });
      const harness = page.locator(HARNESS);
      await harness.waitFor({ state: 'visible', timeout: 20_000 });

      await harness.locator('#t-virtualized').click();
      await harness.locator('[data-testid="seed-long"]').click();
      const timeline = harness.locator('.chat-timeline');
      // The transcript starts pinned to the bottom with the last rows rendered.
      await expect(timeline.getByText('Answer 150:').first()).toBeVisible({ timeout: 10_000 });
      await expect
        .poll(async () => timeline.evaluate((element) => element.scrollTop))
        .toBeGreaterThan(0);

      await harness.locator('[data-testid="scroll-top"]').click();
      await expect
        .poll(async () => timeline.evaluate((element) => element.scrollTop), { timeout: 10_000 })
        .toBe(0);
      await expect(timeline.getByText('Question 1: tell me about alpha.').first()).toBeVisible();

      await harness.locator('[data-testid="scroll-bottom"]').click();
      await expect
        .poll(
          async () =>
            timeline.evaluate(
              (element) => element.scrollHeight - element.scrollTop - element.clientHeight,
            ),
          { timeout: 10_000 },
        )
        .toBeLessThan(50);
      await expect(timeline.getByText('Answer 150:').first()).toBeVisible();
    } finally {
      await context.close();
    }
  });
});

test.describe('chat harness — attachments', () => {
  test('an accepted file fires onattachmentadd; a disallowed file fires onattachmentfailure', async ({
    browser,
  }) => {
    const { harness, dispose } = await openHarness(browser);
    try {
      const fileInput = harness.locator('input[type="file"]');
      // Accepted: an image (the composer accepts images by default).
      await fileInput.setInputFiles({
        name: 'pic.png',
        mimeType: 'image/png',
        buffer: Buffer.from([0x89, 0x50, 0x4e, 0x47]),
      });
      await expectLoggedEvent(harness, 'onattachmentadd');

      // Disallowed MIME → the composer's own validation fires onattachmentfailure.
      await fileInput.setInputFiles({
        name: 'evil.exe',
        mimeType: 'application/x-msdownload',
        buffer: Buffer.from([0x4d, 0x5a]),
      });
      await expectLoggedEvent(harness, 'onattachmentfailure');
    } finally {
      await dispose();
    }
  });
});

test.describe('chat harness — accessibility', () => {
  test('the harnessed chat exposes log + region roles and has no critical axe violations', async ({
    browser,
  }) => {
    const { page, harness, dispose } = await openHarness(browser);
    try {
      await harness.locator('[data-testid="seed-thread"]').click();
      await expect(harness.locator('[role="region"]')).toBeVisible();
      await expect(harness.locator('[role="log"]')).toBeVisible();

      // Audit the Chat component under test specifically (not the demo control
      // panel, which is harness scaffolding rather than a cinder surface).
      const buckets = await runAxe(
        page,
        { slug: 'chat', theme: 'dark', viewport: 'desktop', fixture: 'interactive-harness' },
        { include: `${HARNESS} #harness-chat` },
      );
      expect(buckets.critical, JSON.stringify(buckets.critical, null, 2)).toHaveLength(0);
      expect(buckets.serious, JSON.stringify(buckets.serious, null, 2)).toHaveLength(0);
    } finally {
      await dispose();
    }
  });
});

// Regression suite for #1237's reopened symptoms, driven against the
// `history-prepend-stress` example: an adapter-mode load-earlier flow inside
// a full-height app shell whose header content (an event log line) grows when
// a load completes — the same geometry as the downstream repro. Three loads
// walk through every trigger state: idle → loading → idle, and finally
// idle → unmounted (last page, hasMore: false).
test.describe('chat harness — history prepend stress (#1237)', () => {
  const STRESS = '[data-testid="chat-private-history-prepend-stress"]';

  test('adapter prepend never presents an uncompensated anchor to the compositor', async ({
    browser,
  }) => {
    test.setTimeout(120_000);
    const context = await browser.newContext({
      baseURL: PLAYGROUND_URL,
      colorScheme: 'dark',
      reducedMotion: 'no-preference',
      viewport: { width: 1280, height: 900 },
    });
    const page = await context.newPage();
    const session = await context.newCDPSession(page);
    let screencastStarted = false;
    try {
      await page.goto(
        `/page/chat?snapshot=1&fixture=private-history-prepend-stress&fixtureContentHash=${PRIVATE_HISTORY_PREPEND_STRESS_FIXTURE_HASH}`,
        { waitUntil: 'load' },
      );
      const mount = page.locator(STRESS);
      await mount.waitFor({ state: 'visible', timeout: 20_000 });
      await mount.scrollIntoViewIfNeeded();
      const timeline = mount.locator('.chat-timeline');

      await mount.locator('[data-testid="stress-scroll-top"]').click();
      await expect.poll(async () => timeline.evaluate((element) => element.scrollTop)).toBe(0);
      await page.waitForTimeout(400);

      const anchorMarkerObserver = await timeline.evaluateHandle((element) => {
        const markAnchor = () => {
          const anchor = Array.from(element.querySelectorAll('.chat-message-body')).find(
            (candidate) => candidate.textContent?.trimStart().startsWith('Live message 1 —'),
          );
          anchor?.setAttribute('data-cinder-paint-anchor', '');
        };
        markAnchor();
        const observer = new MutationObserver(markAnchor);
        observer.observe(element, { childList: true, subtree: true });
        return observer;
      });

      // Paint two high-contrast rulers into the real surface: cyan at the
      // timeline's top edge and magenta across the retained message. CDP's
      // screencast event is emitted from compositor presentations, so unlike
      // a DOM read inside requestAnimationFrame this observes what Chromium
      // actually displayed.
      await page.addStyleTag({
        content: `
          .chat-timeline { box-shadow: inset 0 5px 0 rgb(0 255 255) !important; }
          [data-cinder-paint-anchor] {
            background: rgb(255 0 255) !important;
            border-color: rgb(255 0 255) !important;
            color: rgb(255 0 255) !important;
          }
        `,
      });

      const measureFrame = (data: Buffer): number | null => {
        const image = PNG.sync.read(data);
        let timelineTop = -1;
        let anchorTop = -1;

        for (let y = 0; y < image.height; y += 1) {
          let cyanPixels = 0;
          let magentaPixels = 0;
          for (let x = 0; x < image.width; x += 1) {
            const pixel = (y * image.width + x) * 4;
            const red = image.data[pixel] ?? 0;
            const green = image.data[pixel + 1] ?? 0;
            const blue = image.data[pixel + 2] ?? 0;
            if (timelineTop < 0 && red < 30 && green > 225 && blue > 225) {
              cyanPixels += 1;
              if (cyanPixels > 100) timelineTop = y;
            }
            if (anchorTop < 0 && red > 225 && green < 30 && blue > 225) {
              magentaPixels += 1;
              if (magentaPixels > 100) anchorTop = y;
            }
            if (timelineTop >= 0 && anchorTop >= 0) break;
          }
          if (timelineTop >= 0 && anchorTop >= 0) break;
        }

        return timelineTop >= 0 && anchorTop >= 0 ? anchorTop - timelineTop : null;
      };
      const baseline = measureFrame(await page.screenshot());
      expect(baseline).not.toBeNull();

      const samples: Array<number | null> = [];
      let imageProcessing = Promise.resolve();
      const handleScreencastFrame = (event: { data: string; sessionId: number }) => {
        void session.send('Page.screencastFrameAck', { sessionId: event.sessionId }).catch(() => {
          // A final frame can race Page.stopScreencast during test cleanup.
        });
        imageProcessing = imageProcessing.then(() => {
          samples.push(measureFrame(Buffer.from(event.data, 'base64')));
        });
      };
      session.on('Page.screencastFrame', handleScreencastFrame);
      await session.send('Page.startScreencast', {
        everyNthFrame: 1,
        format: 'png',
        maxHeight: 900,
        maxWidth: 1280,
      });
      screencastStarted = true;

      const paintProbe = await page.evaluateHandle(() => {
        const probe = document.createElement('div');
        probe.style.cssText =
          'position:fixed;left:0;top:0;width:50px;height:50px;z-index:2147483647;pointer-events:none';
        document.body.append(probe);
        let frame = 0;
        return setInterval(() => {
          probe.style.background = frame++ % 2 === 0 ? 'black' : 'white';
        }, 16);
      });
      try {
        await timeline
          .getByRole('button', { name: /load earlier messages/i })
          .dispatchEvent('click');
        await expect(mount.locator('[data-testid="stress-message-count"]')).toHaveText(
          'messages: 64',
        );
        await page.waitForTimeout(500);
        await session.send('Page.stopScreencast');
        screencastStarted = false;
        session.off('Page.screencastFrame', handleScreencastFrame);
        await imageProcessing;

        expect(samples.length).toBeGreaterThan(2);
        for (const sample of samples) {
          expect(sample).not.toBeNull();
          expect(Math.abs((sample ?? 0) - (baseline ?? 0))).toBeLessThanOrEqual(2);
        }
      } finally {
        await page.evaluate((interval) => clearInterval(interval), paintProbe);
        await paintProbe.dispose();
        await anchorMarkerObserver.evaluate((observer) => observer.disconnect());
        await anchorMarkerObserver.dispose();
        if (screencastStarted) {
          await session.send('Page.stopScreencast');
          screencastStarted = false;
        }
        session.off('Page.screencastFrame', handleScreencastFrame);
      }
    } finally {
      if (screencastStarted) await session.send('Page.stopScreencast');
      await context.close();
    }
  });

  test('adapter prepends at scrollTop=0 hold the anchor at every animation-frame checkpoint', async ({
    browser,
  }) => {
    test.setTimeout(120_000);
    const context = await browser.newContext({
      baseURL: PLAYGROUND_URL,
      colorScheme: 'dark',
      reducedMotion: 'no-preference',
      viewport: { width: 1280, height: 900 },
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
    try {
      await page.goto(
        `/page/chat?snapshot=1&fixture=private-history-prepend-stress&fixtureContentHash=${PRIVATE_HISTORY_PREPEND_STRESS_FIXTURE_HASH}`,
        { waitUntil: 'load' },
      );
      await page.waitForSelector('#app > *', { state: 'visible', timeout: 20_000 });
      const mount = page.locator(STRESS);
      await mount.waitFor({ state: 'visible', timeout: 20_000 });
      await mount.scrollIntoViewIfNeeded();
      const timeline = mount.locator('.chat-timeline');

      // Three pages: the first two swap the trigger idle → loading → idle,
      // the third also unmounts it (hasMore: false) after the restore.
      for (let load = 0; load < 3; load += 1) {
        await mount.locator('[data-testid="stress-scroll-bottom"]').click();
        await page.waitForTimeout(600);
        await mount.locator('[data-testid="stress-scroll-top"]').click();
        await expect.poll(async () => timeline.evaluate((element) => element.scrollTop)).toBe(0);
        await page.waitForTimeout(400);

        // Sample the anchor's viewport-relative offset on EVERY animation
        // frame. The restore must land in the same rendered frame as the
        // prepend — a single frame showing the anchor shifted is the visible
        // flash this test exists to prevent.
        const preloadBaseline = await timeline.evaluate((element) => {
          const w = window as unknown as {
            __anchorSamples?: number[];
            __anchorStop?: boolean;
          };
          w.__anchorSamples = [];
          w.__anchorStop = false;
          const measure = (): number | null => {
            const target = Array.from(element.querySelectorAll('.chat-message-body')).find(
              (candidate) => candidate.textContent?.trimStart().startsWith('Live message 5 —'),
            );
            if (!target) return null;
            return target.getBoundingClientRect().top - element.getBoundingClientRect().top;
          };
          // Seed the series SYNCHRONOUSLY. `evaluate` resolves the moment this
          // body returns, so the requestAnimationFrame below only SCHEDULES
          // the first sample — nothing forces a frame boundary before the
          // click dispatched two statements later, and the click routinely
          // wins. When it does, samples[0] is a POST-restore reading (the
          // stress example is non-virtualized and prepends synchronously
          // inside the dispatch, and the non-virtualized restore lands in the
          // same microtask flush), so a regression that anchors at a
          // wrong-but-stable offset just moves the baseline with it and every
          // comparison below passes vacuously.
          const initial = measure();
          if (initial !== null) w.__anchorSamples.push(initial);
          const sample = () => {
            if (w.__anchorStop) return;
            const offset = measure();
            if (offset !== null) w.__anchorSamples!.push(offset);
            requestAnimationFrame(sample);
          };
          requestAnimationFrame(sample);
          return initial;
        });
        // A missed lookup would silently slide the baseline to a later frame.
        expect(preloadBaseline).not.toBeNull();
        // And at least one genuinely PAINTED pre-prepend frame must be in the
        // series before the prepend is triggered.
        await expect
          .poll(async () =>
            page.evaluate(
              () =>
                (window as unknown as { __anchorSamples?: number[] }).__anchorSamples?.length ?? 0,
            ),
          )
          .toBeGreaterThan(1);

        // dispatchEvent rather than .click(): the trigger sits at the top of
        // the transcript and Playwright's click would scroll on its own.
        await timeline
          .getByRole('button', { name: /load earlier messages/i })
          .dispatchEvent('click');
        await expect(mount.locator('[data-testid="stress-message-count"]')).toHaveText(
          `messages: ${60 + (load + 1) * 4}`,
        );
        await page.waitForTimeout(500);

        const samples = await page.evaluate(() => {
          const w = window as unknown as {
            __anchorSamples?: number[];
            __anchorStop?: boolean;
          };
          w.__anchorStop = true;
          return w.__anchorSamples ?? [];
        });
        expect(samples.length).toBeGreaterThan(5);
        const baseline = samples[0]!;
        for (const sample of samples) {
          expect(Math.abs(sample - baseline)).toBeLessThanOrEqual(2);
        }
        expect(Math.abs(samples[samples.length - 1]! - baseline)).toBeLessThanOrEqual(1);
      }

      // The final page reported hasMore: false — the trigger is gone and the
      // anchored content stayed put through its unmount.
      await expect(timeline.getByRole('button', { name: /load earlier messages/i })).toHaveCount(0);
    } finally {
      await context.close();
    }
  });
});
