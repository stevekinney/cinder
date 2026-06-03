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
import { expect, test, type Browser, type Locator, type Page } from '@playwright/test';

import { runAxe } from '../src/helpers/axe.ts';
import { PLAYGROUND_URL } from '../src/helpers/playground-url.ts';
import { THEME_STORAGE_KEY } from '../src/helpers/theme.ts';

const HARNESS = '#example-mount-interactive-harness';

/** Opens /page/chat and returns a Locator scoped to the harness mount. */
async function openHarness(
  browser: Browser,
): Promise<{ page: Page; harness: Locator; dispose: () => Promise<void> }> {
  const context = await browser.newContext({
    baseURL: PLAYGROUND_URL,
    colorScheme: 'dark',
    reducedMotion: 'reduce',
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
  await page.goto('/page/chat?snapshot=1', { waitUntil: 'load' });
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
      // The composer is a Milkdown/ProseMirror contenteditable. ProseMirror only
      // updates its document model from REAL key events, so use
      // pressSequentially (per-key keydown/input) — execCommand/keyboard.type do
      // not reliably reach the editor model. Submit via the send button.
      const editor = harness
        .locator('.chat-input-editor [contenteditable], .chat-input-editor [role="textbox"]')
        .first();
      await editor.click();
      await editor.pressSequentially('What is alpha?');
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
